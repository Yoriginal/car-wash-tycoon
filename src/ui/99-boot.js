/* Démarrage : en dernier, quand tous les modules sont chargés. */
window.__CWT = { get S() { return S; }, E, go, toast, setSpeed, act: (a, d = {}) => act(a, { dataset: d }) };
{
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
}
