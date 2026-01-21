// systems.js
export class AbilitySystem {
    constructor(player) {
        this.player = player;
    }

    /**
     * Checks if a skill at specific slot can be used
     * @param {number} slotIndex - 0 to 3
     * @param {Array} enemies - For targeting
     * @param {Array} shockwaves - For visual effects
     * @param {Function} sendHit - Network callback
     */
    tryTriggerSkill(slotIndex, enemies, shockwaves, sendHit) {
        // Map slots to skill keys
        const skillKeys = ['fireBurst', 'flameDash', 'moltenGuard', 'inferno'];
        const key = skillKeys[slotIndex];
        const skill = this.player.skills[key];

        // Validation
        if (!skill) return;
        if (!skill.unlocked) return; // Greyed out
        if (skill.cooldown > 0) return; // On Cooldown

        // EXECUTE SKILL
        this.executeSkillLogic(key, enemies, shockwaves, sendHit);

        // Apply Cooldown
        skill.cooldown = skill.maxCD;
    }

    executeSkillLogic(key, enemies, shockwaves, sendHit) {
        const p = this.player;

        switch (key) {
            case 'fireBurst': // Slot 1: Basic AOE
                shockwaves.push({ 
                    x: p.x, y: p.y, r: 10, maxR: 120, alpha: 1, 
                    color: p.weapons[0].color 
                });
                enemies.forEach(en => {
                    if (Math.hypot(en.x - p.x, en.y - p.y) < 120) sendHit(en.id, 3);
                });
                break;

            case 'flameDash': // Slot 2: Mobility
                const dx = p.currentDir.x || 1; 
                const dy = p.currentDir.y || 0;
                // Add visual trail
                shockwaves.push({ x: p.x, y: p.y, r: 20, maxR: 40, alpha: 0.8, color: 'white' });
                p.x += dx * 180; 
                p.y += dy * 180;
                break;

            case 'moltenGuard': // Slot 3: Shield
                // Visual only for now, logic would go in player hp check
                shockwaves.push({ x: p.x, y: p.y, r: 40, maxR: 45, alpha: 1, color: 'cyan' });
                p.hp = Math.min(p.hp + 2, p.maxHp); // Heal/Shield mechanic
                break;

            case 'inferno': // Slot 4: Ultimate
                shockwaves.push({ x: p.x, y: p.y, r: 10, maxR: 350, alpha: 1, color: 'red' });
                enemies.forEach(en => {
                    if (Math.hypot(en.x - p.x, en.y - p.y) < 350) sendHit(en.id, 10);
                });
                break;
        }
    }
}

export class CombatSystem {
    constructor() { this.projectiles = []; }
    
    updateWeapons(player, enemies, currentTime) {
        player.weapons.forEach(w => {
            if (currentTime - w.lastShot > w.fireRate && enemies.length > 0) {
                // Find nearest
                let nearest = enemies.reduce((a, b) => 
                    Math.hypot(a.x - player.x, a.y - player.y) < Math.hypot(b.x - player.x, b.y - player.y) ? a : b
                );
                
                if (Math.hypot(nearest.x - player.x, nearest.y - player.y) < 500) {
                    this.projectiles.push({
                        x: player.x, y: player.y,
                        vx: ((nearest.x - player.x) / Math.hypot(nearest.x - player.x, nearest.y - player.y)) * 10,
                        vy: ((nearest.y - player.y) / Math.hypot(nearest.x - player.x, nearest.y - player.y)) * 10,
                        damage: w.damage, color: w.color
                    });
                    w.lastShot = currentTime;
                }
            }
        });
    }

    updateProjectiles(enemies, arenaSize, sendHit, player) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.x += p.vx; p.y += p.vy;
            
            let hit = false;
            enemies.forEach(en => {
                if (!hit && Math.hypot(p.x - en.x, p.y - en.y) < 25) {
                    sendHit(en.id, p.damage);
                    hit = true;
                    this.projectiles.splice(i, 1);
                    // Client-side prediction for XP
                    if (en.hp <= p.damage) player.xp += 20; 
                }
            });
            
            if (!hit && (Math.abs(p.x) > arenaSize + 100)) this.projectiles.splice(i, 1);
        }
    }
}
