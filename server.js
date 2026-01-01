const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

// Global state for simple room management
// Rooms format: { [roomId]: { type: 'tictactoe'|'chess'|'battleship', players: {}, gameState: {} } }
const rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_game', (gameType) => {
        // Find a room with available space for this game type
        let roomName = null;
        for (const [id, room] of Object.entries(rooms)) {
            if (room.type === gameType && Object.keys(room.players).length < 2) {
                roomName = id;
                break;
            }
        }

        // If no room found, create one
        if (!roomName) {
            roomName = `${gameType}_${Date.now()}`;
            rooms[roomName] = {
                type: gameType,
                players: {},
                state: initializeGameState(gameType)
            };
        }

        socket.join(roomName);
        const room = rooms[roomName];

        // Assign Role
        const existingRoles = Object.values(room.players);
        let role;

        if (gameType === 'tictactoe') {
            role = !existingRoles.includes('X') ? 'X' : 'O';
        } else if (gameType === 'chess') {
            role = !existingRoles.includes('white') ? 'white' : 'black';
        } else if (gameType === 'battleship') {
            role = !existingRoles.includes('p1') ? 'p1' : 'p2';
        }

        room.players[socket.id] = role;
        socket.emit('player_role', role);
        socket.emit('room_joined', roomName); // Notify client of room name

        // Check if game should start
        if (Object.keys(room.players).length === 2) {
            room.state.gameActive = true;
            io.to(roomName).emit('game_start', { players: Object.values(room.players) });
            io.to(roomName).emit('game_update', room.state);
        } else {
            io.to(roomName).emit('game_update', room.state);
        }

        // Handle Disconnect
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            if (rooms[roomName] && rooms[roomName].players[socket.id]) {
                delete rooms[roomName].players[socket.id];
                // Reset or Pausing game logic depending on game? 
                // For now, simple logic: stop game
                rooms[roomName].state.gameActive = false;
                if (gameType === 'tictactoe') rooms[roomName].state.board = Array(9).fill(null);

                io.to(roomName).emit('player_left');
                io.to(roomName).emit('game_update', rooms[roomName].state);

                // Cleanup empty room
                if (Object.keys(rooms[roomName].players).length === 0) {
                    delete rooms[roomName];
                }
            }
        });

        // --- Tic-Tac-Toe Events ---
        if (gameType === 'tictactoe') {
            socket.on('make_move', (index) => {
                const r = rooms[roomName];
                if (!r || !r.state.gameActive || r.state.board[index] || r.players[socket.id] !== r.state.currentPlayer) return;

                r.state.board[index] = r.players[socket.id]; // 'X' or 'O'
                const winner = checkTicTacToeWin(r.state.board);

                if (winner) {
                    r.state.gameActive = false;
                    io.to(roomName).emit('game_over', { winner, board: r.state.board });
                } else {
                    r.state.currentPlayer = r.state.currentPlayer === 'X' ? 'O' : 'X';
                    io.to(roomName).emit('game_update', r.state);
                }
            });

            socket.on('restart_game', () => {
                const r = rooms[roomName];
                if (r && r.players[socket.id]) {
                    r.state.board = Array(9).fill(null);
                    r.state.currentPlayer = 'X';
                    r.state.gameActive = true;
                    io.to(roomName).emit('game_update', r.state);
                }
            });
        } else if (gameType === 'chess') {
            socket.on('chess_move', (move) => {
                const r = rooms[roomName];
                if (r) {
                    // Broadcast to room
                    socket.broadcast.to(roomName).emit('chess_move', move);
                }
            });
        } else if (gameType === 'battleship') {
            socket.on('battleship_ready', (ships) => {
                const r = rooms[roomName];
                if (!r) return;

                r.state.ships = r.state.ships || {};
                r.state.ships[socket.id] = ships; // Array of indices

                // If both ready, start
                if (Object.keys(r.state.ships).length === 2) {
                    r.state.gameActive = true;
                    r.state.turn = 'p1'; // p1 starts
                    // Map p1/p2 to socket ids
                    const p1Id = Object.keys(r.players).find(key => r.players[key] === 'p1');
                    r.state.turnId = p1Id;

                    io.to(roomName).emit('battleship_start', { turn: 'p1' });
                }
            });

            socket.on('battleship_attack', (index) => {
                const r = rooms[roomName];
                if (!r || !r.state.gameActive || socket.id !== r.state.turnId) return;

                const opponentId = Object.keys(r.players).find(key => key !== socket.id);
                const opponentShips = r.state.ships[opponentId];

                const hit = opponentShips.includes(index);

                // Track hits
                r.state.hits = r.state.hits || {};
                r.state.hits[opponentId] = r.state.hits[opponentId] || [];
                r.state.hits[opponentId].push(index);

                io.to(roomName).emit('attack_result', { shooter: r.players[socket.id], index, hit });

                // Check Win (all opponent ships hit)
                const allSunk = opponentShips.every(idx => r.state.hits[opponentId].includes(idx));
                if (allSunk) {
                    r.state.gameActive = false;
                    io.to(roomName).emit('game_over', { winner: r.players[socket.id] });
                } else {
                    // Switch turn
                    r.state.turn = r.state.turn === 'p1' ? 'p2' : 'p1';
                    r.state.turnId = opponentId;
                    io.to(roomName).emit('battleship_update', { turn: r.state.turn });
                }
            });
        }

        // --- Shared Chat ---
        socket.on('chat_message', (msg) => {
            const r = rooms[roomName];
            if (r) {
                io.to(roomName).emit('chat_message', { id: socket.id, role: r.players[socket.id] || 'Spectator', text: msg });
            }
        });
    });
});

function initializeGameState(type) {
    if (type === 'tictactoe') {
        return {
            board: Array(9).fill(null),
            currentPlayer: 'X',
            gameActive: false
        };
    } else if (type === 'chess') {
        return {
            // Placeholder for chess state
            fen: 'start',
            turn: 'w',
            gameActive: false
        }
    } else if (type === 'battleship') {
        return {
            // Placeholder for battleship
            gameActive: false
        }
    }
    return {};
}

function checkTicTacToeWin(board) {
    const winConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (let condition of winConditions) {
        let [a, b, c] = condition;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return board.includes(null) ? null : 'draw';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
