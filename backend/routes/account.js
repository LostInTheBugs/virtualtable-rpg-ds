const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Toutes les routes compte requièrent auth
router.use(authMiddleware);

// ── GET /rpg/api/account/me ───────────────────────────────────
// Profil complet de l'utilisateur connecté
router.get('/me', async (req, res) => {
  try {
    const r = await db.query(
      'SELECT id, username, email, avatar_url, invite_code, created_at, last_login FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('[ACCOUNT] me error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── PUT /rpg/api/account/profile ──────────────────────────────
// Modifier username / email / avatar_url
router.put('/profile', async (req, res) => {
  const { username, email, avatar_url } = req.body;
  const sets = [];
  const vals = [];

  if (username !== undefined) {
    if (username.trim().length < 3) return res.status(400).json({ error: 'Nom d\'utilisateur trop court (min 3 caractères)' });
    sets.push(`username = $${sets.length + 1}`); vals.push(username.trim());
  }
  if (email !== undefined) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Email invalide' });
    sets.push(`email = $${sets.length + 1}`); vals.push(email.toLowerCase().trim());
  }
  if (avatar_url !== undefined) {
    sets.push(`avatar_url = $${sets.length + 1}`); vals.push(avatar_url || null);
  }

  if (sets.length === 0) return res.status(400).json({ error: 'Rien à modifier' });

  vals.push(req.user.id);
  try {
    const r = await db.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length}
       RETURNING id, username, email, avatar_url, invite_code`,
      vals
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const field = err.constraint?.includes('email') ? 'email' : 'username';
      return res.status(409).json({ error: `Ce ${field} est déjà utilisé` });
    }
    console.error('[ACCOUNT] profile error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── PUT /rpg/api/account/password ─────────────────────────────
// Changer le mot de passe (nécessite le mot de passe actuel)
router.put('/password', async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Champs requis manquants' });
  if (new_password.length < 8)
    return res.status(400).json({ error: 'Nouveau mot de passe trop court (min 8 caractères)' });

  try {
    const r = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const valid = await bcrypt.compare(current_password, r.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ACCOUNT] password error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /rpg/api/account/owned-campaigns ─────────────────────
// Campagnes dont l'utilisateur est MJ, avec liste des membres pour transfert
router.get('/owned-campaigns', async (req, res) => {
  try {
    const campaigns = await db.query(
      `SELECT ca.id, ca.name,
              COUNT(DISTINCT cm.user_id) AS member_count
       FROM campaigns ca
       LEFT JOIN campaign_members cm ON cm.campaign_id = ca.id
       WHERE ca.owner_id = $1
       GROUP BY ca.id
       ORDER BY ca.name`,
      [req.user.id]
    );

    // Pour chaque campagne, récupérer les membres (hors soi-même) pour le transfert
    const result = [];
    for (const camp of campaigns.rows) {
      const members = await db.query(
        `SELECT u.id, u.username
         FROM campaign_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.campaign_id = $1 AND u.id != $2
         ORDER BY u.username`,
        [camp.id, req.user.id]
      );
      result.push({ ...camp, members: members.rows });
    }
    res.json(result);
  } catch (err) {
    console.error('[ACCOUNT] owned-campaigns error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── DELETE /rpg/api/account ───────────────────────────────────
// Supprimer son propre compte
// Body: {
//   password: string,                     // confirmation mot de passe
//   keep_characters: bool,                // true = mettre user_id à NULL, false = cascade
//   campaign_actions: [                   // une entrée par campagne possédée
//     { campaign_id, action: 'transfer' | 'delete', transfer_to?: userId }
//   ]
// }
router.delete('/', async (req, res) => {
  const { password, keep_characters, campaign_actions = [] } = req.body;

  if (!password) return res.status(400).json({ error: 'Mot de passe requis pour confirmer la suppression' });

  try {
    // 1. Vérifier le mot de passe
    const r = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const valid = await bcrypt.compare(password, r.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe incorrect' });

    // 2. Vérifier les campagnes possédées
    const ownedResult = await db.query(
      'SELECT id FROM campaigns WHERE owner_id = $1', [req.user.id]
    );
    const ownedIds = ownedResult.rows.map(r => r.id);

    // Valider que chaque campagne possédée a une action fournie
    for (const cid of ownedIds) {
      const action = campaign_actions.find(a => a.campaign_id === cid);
      if (!action) return res.status(400).json({ error: `Action requise pour la campagne ${cid}` });
      if (action.action === 'transfer' && !action.transfer_to)
        return res.status(400).json({ error: `Destinataire requis pour le transfert de la campagne ${cid}` });
    }

    // 3. Traiter les campagnes possédées
    for (const action of campaign_actions) {
      if (!ownedIds.includes(action.campaign_id)) continue; // ignorer les campagnes non possédées

      if (action.action === 'delete') {
        await db.query('DELETE FROM campaigns WHERE id = $1 AND owner_id = $2',
          [action.campaign_id, req.user.id]);
      } else if (action.action === 'transfer') {
        // Vérifier que le destinataire est bien membre de la campagne
        const memberCheck = await db.query(
          'SELECT 1 FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
          [action.campaign_id, action.transfer_to]
        );
        if (!memberCheck.rows[0])
          return res.status(400).json({ error: 'Le destinataire n\'est pas membre de la campagne' });
        await db.query('UPDATE campaigns SET owner_id = $1 WHERE id = $2 AND owner_id = $3',
          [action.transfer_to, action.campaign_id, req.user.id]);
      }
    }

    // 4. Gérer les personnages
    if (keep_characters) {
      // Détacher les personnages (user_id → NULL)
      await db.query('UPDATE characters SET user_id = NULL WHERE user_id = $1', [req.user.id]);
    }
    // Si keep_characters = false, la contrainte ON DELETE CASCADE s'en charge automatiquement

    // 5. Supprimer l'utilisateur
    await db.query('DELETE FROM users WHERE id = $1', [req.user.id]);

    console.info(`[ACCOUNT] Compte supprimé : ${req.user.username} (${req.user.email})`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ACCOUNT] delete error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
