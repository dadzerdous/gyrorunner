// map.js
// ============================================================
//  SPIRE ONLINE — MAP SYSTEM
//  Procedural 3000x3000 world with:
//  - Terrain chunks (obstacles, decoration)
//  - Enemy clusters (clearing pushes corruption back)
//  - Corruption fog (creeps inward from edges)
//  - Purge Stones (3 per level, activate to beat level)
//  - XP gem drops
// ============================================================

export const MAP_SIZE = 3000; // half-extent — world is -3000 to +3000
export const SAFE_ZONE_RADIUS = 200; // center safe area (hub)

// ============================================================
//  TERRAIN CHUNK TYPES
// ============================================================
const TERRAIN_TYPES = [
    { type: 'ruins',   emoji: '🏚️', w: 80,  h: 80,  solid: true,  color: '#2a2020' },
    { type: 'rock',    emoji: '🪨', w: 60,  h: 60,  solid: true,  color: '#1e1e1e' },
    { type: 'tree',    emoji: '🌲', w: 40,  h: 40,  solid: false, color: '#0a1a0a' },
    { type: 'crystal', emoji: '💎', w: 50,  h: 50,  solid: false, color: '#0a0a2a' },
    { type: 'shrine',  emoji: '⛩️', w: 70,  h: 70,  solid: true,  color: '#1a1020' },
    { type: 'bones',   emoji: '🦴', w: 30,  h: 30,  solid: false, color: '#111' },
];

// ============================================================
//  PROCEDURAL MAP GENERATOR
// ============================================================
export class MapSystem {
    static generate(seed = Date.now()) {
        const rng = _seededRng(seed);
        const map = {
            seed,
            size: MAP_SIZE,
            terrain: [],
            enemyClusters: [],
            purgeStones: [],
            decorations: [],
        };

        // ── Terrain chunks ──
        const terrainCount = 180;
        for (let i = 0; i < terrainCount; i++) {
            const t = TERRAIN_TYPES[Math.floor(rng() * TERRAIN_TYPES.length)];
            let x, y;
            let attempts = 0;
            do {
                x = (rng() * 2 - 1) * (MAP_SIZE - 200);
                y = (rng() * 2 - 1) * (MAP_SIZE - 200);
                attempts++;
            } while (Math.hypot(x, y) < SAFE_ZONE_RADIUS + 100 && attempts < 20);

            map.terrain.push({
                x, y, w: t.w, h: t.h,
                type: t.type, emoji: t.emoji,
                solid: t.solid, color: t.color,
            });
        }

        // ── Enemy clusters (12 spread across map) ──
        const clusterPositions = _spreadPoints(12, MAP_SIZE - 300, SAFE_ZONE_RADIUS + 200, rng);
        clusterPositions.forEach((pos, idx) => {
            const types = ['goblin','skeleton','troll','wraith'];
            const primary = types[Math.floor(rng() * types.length)];
            map.enemyClusters.push({
                id: `cluster_${idx}`,
                x: pos.x, y: pos.y,
                radius: 200 + rng() * 100,
                enemyCount: 6 + Math.floor(rng() * 8),
                primaryType: primary,
                cleared: false,
                // Clearing this cluster pushes corruption back in its area
                corruptionPushRadius: 350 + rng() * 150,
            });
        });

        // ── Purge Stones (3, roughly equally spaced, away from center) ──
        const stoneAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
        stoneAngles.forEach((angle, idx) => {
            const dist = MAP_SIZE * 0.55 + rng() * MAP_SIZE * 0.15;
            const jitter = (rng() - 0.5) * 0.4;
            map.purgeStones.push({
                id: `stone_${idx}`,
                x: Math.cos(angle + jitter) * dist,
                y: Math.sin(angle + jitter) * dist,
                activated: false,
                progress: 0,      // 0-1 channel progress
                channelTime: 300, // frames to channel (5s at 60fps)
                guardCount: 4 + idx * 2, // more guards per stone
            });
        });

        // ── Decorations (non-solid flavor) ──
        for (let i = 0; i < 80; i++) {
            const emojis = ['🌿','🍄','💀','🕸️','🌑','⛰️','🪦','🌾'];
            map.decorations.push({
                x: (rng() * 2 - 1) * (MAP_SIZE - 100),
                y: (rng() * 2 - 1) * (MAP_SIZE - 100),
                emoji: emojis[Math.floor(rng() * emojis.length)],
                scale: 0.6 + rng() * 0.8,
            });
        }

        return map;
    }

    // Check solid terrain collision
    static checkCollision(x, y, radius, terrain) {
        for (const t of terrain) {
            if (!t.solid) continue;
            if (x + radius > t.x && x - radius < t.x + t.w &&
                y + radius > t.y && y - radius < t.y + t.h) {
                return true;
            }
        }
        return false;
    }

    // Returns initial enemy spawn list from clusters
    static getClusterEnemies(cluster, waveScale = 1) {
        const enemies = [];
        for (let i = 0; i < cluster.enemyCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist  = 40 + Math.random() * (cluster.radius * 0.7);
            enemies.push({
                type: i === 0 ? cluster.primaryType : _randomEnemyType(cluster.primaryType),
                x: cluster.x + Math.cos(angle) * dist,
                y: cluster.y + Math.sin(angle) * dist,
                clusterId: cluster.id,
                waveScale,
            });
        }
        return enemies;
    }
}

// ============================================================
//  CORRUPTION SYSTEM
//  Tracks corruption state — server owns the authoritative
//  version, client mirrors for rendering.
// ============================================================
export class CorruptionSystem {
    constructor(mapSize) {
        this.mapSize    = mapSize;
        this.radius     = mapSize + 200; // starts beyond map edge
        this.minRadius  = 80;            // how small it can get (= run over)
        this.speed      = 0.18;          // units per frame inward creep
        this.pushedBack = {};            // clusterId -> push amount remaining
        this.active     = true;
        this.runOver    = false;

        // Corruption is circular for simplicity — radius shrinks over time
        // When all 3 purge stones activated it reverses
        this.reversing  = false;
        this.reverseSpeed = 0.4;
    }

    tick(clearedClusterIds = []) {
        if (!this.active || this.runOver) return;

        if (this.reversing) {
            // Corruption retreats after all purge stones activated
            this.radius = Math.min(this.mapSize + 400, this.radius + this.reverseSpeed);
            return;
        }

        // Shrink radius
        this.radius -= this.speed;

        // Apply push-backs from cleared clusters
        for (const [id, push] of Object.entries(this.pushedBack)) {
            if (push > 0) {
                this.radius += push * 0.002; // gradual push-back
                this.pushedBack[id] = Math.max(0, push - 1);
            }
        }

        if (this.radius <= this.minRadius) {
            this.runOver = true;
        }
    }

    // Called when a cluster is cleared
    pushBack(cluster) {
        this.pushedBack[cluster.id] = cluster.corruptionPushRadius;
    }

    // Called when all 3 purge stones are activated
    startReversing() {
        this.reversing = true;
    }

    // Is this world position inside the corruption?
    isCorrupted(x, y) {
        return Math.hypot(x, y) > this.radius;
    }

    // Damage to deal per frame when in corruption
    getDamage() { return 0.06; }

    // Progress 0-1 for UI (how closed the corruption is)
    getProgress() {
        const total = this.mapSize + 200;
        return 1 - Math.max(0, Math.min(1, (this.radius - this.minRadius) / (total - this.minRadius)));
    }

    serialize() {
        return { radius: this.radius, reversing: this.reversing, runOver: this.runOver };
    }

    applySync(data) {
        if (!data) return;
        this.radius    = data.radius    ?? this.radius;
        this.reversing = data.reversing ?? this.reversing;
        this.runOver   = data.runOver   ?? this.runOver;
    }
}

// ============================================================
//  PURGE STONE SYSTEM
// ============================================================
export class PurgeStoneSys {
    constructor(stones) {
        this.stones = stones.map(s => ({ ...s }));
    }

    // Update channel progress for a stone (called on server)
    channelStone(stoneId, playersNearby, dt = 1) {
        const stone = this.stones.find(s => s.id === stoneId);
        if (!stone || stone.activated) return null;

        if (playersNearby > 0) {
            stone.progress += dt / stone.channelTime;
            if (stone.progress >= 1) {
                stone.progress  = 1;
                stone.activated = true;
                return { activated: true, stoneId };
            }
        } else {
            // Decay if no one is channeling
            stone.progress = Math.max(0, stone.progress - dt / (stone.channelTime * 0.5));
        }
        return null;
    }

    allActivated() {
        return this.stones.every(s => s.activated);
    }

    getStone(id) {
        return this.stones.find(s => s.id === id);
    }

    serialize() {
        return this.stones.map(s => ({
            id: s.id, x: s.x, y: s.y,
            activated: s.activated, progress: s.progress,
        }));
    }
}

// ============================================================
//  XP GEM SYSTEM
// ============================================================
export class GemSystem {
    constructor() {
        this.gems = []; // { id, x, y, value, color, radius, lifetime }
    }

    // Spawn gems on enemy death
    spawnFromKill(x, y, enemyType) {
        const values = { goblin:3, skeleton:4, troll:6, wraith:5, miniboss:30, boss:100 };
        const val = values[enemyType] || 3;

        // Scatter 1-3 gems
        const count = enemyType === 'boss' ? 5 : enemyType === 'miniboss' ? 3 : 1;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spread = Math.random() * 40;
            this.gems.push({
                id: Math.random().toString(36).slice(2),
                x: x + Math.cos(angle) * spread,
                y: y + Math.sin(angle) * spread,
                value: Math.ceil(val / count),
                color: _gemColor(val),
                radius: val >= 20 ? 14 : val >= 8 ? 10 : 7,
                lifetime: 600, // 10 seconds at 60fps
                pulse: Math.random() * Math.PI * 2, // phase offset for pulse anim
            });
        }
    }

    // Check collection (called per frame per player)
    collectNear(px, py, collectRadius = 60) {
        const collected = [];
        for (let i = this.gems.length - 1; i >= 0; i--) {
            const g = this.gems[i];
            if (Math.hypot(g.x - px, g.y - py) < collectRadius) {
                collected.push(g);
                this.gems.splice(i, 1);
            }
        }
        return collected;
    }

    tick() {
        for (let i = this.gems.length - 1; i >= 0; i--) {
            this.gems[i].lifetime--;
            this.gems[i].pulse += 0.08;
            if (this.gems[i].lifetime <= 0) this.gems.splice(i, 1);
        }
    }

    serialize() {
        return this.gems.map(g => ({
            id: g.id, x: g.x, y: g.y,
            value: g.value, color: g.color, radius: g.radius,
            pulse: g.pulse, lifetime: g.lifetime,
        }));
    }

    applySync(data) {
        if (!data) return;
        // Merge — add new gems from server, remove collected ones
        const serverIds = new Set(data.map(g => g.id));
        this.gems = this.gems.filter(g => serverIds.has(g.id));
        data.forEach(sg => {
            if (!this.gems.find(g => g.id === sg.id)) {
                this.gems.push({ ...sg });
            }
        });
    }
}

// ============================================================
//  MAP RENDERING HELPERS (called from game.js draw loop)
// ============================================================
export function drawMap(ctx, map, corruption) {
    if (!map) return;

    // ── Floor ──
    ctx.fillStyle = '#0b0916';
    ctx.fillRect(-map.size, -map.size, map.size * 2, map.size * 2);

    // Subtle tile grid
    ctx.strokeStyle = '#12102a';
    ctx.lineWidth = 0.5;
    const tileSize = 200;
    for (let x = -map.size; x <= map.size; x += tileSize) {
        ctx.beginPath(); ctx.moveTo(x, -map.size); ctx.lineTo(x, map.size); ctx.stroke();
    }
    for (let y = -map.size; y <= map.size; y += tileSize) {
        ctx.beginPath(); ctx.moveTo(-map.size, y); ctx.lineTo(map.size, y); ctx.stroke();
    }

    // ── Decorations ──
    map.decorations.forEach(d => {
        ctx.font = `${Math.floor(16 * d.scale)}px serif`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.4;
        ctx.fillText(d.emoji, d.x, d.y);
        ctx.globalAlpha = 1;
    });

    // ── Terrain ──
    map.terrain.forEach(t => {
        // Background fill
        ctx.fillStyle = t.color || '#111';
        ctx.fillRect(t.x - t.w/2, t.y - t.h/2, t.w, t.h);
        // Emoji
        ctx.font = `${Math.floor(t.w * 0.6)}px serif`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.85;
        ctx.fillText(t.emoji, t.x, t.y + t.h * 0.2);
        ctx.globalAlpha = 1;
        // Solid border
        if (t.solid) {
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            ctx.strokeRect(t.x - t.w/2, t.y - t.h/2, t.w, t.h);
        }
    });

    // ── Enemy cluster markers (uncleated only) ──
    map.enemyClusters.forEach(cl => {
        if (cl.cleared) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,60,0,0.18)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(cl.x, cl.y, cl.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    });

    ctx.textAlign = 'left';
}

export function drawPurgeStones(ctx, stones) {
    if (!stones) return;
    const now = Date.now();

    stones.forEach(stone => {
        if (stone.activated) {
            // Activated — glowing pillar
            ctx.save();
            ctx.shadowBlur  = 40;
            ctx.shadowColor = '#00ffcc';
            ctx.font = '38px serif';
            ctx.textAlign = 'center';
            ctx.fillText('✨', stone.x, stone.y + 12);
            ctx.font = 'bold 9px "Courier New", monospace';
            ctx.fillStyle = '#00ffcc';
            ctx.fillText('PURIFIED', stone.x, stone.y - 30);
            ctx.restore();
        } else {
            // Pulse ring
            const pulse = Math.sin(now / 800) * 0.3 + 0.7;
            ctx.save();
            ctx.globalAlpha = pulse * 0.5;
            ctx.strokeStyle = '#ff4400';
            ctx.lineWidth   = 3;
            ctx.beginPath();
            ctx.arc(stone.x, stone.y, 55 + Math.sin(now/600)*8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.font = '32px serif';
            ctx.textAlign = 'center';
            ctx.fillText('🗿', stone.x, stone.y + 10);

            // Channel progress arc
            if (stone.progress > 0) {
                ctx.strokeStyle = '#00ffcc';
                ctx.lineWidth   = 5;
                ctx.shadowBlur  = 15;
                ctx.shadowColor = '#00ffcc';
                ctx.beginPath();
                ctx.arc(stone.x, stone.y, 38, -Math.PI/2, -Math.PI/2 + stone.progress * Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Label
            ctx.fillStyle = '#ff8800';
            ctx.font = 'bold 9px "Courier New", monospace';
            ctx.fillText('PURGE STONE', stone.x, stone.y - 35);
            ctx.fillStyle = '#666';
            ctx.font = '8px "Courier New", monospace';
            ctx.fillText('STAND TO CHANNEL', stone.x, stone.y - 24);
            ctx.restore();
        }
        ctx.textAlign = 'left';
    });
}

export function drawGems(ctx, gems) {
    if (!gems) return;
    gems.forEach(g => {
        const scale = 1 + Math.sin(g.pulse) * 0.15;
        const alpha = g.lifetime < 120 ? g.lifetime / 120 : 1;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowBlur  = 10 * scale;
        ctx.shadowColor = g.color;

        ctx.beginPath();
        ctx.arc(g.x, g.y, g.radius * scale, 0, Math.PI * 2);
        ctx.fillStyle = g.color;
        ctx.fill();

        // Inner highlight
        ctx.beginPath();
        ctx.arc(g.x - g.radius * 0.25, g.y - g.radius * 0.25, g.radius * 0.3 * scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();

        ctx.restore();
    });
}

export function drawCorruption(ctx, corruption, mapSize) {
    if (!corruption || corruption.radius >= mapSize + 200) return;

    const r = corruption.radius;
    const now = Date.now();

    // Dark fog beyond corruption radius — radial gradient
    ctx.save();

    // Outer solid black
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(-mapSize - 500, -mapSize - 500, (mapSize + 500) * 2, (mapSize + 500) * 2);

    // Cut out the safe circle using composite
    ctx.globalCompositeOperation = 'destination-out';
    const fadeGrad = ctx.createRadialGradient(0, 0, Math.max(0, r - 200), 0, 0, r);
    fadeGrad.addColorStop(0, 'rgba(0,0,0,1)');
    fadeGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fadeGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';

    // Corruption edge glow
    const edgeGrad = ctx.createRadialGradient(0, 0, r - 120, 0, 0, r + 80);
    edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(0.5, `rgba(80,0,140,${0.4 + Math.sin(now/400)*0.1})`);
    edgeGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = edgeGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r + 80, 0, Math.PI * 2);
    ctx.fill();

    // Tendrils (animated sine wobble on edge)
    ctx.strokeStyle = `rgba(120,0,200,${0.3 + Math.sin(now/300)*0.1})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 20]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
}

export function drawCorruptionHUD(ctx, canvas, corruption) {
    if (!corruption) return;
    const progress = corruption.getProgress?.() ?? 0;
    if (progress <= 0) return;

    const barW = Math.min(160, canvas.width * 0.25);
    const x    = canvas.width / 2 - barW / 2;
    const y    = 8;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x, y, barW, 8);
    ctx.fillStyle = corruption.reversing
        ? '#00ffcc'
        : `rgb(${Math.floor(140 + progress * 115)},0,${Math.floor(180 - progress * 100)})`;
    ctx.fillRect(x, y, barW * progress, 8);

    ctx.fillStyle = corruption.reversing ? '#00ffcc' : '#cc44ff';
    ctx.font = '8px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(corruption.reversing ? 'CORRUPTION RETREATING' : 'CORRUPTION', canvas.width / 2, y + 18);
    ctx.textAlign = 'left';
}

export function drawPurgeStoneHUD(ctx, canvas, stones) {
    if (!stones) return;
    const total     = stones.length;
    const activated = stones.filter(s => s.activated).length;

    ctx.fillStyle = '#00ffcc88';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
        `🗿 PURGE STONES  ${activated} / ${total}`,
        canvas.width / 2, 32
    );

    // Small stone icons
    const iconW = 20;
    const startX = canvas.width / 2 - (total * (iconW + 4)) / 2;
    stones.forEach((s, i) => {
        const ix = startX + i * (iconW + 4);
        ctx.fillStyle = s.activated ? '#00ffcc' : s.progress > 0 ? '#ff8800' : '#333';
        ctx.fillRect(ix, 36, iconW, 5);
        if (s.progress > 0 && !s.activated) {
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(ix, 36, iconW * s.progress, 5);
        }
    });

    ctx.textAlign = 'left';
}

// ============================================================
//  MINIMAP (top right corner)
// ============================================================
export function drawMinimap(ctx, canvas, player, corruption, stones, clusters, mapSize) {
    const mm = 110; // minimap size px
    const mx = canvas.width  - mm - 10;
    const my = 50;
    const scale = mm / (mapSize * 2);

    ctx.save();

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(mx, my, mm, mm);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mm, mm);

    // Corruption circle
    if (corruption && corruption.radius < mapSize + 200) {
        const cr = corruption.radius * scale;
        const cx = mx + mm / 2;
        const cy = my + mm / 2;
        ctx.fillStyle = 'rgba(80,0,140,0.35)';
        ctx.fillRect(mx, my, mm, mm);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0, cr), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    // Clusters
    if (clusters) {
        clusters.forEach(cl => {
            const cx = mx + mm/2 + cl.x * scale;
            const cy = my + mm/2 + cl.y * scale;
            ctx.fillStyle = cl.cleared ? '#003300' : '#330000';
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Purge stones
    if (stones) {
        stones.forEach(s => {
            const sx = mx + mm/2 + s.x * scale;
            const sy = my + mm/2 + s.y * scale;
            ctx.fillStyle = s.activated ? '#00ffcc' : '#ff8800';
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Player dot
    const px = mx + mm/2 + player.x * scale;
    const py = my + mm/2 + player.y * scale;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(
        Math.max(mx + 3, Math.min(mx + mm - 3, px)),
        Math.max(my + 3, Math.min(my + mm - 3, py)),
        3, 0, Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
}

// ============================================================
//  HELPERS
// ============================================================
function _seededRng(seed) {
    let s = seed;
    return function() {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

function _spreadPoints(count, maxDist, minDist, rng) {
    const points = [];
    let attempts = 0;
    while (points.length < count && attempts < count * 20) {
        attempts++;
        const angle = rng() * Math.PI * 2;
        const dist  = minDist + rng() * (maxDist - minDist);
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        // Ensure min separation between clusters
        const tooClose = points.some(p => Math.hypot(p.x - x, p.y - y) < 350);
        if (!tooClose) points.push({ x, y });
    }
    return points;
}

function _randomEnemyType(preferred) {
    const all = ['goblin','skeleton','troll','wraith'];
    return Math.random() < 0.6 ? preferred : all[Math.floor(Math.random() * all.length)];
}

function _gemColor(value) {
    if (value >= 50) return '#ff88ff'; // legendary — pink
    if (value >= 20) return '#ffcc00'; // rare — gold
    if (value >= 8)  return '#00ccff'; // uncommon — blue
    return '#44ff88';                  // common — green
}
