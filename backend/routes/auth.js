const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { generateToken } = require('../middleware/auth');

// ── Honeypot check ────────────────────────────────────────────
// Le champ "website" est caché CSS — les bots le remplissent, les humains non
function checkHoneypot(req, res, next) {
  const { website } = req.body;
  if (website && website.trim() !== '') {
    // Bot détecté : on répond comme si tout allait bien (ne pas alerter)
    console.warn(`[HONEYPOT] Bot détecté depuis ${req.ip} — champ piège rempli : "${website}"`);
    // Délai artificiel pour ralentir les bots
    return setTimeout(() => res.status(400).json({ error: 'Données invalides' }), 2000);
  }
  next();
}

// ── Rate limiters ─────────────────────────────────────────────

// Login : 5 tentatives max par IP sur 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Ne compte pas les connexions réussies
  handler: (req, res) => {
    const retry = Math.ceil(req.rateLimit.resetTime / 1000 - Date.now() / 1000 / 60);
    console.warn(`[RATE LIMIT] Login bloqué pour ${req.ip}`);
    res.status(429).json({
      error: `Trop de tentatives. Réessayez dans ${Math.ceil((req.rateLimit.resetTime - Date.now()) / 60000)} minute(s).`,
    });
  },
});

// Inscription : 3 comptes max par IP par heure
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[RATE LIMIT] Register bloqué pour ${req.ip}`);
    res.status(429).json({
      error: 'Trop d\'inscriptions depuis cette adresse. Réessayez dans une heure.',
    });
  },
});

// ── Lockout progressif ────────────────────────────────────────
// Délais selon le nombre d'échecs consécutifs sur le compte
const LOCKOUT_SCHEDULE = [
  { attempts: 3, minutes: 1  },
  { attempts: 4, minutes: 5  },
  { attempts: 5, minutes: 30 },
  { attempts: 8, minutes: 60 * 24 }, // 24h après 8 échecs
];

function getLockDuration(attempts) {
  const rule = [...LOCKOUT_SCHEDULE].reverse().find(r => attempts >= r.attempts);
  return rule ? rule.minutes : 0;
}

// ── POST /rpg/api/auth/register ───────────────────────────────
router.post('/register', registerLimiter, checkHoneypot, async (req, res) => {
  const { username, email, password, invite_code } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ error: 'Champs requis manquants' });
  if (!invite_code || invite_code.trim().length < 4)
    return res.status(400).json({ error: 'Code d\'invitation requis' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Mot de passe trop court (min 8 caractères)' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Email invalide' });
  if (username.trim().length < 3)
    return res.status(400).json({ error: 'Nom d\'utilisateur trop court (min 3 caractères)' });

  try {
    // Vérifier que le code d'invitation existe et appartient à un compte actif
    const inviterResult = await db.query(
      'SELECT id, username FROM users WHERE upper(invite_code) = upper($1)',
      [invite_code.trim()]
    );
    if (!inviterResult.rows[0])
      return res.status(400).json({ error: 'Code d\'invitation invalide ou inexistant' });

    const inviter = inviterResult.rows[0];
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, invited_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, invite_code, created_at`,
      [username.trim(), email.toLowerCase().trim(), hash, inviter.id]
    );
    const user = result.rows[0];
    const token = generateToken(user);
    console.info(`[AUTH] Nouveau compte : ${user.username} (${user.email}) invité par ${inviter.username} depuis ${req.ip}`);
    res.status(201).json({ user, token });
  } catch (err) {
    if (err.code === '23505') {
      const field = err.constraint?.includes('email') ? 'email' : 'username';
      return res.status(409).json({ error: `Ce ${field} est déjà utilisé` });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /rpg/api/auth/login ──────────────────────────────────
router.post('/login', loginLimiter, checkHoneypot, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const result = await db.query(
      `SELECT id, username, email, password_hash, avatar_url,
              failed_attempts, locked_until, is_admin, invite_code, tier
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];

    // ── Compte inconnu : on fait quand même bcrypt pour éviter le timing attack
    if (!user) {
      await bcrypt.compare(password, '$2a$12$dummyhashtopreventtimingattacksXXXXXXXXXXXXXXXXXXXXXXX');
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // ── Vérifier le lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      console.warn(`[LOCKOUT] Tentative sur compte bloqué : ${user.email} depuis ${req.ip}`);
      return res.status(429).json({
        error: `Compte temporairement bloqué après plusieurs échecs. Réessayez dans ${remaining} minute(s).`,
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      // ── Incrémenter les échecs + calculer le nouveau lockout
      const newAttempts = (user.failed_attempts || 0) + 1;
      const lockMinutes = getLockDuration(newAttempts);
      const lockedUntil = lockMinutes
        ? new Date(Date.now() + lockMinutes * 60 * 1000)
        : null;

      await db.query(
        'UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3',
        [newAttempts, lockedUntil, user.id]
      );

      console.warn(`[AUTH] Échec login : ${user.email} — tentative ${newAttempts} depuis ${req.ip}`);

      let message = 'Email ou mot de passe incorrect';
      if (lockMinutes) {
        message += `. Compte bloqué pendant ${lockMinutes} minute(s) après ${newAttempts} échecs.`;
      } else {
        const remaining = LOCKOUT_SCHEDULE[0].attempts - newAttempts;
        if (remaining > 0) message += ` (${remaining} tentative(s) restante(s) avant blocage)`;
      }

      return res.status(401).json({ error: message });
    }

    // ── Connexion réussie : réinitialiser les compteurs
    await db.query(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
      [user.id]
    );

    const { password_hash, failed_attempts, locked_until, ...safeUser } = user;
    const token = generateToken(safeUser);
    console.info(`[AUTH] Login réussi : ${user.username} depuis ${req.ip}`);
    res.json({ user: safeUser, token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /rpg/api/auth/me ──────────────────────────────────────
router.get('/me', require('../middleware/auth').authMiddleware, async (req, res) => {
  try {
      const result = await db.query(
        'SELECT id, username, email, avatar_url, created_at, last_login, invite_code, is_admin, tier FROM users WHERE id = $1',
        [req.user.id]
      );
    if (!result.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
