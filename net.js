const WS_URL = "wss://gyrorunner-server.onrender.com";

let ws = null;
export let remotePlayers = {};
export let remoteEnemies = [];
export let myId = null;

export function connectNet() {
  ws = new WebSocket(WS_URL);

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "welcome") {
      myId = msg.id; //
    }
    if (msg.type === "state") {
      remotePlayers = msg.players; //
      remoteEnemies = msg.enemies || [];
    }
  };
}

export function sendMove(x, y) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "move", x, y })); //
  }
}

// New function to notify server of a hit
export function sendHit(enemyId, damage) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "hit", enemyId, damage }));
  }
}
