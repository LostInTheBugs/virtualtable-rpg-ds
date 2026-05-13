const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /rpg/api/stats — statistiques générales
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [
      usersRes,
      campaignsRes,
      messagesRes,
      rollsRes,
      critsRes,
      fumblesRes,
      activeRes,
    ] = await Promise.all([
      // Total utilisateurs
      db.query('SELECT COUNT(*) AS total FROM users'),
      // Total campagnes
      db.query('SELECT COUNT(*) AS total FROM campaigns'),
      // Messages (total chat)
      db.query('SELECT COUNT(*) AS total FROM messages'),
      // Lancés de dés (messages de type roll)
      db.query('SELECT COUNT(*) AS total FROM messages WHERE type = $1', ['roll']),
      // Critiques (20 sur d20)
      db.query(`SELECT COUNT(*) AS total FROM messages WHERE type = 'roll' AND roll_data->>'rolls' ~ '\\[20\\]|\\b20\\b'`),
      // Échecs critiques (1 sur d20)
      db.query(`SELECT COUNT(*) AS total FROM messages WHERE type = 'roll' AND roll_data->>'rolls' ~ '\\b1\\b'`),
      // Utilisateurs actifs (connectés depuis moins de 24h)
      db.query("SELECT COUNT(*) AS total FROM users WHERE last_login > NOW() - INTERVAL '24 hours'"),
    ]);

    // Stats par jour (30 derniers jours)
    const dailyStats = await db.query(`
      SELECT
        DATE(created_at) AS day,
        COUNT(*) AS messages,
        COUNT(*) FILTER (WHERE type = 'roll') AS rolls,
        COUNT(*) FILTER (WHERE type = 'roll' AND roll_data->>'rolls' ~ '\\[20\\]|\\b20\\b') AS crits,
        COUNT(*) FILTER (WHERE type = 'roll' AND roll_data->>'rolls' ~ '\\b1\\b') AS fumbles
      FROM messages
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY day DESC
    `);

    // Top 10 des utilisateurs les plus actifs
    const topUsers = await db.query(`
      SELECT
        u.username,
        COUNT(*) AS messages,
        COUNT(*) FILTER (WHERE m.type = 'roll') AS rolls
      FROM messages m
      JOIN users u ON u.id = m.user_id
      GROUP BY u.id, u.username
      ORDER BY messages DESC
      LIMIT 10
    `);

    // Campagnes avec le plus de messages
    const topCampaigns = await db.query(`
      SELECT
        c.name,
        c.system,
        COUNT(*) AS messages,
        COUNT(*) FILTER (WHERE m.type = 'roll') AS rolls
      FROM messages m
      JOIN campaigns c ON c.id = m.campaign_id
      GROUP BY c.id, c.name, c.system
      ORDER BY messages DESC
      LIMIT 10
    `);

    res.json({
      totals: {
        users:         parseInt(usersRes.rows[0]?.total) || 0,
        campaigns:     parseInt(campaignsRes.rows[0]?.total) || 0,
        messages:      parseInt(messagesRes.rows[0]?.total) || 0,
        dice_rolls:    parseInt(rollsRes.rows[0]?.total) || 0,
        crit_success:  parseInt(critsRes.rows[0]?.total) || 0,
        crit_fumble:   parseInt(fumblesRes.rows[0]?.total) || 0,
        active_users:  parseInt(activeRes.rows[0]?.total) || 0,
      },
      daily: dailyStats.rows,
      top_users: topUsers.rows,
      top_campaigns: topCampaigns.rows,
    });
  } catch (err) {
    console.error('[STATS] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
