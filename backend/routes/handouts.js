const express = require('express');
const router  = express.Router({ mergeParams: true });
const db      = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Helper : vérifier membership et rôle
async function getMembership(campaign_id, user_id) {
  const r = await db.query(
    'SELECT role FROM campaign_members WHERE campaign_id=$1 AND user_id=$2',
    [campaign_id, user_id]
  );
  return r.rows[0] || null;
}

// GET /campaigns/:id/handouts
//   MJ  → tous les handouts de la campagne
//   Joueur → seulement les handouts partagés
router.get('/', async (req, res) => {
  const { id: campaign_id } = req.params;
  const member = await getMembership(campaign_id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Accès refusé' });
  try {
    const where = member.role === 'gm' ? '' : 'AND h.shared = TRUE';
    const { rows } = await db.query(
      `SELECT h.*, u.username AS author
       FROM handouts h
       JOIN users u ON u.id = h.created_by
       WHERE h.campaign_id = $1 ${where}
       ORDER BY h.created_at DESC`,
      [campaign_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[handouts GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /campaigns/:id/handouts  (MJ uniquement)
router.post('/', async (req, res) => {
  const { id: campaign_id } = req.params;
  const member = await getMembership(campaign_id, req.user.id);
  if (!member || member.role !== 'gm') return res.status(403).json({ error: 'MJ uniquement' });
  const { title, content, image_url } = req.body;
  if (!title) return res.status(400).json({ error: 'title requis' });
  try {
    const { rows } = await db.query(
      `INSERT INTO handouts (campaign_id, created_by, title, content, image_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [campaign_id, req.user.id, title.slice(0,255), content || null, image_url || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[handouts POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /campaigns/:id/handouts/:hid  (MJ uniquement)
router.put('/:hid', async (req, res) => {
  const { id: campaign_id, hid } = req.params;
  const member = await getMembership(campaign_id, req.user.id);
  if (!member || member.role !== 'gm') return res.status(403).json({ error: 'MJ uniquement' });
  const { title, content, image_url } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE handouts SET
         title     = COALESCE($1, title),
         content   = COALESCE($2, content),
         image_url = COALESCE($3, image_url),
         updated_at = NOW()
       WHERE id=$4 AND campaign_id=$5
       RETURNING *`,
      [title ? title.slice(0,255) : null, content ?? null, image_url ?? null, hid, campaign_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Handout introuvable' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[handouts PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /campaigns/:id/handouts/:hid/share  (MJ — bascule le partage + socket)
router.put('/:hid/share', async (req, res) => {
  const { id: campaign_id, hid } = req.params;
  const member = await getMembership(campaign_id, req.user.id);
  if (!member || member.role !== 'gm') return res.status(403).json({ error: 'MJ uniquement' });
  try {
    const { rows } = await db.query(
      `UPDATE handouts SET shared = NOT shared, updated_at = NOW()
       WHERE id=$1 AND campaign_id=$2 RETURNING *`,
      [hid, campaign_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Handout introuvable' });
    // Le broadcast socket est géré par le frontend après réception de cette réponse
    res.json(rows[0]);
  } catch (err) {
    console.error('[handouts share]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /campaigns/:id/handouts/:hid  (MJ uniquement)
router.delete('/:hid', async (req, res) => {
  const { id: campaign_id, hid } = req.params;
  const member = await getMembership(campaign_id, req.user.id);
  if (!member || member.role !== 'gm') return res.status(403).json({ error: 'MJ uniquement' });
  try {
    const { rowCount } = await db.query(
      'DELETE FROM handouts WHERE id=$1 AND campaign_id=$2',
      [hid, campaign_id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Handout introuvable' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[handouts DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
