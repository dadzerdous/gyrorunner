// entities.js
export class Player {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.size = 20;
        this.gems = 0; // Add this line
        
        // --- BASE STATS ---
        this.hp = 10;
        this.maxHp = 10;
        this.speed = 3.5;
        this.armor = 0;
        this.luck = 1;

        // --- WEAPONS ---
        // Multiple weapons can be active (like Brotato)
        this.weapons = [
            { name: "Blood Bolt", damage: 2, fireRate: 1000, lastShot: 0, element: "none" }
        ];

        // --- SKILLS (ACTION COMMANDS) ---
        // These are unlocked via the Spire-style level up
        this.skills = {
            jump: { unlocked: false, cooldown: 0, maxCD: 200 },
            shield: { unlocked: false, cooldown: 0, maxCD: 400 },
            dash: { unlocked: false, cooldown: 0, maxCD: 100 }
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
