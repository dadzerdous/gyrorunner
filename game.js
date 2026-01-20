import { connectNet, sendMove, remotePlayers, myId } from "./net.js";
import { Player, Enemy } from './entities.js';
import { InputHandler } from './input.js';
import { CombatSystem, AbilitySystem } from './systems.js';
import { MapSystem } from './map.js';

connectNet();


const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth; canvas.height = window.innerHeight;

const input = new InputHandler();
const player = new Player();
const combat = new CombatSystem();
const spireMap = new MapSystem(15);

let gameState = 'WAVE';
let arenaSize = 450;
let enemies = [], gems = [], shockwaves = [];

function spawnWave(waveNum) {
    enemies = []; gems = []; shockwaves = [];
    const count = 5 + (waveNum * 2);
    for (let i = 0; i < count; i++) {
        enemies.push(new Enemy(i % 7 === 0 ? 'archer' : 'goblin', arenaSize));
    }
    gameState = 'WAVE';
    document.getElementById('room-menu').style.display = 'none';
}

function showRoomSelection() {
    gameState = 'MAP';
    const menu = document.getElementById('room-menu');
    const container = document.getElementById('room-choices');
    menu.style.display = 'flex';
    container.innerHTML = "";
    
    spireMap.getNextOptions().forEach(type => {
        const btn = document.createElement('button');
        btn.innerHTML = type;
        btn.onclick = () => window.startNextWave(type);
        container.appendChild(btn);
    });
}

window.startNextWave = (type) => {
    if (type === 'Rest') { player.hp = Math.min(player.maxHp, player.hp + 5); showRoomSelection(); return; }
    if (type === 'Mystery') { triggerMystery(); return; }
    spawnWave(spireMap.currentFloorIndex + 1);
};

function triggerMystery() {
    // Permanent stat buff example
    player.maxHp += 2; player.hp += 2;
    alert("Mystery Ritual: +2 Max HP!");
    showRoomSelection();
}

function update(time) {
    if (gameState !== 'WAVE') return;

    if (player.skills.jump.cooldown > 0) player.skills.jump.cooldown--;
    if (player.skills.dash.cooldown > 0) player.skills.dash.cooldown--;

    const cmd = input.consumeCommand();
    AbilitySystem.resolveCommand(cmd, player);

const move = input.getMovement();
player.currentDir = move;

player.x += move.x * player.speed;
player.y += move.y * player.speed;

// send movement to server
sendMove(player.x, player.y);



    // SOLID BARRIER BLOCK
    player.x = Math.max(-arenaSize, Math.min(arenaSize, player.x));
    player.y = Math.max(-arenaSize, Math.min(arenaSize, player.y));

    if (player.isJumping) {
        player.jumpTime--;
        if (player.jumpTime === 0) { player.isJumping = false; shockwaves.push({ x: player.x, y: player.y, r: 10, op: 1 }); }
    }

    combat.updateWeapons(player, enemies, time);
    combat.updateProjectiles(enemies, arenaSize);

    enemies.forEach(en => {
        const d = Math.hypot(player.x - en.x, player.y - en.y);
        en.x += ((player.x - en.x)/d) * en.speed;
        en.y += ((player.y - en.y)/d) * en.speed;
        if (d < 25 && !player.isJumping) player.hp -= 0.01;
    });

    enemies = enemies.filter(en => {
        if (en.hp <= 0) { gems.push({ x: en.x, y: en.y }); return false; }
        return true;
    });

    for (let i = gems.length - 1; i >= 0; i--) {
        const g = gems[i];
        const d = Math.hypot(g.x - player.x, g.y - player.y);
        if (d < 150) { g.x += (player.x - g.x)*0.1; g.y += (player.y - g.y)*0.1; }
        if (d < 20) { player.gems++; gems.splice(i, 1); }
    }

    if (enemies.length === 0) showRoomSelection();
}

function draw() {
    ctx.fillStyle = '#050208'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Arena Grid & Boundary
    ctx.strokeStyle = '#2a1b4d'; 
    for (let i = -arenaSize; i <= arenaSize; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, -arenaSize); ctx.lineTo(i, arenaSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-arenaSize, i); ctx.lineTo(arenaSize, i); ctx.stroke();
    }
    ctx.strokeStyle = '#ff0044'; 
    ctx.strokeRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);

    // Draw Synchronized Enemies (from net.js)
    remoteEnemies.forEach(en => {
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.fillText(en.type === 'archer' ? '🏹' : '🧟', en.x, en.y + 10);
    });

    // Draw Local Projectiles
    combat.projectiles.forEach(p => {
        ctx.fillStyle = p.color || '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    // Draw Other Players
    Object.entries(remotePlayers).forEach(([id, p]) => {
        if (!myId || id === myId) return; // Hide self (handled by player object)
        ctx.font = "28px serif";
        ctx.fillText("🧙", p.x, p.y + 10);
    });

    // Draw Local Player
    let scale = player.isJumping ? 1.6 : 1;
    ctx.font = (32 * scale) + 'px serif';
    ctx.fillText('🧛', player.x, player.y + 12);

    ctx.restore();

    // HUD
    ctx.fillStyle = '#00ffcc'; 
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillText(`HP: ${Math.ceil(player.hp)} | Gems: ${player.gems || 0}`, 20, 40);
}

function ticker(time) { update(time); draw(); requestAnimationFrame(ticker); }
spawnWave(1);
requestAnimationFrame(ticker);
