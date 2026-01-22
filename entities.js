export class Player {
    constructor() {
        this.x = 0;
        this.y = 0;
        
        // --- PROGRESSION ---
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 100;
        
        this.statPoints = 0;    // Earned from Leveling (XP)
        this.abilityPoints = 0; // Earned from Waves (Portal)
        
        this.gold = 0;
        this.lastServerPhase = 'WAVE'; // Track phase changes

        // --- BASE STATS ---
        this.stats = {
            str: 0, // Increases Damage
            dex: 0, // Increases Fire Rate
            con: 0, // Increases Max HP
            int: 0, // Increases Burn/DoT
            wis: 0  // Reduces Cooldowns
        };

        this.element = 'fire';
        this.baseHp = 10; 
        this.hp = 10;
        this.speed = 3.5;
        this.avatar = '🧙';
        
        this.weapons = [
            { name: "Starter Wand", baseDamage: 2, baseFireRate: 1000, lastShot: 0, color: 'orange', damage: 2, fireRate: 1000 }
        ];

        this.skills = {
            fireBurst: { unlocked: false, cooldown: 0, maxCD: 150 }, 
            flameDash: { unlocked: false, cooldown: 0, maxCD: 200 }, 
            moltenGuard: { unlocked: false, cooldown: 0, maxCD: 400 }, 
            inferno: { unlocked: false, cooldown: 0, maxCD: 1000 }    
        };
    }

    // --- DYNAMIC STAT CALCULATIONS ---
    get maxHp() { return this.baseHp + (this.stats.con * 5); }
    get currentDamage() { return this.weapons[0].baseDamage + (this.stats.str * 1); }
    get currentFireRate() { return Math.max(200, this.weapons[0].baseFireRate - (this.stats.dex * 50)); }
    get burnDamage() { return 1 + (this.stats.int * 0.5); }
    get cooldownReduction() { return this.stats.wis * 10; } 

    saveProfile() {
        const data = {
            level: this.level,
            xp: this.xp,
            xpToNext: this.xpToNext,
            statPoints: this.statPoints,
            abilityPoints: this.abilityPoints,
            gold: this.gold,
            stats: this.stats,
            skills: this.skills,
            avatar: this.avatar
        };
        localStorage.setItem('spire_save', JSON.stringify(data));
        console.log("Progress Saved");
    }

    loadProfile() {
        const json = localStorage.getItem('spire_save');
        if (json) {
            const data = JSON.parse(json);
            this.level = data.level || 1;
            this.xp = data.xp || 0;
            this.xpToNext = data.xpToNext || 100;
            this.statPoints = data.statPoints || 0;
            this.abilityPoints = data.abilityPoints || 0;
            this.gold = data.gold || 0;
            this.stats = data.stats || { str:0, dex:0, con:0, int:0, wis:0 };
            this.avatar = data.avatar || this.avatar;
            
            for (let key in data.skills) {
                if (this.skills[key]) {
                    this.skills[key].unlocked = data.skills[key].unlocked;
                }
            }
            this.hp = this.maxHp; // Heal to full on load
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
