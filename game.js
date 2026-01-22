import { connectNet, disconnectNet, sendMove, sendHit, sendReady, remoteEnemies, remotePlayers, portal, serverPhase, myId } from "./net.js";
import { Player } from './entities.js';
import { InputHandler } from './input.js';
import { CombatSystem, AbilitySystem } from './systems.js';
import { MapSystem } from './map.js';
import { drawHUD, drawTicker, drawOverlayMessage, drawSkillBar, drawPortal, drawQuitButton, skillButtons, quitButton } from './ui.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth; canvas.height = window.innerHeight;

const input = new InputHandler();
const player = new Player();
const combat = new CombatSystem();
const abilitySys = new AbilitySystem(player);

let gameState = 'START'; 
let arenaSize = 450;
let shockwaves = [];
let hazards = [];
let tickerMsg = { text: "", x: canvas.width }; 
let currentMessage = { title: "", body: "" };

// Show Char Select
document.getElementById('char-select').style.display = 'flex';

// --- MENU FUNCTIONS ---
window.selectElement = (emoji, type) => {
    // 1. Load or Create Profile
    const loaded = player.loadProfile();
    
    if (!loaded) {
        player.avatar = emoji; 
        player.element = 'fire'; 
        // Set weapon types
        if (type === 'blood') { player.weapons[0].color = '#ff0000'; player.weapons[0].damage = 5; } 
        else if (type === 'plague') { player.weapons[0].color = '#00ff00'; player.weapons[0].fireRate = 800; } 
        else { player.weapons[0].color = 'orange'; }
    } else {
        player.avatar = emoji; 
    }

    // --- FIX: FORCE UNLOCK ALL ABILITIES ---
    // This makes sure keys 1, 2, 3, 4 work immediately for testing
    player.skills.fireBurst.unlocked = true;
    player.skills.flameDash.unlocked = true;
    player.skills.moltenGuard.unlocked = true;
    player.skills.inferno.unlocked = true;

    // 2. Connect to server
    connectNet(); 

    // 3. Hide Menu & Generate Map
    document.getElementById('char-select').style.display = 'none';
    hazards = MapSystem.generateHazards(arenaSize); 
    
    if (loaded) showAnnouncement("WELCOME BACK", "Stats loaded. Wave progress reset.");
    else showAnnouncement("ASCENSION BEGINS", "Kill enemies to spawn the Portal.");
};

window.buyItem = (type) => {
    if (type === 'potion' && player.gold >= 50) {
        player.gold -= 50; player.hp = Math.min(player.hp + 5, player.maxHp);
        window.triggerTicker("❤️ HEALED!");
    }
    if (type === 'damage' && player.gold >= 100) {
        player.gold -= 100; player.weapons[0].damage += 1;
        window.triggerTicker("⚔️ DAMAGE UPGRADED!");
    }
    updateMenuUI();
};

window.upgradeSkill = (key) => {
    if (player.skillPoints >= 1) {
        player.skillPoints--;
        player.skills[key].unlocked = true;
        player.skills[key].maxCD = Math.max(50, player.skills[key].maxCD - 20); 
        window.triggerTicker(`UPGRADED ${key.toUpperCase()}`);
    }
    updateMenuUI();
};

window.closeMenus = () => {
    document.getElementById('shop-menu').style.display = 'none';
    document.getElementById('skill-menu').style.display = 'none';
    gameState = 'WAVE'; 
};
window.showAnnouncement = (title, body) => {
    currentMessage.title = title;
    currentMessage.body = body;
    gameState = 'MESSAGE';
};

function updateMenuUI() {
    document.getElementById('shop-gold').innerText = player.gold;
    document.getElementById('skill-points').innerText = player.skillPoints;
}

// --- MAIN LOOP ---
function update(time) {
    if (gameState === 'MESSAGE' || gameState === 'START' || gameState === 'MENU') return;

    // Ticker & Level Up
    if (tickerMsg.text) { tickerMsg.x -= 3; if (tickerMsg.x < -1000) tickerMsg.text = ""; }
    if (player.xp >= player.xpToNext) {
        player.level++; player.xp = 0; player.xpToNext *= 1.2; player.skillPoints++;
        window.triggerTicker("LEVEL UP! +1 SP");
        player.saveProfile();
    }
    // Reduce cooldowns
    Object.values(player.skills).forEach(s => { if (s.cooldown > 0) s.cooldown--; });

    // Movement
    const move = input.getMovement();
    if (move.x !== 0 || move.y !== 0) player.currentDir = move;
    let nextX = player.x + move.x * player.speed;
    let nextY = player.y + move.y * player.speed;
    const pRadius = 20;

    // --- ABILITY INPUTS (Fixed) ---
    // Checks 1-4 on both top row and numpad
    if (input.keys['Digit1'] || input.keys['Numpad1']) abilitySys.tryTriggerSkill(0, remoteEnemies, shockwaves, sendHit);
    if (input.keys['Digit2'] || input.keys['Numpad2']) abilitySys.tryTriggerSkill(1, remoteEnemies, shockwaves, sendHit);
    if (input.keys['Digit3'] || input.keys['Numpad3']) abilitySys.tryTriggerSkill(2, remoteEnemies, shockwaves, sendHit);
    if (input.keys['Digit4'] || input.keys['Numpad4']) abilitySys.tryTriggerSkill(3, remoteEnemies, shockwaves, sendHit);

    // Shockwave Animation
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let s = shockwaves[i];
        s.r += 2;
        s.alpha -= 0.02;
        if (s.alpha <= 0) shockwaves.splice(i, 1);
    }

    // --- PHASE & HUB LOGIC ---
    if (serverPhase === 'HUB') {
        // We are in the Hub!
        
        // Shop Zone Interaction
        if (Math.hypot(player.x - (-200), player.y) < 80) {
            window.triggerTicker("PRESS [E] OR CLICK TO SHOP");
            if (input.keys['KeyE']) openShop();
        }
        // Skill Zone Interaction
        if (Math.hypot(player.x - 200, player.y) < 80) {
            window.triggerTicker("PRESS [E] OR CLICK FOR SKILLS");
            if (input.keys['KeyE']) openSkills();
        }
        // Exit Zone (Top of map) - Sends you to next Wave
        if (player.y < -arenaSize + 150) {
            sendReady(true); 
            window.triggerTicker("WAITING FOR TEAM TO EXIT...");
        } else {
            sendReady(false);
        }
        player.x = nextX; player.y = nextY;
    } 
    else { // WAVE MODE
        // 1. Check for Portal
        if (portal) {
             // If portal exists, tell the player!
             if (Math.random() < 0.02) window.triggerTicker("PORTAL OPEN! GO NORTH!");
             
             // --- FIX: PORTAL INTERACTION ---
             // I increased the range to 100 so it's easier to hit
             if (Math.hypot(player.x - portal.x, player.y - portal.y) < 100) {
                 sendReady(true);
                 window.triggerTicker("TELEPORTING...");
             } else {
                 sendReady(false);
             }
        }

        // 2. Hazards & Traps
        let hitBarrier = false;
        hazards.forEach(h => {
            if (nextX + pRadius > h.x && nextX - pRadius < h.x + 50 &&
                nextY + pRadius > h.y && nextY - pRadius < h.y + 50) {
                if (h.type === 'BARRIER') hitBarrier = true;
                else if (h.type === 'TRAP' && !player.isJumping) player.hp -= 0.1;
            }
        });
        if (!hitBarrier) { player.x = nextX; player.y = nextY; }
    }

    // Keep player inside arena
    player.x = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.x));
    player.y = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.y));
    
    // Send position to server
    sendMove(player.x, player.y);

    if (serverPhase === 'WAVE') {
        combat.updateWeapons(player, remoteEnemies, time);
        combat.updateProjectiles(remoteEnemies, arenaSize, sendHit, player);
    }
}
function openShop() {
    gameState = 'MENU';
    updateMenuUI();
    document.getElementById('shop-menu').style.display = 'flex';
}

function openSkills() {
    gameState = 'MENU';
    updateMenuUI();
    document.getElementById('skill-menu').style.display = 'flex';
}

function draw() {
    // 1. Background (Blue-ish)
    ctx.fillStyle = '#1a1a2e'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'START') return;

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // 2. Floor Grid
    if (serverPhase === 'HUB') {
        // HUB FLOOR: Checkerboard pattern
        ctx.strokeStyle = '#333';
        ctx.fillStyle = '#222';
        for (let i = -arenaSize; i < arenaSize; i += 100) {
            for (let j = -arenaSize; j < arenaSize; j += 100) {
                if ((i + j) % 200 === 0) ctx.fillRect(i, j, 100, 100);
            }
        }
    } else {
        // WAVE FLOOR: Standard Grid
        ctx.strokeStyle = '#2a1b4d';
        for (let i = -arenaSize; i <= arenaSize; i += 50) {
            ctx.beginPath(); ctx.moveTo(i, -arenaSize); ctx.lineTo(i, arenaSize); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-arenaSize, i); ctx.lineTo(arenaSize, i); ctx.stroke();
        }
    }

    // 3. Border (Yellow)
    ctx.lineWidth = 8;
    ctx.strokeStyle = serverPhase === 'HUB' ? '#00ffcc' : '#ffff00';
    ctx.strokeRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);
    ctx.lineWidth = 1;

    // 4. Abilities (Shockwaves)
    shockwaves.forEach(s => {
        ctx.save();
        ctx.strokeStyle = s.color || 'white';
        ctx.lineWidth = 5;
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    });

    if (serverPhase === 'HUB') {
        // Draw Hub Zones (Shop/Skill/Exit)
        ctx.fillStyle = 'rgba(255, 215, 0, 0.4)'; ctx.fillRect(-240, -40, 80, 80); // Shop
        ctx.fillStyle = 'white'; ctx.font = "bold 20px monospace"; ctx.fillText("🛒 SHOP", -230, -50);

        ctx.fillStyle = 'rgba(0, 255, 200, 0.4)'; ctx.fillRect(160, -40, 80, 80); // Skills
        ctx.fillText("💪 SKILLS", 170, -50);

        ctx.fillStyle = 'rgba(0, 100, 255, 0.3)'; ctx.fillRect(-150, -arenaSize, 300, 100); // Exit
        ctx.fillText("EXIT TO NEXT WAVE ⬆️", -100, -arenaSize + 120);
    } else {
        // Wave Stuff
        hazards.forEach(h => {
             ctx.fillStyle = h.type === 'BARRIER' ? '#555' : 'rgba(255,0,0,0.3)';
             ctx.fillRect(h.x, h.y, 50, 50);
        });
        if (portal) drawPortal(ctx, portal); 
        
        remoteEnemies.forEach(en => {
            ctx.fillText(en.type === 'archer' ? '🏹' : '🧟', en.x, en.y);
            ctx.fillStyle = 'red'; ctx.fillRect(en.x-15, en.y-20, 30*(en.hp/3), 4);
        });
        
        // Projectiles
        combat.projectiles.forEach(p => {
            ctx.fillStyle = p.color || 'yellow';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    // Players
    Object.entries(remotePlayers).forEach(([id, p]) => {
        if (id !== myId) ctx.fillText("🧙", p.x, p.y);
    });
    ctx.fillText(player.avatar, player.x, player.y);
    ctx.restore();

    drawHUD(ctx, canvas, player);
    if (gameState === 'WAVE' || serverPhase === 'WAVE') drawSkillBar(ctx, canvas, player);
    if (gameState === 'MESSAGE') {
        drawOverlayMessage(ctx, canvas, currentMessage);
        return;
    }

    drawQuitButton(ctx, canvas);
    drawTicker(ctx, canvas, tickerMsg);
}

// Global Click
window.addEventListener('mousedown', (e) => {
    if (serverPhase === 'HUB') {
        if (Math.hypot(player.x - (-200), player.y) < 80) openShop();
        if (Math.hypot(player.x - 200, player.y) < 80) openSkills();
    }
    if (gameState === 'MESSAGE') {
        gameState = 'WAVE';
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (quitButton && mx > quitButton.x && mx < quitButton.x + quitButton.w && my > quitButton.y && my < quitButton.y + quitButton.h) {
        player.saveProfile();
        disconnectNet();
        location.reload();
    }
});

function ticker(t) { update(t); draw(); requestAnimationFrame(ticker); }
window.triggerTicker = (text) => { tickerMsg.text = text; tickerMsg.x = canvas.width; };
requestAnimationFrame(ticker);
