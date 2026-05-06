const router = require('express').Router({ mergeParams: true });
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

async function checkMember(campaignId, userId) {
  const r = await db.query(
    'SELECT role FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
    [campaignId, userId]
  );
  return r.rows[0] || null;
}

// GET /rpg/api/campaigns/:id/maps
router.get('/', authMiddleware, async (req, res) => {
  const m = await checkMember(req.params.id, req.user.id);
  if (!m) return res.status(403).json({ error: 'Accès refusé' });
  try {
    const maps = await db.query(
      'SELECT * FROM maps WHERE campaign_id = $1 ORDER BY is_active DESC, name',
      [req.params.id]
    );
    res.json(maps.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /rpg/api/campaigns/:id/maps/:mapId/tokens
router.get('/:mapId/tokens', authMiddleware, async (req, res) => {
  const m = await checkMember(req.params.id, req.user.id);
  if (!m) return res.status(403).json({ error: 'Accès refusé' });
  try {
    const tokens = await db.query(
      `SELECT t.*, c.name AS char_name, c.portrait_url AS char_portrait,
              c.user_id AS char_user_id, c.vision_radius AS char_vision_radius,
              c.vision_angle AS char_vision_angle,
              COALESCE(t.hp_max, c.hp_max) AS hp_max
       FROM tokens t
       LEFT JOIN characters c ON c.id = t.character_id
       WHERE t.map_id = $1 AND (t.visible = TRUE OR $2 = 'gm')
       ORDER BY t.created_at`,
      [req.params.mapId, m.role]
    );
    res.json(tokens.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /rpg/api/campaigns/:id/maps — créer une carte (MJ)
router.post('/', authMiddleware, async (req, res) => {
  const m = await checkMember(req.params.id, req.user.id);
  if (!m || m.role !== 'gm') return res.status(403).json({ error: 'Réservé au MJ' });

  const { name, background_url, grid_size, width, height } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });

  try {
    const r = await db.query(
      `INSERT INTO maps (campaign_id, name, background_url, grid_size, width, height)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, name, background_url || null, grid_size || 50, width || 2000, height || 1500]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /rpg/api/campaigns/:id/maps/:mapId — mettre à jour (fond, grille…)
router.patch('/:mapId', authMiddleware, async (req, res) => {
  const m = await checkMember(req.params.id, req.user.id);
  if (!m || m.role !== 'gm') return res.status(403).json({ error: 'Réservé au MJ' });

  const { name, background_url, grid_size, width, height } = req.body;
  try {
    const r = await db.query(
      `UPDATE maps SET
         name           = COALESCE($1, name),
         background_url = COALESCE($2, background_url),
         grid_size      = COALESCE($3, grid_size),
         width          = COALESCE($6, width),
         height         = COALESCE($7, height)
       WHERE id = $4 AND campaign_id = $5 RETURNING *`,
      [name || null, background_url !== undefined ? background_url : null,
       grid_size || null, req.params.mapId, req.params.id,
       width || null, height || null]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Carte introuvable' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /rpg/api/campaigns/:id/maps/:mapId/activate — définir la carte active (MJ)
router.put('/:mapId/activate', authMiddleware, async (req, res) => {
  const m = await checkMember(req.params.id, req.user.id);
  if (!m || m.role !== 'gm') return res.status(403).json({ error: 'Réservé au MJ' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE maps SET is_active = FALSE WHERE campaign_id = $1', [req.params.id]);
    const r = await client.query(
      'UPDATE maps SET is_active = TRUE WHERE id = $1 AND campaign_id = $2 RETURNING *',
      [req.params.mapId, req.params.id]
    );
    await client.query('COMMIT');
    res.json(r.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

module.exports = router;
