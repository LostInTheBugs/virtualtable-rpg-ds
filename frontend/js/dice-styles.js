// ═══════════════════════════════════════════════════════════════
//  DICE-STYLES.JS — Styles de dés 3D
//  Chaque style définit couleurs, matériau et effets visuels.
//  La préférence du joueur est sauvegardée dans localStorage.
// ═══════════════════════════════════════════════════════════════

const DICE_STYLES = [
  {
    id: 'classic',
    name: 'Classique',
    desc: 'Dé sombre aux arêtes dorées',
    body: 0x14141f,
    edge: 0xc9a227,
    d6Bg: '#13131e',
    d6Dot: '#c9a227',
    d6Border: '#c9a227',
    emissive: 0x0a0a14,
    specular: 0xc9a227,
    shininess: 100,
  },
  {
    id: 'ruby',
    name: 'Rubis',
    desc: 'Rouge profond et brillant',
    body: 0x4a0e0e,
    edge: 0xff4444,
    d6Bg: '#1f0808',
    d6Dot: '#ef4444',
    d6Border: '#ff4444',
    emissive: 0x1a0404,
    specular: 0xff6666,
    shininess: 120,
  },
  {
    id: 'sapphire',
    name: 'Saphir',
    desc: 'Bleu roi aux reflets argentés',
    body: 0x0a1a3a,
    edge: 0x6ba4ff,
    d6Bg: '#08102a',
    d6Dot: '#3b82f6',
    d6Border: '#6ba4ff',
    emissive: 0x040818,
    specular: 0x8bbbff,
    shininess: 120,
  },
  {
    id: 'emerald',
    name: 'Émeraude',
    desc: 'Vert profond et lumineux',
    body: 0x0a2a0e,
    edge: 0x4ade80,
    d6Bg: '#061a08',
    d6Dot: '#22c55e',
    d6Border: '#4ade80',
    emissive: 0x040a04,
    specular: 0x6bee90,
    shininess: 110,
  },
  {
    id: 'amethyst',
    name: 'Améthyste',
    desc: 'Violet mystique aux reflets magiques',
    body: 0x1e0a2a,
    edge: 0xa855f7,
    d6Bg: '#120820',
    d6Dot: '#8b5cf6',
    d6Border: '#a855f7',
    emissive: 0x0c0418,
    specular: 0xc084fc,
    shininess: 110,
  },
  {
    id: 'gold',
    name: 'Doré',
    desc: 'Or massif, digne d\'un roi',
    body: 0x3a2a00,
    edge: 0xfbbf24,
    d6Bg: '#2a1e00',
    d6Dot: '#f59e0b',
    d6Border: '#fbbf24',
    emissive: 0x1a1200,
    specular: 0xfde68a,
    shininess: 150,
  },
  {
    id: 'ivory',
    name: 'Ivoire',
    desc: 'Blanc élégant aux arêtes sombres',
    body: 0xe8e0d0,
    edge: 0x555555,
    d6Bg: '#d8d0c0',
    d6Dot: '#333333',
    d6Border: '#555555',
    emissive: 0x0,
    specular: 0x444444,
    shininess: 60,
  },
  {
    id: 'ice',
    name: 'Glace',
    desc: 'Bleu glacé translucide',
    body: 0x0a2a3a,
    edge: 0x7dd3fc,
    d6Bg: '#061a2a',
    d6Dot: '#38bdf8',
    d6Border: '#7dd3fc',
    emissive: 0x041018,
    specular: 0xbae6fd,
    shininess: 140,
  },
  {
    id: 'lava',
    name: 'Lave',
    desc: 'Rouge orangé incandescent',
    body: 0x3a0e00,
    edge: 0xf97316,
    d6Bg: '#2a0a00',
    d6Dot: '#ea580c',
    d6Border: '#f97316',
    emissive: 0x2a0800,
    specular: 0xfb923c,
    shininess: 80,
  },
  {
    id: 'midnight',
    name: 'Nocturne',
    desc: 'Noir mat aux arêtes subtiles',
    body: 0x0a0a0e,
    edge: 0x555566,
    d6Bg: '#08080a',
    d6Dot: '#777788',
    d6Border: '#555566',
    emissive: 0x0,
    specular: 0x222233,
    shininess: 30,
  },
];

// ── Helpers ──────────────────────────────────────────────────

const DICE_STYLE_KEY = 'rpg_dice_style';

function getDiceStyle() {
  const id = localStorage.getItem(DICE_STYLE_KEY) || 'classic';
  return DICE_STYLES.find(s => s.id === id) || DICE_STYLES[0];
}

function setDiceStyle(id) {
  const style = DICE_STYLES.find(s => s.id === id);
  if (style) {
    localStorage.setItem(DICE_STYLE_KEY, id);
    return style;
  }
  return getDiceStyle();
}

function applyDiceStyle(mesh, faces, style) {
  if (!mesh || !style) return;
  // For d6, we rebuild materials with the style's colors
  if (mesh.material && Array.isArray(mesh.material)) {
    // d6 uses per-face materials - rebuild them
    rebuildD6Materials(mesh, style);
    return;
  }
  // For other dice, apply the style to the material
  if (mesh.material && !Array.isArray(mesh.material)) {
    mesh.material.color.setHex(style.body);
    mesh.material.emissive.setHex(style.emissive || 0x0a0a14);
    mesh.material.specular.setHex(style.specular || 0xc9a227);
    mesh.material.shininess = style.shininess || 100;
    mesh.material.needsUpdate = true;
  }
  // Update edge lines
  mesh.children.forEach(child => {
    if (child.isLineSegments && child.material) {
      child.material.color.setHex(style.edge);
      child.material.needsUpdate = true;
    }
  });
}

function rebuildD6Materials(mesh, style) {
  const facePositions = {
    1: [[64, 64]],
    2: [[38, 42], [90, 86]],
    3: [[38, 42], [64, 64], [90, 86]],
    4: [[38, 38], [90, 38], [38, 90], [90, 90]],
    5: [[38, 38], [90, 38], [64, 64], [38, 90], [90, 90]],
    6: [[38, 30], [90, 30], [38, 64], [90, 64], [38, 98], [90, 98]]
  };
  const mats = [];
  for (let f = 1; f <= 6; f++) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const cx = cv.getContext('2d');
    cx.fillStyle = style.d6Bg;
    if (cx.roundRect) { cx.roundRect(4, 4, 120, 120, 16); cx.fill(); }
    else { cx.fillRect(4, 4, 120, 120); }
    cx.strokeStyle = style.d6Border;
    cx.lineWidth = 3;
    if (cx.roundRect) { cx.roundRect(4, 4, 120, 120, 16); cx.stroke(); }
    else { cx.strokeRect(4, 4, 120, 120); }
    cx.fillStyle = style.d6Dot;
    (facePositions[f] || []).forEach(([px, py]) => {
      cx.beginPath(); cx.arc(px, py, 9, 0, Math.PI * 2); cx.fill();
    });
    mats.push(new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(cv) }));
  }
  mesh.material = mats;
}
