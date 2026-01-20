import { Player, Enemy } from './entities.js';
import { InputHandler } from './input.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const input = new InputHandler();
const player = new Player();

let arenaSize = 400;
let gameState = 'WAVE'; // WAVE, UPGRADE, MAP
let enemies = [];
let currentWave = 1;

function spawnWave(waveNumber) {
    enemies = [];
    // 5 Goblins for every 1 Archer (Ratio)
    const totalEnemies = 10 + (waveNumber * 2);
    for (let i = 0; i < totalEnemies; i++) {
        const type = (i % 6 === 0) ? 'archer' : 'goblin';
        enemies.push(new Enemy(type, arenaSize));
    }
}

function gameLoop(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'WAVE') {
        // 1. Handle Input Command
        const cmd = input.consumeCommand();
        if (cmd === 'UP_SWIPE' && player.skills.jump.unlocked) {
            // Trigger Jump logic here
        }

        // 2. Move Player
        player.x += input.moveDir.x * player.speed;
        player.y += input.moveDir.y * player.speed;

        // 3. Update Entities & Combat
        // (Bullet and Enemy logic goes here)

        // 4. Check for Wave End
        if (enemies.length === 0) {
            gameState = 'UPGRADE';
            showUpgradeUI();
        }
    }

    draw();
    requestAnimationFrame(gameLoop);
}

function showUpgradeUI() {
    // Slay the Spire style choice:
    // Option A: New Weapon
    // Option B: Upgrade Stats
    // Option C: New Skill (Jump/Shield)
}

spawnWave(currentWave);
requestAnimationFrame(gameLoop);
