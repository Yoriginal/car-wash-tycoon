/* Aperçu (/preview/) : bandeau visible et copies de sécurité de la partie avant chaque ouverture.
   La partie est partagée avec le jeu principal (même appareil, même sauvegarde). */
const PREVIEW = !!window.CWT_PREVIEW;
const PREVIEW_BACKUPS = ['cwt-backup-apercu-1', 'cwt-backup-apercu-2', 'cwt-backup-apercu-3'];
if (PREVIEW) {
  try {
    const raw = localStorage.getItem('cwt-save-v3');
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
// restaure la copie n (1 = la plus récente) ; renvoie false si absente
function restorePreviewBackup(n) {
  try {
    const b = JSON.parse(localStorage.getItem(PREVIEW_BACKUPS[n - 1]) || 'null');
    if (!b || !b.raw) return false;
    localStorage.setItem('cwt-save-v3', b.raw);
    return true;
  } catch (e) { return false; }
}
