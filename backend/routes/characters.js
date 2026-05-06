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

// GET /rpg/api/campaigns/:id/characters
router.get('/', authMiddleware, async (req, res) => {
  const m = await checkMember(req.params.id, req.user.id);
  if (!m) return res.status(403).json({ error: 'Accès refusé' });
  try {
    const r = await db.query(
      'SELECT * FROM characters WHERE campaign_id = $1 ORDER BY name',
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /rpg/api/campaigns/:id/characters
router.post('/', authMiddleware, async (req, res) => {
  const m = await checkMember(req.params.id, req.user.id);
  if (!m) return res.status(403).json({ error: 'Accès refusé' });

  const {
    name, race, class: cls, level, hp_max, ac, speed, stats, skills, notes, portrait_url,
    spells, proficiency_bonus, saving_throws, inventory, subclass, abilities, background, system_data
  } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });

  try {
    const r = await db.query(
      `INSERT INTO characters
         (campaign_id, user_id, name, race, class, level, hp_current, hp_max, ac, speed,
          stats, skills, notes, portrait_url, spells, proficiency_bonus, saving_throws,
          inventory, subclass, abilities, background, system_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
      [
        req.params.id, req.user.id, name,
        race || null, cls || null,
        level || 1, hp_max || 10,
        ac || 10, speed || 30,
        JSON.stringify(stats || { str:10,dex:10,con:10,int:10,wis:10,cha:10 }),
        JSON.stringify(skills || {}),
        notes || null, portrait_url || null,
        JSON.stringify(spells || []),
        proficiency_bonus || 2,
        JSON.stringify(saving_throws || {}),
        JSON.stringify(inventory || []),
        subclass || null,
        JSON.stringify(abilities || []),
        background || null,
        JSON.stringify(system_data || {}),
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /rpg/api/campaigns/:id/characters/:charId
router.put('/:charId', authMiddleware, async (req, res) => {
  const m = await checkMember(req.params.id, req.user.id);
  if (!m) return res.status(403).json({ error: 'Accès refusé' });

  const char = await db.query('SELECT * FROM characters WHERE id = $1', [req.params.charId]);
  if (!char.rows[0]) return res.status(404).json({ error: 'Personnage introuvable' });

  // Vérifie que le personnage appartient bien à cette campagne (évite la modification cross-campagne)
  if (char.rows[0].campaign_id !== req.params.id)
    return res.status(403).json({ error: 'Ce personnage n\'appartient pas à cette campagne' });

  // Un joueur ne peut modifier que son propre personnage ; le MJ peut tout modifier
  if (m.role !== 'gm' && char.rows[0].user_id !== req.user.id)
    return res.status(403).json({ error: 'Ce personnage ne vous appartient pas' });

  // Les joueurs ne peuvent pas modifier le niveau directement (passe par level_up_requests)
  const fields = m.role === 'gm'
    ? ['name','race','class','level','hp_current','hp_max','ac','speed','initiative',
       'stats','skills','inventory','spells','notes','portrait_url','vision_radius','vision_angle',
       'background','proficiency_bonus','system_data','subclass','abilities']
    : ['name','race','class','hp_current','hp_max','ac','speed','initiative',
       'stats','skills','inventory','spells','notes','portrait_url','vision_radius','vision_angle',
       'background','proficiency_bonus','system_data','subclass','abilities'];
  const updates = [];
  const values = [];
  let i = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = $${i++}`);
      values.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'Rien à mettre à jour' });
  values.push(req.params.charId);

  try {
    const r = await db.query(
      `UPDATE characters SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /rpg/api/campaigns/:id/characters/:charId
router.delete('/:charId', authMiddleware, async (req, res) => {
  const m = await checkMember(req.params.id, req.user.id);
  if (!m) return res.status(403).json({ error: 'Accès refusé' });

  const char = await db.query('SELECT user_id, campaign_id FROM characters WHERE id = $1', [req.params.charId]);
  if (!char.rows[0]) return res.status(404).json({ error: 'Personnage introuvable' });
  if (char.rows[0].campaign_id !== req.params.id)
    return res.status(403).json({ error: 'Ce personnage n\'appartient pas à cette campagne' });
  if (m.role !== 'gm' && char.rows[0].user_id !== req.user.id)
    return res.status(403).json({ error: 'Ce personnage ne vous appartient pas' });

  try {
    await db.query('DELETE FROM characters WHERE id = $1', [req.params.charId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
