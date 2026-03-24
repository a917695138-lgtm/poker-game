# ♠️ Texas Hold'em Poker

A production-ready, real-time multiplayer Texas Hold'em poker game with WebSocket server.

## Features

- **Room System**: Create private rooms with 6-digit codes, host controls
- **Real-time Sync**: Instant player join/leave, state updates via WebSocket
- **Full Poker Rules**:
  - 10,000 starting chips per player
  - 1 chip ante, 2 chip big blind
  - 2 hole cards per player
  - Betting: check, call, bet, raise, fold, all-in
  - Max bet: 40 chips
  - 5 community cards at showdown
  - Complete hand evaluation (Royal Flush to High Card)
  - Winner determination with side pot support
- **Security**: Server authoritative — clients cannot cheat
- **Reconnection**: Players can reconnect if disconnected (60s grace period)

## Tech Stack

- **Backend**: Node.js + Express + ws (WebSocket)
- **Frontend**: Vanilla JavaScript + WebSocket
- **Protocol**: Custom JSON messages
- **Deployment**: Ready for Render/Railway/Heroku

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start server
npm start

# Open browser
open http://localhost:3000
```

### Deploy to Render

1. Create a new Web Service on Render
2. Connect your GitHub repo
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Deploy!

The server will automatically use the `PORT` environment variable.

## Game Rules

1. **Ante**: All players post 1 chip before each hand
2. **Blinds**: Small blind (1) and big blind (2) rotate clockwise
3. **Betting Rounds**:
   - Pre-flop (after hole cards)
   - Flop (3 community cards)
   - Turn (4th card)
   - River (5th card)
4. **Actions**: Check, Call, Bet, Raise, Fold, All-in
5. **Max Raise**: 40 chips per player
6. **Showdown**: Best 5-card hand wins the pot

## WebSocket Protocol

### Client → Server
```json
{"type": "createRoom", "name": "Player Name"}
{"type": "joinRoom", "roomCode": "ABC123", "name": "Player Name"}
{"type": "startGame"}
{"type": "bet", "amount": 10}
{"type": "call"}
{"type": "check"}
{"type": "fold"}
{"type": "allin"}
{"type": "reconnect", "playerId": "p_xxx", "roomCode": "ABC123"}
{"type": "leaveRoom"}
```

### Server → Client
```json
{"type": "roomCreated", "roomCode": "ABC123", "playerId": "p_xxx"}
{"type": "joinedRoom", "roomCode": "ABC123", "playerId": "p_xxx", "players": [...]}
{"type": "playerJoined", "player": {...}}
{"type": "playerLeft", "playerId": "p_xxx", "name": "..."}
{"type": "gameStarted"}
{"type": "yourCards", "cards": [{"suit": "hearts", "rank": "A"}, ...]}
{"type": "gameState", "phase": "betting", "pot": 100, ...}
{"type": "playerAction", "playerId": "p_xxx", "action": "call", "amount": 10, "name": "..."}
{"type": "showdown", "winners": [...], "players": [...], "communityCards": [...]}
{"type": "reconnected", "gameState": {...}}
{"type": "error", "message": "..."}
```

## Hand Rankings

1. Royal Flush (A-K-Q-J-10 same suit)
2. Straight Flush (5 consecutive same suit)
3. Four of a Kind
4. Full House (3 + 2)
5. Flush (5 same suit)
6. Straight (5 consecutive)
7. Three of a Kind
8. Two Pair
9. One Pair
10. High Card

## File Structure

```
poker-perfect/
├── package.json          # Dependencies & scripts
├── server.js             # WebSocket server + HTTP
├── public/
│   ├── index.html        # Game client (UI)
│   └── game.js           # Game logic
└── README.md             # This file
```

## License

MIT
