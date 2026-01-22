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
    document.getElementById('stat-menu').style.display = 'none'; // Add this line
    gameState = 'WAVE'; 
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
    if (gameState === 'MESSAGE' || gameState === 'START' || gameState === 'MENU') return;

    // --- APPLY STATS TO WEAPONS ---
    // This ensures STR and DEX actually work!
    player.weapons[0].damage = player.currentDamage;
    player.weapons[0].fireRate = player.currentFireRate;

    // Ticker
    if (tickerMsg.text) { tickerMsg.x -= 3; if (tickerMsg.x < -1000) tickerMsg.text = ""; }

    // --- LEVEL UP (XP -> STAT POINTS) ---
    if (player.xp >= player.xpToNext) {
        player.level++; player.xp = 0; player.xpToNext *= 1.2; 
        player.statPoints++; // Gain Stat Point
        window.triggerTicker("LEVEL UP! +1 STAT POINT (STR/DEX/ETC)");
        player.saveProfile();
    }

    // --- WAVE CLEAR (PHASE -> ABILITY POINTS) ---
    if (player.lastServerPhase === 'WAVE' && serverPhase === 'HUB') {
        player.abilityPoints++; // Gain Ability Point
        window.triggerTicker("WAVE CLEARED! +1 ABILITY POINT");
        player.saveProfile();
    }
    player.lastServerPhase = serverPhase;
    if (serverPhase === 'HUB') {
    wantsToExitHub = false;
}


    // Reduce cooldowns (Apply WIS here)
    const cdReduction = player.cooldownReduction;
    Object.values(player.skills).forEach(s => { 
        if (s.cooldown > 0) s.cooldown--; 
        // Ensure maxCD is updated with WIS
        // (This is a simplified way to apply it dynamically)
    });

    // Movement
    const move = input.getMovement();
    if (move.x !== 0 || move.y !== 0) player.currentDir = move;
    let nextX = player.x + move.x * player.speed;
    let nextY = player.y + move.y * player.speed;
    const pRadius = 20;

    // Ability Inputs
    if (input.keys['Digit1'] || input.keys['Numpad1']) abilitySys.tryTriggerSkill(0, remoteEnemies, shockwaves, sendHit);
    if (input.keys['Digit2'] || input.keys['Numpad2']) abilitySys.tryTriggerSkill(1, remoteEnemies, shockwaves, sendHit);
    if (input.keys['Digit3'] || input.keys['Numpad3']) abilitySys.tryTriggerSkill(2, remoteEnemies, shockwaves, sendHit);
    if (input.keys['Digit4'] || input.keys['Numpad4']) abilitySys.tryTriggerSkill(3, remoteEnemies, shockwaves, sendHit);

    // Shockwaves
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let s = shockwaves[i];
        s.r += 2; s.alpha -= 0.02;
        if (s.alpha <= 0) shockwaves.splice(i, 1);
    }

    // --- HUB LOGIC ---
    if (serverPhase === 'HUB') {
        // Shop Zone (Left)
        if (Math.hypot(player.x - (-200), player.y) < 80) {
            window.triggerTicker("PRESS [E] TO SHOP");
            if (input.keys['KeyE']) { gameState = 'MENU'; updateMenuUI(); document.getElementById('shop-menu').style.display = 'flex'; }
        }
        // Skill Zone (Right)
        if (Math.hypot(player.x - 200, player.y) < 80) {
            window.triggerTicker("PRESS [E] FOR ABILITIES");
            if (input.keys['KeyE']) { gameState = 'MENU'; updateMenuUI(); document.getElementById('skill-menu').style.display = 'flex'; }
        }
        // --- NEW: STAT MIRROR ZONE (Bottom) ---
        if (Math.hypot(player.x, player.y - 200) < 80) {
            window.triggerTicker("PRESS [E] FOR STATS");
            if (input.keys['KeyE']) { gameState = 'MENU'; updateMenuUI(); document.getElementById('stat-menu').style.display = 'flex'; }
        }

if (player.y < -arenaSize + 150) {
    window.triggerTicker("PRESS [E] TO ENTER NEXT WAVE");
    if (input.keys['KeyE']) {
        wantsToExitHub = true;
        sendReady(true);
    }
} else {
    sendReady(false);
}


        player.x = nextX; player.y = nextY;
    } 
    else { // WAVE
        if (portal) {
             if (Math.random() < 0.02) window.triggerTicker("PORTAL OPEN! GO NORTH!");
             if (Math.hypot(player.x - portal.x, player.y - portal.y) < 100) {
                 sendReady(true); window.triggerTicker("TELEPORTING...");
             } else { sendReady(false); }
        }
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
        // Shop (Yellow)
        ctx.fillStyle = 'rgba(255, 215, 0, 0.4)'; ctx.fillRect(-240, -40, 80, 80);
        ctx.fillStyle = 'white'; ctx.font = "bold 20px monospace"; ctx.fillText("🛒 SHOP", -230, -50);

        // Skills (Teal)
        ctx.fillStyle = 'rgba(0, 255, 200, 0.4)'; ctx.fillRect(160, -40, 80, 80);
        ctx.fillText("💪 SKILLS", 170, -50);
        
        // --- NEW: STAT MIRROR (Purple) ---
        // Located at (0, 200) - South
        ctx.fillStyle = 'rgba(255, 0, 255, 0.4)'; ctx.fillRect(-40, 160, 80, 80);
        ctx.fillText("🧠 STATS", -35, 150);

        // Exit (Blue)
        ctx.fillStyle = 'rgba(0, 100, 255, 0.3)'; ctx.fillRect(-150, -arenaSize, 300, 100);
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
