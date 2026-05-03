// systems.js
import { SKILL_TIERS, WEAPON_SKILLS, ITEM_DEFS, CLASS_DEFINITIONS } from './entities.js';
import {
    calcDamage, applyStatus, tickStatuses, checkCrossCombo,
    getActiveCombo, checkOverload, getElementColor,
    STATUS_DEFS, OVERLOADS, ELEMENTS, bestiary
} from './elements.js';

// ============================================================
//  SHARED STATE
// ============================================================
export let poisonZones = [];
export let zombies = [];

// ============================================================
//  SWIPE INPUT HANDLER
//  Replaces drag-joystick. Swipe anywhere on canvas = move direction.
//  Skills are separate buttons — no conflict.
// ============================================================
export class SwipeInput {
    constructor(canvas) {
        this.canvas = canvas;
        this.moveDir = { x: 0, y: 0 };
        this.keys = {};
        this._swipeStart = null;
        this._active = false;
        this._deadZone = 18;       // px before direction locks in
        this._skillZoneHeight = 130; // bottom px reserved for skill buttons

        // Touch
        canvas.addEventListener('touchstart', e => this._onStart(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
        canvas.addEventListener('touchmove',  e => { e.preventDefault(); this._onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
        canvas.addEventListener('touchend',   () => this._onEnd(), { passive: true });

        // Mouse (desktop fallback)
        canvas.addEventListener('mousedown', e => this._onStart(e.clientX, e.clientY));
        canvas.addEventListener('mousemove', e => { if (this._active) this._onMove(e.clientX, e.clientY); });
        canvas.addEventListener('mouseup',   () => this._onEnd());

        // Keyboard
        window.addEventListener('keydown', e => { this.keys[e.code] = true; });
        window.addEventListener('keyup',   e => { this.keys[e.code] = false; });
    }

    _onStart(x, y) {
        // Ignore touches in the skill button zone (bottom strip)
        const rect = this.canvas.getBoundingClientRect();
        if (y > rect.bottom - this._skillZoneHeight) return;
        this._swipeStart = { x, y };
        this._active = true;
    }

    _onMove(x, y) {
        if (!this._active || !this._swipeStart) return;
        const dx = x - this._swipeStart.x;
        const dy = y - this._swipeStart.y;
        const dist = Math.hypot(dx, dy);
        if (dist > this._deadZone) {
            this.moveDir.x = dx / dist;
            this.moveDir.y = dy / dist;
        }
    }

    _onEnd() {
        this._active = false;
        this._swipeStart = null;
        this.moveDir = { x: 0, y: 0 };
    }

    getMovement() {
        let x = this.moveDir.x;
        let y = this.moveDir.y;

        // Keyboard override
        if (this.keys['KeyW'] || this.keys['ArrowUp'])    y = -1;
        if (this.keys['KeyS'] || this.keys['ArrowDown'])  y =  1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft'])  x = -1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) x =  1;

        if (x !== 0 && y !== 0) {
            const mag = Math.hypot(x, y);
            x /= mag; y /= mag;
        }
        return { x, y };
    }
}

// ============================================================
//  COMBAT SYSTEM
//  Auto-attacks nearest enemy with full element awareness
// ============================================================
export class CombatSystem {
    constructor() {
        this.projectiles = [];
        this._quakeCounter = 0;
        this._cycloneCounter = 0;
    }

    updateWeapons(player, enemies, currentTime, sendHit, sendApplyStatus, shockwaves) {
        if (enemies.length === 0) return;

        player.weapons.forEach(w => {
            const fireRate = player.currentFireRate;
            if (currentTime - (w.lastShot || 0) < fireRate) return;

            // Find nearest enemy
            const nearest = enemies.reduce((a, b) =>
                Math.hypot(a.x - player.x, a.y - player.y) <
                Math.hypot(b.x - player.x, b.y - player.y) ? a : b
            );
            if (Math.hypot(nearest.x - player.x, nearest.y - player.y) > 550) return;

            const dx = nearest.x - player.x;
            const dy = nearest.y - player.y;
            const dist = Math.hypot(dx, dy);

            // Determine firing element — weapon element combined with active player elements
            const weaponEl = w.element || 'fire';

            // Check overload
            const overload = checkOverload(player.element, weaponEl);

            // Build projectile
            const proj = {
                x: player.x, y: player.y,
                vx: (dx / dist) * 10,
                vy: (dy / dist) * 10,
                damage: player.currentDamage,
                color: w.color || getElementColor(weaponEl),
                element: weaponEl,
                weaponName: w.name,
                pierce: false,
                aoe: false,
                aoeRadius: 0,
                overload,
                playerActiveElements: [...player.activeElements],
                playerId: window._myId,
            };

            // Apply weapon skill modifiers
            this._applyWeaponSkillMods(proj, player, w);

            // Overload bonuses on projectile
            if (overload) {
                if (overload.apply) {
                    const mods = overload.apply({});
                    if (mods.alwaysAoe)    { proj.aoe = true; proj.aoeRadius = mods.aoeRadius || 60; }
                    if (mods.chainTargets) { proj.chainTargets = mods.chainTargets; }
                    if (mods.freezeChance) { proj.freezeChance = mods.freezeChance; }
                }
            }

            this.projectiles.push(proj);
            w.lastShot = currentTime;

            // Quake overload counter (earth)
            if (weaponEl === 'earth') {
                this._quakeCounter++;
                if (this._quakeCounter >= 5) {
                    this._quakeCounter = 0;
                    this._triggerQuake(player, enemies, sendHit, shockwaves);
                }
            }
            // Cyclone overload counter (wind)
            if (weaponEl === 'wind') {
                this._cycloneCounter++;
                if (this._cycloneCounter >= 4) {
                    this._cycloneCounter = 0;
                    this._triggerCyclone(player, enemies, shockwaves);
                }
            }
        });
    }

    _applyWeaponSkillMods(proj, player, weapon) {
        const skills = weapon.unlockedSkills || [];

        // Flame Splash — aoe on impact
        if (skills.includes('flameSplash')) { proj.aoe = true; proj.aoeRadius = 50; }
        // Inferno Shot — every 5th shot triple damage (tracked via hitCounter)
        if (skills.includes('infernoShot') && player.hitCounter % 5 === 0) { proj.damage *= 3; proj.color = '#ff2200'; }
        // Phoenix Round — pierce
        if (skills.includes('phoenixRound')) { proj.pierce = true; }
        // Drain Shot — lifesteal flag
        if (skills.includes('drainShot')) { proj.lifesteal = 1; }
        // Null Shot — ignore resistances
        if (skills.includes('nullShot')) { proj.ignoreRes = true; }
        // Chilled Shot — slow on hit
        if (skills.includes('chilledShot')) { proj.applySlowOnHit = true; }
        // Glacial Arrow — freeze every 3rd
        if (skills.includes('glacialArrow') && player.hitCounter % 3 === 0) { proj.applyFreezeOnHit = true; }
        // Seismic Shot — stagger
        if (skills.includes('seismicShot')) { proj.applyStaggerOnHit = true; }
        // Chain Slash — chain to 2 nearby
        if (skills.includes('chainSlash')) { proj.chainTargets = (proj.chainTargets || 0) + 2; }
        // Holy Smite — bonus vs dark/undead
        if (skills.includes('divineSmite')) { proj.holyBonus = true; }
    }

    updateProjectiles(enemies, arenaSize, sendHit, sendApplyStatus, player, shockwaves) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx;
            p.y += p.vy;

            let hit = false;
            for (let j = 0; j < enemies.length; j++) {
                const en = enemies[j];
                if (Math.hypot(p.x - en.x, p.y - en.y) >= (en.radius || 20)) continue;

                // Hit!
                let dmg = p.damage;

                // Holy bonus vs dark/undead
                if (p.holyBonus && (en.element === 'dark' || en.element === 'necrotic')) dmg *= 1.5;

                // Ignore resistance flag
                const hitParams = { ignoreRes: p.ignoreRes || false };

                // Send hit with element to server (server handles chart + status apply)
                sendHit(en.id, dmg, p.element, hitParams);

                // Lifesteal
                if (p.lifesteal) player.hp = Math.min(player.hp + p.lifesteal, player.maxHp);

                // Local weapon XP
                const rankUp = player.addWeaponXp(1);
                if (rankUp) {
                    window.triggerTicker?.(`⚔️ ${player.weapons[0].name} RANK ${rankUp.newRank}!`);
                    // Add new weapon skill to card pool
                    CardSystem.addWeaponSkillCard(rankUp.unlockedSkill);
                }

                // Hit counter
                player.hitCounter = (player.hitCounter || 0) + 1;
                player.runStats.damageDealt += dmg;

                // Freeze chance
                if (p.applyFreezeOnHit || (Math.random() < (p.freezeChance || 0))) {
                    sendApplyStatus(en.id, 'ice');
                }
                // Slow on hit (ice/chilled)
                if (p.applySlowOnHit) sendApplyStatus(en.id, 'ice');
                // Stagger
                if (p.applyStaggerOnHit) sendApplyStatus(en.id, 'earth');

                // Chain lightning
                if (p.chainTargets > 0) {
                    this._chainHit(en, enemies, dmg * 0.6, p.chainTargets, sendHit, p.element, shockwaves);
                }

                // AOE on impact
                if (p.aoe && p.aoeRadius > 0) {
                    enemies.forEach(other => {
                        if (other.id === en.id) return;
                        if (Math.hypot(other.x - en.x, other.y - en.y) < p.aoeRadius) {
                            sendHit(other.id, dmg * 0.5, p.element, hitParams);
                            shockwaves.push({ x: other.x, y: other.y, r: 5, alpha: 0.6, color: p.color, maxR: 25 });
                        }
                    });
                    shockwaves.push({ x: en.x, y: en.y, r: 10, alpha: 0.8, color: p.color, maxR: p.aoeRadius });
                }

                // Bestiary record
                // (multiplier comes back via hitResult message from server)

                if (!p.pierce) {
                    this.projectiles.splice(i, 1);
                    hit = true;
                    break;
                }
                // Pierce — keep going, mark hit for this enemy only
                hit = false; // pierce doesn't stop
            }

            // Out of bounds
            if (!hit && (Math.abs(p.x) > arenaSize + 100 || Math.abs(p.y) > arenaSize + 100)) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    _chainHit(source, enemies, dmg, maxChains, sendHit, element, shockwaves) {
        let remaining = maxChains;
        let lastPos = { x: source.x, y: source.y };
        const hit = new Set([source.id]);

        while (remaining > 0) {
            // Find nearest un-hit enemy within range
            let next = null, minD = 180;
            enemies.forEach(en => {
                if (hit.has(en.id)) return;
                const d = Math.hypot(en.x - lastPos.x, en.y - lastPos.y);
                if (d < minD) { minD = d; next = en; }
            });
            if (!next) break;

            sendHit(next.id, dmg, element);
            shockwaves.push({ x: next.x, y: next.y, r: 5, alpha: 0.8, color: '#ffff00', maxR: 20 });
            hit.add(next.id);
            lastPos = { x: next.x, y: next.y };
            remaining--;
        }
    }

    _triggerQuake(player, enemies, sendHit, shockwaves) {
        const radius = 180;
        shockwaves.push({ x: player.x, y: player.y, r: 10, alpha: 1, color: '#aa7744', maxR: radius });
        shockwaves.push({ x: player.x, y: player.y, r: 10, alpha: 0.5, color: '#cc9955', maxR: radius * 0.6 });
        enemies.forEach(en => {
            if (Math.hypot(en.x - player.x, en.y - player.y) < radius) {
                sendHit(en.id, player.currentDamage * 2, 'earth');
            }
        });
        window.triggerTicker?.('🪨 EARTHQUAKE!');
    }

    _triggerCyclone(player, enemies, shockwaves) {
        const radius = 200;
        shockwaves.push({ x: player.x, y: player.y, r: 10, alpha: 0.8, color: '#ccffee', maxR: radius });
        // Pull enemies toward player
        enemies.forEach(en => {
            const d = Math.hypot(en.x - player.x, en.y - player.y);
            if (d < radius && d > 5) {
                const dx = player.x - en.x;
                const dy = player.y - en.y;
                en.x += (dx / d) * 40;
                en.y += (dy / d) * 40;
            }
        });
        window.triggerTicker?.('🌪️ CYCLONE!');
    }
}

// ============================================================
//  ABILITY SYSTEM (3-slot: class / weapon / item)
// ============================================================
export class AbilitySystem {
    constructor(player) {
        this.player = player;
        this._cooldowns = { class: 0, weapon: 0, item: 0 };
    }

    // Trigger by slot index: 0=class, 1=weapon, 2=item
    tryTriggerSlot(slotIndex, enemies, shockwaves, sendHit, sendApplyStatus) {
        const slots = ['class', 'weapon', 'item'];
        const slot = slots[slotIndex];
        if (!slot) return false;
        if (this._cooldowns[slot] > 0) return false;

        const triggered = this._executeSlot(slot, enemies, shockwaves, sendHit, sendApplyStatus);
        if (triggered) {
            const cd = this._getCooldown(slot);
            this._cooldowns[slot] = Math.max(20, cd - this.player.cooldownReduction);
        }
        return triggered;
    }

    tickCooldowns() {
        for (const k of Object.keys(this._cooldowns)) {
            if (this._cooldowns[k] > 0) this._cooldowns[k]--;
        }
    }

    getCooldownRatio(slotIndex) {
        const slots = ['class', 'weapon', 'item'];
        const slot = slots[slotIndex];
        const cd = this._cooldowns[slot] || 0;
        const max = this._getMaxCooldown(slot);
        return max > 0 ? cd / max : 0;
    }

    _getCooldown(slot) { return this._getMaxCooldown(slot); }

    _getMaxCooldown(slot) {
        if (slot === 'class') {
            const sk = this.player.classSkill;
            return sk?.maxCD || 200;
        }
        if (slot === 'weapon') return 180;
        if (slot === 'item')   return 300;
        return 200;
    }

    _executeSlot(slot, enemies, shockwaves, sendHit, sendApplyStatus) {
        const p = this.player;

        if (slot === 'class') return this._executeClassSkill(enemies, shockwaves, sendHit, sendApplyStatus);
        if (slot === 'weapon') return this._executeWeaponSkill(enemies, shockwaves, sendHit, sendApplyStatus);
        if (slot === 'item')   return this._executeItemSkill(enemies, shockwaves, sendHit, sendApplyStatus);
        return false;
    }

    // --------------------------------------------------------
    //  CLASS SKILLS
    // --------------------------------------------------------
    _executeClassSkill(enemies, shockwaves, sendHit, sendApplyStatus) {
        const p = this.player;
        const sk = p.classSkill;
        if (!sk) return false;

        // Use old skill system if no new classSkill assigned yet
        const keys = p.getSkillKeys();
        const key = keys[0];
        if (!key) return false;
        const skill = p.skills[key];
        if (!skill || skill.tier === 0) return false;

        this._legacyExecuteSkill(key, enemies, shockwaves, sendHit);
        return true;
    }

    _legacyExecuteSkill(key, enemies, shockwaves, sendHit) {
        const p = this.player;
        const tier = p.skills[key]?.tier || 1;
        const tierData = SKILL_TIERS[p.element]?.[key]?.[tier] || {};
        const el = p.element;

        switch (el) {
            case 'fire':  this._pyroSkill(key, tier, tierData, enemies, shockwaves, sendHit); break;
            case 'blood': this._bloodSkill(key, tier, tierData, enemies, shockwaves, sendHit); break;
            case 'plague':this._plagueSkill(key, tier, tierData, enemies, shockwaves, sendHit); break;
        }
    }

    // --------------------------------------------------------
    //  WEAPON SKILLS (active portion of weapon unlocks)
    // --------------------------------------------------------
    _executeWeaponSkill(enemies, shockwaves, sendHit, sendApplyStatus) {
        const p = this.player;
        const w = p.weapons[0];
        if (!w || !w.unlockedSkills?.length) return false;

        // Use highest unlocked skill as the active weapon skill
        const activeKey = w.unlockedSkills[w.unlockedSkills.length - 1];
        const skillDef = WEAPON_SKILLS[activeKey];
        if (!skillDef) return false;

        const range = 220;
        const el = w.element || 'fire';

        switch (activeKey) {
            case 'flameSplash': {
                enemies.forEach(en => {
                    if (Math.hypot(en.x - p.x, en.y - p.y) < range) {
                        sendHit(en.id, p.currentDamage * 1.5, el);
                        shockwaves.push({ x: en.x, y: en.y, r: 10, alpha: 0.8, color: '#ff6600', maxR: 60 });
                    }
                });
                return true;
            }
            case 'chilledShot': {
                const nearest = enemies.reduce((a, b) =>
                    Math.hypot(a.x-p.x,a.y-p.y) < Math.hypot(b.x-p.x,b.y-p.y) ? a : b, enemies[0]);
                if (nearest) { sendApplyStatus(nearest.id, 'ice', 2); }
                return true;
            }
            case 'glacialArrow': {
                enemies.slice(0, 3).forEach(en => sendApplyStatus(en.id, 'ice', 1));
                return true;
            }
            case 'drainShot': {
                const n = enemies.reduce((a,b) => Math.hypot(a.x-p.x,a.y-p.y)<Math.hypot(b.x-p.x,b.y-p.y)?a:b, enemies[0]);
                if (n) { sendHit(n.id, p.currentDamage * 2, el); p.hp = Math.min(p.hp + 4, p.maxHp); }
                return true;
            }
            case 'chainSlash': case 'shockwave': {
                const center = enemies.reduce((a,b) => Math.hypot(a.x-p.x,a.y-p.y)<Math.hypot(b.x-p.x,b.y-p.y)?a:b, enemies[0]);
                if (!center) return false;
                const chain = enemies.filter(e => Math.hypot(e.x-center.x,e.y-center.y) < 160);
                chain.forEach(e => { sendHit(e.id, p.currentDamage, el); shockwaves.push({ x:e.x, y:e.y, r:5, alpha:0.8, color:'#ffff00', maxR:20 }); });
                return true;
            }
            case 'nullShot': {
                enemies.filter(e => Math.hypot(e.x-p.x,e.y-p.y) < range)
                       .forEach(e => sendApplyStatus(e.id, 'void', 1));
                return true;
            }
            case 'divineSmite': {
                enemies.filter(e => Math.hypot(e.x-p.x,e.y-p.y) < range)
                       .forEach(e => { sendHit(e.id, p.currentDamage * 2, 'holy'); shockwaves.push({ x:e.x, y:e.y, r:5, alpha:0.8, color:'#ffffcc', maxR:40 }); });
                return true;
            }
            case 'seismicShot': {
                enemies.filter(e => Math.hypot(e.x-p.x,e.y-p.y) < range)
                       .forEach(e => sendApplyStatus(e.id, 'earth', 1));
                shockwaves.push({ x:p.x, y:p.y, r:10, alpha:0.8, color:'#aa7744', maxR:range });
                return true;
            }
            default: return false;
        }
    }

    // --------------------------------------------------------
    //  ITEM SKILLS (triggered item effects)
    // --------------------------------------------------------
    _executeItemSkill(enemies, shockwaves, sendHit, sendApplyStatus) {
        const p = this.player;
        // Find first item with a triggered skill
        const triggered = p.items.find(it => ['poisonOnKill', 'voidHeart'].includes(it.effect));
        if (!triggered) return false;

        if (triggered.effect === 'poisonOnKill') {
            // Manual trigger: drop poison zone at feet
            poisonZones.push({
                x: p.x, y: p.y, radius: triggered.radius || 60,
                dmgPerTick: 1 + p.stats.int * 0.3,
                duration: 180, tickTimer: 0, alpha: 0.4, element: 'poison'
            });
            shockwaves.push({ x:p.x, y:p.y, r:10, alpha:0.5, color:'#44ff44', maxR:triggered.radius||60 });
            return true;
        }
        return false;
    }

    // --------------------------------------------------------
    //  PYRO / BLOOD / PLAGUE (legacy class skills)
    // --------------------------------------------------------
    _pyroSkill(key, tier, td, enemies, shockwaves, sendHit) {
        const p = this.player;
        switch (key) {
            case 'fireBurst': {
                const r = 120 + tier * 40;
                shockwaves.push({ x:p.x, y:p.y, r:10, alpha:1, color:'orange', maxR:r });
                enemies.forEach(en => { if (Math.hypot(en.x-p.x,en.y-p.y)<r) sendHit(en.id, (td.dmg||3)+p.stats.int, 'fire'); });
                break;
            }
            case 'flameDash': {
                const dist = td.dist || 180;
                const dx = p.currentDir.x||1, dy = p.currentDir.y||0;
                for (let i=0;i<3;i++) shockwaves.push({ x:p.x+dx*(dist/3)*i, y:p.y+dy*(dist/3)*i, r:15, alpha:0.7, color:'#ff6600', maxR:35 });
                p.x += dx*dist; p.y += dy*dist;
                break;
            }
            case 'moltenGuard': {
                p.shield = 20 + tier*15;
                p.hp = Math.min(p.hp+(td.heal||2), p.maxHp);
                shockwaves.push({ x:p.x, y:p.y, r:35, alpha:1, color:'cyan', maxR:50 });
                break;
            }
            case 'inferno': {
                const r = 200 + tier*80;
                shockwaves.push({ x:p.x, y:p.y, r:10, alpha:1, color:'#ff2200', maxR:r });
                setTimeout(() => shockwaves.push({ x:p.x, y:p.y, r:10, alpha:0.6, color:'#ffaa00', maxR:r*0.7 }), 100);
                enemies.forEach(en => { if (Math.hypot(en.x-p.x,en.y-p.y)<r) sendHit(en.id, (td.dmg||10)+p.stats.int*2, 'fire'); });
                break;
            }
        }
    }

    _bloodSkill(key, tier, td, enemies, shockwaves, sendHit) {
        const p = this.player;
        switch (key) {
            case 'bloodDrain': {
                if (!enemies.length) break;
                const n = enemies.reduce((a,b) => Math.hypot(a.x-p.x,a.y-p.y)<Math.hypot(b.x-p.x,b.y-p.y)?a:b);
                if (Math.hypot(n.x-p.x,n.y-p.y) < 150+tier*50) {
                    sendHit(n.id, 2+tier, 'necrotic');
                    p.hp = Math.min(p.hp+(td.heal||3)+p.stats.con, p.maxHp);
                    shockwaves.push({ x:(p.x+n.x)/2, y:(p.y+n.y)/2, r:5, alpha:1, color:'#ff0044', maxR:20 });
                }
                break;
            }
            case 'batSwarm': {
                const r = 160+tier*40; let hits=0;
                enemies.forEach(en => { if (Math.hypot(en.x-p.x,en.y-p.y)<r) { sendHit(en.id,td.dmg||2,'dark'); hits++; shockwaves.push({ x:en.x, y:en.y, r:5, alpha:0.8, color:'#880088', maxR:20 }); } });
                if (hits>0) p.hp = Math.min(p.hp+hits*0.5, p.maxHp);
                break;
            }
            case 'bloodPact': {
                const selfDmg = Math.min(p.hp-1,3+tier);
                const r = 180+tier*50;
                p.hp -= selfDmg;
                shockwaves.push({ x:p.x, y:p.y, r:20, alpha:1, color:'#ff0000', maxR:r });
                enemies.forEach(en => { if (Math.hypot(en.x-p.x,en.y-p.y)<r) sendHit(en.id, (td.dmg||8)+selfDmg*2, 'necrotic'); });
                break;
            }
            case 'hemorrhage': {
                const thresh = td.threshold||0.25;
                enemies.forEach(en => { if (en.hp/(en.maxHp||1)<thresh) { sendHit(en.id,9999,'necrotic'); shockwaves.push({ x:en.x, y:en.y, r:10, alpha:1, color:'#ff0044', maxR:30 }); p.hp=Math.min(p.hp+2,p.maxHp); } });
                break;
            }
        }
    }

    _plagueSkill(key, tier, td, enemies, shockwaves, sendHit) {
        const p = this.player;
        switch (key) {
            case 'poisonCloud': {
                poisonZones.push({ x:p.x, y:p.y, radius:80+tier*30, dmgPerTick:(td.dmg||1)+p.stats.int*0.3, duration:180+tier*60, tickTimer:0, alpha:0.4, element:'poison' });
                shockwaves.push({ x:p.x, y:p.y, r:10, alpha:0.5, color:'#00ff44', maxR:80+tier*30 });
                break;
            }
            case 'webTrap': {
                const r = 140+tier*40;
                enemies.forEach(en => { if (Math.hypot(en.x-p.x,en.y-p.y)<r) { en.slowed=180+tier*60; en.slowAmount=td.slow||0.3; shockwaves.push({ x:en.x, y:en.y, r:5, alpha:0.7, color:'#aaaaaa', maxR:25 }); } });
                shockwaves.push({ x:p.x, y:p.y, r:10, alpha:0.4, color:'#888888', maxR:r });
                break;
            }
            case 'reanimate': {
                zombies.push({ x:p.x+40, y:p.y, hp:(td.hp||8)+p.stats.int, maxHp:(td.hp||8)+p.stats.int, speed:1.5, damage:1+tier, lastShot:0, lifetime:600+tier*200, emoji:'🧟' });
                shockwaves.push({ x:p.x, y:p.y, r:10, alpha:0.6, color:'#00ff00', maxR:50 });
                break;
            }
            case 'plagueNova': {
                shockwaves.push({ x:p.x, y:p.y, r:10, alpha:1, color:'#00ff44', maxR:500 });
                setTimeout(() => shockwaves.push({ x:p.x, y:p.y, r:10, alpha:0.5, color:'#004400', maxR:450 }), 150);
                enemies.forEach(en => {
                    sendHit(en.id, (td.dmg||8)+p.stats.int, 'poison');
                    poisonZones.push({ x:en.x, y:en.y, radius:40, dmgPerTick:1+p.stats.int*0.2, duration:120+tier*40, tickTimer:0, alpha:0.3, element:'poison' });
                });
                break;
            }
        }
    }
}

// ============================================================
//  CARD SYSTEM (VS-style level-up picks)
// ============================================================
export class CardSystem {
    static _pendingWeaponSkills = [];
    static _pendingElementUnlocks = [];

    static addWeaponSkillCard(skillKey) {
        if (skillKey) CardSystem._pendingWeaponSkills.push(skillKey);
    }

    static addElementCard(elementKey) {
        if (elementKey) CardSystem._pendingElementUnlocks.push(elementKey);
    }

    // Generate 3 cards for a level-up pick
    static generateCards(player) {
        const cards = [];
        const usedTypes = new Set();

        // 1. Try a pending weapon skill card first
        if (CardSystem._pendingWeaponSkills.length > 0 && !usedTypes.has('weapon')) {
            const key = CardSystem._pendingWeaponSkills.shift();
            const def = WEAPON_SKILLS[key];
            if (def) {
                cards.push({ type: 'weapon', key, name: def.name, icon: def.icon, desc: def.desc, color: '#ffaa00' });
                usedTypes.add('weapon');
            }
        }

        // 2. Try a pending element unlock
        if (CardSystem._pendingElementUnlocks.length > 0 && !usedTypes.has('element')) {
            const key = CardSystem._pendingElementUnlocks.shift();
            const el = ELEMENTS[key];
            if (el) {
                cards.push({ type: 'element', key, name: el.name, icon: el.emoji, desc: `Add ${el.name} to your active elements. Enables elemental combos.`, color: el.color });
                usedTypes.add('element');
            }
        }

        // 3. Fill remaining slots with random class skills / items
        const classSkillCards = CardSystem._getClassSkillCards(player);
        const itemCards = CardSystem._getItemCards(player);
        const pool = [...classSkillCards, ...itemCards];
        CardSystem._shuffle(pool);

        for (const card of pool) {
            if (cards.length >= 3) break;
            if (!usedTypes.has(card.type)) {
                cards.push(card);
                usedTypes.add(card.type);
            }
        }

        // Pad to 3 if pool was small
        while (cards.length < 3 && pool.length > 0) {
            const extra = pool.find(c => !cards.includes(c));
            if (extra) cards.push(extra);
            else break;
        }

        return cards.slice(0, 3);
    }

    static _getClassSkillCards(player) {
        const def = CLASS_DEFINITIONS[player.element];
        if (!def) return [];
        return Object.entries(def.skills).map(([key, skill]) => ({
            type: 'class', key,
            name: skill.name, icon: skill.icon,
            desc: skill.description,
            color: '#00ffcc',
            currentTier: player.skills[key]?.tier || 0,
            maxTier: skill.maxTier,
        })).filter(c => (player.skills[c.key]?.tier || 0) < c.maxTier);
    }

    static _getItemCards(player) {
        return Object.entries(ITEM_DEFS).map(([key, item]) => ({
            type: 'item', key,
            name: item.name, icon: item.icon,
            desc: item.desc,
            color: '#cc88ff',
        })).filter(c => !player.items.find(i => i.key === c.key)); // don't offer dupes
    }

    static applyCard(card, player) {
        switch (card.type) {
            case 'class':
                if (player.skills[card.key]) {
                    player.skills[card.key].tier = Math.min(
                        player.skills[card.key].tier + 1,
                        player.skills[card.key].maxTier
                    );
                    const tierBonus = SKILL_TIERS[player.element]?.[card.key]?.[player.skills[card.key].tier];
                    if (tierBonus?.cdMult) {
                        const baseDef = CLASS_DEFINITIONS[player.element].skills[card.key];
                        player.skills[card.key].maxCD = Math.round(baseDef.maxCD * tierBonus.cdMult);
                    }
                }
                break;
            case 'weapon':
                if (player.weapons[0]) {
                    player.weapons[0].unlockedSkills = player.weapons[0].unlockedSkills || [];
                    if (!player.weapons[0].unlockedSkills.includes(card.key)) {
                        player.weapons[0].unlockedSkills.push(card.key);
                    }
                }
                break;
            case 'item':
                player.equipItem(card.key);
                break;
            case 'element':
                player.addElement(card.key);
                if (player.classProfile) player.classProfile.unlockElement(card.key);
                break;
        }
        player.saveProfile();
    }

    static _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}

// ============================================================
//  ITEM PASSIVE TICK (regen, etc.)
// ============================================================
export function tickItemPassives(player) {
    player.items.forEach(item => {
        if (item.effect === 'regen') {
            item._timer = (item._timer || 0) + 1;
            if (item._timer >= (item.interval || 300)) {
                item._timer = 0;
                player.hp = Math.min(player.hp + item.value, player.maxHp);
            }
        }
    });
}

// ============================================================
//  POISON ZONE TICK
// ============================================================
export function updatePoisonZones(enemies, sendHit) {
    for (let i = poisonZones.length - 1; i >= 0; i--) {
        const z = poisonZones[i];
        z.duration--;
        z.tickTimer++;
        if (z.tickTimer >= 30) {
            z.tickTimer = 0;
            enemies.forEach(en => {
                if (Math.hypot(en.x-z.x, en.y-z.y) < z.radius)
                    sendHit(en.id, z.dmgPerTick, z.element || 'poison');
            });
        }
        if (z.duration <= 0) poisonZones.splice(i, 1);
    }
}

// ============================================================
//  ZOMBIE TICK
// ============================================================
export function updateZombies(enemies, sendHit) {
    for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i];
        z.lifetime--;
        if (enemies.length > 0) {
            const n = enemies.reduce((a,b) => Math.hypot(a.x-z.x,a.y-z.y)<Math.hypot(b.x-z.x,b.y-z.y)?a:b);
            const dx = n.x-z.x, dy = n.y-z.y, d = Math.hypot(dx,dy);
            if (d > 20) { z.x += (dx/d)*z.speed; z.y += (dy/d)*z.speed; }
            else {
                const now = Date.now();
                if (now - z.lastShot > 1000) { sendHit(n.id, z.damage, 'necrotic'); z.lastShot = now; }
            }
        }
        if (z.lifetime <= 0 || z.hp <= 0) zombies.splice(i, 1);
    }
}

// ============================================================
//  WAVE CONFIG (kept for HUD label compatibility)
// ============================================================
export const WAVE_CONFIG = {
    isBossWave(n)     { return n > 0 && n % 10 === 0; },
    isMiniBossWave(n) { return n > 0 && n % 5  === 0 && n % 10 !== 0; },
    getWaveLabel(n, swarmTier) {
        if (this.isBossWave(swarmTier))     return `⚠️ BOSS — TIER ${swarmTier}`;
        if (this.isMiniBossWave(swarmTier)) return `⚡ MINI-BOSS — TIER ${swarmTier}`;
        return `TIER ${swarmTier}`;
    },
};
