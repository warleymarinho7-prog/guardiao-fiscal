// init.js — DOMContentLoaded, feed demo

document.addEventListener('DOMContentLoaded', function() {
  renderQ();
  // mRenderQ e initProFreeMode diferidos — não bloqueiam o primeiro frame
  (window.requestIdleCallback || (cb => setTimeout(cb, 300)))(function() {
    mRenderQ();
    initProFreeMode();
  });
  // Anima o dashboard mockup no hero desktop
  setTimeout(() => {
    const bar = document.getElementById('mockBar');
    if (bar) bar.style.width = '38%';
  }, 600);
  // Restaura página via hash na URL (ex: após voltar/avançar do browser)
  const hashPage = window.location.hash.replace('#', '');
  const validPages = ['home', 'extrato', 'planos', 'institucional'];
  if (hashPage && validPages.includes(hashPage)) {
    _applyPage(hashPage);
  }
  // Registra estado inicial no histórico para o popstate funcionar na primeira navegação
  const activePage = document.querySelector('.page.active')?.id?.replace('page-', '') || 'home';
  try { history.replaceState({ page: activePage }, '', window.location.href); } catch(e) {}
});

