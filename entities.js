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
        
        this.element = 'fire';
        this.hp = 10;
        this.maxHp = 10;
        this.speed = 3.5;
        this.avatar = '🧙'; // Default
        
        this.weapons = [
            { name: "Starter Wand", damage: 2, fireRate: 1000, lastShot: 0, color: 'orange' }
        ];

        this.skills = {
            fireBurst: { unlocked: true, cooldown: 0, maxCD: 150 }, 
            flameDash: { unlocked: false, cooldown: 0, maxCD: 200 }, 
            moltenGuard: { unlocked: false, cooldown: 0, maxCD: 400 }, 
            inferno: { unlocked: false, cooldown: 0, maxCD: 1000 }    
        };
        
        this.keystones = {
            chainExplosions: false, 
            burnSpread: false      
        };
    }

    // NEW: Save character progress
    saveProfile() {
        const data = {
            level: this.level,
            xp: this.xp,
            xpToNext: this.xpToNext,
            gold: this.gold,
            skillPoints: this.skillPoints,
            skills: this.skills, // Save unlock states
            keystones: this.keystones,
            avatar: this.avatar,
            element: this.element,
            hp: this.hp, // Optional: save current HP or reset?
            maxHp: this.maxHp
        };
        localStorage.setItem('spire_save', JSON.stringify(data));
        console.log("Game Saved");
    }

    // NEW: Load character progress
    loadProfile() {
        const json = localStorage.getItem('spire_save');
        if (json) {
            const data = JSON.parse(json);
            this.level = data.level;
            this.xp = data.xp;
            this.xpToNext = data.xpToNext;
            this.gold = data.gold;
            this.skillPoints = data.skillPoints;
            this.avatar = data.avatar || this.avatar;
            this.element = data.element || 'fire';
            this.maxHp = data.maxHp;
            
            // Merge Skills (keep cooldowns/functions, update unlocked status)
            for (let key in data.skills) {
                if (this.skills[key]) {
                    this.skills[key].unlocked = data.skills[key].unlocked;
                }
            }
            // Merge Keystones
            this.keystones = data.keystones;
            console.log("Save Loaded: Level " + this.level);
            return true;
        }
        return false;
    }
}

export class Enemy {
    constructor(type, arenaSize) {
        this.type = type; 
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
