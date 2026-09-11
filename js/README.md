# Le P'tit Buro - Assistant Week-end (Rugby)

Bienvenue dans **Le P'tit Buro**, une application web front-end moderne conçue pour gérer, optimiser et suivre les compositions d'équipe, les budgets et le calendrier d'un week-end de rugby. 

Ce document détaille l'architecture du projet et vous indique précisément où regarder dans le code selon ce que vous souhaitez analyser ou modifier (par exemple, la gestion des fichiers JSON).

---

## 📂 Structure du Projet

```text
C:.
│   calendrier.json
│   feuillesJ1.json
│   index.html
│   playersJ1.json
│   playersJ2.json
│
├───css
│       styles.css
│
└───js
    │   main.js
    │   state.js
    │
    ├───engine
    │       optimizer.js
    │       scoring.js
    │
    └───services
            parser.js
    │
    └───ui
            components.js
            renderer.js
```

---

## 🔍 Guide des Fichiers (Où aller chercher quoi ?)

### 1. Fichiers à la Racine (Données et Point d'entrée)

* **`index.html`**
  * **Rôle :** Le squelette HTML de l'application. Il contient l'élément conteneur `#app` et charge le point d'entrée JavaScript (`js/main.js`).
  * **À checker si :** Vous voulez modifier le titre de la page ou ajouter des bibliothèques externes tierces.

* **Fichiers JSON de données (`calendrier.json`, `players.json`, `playersJ2.json`, `feuilles.json`, `forme.json`)**
  * **Rôle :** Jeux de données extraits de la plateforme Fantasy :
    * `calendrier.json` : calendrier complet de la saison (chargé automatiquement au démarrage).
    * `players.json` (J1) / `playersJ2.json` (J2) : effectifs complets (prix, postes, clubs, forfaits et champ `"moyenne"` calculé post-J1).
    * `forme.json` : instantané des performances et notes de forme (post-J1).
    * `feuilles.json` (ou `feuillesJ2.json` dès 18h le vendredi) : feuilles de match officielles (titulaires 1-15, remplaçants 16-23).
  * **Comment synchroniser automatiquement ces fichiers ?** 
    * 📍 *Réponse directe :* Vous pouvez lancer la commande `npm run sync` (ou `node scripts/sync.mjs`). Ce script interroge directement l'API de la plateforme Fantasy, télécharge et archive proprement les données dans le dossier `data/` (`players_J1.json`, `players_J2.json`, `feuilles_J1.json`, `feuilles_J2.json`, `calendrier.json`) et met à jour automatiquement les fichiers actifs à la racine pour l'application.

---

### 2. Dossier `/css` (Styles)

* **`css/styles.css`**
  * **Rôle :** Feuille de styles globale de l'application. Elle gère le thème sombre (mode nuit), la mise en page générale, les composants de l'interface (boutons, modales, jauges de budget) et la disposition visuelle du terrain de rugby.
  * **À checker si :** Vous voulez modifier les couleurs, l'apparence des cartes de joueurs ou le design des tableaux.

---

### 3. Dossier `/js` (Cœur de l'application)

* **`js/main.js`**
  * **Rôle :** Le chef d'orchestre (point d'entrée JavaScript). C'est lui qui initialise l'application, écoute les actions globales et déclenche le rendu initial.
  * **À checker si :** Vous voulez comprendre le cycle de vie du démarrage de l'application ou l'enchaînement des écrans.

* **`js/state.js`**
  * **Rôle :** La gestion de l'état global (Store). Il conserve les données en mémoire (joueurs sélectionnés, budget actuel, journée active, etc.).
  * **À checker si :** Vous cherchez où sont stockées les données modifiées par l'utilisateur en cours de session.

---

### 4. Sous-dossier `/js/engine` (Algorithmes et Logique Métier)

* **`js/engine/optimizer.js`**
  * **Rôle :** Le moteur d'optimisation. Il calcule les meilleures configurations d'équipe possibles en fonction des contraintes budgétaires, des postes et des performances.
  * **À checker si :** Vous souhaitez auditer ou modifier la logique mathématique/heuristique de placement ou de suggestion automatique des joueurs.

* **`js/engine/scoring.js`**
  * **Rôle :** Le calcul des notes, des bonus, des malus et de l'évaluation globale des joueurs ou des compositions.
  * **À checker si :** Vous voulez modifier la façon dont les points ou les critères de sélection (pépites, risques, etc.) sont évalués.

---

### 5. Sous-dossier `/js/services` (Traitements externes)

* **`js/services/parser.js`**
  * **Rôle :** L'analyseur de données. C'est ici que sont lues, parsées et validées les structures de données entrantes (notamment la lecture des fichiers JSON comme `calendrier.json` ou les fichiers de joueurs).
  * **📍 À checker précisément si vous vous demandez comment le code gère le `calendrier.json` :** C'est **ici** qu'il faut aller regarder pour voir si l'application attend un chargement utilisateur ou si elle va piocher directement dans les fichiers JSON présents à la racine.

---

### 6. Sous-dossier `/js/ui` (Interface Utilisateur)

* **`js/ui/components.js`**
  * **Rôle :** Contient la définition des composants visuels réutilisables (boutons spécifiques, modales de sélection de joueurs, menus, etc.).
  * **À checker si :** Vous souhaitez modifier l'interactivité ou l'HTML dynamique généré pour certains blocs de l'interface.

* **`js/ui/renderer.js`**
  * **Rôle :** Le moteur de rendu graphique. Il met à jour l'affichage sur le DOM en fonction des changements d'état (par exemple, dessiner le terrain de rugby, placer les joueurs sur leurs postes, actualiser la jauge de budget).
  * **À checker si :** Un élément visuel ne se met pas à jour correctement ou pour changer la structure de l'affichage du terrain.