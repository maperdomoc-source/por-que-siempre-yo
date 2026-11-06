/* ============================================================
   ¿POR QUÉ SIEMPRE YO? — Lógica del juego
   Modos: 1 vs BOT (local) y Online (2-4 personas reales)
   ============================================================ */

// ---------- CONSTANTES ----------
const MARBLE_STYLES = [
  { name: 'Verde Esmeralda', class: 'marble-green',   colorHex: '#22c55e' },
  { name: 'Azul Turquesa',   class: 'marble-teal',    colorHex: '#14b8a6' },
  { name: 'Ámbar Dorado',    class: 'marble-amber',   colorHex: '#eab308' },
  { name: 'Magenta Cristal', class: 'marble-magenta', colorHex: '#ec4899' },
];

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
}

// Generar canicas flotantes decorativas en las pantallas
function spawnFloatingMarbles(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const colors = ['#22c55e', '#14b8a6', '#eab308', '#ec4899', '#3b82f6', '#f97316'];
  for (let i = 0; i < 14; i++) {
    const m = document.createElement('div');
    const size = 18 + Math.random() * 46;
    m.className = 'floating-marble';
    m.style.width = size + 'px';
    m.style.height = size + 'px';
    m.style.left = Math.random() * 100 + 'vw';
    m.style.background = `radial-gradient(circle at 35% 35%, #fff, ${colors[i % colors.length]})`;
    m.style.animationDuration = (8 + Math.random() * 10) + 's';
    m.style.animationDelay = (Math.random() * 8) + 's';
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

  // desbloquear audio en el primer toque
  document.body.addEventListener('pointerdown', ensureAudio, { once: true });
});

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
    btnLocal.classList.add('ring-4', 'ring-amber-400');
    btnOnline.classList.remove('ring-4', 'ring-amber-400');
    localCfg.classList.remove('hidden');
    onlineCfg.classList.add('hidden');
  } else {
    btnOnline.classList.add('ring-4', 'ring-amber-400');
    btnLocal.classList.remove('ring-4', 'ring-amber-400');
    onlineCfg.classList.remove('hidden');
    localCfg.classList.add('hidden');
  }
}

function setMarbleCount(count) {
  gameState.marblesPerPlayer = count;
  [4, 6, 8, 10].forEach(c => {
    const btn = document.getElementById(`mb${c}`);
    if (!btn) return;
    btn.classList.toggle('ring-4', c === count);
    btn.classList.toggle('ring-amber-400', c === count);
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
  const diceVal = document.getElementById('diceValue');
  if (diceVal) diceVal.innerText = '?';
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
    card.className = `flex-1 p-3 rounded-2xl border transition-all ${
      isCurrent
        ? 'bg-slate-800 border-amber-500/80 shadow-lg shadow-amber-500/10 scale-105'
        : 'bg-slate-900/60 border-white/5 opacity-80'
    }`;

    let marblesHtml = '';
    for (let m = 0; m < p.marbles; m++) {
      marblesHtml += `<div class="w-4 h-4 rounded-full ${p.style.class} inline-block shadow-sm"></div>`;
    }

    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 rounded-full ${p.style.class}"></div>
          <span class="font-display text-base text-white truncate max-w-[110px]">${p.name}</span>
          ${p.isBot ? '<span class="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-sans">BOT</span>' : ''}
        </div>
        ${isCurrent ? '<span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>' : ''}
      </div>
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between text-sm text-slate-300 font-sans">
          <span>Canicas: <strong class="text-white">${p.marbles}</strong></span>
        </div>
        <div class="flex flex-wrap gap-1 items-center min-h-[20px]">
          ${p.marbles === 0 ? '<span class="text-sm font-bold text-emerald-400">¡Sin canicas! 🎉</span>' : marblesHtml}
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
      const marbleDiv = document.createElement('div');
      marbleDiv.className = `w-10 h-10 sm:w-11 sm:h-11 marble ${occupant.style.class}`;
      holeEl.appendChild(marbleDiv);
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
  const btnRoll = document.getElementById('btnRoll');
  const btnPass = document.getElementById('btnPass');

  if (nameEl) nameEl.innerText = curPlayer.name;
  if (dotEl)  dotEl.className = `w-6 h-6 rounded-full ${curPlayer.style.class}`;

  const isMyTurn = isMyTurnNow();

  if (btnRoll) {
    btnRoll.disabled = !isMyTurn || gameState.isRolling || gameState.isWaitingForHoleClick || curPlayer.isBot || gameState.isGameOver;
    btnRoll.className = btnRoll.disabled
      ? "w-full py-4 rounded-2xl bg-slate-800 text-slate-500 font-display font-extrabold text-xl opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
      : "w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2";
  }

  if (btnPass) {
    btnPass.disabled = !isMyTurn || !gameState.hasPlacedThisTurn || gameState.isRolling || gameState.isWaitingForHoleClick || curPlayer.isBot || gameState.isGameOver;
    btnPass.className = btnPass.disabled
      ? "w-full py-3 rounded-2xl bg-slate-800 text-slate-500 font-sans font-bold text-base border border-white/5 opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
      : "w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-sans font-bold text-base shadow-md transition-all flex items-center justify-center gap-2";
  }
}

function logAction(msg) {
  const logEl = document.getElementById('actionLog');
  if (logEl) logEl.innerText = msg;
}

function setBoardTheme(themeClass) {
  gameState.boardTheme = themeClass;
  const board = document.getElementById('boardSurface');
  if (board) {
    board.className = `w-full h-full rounded-2xl ${themeClass} relative p-4 flex flex-col justify-between overflow-hidden shadow-inner`;
  }
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
function animateDice(rolledValue, playerName) {
  const diceEl = document.getElementById('dice3d');
  const diceValEl = document.getElementById('diceValue');
  if (diceEl) diceEl.classList.add('dice-rolling');
  playDiceSound();
  logAction(`${playerName} está lanzando el dado...`);
  setTimeout(() => {
    if (diceValEl) diceValEl.innerText = rolledValue;
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
    }
  }, 650);
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
  m.className = `w-8 h-8 marble ${player.style.class} animate-drop-six`;
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
    triggerWin(curPlayer.name);
    if (gameState.gameType === 'online' && gameState.isHost) {
      broadcastToGuests({ type: 'GAME_OVER', winnerName: curPlayer.name, winnerIdx: curPlayer.id });
    }
    return true;
  }
  return false;
}

// Mostrar pantalla de fin + confetti (en este dispositivo)
function triggerWin(winnerName) {
  playWinSound();
  const nameEl = document.getElementById('winnerName');
  if (nameEl) nameEl.innerText = winnerName;

  const rematchBox = document.getElementById('rematchStatus');
  if (rematchBox) rematchBox.innerText = '';
  const btnRematch = document.getElementById('btnRematch');
  if (btnRematch) { btnRematch.disabled = false; btnRematch.classList.remove('opacity-50'); }

  showScreen('end');
  fireConfetti();
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
    document.getElementById('roomCodeDisplay').classList.remove('hidden');
    document.getElementById('roomCodeText').innerText = code;
    document.getElementById('roomConnectedCount').innerText = `Conectados: 1 (${nickname})`;
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
      case 'SYNC_STATE':
        gameState.players = data.players;
        gameState.boardHoles = data.boardHoles;
        gameState.currentTurnIndex = data.currentTurnIndex;
        gameState.hasPlacedThisTurn = data.hasPlacedThisTurn;
        gameState.isWaitingForHoleClick = data.isWaitingForHoleClick;
        gameState.currentDiceValue = data.currentDiceValue;
        gameState.isGameOver = data.isGameOver;
        if (data.actionText) logAction(data.actionText);
        const diceValEl = document.getElementById('diceValue');
        if (diceValEl && data.currentDiceValue) diceValEl.innerText = data.currentDiceValue;
        renderBoardHoles();
        renderPlayersPanel();
        updateTurnUI();
        break;
      case 'GAME_OVER':
        gameState.isGameOver = true;
        triggerWin(data.winnerName);
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
function openRulesModal()  { document.getElementById('rulesModal').classList.remove('hidden'); }
function closeRulesModal() { document.getElementById('rulesModal').classList.add('hidden'); }

function toggleSound() {
  soundEnabled = !soundEnabled;
  const icon = document.getElementById('soundIcon');
  if (icon) icon.className = soundEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  if (soundEnabled) { ensureAudio(); playMarbleSound(); }
}
