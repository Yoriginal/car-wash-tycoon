/* Kit d'interface : icônes, pictos d'état, sprites du pack, petits utilitaires d'affichage.
   Uniquement des fonctions : aucun code exécuté au chargement. */

// icône du pack (grille 24, trait currentColor)
function icon(name, cls = 'ic') {
  const svg = ASSETS['icones/' + name];
  if (!svg) return '';
  return `<span class="${cls}" aria-hidden="true">${svg.replace(/ width="24" height="24"/, '')}</span>`;
}

// sprite du pack, avec ses marqueurs {{...}} remplis
function sprite(name, values = {}, cls = '') {
  let svg = ASSETS[name] || '';
  for (const k in values) svg = svg.split('{{' + k + '}}').join(escSvg(values[k]));
  return cls ? svg.replace('<svg ', `<svg class="${cls}" `) : svg;
}
function escSvg(v) { return String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// pictos d'état : 5 silhouettes distinctes, la forme porte le sens
const PICTO_LABEL = { critique: 'Critique', opportunite: 'Opportunité', info: 'Info', recompense: 'Récompense', ok: 'Tout tourne' };
function picto(kind, size = 22) {
  const s = `width="${size}" height="${size}" viewBox="0 0 24 24" role="img" aria-label="${PICTO_LABEL[kind] || ''}"`;
  switch (kind) {
    case 'critique': return `<svg class="picto" ${s}><path d="M12 2.6L22.6 21H1.4z" fill="#EE3B30" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 9v5.4" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="17.7" r="1.5" fill="#fff"/></svg>`;
    case 'opportunite': return `<svg class="picto" ${s}><path d="M12 1.5L22.5 12 12 22.5 1.5 12z" fill="#F5A300" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 16.5V8M8.3 11.4L12 7.7l3.7 3.7" stroke="#171B1E" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'info': return `<svg class="picto" ${s}><circle cx="12" cy="12" r="10.4" fill="#1E97E0" stroke="#fff" stroke-width="1.2"/><circle cx="12" cy="7.4" r="1.5" fill="#fff"/><path d="M12 10.8v6.4" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`;
    case 'recompense': return `<svg class="picto" ${s}><path d="M12 1.8l3 6.5 7.1.8-5.3 4.8 1.5 7-6.3-3.6-6.3 3.6 1.5-7L1.9 9.1 9 8.3z" fill="#FF2E7A" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/></svg>`;
    case 'ok': return `<svg class="picto" ${s}><rect x="2.2" y="2.2" width="19.6" height="19.6" rx="5" fill="#22A447" stroke="#fff" stroke-width="1.2"/><path d="M7 12.4l3.3 3.3 6.7-7" stroke="#171B1E" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  return '';
}

// pièce de la trésorerie
function coin(size = 26) {
  return `<svg class="coin" width="${size}" height="${size}" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="#F5A300"/><circle cx="13" cy="13" r="9" fill="none" stroke="#171B1E" stroke-width="1.4" opacity=".35"/><text x="13" y="17.6" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="13" fill="#171B1E">€</text></svg>`;
}

// Bulle, la mascotte : ok, joie, oups
function bulle(humeur = 'ok', size = 40) {
  return sprite('ui/bulle_' + humeur).replace('<svg ', `<svg class="bulle" width="${size}" height="${size}" `);
}

// montants
function signed(v) { return (v >= 0 ? '+' : '−') + fmt(Math.abs(v)).replace(/^−/, ''); }
