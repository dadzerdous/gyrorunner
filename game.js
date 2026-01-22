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

// --- MENU FUNCTIONS (Exposed to HTML) ---
window.selectElement = (emoji, type) => {
    // 1. Try to load existing save
    const loaded = player.loadProfile();
    
    // 2. If no save, set defaults based on selection
    if (!loaded) {
        player.avatar = emoji; 
        player.element = 'fire'; 
        if (type === 'blood') { player.weapons[0].color = '#ff0000'; player.weapons[0].damage = 5; } 
        else if (type === 'plague') { player.weapons[0].color = '#00ff00'; player.weapons[0].fireRate = 800; } 
        else { player.weapons[0].color = 'orange'; }
    } else {
        // Just update the avatar visual if loaded
        player.avatar = emoji; 
    }
    
    // 3. Connect to server
    // (Ensure you have connectNet imported!)
    connectNet(); 

    document.getElementById('char-select').style.display = 'none';
    hazards = MapSystem.generateHazards(arenaSize); 
    
    if (loaded) showAnnouncement("WELCOME BACK", "Stats loaded. Wave progress reset.");
    else showAnnouncement("ASCENSION BEGINS", "Reach Floor 10 to survive.");
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
        player.skills[key].maxCD = Math.max(50, player.skills[key].maxCD - 20); // Reduce CD
        window.triggerTicker(`UPGRADED ${key.toUpperCase()}`);
    }
    updateMenuUI();
};

window.closeMenus = () => {
    document.getElementById('shop-menu').style.display = 'none';
    document.getElementById('skill-menu').style.display = 'none';
    gameState = 'WAVE'; // Resume moving
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
    Object.values(player.skills).forEach(s => { if (s.cooldown > 0) s.cooldown--; });

    // Movement
    const move = input.getMovement();
    if (move.x !== 0 || move.y !== 0) player.currentDir = move;
    let nextX = player.x + move.x * player.speed;
    let nextY = player.y + move.y * player.speed;
    const pRadius = 20;

    // --- PHASE LOGIC ---
    if (serverPhase === 'HUB') {
        // 1. Shop Zone (-200, 0)
        if (Math.hypot(player.x - (-200), player.y) < 60) {
            window.triggerTicker("PRESS [E] OR CLICK TO SHOP");
            if (input.keys['KeyE']) openShop();
        }
        // 2. Skill Zone (200, 0)
        if (Math.hypot(player.x - 200, player.y) < 60) {
            window.triggerTicker("PRESS [E] OR CLICK FOR SKILLS");
            if (input.keys['KeyE']) openSkills();
        }
        // 3. Exit Zone (Top Edge)
        if (player.y < -arenaSize + 100) {
            sendReady(true); window.triggerTicker("WAITING FOR TEAM TO EXIT...");
        } else {
            sendReady(false);
        }

        player.x = nextX; player.y = nextY;
    } 
    else { // WAVE
        let hitBarrier = false;
        hazards.forEach(h => {
            if (nextX + pRadius > h.x && nextX - pRadius < h.x + 50 &&
                nextY + pRadius > h.y && nextY - pRadius < h.y + 50) {
                if (h.type === 'BARRIER') hitBarrier = true;
                else if (h.type === 'TRAP' && !player.isJumping) player.hp -= 0.1;
            }
        });
        if (!hitBarrier) { player.x = nextX; player.y = nextY; }

        if (portal && Math.hypot(player.x - portal.x, player.y - portal.y) < 50) sendReady(true);
        else sendReady(false);
    }

    // Clamp & Sync
    player.x = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.x));
    player.y = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.y));
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
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (gameState === 'START') return;

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Floor Grid
    ctx.strokeStyle = serverPhase === 'HUB' ? '#444' : '#2a1b4d';
    for (let i = -arenaSize; i <= arenaSize; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, -arenaSize); ctx.lineTo(i, arenaSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-arenaSize, i); ctx.lineTo(arenaSize, i); ctx.stroke();
    }

    if (serverPhase === 'HUB') {
        // Draw Hub Zones
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'; ctx.fillRect(-230, -30, 60, 60); // Shop
        ctx.fillStyle = 'white'; ctx.fillText("🛒 SHOP", -220, -40);

        ctx.fillStyle = 'rgba(0, 255, 200, 0.3)'; ctx.fillRect(170, -30, 60, 60); // Skills
        ctx.fillText("💪 SKILLS", 180, -40);

        ctx.fillStyle = 'rgba(0, 100, 255, 0.3)'; ctx.fillRect(-100, -arenaSize, 200, 80); // Exit
        ctx.fillText("EXIT ⬆️", -20, -arenaSize + 100);
    } else {
        // Wave Stuff (Hazards, Enemies, Portal)
        hazards.forEach(h => {
             ctx.fillStyle = h.type === 'BARRIER' ? '#555' : 'rgba(255,0,0,0.3)';
             ctx.fillRect(h.x, h.y, 50, 50);
        });
        if (portal) drawPortal(ctx, portal); // Use ui.js portal
        remoteEnemies.forEach(en => {
            ctx.fillText(en.type === 'archer' ? '🏹' : '🧟', en.x, en.y);
            ctx.fillStyle = 'red'; ctx.fillRect(en.x-15, en.y-20, 30*(en.hp/3), 4);
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
    drawQuitButton(ctx, canvas);
    drawTicker(ctx, canvas, tickerMsg);
}

// Global Click for Interacting
window.addEventListener('mousedown', (e) => {
    // Check Shop/Skill Click interaction if in Hub
    if (serverPhase === 'HUB') {
        // Calculate world coordinates if you want click-to-move or click-to-interact
        // For now, simpler: If near zone, clicking anywhere opens it
        if (Math.hypot(player.x - (-200), player.y) < 60) openShop();
        if (Math.hypot(player.x - 200, player.y) < 60) openSkills();
    }
    
    // Quit Button
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
