import { state } from '../state.js';

export function recomputeRanks(){
  const byPoste = {};
  state.players.forEach(p=>{
    p.valeur = typeof p.valeur === 'string' ? parseFloat(p.valeur) : p.valeur;
    (byPoste[p.poste] = byPoste[p.poste]||[]).push(p);
  });
  Object.values(byPoste).forEach(list=>{
    const sorted = list.slice().sort((a,b)=>a.valeur-b.valeur);
    const n = sorted.length;
    sorted.forEach((p,i)=>{ p._priceRank = n<=1 ? 1 : i/(n-1); });
  });
}
export function playerQuality(p){
  if(p.notes && Object.keys(p.notes).length){
    const vals = Object.values(p.notes).filter(v=>typeof v==='number');
    if(vals.length){
      const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
      return 0.65*(avg/100) + 0.35*(p._priceRank||0);
    }
  }
  return p._priceRank||0;
}
export function homeFactor(club){
  const st = state.calendrier[club];
  if(st==='D') return 1 + state.homeBonusPct/100;
  if(st==='E') return 1 + state.awayMalusPct/100;
  return 1;
}
export function playerScore(p){
  return playerQuality(p) * homeFactor(p.club);
}
export function tierOf(p){
  const q = playerQuality(p);
  if(q>=0.85) return 'sur';
  if(q>=0.55) return 'bon';
  if(q>=0.25) return 'pepite';
  return 'risque';
}
export function tierLabel(t){ return {sur:'Valeur sûre', bon:'Bon choix', pepite:'Pépite', risque:'Risqué'}[t]; }

export function slotAdjustedScore(slot, p){
  let score = playerScore(p);
  if(!p.surFeuille) return score;
  const bench = !!slot.group;
  if(bench && p.titulaireReel) score *= 0.5;
  else if(!bench && p.remplacantReel) score *= 0.9;
  return score;
}
