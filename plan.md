# Plan — Intégration des données de forme, persistance et automatisation (J1 → J2+)

## 1. Contexte, calendrier et dynamique de jeu

### 1.1 Contexte temporel actuel
- **Statut :** Nous sommes actuellement dans l'intervalle entre la **J1** (terminée) et la **J2** (à venir).
- **Événement clé à court terme :** Publication des compositions officielles d'équipes (feuilles de match) pour la J2 le **vendredi à 18h**. Ce fichier sera intégré sous le nom `feuilles_J2.json`.

### 1.2 Origine des données et cycle de vie
Tous les fichiers JSON manipulés sont des exports extraits par l'utilisateur depuis la plateforme de Fantasy Rugby (Top 14).
1. **Fichiers Effectif (`players_J{n}.json`)** :
   - `players.json` (ou `players_J1.json`) : base initiale de début de saison (715 joueurs), contenant attributs physiques, clubs, postes et prix initial (`valeur`).
   - `playersJ2.json` (ou `players_J2.json`) : effectif actualisé post-J1 (717 joueurs). Il contient les nouvelles valeurs marchandes et intègre un champ **`"moyenne"`** calculé par le jeu pour les joueurs ayant participé à la J1.
2. **Fichiers Instantané de Forme (`forme_J{n}.json`)** :
   - `forme.json` (post-J1) : instantané extrait après les matchs de la J1. Il expose `{id, note, note_prec, delta, ...}`. Actuellement, ce fichier représente un extrait des joueurs les plus en forme (Top 10 post-J1). Le fichier équivalent pour la J2 sera disponible après le déroulement de la J2.
3. **Fichiers Feuilles de Match (`feuilles_J{n}.json`)** :
   - Map `{ [playerId]: numeroDeMaillot }` (1 à 15 pour les titulaires, 16 à 23 pour les remplaçants). Publié le vendredi à 18h la veille de chaque journée.
4. **Calendrier (`calendrier.json`)** :
   - Calendrier complet de la saison avec domiciles/extérieurs par journée.

### 1.3 Évaluation des joueurs : aucune normalisation par poste (ni sur les notes, ni sur les prix)
- **Pour les notes de performance (/100) :** Les critères du jeu sont spécifiquement étalonnés selon le poste et le rôle réel sur le terrain. Un 2e ligne effectuant un gros travail de l'ombre (plaquages, rucks, ballons contrés) est noté sur ses critères propres et peut obtenir un 85/100 au même titre qu'un ailier marquant deux essais.
- **Pour les valeurs marchandes (prix en M€) :** L'économie de la plateforme est également unifiée à l'échelle globale :
  - Les joueurs les plus chers couvrent tous les postes : ouvreur (n°10 Jalibert à 1.05M€), 3e ligne (Willis à 1.05M€), 2e ligne (n°4 Flament à 0.96M€), n°8 (Gorgadze à 0.92M€), ailier (Niniashvili à 0.92M€), demi de mêlée (Lucu à 0.91M€).
  - Le prix moyen par poste est remarquablement homogène sur l'ensemble de l'effectif (entre 0.40M€ et 0.47M€ quel que soit le poste).
  - Un joueur à 0.90M€ représente exactement le même investissement budgétaire et le même statut de "star" qu'il soit pilier ou arrière.
- **Décision d'architecture :**
  - **Aucune normalisation par poste, ni pour les notes, ni pour les prix.**
  - Les notes sont comparées en valeur absolue directe (/100).
  - Le rang de prix (`_priceRank`) passe à une échelle globale (percentile ou min-max sur l'ensemble des ~715 joueurs : [0.05M€ — 1.05M€]), simplifiant le modèle et reflétant fidèlement l'économie globale du jeu.

### 1.4 Gestion des absences de temps de jeu
- Tous les joueurs ne jouent pas chaque week-end (rotation, blessures, non retenus).
- **Règle fondamentale :** Absence de note $\ne$ mauvaise note (0/100). L'absence de note signifie simplement une **absence de données de match**. Pour ces joueurs, l'évaluation doit continuer de s'appuyer sur le signal de prix (ou sur leur historique antérieur s'ils ont joué d'autres journées), sans subir de pénalité arbitraire tant qu'ils sont annoncés sur la feuille de match.

---

## 2. Standardisation des fichiers et organisation de l'historique

Pour éviter les confusions (`players.json` vs `playersJ2.json`, `feuilles.json` vs `feuillesJ1.json`) et automatiser l'accumulation des saisons :

### 2.1 Convention de nommage
Les fichiers sources sont organisés dans un répertoire dédié (ex. `data/` ou `database/`) :
- `data/players_J{n}.json` (ex: `players_J1.json`, `players_J2.json`)
- `data/feuilles_J{n}.json` (ex: `feuilles_J1.json`, `feuilles_J2.json`)
- `data/forme_J{n}.json` (ex: `forme_J1.json`)
- `calendrier.json` (à la racine ou dans `data/`)

### 2.2 Base de données locale & persistance de l'historique
- Conserver systématiquement les JSON bruts de chaque journée dans le dossier de données.
- Au sein de l'application front-end, maintenir un historique cumulé pour chaque joueur :
  ```json
  {
    "id": 45,
    "nom": "Jalibert",
    "valeurInitiale": 1.05,
    "valeur": 1.05,
    "moyenneSite": 75.74,
    "notes": {
      "J1": 75.74
    }
  }
  ```

---

## 3. Découpage du plan d'action

### Phase 0 — Ingestion, discriminateur robuste, persistance & piste d'automatisation

1. **Discrimination fiable dans `detectShape()` (`js/services/parser.js`)** :
   - `players` : Tableau d'objets contenant `valeur`, `taille_cm` ou `poste_secondaire`.
   - `forme` : Tableau d'objets contenant `note` (et ne contenant pas `taille_cm`/`poste_secondaire`).
   - `feuilles` : Objet dictionnaire dont les valeurs sont des entiers (1 à 23).
   - `calendrier` : Objet contenant la structure des matchs/dates.
2. **Identification de la journée d'application** :
   - Lors de l'import d'un fichier de forme, permettre de cibler la journée correspondante (par exemple J1 si on est avant la J2, ou via le numéro sélectionné dans l'interface).
3. **Gestion pérenne de `valeurInitiale`** :
   - Comme `valeur_initiale` n'est pas fournie par les JSON de la plateforme, elle est initialisée par l'application au tout premier import du joueur :
     `p.valeurInitiale = p.valeurInitiale ?? p.valeur;`
   - Lors d'imports ultérieurs (ex. J2 avec `merge = true`), `valeurInitiale` n'est **jamais écrasée**.
4. **Complétude de `exportState()`** :
   - Ajouter explicitement `valeurInitiale`, `moyenne` et l'historique complet de `notes` dans le payload de sortie pour éviter toute perte de données lors d'un cycle export $\rightarrow$ import.
5. **Étude d'automatisation (fetch direct en ligne)** :
   - Documenter le protocole manuel actuellement utilisé (URL des endpoints, headers/cookies de session nécessaires).
   - Concevoir un module ou script d'ingestion directe (Node.js ou fetch navigateur) capable de récupérer automatiquement `players`, `feuilles` (le vendredi 18h) et `forme` dès leur parution, tout en gardant l'import par glisser-déposer en fallback.

---

### Phase 1 — Modèle de données unifié

- Parser sans perte les nouveaux attributs :
  - `p.notes` : dictionnaire `{ "J1": 90.24, ... }`
  - `p.moyenne` : moyenne globale fournie par la plateforme (présente dès `playersJ2.json`)
  - `p.valeurInitiale` : prix d'origine
  - `p.nbJourneesJouees` : nombre de notes réelles enregistrées dans `p.notes` (ou 1 si `p.moyenne` est présent sans détail).
- Gestion robuste du joueur sans match : si `p.notes` est vide et `p.moyenne == null`, le joueur est traité avec neutralité sur la forme (pas de pénalité indue).

---

### Phase 2 — Refonte du scoring & Tiers adaptés au début de saison

1. **Pondération de confiance progressive (échelle absolue globale, sans normalisation par poste)** :
   - Évaluation de performance :
     $\text{perfReelle} = \text{moyenne}(p.\text{notes}) / 100$ (ou $p.\text{moyenne} / 100$)
   - Confiance selon le nombre de matchs joués :
     $\alpha = \min(1, \text{nbMatchs} / 5)$
   - Qualité globale :
     $Q = \alpha \times \text{perfReelle} + (1 - \alpha) \times p.\_priceRankGlobal$
   - *Effet :* En J1 ($\alpha = 0.2$), le prix reste le repère principal ; en J5+, la note réelle domine largement.
2. **Logique des Tiers adaptée au faible échantillon (J1-J2)** :
   - *Problème :* L'écart-type et la variance n'ont aucun sens statistique sur 1 ou 2 matchs ($n < 3$).
   - *Règle de transition :*
     - **Tant que $n < 3$ :** Les tiers sont attribués selon la note/moyenne pondérée par le prix, sans mesure de dispersion. Une excellente note en J1 qualifie en **"Bon choix"** ou **"Pépite"** (si prix bas), mais réserve le label **"Valeur sûre"** aux profils confirmés par le prix ou la régularité.
     - **Dès que $n \ge 3$ :** Activation complète des 4 profils :
       - *Valeur sûre* : moyenne haute + écart-type faible.
       - *Pépite* : ratio performance / prix élevé.
       - *Risqué* : forte dispersion (écart-type élevé, profil imprévisible).
       - *Bon choix* : profil solide standard.
   - *Impact optimiseur :* L'optimiseur excluant les joueurs "Risqué" par défaut, cette progressivité évite de disqualifier à tort des joueurs après un seul match atypique en J1.
3. **Séparation visuelle stricte :**
   - Le signal de marché (dérive $\Delta \text{valeur} = \text{valeur} - \text{valeurInitiale}$) et le signal de terrain (notes réelles) sont présentés de manière distincte.

---

### Phase 3 — Interface Utilisateur (UI)

1. **Tableau Joueurs & Picker** :
   - Affichage de la moyenne réelle et de la dernière note.
   - Badge de fiabilité de l'échantillon ("1 match", "2 matchs", etc.).
   - Visualisation de la variation de valeur ($\Delta$ M€).
2. **Prise en compte des Feuilles J2 (dès 18h vendredi)** :
   - État immédiat : Annoncé titulaire (n° 1 à 15), Remplaçant (n° 16 à 23) ou Hors feuille.
   - Application des bonus/malus d'alignement (`slotAdjustedScore`).
3. **Pépites du week-end (`renderNuggets`)** :
   - Mise à jour du tri pour valoriser les joueurs performants à prix contenu, en tenant compte de la note réelle disponible.

---

### Phase 4 — Rétrospective et optimisation continue (Labo)

- Archivage de la composition choisie à chaque journée (`state.history[Jn] = { squad, captain, impact }`).
- Rétrospective post-match : calcul des points réels marqués vs composition optimale théorique au même budget.

---

### Phase 5 — Automatisation avancée & Scraper / Fetcher direct

- Mise en place du module de synchronisation automatique avec la plateforme.
- Téléchargement et archivage planifiés des JSON à chaque point d'étape hebdomadaire (mercredi : nouveaux prix, vendredi 18h : compositions d'équipes, lundi : notes et formes).