/**
 * Script de synchronisation automatique avec l'API fantasy.poneeey.fr
 * Usage :
 *   node scripts/sync.mjs             (synchronise la journée courante et l'historique)
 *   node scripts/sync.mjs --journee 2 (force la synchronisation de la J2)
 */

import fs from 'fs';
import path from 'path';

// Configuration
const BASE_URL = 'https://fantasy.poneeey.fr/api';

function resolveToken() {
  if (process.env.FANTASY_TOKEN) return process.env.FANTASY_TOKEN;
  try {
    if (fs.existsSync('./config.local.json')) {
      const cfg = JSON.parse(fs.readFileSync('./config.local.json', 'utf8'));
      if (cfg.token) return cfg.token;
    }
  } catch (e) {}
  return null;
}

const TOKEN = resolveToken();
if (!TOKEN) {
  console.error("⚠️ Aucun token trouvé. Renseignez votre token dans config.local.json ou via la variable d'environnement FANTASY_TOKEN.");
}

const HEADERS = {
  'Accept': 'application/json',
  'Authorization': `Bearer ${TOKEN}`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  'Referer': 'https://fantasy.poneeey.fr/'
};

const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function apiFetch(endpoint) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} sur ${endpoint}`);
  }
  return res.json();
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  💾 Enregistré : ${filePath}`);
}

// 1. Synchroniser les matchs / calendrier
async function syncCalendrier() {
  console.log('\n📅 Synchronisation du calendrier...');
  try {
    const raw = await apiFetch('/top14/matchs');
    saveJSON(path.join(DATA_DIR, 'matchs_api_raw.json'), raw);

    // Conversion au format attendu par calendrier.json du projet
    const seasonKey = 'top14_2026';
    const calendrierFormatted = { [seasonKey]: {} };

    for (const m of raw.matchs || []) {
      const jKey = `J${m.journee}`;
      if (!calendrierFormatted[seasonKey][jKey]) {
        calendrierFormatted[seasonKey][jKey] = {
          dates: [],
          matches: []
        };
      }
      const jObj = calendrierFormatted[seasonKey][jKey];
      const matchDate = m.date ? m.date.slice(0, 10) : null;
      if (matchDate && !jObj.dates.includes(matchDate)) {
        jObj.dates.push(matchDate);
      }
      jObj.matches.push({
        home: m.dom.nom,
        away: m.ext.nom,
        homeCode: m.dom.abrev,
        awayCode: m.ext.abrev,
        date: m.date,
        heure: m.heure,
        stade: m.stade,
        scoreDom: m.dom.score,
        scoreExt: m.ext.score,
        statut: m.statut
      });
    }

    // Trie des dates pour chaque journée
    for (const jKey of Object.keys(calendrierFormatted[seasonKey])) {
      calendrierFormatted[seasonKey][jKey].dates.sort();
    }

    saveJSON(path.join(DATA_DIR, 'calendrier.json'), calendrierFormatted);
    console.log('  ✅ Calendrier synchronisé avec succès.');
  } catch (err) {
    console.error('  ❌ Erreur calendrier :', err.message);
  }
}

// 2. Synchroniser une journée donnée
async function syncJournee(jNum) {
  console.log(`\n🏉 Synchronisation des données pour la Journée ${jNum}...`);

  // A. Effectif (Joueurs)
  try {
    const data = await apiFetch(`/joueurs?journee=${jNum}`);
    // Sauvegarde brute avec métadonnées
    saveJSON(path.join(DATA_DIR, `players_raw_J${jNum}.json`), data);
    // Sauvegarde au format tableau direct (compatible players.json de l'appli)
    const playersList = data.joueurs || [];
    saveJSON(path.join(DATA_DIR, `players_J${jNum}.json`), playersList);
    console.log(`  ✅ Effectif J${jNum} : ${playersList.length} joueurs.`);
  } catch (err) {
    console.error(`  ❌ Erreur joueurs J${jNum} :`, err.message);
  }

  // B. Feuilles de match
  try {
    const data = await apiFetch(`/feuilles?journee=${jNum}`);
    saveJSON(path.join(DATA_DIR, `feuilles_raw_J${jNum}.json`), data);
    const feuillesMap = data.joueurs || {};
    saveJSON(path.join(DATA_DIR, `feuilles_J${jNum}.json`), feuillesMap);
    const countAnnonces = Object.keys(feuillesMap).length;
    const clubsAnnonces = data.clubs_annonces || [];
    console.log(`  ✅ Feuilles J${jNum} : ${countAnnonces} joueurs annoncés (Clubs : ${clubsAnnonces.join(', ') || 'aucun pour l\'instant'}).`);
  } catch (err) {
    console.error(`  ❌ Erreur feuilles J${jNum} :`, err.message);
  }

  // C. Forme
  try {
    const data = await apiFetch(`/forme?journee=${jNum}`);
    saveJSON(path.join(DATA_DIR, `forme_raw_J${jNum}.json`), data);
    const formeList = data.joueurs || [];
    saveJSON(path.join(DATA_DIR, `forme_J${jNum}.json`), formeList);
    console.log(`  ✅ Forme J${jNum} : ${formeList.length} joueurs listés.`);
  } catch (err) {
    // Normal si la journée n'est pas encore jouée
    console.log(`  ℹ️ Forme J${jNum} non disponible (${err.message}).`);
  }
}

async function main() {
  console.log('====================================================');
  console.log('   Synchronisation Fantasy Top 14 (Poneeey)');
  console.log('====================================================');

  // Analyse des arguments CLI
  const args = process.argv.slice(2);
  const jIndex = args.indexOf('--journee');
  const targetJ = jIndex !== -1 ? parseInt(args[jIndex + 1]) : null;

  // 1. Calendrier complet
  await syncCalendrier();

  // 2. Synchronisation de la J1 (historique) et de la J2 (active)
  // 2. Détermination de la journée active
  let detectedJ = 1;
  try {
    const rawMatchs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'matchs_api_raw.json'), 'utf8'));
    const nextMatch = rawMatchs.matchs.find(m => m.statut !== 'Result');
    if (nextMatch) {
      detectedJ = nextMatch.journee;
    } else if (rawMatchs.matchs.length > 0) {
      detectedJ = rawMatchs.matchs[rawMatchs.matchs.length - 1].journee;
    }
  } catch (err) {
    console.error('  ❌ Impossible de déterminer la journée active à partir du calendrier:', err.message);
  }

  // 3. Synchronisation
  if (targetJ) {
    await syncJournee(targetJ);
  } else {
    // Synchronisation de l'historique J1
    await syncJournee(1);
    // Synchronisation de la journée active J2
    await syncJournee(2);
    // Synchronisation de l'historique (J1) jusqu'à la journée active
    for (let j = 1; j <= detectedJ; j++) {
      await syncJournee(j);
    }

    // Enregistrer la journée active dans data/active.json
    saveJSON(path.join(DATA_DIR, 'active.json'), {
      journee: 2,
      journee: detectedJ,
      updatedAt: new Date().toISOString(),
      playersFile: 'players_J2.json',
      feuillesFile: 'feuilles_J2.json',
      formeFile: 'forme_J1.json',
      playersFile: `players_J${detectedJ}.json`,
      feuillesFile: `feuilles_J${detectedJ}.json`,
      formeFile: `forme_J${detectedJ}.json`,
      calendrierFile: 'calendrier.json'
    });
    console.log('\n✨ data/active.json mis à jour (Journée active = J2).');
    console.log(`\n✨ data/active.json mis à jour (Journée active = J${detectedJ}).`);
  }

  console.log('\n🎉 Synchronisation terminée !');
}

main();

