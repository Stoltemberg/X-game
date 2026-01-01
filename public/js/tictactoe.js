const socket = io();

// Join the Tic-Tac-Toe room
socket.emit('join_game', 'tictactoe');

const gameBoard = document.getElementById('game-board');
const statusDiv = document.getElementById('status');
const restartBtn = document.getElementById('restart-btn');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

let myRole = null;
// Store latest game state to handle race conditions between role assignment and game updates
let latestGameState = {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    gameActive: false
};

// Initialize board
for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell', 'w-full', 'h-24', 'bg-gray-700', 'rounded-lg', 'flex', 'items-center', 'justify-content-center', 'text-4xl', 'font-bold', 'cursor-pointer', 'hover:bg-gray-600', 'flex', 'justify-center', 'items-center');
    cell.dataset.index = i;
    cell.addEventListener('click', () => {
        if (myRole && myRole !== 'spectator') {
            socket.emit('make_move', i);
        }
    });
    gameBoard.appendChild(cell);
}

function updateUI() {
    const { board, currentPlayer, gameActive } = latestGameState;
    const isMyTurn = (myRole === currentPlayer);

    // Update board UI
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
        cell.textContent = board[index] || '';
        cell.className = 'cell w-full h-24 rounded-lg flex items-center justify-center text-5xl font-bold cursor-pointer transition transform ';

        if (board[index] === 'X') {
            cell.classList.add('bg-gray-700', 'text-blue-400');
        } else if (board[index] === 'O') {
            cell.classList.add('bg-gray-700', 'text-purple-400');
        } else {
            cell.classList.add('bg-gray-700', 'hover:bg-gray-600');
        }
    });

    // Update Status
    if (gameActive) {
        if (myRole === 'spectator') {
            statusDiv.textContent = `Spectating - It's ${currentPlayer}'s turn`;
            statusDiv.className = 'mb-4 text-xl font-semibold text-gray-300';
        } else {
            const roleText = myRole ? `(You are ${myRole}) ` : '';
            statusDiv.textContent = isMyTurn ? `${roleText}It's your turn!` : `${roleText}Waiting for opponent (${currentPlayer})...`;
            statusDiv.className = isMyTurn ? 'mb-4 text-xl font-bold text-green-400 animate-pulse' : 'mb-4 text-xl font-semibold text-gray-300';
        }
        restartBtn.classList.add('hidden');
    } else {
        if (myRole === 'spectator') {
            statusDiv.textContent = 'Game not active';
            statusDiv.className = 'mb-4 text-xl font-semibold text-gray-400';
        } else if (myRole) {
            statusDiv.textContent = `You are Player ${myRole}. Waiting for opponent to join...`;
            statusDiv.className = 'mb-4 text-xl font-semibold text-yellow-500';
        } else {
            statusDiv.textContent = 'Connecting...';
            statusDiv.className = 'mb-4 text-xl font-semibold text-gray-400';
        }
    }
}

// Socket Events

socket.on('player_role', (role) => {
    console.log('Role assigned:', role);
    myRole = role;
    updateUI();
});

socket.on('game_start', (data) => {
    console.log('Game Start');
});

socket.on('game_update', (gameState) => {
    console.log('Game Update:', gameState);
    latestGameState = gameState;
    updateUI();
});

socket.on('game_over', ({ winner, board }) => {
    latestGameState.board = board;
    latestGameState.gameActive = false;
    updateUI(); // Render final board state

    // Override status for game over
    if (winner === 'draw') {
        statusDiv.textContent = "It's a Draw!";
        statusDiv.className = 'mb-4 text-xl font-bold text-yellow-400';
    } else {
        statusDiv.textContent = winner === myRole ? "You Win! 🎉" : `${winner} Wins!`;
        statusDiv.className = winner === myRole ? 'mb-4 text-2xl font-bold text-green-500' : 'mb-4 text-2xl font-bold text-red-500';
    }

    if (myRole !== 'spectator') {
        restartBtn.classList.remove('hidden');
    }
});

socket.on('player_left', () => {
    console.log('Player left');
    statusDiv.textContent = 'Opponent left. Game Over.';
    statusDiv.className = 'mb-4 text-xl font-bold text-red-500';
    latestGameState.gameActive = false;
    latestGameState.board = Array(9).fill(null);
    updateUI();
});

socket.on('chat_message', ({ id, role, text }) => {
    const msgDiv = document.createElement('div');
    const isMe = id === socket.id;

    msgDiv.className = `p-2 rounded-lg mb-2 max-w-[80%] ${isMe ? 'bg-blue-600 ml-auto' : 'bg-gray-600'}`;

    const header = document.createElement('div');
    header.className = 'text-xs opacity-75 mb-1';
    header.textContent = isMe ? 'You' : (role === 'spectator' ? 'Spectator' : `Player ${role}`);

    const content = document.createElement('div');
    content.textContent = text;

    msgDiv.appendChild(header);
    msgDiv.appendChild(content);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Event Listeners

restartBtn.addEventListener('click', () => {
    socket.emit('restart_game');
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) {
        socket.emit('chat_message', text);
        chatInput.value = '';
    }
});
