import { Player, Enemy } from './entities.js';
import { InputHandler } from './input.js';
import { CombatSystem, AbilitySystem } from './systems.js';

// --- INITIALIZATION ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const input = new InputHandler();
const player = new Player();
const combat = new CombatSystem();

// --- GAME STATE ---
let gameState = 'WAVE'; // WAVE, UPGRADE, MAP
let currentWave = 1;
let arenaSize = 400;
let enemies = [];
let gems = [];
let shockwaves = [];

// --- CORE FUNCTIONS ---

function spawnWave(waveNum) {
    enemies = [];
    gems = [];
    shockwaves = [];
    combat.projectiles = []; // Clear old bullets
    
    // Ratio: ~5 Goblins to 1 Archer
    const count = 5 + (waveNum * 3);
    for (let i = 0; i < count; i++) {
        const type = (i % 6 === 0) ? 'archer' : 'goblin';
        enemies.push(new Enemy(type, arenaSize));
    }
    gameState = 'WAVE';
    document.getElementById('upgrade-menu').style.display = 'none';
    document.getElementById('room-menu').style.display = 'none';
}

function handleCollisions() {
    enemies.forEach(en => {
        const d = Math.hypot(en.x - player.x, en.y - player.y);
        if (d < 30 && !player.isJumping) {
            player.hp -= 0.02; // Simple tick damage
            if (player.hp <= 0) location.reload(); 
        }
    });

    for (let i = gems.length - 1; i >= 0; i--) {
        const g = gems[i];
        const d = Math.hypot(g.x - player.x, g.y - player.y);
        if (d < 150) { // Magnetism
            g.x += (player.x - g.x) * 0.1;
            g.y += (player.y - g.y) * 0.1;
        }
        if (d < 20) {
            player.xp++;
            gems.splice(i, 1);
        }
    }
}

// --- DRAWING ---
function draw() {
    ctx.fillStyle = '#050208';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Arena Floor
    ctx.strokeStyle = '#221133';
    ctx.lineWidth = 2;
    ctx.strokeRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);

    // Gems
    ctx.font = '16px serif';
    gems.forEach(g => ctx.fillText('💎', g.x - 8, g.y + 8));

    // Enemies
    enemies.forEach(en => {
        ctx.font = '24px serif';
        ctx.fillText(en.type === 'archer' ? '🏹' : '🧟', en.x - 12, en.y + 12);
    });

    // Bullets
    combat.projectiles.forEach(p => {
        ctx.fillStyle = p.color || 'white';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    // Shockwaves
    shockwaves.forEach(sw => {
        ctx.strokeStyle = `rgba(0, 255, 204, ${sw.op})`;
        ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2); ctx.stroke();
    });

    // Player
    let scale = player.isJumping ? 1.6 : 1;
    ctx.font = (30 * scale) + 'px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧛', player.x, player.y + 10);

    ctx.restore();

    // HUD (Simple Overlay)
    ctx.fillStyle = "white";
    ctx.font = "18px Arial";
    ctx.fillText(`Wave: ${currentWave} | HP: ${Math.ceil(player.hp)} | XP: ${player.xp}`, 20, 30);
}

// --- UPDATE LOOP ---
function update(time) {
    if (gameState !== 'WAVE') return;

    const cmd = input.consumeCommand();
    AbilitySystem.resolveCommand(cmd, player, shockwaves);

    player.x += input.moveDir.x * player.speed;
    player.y += input.moveDir.y * player.speed;
    player.x = Math.max(-arenaSize, Math.min(arenaSize, player.x));
    player.y = Math.max(-arenaSize, Math.min(arenaSize, player.y));

    if (player.isJumping) {
        player.jumpTime--;
        if (player.jumpTime === 0) {
            player.isJumping = false;
            shockwaves.push({ x: player.x, y: player.y, r: 10, op: 1 });
        }
    }

    combat.updateWeapons(player, enemies, time);
    combat.updateProjectiles(enemies, arenaSize);

    enemies.forEach(en => {
        const dx = player.x - en.x;
        const dy = player.y - en.y;
        const d = Math.hypot(dx, dy);
        en.x += (dx / d) * en.speed;
        en.y += (dy / d) * en.speed;
    });

    shockwaves.forEach((sw, i) => {
        sw.r += 6; sw.op -= 0.03;
        enemies.forEach(en => {
            if (Math.abs(Math.hypot(en.x - sw.x, en.y - sw.y) - sw.r) < 20) en.hp -= 5;
        });
        if (sw.op <= 0) shockwaves.splice(i, 1);
    });

    enemies = enemies.filter(en => {
        if (en.hp <= 0) { gems.push({ x: en.x, y: en.y }); return false; }
        return true;
    });

    handleCollisions();

    if (enemies.length === 0) {
        showRoomSelection();
    }
}

function showRoomSelection() {
    gameState = 'MAP';
    const menu = document.getElementById('room-menu');
    menu.style.display = 'flex';
    menu.innerHTML = `
        <h2 style="color:red">CHOOSE YOUR PATH</h2>
        <button onclick="window.startNextWave('Standard')">Standard Wave (More XP)</button>
        <button onclick="window.startNextWave('Elite')">Elite Room (New Weapon)</button>
    `;
}

// Global helper for the buttons
window.startNextWave = (type) => {
    currentWave++;
    if (type === 'Elite') {
        player.weapons.push({ name: "Fire Dagger", damage: 4, fireRate: 1500, lastShot: 0, element: "fire" });
    }
    spawnWave(currentWave);
};

function ticker(time) {
    update(time);
    draw();
    requestAnimationFrame(ticker);
}

// Initial Spawn
spawnWave(currentWave);
requestAnimationFrame(ticker);
