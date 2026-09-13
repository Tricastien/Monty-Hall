'use strict';

/**
 * Vérifie la logique du jeu SANS lancer le serveur.
 * Lancer avec : node test-logic.js
 */

const { hostOpens, remainingClosedDoor, simulate } = require('./gameLogic');

console.log('=== Vérification : le présentateur n\'ouvre jamais la voiture ni la porte du joueur ===');
let violations = 0;
const TRIALS = 200000;
for (let i = 0; i < TRIALS; i++) {
  const carDoor = 1 + Math.floor(Math.random() * 3);
  const playerChoice = 1 + Math.floor(Math.random() * 3);
  const opened = hostOpens(carDoor, playerChoice);
  if (opened === carDoor || opened === playerChoice) violations++;
  if (![1, 2, 3].includes(opened)) violations++;
}
console.log(`${TRIALS} essais, violations détectées : ${violations}`);
if (violations > 0) {
  console.error('ÉCHEC : la règle du présentateur est violée.');
  process.exit(1);
}
console.log('OK\n');

console.log('=== Vérification : remainingClosedDoor renvoie toujours une porte valide ===');
let badRemaining = 0;
for (let i = 0; i < TRIALS; i++) {
  const playerChoice = 1 + Math.floor(Math.random() * 3);
  const others = [1, 2, 3].filter((d) => d !== playerChoice);
  const opened = others[Math.floor(Math.random() * others.length)];
  const remaining = remainingClosedDoor(playerChoice, opened);
  if (remaining === playerChoice || remaining === opened || ![1, 2, 3].includes(remaining)) {
    badRemaining++;
  }
}
console.log(`${TRIALS} essais, anomalies : ${badRemaining}`);
if (badRemaining > 0) {
  console.error('ÉCHEC.');
  process.exit(1);
}
console.log('OK\n');

console.log('=== Convergence vers 1/3 (garder) et 2/3 (changer) ===');
console.log('Valeurs théoriques : GARDER = 33.3 %  |  CHANGER = 66.7 %\n');
for (const n of [100, 1000, 10000, 100000]) {
  const keep = simulate(n, 'keep');
  const change = simulate(n, 'switch');
  const line =
    `n=${String(n).padStart(6)}  |  ` +
    `GARDER: ${(keep.rate * 100).toFixed(1).padStart(5)} %  |  ` +
    `CHANGER: ${(change.rate * 100).toFixed(1).padStart(5)} %`;
  console.log(line);
}

console.log('\nTous les tests sont passés.');
