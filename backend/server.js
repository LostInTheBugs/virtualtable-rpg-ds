const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('trust proxy', 1); // Apache proxy — nécessaire pour express-rate-limit
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────
const io = new Server(server, {
  path: '/rpg/socket.io',
  cors: {
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});
require('./socket')(io);

// Exposer io pour les routes qui en ont besoin (ex. admin)
app.set('io', io);

// ── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

// ── Health check ─────────────────────────────────────────────
app.get('/rpg/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Routes ───────────────────────────────────────────────────
app.use('/rpg/api/auth',       require('./routes/auth'));
app.use('/rpg/api/campaigns',  require('./routes/campaigns'));
app.use('/rpg/api/campaigns/:id/characters', require('./routes/characters'));
app.use('/rpg/api/campaigns/:id/maps',       require('./routes/maps'));
app.use('/rpg/api/upload',                   require('./routes/upload'));
app.use('/rpg/api/admin',                    require('./routes/admin'));
app.use('/rpg/api/account',                  require('./routes/account'));
app.use('/rpg/api/macros',                   require('./routes/macros'));
app.use('/rpg/api/campaigns/:id/handouts',   require('./routes/handouts'));
app.use('/rpg/api/campaigns/:id/tables',     require('./routes/tables'));

// ── Init DB ──────────────────────────────────────────────────
async function initDB() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await db.query(schema);
    console.log('[DB] Schéma initialisé');
  } catch (err) {
    console.error('[DB] Erreur initialisation schéma:', err.message);
  }
}

// ── Démarrage ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`[RPG] Serveur démarré sur le port ${PORT}`);
  await initDB();
});
