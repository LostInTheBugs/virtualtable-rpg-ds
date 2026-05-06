const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Répertoire de stockage — bind-monté sur /opt/docker/nginx/html/uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp',
                     '.mp3', '.ogg', '.wav', '.m4a', '.flac', '.opus'];
const MAX_SIZE    = 30 * 1024 * 1024; // 30 Mo (audio)

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uuidv4() + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXT.includes(ext)) cb(null, true);
  else cb(new Error('Type non autorisé (jpg/png/gif/webp uniquement)'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });

// POST /rpg/api/upload
router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Gestion des erreurs multer
router.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ error: 'Fichier trop volumineux (max 5 Mo)' });
  res.status(400).json({ error: err.message || 'Erreur upload' });
});

module.exports = router;
