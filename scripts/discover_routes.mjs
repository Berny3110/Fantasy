import fs from 'fs';

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
  'Authorization': 'Bearer ' + TOKEN,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'
};

async function run() {
  const res = await fetch('https://fantasy.poneeey.fr/equipe', { headers: HEADERS });
  const html = await res.text();
  
  const apiMatches = new Set([...html.matchAll(/\/api\/[a-zA-Z0-9_\-\/?=&]+/g)].map(m => m[0]));
  console.log('API endpoints found inside HTML (/equipe):', Array.from(apiMatches));
  
  // Also check /joueurs page, /classement, /marche or other pages
  const pages = ['/', '/marche', '/classement', '/reglement', '/joueurs'];
  for (const p of pages) {
    try {
      const r = await fetch(`https://fantasy.poneeey.fr${p}`, { headers: HEADERS });
      if (r.ok) {
        const text = await r.text();
        const eps = [...text.matchAll(/\/api\/[a-zA-Z0-9_\-\/?=&]+/g)].map(m => m[0]);
        eps.forEach(e => apiMatches.add(e));
      }
    } catch(e) {}
  }
  
  console.log('\nAll unique API endpoints discovered across pages:');
  console.log(Array.from(apiMatches).sort());
}

run();

