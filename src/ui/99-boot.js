/* Démarrage : en dernier, quand tous les modules sont chargés. */
// définitions SVG communes (motifs, dégradés) une seule fois dans la page
if (ASSET_DEFS && !document.getElementById('cwt-defs')) {
  document.body.insertAdjacentHTML('afterbegin', ASSET_DEFS.replace('<svg ', '<svg id="cwt-defs" width="0" height="0" style="position:absolute" aria-hidden="true" '));
}
feuillesBind();
window.__CWT = { get S() { return S; }, E, go, toast, setSpeed, pop: p => { (ui.pops = ui.pops || []).push(p); popupNext(); }, feuille: (k, a) => feuilleOpen(k, a), act: (a, d = {}) => act(a, { dataset: d }) };
{
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
}
coachBuild();
setInterval(coachTick, 300);
