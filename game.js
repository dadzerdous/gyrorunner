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

// --- CONTROL STATE ---
player.controlMode = 'WAVE'; // 'WAVE' | 'HUB' | 'UI'
player.activePad = null;     // 'SHOP' | 'SKILLS' | 'STATS' | null


let gameState = 'START'; 
let arenaSize = 450;
let shockwaves = [];
let hazards = [];
let tickerMsg = { text: "", x: canvas.width }; 
let currentMessage = { title: "", body: "" };
let wantsToExitHub = false;


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
    document.getElementById('stat-menu').style.display = 'none';

    player.controlMode = 'HUB';
    player.activePad = null;
};

window.showAnnouncement = (title, body) => {
    currentMessage.title = title;
    currentMessage.body = body;
    gameState = 'MESSAGE';
};

window.upgradeStat = (type) => {
    if (player.statPoints > 0) {
        player.statPoints--;
        player.stats[type]++;
        window.triggerTicker(`IMPROVED ${type.toUpperCase()}!`);
        // Recalculate maxHP immediately if CON changes
        if (type === 'con') player.hp = player.maxHp; 
        player.saveProfile();
        updateMenuUI();
    }
}

function updateMenuUI() {
    document.getElementById('shop-gold').innerText = player.gold;
    document.getElementById('skill-points').innerText = player.abilityPoints; // Use Ability Points here
    if(document.getElementById('stat-points-display')) {
        document.getElementById('stat-points-display').innerText = player.statPoints; // New Stat Points
    }
}

// --- MAIN LOOP ---
function update(time) {
    // --- HARD STOPS ---
    if (gameState === 'MESSAGE' || gameState === 'START') return;

    // If UI is open, freeze gameplay but still draw
    if (player.controlMode === 'UI') {
        return;
    }

    // --- APPLY STATS TO WEAPONS ---
    player.weapons[0].damage = player.currentDamage;
    player.weapons[0].fireRate = player.currentFireRate;

    // --- TICKER ---
    if (tickerMsg.text) {
        tickerMsg.x -= 3;
        if (tickerMsg.x < -1000) tickerMsg.text = "";
    }

    // --- LEVEL UP (XP → STAT POINTS) ---
    if (player.xp >= player.xpToNext) {
        player.level++;
        player.xp = 0;
        player.xpToNext *= 1.2;
        player.statPoints++;
        window.triggerTicker("LEVEL UP! +1 STAT POINT");
        player.saveProfile();
    }

    // --- WAVE CLEAR → ABILITY POINT ---
    if (player.lastServerPhase === 'WAVE' && serverPhase === 'HUB') {
        player.abilityPoints++;
        window.triggerTicker("WAVE CLEARED! +1 ABILITY POINT");
        player.saveProfile();
    }
    player.lastServerPhase = serverPhase;

    // --- COOLDOWNS ---
    Object.values(player.skills).forEach(s => {
        if (s.cooldown > 0) s.cooldown--;
    });

    // --- MOVEMENT INPUT ---
    const move = input.getMovement();
    if (move.x !== 0 || move.y !== 0) player.currentDir = move;

    let nextX = player.x + move.x * player.speed;
    let nextY = player.y + move.y * player.speed;
    const pRadius = 20;

    // --- HUB MODE ---
    if (serverPhase === 'HUB') {

        // Ensure correct mode
        if (player.controlMode !== 'UI') {
            player.controlMode = 'HUB';
        }

        // Apply movement ONLY in HUB mode
        if (player.controlMode === 'HUB') {
            player.x = nextX;
            player.y = nextY;
        }

        // -------- WALK-ON PADS --------

        // SHOP PAD (LEFT)
        if (player.controlMode === 'HUB' &&
            Math.hypot(player.x + 200, player.y) < 60) {
            enterPad('SHOP');
        }

        // SKILLS PAD (RIGHT)
        else if (player.controlMode === 'HUB' &&
            Math.hypot(player.x - 200, player.y) < 60) {
            enterPad('SKILLS');
        }

        // STATS PAD (BOTTOM)
        else if (player.controlMode === 'HUB' &&
            Math.hypot(player.x, player.y - 200) < 60) {
            enterPad('STATS');
        }

        // EXIT PORTAL (TOP)
        else if (player.controlMode === 'HUB' &&
            player.y < -arenaSize + 120) {
            sendReady(true);
        } else {
            sendReady(false);
        }
    }

    // --- WAVE MODE ---
    else {
        player.controlMode = 'WAVE';

        // Ability inputs ONLY during wave
        if (input.keys['Digit1'] || input.keys['Numpad1'])
            abilitySys.tryTriggerSkill(0, remoteEnemies, shockwaves, sendHit);
        if (input.keys['Digit2'] || input.keys['Numpad2'])
            abilitySys.tryTriggerSkill(1, remoteEnemies, shockwaves, sendHit);
        if (input.keys['Digit3'] || input.keys['Numpad3'])
            abilitySys.tryTriggerSkill(2, remoteEnemies, shockwaves, sendHit);
        if (input.keys['Digit4'] || input.keys['Numpad4'])
            abilitySys.tryTriggerSkill(3, remoteEnemies, shockwaves, sendHit);

        // Portal logic
        if (portal) {
            if (Math.hypot(player.x - portal.x, player.y - portal.y) < 100) {
                sendReady(true);
            } else {
                sendReady(false);
            }
        }

        // Collision
        let hitBarrier = false;
        hazards.forEach(h => {
            if (
                nextX + pRadius > h.x && nextX - pRadius < h.x + 50 &&
                nextY + pRadius > h.y && nextY - pRadius < h.y + 50
            ) {
                if (h.type === 'BARRIER') hitBarrier = true;
                else if (h.type === 'TRAP') player.hp -= 0.1;
            }
        });

        if (!hitBarrier) {
            player.x = nextX;
            player.y = nextY;
        }
    }

    // --- CLAMP ---
    player.x = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.x));
    player.y = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.y));

    sendMove(player.x, player.y);

    // --- COMBAT ---
    if (serverPhase === 'WAVE') {
        combat.updateWeapons(player, remoteEnemies, time);
        combat.updateProjectiles(remoteEnemies, arenaSize, sendHit, player);
    }

    // --- SHOCKWAVES ---
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        shockwaves[i].r += 2;
        shockwaves[i].alpha -= 0.02;
        if (shockwaves[i].alpha <= 0) shockwaves.splice(i, 1);
    }
}


function enterPad(type) {
    if (player.controlMode !== 'HUB') return;

    player.controlMode = 'UI';
    player.activePad = type;

    // Hard stop movement
    input.moveDir = { x: 0, y: 0 };

    updateMenuUI();

    if (type === 'SHOP') {
        document.getElementById('shop-menu').style.display = 'flex';
    }
    if (type === 'SKILLS') {
        document.getElementById('skill-menu').style.display = 'flex';
    }
    if (type === 'STATS') {
        document.getElementById('stat-menu').style.display = 'flex';
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
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (gameState === 'START') return;

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Floor
    if (serverPhase === 'HUB') {
        ctx.strokeStyle = '#333'; ctx.fillStyle = '#222';
        for (let i = -arenaSize; i < arenaSize; i += 100) {
            for (let j = -arenaSize; j < arenaSize; j += 100) {
                if ((i + j) % 200 === 0) ctx.fillRect(i, j, 100, 100);
            }
        }
    } else {
        ctx.strokeStyle = '#2a1b4d';
        for (let i = -arenaSize; i <= arenaSize; i += 50) {
            ctx.beginPath(); ctx.moveTo(i, -arenaSize); ctx.lineTo(i, arenaSize); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-arenaSize, i); ctx.lineTo(arenaSize, i); ctx.stroke();
        }
    }

    // Border
    ctx.lineWidth = 8; ctx.strokeStyle = serverPhase === 'HUB' ? '#00ffcc' : '#ffff00';
    ctx.strokeRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2); ctx.lineWidth = 1;

    // Shockwaves
    shockwaves.forEach(s => {
        ctx.save(); ctx.strokeStyle = s.color || 'white'; ctx.lineWidth = 5; ctx.globalAlpha = s.alpha;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    });

if (serverPhase === 'HUB') {

    // Ensure correct control mode
    if (player.controlMode !== 'UI') {
        player.controlMode = 'HUB';
    }

    // Only allow movement if NOT in UI
    const moveAllowed = player.controlMode === 'HUB';
    if (moveAllowed) {
        player.x = nextX;
        player.y = nextY;
    }

    // ---- WALK-ON PADS ----
    if (player.controlMode === 'HUB') {

        // SHOP PAD (LEFT)
        if (Math.hypot(player.x + 200, player.y) < 60) {
            enterPad('SHOP');
        }

        // SKILLS PAD (RIGHT)
        else if (Math.hypot(player.x - 200, player.y) < 60) {
            enterPad('SKILLS');
        }

        // STATS PAD (BOTTOM)
        else if (Math.hypot(player.x, player.y - 200) < 60) {
            enterPad('STATS');
        }

        // EXIT PORTAL (TOP EDGE)
        else if (player.y < -arenaSize + 120) {
            sendReady(true);
        } else {
            sendReady(false);
        }
    }

 else {
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
        combat.projectiles.forEach(p => {
            ctx.fillStyle = p.color || 'yellow'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
        });
    }
    
    Object.entries(remotePlayers).forEach(([id, p]) => { if (id !== myId) ctx.fillText("🧙", p.x, p.y); });
    ctx.fillText(player.avatar, player.x, player.y);
    ctx.restore();

    drawHUD(ctx, canvas, player);
    if (gameState === 'WAVE' || serverPhase === 'WAVE') drawSkillBar(ctx, canvas, player);
    if (gameState === 'MESSAGE') { drawOverlayMessage(ctx, canvas, currentMessage); return; }

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
