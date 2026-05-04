// net.js
const WS_URL = "wss://gyrorunner-server.onrender.com";

let ws = null;
export let remotePlayers  = {};
export let remoteEnemies  = [];
export let remoteGems     = [];
export let portal         = null;
export let serverPhase    = 'WAITING';
export let myId           = null;
export let myLobbyCode    = null;
export let isHost         = false;
export let lobbyRoster    = [];

export let hasReceivedFirstState = false;
export let serverInitialized     = false;

export let netDebug = {
    connectStartedAt: 0,
    socketOpenedAt:   0,
    welcomeAt:        0,
    firstStateAt:     0,
};

let _onRosterUpdate    = null;
let _onGameStart       = null;
let _onLoading         = null;
let _onError           = null;
let _onHostTransferred = null;

export function setCallbacks(cbs) {
    if (cbs.rosterUpdate)    _onRosterUpdate    = cbs.rosterUpdate;
    if (cbs.gameStart)       _onGameStart       = cbs.gameStart;
    if (cbs.loading)         _onLoading         = cbs.loading;
    if (cbs.error)           _onError           = cbs.error;
    if (cbs.hostTransferred) _onHostTransferred = cbs.hostTransferred;
}

function _connect(onOpen) {
    if (ws) ws.close();

    hasReceivedFirstState = false;
    serverInitialized     = false;
    netDebug = { connectStartedAt:performance.now(), socketOpenedAt:0, welcomeAt:0, firstStateAt:0 };

    console.log(`[NET] connecting to ${WS_URL}`);
    ws = new WebSocket(WS_URL);
    window._rawWs = ws;

    ws.onopen = () => {
        netDebug.socketOpenedAt = performance.now();
        console.log(`[NET] open after ${(netDebug.socketOpenedAt-netDebug.connectStartedAt).toFixed(1)}ms`);
        onOpen?.();
    };

    ws.onerror = (err) => console.error('[NET] error', err);
    ws.onclose = (e)   => console.log(`[NET] closed code=${e.code}`);

    ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);

        if (msg.type === 'welcome') {
            myId        = msg.id;
            myLobbyCode = msg.lobbyCode;
            isHost      = msg.isHost || false;
            lobbyRoster = msg.roster || [];
            window._myId = msg.id;
            netDebug.welcomeAt = performance.now();
            console.log(`[NET] welcome id=${myId} lobby=${myLobbyCode} host=${isHost}`);
            // Treat welcome roster as first rosterUpdate
            _onRosterUpdate?.(lobbyRoster);
        }

        if (msg.type === 'rosterUpdate') {
            lobbyRoster = msg.roster || [];
            _onRosterUpdate?.(lobbyRoster);
        }

        if (msg.type === 'loading')         _onLoading?.();
        if (msg.type === 'gameStart')       _onGameStart?.(msg);
        if (msg.type === 'hostTransferred') { isHost = true; _onHostTransferred?.(); }
        if (msg.type === 'error')           { console.warn('[NET] server error:', msg.message); _onError?.(msg.message); }

        if (msg.type === 'state') {
            remotePlayers = msg.players || {};
            remoteEnemies = msg.enemies || [];
            remoteGems    = msg.gems    || [];
            portal        = msg.portal  || null;
            serverPhase   = msg.phase   || 'WAITING';

            if (msg.initialized && !serverInitialized) {
                serverInitialized = true;
                console.log('[NET] server initialized — enemies ready');
            }

            if (!hasReceivedFirstState) {
                hasReceivedFirstState = true;
                netDebug.firstStateAt = performance.now();
                console.log(`[NET] FIRST state | phase=${serverPhase} enemies=${remoteEnemies.length}`);
            }
        }
    };
}

export function createLobby(avatar, className, heroName, activeElements, isPrivate=false) {
    _connect(() => ws.send(JSON.stringify({ type:'createLobby', avatar, className, heroName, activeElements, private:isPrivate })));
}

export function joinLobbyByCode(code, avatar, className, heroName, activeElements) {
    _connect(() => ws.send(JSON.stringify({ type:'joinLobby', code, avatar, className, heroName, activeElements })));
}

export function quickJoin(avatar, className, heroName, activeElements) {
    _connect(() => ws.send(JSON.stringify({ type:'quickJoin', avatar, className, heroName, activeElements })));
}

export function sendStartGame() {
    if (ws && ws.readyState===1) ws.send(JSON.stringify({ type:'startGame' }));
}

export function isConnected() {
    return ws && ws.readyState === 1;
}

export function disconnectNet() {
    if (ws) { ws.close(); ws=null; }
    remotePlayers={}; remoteEnemies=[]; remoteGems=[];
    portal=null; serverPhase='WAITING';
    serverInitialized=false; hasReceivedFirstState=false;
}

export function sendMove(x, y) {
    if (ws && ws.readyState===1) ws.send(JSON.stringify({ type:'move', x, y }));
}

export function sendHit(enemyId, damage) {
    if (ws && ws.readyState===1) ws.send(JSON.stringify({ type:'hit', enemyId, damage }));
}

export function sendReady(status) {
    if (ws && ws.readyState===1) ws.send(JSON.stringify({ type:'playerReady', status }));
}

export function sendProfile(avatar, className, heroName, activeElements) {
    if (ws && ws.readyState===1) ws.send(JSON.stringify({ type:'profile', avatar, className, heroName, activeElements }));
}
