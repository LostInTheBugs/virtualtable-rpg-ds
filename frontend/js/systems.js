// ═══════════════════════════════════════════════════════════════
//  SYSTEMS.JS — Définitions des systèmes de jeu
//  Chaque système définit ses propres stats, compétences, races,
//  classes, et champs spécifiques pour la création de personnage.
// ═══════════════════════════════════════════════════════════════

const RPG_SYSTEMS = {

  // ── D&D 5e ──────────────────────────────────────────────────
  "D&D 5e": {
    label: "D&D 5e",
    desc: "Le plus célèbre des jeux de rôle fantasy. Personnalisation poussée via classes, sous-classes, sorts et dons. Système de combat tactique au tour par tour.",
    logo: "🐉",
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
    desc: "Successeur spirituel de D&D 3.5. Système très tactique avec trois actions par tour, classes et archétypes variés.",
    logo: "⚔️",
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
    desc: "Univers sombre et brutal du Vieux Monde. Carrières évolutives, combat mortel, magie dangereuse. Système de pourcentages (d100).",
    logo: "🗡️",
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
    desc: "Enquête horrifique dans l'univers de H.P. Lovecraft. Système de pourcentages (d100), santé mentale (SAN), mythe de Cthulhu. Très orienté enquête et rôle.",
    logo: "🐙",
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
    desc: "D&D 5e dans l'espace. Créatures aliens, vaisseaux spatiaux, technologie avancée et magie (mysticisme). Système de stamina et résolution.",
    logo: "🚀",
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
    desc: "Cyberpunk-fantasy. Hackers, mages, samouraïs et elfes dans un futur dystopique. Système de pool de dés (d6), essence et magie matricielle.",
    logo: "🤖",
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
    desc: "Jeu de rôle narratif dans le Monde des Ténèbres. Incarnez un vampire, gérez votre humanité, vos disciplines et votre sang. Système de pool de d10.",
    logo: "🦇",
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
    desc: "Dark future city. Cyber-implantations, armes à feu, netrunning et rockers. Système d10 avec explosion de dés, armure SP.",
    logo: "💻",
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
    desc: "Système générique rapide et nerveux (Fast! Furious! Fun!). Dés dégressifs par compétence, cartes pour l'initiative, bénéfices et handicaps.",
    logo: "🎲",
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

  // ── Cats! La Mascarade ─────────────────────────────────────
  "Cats! La Mascarade": {
    label: "Cats! La Mascarade",
    desc: "Jeu de rôle français où les PJ sont des chats vivant dans l'Ombre. Agilité, charme félin, griffes et mystères. Système narratif léger.",
    logo: "🐱",
    stats: [
      { key: 'agi', label: 'AGI', default: 3 },
      { key: 'per', label: 'PER', default: 3 },
      { key: 'cha', label: 'CHA', default: 3 },
      { key: 'sag', label: 'SAG', default: 3 },
      { key: 'for', label: 'FOR', default: 3 },
    ],
    skills: [
      { name: 'Acrobaties', attr: 'agi' }, { name: 'Discrétion', attr: 'agi' },
      { name: 'Charme', attr: 'cha' }, { name: 'Perception', attr: 'per' },
      { name: 'Intuition', attr: 'sag' }, { name: 'Esquive', attr: 'agi' },
      { name: 'Bagarre', attr: 'for' }, { name: 'Investigation', attr: 'per' },
    ],
    races: ['Chat de gouttière','Siamois','Persan','Maine Coon','Bengal','Sphynx','Européen'],
    classes: ['Vagabond','Mascotte','Chasseur','Voyant','Protecteur','Espion'],
    hasSpells: false,
    hasSubclass: false,
    hasProficiency: false,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','initiative','luck'],
  },

  // ── Dune: Adventures in the Imperium ─────────────────────────
  "Dune": {
    label: "Dune",
    desc: "Univers de Frank Herbert. Politique, intrigues et combat dans l'Imperium. Système 2d20 avec momentum, avantages et compétences de Maison.",
    logo: "🏜️",
    stats: [
      { key: 'str', label: 'FOR', default: 8 },
      { key: 'agi', label: 'AGI', default: 8 },
      { key: 'vol', label: 'VOL', default: 8 },
      { key: 'emp', label: 'EMP', default: 8 },
      { key: 'rai', label: 'RAI', default: 8 },
    ],
    skills: [
      { name: 'Combat', attr: 'str' }, { name: 'Déplacement', attr: 'agi' },
      { name: 'Discrétion', attr: 'agi' }, { name: 'Guerilla', attr: 'str' },
      { name: 'Commandement', attr: 'vol' }, { name: 'Diplomatie', attr: 'emp' },
      { name: 'Artisanat', attr: 'rai' }, { name: 'Connaissance', attr: 'rai' },
      { name: 'Perception', attr: 'vol' }, { name: 'Persuasion', attr: 'emp' },
      { name: 'Pilotage', attr: 'agi' }, { name: 'Savoir', attr: 'rai' },
      { name: 'Société', attr: 'emp' }, { name: 'Survie', attr: 'vol' },
    ],
    races: ['Humain','Bene Gesserit','Mentat','Sardaukar','Fremen','Navigateur','Ixien'],
    classes: ['Guerrier','Diplomate','Mentat','Bene Gesserit','Pilote','Savant','Noble'],
    hasSpells: false,
    hasSubclass: false,
    hasProficiency: false,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','speed','initiative','inventory'],
    money: ['Solaris'],
  },

  // ── Star Wars (FFG / Narrative Dice) ──────────────────────
  "Star Wars": {
    label: "Star Wars",
    desc: "Galaxie lointaine, très lointaine. Système aux dés narratifs (Boost/Setback/Advantage/Threat). Trois sagas : Rebelles, Contrebandiers ou Jedi.",
    logo: "⭐",
    stats: [
      { key: 'brw', label: 'BRU', default: 2 },
      { key: 'agi', label: 'AGI', default: 2 },
      { key: 'int', label: 'INT', default: 2 },
      { key: 'cun', label: 'RUS', default: 2 },
      { key: 'wil', label: 'VOL', default: 2 },
      { key: 'prs', label: 'PRE', default: 2 },
    ],
    skills: [
      { name: 'Athlétisme', attr: 'brw' }, { name: 'Bagarre', attr: 'brw' },
      { name: 'Conduite', attr: 'agi' }, { name: 'Discrétion', attr: 'agi' },
      { name: 'Gunnery', attr: 'agi' }, { name: 'Mêlée', attr: 'brw' },
      { name: 'Pilotage', attr: 'agi' }, { name: 'Tir', attr: 'agi' },
      { name: 'Astrogation', attr: 'int' }, { name: 'Informatique', attr: 'int' },
      { name: 'Investigation', attr: 'int' }, { name: 'Médecine', attr: 'int' },
      { name: 'Perception', attr: 'cun' }, { name: 'Pistage', attr: 'cun' },
      { name: 'Charme', attr: 'prs' }, { name: 'Intimidation', attr: 'prs' },
      { name: 'Persuasion', attr: 'prs' }, { name: 'Tromperie', attr: 'cun' },
      { name: 'Commandement', attr: 'wil' }, { name: 'Survie', attr: 'wil' },
      { name: 'Force', attr: 'wil' },
    ],
    races: ['Humain','Wookiee','Twi lek','Droid','Zabrak','Bothan','Mon Calamari','Rodian',
      'Trandoshan','Céréen','Ewok','Mandalorien','Chiss'],
    classes: ['Garde','Explorateur','Diplomate','Mystique','Contrebandier','Mécanicien','Pilote','Soldat','Jedi','Sith'],
    hasSpells: true,
    hasSubclass: true,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','speed','initiative','proficiency','background','spells','inventory'],
    money: ['Crédit'],
  },

  // ── Le Seigneur des Anneaux (The One Ring) ─────────────────
  "Le Seigneur des Anneaux": {
    label: "Le Seigneur des Anneaux",
    desc: "Terre du Milieu. Compagnie de Héros, ombre du Mordor, conseils et voyages. Système de dés de succès avec Courage et Ombre.",
    logo: "💍",
    stats: [
      { key: 'str', label: 'COR', default: 3 },
      { key: 'agi', label: 'AGA', default: 3 },
      { key: 'vit', label: 'VIT', default: 3 },
      { key: 'coeur',label: 'CŒU',default: 3 },
      { key: 'sag', label: 'SAG', default: 3 },
    ],
    skills: [
      { name: 'Archerie', attr: 'agi' }, { name: 'Athlétisme', attr: 'str' },
      { name: 'Combat', attr: 'str' }, { name: 'Chant', attr: 'coeur' },
      { name: 'Courtoisie', attr: 'coeur' }, { name: 'Étiquette', attr: 'coeur' },
      { name: 'Furtivité', attr: 'agi' }, { name: 'Guérison', attr: 'sag' },
      { name: 'Lore', attr: 'sag' }, { name: 'Lutte', attr: 'str' },
      { name: 'Navigation', attr: 'sag' }, { name: 'Pistage', attr: 'vit' },
      { name: 'Survie', attr: 'vit' }, { name: 'Voyage', attr: 'vit' },
    ],
    races: ['Humain','Elfe','Nain','Hobbit','Bardien','Béornide','Homme du Sud','Rohirrim','Gondorien'],
    classes: ['Guerrier','Explorateur','Voyageur','Ménéstrel','Magicien','Soigneur'],
    hasSpells: true,
    hasSubclass: false,
    hasProficiency: false,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','speed','initiative','background','spells','inventory'],
    money: ['po'],
  },

  // ── Paranoia ──────────────────────────────────────────────
  "Paranoia": {
    label: "Paranoia",
    desc: "Humour dystopique dans un complexe souterrain dirigé par l'Amical Ordinateur. Trahison, clones, mutants et société secrètes. Système d100.",
    logo: "☢️",
    stats: [
      { key: 'vio', label: 'VIOL', default: 5 },
      { key: 'cha', label: 'CHAR', default: 5 },
      { key: 'sav', label: 'SAVO', default: 5 },
      { key: 'meca',label: 'MÉCA',default: 5 },
    ],
    skills: [
      { name: 'Armes à énergie', attr: 'vio' }, { name: 'Bagarre', attr: 'vio' },
      { name: 'Conduite', attr: 'meca' }, { name: 'Électronique', attr: 'meca' },
      { name: 'Discrétion', attr: 'cha' }, { name: 'Sécurité', attr: 'sav' },
      { name: 'Psychologie', attr: 'sav' }, { name: 'Persuasion', attr: 'cha' },
      { name: 'Déguisement', attr: 'cha' }, { name: 'Armes de poing', attr: 'vio' },
    ],
    races: ['Humain','Clone Alpha','Clone Beta','Clone Gamma','Clone Delta'],
    classes: ['Sécurité','Technologie','Administration','Médical','Psychique','Espion'],
    hasSpells: false,
    hasSubclass: false,
    hasProficiency: false,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','speed','security_clearance','treason'],
    money: ['Crédit'],
  },

  // ── Tomorrow City ─────────────────────────────────────────
  "Tomorrow City": {
    label: "Tomorrow City",
    desc: "Jeu de rôle français cyber-noir. Megacorporations, implants cybernétiques et pluie acide. Système narratif avec dés de conflit.",
    logo: "🌆",
    stats: [
      { key: 'phy', label: 'PHY', default: 5 },
      { key: 'men', label: 'MEN', default: 5 },
      { key: 'soc', label: 'SOC', default: 5 },
      { key: 'ins', label: 'INS', default: 5 },
    ],
    skills: [
      { name: 'Combat', attr: 'phy' }, { name: 'Athlétisme', attr: 'phy' },
      { name: 'Discrétion', attr: 'phy' }, { name: 'Tir', attr: 'phy' },
      { name: 'Conduite', attr: 'men' }, { name: 'Informatique', attr: 'men' },
      { name: 'Médecine', attr: 'men' }, { name: 'Investigation', attr: 'men' },
      { name: 'Persuasion', attr: 'soc' }, { name: 'Réseau', attr: 'soc' },
      { name: 'Intimidation', attr: 'soc' }, { name: 'Étiquette', attr: 'soc' },
      { name: 'Perception', attr: 'ins' }, { name: 'Survie', attr: 'ins' },
    ],
    races: ['Humain'],
    classes: ['Exécuteur','Pirate','Médic','Fixeur','Journaliste','Détective','Policier'],
    hasSpells: false,
    hasSubclass: false,
    hasProficiency: false,
    hasBackground: true,
    fields: ['race','class','level','hp','ac','initiative','cyberdeck','inventory'],
    money: ['¥'],
  },

  // ── Autre (générique) ───────────────────────────────────────
  "Autre": {
    label: "Autre",
    desc: "Système de jeu non listé. Utilisez pour tout jeu ne figurant pas dans cette liste (Chroniques Oubliées, Légendes, etc.).",
    logo: "❓",
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
