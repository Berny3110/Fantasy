import { state } from '../state.js';

export function recomputeRanks(){
  let minPrix = Infinity;
  let maxPrix = -Infinity;

  state.players.forEach(p => {
    p.valeur = typeof p.valeur === 'string' ? parseFloat(p.valeur) : p.valeur;
    if (p.valeur < minPrix) minPrix = p.valeur;
    if (p.valeur > maxPrix) maxPrix = p.valeur;
  });

  const range = maxPrix - minPrix || 1;

  state.players.forEach(p => {
    p._priceRankGlobal = (p.valeur - minPrix) / range;
  });

  let globalSum = 0;
  let globalCount = 0;
  const clubSums = {};
  const clubCounts = {};

  state.players.forEach(p => {
    if (p.notes && Object.keys(p.notes).length) {
      const vals = Object.values(p.notes).filter(v => typeof v === 'number');
      if (vals.length) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const perfIndiv = avg / 100;
        
        globalSum += perfIndiv;
        globalCount += 1;
        
        clubSums[p.club] = (clubSums[p.club] || 0) + perfIndiv;
        clubCounts[p.club] = (clubCounts[p.club] || 0) + 1;
      }
    }
  });

  const globalAvg = globalCount > 0 ? globalSum / globalCount : 0.5;
  state.clubFormFactors = {};

  Object.keys(clubSums).forEach(club => {
    const mClub = clubSums[club] / clubCounts[club];
    const ratio = mClub / (globalAvg || 1);
    state.clubFormFactors[club] = 1 + (ratio - 1) * 0.5;
  });
}

export function playerQuality(p){
  const priceRank = p._priceRankGlobal || 0;
  let alpha = 0;
  let perfIndiv = 0;

  if (p.notes && Object.keys(p.notes).length) {
    const vals = Object.values(p.notes).filter(v => typeof v === 'number');
    const nbMatchs = vals.length;
    if (nbMatchs > 0) {
      const avg = vals.reduce((a, b) => a + b, 0) / nbMatchs;
      perfIndiv = avg / 100;
      alpha = Math.min(1, nbMatchs / 5);
    }
  }

  return alpha * perfIndiv + (1 - alpha) * priceRank;
}

export function homeFactor(club){
  const st = state.calendrier[club];
  if(st === 'D') return 1 + state.homeBonusPct / 100;
  if(st === 'E') return 1 + state.awayMalusPct / 100;
  return 1;
}

export function playerScore(p){
  const clubForm = (state.clubFormFactors && state.clubFormFactors[p.club]) ? state.clubFormFactors[p.club] : 1;
  return playerQuality(p) * homeFactor(p.club) * clubForm;
}

export function tierOf(p){
  const q = playerQuality(p);
  if(q >= 0.85) return 'sur';
  if(q >= 0.55) return 'bon';
  if(q >= 0.25) return 'pepite';
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
