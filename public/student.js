'use strict';

const socket = io();

// ---- Navigation entre écrans -----------------------------------------
const screens = {
  join: document.getElementById('screen-join'),
  choose: document.getElementById('screen-choose'),
  decide: document.getElementById('screen-decide'),
  result: document.getElementById('screen-result'),
};
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ---- État local ---------------------------------------------------
let wins = 0;
let games = 0;
let inClassChallenge = false; // vrai pendant un "Défi de la classe"

// ---- Écran 1 : rejoindre --------------------------------------------
const inputCode = document.getElementById('input-code');
const inputName = document.getElementById('input-name');
const joinError = document.getElementById('join-error');

document.getElementById('btn-join').addEventListener('click', () => {
  const code = inputCode.value.trim().toUpperCase();
  const name = inputName.value.trim();
  if (code.length !== 6) {
    joinError.textContent = 'Le code doit comporter 6 caractères.';
    return;
  }
  socket.emit('student:join-session', { code, name }, (res) => {
    if (!res || res.error) {
      joinError.textContent = 'Code invalide. Vérifie avec ton professeur.';
      return;
    }
    joinError.textContent = '';
    showScreen('choose');
  });
});

// ---- Écran 2 : choisir une porte (individuel ou défi de la classe) ----
document.getElementById('doors-choose').addEventListener('click', (e) => {
  const btn = e.target.closest('.door');
  if (!btn) return;
  const door = parseInt(btn.dataset.door, 10);

  if (inClassChallenge) {
    socket.emit('student:class-choose-door', { door });
    pendingChoice = door;
    document.getElementById('status-line').textContent = 'Choix enregistré !';
    document.getElementById('waiting-challenge').classList.remove('hidden');
    return;
  }

  document.getElementById('status-line').textContent = 'En attente du présentateur…';
  socket.emit('student:choose-door', { door }, (res) => {
    if (!res) return;
    pendingChoice = door;
    pendingOpened = res.openedDoor;
    renderDecideScreen(door, res.openedDoor);
    showScreen('decide');
  });
});

let pendingChoice = null;
let pendingOpened = null;

function renderDecideScreen(playerChoice, openedDoor) {
  document.getElementById('opened-line').textContent = `Le présentateur ouvre la porte ${openedDoor}.`;
  const container = document.getElementById('doors-decide');
  container.innerHTML = '';
  [1, 2, 3].forEach((d) => {
    const div = document.createElement('div');
    div.className = 'door door-static';
    if (d === openedDoor) {
      div.classList.add('door-open');
      div.innerHTML = '<span class="door-face">🐐</span><span class="door-label">' + d + '</span>';
    } else if (d === playerChoice) {
      div.classList.add('door-picked');
      div.innerHTML = '<span class="door-face">🚪</span><span class="door-label">' + d + '</span>';
    } else {
      div.innerHTML = '<span class="door-face">🚪</span><span class="door-label">' + d + '</span>';
    }
    container.appendChild(div);
  });
  document.getElementById('waiting-decision').classList.add('hidden');
}

// ---- Écran 3 : garder / changer ---------------------------------------
document.getElementById('btn-keep').addEventListener('click', () => makeDecision('keep'));
document.getElementById('btn-switch').addEventListener('click', () => makeDecision('switch'));

function makeDecision(decision) {
  if (inClassChallenge) {
    socket.emit('student:class-decision', { decision });
    document.getElementById('waiting-decision').classList.remove('hidden');
    return;
  }
  socket.emit('student:decision', { decision }, (res) => {
    if (!res) return;
    games++;
    if (res.win) wins++;
    showResult(res.win, res.carDoor);
  });
}

function showResult(win, carDoor) {
  document.getElementById('result-emoji').textContent = win ? '🚗' : '🐐';
  document.getElementById('result-text').textContent = win ? 'GAGNÉ !' : 'PERDU !';
  document.getElementById('result-detail').textContent = `La voiture était derrière la porte ${carDoor}.`;
  document.getElementById('score-wins').textContent = wins;
  document.getElementById('score-games').textContent = games;
  showScreen('result');
}

document.getElementById('btn-replay').addEventListener('click', () => {
  document.getElementById('status-line').textContent = 'Choisissez une porte';
  showScreen('choose');
});

// ---- Défi de la classe (mode collectif piloté par le professeur) ------
socket.on('class-challenge:started', () => {
  inClassChallenge = true;
  document.getElementById('status-line').textContent = 'Défi de la classe : choisissez une porte !';
  document.getElementById('waiting-challenge').classList.add('hidden');
  showScreen('choose');
});

socket.on('class-challenge:door-opened', ({ openedDoor }) => {
  pendingOpened = openedDoor;
  renderDecideScreen(pendingChoice, openedDoor);
  showScreen('decide');
});

socket.on('class-challenge:result', ({ win, carDoor }) => {
  games++;
  if (win) wins++;
  inClassChallenge = false;
  showResult(win, carDoor);
});

socket.on('session:reset', () => {
  wins = 0;
  games = 0;
  inClassChallenge = false;
  showScreen('choose');
});
