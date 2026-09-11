import { state, byId, POSTE_LABELS } from '../state.js';
import { recomputeRanks } from '../engine/scoring.js';
import { autoFill, suggestCaptain, suggestImpact } from '../engine/optimizer.js';
import { handleImportedJSON, exportState, applyCalendrierForJournee } from '../services/parser.js';
import { renderImportScreen, renderHeader, renderTab, renderFooter, renderPicker } from './components.js';

export function render(){
  const app = document.getElementById('app');
  if(!state.imported){ app.innerHTML = renderImportScreen(); attachImportHandlers(); return; }
  app.innerHTML = `
    ${renderHeader()}
    <main>${renderTab()}</main>
    ${renderFooter()}
    ${state.picker ? renderPicker() : ''}
  `;
  attachGlobalHandlers();
}

export function processFiles(fileList){
  const files = Array.from(fileList);
  const statusEl = document.getElementById('importStatus') || document.getElementById('mergeStatus');
  let remaining = files.length;
  files.forEach(f=>{
    const r = new FileReader();
    r.onload = ()=>{
      const res = handleImportedJSON(r.result, true);
      if(res && statusEl) statusEl.innerHTML += `<div>✓ ${f.name} — ${res.summary}</div>`;
      remaining--;
      if(remaining===0) render();
    };
    r.readAsText(f);
  });
}

export function attachImportHandlers(){
  const dz = document.getElementById('dropzone');
  const fi = document.getElementById('fileInput');
  dz.addEventListener('click', ()=>fi.click());
  ['dragover','dragenter'].forEach(ev=>dz.addEventListener(ev, e=>{e.preventDefault(); dz.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev, e=>{e.preventDefault(); dz.classList.remove('drag');}));
  dz.addEventListener('drop', e=>{ if(e.dataTransfer.files.length) processFiles(e.dataTransfer.files); });
  fi.addEventListener('change', e=>{ if(e.target.files.length) processFiles(e.target.files); });
  document.getElementById('pasteBtn').addEventListener('click', ()=>{
    const txt = document.getElementById('pasteArea').value.trim();
    if(!txt){ alert('Colle un JSON avant de charger.'); return; }
    const res = handleImportedJSON(txt, true);
    if(res) render();
  });
  const cb = document.getElementById('continueBtn');
  if(cb) cb.onclick = ()=>{ state.imported = true; render(); };
}

export function attachGlobalHandlers(){
  const reimport = document.getElementById('reimportBtn');
  if(reimport) reimport.onclick = ()=>{ if(confirm("Repartir de l'écran d'import ? Ta composition en cours sera perdue.")){ Object.assign(state, {imported:false, players:[], squad:{}, locked:{}, captainSlot:null, impactSlot:null}); render(); } };

  document.querySelectorAll('nav.tabs button').forEach(b=>{
    b.onclick = ()=>{ state.tab = b.dataset.tab; render(); };
  });

  if(state.tab==='semaine') attachSemaineHandlers();
  if(state.tab==='effectif') attachEffectifHandlers();
  if(state.tab==='joueurs') attachJoueursHandlers();
  if(state.tab==='export') attachExportHandlers();
  if(state.picker) attachPickerHandlers();
}

export function renderSemaineTab() {
  const container = document.getElementById('tab-semaine-content'); // ou votre conteneur
  if (!container) return;

  const hasCalendrier = !!state.calendrierJournees;
  const currentJKey = 'J' + state.journee;
  const currentJData = hasCalendrier ? state.calendrierJournees[currentJKey] : null;

  let html = `
    <div class="card p-4 mb-4">
      <h3>📅 État du Calendrier</h3>
      <p>Source actuelle : <strong>${state.calendrierSource || 'Non chargé'}</strong></p>
      <p>Journée active sélectionnée : <span class="badge bg-primary">Journée ${state.journee}</span></p>
    </div>
  `;

  if (!hasCalendrier) {
    html += `
      <div class="alert alert-warning">
        ⚠️ Aucun calendrier n'est actuellement en mémoire. Vérifiez que <code>calendrier.json</code> est bien présent à la racine et que le serveur local le sert correctement.
      </div>
    `;
  } else {
    // Liste de toutes les journées avec mise en evidence de la journée active
    const journeesKeys = Object.keys(state.calendrierJournees).sort((a, b) => {
      return parseInt(a.replace('J', '')) - parseInt(b.replace('J', ''));
    });

    html += `
      <div class="card p-4 mb-4">
        <h4>Sélection de la Journée</h4>
        <div class="d-flex flex-wrap gap-2 my-3">
    `;

    journeesKeys.forEach(jKey => {
      const jNum = parseInt(jKey.replace('J', ''));
      const isActive = jNum === state.journee;
      // Style dynamique : si c'est la journée active, on met en relief fort (ex: btn-primary vs btn-outline-secondary)
      const btnClass = isActive ? 'btn btn-primary fw-bold shadow-sm' : 'btn btn-outline-secondary';
      html += `<button class="${btnClass} journee-selector-btn" data-journee="${jNum}">${jKey}</button>`;
    });

    html += `</div>`;

    // Détail des matchs de la journée sélectionnée pour vérification visuelle immédiate
    html += `
        <h5 class="mt-4">Matchs de la Journée ${state.journee} ${currentJData && currentJData.dates ? `(${currentJData.dates})` : ''}</h5>
    `;

    if (!currentJData || !currentJData.matches || currentJData.matches.length === 0) {
      html += `<p class="text-muted">Aucun match trouvé pour cette journée dans le calendrier.</p>`;
    } else {
      html += `<ul class="list-group">`;
      currentJData.matches.forEach(m => {
        // Vérification de la résolution des clubs
        const hc = resolveClubCode(m.home);
        const ac = resolveClubCode(m.away);
        const hBadge = hc ? `<span class="badge bg-success">Dom (${hc})</span>` : `<span class="badge bg-danger" title="Club non reconnu">Dom non reconnu (${m.home})</span>`;
        const aBadge = ac ? `<span class="badge bg-info text-dark">Ext (${ac})</span>` : `<span class="badge bg-danger" title="Club non reconnu">Ext non reconnu (${m.away})</span>`;

        html += `
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <span><strong>${m.home}</strong> vs <strong>${m.away}</strong></span>
            <div>${hBadge} ${aBadge}</div>
          </li>
        `;
      });
      html += `</ul>`;
    }

    html += `</div>`;
  }

  container.innerHTML = html;

  // Ajouter les écouteurs d'événements pour changer de journée directement depuis cet onglet de test
  container.querySelectorAll('.journee-selector-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetJ = parseInt(e.target.getAttribute('data-journee'));
      state.journee = targetJ;
      applyCalendrierForJournee(targetJ);
      renderSemaineTab(); // Re-render pour mettre à jour la vue
      // Mettre à jour aussi le reste de l'app si nécessaire (ex: grille principale)
      if (typeof window.refreshApp === 'function') window.refreshApp();
    });
  });
}

function attachSemaineHandlers(){
  const j = document.getElementById('inpJournee');
  if(j) j.onchange = ()=>{ state.journee = parseInt(j.value)||1; applyCalendrierForJournee(state.journee); render(); };
  const b = document.getElementById('inpBudget');
  if(b) b.onchange = ()=>{ state.budget = parseFloat(b.value)||0; render(); };
  const hb = document.getElementById('inpHomeBonus');
  if(hb) hb.onchange = ()=>{ state.homeBonusPct = parseFloat(hb.value)||0; render(); };
  const am = document.getElementById('inpAwayMalus');
  if(am) am.onchange = ()=>{ state.awayMalusPct = parseFloat(am.value)||0; render(); };

  document.querySelectorAll('[data-goto-journee]').forEach(el=>{
    el.onclick = ()=>{
      const n = parseInt(el.dataset.gotoJournee);
      state.journee = n;
      applyCalendrierForJournee(n);
      render();
    };
  });
}

function attachEffectifHandlers(){
  const af = document.getElementById('autoFillBtn'); if(af) af.onclick = ()=>{ autoFill(); render(); };
  const sc = document.getElementById('suggestCapBtn'); if(sc) sc.onclick = ()=>{ suggestCaptain(); render(); };
  const si = document.getElementById('suggestImpBtn'); if(si) si.onclick = ()=>{ suggestImpact(); render(); };
  const cs = document.getElementById('clearSquadBtn'); if(cs) cs.onclick = ()=>{
    if(confirm('Vider toute la composition ?')){ state.squad={}; state.locked={}; state.captainSlot=null; state.impactSlot=null; render(); }
  };
  const rk = document.getElementById('riskyToggle'); if(rk) rk.onchange = ()=>{ state.allowRisky = rk.checked; render(); };
  const hf = document.getElementById('horsFeuilleToggle'); if(hf) hf.onchange = ()=>{ state.allowHorsFeuille = hf.checked; render(); };

  document.querySelectorAll('[data-slot-open]').forEach(el=>{
    el.onclick = ()=>{ state.picker = el.dataset.slotOpen; render(); };
  });
  document.querySelectorAll('[data-action]').forEach(btn=>{
    btn.onclick = (e)=>{
      e.stopPropagation();
      const key = btn.dataset.slot;
      const action = btn.dataset.action;
      if(action==='clear'){ state.squad[key]=null; delete state.locked[key]; if(state.captainSlot===key) state.captainSlot=null; if(state.impactSlot===key) state.impactSlot=null; }
      if(action==='lock'){ state.locked[key] = !state.locked[key]; }
      if(action==='cap'){ state.captainSlot = state.captainSlot===key ? null : key; }
      if(action==='imp'){ state.impactSlot = state.impactSlot===key ? null : key; }
      render();
    };
  });
}

function attachJoueursHandlers(){
  const s = document.getElementById('searchInp'); if(s) s.oninput = ()=>{ state.filters.q = s.value; render(); };
  const pf = document.getElementById('posteFilter'); if(pf) pf.onchange = ()=>{ state.filters.poste = pf.value; render(); };
  const cf = document.getElementById('clubFilter'); if(cf) cf.onchange = ()=>{ state.filters.club = cf.value; render(); };
  const hi = document.getElementById('hideIndispoChk'); if(hi) hi.onchange = ()=>{ state.filters.hideIndispo = hi.checked; render(); };
  document.querySelectorAll('th[data-sort]').forEach(th=>{
    th.onclick = ()=>{
      const k = th.dataset.sort;
      if(state.filters.sortKey===k) state.filters.sortDir *= -1; else { state.filters.sortKey=k; state.filters.sortDir=1; }
      render();
    };
  });
  document.querySelectorAll('[data-price]').forEach(inp=>{
    inp.onchange = ()=>{ const p = byId(parseInt(inp.dataset.price)); if(p){ p.valeur = parseFloat(inp.value)||0; recomputeRanks(); render(); } };
  });
  document.querySelectorAll('[data-indispo]').forEach(chk=>{
    chk.onchange = ()=>{ const p = byId(parseInt(chk.dataset.indispo)); if(p){ p.indisponible = chk.checked; render(); } };
  });
  document.querySelectorAll('[data-usein]').forEach(btn=>{
    btn.onclick = ()=>{
      const p = byId(parseInt(btn.dataset.usein));
      alert(`${p.prenom} ${p.nom}\nPoste principal : ${POSTE_LABELS[p.poste]||p.poste}${p.poste_secondaire?`\nPoste secondaire : ${POSTE_LABELS[p.poste_secondaire]||p.poste_secondaire}`:''}`);
    };
  });
}

function attachExportHandlers(){
  const mfb = document.getElementById('mergeFileBtn');
  const mfi = document.getElementById('mergeFileInput');
  if(mfb) mfb.onclick = ()=>mfi.click();
  if(mfi) mfi.onchange = (e)=>{
    const files = Array.from(e.target.files); if(!files.length) return;
    processFiles(files);
  };
  const mb = document.getElementById('mergeBtn');
  if(mb) mb.onclick = ()=>{
    const txt = document.getElementById('mergeArea').value.trim();
    if(!txt) return;
    const res = handleImportedJSON(txt, true);
    if(res){ render(); }
  };
  const eb = document.getElementById('exportBtn');
  if(eb) eb.onclick = exportState;
}

function attachPickerHandlers(){
  const overlay = document.getElementById('pickerOverlay');
  const close = ()=>{ state.picker=null; render(); };
  document.getElementById('closePicker').onclick = close;
  document.getElementById('cancelPicker').onclick = close;
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  document.getElementById('pickerSearch').oninput = (e)=>{
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#pickerList .pick-row').forEach(row=>{
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  };
  document.querySelectorAll('[data-pick]').forEach(row=>{
    row.onclick = ()=>{
      state.squad[state.picker] = parseInt(row.dataset.pick);
      state.picker = null;
      render();
    };
  });
}
