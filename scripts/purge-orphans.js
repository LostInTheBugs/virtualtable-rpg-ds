#!/usr/bin/env node
/**
 * purge-orphans.js — Nettoie les fichiers orphelins du répertoire d'upload.
 *
 * Sans --delete : liste les incohérences entre le disque et la base.
 * Avec --delete : supprime les fichiers sur disque sans ligne en base,
 *                  et les lignes en base sans fichier sur disque.
 *
 * Usage :
 *   node scripts/purge-orphans.js              # lister seulement
 *   node scripts/purge-orphans.js --delete     # lister + supprimer
 *
 * Variables d'environnement :
 *   DATABASE_URL — chaîne de connexion PostgreSQL
 *   UPLOAD_DIR   — répertoire des fichiers uploadés (défaut : ../uploads)
 */

const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

// ── Configuration ──────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL est requis');
  process.exit(1);
}

const UPLOAD_DIR = process.env.UPLOAD_DIR
  || path.join(__dirname, '..', 'backend', 'uploads');

const SUPPRIMER = process.argv.includes('--delete');

// ── Connexion DB ───────────────────────────────────────────
const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  console.log(`📂 Répertoire : ${UPLOAD_DIR}`);
  console.log(`🗑️  Mode : ${SUPPRIMER ? 'SUPPRESSION' : 'LISTE SEULEMENT'}\n`);

  // 1. Récupérer tous les noms de fichiers en base
  const { rows: lignesDb } = await pool.query('SELECT filename, user_id, taille, mime FROM uploads');
  const enBase = new Set(lignesDb.map(r => r.filename));
  console.log(`📋 ${lignesDb.length} fichier(s) enregistré(s) en base`);

  // 2. Lister les fichiers présents sur disque
  let surDisque = [];
  try {
    surDisque = fs.readdirSync(UPLOAD_DIR).filter(f => {
      const chemin = path.join(UPLOAD_DIR, f);
      return fs.statSync(chemin).isFile();
    });
  } catch (err) {
    console.error(`❌ Impossible de lister ${UPLOAD_DIR}:`, err.message);
    process.exit(1);
  }
  const disqueSet = new Set(surDisque);
  console.log(`💾 ${surDisque.length} fichier(s) présent(s) sur disque\n`);

  // 3. Fichiers sur disque SANS ligne en base
  const orphelinsDisque = surDisque.filter(f => !enBase.has(f));
  if (orphelinsDisque.length > 0) {
    console.log(`⚠️  ${orphelinsDisque.length} fichier(s) sur disque sans ligne en base :`);
    for (const f of orphelinsDisque) {
      const chemin = path.join(UPLOAD_DIR, f);
      const taille = fs.statSync(chemin).size;
      const tailleMo = (taille / 1024 / 1024).toFixed(2);
      console.log(`   📄 ${f} (${tailleMo} Mo)`);
      if (SUPPRIMER) {
        fs.unlinkSync(chemin);
        console.log(`      → supprimé du disque`);
      }
    }
  } else {
    console.log('✅ Aucun fichier sur disque sans ligne en base');
  }

  console.log('');

  // 4. Lignes en base SANS fichier sur disque
  const orphelinsBase = lignesDb.filter(r => !disqueSet.has(r.filename));
  if (orphelinsBase.length > 0) {
    console.log(`⚠️  ${orphelinsBase.length} ligne(s) en base sans fichier sur disque :`);
    for (const r of orphelinsBase) {
      const tailleMo = (parseInt(r.taille) / 1024 / 1024).toFixed(2);
      console.log(`   🗄️  ${r.filename} (${tailleMo} Mo, user: ${r.user_id})`);
      if (SUPPRIMER) {
        await pool.query('DELETE FROM uploads WHERE filename = $1', [r.filename]);
        console.log(`      → ligne supprimée de la base`);
      }
    }
  } else {
    console.log('✅ Aucune ligne en base sans fichier sur disque');
  }

  // 5. Récapitulatif
  if (SUPPRIMER && (orphelinsDisque.length > 0 || orphelinsBase.length > 0)) {
    const totalDisque = orphelinsDisque.reduce((sum, f) => sum + fs.statSync(path.join(UPLOAD_DIR, f)).size, 0);
    const totalBase   = orphelinsBase.reduce((sum, r) => sum + parseInt(r.taille), 0);
    const totalMo = ((totalDisque + totalBase) / 1024 / 1024).toFixed(2);
    console.log(`\n✨ Nettoyage terminé — ${totalMo} Mo libérés`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
