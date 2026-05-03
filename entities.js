// entities.js
import { OVERLOADS, getActiveCombo, checkOverload, ENEMY_ELEMENTS } from './elements.js';

// ============================================================
//  CLASS DEFINITIONS
// ============================================================
export const CLASS_DEFINITIONS = {
    fire: {
        name: "PYRO", avatar: "🧙",
        description: "Glass cannon. High damage, low survivability.",
        startingElement: 'fire',
        baseStats: { str: 3, dex: 2, con: 0, int: 4, wis: 1 },
        statMin:   { str: 0, dex: 0, con: 0, int: 0, wis: 0 },
        statMax:   { str: 10, dex: 8, con: 5, int: 15, wis: 8 },
        baseHp: 8,
        baseWeapon: { name: "Ember Wand", baseDamage: 3, baseFireRate: 900, color: 'orange', element: 'fire' },
        // Element unlock table — which elements are offered at each class profile level
        elementUnlocks: {
            2:  ['fire', 'lightning', 'earth'],
            4:  ['water', 'ice', 'wind'],
            6:  ['dark', 'void', 'necrotic'],
            10: ['holy', 'light', 'poison'],
            15: ['fire', 'lightning', 'plasma'], // plasma = combo unlock
        },
        skills: {
            fireBurst:   { name: "Fire Burst",   icon: "🔥", description: "AOE explosion around you",        cooldown: 0, maxCD: 150, tier: 0, maxTier: 3 },
            flameDash:   { name: "Flame Dash",   icon: "💨", description: "Dash in movement direction",      cooldown: 0, maxCD: 200, tier: 0, maxTier: 3 },
            moltenGuard: { name: "Molten Guard", icon: "🛡️", description: "Shield that absorbs damage",      cooldown: 0, maxCD: 400, tier: 0, maxTier: 3 },
            inferno:     { name: "Inferno",      icon: "☄️", description: "Screen-wide nuke",               cooldown: 0, maxCD: 1000, tier: 0, maxTier: 3 },
        }
    },
    blood: {
        name: "BLOOD", avatar: "🧛",
        description: "Sustain fighter. Lifesteal and high HP.",
        startingElement: 'necrotic',
        baseStats: { str: 2, dex: 1, con: 4, int: 1, wis: 2 },
        statMin:   { str: 0, dex: 0, con: 0, int: 0, wis: 0 },
        statMax:   { str: 8, dex: 6, con: 15, int: 5, wis: 8 },
        baseHp: 15,
        baseWeapon: { name: "Blood Lance", baseDamage: 2, baseFireRate: 1100, color: '#ff0000', element: 'necrotic' },
        elementUnlocks: {
            2:  ['necrotic', 'dark', 'poison'],
            4:  ['void', 'earth', 'wind'],
            6:  ['fire', 'lightning', 'ice'],
            10: ['holy', 'water', 'light'],
            15: ['necrotic', 'dark', 'leech'], // leech = combo unlock
        },
        skills: {
            bloodDrain:  { name: "Blood Drain",  icon: "🩸", description: "Drain HP from nearest enemy",     cooldown: 0, maxCD: 180, tier: 0, maxTier: 3 },
            batSwarm:    { name: "Bat Swarm",    icon: "🦇", description: "Multi-hit all nearby enemies",    cooldown: 0, maxCD: 220, tier: 0, maxTier: 3 },
            bloodPact:   { name: "Blood Pact",   icon: "❤️", description: "Sacrifice HP for a damage burst", cooldown: 0, maxCD: 350, tier: 0, maxTier: 3 },
            hemorrhage:  { name: "Hemorrhage",   icon: "💉", description: "Execute low HP enemies instantly",cooldown: 0, maxCD: 900, tier: 0, maxTier: 3 },
        }
    },
    plague: {
        name: "ROT", avatar: "🧟",
        description: "DoT specialist. Slow but devastating over time.",
        startingElement: 'poison',
        baseStats: { str: 1, dex: 0, con: 2, int: 5, wis: 2 },
        statMin:   { str: 0, dex: 0, con: 0, int: 0, wis: 0 },
        statMax:   { str: 6, dex: 5, con: 8, int: 15, wis: 10 },
        baseHp: 10,
        baseWeapon: { name: "Rot Staff", baseDamage: 1, baseFireRate: 1400, color: '#00ff00', element: 'poison' },
        elementUnlocks: {
            2:  ['poison', 'necrotic', 'dark'],
            4:  ['earth', 'water', 'wind'],
            6:  ['void', 'ice', 'lightning'],
            10: ['fire', 'holy', 'light'],
            15: ['poison', 'necrotic', 'acid'], // acid = combo unlock
        },
        skills: {
            poisonCloud: { name: "Poison Cloud", icon: "☠️", description: "Leave a damaging poison zone",    cooldown: 0, maxCD: 160, tier: 0, maxTier: 3 },
            webTrap:     { name: "Web Trap",     icon: "🕸️", description: "Slow all nearby enemies",        cooldown: 0, maxCD: 240, tier: 0, maxTier: 3 },
            reanimate:   { name: "Reanimate",    icon: "🧟", description: "Summon a zombie ally",           cooldown: 0, maxCD: 450, tier: 0, maxTier: 3 },
            plagueNova:  { name: "Plague Nova",  icon: "🌑", description: "Ultimate DoT burst on all",      cooldown: 0, maxCD: 950, tier: 0, maxTier: 3 },
        }
    }
};

// ============================================================
//  SKILL TIER BONUSES
// ============================================================
export const SKILL_TIERS = {
    fire: {
        fireBurst:   [ {}, { cdMult: 0.85, dmg: 3 },  { cdMult: 0.7,  dmg: 6  } ],
        flameDash:   [ {}, { cdMult: 0.85, dist: 220 },{ cdMult: 0.7,  dist: 280 } ],
        moltenGuard: [ {}, { cdMult: 0.85, heal: 4 },  { cdMult: 0.7,  heal: 8  } ],
        inferno:     [ {}, { cdMult: 0.85, dmg: 10 },  { cdMult: 0.7,  dmg: 20  } ],
    },
    blood: {
        bloodDrain:  [ {}, { cdMult: 0.85, heal: 4 },  { cdMult: 0.7,  heal: 8  } ],
        batSwarm:    [ {}, { cdMult: 0.85, dmg: 3 },   { cdMult: 0.7,  dmg: 6   } ],
        bloodPact:   [ {}, { cdMult: 0.85, dmg: 8 },   { cdMult: 0.7,  dmg: 16  } ],
        hemorrhage:  [ {}, { cdMult: 0.85, threshold: 0.3 }, { cdMult: 0.7, threshold: 0.5 } ],
    },
    plague: {
        poisonCloud: [ {}, { cdMult: 0.85, dmg: 2 },   { cdMult: 0.7,  dmg: 4   } ],
        webTrap:     [ {}, { cdMult: 0.85, slow: 0.4 }, { cdMult: 0.7,  slow: 0.6 } ],
        reanimate:   [ {}, { cdMult: 0.85, hp: 10 },   { cdMult: 0.7,  hp: 20   } ],
        plagueNova:  [ {}, { cdMult: 0.85, dmg: 8 },   { cdMult: 0.7,  dmg: 16  } ],
    }
};

// ============================================================
//  WEAPON DEFINITIONS
//  Each weapon has an element, XP thresholds, and skill unlocks
// ============================================================
export const WEAPON_DEFS = {
    emberWand:   { name: "Ember Wand",    baseDamage: 3,  baseFireRate: 900,  color: 'orange',   element: 'fire',
                   xpThresholds: [0, 50, 150, 300], skills: ['flameSplash', 'infernoShot', 'phoenixRound'] },
    bloodLance:  { name: "Blood Lance",   baseDamage: 2,  baseFireRate: 1100, color: '#ff0000',  element: 'necrotic',
                   xpThresholds: [0, 60, 180, 360], skills: ['drainShot', 'hemorrhageRound', 'soulPierce'] },
    rotStaff:    { name: "Rot Staff",     baseDamage: 1,  baseFireRate: 1400, color: '#00ff00',  element: 'poison',
                   xpThresholds: [0, 40, 120, 280], skills: ['toxicShot', 'plagueRound', 'deathSpore'] },
    frostBow:    { name: "Frost Bow",     baseDamage: 2,  baseFireRate: 1000, color: '#aaddff',  element: 'ice',
                   xpThresholds: [0, 55, 165, 330], skills: ['chilledShot', 'glacialArrow', 'absoluteZero'] },
    stormBlade:  { name: "Storm Blade",   baseDamage: 4,  baseFireRate: 700,  color: '#ffff88',  element: 'lightning',
                   xpThresholds: [0, 70, 200, 400], skills: ['chainSlash', 'shockwave', 'thunderclap'] },
    voidShard:   { name: "Void Shard",    baseDamage: 3,  baseFireRate: 800,  color: '#9900ff',  element: 'void',
                   xpThresholds: [0, 80, 240, 480], skills: ['nullShot', 'realityTear', 'annihilate'] },
    holyOrb:     { name: "Holy Orb",      baseDamage: 2,  baseFireRate: 1200, color: '#ffffcc',  element: 'holy',
                   xpThresholds: [0, 50, 150, 300], skills: ['divineSmite', 'sacredNova', 'judgement'] },
    earthShaker: { name: "Earth Shaker",  baseDamage: 5,  baseFireRate: 1600, color: '#aa7744',  element: 'earth',
                   xpThresholds: [0, 90, 270, 540], skills: ['seismicShot', 'rockSlide', 'earthquake'] },
};

// ============================================================
//  WEAPON SKILL DEFINITIONS (unlocked via weapon XP)
// ============================================================
export const WEAPON_SKILLS = {
    // Ember Wand skills
    flameSplash:    { name: 'Flame Splash',    icon: '🔥', type: 'weapon', desc: 'Shots explode on impact for AOE fire damage' },
    infernoShot:    { name: 'Inferno Shot',    icon: '☄️', type: 'weapon', desc: 'Every 5th shot deals triple damage' },
    phoenixRound:   { name: 'Phoenix Round',   icon: '🦅', type: 'weapon', desc: 'Shots pierce through enemies and ignite all hit' },
    // Blood Lance skills
    drainShot:      { name: 'Drain Shot',      icon: '🩸', type: 'weapon', desc: 'Each hit restores 1 HP' },
    hemorrhageRound:{ name: 'Hemorrhage Rnd',  icon: '💉', type: 'weapon', desc: 'Crits on enemies below 30% HP' },
    soulPierce:     { name: 'Soul Pierce',     icon: '👻', type: 'weapon', desc: 'Shots pass through enemies, applying decay' },
    // Rot Staff skills
    toxicShot:      { name: 'Toxic Shot',      icon: '☠️', type: 'weapon', desc: 'Shots leave a small poison cloud on hit' },
    plagueRound:    { name: 'Plague Round',    icon: '🦠', type: 'weapon', desc: 'Shots spread poison to nearby enemies' },
    deathSpore:     { name: 'Death Spore',     icon: '🌑', type: 'weapon', desc: 'Killing a poisoned enemy spawns a poison zone' },
    // Frost Bow
    chilledShot:    { name: 'Chilled Shot',    icon: '❄️', type: 'weapon', desc: 'Shots slow enemies by 30%' },
    glacialArrow:   { name: 'Glacial Arrow',   icon: '🏹', type: 'weapon', desc: 'Every 3rd shot freezes target' },
    absoluteZero:   { name: 'Absolute Zero',   icon: '🧊', type: 'weapon', desc: 'Frozen enemies shatter on death, dealing AoE' },
    // Storm Blade
    chainSlash:     { name: 'Chain Slash',     icon: '⚡', type: 'weapon', desc: 'Slashes chain to 2 nearby enemies' },
    shockwave:      { name: 'Shockwave',       icon: '💥', type: 'weapon', desc: 'Every 4th hit sends out a shockwave' },
    thunderclap:    { name: 'Thunderclap',     icon: '🌩️', type: 'weapon', desc: 'On kill: lightning strikes nearest enemy' },
    // Void Shard
    nullShot:       { name: 'Null Shot',       icon: '🌀', type: 'weapon', desc: 'Shots ignore elemental resistances' },
    realityTear:    { name: 'Reality Tear',    icon: '💠', type: 'weapon', desc: 'Creates a void zone that pulls enemies in' },
    annihilate:     { name: 'Annihilate',      icon: '🌌', type: 'weapon', desc: 'Nulled enemies explode for AoE void damage' },
    // Holy Orb
    divineSmite:    { name: 'Divine Smite',    icon: '💫', type: 'weapon', desc: 'Bonus damage vs dark/undead enemies' },
    sacredNova:     { name: 'Sacred Nova',     icon: '✨', type: 'weapon', desc: 'On kill: holy nova heals nearby allies 2 HP' },
    judgement:      { name: 'Judgement',       icon: '⚖️', type: 'weapon', desc: 'Seared enemies have 20% instant-kill chance' },
    // Earth Shaker
    seismicShot:    { name: 'Seismic Shot',    icon: '🪨', type: 'weapon', desc: 'Shots stagger enemies on hit' },
    rockSlide:      { name: 'Rock Slide',      icon: '🏔️', type: 'weapon', desc: 'Staggered enemies take 2x next hit' },
    earthquake:     { name: 'Earthquake',      icon: '💥', type: 'weapon', desc: 'Every 6th hit creates an earth shockwave' },
};

// ============================================================
//  PASSIVE ITEM DEFINITIONS
// ============================================================
export const ITEM_DEFS = {
    bloodstone:  { name: 'Bloodstone',   icon: '💎', desc: 'Lifesteal 3% per hit',         effect: 'lifesteal', value: 0.03 },
    plagueMask:  { name: 'Plague Mask',  icon: '😷', desc: 'Poison cloud on kill',          effect: 'poisonOnKill', radius: 60 },
    voidHeart:   { name: 'Void Heart',   icon: '🫀', desc: 'All damage ignores 20% resist', effect: 'resIgnore', value: 0.2 },
    stormRing:   { name: 'Storm Ring',   icon: '💍', desc: '+15% attack speed',             effect: 'atkSpeed', value: 0.15 },
    frostCloak:  { name: 'Frost Cloak',  icon: '🧥', desc: 'Dodge chance 10%',              effect: 'dodge', value: 0.10 },
    soulVessel:  { name: 'Soul Vessel',  icon: '⚗️', desc: '+20% XP from kills',           effect: 'xpBoost', value: 0.20 },
    holyWater:   { name: 'Holy Water',   icon: '💧', desc: 'Heals 1 HP every 5 seconds',    effect: 'regen', value: 1, interval: 300 },
    darkShard:   { name: 'Dark Shard',   icon: '🔮', desc: 'Cursed enemies take +10% dmg',  effect: 'cursedAmp', value: 0.10 },
    earthCore:   { name: 'Earth Core',   icon: '🌍', desc: '+25 max HP',                   effect: 'maxHp', value: 25 },
    windCharm:   { name: 'Wind Charm',   icon: '🪶', desc: '+20% movement speed',           effect: 'moveSpeed', value: 0.20 },
    necroTome:   { name: 'Necro Tome',   icon: '📖', desc: 'Kills extend all DoT durations',effect: 'dotExtend', value: 60 },
    lightOrb:    { name: 'Light Orb',    icon: '🔆', desc: 'Illuminated enemies drop +1g',  effect: 'illuminateGold', value: 1 },
};

// ============================================================
//  CLASS PROFILE (meta-progression — persists across runs)
// ============================================================
export class ClassProfile {
    constructor(classType) {
        this.classType = classType;
        this.classXp = 0;
        this.classLevel = 1;
        this.classXpToNext = 200;
        this.unlockedElements = [CLASS_DEFINITIONS[classType]?.startingElement || 'fire'];
        this.activeElements = [CLASS_DEFINITIONS[classType]?.startingElement || 'fire'];
        this.unlockedPerks = [];
        this.totalRuns = 0;
        this.bestWave = 0;
    }

    // Add XP after a run
    addRunXp(amount) {
        this.classXp += amount;
        const levelsGained = [];
        while (this.classXp >= this.classXpToNext) {
            this.classXp -= this.classXpToNext;
            this.classLevel++;
            this.classXpToNext = Math.floor(this.classXpToNext * 1.3);
            levelsGained.push(this.classLevel);
        }
        return levelsGained; // array of new levels gained
    }

    // Get element choices offered at a given class level
    getElementChoicesForLevel(level) {
        const def = CLASS_DEFINITIONS[this.classType];
        return def?.elementUnlocks[level] || null;
    }

    // Unlock an element (chosen from card)
    unlockElement(element) {
        if (!this.unlockedElements.includes(element)) {
            this.unlockedElements.push(element);
        }
    }

    // Set active elements for the run (max based on class level)
    setActiveElements(elements) {
        const maxSlots = this.classLevel >= 15 ? 3 : this.classLevel >= 4 ? 2 : 1;
        this.activeElements = elements.slice(0, maxSlots);
    }

    save() {
        const key = `spire_profile_${this.classType}`;
        localStorage.setItem(key, JSON.stringify({
            classXp: this.classXp,
            classLevel: this.classLevel,
            classXpToNext: this.classXpToNext,
            unlockedElements: this.unlockedElements,
            activeElements: this.activeElements,
            unlockedPerks: this.unlockedPerks,
            totalRuns: this.totalRuns,
            bestWave: this.bestWave,
        }));
    }

    load() {
        const key = `spire_profile_${this.classType}`;
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const d = JSON.parse(raw);
        this.classXp = d.classXp || 0;
        this.classLevel = d.classLevel || 1;
        this.classXpToNext = d.classXpToNext || 200;
        this.unlockedElements = d.unlockedElements || [CLASS_DEFINITIONS[this.classType]?.startingElement];
        this.activeElements = d.activeElements || [CLASS_DEFINITIONS[this.classType]?.startingElement];
        this.unlockedPerks = d.unlockedPerks || [];
        this.totalRuns = d.totalRuns || 0;
        this.bestWave = d.bestWave || 0;
        return true;
    }
}

// ============================================================
//  PLAYER CLASS
// ============================================================
export class Player {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.element = 'fire';
        this.avatar = '🧙';
        this.className = 'PYRO';
        this.heroName = 'HERO';

        // --- PROGRESSION ---
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 100;
        this.statPoints = 0;
        this.skillTokens = 0;
        this.gold = 0;
        this.lastServerPhase = 'WAVE';
        this.waveNumber = 0;

        // --- ELEMENT SYSTEM ---
        this.activeElements = ['fire'];  // elements equipped this run
        this.classProfile = null;        // ClassProfile instance, set on class select
        this.overload = null;            // current overload bonus if class == weapon element
        this.activeCombo = null;         // active combo element if 2 bases match

        // --- STATS ---
        this.stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0 };
        this.statMax = { str: 10, dex: 8, con: 5, int: 15, wis: 8 };
        this.baseHp = 10;
        this.hp = 10;
        this.speed = 3.5;
        this.shield = 0;

        // --- WEAPONS ---
        this.weapons = [
            { name: "Starter Wand", baseDamage: 2, baseFireRate: 1000, lastShot: 0,
              color: 'orange', damage: 2, fireRate: 1000, element: 'fire',
              xp: 0, rank: 0, unlockedSkills: [] }
        ];

        // --- SKILLS (3 slots) ---
        this.classSkill = null;   // slot 1 — active class ability
        this.weaponSkill = null;  // slot 2 — weapon active skill
        this.itemSkill = null;    // slot 3 — item passive/triggered

        this.skills = {};         // class skills from old system (kept for compatibility)

        // --- ITEMS ---
        this.items = [];          // passive item relics

        // --- QUAKE COUNTER (earth overload) ---
        this.hitCounter = 0;

        // --- CONTROL ---
        this.controlMode = 'WAVE';
        this.activePad = null;
        this.currentDir = { x: 1, y: 0 };

        // --- RUN STATS (for class XP calculation post-run) ---
        this.runStats = {
            kills: 0,
            bossKills: 0,
            crossCombos: 0,
            damageDealt: 0,
            survivalFrames: 0,
        };
    }

    // --------------------------------------------------------
    //  INIT CLASS (called on class select)
    // --------------------------------------------------------
    initClass(elementType) {
        const def = CLASS_DEFINITIONS[elementType];
        if (!def) return;

        this.element = elementType;
        this.avatar = def.avatar;
        this.className = def.name;
        this.baseHp = def.baseHp;
        this.hp = def.baseHp;
        this.heroName = window._heroName || 'HERO';
        this.stats = { ...def.baseStats };
        this.statMax = { ...def.statMax };

        // Deep copy skills
        this.skills = {};
        for (const [key, val] of Object.entries(def.skills)) {
            this.skills[key] = { ...val };
        }

        // Set starting weapon with element
        const w = def.baseWeapon;
        this.weapons = [{
            name: w.name, baseDamage: w.baseDamage, baseFireRate: w.baseFireRate,
            lastShot: 0, color: w.color, damage: w.baseDamage, fireRate: w.baseFireRate,
            element: w.element, xp: 0, rank: 0, unlockedSkills: []
        }];

        // Init class profile
        this.classProfile = new ClassProfile(elementType);
        this.classProfile.load();
        this.activeElements = [...this.classProfile.activeElements];
        this._updateElementBonuses();
    }

    // --------------------------------------------------------
    //  ELEMENT MANAGEMENT
    // --------------------------------------------------------
    _updateElementBonuses() {
        // Check for overload (class element matches weapon element)
        const weaponEl = this.weapons[0]?.element;
        this.overload = checkOverload(this.classProfile?.classType || this.element, weaponEl);

        // Check for active combo element
        this.activeCombo = getActiveCombo(this.activeElements);
    }

    addElement(element) {
        if (!this.activeElements.includes(element)) {
            this.activeElements.push(element);
        }
        this._updateElementBonuses();
    }

    // --------------------------------------------------------
    //  WEAPON XP
    // --------------------------------------------------------
    addWeaponXp(amount, weaponIndex = 0) {
        const w = this.weapons[weaponIndex];
        if (!w) return null;
        const def = Object.values(WEAPON_DEFS).find(d => d.name === w.name);
        if (!def) return null;

        w.xp = (w.xp || 0) + amount;
        const thresholds = def.xpThresholds;
        const newRank = thresholds.findIndex((t, i) => w.xp < (thresholds[i+1] || Infinity));
        if (newRank > (w.rank || 0)) {
            w.rank = newRank;
            const skillKey = def.skills[newRank - 1];
            if (skillKey && !w.unlockedSkills.includes(skillKey)) {
                w.unlockedSkills.push(skillKey);
                return { rankUp: true, newRank, unlockedSkill: skillKey };
            }
        }
        return null;
    }

    // --------------------------------------------------------
    //  EQUIP ITEM
    // --------------------------------------------------------
    equipItem(itemKey) {
        const def = ITEM_DEFS[itemKey];
        if (!def) return;
        if (this.items.length < 6) {
            this.items.push({ key: itemKey, ...def });
        }
        this._applyItemEffects();
    }

    _applyItemEffects() {
        // Reset passive bonuses then re-apply all items
        let bonusMaxHp = 0;
        let bonusSpeed = 0;

        this.items.forEach(item => {
            if (item.effect === 'maxHp')    bonusMaxHp  += item.value;
            if (item.effect === 'moveSpeed') bonusSpeed  += item.value;
        });

        this.baseHp += bonusMaxHp;
        this.speed  *= (1 + bonusSpeed);
    }

    // --------------------------------------------------------
    //  COMPUTE RUN CLASS XP (called at end of run)
    // --------------------------------------------------------
    computeRunClassXp() {
        const r = this.runStats;
        let xp = 0;
        xp += r.kills * 2;
        xp += r.bossKills * 100;
        xp += r.crossCombos * 15;
        xp += Math.floor(r.survivalFrames / 60) * 1; // 1 XP per second survived
        xp += Math.floor(r.damageDealt / 10);
        return xp;
    }

    // --------------------------------------------------------
    //  DYNAMIC STAT CALCULATIONS
    // --------------------------------------------------------
    get maxHp()           { return this.baseHp + (this.stats.con * 5); }
    get currentDamage()   { return this.weapons[0].baseDamage + (this.stats.str * 1); }
    get currentFireRate() { return Math.max(200, this.weapons[0].baseFireRate - (this.stats.dex * 50)); }
    get burnDamage()      { return 1 + (this.stats.int * 0.5); }
    get cooldownReduction() { return this.stats.wis * 10; }

    // --------------------------------------------------------
    //  SKILL HELPERS (legacy class skills)
    // --------------------------------------------------------
    getSkillKeys() { return Object.keys(this.skills); }

    canUpgradeSkill(key) {
        const skill = this.skills[key];
        if (!skill) return false;
        return this.skillTokens >= 1 && skill.tier < skill.maxTier;
    }

    upgradeSkill(key) {
        if (!this.canUpgradeSkill(key)) return false;
        this.skillTokens--;
        this.skills[key].tier++;
        const tierBonus = SKILL_TIERS[this.element]?.[key]?.[this.skills[key].tier];
        if (tierBonus?.cdMult) {
            const def = CLASS_DEFINITIONS[this.element].skills[key];
            this.skills[key].maxCD = Math.round(def.maxCD * tierBonus.cdMult);
        }
        return true;
    }

    isSkillUnlocked(key) { return this.skills[key]?.tier > 0; }

    canUpgradeStat(type) {
        return this.statPoints > 0 && this.stats[type] < this.statMax[type];
    }

    upgradeStat(type) {
        if (!this.canUpgradeStat(type)) return false;
        this.statPoints--;
        this.stats[type]++;
        if (type === 'con') this.hp = Math.min(this.hp + 5, this.maxHp);
        this.saveProfile();
        return true;
    }

    // --------------------------------------------------------
    //  SAVE / LOAD (run profile — not class profile)
    // --------------------------------------------------------
    saveProfile() {
        const data = {
            element: this.element, avatar: this.avatar, className: this.className,
            level: this.level, xp: this.xp, xpToNext: this.xpToNext,
            statPoints: this.statPoints, skillTokens: this.skillTokens, gold: this.gold,
            stats: this.stats, statMax: this.statMax, baseHp: this.baseHp,
            skills: this.skills, weapons: this.weapons, heroName: this.heroName,
            activeElements: this.activeElements, items: this.items,
        };
        localStorage.setItem('spire_save', JSON.stringify(data));
        this.classProfile?.save();
    }

    loadProfile() {
        const json = localStorage.getItem('spire_save');
        if (!json) return false;
        const d = JSON.parse(json);

        this.element    = d.element    || 'fire';
        this.avatar     = d.avatar     || '🧙';
        this.className  = d.className  || 'PYRO';
        this.level      = d.level      || 1;
        this.xp         = d.xp         || 0;
        this.xpToNext   = d.xpToNext   || 100;
        this.statPoints = d.statPoints  || 0;
        this.skillTokens= d.skillTokens || 0;
        this.gold       = d.gold        || 0;
        this.stats      = d.stats       || { str:0, dex:0, con:0, int:0, wis:0 };
        this.statMax    = d.statMax     || { str:10, dex:8, con:5, int:15, wis:8 };
        this.baseHp     = d.baseHp      || 10;
        this.weapons    = d.weapons     || this.weapons;
        this.heroName   = d.heroName    || 'HERO';
        this.activeElements = d.activeElements || [this.element];
        this.items      = d.items       || [];

        if (d.skills) {
            const def = CLASS_DEFINITIONS[this.element];
            if (def) {
                this.skills = {};
                for (const [key, val] of Object.entries(def.skills)) {
                    this.skills[key] = {
                        ...val, tier: d.skills[key]?.tier || 0, cooldown: 0
                    };
                    const tier = this.skills[key].tier;
                    if (tier > 0) {
                        const tierBonus = SKILL_TIERS[this.element]?.[key]?.[tier];
                        if (tierBonus?.cdMult) {
                            this.skills[key].maxCD = Math.round(val.maxCD * tierBonus.cdMult);
                        }
                    }
                }
            }
        }

        this.classProfile = new ClassProfile(this.element);
        this.classProfile.load();
        this._updateElementBonuses();
        this.hp = this.maxHp;
        return true;
    }
}

// ============================================================
//  ENEMY CLASS
// ============================================================
export class Enemy {
    constructor(type, arenaSize) {
        this.id = null;
        this.type = type;
        this.slowed = 0;
        this.statuses = {};  // elemental statuses applied to this enemy

        const configs = {
            goblin:   { emoji: '👺', hp: 3,  speed: 1.8, radius: 15 },
            skeleton: { emoji: '💀', hp: 2,  speed: 1.0, radius: 15 },
            troll:    { emoji: '👾', hp: 6,  speed: 1.2, radius: 20 },
            wraith:   { emoji: '👻', hp: 4,  speed: 2.2, radius: 15 },
            miniboss: { emoji: '🐲', hp: 30, speed: 1.0, radius: 25 },
            boss:     { emoji: '👹', hp: 80, speed: 0.7, radius: 35 },
        };

        const cfg = configs[type] || configs.goblin;
        this.emoji  = cfg.emoji;
        this.hp     = cfg.hp;
        this.maxHp  = cfg.hp;
        this.speed  = cfg.speed;
        this.radius = cfg.radius;

        // Assign elemental affinity
        const elDef = ENEMY_ELEMENTS[type];
        this.element  = elDef?.element  || 'earth';
        this.weakTo   = elDef?.weakTo   || [];
        this.resistTo = elDef?.resistTo || [];

        // Spawn on random edge
        const side = Math.floor(Math.random() * 4);
        const m = 30;
        if      (side === 0) { this.x = -arenaSize + m; this.y = (Math.random()*2-1)*arenaSize; }
        else if (side === 1) { this.x =  arenaSize - m; this.y = (Math.random()*2-1)*arenaSize; }
        else if (side === 2) { this.y = -arenaSize + m; this.x = (Math.random()*2-1)*arenaSize; }
        else                 { this.y =  arenaSize - m; this.x = (Math.random()*2-1)*arenaSize; }

        this.lastShot = 0;
    }
}
