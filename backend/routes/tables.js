const express = require('express');
const router  = express.Router({ mergeParams: true });
const db      = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

async function getMembership(campaign_id, user_id) {
  const r = await db.query(
    'SELECT role FROM campaign_members WHERE campaign_id=$1 AND user_id=$2',
    [campaign_id, user_id]
  );
  return r.rows[0] || null;
}

// GET /campaigns/:id/tables  — liste les tables + leurs entrées
router.get('/', async (req, res) => {
  const { id: campaign_id } = req.params;
  const member = await getMembership(campaign_id, req.user.id);
  if (!member || member.role !== 'gm') return res.status(403).json({ error: 'MJ uniquement' });
  try {
    const tables  = await db.query('SELECT * FROM random_tables WHERE campaign_id=$1 ORDER BY created_at', [campaign_id]);
    const entries = await db.query(
      'SELECT * FROM table_entries WHERE table_id = ANY($1::uuid[]) ORDER BY weight DESC',
      [tables.rows.map(t => t.id)]
    );
    const result = tables.rows.map(t => ({
      ...t,
      entries: entries.rows.filter(e => e.table_id === t.id),
    }));
    res.json(result);
  } catch (err) {
    console.error('[tables GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /campaigns/:id/tables  — créer une table (avec ses entrées)
router.post('/', async (req, res) => {
  const { id: campaign_id } = req.params;
  const member = await getMembership(campaign_id, req.user.id);
  if (!member || member.role !== 'gm') return res.status(403).json({ error: 'MJ uniquement' });
  const { name, description, entries = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'name requis' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const tr = await client.query(
      'INSERT INTO random_tables (campaign_id, created_by, name, description) VALUES ($1,$2,$3,$4) RETURNING *',
      [campaign_id, req.user.id, name.slice(0,100), description || null]
    );
    const table = tr.rows[0];
    const savedEntries = [];
    for (const e of entries.slice(0, 100)) {
      const er = await client.query(
        'INSERT INTO table_entries (table_id, text, weight) VALUES ($1,$2,$3) RETURNING *',
        [table.id, String(e.text).slice(0,500), Math.max(1, parseInt(e.weight)||1)]
      );
      savedEntries.push(er.rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json({ ...table, entries: savedEntries });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[tables POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally { client.release(); }
});

// PUT /campaigns/:id/tables/:tid — mettre à jour nom/description + remplacer les entrées
router.put('/:tid', async (req, res) => {
  const { id: campaign_id, tid } = req.params;
  const member = await getMembership(campaign_id, req.user.id);
  if (!member || member.role !== 'gm') return res.status(403).json({ error: 'MJ uniquement' });
  const { name, description, entries } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const tr = await client.query(
      `UPDATE random_tables SET
        name        = COALESCE($1, name),
        description = COALESCE($2, description)
       WHERE id=$3 AND campaign_id=$4 RETURNING *`,
      [name?.slice(0,100) || null, description ?? null, tid, campaign_id]
    );
    if (!tr.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Table introuvable' }); }
    let savedEntries = [];
    if (Array.isArray(entries)) {
      await client.query('DELETE FROM table_entries WHERE table_id=$1', [tid]);
      for (const e of entries.slice(0,100)) {
        const er = await client.query(
          'INSERT INTO table_entries (table_id, text, weight) VALUES ($1,$2,$3) RETURNING *',
          [tid, String(e.text).slice(0,500), Math.max(1, parseInt(e.weight)||1)]
        );
        savedEntries.push(er.rows[0]);
      }
    } else {
      const existing = await client.query('SELECT * FROM table_entries WHERE table_id=$1', [tid]);
      savedEntries = existing.rows;
    }
    await client.query('COMMIT');
    res.json({ ...tr.rows[0], entries: savedEntries });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[tables PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally { client.release(); }
});

// DELETE /campaigns/:id/tables/:tid
router.delete('/:tid', async (req, res) => {
  const { id: campaign_id, tid } = req.params;
  const member = await getMembership(campaign_id, req.user.id);
  if (!member || member.role !== 'gm') return res.status(403).json({ error: 'MJ uniquement' });
  try {
    const { rowCount } = await db.query(
      'DELETE FROM random_tables WHERE id=$1 AND campaign_id=$2', [tid, campaign_id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Table introuvable' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[tables DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
