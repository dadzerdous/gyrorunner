// ui.js

// CONFIG: Button Layout
const ICON_SIZE = 50;
const PADDING = 10;
const HOTBAR_Y_OFFSET = 80; // Distance from bottom

export const skillButtons = [
    { key: 'fireBurst', label: '1', color: '#ff4400', icon: '🔥' },
    { key: 'flameDash', label: '2', color: '#ffffff', icon: '💨' },
    { key: 'moltenGuard', label: '3', color: '#00ccff', icon: '🛡' },
    { key: 'inferno', label: '4', color: '#ff0000', icon: '☠️' }
];

export function drawSkillBar(ctx, canvas, player) {
    const totalWidth = (ICON_SIZE * 4) + (PADDING * 3);
    const startX = (canvas.width / 2) - (totalWidth / 2);
    const y = canvas.height - HOTBAR_Y_OFFSET;

    skillButtons.forEach((btn, index) => {
        const x = startX + (index * (ICON_SIZE + PADDING));
        const skill = player.skills[btn.key];
        
        // Store coordinates for mouse click detection
        btn.rect = { x, y, w: ICON_SIZE, h: ICON_SIZE };

        // 1. Background / Frame
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(x, y, ICON_SIZE, ICON_SIZE);
        ctx.strokeStyle = skill.unlocked ? '#666' : '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, ICON_SIZE, ICON_SIZE);

        // 2. Icon
        if (skill.unlocked) {
            ctx.fillStyle = btn.color;
            ctx.font = "24px serif";
            ctx.textAlign = "center";
            ctx.fillText(btn.icon, x + ICON_SIZE/2, y + 32);
        } else {
            ctx.fillStyle = '#333';
            ctx.font = "24px serif";
            ctx.textAlign = "center";
            ctx.fillText('🔒', x + ICON_SIZE/2, y + 32);
        }

        // 3. Cooldown Overlay (The "Clock" Wipe)
        if (skill.cooldown > 0) {
            const ratio = skill.cooldown / skill.maxCD;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x, y + (ICON_SIZE * (1 - ratio)), ICON_SIZE, ICON_SIZE * ratio);
            
            // Cooldown Text
            ctx.fillStyle = 'white';
            ctx.font = "bold 14px monospace";
            ctx.fillText(Math.ceil(skill.cooldown / 20), x + ICON_SIZE/2, y + 30);
        }

        // 4. Hotkey Label
        ctx.fillStyle = '#ffff00';
        ctx.font = "10px monospace";
        ctx.fillText(btn.label, x + ICON_SIZE - 8, y + 12);
    });
}

// NEW PORTAL VISUAL
export function drawPortal(ctx, portal) {
    if (!portal) return;

    // 1x1 Glowing Square (50x50)
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#00ffff';
    ctx.fillStyle = 'rgba(0, 255, 255, 0.2)'; // Faint center
    ctx.fillRect(portal.x - 25, portal.y - 25, 50, 50);
    
    // Border
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(portal.x - 25, portal.y - 25, 50, 50);
    
    ctx.shadowBlur = 0; // Reset glow for text

    // Text with Stroke (Border)
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'black'; // Black Border
    ctx.strokeText("PORTAL", portal.x, portal.y - 35);
    ctx.fillStyle = 'white';   // White Text
    ctx.fillText("PORTAL", portal.x, portal.y - 35);
}

// ... Keep drawHUD, drawTicker, drawOverlayMessage from previous step ...
export function drawHUD(ctx, canvas, player) {
    // HP Bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(20, canvas.height - 40, 200, 20);
    ctx.fillStyle = '#ff0044'; ctx.fillRect(20, canvas.height - 40, 200 * (player.hp / player.maxHp), 20);
    // XP Bar
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(20, 20, canvas.width - 40, 8);
    ctx.fillStyle = '#ffcc00'; ctx.fillRect(20, 20, (canvas.width - 40) * (player.xp / player.xpToNext), 8);
    // Text Stats
    ctx.fillStyle = '#00ffcc'; ctx.font = "bold 18px monospace"; ctx.textAlign = "left";
    ctx.fillText(`LVL ${player.level} | ${player.avatar || '?'} FIRE | 💰 ${player.gold}`, 20, 50);
}

export function drawTicker(ctx, canvas, tickerMsg) {
    if (tickerMsg.text) {
        ctx.fillStyle = '#ffcc00'; ctx.font = "bold 24px monospace";
        ctx.fillText(tickerMsg.text, tickerMsg.x, canvas.height - 80);
    }
}

export function drawOverlayMessage(ctx, canvas, message) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffcc00'; ctx.textAlign = 'center'; ctx.font = "bold 40px monospace";
    ctx.fillText(message.title, canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillStyle = 'white'; ctx.font = "20px monospace";
    ctx.fillText(message.body, canvas.width / 2, canvas.height / 2 + 30);
    ctx.fillStyle = '#00ffcc'; ctx.fillText("TAP OR CLICK TO CONTINUE", canvas.width / 2, canvas.height / 2 + 100);
}

export function drawHubZones(ctx, arenaSize) {
    ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; ctx.fillRect(-225, -25, 50, 50);
    ctx.fillStyle = 'white'; ctx.fillText("🛒", -210, 10);
    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'; ctx.fillRect(-25, -225, 50, 50);
    ctx.fillText("💪", -10, -190);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.2)'; ctx.fillRect(arenaSize - 100, -arenaSize, 100, arenaSize*2);
    ctx.fillText("EXIT ➡", arenaSize - 250, 0);
}
