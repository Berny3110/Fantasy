import { state, ALL_SLOTS, SLOTS, BENCH_SLOTS, byId } from '../state.js';
import { slotAdjustedScore, tierOf } from './scoring.js';

export function slotDef(key){ return ALL_SLOTS.find(s=>s.key===key); }

export function isEligible(slot, p){
  if(!p || p.indisponible) return false;
  const posteOk = slot.postes ? slot.postes.includes(p.poste) : p.poste === slot.poste;
  if(!posteOk) return false;
  if(state.feuillesLoaded && !state.allowHorsFeuille && !p.surFeuille) return false;
  return true;
}

export function usedIds(excludeSlot){
  const set = new Set();
  Object.entries(state.squad).forEach(([k,id])=>{ if(k!==excludeSlot && id!=null) set.add(id); });
  return set;
}

export function clubCounts(excludeSlot){
  const map = {};
  Object.entries(state.squad).forEach(([k,id])=>{
    if(k===excludeSlot || id==null) return;
    const p = byId(id); if(!p) return;
    map[p.club] = (map[p.club]||0)+1;
  });
  return map;
}

export function totalCost(){
  let sum=0;
  Object.values(state.squad).forEach(id=>{ if(id!=null){ const p=byId(id); if(p) sum+=p.valeur; } });
  return sum;
}

export function slotViolation(slotKey){
  const id = state.squad[slotKey]; if(id==null) return null;
  const p = byId(id);
  const slot = slotDef(slotKey);
  const bench = !!slot.group;
  const counts = clubCounts(slotKey);
  const wouldBe = (counts[p.club]||0)+1;
  const issues = [];
  if(p.indisponible) issues.push('Forfait');
  if(wouldBe>3) issues.push('Quota club dépassé');
  if(state.feuillesLoaded && !p.surFeuille) issues.push('Pas sur la feuille — 0 pt garanti');
  if(bench && p.titulaireReel) issues.push('Titulaire réel — malus ÷2 sur le banc');
  return issues.length ? issues.join(' · ') : null;
}

export function slotInfo(slotKey){
  const id = state.squad[slotKey]; if(id==null) return null;
  const p = byId(id);
  const slot = slotDef(slotKey);
  const bench = !!slot.group;
  if(!bench && p.surFeuille && p.remplacantReel) return 'Remplaçant réel — risque de temps de jeu';
  return null;
}

export function autoFill(){
  const emptySlots = ALL_SLOTS.filter(s => !state.locked[s.key]);
  if(!emptySlots.length) return;
  let used = usedIds(null);
  Object.keys(state.squad).forEach(k=>{ if(!state.locked[k]) used.delete(state.squad[k]); });
  let counts = {};
  Object.entries(state.squad).forEach(([k,id])=>{
    if(id==null) return;
    if(!state.locked[k]) return;
    const p=byId(id); counts[p.club]=(counts[p.club]||0)+1;
  });
  emptySlots.forEach(s=>{ state.squad[s.key]=null; });

  function eligiblePool(slot){
    return state.players.filter(p=>{
      if(!isEligible(slot,p)) return false;
      if(used.has(p.id)) return false;
      if((counts[p.club]||0) >= 3) return false;
      if(!state.allowRisky && tierOf(p)==='risque') return false;
      return true;
    });
  }
  const order = emptySlots.slice().sort((a,b)=> eligiblePool(a).length - eligiblePool(b).length);

  order.forEach(slot=>{
    const pool = eligiblePool(slot).sort((a,b)=>a.valeur-b.valeur);
    if(pool.length){
      const pick = pool[0];
      state.squad[slot.key] = pick.id;
      used.add(pick.id);
      counts[pick.club] = (counts[pick.club]||0)+1;
    }
  });

  let remaining = state.budget - totalCost();
  if(remaining < 0) return;

  let iterations = 0;
  while(iterations++ < 300){
    let best=null;
    for(const slot of emptySlots){
      const currentId = state.squad[slot.key];
      const current = byId(currentId);
      const curScore = current ? slotAdjustedScore(slot,current) : -1;
      const curPrice = current ? current.valeur : 0;
      const candidates = state.players.filter(p=>{
        if(!isEligible(slot,p)) return false;
        if(p.id===currentId) return false;
        if(used.has(p.id)) return false;
        if(!state.allowRisky && tierOf(p)==='risque') return false;
        const projectedClubCount = (counts[p.club]||0) + (current && current.club===p.club ? 0 : 1);
        if(projectedClubCount>3) return false;
        const costDelta = p.valeur - curPrice;
        return costDelta <= remaining + 1e-9;
      });
      candidates.forEach(cand=>{
        const gain = slotAdjustedScore(slot,cand) - curScore;
        if(gain > 1e-6){
          if(!best || gain > best.gain){
            best = {slot, cand, gain, costDelta: cand.valeur - curPrice};
          }
        }
      });
    }
    if(!best) break;
    const {slot, cand, costDelta} = best;
    const prevId = state.squad[slot.key];
    if(prevId!=null){
      used.delete(prevId);
      const prev = byId(prevId);
      counts[prev.club] = Math.max(0,(counts[prev.club]||0)-1);
    }
    state.squad[slot.key] = cand.id;
    used.add(cand.id);
    counts[cand.club] = (counts[cand.club]||0)+1;
    remaining -= costDelta;
  }
}

export function suggestCaptain(){
  const filled = SLOTS.filter(s=>state.squad[s.key]!=null);
  if(!filled.length) return;
  filled.sort((a,b)=> slotAdjustedScore(b,byId(state.squad[b.key])) - slotAdjustedScore(a,byId(state.squad[a.key])));
  state.captainSlot = filled[0].key;
}

export function suggestImpact(){
  const filled = BENCH_SLOTS.filter(s=>state.squad[s.key]!=null);
  if(!filled.length) return;
  filled.sort((a,b)=> slotAdjustedScore(b,byId(state.squad[b.key])) - slotAdjustedScore(a,byId(state.squad[a.key])));
  state.impactSlot = filled[0].key;
}
