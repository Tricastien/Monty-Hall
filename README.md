# Monty Hall — Jeu interactif pour une classe

Application web temps réel : les élèves jouent depuis leur téléphone,
le professeur projette un tableau de bord live sur l'écran de classe.

## 1. Fichiers du projet

```
monty-hall-app/
├── package.json
├── server.js          # serveur Express + Socket.io (logique réseau/sessions)
├── gameLogic.js        # règles du jeu Monty Hall, pur JS, sans dépendance
├── test-logic.js        # vérifie la logique (aucun serveur nécessaire)
├── public/
│   ├── student.html    # interface élève (mobile)
│   ├── student.js
│   ├── teacher.html    # interface professeur (vidéoprojecteur)
│   ├── teacher.js
│   └── style.css
└── README.md
```

Tous ces fichiers sont déjà prêts. Il n'y a rien à écrire vous-même.

## 2. Installer les dépendances

Il vous faut [Node.js](https://nodejs.org/) (version 18 ou plus) installé sur
votre ordinateur.

Ouvrez un terminal dans le dossier `monty-hall-app/` et lancez :

```bash
npm install
```

Cela télécharge les deux seules dépendances : `express` (serveur web) et
`socket.io` (communication temps réel).

## 3. Vérifier la logique du jeu (optionnel mais recommandé)

Avant même de lancer le serveur, vous pouvez vérifier que les règles du jeu
sont correctement respectées (le présentateur n'ouvre jamais la voiture, les
probabilités convergent bien vers 1/3 et 2/3) :

```bash
node test-logic.js
```

Vous devez voir `Tous les tests sont passés.` à la fin.

## 4. Lancer l'application en local

```bash
npm start
```

Le serveur démarre sur `http://localhost:3000`.

- Interface élève : `http://localhost:3000/`
- Interface professeur : `http://localhost:3000/teacher`

Pour tester en local avec votre téléphone (sur le même réseau Wi-Fi que
votre ordinateur), remplacez `localhost` par l'adresse IP locale de votre
ordinateur (par exemple `http://192.168.1.23:3000`).

## 5. Mettre l'application en ligne (gratuit)

La solution la plus simple pour ce type d'application (serveur + WebSocket,
sans base de données) est **[Render](https://render.com)**. C'est gratuit
pour un usage occasionnel comme le vôtre, et ça ne demande aucune
administration serveur.

### Étapes

1. **Créez un compte** sur [render.com](https://render.com) (gratuit,
   connexion possible avec GitHub).

2. **Mettez votre code sur GitHub** :
   - Créez un nouveau dépôt (repository) sur [github.com](https://github.com).
   - Uploadez-y tout le contenu du dossier `monty-hall-app/` (vous pouvez
     glisser-déposer les fichiers directement depuis l'interface web de
     GitHub, pas besoin de ligne de commande).

3. **Créez un nouveau service sur Render** :
   - Cliquez sur **New +** → **Web Service**.
   - Connectez votre dépôt GitHub.
   - Render détecte automatiquement Node.js. Vérifiez ces réglages :
     - **Build Command** : `npm install`
     - **Start Command** : `npm start`
     - **Instance Type** : Free
   - Cliquez sur **Create Web Service**.

4. **Attendez le déploiement** (1 à 2 minutes). Render vous donne une URL
   publique du type :

   ```
   https://monty-hall-classe.onrender.com
   ```

5. **C'est prêt !**
   - Vous (le professeur), allez sur `https://monty-hall-classe.onrender.com/teacher`
   - Vos élèves vont sur `https://monty-hall-classe.onrender.com/`

> **Note sur le plan gratuit de Render** : un service gratuit se met en
> veille après 15 minutes d'inactivité, et met alors 30 à 60 secondes à se
> "réveiller" au premier accès. Pensez à ouvrir la page professeur quelques
> minutes avant le début du cours pour que le serveur soit bien réveillé.

## 6. Déroulé en classe

1. **Le professeur** ouvre la page `/teacher` et clique sur
   **CRÉER UNE PARTIE**. Un code à 6 caractères apparaît (ex. `M7K4P2`).
2. **Les élèves** vont sur l'URL principale depuis leur téléphone, entrent
   ce code et, s'ils le souhaitent, leur prénom.
3. **Phase 1 — Découverte** : chaque élève joue librement, à son rythme,
   en choisissant GARDER ou CHANGER. Le tableau de bord du professeur se
   met à jour en temps réel.
4. **Phase 2 — Comparaison** : le tableau de bord affiche déjà la
   comparaison GARDER / CHANGER en direct (nombre de parties, victoires,
   taux de réussite, graphique).
5. **Phase 3 — Grande expérience** : le professeur clique sur un des
   boutons de simulation (100 / 1 000 / 10 000 / 100 000 parties) pour
   montrer la convergence vers les valeurs théoriques.
6. **Phase 4 — Explication** : le tableau de bord affiche l'explication
   pédagogique du résultat, prête à commenter à l'oral.
7. **Défi de la classe** (optionnel, à tout moment) : le professeur clique
   sur **Démarrer une manche collective** — tous les élèves jouent la même
   manche en simultané, le professeur voit les portes choisies en direct,
   révèle l'ouverture pour tout le monde, puis les décisions, puis les
   résultats.
8. En fin de session, le bouton **Réinitialiser** remet tous les compteurs
   à zéro pour la classe suivante (aucun prénom n'est conservé au-delà de
   la session : tout est en mémoire et disparaît au redémarrage du
   serveur ou à la réinitialisation).

## 7. Ce que la logique garantit (voir `gameLogic.js` et `test-logic.js`)

- Le présentateur n'ouvre **jamais** la porte contenant la voiture, ni la
  porte choisie par l'élève.
- Le choix initial (GARDER) a bien une probabilité de victoire de 1/3.
- Le changement (CHANGER) a bien une probabilité de victoire de 2/3.
- Les statistiques collectives (`server.js`, fonction `aggregatedStats`)
  agrègent correctement tous les élèves connectés.
- Chaque élève a son propre état de partie (`socket.data.pendingRound`),
  stocké côté serveur par connexion : plusieurs élèves peuvent jouer en
  même temps sans mélanger leurs parties.

## 8. Limites connues (transparence)

- Les données (sessions, scores) sont stockées **en mémoire** sur le
  serveur : elles sont perdues si le serveur redémarre. C'est un choix
  volontaire, cohérent avec la consigne de ne rien conserver après la
  classe.
- Si le professeur **recharge ou ferme** l'onglet `/teacher` pendant une
  session, celle-ci se termine (le code cesse de fonctionner) : les
  élèves devront rejoindre une nouvelle session. Évitez de rafraîchir
  cette page pendant le cours.
- Le plan gratuit de Render n'est pas adapté à un usage intensif toute la
  journée — il convient très bien pour quelques séances de classe.
- L'application n'a pas de mot de passe : n'importe qui connaissant le
  code à 6 caractères peut rejoindre la session. C'est voulu pour rester
  simple, mais évitez de partager le code en dehors de la classe.
