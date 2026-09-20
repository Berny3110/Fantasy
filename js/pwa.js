/**
 * Module PWA : Enregistrement du Service Worker, gestion de l'installation et mode hors-ligne
 */

class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isStandalone = false;
    this.isIOS = false;
    this.isOnline = navigator.onLine;
    this.init();
  }

  init() {
    // 1. Détection du mode autonome (déjà installé)
    this.isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    // 2. Détection iOS
    const ua = window.navigator.userAgent.toLowerCase();
    this.isIOS = /iphone|ipad|ipod/.test(ua) && !window.MSStream;

    // 3. Enregistrement du Service Worker
    this.registerServiceWorker();

    // 4. Écoute de l'événement d'installation Chromium/Android/Desktop
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.updateInstallButtonVisibility();
    });

    window.addEventListener('appinstalled', () => {
      console.log('🎉 Application PWA installée avec succès !');
      this.isStandalone = true;
      this.deferredPrompt = null;
      this.updateInstallButtonVisibility();
    });

    // 5. Gestion de l'état de connexion réseau
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateOfflineBanner();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateOfflineBanner();
    });

    // Afficher l'indicateur si déjà hors-ligne
    if (!this.isOnline) {
      this.updateOfflineBanner();
    }
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // Nettoyage immédiat des anciens caches obsolètes (v1, v2, v3, v4)
        if ('caches' in window) {
          caches.keys().then((keys) => {
            keys.forEach((k) => {
              if (k !== 'ptit-buro-pwa-v5' && k !== 'ptit-buro-fonts') {
                caches.delete(k);
              }
            });
          });
        }

        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('✅ Service Worker actif avec le scope :', registration.scope);
        registration.update();

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 Nouvelle version disponible en cache.');
              }
            });
          }
        });
      } catch (err) {
        console.warn('⚠️ Échec de l’enregistrement du Service Worker :', err);
      }
    }
  }

  get canInstall() {
    if (this.isStandalone) return false;
    return !!this.deferredPrompt || this.isIOS;
  }

  async install() {
    if (this.deferredPrompt) {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.isStandalone = true;
        this.deferredPrompt = null;
        this.updateInstallButtonVisibility();
      }
      return;
    }

    if (this.isIOS) {
      this.showIOSInstructions();
    }
  }

  showIOSInstructions() {
    const existing = document.getElementById('pwa-ios-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'pwa-ios-modal';
    modal.className = 'pwa-modal-overlay';
    modal.innerHTML = `
      <div class="pwa-modal-box">
        <div class="pwa-modal-title">
          <span>📲</span> Installer sur iPhone / iPad
        </div>
        <div class="pwa-modal-body">
          <p style="margin-bottom: 14px;">
            Pour utiliser <strong>Le P'tit Buro</strong> comme une vraie application sans barre de navigateur :
          </p>
          <div class="pwa-step">
            <div class="pwa-step-num">1</div>
            <div>Touchez le bouton de <strong>Partage</strong> (<span style="font-size:1.1rem;">⎋</span> ou rectangle avec flèche vers le haut) dans Safari.</div>
          </div>
          <div class="pwa-step">
            <div class="pwa-step-num">2</div>
            <div>Faites défiler vers le bas et sélectionnez <strong>Sur l'écran d'accueil</strong> (<span style="font-size:1.1rem;">⊞</span>).</div>
          </div>
          <div class="pwa-step">
            <div class="pwa-step-num">3</div>
            <div>Confirmez en appuyant sur <strong>Ajouter</strong> en haut à droite.</div>
          </div>
        </div>
        <button class="btn primary" id="close-ios-modal" style="width: 100%;">Compris</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#close-ios-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  updateInstallButtonVisibility() {
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) {
      if (this.canInstall) {
        btn.classList.remove('hidden');
      } else {
        btn.classList.add('hidden');
      }
    }
  }

  updateOfflineBanner() {
    let banner = document.getElementById('offline-toast');
    if (!this.isOnline) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'offline-toast';
        banner.className = 'offline-banner';
        banner.innerHTML = `
          <span class="offline-led"></span>
          <span><strong>MODE HORS-LIGNE</strong> · Données locales actives</span>
        `;
        document.body.appendChild(banner);
      }
    } else {
      if (banner) banner.remove();
    }
  }
}

export const pwa = new PWAManager();
