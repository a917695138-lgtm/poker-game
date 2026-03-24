/**
 * Texas Hold'em Poker Server
 * Node.js + Express + WebSocket (ws library)
 * Server-authoritative poker game engine
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ─── Constants ──────────────────────────────────────────────────────────────
const STARTING_CHIPS = 10000;
const ANTE_AMOUNT = 1;
const SMALL_BLIND = 1;
const BIG_BLIND = 2;
const MAX_BET = 40;
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

// ─── Utility ────────────────────────────────────────────────────────────────
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId() {
  return 'p_' + Math.random().toString(36).substring(2, 10);
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ─── Hand Evaluation ────────────────────────────────────────────────────────
function evaluateHand(cards) {
  if (!cards || cards.length < 5) return { rank: 0, name: 'Invalid', values: [] };
  const values = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const rankCount = {};
  values.forEach(v => { rankCount[v] = (rankCount[v] || 0) + 1; });
  const counts = Object.values(rankCount).sort((a, b) => b - a);
  const sortedValues = Object.keys(rankCount).map(Number).sort((a, b) => {
    if (rankCount[b] !== rankCount[a]) return rankCount[b] - rankCount[a];
    return b - a;
  });

  let flushSuit = null;
  for (const suit of SUITS) {
    if (suits.filter(s => s === suit).length >= 5) { flushSuit = suit; break; }
  }
  const flushCards = flushSuit ? cards.filter(c => c.suit === flushSuit) : [];
  const flushValues = flushCards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);

  function hasStraight(vals) {
    const unique = [...new Set(vals)].sort((a, b) => b - a);
    if (unique.length < 5) return false;
    if (unique.includes(14) && unique.includes(5) && unique.includes(4) && unique.includes(3) && unique.includes(2)) {
      return [5, 4, 3, 2, 1];
    }
    for (let i = 0; i <= unique.length - 5; i++) {
      if (unique[i] - unique[i + 4] === 4) {
        return [unique[i], unique[i + 1], unique[i + 2], unique[i + 3], unique[i + 4]];
      }
    }
    return false;
  }

  const straightHigh = hasStraight(values);
  const flushStraight = flushValues.length >= 5 ? hasStraight(flushValues) : false;

  if (flushStraight && flushStraight[0] === 14) return { rank: 10, name: 'Royal Flush', values: [14, 13, 12, 11, 10] };
  if (flushStraight) return { rank: 9, name: 'Straight Flush', values: flushStraight };
  if (counts[0] === 4) return { rank: 8, name: 'Four of a Kind', values: [sortedValues[0], sortedValues.find(v => v !== sortedValues[0]) || 0] };
  if (counts[0] === 3 && counts[1] === 2) return { rank: 7, name: 'Full House', values: [sortedValues[0], sortedValues[1]] };
  if (flushSuit) return { rank: 6, name: 'Flush', values: flushValues.slice(0, 5) };
  if (straightHigh) return { rank: 5, name: 'Straight', values: straightHigh.map(v => v === 1 ? 14 : v) };
  if (counts[0] === 3) return { rank: 4, name: 'Three of a Kind', values: [sortedValues[0], ...sortedValues.filter(v => v !== sortedValues[0]).slice(0, 2)] };
  if (counts[0] === 2 && counts[1] === 2) {
    const p1 = Math.max(sortedValues[0], sortedValues[1]);
    const p2 = Math.min(sortedValues[0], sortedValues[1]);
    const kicker = sortedValues.find(v => v !== p1 && v !== p2) || 0;
    return { rank: 3, name: 'Two Pair', values: [p1, p2, kicker] };
  }
  if (counts[0] === 2) return { rank: 2, name: 'One Pair', values: [sortedValues[0], ...sortedValues.filter(v => v !== sortedValues[0]).slice(0, 3)] };
  return { rank: 1, name: 'High Card', values: values.slice(0, 5) };
}

function compareHands(a, b) {
  if (a.rank !== b.rank) return b.rank - a.rank;
  for (let i = 0; i < Math.min(a.values.length, b.values.length); i++) {
    if (a.values[i] !== b.values[i]) return a.values[i] - b.values[i];
  }
  return 0;
}

// ─── Room class ─────────────────────────────────────────────────────────────
class Room {
  constructor(hostId, hostName) {
    this.id = generateRoomCode();
    this.code = this.id;
    this.hostId = hostId;
    this.players = [];
    this.phase = 'waiting';
    this.deck = [];
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.dealerIndex = -1;
    this.currentPlayerIndex = -1;
    this.bettingRound = 0;
    this.raiseCount = 0;
    this.connections = new Map();
    this.disconnectedPlayers = new Map();
  }

  addPlayer(ws, name) {
    const id = generatePlayerId();
    const player = {
      id,
      name: (name || 'Player').substring(0, 20),
      chips: STARTING_CHIPS,
      cards: [],
      currentBet: 0,
      folded: false,
      allIn: false,
      isConnected: true,
      isHost: this.players.length === 0
    };
    this.players.push(player);
    this.connections.set(id, ws);
    if (this.hostId === null) this.hostId = id;
    return player;
  }

  addConnection(playerId, ws) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    player.isConnected = true;
    const dt = this.disconnectedPlayers.get(playerId);
    if (dt) { clearTimeout(dt.timeout); this.disconnectedPlayers.delete(playerId); }
    this.connections.set(playerId, ws);
  }

  removeConnection(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    player.isConnected = false;
    this.connections.delete(playerId);
    const timeout = setTimeout(() => { this.handleDisconnect(playerId); }, 60000);
    this.disconnectedPlayers.set(playerId, { timeout });
  }

  handleDisconnect(playerId) {
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx === -1) return;
    const player = this.players[idx];
    this.disconnectedPlayers.delete(playerId);
    if (this.phase === 'waiting') {
      this.broadcast({ type: 'playerLeft', playerId, name: player.name });
      this.players.splice(idx, 1);
      if (player.isHost && this.players.length > 0) {
        this.players[0].isHost = true;
        this.hostId = this.players[0].id;
        this.broadcast({ type: 'hostChanged', hostId: this.hostId });
      }
    } else {
      player.folded = true;
      player.cards = [];
      this.broadcast({ type: 'playerFolded', playerId, name: player.name });
      if (this.phase === 'betting') this._advancePlayer();
    }
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const [, ws] of this.connections) {
      if (ws.readyState === 1) ws.send(data);
    }
  }

  sendTo(playerId, msg) {
    const ws = this.connections.get(playerId);
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  getActivePlayers() {
    return this.players.filter(p => !p.folded);
  }

  // ─── Game Logic ─────────────────────────────────────────────────────────
  startGame() {
    if (this.players.length < 2) return { error: 'Need at least 2 players to start' };
    const active = this.players.filter(p => p.chips > 0 || p.chips === 0);
    if (active.length < 2) return { error: 'Not enough players' };

    this.deck = createDeck();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.bettingRound = 0;
    this.raiseCount = 0;
    this.phase = 'dealing';

    for (const p of this.players) {
      p.cards = [];
      p.currentBet = 0;
      p.folded = false;
      p.allIn = false;
      if (p.chips <= 0) p.chips = STARTING_CHIPS;
    }

    // Find dealer index
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    while (this.players[this.dealerIndex].chips <= 0) {
      this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
      if (this.players.every(p => p.chips <= 0)) break;
    }

    // Post antes
    let totalAntes = 0;
    for (const p of this.players) {
      const ante = Math.min(ANTE_AMOUNT, p.chips);
      p.chips -= ante;
      totalAntes += ante;
    }
    this.pot += totalAntes;

    // Small blind
    const sbIndex = (this.dealerIndex + 1) % this.players.length;
    const sbPlayer = this.players[sbIndex];
    const sb = Math.min(SMALL_BLIND, sbPlayer.chips);
    sbPlayer.chips -= sb;
    sbPlayer.currentBet = sb;
    this.pot += sb;

    // Big blind
    const bbIndex = (this.dealerIndex + 2) % this.players.length;
    const bbPlayer = this.players[bbIndex];
    const bb = Math.min(BIG_BLIND, bbPlayer.chips);
    bbPlayer.chips -= bb;
    bbPlayer.currentBet = bb;
    this.pot += bb;
    this.currentBet = bb;

    // Deal cards
    for (const p of this.players) {
      p.cards = [this.deck.pop(), this.deck.pop()];
    }

    // First to act: after BB
    this._findFirstToAct();
    this.phase = 'betting';
    this.broadcastState();
    return { success: true };
  }

  _findFirstToAct() {
    const startIdx = (this.dealerIndex + 3) % this.players.length;
    for (let i = 0; i < this.players.length; i++) {
      const idx = (startIdx + i) % this.players.length;
      const p = this.players[idx];
      if (!p.folded && p.chips > 0) {
        this.currentPlayerIndex = idx;
        return;
      }
    }
    this.currentPlayerIndex = -1;
  }

  broadcastState() {
    const state = {
      type: 'gameState',
      phase: this.phase,
      pot: this.pot,
      communityCards: this.communityCards,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        currentBet: p.currentBet,
        folded: p.folded,
        allIn: p.allIn,
        isConnected: p.isConnected,
        isHost: p.isHost
      })),
      dealerIndex: this.dealerIndex,
      currentPlayerIndex: this.currentPlayerIndex,
      currentBet: this.currentBet,
      bettingRound: this.bettingRound,
      raiseCount: this.raiseCount
    };
    this.broadcast(state);
  }

  _isBettingComplete() {
    const active = this.getActivePlayers();
    if (active.length === 0) return true;
    if (active.length === 1) return true;
    return active.every(p => p.currentBet === this.currentBet || p.allIn || p.chips === 0);
  }

  _advancePlayer() {
    if (this.phase !== 'betting') return;
    if (this._isBettingComplete()) {
      this._endBettingRound();
      return;
    }
    const start = this.currentPlayerIndex;
    for (let i = 1; i <= this.players.length; i++) {
      const idx = (start + i) % this.players.length;
      const p = this.players[idx];
      if (!p.folded && p.chips > 0 && (p.currentBet < this.currentBet || p.allIn)) {
        this.currentPlayerIndex = idx;
        this.broadcastState();
        return;
      }
    }
    this._endBettingRound();
  }

  handleAction(playerId, action, amount) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { error: 'Player not found' };
    if (this.players.indexOf(player) !== this.currentPlayerIndex) {
      return { error: 'Not your turn' };
    }

    switch (action) {
      case 'check': {
        if (player.currentBet < this.currentBet) {
          return { error: 'Must call or fold' };
        }
        this.broadcast({ type: 'playerAction', playerId, action: 'check', name: player.name });
        break;
      }
      case 'call': {
        const toCall = this.currentBet - player.currentBet;
        if (toCall <= 0) return { error: 'Nothing to call' };
        const amt = Math.min(toCall, player.chips);
        player.chips -= amt;
        player.currentBet += amt;
        this.pot += amt;
        if (player.chips === 0) player.allIn = true;
        this.broadcast({ type: 'playerAction', playerId, action: 'call', amount: amt, name: player.name });
        break;
      }
      case 'bet': {
        const toCall = this.currentBet - player.currentBet;
        const minRaise = toCall + (toCall === 0 ? BIG_BLIND : 0);
        if (amount < minRaise) return { error: `Minimum raise is ${minRaise}` };
        if (amount > MAX_BET) return { error: `Maximum bet is ${MAX_BET}` };
        if (this.raiseCount >= 3) return { error: 'Maximum re-raises reached' };
        const totalBet = Math.min(amount, player.chips + player.currentBet);
        const actualBet = totalBet - player.currentBet;
        player.chips -= actualBet;
        player.currentBet = totalBet;
        this.pot += actualBet;
        this.currentBet = totalBet;
        if (player.chips === 0) player.allIn = true;
        this.raiseCount++;
        this.broadcast({ type: 'playerAction', playerId, action: 'bet', amount: actualBet, totalBet, name: player.name });
        break;
      }
      case 'fold': {
        player.folded = true;
        player.cards = [];
        this.broadcast({ type: 'playerAction', playerId, action: 'fold', name: player.name });
        break;
      }
      case 'allin': {
        const allInAmt = player.chips;
        if (allInAmt <= 0) return { error: 'No chips left' };
        const toCall = this.currentBet - player.currentBet;
        player.chips = 0;
        player.currentBet += allInAmt;
        this.pot += allInAmt;
        const isRaise = allInAmt > toCall;
        if (isRaise && this.raiseCount >= 3) {
          player.chips = allInAmt;
          player.currentBet -= allInAmt;
          this.pot -= allInAmt;
          return { error: 'Maximum re-raises reached' };
        }
        if (isRaise) { this.currentBet = player.currentBet; this.raiseCount++; }
        if (player.currentBet >= this.currentBet) player.allIn = true;
        this.broadcast({ type: 'playerAction', playerId, action: 'allin', amount: allInAmt, isRaise, name: player.name });
        break;
      }
      default:
        return { error: 'Unknown action' };
    }

    // Reset all player bets to 0 for next round tracking
    for (const p of this.players) p.currentBet = 0;
    this.currentBet = 0;

    // Check if only one player left
    const active = this.getActivePlayers();
    if (active.length <= 1) {
      this._awardPotToOne(active[0] || this.players.find(p => !p.folded));
      return;
    }

    this._advancePlayer();
  }

  _endBettingRound() {
    this.bettingRound++;

    if (this.bettingRound === 1) {
      this.communityCards = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
    } else if (this.bettingRound === 2) {
      this.communityCards.push(this.deck.pop());
    } else if (this.bettingRound === 3) {
      this.communityCards.push(this.deck.pop());
    } else {
      this._showdown();
      return;
    }

    this.raiseCount = 0;
    this.currentBet = 0;
    for (const p of this.players) p.currentBet = 0;

    // Find first to act (after dealer)
    const startIdx = (this.dealerIndex + 1) % this.players.length;
    this.currentPlayerIndex = -1;
    for (let i = 0; i < this.players.length; i++) {
      const idx = (startIdx + i) % this.players.length;
      const p = this.players[idx];
      if (!p.folded && !p.allIn && p.chips > 0) {
        this.currentPlayerIndex = idx;
        break;
      }
    }

    // If everyone is all-in, go straight to next card
    const canAct = this.players.some(p => !p.folded && !p.allIn && p.chips > 0);
    if (!canAct) {
      this._endBettingRound();
      return;
    }

    this.broadcastState();
  }

  _showdown() {
    this.phase = 'showdown';
    const showdownPlayers = this.players.filter(p => !p.folded);

    const results = showdownPlayers.map(p => ({
      player: p,
      hand: evaluateHand([...this.communityCards, ...p.cards])
    })).sort((a, b) => compareHands(b.hand, a.hand));

    const topHand = results[0] ? results[0].hand : null;
    const winners = results.filter(r => topHand && compareHands(r.hand, topHand) === 0).map(r => r.player);

    const winAmt = Math.floor(this.pot / winners.length);
    const remainder = this.pot - (winAmt * winners.length);
    winners.forEach((w, i) => { w.chips += winAmt + (i === 0 ? remainder : 0); });

    this.broadcast({
      type: 'showdown',
      communityCards: this.communityCards,
      players: showdownPlayers.map(p => ({
        id: p.id, name: p.name, cards: p.cards,
        hand: evaluateHand([...this.communityCards, ...p.cards])
      })),
      winners: winners.map(w => ({ id: w.id, name: w.name, hand: evaluateHand([...this.communityCards, ...w.cards]) }))
    });

    setTimeout(() => this._resetToWaiting(), 15000);
  }

  _awardPotToOne(winner) {
    if (!winner) return;
    winner.chips += this.pot;
    this.broadcast({
      type: 'showdown',
      communityCards: this.communityCards,
      players: [{ id: winner.id, name: winner.name, cards: winner.cards, hand: { rank: 0, name: 'Winner', values: [] } }],
      winners: [{ id: winner.id, name: winner.name, hand: { rank: 0, name: 'Winner', values: [] } }]
    });
    this.pot = 0;
    setTimeout(() => this._resetToWaiting(), 10000);
  }

  _resetToWaiting() {
    this.phase = 'waiting';
    for (const p of this.players) { p.cards = []; p.currentBet = 0; p.folded = false; }
    this.communityCards = [];
    this.deck = [];
    this.pot = 0;
    this.currentBet = 0;
    this.bettingRound = 0;
    this.raiseCount = 0;
    this.broadcastState();
  }
}

// ─── Room Management ─────────────────────────────────────────────────────────
const rooms = new Map();
const playerRooms = new Map();

function getRoomByCode(code) {
  for (const room of rooms.values()) {
    if (room.code === code) return room;
  }
  return null;
}

// ─── WebSocket Handler ───────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  let currentPlayerId = null;
  let currentRoom = null;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); }
    catch { ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' })); return; }

    switch (msg.type) {

      case 'createRoom': {
        if (currentRoom) { ws.send(JSON.stringify({ type: 'error', message: 'Already in a room' })); return; }
        const name = (msg.name || 'Player').trim().substring(0, 20) || 'Player';
        const room = new Room(null, name);
        rooms.set(room.code, room);
        const player = room.addPlayer(ws, name);
        currentPlayerId = player.id;
        currentRoom = room;
        playerRooms.set(player.id, room);
        ws.send(JSON.stringify({ type: 'roomCreated', roomCode: room.code, playerId: player.id }));
        break;
      }

      case 'joinRoom': {
        if (currentRoom) { ws.send(JSON.stringify({ type: 'error', message: 'Already in a room' })); return; }
        const code = (msg.roomCode || '').toString().toUpperCase();
        const name = (msg.name || 'Player').trim().substring(0, 20) || 'Player';
        const room = getRoomByCode(code);
        if (!room) { ws.send(JSON.stringify({ type: 'error', message: 'Room not found' })); return; }
        if (room.phase !== 'waiting') { ws.send(JSON.stringify({ type: 'error', message: 'Game already in progress' })); return; }
        if (room.players.length >= 9) { ws.send(JSON.stringify({ type: 'error', message: 'Room is full' })); return; }
        const player = room.addPlayer(ws, name);
        currentPlayerId = player.id;
        currentRoom = room;
        playerRooms.set(player.id, room);
        ws.send(JSON.stringify({
          type: 'joinedRoom', roomCode: room.code, playerId: player.id,
          players: room.players.map(p => ({ id: p.id, name: p.name, chips: p.chips, isHost: p.isHost })),
          hostId: room.hostId
        }));
        room.broadcast({ type: 'playerJoined', player: { id: player.id, name: player.name, chips: player.chips, isHost: false } });
        break;
      }

      case 'reconnect': {
        const room = getRoomByCode(msg.roomCode);
        if (!room) { ws.send(JSON.stringify({ type: 'error', message: 'Room not found' })); return; }
        const player = room.players.find(p => p.id === msg.playerId);
        if (!player) { ws.send(JSON.stringify({ type: 'error', message: 'Player not found' })); return; }
        if (currentRoom) {
          currentRoom.removeConnection(currentPlayerId);
          playerRooms.delete(currentPlayerId);
        }
        currentPlayerId = player.id;
        currentRoom = room;
        room.addConnection(player.id, ws);
        playerRooms.set(player.id, room);
        ws.send(JSON.stringify({
          type: 'reconnected', playerId: player.id, roomCode: room.code,
          gameState: {
            phase: room.phase, pot: room.pot, communityCards: room.communityCards,
            players: room.players.map(p => ({
              id: p.id, name: p.name, chips: p.chips, currentBet: p.currentBet,
              folded: p.folded, allIn: p.allIn, isConnected: true, isHost: p.isHost,
              cards: p.id === player.id ? p.cards : (p.cards.length > 0 ? p.cards : [])
            })),
            dealerIndex: room.dealerIndex, currentPlayerIndex: room.currentPlayerIndex,
            currentBet: room.currentBet, bettingRound: room.bettingRound, raiseCount: room.raiseCount
          }
        }));
        break;
      }

      case 'startGame': {
        if (!currentRoom) { ws.send(JSON.stringify({ type: 'error', message: 'Not in a room' })); return; }
        const player = currentRoom.players.find(p => p.id === currentPlayerId);
        if (!player || !player.isHost) { ws.send(JSON.stringify({ type: 'error', message: 'Only host can start' })); return; }
        if (currentRoom.players.length < 2) { ws.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players' })); return; }
        if (currentRoom.phase !== 'waiting') { ws.send(JSON.stringify({ type: 'error', message: 'Game already in progress' })); return; }
        const result = currentRoom.startGame();
        if (result.error) { ws.send(JSON.stringify({ type: 'error', message: result.error })); return; }
        for (const p of currentRoom.players) {
          currentRoom.sendTo(p.id, { type: 'yourCards', cards: p.cards });
        }
        break;
      }

      case 'bet': case 'call': case 'check': case 'fold': case 'allin': {
        if (!currentRoom) { ws.send(JSON.stringify({ type: 'error', message: 'Not in a room' })); return; }
        if (currentRoom.phase !== 'betting') { ws.send(JSON.stringify({ type: 'error', message: 'Not in betting phase' })); return; }
        const result = currentRoom.handleAction(currentPlayerId, msg.type, msg.amount || 0);
        if (result && result.error) { ws.send(JSON.stringify({ type: 'error', message: result.error })); return; }
        break;
      }

      case 'leaveRoom': {
        if (currentRoom) {
          currentRoom.removeConnection(currentPlayerId);
          playerRooms.delete(currentPlayerId);
          currentRoom = null;
          currentPlayerId = null;
          ws.send(JSON.stringify({ type: 'roomLeft' }));
        }
        break;
      }

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentPlayerId) {
      currentRoom.removeConnection(currentPlayerId);
      playerRooms.delete(currentPlayerId);
    }
  });

  ws.on('error', () => {});
});

// ─── Cleanup empty rooms ────────────────────────────────────────────────────
setInterval(() => {
  for (const [code, room] of rooms) {
    if (room.players.length === 0) rooms.delete(code);
  }
}, 60000);

// ─── Start server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`♠️  Poker server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});
