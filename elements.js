// elements.js
// ============================================================
//  SPIRE ONLINE — ELEMENT SYSTEM
//  Owns: element definitions, status effects, damage chart,
//        combo table, cross-player combo detection,
//        same-element overload logic, bestiary tracking
// ============================================================

// ============================================================
//  BASE ELEMENTS
// ============================================================
export const ELEMENTS = {
    fire:     { name: 'Fire',     emoji: '🔥', color: '#ff4400', glowColor: '#ff6600', statusColor: '#ff4400', borderColor: '#ff6600' },
    water:    { name: 'Water',    emoji: '💧', color: '#0099ff', glowColor: '#00ccff', statusColor: '#0099ff', borderColor: '#00ccff' },
    ice:      { name: 'Ice',      emoji: '❄️', color: '#aaddff', glowColor: '#cceeff', statusColor: '#88ccff', borderColor: '#aaddff' },
    lightning:{ name: 'Lightning',emoji: '⚡', color: '#ffee00', glowColor: '#ffff88', statusColor: '#ffdd00', borderColor: '#ffff44' },
    poison:   { name: 'Poison',   emoji: '☠️', color: '#44ff44', glowColor: '#88ff88', statusColor: '#33cc33', borderColor: '#66ff66' },
    earth:    { name: 'Earth',    emoji: '🪨', color: '#aa7744', glowColor: '#cc9955', statusColor: '#996633', borderColor: '#bb8844' },
    dark:     { name: 'Dark',     emoji: '🌑', color: '#6600cc', glowColor: '#9933ff', statusColor: '#5500aa', borderColor: '#7722dd' },
    light:    { name: 'Light',    emoji: '✨', color: '#ffff88', glowColor: '#ffffcc', statusColor: '#eeee66', borderColor: '#ffff99' },
    holy:     { name: 'Holy',     emoji: '💫', color: '#ffffaa', glowColor: '#ffffff', statusColor: '#ffeeaa', borderColor: '#fff0cc' },
    necrotic: { name: 'Necrotic', emoji: '💀', color: '#556655', glowColor: '#778877', statusColor: '#445544', borderColor: '#667766' },
    void:     { name: 'Void',     emoji: '🌀', color: '#330066', glowColor: '#660099', statusColor: '#220055', borderColor: '#440077' },
    wind:     { name: 'Wind',     emoji: '🌪️', color: '#ccffee', glowColor: '#eeffee', statusColor: '#aaddcc', borderColor: '#ccffdd' },
};

// ============================================================
//  COMBO ELEMENTS
//  Activated when player has BOTH base elements equipped
// ============================================================
export const COMBOS = {
    plasma:   { name: 'Plasma',   emoji: '⚡🔥', color: '#ff8800', requires: ['fire', 'lightning'],
                desc: 'Burns AND chains — shocked enemies explode' },
    blizzard: { name: 'Blizzard', emoji: '🌨️',  color: '#aaeeff', requires: ['water', 'ice'],
                desc: 'Soaked enemies instantly freeze' },
    leech:    { name: 'Leech',    emoji: '🩸',   color: '#cc0044', requires: ['poison', 'necrotic'],
                desc: 'DoT heals the attacker' },
    chaos:    { name: 'Chaos',    emoji: '🌀',   color: '#9900ff', requires: ['dark', 'void'],
                desc: 'Nulled enemies take double dark damage' },
    radiance: { name: 'Radiance', emoji: '☀️',   color: '#ffffcc', requires: ['holy', 'light'],
                desc: 'Illuminated enemies take divine nova damage' },
    storm:    { name: 'Storm',    emoji: '⛈️',   color: '#88aacc', requires: ['earth', 'wind'],
                desc: 'Staggered enemies get swept — huge knockback' },
    acid:     { name: 'Acid',     emoji: '🧪',   color: '#99ff00', requires: ['fire', 'poison'],
                desc: 'Burn accelerates poison stacks' },
    tempest:  { name: 'Tempest',  emoji: '🌩️',   color: '#88ccff', requires: ['lightning', 'wind'],
                desc: 'Shocked enemies get pulled into chain range' },
    umbra:    { name: 'Umbra',    emoji: '🖤',   color: '#221133', requires: ['necrotic', 'dark'],
                desc: 'Decay + Curse stack — enemies crumble fast' },
    nullice:  { name: 'Null Ice', emoji: '💠',   color: '#aaccff', requires: ['ice', 'void'],
                desc: 'Frozen enemies can\'t resist anything' },
};

// ============================================================
//  STATUS EFFECTS
//  Applied to enemies when hit with an element
// ============================================================
export const STATUS_DEFS = {
    // element key → status definition
    fire: {
        key: 'burn',
        name: 'Burning',
        color: '#ff4400',
        duration: 180,         // frames
        tickInterval: 30,
        tickDamage: (stacks) => stacks * 0.5,
        maxStacks: 5,
        onApply: () => {},
        onTick: (enemy, stacks, sendHit) => {
            sendHit(enemy.id, stacks * 0.5, 'fire');
        },
    },
    water: {
        key: 'soaked',
        name: 'Soaked',
        color: '#0099ff',
        duration: 240,
        tickInterval: null,    // no tick damage — amplifies next hit
        ampMultiplier: 1.5,    // next hit does 1.5x
        maxStacks: 1,
        onApply: () => {},
    },
    ice: {
        key: 'frozen',
        name: 'Frozen',
        color: '#aaddff',
        duration: 150,
        tickInterval: null,
        slowAmount: 0.15,      // move at 15% speed
        maxStacks: 1,
        onApply: (enemy) => { enemy.frozenSpeed = enemy.speed; enemy.speed *= 0.15; },
        onExpire: (enemy) => { if (enemy.frozenSpeed) { enemy.speed = enemy.frozenSpeed; delete enemy.frozenSpeed; } },
    },
    lightning: {
        key: 'shocked',
        name: 'Shocked',
        color: '#ffee00',
        duration: 120,
        tickInterval: null,
        chainRadius: 120,      // chains damage to nearby enemies
        maxStacks: 1,
        onApply: () => {},
    },
    poison: {
        key: 'poisoned',
        name: 'Poisoned',
        color: '#44ff44',
        duration: 300,
        tickInterval: 40,
        tickDamage: (stacks) => stacks * 0.3,
        maxStacks: 8,
        onTick: (enemy, stacks, sendHit) => {
            sendHit(enemy.id, stacks * 0.3, 'poison');
        },
    },
    earth: {
        key: 'staggered',
        name: 'Staggered',
        color: '#aa7744',
        duration: 90,
        tickInterval: null,
        knockbackForce: 80,
        maxStacks: 1,
        onApply: (enemy, player) => {
            // knockback applied in systems.js
        },
    },
    dark: {
        key: 'cursed',
        name: 'Cursed',
        color: '#6600cc',
        duration: 240,
        tickInterval: null,
        dmgAmpPerStack: 0.15,  // +15% damage taken per stack
        maxStacks: 5,
        onApply: () => {},
    },
    light: {
        key: 'illuminated',
        name: 'Illuminated',
        color: '#ffff88',
        duration: 200,
        tickInterval: null,
        noDodge: true,
        maxStacks: 1,
        onApply: () => {},
    },
    holy: {
        key: 'seared',
        name: 'Seared',
        color: '#ffffaa',
        duration: 180,
        tickInterval: 45,
        tickDamage: (stacks) => stacks * 0.8,  // high vs undead
        maxStacks: 3,
        onTick: (enemy, stacks, sendHit) => {
            const mult = (enemy.element === 'necrotic' || enemy.element === 'dark') ? 2 : 1;
            sendHit(enemy.id, stacks * 0.8 * mult, 'holy');
        },
    },
    necrotic: {
        key: 'decay',
        name: 'Decaying',
        color: '#556655',
        duration: 360,
        tickInterval: 60,
        maxHpReduction: 0.05,  // -5% max HP per tick per stack
        maxStacks: 4,
        onTick: (enemy, stacks) => {
            enemy.maxHp = Math.max(1, enemy.maxHp - stacks * 0.05 * enemy.maxHp);
            enemy.hp = Math.min(enemy.hp, enemy.maxHp);
        },
    },
    void: {
        key: 'nulled',
        name: 'Nulled',
        color: '#330066',
        duration: 180,
        tickInterval: null,
        ignoreResistances: true,
        maxStacks: 1,
        onApply: () => {},
    },
    wind: {
        key: 'swept',
        name: 'Swept',
        color: '#ccffee',
        duration: 120,
        tickInterval: null,
        accuracyReduction: 0.3,
        maxStacks: 1,
        onApply: () => {},
    },
};

// ============================================================
//  SAME-ELEMENT OVERLOAD
//  Triggered when player's class element === weapon element
// ============================================================
export const OVERLOADS = {
    fire:      { name: 'Inferno Overload', emoji: '🔥💥',
                 desc: 'Explosion radius +50%, AOE on every hit',
                 apply: (hit) => ({ ...hit, aoeRadius: (hit.aoeRadius || 30) * 1.5, alwaysAoe: true }) },
    water:     { name: 'Tidal Overload',   emoji: '💧🌊',
                 desc: 'Soaked on every hit guaranteed, +30% next hit',
                 apply: (hit) => ({ ...hit, guaranteedSoak: true, nextHitAmp: 1.3 }) },
    ice:       { name: 'Permafrost',       emoji: '❄️❄️',
                 desc: 'Freeze chance every hit, Shatter = 3x damage',
                 apply: (hit) => ({ ...hit, freezeChance: 0.4, shatterMult: 3 }) },
    lightning: { name: 'Surge Overload',   emoji: '⚡⚡',
                 desc: 'Chains to 3 extra enemies, shocked spreads',
                 apply: (hit) => ({ ...hit, chainTargets: 3, shockSpreads: true }) },
    poison:    { name: 'Plague Overload',  emoji: '☠️☠️',
                 desc: 'Stacks double, duration doubled',
                 apply: (hit) => ({ ...hit, stackMult: 2, durationMult: 2 }) },
    earth:     { name: 'Quake Overload',   emoji: '🪨💥',
                 desc: 'Every 5th hit is a free Earthquake',
                 apply: (hit) => ({ ...hit, quakeCounter: true }) },
    dark:      { name: 'Shadow Overload',  emoji: '🌑🌑',
                 desc: 'Curse stacks faster, last stack = 2x damage window',
                 apply: (hit) => ({ ...hit, curseFast: true, lastStackDouble: true }) },
    light:     { name: 'Radiant Overload', emoji: '✨✨',
                 desc: 'Heals 1 HP per illuminated enemy killed',
                 apply: (hit) => ({ ...hit, illuminateHeal: 1 }) },
    holy:      { name: 'Divine Overload',  emoji: '💫💫',
                 desc: 'Divine nova on kill chains to nearby enemies',
                 apply: (hit) => ({ ...hit, novaOnKill: true }) },
    necrotic:  { name: 'Death Overload',   emoji: '💀💀',
                 desc: 'Decay reduces max HP faster, execute at 20% HP',
                 apply: (hit) => ({ ...hit, fastDecay: true, executeThreshold: 0.20 }) },
    void:      { name: 'Annihilation',     emoji: '🌀💥',
                 desc: 'All hits ignore resistances, nulled enemies explode',
                 apply: (hit) => ({ ...hit, ignoreRes: true, nulledExplode: true }) },
    wind:      { name: 'Cyclone Overload', emoji: '🌪️🌪️',
                 desc: 'Cyclone every 4th hit, enemies pulled into range',
                 apply: (hit) => ({ ...hit, cycloneCounter: true, pullOnCyclone: true }) },
};

// ============================================================
//  DAMAGE MULTIPLIER CHART
//  [attacker element][defender element] = multiplier
//  1.5 = super effective, 0.5 = not very effective, 1.0 = neutral
// ============================================================
export const DAMAGE_CHART = {
    //         fire  water  ice   light necrotic  dark  holy  void  wind  earth poison  lightning
    fire:      { fire:1.0, water:0.5, ice:2.0,   light:1.0, necrotic:1.5, dark:1.0, holy:0.5, void:1.0, wind:0.5, earth:1.0, poison:1.5, lightning:1.0 },
    water:     { fire:2.0, water:1.0, ice:0.5,   light:1.0, necrotic:1.0, dark:1.0, holy:0.5, void:1.0, wind:1.5, earth:1.5, poison:0.5, lightning:0.5 },
    ice:       { fire:0.5, water:1.5, ice:1.0,   light:1.0, necrotic:1.5, dark:0.5, holy:1.0, void:1.0, wind:0.5, earth:0.5, poison:1.0, lightning:1.0 },
    lightning: { fire:1.0, water:2.0, ice:1.5,   light:1.5, necrotic:0.5, dark:1.0, holy:1.0, void:0.5, wind:1.5, earth:0.5, poison:1.0, lightning:1.0 },
    poison:    { fire:0.5, water:1.5, ice:1.0,   light:0.5, necrotic:0.5, dark:1.5, holy:0.5, void:1.0, wind:1.0, earth:2.0, poison:1.0, lightning:1.0 },
    earth:     { fire:1.0, water:0.5, ice:0.5,   light:1.0, necrotic:1.0, dark:1.0, holy:1.0, void:0.5, wind:2.0, earth:1.0, poison:0.5, lightning:2.0 },
    dark:      { fire:1.0, water:1.0, ice:1.0,   light:0.5, necrotic:0.5, dark:1.0, holy:0.2, void:1.5, wind:1.0, earth:1.0, poison:1.5, lightning:1.0 },
    light:     { fire:1.0, water:1.0, ice:1.0,   light:1.0, necrotic:2.0, dark:2.0, holy:0.5, void:1.5, wind:1.0, earth:1.0, poison:1.0, lightning:1.0 },
    holy:      { fire:0.5, water:1.0, ice:1.0,   light:1.0, necrotic:2.0, dark:2.0, holy:1.0, void:1.5, wind:1.0, earth:1.0, poison:0.5, lightning:1.0 },
    necrotic:  { fire:0.5, water:1.0, ice:1.5,   light:0.5, necrotic:1.0, dark:1.5, holy:0.2, void:2.0, wind:1.0, earth:1.0, poison:2.0, lightning:0.5 },
    void:      { fire:1.0, water:1.0, ice:1.0,   light:1.5, necrotic:1.5, dark:1.5, holy:1.5, void:1.0, wind:1.0, earth:1.0, poison:1.0, lightning:1.0 },
    wind:      { fire:0.5, water:0.5, ice:1.0,   light:1.0, necrotic:1.0, dark:1.0, holy:1.0, void:0.5, wind:1.0, earth:2.0, poison:1.5, lightning:0.5 },
};

// ============================================================
//  CROSS-PLAYER COMBO TABLE
//  When player A applies a status, player B hits with matching element
// ============================================================
export const CROSS_COMBOS = {
    // statusOnEnemy: { triggerElement: { name, effect } }
    frozen: {
        fire:      { name: 'Shatter',      color: '#ff8800', dmgMult: 3.0,  aoe: true,  aoeRadius: 100 },
        lightning: { name: 'Cryostrike',   color: '#aaeeff', dmgMult: 2.0,  stun: 120 },
        earth:     { name: 'Avalanche',    color: '#aabb99', dmgMult: 2.5,  aoe: true,  aoeRadius: 80  },
    },
    soaked: {
        lightning: { name: 'Conductance',  color: '#ffff00', dmgMult: 2.0,  chainAll: true },
        ice:       { name: 'Flash Freeze', color: '#ccffff', dmgMult: 1.5,  instantFreeze: true },
        poison:    { name: 'Dilution',     color: '#88ff88', dmgMult: 1.5,  stackAmp: 2 },
    },
    burn: {
        water:     { name: 'Steam Burst',  color: '#ccccff', dmgMult: 1.5,  blind: true, blindDur: 150 },
        ice:       { name: 'Quench',       color: '#aaddff', dmgMult: 1.2,  healPlayer: 3 },
        poison:    { name: 'Venom Flare',  color: '#aaff00', dmgMult: 2.0,  dotExplode: true },
    },
    shocked: {
        earth:     { name: 'Grounded',     color: '#886644', dmgMult: 2.0,  stun: 180 },
        water:     { name: 'Electrolysis', color: '#88ccff', dmgMult: 1.5,  chainAll: true },
        wind:      { name: 'Tempest Pull', color: '#aaccee', dmgMult: 1.5,  pull: true,  pullRadius: 150 },
    },
    poisoned: {
        fire:      { name: 'Venom Flare',  color: '#aaff00', dmgMult: 2.5,  aoe: true,  aoeRadius: 90  },
        holy:      { name: 'Purge',        color: '#ffffcc', dmgMult: 2.0,  executeAt: 0.35 },
        wind:      { name: 'Spore Cloud',  color: '#88ff88', dmgMult: 1.5,  spreadPoison: true },
    },
    cursed: {
        holy:      { name: 'Exorcism',     color: '#ffffff', dmgMult: 4.0,  cleanse: true },
        light:     { name: 'Revelation',   color: '#ffff88', dmgMult: 2.5,  illuminateAll: true },
        void:      { name: 'Doom',         color: '#660099', dmgMult: 3.0,  executeAt: 0.50 },
    },
    decay: {
        light:     { name: 'Purge',        color: '#ffffaa', dmgMult: 3.0,  executeAt: 0.40 },
        holy:      { name: 'Consecrate',   color: '#ffffcc', dmgMult: 2.5,  healAll: 5 },
        fire:      { name: 'Cremation',    color: '#ff6600', dmgMult: 2.0,  instaKillAt: 0.15 },
    },
    nulled: {
        // Nulled amplifies ANY element
        _any:      { name: 'Amplified',    color: '#cc88ff', dmgMult: 2.0 },
    },
    staggered: {
        wind:      { name: 'Rockslide',    color: '#ccbb99', dmgMult: 2.0,  knockbackForce: 200 },
        lightning: { name: 'Shockwave',    color: '#ffff88', dmgMult: 2.0,  stunAll: true },
    },
    illuminated: {
        dark:      { name: 'Eclipse',      color: '#8800cc', dmgMult: 2.0,  blind: true,  blindDur: 200 },
        holy:      { name: 'Judgement',    color: '#ffffff', dmgMult: 3.0,  aoe: true,    aoeRadius: 120 },
    },
    seared: {
        water:     { name: 'Holy Water',   color: '#aaffff', dmgMult: 2.5,  healPlayer: 5 },
        void:      { name: 'Void Smite',   color: '#9900ff', dmgMult: 3.0,  ignoreRes: true },
    },
    swept: {
        earth:     { name: 'Dust Storm',   color: '#ccaa77', dmgMult: 1.8,  blind: true,  blindDur: 120 },
        ice:       { name: 'Hailstorm',    color: '#ccddff', dmgMult: 2.0,  aoe: true,    aoeRadius: 100 },
    },
};

// ============================================================
//  CALCULATE DAMAGE
//  Returns final damage after elemental matchup + status modifiers
// ============================================================
export function calcDamage(baseDamage, attackElement, enemy, hitParams = {}) {
    let dmg = baseDamage;

    // Elemental matchup multiplier
    if (attackElement && enemy.element && DAMAGE_CHART[attackElement]) {
        const chart = DAMAGE_CHART[attackElement];
        const mult = chart[enemy.element] ?? 1.0;
        dmg *= mult;
    }

    // Void nulled — ignore all resistances (force 1.0 minimum from chart)
    if (hitParams.ignoreRes || (enemy.statuses?.nulled?.stacks > 0)) {
        if (attackElement && enemy.element && DAMAGE_CHART[attackElement]) {
            const raw = DAMAGE_CHART[attackElement][enemy.element] ?? 1.0;
            if (raw < 1.0) dmg = baseDamage; // restore to base if resisted
        }
    }

    // Soaked amplifier (next hit)
    if (enemy.statuses?.soaked?.stacks > 0) {
        const def = STATUS_DEFS.water;
        dmg *= def.ampMultiplier;
        // Soaked consumed on hit
        enemy.statuses.soaked.stacks = 0;
    }

    // Cursed damage amplification
    if (enemy.statuses?.cursed?.stacks > 0) {
        dmg *= 1 + (enemy.statuses.cursed.stacks * STATUS_DEFS.dark.dmgAmpPerStack);
    }

    return Math.round(dmg * 10) / 10;
}

// ============================================================
//  APPLY STATUS TO ENEMY
//  Called when a hit connects — adds/stacks the status
// ============================================================
export function applyStatus(enemy, element, overloadParams = {}) {
    const def = STATUS_DEFS[element];
    if (!def) return null;

    if (!enemy.statuses) enemy.statuses = {};

    const key = def.key;
    if (!enemy.statuses[key]) {
        enemy.statuses[key] = {
            stacks: 0,
            duration: 0,
            tickTimer: 0,
            element,
        };
    }

    const status = enemy.statuses[key];
    const stackMult = overloadParams.stackMult || 1;
    const durationMult = overloadParams.durationMult || 1;

    // Add stack up to max
    const prev = status.stacks;
    status.stacks = Math.min((status.stacks + stackMult), def.maxStacks);

    // Refresh or extend duration
    const dur = def.duration * durationMult;
    status.duration = Math.max(status.duration, dur);

    // First apply
    if (prev === 0 && def.onApply) def.onApply(enemy);

    return { key, stacks: status.stacks, isNew: prev === 0 };
}

// ============================================================
//  TICK ALL STATUSES ON ENEMY
//  Call every game frame — handles DoT, expiry, etc.
// ============================================================
export function tickStatuses(enemy, sendHit) {
    if (!enemy.statuses) return;

    for (const key of Object.keys(enemy.statuses)) {
        const status = enemy.statuses[key];
        if (!status || status.stacks <= 0) continue;

        // Find the status def
        const el = status.element;
        const def = STATUS_DEFS[el];
        if (!def) continue;

        // Count down duration
        status.duration--;
        if (status.duration <= 0) {
            if (def.onExpire) def.onExpire(enemy);
            delete enemy.statuses[key];
            continue;
        }

        // Tick damage
        if (def.tickInterval) {
            status.tickTimer++;
            if (status.tickTimer >= def.tickInterval) {
                status.tickTimer = 0;
                if (def.onTick) def.onTick(enemy, status.stacks, sendHit);
            }
        }
    }
}

// ============================================================
//  CHECK CROSS-PLAYER COMBO
//  Call when a hit lands — checks if enemy has statuses from other players
// ============================================================
export function checkCrossCombo(enemy, attackElement, attackPlayerId) {
    if (!enemy.statuses) return null;

    for (const [statusKey, statusData] of Object.entries(enemy.statuses)) {
        if (!statusData || statusData.stacks <= 0) continue;

        // Don't combo with your own status
        if (statusData.appliedBy === attackPlayerId) continue;

        const comboTable = CROSS_COMBOS[statusKey];
        if (!comboTable) continue;

        // Check for specific element match
        const combo = comboTable[attackElement] || comboTable['_any'];
        if (combo) {
            return {
                ...combo,
                statusKey,
                attackElement,
                triggeredBy: attackPlayerId,
                statusAppliedBy: statusData.appliedBy,
            };
        }
    }
    return null;
}

// ============================================================
//  GET ACTIVE COMBO ELEMENT
//  Returns the combo element key if player has both required base elements
// ============================================================
export function getActiveCombo(playerElements) {
    for (const [comboKey, combo] of Object.entries(COMBOS)) {
        const [a, b] = combo.requires;
        if (playerElements.includes(a) && playerElements.includes(b)) {
            return { key: comboKey, ...combo };
        }
    }
    return null;
}

// ============================================================
//  CHECK OVERLOAD
//  True when player's class element matches weapon element
// ============================================================
export function checkOverload(classElement, weaponElement) {
    if (!classElement || !weaponElement) return null;
    if (classElement === weaponElement) return OVERLOADS[classElement] || null;
    return null;
}

// ============================================================
//  ELEMENT COLORS FOR RENDERING
//  Returns color for a given element (or status effect)
// ============================================================
export function getElementColor(elementKey) {
    return ELEMENTS[elementKey]?.color || '#ffffff';
}

export function getStatusBorderColor(statusKey) {
    // Map status key back to element
    const el = Object.entries(STATUS_DEFS).find(([, d]) => d.key === statusKey);
    return el ? ELEMENTS[el[0]]?.borderColor || '#ffffff' : '#ffffff';
}

// ============================================================
//  BESTIARY SYSTEM
//  Tracks which enemy/element combos the player has encountered
// ============================================================
export class Bestiary {
    constructor() {
        this.entries = {}; // { enemyType: { elements: Set, revealed: { element: { str, weak } } } }
        this._load();
    }

    // Record using element against enemy — reveals matchup
    recordHit(enemyType, attackElement, enemyElement, multiplier) {
        if (!this.entries[enemyType]) {
            this.entries[enemyType] = { knownElement: null, revealed: {} };
        }
        const entry = this.entries[enemyType];

        // Reveal the enemy's element if multiplier is notable
        if (multiplier >= 1.5 || multiplier <= 0.5) {
            if (!entry.revealed[attackElement]) {
                entry.revealed[attackElement] = {
                    multiplier,
                    effective: multiplier >= 1.5,
                };
            }
        }

        // Reveal enemy element once you've hit them a few times
        if (!entry.knownElement && Object.keys(entry.revealed).length >= 2) {
            entry.knownElement = enemyElement;
        }

        this._save();
    }

    // Returns what's known about an enemy (for bestiary UI)
    getEntry(enemyType) {
        return this.entries[enemyType] || null;
    }

    // Has the player discovered anything about this enemy?
    hasAnyData(enemyType) {
        return !!this.entries[enemyType];
    }

    _save() {
        try {
            localStorage.setItem('spire_bestiary', JSON.stringify(
                Object.fromEntries(
                    Object.entries(this.entries).map(([k,v]) => [k, {
                        ...v,
                        revealed: v.revealed
                    }])
                )
            ));
        } catch(e) {}
    }

    _load() {
        try {
            const raw = localStorage.getItem('spire_bestiary');
            if (raw) this.entries = JSON.parse(raw);
        } catch(e) {}
    }

    reset() {
        this.entries = {};
        localStorage.removeItem('spire_bestiary');
    }
}

// Singleton bestiary
export const bestiary = new Bestiary();

// ============================================================
//  ENEMY ELEMENT ASSIGNMENTS
//  Base affinities per enemy type
// ============================================================
export const ENEMY_ELEMENTS = {
    goblin:   { element: 'poison',   weakTo: ['fire', 'holy'],     resistTo: ['water', 'dark'] },
    skeleton: { element: 'necrotic', weakTo: ['holy', 'light'],    resistTo: ['poison', 'dark'] },
    troll:    { element: 'earth',    weakTo: ['lightning', 'water'],resistTo: ['fire', 'earth'] },
    wraith:   { element: 'dark',     weakTo: ['holy', 'light'],    resistTo: ['necrotic', 'void'] },
    miniboss: { element: 'void',     weakTo: [],                   resistTo: [] }, // revealed via bestiary
    boss:     { element: 'chaos',    weakTo: [],                   resistTo: [] }, // revealed via bestiary
};
