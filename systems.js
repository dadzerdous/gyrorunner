// systems.js

/**
 * Handles all damage calculation, projectiles, and status effects
 */
export class CombatSystem {
    constructor() {
        this.projectiles = [];
        this.particles = [];
    }

    /**
     * Checks if the player has multiple weapons of the same element 
     * to merge them into a high-tier "Tower"
     */
    checkEvolutions(player) {
        const fireWeapons = player.weapons.filter(w => w.element === 'fire');
        if (fireWeapons.length >= 2) {
            // Merge them into an Inferno Tower
            player.weapons = player.weapons.filter(w => w.element !== 'fire');
            player.weapons.push({
                name: "Inferno Tower",
                damage: 10,
                fireRate: 2000,
                lastShot: 0,
                element: 'fire',
                isStatic: true // This weapon represents a stationary growth
            });
            console.log("Evolution! Inferno Tower created.");
        }
    }

    // Handles weapons auto-firing based on their individual fireRates
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
                        color: this.getElementColor(weapon.element)
                    });
                    weapon.lastShot = currentTime;
                }
            }
        });
    }

    // Assigns colors based on elemental properties
    getElementColor(element) {
        switch(element) {
            case 'fire': return '#ff4500'; // Orange-Red
            case 'ice': return '#00ffff';  // Cyan
            case 'volt': return '#ffff00'; // Yellow
            default: return '#ffffff';     // White (Blood Bolt)
        }
    }

    // Updates projectile positions and checks for enemy hits
    updateProjectiles(enemies, arenaSize) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.x += p.vx;
            p.y += p.vy;

            // Collision detection with enemies
            for (let j = enemies.length - 1; j >= 0; j--) {
                let en = enemies[j];
                if (Math.hypot(p.x - en.x, p.y - en.y) < 25) {
                    this.applyDamage(en, p.damage, p.element);
                    this.projectiles.splice(i, 1);
                    break;
                }
            }

            // Remove projectiles that go way outside the arena
            if (p && (Math.abs(p.x) > arenaSize * 1.5 || Math.abs(p.y) > arenaSize * 1.5)) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    // Applies damage and status effect logic
    applyDamage(enemy, dmg, element) {
        enemy.hp -= dmg;
        
        // Element Logic: Ice slows movement speed
        if (element === 'ice') {
            enemy.speed *= 0.8;
        }
        
        // Element Logic: Fire marks for future tick damage (Burning)
        if (element === 'fire') {
            enemy.isBurning = true;
        }
    }
}

/**
 * Resolves Action Commands (Swipes/Keys) into Player Abilities
 */
export class AbilitySystem {
    static resolveCommand(command, player, shockwaves) {
        if (!command) return;

        // Map Swipe Commands to specific Skills
        if (command === 'UP_SWIPE' && player.skills.jump.unlocked && player.skills.jump.cooldown <= 0) {
            this.executeJump(player);
        }
        
        if (command === 'RIGHT_SWIPE' && player.skills.dash.unlocked && player.skills.dash.cooldown <= 0) {
            this.executeDash(player);
        }
    }

    static executeJump(player) {
        player.isJumping = true;
        player.jumpTime = 30; // Length of the jump in frames
        player.skills.jump.cooldown = player.skills.jump.maxCD;
        console.log("Player Jump Triggered");
    }

    static executeDash(player) {
        // Dash logic: Quick burst in the current movement direction
        const dashPower = 120;
        // Uses moveDir from input if available, otherwise defaults right
        const dirX = player.moveDir?.x || 1;
        const dirY = player.moveDir?.y || 0;
        
        player.x += dirX * dashPower;
        player.y += dirY * dashPower;
        
        player.skills.dash.cooldown = player.skills.dash.maxCD;
        console.log("Player Dash Triggered");
    }
}
