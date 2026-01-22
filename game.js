import { connectNet, disconnectNet, sendMove, sendHit, sendReady, remoteEnemies, remotePlayers, portal, serverPhase, myId } from "./net.js"; // Added disconnectNet
import { Player } from './entities.js';
import { InputHandler } from './input.js';
import { CombatSystem, AbilitySystem } from './systems.js';
import { MapSystem } from './map.js';
import { drawHUD, drawTicker, drawOverlayMessage, drawHubZones, drawSkillBar, drawPortal, drawQuitButton, skillButtons, quitButton } from './ui.js';

// Removed auto connectNet() at top - we connect when game starts

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth; canvas.height = window.innerHeight;

const input = new InputHandler();
const player = new Player(); // Loads default
const combat = new CombatSystem();
const abilitySys = new AbilitySystem(player);

let gameState = 'START'; 
let arenaSize = 450;
let shockwaves = [];
let hazards = [];
let tickerMsg = { text: "", x: canvas.width }; 
let currentMessage = { title: "", body: "" };

// Show the menu on load
document.getElementById('char-select').style.display = 'flex';

window.selectElement = (emoji, type) => {
    // 1. Load Save if exists (Before setting defaults)
    const loaded = player.loadProfile();
    
    // 2. Apply Selection Overrides (Only if not loaded, or update visual avatar)
    if (!loaded) {
        player.avatar = emoji; 
        player.element = 'fire'; 
        if (type === 'blood') { player.weapons[0].color = '#ff0000'; player.weapons[0].damage = 5; } 
        else if (type === 'plague') { player.weapons[0].color = '#00ff00'; player.weapons[0].fireRate = 800; } 
        else { player.weapons[0].color = 'orange'; }
    } else {
        // If loaded, just update the avatar to match what they clicked (optional) or keep save
        player.avatar = emoji; // Let them look like what they clicked even if stats are loaded
        window.triggerTicker("WELCOME BACK " + emoji);
    }
    
    // 3. Connect and Start
    connectNet();
    document.getElementById('char-select').style.display = 'none';
    hazards = MapSystem.generateHazards(arenaSize); 
    
    if (!loaded) showAnnouncement("ASCENSION BEGINS", "Reach Floor 10 to survive.");
    else showAnnouncement("RESUMING RUN", "Floor progress reset. Stats saved.");
};

function showAnnouncement(title, body) {
    currentMessage = { title, body };
    gameState = 'MESSAGE';
}

function handleGlobalClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const mouseY = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    // 1. Message Dismiss
    if (gameState === 'MESSAGE') {
        gameState = 'WAVE';
        window.triggerTicker("SURVIVE THE WAVES");
        return;
    }

    // 2. Quit Button (Top Right) - Only during active gameplay
    if ((gameState === 'WAVE' || serverPhase === 'WAVE' || serverPhase === 'HUB') && quitButton) {
         if (mouseX >= quitButton.x && mouseX <= quitButton.x + quitButton.w &&
             mouseY >= quitButton.y && mouseY <= quitButton.y + quitButton.h) {
             
             // SAVE & QUIT Logic
             player.saveProfile();
             disconnectNet();
             gameState = 'START';
             document.getElementById('char-select').style.display = 'flex';
             return;
         }
    }

    // 3. Skill Buttons
    if (gameState === 'WAVE' || serverPhase === 'WAVE') {
        skillButtons.forEach((btn, index) => {
            if (btn.rect && 
                mouseX >= btn.rect.x && mouseX <= btn.rect.x + btn.rect.w &&
                mouseY >= btn.rect.y && mouseY <= btn.rect.y + btn.rect.h) {
                abilitySys.tryTriggerSkill(index, remoteEnemies, shockwaves, sendHit);
            }
        });
    }
}

window.triggerTicker = (text) => { tickerMsg.text = text; tickerMsg.x = canvas.width; };

function update(time) {
    if (gameState === 'MESSAGE' || gameState === 'START') return;
    if (tickerMsg.text) { tickerMsg.x -= 3; if (tickerMsg.x < -1000) tickerMsg.text = ""; }
    if (player.xp >= player.xpToNext) {
        levelUp();
        player.saveProfile(); // Auto-save on level up
    }
    Object.values(player.skills).forEach(s => { if (s.cooldown > 0) s.cooldown--; });
    
    const move = input.getMovement();
    if (move.x !== 0 || move.y !== 0) player.currentDir = move;
    
    let nextX = player.x + move.x * player.speed;
    let nextY = player.y + move.y * player.speed;
    const pRadius = 20; 

    if (serverPhase === 'HUB') {
        checkHubInteractions(player.x, player.y);
        if (player.x > arenaSize - 50) { sendReady(true); window.triggerTicker("WAITING FOR TEAM..."); } 
        else { sendReady(false); }
        player.x = nextX; player.y = nextY;
    } else { 
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

    player.x = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.x));
    player.y = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.y));
    sendMove(player.x, player.y);

    if (serverPhase === 'WAVE') combat.updateWeapons(player, remoteEnemies, time);
    combat.updateProjectiles(remoteEnemies, arenaSize, sendHit, player);
}

function checkHubInteractions(x, y) {
    if (Math.hypot(x - (-200), y - 0) < 50) window.triggerTicker("🛒 SHOP ZONE");
    if (Math.hypot(x - 0, y - (-200)) < 50) window.triggerTicker("💪 TRAINER ZONE");
}

function levelUp() {
    player.level++; player.xp = 0; player.xpToNext *= 1.2; player.skillPoints += 1;
    window.triggerTicker(`⚡ LEVEL UP! NOW LEVEL ${player.level} ⚡`);
    if (player.level === 3) { player.skills.flameDash.unlocked = true; window.triggerTicker("UNLOCKED: FLAME DASH"); }
    if (player.level === 5) { player.keystones.chainExplosions = true; window.triggerTicker("KEYSTONE ACTIVE"); }
    if (player.level === 6) { player.skills.moltenGuard.unlocked = true; window.triggerTicker("UNLOCKED: MOLTEN GUARD"); }
    if (player.level === 9) { player.skills.inferno.unlocked = true; window.triggerTicker("UNLOCKED: INFERNO"); }
}

function draw() {
    ctx.fillStyle = '#050208'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'START') {
        // Stop drawing game when in menu
        return; 
    }

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    ctx.strokeStyle = '#2a1b4d'; 
    for (let i = -arenaSize; i <= arenaSize; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, -arenaSize); ctx.lineTo(i, arenaSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-arenaSize, i); ctx.lineTo(arenaSize, i); ctx.stroke();
    }

    shockwaves.forEach(sw => {
        sw.r += 5; sw.alpha -= 0.05;
        ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.fillStyle = sw.color || 'orange'; ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.fill(); ctx.globalAlpha = 1.0;
    });
    shockwaves = shockwaves.filter(sw => sw.alpha > 0);

    if (serverPhase === 'HUB') {
        drawHubZones(ctx, arenaSize);
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
        if (portal) drawPortal(ctx, portal);
        remoteEnemies.forEach(en => {
            ctx.font = '28px serif'; ctx.textAlign = 'center';
            ctx.fillText(en.type === 'archer' ? '🏹' : '🧟', en.x, en.y + 10);
            ctx.fillStyle = 'red'; ctx.fillRect(en.x - 15, en.y - 25, 30 * (en.hp / 3), 4);
        });
    }

    ctx.lineWidth = 5; ctx.strokeStyle = '#ff0044'; 
    ctx.shadowBlur = 20; ctx.shadowColor = '#ff0044';
    ctx.strokeRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);
    ctx.shadowBlur = 0; ctx.lineWidth = 1;

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

    // UI DRAWING - HUD IS ALWAYS HERE
    drawHUD(ctx, canvas, player);
    if (gameState === 'WAVE' || serverPhase === 'WAVE') drawSkillBar(ctx, canvas, player);
    drawQuitButton(ctx, canvas); // Always draw quit button when playing
    
    drawTicker(ctx, canvas, tickerMsg);
    if (gameState === 'MESSAGE') drawOverlayMessage(ctx, canvas, currentMessage);
}

function ticker(time) { update(time); draw(); requestAnimationFrame(ticker); }
requestAnimationFrame(ticker);

window.addEventListener('mousedown', handleGlobalClick);
window.addEventListener('touchstart', handleGlobalClick);
