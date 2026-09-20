import { state, SLOTS, BENCH_SLOTS, ALL_SLOTS, POSTE_LABELS, byId } from '../state.js';
import { tierOf, tierLabel, playerScore, slotAdjustedScore } from '../engine/scoring.js';
import { totalCost, slotViolation, slotInfo, usedIds, isEligible, slotDef } from '../engine/optimizer.js';
import { resolveClubCode, todayStr } from '../services/parser.js';
import { pwa } from '../pwa.js';

export function fmtM(n){ return (Math.round(n*100)/100).toFixed(2); }

export function renderImportScreen(){
  return `<div class="import-screen">
    <img src="/icons/icon-192.png" alt="FT14" style="width:72px;height:72px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(223,177,82,0.4);margin:0 auto 16px;display:block;">
    <h1 class="display" style="font-size:24px;margin:0 0 6px;">Assistant Week-end</h1>
    <p style="color:var(--chalk-dim);font-size:13px;line-height:1.6;">
      Les données sont synchronisées automatiquement dans le dossier <span class="mono">data/</span> via la commande <span class="mono">npm run sync</span>.
    </p>
    <div style="text-align:left;background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;font-size:12px;color:var(--chalk-soft);margin:12px 0;">
      💡 <strong>Application PWA :</strong> Cette application fonctionne à 100% hors-ligne une fois chargée.
    </div>
    ${pwa.canInstall ? `<button class="pwa-btn" id="pwaImportInstallBtn" style="margin-bottom:12px;width:100%;justify-content:center;"><span>📲</span> Installer l'application sur cet appareil</button>` : ''}
    <div class="dropzone" id="dropzone">
      <strong>Ou glisse un fichier JSON ici (secours)</strong>
      <p>effectif, feuille de match, calendrier ou forme</p>
      <input type="file" id="fileInput" accept="application/json" multiple class="hidden">
    </div>
    <div id="importStatus" style="text-align:left;font-size:12px;color:var(--brass-soft);margin-top:12px;"></div>
    <p style="color:var(--chalk-faint);font-size:11px;margin-top:16px;">
      100% local — rien n'est envoyé sur un serveur tiers. Tu peux aussi coller un JSON manuellement :
    </p>
    <textarea id="pasteArea" rows="3" style="width:100%;margin-top:8px;" placeholder="Coller le JSON ici..."></textarea>
    <button class="btn primary" id="pasteBtn" style="margin-top:10px;width:100%;">Charger ce JSON</button>
    ${state.players.length ? `<button class="btn ghost" id="continueBtn" style="margin-top:10px;width:100%;">Continuer avec l'effectif en mémoire →</button>` : ''}
  </div>`;
}

export function renderHeader(){
  const used = totalCost();
  const pct = Math.min(100, (used/state.budget)*100);
  const over = used > state.budget;
  const tabs = [
    ['semaine','Semaine'],['effectif','Effectif'],['joueurs','Joueurs'],['export','Import / Export']
  ];
  return `<header class="scoreboard">
    <div class="sb-inner">
      <img src="/icons/icon-192.png" alt="FT14" style="width:38px;height:38px;border-radius:8px;border:1px solid rgba(223,177,82,0.35);box-shadow:0 2px 8px rgba(0,0,0,0.5);flex:none;">
      <div class="badge-jour">J${state.journee}</div>
      <div class="sb-title">
        <span class="eyebrow">Le P'tit Buro · Fantasy</span>
        <h1>Assistant Week-end</h1>
      </div>
      <div class="sb-spacer"></div>
      <div class="budget-gauge">
        <div class="track"><div class="fill ${over?'over':''}" style="width:${pct}%"></div></div>
        <div class="num mono">${fmtM(used)} <span class="dim">/ ${fmtM(state.budget)} M€</span></div>
      </div>
      <button class="pwa-btn ${pwa.canInstall ? '' : 'hidden'}" id="pwaInstallBtn" title="Installer l'application sur votre appareil">
        <span>📲</span> Installer
      </button>
      <button class="btn-reset" id="reimportBtn">Changer de fichier</button>
    </div>
    <nav class="tabs">
      ${tabs.map(([k,l])=>`<button data-tab="${k}" class="${state.tab===k?'active':''}">${l}</button>`).join('')}
    </nav>
  </header>`;
}

export function renderTab(){
  if(state.tab==='semaine') return renderSemaine();
  if(state.tab==='effectif') return renderEffectif();
  if(state.tab==='joueurs') return renderJoueurs();
  if(state.tab==='export') return renderExport();
  return '';
}

export function renderSemaine(){
  const clubNom = c => (state.players.find(p=>p.club===c)||{}).club_nom || c;
  const clubColor = c => (state.players.find(p=>p.club===c)||{}).couleur_hex || '#5a6570';
  const hasCal = !!state.calendrierJournees;
  const journeeKeys = hasCal ? Object.keys(state.calendrierJournees).sort((a,b)=>parseInt(a.slice(1))-parseInt(b.slice(1))) : [];

  // ---- Diagnostic de chargement (inchangé) ----
  let statusBanner = '';
  if(state.calendrierLoadStatus === 'ok' && hasCal){
    statusBanner = `<div class="ok-banner">✅ Calendrier chargé automatiquement — source : <strong>${state.calendrierSource}</strong> · ${journeeKeys.length} journée(s) en mémoire.</div>`;
  } else if(state.calendrierLoadStatus === 'error'){
    statusBanner = `<div class="warn-banner">⚠️ Le chargement automatique de <span class="mono">calendrier.json</span> a échoué (${state.calendrierLoadError || 'raison inconnue'}). Si tu ouvres <span class="mono">index.html</span> en file://, lance un serveur local et recharge. Tu peux aussi importer le fichier manuellement dans l'onglet Import / Export.</div>`;
  } else if(state.calendrierLoadStatus === 'loading'){
    statusBanner = `<div class="ok-banner">⏳ Chargement de calendrier.json en cours…</div>`;
  } else if(!hasCal){
    statusBanner = `<div class="warn-banner">Aucun calendrier chargé pour le moment.</div>`;
  }

  const journeeField = hasCal ? `
      <label class="field">Journée active
        <select id="inpJournee" style="width:170px;">
          ${journeeKeys.map(k=>{
            const n = parseInt(k.slice(1));
            const jd = state.calendrierJournees[k];
            const dateLabel = jd.dates && jd.dates[0] ? new Date(jd.dates[0]).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}) : '';
            return `<option value="${n}" ${state.journee===n?'selected':''}>${k} — ${dateLabel}</option>`;
          }).join('')}
        </select>
      </label>` : `
      <label class="field">Journée
        <input type="number" id="inpJournee" min="1" value="${state.journee}" style="width:90px;">
      </label>`;

  // ---- Affiches : tableau de mission ----
  let fixturesBlock = '';
  if(hasCal){
    const jdata = state.calendrierJournees['J'+state.journee];
    if(jdata){
      const dateLabel = (jdata.dates||[]).map(d=>new Date(d).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short'})).join(' · ');
      const cards = jdata.matches.map(m=>{
        const hc = resolveClubCode(m.home), ac = resolveClubCode(m.away);
        return `<div class="fixture-card">
          <div class="fixture-team home">
            <span class="team-dot" style="background:${hc?clubColor(hc):'#e6524f'}"></span>
            <div class="team-info">
              <span class="team-tag ${hc?'':'unresolved'}">DOM${hc?'':' · ?'}</span>
              <span class="team-name">${hc?clubNom(hc):m.home}</span>
            </div>
          </div>
          <div class="fixture-vs"><div class="vs-diamond"><span>VS</span></div></div>
          <div class="fixture-team away">
            <div class="team-info">
              <span class="team-tag ${ac?'':'unresolved'}">EXT${ac?'':' · ?'}</span>
              <span class="team-name">${ac?clubNom(ac):m.away}</span>
            </div>
            <span class="team-dot" style="background:${ac?clubColor(ac):'#e6524f'}"></span>
          </div>
        </div>`;
      }).join('');
      fixturesBlock = `<div class="panel">
        <div class="briefing-header">
          <h2>Affiches — Journée ${state.journee}</h2>
          <span class="ops-date-stamp">${dateLabel}</span>
        </div>
        <p class="sub">${jdata.matches.length} rencontre(s) programmée(s) ce week-end.</p>
        <div class="fixtures-board">${cards}</div>
        ${state.calendrierUnmatched && state.calendrierUnmatched.length ? `<div class="warn-banner" style="margin-top:14px;">⚠ Club(s) non reconnu(s) dans l'effectif : ${state.calendrierUnmatched.join(', ')}. Le bonus/malus domicile-extérieur ne sera pas appliqué pour eux.</div>` : ''}
      </div>`;
    } else {
      fixturesBlock = `<div class="warn-banner">Aucune donnée de calendrier pour la journée ${state.journee}.</div>`;
    }
  } else {
    fixturesBlock = `<div class="panel"><p class="sub">Importe <span class="mono">calendrier.json</span> (onglet Import / Export) pour afficher automatiquement qui joue à domicile / à l'extérieur chaque journée.</p></div>`;
  }

  // ---- Calendrier complet : rack de campagne ----
  let fullCalendarBlock = '';
  if(hasCal){
    const tiles = journeeKeys.map(k=>{
      const n = parseInt(k.slice(1));
      const jd = state.calendrierJournees[k];
      const isActive = n === state.journee;
      const dateLabel = (jd.dates||[]).map(d=>new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})).join('–');
      const unresolved = jd.matches.filter(m => !resolveClubCode(m.home) || !resolveClubCode(m.away));
      const rows = jd.matches.map(m=>{
        const hc = resolveClubCode(m.home), ac = resolveClubCode(m.away);
        return `<div class="tile-match">
          <i class="tm-dot" style="background:${hc?clubColor(hc):'#e6524f'}"></i>
          <span class="tm-name">${hc||m.home}</span>
          <span class="tm-sep">–</span>
          <span class="tm-name">${ac||m.away}</span>
          <i class="tm-dot" style="background:${ac?clubColor(ac):'#e6524f'}"></i>
        </div>`;
      }).join('');
      return `<div class="journee-tile ${isActive?'active':''}" data-goto-journee="${n}">
        <div class="tile-tab">
          <span class="tile-led"></span>
          <span class="tile-num">${k}</span>
          ${isActive ? '<span class="tile-active-tag">Active</span>' : ''}
        </div>
        <div class="tile-date">${dateLabel}</div>
        <div class="tile-matches">${rows}</div>
        ${unresolved.length ? `<div class="tile-alert">⚠ ${unresolved.length} club(s) non reconnu(s)</div>` : ''}
      </div>`;
    }).join('');
    fullCalendarBlock = `<div class="panel">
      <h2>Calendrier complet — Top 14</h2>
      <p class="sub">${journeeKeys.length} journées chargées depuis <span class="mono">calendrier.json</span>. Clique sur une journée pour l'activer et vérifier qu'elle correspond bien à ton choix.</p>
      <div class="campaign-rack">${tiles}</div>
    </div>`;
  }

  return `<div class="panel">
    <h2>Budget & journée</h2>
    <p class="sub">Le salary cap évolue chaque semaine selon la revente de ton équipe (§5 du règlement). Indique ici ton budget disponible pour ce week-end.</p>
    ${statusBanner}
    <div class="row">
      ${journeeField}
      <label class="field">Budget disponible (M€)
        <input type="number" id="inpBudget" step="0.01" min="0" value="${state.budget}" style="width:120px;">
      </label>
      <label class="field">Bonus domicile (%)
        <input type="number" id="inpHomeBonus" step="1" value="${state.homeBonusPct}" style="width:90px;">
      </label>
      <label class="field">Malus extérieur (%)
        <input type="number" id="inpAwayMalus" step="1" value="${state.awayMalusPct}" style="width:90px;">
      </label>
    </div>
  </div>
  ${fixturesBlock}
  ${fullCalendarBlock}`;
}

export function renderEffectif(){
  const cost = totalCost();
  const over = cost > state.budget;
  const clubCountsAll = {};
  Object.values(state.squad).forEach(id=>{ if(id!=null){ const p=byId(id); clubCountsAll[p.club]=(clubCountsAll[p.club]||0)+1; } });
  const clubOver = Object.entries(clubCountsAll).filter(([,n])=>n>3);

  let banner = '';
  if(over) banner = `<div class="warn-banner">Budget dépassé de ${fmtM(cost-state.budget)} M€. Ajuste ta composition ou augmente le budget disponible.</div>`;
  else if(clubOver.length) banner = `<div class="warn-banner">Quota club dépassé : ${clubOver.map(([c,n])=>c+' ('+n+')').join(', ')} — 3 joueurs maximum par club.</div>`;
  else banner = `<div class="ok-banner">Composition valide : ${fmtM(cost)} / ${fmtM(state.budget)} M€ utilisés.</div>`;

  const feuilleBanner = state.feuillesLoaded
    ? `<div class="ok-banner">Feuille de match chargée : ${state.players.filter(p=>p.surFeuille).length} joueur(s) annoncé(s). Les autres sont exclus de la sélection (0 point garanti).</div>`
    : `<div class="warn-banner">Aucune feuille de match chargée — tous les joueurs sont considérés disponibles. Importe <span class="mono">feuilles.json</span> la veille des matchs (onglet Import / Export) pour affiner.</div>`;

  return `<div class="panel">
    <h2>Composition du week-end</h2>
    <p class="sub">Verrouille tes valeurs sûres (notamment ton capitaine) avant de lancer le remplissage automatique : l'algorithme ne touchera pas aux postes verrouillés et ira chercher des pépites pour le reste, à budget constant.</p>
    ${banner}
    ${feuilleBanner}
    <div class="toolbar">
      <button class="btn primary" id="autoFillBtn">⚡ Remplir automatiquement (pépites)</button>
      <button class="btn ghost" id="suggestCapBtn">Suggérer capitaine</button>
      <button class="btn ghost" id="suggestImpBtn">Suggérer impact player</button>
      <button class="btn danger" id="clearSquadBtn" onclick="window.clearSquad && window.clearSquad()">Vider l'équipe</button>
      <div class="grow"></div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--chalk-dim);">
        <input type="checkbox" id="riskyToggle" ${state.allowRisky?'checked':''}> Autoriser les joueurs risqués
      </label>
      ${state.feuillesLoaded ? `<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--chalk-dim);">
        <input type="checkbox" id="horsFeuilleToggle" ${state.allowHorsFeuille?'checked':''}> Autoriser les joueurs hors feuille
      </label>` : ''}
    </div>
    <div class="pitch-wrap" id="pitchWrap">
      <div class="try-zone top"></div>
      <div class="pline try-line" style="top:7%;"></div>
      <div class="pline dashed" style="top:27%;"></div>
      <div class="pline midline" style="top:50%;"></div>
      <div class="pline dashed" style="top:73%;"></div>
      <div class="pline try-line" style="top:93%;"></div>
      <div class="try-zone bottom"></div>
      ${SLOTS.map(s=>renderSlot(s)).join('')}
    </div>
    <div class="bench-row">
      ${BENCH_SLOTS.map(s=>renderSlot(s)).join('')}
    </div>
    <div class="legend">
      <span><i style="background:var(--brass)"></i> Capitaine (×2)</span>
      <span><i style="background:var(--sky)"></i> Impact player (×2)</span>
      <span><i style="background:var(--try-red)"></i> Alerte (forfait / quota)</span>
    </div>
  </div>
  ${renderNuggets()}`;
}

export function renderSlot(s){
  const bench = !!s.group;
  const id = state.squad[s.key];
  const p = id!=null ? byId(id) : null;
  const locked = !!state.locked[s.key];
  const isCap = state.captainSlot===s.key;
  const isImp = state.impactSlot===s.key;
  const violation = p ? slotViolation(s.key) : null;
  const info = p ? slotInfo(s.key) : null;
  const posStyle = bench ? '' : `left:${s.x}%; top:${s.y}%;`;
  const tier = p ? tierOf(p) : null;

  const flags = `<div class="flags">
      ${isCap?'<div class="flag cap" title="Capitaine">C</div>':''}
      ${isImp?'<div class="flag imp" title="Impact player">IP</div>':''}
      ${locked?'<div class="flag lock" title="Verrouillé">🔒</div>':''}
      ${violation?'<div class="flag warn" title="'+violation+'">!</div>':''}
    </div>`;

  const home = p ? state.calendrier[p.club] : null;
  const homeIco = home==='D' ? '🏠' : (home==='E' ? '✈️' : '');
  
  let feuilleTag = '';
  if(p && state.feuillesLoaded){
    if(!p.surFeuille) feuilleTag = `<span class="feuille-tag off" title="Hors feuille de match">HORS</span>`;
    else if(p.titulaireReel) feuilleTag = `<span class="feuille-tag tit" title="Titulaire réel n°${p.feuilleNum}">T#${p.feuilleNum}</span>`;
    else feuilleTag = `<span class="feuille-tag remp" title="Remplaçant réel n°${p.feuilleNum}">R#${p.feuilleNum}</span>`;
  }

  const actions = p ? `
    <div class="slot-actions">
      ${!bench?`<button class="micro-btn cap ${isCap?'active':''}" data-action="cap" data-slot="${s.key}" title="Capitaine (x2)">C</button>`:''}
      ${bench?`<button class="micro-btn imp ${isImp?'active':''}" data-action="imp" data-slot="${s.key}" title="Impact player (x2)">IP</button>`:''}
      <button class="micro-btn lock ${locked?'active':''}" data-action="lock" data-slot="${s.key}" title="${locked?'Déverrouiller':'Verrouiller'}">🔒</button>
      <button class="micro-btn clear" data-action="clear" data-slot="${s.key}" title="Retirer">✕</button>
    </div>` : `
    <div class="slot-actions empty-actions">
      <span class="empty-hint">Libre</span>
    </div>`;

  return `<div class="slot ${p?'filled':'empty'}" data-slot="${s.key}" style="${posStyle}" title="${violation||info||''}">
    ${flags}
    <div class="num">${s.num||(s.group==='AVANT'?'R1':'R2')}</div>
    <div class="card" data-slot-open="${s.key}">
      ${p ? `
        <div class="pname" title="${p.prenom} ${p.nom}">${p.nom}</div>
        <div class="pmeta">
          <span class="club">${p.club}</span>
          <span class="sep">·</span>
          <span class="cost">${fmtM(p.valeur)}M</span>
          ${homeIco ? `<span class="loc">${homeIco}</span>` : ''}
        </div>
        <div class="pstatus">
          <span class="tier tier-${tier}">${tierLabel(tier)}</span>
          ${feuilleTag}
        </div>
      ` : `
        <div class="empty-pos">${s.label}</div>
        <div class="empty-cta"><span class="empty-plus">+</span> Choisir</div>
      `}
    </div>
    ${actions}
  </div>`;
}

export function renderNuggets(){
  const used = usedIds(null);
  const groups = ['PIL','TAL','DL','TL','N8','DM','OUV','CEN','AIL','ARR'];
  const cards = groups.map(poste=>{
    const pool = state.players.filter(p=>p.poste===poste && !p.indisponible && !used.has(p.id) && tierOf(p)!=='risque' && (!state.feuillesLoaded || state.allowHorsFeuille || p.surFeuille));
    if(!pool.length) return '';
    pool.sort((a,b)=> (playerScore(b)/b.valeur) - (playerScore(a)/a.valeur));
    const best = pool[0];
    const home = state.calendrier[best.club];
    const ico = home==='D'?'🏠':(home==='E'?'✈️':'');
    return `<div class="nugget-card">
      <div class="pos">${POSTE_LABELS[poste]}</div>
      <div class="nm">${best.nom} ${ico}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="tier tier-${tierOf(best)}">${tierLabel(tierOf(best))}</span>
        <span class="pr">${fmtM(best.valeur)}M</span>
      </div>
    </div>`;
  }).filter(Boolean).join('');
  return `<div class="panel">
    <h2>Pépites du week-end</h2>
    <p class="sub">Meilleur ratio score / prix disponible par poste (hors joueurs déjà sélectionnés ou jugés risqués).</p>
    <div class="nuggets-grid">${cards}</div>
  </div>`;
}

export function renderJoueurs(){
  const f = state.filters;
  let list = state.players.slice();
  if(f.q) list = list.filter(p => (p.nom+' '+p.prenom).toLowerCase().includes(f.q.toLowerCase()));
  if(f.poste) list = list.filter(p=>p.poste===f.poste);
  if(f.club) list = list.filter(p=>p.club===f.club);
  if(f.hideIndispo) list = list.filter(p=>!p.indisponible);
  list.sort((a,b)=>{
    let va=a[f.sortKey], vb=b[f.sortKey];
    if(typeof va==='string') { va=va.toLowerCase(); vb=(vb||'').toLowerCase(); }
    if(va<vb) return -1*f.sortDir; if(va>vb) return 1*f.sortDir; return 0;
  });
  const clubs = Array.from(new Set(state.players.map(p=>p.club))).sort();
  const postes = Object.keys(POSTE_LABELS);

  return `<div class="panel">
    <h2>Effectif complet</h2>
    <p class="sub">Mets à jour prix et forfaits avant de lancer l'optimiseur. Rappel : un joueur qui dispute moins de 10 minutes réelles obtient 0 point.</p>
    <div class="toolbar">
      <input type="text" id="searchInp" placeholder="Rechercher un nom..." value="${f.q}" style="width:200px;">
      <select id="posteFilter"><option value="">Tous postes</option>${postes.map(k=>`<option value="${k}" ${f.poste===k?'selected':''}>${POSTE_LABELS[k]}</option>`).join('')}</select>
      <select id="clubFilter"><option value="">Tous clubs</option>${clubs.map(c=>`<option value="${c}" ${f.club===c?'selected':''}>${c}</option>`).join('')}</select>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--chalk-dim);">
        <input type="checkbox" id="hideIndispoChk" ${f.hideIndispo?'checked':''}> Masquer les forfaits
      </label>
      <div class="grow"></div>
      <span style="font-size:11.5px;color:var(--chalk-faint);">${list.length} joueur(s)</span>
    </div>
    <div class="table-scroll">
      <table>
        <thead><tr>
          <th data-sort="nom">Joueur</th>
          <th data-sort="poste">Poste</th>
          <th data-sort="club">Club</th>
          <th data-sort="valeur">Prix (M€)</th>
          <th data-sort="_priceRank">Tendance</th>
          <th>Feuille</th>
          <th>Forfait</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${list.map(p=>{
            let feuilleCell = '<span style="color:var(--chalk-faint);">—</span>';
            if(state.feuillesLoaded){
              if(!p.surFeuille) feuilleCell = '<span style="color:var(--try-red-soft);font-size:11px;">Hors feuille</span>';
              else if(p.titulaireReel) feuilleCell = `<span style="color:var(--brass-soft);font-size:11px;">Tit. n°${p.feuilleNum}</span>`;
              else feuilleCell = `<span style="color:#8fc4dd;font-size:11px;">Remp. n°${p.feuilleNum}</span>`;
            }
            return `<tr class="${p.indisponible?'indispo':''}">
              <td>${p.prenom} <strong>${p.nom}</strong></td>
              <td>${p.poste}</td>
              <td><span class="club-tag"><span class="club-dot" style="width:8px;height:8px;background:${p.couleur_hex||'#888'}"></span>${p.club}</span></td>
              <td><input type="number" step="0.01" class="price-input" data-price="${p.id}" value="${p.valeur}"></td>
              <td><span class="tier tier-${tierOf(p)}">${tierLabel(tierOf(p))}</span></td>
              <td>${feuilleCell}</td>
              <td style="text-align:center;"><input type="checkbox" data-indispo="${p.id}" ${p.indisponible?'checked':''}></td>
              <td><button class="btn sm ghost" data-usein="${p.id}">Voir postes</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

export function renderExport(){
  return `<div class="panel">
    <h2>Importer une mise à jour</h2>
    <p class="sub">
      Recharge un JSON plus récent : effectif (<span class="mono">players.json</span>, nouveaux prix/forfaits),
      feuille de match (<span class="mono">feuilles.json</span>, la veille des matchs) ou calendrier
      (<span class="mono">calendrier.json</span>). Le type est détecté automatiquement, et tu peux
      sélectionner plusieurs fichiers d'un coup.
    </p>
    <div class="row">
      <button class="btn ghost" id="mergeFileBtn">Choisir un ou plusieurs fichiers</button>
      <input type="file" id="mergeFileInput" accept="application/json" multiple class="hidden">
    </div>
    <div id="mergeStatus" style="font-size:12px;color:var(--brass-soft);margin-top:10px;"></div>
    <textarea id="mergeArea" rows="4" style="width:100%;margin-top:12px;" placeholder="...ou coller un JSON ici"></textarea>
    <button class="btn primary" id="mergeBtn" style="margin-top:10px;">Charger ce JSON</button>
  </div>
  <div class="panel">
    <h2>État des données chargées</h2>
    <div class="row" style="gap:22px;">
      <div><div style="font-size:11px;color:var(--chalk-dim);">Effectif</div><div class="mono" style="font-size:16px;">${state.players.length} joueurs</div></div>
      <div><div style="font-size:11px;color:var(--chalk-dim);">Feuille de match</div><div class="mono" style="font-size:16px;">${state.feuillesLoaded ? state.players.filter(p=>p.surFeuille).length+' annoncés' : 'non chargée'}</div></div>
      <div><div style="font-size:11px;color:var(--chalk-dim);">Calendrier</div><div class="mono" style="font-size:16px;">${state.calendrierJournees ? Object.keys(state.calendrierJournees).length+' journées' : 'non chargé'}</div></div>
    </div>
  </div>
  <div class="panel">
    <h2>Exporter la semaine</h2>
    <p class="sub">
      Génère un fichier <span class="mono">ptitburo_J${state.journee}_${todayStr()}.json</span> contenant ta composition,
      le calendrier renseigné et l'effectif à jour (prix, forfaits). Chaque joueur porte un champ
      <span class="mono">notes</span> vide, prêt à accueillir sa note réelle du week-end (ex. <span class="mono">{"J${state.journee}": 71}</span>)
      pour affiner automatiquement les scores la semaine prochaine.
    </p>
    <button class="btn primary" id="exportBtn">⬇ Exporter le JSON de la journée ${state.journee}</button>
  </div>`;
}

export function renderPicker(){
  const slot = slotDef(state.picker);
  const used = usedIds(state.picker);
  const pool = state.players.filter(p=>isEligible(slot,p) && !used.has(p.id));
  pool.sort((a,b)=>slotAdjustedScore(slot,b)-slotAdjustedScore(slot,a));
  const bench = !!slot.group;
  return `<div class="modal-overlay" id="pickerOverlay">
    <div class="modal">
      <div class="modal-head">
        <h3>${slot.label} — choisir un joueur</h3>
        <button class="close-x" id="closePicker">✕</button>
      </div>
      <div class="modal-body">
        <input type="text" id="pickerSearch" placeholder="Filtrer par nom ou club..." style="width:100%;margin-bottom:10px;">
        ${state.feuillesLoaded && state.allowHorsFeuille ? `<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--chalk-dim);margin-bottom:8px;"><input type="checkbox" checked disabled> Joueurs hors feuille inclus (option activée)</label>` : ''}
        <div id="pickerList">
          ${pool.slice(0,300).map(p=>{
            const home = state.calendrier[p.club];
            const ico = home==='D'?'🏠':(home==='E'?'✈️':'');
            let feuilleTag = '';
            if(state.feuillesLoaded){
              if(!p.surFeuille) feuilleTag = `<span style="color:var(--try-red-soft);font-size:10px;">Hors feuille</span>`;
              else if(bench && p.titulaireReel) feuilleTag = `<span style="color:var(--try-red-soft);font-size:10px;">Titulaire réel — ÷2</span>`;
              else if(!bench && p.remplacantReel) feuilleTag = `<span style="color:var(--chalk-dim);font-size:10px;">Remplaçant réel</span>`;
            }
            return `<div class="pick-row" data-pick="${p.id}">
              <span class="tier tier-${tierOf(p)}">${tierLabel(tierOf(p))}</span>
              <span class="pn">${p.prenom} ${p.nom} <span style="color:var(--chalk-dim);font-weight:400;">· ${p.club}</span></span>
              ${feuilleTag}
              <span class="home-ico">${ico}</span>
              <span class="pp mono">${fmtM(p.valeur)}M</span>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="modal-foot">
        <span style="font-size:11px;color:var(--chalk-faint);">${pool.length} joueur(s) éligible(s)</span>
        <button class="btn ghost" id="cancelPicker">Annuler</button>
      </div>
    </div>
  </div>`;
}

export function renderFooter(){
  return `<footer class="note">
    Score sans notes de match réelles : basé sur le prix (proxy de qualité) × bonus domicile/extérieur — architecture prête à
    utiliser automatiquement de vraies notes /100 dès qu'elles seront présentes dans le JSON importé.
    ${state.feuillesLoaded ? 'Feuille de match prise en compte : les joueurs non annoncés sont exclus des propositions, et un titulaire réel placé sur le banc fantasy voit son score anticipé divisé par deux.' : "Pense à importer la feuille de match la veille des matchs pour affiner les propositions."}
    Rappels règlement : capitaine et impact player comptent double · un remplaçant réellement titularisé chez son club voit ses points divisés par deux · verrou au coup d'envoi du match de chaque club.
  </footer>`;
}
