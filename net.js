// net.js
const WS_URL = "wss://gyrorunner-server.onrender.com";

let ws = null;
export let remotePlayers = {};
export let remoteEnemies = [];
export let portal = null;
export let serverPhase = 'WAVE';
export let myId = null;

export let hasReceivedFirstState = false;
export let netDebug = {
    connectStartedAt: 0,
    socketOpenedAt: 0,
    welcomeAt: 0,
    firstStateAt: 0
};

export function connectNet() {
    if (ws) ws.close();

    hasReceivedFirstState = false;
    netDebug = {
        connectStartedAt: performance.now(),
        socketOpenedAt: 0,
        welcomeAt: 0,
        firstStateAt: 0
    };

    console.log("[NET] connectNet() called");
    console.log(`[NET] connecting to ${WS_URL}`);

    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        netDebug.socketOpenedAt = performance.now();
        console.log(
            `[NET] socket open after ${(netDebug.socketOpenedAt - netDebug.connectStartedAt).toFixed(1)} ms`
        );
    };

    ws.onerror = (err) => {
        console.error("[NET] socket error", err);
    };

    ws.onclose = (e) => {
        console.log(`[NET] socket closed code=${e.code} reason=${e.reason || "(none)"}`);
    };

    ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);

        if (msg.type === "welcome") {
            myId = msg.id;
            window._myId = msg.id;
            netDebug.welcomeAt = performance.now();
            console.log(
                `[NET] welcome after ${(netDebug.welcomeAt - netDebug.connectStartedAt).toFixed(1)} ms | myId=${myId}`
            );
        }

        if (msg.type === "state") {
            remotePlayers = msg.players || {};
            remoteEnemies = msg.enemies || [];
            portal = msg.portal;
            serverPhase = msg.phase || 'WAVE';

            if (!hasReceivedFirstState) {
                hasReceivedFirstState = true;
                netDebug.firstStateAt = performance.now();

                console.log(
                    `[NET] FIRST state after ${(netDebug.firstStateAt - netDebug.connectStartedAt).toFixed(1)} ms`
                );
                console.log(
                    `[NET] first state details | phase=${serverPhase} | enemies=${remoteEnemies.length} | players=${Object.keys(remotePlayers).length} | portal=${portal ? "yes" : "no"}`
                );
            }
        }
    };
}
export function isConnected() {
    return ws && ws.readyState === 1;
}

export function disconnectNet() {
    if (ws) { ws.close(); ws = null; }
    remotePlayers = {};
    remoteEnemies = [];
    portal = null;
}

export function sendMove(x, y) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "move", x, y }));
}

export function sendHit(enemyId, damage) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "hit", enemyId, damage }));
}

export function sendReady(status) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "playerReady", status }));
}

export function sendProfile(avatar, className, heroName) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "profile", avatar, className, heroName }));
}
