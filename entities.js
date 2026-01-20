export class Player {
    constructor() {
        this.x = 0; this.y = 0;
        this.hp = 10; this.maxHp = 10;
        this.xp = 0; this.level = 1;
        this.speed = 3.5;
        this.stats = { attackSpeed: 1, luck: 1, fireRes: 0 };
        this.abilities = []; // Tied to action commands
    }
}

export class Enemy {
    constructor(type, x, y) {
        this.x = x; this.y = y;
        this.type = type; // 'goblin', 'archer', 'tank'
        this.hp = type === 'goblin' ? 2 : 1;
        this.speed = type === 'goblin' ? 1.8 : 0.9;
        this.color = type === 'goblin' ? '#4ade80' : '#f87171';
    }
}
