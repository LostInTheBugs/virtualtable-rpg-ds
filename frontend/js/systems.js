// ═══════════════════════════════════════════════════════════════
//  SYSTEMS.JS — Définitions des systèmes de jeu
//  Chaque système définit ses propres stats, compétences, races,
//  classes, et champs spécifiques pour la création de personnage.
// ═══════════════════════════════════════════════════════════════

const RPG_SYSTEMS = {

  // ── D&D 5e ──────────────────────────────────────────────────
  "D&D 5e": {
    label: "D&D 5e",
    stats: [
      { key: 'str', label: 'FOR',  default: 10 },
      { key: 'dex', label: 'DEX',  default: 10 },
      { key: 'con', label: 'CON',  default: 10 },
      { key: 'int', label: 'INT',  default: 10 },
      { key: 'wis', label: 'SAG',  default: 10 },
      { key: 'cha', label: 'CHA',  default: 10 },
    ],
    skills: [
      { name: 'Acrobaties', attr: 'dex' }, { name: 'Arcanes', attr: 'int' },
      { name: 'Athlétisme', attr: 'str' }, { name: 'Discrétion', attr: 'dex' },
      { name: 'Dressage', attr: 'wis' }, { name: 'Escamotage', attr: 'dex' },
      { name: 'Histoire', attr: 'int' }, { name: 'Intimidation', attr: 'cha' },
      { name: 'Intuition', attr: 'wis' }, { name: 'Investigation', attr: 'int' },
      { name: 'Médecine', attr: 'wis' }, { name: 'Nature', attr: 'int' },
      { name: 'Perception', attr: 'wis' }, { name: 'Perspicacité', attr: 'wis' },
      { name: 'Persuasion', attr: 'cha' }, { name: 'Religion', attr: 'int' },
      { name: 'Représentation', attr: 'cha' }, { name: 'Survie', attr: 'wis' },
      { name: 'Tromperie', attr: 'cha' },
    ],
    races: ['Humain','Elfe','Elfe des bois','Elfe de haute noblesse','Elfe noir (Drow)',
      'Nain des collines','Nain des montagnes','Halfelin','Gnome des forêts','Gnome des roches',
      'Demi-Elfe','Demi-Orc','Tieffelin','Dragonien','Aasimar','Goliath','Triton',
      'Tabaxi','Kenku','Lizardfolk','Tortle','Firbolg','Yuan-ti Pureblooded'],
    classes: ['Barbare','Barde','Clerc','Druide','Guerrier','Moine','Paladin','Rôdeur',
      'Roublard','Ensorceleur','Occultiste','Magicien','Artificier','Sangdragon (Blood Hunter)'],
    hasSpells: true,
    hasSubclass: true,
    hasProficiency: true,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','speed','initiative','proficiency','background','subclass','spells','inventory','money'],
    money: ['po','pa','pc'],
  },

  // ── Pathfinder 2e ───────────────────────────────────────────
  "Pathfinder 2e": {
    label: "Pathfinder 2e",
    stats: [
      { key: 'str', label: 'FOR',  default: 10 },
      { key: 'dex', label: 'DEX',  default: 10 },
      { key: 'con', label: 'CON',  default: 10 },
      { key: 'int', label: 'INT',  default: 10 },
      { key: 'wis', label: 'SAG',  default: 10 },
      { key: 'cha', label: 'CHA',  default: 10 },
    ],
    skills: [
      { name: 'Acrobaties', attr: 'dex' }, { name: 'Arcanes', attr: 'int' },
      { name: 'Artisanat', attr: 'int' }, { name: 'Athlétisme', attr: 'str' },
      { name: 'Discrétion', attr: 'dex' }, { name: 'Diplomatie', attr: 'cha' },
      { name: 'Duperie', attr: 'cha' }, { name: 'Intimidation', attr: 'cha' },
      { name: 'Intuition', attr: 'wis' }, { name: 'Médecine', attr: 'wis' },
      { name: 'Nature', attr: 'wis' }, { name: 'Performance', attr: 'cha' },
      { name: 'Religion', attr: 'wis' }, { name: 'Représentation', attr: 'cha' },
      { name: 'Savoir', attr: 'int' }, { name: 'Société', attr: 'int' },
      { name: 'Survie', attr: 'wis' }, { name: 'Vol', attr: 'dex' },
    ],
    races: ['Humain','Elfe','Nain','Halfelin','Gnome','Orc','Gobelin','Kobold',
      'Ratelin','Catfolk','Lézardfolk','Tengu','Demi-Orc','Demi-Elfe'],
    classes: ['Alchimiste','Barbare','Barde','Champion','Clerc','Druide','Ensorceleur',
      'Fighter','Guerrier','Gourou','Investigator','Magicien','Moine','Oracle',
      'Paladin','Rôdeur','Roublard','Sorcier','Mage'],
    hasSpells: true,
    hasSubclass: true,
    hasProficiency: true,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','speed','initiative','proficiency','background','spells','inventory'],
    money: ['po','pa','pc'],
  },

  // ── Warhammer Fantasy ───────────────────────────────────────
  "Warhammer Fantasy": {
    label: "Warhammer Fantasy",
    stats: [
      { key: 'ws',  label: 'CC',  default: 30 },
      { key: 'bs',  label: 'CT',  default: 30 },
      { key: 's',   label: 'F',   default: 30 },
      { key: 't',   label: 'E',   default: 30 },
      { key: 'i',   label: 'I',   default: 30 },
      { key: 'ag',  label: 'Ag',  default: 30 },
      { key: 'dex', label: 'Dex', default: 30 },
      { key: 'int', label: 'Int', default: 30 },
      { key: 'wp',  label: 'FM',  default: 30 },
      { key: 'fel', label: 'Soc', default: 30 },
    ],
    skills: [
      { name: 'Art', attr: 'dex' }, { name: 'Athlétisme', attr: 'ag' },
      { name: 'Baratin', attr: 'fel' }, { name: 'Calme', attr: 'wp' },
      { name: 'Commandement', attr: 'fel' }, { name: 'Commerce', attr: 'int' },
      { name: 'Conduite', attr: 'ag' }, { name: 'Conscience', attr: 'int' },
      { name: 'Discrétion', attr: 'ag' }, { name: 'Intimidation', attr: 's' },
      { name: 'Investigation', attr: 'int' }, { name: 'Lancer', attr: 'ag' },
      { name: 'Mêlée (base)', attr: 'ws' }, { name: 'Navigation', attr: 'i' },
      { name: 'Perception', attr: 'i' }, { name: 'Persuasion', attr: 'fel' },
      { name: 'Pistage', attr: 'i' }, { name: 'Premiers soins', attr: 'dex' },
      { name: 'Résistance', attr: 't' }, { name: 'Savoir (au choix)', attr: 'int' },
      { name: 'Survie', attr: 'i' }, { name: 'Tir', attr: 'bs' },
      { name: 'Vol', attr: 'ag' }, { name: 'Équitation', attr: 'ag' },
    ],
    races: ['Humain','Nain','Elfe','Halfelin','Haut Elfe','Elfe sylvain',
      'Nain des montagnes','Nain des forets'],
    classes: ['Guerrier','Artisan','Roublard','Lettré','Mystique','Roturier','Chasseur de primes',
      'Mercenaire','Soldat','Templier','Ingénieur','Médecin','Sorcier','Prêtre',
      'Voleur','Barde','Navigateur','Chevalier','Pisteur'],
    hasSpells: false,
    hasSubclass: false,
    hasProficiency: false,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','speed','initiative','wounds','fate','encumbrance'],
    wounds_label: 'Wounds',
  },

  // ── Call of Cthulhu ─────────────────────────────────────────
  "Call of Cthulhu": {
    label: "Call of Cthulhu",
    stats: [
      { key: 'str', label: 'FOR', default: 50 },
      { key: 'con', label: 'CON', default: 50 },
      { key: 'siz', label: 'TAI', default: 50 },
      { key: 'dex', label: 'DEX', default: 50 },
      { key: 'app', label: 'APP', default: 50 },
      { key: 'int', label: 'INT', default: 50 },
      { key: 'pow', label: 'POU', default: 50 },
      { key: 'edu', label: 'EDU', default: 50 },
    ],
    skills: [
      { name: 'Anthropologie', attr: 'int' }, { name: 'Archéologie', attr: 'int' },
      { name: 'Art', attr: 'pow' }, { name: 'Charme', attr: 'app' },
      { name: 'Combat', attr: 'str' }, { name: 'Comptabilité', attr: 'int' },
      { name: 'Conduite', attr: 'dex' }, { name: 'Conscience', attr: 'pow' },
      { name: 'Crochetage', attr: 'dex' }, { name: 'Discrétion', attr: 'dex' },
      { name: 'Droit', attr: 'int' }, { name: 'Équitation', attr: 'dex' },
      { name: 'Esquive', attr: 'dex' }, { name: 'Étranger', attr: 'edu' },
      { name: 'Évaluation', attr: 'int' }, { name: 'Explosifs', attr: 'int' },
      { name: 'Filature', attr: 'int' }, { name: 'Histoire', attr: 'edu' },
      { name: 'Intimidation', attr: 'str' }, { name: 'Investigation', attr: 'int' },
      { name: 'Lancer', attr: 'dex' }, { name: 'Marchandage', attr: 'app' },
      { name: 'Médecine', attr: 'int' }, { name: 'Natation', attr: 'str' },
      { name: 'Navigation', attr: 'int' }, { name: 'Occultisme', attr: 'int' },
      { name: 'Perception', attr: 'int' }, { name: 'Persuasion', attr: 'app' },
      { name: 'Pilotage', attr: 'dex' }, { name: 'Premiers soins', attr: 'int' },
      { name: 'Psychanalyse', attr: 'int' }, { name: 'Psychologie', attr: 'int' },
      { name: 'Sabotage', attr: 'dex' }, { name: 'Science', attr: 'int' },
      { name: 'Survie', attr: 'int' }, { name: 'Tir', attr: 'dex' },
    ],
    races: ['Humain'],
    classes: ['Archéologue','Artiste','Bodyguard','Chasseur','Détective','Docteur',
      'Écrivain','Érudit','Ingénieur','Journaliste','Militaire','Policier',
      'Professeur','Prêtre','Scientifique','Vagabond'],
    hasSpells: false,
    hasSubclass: false,
    hasProficiency: false,
    hasBackground: true,
    hasSanity: true,
    fields: ['race','occupation','hp','ac','speed','sanity','luck','wounds'],
  },

  // ── Starfinder ──────────────────────────────────────────────
  "Starfinder": {
    label: "Starfinder",
    stats: [
      { key: 'str', label: 'FOR',  default: 10 },
      { key: 'dex', label: 'DEX',  default: 10 },
      { key: 'con', label: 'CON',  default: 10 },
      { key: 'int', label: 'INT',  default: 10 },
      { key: 'wis', label: 'SAG',  default: 10 },
      { key: 'cha', label: 'CHA',  default: 10 },
    ],
    skills: [
      { name: 'Acrobaties', attr: 'dex' }, { name: 'Athlétisme', attr: 'str' },
      { name: 'Culture', attr: 'int' }, { name: 'Discrétion', attr: 'dex' },
      { name: 'Duperie', attr: 'cha' }, { name: 'Ingénierie', attr: 'int' },
      { name: 'Intimidation', attr: 'cha' }, { name: 'Médecine', attr: 'int' },
      { name: 'Mysticisme', attr: 'wis' }, { name: 'Navigation', attr: 'int' },
      { name: 'Perception', attr: 'wis' }, { name: 'Persuasion', attr: 'cha' },
      { name: 'Pilotage', attr: 'dex' }, { name: 'Profession', attr: 'int' },
      { name: 'Religion', attr: 'wis' }, { name: 'Survie', attr: 'wis' },
    ],
    races: ['Humain','Androïde','Ysoki','Kasatha','Shirren','Vesk','Lashunta'],
    classes: ['Envoyé','Mécaniste','Mystique','Opérateur','Solarian','Soldat','Technomancien'],
    hasSpells: false,
    hasSubclass: true,
    hasProficiency: true,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','speed','initiative','proficiency','stamina','spells','inventory'],
  },

  // ── Shadowrun ───────────────────────────────────────────────
  "Shadowrun": {
    label: "Shadowrun",
    stats: [
      { key: 'bod', label: 'BOD', default: 3 },
      { key: 'agi', label: 'AGI', default: 3 },
      { key: 'rea', label: 'REA', default: 3 },
      { key: 'str', label: 'FOR', default: 3 },
      { key: 'wil', label: 'VOL', default: 3 },
      { key: 'cha', label: 'CHA', default: 3 },
      { key: 'int', label: 'INT', default: 3 },
      { key: 'log', label: 'LOG', default: 3 },
      { key: 'edg', label: 'BORD',default: 1 },
    ],
    skills: [
      { name: 'Arme à feu', attr: 'agi' }, { name: 'Arme blanche', attr: 'agi' },
      { name: 'Athlétisme', attr: 'agi' }, { name: 'Conduite', attr: 'rea' },
      { name: 'Connaissance', attr: 'log' }, { name: 'Discrétion', attr: 'agi' },
      { name: 'Électronique', attr: 'log' }, { name: 'Étiquette', attr: 'cha' },
      { name: 'Étranger', attr: 'int' }, { name: 'Informatique', attr: 'log' },
      { name: 'Intimidation', attr: 'cha' }, { name: 'Investigation', attr: 'int' },
      { name: 'Lancer', attr: 'agi' }, { name: 'Perception', attr: 'int' },
      { name: 'Persuasion', attr: 'cha' }, { name: 'Pilotage', attr: 'rea' },
      { name: 'Pistage', attr: 'int' }, { name: 'Survie', attr: 'int' },
    ],
    races: ['Humain','Elfe','Nain','Orc','Troll'],
    classes: ['Decker','Mage','Adepte','Face','Samurai','Rigger','Technomancien'],
    hasSpells: false,
    hasSubclass: false,
    hasProficiency: false,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','initiative','essence','edge','inventory'],
    money: ['¥'],
  },

  // ── Vampire: The Masquerade ─────────────────────────────────
  "Vampire: The Masquerade": {
    label: "Vampire: The Masquerade",
    stats: [
      { key: 'str', label: 'FOR', default: 1 },
      { key: 'dex', label: 'DEX', default: 1 },
      { key: 'sta', label: 'VIG', default: 1 },
      { key: 'cha', label: 'CHA', default: 1 },
      { key: 'man', label: 'MAN', default: 1 },
      { key: 'app', label: 'APP', default: 1 },
      { key: 'per', label: 'PER', default: 1 },
      { key: 'int', label: 'INT', default: 1 },
      { key: 'wit', label: 'AST', default: 1 },
    ],
    skills: [
      { name: 'Athlétisme', attr: 'str' }, { name: 'Bagarre', attr: 'str' },
      { name: 'Danse', attr: 'dex' }, { name: 'Discrétion', attr: 'dex' },
      { name: 'Érudition', attr: 'int' }, { name: 'Espionnage', attr: 'per' },
      { name: 'Étiquette', attr: 'cha' }, { name: 'Intimidation', attr: 'man' },
      { name: 'Investigation', attr: 'per' }, { name: 'Méditation', attr: 'int' },
      { name: 'Mêlée', attr: 'str' }, { name: 'Persuasion', attr: 'cha' },
      { name: 'Pilotage', attr: 'dex' }, { name: 'Séduction', attr: 'app' },
      { name: 'Subterfuge', attr: 'man' }, { name: 'Survie', attr: 'sta' },
      { name: 'Tir', attr: 'dex' }, { name: 'Vol', attr: 'dex' },
    ],
    races: ['Brujah','Gangrel','Malkavien','Nosferatu','Toreador','Tremere','Ventrue','Assamite','Giovanni','Ravnos','Setite','Tzimisce','Lasombra'],
    classes: ['Ancilla','Neonate','Elder','Primogène'],
    hasSpells: true,
    hasSubclass: false,
    hasProficiency: false,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','sanguine','willpower','humanity','background','disciplines','inventory'],
    money: ['$'],
  },

  // ── Cyberpunk Red ───────────────────────────────────────────
  "Cyberpunk Red": {
    label: "Cyberpunk Red",
    stats: [
      { key: 'int', label: 'INT', default: 5 },
      { key: 'ref', label: 'REF', default: 5 },
      { key: 'dex', label: 'DEX', default: 5 },
      { key: 'tech',label: 'TECH',default: 5 },
      { key: 'cool',label: 'COOL',default: 5 },
      { key: 'will',label: 'VOL', default: 5 },
      { key: 'luck',label: 'CHAN',default: 5 },
      { key: 'move',label: 'MVT', default: 5 },
      { key: 'body',label: 'CORPS',default: 5 },
      { key: 'emp',  label: 'EMP',  default: 5 },
    ],
    skills: [
      { name: 'Arme à feu', attr: 'ref' }, { name: 'Arme lourde', attr: 'body' },
      { name: 'Athlétisme', attr: 'dex' }, { name: 'Bagarre', attr: 'body' },
      { name: 'Conduite', attr: 'ref' }, { name: 'Connaissance', attr: 'int' },
      { name: 'Crochetage', attr: 'tech' }, { name: 'Discrétion', attr: 'dex' },
      { name: 'Électronique', attr: 'tech' }, { name: 'Éloquence', attr: 'cool' },
      { name: 'Escalade', attr: 'dex' }, { name: 'Informatique', attr: 'int' },
      { name: 'Intimidation', attr: 'cool' }, { name: 'Investigation', attr: 'int' },
      { name: 'Médecine', attr: 'tech' }, { name: 'Mêlée', attr: 'dex' },
      { name: 'Perception', attr: 'int' }, { name: 'Persuasion', attr: 'cool' },
      { name: 'Pilotage', attr: 'ref' }, { name: 'Pistage', attr: 'int' },
      { name: 'Premiers soins', attr: 'tech' }, { name: 'Survie', attr: 'int' },
      { name: 'Tir', attr: 'ref' }, { name: 'Vol', attr: 'dex' },
    ],
    races: ['Humain'],
    classes: ['Rockeur','Solo','Netrunner','Tech','Médic','Exécutif','Fixeur','Nomade'],
    hasSpells: false,
    hasSubclass: false,
    hasProficiency: false,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','initiative','humanity','luck','inventory'],
    money: ['€$'],
  },

  // ── Savage Worlds ────────────────────────────────────────────
  "Savage Worlds": {
    label: "Savage Worlds",
    stats: [
      { key: 'agi', label: 'AGI', default: 4 },
      { key: 'sma', label: 'INT', default: 4 },
      { key: 'spi', label: 'AME', default: 4 },
      { key: 'str', label: 'FOR', default: 4 },
      { key: 'vig', label: 'VIG', default: 4 },
    ],
    skills: [
      { name: 'Athlétisme', attr: 'agi' }, { name: 'Bagare', attr: 'str' },
      { name: 'Combat', attr: 'str' }, { name: 'Conduite', attr: 'agi' },
      { name: 'Connaissance', attr: 'sma' }, { name: 'Discrétion', attr: 'agi' },
      { name: 'Éloquence', attr: 'spi' }, { name: 'Intimidation', attr: 'spi' },
      { name: 'Investigation', attr: 'sma' }, { name: 'Perception', attr: 'sma' },
      { name: 'Persuasion', attr: 'spi' }, { name: 'Pilotage', attr: 'agi' },
      { name: 'Réparation', attr: 'sma' }, { name: 'Survie', attr: 'sma' },
      { name: 'Tir', attr: 'agi' }, { name: 'Vol', attr: 'agi' },
    ],
    races: ['Humain'],
    classes: ['Combattant','Mage','Voleur','Prêtre','Noble','Explorateur'],
    hasSpells: true,
    hasSubclass: false,
    hasProficiency: false,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','speed','parry','toughness','power_points','inventory'],
    money: ['po','pa','pc'],
  },

  // ── Autre (générique) ───────────────────────────────────────
  "Autre": {
    label: "Autre",
    stats: [
      { key: 'stat1', label: 'Stat 1', default: 10 },
      { key: 'stat2', label: 'Stat 2', default: 10 },
      { key: 'stat3', label: 'Stat 3', default: 10 },
    ],
    skills: [],
    races: [],
    classes: [],
    hasSpells: false,
    hasSubclass: false,
    hasProficiency: false,
    hasBackground: false,
    fields: ['race','class','level','hp','ac','speed'],
  },
};

// ── Alias de compatibilité (campagnes créées avant renommage) ─
const SYSTEM_ALIASES = {
  'Warhammer': 'Warhammer Fantasy',
  'Vampire':  'Vampire: The Masquerade',
  'Cyberpunk': 'Cyberpunk Red',
};

// ── Helpers ──────────────────────────────────────────────────

/** Retourne la définition d'un système, avec fallback "Autre" */
function getSystem(systemName) {
  const resolved = SYSTEM_ALIASES[systemName] || systemName;
  return RPG_SYSTEMS[resolved] || RPG_SYSTEMS["Autre"];
}

/** Retourne la liste des stats pour un système */
function getSystemStats(systemName) {
  return getSystem(systemName).stats;
}

/** Retourne la liste des compétences pour un système */
function getSystemSkills(systemName) {
  return getSystem(systemName).skills;
}

/** Retourne les races disponibles */
function getSystemRaces(systemName) {
  return getSystem(systemName).races;
}

/** Retourne les classes/carrières disponibles */
function getSystemClasses(systemName) {
  return getSystem(systemName).classes;
}
