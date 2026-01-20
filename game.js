let currentWave = 1;
let gameState = 'WAVE'; // 'WAVE', 'UPGRADE', 'MAP'

const roomTypes = {
    COMBAT: { name: "Dark Woods", reward: "XP Boost" },
    ELITE: { name: "Vampire Crypt", reward: "Artifact" },
    REST: { name: "Blood Altar", reward: "Heal" }
};

function endWave() {
    gameState = 'UPGRADE';
    showUpgradeScreen();
}

function startNextRoom(choice) {
    currentWave++;
    gameState = 'WAVE';
    spawnWave(currentWave, choice);
}
