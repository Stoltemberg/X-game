const socket = io();
socket.emit('join_game', 'battleship');

const myBoard = document.getElementById('my-board');
const enemyBoard = document.getElementById('enemy-board');
const statusDiv = document.getElementById('status');
const randomizeBtn = document.getElementById('randomize-btn');
const readyBtn = document.getElementById('ready-btn');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const controlsDiv = document.getElementById('controls');

let myRole = null;
let gamePhase = 'setup'; // 'setup', 'waiting', 'battle', 'gameover'
let myShips = []; // Indices of current ships
let myHits = [];
let myMisses = [];
let enemyHits = [];
let enemyMisses = [];
let isMyTurn = false;

// Initialize Grids
function createGrid(element, isEnemy = false) {
    element.innerHTML = '';
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell bg-gray-700 rounded-sm cursor-pointer hover:bg-gray-600 transition';
        cell.dataset.index = i;
        if (isEnemy) {
            cell.addEventListener('click', () => handleAttack(i));
        }
        element.appendChild(cell);
    }
}

createGrid(myBoard);
createGrid(enemyBoard, true);

// Setup Logic
function randomizeShips() {
    // Simple logic: pick 5 random distinct indices for now (Demo version)
    // Real battleship has sizes (5,4,3,3,2). Let's just pick 17 random spots for simplicity or implement proper placement?
    // Let's implement proper simple placement for 5 ships (sizes 5,4,3,3,2)
    myShips = [];
    const sizes = [5, 4, 3, 3, 2];

    // Clear board visual - Remove ALL ship/green classes and reset to default gray
    document.querySelectorAll('#my-board .grid-cell').forEach(c => {
        c.classList.remove('ship', 'bg-green-500');
        c.classList.add('bg-gray-700');
    });

    for (let size of sizes) {
        let placed = false;
        while (!placed) {
            const horizontal = Math.random() < 0.5;
            const start = Math.floor(Math.random() * 100);
            const x = start % 10;
            const y = Math.floor(start / 10);

            // Check boundaries
            if (horizontal && x + size > 10) continue;
            if (!horizontal && y + size > 10) continue;

            const indices = [];
            let overlap = false;
            for (let i = 0; i < size; i++) {
                let idx = horizontal ? start + i : start + (i * 10);
                if (myShips.includes(idx)) { overlap = true; break; }
                indices.push(idx);
            }

            if (!overlap) {
                myShips.push(...indices);
                placed = true;
            }
        }
    }

    // Draw
    myShips.forEach(idx => {
        const cell = myBoard.children[idx];
        cell.classList.remove('bg-gray-700');
        cell.classList.add('bg-green-500'); // Explicit Tailwind class for visibility
    });
}

randomizeShips();

randomizeBtn.addEventListener('click', randomizeShips);
readyBtn.addEventListener('click', () => {
    socket.emit('battleship_ready', myShips);
    gamePhase = 'waiting';
    controlsDiv.classList.add('hidden');
    statusDiv.textContent = 'Waiting for opponent...';
});

function handleAttack(index) {
    if (gamePhase !== 'battle' || !isMyTurn) return;
    // Optimistic UI update or wait for server? Wait for server response recommended
    socket.emit('battleship_attack', index);
}

// Socket Events
socket.on('player_role', (role) => {
    myRole = role;
    if (role === 'p1' || role === 'p2') {
        statusDiv.textContent = `Place your ships!`;
    } else {
        statusDiv.textContent = 'Spectating';
        controlsDiv.classList.add('hidden');
    }
});

socket.on('battleship_start', ({ turn }) => {
    gamePhase = 'battle';
    isMyTurn = (turn === myRole);
    statusDiv.textContent = isMyTurn ? 'Battle Started! Your Turn! Attack Enemy Waters.' : 'Battle Started! Enemy Turn.';
    enemyBoard.classList.remove('opacity-50', 'cursor-not-allowed');
});

socket.on('battleship_update', ({ turn }) => {
    isMyTurn = (turn === myRole);
    statusDiv.textContent = isMyTurn ? 'Your Turn!' : 'Enemy Turn...';
});

socket.on('attack_result', ({ shooter, index, hit }) => {
    const board = shooter === myRole ? enemyBoard : myBoard;
    const cell = board.children[index];

    if (hit) {
        cell.classList.remove('bg-gray-700', 'bg-green-500');
        cell.classList.add('bg-red-500'); // Red for hit
    } else {
        cell.classList.remove('bg-gray-700');
        cell.classList.add('bg-blue-500'); // Blue for miss
    }
});

socket.on('game_over', ({ winner }) => {
    gamePhase = 'gameover';
    statusDiv.textContent = winner === myRole ? 'VICTORY! All enemy ships sunk.' : 'DEFEAT! Your fleet is destroyed.';
    enemyBoard.classList.add('opacity-50', 'cursor-not-allowed');
});

// Chat
socket.on('chat_message', ({ id, role, text }) => {
    const msgDiv = document.createElement('div');
    const isMe = id === socket.id;
    msgDiv.className = `p-2 rounded-lg mb-2 max-w-[80%] ${isMe ? 'bg-pink-600 ml-auto' : 'bg-gray-600'}`;
    const header = document.createElement('div');
    header.className = 'text-xs opacity-75 mb-1';
    header.textContent = isMe ? 'You' : role;
    const content = document.createElement('div');
    content.textContent = text;
    msgDiv.appendChild(header);
    msgDiv.appendChild(content);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) {
        socket.emit('chat_message', text);
        chatInput.value = '';
    }
});
