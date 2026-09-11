import { loadDefaultData } from './services/parser.js';
import { render } from './ui/renderer.js';

document.addEventListener('DOMContentLoaded', async () => {
  await loadDefaultData();
  render();
});