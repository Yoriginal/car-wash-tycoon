/* Aperçu (/preview/) : bandeau visible, partie copiée et copies de sécurité.
   L'aperçu peut embarquer un moteur plus récent que le jeu (format de sauvegarde plus récent) :
   il joue donc sur une COPIE de la partie (clé « cwt-apercu-save »), jamais sur celle du jeu,
   qu'une version plus ancienne ne saurait pas relire. */
const PREVIEW = !!window.CWT_PREVIEW;
const SAVE_KEY = PREVIEW ? 'cwt-apercu-save' : 'cwt-save-v3';
const PREVIEW_BACKUPS = ['cwt-backup-apercu-1', 'cwt-backup-apercu-2', 'cwt-backup-apercu-3'];
if (PREVIEW) {
  try {
    // première ouverture : on part d'une copie de la partie du jeu
    if (!localStorage.getItem(SAVE_KEY)) { const jeu = localStorage.getItem('cwt-save-v3'); if (jeu) localStorage.setItem(SAVE_KEY, jeu); }
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      // rotation : la plus récente en 1, on garde les 3 dernières ouvertures
      for (let i = PREVIEW_BACKUPS.length - 1; i > 0; i--) {
        const prev = localStorage.getItem(PREVIEW_BACKUPS[i - 1]);
        if (prev) localStorage.setItem(PREVIEW_BACKUPS[i], prev);
      }
      localStorage.setItem(PREVIEW_BACKUPS[0], JSON.stringify({ at: Date.now(), raw }));
    }
  } catch (e) { /* stockage indisponible */ }
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.className = 'preview-ribbon';
    b.textContent = 'APERÇU';
    document.body.appendChild(b);
  });
}
// partie du jeu principal, pour repartir de celle-ci dans l'aperçu
function partieDuJeu() {
  try { const t = localStorage.getItem('cwt-save-v3'); return t ? JSON.parse(t) : null; } catch (e) { return null; }
}
