// Script d'exploration de l'API fantasy.poneeey.fr
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://fantasy.poneeey.fr/api';
function resolveToken() {
  if (process.env.FANTASY_TOKEN) return process.env.FANTASY_TOKEN;
  try {
    if (fs.existsSync('./config.local.json')) {
      const cfg = JSON.parse(fs.readFileSync('./config.local.json', 'utf8'));
      if (cfg.token) return cfg.token;
    }
  } catch (e) {}
  return '';
}

const TOKEN = resolveToken();

const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Authorization': `Bearer ${TOKEN}`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  'Referer': 'https://fantasy.poneeey.fr/'
};

async function testEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    const status = res.status;
    const contentType = res.headers.get('content-type') || '';
    
    if (status === 200 && contentType.includes('json')) {
      const data = await res.json();
      let info = '';
      if (Array.isArray(data)) {
        info = `Array [${data.length} éléments] - Clés du 1er: ${data[0] ? Object.keys(data[0]).join(', ') : 'vide'}`;
      } else if (typeof data === 'object' && data !== null) {
        info = `Object - Clés: ${Object.keys(data).join(', ')}`;
      } else {
        info = typeof data;
      }
      console.log(`✅ [${status}] ${endpoint.padEnd(30)} -> ${info}`);
      return { endpoint, status, data };
    } else {
      console.log(`❌ [${status}] ${endpoint.padEnd(30)} -> ${res.statusText}`);
      return { endpoint, status, error: res.statusText };
    }
  } catch (err) {
    console.log(`⚠️ [ERR] ${endpoint.padEnd(30)} -> ${err.message}`);
    return { endpoint, error: err.message };
  }
}

async function main() {
  console.log('=== Exploration de l\'API fantasy.poneeey.fr ===\n');

  // Liste des endpoints candidats à tester
  const candidates = [
    '/joueurs',
    '/joueurs?journee=1',
    '/joueurs?journee=2',
    '/forme',
    '/forme?journee=1',
    '/top-forme',
    '/stats',
    '/calendrier',
    '/matchs',
    '/matches',
    '/feuilles',
    '/feuille',
    '/feuilles/2',
    '/feuille/2',
    '/equipe',
    '/journees',
    '/journee',
    '/classement',
    '/budget'
  ];

  const results = {};
  for (const ep of candidates) {
    const res = await testEndpoint(ep);
    if (res.data) {
      results[ep] = res.data;
    }
  }

  // Sauvegarder les données de /joueurs pour vérification
  if (results['/joueurs']) {
    const outDir = './data';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'api_joueurs_test.json'), JSON.stringify(results['/joueurs'], null, 2), 'utf8');
    console.log(`\n💾 Réponse de /joueurs sauvegardée dans data/api_joueurs_test.json`);
  }
}

main();

