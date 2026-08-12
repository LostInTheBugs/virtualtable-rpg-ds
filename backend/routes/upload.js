const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// Répertoire de stockage — bind-monté sur /opt/docker/nginx/html/uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const AUDIO_EXT = ['.mp3', '.ogg', '.wav', '.m4a', '.flac', '.opus'];
const ALLOWED_EXT = [...IMAGE_EXT, ...AUDIO_EXT];

const MAX_IMAGE = 10 * 1024 * 1024;  // 10 Mo
const MAX_AUDIO = 30 * 1024 * 1024;  // 30 Mo
const MAX_SIZE  = MAX_AUDIO;         // plafond multer, affiné après coup

// Quota par utilisateur (500 Mo), persistant en base
const MAX_QUOTA_PER_USER = 500 * 1024 * 1024; // 500 Mo

// ── Signatures binaires (magic bytes) ────────────────────────
// L'extension seule est déclarative : on vérifie le contenu réel.
const SIGNATURES = [
  { ext: ['.jpg', '.jpeg'], test: b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { ext: ['.png'],  test: b => b.slice(0, 8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A])) },
  { ext: ['.gif'],  test: b => b.slice(0, 6).toString('ascii').match(/^GIF8[79]a$/) !== null },
  { ext: ['.webp'], test: b => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' },
  { ext: ['.mp3'],  test: b => b.slice(0, 3).toString('ascii') === 'ID3' || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) },
  { ext: ['.ogg', '.opus'], test: b => b.slice(0, 4).toString('ascii') === 'OggS' },
  { ext: ['.wav'],  test: b => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WAVE' },
  { ext: ['.flac'], test: b => b.slice(0, 4).toString('ascii') === 'fLaC' },
  { ext: ['.m4a'],  test: b => b.slice(4, 8).toString('ascii') === 'ftyp' },
];

function contenuCoherent(filePath, ext) {
  const rule = SIGNATURES.find(s => s.ext.includes(ext));
  if (!rule) return false;
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    return !!rule.test(buf);
  } catch {
    return false;
  } finally {
    fs.closeSync(fd);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    // Nom généré : l'originalname n'est jamais utilisé pour construire un chemin
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uuidv4() + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return cb(new Error('Type non autorisé (images : jpg, png, gif, webp — audio : mp3, ogg, wav, m4a, flac, opus)'));
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE, files: 1 } });

// ── Helper : quota utilisé par un utilisateur (somme des tailles en base) ──
async function quotaUtilise(userId) {
  const r = await db.query('SELECT COALESCE(SUM(taille), 0) AS total FROM uploads WHERE user_id = $1', [userId]);
  return parseInt(r.rows[0].total, 10);
}

// ── Helper : liste des fichiers d'un utilisateur ──
async function fichiersUtilisateur(userId) {
  const r = await db.query(
    'SELECT filename, taille, mime, created_at FROM uploads WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return r.rows;
}

// POST /rpg/api/upload
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

  const ext  = path.extname(req.file.filename).toLowerCase();
  const jeter = (msg, code = 400) => {
    fs.unlink(req.file.path, () => {});
    return res.status(code).json({ error: msg });
  };

  // 1. Le contenu doit correspondre à l'extension annoncée
  if (!contenuCoherent(req.file.path, ext)) {
    console.warn(`[UPLOAD] Contenu incohérent avec ${ext} — user ${req.user.id}`);
    return jeter('Le contenu du fichier ne correspond pas à son extension');
  }

  // 2. Limite de taille selon le type réel
  const maxPourType = IMAGE_EXT.includes(ext) ? MAX_IMAGE : MAX_AUDIO;
  if (req.file.size > maxPourType) {
    return jeter(`Fichier trop volumineux (max ${Math.round(maxPourType / 1024 / 1024)} Mo pour ce type)`);
  }

  // 3. Quota par utilisateur (persistant en base)
  const utilise = await quotaUtilise(req.user.id);
  if (utilise + req.file.size > MAX_QUOTA_PER_USER) {
    return jeter('Quota de stockage atteint (500 Mo). Supprimez des fichiers avant de réessayer.', 413);
  }

  // 4. Enregistrer la ligne en base
  try {
    await db.query(
      'INSERT INTO uploads (user_id, filename, taille, mime) VALUES ($1, $2, $3, $4)',
      [req.user.id, req.file.filename, req.file.size, req.file.mimetype || null]
    );
  } catch (dbErr) {
    console.error('[UPLOAD] Erreur DB insertion:', dbErr);
    fs.unlink(req.file.path, () => {});
    return res.status(500).json({ error: 'Erreur lors de l\'enregistrement du fichier' });
  }

  res.json({ url: `/uploads/${req.file.filename}` });
});

// DELETE /rpg/api/upload/:filename — supprime un fichier (propriétaire ou admin)
router.delete('/:filename', authMiddleware, async (req, res) => {
  const { filename } = req.params;

  // Vérifier que le fichier existe en base et appartient à l'utilisateur (ou admin)
  try {
    const r = await db.query('SELECT user_id, filename FROM uploads WHERE filename = $1', [filename]);
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Fichier introuvable en base' });
    }

    const ligne = r.rows[0];
    const estAdmin = req.user.is_admin;
    if (ligne.user_id !== req.user.id && !estAdmin) {
      // Vérifier admin en base pour les tokens anciens
      let adminDb = false;
      try {
        const a = await db.query('SELECT is_admin, tier FROM users WHERE id = $1', [req.user.id]);
        adminDb = a.rows[0]?.is_admin || a.rows[0]?.tier === 'admin';
      } catch {}
      if (!adminDb) {
        return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres fichiers' });
      }
    }

    // Supprimer du disque
    const chemin = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(chemin)) {
      fs.unlinkSync(chemin);
    }

    // Supprimer la ligne en base
    await db.query('DELETE FROM uploads WHERE filename = $1', [filename]);

    res.json({ ok: true, message: 'Fichier supprimé' });
  } catch (err) {
    console.error('[UPLOAD] Erreur suppression:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// GET /rpg/api/upload/quota — informations de quota pour l'utilisateur connecté
router.get('/quota', authMiddleware, async (req, res) => {
  try {
    const [utilise, fichiers] = await Promise.all([
      quotaUtilise(req.user.id),
      fichiersUtilisateur(req.user.id),
    ]);
    res.json({
      utilise,
      quota: MAX_QUOTA_PER_USER,
      fichiers,
    });
  } catch (err) {
    console.error('[UPLOAD] Erreur quota:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du quota' });
  }
});

// Gestion des erreurs multer
router.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ error: `Fichier trop volumineux (max ${Math.round(MAX_SIZE / 1024 / 1024)} Mo)` });
  res.status(400).json({ error: err.message || 'Erreur upload' });
});

module.exports = router;
