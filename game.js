import { connectNet, sendMove, remotePlayers } from "./net.js";
connectNet();


import { Player, Enemy } from './entities.js';
import { InputHandler } from './input.js';
import { CombatSystem, AbilitySystem } from './systems.js';
import { MapSystem } from './map.js';

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
sendMove(move.x * player.speed, move.y * player.speed);


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
    // 1. Clear the screen with a very dark background
    ctx.fillStyle = '#050208'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // 2. Center the camera on the player
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // 3. Draw Arena Floor Grid (Lightened for visibility)
    ctx.strokeStyle = '#2a1b4d'; 
    ctx.lineWidth = 1;
    for (let i = -arenaSize; i <= arenaSize; i += 50) {
        ctx.beginPath(); 
        ctx.moveTo(i, -arenaSize); 
        ctx.lineTo(i, arenaSize); 
        ctx.stroke();
        
        ctx.beginPath(); 
        ctx.moveTo(-arenaSize, i); 
        ctx.lineTo(arenaSize, i); 
        ctx.stroke();
    }

    // 4. Draw the Solid Red Boundary Barrier
    ctx.strokeStyle = '#ff0044'; 
    ctx.lineWidth = 5;
    ctx.strokeRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);

    // 5. Draw Gems (💎)
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    gems.forEach(g => {
        ctx.fillText('💎', g.x, g.y + 8);
    });

    // 6. Draw Enemies (Melee 🧟 and Archer 🏹)
    enemies.forEach(en => {
        ctx.font = '28px serif';
        ctx.fillText(en.type === 'archer' ? '🏹' : '🧟', en.x, en.y + 10);
    });

    // 7. Draw Player Projectiles (White/Elemental)
    combat.projectiles.forEach(p => {
        ctx.fillStyle = p.color || '#ffffff';
        ctx.beginPath(); 
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); 
        ctx.fill();
    });

    // 8. Draw Active Shockwaves
    shockwaves.forEach((sw) => {
        ctx.strokeStyle = `rgba(0, 255, 204, ${sw.op})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); 
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2); 
        ctx.stroke();
    });

    // 9. Draw the Player (🧛)
    // Scale up during jump to simulate height
    let scale = player.isJumping ? 1.6 : 1;
    ctx.font = (32 * scale) + 'px serif';
    ctx.fillText('🧛', player.x, player.y + 12);

Object.entries(remotePlayers).forEach(([id, p]) => {
  if (id === myId) return; // ← hide your own server echo

  ctx.font = "28px serif";
  ctx.fillText("🧙", p.x, p.y + 10);
});


    ctx.restore();


    // 10. Draw the HUD (Bright Cyan for visibility on black)
    ctx.fillStyle = '#00ffcc'; 
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.textAlign = "left";
    
    // Using a shadow to make it pop even more
    ctx.shadowColor = "black";
    ctx.shadowBlur = 4;
    
    const hudText = `Floor: ${spireMap.currentFloorIndex + 1} | HP: ${Math.ceil(player.hp)} | Gems: ${player.gems}`;
    ctx.fillText(hudText, 20, 40);
    
    // Reset shadow so it doesn't affect other drawings
    ctx.shadowBlur = 0;

    // 11. Draw Joystick UI (If active)
    if (input.joystickActive) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath(); 
        ctx.arc(input.touchStart.x, input.touchStart.y, 50, 0, Math.PI * 2); 
        ctx.stroke();
    }
}
function ticker(time) { update(time); draw(); requestAnimationFrame(ticker); }
spawnWave(1);
requestAnimationFrame(ticker);
