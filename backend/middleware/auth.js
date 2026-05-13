const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, is_admin: !!user.is_admin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function adminMiddleware(req, res, next) {
  // Vérifie d'abord le token, puis la DB pour les tokens anciens sans is_admin
  if (req.user?.is_admin) { next(); return; }
  try {
    const r = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user?.id]);
    if (r.rows[0]?.is_admin) { next(); return; }
  } catch {}
  return res.status(403).json({ error: 'Accès refusé — admin requis' });
}

module.exports = { authMiddleware, adminMiddleware, generateToken };
