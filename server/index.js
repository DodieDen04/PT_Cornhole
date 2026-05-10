require('dotenv/config');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { attachSpectator } = require('./lib/spectator');

const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/players');
const gameRoutes = require('./routes/games');
const roundRoutes = require('./routes/rounds');
const throwRoutes = require('./routes/throws');
const setRoutes = require('./routes/sets');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const tournamentRoutes = require('./routes/tournaments');
const groupRoutes = require('./routes/groups');
const invitationRoutes = require('./routes/invitations');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/rounds', roundRoutes);
app.use('/api/throws', throwRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api', setRoutes);

const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const server = http.createServer(app);
attachSpectator(server);
server.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
