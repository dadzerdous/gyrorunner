export function drawHUD(ctx, canvas, player) {
    // HP Bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; 
    ctx.fillRect(20, canvas.height - 40, 200, 20);
    ctx.fillStyle = '#ff0044'; 
    ctx.fillRect(20, canvas.height - 40, 200 * (player.hp / player.maxHp), 20);
    
    // XP Bar
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; 
    ctx.fillRect(20, 20, canvas.width - 40, 8);
    ctx.fillStyle = '#ffcc00'; 
    ctx.fillRect(20, 20, (canvas.width - 40) * (player.xp / player.xpToNext), 8);
    
    // Stats Text
    ctx.fillStyle = '#00ffcc'; 
    ctx.font = "bold 18px monospace"; 
    ctx.textAlign = "left";
    ctx.fillText(`LVL ${player.level} | ${player.avatar || '?'} FIRE | 💰 ${player.gold}`, 20, 50);
}

export function drawTicker(ctx, canvas, tickerMsg) {
    if (tickerMsg.text) {
        ctx.fillStyle = '#ffcc00'; 
        ctx.font = "bold 24px monospace";
        ctx.fillText(tickerMsg.text, tickerMsg.x, canvas.height - 80);
    }
}

export function drawOverlayMessage(ctx, canvas, message) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ffcc00';
    ctx.textAlign = 'center';
    ctx.font = "bold 40px monospace";
    ctx.fillText(message.title, canvas.width / 2, canvas.height / 2 - 20);
    
    ctx.fillStyle = 'white';
    ctx.font = "20px monospace";
    ctx.fillText(message.body, canvas.width / 2, canvas.height / 2 + 30);
    
    ctx.fillStyle = '#00ffcc';
    ctx.fillText("TAP OR CLICK TO CONTINUE", canvas.width / 2, canvas.height / 2 + 100);
}
