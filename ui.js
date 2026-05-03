// ui.js
// ============================================================
//  SPIRE ONLINE — UI SYSTEM
//  Owns: 3-slot skill bar, card picker, element HUD orbs,
//        enemy status borders, cross-combo flash,
//        bestiary drawer, boss bar, HUD, overlays
//
//  Aesthetic direction: dark occult terminal — deep black with
//  sharp elemental accent colors. Monospace + pixel hybrid.
//  Everything tight, readable at arm's length on mobile.
// ============================================================

import { ELEMENTS, COMBOS, getStatusBorderColor, getElementColor } from './elements.js';
import { WEAPON_SKILLS, ITEM_DEFS } from './entities.js';

// ============================================================
//  CONSTANTS
// ============================================================
const SKILL_BTN_SIZE  = 72;   // px — minimum comfortable tap target
const SKILL_BTN_GAP   = 10;
const SKILL_BAR_H     = 100;  // reserved height at bottom for skill bar
const ELEMENT_ORB_R   = 10;   // radius of element orbs in HUD

// ============================================================
//  SKILL BUTTON HIT AREAS (screen space, updated each frame)
// ============================================================
export let skillButtons = [];   // [{ slot, x, y, w, h }]
export let quitButton   = { x: 0, y: 10, w: 80, h: 30 };
export let bestiaryButton = { x: 0, y: 0, w: 44, h: 44 };

// ============================================================
//  CROSS-COMBO FLASH STATE
// ============================================================
let comboFlash = null; // { name, color, alpha, timer }

export function triggerComboFlash(name, color) {
    comboFlash = { name, color: color || '#ffffff', alpha: 1, timer: 90 };
}

// ============================================================
//  SKILL BAR  (bottom center, 3 large buttons)
// ============================================================
export function drawSkillBar(ctx, canvas, player, abilitySys) {
    const totalW = SKILL_BTN_SIZE * 3 + SKILL_BTN_GAP * 2;
    const startX = (canvas.width / 2) - totalW / 2;
    const y = canvas.height - SKILL_BAR_H + (SKILL_BAR_H - SKILL_BTN_SIZE) / 2;

    skillButtons = [];

    const slots = [
        { label: 'CLASS',  color: '#00ffcc', getSkill: () => _getClassSlotInfo(player) },
        { label: 'WEAPON', color: '#ffaa00', getSkill: () => _getWeaponSlotInfo(player) },
        { label: 'ITEM',   color: '#cc88ff', getSkill: () => _getItemSlotInfo(player)   },
    ];

    slots.forEach((slot, i) => {
        const x = startX + i * (SKILL_BTN_SIZE + SKILL_BTN_GAP);
        const info = slot.getSkill();
        const cdRatio = abilitySys ? abilitySys.getCooldownRatio(i) : 0;

        skillButtons.push({ slot: i, x, y, w: SKILL_BTN_SIZE, h: SKILL_BTN_SIZE });

        // ── Background ──
        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        _roundRect(ctx, x, y, SKILL_BTN_SIZE, SKILL_BTN_SIZE, 6);
        ctx.fill();

        // ── Border — slot color, brighter when active ──
        ctx.strokeStyle = info.available ? slot.color : '#2a2a2a';
        ctx.lineWidth = info.available ? 2 : 1;
        _roundRect(ctx, x, y, SKILL_BTN_SIZE, SKILL_BTN_SIZE, 6);
        ctx.stroke();

        // ── Cooldown overlay (sweeps from bottom) ──
        if (cdRatio > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            const covH = SKILL_BTN_SIZE * cdRatio;
            ctx.fillRect(x + 1, y + SKILL_BTN_SIZE - covH, SKILL_BTN_SIZE - 2, covH);

            // CD number
            const secs = Math.ceil(cdRatio * _getMaxCdSecs(i, player));
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = 'bold 18px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(secs, x + SKILL_BTN_SIZE / 2, y + SKILL_BTN_SIZE / 2 + 6);
        }

        // ── Icon ──
        if (info.icon) {
            ctx.font = `${cdRatio > 0 ? 22 : 28}px serif`;
            ctx.globalAlpha = info.available ? 1 : 0.35;
            ctx.textAlign = 'center';
            ctx.fillText(info.icon, x + SKILL_BTN_SIZE / 2, y + SKILL_BTN_SIZE / 2 + 4);
            ctx.globalAlpha = 1;
        } else {
            // Empty slot indicator
            ctx.fillStyle = '#333';
            ctx.font = '11px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(slot.label, x + SKILL_BTN_SIZE / 2, y + SKILL_BTN_SIZE / 2 + 4);
        }

        // ── Slot label (top-left corner) ──
        ctx.fillStyle = slot.color;
        ctx.font = '8px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(slot.label, x + 4, y + 10);

        // ── Tier pips (bottom, for class skill) ──
        if (i === 0 && info.tier !== undefined) {
            for (let t = 0; t < (info.maxTier || 3); t++) {
                ctx.fillStyle = t < info.tier ? slot.color : '#2a2a2a';
                ctx.fillRect(x + 4 + t * 11, y + SKILL_BTN_SIZE - 7, 9, 4);
            }
        }

        // ── Rank dots (bottom, for weapon skill) ──
        if (i === 1 && info.rank !== undefined) {
            for (let r = 0; r < 3; r++) {
                ctx.beginPath();
                ctx.arc(x + 8 + r * 12, y + SKILL_BTN_SIZE - 6, 3, 0, Math.PI * 2);
                ctx.fillStyle = r < info.rank ? slot.color : '#2a2a2a';
                ctx.fill();
            }
        }
    });

    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
}

function _getClassSlotInfo(player) {
    const keys = player.getSkillKeys();
    for (const key of keys) {
        const sk = player.skills[key];
        if (sk && sk.tier > 0) {
            return { icon: sk.icon, available: sk.cooldown <= 0, tier: sk.tier, maxTier: sk.maxTier };
        }
    }
    return { icon: '🔒', available: false };
}

function _getWeaponSlotInfo(player) {
    const w = player.weapons[0];
    if (!w || !w.unlockedSkills?.length) return { icon: null, available: false, rank: 0 };
    const key = w.unlockedSkills[w.unlockedSkills.length - 1];
    const def = WEAPON_SKILLS[key];
    return { icon: def?.icon || '⚔️', available: true, rank: w.rank || 0 };
}

function _getItemSlotInfo(player) {
    const triggered = player.items.find(it => ['poisonOnKill'].includes(it.effect));
    if (!triggered) {
        const passive = player.items[0];
        return { icon: passive?.icon || null, available: false };
    }
    return { icon: triggered.icon || '⚗️', available: true };
}

function _getMaxCdSecs(slotIndex, player) {
    const maxCDs = [200, 180, 300];
    return Math.round((maxCDs[slotIndex] || 200) / 60);
}

// ============================================================
//  HUD  (top left: HP, XP, level, elements)
// ============================================================
export function drawHUD(ctx, canvas, player) {
    const barW = Math.min(200, canvas.width * 0.32);
    const LEFT = 14;

    // ── XP bar (very top, full width) ──
    const xpRatio = player.xp / player.xpToNext;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, 5);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(0, 0, canvas.width * xpRatio, 5);

    // ── HP bar ──
    const hpRatio = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(LEFT, 14, barW, 16);
    const hpColor = hpRatio > 0.5 ? '#ff1155' : hpRatio > 0.25 ? '#ff6600' : '#ff0000';
    ctx.fillStyle = hpColor;
    ctx.fillRect(LEFT, 14, barW * hpRatio, 16);
    // Shield overlay
    if (player.shield > 0) {
        ctx.fillStyle = 'rgba(0,220,255,0.45)';
        ctx.fillRect(LEFT, 14, barW * Math.min(1, player.shield / 30), 16);
    }
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(LEFT, 14, barW, 16);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`HP  ${Math.ceil(player.hp)} / ${player.maxHp}`, LEFT + 4, 26);

    // ── Level / class ──
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText(`${player.avatar}  ${player.className}  LV${player.level}`, LEFT, 50);

    // ── Gold ──
    ctx.fillStyle = '#ffcc00';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText(`💰 ${player.gold}`, LEFT, 65);

    // ── Stat / skill point alerts ──
    if (player.statPoints > 0) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.fillText(`▲ ${player.statPoints} STAT`, LEFT, 80);
    }

    // ── Active element orbs (right side of HP bar) ──
    _drawElementOrbs(ctx, player, LEFT + barW + 12, 18);

    // ── Swarm tier (top right) ──
    ctx.fillStyle = '#ffffff88';
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`TIER ${player.swarmTier || 1}`, canvas.width - 90, 30);
    ctx.textAlign = 'left';
}

function _drawElementOrbs(ctx, player, startX, y) {
    const els = player.activeElements || [];
    els.forEach((el, i) => {
        const elDef = ELEMENTS[el];
        if (!elDef) return;
        const cx = startX + i * (ELEMENT_ORB_R * 2 + 5) + ELEMENT_ORB_R;

        // Glow
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = elDef.glowColor || elDef.color;
        ctx.beginPath();
        ctx.arc(cx, y + ELEMENT_ORB_R, ELEMENT_ORB_R, 0, Math.PI * 2);
        ctx.fillStyle = elDef.color;
        ctx.fill();
        ctx.restore();

        // Emoji
        ctx.font = '10px serif';
        ctx.textAlign = 'center';
        ctx.fillText(elDef.emoji, cx, y + ELEMENT_ORB_R * 2 + 2);
    });

    // Active combo badge
    if (player.activeCombo) {
        const comboDef = COMBOS[player.activeCombo.key];
        if (comboDef) {
            const cx = startX + els.length * (ELEMENT_ORB_R * 2 + 5) + ELEMENT_ORB_R + 8;
            ctx.fillStyle = comboDef.color;
            ctx.font = 'bold 8px "Courier New", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`⚡${comboDef.emoji}`, cx, y + ELEMENT_ORB_R + 3);
        }
    }
    ctx.textAlign = 'left';
}

// ============================================================
//  ENEMY RENDERING — color tint + status borders
// ============================================================
export function drawEnemies(ctx, enemies) {
    enemies.forEach(en => {
        const size = (en.radius || 15) * 1.8;

        ctx.save();

        // Color tint based on element
        const elColor = getElementColor(en.element || 'earth');

        // Status border (pulsing, cycles through active statuses)
        const statusKeys = en.statuses ? Object.keys(en.statuses).filter(k => en.statuses[k]?.stacks > 0) : [];
        if (statusKeys.length > 0) {
            const tick = Math.floor(Date.now() / 400) % statusKeys.length;
            const activeStatus = statusKeys[tick];
            const borderColor = getStatusBorderColor(activeStatus);

            ctx.shadowBlur = 14;
            ctx.shadowColor = borderColor;
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(en.x, en.y, (en.radius || 15) + 4, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Enemy emoji
        ctx.font = `${size}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText(en.emoji || '👾', en.x, en.y + size * 0.35);

        ctx.restore();
    });
}

// ============================================================
//  ENEMY HP BARS
// ============================================================
export function drawEnemyBars(ctx, enemies) {
    enemies.forEach(en => {
        if (en.hp === en.maxHp) return;
        const bw = Math.max(30, (en.radius || 15) * 2.2);
        const by = en.y - (en.radius || 15) - 12;

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(en.x - bw/2, by, bw, 5);

        const ratio = Math.max(0, en.hp / en.maxHp);
        ctx.fillStyle = en.type === 'boss' ? '#ff0000' :
                        en.type === 'miniboss' ? '#ff8800' : '#ff4444';
        ctx.fillRect(en.x - bw/2, by, bw * ratio, 5);
    });
}

// ============================================================
//  BOSS BAR (top center)
// ============================================================
export function drawBossBar(ctx, canvas, enemies) {
    const boss = enemies.find(e => e.type === 'boss' || e.type === 'miniboss');
    if (!boss) return;

    const barW = Math.min(380, canvas.width * 0.58);
    const barH = 22;
    const x = (canvas.width - barW) / 2;
    const y = 50;
    const ratio = Math.max(0, boss.hp / boss.maxHp);

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    _roundRect(ctx, x - 4, y - 4, barW + 8, barH + 8, 4);
    ctx.fill();

    const bossColor = boss.type === 'boss' ? '#ff0000' : '#ff8800';
    ctx.fillStyle = bossColor;
    ctx.fillRect(x, y, barW * ratio, barH);

    ctx.strokeStyle = bossColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, barW, barH);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    const label = boss.type === 'boss'
        ? `👹 BOSS  ${Math.ceil(boss.hp)} / ${boss.maxHp}`
        : `🐲 MINI-BOSS  ${Math.ceil(boss.hp)} / ${boss.maxHp}`;
    ctx.fillText(label, canvas.width / 2, y + 15);
    ctx.textAlign = 'left';
}

// ============================================================
//  CROSS-COMBO FLASH (world space center screen)
// ============================================================
export function drawComboFlash(ctx, canvas) {
    if (!comboFlash || comboFlash.alpha <= 0) return;

    comboFlash.timer--;
    comboFlash.alpha = Math.max(0, comboFlash.timer / 90);

    ctx.save();
    ctx.globalAlpha = comboFlash.alpha;

    // Big colored flash text
    ctx.shadowBlur = 30;
    ctx.shadowColor = comboFlash.color;
    ctx.fillStyle = comboFlash.color;
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`⚡ ${comboFlash.name.toUpperCase()} ⚡`, canvas.width / 2, canvas.height / 2 - 60);

    ctx.restore();
    ctx.textAlign = 'left';

    if (comboFlash.timer <= 0) comboFlash = null;
}

// ============================================================
//  TICKER (scrolling message)
// ============================================================
export function drawTicker(ctx, canvas, tickerMsg) {
    if (!tickerMsg.text) return;
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(tickerMsg.text, tickerMsg.x, canvas.height - SKILL_BAR_H - 14);
}

// ============================================================
//  QUIT BUTTON
// ============================================================
export function drawQuitButton(ctx, canvas) {
    quitButton.x = canvas.width - quitButton.w - 14;
    quitButton.y = 8;

    ctx.fillStyle = 'rgba(140,0,0,0.75)';
    _roundRect(ctx, quitButton.x, quitButton.y, quitButton.w, quitButton.h, 4);
    ctx.fill();
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1;
    _roundRect(ctx, quitButton.x, quitButton.y, quitButton.w, quitButton.h, 4);
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('QUIT', quitButton.x + quitButton.w / 2, quitButton.y + 20);
    ctx.textAlign = 'left';
}

// ============================================================
//  BESTIARY BUTTON (bottom right)
// ============================================================
export function drawBestiaryButton(ctx, canvas) {
    const x = canvas.width - 58;
    const y = canvas.height - SKILL_BAR_H + (SKILL_BAR_H - 44) / 2;
    bestiaryButton = { x, y, w: 44, h: 44 };

    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    _roundRect(ctx, x, y, 44, 44, 6);
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    _roundRect(ctx, x, y, 44, 44, 6);
    ctx.stroke();

    ctx.font = '22px serif';
    ctx.textAlign = 'center';
    ctx.fillText('📖', x + 22, y + 28);
    ctx.font = '7px "Courier New", monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('BESTIARY', x + 22, y + 42);
    ctx.textAlign = 'left';
}

// ============================================================
//  PORTAL
// ============================================================
export function drawPortal(ctx, portal) {
    if (!portal) return;
    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#00ffff';
    ctx.fillStyle = 'rgba(0,255,255,0.12)';
    ctx.fillRect(portal.x - 28, portal.y - 28, 56, 56);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(portal.x - 28, portal.y - 28, 56, 56);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'black'; ctx.lineWidth = 3;
    ctx.strokeText('PORTAL', portal.x, portal.y - 36);
    ctx.fillStyle = 'white';
    ctx.fillText('PORTAL', portal.x, portal.y - 36);
    ctx.restore();
}

// ============================================================
//  OVERLAY MESSAGE (wave announce, death, boss warning)
// ============================================================
export function drawOverlayMessage(ctx, canvas, message) {
    ctx.fillStyle = 'rgba(0,0,0,0.90)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = message.color || '#ffcc00';
    ctx.textAlign = 'center';
    ctx.font = `bold ${message.big ? 44 : 32}px "Courier New", monospace`;
    ctx.fillText(message.title, canvas.width / 2, canvas.height / 2 - 30);

    ctx.fillStyle = 'white';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(message.body, canvas.width / 2, canvas.height / 2 + 16);

    ctx.fillStyle = '#00ffcc';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('TAP OR CLICK TO CONTINUE', canvas.width / 2, canvas.height / 2 + 60);
    ctx.textAlign = 'left';
}

// ============================================================
//  DEATH SCREEN
// ============================================================
export function drawDeathScreen(ctx, canvas) {
    ctx.fillStyle = 'rgba(0,0,0,0.93)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff0044';
    ctx.font = 'bold 44px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('YOU DIED', canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillStyle = 'white';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('Your progress has been saved.', canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillStyle = '#00ffcc';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('TAP TO RESPAWN', canvas.width / 2, canvas.height / 2 + 55);
    ctx.textAlign = 'left';
}

// ============================================================
//  HUB ZONES
// ============================================================
export function drawHubZones(ctx, arenaSize) {
    const zones = [
        { x:-200, y:0,             color:'rgba(255,220,0,0.22)',  border:'#ffdd00', icon:'🛒', label:'SHOP'   },
        { x: 200, y:0,             color:'rgba(0,255,200,0.22)',  border:'#00ffcc', icon:'📚', label:'SKILLS' },
        { x: 0,   y:200,           color:'rgba(255,0,255,0.22)',  border:'#ff00ff', icon:'🪞', label:'STATS'  },
        { x: 0,   y:-arenaSize+60, color:'rgba(0,200,255,0.18)', border:'#00ccff', icon:'🌀', label:'READY'  },
    ];
    zones.forEach(z => {
        const r = 55;
        ctx.save();
        ctx.fillStyle = z.color;
        ctx.strokeStyle = z.border;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(z.x, z.y, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.font = '24px serif'; ctx.textAlign = 'center';
        ctx.fillText(z.icon, z.x, z.y + 8);
        ctx.fillStyle = 'white'; ctx.font = 'bold 10px "Courier New", monospace';
        ctx.fillText(z.label, z.x, z.y + r + 14);
        ctx.restore();
    });
}

// ============================================================
//  PLAYER TAG (world space)
// ============================================================
export function drawPlayerTag(ctx, player) {
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText(player.heroName || player.className, player.x, player.y - 28);
    ctx.textAlign = 'left';
}

// ============================================================
//  POISON ZONES (world space)
// ============================================================
export function drawPoisonZones(ctx, poisonZones) {
    poisonZones.forEach(z => {
        const elColor = getElementColor(z.element || 'poison');
        ctx.save();
        ctx.globalAlpha = z.alpha * (z.duration / 300);
        ctx.fillStyle = elColor;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    });
}

// ============================================================
//  ZOMBIES (world space)
// ============================================================
export function drawZombies(ctx, zombies) {
    zombies.forEach(z => {
        ctx.font = '26px serif';
        ctx.textAlign = 'center';
        ctx.fillText(z.emoji, z.x, z.y + 10);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(z.x - 18, z.y - 20, 36, 5);
        ctx.fillStyle = '#00ff44';
        ctx.fillRect(z.x - 18, z.y - 20, 36 * (z.hp / z.maxHp), 5);
    });
    ctx.textAlign = 'left';
}

// ============================================================
//  WAVE COUNTER
// ============================================================
export function drawWaveCounter(ctx, canvas, swarmTier, serverPhase) {
    if (serverPhase === 'HUB') {
        ctx.fillStyle = '#00ffcc';
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`HUB — Next: Tier ${swarmTier + 1}`, canvas.width - 16, 46);
        ctx.textAlign = 'left';
        return;
    }
    const isBoss = swarmTier > 0 && swarmTier % 10 === 0;
    const isMini = swarmTier > 0 && swarmTier % 5 === 0 && !isBoss;
    ctx.font = `bold ${isBoss ? 15 : 11}px "Courier New", monospace`;
    ctx.textAlign = 'right';
    ctx.fillStyle = isBoss ? '#ff4444' : isMini ? '#ffaa00' : '#ffffff88';
    const label = isBoss ? `⚠️ BOSS TIER ${swarmTier}` :
                  isMini ? `⚡ MINI-BOSS TIER ${swarmTier}` :
                           `TIER ${swarmTier}`;
    ctx.fillText(label, canvas.width - 16, 46);
    ctx.textAlign = 'left';
}

// ============================================================
//  CARD PICKER  (HTML overlay — injected into DOM)
//  Called when a level-up card pick is needed.
//  Returns a Promise that resolves with the chosen card.
// ============================================================
export function showCardPicker(cards) {
    return new Promise(resolve => {
        // Remove any existing picker
        document.getElementById('card-picker')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'card-picker';
        overlay.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,0.94);
            display:flex; flex-direction:column; align-items:center;
            justify-content:center; z-index:200; padding:16px;
            font-family:'Courier New',monospace;
        `;

        const title = document.createElement('div');
        title.style.cssText = `
            color:#ffcc00; font-size:clamp(16px,4vw,22px); letter-spacing:3px;
            font-weight:bold; margin-bottom:8px;
        `;
        title.textContent = '★ LEVEL UP — CHOOSE ONE ★';
        overlay.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.style.cssText = 'color:#555; font-size:10px; letter-spacing:2px; margin-bottom:24px;';
        subtitle.textContent = 'TAP A CARD TO SELECT';
        overlay.appendChild(subtitle);

        const row = document.createElement('div');
        row.style.cssText = `
            display:flex; gap:12px; width:100%; max-width:500px;
            justify-content:center; flex-wrap:wrap;
        `;

        cards.forEach(card => {
            const el = document.createElement('div');
            const typeColors = { class:'#00ffcc', weapon:'#ffaa00', item:'#cc88ff', element: card.color || '#ffffff' };
            const borderColor = typeColors[card.type] || '#444';

            el.style.cssText = `
                flex:1; min-width:120px; max-width:150px;
                background:#0a0a0a; border:2px solid ${borderColor};
                padding:16px 12px; cursor:pointer; transition:0.15s;
                display:flex; flex-direction:column; align-items:center;
                gap:8px; min-height:160px; border-radius:4px;
                -webkit-tap-highlight-color:transparent;
            `;

            // Type badge
            const badge = document.createElement('div');
            badge.style.cssText = `
                font-size:8px; letter-spacing:2px; color:${borderColor};
                font-weight:bold; align-self:flex-start;
            `;
            badge.textContent = card.type.toUpperCase();

            // Icon
            const icon = document.createElement('div');
            icon.style.cssText = 'font-size:36px; line-height:1;';
            icon.textContent = card.icon || '?';

            // Name
            const name = document.createElement('div');
            name.style.cssText = `color:${borderColor}; font-size:12px; font-weight:bold; text-align:center; letter-spacing:1px;`;
            name.textContent = card.name;

            // Desc
            const desc = document.createElement('div');
            desc.style.cssText = 'color:#666; font-size:10px; text-align:center; line-height:1.5; flex:1;';
            desc.textContent = card.desc;

            // Tier info for class cards
            if (card.type === 'class' && card.currentTier !== undefined) {
                const tier = document.createElement('div');
                tier.style.cssText = 'color:#888; font-size:9px;';
                tier.textContent = `TIER ${card.currentTier} → ${card.currentTier + 1}`;
                el.appendChild(badge); el.appendChild(icon); el.appendChild(name); el.appendChild(desc); el.appendChild(tier);
            } else {
                el.appendChild(badge); el.appendChild(icon); el.appendChild(name); el.appendChild(desc);
            }

            // Hover / press
            el.addEventListener('pointerover', () => {
                el.style.background = `${borderColor}18`;
                el.style.transform = 'translateY(-3px)';
                el.style.boxShadow = `0 0 20px ${borderColor}44`;
            });
            el.addEventListener('pointerout', () => {
                el.style.background = '#0a0a0a';
                el.style.transform = '';
                el.style.boxShadow = '';
            });

            el.addEventListener('click', () => {
                overlay.remove();
                resolve(card);
            });

            row.appendChild(el);
        });

        overlay.appendChild(row);
        document.body.appendChild(overlay);
    });
}

// ============================================================
//  BESTIARY DRAWER  (HTML slide-up panel)
// ============================================================
export function showBestiaryDrawer(bestiaryData) {
    document.getElementById('bestiary-drawer')?.remove();

    const drawer = document.createElement('div');
    drawer.id = 'bestiary-drawer';
    drawer.style.cssText = `
        position:fixed; bottom:0; left:0; right:0;
        background:#0a0a0a; border-top:2px solid #333;
        z-index:150; max-height:65vh; overflow-y:auto;
        font-family:'Courier New',monospace;
        transform:translateY(100%); transition:transform 0.25s ease;
        padding:16px 16px 100px;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;';
    header.innerHTML = `
        <span style="color:#ffcc00;font-size:14px;font-weight:bold;letter-spacing:2px">📖 BESTIARY</span>
        <button onclick="document.getElementById('bestiary-drawer').style.transform='translateY(100%)'"
            style="background:none;border:1px solid #444;color:#888;padding:4px 10px;cursor:pointer;font-family:'Courier New',monospace;font-size:11px">CLOSE</button>
    `;
    drawer.appendChild(header);

    const enemyTypes = ['goblin','skeleton','troll','wraith','miniboss','boss'];
    const emojis = { goblin:'👺', skeleton:'💀', troll:'👾', wraith:'👻', miniboss:'🐲', boss:'👹' };
    const names = { goblin:'GOBLIN', skeleton:'SKELETON', troll:'TROLL', wraith:'WRAITH', miniboss:'MINI-BOSS', boss:'BOSS' };

    enemyTypes.forEach(type => {
        const entry = bestiaryData?.getEntry(type);
        const row = document.createElement('div');
        row.style.cssText = `
            background:#111; border:1px solid #1e1e1e; padding:12px;
            margin-bottom:8px; display:flex; gap:12px; align-items:flex-start;
        `;

        const emoji = document.createElement('div');
        emoji.style.cssText = 'font-size:28px; flex-shrink:0;';
        emoji.textContent = emojis[type];

        const info = document.createElement('div');
        info.style.cssText = 'flex:1;';

        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'color:#ccc; font-size:12px; font-weight:bold; margin-bottom:6px;';
        nameEl.textContent = names[type];

        if (!entry) {
            const unknown = document.createElement('div');
            unknown.style.cssText = 'color:#444; font-size:10px;';
            unknown.textContent = '??? — No data yet. Fight this enemy with different elements.';
            info.appendChild(nameEl);
            info.appendChild(unknown);
        } else {
            const revealedEls = Object.entries(entry.revealed || {});

            if (entry.knownElement) {
                const elDef = ELEMENTS[entry.knownElement];
                const elTag = document.createElement('div');
                elTag.style.cssText = `color:${elDef?.color||'#fff'}; font-size:10px; margin-bottom:6px;`;
                elTag.textContent = `Element: ${elDef?.emoji || ''} ${elDef?.name || entry.knownElement}`;
                info.appendChild(nameEl);
                info.appendChild(elTag);
            } else {
                info.appendChild(nameEl);
            }

            if (revealedEls.length === 0) {
                const hint = document.createElement('div');
                hint.style.cssText = 'color:#444; font-size:10px;';
                hint.textContent = 'Keep testing elements to reveal strengths and weaknesses.';
                info.appendChild(hint);
            } else {
                const grid = document.createElement('div');
                grid.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px;';
                revealedEls.forEach(([el, data]) => {
                    const elDef = ELEMENTS[el];
                    const badge = document.createElement('div');
                    const isStrong = data.multiplier >= 1.5;
                    badge.style.cssText = `
                        background:${isStrong ? '#002200' : '#220000'};
                        border:1px solid ${isStrong ? '#00ff44' : '#ff4444'};
                        color:${isStrong ? '#00ff88' : '#ff6666'};
                        font-size:9px; padding:3px 7px; border-radius:2px;
                    `;
                    badge.textContent = `${elDef?.emoji||''} ${isStrong ? '▲' : '▼'} ${(data.multiplier).toFixed(1)}x`;
                    grid.appendChild(badge);
                });
                info.appendChild(grid);
            }
        }

        row.appendChild(emoji);
        row.appendChild(info);
        drawer.appendChild(row);
    });

    document.body.appendChild(drawer);
    requestAnimationFrame(() => {
        drawer.style.transform = 'translateY(0)';
    });
}

export function closeBestiaryDrawer() {
    const d = document.getElementById('bestiary-drawer');
    if (d) d.style.transform = 'translateY(100%)';
}

// ============================================================
//  SHOCKWAVE TICK (shared with game.js)
// ============================================================
export function updateShockwaves(shockwaves) {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const s = shockwaves[i];
        s.r += 4;
        s.alpha -= 0.025;
        if (s.alpha <= 0) shockwaves.splice(i, 1);
    }
}

// ============================================================
//  UTILITY — rounded rect path helper
// ============================================================
function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
