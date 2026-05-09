const { WebSocketServer } = require('ws');

const subscribers = new Map();

function attachSpectator(server) {
  const wss = new WebSocketServer({ server, path: '/ws/spectate' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://x');
    const gameId = url.searchParams.get('gameId');
    if (!gameId) {
      ws.close(1008, 'gameId required');
      return;
    }
    if (!subscribers.has(gameId)) subscribers.set(gameId, new Set());
    subscribers.get(gameId).add(ws);

    ws.on('close', () => {
      const set = subscribers.get(gameId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) subscribers.delete(gameId);
      }
    });

    ws.send(JSON.stringify({ type: 'connected', gameId }));
  });

  return wss;
}

function broadcastGameUpdate(gameId, payload) {
  const set = subscribers.get(gameId);
  if (!set) return;
  const msg = JSON.stringify({ type: 'update', gameId, ...payload });
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

module.exports = { attachSpectator, broadcastGameUpdate };
