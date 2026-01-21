import { connectNet, sendMove, sendHit, sendReady, remoteEnemies, remotePlayers, portal, serverPhase, myId } from "./net.js";
import { Player } from './entities.js';
import { InputHandler } from './input.js';
import { drawHUD, drawTicker, drawOverlayMessage } from './ui.js';
import { AbilitySystem } from './systems.js';
import { MapSystem } from './map.js';

// --- SETUP ---
connectNet();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth; canvas.height = window.innerHeight;

const input = new InputHandler();
const player = new Player();
const combat = new CombatSystem();import { connectNet, sendMove, sendHit, sendReady, remoteEnemies, remotePlayers, portal, serverPhase, myId } from "./net.js";
import { Player } from './entities.js';
import { InputHandler } from './input.js';
import { CombatSystem, AbilitySystem } from './systems.js';
import { MapSystem } from './map.js';
import { drawHUD, drawTicker, drawOverlayMessage, drawHubZones } from './ui.js';

// --- SETUP ---
connectNet();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth; canvas.height = window.innerHeight;

const input = new InputHandler();
const player = new Player();
const combat = new CombatSystem();

let gameState = 'START'; 
let arenaSize = 450;
let shockwaves = [];
let hazards = [];
let tickerMsg = { text: "", x: canvas.width }; 
let currentMessage = { title: "", body: "" };

// --- SELECTION LOGIC ---
window.selectElement = (emoji, type) => {
    player.avatar = emoji; 
    player.element = 'fire'; 
    
    if (type === 'blood') { player.weapons[0].color = '#ff0000'; player.weapons[0].damage = 5; } 
    else if (type === 'plague') { player.weapons[0].color = '#00ff00'; player.weapons[0].fireRate = 800; } 
    else { player.weapons[0].color = 'orange'; }
    
    document.getElementById('char-select').style.display = 'none';
    hazards = MapSystem.generateHazards(arenaSize); // Using map.js
    
    showAnnouncement("ASCENSION BEGINS", "Reach Floor 10 to survive.");
};

// --- MESSAGE SYSTEM ---
function showAnnouncement(title, body) {
    currentMessage = { title, body };
    gameState = 'MESSAGE';
}

function dismissMessage() {
    if (gameState === 'MESSAGE') {
        gameState = 'WAVE';
        window.triggerTicker("SURVIVE THE WAVES");
    }
}

window.triggerTicker = (text) => {
    tickerMsg.text = text; tickerMsg.x = canvas.width; 
};

// --- MAIN LOOP ---
function update(time) {
    if (gameState === 'MESSAGE' || gameState === 'START') return;

    // Ticker
    if (tickerMsg.text) {
        tickerMsg.x -= 3; 
        if (tickerMsg.x < -1000) tickerMsg.text = ""; 
    }

    // Level Up
    if (player.xp >= player.xpToNext) levelUp();

    // Cooldowns & Input
    Object.values(player.skills).forEach(s => { if (s.cooldown > 0) s.cooldown--; });
    
    const cmd = input.consumeCommand();
    AbilitySystem.resolveCommand(cmd, player); // Standard moves
    
    // Trigger Class Skill (Refactored to systems.js)
    if (cmd === 'UP_SWIPE' && player.skills.fireBurst.cooldown <= 0) {
        AbilitySystem.triggerSkill(player, remoteEnemies, shockwaves, sendHit);
    }

    const move = input.getMovement();
    if (move.x !== 0 || move.y !== 0) player.currentDir = move;
    
    let nextX = player.x + move.x * player.speed;
    let nextY = player.y + move.y * player.speed;
    const pRadius = 20; 

    // HUB vs WAVE Logic
    if (serverPhase === 'HUB') {
        checkHubInteractions(player.x, player.y);
        if (player.x > arenaSize - 50) {
            sendReady(true); window.triggerTicker("WAITING FOR TEAM...");
        } else {
            sendReady(false);
        }
        player.x = nextX; player.y = nextY;
    } else { 
        // Wave Collisions
        let hitBarrier = false;
        hazards.forEach(h => {
            if (nextX + pRadius > h.x && nextX - pRadius < h.x + 50 &&
                nextY + pRadius > h.y && nextY - pRadius < h.y + 50) {
                if (h.type === 'BARRIER') hitBarrier = true;
                else if (h.type === 'TRAP' && !player.isJumping) player.hp -= 0.1;
            }
        });
        if (!hitBarrier) { player.x = nextX; player.y = nextY; }

        if (portal) {
            if (Math.hypot(player.x - portal.x, player.y - portal.y) < 50) {
                 sendReady(true); window.triggerTicker("WAITING AT PORTAL...");
            } else { sendReady(false); }
        }
    }

    // Boundaries & Sync
    player.x = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.x));
    player.y = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.y));
    sendMove(player.x, player.y);

    // Combat
    if (serverPhase === 'WAVE') combat.updateWeapons(player, remoteEnemies, time);
    
    for (let i = combat.projectiles.length - 1; i >= 0; i--) {
        let p = combat.projectiles[i];
        p.x += p.vx; p.y += p.vy;
        
        if (serverPhase === 'WAVE') {
            remoteEnemies.forEach(en => {
                if (Math.hypot(p.x - en.x, p.y - en.y) < 25) {
                    sendHit(en.id, p.damage);
                    combat.projectiles.splice(i, 1);
                    if (en.hp <= p.damage) player.xp += 20; 
                }
            });
        }
        if (Math.abs(p.x) > arenaSize + 100) combat.projectiles.splice(i, 1);
    }
}

function checkHubInteractions(x, y) {
    if (Math.hypot(x - (-200), y - 0) < 50) window.triggerTicker("🛒 SHOP ZONE (Coming Soon)");
    if (Math.hypot(x - 0, y - (-200)) < 50) window.triggerTicker("💪 TRAINER ZONE (Coming Soon)");
}

function levelUp() {
    player.level++; player.xp = 0; player.xpToNext *= 1.2; player.skillPoints += 1;
    window.triggerTicker(`⚡ LEVEL UP! NOW LEVEL ${player.level} ⚡`);
    // Simple unlock check
    if (player.level === 3) window.triggerTicker("UNLOCKED: FLAME DASH (Swipe Right)");
    if (player.level === 5) { player.keystones.chainExplosions = true; window.triggerTicker("KEYSTONE ACTIVE"); }
}

// --- DRAW LOOP ---
function draw() {
    ctx.fillStyle = '#050208'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Grid
    ctx.strokeStyle = '#2a1b4d'; 
    for (let i = -arenaSize; i <= arenaSize; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, -arenaSize); ctx.lineTo(i, arenaSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-arenaSize, i); ctx.lineTo(arenaSize, i); ctx.stroke();
    }

    // Shockwaves
    shockwaves.forEach(sw => {
        sw.r += 5; sw.alpha -= 0.05;
        ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.fillStyle = sw.color || 'orange'; ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.fill(); ctx.globalAlpha = 1.0;
    });
    shockwaves = shockwaves.filter(sw => sw.alpha > 0);

    // Phase Drawing
    if (serverPhase === 'HUB') {
        drawHubZones(ctx, arenaSize); // Using ui.js
    } else {
        hazards.forEach(h => {
            if (h.type === 'BARRIER') {
                ctx.fillStyle = '#3a3a4d'; ctx.fillRect(h.x + 2, h.y + 2, 46, 46);
                ctx.strokeStyle = '#555'; ctx.strokeRect(h.x + 2, h.y + 2, 46, 46);
            } else if (h.type === 'TRAP') {
                ctx.fillStyle = 'rgba(255, 68, 0, 0.3)'; ctx.fillRect(h.x, h.y, 50, 50);
                ctx.fillText('🔥', h.x + 25, h.y + 35);
            }
        });
        if (portal) {
            ctx.shadowBlur = 20; ctx.shadowColor = 'cyan';
            ctx.fillStyle = '#00ffff'; ctx.beginPath(); ctx.arc(portal.x, portal.y, 40, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
        }
        remoteEnemies.forEach(en => {
            ctx.font = '28px serif'; ctx.textAlign = 'center';
            ctx.fillText(en.type === 'archer' ? '🏹' : '🧟', en.x, en.y + 10);
            ctx.fillStyle = 'red'; ctx.fillRect(en.x - 15, en.y - 25, 30 * (en.hp / 3), 4);
        });
    }

    // Border
    ctx.lineWidth = 5; ctx.strokeStyle = '#ff0044'; 
    ctx.shadowBlur = 20; ctx.shadowColor = '#ff0044';
    ctx.strokeRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);
    ctx.shadowBlur = 0; ctx.lineWidth = 1;

    // Entities
    combat.projectiles.forEach(p => {
        ctx.fillStyle = p.color || '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });
    Object.entries(remotePlayers).forEach(([id, p]) => {
        if (!myId || id === myId) return; 
        ctx.font = "28px serif"; ctx.fillText("🧙", p.x, p.y + 10);
        ctx.font = "12px monospace"; ctx.fillStyle = "white"; ctx.fillText(id.substring(0, 4), p.x, p.y - 15);
    });

    let scale = player.isJumping ? 1.6 : 1;
    ctx.font = (32 * scale) + 'px serif';
    ctx.fillText(player.avatar || '🧛', player.x, player.y + 12);
    ctx.restore();

    // UI (Refactored to ui.js)
    drawHUD(ctx, canvas, player);
    drawTicker(ctx, canvas, tickerMsg);
    if (gameState === 'MESSAGE') drawOverlayMessage(ctx, canvas, currentMessage);
}

function ticker(time) { update(time); draw(); requestAnimationFrame(ticker); }
requestAnimationFrame(ticker);

// --- INPUT LISTENERS ---
window.addEventListener('keydown', dismissMessage);
window.addEventListener('mousedown', dismissMessage); // Mouse click to dismiss
window.addEventListener('touchstart', dismissMessage); // Phone tap to dismiss

let gameState = 'START'; // Start in menu
let arenaSize = 450;
let shockwaves = [];
let hazards = [];
let tickerMsg = { text: "", x: canvas.width }; 
let currentMessage = { title: "", body: "" }; // Holds the pop-up text

// --- SELECTION LOGIC ---
window.selectElement = (emoji, type) => {
    player.avatar = emoji; 
    player.element = 'fire'; 
    
    // Custom Theming
    if (type === 'blood') {
        player.weapons[0].color = '#ff0000'; 
        player.weapons[0].damage = 5; 
    } else if (type === 'plague') {
        player.weapons[0].color = '#00ff00'; 
        player.weapons[0].fireRate = 800; 
    } else {
        player.weapons[0].color = 'orange'; 
    }
    
    document.getElementById('char-select').style.display = 'none';
    generateHazards();
    
    // Show the intro message
    showAnnouncement("ASCENSION BEGINS", "Reach Floor 10 to survive.");
};

// --- MESSAGE SYSTEM (Pop-ups) ---
function showAnnouncement(title, body) {
    currentMessage = { title, body };
    gameState = 'MESSAGE'; // Pauses the game loop visually
}

function dismissMessage() {
    if (gameState === 'MESSAGE') {
        gameState = 'WAVE'; // Unpause / Start Game
        window.triggerTicker("SURVIVE THE WAVES");
    }
}

// --- SCROLLING TICKER HELPER ---
window.triggerTicker = (text) => {
    tickerMsg.text = text;
    tickerMsg.x = canvas.width; 
};

// --- HAZARD GENERATION ---
function generateHazards() {
    hazards = [];
    const numHazards = 8;
    for (let i = 0; i < numHazards; i++) {
        hazards.push({
            x: (Math.floor(Math.random() * (arenaSize * 2 / 50)) * 50) - arenaSize,
            y: (Math.floor(Math.random() * (arenaSize * 2 / 50)) * 50) - arenaSize,
            type: Math.random() > 0.5 ? 'BARRIER' : 'TRAP'
        });
    }
}

// --- MAIN UPDATE LOOP ---
function update(time) {
    // If we are looking at a message, do not update game logic
    if (gameState === 'MESSAGE' || gameState === 'START') return;

    // 1. Ticker Logic
    if (tickerMsg.text) {
        tickerMsg.x -= 3; 
        if (tickerMsg.x < -1000) tickerMsg.text = ""; 
    }

    // 2. Level Up Check (Non-pausing)
    if (player.xp >= player.xpToNext) {
        levelUp();
    }

    // 3. Cooldowns
    Object.values(player.skills).forEach(s => { if (s.cooldown > 0) s.cooldown--; });

    // 4. Input Processing
    const cmd = input.consumeCommand();
    // Resolve Skills
    if (cmd === 'UP_SWIPE' && player.skills.fireBurst.cooldown <= 0) triggerFireBurst(); 

    const move = input.getMovement();
    
    if (move.x !== 0 || move.y !== 0) player.currentDir = move;
    
    let nextX = player.x + move.x * player.speed;
    let nextY = player.y + move.y * player.speed;
    const pRadius = 20; // Hitbox Radius

    // 5. PHASE LOGIC (Hub vs Wave)
    if (serverPhase === 'HUB') {
        checkHubInteractions(player.x, player.y);
        
        // Exit Logic (Walk to Right Edge)
        if (player.x > arenaSize - 50) {
            sendReady(true); 
            window.triggerTicker("WAITING FOR TEAM...");
        } else {
            sendReady(false);
        }

        player.x = nextX;
        player.y = nextY;

    } else { 
        // WAVE LOGIC
        let hitBarrier = false;
        hazards.forEach(h => {
            if (nextX + pRadius > h.x && nextX - pRadius < h.x + 50 &&
                nextY + pRadius > h.y && nextY - pRadius < h.y + 50) {
                if (h.type === 'BARRIER') hitBarrier = true;
                else if (h.type === 'TRAP' && !player.isJumping) player.hp -= 0.1;
            }
        });

        if (!hitBarrier) {
            player.x = nextX;
            player.y = nextY;
        }

        if (portal) {
            if (Math.hypot(player.x - portal.x, player.y - portal.y) < 50) {
                 sendReady(true);
                 window.triggerTicker("WAITING AT PORTAL...");
            } else {
                 sendReady(false);
            }
        }
    }

    // 6. Boundary Clamp & Sync
    player.x = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.x));
    player.y = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.y));
    sendMove(player.x, player.y);

    // 7. Combat (Only in Wave)
    if (serverPhase === 'WAVE') {
        combat.updateWeapons(player, remoteEnemies, time);
    }
    
    for (let i = combat.projectiles.length - 1; i >= 0; i--) {
        let p = combat.projectiles[i];
        p.x += p.vx;
        p.y += p.vy;
        
        if (serverPhase === 'WAVE') {
            remoteEnemies.forEach(en => {
                if (Math.hypot(p.x - en.x, p.y - en.y) < 25) {
                    sendHit(en.id, p.damage);
                    combat.projectiles.splice(i, 1);
                    if (en.hp <= p.damage) player.xp += 20; 
                }
            });
        }
        if (Math.abs(p.x) > arenaSize + 100) combat.projectiles.splice(i, 1);
    }
}

function checkHubInteractions(x, y) {
    if (Math.hypot(x - (-200), y - 0) < 50) window.triggerTicker("🛒 SHOP ZONE (Coming Soon)");
    if (Math.hypot(x - 0, y - (-200)) < 50) window.triggerTicker("💪 TRAINER ZONE (Coming Soon)");
}

function levelUp() {
    player.level++;
    player.xp = 0;
    player.xpToNext *= 1.2;
    player.skillPoints += 1;
    window.triggerTicker(`⚡ LEVEL UP! NOW LEVEL ${player.level} ⚡`);
    checkUnlocks();
}

// --- DRAW LOOP ---
function draw() {
    ctx.fillStyle = '#050208'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // 1. Grid
    ctx.strokeStyle = '#2a1b4d'; 
    for (let i = -arenaSize; i <= arenaSize; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, -arenaSize); ctx.lineTo(i, arenaSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-arenaSize, i); ctx.lineTo(arenaSize, i); ctx.stroke();
    }

    // 2. Shockwaves
    shockwaves.forEach(sw => {
        sw.r += 5; sw.alpha -= 0.05;
        ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.fillStyle = sw.color || 'orange';
        ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.fill(); ctx.globalAlpha = 1.0;
    });
    shockwaves = shockwaves.filter(sw => sw.alpha > 0);

    // 3. Phase Specific
    if (serverPhase === 'HUB') {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; ctx.fillRect(-225, -25, 50, 50);
        ctx.fillStyle = 'white'; ctx.fillText("🛒", -210, 10);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'; ctx.fillRect(-25, -225, 50, 50);
        ctx.fillText("💪", -10, -190);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.fillRect(arenaSize - 100, -arenaSize, 100, arenaSize*2);
        ctx.fillText("EXIT ➡", arenaSize - 250, 0);
    } else {
        hazards.forEach(h => {
            if (h.type === 'BARRIER') {
                ctx.fillStyle = '#3a3a4d'; ctx.fillRect(h.x + 2, h.y + 2, 46, 46);
                ctx.strokeStyle = '#555'; ctx.strokeRect(h.x + 2, h.y + 2, 46, 46);
            } else if (h.type === 'TRAP') {
                ctx.fillStyle = 'rgba(255, 68, 0, 0.3)'; ctx.fillRect(h.x, h.y, 50, 50);
                ctx.fillText('🔥', h.x + 25, h.y + 35);
            }
        });
        
        if (portal) {
            ctx.shadowBlur = 20; ctx.shadowColor = 'cyan';
            ctx.fillStyle = '#00ffff';
            ctx.beginPath(); ctx.arc(portal.x, portal.y, 40, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.font = "20px monospace";
            ctx.fillText("PORTAL", portal.x - 30, portal.y + 5);
            ctx.shadowBlur = 0;
        }

        remoteEnemies.forEach(en => {
            ctx.font = '28px serif'; ctx.textAlign = 'center';
            ctx.fillText(en.type === 'archer' ? '🏹' : '🧟', en.x, en.y + 10);
            ctx.fillStyle = 'red'; ctx.fillRect(en.x - 15, en.y - 25, 30 * (en.hp / 3), 4);
        });
    }

    // 4. Border
    ctx.lineWidth = 5; ctx.strokeStyle = '#ff0044'; 
    ctx.shadowBlur = 20; ctx.shadowColor = '#ff0044';
    ctx.strokeRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);
    ctx.shadowBlur = 0; ctx.lineWidth = 1;

    // 5. Entities
    combat.projectiles.forEach(p => {
        ctx.fillStyle = p.color || '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    Object.entries(remotePlayers).forEach(([id, p]) => {
        if (!myId || id === myId) return; 
        ctx.font = "28px serif"; ctx.fillText("🧙", p.x, p.y + 10);
        ctx.font = "12px monospace"; ctx.fillStyle = "white";
        ctx.fillText(id.substring(0, 4), p.x, p.y - 15);
    });

    // Local Player
    let scale = player.isJumping ? 1.6 : 1;
    ctx.font = (32 * scale) + 'px serif';
    ctx.fillText(player.avatar || '🧛', player.x, player.y + 12);

    ctx.restore();

    // 6. UI Layers
    drawModernUI();
    
    // Draw Ticker
    if (tickerMsg.text) {
        ctx.fillStyle = '#ffcc00'; ctx.font = "bold 24px monospace";
        ctx.fillText(tickerMsg.text, tickerMsg.x, canvas.height - 80);
    }
    
    // Draw Pop-up Message
    if (gameState === 'MESSAGE') {
        drawOverlayMessage();
    }
}

// --- UI HELPERS ---
function drawModernUI() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(20, canvas.height - 40, 200, 20);
    ctx.fillStyle = '#ff0044'; ctx.fillRect(20, canvas.height - 40, 200 * (player.hp / player.maxHp), 20);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(20, 20, canvas.width - 40, 8);
    ctx.fillStyle = '#ffcc00'; ctx.fillRect(20, 20, (canvas.width - 40) * (player.xp / player.xpToNext), 8);
    ctx.fillStyle = '#00ffcc'; ctx.font = "bold 18px monospace"; ctx.textAlign = "left";
    ctx.fillText(`LVL ${player.level} | ${player.avatar || '?'} FIRE | 💰 ${player.gold}`, 20, 50);
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
    ctx.fillText("TAP OR CLICK TO CONTINUE", canvas.width / 2, canvas.height / 2 + 100);
}

function checkUnlocks() {
    if (player.level >= 3 && !player.skills.flameDash.unlocked) {
        player.skills.flameDash.unlocked = true;
        window.triggerTicker("UNLOCKED: FLAME DASH (Swipe Right)");
    }
    if (player.level === 5) {
         window.triggerTicker("KEYSTONE: CHAIN EXPLOSIONS ACTIVE");
         player.keystones.chainExplosions = true;
    }
}

function triggerFireBurst() {
    shockwaves.push({ 
        x: player.x, y: player.y, r: 10, maxR: 100, alpha: 1,
        color: player.weapons[0].color 
    });
    remoteEnemies.forEach(en => {
        if (Math.hypot(en.x - player.x, en.y - player.y) < 100) {
            sendHit(en.id, 2);
        }
    });
    player.skills.fireBurst.cooldown = player.skills.fireBurst.maxCD;
}

function ticker(time) { update(time); draw(); requestAnimationFrame(ticker); }
requestAnimationFrame(ticker);

// --- INPUT LISTENERS (THIS FIXES YOUR CLICK ISSUE) ---
window.addEventListener('keydown', dismissMessage);
window.addEventListener('mousedown', dismissMessage); // Mouse click to dismiss
window.addEventListener('touchstart', dismissMessage); // Phone tap to dismiss
