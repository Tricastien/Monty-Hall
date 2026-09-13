'use strict';

/**
 * Logique pure du jeu de Monty Hall.
 * Aucune dépendance réseau ici : ces fonctions sont testables isolément
 * (voir test-logic.js) avant même de lancer le serveur.
 */

function randomDoor() {
  return 1 + Math.floor(Math.random() * 3);
}

function otherDoors(door) {
  return [1, 2, 3].filter((d) => d !== door);
}

/**
 * Le présentateur ouvre une porte qui n'est JAMAIS :
 *  - la porte contenant la voiture
 *  - la porte choisie par le joueur
 * S'il a le choix entre deux portes valides (le joueur a choisi la porte
 * de la voiture), il choisit au hasard parmi elles.
 */
function hostOpens(carDoor, playerChoice) {
  const candidates = [1, 2, 3].filter((d) => d !== carDoor && d !== playerChoice);
  if (candidates.length === 1) return candidates[0];
  // playerChoice === carDoor : les deux autres portes sont valides.
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** La seule porte fermée restante après l'ouverture du présentateur. */
function remainingClosedDoor(playerChoice, openedDoor) {
  return [1, 2, 3].find((d) => d !== playerChoice && d !== openedDoor);
}

/**
 * Joue une manche complète.
 * @param {number} playerChoice - porte choisie initialement (1, 2 ou 3)
 * @param {'keep'|'switch'} decision
 * @param {number} [carDoor] - porte de la voiture (générée aléatoirement si omise)
 */
function playRound(playerChoice, decision, carDoor = randomDoor()) {
  const openedDoor = hostOpens(carDoor, playerChoice);
  const switchDoor = remainingClosedDoor(playerChoice, openedDoor);
  const finalDoor = decision === 'switch' ? switchDoor : playerChoice;
  const win = finalDoor === carDoor;
  return { carDoor, openedDoor, switchDoor, finalDoor, win };
}

/**
 * Simule un grand nombre de parties avec une stratégie fixe.
 * Par symétrie du jeu, le choix initial du joueur peut être fixé à 1 :
 * seule la position aléatoire de la voiture varie d'une partie à l'autre.
 */
function simulate(count, decision) {
  let wins = 0;
  for (let i = 0; i < count; i++) {
    const { win } = playRound(1, decision);
    if (win) wins++;
  }
  return { count, wins, rate: count ? wins / count : 0 };
}

module.exports = { randomDoor, hostOpens, remainingClosedDoor, playRound, simulate };
