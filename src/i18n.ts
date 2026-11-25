/** Interface text in English and French. Every string a player can read
 * lives here; the UI asks for it by key. Hints are small trusted HTML
 * fragments (they contain <kbd> tags) and are the only strings inserted
 * as markup. */

export type Locale = "en" | "fr";
export type LanguageSetting = "auto" | Locale;

const EN = {
  tagline: "An endless world of light, built block by block.",
  play: "Play",
  resume: "Resume",
  settings: "Settings",
  worlds: "Worlds",
  worldsMode: "Worlds · {mode}",
  worldsLocalIntro:
    "Worlds saved on this device. Your family can join once online worlds are available.",
  worldLegacy: "Older save",
  worldCardDetails: "{mode} · Seed {seed} · {date}",
  worldCurrent: "Current world",
  worldOpen: "Play",
  worldRename: "Rename",
  worldSaveName: "Save name",
  worldName: "World name",
  worldDelete: "Delete",
  worldDeleteConfirm: "Tap again to permanently delete this save",
  worldSaveFailed: "Unable to save this change. Check your browser's storage.",
  worldCreate: "Create a world",
  worldOptionalSeed: "Seed (optional, random if blank)",
  worldCreateFailed: "Name required, seed already used or storage unavailable.",
  worldOpenSeed: "Open by seed",
  worldSeedNotSharing:
    "A seed shares the terrain, not saved builds or multiplayer. Shared worlds are coming later.",
  worldCurrentSettings: "Current world settings",
  worldExport: "Export backup",
  worldExportStarted: "Backup file prepared for download.",
  worldExportFailed: "Cannot export this world. Its save may be invalid or too large.",
  worldImport: "Restore a world from a file",
  worldImportHint: "JSON backups only, up to 6 MB. Existing worlds are never overwritten.",
  worldImportSuccess: "World restored. Select it above to play.",
  worldImportConflict: "This world's seed is already on this device. No data was replaced.",
  worldImportInvalid: "The backup file is invalid or too large.",

  fullscreen: "Fullscreen",
  back: "Back",
  privacy: "Privacy",
  hintDesktop:
    "<kbd>WASD</kbd> move &middot; <kbd>Space</kbd> jump (twice to fly) &middot; <kbd>Shift</kbd> sprint<br />" +
    "<kbd>Left click</kbd> break &middot; <kbd>Right click</kbd> place &middot; <kbd>Middle click</kbd> pick<br />" +
    "<kbd>E</kbd> blocks &middot; <kbd>1</kbd>-<kbd>9</kbd> or scroll to choose &middot; <kbd>F1</kbd> photo mode",
  hintTouch:
    "Left thumb moves &middot; drag the right side to look<br />" +
    "Tap to break &middot; the buttons jump, place and fly<br />" +
    "Tap a slot to choose a block",
  version: "v{version} · seed {seed}",
  graphics: "Graphics",
  qualityLow: "Low",
  qualityMedium: "Medium",
  qualityHigh: "High",
  qualityUltra: "Ultra",
  viewDistance: "View distance",
  chunks: "{n} chunks",
  fov: "Field of view",
  sensitivity: "Look sensitivity",
  volume: "Volume",
  invertY: "Invert vertical look",
  autoJump: "Auto-jump up ledges",
  viewBob: "View bobbing",
  showStats: "Show performance stats",
  language: "Language",
  languageAuto: "Auto",
  worldsIntro:
    "Every world grows from a seed. You're in world {seed} — share that number and a friend gets the same land.",
  seedPlaceholder: "A number or any word",
  seedLabel: "World seed",
  exploreWorld: "Explore this world",
  surpriseMe: "Surprise me",
  resetWorld: "Undo all my changes to this world",
  resetConfirm: "Tap again to erase everything you built here",
  blocks: "Blocks",
  inventoryHint: "Pick a block to put it in the selected slot.",
  close: "Close",
  flying: "Flying",
  walking: "Walking",
  dragonMount: "Mount dragon",
  dragonApproachHint: "Move closer to mount the dragon",
  dragonDismount: "Dismount",
  dragonTakeoffHint: "Mounted · Space to take off · R to dismount",
  dragonFlyingHint: "Mounted · Space to climb · C to land",
  dragonTouchTakeoffHint: "Hold ⤒ to take off",
  dragonTouchFlyingHint: "Hold ⤒ to climb · ⤓ to land",
  dragonLandingRequired: "Land before dismounting.",
  dragonExitBlocked: "Find a clear spot to dismount.",
  screenshotSaved: "Screenshot saved",
  mode: "Game mode",
  modeCreative: "Creative",
  modeAdventure: "Adventure",
  modeCreativeHint: "Every block, without limit, and you can fly.",
  modeAdventureHint: "Gather materials and make your first pick under Craft in your inventory.",
  tabBlocks: "Blocks",
  tabBag: "Bag",
  tabCraft: "Craft",
  tabJournal: "Journal",
  bagEmpty: "Your bag is empty. Dig something up!",
  craftHint: "Tap a recipe to make it.",
  miningPick: "Shard pick",
  miningPickEquipped: "Shard pick in hand.",
  miningPickSelect: "Select the shard pick to hold it.",
  miningPickOwned: "Already in your bag.",
  copperPick: "Copper pick",
  copperArmor: "Copper chestplate",
  copperPickRecipe: "A faster pick, reinforced with copper.",
  copperArmorRecipe: "Automatically worn. Halves damage from roamers.",
  copperArmorReady: "Copper chestplate equipped.",
  copperSword: "Copper sword",
  copperAxe: "Copper axe",
  woodShield: "Wooden shield",
  copperSwordRecipe: "A sturdy weapon: 4 damage instead of 2.",
  copperAxeRecipe: "Cuts logs faster and deals 3 damage.",
  woodShieldRecipe: "Hold it to reduce incoming damage by 1.",
  equipmentSelected: "{name} in hand.",
  shieldBlocked: "Shield blocked the attack!",
  catAdopt: "{use} to adopt this cat",
  catBreed: "{use} to bring your cats together",
  useMouse: "Right click",
  useTouch: "Place button",
  usePad: "Left trigger",
  catKitten: "Kitten",
  catAdopted: "This cat will follow you.",
  catPurr: "Bring another adult cat nearby.",
  catResting: "This cat is resting or still growing.",
  catFull: "Your family of cats is full.",
  catBorn: "A kitten joined the family!",
  roamer: "Slate roamer {life}/6",
  roamerStruck: "Roamer hit.",
  attackMouse: "Left click",
  attackTouch: "Tap",
  attackPad: "Right trigger",
  roamerFell: "Slate roamer defeated. Coal collected.",
  playerHurt: "A slate roamer hit you.",
  playerRetreat: "You returned to your starting point. Your bag is safe.",
  healthStatus: "Health {life}/{max}",
  petStatus: "Cats {count}",
  adventDay: "Day",
  adventNight: "Night",
  campSleep: "{use} to sleep until dawn",
  campDay: "Come back to the bed at night",
  campDawn: "You slept until dawn.",
  legacyMultiplayer: "Family multiplayer (previous version)",
  drillLeave: "Leave drill",
  drillBoard: "Board drill",
  drillFind: "Reach the drill",
  drillOn: "Boring",
  drillOff: "Drill off",
  drillPointerHint: "{status} · {size}×{size} · Hold click or J · T size · Space up · Ctrl down",
  drillDragHint: "{status} · {size}×{size} · J to bore · T size · Space up · Ctrl down",
  miningPickRecipe: "Mines rock faster and unlocks gold and crystal.",
  miningPickRequired: "Craft a shard pick to mine this block",
  digHold: "Hold left click to dig",
  digClick: "Click to start digging",
  digTouch: "Tap to start digging",
  digPad: "Press the right trigger to dig",
  digProgress: "Digging progress",
  journalProgress: "{found} of {total} discoveries",
  discovered: "Discovery: {name}",
  crafted: "Made {amount} × {name}",
  fatalTitle: "{name} couldn't start",
  fatalHint:
    "Try a hard refresh or another browser. If it keeps happening, please report this exact message.",
} as const;

export type TextKey = keyof typeof EN;

const FR: Record<TextKey, string> = {
  tagline: "Un monde infini de lumière, à bâtir bloc par bloc.",
  play: "Jouer",
  resume: "Reprendre",
  settings: "Réglages",
  worlds: "Mondes",
  worldsMode: "Mondes · {mode}",
  worldsLocalIntro:
    "Mondes sauvegardés sur cet appareil. Le partage familial arrivera avec les mondes en ligne.",
  worldLegacy: "Ancienne sauvegarde",
  worldCardDetails: "{mode} · Graine {seed} · {date}",
  worldCurrent: "Monde actuel",
  worldOpen: "Jouer",
  worldRename: "Renommer",
  worldSaveName: "Enregistrer",
  worldName: "Nom du monde",
  worldDelete: "Supprimer",
  worldDeleteConfirm: "Retouchez pour supprimer définitivement cette sauvegarde",
  worldSaveFailed: "Impossible d'enregistrer. Vérifiez le stockage du navigateur.",
  worldCreate: "Créer un monde",
  worldOptionalSeed: "Graine (facultative, aléatoire sinon)",
  worldCreateFailed: "Nom manquant, graine déjà utilisée ou stockage indisponible.",
  worldOpenSeed: "Ouvrir par graine",
  worldSeedNotSharing:
    "Une graine partage le terrain, pas les constructions ni une partie en ligne. Le partage arrive plus tard.",
  worldCurrentSettings: "Réglages du monde actuel",
  worldExport: "Exporter",
  worldExportStarted: "Fichier de sauvegarde prêt à télécharger.",
  worldExportFailed: "Impossible d'exporter ce monde : sauvegarde invalide ou trop volumineuse.",
  worldImport: "Restaurer un monde depuis un fichier",
  worldImportHint: "Fichiers de sauvegarde JSON, 6 Mo maximum. Aucun monde existant n'est écrasé.",
  worldImportSuccess: "Monde restauré. Sélectionnez-le dans la liste pour jouer.",
  worldImportConflict: "Cette graine existe déjà sur cet appareil. Aucune donnée remplacée.",
  worldImportInvalid: "Le fichier de sauvegarde est invalide ou trop volumineux.",

  fullscreen: "Plein écran",
  back: "Retour",
  privacy: "Confidentialité",
  hintDesktop:
    "<kbd>ZQSD</kbd> se déplacer &middot; <kbd>Espace</kbd> sauter (deux fois : voler) &middot; <kbd>Maj</kbd> courir<br />" +
    "<kbd>Clic gauche</kbd> casser &middot; <kbd>Clic droit</kbd> poser &middot; <kbd>Clic molette</kbd> copier<br />" +
    "<kbd>E</kbd> blocs &middot; <kbd>1</kbd>-<kbd>9</kbd> ou molette pour choisir &middot; <kbd>F1</kbd> mode photo",
  hintTouch:
    "Pouce gauche pour avancer &middot; glissez à droite pour regarder<br />" +
    "Touchez pour casser &middot; les boutons sautent, posent et volent<br />" +
    "Touchez une case pour choisir un bloc",
  version: "v{version} · graine {seed}",
  graphics: "Graphismes",
  qualityLow: "Bas",
  qualityMedium: "Moyen",
  qualityHigh: "Élevé",
  qualityUltra: "Ultra",
  viewDistance: "Distance d'affichage",
  chunks: "{n} tronçons",
  fov: "Champ de vision",
  sensitivity: "Sensibilité du regard",
  volume: "Volume",
  invertY: "Inverser l'axe vertical",
  autoJump: "Saut automatique",
  viewBob: "Balancement de la vue",
  showStats: "Afficher les performances",
  language: "Langue",
  languageAuto: "Auto",
  worldsIntro:
    "Chaque monde naît d'une graine. Vous êtes dans le monde {seed} — partagez ce nombre et un ami obtiendra les mêmes terres.",
  seedPlaceholder: "Un nombre ou un mot",
  seedLabel: "Graine du monde",
  exploreWorld: "Explorer ce monde",
  surpriseMe: "Surprends-moi",
  resetWorld: "Annuler toutes mes modifications dans ce monde",
  resetConfirm: "Touchez encore pour effacer tout ce que vous avez construit ici",
  blocks: "Blocs",
  inventoryHint: "Choisissez un bloc pour le placer dans la case sélectionnée.",
  close: "Fermer",
  flying: "En vol",
  walking: "À pied",
  dragonMount: "Monter sur le dragon",
  dragonApproachHint: "Approche-toi du dragon pour monter",
  dragonDismount: "Quitter la selle",
  dragonTakeoffHint: "En selle · Espace pour décoller · R pour quitter la selle",
  dragonFlyingHint: "En selle · Espace pour monter · C pour atterrir",
  dragonTouchTakeoffHint: "Maintiens ⤒ pour décoller",
  dragonTouchFlyingHint: "Maintiens ⤒ pour monter · ⤓ pour atterrir",
  dragonLandingRequired: "Pose le dragon avant de quitter la selle.",
  dragonExitBlocked: "Trouve un endroit dégagé pour quitter la selle.",
  screenshotSaved: "Capture enregistrée",
  mode: "Mode de jeu",
  modeCreative: "Créatif",
  modeAdventure: "Aventure",
  modeCreativeHint: "Tous les blocs, sans limite, et vous pouvez voler.",
  modeAdventureHint:
    "Récolte des matériaux, puis fabrique ta première pioche dans l’onglet Fabriquer de l’inventaire.",
  tabBlocks: "Blocs",
  tabBag: "Sac",
  tabCraft: "Fabriquer",
  tabJournal: "Journal",
  bagEmpty: "Votre sac est vide. Allez creuser !",
  craftHint: "Touchez une recette pour la fabriquer.",
  miningPick: "Pioche d’éclat",
  miningPickEquipped: "Pioche d’éclat en main.",
  miningPickSelect: "Sélectionne la pioche pour la prendre en main.",
  miningPickOwned: "Déjà dans ton sac.",
  copperPick: "Pioche en cuivre",
  copperArmor: "Plastron en cuivre",
  copperPickRecipe: "Une pioche renforcée au cuivre qui mine plus vite.",
  copperArmorRecipe: "S’équipe automatiquement et réduit de moitié les dégâts des rôdeurs.",
  copperArmorReady: "Plastron en cuivre équipé.",
  copperSword: "Épée en cuivre",
  copperAxe: "Hache en cuivre",
  woodShield: "Bouclier en bois",
  copperSwordRecipe: "Une arme solide : 4 dégâts au lieu de 2.",
  copperAxeRecipe: "Coupe le bois plus vite et inflige 3 dégâts.",
  woodShieldRecipe: "Tenu en main, réduit les dégâts reçus de 1.",
  equipmentSelected: "{name} en main.",
  shieldBlocked: "Le bouclier a bloqué l'attaque !",
  catAdopt: "{use} pour adopter ce chat",
  catBreed: "{use} pour réunir tes chats",
  useMouse: "Clic droit",
  useTouch: "Bouton Poser",
  usePad: "Gâchette gauche",
  catKitten: "Chaton",
  catAdopted: "Ce chat va te suivre.",
  catPurr: "Fais venir un autre chat adulte à proximité.",
  catResting: "Ce chat se repose ou est encore en train de grandir.",
  catFull: "Ta famille de chats est au complet.",
  catBorn: "Un chaton rejoint la famille !",
  roamer: "Rôdeur de schiste {life}/6",
  roamerStruck: "Rôdeur touché.",
  attackMouse: "Clic gauche",
  attackTouch: "Touche",
  attackPad: "Gâchette droite",
  roamerFell: "Rôdeur vaincu. Charbon récolté.",
  playerHurt: "Un rôdeur de schiste t’a touché.",
  playerRetreat: "Tu as regagné ton point de départ et conservé ton sac.",
  healthStatus: "Santé {life}/{max}",
  petStatus: "Chats {count}",
  adventDay: "Jour",
  adventNight: "Nuit",
  campSleep: "{use} pour dormir jusqu’à l’aube",
  campDay: "Reviens au lit de camp la nuit",
  campDawn: "Tu as dormi jusqu’à l’aube.",
  legacyMultiplayer: "Multijoueur familial (ancienne version)",
  drillLeave: "Quitter la foreuse",
  drillBoard: "Monter dans la foreuse",
  drillFind: "Rejoindre la foreuse",
  drillOn: "Forage actif",
  drillOff: "Foret arrêté",
  drillPointerHint:
    "{status} · {size}×{size} · Clic maintenu ou J · T diamètre · Espace monte · Ctrl descend",
  drillDragHint: "{status} · {size}×{size} · J fore · T diamètre · Espace monte · Ctrl descend",
  miningPickRecipe: "Mine la roche plus vite et permet de récolter l’or et les cristaux.",
  miningPickRequired: "Fabrique une pioche d’éclat pour miner ce bloc",
  digHold: "Maintiens le clic gauche pour creuser",
  digClick: "Clique pour commencer à creuser",
  digTouch: "Touche pour commencer à creuser",
  digPad: "Appuie sur la gâchette droite pour creuser",
  digProgress: "Progression de la récolte",
  journalProgress: "{found} découvertes sur {total}",
  discovered: "Découverte : {name}",
  crafted: "{amount} × {name} fabriqué",
  fatalTitle: "{name} n'a pas pu démarrer",
  fatalHint:
    "Essayez un rechargement complet ou un autre navigateur. Si le problème persiste, signalez ce message exact.",
};

const TEXT: Record<Locale, Record<TextKey, string>> = { en: EN, fr: FR };

/** French names for the blocks, keyed by their English (registry) name. */
const BLOCK_NAMES_FR: Record<string, string> = {
  air: "air",
  grass: "herbe",
  dirt: "terre",
  stone: "pierre",
  sand: "sable",
  water: "eau",
  "oak log": "bûche de chêne",
  "oak leaves": "feuilles de chêne",
  bedrock: "socle rocheux",
  snow: "neige",
  "tall grass": "hautes herbes",
  "ember bloom": "fleur de braise",
  "sun daisy": "marguerite solaire",
  "sky bell": "clochette céleste",
  planks: "planches",
  cobblestone: "pavés",
  "stone bricks": "briques de pierre",
  glass: "verre",
  lantern: "lanterne",
  "coal ore": "minerai de charbon",
  "gold ore": "minerai d'or",
  "lumen crystal": "cristal de lumen",
  "pale log": "bûche pâle",
  "autumn leaves": "feuilles d'automne",
  "pine log": "bûche de pin",
  "pine needles": "aiguilles de pin",
  cactus: "cactus",
  gravel: "gravier",
  ice: "glace",
  bricks: "briques",
  sandstone: "grès",
  "dry bush": "buisson sec",
  "frosted grass": "herbe givrée",
  glowshroom: "champignon luisant",
  "copper ore": "minerai de cuivre",
  "rough diamond": "diamant brut",
  "hammered copper": "cuivre martelé",
  "camp bed": "lit de camp",
  clay: "argile",
};

/** Names of the journal's discoveries, by id. */
const DISCOVERY_NAMES: Record<Locale, Record<string, string>> = {
  en: {
    "biome-0": "The ocean",
    "biome-1": "A beach",
    "biome-2": "The meadows",
    "biome-3": "An oak forest",
    "biome-4": "An autumn grove",
    "biome-5": "A pine forest",
    "biome-6": "The desert",
    "biome-7": "The tundra",
    "biome-8": "The mountains",
    "biome-9": "A snowy peak",
    "first-dig": "First dig",
    "first-build": "First block placed",
    builder: "Builder (50 blocks)",
    architect: "Architect (500 blocks)",
    light: "Let there be light",
    lumen: "A lumen crystal",
    glowshroom: "A glowing mushroom",
    coal: "Coal",
    gold: "Gold",
    deep: "Deep underground",
    summit: "On top of the world",
    swim: "A swim",
    night: "A night under the stars",
    rain: "Caught in the rain",
    snow: "Snowfall",
    storm: "A thunderstorm",
    craft: "First craft",
    fly: "Taking flight",
  },
  fr: {
    "biome-0": "L'océan",
    "biome-1": "Une plage",
    "biome-2": "Les prairies",
    "biome-3": "Une forêt de chênes",
    "biome-4": "Un bois d'automne",
    "biome-5": "Une forêt de pins",
    "biome-6": "Le désert",
    "biome-7": "La toundra",
    "biome-8": "Les montagnes",
    "biome-9": "Un sommet enneigé",
    "first-dig": "Premier coup de pioche",
    "first-build": "Premier bloc posé",
    builder: "Bâtisseur (50 blocs)",
    architect: "Architecte (500 blocs)",
    light: "Que la lumière soit",
    lumen: "Un cristal de lumen",
    glowshroom: "Un champignon luisant",
    coal: "Du charbon",
    gold: "De l'or",
    deep: "Au fond de la terre",
    summit: "Sur le toit du monde",
    swim: "Une baignade",
    night: "Une nuit sous les étoiles",
    rain: "Surpris par la pluie",
    snow: "Chute de neige",
    storm: "Un orage",
    craft: "Première fabrication",
    fly: "L'envol",
  },
};

export const LOCALES: readonly Locale[] = ["en", "fr"];

/** Picks the first supported language from the browser's preference list. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split("-")[0];
    if (base === "fr") return "fr";
    if (base === "en") return "en";
  }
  return "en";
}

export function resolveLocale(setting: LanguageSetting, languages: readonly string[]): Locale {
  return setting === "auto" ? detectLocale(languages) : setting;
}

export interface Translator {
  readonly locale: Locale;
  /** The text for a key, with `{name}` placeholders filled in. */
  (key: TextKey, values?: Record<string, string | number>): string;
  /** A block's display name, from its registry name. */
  block(name: string): string;
  /** A journal discovery's name, from its id. */
  discovery(id: string): string;
}

export function createTranslator(locale: Locale): Translator {
  const table = TEXT[locale];
  const translate = (key: TextKey, values?: Record<string, string | number>): string => {
    let text = table[key];
    if (values) {
      for (const [name, value] of Object.entries(values)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
  return Object.assign(translate, {
    locale,
    block: (name: string): string => (locale === "fr" ? (BLOCK_NAMES_FR[name] ?? name) : name),
    discovery: (id: string): string => DISCOVERY_NAMES[locale][id] ?? id,
  });
}

/** Every key, for tests and tooling. */
export const TEXT_KEYS = Object.keys(EN) as TextKey[];
export function hasFrenchBlockName(name: string): boolean {
  return name in BLOCK_NAMES_FR;
}
export function hasDiscoveryName(locale: Locale, id: string): boolean {
  return id in DISCOVERY_NAMES[locale];
}
