import { MapSystem } from './map.js';

const spireMap = new MapSystem(15); // 15-floor dungeon

function showRoomSelection() {
    gameState = 'MAP';
    const menu = document.getElementById('room-menu');
    menu.style.display = 'flex';
    
    const options = spireMap.getNextOptions();
    let html = `<h2>FLOOR ${spireMap.currentFloorIndex + 1}</h2><p>Choose your path:</p>`;
    
    options.forEach(type => {
        const icon = getRoomIcon(type);
        html += `<button onclick="window.startNextWave('${type}')">${icon} ${type}</button>`;
    });
    
    menu.innerHTML = html;
}

function getRoomIcon(type) {
    switch(type) {
        case 'Combat': return '⚔️';
        case 'Elite': return '💀';
        case 'Rest': return '🩸';
        case 'Mystery': return '❓';
        case 'Boss': return '👑';
        default: return '🚪';
    }
}

// Modify the global helper to handle different room effects
window.startNextWave = (type) => {
    if (type === 'Rest') {
        player.hp = Math.min(player.maxHp, player.hp + 5);
        showRoomSelection(); // Move to next floor immediately
        return;
    }
    
    if (type === 'Elite') {
        // Buff enemies for this wave
        arenaSize = 350; // Smaller arena for elites
    } else {
        arenaSize = 450;
    }

    currentWave++;
    spawnWave(currentWave);
};
