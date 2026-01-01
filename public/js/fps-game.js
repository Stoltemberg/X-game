const socket = io();

// --- UI Elements ---
const lobbyScreen = document.getElementById('lobby-screen');
const lobbyListEl = document.getElementById('lobby-list');
const createBtn = document.getElementById('create-btn');
const refreshBtn = document.getElementById('refresh-btn');
const scoreboard = document.getElementById('scoreboard');
const scoreboardBody = document.getElementById('scoreboard-body');
const healthEl = document.getElementById('health');
const shieldEl = document.getElementById('shield');
const blocker = document.getElementById('blocker');
const playBtn = document.getElementById('play-btn');

// --- Graphics Globals ---
let camera, scene, renderer, controls;
// let composer, bloomPass; // Unused for now or setup later
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, canJump = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();
let lastStep = 0;

// --- Game Assets ---
let weaponMesh = null;
let currentWeapon = 'pistol'; // pistol, rifle, railgun

// --- Game State ---
let players = {}; // id -> mesh
let powerups = {}; // id -> mesh
let colliders = []; // Array of Box3 for walls
let myId = null;
let isRunning = false;
let audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- Sound System ---
const Sound = {
    shoot: (type) => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'rifle') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'railgun') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(50, now + 1.5);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
            osc.start(now);
            osc.stop(now + 1.5);
        } else {
            // Pistol
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        }
    },
    step: () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        osc.frequency.setValueAtTime(50, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);

        osc.start(now);
        osc.stop(now + 0.05);
    }
};

// --- Lobby Logic ---
// refreshLobbies(); // Moved to connect event

refreshBtn.addEventListener('click', () => {
    console.log('Refreshing lobbies...');
    refreshLobbies();
});

createBtn.addEventListener('click', () => {
    console.log('Requesting Quick Play...');
    // Send only type to trigger server-side auto-match
    socket.emit('join_game', { type: 'fps' });
});

function refreshLobbies() {
    console.log('Emitting get_lobbies');
    socket.emit('get_lobbies', 'fps');
}

socket.on('lobby_list', (lobbies) => {
    console.log('Received lobby_list:', lobbies);
    lobbyListEl.innerHTML = '';
    if (lobbies.length === 0) {
        lobbyListEl.innerHTML = '<div class="text-gray-500 text-center">No active lobbies found.</div>';
        return;
    }

    lobbies.forEach(lobby => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-gray-700 p-3 rounded hover:bg-gray-600 cursor-pointer transition';
        div.innerHTML = `
            <span class="text-white font-mono">${lobby.id}</span>
            <span class="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">${lobby.count} Players</span>
        `;
        div.onclick = () => {
            console.log('Joining lobby:', lobby.id);
            socket.emit('join_game', { type: 'fps', roomId: lobby.id });
        };
        lobbyListEl.appendChild(div);
    });
});

socket.on('room_joined', (roomName) => {
    // Hide Lobby, Show Game Intro
    lobbyScreen.style.display = 'none';
    blocker.style.display = 'flex';
});

// --- Main Game Init ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.Fog(0x050510, 0, 750);

    // Light
    const light = new THREE.HemisphereLight(0xffffff, 0x444444);
    light.position.set(0, 200, 0);
    scene.add(light);

    // POV
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);

    // Weapon Model (Attached to Camera)
    createWeaponModel();
    scene.add(camera); // Add camera to scene

    // Controls
    controls = new THREE.PointerLockControls(camera, document.body);
    playBtn.addEventListener('click', () => {
        controls.lock();
    });

    controls.addEventListener('lock', () => {
        blocker.style.display = 'none';
    });

    controls.addEventListener('unlock', () => {
        blocker.style.display = 'flex';
    });
    scene.add(controls.getObject());

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
    floorGeometry.rotateX(-Math.PI / 2);
    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x111111, wireframe: true, transparent: true, opacity: 0.3 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    scene.add(floor);

    // City Generation
    generateCity();

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Events
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousedown', onMouseDown);

    socket.on('connect', () => {
        myId = socket.id;
        console.log('Connected! ID:', myId);
        refreshLobbies();
    });

    animate();
}

// --- Game Loop ---
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked) {
        const speedMultiplier = isRunning ? 2.0 : 1.0;
        const baseSpeed = 400.0 * speedMultiplier;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 100.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * baseSpeed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * baseSpeed * delta;

        // Footsteps
        if ((moveForward || moveLeft || moveRight || moveBackward) && controls.getObject().position.y === 10) {
            // Rate depends on speed
            const rate = isRunning ? 250 : 500;
            if (time - lastStep > rate) {
                Sound.step();
                lastStep = time;
            }
        }


        // Predictive Movement w/ Collision checking
        // We move in X and Z separately to allow sliding

        const originalPos = controls.getObject().position.clone();

        // X Movement
        controls.moveRight(-velocity.x * delta);
        if (checkCollision(controls.getObject().position)) {
            velocity.x = 0;
            controls.getObject().position.x = originalPos.x; // Revert X
        }

        // Z Movement
        controls.moveForward(-velocity.z * delta);
        if (checkCollision(controls.getObject().position)) {
            velocity.z = 0;
            controls.getObject().position.z = originalPos.z; // Revert Z
        }

        controls.getObject().position.y += (velocity.y * delta); // Jump

        if (controls.getObject().position.y < 10) {
            velocity.y = 0;
            controls.getObject().position.y = 10;
            canJump = true;
        }

        // Unstuck Loop: If stuck inside something, push up?
        if (checkCollision(controls.getObject().position)) {
            // We are likely stuck inside a spawn object?
            // Move to safe zone
            if (controls.getObject().position.y === 10) { // Only if on ground
                controls.getObject().position.set(0, 100, 0); // Respawn air
                velocity.y = 0;
            }
        }

        socket.emit('fps_move', {
            x: controls.getObject().position.x,
            y: controls.getObject().position.y,
            z: controls.getObject().position.z
        });

        Object.keys(powerups).forEach(pid => {
            if (controls.getObject().position.distanceTo(powerups[pid].position) < 5) {
                socket.emit('fps_collect', pid);
            }
        });

        // Weapon bob
        if (weaponMesh && (moveForward || moveLeft || moveRight || moveBackward)) {
            weaponMesh.position.y = -1.5 + Math.sin(time * 0.01) * 0.1;
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}

// --- Input Handling ---
function onKeyDown(event) {
    if (event.code === 'Tab') {
        event.preventDefault();
        scoreboard.classList.remove('hidden');
    }
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = true; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
        case 'ArrowDown': case 'KeyS': moveBackward = true; break;
        case 'ArrowRight': case 'KeyD': moveRight = true; break;
        case 'Space': if (canJump === true) velocity.y += 350; canJump = false; break;
        case 'ShiftLeft': case 'ShiftRight': isRunning = true; break;
    }
}

function onKeyUp(event) {
    if (event.code === 'Tab') {
        event.preventDefault();
        scoreboard.classList.add('hidden');
    }
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = false; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
        case 'ArrowDown': case 'KeyS': moveBackward = false; break;
        case 'ArrowRight': case 'KeyD': moveRight = false; break;
        case 'ShiftLeft': case 'ShiftRight': isRunning = false; break;
    }
}

function onMouseDown(event) {
    if (!controls.isLocked) return;

    Sound.shoot(currentWeapon);

    // Weapon Animation (Recoil)
    if (weaponMesh) {
        weaponMesh.position.z += 0.5;
        setTimeout(() => weaponMesh.position.z -= 0.5, 100);
    }

    // 1. Calculate Gun Tip Position (World Space)
    let startPos = new THREE.Vector3();
    if (weaponMesh) {
        const muzzle = weaponMesh.getObjectByName('muzzle');
        if (muzzle) {
            muzzle.getWorldPosition(startPos);
        } else {
            // Fallback
            weaponMesh.getWorldPosition(startPos);
        }
    } else {
        startPos.copy(controls.getObject().position);
    }

    // 2. Raycast from Camera Center to find TRUE target
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // Intersect everything in scene 
    const intersects = raycaster.intersectObjects(scene.children, true); // Recursive

    let hit = null;
    let targetPoint = new THREE.Vector3();

    for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i].object;

        // 1. Ignore Weapon Parts
        let isWeapon = false;
        let p = obj;
        while (p) {
            if (p === weaponMesh) { isWeapon = true; break; }
            p = p.parent;
        }
        if (isWeapon) continue;

        // 2. Ignore Visual Helpers (Lasers, Edges, Wireframes)
        if (obj.type === 'Line' || obj.type === 'LineSegments') continue;

        // 3. Ignore Ghost/Helper objects
        if (obj.name === 'muzzle') continue;
        if (players[obj.uuid] || obj.parent && players[obj.parent.uuid]) continue; // Avoid self hit if possible, though 'players' is list of others

        hit = intersects[i];
        break;
    }

    if (hit) {
        targetPoint.copy(hit.point);
    } else {
        // No hit (sky), project far away in camera direction
        targetPoint.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(2000));
    }

    // 3. Direction from Gun Tip to Hit Point
    const visualDir = new THREE.Vector3().subVectors(targetPoint, startPos).normalize();
    const distance = startPos.distanceTo(targetPoint);

    // Visual Laser (Local)
    let color = 0xffff00;
    if (currentWeapon === 'rifle') color = 0x00ffff;
    if (currentWeapon === 'railgun') color = 0xff0000;

    createLaser(startPos, visualDir, distance, color);

    socket.emit('fps_shoot', {
        position: controls.getObject().position,
        direction: camera.getWorldDirection(new THREE.Vector3())
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Game Logic Helpers ---

function updatePlayers(serverPlayers) {
    Object.keys(serverPlayers).forEach(id => {
        if (id === myId) return;

        const pData = serverPlayers[id];

        if (!players[id]) {
            const group = new THREE.Group();
            group.uuid = id; // Store ID for raycast ignore check

            // Body
            const geo = new THREE.CapsuleGeometry(3, 10, 4, 8);
            const mat = new THREE.MeshLambertMaterial({ color: pData.color || 0xffffff });
            const mesh = new THREE.Mesh(geo, mat);
            group.add(mesh);

            // Head/Eye
            const eyeGeo = new THREE.BoxGeometry(4, 2, 2);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.position.set(0, 3, 2);
            group.add(eye);

            scene.add(group);
            players[id] = group;
        }

        // Interpolation could be added here
        players[id].position.set(pData.position.x, pData.position.y, pData.position.z);
        players[id].lookAt(controls.getObject().position);
    });

    Object.keys(players).forEach(id => {
        if (!serverPlayers[id]) {
            scene.remove(players[id]);
            delete players[id];
        }
    });
}

function updatePowerups(serverPowerups) {
    Object.keys(serverPowerups).forEach(id => {
        const pData = serverPowerups[id];
        if (!powerups[id]) {
            let geo, mat;
            let yOffset = 0;

            if (pData.type === 'shield') {
                geo = new THREE.IcosahedronGeometry(3);
                mat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
            } else if (pData.type === 'health') {
                geo = new THREE.BoxGeometry(4, 4, 4);
                mat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
            } else if (pData.type === 'rifle') {
                geo = new THREE.CylinderGeometry(0.5, 0.5, 6);
                geo.rotateX(Math.PI / 2);
                mat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
                yOffset = 2;
            } else if (pData.type === 'railgun') {
                geo = new THREE.BoxGeometry(1, 1, 8);
                mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                yOffset = 2;
            } else {
                geo = new THREE.SphereGeometry(2);
                mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            }

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(pData.position.x, pData.position.y + yOffset, pData.position.z);
            scene.add(mesh);
            powerups[id] = mesh;
        } else {
            powerups[id].rotation.y += 0.05;
        }
    });

    Object.keys(powerups).forEach(id => {
        if (!serverPowerups[id]) {
            scene.remove(powerups[id]);
            delete powerups[id];
        }
    });
}

function updateWeaponVisuals(type) {
    weaponMesh.clear();
    currentWeapon = type;

    let muzzle = new THREE.Object3D();
    muzzle.name = 'muzzle';

    if (type === 'pistol') {
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), new THREE.MeshBasicMaterial({ color: 0x888800 }));
        handle.position.set(0, -0.75, 0.5);
        handle.rotation.x = Math.PI / 8;
        weaponMesh.add(barrel, handle);
        muzzle.position.set(0, 0, -1.1);
    }
    else if (type === 'rifle') {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 8), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
        barrel.rotation.x = Math.PI / 2;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 2), new THREE.MeshBasicMaterial({ color: 0x008888 }));
        body.position.z = 1.5;
        weaponMesh.add(barrel, body);
        muzzle.position.set(0, 0, -2.1);
    }
    else if (type === 'railgun') {
        const barrel1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 5), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        barrel1.position.x = -0.3;
        const barrel2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 5), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        barrel2.position.x = 0.3;
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        weaponMesh.add(barrel1, barrel2, core);
        muzzle.position.set(0, 0, -2.6);
    }

    weaponMesh.add(muzzle);
}

function createWeaponModel() {
    weaponMesh = new THREE.Group();
    weaponMesh.position.set(2, -1.5, -3);
    updateWeaponVisuals('pistol');
    camera.add(weaponMesh);
}

function createLaser(origin, direction, length, color) {
    const dist = (typeof length === 'number') ? length : 200;
    const finalColor = (typeof length === 'number') ? color : length || 0xffff00;

    const start = new THREE.Vector3().copy(origin);

    const material = new THREE.LineBasicMaterial({ color: finalColor });
    const points = [];
    points.push(start);
    points.push(new THREE.Vector3().copy(start).add(direction.multiplyScalar(dist)));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    scene.add(line);

    setTimeout(() => scene.remove(line), 100);
}

function checkCollision(position) {
    const playerRadius = 4;
    for (const box of colliders) {
        if (box.containsPoint(position)) {
            return true;
        }
        const expandedBox = box.clone().expandByScalar(playerRadius);
        if (expandedBox.containsPoint(position)) return true;
    }
    return false;
}

// Generate a larger, more interesting city
function generateCity() {
    colliders = []; // Clear

    // Bounds
    createWall(0, 20, -1000, 2000, 100, 10, 0x333333); // Back
    createWall(0, 20, 1000, 2000, 100, 10, 0x333333); // Front
    createWall(-1000, 20, 0, 10, 100, 2000, 0x333333); // Left
    createWall(1000, 20, 0, 10, 100, 2000, 0x333333); // Right

    // Grid City
    const size = 100;
    const gap = 40;

    for (let x = -800; x <= 800; x += (size + gap)) {
        for (let z = -800; z <= 800; z += (size + gap)) {
            // SAFE ZONE
            if (Math.abs(x) < 200 && Math.abs(z) < 200) continue;

            if (Math.random() > 0.3) {
                const height = 50 + Math.random() * 200;
                // Building color
                const color = Math.random() * 0x333333 + 0x111111;
                createWall(x, height / 2, z, size, height, size, color);
            }
        }
    }
}

function createWall(x, y, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    // Collision Box
    const box = new THREE.Box3().setFromObject(mesh);
    colliders.push(box);

    // Edge glow
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x4444ff, opacity: 0.2, transparent: true }));
    line.position.copy(mesh.position);
    scene.add(line);
}


// --- Socket Events (Game State) ---

socket.on('fps_state', (state) => {
    updatePlayers(state.players);
    updatePowerups(state.powerups);

    if (state.players[myId]) {
        healthEl.textContent = Math.ceil(state.players[myId].health);
        shieldEl.textContent = Math.ceil(state.players[myId].shield);

        if (state.players[myId].health <= 0) {
            controls.unlock();
        }
    }

    // Update Scoreboard UI (Always update so it's ready on Tab)
    if (scoreboardBody) {
        // console.log('Updating scoreboard, players:', Object.keys(state.players).length); 
        let rows = '';
        const playerIds = Object.keys(state.players);

        if (playerIds.length === 0) {
            rows = '<tr><td colspan="3" class="text-center text-gray-500 py-4">No active players</td></tr>';
        } else {
            Object.values(state.players).forEach(p => {
                const isMe = p.id === myId ? '<span class="text-yellow-400 font-bold">(You)</span>' : '';
                rows += `
                    <tr class="border-b border-gray-800 hover:bg-gray-800 transition">
                        <td class="py-2 text-cyan-400 font-mono">${p.id.substr(0, 5)}... ${isMe}</td>
                        <td class="py-2 text-right text-green-400 font-bold">${Math.ceil(p.health)}</td>
                        <td class="py-2 text-right text-blue-400 font-bold">${Math.ceil(p.shield)}</td>
                    </tr>
                 `;
            });
        }
        scoreboardBody.innerHTML = rows;
    } else {
        console.error('Scoreboard body element not found!');
    }
});

socket.on('player_update', ({ id, weapon }) => {
    if (id === myId) {
        updateWeaponVisuals(weapon);
    }
});

socket.on('fps_shot_fired', ({ from, to, color }) => {
    createLaser(from, to, color);
});

// --- Boot ---
init();
