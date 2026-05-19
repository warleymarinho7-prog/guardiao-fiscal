// plans.js — PRO_FREE_MODE, initProFreeMode, UI de planos

// plans.js — PRO_FREE_MODE, initProFreeMode, openCheckout, Mercado Pago

// auth.js — Supabase, auth, planos, senha

// ===== PRO FREE MODE FUNCTIONS =====
const PRO_FREE_MODE = true; // mude para false para reativar cobrança

function showProFreeBanner() {
  showPage('planos');
  setTimeout(() => {
    const banner = document.getElementById('proFreeBanner');
    if (banner) { banner.style.display = 'block'; banner.scrollIntoView({behavior:'smooth',block:'start'}); }
  }, 150);
}

function initProFreeMode() {
  if (!PRO_FREE_MODE) return;
  // Banner na página de planos
  const plansWrap = document.querySelector('#page-planos .plans-page');
  if (plansWrap && !document.getElementById('proFreeBanner')) {
    const banner = document.createElement('div');
    banner.id = 'proFreeBanner';
    banner.style.cssText = 'display:none;background:linear-gradient(135deg,rgba(0,217,110,0.1),rgba(0,150,100,0.06));border:1px solid rgba(0,217,110,0.3);border-radius:14px;padding:18px 20px;margin-bottom:24px;text-align:center';
    banner.innerHTML = '<div style="font-family:Manrope,sans-serif;font-size:14px;font-weight:700;color:#00d96e;margin-bottom:5px">🎉 Período de Lançamento — Pro Gratuito</div><div style="font-size:12px;color:#8fa8c8;line-height:1.6">Durante o lançamento todos os recursos Pro estão liberados gratuitamente.<br>Aproveite e nos dê seu feedback!</div>';
    plansWrap.insertBefore(banner, plansWrap.firstChild);
  }
  // Atualiza badge aba extrato
  const badge = document.getElementById('extratoTabBadge');
  if (badge) { badge.textContent = 'PRO GRÁTIS'; badge.className = 'tbadge tbadge-green'; }
  // Atualiza botão Pro na página de planos
  const btnPro = document.querySelector('.btn-plan-pro');
  if (btnPro) btnPro.innerHTML = '🎉 Acessar Pro Grátis — Período de lançamento →';
  // Atualiza destaque popular
  const popular = document.querySelector('.plan-popular');
  if (popular) popular.textContent = '🎉 GRATUITO AGORA';
  // Atualiza preço
  const planVal = document.querySelector('.plan-card.featured .plan-value');
  if (planVal) { planVal.textContent = 'R$0'; planVal.style.color = '#00d96e'; }
  const planPeriod = document.querySelector('.plan-card.featured .plan-period');
  if (planPeriod) planPeriod.textContent = 'durante o lançamento';
  // Atualiza cards upgrade no resultado
  const ucPro = document.getElementById('ucProText');
  if (ucPro) ucPro.textContent = 'Acessar Pro Grátis — Período de lançamento';
  // Atualiza paywall
  const pwPro = document.getElementById('paywallProText');
  if (pwPro) pwPro.textContent = 'Acessar Pro Grátis — Período de lançamento';
}

