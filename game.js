// game.js
import {
    connectNet, disconnectNet,
    sendMove, sendHit, sendReady, sendProfile,
    isConnected, remoteEnemies, remotePlayers,
    portal, serverPhase, myId,
    hasReceivedFirstState, netDebug
} from "./net.js";

import { Player } from "./entities.js";
import {
    CombatSystem, AbilitySystem, SwipeInput,
    updatePoisonZones, updateZombies,
    poisonZones, zombies, WAVE_CONFIG, CardSystem,
    tickItemPassives
} from "./systems.js";
import { MapSystem, CorruptionSystem, GemSystem, drawMap, drawPurgeStones, drawGems, drawCorruption, drawCorruptionHUD, drawPurgeStoneHUD, drawMinimap, MAP_SIZE } from "./map.js";
import {
    drawHUD, drawTicker, drawOverlayMessage,
    drawSkillBar, drawPortal, drawQuitButton,
    drawBossBar, drawWaveCounter, drawHubZones,
    drawPoisonZones, drawZombies, drawPlayerTag,
    drawEnemyBars, drawEnemies, drawDeathScreen,
    drawBestiaryButton, drawComboFlash,
    updateShockwaves, showCardPicker,
    showBestiaryDrawer, closeBestiaryDrawer,
    triggerComboFlash,
    skillButtons, quitButton, bestiaryButton
} from "./ui.js";
import { bestiary } from "./elements.js";

const GOD_MODE = false;

// ============================================================
//  CANVAS SETUP
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
    const wrap = document.getElementById('canvas-wrap');
    canvas.width  = wrap.offsetWidth;
    canvas.height = wrap.offsetHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============================================================
//  CORE OBJECTS
// ============================================================
const swipeInput = new SwipeInput(canvas);
const player     = new Player();
const combat     = new CombatSystem();
const abilitySys = new AbilitySystem(player);

// ============================================================
//  GAME STATE
// ============================================================
let gameState       = 'SPLASH';   // SPLASH | MESSAGE | WAVE | DEAD | CARD_PICK
let arenaSize       = MAP_SIZE || 3000;
let worldMap        = null;
let corruptionSys   = null;
let gemSystem       = null;
let purgeStoneData  = [];
let clusterData     = [];
let shockwaves      = [];
let hazards         = [];
let tickerMsg       = { text: '', x: 0 };
let currentMessage  = { title: '', body: '', color: '#ffcc00', big: false };
let bestiaryOpen    = false;
let cardPickPending = false;      // block update while card picker is open
let swarmTier       = 1;

// net message extras beyond base net.js
let _remoteSwarmTier = 1;

// ============================================================
//  NET EXTENSIONS — sendHit with element, sendApplyStatus
// ============================================================
function sendElementHit(enemyId, damage, element) {
    if (isConnected()) {
        const ws = window._ws; // exposed by net.js if needed — fallback below
    }
    // net.js sendHit only sends {type,enemyId,damage} — we extend it here
    // by hooking into the raw ws. We re-export a local wrapper instead.
    _sendRaw({ type: 'hit', enemyId, damage, element: element || null });
}

function sendApplyStatus(enemyId, element, stacks = 1) {
    _sendRaw({ type: 'applyStatus', enemyId, element, stacks });
}

function _sendRaw(obj) {
    if (window._rawWs && window._rawWs.readyState === 1) {
        window._rawWs.send(JSON.stringify(obj));
    }
}

// ============================================================
//  NET HOOK — expose raw WS so we can send extended messages
//  Patch WebSocket BEFORE connectNet() is called so we capture
//  the socket the moment net.js creates it.
// ============================================================
function connectNetExtended() {
    // Patch WebSocket BEFORE connectNet() so we capture the socket
    const _origWS = window.WebSocket;
    window.WebSocket = function(...args) {
        const ws = new _origWS(...args);

        // Capture socket reference for _sendRaw
        ws.addEventListener('open', () => { window._rawWs = ws; });

        // Intercept extended server messages
        ws.addEventListener('message', (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }

            // Swarm tier sync
            if (msg.type === 'state' && msg.swarmTier !== undefined) {
                _remoteSwarmTier = msg.swarmTier;
                player.swarmTier = msg.swarmTier;
                // Sync corruption, purge stones, clusters, gems
                if (msg.corruption && corruptionSys) corruptionSys.applySync(msg.corruption);
                if (msg.purgeStones) purgeStoneData = msg.purgeStones;
                if (msg.clusters)    clusterData    = msg.clusters;
                if (msg.gems && gemSystem) gemSystem.applySync(msg.gems);
            }
            // Kill XP
            if (msg.type === 'killXp') {
                player.xp += msg.amount;
                player.runStats.kills++;
                if (msg.enemyType === 'boss' || msg.enemyType === 'miniboss') player.runStats.bossKills++;
                checkLevelUp();
            }
            // Hit result — bestiary
            if (msg.type === 'hitResult') {
                bestiary.recordHit(msg.enemyType || 'goblin', msg.attackElement, msg.enemyElement, msg.multiplier);
                if (msg.multiplier >= 1.5) window.triggerTicker(`⚡ ${(msg.attackElement||'').toUpperCase()} SUPER EFFECTIVE! x${msg.multiplier}`);
                else if (msg.multiplier <= 0.5) window.triggerTicker(`🛡️ ${(msg.attackElement||'').toUpperCase()} resisted (x${msg.multiplier})`);
            }
            // Cross-combo
            if (msg.type === 'crossCombo') {
                triggerComboFlash(msg.comboName, msg.color);
                window.triggerTicker(`⚡ ${msg.comboName.toUpperCase()}!`);
                player.runStats.crossCombos++;
            }
            // Events
            if (msg.type === 'event') {
                if (msg.event === 'tierUp') showAnnouncement(`TIER ${msg.tier}`, 'The horde grows stronger', '#ff8800', false);
                if (msg.event === 'bossIncoming') setTimeout(() => showAnnouncement('⚠️ BOSS INCOMING', 'Prepare yourself!', '#ff0044', true), 800);
                if (msg.event === 'miniBossIncoming') setTimeout(() => showAnnouncement('⚡ MINI-BOSS', 'A powerful foe approaches', '#ff8800', false), 800);
                if (msg.event === 'stoneActivated') window.triggerTicker(`🗿 PURGE STONE ACTIVATED!`);
                if (msg.event === 'allStonesActivated') showAnnouncement('🗿 ALL STONES PURIFIED', 'Corruption retreating — BOSS INCOMING!', '#00ffcc', true);
                if (msg.event === 'clusterCleared') window.triggerTicker('✅ CLUSTER CLEARED — corruption pushed back!');
                if (msg.event === 'levelClear') showAnnouncement('✨ LEVEL CLEAR', 'Walk to center when ready for next level', '#ffcc00', true);
                if (msg.event === 'runOver') showAnnouncement('💀 CORRUPTION CONSUMED YOU', 'Stay inside the boundary next time', '#cc00cc', true);
                if (msg.event === 'finalBossSpawned') showAnnouncement('👹 FINAL BOSS', 'Destroy it to complete the level!', '#ff0000', true);
            }
            // Run result
            if (msg.type === 'runResult') _handleRunResult(msg);
        });

        return ws;
    };
    window.WebSocket.prototype  = _origWS.prototype;
    window.WebSocket.CONNECTING = _origWS.CONNECTING;
    window.WebSocket.OPEN       = _origWS.OPEN;
    window.WebSocket.CLOSING    = _origWS.CLOSING;
    window.WebSocket.CLOSED     = _origWS.CLOSED;

    // Now connect — net.js will use our patched WebSocket
    connectNet();
}

// ============================================================
//  WAIT FOR SPLASH SIGNAL
// ============================================================
function waitForStart() {
    if (!window._gameReady) { requestAnimationFrame(waitForStart); return; }
    initGame();
}
requestAnimationFrame(waitForStart);

// ============================================================
//  INIT GAME
// ============================================================
function initGame() {
    connectNetExtended();

    worldMap      = MapSystem.generate(Date.now());
    corruptionSys = new CorruptionSystem(arenaSize);
    gemSystem     = new GemSystem();

    if (window._continueGame) {
        const loaded = player.loadProfile();
        if (loaded) {
            _sendProfileWhenReady();
            gameState  = 'MESSAGE';
            currentMessage = {
                title: 'WELCOME BACK',
                body:  `${player.avatar} ${player.className} — Level ${player.level}`,
                color: '#00ffcc', big: false
            };
            startLoop();
            return;
        }
    }

    // New run
    player.initClass(window._startClass || 'fire');
    applyGodMode();
    _sendProfileWhenReady();
    gameState = 'MESSAGE';
    currentMessage = {
        title: 'ASCENSION BEGINS',
        body:  `${player.avatar} ${player.className} — Survive the corruption`,
        color: '#ffcc00', big: true
    };
    startLoop();
}

function _sendProfileWhenReady() {
    const iv = setInterval(() => {
        if (isConnected()) {
            sendProfile(player.avatar, player.className, player.heroName || 'HERO');
            // Send active elements too (extended profile)
            _sendRaw({
                type: 'profile',
                avatar: player.avatar,
                className: player.className,
                heroName: player.heroName || 'HERO',
                activeElements: player.activeElements || [player.element],
            });
            clearInterval(iv);
        }
    }, 100);
}

// ============================================================
//  GOD MODE
// ============================================================
function applyGodMode() {
    if (!GOD_MODE) return;
    player.gold = 9999;
    player.statPoints = 99;
    player.skillTokens = 99;
    Object.keys(player.stats).forEach(k => player.stats[k] = player.statMax[k]);
    Object.keys(player.skills).forEach(k => {
        player.skills[k].tier = player.skills[k].maxTier;
        player.skills[k].cooldown = 0;
    });
    window.triggerTicker('⚡ GOD MODE ACTIVE');
}

// ============================================================
//  LEVEL UP — VS STYLE CARD PICK
// ============================================================
function checkLevelUp() {
    if (player.xp < player.xpToNext) return;
    if (cardPickPending) return; // wait for previous pick

    player.level++;
    player.xp = 0;
    player.xpToNext = Math.floor(player.xpToNext * 1.25);
    player.runStats.statPoints = (player.runStats.statPoints || 0) + 1;

    // Check class profile for element unlocks at milestone levels
    if (player.classProfile) {
        const elementChoices = player.classProfile.getElementChoicesForLevel(player.classProfile.classLevel);
        if (elementChoices) {
            elementChoices.forEach(el => CardSystem.addElementCard(el));
        }
    }

    // Trigger card pick (pauses game)
    _showLevelUpCards();
}

async function _showLevelUpCards() {
    cardPickPending = true;
    const cards = CardSystem.generateCards(player);
    if (cards.length === 0) {
        // Fallback — just give stat points
        player.statPoints++;
        window.triggerTicker(`🎉 LEVEL ${player.level}! +1 STAT POINT`);
        cardPickPending = false;
        return;
    }

    const chosen = await showCardPicker(cards);
    CardSystem.applyCard(chosen, player);
    window.triggerTicker(`🎉 LEVEL ${player.level}! ${chosen.icon} ${chosen.name}`);
    player.saveProfile();
    cardPickPending = false;
}

// ============================================================
//  POST-RUN (called when player quits or dies)
// ============================================================
function _handleRunResult(msg) {
    const classXp = player.computeRunClassXp();
    if (player.classProfile) {
        const levelsGained = player.classProfile.addRunXp(classXp);
        if (levelsGained.length > 0) {
            window.triggerTicker(`★ CLASS LEVEL ${player.classProfile.classLevel}! New element unlocks available.`);
        }
        player.classProfile.totalRuns++;
        player.classProfile.bestWave = Math.max(player.classProfile.bestWave, _remoteSwarmTier);
        player.classProfile.save();
    }
}

// ============================================================
//  HUB SHOP / MENUS (legacy — kept for hub phase)
// ============================================================
window.buyItem = (type) => {
    const costs = { potion:50, damage:100, firerate:80, maxhp:120, bomb:60, reset:150 };
    const cost = costs[type];
    if (!cost || player.gold < cost) { window.triggerTicker('NOT ENOUGH GOLD'); return; }
    player.gold -= cost;
    switch (type) {
        case 'potion':   player.hp = Math.min(player.hp + 5, player.maxHp); window.triggerTicker('❤️ HEALED +5 HP'); break;
        case 'damage':   player.weapons[0].baseDamage++; window.triggerTicker('⚔️ BASE DAMAGE +1'); break;
        case 'firerate': player.weapons[0].baseFireRate = Math.max(200, player.weapons[0].baseFireRate - 80); window.triggerTicker('💨 FIRE RATE +1'); break;
        case 'maxhp':    player.baseHp += 5; player.hp = Math.min(player.hp + 5, player.maxHp); window.triggerTicker('🛡️ MAX HP +5'); break;
        case 'reset':    Object.values(player.skills).forEach(s => s.cooldown = 0); window.triggerTicker('⚡ COOLDOWNS RESET'); break;
    }
    player.saveProfile();
    window.updatePanel?.(player);
};

window.closeMenus = () => {
    ['shop-menu','skill-menu','stat-menu'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    player.controlMode = 'HUB';
    player.activePad   = null;
};

window.panelUpgradeStat = (type) => {
    if (player.upgradeStat(type)) {
        window.triggerTicker(`▲ ${type.toUpperCase()} UPGRADED`);
        window.updatePanel?.(player);
    }
};

window.panelUpgradeSkill = (key) => {
    if (player.upgradeSkill(key)) {
        window.triggerTicker(`★ ${player.skills[key].name.toUpperCase()} → TIER ${player.skills[key].tier}`);
        player.saveProfile();
        window.updatePanel?.(player);
    }
};

// ============================================================
//  SHOW ANNOUNCEMENT
// ============================================================
function showAnnouncement(title, body, color = '#ffcc00', big = false) {
    currentMessage = { title, body, color, big };
    gameState = 'MESSAGE';
}

// ============================================================
//  UPDATE
// ============================================================
let _loggedWaiting = false, _loggedFirstEnemy = false;

function update(time) {
    if (gameState === 'SPLASH' || gameState === 'DEAD') return;
    if (cardPickPending) return; // paused for card pick

    if (!hasReceivedFirstState && !_loggedWaiting) {
        _loggedWaiting = true;
        console.log('[GAME] waiting for first server state');
    }
    if (hasReceivedFirstState && remoteEnemies.length > 0 && !_loggedFirstEnemy) {
        _loggedFirstEnemy = true;
        console.log(`[GAME] first enemies visible at ${(performance.now() - netDebug.connectStartedAt).toFixed(1)}ms`);
    }

    // ── Update stat-derived weapon values ──
    player.weapons[0].damage   = player.currentDamage;
    player.weapons[0].fireRate = player.currentFireRate;

    // ── Run survival time ──
    player.runStats.survivalFrames++;

    // ── Ticker scroll ──
    if (tickerMsg.text) {
        tickerMsg.x -= 3;
        if (tickerMsg.x < -canvas.width) tickerMsg.text = '';
    }

    // ── Ability cooldowns ──
    abilitySys.tickCooldowns();
    // Legacy skill cooldowns
    Object.values(player.skills).forEach(s => { if (s.cooldown > 0) s.cooldown--; });

    if (GOD_MODE) {
        Object.values(player.skills).forEach(s => s.cooldown = 0);
        player.hp = player.maxHp;
    }

    // ── Item passives ──
    tickItemPassives(player);

    // ── Movement ──
    const move = swipeInput.getMovement();
    if (move.x !== 0 || move.y !== 0) player.currentDir = move;

    const pRadius = 20;
    let nextX = player.x + move.x * player.speed;
    let nextY = player.y + move.y * player.speed;

    // ── HUB PHASE ──
    if (serverPhase === 'HUB') {
        if (player.controlMode !== 'UI') player.controlMode = 'HUB';
        if (player.controlMode === 'HUB') {
            player.x = nextX;
            player.y = nextY;
        }
        // Walk-on zone detection
        if (player.controlMode === 'HUB') {
            if      (Math.hypot(player.x + 200, player.y) < 60) _enterPad('SHOP');
            else if (Math.hypot(player.x - 200, player.y) < 60) _enterPad('SKILLS');
            else if (Math.hypot(player.x, player.y - 200) < 60) _enterPad('STATS');
            else if (player.y < -arenaSize + 120)                { sendReady(true); }
            else                                                  { sendReady(false); }
        }

    // ── WAVE PHASE ──
    } else {
        player.controlMode = 'WAVE';

        // Keyboard skill triggers
        const keyCodes = [
            ['Digit1','Numpad1'],
            ['Digit2','Numpad2'],
            ['Digit3','Numpad3'],
        ];
        keyCodes.forEach((codes, i) => {
            if (codes.some(c => swipeInput.keys[c])) {
                abilitySys.tryTriggerSlot(i, remoteEnemies, shockwaves, sendElementHit, sendApplyStatus);
            }
        });

        // Portal proximity
        if (portal) {
            sendReady(Math.hypot(player.x - portal.x, player.y - portal.y) < 100);
        }

        // Hazard collision
        let blocked = false;
        hazards.forEach(h => {
            if (nextX+pRadius > h.x && nextX-pRadius < h.x+50 &&
                nextY+pRadius > h.y && nextY-pRadius < h.y+50) {
                if (h.type === 'BARRIER') blocked = true;
                else if (h.type === 'TRAP') player.hp -= 0.05;
            }
        });
        if (!blocked) { player.x = nextX; player.y = nextY; }

        // Enemy contact damage
        remoteEnemies.forEach(en => {
            if (Math.hypot(en.x - player.x, en.y - player.y) < pRadius + (en.radius || 15)) {
                if (!GOD_MODE) player.hp -= 0.04;
            }
        });

        // Combat systems
        updatePoisonZones(remoteEnemies, sendElementHit);
        updateZombies(remoteEnemies, sendElementHit);
        combat.updateWeapons(player, remoteEnemies, time, sendElementHit, sendApplyStatus, shockwaves);
        combat.updateProjectiles(remoteEnemies, arenaSize, sendElementHit, sendApplyStatus, player, shockwaves);

        // Gem collection
        if (gemSystem) {
            const collected = gemSystem.collectNear(player.x, player.y, 70);
            collected.forEach(g => {
                _sendRaw({ type: 'collectGem', gemId: g.id });
            });
        }

        // Corruption damage
        if (corruptionSys && corruptionSys.isCorrupted(player.x, player.y)) {
            if (!GOD_MODE) player.hp -= corruptionSys.getDamage();
            window.triggerTicker?.('☠️ CORRUPTION!');
        }
    }

    // ── Clamp to arena ──
    player.x = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.x));
    player.y = Math.max(-arenaSize + pRadius, Math.min(arenaSize - pRadius, player.y));

    sendMove(player.x, player.y);

    // ── Death ──
    if (player.hp <= 0 && !GOD_MODE) {
        player.hp = 0;
        gameState = 'DEAD';
        // Send run complete to server for class XP
        const classXp = player.computeRunClassXp();
        _sendRaw({ type: 'runComplete', classXp });
        player.saveProfile();
    }

    // ── Shockwaves ──
    updateShockwaves(shockwaves);

    // ── Panel update (throttled) ──
    if (Math.floor(time / 30) % 2 === 0) window.updatePanel?.(player);
}

// ============================================================
//  ENTER HUB PAD
// ============================================================
function _enterPad(type) {
    if (player.controlMode !== 'HUB') return;
    player.controlMode = 'UI';
    player.activePad   = type;
    swipeInput.moveDir = { x: 0, y: 0 };
    window.updatePanel?.(player);
    if (type === 'SHOP')   { const el = document.getElementById('shop-menu');  if (el) el.style.display = 'flex'; }
    if (type === 'SKILLS') { const el = document.getElementById('skill-menu'); if (el) el.style.display = 'flex'; }
    if (type === 'STATS')  { const el = document.getElementById('stat-menu');  if (el) el.style.display = 'flex'; }
}

// ============================================================
//  DRAW
// ============================================================
function draw() {
    // Background
    ctx.fillStyle = '#0d0b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'SPLASH') return;

    if (gameState === 'DEAD') {
        drawDeathScreen(ctx, canvas);
        return;
    }

    // ── WORLD SPACE — camera follows player ──
    ctx.save();
    const VIEW_SCALE = Math.min(canvas.width, canvas.height) / 900;
    ctx.translate(canvas.width / 2, (canvas.height - 100) / 2);
    ctx.scale(VIEW_SCALE, VIEW_SCALE);
    ctx.translate(-player.x, -player.y);

    // Floor + terrain
    if (serverPhase === 'HUB') {
        _drawHubFloor();
        drawHubZones(ctx, 600);
    } else {
        drawMap(ctx, worldMap, corruptionSys);
    }

    // Corruption fog (world space)
    if (corruptionSys) drawCorruption(ctx, corruptionSys, arenaSize);

    // Purge stones
    drawPurgeStones(ctx, purgeStoneData);

    // Gems
    if (gemSystem) drawGems(ctx, gemSystem.gems);

    // Poison zones
    drawPoisonZones(ctx, poisonZones);

    // Shockwaves
    shockwaves.forEach(s => {
        ctx.save();
        ctx.strokeStyle = s.color || 'white';
        ctx.lineWidth   = 3;
        ctx.globalAlpha = Math.max(0, s.alpha);
        ctx.shadowBlur  = 8;
        ctx.shadowColor = s.color || 'white';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    });

    // Portal
    drawPortal(ctx, portal);

    // Remote players
    Object.entries(remotePlayers).forEach(([id, p]) => {
        if (id === myId || id === window._myId || !p || p.avatar === '❓') return;
        ctx.font = '32px serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.avatar || '🧙', p.x, p.y + 12);
        ctx.fillStyle = '#00ffcc';
        ctx.font = '10px "Courier New", monospace';
        ctx.fillText(p.heroName || p.className || '', p.x, p.y - 22);
    });

    // Enemies with elemental status borders
    drawEnemies(ctx, remoteEnemies);
    drawEnemyBars(ctx, remoteEnemies);

    // Zombies
    drawZombies(ctx, zombies);

    // Projectiles
    combat.projectiles.forEach(p => {
        ctx.save();
        ctx.shadowBlur  = 10;
        ctx.shadowColor = p.color || 'orange';
        ctx.fillStyle   = p.color || 'orange';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Local player
    ctx.font = '36px serif';
    ctx.textAlign = 'center';
    ctx.fillText(player.avatar, player.x, player.y + 12);
    drawPlayerTag(ctx, player);

    // Shield ring
    if (player.shield > 0) {
        ctx.save();
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth   = 3;
        ctx.globalAlpha = 0.6;
        ctx.shadowBlur  = 12;
        ctx.shadowColor = '#00ccff';
        ctx.beginPath();
        ctx.arc(player.x, player.y, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        player.shield--;
    }

    ctx.restore(); // end world space

    // ── SCREEN SPACE HUD ──
    if (gameState === 'MESSAGE') {
        drawOverlayMessage(ctx, canvas, currentMessage);
        return;
    }

    drawHUD(ctx, canvas, player);
    drawCorruptionHUD(ctx, canvas, corruptionSys);
    drawPurgeStoneHUD(ctx, canvas, purgeStoneData);
    drawWaveCounter(ctx, canvas, _remoteSwarmTier, serverPhase);
    drawBossBar(ctx, canvas, remoteEnemies);
    drawMinimap(ctx, canvas, player, corruptionSys, purgeStoneData, clusterData, arenaSize);
    _drawClassSkillIcon(ctx, canvas, player, abilitySys);
    drawSkillBar(ctx, canvas, player, abilitySys);
    drawBestiaryButton(ctx, canvas);
    drawQuitButton(ctx, canvas);
    drawTicker(ctx, canvas, tickerMsg);
    drawComboFlash(ctx, canvas);
}

// ============================================================
//  CLASS SKILL HUD ICON (above playfield, left side)
// ============================================================
function _drawClassSkillIcon(ctx, canvas, player, abilitySys) {
    const keys = player.getSkillKeys();
    let activeSkill = null;
    for (const key of keys) {
        const sk = player.skills[key];
        if (sk && sk.tier > 0) { activeSkill = sk; break; }
    }
    if (!activeSkill) return;

    const size = 44;
    const x = 14;
    const y = canvas.height - 100 - size - 8;
    const cdRatio = abilitySys ? abilitySys.getCooldownRatio(0) : 0;

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = cdRatio > 0 ? '#333' : '#00ffcc';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);

    if (cdRatio > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x, y + size * (1 - cdRatio), size, size * cdRatio);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px "Courier New",monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(cdRatio * 10), x + size / 2, y + size / 2 + 5);
    } else {
        ctx.font = '24px serif';
        ctx.textAlign = 'center';
        ctx.fillText(activeSkill.icon, x + size / 2, y + size / 2 + 8);
    }

    ctx.fillStyle = '#00ffcc';
    ctx.font = '7px "Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CLASS', x + size / 2, y + size + 10);

    ctx.fillStyle = '#555';
    ctx.font = '7px "Courier New",monospace';
    ctx.fillText('[1]', x + size / 2, y + size + 19);
    ctx.textAlign = 'left';
}

// ============================================================
//  FLOOR DRAWING HELPERS
// ============================================================
function _drawWaveFloor() {
    ctx.fillStyle = '#0d0b14';
    ctx.fillRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);
    // Subtle grid
    ctx.strokeStyle = '#1a1530';
    ctx.lineWidth = 0.5;
    for (let i = -arenaSize; i <= arenaSize; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, -arenaSize); ctx.lineTo(i, arenaSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-arenaSize, i); ctx.lineTo(arenaSize, i); ctx.stroke();
    }
    // Vignette corners
    const grad = ctx.createRadialGradient(0, 0, arenaSize * 0.3, 0, 0, arenaSize * 1.5);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);
}

function _drawHubFloor() {
    ctx.fillStyle = '#111018';
    ctx.fillRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);
    for (let i = -arenaSize; i < arenaSize; i += 80) {
        for (let j = -arenaSize; j < arenaSize; j += 80) {
            if ((Math.floor(i/80) + Math.floor(j/80)) % 2 === 0) {
                ctx.fillStyle = '#13101f';
                ctx.fillRect(i, j, 80, 80);
            }
        }
    }
}

// ============================================================
//  INPUT — SKILL BUTTONS + QUIT + BESTIARY
// ============================================================
canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    _handleUITouch(t.clientX, t.clientY);
}, { passive: true });

canvas.addEventListener('mousedown', (e) => {
    _handleUITouch(e.clientX, e.clientY);
});

window.addEventListener('mousedown', (e) => {
    _handleQuitTouch(e.clientX, e.clientY);
    _handleMessageDismiss(e);
    _handleDeathDismiss(e);
});

function _handleUITouch(tx, ty) {
    if (cardPickPending) return;

    // Skill buttons
    if (gameState === 'WAVE' || serverPhase === 'WAVE') {
        skillButtons.forEach((btn, i) => {
            if (!btn || tx < btn.x || tx > btn.x + btn.w || ty < btn.y || ty > btn.y + btn.h) return;
            abilitySys.tryTriggerSlot(i, remoteEnemies, shockwaves, sendElementHit, sendApplyStatus);
        });
    }

    // Bestiary button
    const bb = bestiaryButton;
    if (bb && tx > bb.x && tx < bb.x + bb.w && ty > bb.y && ty < bb.y + bb.h) {
        if (bestiaryOpen) {
            closeBestiaryDrawer();
            bestiaryOpen = false;
        } else {
            showBestiaryDrawer(bestiary);
            bestiaryOpen = true;
        }
        return;
    }

    // Close bestiary on canvas tap outside
    if (bestiaryOpen) {
        closeBestiaryDrawer();
        bestiaryOpen = false;
    }
}

function _handleQuitTouch(mx, my) {
    if (!quitButton) return;
    if (mx > quitButton.x && mx < quitButton.x + quitButton.w &&
        my > quitButton.y && my < quitButton.y + quitButton.h) {
        const classXp = player.computeRunClassXp();
        _sendRaw({ type: 'runComplete', classXp });
        _handleRunResult({});
        player.saveProfile();
        disconnectNet();
        location.reload();
    }
}

function _handleMessageDismiss(e) {
    if (gameState === 'MESSAGE') gameState = 'WAVE';
}

function _handleDeathDismiss(e) {
    if (gameState === 'DEAD') {
        player.hp = Math.ceil(player.maxHp / 2);
        player.runStats = { kills:0, bossKills:0, crossCombos:0, damageDealt:0, survivalFrames:0 };
        gameState = 'WAVE';
    }
}

// ============================================================
//  TICKER
// ============================================================
window.triggerTicker = (text) => {
    tickerMsg.text = text;
    tickerMsg.x    = canvas.width;
};

// ============================================================
//  MAIN LOOP
// ============================================================
function startLoop() {
    function tick(t) {
        update(t);
        draw();
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}