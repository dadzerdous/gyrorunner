// systems.js

/**
 * Handles all damage calculation, projectiles, and status effects
 */
export class CombatSystem {
    constructor() {
        this.projectiles = [];
    }

    /**
     * Handles weapons auto-firing based on their individual fireRates
     */
    updateWeapons(player, enemies, currentTime) {
        player.weapons.forEach(weapon => {
            if (currentTime - weapon.lastShot > weapon.fireRate && enemies.length > 0) {
                // Find nearest enemy in the arena
                let nearest = enemies.reduce((a, b) => 
                    Math.hypot(a.x - player.x, a.y - player.y) < Math.hypot(b.x - player.x, b.y - player.y) ? a : b
                );

                const dist = Math.hypot(nearest.x - player.x, nearest.y - player.y);
                
                // Only shoot if enemy is within range
                if (dist < 500) {
                    this.projectiles.push({
                        x: player.x,
                        y: player.y,
                        vx: ((nearest.x - player.x) / dist) * 10,
                        vy: ((nearest.y - player.y) / dist) * 10,
                        damage: weapon.damage,
                        element: weapon.element,
                        color: weapon.element === 'fire' ? 'orange' : 'white' // Simplified elemental color
                    });
                    weapon.lastShot = currentTime;
                }
            }
        });
    }

    /**
     * Updates projectile positions and checks for enemy hits
     */
    updateProjectiles(enemies, arenaSize) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.x += p.vx;
            p.y += p.vy;

            // Collision detection with enemies
            enemies.forEach(en => {
                if (Math.hypot(p.x - en.x, p.y - en.y) < 25) {
                    en.hp -= p.damage; // Apply damage
                    this.projectiles.splice(i, 1);
                }
            });

            // Remove projectiles that go way outside the arena
            if (p && Math.abs(p.x) > arenaSize + 100) {
                this.projectiles.splice(i, 1);
            }
        }
    }
}

/**
 * Resolves Action Commands (Swipes/Keys) into Player Abilities
 */
export class AbilitySystem {
    /**
     * Maps inputs to specific skill triggers
     */
    static resolveCommand(command, player) {
        if (!command) return;

        // Jump logic: invincible while in air
        if (command === 'UP_SWIPE' && player.skills.jump.unlocked && player.skills.jump.cooldown <= 0) {
            player.isJumping = true;
            player.jumpTime = 35; 
            player.skills.jump.cooldown = player.skills.jump.maxCD;
        }
        
        // Dash logic: Burst in current movement direction
        if (command === 'RIGHT_SWIPE' && player.skills.dash.unlocked && player.skills.dash.cooldown <= 0) {
            const dx = player.currentDir.x || 1;
            const dy = player.currentDir.y || 0;
            player.x += dx * 130; 
            player.y += dy * 130;
            player.skills.dash.cooldown = player.skills.dash.maxCD;
        }
    }
}
