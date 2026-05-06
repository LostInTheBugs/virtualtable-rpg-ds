const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// GET /rpg/api/campaigns — mes campagnes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, cm.role,
              (SELECT COUNT(*) FROM campaign_members WHERE campaign_id = c.id) AS member_count
       FROM campaigns c
       JOIN campaign_members cm ON cm.campaign_id = c.id
       WHERE cm.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /rpg/api/campaigns — créer une campagne
router.post('/', authMiddleware, async (req, res) => {
  const { name, description, system } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    let invite_code, attempt = 0;
    while (attempt < 10) {
      invite_code = genCode();
      const exists = await client.query('SELECT 1 FROM campaigns WHERE invite_code = $1', [invite_code]);
      if (!exists.rows.length) break;
      attempt++;
    }
    const camp = await client.query(
      `INSERT INTO campaigns (name, description, owner_id, invite_code, system)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), description || null, req.user.id, invite_code, system || 'D&D 5e']
    );
    await client.query(
      `INSERT INTO campaign_members (campaign_id, user_id, role) VALUES ($1, $2, 'gm')`,
      [camp.rows[0].id, req.user.id]
    );
    // Créer une carte par défaut
    await client.query(
      `INSERT INTO maps (campaign_id, name, is_active) VALUES ($1, 'Carte principale', TRUE)`,
      [camp.rows[0].id]
    );
    await client.query('COMMIT');
    res.status(201).json({ ...camp.rows[0], role: 'gm', member_count: 1 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// POST /rpg/api/campaigns/join — rejoindre via code
router.post('/join', authMiddleware, async (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ error: 'Code requis' });

  try {
    const camp = await db.query('SELECT * FROM campaigns WHERE invite_code = $1', [invite_code.toUpperCase()]);
    if (!camp.rows[0]) return res.status(404).json({ error: 'Code invalide' });

    const already = await db.query(
      'SELECT 1 FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
      [camp.rows[0].id, req.user.id]
    );
    if (already.rows.length) return res.status(409).json({ error: 'Déjà membre de cette campagne' });

    await db.query(
      `INSERT INTO campaign_members (campaign_id, user_id, role) VALUES ($1, $2, 'player')`,
      [camp.rows[0].id, req.user.id]
    );
    res.json({ ...camp.rows[0], role: 'player' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /rpg/api/campaigns/:id — détail d'une campagne
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const member = await db.query(
      'SELECT role FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!member.rows[0]) return res.status(403).json({ error: 'Accès refusé' });

    const [camp, members, chars, maps] = await Promise.all([
      db.query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]),
      db.query(
        `SELECT u.id, u.username, u.avatar_url, cm.role
         FROM campaign_members cm JOIN users u ON u.id = cm.user_id
         WHERE cm.campaign_id = $1`, [req.params.id]
      ),
      db.query('SELECT * FROM characters WHERE campaign_id = $1 ORDER BY name', [req.params.id]),
      db.query('SELECT * FROM maps WHERE campaign_id = $1 ORDER BY is_active DESC, name', [req.params.id]),
    ]);

    res.json({
      ...camp.rows[0],
      role: member.rows[0].role,
      members: members.rows,
      characters: chars.rows,
      maps: maps.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /rpg/api/campaigns/:id — modifier la campagne (MJ/owner)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const member = await db.query(
      'SELECT role FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!member.rows[0] || member.rows[0].role !== 'gm')
      return res.status(403).json({ error: 'Réservé au MJ' });

    const { name, description, system, regenerate_invite, settings } = req.body;
    const updates = [];
    const values  = [];
    let i = 1;

    if (name)        { updates.push(`name = $${i++}`);        values.push(name); }
    if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
    if (system)      { updates.push(`system = $${i++}`);      values.push(system); }
    if (settings)    { updates.push(`settings = $${i++}`);    values.push(JSON.stringify(settings)); }
    if (regenerate_invite) {
      updates.push(`invite_code = upper(encode(gen_random_bytes(5), 'hex'))`);
    }

    if (!updates.length) return res.status(400).json({ error: 'Rien à mettre à jour' });
    values.push(req.params.id);

    const r = await db.query(
      `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /rpg/api/campaigns/:id — supprimer (owner seulement)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const camp = await db.query('SELECT owner_id FROM campaigns WHERE id = $1', [req.params.id]);
    if (!camp.rows[0]) return res.status(404).json({ error: 'Campagne introuvable' });
    if (camp.rows[0].owner_id !== req.user.id)
      return res.status(403).json({ error: 'Seul le MJ peut supprimer la campagne' });
    await db.query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
