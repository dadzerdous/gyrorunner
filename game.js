import { connectNet, sendMove, sendHit, remoteEnemies, remotePlayers, myId } from "./net.js";
import { Player } from './entities.js';
import { InputHandler } from './input.js';
import { CombatSystem, AbilitySystem } from './systems.js';
import { MapSystem } from './map.js';
let currentMessage = { title: "", body: "" };
// KEEP THIS: This starts the WebSocket connection
window.selectElement = (emoji) => {
    player.avatar = emoji; // Store the emoji for drawing
    player.element = 'fire'; // Force Fire Class skills
    
    // Assign Fire Class Starting Stats
    player.weapons[0].damage = 4;
    player.weapons[0].color = 'orange';
    
    document.getElementById('char-select').style.display = 'none';
    generateHazards();
    
    // Show a "New Game" pop-up instead of starting instantly
    window.showAnnouncement("ASCENSION BEGINS", "Reach Floor 10 to survive the inferno.");
};

window.showAnnouncement = (title, body) => {
    currentMessage = { title, body };
    gameState = 'MESSAGE';
};

// Listen for any key to progress past announcements
window.addEventListener('keydown', e => {
    if (gameState === 'MESSAGE') {
        gameState = 'WAVE';
    }
});
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

    // 1. Skill Cooldowns
    Object.values(player.skills).forEach(s => { if (s.cooldown > 0) s.cooldown--; });

    // 2. Input & Movement
    const cmd = input.consumeCommand();
    const move = input.getMovement();
    player.currentDir = move;
    
    // Resolve Fire Skills
    if (cmd === 'UP_SWIPE' && player.skills.fireBurst.cooldown <= 0) {
        triggerFireBurst(); 
    }

    player.x += move.x * player.speed;
    player.y += move.y * player.speed;

    // 3. Grid & Hazard Collisions
    hazards.forEach(h => {
        if (player.x > h.x && player.x < h.x + 50 && player.y > h.y && player.y < h.y + 50) {
            if (h.type === 'BARRIER') {
                player.x -= move.x * player.speed;
                player.y -= move.y * player.speed;
            } else if (h.type === 'TRAP' && !player.isJumping) {
                player.hp -= 0.1; // Lava hurts!
            }
        }
    });

    sendMove(player.x, player.y);

    // 4. Combat & Hits
    combat.updateWeapons(player, remoteEnemies, time);
    
    // Handle Projectile Hits + XP Gain
    for (let i = combat.projectiles.length - 1; i >= 0; i--) {
        let p = combat.projectiles[i];
        p.x += p.vx;
        p.y += p.vy;

        remoteEnemies.forEach(en => {
            if (Math.hypot(p.x - en.x, p.y - en.y) < 25) {
                sendHit(en.id, p.damage);
                combat.projectiles.splice(i, 1);
                
                // If enemy dies (HP check would ideally be server-side, 
                // but we simulate XP gain here for responsiveness)
                if (en.hp <= p.damage) {
                    player.xp += 20; 
                    if (player.xp >= player.xpToNext) levelUp();
                }
            }
        });
    }
}

function levelUp() {
    player.level++;
    player.xp = 0;
    player.xpToNext *= 1.2;
    player.skillPoints += 1;
    // Trigger Level-specific unlocks (Level 3 Dash, Level 6 Guard, etc.)
    checkUnlocks();
}

function draw() {
    ctx.fillStyle = '#050208'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // 1. Arena & Hazards
    ctx.strokeStyle = '#2a1b4d'; 
    for (let i = -arenaSize; i <= arenaSize; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, -arenaSize); ctx.lineTo(i, arenaSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-arenaSize, i); ctx.lineTo(arenaSize, i); ctx.stroke();
    }

    hazards.forEach(h => {
        if (h.type === 'BARRIER') {
            ctx.fillStyle = '#3a3a4d';
            ctx.fillRect(h.x + 2, h.y + 2, 46, 46);
            ctx.strokeStyle = '#555';
            ctx.strokeRect(h.x + 2, h.y + 2, 46, 46);
        } else if (h.type === 'TRAP') {
            ctx.fillStyle = 'rgba(255, 68, 0, 0.3)';
            ctx.fillRect(h.x, h.y, 50, 50);
            ctx.fillText('🔥', h.x + 25, h.y + 35);
        }
    });

    ctx.strokeStyle = '#ff0044'; 
    ctx.strokeRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);

    // 2. Enemies & Projectiles
    remoteEnemies.forEach(en => {
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.fillText(en.type === 'archer' ? '🏹' : '🧟', en.x, en.y + 10);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(en.x - 15, en.y - 25, 30, 4);
        ctx.fillStyle = 'red';
        ctx.fillRect(en.x - 15, en.y - 25, 30 * (en.hp / 3), 4);
    });

    combat.projectiles.forEach(p => {
        ctx.fillStyle = p.color || '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    // 3. Remote Players & Local Player
    Object.entries(remotePlayers).forEach(([id, p]) => {
        if (!myId || id === myId) return; 
        ctx.font = "28px serif";
        ctx.fillText("🧙", p.x, p.y + 10);
        ctx.font = "12px monospace";
        ctx.fillStyle = "white";
        ctx.fillText(`Player: ${id.substring(0, 4)}`, p.x, p.y - 15);
    });

    let scale = player.isJumping ? 1.6 : 1;
    ctx.font = (32 * scale) + 'px serif';
    ctx.fillText(player.avatar || '🧛', player.x, player.y + 12); // Use chosen emoji

    ctx.restore();

    // 4. Modern Player UI
    drawModernUI();

    // 5. Progress Overlay
    if (gameState === 'MESSAGE') {
        drawOverlayMessage();
    }
}
function ticker(time) { update(time); draw(); requestAnimationFrame(ticker); }
startWaveUI();
requestAnimationFrame(ticker);

function drawModernUI() {
    // Health Bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(20, canvas.height - 40, 200, 20);
    ctx.fillStyle = '#ff0044';
    ctx.fillRect(20, canvas.height - 40, 200 * (player.hp / player.maxHp), 20);
    
    // XP Bar
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(20, 20, canvas.width - 40, 8);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(20, 20, (canvas.width - 40) * (player.xp / player.xpToNext), 8);

    // Text Stats
    ctx.fillStyle = '#00ffcc';
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`LVL ${player.level} | ${player.avatar} FIRE | 💰 ${player.gold}`, 20, 50);
}

function drawOverlayMessage() {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffcc00';
    ctx.textAlign = 'center';
    ctx.font = "bold 40px monospace";
    ctx.fillText(currentMessage.title, canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillStyle = 'white';
    ctx.font = "20px monospace";
    ctx.fillText(currentMessage.body, canvas.width / 2, canvas.height / 2 + 30);
    ctx.fillStyle = '#00ffcc';
    ctx.fillText("Press ANY KEY to Progress", canvas.width / 2, canvas.height / 2 + 100);
}
