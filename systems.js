// systems.js

/**
 * Handles all damage calculation and status effects
 */
export class CombatSystem {
    constructor() {
        this.projectiles = [];
        this.particles = [];
        checkEvolutions(player) {
    const fireWeapons = player.weapons.filter(w => w.element === 'fire');
    if (fireWeapons.length >= 2) {
        // Merge them into a "Tower"
        player.weapons = player.weapons.filter(w => w.element !== 'fire');
        player.weapons.push({
            name: "Inferno Tower",
            damage: 10,
            fireRate: 2000,
            lastShot: 0,
            element: 'fire',
            isStatic: true // This weapon doesn't move with player
        });
    }
}
    }

    // Handles weapons auto-firing
    updateWeapons(player, enemies, currentTime) {
        player.weapons.forEach(weapon => {
            if (currentTime - weapon.lastShot > weapon.fireRate && enemies.length > 0) {
                // Find nearest enemy
                let nearest = enemies.reduce((a, b) => 
                    Math.hypot(a.x - player.x, a.y - player.y) < Math.hypot(b.x - player.x, b.y - player.y) ? a : b
                );

                const dist = Math.hypot(nearest.x - player.x, nearest.y - player.y);
                if (dist < 500) {
                    this.projectiles.push({
                        x: player.x,
                        y: player.y,
                        vx: ((nearest.x - player.x) / dist) * 10,
                        vy: ((nearest.y - player.y) / dist) * 10,
                        damage: weapon.damage,
                        element: weapon.element,
                        color: this.getElementColor(weapon.element)
                    });
                    weapon.lastShot = currentTime;
                }
            }
        });
    }

    getElementColor(element) {
        switch(element) {
            case 'fire': return '#ff4500'; // Burn
            case 'ice': return '#00ffff';  // Slow
            case 'volt': return '#ffff00'; // Chain
            default: return '#ffffff';
        }
    }

    updateProjectiles(enemies, arenaSize) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.x += p.vx;
            p.y += p.vy;

            // Collision with enemies
            for (let j = enemies.length - 1; j >= 0; j--) {
                let en = enemies[j];
                if (Math.hypot(p.x - en.x, p.y - en.y) < 25) {
                    this.applyDamage(en, p.damage, p.element);
                    this.projectiles.splice(i, 1);
                    break;
                }
            }

            // Boundary check
            if (p && (Math.abs(p.x) > arenaSize || Math.abs(p.y) > arenaSize)) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    applyDamage(enemy, dmg, element) {
        enemy.hp -= dmg;
        // Logic for Elemental Effects
        if (element === 'ice') enemy.speed *= 0.8; // Slow
        if (element === 'fire') enemy.isBurning = true; // Future tick damage
    }
}

/**
 * Resolves Action Commands (Swipes) into Skills
 */
export class AbilitySystem {
    static resolveCommand(command, player, shockwaves) {
        if (!command) return;

        // Command Mapping
        if (command === 'UP_SWIPE' && player.skills.jump.unlocked && player.skills.jump.cooldown <= 0) {
            this.executeJump(player, shockwaves);
        }
        
        if (command === 'RIGHT_SWIPE' && player.skills.dash.unlocked && player.skills.dash.cooldown <= 0) {
            this.executeDash(player);
        }
    }

    static executeJump(player, shockwaves) {
        player.isJumping = true;
        player.jumpTime = 30;
        player.skills.jump.cooldown = player.skills.jump.maxCD;
        // The actual shockwave spawn logic will be called in game.js when jumpTime hits 0
    }

    static executeDash(player) {
        // Dash logic: Instant burst of movement
        player.x += Math.sign(player.moveDir.x || 1) * 100;
        player.skills.dash.cooldown = player.skills.dash.maxCD;
    }
}
