'use strict';

const socket = io();

const screens = {
  create: document.getElementById('screen-create'),
  dashboard: document.getElementById('screen-dashboard'),
};
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ---- Créer une session -------------------------------------------------
document.getElementById('btn-create').addEventListener('click', () => {
  socket.emit('teacher:create-session', {}, ({ code }) => {
    document.getElementById('session-code').textContent = code;
    showScreen('dashboard');
  });
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('Réinitialiser toutes les statistiques de cette session ?')) {
    socket.emit('teacher:reset-session');
  }
});

// ---- Graphique en direct (barres GARDER vs CHANGER) ---------------------
const ctx = document.getElementById('chart-live').getContext('2d');
const liveChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['GARDER', 'CHANGER'],
    datasets: [{
      label: 'Taux de réussite (%)',
      data: [0, 0],
      backgroundColor: ['#3b82f6', '#22c55e'],
    }],
  },
  options: {
    scales: { y: { beginAtZero: true, max: 100 } },
    plugins: { legend: { display: false } },
    animation: { duration: 300 },
  },
});

socket.on('teacher:stats', (stats) => {
  document.getElementById('connected-count').textContent = stats.totalPlayers;
  document.getElementById('stat-keep-plays').textContent = stats.keepPlays;
  document.getElementById('stat-keep-wins').textContent = stats.keepWins;
  document.getElementById('stat-keep-rate').textContent = `${Math.round(stats.keepRate * 100)} %`;
  document.getElementById('stat-switch-plays').textContent = stats.switchPlays;
  document.getElementById('stat-switch-wins').textContent = stats.switchWins;
  document.getElementById('stat-switch-rate').textContent = `${Math.round(stats.switchRate * 100)} %`;

  liveChart.data.datasets[0].data = [stats.keepRate * 100, stats.switchRate * 100];
  liveChart.update();
});

socket.on('session:reset', () => {
  document.getElementById('connected-count').textContent = '0';
  ['keep', 'switch'].forEach((k) => {
    document.getElementById(`stat-${k}-plays`).textContent = '0';
    document.getElementById(`stat-${k}-wins`).textContent = '0';
    document.getElementById(`stat-${k}-rate`).textContent = '0 %';
  });
  liveChart.data.datasets[0].data = [0, 0];
  liveChart.update();
  document.getElementById('challenge-live').classList.add('hidden');
  document.getElementById('challenge-final').classList.add('hidden');
});

// ---- Défi de la classe ---------------------------------------------
const challengeLive = document.getElementById('challenge-live');
const challengeFinal = document.getElementById('challenge-final');
const decisionLine = document.getElementById('cc-decision-line');
const btnRevealOpenings = document.getElementById('btn-reveal-openings');
const btnRevealResults = document.getElementById('btn-reveal-results');

document.getElementById('btn-start-challenge').addEventListener('click', () => {
  socket.emit('teacher:start-class-challenge');
  challengeLive.classList.remove('hidden');
  challengeFinal.classList.add('hidden');
  decisionLine.classList.add('hidden');
  btnRevealResults.classList.add('hidden');
  btnRevealOpenings.classList.remove('hidden');
  document.getElementById('cc-door-counts').textContent = '1: 0 · 2: 0 · 3: 0';
});

btnRevealOpenings.addEventListener('click', () => {
  socket.emit('teacher:class-reveal-openings');
  btnRevealOpenings.classList.add('hidden');
  decisionLine.classList.remove('hidden');
  btnRevealResults.classList.remove('hidden');
});

btnRevealResults.addEventListener('click', () => {
  socket.emit('teacher:class-reveal-results');
});

socket.on('teacher:class-choice-counts', ({ counts, answered, total }) => {
  document.getElementById('cc-door-counts').textContent = `1: ${counts[1]} · 2: ${counts[2]} · 3: ${counts[3]}`;
  document.getElementById('cc-choose-answered').textContent = answered;
  document.getElementById('cc-choose-total').textContent = total;
});

socket.on('teacher:class-decision-counts', ({ counts, answered, total }) => {
  document.getElementById('cc-keep-count').textContent = counts.keep;
  document.getElementById('cc-switch-count').textContent = counts.switch;
  document.getElementById('cc-decide-answered').textContent = answered;
  document.getElementById('cc-decide-total').textContent = total;
});

socket.on('teacher:class-final', ({ carDoor, keepWins, keepTotal, switchWins, switchTotal }) => {
  challengeLive.classList.add('hidden');
  challengeFinal.classList.remove('hidden');
  document.getElementById('cc-final-text').textContent =
    `La voiture était derrière la porte ${carDoor}. ` +
    `Ceux qui ont gardé : ${keepWins}/${keepTotal} victoires. ` +
    `Ceux qui ont changé : ${switchWins}/${switchTotal} victoires.`;
});

// ---- Simulation --------------------------------------------------
document.querySelectorAll('.sim-buttons button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const count = parseInt(btn.dataset.count, 10);
    socket.emit('teacher:run-simulation', { count });
  });
});

socket.on('teacher:simulation-result', (res) => {
  document.getElementById('sim-result').classList.remove('hidden');
  document.getElementById('sim-keep-wins').textContent = res.keep.wins;
  document.getElementById('sim-switch-wins').textContent = res.switch.wins;
  document.getElementById('sim-keep-rate').textContent = `${(res.keep.rate * 100).toFixed(1)} %`;
  document.getElementById('sim-switch-rate').textContent = `${(res.switch.rate * 100).toFixed(1)} %`;
});
