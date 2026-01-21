// entities.js
export class Player {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 100;
        this.gold = 0;
        this.skillPoints = 0;
        
        // Fire Class Progression
        this.element = 'fire';
        this.hp = 10;
        this.maxHp = 10;
        this.speed = 3.5;
        
        this.weapons = [
            { name: "Starter Wand", damage: 2, fireRate: 1000, lastShot: 0, color: 'orange' }
        ];

        this.skills = {
            fireBurst: { unlocked: true, cooldown: 0, maxCD: 150 }, // Level 1
            flameDash: { unlocked: false, cooldown: 0, maxCD: 200 }, // Level 3
            moltenGuard: { unlocked: false, cooldown: 0, maxCD: 400 }, // Level 6
            inferno: { unlocked: false, cooldown: 0, maxCD: 1000 }    // Level 9 (Ult)
        };
        
        this.keystones = {
            chainExplosions: false, // Level 5
            burnSpread: false      // Level 10
        };
    }
}

export class Enemy {
    constructor(type, arenaSize) {
        // Ratios: Goblins are melee, Archers are ranged
        this.type = type; // 'goblin', 'archer', 'elite'
        
        // Spawning logic: strictly inside arena edges
        const side = Math.floor(Math.random() * 4);
        const margin = 30;
        if (side === 0) { this.x = -arenaSize + margin; this.y = (Math.random() * 2 - 1) * arenaSize; }
        else if (side === 1) { this.x = arenaSize - margin; this.y = (Math.random() * 2 - 1) * arenaSize; }
        else if (side === 2) { this.y = -arenaSize + margin; this.x = (Math.random() * 2 - 1) * arenaSize; }
        else { this.y = arenaSize - margin; this.x = (Math.random() * 2 - 1) * arenaSize; }

        this.hp = type === 'goblin' ? 3 : 1;
        this.speed = type === 'goblin' ? 1.5 : 0.8;
        this.lastShot = 0;
    }
}
