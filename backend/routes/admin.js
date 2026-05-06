const router = require('express').Router();
const db = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Toutes les routes admin requièrent auth + is_admin
router.use(authMiddleware, adminMiddleware);

// ── GET /rpg/api/admin/stats ──────────────────────────────────
// Statistiques globales de la plateforme
router.get('/stats', async (req, res) => {
  try {
    const [users, campaigns, characters, messages, tokens, maps] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM campaigns'),
      db.query('SELECT COUNT(*) FROM characters'),
      db.query('SELECT COUNT(*) FROM messages'),
      db.query('SELECT COUNT(*) FROM tokens'),
      db.query('SELECT COUNT(*) FROM maps'),
    ]);
    // Nouvelles inscriptions sur 7 jours
    const newUsers = await db.query(
      `SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'`
    );
    // Comptes verrouillés
    const locked = await db.query(
      `SELECT COUNT(*) FROM users WHERE locked_until > NOW()`
    );
    res.json({
      users:      parseInt(users.rows[0].count),
      campaigns:  parseInt(campaigns.rows[0].count),
      characters: parseInt(characters.rows[0].count),
      messages:   parseInt(messages.rows[0].count),
      tokens:     parseInt(tokens.rows[0].count),
      maps:       parseInt(maps.rows[0].count),
      new_users_7d: parseInt(newUsers.rows[0].count),
      locked_accounts: parseInt(locked.rows[0].count),
    });
  } catch (err) {
    console.error('[ADMIN] stats error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /rpg/api/admin/users ──────────────────────────────────
// Liste tous les utilisateurs avec détails
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id, u.username, u.email, u.avatar_url, u.is_admin,
        u.created_at, u.last_login,
        u.failed_attempts,
        u.locked_until > NOW() AS is_locked,
        u.locked_until,
        COUNT(DISTINCT cm.campaign_id) AS campaign_count,
        COUNT(DISTINCT c.id) AS character_count,
        COUNT(DISTINCT ca.id) FILTER (WHERE ca.owner_id = u.id) AS owned_campaigns
      FROM users u
      LEFT JOIN campaign_members cm ON cm.user_id = u.id
      LEFT JOIN characters c ON c.user_id = u.id
      LEFT JOIN campaigns ca ON ca.owner_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[ADMIN] users error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── PUT /rpg/api/admin/users/:id ─────────────────────────────
// Modifier username / email d'un utilisateur
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, email } = req.body;
  if (!username && !email) return res.status(400).json({ error: 'Rien à modifier' });
  try {
    const sets = [];
    const vals = [];
    if (username) { sets.push(`username = $${sets.length + 1}`); vals.push(username.trim()); }
    if (email)    { sets.push(`email = $${sets.length + 1}`);    vals.push(email.toLowerCase().trim()); }
    vals.push(id);
    const r = await db.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id, username, email`,
      vals
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username ou email déjà utilisé' });
    console.error('[ADMIN] edit user error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── DELETE /rpg/api/admin/users/:id ──────────────────────────
// Supprimer un compte (pas soi-même)
router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer son propre compte' });
  try {
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ADMIN] delete user error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── PUT /rpg/api/admin/users/:id/toggle-admin ─────────────────
// Promouvoir / rétrograder un admin
router.put('/users/:id/toggle-admin', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Impossible de modifier son propre statut admin' });
  try {
    const r = await db.query(
      'UPDATE users SET is_admin = NOT is_admin WHERE id = $1 RETURNING id, username, is_admin',
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('[ADMIN] toggle-admin error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── PUT /rpg/api/admin/users/:id/unlock ──────────────────────
// Débloquer un compte verrouillé
router.put('/users/:id/unlock', async (req, res) => {
  try {
    await db.query(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1',
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[ADMIN] unlock error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /rpg/api/admin/campaigns ─────────────────────────────
// Liste toutes les campagnes avec détails
router.get('/campaigns', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        ca.id, ca.name, ca.description, ca.invite_code, ca.created_at,
        u.username AS owner_name, u.email AS owner_email,
        COUNT(DISTINCT cm.user_id) AS member_count,
        COUNT(DISTINCT ch.id)      AS character_count,
        COUNT(DISTINCT m.id)       AS map_count,
        COUNT(DISTINCT t.id)       AS token_count,
        COUNT(DISTINCT msg.id)     AS message_count,
        MAX(msg.created_at)        AS last_activity
      FROM campaigns ca
      LEFT JOIN users u             ON u.id = ca.owner_id
      LEFT JOIN campaign_members cm ON cm.campaign_id = ca.id
      LEFT JOIN characters ch       ON ch.campaign_id = ca.id
      LEFT JOIN maps m              ON m.campaign_id = ca.id
      LEFT JOIN tokens t            ON t.map_id = m.id
      LEFT JOIN messages msg        ON msg.campaign_id = ca.id
      GROUP BY ca.id, u.username, u.email
      ORDER BY ca.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[ADMIN] campaigns error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /rpg/api/admin/campaigns/:id/members ─────────────────
// Membres d'une campagne (joueurs + rôles)
router.get('/campaigns/:id/members', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id, u.username, u.email, cm.role, cm.joined_at
      FROM campaign_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.campaign_id = $1
      ORDER BY cm.role, u.username
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('[ADMIN] campaign members error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── DELETE /rpg/api/admin/campaigns/:id ──────────────────────
// Supprimer une campagne (cascade)
router.delete('/campaigns/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ADMIN] delete campaign error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /rpg/api/admin/activity ──────────────────────────────
// Dernière activité : logins récents, messages récents
router.get('/activity', async (req, res) => {
  try {
    const [logins, msgs] = await Promise.all([
      db.query(`
        SELECT username, email, last_login, created_at
        FROM users WHERE last_login IS NOT NULL
        ORDER BY last_login DESC LIMIT 10
      `),
      db.query(`
        SELECT msg.content, msg.created_at, u.username, ca.name AS campaign_name
        FROM messages msg
        JOIN users u ON u.id = msg.user_id
        JOIN campaigns ca ON ca.id = msg.campaign_id
        ORDER BY msg.created_at DESC LIMIT 20
      `),
    ]);
    res.json({ recent_logins: logins.rows, recent_messages: msgs.rows });
  } catch (err) {
    console.error('[ADMIN] activity error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /rpg/api/admin/online ─────────────────────────────────
// Utilisateurs connectés via WebSocket en ce moment
router.get('/online', async (req, res) => {
  try {
    const io = req.app.get('io');
    const sockets = await io.fetchSockets();
    const users = sockets.map(s => ({
      user_id:   s.user?.id,
      username:  s.user?.username,
      campaign_id: s.campaignId || null,
      connected_at: s.handshake?.time,
    })).filter(u => u.user_id);
    res.json({ count: users.length, users });
  } catch (err) {
    console.error('[ADMIN] online error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /rpg/api/admin/invitations ───────────────────────────
// Arbre d'invitations : qui a invité qui
router.get('/invitations', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id, u.username, u.email, u.created_at, u.invite_code,
        inv.id        AS inviter_id,
        inv.username  AS inviter_username,
        COUNT(invited.id) AS invited_count
      FROM users u
      LEFT JOIN users inv     ON inv.id = u.invited_by
      LEFT JOIN users invited ON invited.invited_by = u.id
      GROUP BY u.id, inv.id, inv.username
      ORDER BY u.created_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[ADMIN] invitations error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
