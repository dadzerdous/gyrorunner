import { connectNet, sendMove, sendHit, remoteEnemies, remotePlayers, myId } from "./net.js";
import { Player } from './entities.js';
import { InputHandler } from './input.js';
import { CombatSystem, AbilitySystem } from './systems.js';
import { MapSystem } from './map.js';

// KEEP THIS: This starts the WebSocket connection
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
let gems = [], shockwaves = [];
let hazards = [];

function generateHazards() {
    hazards = [];
    const numHazards = 8;
    for (let i = 0; i < numHazards; i++) {
        hazards.push({
            // Align to the 50px grid squares
            x: (Math.floor(Math.random() * (arenaSize * 2 / 50)) * 50) - arenaSize,
            y: (Math.floor(Math.random() * (arenaSize * 2 / 50)) * 50) - arenaSize,
            type: Math.random() > 0.5 ? 'BARRIER' : 'TRAP'
        });
    }
}
window.selectElement = (type) => {
    player.element = type;
    if (type === 'fire') { 
        player.weapons[0].damage = 4; 
        player.weapons[0].color = 'orange'; 
    }
    if (type === 'water') { 
        player.maxHp = 20; player.hp = 20; 
        player.weapons[0].color = 'cyan'; 
    }
    if (type === 'earth') { 
        player.speed = 2.5; player.armor = 2; 
        player.weapons[0].color = '#8B4513'; 
    }
    if (type === 'wind') { 
        player.speed = 5; player.weapons[0].fireRate = 500; 
        player.weapons[0].color = '#ADFF2F'; 
    }
    
    document.getElementById('char-select').style.display = 'none';
    generateHazards(); 
    gameState = 'WAVE'; 
};
// Simplified: We don't spawn enemies locally anymore; the server does
function startWaveUI() {
    gameState = 'WAVE';
    document.getElementById('room-menu').style.display = 'none';
}

function update(time) {
    if (gameState !== 'WAVE') return;

    if (player.skills.jump.cooldown > 0) player.skills.jump.cooldown--;
    if (player.skills.dash.cooldown > 0) player.skills.dash.cooldown--;

    const cmd = input.consumeCommand();
    AbilitySystem.resolveCommand(cmd, player);

    const move = input.getMovement();
    player.currentDir = move;
    
    // Preliminary move
    player.x += move.x * player.speed;
    player.y += move.y * player.speed;

    // --- HAZARD COLLISIONS ---
    hazards.forEach(h => {
        // Check if player is inside the 50x50 grid square of the hazard
        if (player.x > h.x && player.x < h.x + 50 && player.y > h.y && player.y < h.y + 50) {
            if (h.type === 'BARRIER') {
                // If it's a barrier, push the player back (prevent movement)
                player.x -= move.x * player.speed;
                player.y -= move.y * player.speed;
            } else if (h.type === 'TRAP' && !player.isJumping) {
                // If it's a trap, take damage over time
                player.hp -= 0.08; 
            }
        }
    });

    sendMove(player.x, player.y);

    player.x = Math.max(-arenaSize, Math.min(arenaSize, player.x));
    player.y = Math.max(-arenaSize, Math.min(arenaSize, player.y));

    if (player.isJumping) {
        player.jumpTime--;
        if (player.jumpTime === 0) { 
            player.isJumping = false; 
            shockwaves.push({ x: player.x, y: player.y, r: 10, op: 1 }); 
        }
    }

    combat.updateWeapons(player, remoteEnemies, time);
    
    for (let i = combat.projectiles.length - 1; i >= 0; i--) {
        let p = combat.projectiles[i];
        p.x += p.vx;
        p.y += p.vy;

        remoteEnemies.forEach(en => {
            if (Math.hypot(p.x - en.x, p.y - en.y) < 25) {
                sendHit(en.id, p.damage);
                combat.projectiles.splice(i, 1);
            }
        });

        if (p && (Math.abs(p.x) > arenaSize + 100 || Math.abs(p.y) > arenaSize + 100)) {
            combat.projectiles.splice(i, 1);
        }
    }

    remoteEnemies.forEach(en => {
        const d = Math.hypot(player.x - en.x, player.y - en.y);
        if (d < 25 && !player.isJumping) player.hp -= 0.05;
    });
}

function draw() {
    ctx.fillStyle = '#050208'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Arena Grid
    ctx.strokeStyle = '#2a1b4d'; 
    for (let i = -arenaSize; i <= arenaSize; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, -arenaSize); ctx.lineTo(i, arenaSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-arenaSize, i); ctx.lineTo(arenaSize, i); ctx.stroke();
    }

    // --- DRAW HAZARDS ---
    hazards.forEach(h => {
        if (h.type === 'BARRIER') {
            ctx.fillStyle = '#3a3a4d'; // Dark stone color
            ctx.fillRect(h.x + 2, h.y + 2, 46, 46); // Slightly smaller for border look
            ctx.strokeStyle = '#555';
            ctx.strokeRect(h.x + 2, h.y + 2, 46, 46);
        } else if (h.type === 'TRAP') {
            ctx.fillStyle = 'rgba(255, 68, 0, 0.3)'; // Glowing lava
            ctx.fillRect(h.x, h.y, 50, 50);
            ctx.font = '20px serif';
            ctx.fillText('🔥', h.x + 25, h.y + 35);
        }
    });

    ctx.strokeStyle = '#ff0044'; 
    ctx.strokeRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);

    remoteEnemies.forEach(en => {
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.fillText(en.type === 'archer' ? '🏹' : '🧟', en.x, en.y + 10);
        ctx.fillStyle = 'red';
        ctx.fillRect(en.x - 15, en.y - 25, 30 * (en.hp / 3), 4);
    });

    combat.projectiles.forEach(p => {
        ctx.fillStyle = p.color || '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    Object.entries(remotePlayers).forEach(([id, p]) => {
        if (!myId || id === myId) return; 
        ctx.font = "28px serif";
        ctx.fillText("🧙", p.x, p.y + 10);
    });

    let scale = player.isJumping ? 1.6 : 1;
    ctx.font = (32 * scale) + 'px serif';
    ctx.fillText('🧛', player.x, player.y + 12);

    ctx.restore();

    ctx.fillStyle = '#00ffcc'; 
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillText(`HP: ${Math.max(0, Math.ceil(player.hp))} | Gems: ${player.gems || 0}`, 20, 40);
}

function ticker(time) { update(time); draw(); requestAnimationFrame(ticker); }
startWaveUI();
requestAnimationFrame(ticker);
