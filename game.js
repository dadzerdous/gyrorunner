import { Player, Enemy } from './entities.js';
import { InputHandler } from './input.js';
import { CombatSystem, AbilitySystem } from './systems.js';
import { MapSystem } from './map.js';

// --- INITIALIZATION ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const input = new InputHandler();
const player = new Player();
const combat = new CombatSystem();
const spireMap = new MapSystem(15);

// --- GAME STATE ---
let gameState = 'WAVE'; // WAVE, UPGRADE, MAP
let currentWave = 1;
let arenaSize = 450;
let enemies = [];
let gems = [];
let shockwaves = [];

// --- WAVE & ROOM LOGIC ---

function spawnWave(waveNum) {
    enemies = [];
    gems = [];
    shockwaves = [];
    combat.projectiles = [];
    
    // 5 Goblins to 1 Archer ratio
    const count = 5 + (waveNum * 3);
    for (let i = 0; i < count; i++) {
        const type = (i % 6 === 0) ? 'archer' : 'goblin';
        enemies.push(new Enemy(type, arenaSize));
    }
    
    gameState = 'WAVE';
    document.getElementById('upgrade-menu').style.display = 'none';
    document.getElementById('room-menu').style.display = 'none';
}

function showRoomSelection() {
    gameState = 'MAP';
    const menu = document.getElementById('room-menu');
    const container = document.getElementById('room-choices');
    menu.style.display = 'flex';
    
    const options = spireMap.getNextOptions();
    container.innerHTML = ""; // Clear old buttons
    
    options.forEach(type => {
        const btn = document.createElement('button');
        btn.style.margin = "10px";
        btn.style.padding = "10px";
        btn.innerHTML = `${getRoomIcon(type)} ${type}`;
        btn.onclick = () => window.startNextWave(type);
        container.appendChild(btn);
    });
}

function getRoomIcon(type) {
    switch(type) {
        case 'Combat': return '⚔️';
        case 'Elite': return '💀';
        case 'Rest': return '🩸';
        case 'Mystery': return '❓';
        case 'Boss': return '👑';
        default: return '🚪';
    }
}

// Global helper for menu buttons
window.startNextWave = (type) => {
    if (type === 'Rest') {
        player.hp = Math.min(player.maxHp, player.hp + 4);
        showRoomSelection(); 
        return;
    }
    
    currentWave++;
    arenaSize = (type === 'Elite') ? 350 : 450;
    spawnWave(currentWave);
};

// --- CORE LOOP ---

function update(time) {
    if (gameState !== 'WAVE') return;

    // 1. Inputs & Skills
    const cmd = input.consumeCommand();
    AbilitySystem.resolveCommand(cmd, player, shockwaves);

    // 2. Movement
const move = input.getMovement();
player.x += move.x * player.speed;
player.y += move.y * player.speed;
    player.x = Math.max(-arenaSize, Math.min(arenaSize, player.x));
    player.y = Math.max(-arenaSize, Math.min(arenaSize, player.y));

    // 3. Jump Logic
    if (player.isJumping) {
        player.jumpTime--;
        if (player.jumpTime === 0) {
            player.isJumping = false;
            shockwaves.push({ x: player.x, y: player.y, r: 10, op: 1 });
        }
    }

    // 4. Combat & Enemies
    combat.updateWeapons(player, enemies, time);
    combat.updateProjectiles(enemies, arenaSize);

    enemies.forEach(en => {
        const dx = player.x - en.x;
        const dy = player.y - en.y;
        const d = Math.hypot(dx, dy);
        en.x += (dx / d) * en.speed;
        en.y += (dy / d) * en.speed;

        // Player damage
        if (d < 25 && !player.isJumping) {
            player.hp -= 0.01; 
            if (player.hp <= 0) location.reload();
        }
    });

    // 5. Cleanup & XP
    enemies = enemies.filter(en => {
        if (en.hp <= 0) { gems.push({ x: en.x, y: en.y }); return false; }
        return true;
    });

    if (enemies.length === 0) showRoomSelection();
}

function draw() {
    ctx.fillStyle = '#050208';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Arena
    ctx.strokeStyle = '#331144';
    ctx.strokeRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);

    // Entities
    ctx.font = '20px serif';
    gems.forEach(g => ctx.fillText('💎', g.x - 8, g.y + 8));
    enemies.forEach(en => ctx.fillText(en.type === 'archer' ? '🏹' : '🧟', en.x - 12, en.y + 12));

    combat.projectiles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    shockwaves.forEach((sw, i) => {
        ctx.strokeStyle = `rgba(0, 255, 204, ${sw.op})`;
        ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2); ctx.stroke();
        sw.r += 5; sw.op -= 0.02;
        if (sw.op <= 0) shockwaves.splice(i, 1);
    });

    // Player
    ctx.font = (player.isJumping ? 45 : 32) + 'px serif';
    ctx.fillText('🧛', player.x - 16, player.y + 12);

    ctx.restore();

    // HUD
    document.getElementById('hud').innerText = `Floor: ${spireMap.currentFloorIndex + 1} | HP: ${Math.ceil(player.hp)}`;
}

function ticker(time) {
    update(time);
    draw();
    requestAnimationFrame(ticker);
}

spawnWave(currentWave);
requestAnimationFrame(ticker);
