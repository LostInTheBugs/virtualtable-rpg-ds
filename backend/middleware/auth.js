const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, is_admin: !!user.is_admin, tier: user.tier || 'player' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Vérifie que l'utilisateur a au moins le tier requis
function requireTier(minTier) {
  const tiers = ['player', 'creator', 'ai_gm', 'admin'];
  return async (req, res, next) => {
    const userTier = req.user?.tier || 'player';
    const userIdx = tiers.indexOf(userTier);
    const minIdx = tiers.indexOf(minTier);
    if (userIdx >= minIdx) { next(); return; }
    // Fallback DB pour tokens anciens
    try {
      const r = await db.query('SELECT tier FROM users WHERE id = $1', [req.user?.id]);
      const dbTier = r.rows[0]?.tier || 'player';
      if (tiers.indexOf(dbTier) >= minIdx) { req.user.tier = dbTier; next(); return; }
    } catch {}
    return res.status(403).json({ error: 'Accès refusé — niveau d\'accès insuffisant' });
  };
}

async function adminMiddleware(req, res, next) {
  // Vérifie d'abord le token, puis la DB pour les tokens anciens
  if (req.user?.is_admin) { next(); return; }
  try {
    const r = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user?.id]);
    if (r.rows[0]?.is_admin) { next(); return; }
    // Vérifier aussi le tier
    const t = await db.query('SELECT tier FROM users WHERE id = $1', [req.user?.id]);
    if (t.rows[0]?.tier === 'admin') { next(); return; }
  } catch {}
  return res.status(403).json({ error: 'Accès refusé — admin requis' });
}

module.exports = { authMiddleware, adminMiddleware, generateToken, requireTier };
