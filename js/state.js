export const SLOTS = [
  {key:'p1',  poste:'PIL', num:'1',  label:'Pilier',            x:30, y:6},
  {key:'p2',  poste:'TAL', num:'2',  label:'Talonneur',         x:50, y:6},
  {key:'p3',  poste:'PIL', num:'3',  label:'Pilier',            x:70, y:6},
  {key:'p4',  poste:'DL',  num:'4',  label:'2e ligne',          x:38, y:19},
  {key:'p5',  poste:'DL',  num:'5',  label:'2e ligne',          x:62, y:19},
  {key:'p6',  poste:'TL',  num:'6',  label:'3e ligne aile',     x:22, y:32},
  {key:'p8',  poste:'N8',  num:'8',  label:'N°8',               x:50, y:32},
  {key:'p7',  poste:'TL',  num:'7',  label:'3e ligne aile',     x:78, y:32},
  {key:'p9',  poste:'DM',  num:'9',  label:'Demi de mêlée',     x:34, y:47},
  {key:'p10', poste:'OUV', num:'10', label:'Ouvreur',           x:66, y:47},
  {key:'p12', poste:'CEN', num:'12', label:'Centre',            x:34, y:61},
  {key:'p13', poste:'CEN', num:'13', label:'Centre',            x:66, y:61},
  {key:'p11', poste:'AIL', num:'11', label:'Ailier',            x:15, y:76},
  {key:'p15', poste:'ARR', num:'15', label:'Arrière',           x:50, y:83},
  {key:'p14', poste:'AIL', num:'14', label:'Ailier',            x:85, y:76},
];

export const BENCH_SLOTS = [
  {key:'r1', label:'Remplaçant avant',   group:'AVANT',   postes:['PIL','TAL','DL','TL','N8']},
  {key:'r2', label:'Remplaçant arrière', group:'ARRIERE', postes:['DM','OUV','CEN','AIL','ARR']},
];

export const ALL_SLOTS = SLOTS.concat(BENCH_SLOTS);

export const POSTE_LABELS = {PIL:'Pilier',TAL:'Talonneur',DL:'2e ligne',TL:'3e ligne aile',N8:'N°8',DM:'Demi de mêlée',OUV:'Ouvreur',CEN:'Centre',AIL:'Ailier',ARR:'Arrière'};

export const CLUB_ALIASES = {
  AB:   ['aviron bayonnais','bayonne'],
  ASM:  ['asm clermont auvergne','asm clermont','clermont'],
  CO:   ['castres olympique','castres'],
  LOU:  ['lyon ou','lou rugby','lyon'],
  MHR:  ['montpellier herault','montpellier hr','montpellier'],
  R92:  ['racing 92','racing'],
  RCT:  ['rc toulon','toulon'],
  RCV:  ['rc vannes','vannes'],
  SFP:  ['stade francais paris','stade francais'],
  SP:   ['section paloise','pau'],
  SR:   ['stade rochelais','la rochelle','rochelais'],
  ST:   ['stade toulousain','toulouse'],
  UBB:  ['union bordeaux-begles','union bordeaux begles','bordeaux begles','bordeaux'],
  USAP: ['usa perpignan','perpignan', 'usap'],
};

export const state = {
  imported:false,
  players:[],            
  journee:1,
  budget:11.00,
  homeBonusPct:8,
  awayMalusPct:-5,
  allowRisky:false,
  allowHorsFeuille:false,
  calendrier:{},          
  calendrierJournees:null, 
  calendrierDates:null,    
  calendrierUnmatched:[],  
  feuillesLoaded:false,    
  squad:{},                
  locked:{},               
  captainSlot:null,
  impactSlot:null,
  tab:'semaine',
  picker:null,             
  calendrierSource: 'aucun', // 'defaut (chemin)', 'importe' ou 'aucun'
  calendrierLoadStatus: 'idle', // 'idle' | 'loading' | 'ok' | 'error'
  calendrierLoadError: null,
  filters:{q:'', poste:'', club:'', hideIndispo:false, sortKey:'valeur', sortDir:-1},
};

export function byId(id){ return state.players.find(p=>p.id===id); }
