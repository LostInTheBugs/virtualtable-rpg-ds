const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /macros — liste toutes les macros de l'utilisateur
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM macros WHERE user_id = $1 ORDER BY position, created_at',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[macros GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /macros — créer une macro
router.post('/', async (req, res) => {
  const { name, formula, color, position } = req.body;
  if (!name || !formula) return res.status(400).json({ error: 'name et formula requis' });
  // Limite : 20 macros par utilisateur
  const count = await db.query('SELECT COUNT(*) FROM macros WHERE user_id = $1', [req.user.id]);
  if (parseInt(count.rows[0].count) >= 20) return res.status(400).json({ error: 'Limite de 20 macros atteinte' });
  try {
    const { rows } = await db.query(
      'INSERT INTO macros (user_id, name, formula, color, position) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.id, name.slice(0,30), formula.slice(0,100), color || '#c9a227', position || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[macros POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /macros/:id — modifier une macro
router.put('/:id', async (req, res) => {
  const { name, formula, color, position } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE macros SET
        name     = COALESCE($1, name),
        formula  = COALESCE($2, formula),
        color    = COALESCE($3, color),
        position = COALESCE($4, position)
      WHERE id = $5 AND user_id = $6
      RETURNING *`,
      [
        name     ? name.slice(0,30)     : null,
        formula  ? formula.slice(0,100) : null,
        color    || null,
        position != null ? position : null,
        req.params.id, req.user.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Macro introuvable' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[macros PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /macros/:id — supprimer une macro
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM macros WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Macro introuvable' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[macros DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
