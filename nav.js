// nav.js — navegação, drawer, overlays

// ===== NAVIGATION =====
function _applyPage(id) {
  const target = document.getElementById('page-' + id);
  if (!target) { console.warn('showPage: página não encontrada:', id); return; }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  target.classList.add('active');
  window.scrollTo(0,0);
  // Nav desktop
  document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
  if (id === 'home') document.querySelectorAll('.nav-link')[0]?.classList.add('active');
  if (id === 'extrato') document.querySelectorAll('.nav-link')[1]?.classList.add('active');
  if (id === 'planos') document.querySelectorAll('.nav-link')[2]?.classList.add('active');
  if (id === 'institucional') document.querySelectorAll('.nav-link')[3]?.classList.add('active');
  // Nav drawer mobile
  document.querySelectorAll('.nav-drawer-link').forEach(b => b.classList.remove('active'));
  if (id === 'home') document.getElementById('drawerHome')?.classList.add('active');
  if (id === 'extrato') document.getElementById('drawerExtrato')?.classList.add('active');
  if (id === 'planos') document.getElementById('drawerPlanos')?.classList.add('active');
  if (id === 'institucional') document.getElementById('drawerInstitucional')?.classList.add('active');
  // Ao entrar na página de extrato, garantir que simExtrato está visível
  // e auto-skip step1 se já logado
  if (id === 'extrato') {
    const se = document.getElementById('simExtrato');
    if (se) se.style.display = 'block';
    if (typeof _currentUser !== 'undefined' && _currentUser) {
      if (typeof autoSkipExtStep1 === 'function') autoSkipExtStep1(_currentUser.email);
    }
  }
}

function showPage(id) {
  const current = document.querySelector('.page.active')?.id?.replace('page-', '');
  if (current === id) return;
  try { history.pushState({ page: id }, '', '#' + id); } catch(e) {}
  _applyPage(id);
}

// Restaura página ao navegar com botão voltar/avançar do browser
window.addEventListener('popstate', function(e) {
  const id = (e.state && e.state.page) ? e.state.page : 'home';
  _applyPage(id);
});

// ── Fecha todos os overlays ativos (mutex) ──
function closeAllOverlays() {
  document.getElementById('checkoutOverlay').classList.remove('show');
  document.getElementById('loginOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

// ── Mobile drawer ──
function toggleDrawer() {
  const drawer = document.getElementById('navDrawer');
  const hamburger = document.getElementById('navHamburger');
  const isOpen = drawer.classList.toggle('open');
  hamburger.classList.toggle('open', isOpen);
  drawer.style.display = isOpen ? 'block' : 'none';
  document.body.style.overflow = isOpen ? 'hidden' : '';
}
function closeDrawer() {
  const drawer = document.getElementById('navDrawer');
  const hamburger = document.getElementById('navHamburger');
  if (drawer) { drawer.classList.remove('open'); drawer.style.display = 'none'; }
  if (hamburger) hamburger.classList.remove('open');
  document.body.style.overflow = '';
}
// Fechar drawer e modais com ESC
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); closeAllOverlays(); } });

// Scroll automático para input ativo no mobile (evita teclado cobrir campo)
document.addEventListener('focusin', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    const modal = e.target.closest('.modal');
    if (modal && window.innerWidth < 768) {
      setTimeout(() => {
        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 320); // aguarda teclado abrir (~300ms no iOS)
    }
  }
});

function switchSimTab(tab) {
  if (tab === 'extrato') { showPage('extrato'); return; }
  document.getElementById('simPerguntas').style.display = 'block';
  document.getElementById('tabQ').classList.toggle('active', true);
}

