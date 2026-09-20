import { loadDefaultData } from './services/parser.js';
import { render } from './ui/renderer.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🔄 Déclenchement de la synchronisation...');
    await fetch('/api/sync');
    console.log('✅ Synchronisation terminée !');
  } catch (err) {
    console.error('⚠️ Erreur lors de la synchronisation:', err);
  }

  await loadDefaultData();
  render();
});