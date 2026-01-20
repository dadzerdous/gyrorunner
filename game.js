import { Player, Enemy } from './entities.js';
import { InputHandler } from './input.js';
import { CombatSystem, AbilitySystem } from './systems.js';

// --- INITIALIZATION ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const input = new InputHandler();
const player = new Player();
const combat = new CombatSystem();

// --- GAME STATE ---
let gameState = 'WAVE'; // WAVE, UPGRADE, MAP
let currentWave = 1;
let arenaSize = 450;
let enemies = [];
let gems = [];
let shockwaves = [];
let enemyBullets = [];

// --- UI ELEMENTS ---
const hud = document.getElementById('hud');
const upgradeMenu = document.getElementById('upgrade-menu');
const roomMenu = document.getElementById('room-menu');

// --- CORE FUNCTIONS ---

function spawnWave(waveNum) {
    enemies = [];
    // Ratio: 5 Goblins (Melee) to 1 Archer (Ranged)
    const count = 5 + (waveNum * 3);
    for (let i = 0; i < count; i++) {
        const type = (i % 6 === 0) ? 'archer' : 'goblin';
        enemies.push(new Enemy(type, arenaSize));
    }
    gameState = 'WAVE';
}

function handleCollisions() {
    // Enemy-Player Collision
    enemies.forEach(en => {
        const d = Math.hypot(en.x - player.x, en.y - player.y);
        if (d < 30 && !player.isJumping) {
            player.hp -= 0.05; // Continuous damage or use invulnTimer logic
        }
    });

    // Gem Collection
    for (let i = gems.length - 1; i >= 0; i--) {
        const g = gems[i];
        const d = Math.hypot(g.x - player.x, g.y - player.y);
        if (d < 150) { // Magnetism
            g.x += (player.x - g.x) * 0.1;
            g.y += (player.y - g.y) * 0.1;
        }
        if (d < 20) {
            player.xp++;
            gems.splice(i, 1);
        }
    }
}

function update(time) {
    if (gameState !== 'WAVE') return;

    // 1. Process Skills (Action Commands)
    const cmd = input.consumeCommand();
    AbilitySystem.resolveCommand(cmd, player, shockwaves);

    // 2. Move Player (Joystick/WASD)
    player.x += input.moveDir.x * player.speed;
    player.y += input.moveDir.y * player.speed;
    
    // Arena Constraint
    player.x = Math.max(-arenaSize, Math.min(arenaSize, player.x));
    player.y = Math.max(-arenaSize, Math.min(arenaSize, player.y));

    // 3. Jump Logic (Gravity Simulation)
    if (player.isJumping) {
        player.jumpTime--;
        if (player.jumpTime === 0) {
            player.isJumping = false;
            shockwaves.push({ x: player.x, y: player.y, r: 10, op: 1 });
        }
    }

    // 4. Update Combat Systems
    combat.updateWeapons(player, enemies, time);
    combat.updateProjectiles(enemies, arenaSize);

    // 5. Update Entities
    enemies.forEach(en => {
        // Simple logic here or move to a separate controller
        const dx = player.x - en.x;
        const dy = player.y - en.y;
        const d = Math.hypot(dx, dy);
        en.x += (dx / d) * en.speed;
        en.y += (dy / d) * en.speed;
    });

    // 6. Manage Shockwaves
    shockwaves.forEach((sw, i) => {
        sw.r += 5; sw.op -= 0.02;
        enemies.forEach((en, ei) => {
            if (Math.abs(Math.hypot(en.x - sw.x, en.y - sw.y) - sw.r) < 20) {
                en.hp -= 10; // High stomp damage
            }
        });
        if (sw.op <= 0) shockwaves.splice(i, 1);
    });

    // 7. Cleanup & XP Spawn
    enemies = enemies.filter(en => {
        if (en.hp <= 0) {
            gems.push({ x: en.x, y: en.y });
            return false;
        }
        return true;
    });

    handleCollisions();

    // 8. End Wave Condition
    if (enemies.length === 0 && currentWave > 0) {
        transitionToUpgrade();
    }
}

function transitionToUpgrade() {
    gameState = 'UPGRADE';
    document.getElementById('upgrade-menu').style.display = 'flex';
    // Logic to generate 3 random cards based on player.xp
}

function draw() {
    ctx.fillStyle = '#050208';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Draw Arena
    ctx.strokeStyle = '#331144';
    ctx.lineWidth = 5;
    ctx.strokeRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);

    // Draw Gems
    ctx.font = '16px serif';
    gems.forEach(g => ctx.fillText('💎', g.x - 8, g.y + 8));

    // Draw Enemies
    enemies.forEach(en => {
        ctx.font = '24px serif';
        ctx.fillText(en.type === 'archer' ? '🏹' : '🧟', en.x - 12, en.y + 12);
    });

    // Draw Projectiles
    combat.projectiles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    // Draw Shockwaves
    shockwaves.forEach(sw => {
        ctx.strokeStyle = `rgba(0, 255, 204, ${sw.op})`;
        ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2); ctx.stroke();
    });

    // Draw Player
    let scale = player.isJumping ? 1.5 : 1;
    ctx.font = (30 * scale) + 'px serif';
    ctx.fillText('🧛', player.x - 15, player.y + 15);

    ctx.restore();

    // Joystick UI
    if (input.joystickActive) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.strokeRect(input.touchStart.x - 25, input.touchStart.y - 25, 50, 50);
    }
}

function ticker(time) {
    update(time);
    draw();
    requestAnimationFrame(ticker);
}

// Start Game
spawnWave(currentWave);
requestAnimationFrame(ticker);
