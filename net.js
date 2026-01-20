// net.js
const WS_URL = "wss://gyrorunner-server.onrender.com";

let ws = null;
export let remotePlayers = {};
export let myId = null; // Ensure this is exported

export function connectNet() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("[net] connected to server");
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === "welcome") {
      myId = msg.id; // This updates the exported binding
      console.log("[net] my id:", myId);
    }

    if (msg.type === "state") {
      remotePlayers = msg.players;
    }
  };
}

export function sendMove(x, y) {
  if (!ws || ws.readyState !== 1) return;

  ws.send(JSON.stringify({
    type: "move",
    x,
    y
  }));
}
