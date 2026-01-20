const WS_URL = "wss://gyrorunner-server.onrender.com";

let ws = null;
export let remotePlayers = {};
export let remoteEnemies = []; // New export for synced monsters
export let myId = null;

export function connectNet() {
  ws = new WebSocket(WS_URL);

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === "welcome") {
      myId = msg.id;
    }

    if (msg.type === "state") {
      remotePlayers = msg.players;
      remoteEnemies = msg.enemies; // Syncing enemies from server
    }
  };
}

export function sendMove(x, y) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: "move", x, y }));
  }
}
