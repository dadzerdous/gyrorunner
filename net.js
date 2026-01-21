const WS_URL = "wss://gyrorunner-server.onrender.com"; // Keep your URL

let ws = null;
export let remotePlayers = {};
export let remoteEnemies = [];
export let portal = null; // New export
export let serverPhase = 'WAVE'; // New export
export let myId = null;

export function connectNet() {
  ws = new WebSocket(WS_URL);

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "welcome") myId = msg.id;
    if (msg.type === "state") {
      remotePlayers = msg.players;
      remoteEnemies = msg.enemies || [];
      portal = msg.portal;
      serverPhase = msg.phase || 'WAVE';
    }
  };
}

export function sendMove(x, y) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "move", x, y }));
}

export function sendHit(enemyId, damage) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "hit", enemyId, damage }));
}

// Tell server we are standing on the objective
export function sendReady(status) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "playerReady", status }));
}
