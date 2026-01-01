const socket = io();
const game = new Chess();
let board = null;
let myRole = null; // 'white', 'black', 'spectator'

const statusDiv = document.getElementById('status');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

// Join Chess Room
socket.emit('join_game', 'chess');

function onDragStart(source, piece, position, orientation) {
    // do not pick up pieces if the game is over
    if (game.game_over()) return false;

    // only pick up pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }

    // Only allow player to move their own pieces
    if ((game.turn() === 'w' && myRole !== 'white') ||
        (game.turn() === 'b' && myRole !== 'black')) {
        return false;
    }
}

function onDrop(source, target) {
    // see if the move is legal
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q' // NOTE: always promote to a queen for example simplicity
    });

    // illegal move
    if (move === null) return 'snapback';

    // Broadcast move
    socket.emit('chess_move', {
        from: source,
        to: target,
        promotion: 'q',
        fen: game.fen()
    });

    updateStatus();
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd() {
    board.position(game.fen());
}

function updateStatus() {
    var status = '';

    var moveColor = 'White';
    if (game.turn() === 'b') {
        moveColor = 'Black';
    }

    // checkmate?
    if (game.in_checkmate()) {
        status = 'Game over, ' + moveColor + ' is in checkmate.';
    }
    // draw?
    else if (game.in_draw()) {
        status = 'Game over, drawn position';
    }
    // game still on
    else {
        status = moveColor + ' to move';
        if (game.in_check()) {
            status += ', ' + moveColor + ' is in check';
        }
    }

    if (myRole === 'spectator') {
        statusDiv.textContent = `Spectating. ${status}`;
    } else {
        const myColor = myRole === 'white' ? 'White' : 'Black';
        statusDiv.textContent = `You are ${myColor}. ${status}`;
    }
}

const config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};

board = Chessboard('myBoard', config);

// Socket Events

socket.on('player_role', (role) => {
    myRole = role;
    if (role === 'black') {
        board.orientation('black');
    }
    updateStatus();
});

socket.on('chess_move', (move) => {
    // Sync other clients
    game.move(move);
    board.position(game.fen());
    updateStatus();

    // Play move sound?
});

socket.on('room_joined', (roomName) => {
    console.log('Joined room:', roomName);
});

socket.on('chat_message', ({ id, role, text }) => {
    const msgDiv = document.createElement('div');
    const isMe = id === socket.id;
    msgDiv.className = `p-2 rounded-lg mb-2 max-w-[80%] ${isMe ? 'bg-purple-600 ml-auto' : 'bg-gray-600'}`;
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
