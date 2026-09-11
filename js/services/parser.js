import { state, CLUB_ALIASES, ALL_SLOTS, byId } from '../state.js';
import { recomputeRanks } from '../engine/scoring.js';
import { totalCost } from '../engine/optimizer.js';

export function normalizeName(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,'').trim();
}

export function resolveClubCode(name){
  const norm = normalizeName(name);
  if(!norm) return null;
  for(const [code, aliases] of Object.entries(CLUB_ALIASES)){
    if(aliases.some(a=>normalizeName(a)===norm)) return code;
  }
  for(const [code, aliases] of Object.entries(CLUB_ALIASES)){
    if(aliases.some(a=>norm.includes(normalizeName(a)) || normalizeName(a).includes(norm))) return code;
  }
  return null;
}

export function tryParseJSON(text){
  try{ return {data: JSON.parse(text), repaired:false}; }
  catch(e){
    const fixed = text.replace(/}(\s*)\{/g, '},$1{');
    try{ return {data: JSON.parse(fixed), repaired:true}; }
    catch(e2){ throw e; }
  }
}

export function detectShape(obj){
  if(Array.isArray(obj)) {
    if(obj.length && obj[0] && obj[0].note !== undefined && obj[0].valeur === undefined) return 'forme';
    return 'players';
  }
  if(obj && typeof obj==='object'){
    if(obj.players && Array.isArray(obj.players)) return 'players';
    if(obj.joueurs && Array.isArray(obj.joueurs)) {
      if(obj.joueurs.length && obj.joueurs[0].note !== undefined && obj.joueurs[0].valeur === undefined) return 'forme';
      return 'players';
    }
    const vals = Object.values(obj);
    if(vals.length && vals.every(v=>typeof v==='number')) return 'feuilles';
    if(obj.joueurs && typeof obj.joueurs === 'object' && !Array.isArray(obj.joueurs)) return 'feuilles';
    const firstVal = vals[0];
    if(firstVal && typeof firstVal==='object'){
      const subVals = Object.values(firstVal);
      const first2 = subVals[0];
      if(first2 && typeof first2==='object' && Array.isArray(first2.matches)) return 'calendrier';
    }
  }
  return 'unknown';
}

export function applyFeuilles(){
  const data = state.feuillesData || {};
  state.players.forEach(p=>{
    const num = data[String(p.id)] ?? data[p.id];
    p.feuilleNum = (num!=null) ? num : null;
    p.surFeuille = state.feuillesLoaded ? (num!=null) : true;
    p.titulaireReel = num!=null && num<=15;
    p.remplacantReel = num!=null && num>15;
  });
}

export function importPlayers(arr, merge){
  if(arr && arr.players) arr = arr.players; 
  if(arr && arr.joueurs && Array.isArray(arr.joueurs)) arr = arr.joueurs;
  if(!Array.isArray(arr)){ alert('Le fichier doit contenir un tableau de joueurs.'); return false; }
  if(merge && state.players.length){
    const map = {}; state.players.forEach(p=>map[p.id]=p);
    arr.forEach(np=>{
      if(map[np.id]) Object.assign(map[np.id], np);
      else state.players.push(np);
    });
  } else {
    state.players = arr;
  }
  state.players.forEach(p=>{
    if(typeof p.valeur==='string') p.valeur=parseFloat(p.valeur);
    if(p.valeurInitiale === undefined) p.valeurInitiale = p.valeur;
  });
  recomputeRanks();
  applyFeuilles();
  state.imported = true;
  return true;
}

export function importFeuilles(obj){
  if(obj && obj.joueurs && typeof obj.joueurs === 'object') obj = obj.joueurs;
  state.feuillesData = obj;
  state.feuillesLoaded = true;
  applyFeuilles();
  return true;
}

export function importForme(arr, jNum){
  if(arr && arr.joueurs && Array.isArray(arr.joueurs)) arr = arr.joueurs;
  if(!Array.isArray(arr)) return false;
  const targetJ = jNum || 1;
  arr.forEach(f => {
    const p = byId(f.id);
    if(p) {
      if(!p.notes) p.notes = {};
      p.notes['J' + targetJ] = f.note;
    }
  });
  return true;
}

export function applyCalendrierForJournee(n){
  if(!state.calendrierJournees) return {applied:false};
  const jKey = 'J'+n;
  const jdata = state.calendrierJournees[jKey];
  const clubs = Array.from(new Set(state.players.map(p=>p.club)));
  const newCal = {};
  clubs.forEach(c=>newCal[c]='Q');
  if(!jdata){ state.calendrier = newCal; state.calendrierDates = null; return {applied:false}; }
  const unmatched = [];
  jdata.matches.forEach(m=>{
    const hc = resolveClubCode(m.home);
    const ac = resolveClubCode(m.away);
    if(hc) newCal[hc]='D'; else unmatched.push(m.home);
    if(ac) newCal[ac]='E'; else unmatched.push(m.away);
  });
  state.calendrier = newCal;
  state.calendrierDates = jdata.dates;
  state.calendrierUnmatched = unmatched;
  return {applied:true, unmatched};
}

export function importCalendrier(obj){
  const seasonKey = Object.keys(obj)[0];
  state.calendrierJournees = obj[seasonKey];
  applyCalendrierForJournee(state.journee);
  return true;
}

export async function loadDefaultData() {
  state.calendrierLoadStatus = 'loading';
  try {
    // 1. Déterminer la configuration active
    let activeMeta = { journee: 2, playersFile: 'players_J2.json', feuillesFile: 'feuilles_J2.json', formeFile: 'forme_J1.json', calendrierFile: 'calendrier.json' };
    try {
      const metaRes = await fetch('./data/active.json', { cache: 'no-store' });
      if (metaRes.ok) activeMeta = await metaRes.json();
    } catch(e) {}

    state.journee = activeMeta.journee || 2;

    // 2. Charger le calendrier
    const calPath = `./data/${activeMeta.calendrierFile || 'calendrier.json'}`;
    const calRes = await fetch(calPath, { cache: 'no-store' });
    if (calRes.ok) {
      const calData = await calRes.json();
      importCalendrier(calData);
      state.calendrierSource = `défaut (${calPath})`;
      state.calendrierLoadStatus = 'ok';
      state.calendrierLoadError = null;
    }

    // 3. Charger les joueurs
    const playersPath = `./data/${activeMeta.playersFile || 'players_J2.json'}`;
    const plRes = await fetch(playersPath, { cache: 'no-store' });
    if (plRes.ok) {
      const plData = await plRes.json();
      importPlayers(plData, false);
    }

    // 4. Charger les feuilles
    const feuillesPath = `./data/${activeMeta.feuillesFile || 'feuilles_J2.json'}`;
    try {
      const fRes = await fetch(feuillesPath, { cache: 'no-store' });
      if (fRes.ok) {
        const fData = await fRes.json();
        const entries = fData.joueurs && typeof fData.joueurs === 'object' ? fData.joueurs : fData;
        if (entries && Object.keys(entries).length > 0) {
          importFeuilles(entries);
        } else {
          state.feuillesLoaded = false;
        }
      }
    } catch(e) {}

    // 5. Charger la forme
    const formePath = `./data/${activeMeta.formeFile || 'forme_J1.json'}`;
    try {
      const formRes = await fetch(formePath, { cache: 'no-store' });
      if (formRes.ok) {
        const formData = await formRes.json();
        importForme(formData, 1);
      }
    } catch(e) {}

    return state.imported;
  } catch (err) {
    state.calendrierLoadStatus = 'error';
    state.calendrierLoadError = err.message;
    console.warn('[loadDefaultData] Chargement automatique impossible :', err.message);
    return false;
  }
}

export function handleImportedJSON(text, merge){
  let parsed;
  try{ parsed = tryParseJSON(text); }
  catch(e){ alert('JSON invalide : ' + e.message); return null; }
  const shape = detectShape(parsed.data);
  let summary = '';
  if(shape==='players'){
    importPlayers(parsed.data, merge);
    summary = `Effectif : ${state.players.length} joueur(s) chargé(s).`;
  } else if(shape==='forme'){
    importForme(parsed.data, 1);
    summary = `Forme : notes importées avec succès.`;
  } else if(shape==='feuilles'){
    importFeuilles(parsed.data);
    const onSheet = Object.keys(state.feuillesData||{}).length;
    summary = `Feuille de match : ${onSheet} joueur(s) annoncé(s) pour cette journée.`;
  } else if(shape==='calendrier'){
    importCalendrier(parsed.data);
    const nJournees = Object.keys(state.calendrierJournees||{}).length;
    summary = `Calendrier : ${nJournees} journée(s) chargée(s).`;
    if(state.calendrierUnmatched && state.calendrierUnmatched.length){
      summary += ` ⚠ Club(s) non reconnu(s) : ${state.calendrierUnmatched.join(', ')}.`;
    }
  } else {
    alert('Format de fichier non reconnu (ni effectif, ni feuille de match, ni calendrier).');
    return null;
  }
  if(parsed.repaired) summary += ' (une virgule manquante a été réparée automatiquement dans le fichier)';
  return {shape, summary};
}

export function todayStr(){ const d=new Date(); return d.toISOString().slice(0,10); }

export function download(filename, content){
  const blob = new Blob([content], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}

export function exportState(){
  const meta = {
    journee: state.journee,
    date_export: todayStr(),
    budget_disponible: state.budget,
    budget_utilise: Math.round(totalCost()*100)/100,
    coefficients: {bonus_domicile_pct: state.homeBonusPct, malus_exterieur_pct: state.awayMalusPct},
    calendrier: state.calendrier,
    calendrier_dates: state.calendrierDates,
    feuille_de_match_chargee: state.feuillesLoaded,
  };
  const equipe = {};
  ALL_SLOTS.forEach(s=>{
    const id = state.squad[s.key];
    if(id==null) return;
    const p = byId(id);
    equipe[s.key] = {
      id:p.id, nom:p.nom, prenom:p.prenom, poste:p.poste, club:p.club, valeur:p.valeur,
      capitaine: state.captainSlot===s.key, impact_player: state.impactSlot===s.key,
      verrouille: !!state.locked[s.key],
    };
  });
  const playersOut = state.players.map(p=>({
    id:p.id, prenom:p.prenom, nom:p.nom, nationalite:p.nationalite, poste:p.poste,
    poste_secondaire:p.poste_secondaire||null, poste_tertiaire:p.poste_tertiaire||null,
    indisponible: !!p.indisponible, taille_cm:p.taille_cm, poids_kg:p.poids_kg,
    club:p.club, club_nom:p.club_nom, couleur_hex:p.couleur_hex, couleur2_hex:p.couleur2_hex,
    valeur: p.valeur,
    valeurInitiale: p.valeurInitiale ?? p.valeur,
    moyenne: p.moyenne ?? null,
    notes: p.notes || {},
  }));
  const out = {meta, equipe, players: playersOut};
  download(`ptitburo_J${state.journee}_${todayStr()}.json`, JSON.stringify(out, null, 2));
}