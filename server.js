'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { hostOpens, remainingClosedDoor, simulate } = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});
app.get('/teacher', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
});

// ---------------------------------------------------------------------
// Stockage en mémoire (une session = une classe). Tout disparaît au
// redémarrage du serveur, ce qui est volontaire : on ne conserve rien
// entre deux classes.
// ---------------------------------------------------------------------
const sessions = Object.create(null);

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I ambigus

function makeSessionCode() {
  let code;
  do {
    code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (sessions[code]);
  return code;
}

function emptyStats() {
  return { keepPlays: 0, keepWins: 0, switchPlays: 0, switchWins: 0 };
}

function newSession(teacherSocketId) {
  return {
    teacherSocketId,
    players: Object.create(null), // socketId -> { name, stats }
    stats: emptyStats(),          // agrégat de toute la session
    classChallenge: null,
  };
}

function aggregatedStats(session) {
  const s = session.stats;
  return {
    totalPlayers: Object.keys(session.players).length,
    totalGames: s.keepPlays + s.switchPlays,
    keepPlays: s.keepPlays,
    keepWins: s.keepWins,
    keepRate: s.keepPlays ? s.keepWins / s.keepPlays : 0,
    switchPlays: s.switchPlays,
    switchWins: s.switchWins,
    switchRate: s.switchPlays ? s.switchWins / s.switchPlays : 0,
  };
}

function recordResult(session, player, decision, win) {
  const key = decision === 'switch' ? 'switch' : 'keep';
  player.stats[`${key}Plays`]++;
  session.stats[`${key}Plays`]++;
  if (win) {
    player.stats[`${key}Wins`]++;
    session.stats[`${key}Wins`]++;
  }
}

io.on('connection', (socket) => {
  // ---- PROFESSEUR --------------------------------------------------

  socket.on('teacher:create-session', (_payload, ack) => {
    const code = makeSessionCode();
    sessions[code] = newSession(socket.id);
    socket.join(code);
    socket.data.role = 'teacher';
    socket.data.code = code;
    if (ack) ack({ code });
  });

  socket.on('teacher:run-simulation', ({ count } = {}) => {
    const session = sessions[socket.data.code];
    if (!session) return;
    const n = Math.min(Math.max(parseInt(count, 10) || 0, 1), 200000);
    const keep = simulate(n, 'keep');
    const change = simulate(n, 'switch');
    socket.emit('teacher:simulation-result', {
      count: n,
      keep: { wins: keep.wins, rate: keep.rate },
      switch: { wins: change.wins, rate: change.rate },
      theoretical: { keep: 1 / 3, switch: 2 / 3 },
    });
  });

  socket.on('teacher:start-class-challenge', () => {
    const session = sessions[socket.data.code];
    if (!session) return;
    session.classChallenge = {
      carDoor: 1 + Math.floor(Math.random() * 3),
      choices: Object.create(null),
      openedDoors: Object.create(null),
      decisions: Object.create(null),
      phase: 'choosing',
    };
    io.to(socket.data.code).emit('class-challenge:started');
  });

  socket.on('teacher:class-reveal-openings', () => {
    const session = sessions[socket.data.code];
    const cc = session && session.classChallenge;
    if (!cc || cc.phase !== 'choosing') return;
    cc.phase = 'deciding';
    Object.keys(cc.choices).forEach((sid) => {
      io.to(sid).emit('class-challenge:door-opened', { openedDoor: cc.openedDoors[sid] });
    });
  });

  socket.on('teacher:class-reveal-results', () => {
    const session = sessions[socket.data.code];
    const cc = session && session.classChallenge;
    if (!cc) return;
    cc.phase = 'revealed';

    let keepWins = 0, keepTotal = 0, switchWins = 0, switchTotal = 0;
    Object.keys(cc.choices).forEach((sid) => {
      const choice = cc.choices[sid];
      const opened = cc.openedDoors[sid];
      const decision = cc.decisions[sid] || 'keep';
      const switchDoor = remainingClosedDoor(choice, opened);
      const finalDoor = decision === 'switch' ? switchDoor : choice;
      const win = finalDoor === cc.carDoor;

      if (decision === 'switch') { switchTotal++; if (win) switchWins++; }
      else { keepTotal++; if (win) keepWins++; }

      const player = session.players[sid];
      if (player) recordResult(session, player, decision, win);

      io.to(sid).emit('class-challenge:result', { win, carDoor: cc.carDoor, finalDoor });
    });

    io.to(session.teacherSocketId).emit('teacher:class-final', {
      carDoor: cc.carDoor, keepWins, keepTotal, switchWins, switchTotal,
    });
    io.to(session.teacherSocketId).emit('teacher:stats', aggregatedStats(session));
    session.classChallenge = null;
  });

  socket.on('teacher:reset-session', () => {
    const code = socket.data.code;
    const session = sessions[code];
    if (!session) return;
    sessions[code] = newSession(socket.id);
    io.to(code).emit('session:reset');
  });

  // ---- ÉLÈVE ---------------------------------------------------------

  socket.on('student:join-session', ({ code, name } = {}, ack) => {
    const normalizedCode = (code || '').trim().toUpperCase();
    const session = sessions[normalizedCode];
    if (!session) {
      if (ack) ack({ error: 'CODE_INVALIDE' });
      return;
    }
    socket.join(normalizedCode);
    socket.data.role = 'student';
    socket.data.code = normalizedCode;
    session.players[socket.id] = { name: (name || 'Élève').slice(0, 20), stats: emptyStats() };
    if (ack) ack({ ok: true });
    io.to(session.teacherSocketId).emit('teacher:stats', aggregatedStats(session));
  });

  socket.on('student:choose-door', ({ door } = {}, ack) => {
    const session = sessions[socket.data.code];
    if (!session || !session.players[socket.id]) return;
    if (![1, 2, 3].includes(door)) return;
    const carDoor = 1 + Math.floor(Math.random() * 3);
    const openedDoor = hostOpens(carDoor, door);
    socket.data.pendingRound = { carDoor, playerChoice: door, openedDoor };
    if (ack) ack({ openedDoor });
  });

  socket.on('student:decision', ({ decision } = {}, ack) => {
    const session = sessions[socket.data.code];
    const round = socket.data.pendingRound;
    const player = session && session.players[socket.id];
    if (!session || !round || !player) return;

    const switchDoor = remainingClosedDoor(round.playerChoice, round.openedDoor);
    const finalDoor = decision === 'switch' ? switchDoor : round.playerChoice;
    const win = finalDoor === round.carDoor;

    recordResult(session, player, decision, win);
    socket.data.pendingRound = null;

    if (ack) ack({ win, carDoor: round.carDoor, finalDoor, personalStats: player.stats });
    io.to(session.teacherSocketId).emit('teacher:stats', aggregatedStats(session));
  });

  socket.on('student:class-choose-door', ({ door } = {}) => {
    const session = sessions[socket.data.code];
    const cc = session && session.classChallenge;
    if (!cc || cc.phase !== 'choosing' || !session.players[socket.id]) return;
    if (![1, 2, 3].includes(door)) return;
    cc.choices[socket.id] = door;
    cc.openedDoors[socket.id] = hostOpens(cc.carDoor, door);

    const counts = { 1: 0, 2: 0, 3: 0 };
    Object.values(cc.choices).forEach((d) => counts[d]++);
    io.to(session.teacherSocketId).emit('teacher:class-choice-counts', {
      counts, answered: Object.keys(cc.choices).length, total: Object.keys(session.players).length,
    });
  });

  socket.on('student:class-decision', ({ decision } = {}) => {
    const session = sessions[socket.data.code];
    const cc = session && session.classChallenge;
    if (!cc || cc.phase !== 'deciding' || cc.choices[socket.id] === undefined) return;
    cc.decisions[socket.id] = decision === 'switch' ? 'switch' : 'keep';

    const counts = { keep: 0, switch: 0 };
    Object.values(cc.decisions).forEach((d) => counts[d]++);
    io.to(session.teacherSocketId).emit('teacher:class-decision-counts', {
      counts, answered: Object.keys(cc.decisions).length, total: Object.keys(cc.choices).length,
    });
  });

  // ---- DÉCONNEXION ----------------------------------------------------

  socket.on('disconnect', () => {
    const code = socket.data.code;
    const session = sessions[code];
    if (!session) return;
    if (socket.data.role === 'student') {
      delete session.players[socket.id];
      io.to(session.teacherSocketId).emit('teacher:stats', aggregatedStats(session));
    } else if (socket.data.role === 'teacher' && session.teacherSocketId === socket.id) {
      delete sessions[code];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur Monty Hall lancé sur le port ${PORT}`);
});
