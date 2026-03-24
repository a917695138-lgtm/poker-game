'use strict';
// ─── STATE ────────────────────────────────────────────────────────────────────
let ws = null;
let myPlayerId = null;
let myRoomCode = null;
let gameState = null;
let myCards = [];
let actionPending = false;
let logTimeout = null;

// ─── WEBSOCKET ───────────────────────────────────────────────────────────────
const WS_URL = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host;

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    setWsStatus(true);
    if (myPlayerId && myRoomCode) {
      send({ type: 'reconnect', playerId: myPlayerId, roomCode: myRoomCode });
    }
  };
  ws.onclose = () => { setWsStatus(false); setTimeout(connect, 3000); };
  ws.onerror = () => {};
  ws.onmessage = ev => { try { handleMessage(JSON.parse(ev.data)); } catch(e) {} };
}

function send(msg) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }

function setWsStatus(online) {
  const dot = document.getElementById('ws-dot');
  const txt = document.getElementById('status-text');
  if (online) { dot.classList.add('online'); txt.textContent = 'Connected'; }
  else { dot.classList.remove('online'); txt.textContent = 'Reconnecting...'; }
}

// ─── MESSAGE HANDLER ─────────────────────────────────────────────────────────
function handleMessage(msg) {
  switch (msg.type) {

    case 'roomCreated':
      myRoomCode = msg.roomCode; myPlayerId = msg.playerId;
      showScreen('waiting-screen');
      document.getElementById('display-room-code').textContent = msg.roomCode;
      updateWaitingUI(1, false);
      toast('Room created! Code: ' + msg.roomCode);
      break;

    case 'joinedRoom':
      myRoomCode = msg.roomCode; myPlayerId = msg.playerId;
      showScreen('waiting-screen');
      document.getElementById('display-room-code').textContent = msg.roomCode;
      renderWaitingPlayers(msg.players);
      break;

    case 'playerJoined':
      renderWaitingPlayers(null, msg.player);
      addToast(escHtml(msg.player.name) + ' joined');
      break;

    case 'playerLeft':
      renderWaitingPlayers(null, null, msg.playerId);
      addToast(escHtml(msg.name || 'Player') + ' left');
      break;

    case 'hostChanged':
      updateHost(msg.hostId);
      break;

    case 'gameStarted':
      myCards = [];
      showScreen('game-screen');
      addToast('Game started! Good luck!');
      break;

    case 'yourCards':
      myCards = msg.cards || [];
      renderMyCards();
      break;

    case 'gameState':
      gameState = msg;
      renderGame();
      break;

    case 'playerAction':
      addLog(escHtml(msg.name) + ' ' + msg.action + (msg.amount ? ' $' + msg.amount : ''));
      break;

    case 'playerFolded':
      addLog(escHtml(msg.name) + ' folded');
      break;

    case 'showdown':
      showShowdown(msg);
      break;

    case 'reconnected':
      myPlayerId = msg.playerId; myRoomCode = msg.roomCode;
      myCards = (msg.gameState.players.find(p => p.id === myPlayerId) || {}).cards || [];
      showScreen('game-screen'); gameState = msg.gameState;
      renderGame(); renderMyCards(); toast('Reconnected!');
      break;

    case 'roomLeft':
      myPlayerId = null; myRoomCode = null; myCards = []; gameState = null;
      showScreen('lobby-screen');
      break;

    case 'error':
      toast('Error: ' + msg.message); actionPending = false; renderActions();
      break;
  }
}

// ─── SCREEN MANAGEMENT ───────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name).classList.add('active');
}

// ─── TOAST / LOG ─────────────────────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}
window.addToast = toast; // expose for inline use

function addToast(msg) { toast(msg); }

function addLog(msg) {
  const feed = document.getElementById('log-feed');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = msg;
  feed.appendChild(entry);
  // Keep only last 5
  while (feed.children.length > 5) feed.removeChild(feed.firstChild);
}

// ─── LOBBY ───────────────────────────────────────────────────────────────────
document.getElementById('create-btn').onclick = () => {
  const name = document.getElementById('player-name-lobby').value.trim() || 'Player';
  send({ type: 'createRoom', name });
};
document.getElementById('join-btn').onclick = () => {
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  const name = document.getElementById('join-name-input').value.trim() || 'Player';
  if (!code) { toast('Enter a room code'); return; }
  send({ type: 'joinRoom', roomCode: code, name });
};
document.getElementById('leave-btn').onclick = () => send({ type: 'leaveRoom' });
document.getElementById('start-game-btn').onclick = () => send({ type: 'startGame' });
document.getElementById('modal-close-btn').onclick = closeModal;

document.getElementById('player-name-lobby').onkeydown = e => { if (e.key === 'Enter') document.getElementById('create-btn').click(); };
document.getElementById('room-code-input').onkeydown = e => { if (e.key === 'Enter') document.getElementById('join-btn').click(); };
document.getElementById('join-name-input').onkeydown = e => { if (e.key === 'Enter') document.getElementById('join-btn').click(); };

// ─── WAITING ROOM ─────────────────────────────────────────────────────────────
let waitingPlayers = [];

function renderWaitingPlayers(players, newPlayer, leftId) {
  if (players) waitingPlayers = players;
  if (newPlayer && !waitingPlayers.find(p => p.id === newPlayer.id)) waitingPlayers.push(newPlayer);
  if (leftId) waitingPlayers = waitingPlayers.filter(p => p.id !== leftId);
  const container = document.getElementById('players-list-container');
  container.innerHTML = waitingPlayers.map(p => `
    <div class="player-item">
      <div class="player-avatar">${getAvatar(p.name)}</div>
      <div class="player-info">
        <div class="player-name">${escHtml(p.name)}${p.isHost ? '<span class="host-badge">HOST</span>' : ''}</div>
        <div class="player-chips">${(p.chips || 10000).toLocaleString()} chips</div>
      </div>
    </div>`).join('');
  document.getElementById('player-count').textContent = waitingPlayers.length;
  updateWaitingUI(waitingPlayers.length);
}

function updateWaitingUI(count) {
  const btn = document.getElementById('start-game-btn');
  if (count >= 2) {
    btn.disabled = false; btn.textContent = 'Start Game';
  } else {
    btn.disabled = true; btn.textContent = 'Need 2+ players';
  }
}

function updateHost(hostId) {
  waitingPlayers = waitingPlayers.map(p => ({ ...p, isHost: p.id === hostId }));
  renderWaitingPlayers(waitingPlayers);
}

// ─── GAME RENDERING ───────────────────────────────────────────────────────────
function renderGame() {
  if (!gameState) return;
  const { phase, pot, communityCards, players, dealerIndex, currentPlayerIndex, currentBet, bettingRound } = gameState;

  // Pot
  document.getElementById('pot-amount').textContent = pot.toLocaleString();

  // Phase dots
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('dot-' + i);
    if (dot) dot.className = i < bettingRound ? 'dot done' : i === bettingRound ? 'dot active' : 'dot';
  }

  // Community cards
  const ccEl = document.getElementById('community-cards');
  ccEl.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const card = communityCards[i];
    ccEl.appendChild(makeCardEl(card || null, false, i < communityCards.length ? 'flip' : ''));
  }

  // Players
  const tableEl = document.getElementById('table-area');
  tableEl.innerHTML = '';
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const isMe = p.id === myPlayerId;
    const isDealer = i === dealerIndex;
    const isTurn = i === currentPlayerIndex && phase === 'betting';
    const seat = document.createElement('div');
    seat.className = 'player-seat' + (isMe ? ' my-seat' : '') + (p.folded ? ' folded' : '') + (isTurn ? ' active-turn' : '');

    // Avatar
    const av = document.createElement('div');
    av.className = 'seat-avatar';
    av.textContent = getAvatar(p.name);
    seat.appendChild(av);

    // Info
    const info = document.createElement('div');
    info.className = 'seat-info';

    const nameRow = document.createElement('div');
    nameRow.className = 'seat-name';
    if (isMe) nameRow.innerHTML += '<span class="badge badge-you">YOU</span>';
    if (isDealer) nameRow.innerHTML += '<span class="badge badge-dealer">D</span>';
    nameRow.innerHTML += escHtml(p.name);

    const chipsRow = document.createElement('div');
    chipsRow.className = 'seat-chips';
    chipsRow.textContent = p.chips.toLocaleString() + ' chips';
    if (!p.isConnected) chipsRow.textContent += ' (dc)';

    const betRow = document.createElement('div');
    betRow.className = 'seat-bet';
    betRow.textContent = p.currentBet > 0 ? 'Bet: $' + p.currentBet : '';
    if (p.allIn) betRow.textContent = betRow.textContent ? betRow.textContent + ' | ALL-IN' : 'ALL-IN';

    info.appendChild(nameRow);
    info.appendChild(chipsRow);
    info.appendChild(betRow);
    seat.appendChild(info);

    // Cards
    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'seat-cards';
    if (p.folded) {
      cardsDiv.appendChild(makeCardEl(null, true, ''));
      cardsDiv.appendChild(makeCardEl(null, true, ''));
    } else if (isMe && myCards.length === 2) {
      cardsDiv.appendChild(makeCardEl(myCards[0], false, ''));
      cardsDiv.appendChild(makeCardEl(myCards[1], false, ''));
    } else if (p.cards && p.cards.length === 2) {
      cardsDiv.appendChild(makeCardEl(p.cards[0], false, ''));
      cardsDiv.appendChild(makeCardEl(p.cards[1], false, ''));
    } else {
      cardsDiv.appendChild(makeCardEl(null, true, ''));
      cardsDiv.appendChild(makeCardEl(null, true, ''));
    }
    seat.appendChild(cardsDiv);

    tableEl.appendChild(seat);
  }

  // Actions
  renderActions();
}

function renderMyCards() {
  const el = document.getElementById('my-cards');
  el.innerHTML = '';
  if (myCards.length === 0) {
    el.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">Waiting for cards...</span>';
    return;
  }
  myCards.forEach((card, i) => el.appendChild(makeCardEl(card, false, 'flip')));
}

function renderActions() {
  const info = document.getElementById('action-info');
  const btns = document.getElementById('action-buttons');
  const betArea = document.getElementById('bet-area');
  btns.innerHTML = '';
  betArea.classList.remove('show');
  actionPending = false;

  if (!gameState || gameState.phase !== 'betting') {
    info.innerHTML = gameState && gameState.phase === 'showdown' ? '<strong>Showdown!</strong>' : '';
    return;
  }

  const { players, currentPlayerIndex, currentBet } = gameState;
  const me = players.find(p => p.id === myPlayerId);
  if (!me) return;

  const isMyTurn = players.indexOf(me) === currentPlayerIndex;

  if (!isMyTurn) {
    info.innerHTML = '<strong>' + escHtml(players[currentPlayerIndex]?.name || 'Unknown') + '</strong> is thinking...';
    return;
  }

  const toCall = currentBet - me.currentBet;
  info.innerHTML = 'Your turn — ' + (toCall > 0 ? 'Call <strong>$' + toCall + '</strong> or fold' : 'Check or bet');

  // Fold always available
  addActionBtn(btns, 'Fold', 'fold', () => { send({ type: 'fold' }); actionPending = true; });

  if (toCall <= 0) {
    // Can check or bet
    addActionBtn(btns, 'Check', 'check', () => { send({ type: 'check' }); actionPending = true; });
    addActionBtn(btns, 'Bet', 'bet', () => {
      betArea.classList.add('show');
      const slider = document.getElementById('bet-slider');
      slider.max = Math.min(40, me.chips);
      slider.value = Math.min(2, slider.max);
      updateBetDisplay();
    });
  } else {
    // Can call, raise, or go all-in
    const callAmt = Math.min(toCall, me.chips);
    if (callAmt > 0) {
      addActionBtn(btns, 'Call $' + callAmt, 'call', () => { send({ type: 'call' }); actionPending = true; });
    }
    addActionBtn(btns, 'All-In $' + me.chips, 'allin', () => { send({ type: 'allin' }); actionPending = true; });
    addActionBtn(btns, 'Raise', 'bet', () => {
      betArea.classList.add('show');
      const slider = document.getElementById('bet-slider');
      slider.max = Math.min(40, me.chips);
      slider.value = Math.min(toCall + 2, slider.max);
      updateBetDisplay();
    });
  }

  // Bet slider
  document.getElementById('bet-slider').oninput = updateBetDisplay;
  document.getElementById('bet-slider').onchange = () => {
    const amount = parseInt(document.getElementById('bet-slider').value);
    send({ type: 'bet', amount });
    actionPending = true;
    betArea.classList.remove('show');
  };
}

function addActionBtn(parent, label, cls, fn) {
  const btn = document.createElement('button');
  btn.className = 'action-btn ' + cls;
  btn.textContent = label;
  btn.onclick = () => { fn(); renderActions(); };
  parent.appendChild(btn);
}

function updateBetDisplay() {
  document.getElementById('bet-value').textContent = '$' + document.getElementById('bet-slider').value;
}

// ─── CARD ELEMENTS ───────────────────────────────────────────────────────────
function makeCardEl(card, faceDown, animClass) {
  const el = document.createElement('div');
  el.className = 'card small' + (animClass ? ' ' + animClass : '');
  if (faceDown || !card) {
    el.classList.add('back');
  } else {
    el.classList.add(card.suit);
    el.innerHTML = '<span class="rank">' + card.rank + '</span><span class="suit">' + getSuitGlyph(card.suit) + '</span><span class="rank-bottom">' + card.rank + '</span>';
  }
  return el;
}

function getSuitGlyph(suit) {
  return { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[suit] || '?';
}

function getAvatar(name) {
  const emojis = ['😀','😎','🤠','🧑','👨','👩','🦊','🐱','🐶','🦁','🐯','🦉','🦅','🐺','🦄'];
  let hash = 0;
  for (let i = 0; i < (name||'').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return emojis[Math.abs(hash) % emojis.length];
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── SHOWDOWN MODAL ───────────────────────────────────────────────────────────
function showShowdown(msg) {
  const modal = document.getElementById('showdown-modal');
  const winners = msg.winners || [];
  const allPlayers = msg.players || [];
  const communityCards = msg.communityCards || [];
  const totalPot = allPlayers.reduce((s,p) => s + (p.currentBet||0), 0);

  // Title
  document.getElementById('modal-title').textContent = winners.length > 1 ? 'Split Pot!' : '🏆 Winner!';
  document.getElementById('modal-winner').textContent = winners.map(w => escHtml(w.name)).join(', ');
  document.getElementById('modal-hand').textContent = winners[0]?.hand?.name || '';
  document.getElementById('modal-pot').textContent = totalPot > 0 ? '+$' + totalPot.toLocaleString() : '';
  document.getElementById('modal-subtitle').textContent = 'Next hand starting soon...';

  // Show all showdown hands
  const cardsRow = document.getElementById('modal-cards');
  cardsRow.innerHTML = '';
  allPlayers.forEach(p => {
    const isWinner = winners.some(w => w.id === p.id);
    if (isWinner && p.cards) {
      p.cards.forEach(c => cardsRow.appendChild(makeCardEl(c, false, '')));
    }
  });
  communityCards.forEach(c => cardsRow.appendChild(makeCardEl(c, false, '')));

  modal.classList.add('show');
  // Auto-close after 12s
  clearTimeout(modal._t);
  modal._t = setTimeout(closeModal, 12000);
}

function closeModal() {
  document.getElementById('showdown-modal').classList.remove('show');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
// Loading dots animation
const style = document.createElement('style');
style.textContent = '.loading-dots::after{content:"";animation:dots 1.5s steps(4,end) infinite}@keyframes dots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}';
document.head.appendChild(style);

// Start connection
connect();
