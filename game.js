/* ============================================================
   ¿POR QUÉ SIEMPRE YO? — Lógica del juego
   Modos: 1 vs BOT (local) y Online (2-4 personas reales)
   ============================================================ */

// ---------- CONSTANTES ----------
// Todas las canicas son la tricolor colombiana; cada jugador se distingue
// por el color de su anillo (ring) y una etiqueta de color.
const MARBLE_STYLES = [
  { name: 'Amarillo', ring: '#ffcd00', colorHex: '#ffcd00' },
  { name: 'Azul',     ring: '#0b3fae', colorHex: '#0b3fae' },
  { name: 'Rojo',     ring: '#d8232a', colorHex: '#d8232a' },
  { name: 'Verde',    ring: '#3aa655', colorHex: '#3aa655' },
];

// Canica (SVG tricolor) con anillo del color del jugador.
// `sizeClasses` son utilidades Tailwind de tamaño (ej. 'w-10 h-10').
function marbleHTML(player, sizeClasses) {
  const ring = (player && player.style && player.style.ring) || '#ffcd00';
  const svg = (typeof svgMarble === 'function') ? svgMarble('') : '';
  return `<span class="marble ${sizeClasses}" style="box-shadow:0 0 0 2px ${ring}, 0 4px 8px rgba(0,0,0,0.4); border-radius:50%;">${svg}</span>`;
}

// ---------- ESTADO ----------
let gameState = {
  gameType: 'local',          // 'local' (1 humano + 1 bot) | 'online'
  playerCount: 2,
  marblesPerPlayer: 6,
  boardTheme: 'board-blue',
  players: [],
  currentTurnIndex: 0,
  boardHoles: { 1: null, 2: null, 3: null, 4: null, 5: null },
  hasPlacedThisTurn: false,
  isRolling: false,
  isWaitingForHoleClick: false,
  currentDiceValue: null,
  isGameOver: false,

  // Online (PeerJS)
  myPeerId: null,
  myPlayerIndex: 0,
  isHost: false,
  peer: null,
  connections: [],

  // Rematch
  rematchVotes: {},           // { playerIndex: true }
};

// ============================================================
//  AUDIO (Web Audio API — sin archivos externos)
// ============================================================
let audioCtx = null;
let soundEnabled = true;

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, startTime, duration, type = 'sine', gain = 0.2, slideTo = null) {
  const ctx = ensureAudio();
  if (!ctx || !soundEnabled) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, startTime + duration);
  g.gain.setValueAtTime(0.0001, startTime);
  g.gain.exponentialRampToValueAtTime(gain, startTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(startTime); osc.stop(startTime + duration + 0.02);
}

// "pop" al colocar una canica
function playMarbleSound() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(520, t, 0.12, 'sine', 0.25, 180);
}

// traqueteo del dado
function playDiceSound() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 5; i++) {
    tone(140 + Math.random() * 120, t + i * 0.08, 0.06, 'square', 0.12);
  }
}

// penalización / error
function playErrorSound() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(220, t, 0.25, 'sawtooth', 0.2, 90);
}

// fanfarria al ganar
function playWinSound() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => tone(f, t + i * 0.15, 0.3, 'triangle', 0.28));
  tone(1318.5, t + 0.6, 0.5, 'triangle', 0.25);
}

// "trombón triste" (wah-wah-wah-waaah) al perder
function playLoseSound() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  // Cuatro notas descendentes con glissando, timbre nasal tipo trombón
  const steps = [
    { f: 311.13, to: 293.66 }, // Eb4 -> D4
    { f: 277.18, to: 261.63 }, // Db4 -> C4
    { f: 246.94, to: 233.08 }, // B3  -> Bb4
    { f: 220.00, to: 174.61 }, // A3  -> F3 (la caída larga final)
  ];
  steps.forEach((s, i) => {
    const dur = i === steps.length - 1 ? 0.8 : 0.28;
    tone(s.f, t + i * 0.3, dur, 'sawtooth', 0.22, s.to);
  });
}

// ============================================================
//  PANTALLAS (Inicio / Juego / Fin)
// ============================================================
function showScreen(name) {
  const start = document.getElementById('startScreen');
  const game  = document.getElementById('gameScreen');
  const end   = document.getElementById('endScreen');
  [start, game, end].forEach(el => el && el.classList.add('hidden'));
  if (name === 'start') start.classList.remove('hidden');
  if (name === 'game')  game.classList.remove('hidden');
  if (name === 'end')   end.classList.remove('hidden');

  // El título animado necesita medirse cuando su pantalla ya es visible
  // (getBBox no funciona con display:none). Lo (re)dibujamos al mostrar.
  if (typeof renderStrokeTitles === 'function') {
    requestAnimationFrame(() => renderStrokeTitles());
  }
}

// Generar canicas flotantes decorativas en las pantallas
function spawnFloatingMarbles(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const m = document.createElement('div');
    const size = 22 + Math.random() * 42;
    m.className = 'floating-marble';
    m.style.width = size + 'px';
    m.style.height = size + 'px';
    m.style.left = Math.random() * 100 + 'vw';
    m.style.animationDuration = (9 + Math.random() * 10) + 's';
    m.style.animationDelay = (Math.random() * 9) + 's';
    m.innerHTML = (typeof svgMarble === 'function') ? svgMarble('f' + i) : '';
    container.appendChild(m);
  }
}

// ============================================================
//  INICIO
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  spawnFloatingMarbles('startFloaties');
  spawnFloatingMarbles('endFloaties');
  renderPlayerCountButtons();
  setMarbleCount(6);
  showScreen('start');

  // Desbloquear audio en el primer gesto del usuario (clave en iOS/Safari).
  // Escuchamos varios tipos de evento y, al primero, reanudamos el AudioContext
  // y tocamos un tono silencioso para "despertar" el audio en móviles.
  const unlockAudio = () => {
    const ctx = ensureAudio();
    if (ctx) {
      try {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.02);
      } catch (e) {}
    }
    document.body.removeEventListener('pointerdown', unlockAudio);
    document.body.removeEventListener('touchstart', unlockAudio);
    document.body.removeEventListener('click', unlockAudio);
  };
  document.body.addEventListener('pointerdown', unlockAudio);
  document.body.addEventListener('touchstart', unlockAudio);
  document.body.addEventListener('click', unlockAudio);

  // Renderizar el título animado (StrokeText) con canicas en las "O"
  if (typeof renderStrokeTitles === 'function') renderStrokeTitles();

  // Cara inicial del dado ("?")
  renderDiceFace('?');

  // Restaurar nombre de usuario guardado (se comparte entre 1vsBOT y Online)
  const savedName = localStorage.getItem('pqsy_name');
  if (savedName) {
    const localIn  = document.getElementById('localPlayerName');
    const onlineIn = document.getElementById('onlineNickname');
    if (localIn)  localIn.value = savedName;
    if (onlineIn) onlineIn.value = savedName;
  }
  // Sincronizar el nombre entre ambos campos mientras se escribe + guardarlo
  ['localPlayerName', 'onlineNickname'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = el.value;
      const other = document.getElementById(id === 'localPlayerName' ? 'onlineNickname' : 'localPlayerName');
      if (other) other.value = v;
      localStorage.setItem('pqsy_name', v);
    });
  });

  // Activar "agitar para girar el dado" en móviles
  setupShakeToRoll();
});

// ============================================================
//  AGITAR PARA GIRAR EL DADO (móvil) + vibración
// ============================================================
let shakeSetupDone = false;
let lastShakeTime = 0;

function handleMotion(e) {
  const acc = e.accelerationIncludingGravity || e.acceleration;
  if (!acc) return;
  const total = Math.abs(acc.x || 0) + Math.abs(acc.y || 0) + Math.abs(acc.z || 0);
  const now = Date.now();
  // Umbral de agitón; con 1s de reposo para no disparar múltiples veces
  if (total > 28 && now - lastShakeTime > 1000) {
    lastShakeTime = now;
    // Solo si es mi turno, no estoy girando y el juego está activo
    if (document.getElementById('gameScreen') &&
        !document.getElementById('gameScreen').classList.contains('hidden') &&
        isMyTurnNow() && !gameState.isRolling && !gameState.isWaitingForHoleClick && !gameState.isGameOver) {
      if (navigator.vibrate) navigator.vibrate(60);
      handleRollDice();
    }
  }
}

function setupShakeToRoll() {
  if (shakeSetupDone) return;
  if (typeof DeviceMotionEvent === 'undefined') return; // no hay sensor (PC)
  // En iOS 13+ hay que pedir permiso tras un gesto del usuario.
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    // Se solicitará al tocar el dado la primera vez (ver enableMotionIfNeeded)
    return;
  }
  window.addEventListener('devicemotion', handleMotion);
  shakeSetupDone = true;
}

// Pedir permiso de sensor en iOS al primer toque del dado
function enableMotionIfNeeded() {
  if (shakeSetupDone) return;
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission().then(state => {
      if (state === 'granted') {
        window.addEventListener('devicemotion', handleMotion);
        shakeSetupDone = true;
      }
    }).catch(() => {});
  }
}

// ============================================================
//  CONFIGURACIÓN DE PANTALLA DE INICIO
// ============================================================
function selectMode(mode) {
  gameState.gameType = mode;
  const btnLocal  = document.getElementById('modeLocalBtn');
  const btnOnline = document.getElementById('modeOnlineBtn');
  const localCfg  = document.getElementById('localConfig');
  const onlineCfg = document.getElementById('onlineConfig');

  if (mode === 'local') {
    btnLocal.classList.add('chip-active');
    btnOnline.classList.remove('chip-active');
    localCfg.classList.remove('hidden');
    onlineCfg.classList.add('hidden');
  } else {
    btnOnline.classList.add('chip-active');
    btnLocal.classList.remove('chip-active');
    onlineCfg.classList.remove('hidden');
    localCfg.classList.add('hidden');
  }
}

function setMarbleCount(count) {
  gameState.marblesPerPlayer = count;
  [4, 6, 8, 10].forEach(c => {
    const btn = document.getElementById(`mb${c}`);
    if (!btn) return;
    btn.classList.toggle('chip-active', c === count);
  });
}

function renderPlayerCountButtons() { /* reservado para futuras opciones */ }

// ============================================================
//  INICIAR MODO LOCAL (1 humano + 1 BOT)
// ============================================================
function startLocalGame() {
  ensureAudio();
  const nameInput = document.getElementById('localPlayerName');
  const humanName = (nameInput && nameInput.value.trim()) || 'Tú';

  gameState.gameType = 'local';
  gameState.playerCount = 2;
  gameState.players = [
    { id: 0, name: humanName, isBot: false, marbles: gameState.marblesPerPlayer, style: MARBLE_STYLES[0] },
    { id: 1, name: 'BOT',     isBot: true,  marbles: gameState.marblesPerPlayer, style: MARBLE_STYLES[1] },
  ];
  gameState.myPlayerIndex = 0;
  gameState.isHost = false;

  resetRoundState();
  showScreen('game');
  document.getElementById('onlineBadge').classList.add('hidden');
  setBoardTheme(gameState.boardTheme);

  renderBoardHoles();
  renderPlayersPanel();
  updateTurnUI();
  logAction('¡Comienza el juego! Es tu turno.');
  checkBotTurn();
}

function resetRoundState() {
  gameState.currentTurnIndex = 0;
  gameState.boardHoles = { 1: null, 2: null, 3: null, 4: null, 5: null };
  gameState.hasPlacedThisTurn = false;
  gameState.isRolling = false;
  gameState.isWaitingForHoleClick = false;
  gameState.currentDiceValue = null;
  gameState.isGameOver = false;
  gameState.rematchVotes = {};
  const pit = document.getElementById('pitMarbles');
  if (pit) pit.innerHTML = '';
  renderDiceFace('?');
  // Limpiar lágrimas de una derrota anterior
  const tears = document.getElementById('tearsLayer');
  if (tears) tears.innerHTML = '';
}

// ============================================================
//  RENDER DEL TABLERO Y JUGADORES
// ============================================================
function renderPlayersPanel() {
  const panel = document.getElementById('playersPanel');
  if (!panel) return;
  panel.innerHTML = '';

  gameState.players.forEach((p, idx) => {
    const isCurrent = idx === gameState.currentTurnIndex;
    const card = document.createElement('div');
    card.className = `panel-card lift flex-1 p-3 rounded-2xl transition-all ${
      isCurrent ? 'scale-105' : 'opacity-80'
    }`;
    if (isCurrent) card.style.boxShadow = `0 0 0 2px ${p.style.ring}, 0 12px 26px -8px rgba(0,0,0,0.6)`;

    let marblesHtml = '';
    for (let m = 0; m < p.marbles; m++) {
      marblesHtml += marbleHTML(p, 'w-4 h-4');
    }

    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          ${marbleHTML(p, 'w-5 h-5')}
          <span class="font-display text-base text-white truncate max-w-[110px]">${p.name}</span>
          ${p.isBot ? '<span class="text-xs px-2 py-0.5 rounded font-sans text-white" style="background:rgba(216,35,42,0.3)">BOT</span>' : ''}
        </div>
        ${isCurrent ? `<span class="w-2.5 h-2.5 rounded-full animate-ping" style="background:${p.style.ring}"></span>` : ''}
      </div>
      <div class="flex flex-col gap-1">
        <div class="flex items-center text-sm font-sans" style="color:#e9d9b6">
          <span>Canicas: <strong class="text-white">${p.marbles}</strong></span>
        </div>
        <div class="flex flex-wrap gap-1 items-center min-h-[20px]">
          ${p.marbles === 0 ? '<span class="text-sm font-bold" style="color:#ffcd00">¡Sin canicas! 🎉</span>' : marblesHtml}
        </div>
      </div>
    `;
    panel.appendChild(card);
  });
}

function renderBoardHoles() {
  for (let h = 1; h <= 5; h++) {
    const holeEl = document.getElementById(`hole-${h}`);
    if (!holeEl) continue;
    holeEl.innerHTML = '';
    holeEl.classList.remove('hole-waiting-input');

    const myTurn = isMyTurnNow();
    if (gameState.isWaitingForHoleClick && gameState.currentDiceValue === h && myTurn) {
      holeEl.classList.add('hole-waiting-input');
    }

    const occupant = gameState.boardHoles[h];
    if (occupant) {
      holeEl.innerHTML = marbleHTML(occupant, 'w-9 h-9 sm:w-11 sm:h-11');
    }
  }

  const hole6 = document.getElementById('hole-6');
  if (hole6) {
    hole6.classList.remove('hole-waiting-input');
    const myTurn = isMyTurnNow();
    if (gameState.isWaitingForHoleClick && gameState.currentDiceValue === 6 && myTurn) {
      hole6.classList.add('hole-waiting-input');
    }
  }
}

function isMyTurnNow() {
  if (gameState.gameType !== 'online') return true;
  return gameState.currentTurnIndex === gameState.myPlayerIndex;
}

function updateTurnUI() {
  const curPlayer = gameState.players[gameState.currentTurnIndex];
  if (!curPlayer) return;

  const nameEl = document.getElementById('turnPlayerName');
  const dotEl  = document.getElementById('turnMarbleDot');
  const btnPass = document.getElementById('btnPass');
  const dice    = document.getElementById('dice3d');
  const hint    = document.getElementById('diceHint');

  if (nameEl) nameEl.innerText = curPlayer.name;
  if (dotEl)  dotEl.innerHTML = marbleHTML(curPlayer, 'w-7 h-7');

  const isMyTurn = isMyTurnNow();
  const canRoll  = isMyTurn && !gameState.isRolling && !gameState.isWaitingForHoleClick && !curPlayer.isBot && !gameState.isGameOver;

  // El dado es el "botón": clicable solo cuando puedo lanzar
  if (dice) {
    dice.style.pointerEvents = canRoll ? 'auto' : 'none';
    dice.style.opacity = canRoll ? '1' : '0.6';
  }
  if (hint) {
    if (gameState.isGameOver) hint.innerText = '';
    else if (curPlayer.isBot) hint.innerText = `Turno de ${curPlayer.name}…`;
    else if (!isMyTurn) hint.innerText = `Turno de ${curPlayer.name}`;
    else if (gameState.isWaitingForHoleClick) hint.innerText = '';
    else hint.innerHTML = 'Toca el dado <span style="opacity:.7">(o agita el cel)</span>';
  }

  if (btnPass) {
    btnPass.disabled = !isMyTurn || !gameState.hasPlacedThisTurn || gameState.isRolling || gameState.isWaitingForHoleClick || curPlayer.isBot || gameState.isGameOver;
    btnPass.className = btnPass.disabled
      ? "btn-pass w-full py-3 rounded-2xl flex items-center justify-center opacity-40 cursor-not-allowed"
      : "btn-pass lift w-full py-3 rounded-2xl flex items-center justify-center";
  }
}

function logAction(msg) {
  const logEl = document.getElementById('actionLog');
  if (logEl) logEl.innerText = msg;
}

function setBoardTheme() { /* El tablero colombiano es único; función conservada por compatibilidad. */ }

// Clic/toque del dado = lanzar (reemplaza al botón). Pide permiso de sensor en iOS.
function handleDiceTap() {
  enableMotionIfNeeded();
  scrollToDice();   // en móvil, asegura que el dado quede centrado al lanzar
  handleRollDice();
}

// ============================================================
//  JUGABILIDAD
// ============================================================
function handleRollDice() {
  if (gameState.isRolling || gameState.isWaitingForHoleClick || gameState.isGameOver) return;

  if (gameState.gameType === 'online') {
    if (gameState.isHost) {
      const rolledVal = Math.floor(Math.random() * 6) + 1;
      executeOnlineRoll(rolledVal, gameState.currentTurnIndex);
    } else if (gameState.connections[0] && gameState.connections[0].open) {
      gameState.connections[0].send({ type: 'ACTION_ROLL_REQ', playerIdx: gameState.myPlayerIndex });
    }
  } else {
    const rolledVal = Math.floor(Math.random() * 6) + 1;
    executeRoll(rolledVal, gameState.currentTurnIndex);
  }
}

// Anima el dado localmente (usado por todos los dispositivos)
// Posiciones de los pips en el grid 3x3 (1..9) para cada valor del dado.
const DICE_PIP_LAYOUT = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

// Dibuja la cara del dado con puntos negros (o "?" si value es null/"?").
function renderDiceFace(value) {
  const face = document.getElementById('diceFace');
  if (!face) return;
  face.innerHTML = '';
  if (value === null || value === undefined || value === '?' ) {
    const q = document.createElement('div');
    q.className = 'q';
    q.textContent = '?';
    face.appendChild(q);
    return;
  }
  const pips = DICE_PIP_LAYOUT[value] || [];
  for (let cell = 1; cell <= 9; cell++) {
    const c = document.createElement('div');
    c.className = 'cell';
    if (pips.includes(cell)) {
      const pip = document.createElement('div');
      pip.className = 'pip';
      c.appendChild(pip);
    }
    face.appendChild(c);
  }
}

function animateDice(rolledValue, playerName) {
  const diceEl = document.getElementById('dice3d');
  if (diceEl) diceEl.classList.add('dice-rolling');
  playDiceSound();
  logAction(`${playerName} está lanzando el dado...`);
  // Durante el giro, mostrar caras aleatorias para dar sensación de rodar
  let ticks = 0;
  const spin = setInterval(() => { renderDiceFace(Math.floor(Math.random() * 6) + 1); if (++ticks > 4) clearInterval(spin); }, 110);
  setTimeout(() => {
    clearInterval(spin);
    renderDiceFace(rolledValue);
    if (diceEl) diceEl.classList.remove('dice-rolling');
  }, 600);
}

function executeRoll(rolledValue, playerIdx) {
  const curPlayer = gameState.players[playerIdx];
  gameState.isRolling = true;
  updateTurnUI();
  animateDice(rolledValue, curPlayer.name);

  setTimeout(() => {
    gameState.currentDiceValue = rolledValue;
    gameState.isRolling = false;

    if (curPlayer.isBot) {
      executeTurnResult(rolledValue);
    } else {
      gameState.isWaitingForHoleClick = true;
      renderBoardHoles();
      updateTurnUI();
      logAction(`🎯 ${curPlayer.name} sacó un ${rolledValue}. ¡Presiona la casilla ${rolledValue}!`);
      // En móvil: subir automáticamente al tablero para poner la canica
      if (isMyTurnNow()) scrollToBoard();
    }
  }, 650);
}

// ---------- AUTO-SCROLL EN MÓVIL ----------
function isMobileView() {
  return window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
}
function scrollToBoard() {
  if (!isMobileView()) return;
  const el = document.getElementById('boardSurface');
  if (el) setTimeout(() => { try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }, 120);
}
function scrollToDice() {
  if (!isMobileView()) return;
  const el = document.getElementById('dice3d');
  if (el) setTimeout(() => { try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }, 100);
}

function handleHoleClick(clickedHoleNum) {
  if (gameState.isGameOver || !gameState.isWaitingForHoleClick) return;

  if (gameState.gameType === 'online') {
    if (gameState.currentTurnIndex !== gameState.myPlayerIndex) return;
    if (gameState.isHost) {
      executeOnlineHoleClick(clickedHoleNum, gameState.currentTurnIndex);
    } else if (gameState.connections[0] && gameState.connections[0].open) {
      gameState.connections[0].send({ type: 'ACTION_HOLE_REQ', playerIdx: gameState.myPlayerIndex, holeNum: clickedHoleNum });
    }
  } else {
    executeHoleClick(clickedHoleNum, gameState.currentTurnIndex);
  }
}

function executeHoleClick(clickedHoleNum, playerIdx) {
  const curPlayer = gameState.players[playerIdx];
  const targetHole = gameState.currentDiceValue;

  gameState.isWaitingForHoleClick = false;
  renderBoardHoles();

  if (clickedHoleNum !== targetHole) {
    curPlayer.marbles++;
    playErrorSound();
    if (gameState.gameType === 'online' && gameState.isHost) {
      broadcastToGuests({ type: 'FX_PENALTY' });
    }
    renderPlayersPanel();
    logAction(`❌ ¡ERROR! Presionó la casilla ${clickedHoleNum} en vez de la ${targetHole}. ¡PENALIZACIÓN: +1 CANICA! Turno terminado.`);

    setTimeout(() => {
      nextTurn();
      if (gameState.gameType === 'online' && gameState.isHost) {
        broadcastGameState('Penalización aplicada. Turno de ' + gameState.players[gameState.currentTurnIndex].name);
      }
    }, 1800);
  } else {
    executeTurnResult(targetHole);
    if (gameState.gameType === 'online' && gameState.isHost) broadcastGameState();
  }
}

function executeTurnResult(diceVal) {
  const curPlayer = gameState.players[gameState.currentTurnIndex];

  if (diceVal === 6) {
    curPlayer.marbles--;
    gameState.hasPlacedThisTurn = true;
    animateMarbleIntoSix(curPlayer);
    playMarbleSound();
    if (gameState.gameType === 'online' && gameState.isHost) {
      broadcastToGuests({ type: 'FX_MARBLE_SIX', ring: curPlayer.style.ring });
    }
    logAction(`¡Excelente! La canica cayó en el hoyo 6 🎁 (Quedan: ${curPlayer.marbles})`);

    if (checkWinCondition()) return;
    renderPlayersPanel();
    updateTurnUI();
    checkBotTurn();
    if (gameState.gameType === 'online' && gameState.isHost) broadcastGameState();
  } else {
    const isOccupied = gameState.boardHoles[diceVal] !== null;
    if (!isOccupied) {
      curPlayer.marbles--;
      gameState.boardHoles[diceVal] = curPlayer;
      gameState.hasPlacedThisTurn = true;
      playMarbleSound();
      if (gameState.gameType === 'online' && gameState.isHost) {
        broadcastToGuests({ type: 'FX_MARBLE_PLACED' });
      }
      renderBoardHoles();
      renderPlayersPanel();
      logAction(`¡Correcto! Ocupó la casilla ${diceVal}. (Quedan: ${curPlayer.marbles})`);

      if (checkWinCondition()) return;
      updateTurnUI();
      checkBotTurn();
      if (gameState.gameType === 'online' && gameState.isHost) broadcastGameState();
    } else {
      gameState.boardHoles[diceVal] = null;
      curPlayer.marbles++;
      playErrorSound();
      if (gameState.gameType === 'online' && gameState.isHost) {
        broadcastToGuests({ type: 'FX_PENALTY' });
      }
      renderBoardHoles();
      renderPlayersPanel();
      logAction(`¡Casilla ${diceVal} estaba OCUPADA! ${curPlayer.name} recoge la canica (+1) y pierde el turno.`);

      setTimeout(() => {
        nextTurn();
        if (gameState.gameType === 'online' && gameState.isHost) broadcastGameState();
      }, 1500);
    }
  }
}

function animateMarbleIntoSix(player) {
  const pit = document.getElementById('pitMarbles');
  if (!pit) return;
  const m = document.createElement('div');
  m.className = 'w-9 h-9 animate-drop-six';
  m.innerHTML = marbleHTML(player, 'w-9 h-9');
  pit.appendChild(m);
  setTimeout(() => { if (m.parentNode) m.parentNode.removeChild(m); }, 750);
}

function handlePassTurn() {
  if (!gameState.hasPlacedThisTurn || gameState.isRolling || gameState.isWaitingForHoleClick || gameState.isGameOver) return;
  const curPlayer = gameState.players[gameState.currentTurnIndex];
  logAction(`${curPlayer.name} decidió pasar el turno.`);

  if (gameState.gameType === 'online') {
    if (gameState.isHost) {
      nextTurn();
      broadcastGameState();
    } else if (gameState.connections[0] && gameState.connections[0].open) {
      gameState.connections[0].send({ type: 'ACTION_PASS_REQ', playerIdx: gameState.myPlayerIndex });
    }
  } else {
    nextTurn();
  }
}

function nextTurn() {
  gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.playerCount;
  gameState.hasPlacedThisTurn = false;
  gameState.isRolling = false;
  gameState.isWaitingForHoleClick = false;

  renderPlayersPanel();
  updateTurnUI();
  logAction(`Turno de ${gameState.players[gameState.currentTurnIndex].name}`);
  checkBotTurn();
}

function checkBotTurn() {
  if (gameState.isGameOver) return;
  const curPlayer = gameState.players[gameState.currentTurnIndex];
  if (!curPlayer || !curPlayer.isBot) return;

  setTimeout(() => {
    if (gameState.hasPlacedThisTurn) {
      let occupiedCount = 0;
      for (let i = 1; i <= 5; i++) if (gameState.boardHoles[i] !== null) occupiedCount++;
      // El bot pasa por seguridad si el tablero está "peligroso"
      if (occupiedCount >= 3 || Math.random() < 0.35) {
        logAction(`🤖 ${curPlayer.name} decide pasar el turno por seguridad.`);
        nextTurn();
        return;
      }
    }
    const rolledVal = Math.floor(Math.random() * 6) + 1;
    executeRoll(rolledVal, gameState.currentTurnIndex);
  }, 1000);
}

function checkWinCondition() {
  const curPlayer = gameState.players[gameState.currentTurnIndex];
  if (curPlayer.marbles <= 0) {
    gameState.isGameOver = true;
    logAction(`🏆 ¡${curPlayer.name} HA GANADO LA PARTIDA!`);
    triggerGameOver(curPlayer.name, curPlayer.id);
    if (gameState.gameType === 'online' && gameState.isHost) {
      broadcastToGuests({ type: 'GAME_OVER', winnerName: curPlayer.name, winnerIdx: curPlayer.id });
    }
    return true;
  }
  return false;
}

// ¿Ganó ESTE dispositivo?
//  - Online: compara el índice del ganador con mi índice de jugador.
//  - Local (1 vs BOT): el humano siempre es el índice 0; gana si winnerIdx === 0.
function didIWin(winnerIdx) {
  if (gameState.gameType === 'online') return winnerIdx === gameState.myPlayerIndex;
  return winnerIdx === 0;
}

// Mostrar pantalla de fin adecuada (ganador o perdedor) en ESTE dispositivo
function triggerGameOver(winnerName, winnerIdx) {
  const iWon = didIWin(winnerIdx);

  // Botón "Volver a jugar" habilitado en ambos casos
  const btnRematch = document.getElementById('btnRematch');
  if (btnRematch) { btnRematch.disabled = false; btnRematch.classList.remove('opacity-50'); }
  const rematchBox = document.getElementById('rematchStatus');
  if (rematchBox) rematchBox.innerText = '';

  const winView  = document.getElementById('winView');
  const loseView = document.getElementById('loseView');

  if (iWon) {
    if (winView)  winView.classList.remove('hidden');
    if (loseView) loseView.classList.add('hidden');
    const nameEl = document.getElementById('winnerName');
    if (nameEl) nameEl.innerText = winnerName;
    playWinSound();
    showScreen('end');
    fireConfetti();
  } else {
    if (loseView) loseView.classList.remove('hidden');
    if (winView)  winView.classList.add('hidden');
    const loserMsgEl = document.getElementById('loserWinnerName');
    if (loserMsgEl) loserMsgEl.innerText = winnerName;
    playLoseSound();
    showScreen('end');
    fireTears();
  }
}

function fireConfetti() {
  if (typeof confetti !== 'function') return;
  const end = Date.now() + 2500;
  (function frame() {
    confetti({ particleCount: 5, angle: 60,  spread: 70, origin: { x: 0 } });
    confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 180, spread: 100, origin: { y: 0.5 } });
}

// Lluvia de lágrimas en la pantalla de derrota (gotas azules que caen)
function fireTears() {
  const layer = document.getElementById('tearsLayer');
  if (!layer) return;
  layer.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const drop = document.createElement('div');
    drop.className = 'tear-drop';
    drop.style.left = Math.random() * 100 + 'vw';
    drop.style.animationDuration = (1.6 + Math.random() * 1.8) + 's';
    drop.style.animationDelay = (Math.random() * 2.5) + 's';
    // Tamaño variable sin tocar 'transform' (lo controla la animación de caída)
    const scale = 0.6 + Math.random() * 1.0;
    drop.style.width = (12 * scale) + 'px';
    drop.style.height = (18 * scale) + 'px';
    layer.appendChild(drop);
  }
  // Limpiar las gotas tras unos segundos para no acumular nodos
  setTimeout(() => { if (layer) layer.innerHTML = ''; }, 8000);
}

// ============================================================
//  REMATCH (Volver a jugar)
// ============================================================
function handleRematch() {
  const btnRematch = document.getElementById('btnRematch');

  if (gameState.gameType === 'local') {
    // Reinicio directo contra el bot
    startLocalGame();
    return;
  }

  // ----- ONLINE -----
  if (btnRematch) { btnRematch.disabled = true; btnRematch.classList.add('opacity-50'); }

  if (gameState.isHost) {
    gameState.rematchVotes[gameState.myPlayerIndex] = true;
    updateRematchStatus();
    broadcastToGuests({ type: 'REMATCH_STATUS', votes: Object.keys(gameState.rematchVotes).length, total: gameState.players.length });
    maybeStartRematch();
  } else if (gameState.connections[0] && gameState.connections[0].open) {
    gameState.connections[0].send({ type: 'REMATCH_VOTE', playerIdx: gameState.myPlayerIndex });
    document.getElementById('rematchStatus').innerText = 'Esperando a los demás jugadores...';
  }
}

function handleQuit() {
  // Salir → volver a la pantalla de inicio y cortar conexiones
  if (gameState.peer) { try { gameState.peer.destroy(); } catch (e) {} }
  gameState.peer = null;
  gameState.connections = [];
  gameState.isHost = false;
  gameState.gameType = 'local';
  document.getElementById('roomCodeDisplay').classList.add('hidden');
  showScreen('start');
}

function updateRematchStatus() {
  const total = gameState.players.length;
  const votes = Object.keys(gameState.rematchVotes).length;
  const statusEl = document.getElementById('rematchStatus');
  if (statusEl) statusEl.innerText = `Jugadores listos: ${votes} / ${total}`;
}

// El host decide reiniciar cuando todos los que quieren volver ya votaron.
// Lanzamos un reinicio cuando pasa un pequeño tiempo y hay >=2 votos,
// o se puede forzar. Aquí reiniciamos en cuanto hay al menos 2 votos
// y todas las conexiones activas votaron.
let rematchGraceTimer = null;

function maybeStartRematch() {
  if (!gameState.isHost) return;
  const voters = Object.keys(gameState.rematchVotes).map(Number);
  const statusEl = document.getElementById('rematchStatus');

  // Si TODOS los jugadores de la partida anterior ya votaron, arrancamos ya.
  if (voters.length === gameState.players.length && voters.length >= 2) {
    if (rematchGraceTimer) { clearTimeout(rematchGraceTimer); rematchGraceTimer = null; }
    doStartRematch();
    return;
  }

  if (voters.length < 2) {
    if (statusEl) statusEl.innerText = 'Esperando más jugadores... (se necesitan al menos 2)';
    return;
  }

  // Hay al menos 2 listos pero faltan otros por decidir: damos una ventana de gracia.
  if (statusEl) statusEl.innerText = `Jugadores listos: ${voters.length} / ${gameState.players.length}. Iniciando pronto...`;
  if (!rematchGraceTimer) {
    rematchGraceTimer = setTimeout(() => {
      rematchGraceTimer = null;
      if (gameState.isGameOver && Object.keys(gameState.rematchVotes).length >= 2) doStartRematch();
    }, 6000);
  }
}

function doStartRematch() {
  const voters = Object.keys(gameState.rematchVotes).map(Number);

  // Reconstruir la lista de jugadores solo con los que votaron
  const newPlayers = voters
    .sort((a, b) => a - b)
    .map((oldIdx, newIdx) => {
      const old = gameState.players[oldIdx];
      return { oldIdx, player: { ...old, id: newIdx, marbles: gameState.marblesPerPlayer, style: MARBLE_STYLES[newIdx] } };
    });

  // Mapa viejo→nuevo índice para avisar a cada invitado su nuevo índice
  const indexMap = {};
  newPlayers.forEach((np, newIdx) => { indexMap[np.oldIdx] = newIdx; });

  const rebuiltPlayers = newPlayers.map(np => np.player);

  // Reasignar conexiones: conservar solo las de quienes votaron
  // connections está alineado 1:1 con players por índice (host = sin conexión propia en la posición 0)
  const newConnections = [];
  newPlayers.forEach(np => {
    const conn = gameState.connections[np.oldIdx];
    if (conn) newConnections.push(conn); // host no tiene conn en su propia posición → se omite
  });
  gameState.connections = newConnections.filter(Boolean);

  gameState.players = rebuiltPlayers;
  gameState.playerCount = rebuiltPlayers.length;
  gameState.myPlayerIndex = 0; // el host siempre es 0
  resetRoundState();
  setBoardTheme(gameState.boardTheme);
  showScreen('game');
  document.getElementById('onlineBadge').classList.remove('hidden');

  renderBoardHoles();
  renderPlayersPanel();
  updateTurnUI();
  logAction('¡Nueva partida! Turno de ' + gameState.players[0].name);

  // Avisar a cada invitado su nuevo índice y el estado inicial
  broadcastToGuests({
    type: 'REMATCH_START',
    players: gameState.players,
    boardHoles: gameState.boardHoles,
    currentTurnIndex: 0,
    indexMap,
  });
}

// ============================================================
//  ONLINE — PeerJS
// ============================================================
function createOnlineRoom() {
  ensureAudio();
  if (typeof Peer === 'undefined') { alert('Librería PeerJS no cargada. Revisa tu conexión a internet.'); return; }

  const nickname = (document.getElementById('onlineNickname').value || '').trim() || 'Anfitrión';
  const code = generateShortCode();
  const peerId = 'pqsy-' + code;

  gameState.gameType = 'online';
  gameState.isHost = true;
  gameState.myPlayerIndex = 0;
  gameState.connections = [];
  gameState.players = [{ id: 0, name: nickname, isBot: false, marbles: gameState.marblesPerPlayer, style: MARBLE_STYLES[0] }];

  initPeerJS(peerId, () => {
    const display = document.getElementById('roomCodeDisplay');
    display.classList.remove('hidden');
    document.getElementById('roomCodeText').innerText = code;
    document.getElementById('roomConnectedCount').innerText = `Conectados: 1 (${nickname})`;
    // En móviles (iPhone), desplazar la vista hasta el código para que siempre sea visible.
    setTimeout(() => {
      try { display.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    }, 150);
  });
}

function joinOnlineRoom() {
  ensureAudio();
  if (typeof Peer === 'undefined') { alert('Librería PeerJS no cargada. Revisa tu conexión a internet.'); return; }

  const code = (document.getElementById('joinRoomCodeInput').value || '').trim().toUpperCase();
  const nickname = (document.getElementById('onlineNickname').value || '').trim() || 'Invitado';
  if (!code || code.length < 4) { alert('Ingresa un código de sala válido.'); return; }

  const btnJoin = document.getElementById('btnJoinRoom');
  if (btnJoin) { btnJoin.disabled = true; btnJoin.innerText = 'Conectando...'; }

  const hostPeerId = 'pqsy-' + code;
  gameState.gameType = 'online';
  gameState.isHost = false;

  initPeerJS(null, () => {
    const conn = gameState.peer.connect(hostPeerId, { reliable: true });
    setupConnectionEvents(conn, nickname);
  });
}

function initPeerJS(customId, onOpenCallback) {
  try {
    if (gameState.peer) gameState.peer.destroy();
    gameState.peer = customId ? new Peer(customId) : new Peer();

    gameState.peer.on('open', (id) => {
      gameState.myPeerId = id;
      if (onOpenCallback) onOpenCallback(id);
    });
    gameState.peer.on('connection', (conn) => {
      if (gameState.isHost) setupConnectionEvents(conn);
    });
    gameState.peer.on('error', (err) => {
      alert('Error de conexión Online: ' + err.type);
      const btnJoin = document.getElementById('btnJoinRoom');
      if (btnJoin) { btnJoin.disabled = false; btnJoin.innerText = 'Unirse'; }
    });
  } catch (e) {
    alert('Error inicializando PeerJS: ' + e.message);
  }
}

function setupConnectionEvents(conn, myNickname = '') {
  conn.on('open', () => {
    if (!gameState.isHost) {
      gameState.connections = [conn];
      conn.send({ type: 'JOIN_REQ', name: myNickname, peerId: gameState.myPeerId });
    }
  });
  conn.on('data', (data) => handleIncomingNetworkData(conn, data));
  conn.on('close', () => {
    logAction('Un jugador se ha desconectado.');
    const connectedEl = document.getElementById('roomConnectedCount');
    if (gameState.isHost && connectedEl) {
      connectedEl.innerText = `Conectados: ${gameState.connections.filter(c => c && c.open).length + 1} / 4`;
    }
  });
}

function handleIncomingNetworkData(conn, data) {
  if (gameState.isHost) {
    // ---------- HOST ----------
    switch (data.type) {
      case 'JOIN_REQ': {
        const nextIdx = gameState.players.length;
        if (nextIdx >= 4) { conn.send({ type: 'JOIN_REJECT', reason: 'Sala llena' }); return; }
        const newPlayer = { id: nextIdx, name: data.name || `Jugador ${nextIdx + 1}`, isBot: false, marbles: gameState.marblesPerPlayer, style: MARBLE_STYLES[nextIdx] };
        gameState.players.push(newPlayer);
        gameState.connections[nextIdx] = conn; // alineado por índice
        conn.send({ type: 'JOIN_ACK', assignedIdx: nextIdx, players: gameState.players, marblesPerPlayer: gameState.marblesPerPlayer });
        broadcastToGuests({ type: 'ROOM_UPDATE', players: gameState.players });
        const connectedEl = document.getElementById('roomConnectedCount');
        if (connectedEl) connectedEl.innerText = `Conectados: ${gameState.players.length} / 4`;
        break;
      }
      case 'ACTION_ROLL_REQ':
        if (gameState.currentTurnIndex === data.playerIdx) {
          const rolledVal = Math.floor(Math.random() * 6) + 1;
          executeOnlineRoll(rolledVal, data.playerIdx);
        }
        break;
      case 'ACTION_HOLE_REQ':
        if (gameState.currentTurnIndex === data.playerIdx) executeOnlineHoleClick(data.holeNum, data.playerIdx);
        break;
      case 'ACTION_PASS_REQ':
        if (gameState.currentTurnIndex === data.playerIdx) { nextTurn(); broadcastGameState(); }
        break;
      case 'REMATCH_VOTE':
        gameState.rematchVotes[data.playerIdx] = true;
        updateRematchStatus();
        broadcastToGuests({ type: 'REMATCH_STATUS', votes: Object.keys(gameState.rematchVotes).length, total: gameState.players.length });
        maybeStartRematch();
        break;
    }
  } else {
    // ---------- INVITADO ----------
    switch (data.type) {
      case 'JOIN_ACK':
        gameState.myPlayerIndex = data.assignedIdx;
        gameState.players = data.players;
        gameState.marblesPerPlayer = data.marblesPerPlayer;
        logAction(`¡Conectado como ${data.players[data.assignedIdx].name}! Esperando al anfitrión...`);
        showWaitingRoom();
        break;
      case 'ROOM_UPDATE':
        gameState.players = data.players;
        showWaitingRoom();
        break;
      case 'JOIN_REJECT':
        alert('No se pudo unir: ' + (data.reason || 'desconocido'));
        handleQuit();
        break;
      case 'GAME_START':
      case 'REMATCH_START':
        if (data.indexMap && data.indexMap[gameState.myPlayerIndex] !== undefined) {
          gameState.myPlayerIndex = data.indexMap[gameState.myPlayerIndex];
        }
        gameState.players = data.players;
        gameState.playerCount = data.players.length;
        gameState.boardHoles = data.boardHoles;
        gameState.currentTurnIndex = data.currentTurnIndex;
        gameState.isGameOver = false;
        gameState.rematchVotes = {};
        showScreen('game');
        document.getElementById('onlineBadge').classList.remove('hidden');
        document.getElementById('onlineText').innerText = `Online (${data.players[gameState.myPlayerIndex].name})`;
        setBoardTheme(gameState.boardTheme);
        renderBoardHoles();
        renderPlayersPanel();
        updateTurnUI();
        logAction('¡Partida iniciada! Turno de ' + gameState.players[gameState.currentTurnIndex].name);
        break;
      case 'DICE_ANIM':
        animateDice(data.value, data.playerName);
        break;
      case 'FX_MARBLE_PLACED':
        playMarbleSound();
        break;
      case 'FX_MARBLE_SIX':
        playMarbleSound();
        animateMarbleIntoSix({ style: { ring: data.ring || '#ffcd00' } });
        break;
      case 'FX_PENALTY':
        playErrorSound();
        break;
      case 'SYNC_STATE':
        gameState.players = data.players;
        gameState.boardHoles = data.boardHoles;
        gameState.currentTurnIndex = data.currentTurnIndex;
        gameState.hasPlacedThisTurn = data.hasPlacedThisTurn;
        gameState.isWaitingForHoleClick = data.isWaitingForHoleClick;
        gameState.currentDiceValue = data.currentDiceValue;
        gameState.isGameOver = data.isGameOver;
        if (data.actionText) logAction(data.actionText);
        if (data.currentDiceValue) renderDiceFace(data.currentDiceValue);
        renderBoardHoles();
        renderPlayersPanel();
        updateTurnUI();
        break;
      case 'GAME_OVER':
        gameState.isGameOver = true;
        triggerGameOver(data.winnerName, data.winnerIdx);
        break;
      case 'REMATCH_STATUS': {
        const statusEl = document.getElementById('rematchStatus');
        if (statusEl) statusEl.innerText = `Jugadores listos: ${data.votes} / ${data.total}`;
        break;
      }
    }
  }
}

function showWaitingRoom() {
  // El invitado ve una sala de espera simple reutilizando el log
  showScreen('game');
  document.getElementById('onlineBadge').classList.remove('hidden');
  const names = gameState.players.map(p => p.name).join(', ');
  logAction(`Sala: ${names}. Esperando que el anfitrión inicie...`);
  renderPlayersPanel();
  updateTurnUI();
}

function startHostOnlineGame() {
  if (!gameState.isHost) return;
  if (gameState.players.length < 2) { alert('Se necesitan al menos 2 jugadores conectados para iniciar.'); return; }

  gameState.playerCount = gameState.players.length;
  resetRoundState();
  setBoardTheme(gameState.boardTheme);
  showScreen('game');
  document.getElementById('onlineBadge').classList.remove('hidden');
  document.getElementById('onlineText').innerText = `Host (${gameState.players[0].name})`;

  broadcastToGuests({ type: 'GAME_START', players: gameState.players, boardHoles: gameState.boardHoles, currentTurnIndex: 0 });

  renderBoardHoles();
  renderPlayersPanel();
  updateTurnUI();
  logAction('¡Partida iniciada! Turno de ' + gameState.players[0].name);
}

// El host anima el dado localmente y pide a los invitados que lo animen también
function executeOnlineRoll(rolledVal, playerIdx) {
  const playerName = gameState.players[playerIdx].name;
  broadcastToGuests({ type: 'DICE_ANIM', value: rolledVal, playerName });
  executeRoll(rolledVal, playerIdx);
  setTimeout(() => broadcastGameState(), 700);
}

function executeOnlineHoleClick(holeNum, playerIdx) {
  executeHoleClick(holeNum, playerIdx);
  broadcastGameState();
}

function broadcastToGuests(payload) {
  gameState.connections.forEach(conn => { if (conn && conn.open) conn.send(payload); });
}

function broadcastGameState(customActionMsg = '') {
  if (!gameState.isHost) return;
  broadcastToGuests({
    type: 'SYNC_STATE',
    players: gameState.players,
    boardHoles: gameState.boardHoles,
    currentTurnIndex: gameState.currentTurnIndex,
    hasPlacedThisTurn: gameState.hasPlacedThisTurn,
    isWaitingForHoleClick: gameState.isWaitingForHoleClick,
    currentDiceValue: gameState.currentDiceValue,
    isGameOver: gameState.isGameOver,
    actionText: customActionMsg,
  });
}

function generateShortCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function copyRoomCode() {
  const code = document.getElementById('roomCodeText').innerText;
  if (!code) return;
  navigator.clipboard.writeText(code)
    .then(() => alert('Código de sala copiado: ' + code))
    .catch(() => alert('Código: ' + code));
}

// ============================================================
//  MODALES (Reglas) + sonido toggle + temas
// ============================================================
function openRulesModal() {
  document.getElementById('rulesModal').classList.remove('hidden');
  // Inicializar el efecto scroll-reveal cuando el modal ya es visible
  const scrollEl = document.getElementById('rulesScroll');
  if (scrollEl) scrollEl.scrollTop = 0;
  if (typeof initGradientScrolls === 'function') {
    requestAnimationFrame(() => initGradientScrolls());
  }
}
function closeRulesModal() { document.getElementById('rulesModal').classList.add('hidden'); }

function toggleSound() {
  soundEnabled = !soundEnabled;
  const icon = document.getElementById('soundIcon');
  if (icon) icon.className = soundEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  if (soundEnabled) { ensureAudio(); playMarbleSound(); }
}
