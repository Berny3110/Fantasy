import { loadDefaultData } from './services/parser.js';
import { render } from './ui/renderer.js';
import { pwa } from './pwa.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Charger les données immédiatement pour afficher l'application sans attente
  await loadDefaultData();
  render();

  // Synchronisation en arrière-plan sans bloquer l'affichage
  fetch('/api/sync')
    .then(r => r.json())
    .then(res => {
      console.log('✅ Synchronisation arrière-plan :', res);
    })
    .catch(() => {});
});