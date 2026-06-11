// ═══════════════════════════════
// HERO CONFIG — edite aqui para mudar o hero em desktop e mobile
// Não altere o HTML diretamente.
// ═══════════════════════════════
const HERO_CONFIG = {
  tag: '🛡️ Scanner Preventivo de Malha Fina · e-Financeira · LGPD',
  h1:  'A Receita já analisou<br>sua movimentação.<br><em>Você já analisou a sua?</em>',
  sub: 'Descubra em poucos minutos se seu extrato bancário possui sinais que costumam gerar inconsistências no Imposto de Renda — antes que virem problema.',
};

document.addEventListener('DOMContentLoaded', function () {
  ['Desktop', 'Mobile'].forEach(function (s) {
    const tag = document.getElementById('heroTag' + s);
    const h1  = document.getElementById('heroH1' + s);
    const sub = document.getElementById('heroSub' + s);
    if (tag) tag.textContent  = HERO_CONFIG.tag;
    if (h1)  h1.innerHTML     = HERO_CONFIG.h1;
    if (sub) sub.textContent  = HERO_CONFIG.sub;
  });
});

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
  if (id === 'historico') { document.getElementById('drawerHistorico')?.classList.add('active'); eCarregarHistorico(); }
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

// ===== PREÇOS — fonte única de verdade =====
// Para alterar qualquer preço, mude APENAS aqui.
const PRICES = {
  avulso: { value: 19.90, label: 'R$19,90', labelPromo: 'R$19,90' }, // value:19.90 = cobra; cobrança ativa
  pro:    { value: 29.90, label: 'R$29,90' },
};

// ===== CHECKOUT =====
const plans = {
  avulso: {
    icon: '📄', name: 'Análise Avulsa', desc: '1 análise completa por extrato + relatório PDF',
    price: PRICES.avulso.label, period: 'uso único · 30 min de acesso',
    successMsg: 'Sua análise avulsa está ativa! Acesse "Extrato" no menu para fazer o upload e ver os resultados.'
  },
  pro: {
    icon: '🛡️', name: 'Plano Pro', desc: 'Análises ilimitadas + múltiplos extratos + histórico',
    price: PRICES.pro.label, period: '/mês',
    successMsg: 'Bem-vindo ao Pro! Acesso completo liberado — análises ilimitadas e múltiplos extratos disponíveis agora.'
  }
};

let currentPlan = 'pro';

// Injeta PRICES em todos os elementos HTML que exibem preço.
// Chamada no DOMContentLoaded — fonte única de verdade para qualquer alteração futura.
function _initPrices() {
  const pr = PRICES.pro.label;
  // Avulso: preço riscado + "Gratuito" em destaque
  const avHtml = PRICES.avulso.label;
  ['splitAvulsoPrice1','splitAvulsoPrice2','paywallAvulsoPrice','planAvulsoCta']
    .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = avHtml; });
  ['splitProPrice1','splitProPrice2','planProPrice']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = pr; });
}
document.addEventListener('DOMContentLoaded', _initPrices);


// ===== PRO FREE MODE FUNCTIONS =====
const PRO_FREE_MODE = false; // avulso é gratuito, pro cobra R$29,90

function showProFreeBanner() {
  showPage('planos');
  setTimeout(() => {
    const banner = document.getElementById('proFreeBanner');
    if (banner) { banner.style.display = 'block'; banner.scrollIntoView({behavior:'smooth',block:'start'}); }
  }, 150);
}

function initProFreeMode() {
  if (!PRO_FREE_MODE) {
    // Modo pago — garantir que todos os textos refletem o preço real
    const btnPro = document.querySelector('.btn-plan-pro span');
    if (btnPro) btnPro.textContent = 'Assinar Pro — R$29,90/mês →';
    const btnProEl = document.getElementById('btnProText');
    if (btnProEl) btnProEl.textContent = 'Assinar Pro — R$29,90/mês →';
    const pwPro = document.getElementById('paywallProText');
    if (pwPro) pwPro.textContent = 'Acessar Pro — R$29,90/mês';
    const ucPro = document.getElementById('ucProText');
    if (ucPro) ucPro.textContent = 'Acessar Pro — R$29,90/mês';
    const popular = document.getElementById('planProBadge');
    if (popular) popular.textContent = '⭐ MELHOR CUSTO-BENEFÍCIO';
    return;
  }
  // Banner na página de planos
  const plansWrap = document.querySelector('#page-planos .plans-page');
  if (plansWrap && !document.getElementById('proFreeBanner')) {
    const banner = document.createElement('div');
    banner.id = 'proFreeBanner';
    banner.style.cssText = 'display:none;background:linear-gradient(135deg,rgba(0,217,110,0.1),rgba(0,150,100,0.06));border:1px solid rgba(0,217,110,0.3);border-radius:14px;padding:18px 20px;margin-bottom:24px;text-align:center';
    banner.innerHTML = '<div style="font-family:var(--ff);font-size:14px;font-weight:700;color:#7CFF4F;margin-bottom:5px">🎉 Período de Lançamento — Pro Gratuito</div><div style="font-size:12px;color:var(--muted2);line-height:1.6">Durante o lançamento todos os recursos Pro estão liberados gratuitamente.<br>Aproveite e nos dê seu feedback!</div>';
    plansWrap.insertBefore(banner, plansWrap.firstChild);
  }
  // Atualiza badge aba extrato
  const badge = document.getElementById('extratoTabBadge');
  if (badge) { badge.textContent = 'PRO GRÁTIS'; badge.className = 'tbadge tbadge-green'; }
  // Atualiza botão Pro na página de planos
  const btnPro = document.querySelector('.btn-plan-pro');
  if (btnPro) btnPro.innerHTML = '🎉 Acessar Pro — R$29,90/mês →';
  // Atualiza destaque popular
  const popular = document.getElementById('planProBadge');
  if (popular) popular.textContent = '🎉 GRATUITO AGORA';
  // Atualiza preço
  const planVal = document.querySelector('.plan-card.featured .plan-value');
  if (planVal) { planVal.textContent = 'R$0'; planVal.style.color = '#7CFF4F'; }
  const planPeriod = document.querySelector('.plan-card.featured .plan-period');
  if (planPeriod) planPeriod.textContent = 'durante o lançamento';
  // Atualiza cards upgrade no resultado
  const ucPro = document.getElementById('ucProText');
  if (ucPro) ucPro.textContent = 'Acessar Pro — R$29,90/mês';
  // Atualiza paywall
  const pwPro = document.getElementById('paywallProText');
  if (pwPro) pwPro.textContent = 'Acessar Pro — R$29,90/mês';
}

async function openCheckout(plan) {
  // Pixel — checkout iniciado
  if(typeof fbq==='function' && window.PIXEL_ATIVO) {
    fbq('trackCustom','CheckoutStarted',{plan},{ eventID: Date.now().toString() });
    fbq('track','InitiateCheckout',{ content_name:'plano_'+plan, currency:'BRL', value: plan==='pro'?29.90:0 },{ eventID:'ic_'+Date.now().toString() });
  }
  if(typeof clarity==='function') clarity('event','CheckoutStarted');
  // Se usuário já tem plano ativo — verifica no banco e vai direto para análise
  if (_currentUser && sb) {
    let data = null;
    try { const res = await sb.from('profiles').select('plano').eq('id', _currentUser.id).single(); data = res.data; } catch(e) { data = null; }
    const planoAtual = data?.plano;
    if (planoAtual) _currentUser._plano = planoAtual;
    if (planoAtual === 'pro' || (planoAtual === 'avulso' && plan === 'avulso')) {
      if (_eConsolidated) { eUnlockResult(); return; }
      showPage('extrato'); return;
    }
  }

  // MODO PRO GRATUITO — bypass só para o plano Pro, nunca para avulso
  if (PRO_FREE_MODE && plan !== 'avulso') {
    if (_eConsolidated) {
      // já tem análise feita — desbloqueia resultado direto
      closeCheckoutDirect();
      eUnlockResult();
    } else {
      // leva para page-extrato
      showPage('extrato');
      setTimeout(() => {
        const step2 = document.getElementById('extStep2');
        if (step2) step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
    return;
  }

  currentPlan = plan;
  const p = plans[plan];

  // resumo do plano
  // [fix-xss] sanitize por defense-in-depth mesmo sendo dados hardcoded
  const _os = document.getElementById('orderSummary');
  if (_os) {
    _os.innerHTML = `
    <div class="os-icon">${sanitize(p.icon||'')}</div>
    <div class="os-info">
      <div class="os-name">${sanitize(p.name||'')}</div>
      <div class="os-desc">${sanitize(p.desc||'')}</div>
    </div>
    <div class="os-price">${sanitize(p.price||'')}<span style="font-size:11px;color:var(--muted);font-family:var(--ff);font-weight:400"> ${sanitize(p.period||'')}</span></div>
  `;
  }

  // Se já está logado, pula step 1 e vai direto para pagamento
  if (_currentUser) {
    setCheckoutStep(2);
  } else {
    setCheckoutStep(1);
  }
  closeAllOverlays();
  document.getElementById('checkoutOverlay').classList.add('show');
  document.getElementById('checkoutModal').scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

// ── MERCADO PAGO — PUBLIC KEY ─────────────────────────────────
const MP_PUBLIC_KEY = 'APP_USR-60e9c4f7-757b-48da-a367-8b3785a4cf72';
let _mpInstance = null;
let _mpBrick    = null;

function getMpInstance() {
  if (!_mpInstance) _mpInstance = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
  return _mpInstance;
}

// ── Troca entre aba Cartão e Pix/Boleto ──────────────────────
function switchPayTab(tab) {
  const paneCartao = document.getElementById('payPaneCartao');
  const paneOutros = document.getElementById('payPaneOutros');
  const tabC = document.getElementById('tabCartao');
  const tabO = document.getElementById('tabOutros');

  if (tab === 'cartao') {
    paneCartao.style.display = 'block';
    paneOutros.style.display = 'none';
    tabC.style.background = 'var(--surface)';
    tabC.style.color      = 'var(--text)';
    tabO.style.background = 'transparent';
    tabO.style.color      = 'var(--muted)';
    // Inicializa o Brick se ainda não foi iniciado
    if (!_mpBrick) initMpBrick();
  } else {
    paneCartao.style.display = 'none';
    paneOutros.style.display = 'block';
    tabC.style.background = 'transparent';
    tabC.style.color      = 'var(--muted)';
    tabO.style.background = 'var(--surface)';
    tabO.style.color      = 'var(--text)';
  }
}

// ── Inicializa o MP Card Payment Brick ───────────────────────
async function initMpBrick() {
  const container = document.getElementById('mpBrickContainer');
  if (!container) return;

  // Verifica se está no domínio de produção
  const isProd = window.location.hostname === 'oguardiaofiscal.com.br' ||
                 window.location.hostname === 'www.oguardiaofiscal.com.br';

  if (!isProd) {
    container.innerHTML = `
      <div style="text-align:center;padding:24px 16px">
        <div style="font-size:13px;color:var(--muted2);margin-bottom:16px;line-height:1.6">
          O formulário de cartão está disponível apenas no site oficial.<br>
          <strong style="color:var(--text)">oguardiaofiscal.com.br</strong>
        </div>
        <button onclick="switchPayTab('outros')" style="padding:10px 20px;background:var(--green);border:none;border-radius:8px;color:#000;font-family:var(--ff);font-size:13px;font-weight:700;cursor:pointer">Usar Pix ou Boleto →</button>
      </div>`;
    return;
  }

  container.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:13px">Carregando formulário de pagamento...</div>';

  // Verifica se SDK carregou (flag definida logo após o script no head)

  if (typeof MercadoPago === 'undefined') {
    container.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:13px">Carregando formulário de pagamento...</div>';

    // Se o preload do requestIdleCallback já está em andamento, espera até 5s
    if (window._mpSDKPreloading) {
      await new Promise((resolve) => {
        const poll = setInterval(() => {
          if (typeof MercadoPago !== 'undefined' || !window._mpSDKPreloading) {
            clearInterval(poll);
            resolve();
          }
        }, 100);
        setTimeout(() => { clearInterval(poll); resolve(); }, 5000);
      });
    }

    // Se ainda não carregou, carrega agora
    if (typeof MercadoPago === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.onload  = () => resolve();
        script.onerror = (e) => { console.error('[MP SDK] falha ao carregar:', e); reject(new Error('Não foi possível carregar o SDK do Mercado Pago. Tente desativar extensões do navegador (ex: ad blocker) e recarregue a página.')); };
        document.head.appendChild(script);
      }).catch(err => {
        showBrickFallback(container, err.message);
        return null;
      });
    }

    if (typeof MercadoPago === 'undefined') {
      showBrickFallback(container, 'SDK bloqueado. Desative extensões como ad blocker e tente novamente, ou use Pix/Boleto.');
      return;
    }
  }

  try {
    const mp = getMpInstance();
    const bricksBuilder = mp.bricks();
    const amountVal = PRICES[currentPlan]?.value ?? PRICES.avulso.value;

    // Timeout de segurança — se o Brick não renderizar em 15s, mostra fallback
    const brickTimeout = setTimeout(() => {
      if (container && container.innerHTML.includes('Carregando')) {
        console.warn('[MP Brick] timeout — renderização não completou');
        showBrickFallback(container, 'Tempo limite excedido ao carregar o formulário.');
      }
    }, 15000);

    _mpBrick = await bricksBuilder.create('cardPayment', 'mpBrickContainer', {
      initialization: {
        amount: amountVal,
        payer: { email: _currentUser?.email || '' },
      },
      customization: {
        visual: {
          style: { theme: 'dark' },
          hideFormTitle: true,
          hidePaymentButton: false,
        },
        paymentMethods: {
          maxInstallments: currentPlan === 'pro' ? 1 : 3,
        },
      },
      callbacks: {
        onReady: () => {
          clearTimeout(brickTimeout);
        },
        onSubmit: async (cardData) => {
          clearTimeout(brickTimeout);
          await processCardPayment(cardData);
        },
        onError: (err) => {
          clearTimeout(brickTimeout);
          console.error('[MP Brick onError]', JSON.stringify(err));
          const cause = err?.cause?.[0]?.description || err?.message || JSON.stringify(err);
          showBrickFallback(container, cause);
        },
      },
    });
  } catch (e) {
    console.error('[MP Brick catch]', e);
    showBrickFallback(container, e?.message || String(e));
  }
}

function showBrickFallback(container, msg) {
  if (!container) return;
  container.innerHTML = `
    <div style="text-align:center;padding:20px;font-size:13px">
      <div style="color:var(--red);margin-bottom:8px;font-weight:600">Não foi possível carregar o formulário de cartão.</div>
      <div style="color:var(--muted);font-size:11px;margin-bottom:16px;line-height:1.5">${msg || 'Erro desconhecido'}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="_mpBrick=null;initMpBrick()" style="padding:10px 20px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--ff);font-size:13px;font-weight:600;cursor:pointer">🔄 Tentar novamente</button>
        <button onclick="switchPayTab('outros')" style="padding:10px 20px;background:var(--green);border:none;border-radius:8px;color:#000;font-family:var(--ff);font-size:13px;font-weight:700;cursor:pointer">Usar Pix ou Boleto →</button>
      </div>
    </div>`;
}

// ── Processa pagamento por cartão via Edge Function ───────────
// ── UI de assinatura Pro (preapproval) ───────────────────────
function _initProSubscriptionUI() {
  const container = document.getElementById('mpBrickContainer');
  if (!container) return;
  if (_mpBrick) { try { _mpBrick.unmount(); } catch(e) {} _mpBrick = null; }

  container.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:14px;padding:22px 20px;text-align:center">
      <div style="font-size:13px;color:var(--muted2);line-height:1.9;margin-bottom:18px">
        💳 <strong style="color:var(--text)">Cartão de crédito</strong> — cobrança automática mensal<br>
        <span style="font-size:11px;color:var(--muted)">Você será redirecionado para autorizar a assinatura no Mercado Pago</span>
      </div>
      <div id="mpProErr" style="display:none;color:var(--red);font-size:12px;margin-bottom:12px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;padding:10px"></div>
      <button class="btn-pay" id="btnProSubscribe" onclick="startProSubscription()" style="margin-bottom:0">
        <span id="btnProSubTxt">Assinar Pro — R$29,90/mês →</span>
      </button>
      <div style="font-size:11px;color:var(--muted);margin-top:10px">⚠️ Você será redirecionado para autorizar a cobrança recorrente</div>
    </div>`;
}

async function startProSubscription() {
  const btn = document.getElementById('btnProSubTxt');
  const errEl = document.getElementById('mpProErr');
  if (errEl) errEl.style.display = 'none';
  if (btn) btn.textContent = 'Gerando link da assinatura...';
  document.getElementById('btnProSubscribe').disabled = true;

  // Abre janela antes do await (desktop) — mobile usa location.href
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const newWin = !isMobile ? window.open('', '_blank') : null;

  try {
    if (!sb) throw new Error('Serviço indisponível. Recarregue a página.');
    const { data: { session }, error: sessErr } = await sb.auth.getSession();
    if (sessErr || !session) throw new Error('Sessão expirada. Faça login novamente.');

    const res = await fetch(`${SUPA_URL}/functions/v1/create-mp-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan: 'pro' }),
    });

    if (!res.ok) {
      let errMsg = `Erro ${res.status}`;
      try { const j = await res.json(); errMsg = j.error || errMsg; } catch(_) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    const url = data.init_point;
    if (!url || !url.startsWith('https://www.mercadopago.com') && !url.startsWith('https://mercadopago.com')) throw new Error('Link de assinatura inválido. Tente novamente.');

    if (newWin) {
      newWin.location.href = url;
      if (btn) btn.textContent = 'Prosseguir no Mercado Pago →';
      document.getElementById('btnProSubscribe').disabled = false;
    } else {
      // Mobile: substitui onclick com URL gerada
      if (btn) btn.textContent = 'Prosseguir no Mercado Pago →';
      const btnEl = document.getElementById('btnProSubscribe');
      btnEl.disabled = false;
      btnEl.onclick = function() { window.location.href = url; };
      if (errEl) {
        errEl.style.cssText = 'display:block;background:rgba(255,77,79,0.08);border:1px solid rgba(255,77,79,0.2);border-radius:8px;padding:10px;font-size:12px;color:var(--muted2);margin-bottom:12px';
        errEl.innerHTML = '✅ Link gerado! Clique em <strong>Prosseguir no Mercado Pago</strong> para continuar.';
      }
    }
  } catch(e) {
    if (newWin) newWin.close();
    if (errEl) { errEl.textContent = e.message || 'Erro inesperado.'; errEl.style.display = 'block'; }
    if (btn) btn.textContent = 'Assinar Pro — R$29,90/mês →';
    document.getElementById('btnProSubscribe').disabled = false;
  }
}

async function processCardPayment(cardData) {
  const errEl = document.getElementById('mpPayErr');
  if (errEl) errEl.style.display = 'none';

  try {
    if (!sb) throw new Error('Serviço de autenticação indisponível.');
    const { data: { session }, error: sessErr } = await sb.auth.getSession();
    if (sessErr || !session) throw new Error('Sessão expirada. Faça login novamente.');

    const res = await fetch(
      `${SUPA_URL}/functions/v1/create-mp-preference`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plan: currentPlan,
          paymentMethod: 'card',
          cardData,
        }),
      }
    );

    if (!res.ok) {
      let errMsg = `Erro ${res.status}`;
      try { const j = await res.json(); errMsg = j.error || errMsg; } catch(_) {}
      throw new Error(errMsg);
    }

    const data = await res.json();

    if (data.status === 'approved') {
      // Pagamento aprovado — mostrar sucesso
      if (_mpBrick) { try { _mpBrick.unmount(); } catch(e) { console.warn('[MP Brick] unmount:', e.message); } _mpBrick = null; }
      showCheckoutSuccess();
    } else if (data.status === 'in_process' || data.status === 'pending') {
      if (_mpBrick) { try { _mpBrick.unmount(); } catch(e) { console.warn('[MP Brick] unmount:', e.message); } _mpBrick = null; }
      document.getElementById('stepPay').querySelector('.modal-title').textContent = 'Pagamento em análise';
      document.getElementById('stepPay').querySelector('.modal-sub').textContent = 'Seu pagamento está sendo processado. Assim que aprovado você receberá acesso por e-mail.';
    } else if (data.init_point) {
      // Fallback: redireciona para MP se a Edge Function retornar init_point
      window.location.href = data.init_point;
    } else {
      throw new Error(data.error || 'Pagamento não aprovado. Verifique os dados do cartão.');
    }
  } catch (e) {
    if (errEl) {
      errEl.textContent = e.message || 'Erro ao processar pagamento. Tente novamente.';
      errEl.style.display = 'block';
    }
  }
}

function showCheckoutSuccess() {
  setCheckoutStep(3);
  const plan = plans[currentPlan];
  document.getElementById('successMsg').textContent =
    `Seu acesso ao ${plan.name} foi ativado. Pode fechar este painel e usar a análise.`;
  // Pixel — Purchase (cartão aprovado)
  if(typeof fbq==='function' && window.PIXEL_ATIVO) {
    const valor = currentPlan==='pro' ? 29.90 : (PRICES?.avulso?.value ?? 19.90);
    fbq('track','Purchase',{ value: valor, currency:'BRL', content_name:'plano_'+currentPlan },{ eventID:'purchase_'+Date.now().toString() });
  }
  if (_eConsolidated) setTimeout(() => { closeCheckoutDirect(); eUnlockResult(); }, 2000);
}

// ── Destroy brick ao fechar modal ────────────────────────────
function closeCheckoutDirect() {
  if (_mpBrick) { try { _mpBrick.unmount(); } catch(e) { console.warn('[MP Brick] unmount:', e.message); } _mpBrick = null; }
  const el = document.getElementById('checkoutOverlay');
  if (el) el.classList.remove('show');
  document.body.style.overflow = '';
}

// ── setCheckoutStep: inicializa tab cartão quando vai para step 2 ──
// ── setCheckoutStep: gerencia steps do modal + init do Brick ──

function setCheckoutStep(n) {
  ['stepAccount','stepPay','stepSuccess'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', i + 1 === n);
  });
  ['csn1','csn2','csn3'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', i + 1 <= n);
  });
  // Quando entra no step 2, inicializa a aba cartão
  if (n === 2) {
    setTimeout(() => {
      switchPayTab('cartao');
      // Pro = apenas cartão (Pix não é recorrente)
      const tabOutros = document.getElementById('tabOutros');
      const payPaneOutros = document.getElementById('payPaneOutros');
      if (currentPlan === 'pro') {
        if (tabOutros) tabOutros.style.display = 'none';
        if (payPaneOutros) payPaneOutros.style.display = 'none';
        // Pro: mostra botão de assinatura em vez do Brick
        _initProSubscriptionUI();
      } else {
        if (tabOutros) tabOutros.style.display = '';
        // Avulso: inicializa Brick normalmente
        if (!_mpBrick) initMpBrick();
      }
    }, 100);
  }
}

// ── MERCADO PAGO — CHECKOUT PRO (Pix/Boleto redirect) ────────
async function goToMercadoPago() {
  const btn = document.getElementById('btnMpTxt');
  const errEl = document.getElementById('mpPayErrOutros');
  if (errEl) errEl.style.display = 'none';
  if (btn) btn.textContent = 'Gerando link de pagamento...';
  document.getElementById('btnMpPay').disabled = true;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Desktop com SDK MP ativo: abre aba em branco antes do await
  // Mobile: não usa window.open (browsers bloqueiam/suspendem aba em branco)
  const newWin = (!isMobile) ? window.open('', '_blank') : null;

  try {
    if (!sb) throw new Error('Serviço de autenticação indisponível. Recarregue a página.');
    const { data: { session }, error: sessErr } = await sb.auth.getSession();
    if (sessErr) throw new Error('Erro de autenticação. Faça login novamente.');
    if (!session) throw new Error('Sessão expirada. Faça login novamente.');

    let res;
    try {
      res = await fetch(
        `${SUPA_URL}/functions/v1/create-mp-preference`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan: currentPlan }),
        }
      );
    } catch (networkErr) {
      throw new Error('Não foi possível conectar ao servidor de pagamento. Verifique sua conexão e tente novamente.');
    }

    if (!res.ok) {
      let errMsg = `Erro ${res.status}`;
      try { const j = await res.json(); errMsg = j.error || errMsg; } catch(_) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    const url = data.init_point || data.sandbox_url;
    const _urlOk = url && (url.startsWith('https://www.mercadopago.com') || url.startsWith('https://mercadopago.com') || url.startsWith('https://sandbox.mercadopago.com'));
    if (!_urlOk) throw new Error('Link de pagamento inválido. Tente novamente.');

    // Desktop e mobile: substitui onclick com URL gerada — clique humano escapa do SDK do MP
    if (newWin) newWin.close(); // fecha aba em branco se abriu
    if (btn) btn.textContent = 'Prosseguir no Mercado Pago →';
    const btnEl = document.getElementById('btnMpPay');
    btnEl.disabled = false;
    btnEl.onclick = function() { window.open(url, '_blank') || (window.location.href = url); };
    if (errEl) {
      errEl.style.cssText = 'display:block;background:rgba(255,77,79,0.08);border:1px solid rgba(255,77,79,0.2);border-radius:8px;padding:10px;font-size:12px;color:var(--muted2);margin-bottom:12px';
      errEl.innerHTML = '✅ Link gerado! Clique em <strong>Prosseguir no Mercado Pago</strong> para continuar.';
    }

  } catch (e) {
    if (newWin) newWin.close();
    if (errEl) { errEl.textContent = e.message || 'Erro inesperado. Tente novamente.'; errEl.style.display = 'block'; }
    if (btn) btn.textContent = 'Ir para o pagamento →';
    document.getElementById('btnMpPay').disabled = false;
  }
}

// Chamada no DOMContentLoaded — trata retorno do MP via query string
async function handleMpReturn() {
  const params = new URLSearchParams(window.location.search);
  const mp = params.get('mp');
  if (!mp) return;

  // Limpa a query string da URL sem reload
  try { history.replaceState({}, '', window.location.pathname); } catch(e) {}

  if (mp === 'success') {
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    // Retry até 5x com 1.2s de intervalo — webhook pode demorar alguns segundos
    let planoAtualizado = null;
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 1200));
      const { data: profile } = await sb
        .from('profiles')
        .select('plano')
        .eq('id', session.user.id)
        .single();
      if (profile?.plano && profile.plano !== 'free') {
        planoAtualizado = profile.plano;
        break;
      }
    }

    const planKey = planoAtualizado ?? 'pro';
    currentPlan = planKey === 'avulso' ? 'avulso' : 'pro';
    if (_currentUser) _currentUser._plano = planKey;

    setCheckoutStep(3);
    document.getElementById('successMsg').textContent =
      plans[currentPlan]?.successMsg ?? 'Pagamento confirmado! Seu acesso está liberado.';
    document.getElementById('checkoutOverlay').classList.add('show');

    if(typeof fbq==='function' && window.PIXEL_ATIVO) {
      const valor = currentPlan==='pro' ? 29.90 : PRICES?.avulso?.value ?? 34.90;
      fbq('track','Purchase',{ value: valor, currency:'BRL', content_name:'plano_'+currentPlan },{ eventID:'purchase_mp_'+Date.now().toString() });
    }
    if (_eConsolidated) {
      setTimeout(() => { closeCheckoutDirect(); eUnlockResult(); }, 1500);
    }
  } else if (mp === 'failure') {
    // Mostra modal de erro de pagamento
    openCheckout(currentPlan || 'pro');
    setTimeout(() => {
      const errEl = document.getElementById('mpPayErr');
      if (errEl) {
        errEl.textContent = 'Pagamento não aprovado. Tente novamente ou escolha outra forma de pagamento.';
        errEl.style.display = 'block';
        setCheckoutStep(2);
      }
    }, 100);
  }
  // pending: não faz nada, usuário verá o acesso liberado quando webhook chegar
}

// ──────────────────────────────────────────────────────────────────────────

// setCheckoutStep: definida acima com suporte a MP Bricks

async function goToPay() {
  const name = document.getElementById('coName').value.trim();
  const email = document.getElementById('coEmail').value.trim();
  const senha = document.getElementById('coSenha').value;
  const senha2 = document.getElementById('coSenha2').value;

  if (!name) { shake('coName'); return; }
  if (!email.includes('@')) { shake('coEmail'); return; }
  if (senha.length < 8) { shake('coSenha'); return; }
  const pwCheck = checkPasswordStrength(senha);
  if (!pwCheck.strong) { shake('coSenha'); return; }
  if (senha !== senha2) { shake('coSenha2'); return; }

  // Cria conta no Supabase se ainda não logado
  if (!_currentUser) {
    const btn = document.querySelector('#stepAccount .btn-pay');
    if (btn) btn.textContent = 'Criando conta...';
    if (!sb) { shake('coEmail'); return; }
    const { error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome: name } } });
    if (btn) btn.textContent = 'Continuar para pagamento →';
    if (error && !error.message.includes('already registered')) {
      shake('coEmail'); return;
    }
  }

  setCheckoutStep(2);
  document.getElementById('checkoutModal').scrollTop = 0;
}

function goToAccount() {
  // Se já está logado, fechar o modal em vez de voltar para cadastro
  if (_currentUser) {
    closeCheckoutDirect();
  } else {
    setCheckoutStep(1);
    document.getElementById('checkoutModal').scrollTop = 0;
  }
}

function goToSuccess() {
  setCheckoutStep(3);
  document.getElementById('successMsg').textContent = plans[currentPlan].successMsg;
  document.getElementById('checkoutModal').scrollTop = 0;
  // se veio do fluxo de extrato, desbloqueia o resultado após pagamento
  if(_eConsolidated) {
    setTimeout(() => { closeCheckoutDirect(); eUnlockResult(); }, 1200);
  }
}

function shake(id) {
  const el = document.getElementById(id);
  el.style.borderColor = 'rgba(255,71,87,0.6)';
  el.style.animation = 'shake 0.3s ease';
  setTimeout(() => { el.style.borderColor = ''; el.style.animation = ''; }, 600);
}

// ── Fecha todos os overlays ativos (mutex) ──
function closeCheckout(e) {
  if (e.target === document.getElementById('checkoutOverlay')) closeCheckoutDirect();
}
// closeCheckoutDirect: definida acima com unmount do Brick

// switchPtab, formatCard, formatExpiry, copyPixKey removidos — checkout delegado ao Mercado Pago

// ╔══════════════════════════════════════════════════╗
// ║         MÓDULO DE SEGURANÇA — GUARDIÃO FISCAL   ║
// ╚══════════════════════════════════════════════════╝

// ── Rate limiter de autenticação (anti brute-force) ──
const _authAttempts = {};
function authRateLimit(email) {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  if (!_authAttempts[key]) _authAttempts[key] = { count: 0, first: now, blocked: false };
  const a = _authAttempts[key];
  // Reset janela de 15 min
  if (now - a.first > 15 * 60 * 1000) { a.count = 0; a.first = now; a.blocked = false; }
  a.count++;
  if (a.count > 5) {
    a.blocked = true;
    const wait = Math.ceil((15 * 60 * 1000 - (now - a.first)) / 60000);
    return `Muitas tentativas. Aguarde ~${wait} min.`;
  }
  return null;
}
function authSuccess(email) {
  const key = email.toLowerCase().trim();
  delete _authAttempts[key];
}

// ── Validação de magic bytes (PDF real vs PDF falso) ──
async function validatePDFMagicBytes(buffer) {
  const bytes = new Uint8Array(buffer.slice(0, 5));
  const magic = String.fromCharCode(...bytes);
  if (!magic.startsWith('%PDF-')) throw new Error('Arquivo corrompido ou não é um PDF real.');
  return true;
}

// ── Sanitização de conteúdo de texto de extrato ──
// Remove scripts, tags HTML e caracteres de controle do conteúdo dos arquivos
// ── sanitize — escapa HTML para evitar XSS em innerHTML ──
function sanitize(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFileContent(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, '')  // remove blocos script
    .replace(/<[^>]{0,200}>/g, '')                // remove tags HTML (limite 200 chars para evitar ReDoS)
    .replace(/javascript:/gi, '')                 // remove JS URI
    .replace(/data:text\/html/gi, '')             // remove data URIs perigosos
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove control chars exceto \t \n \r
    .replace(/(^|[\n,\t])([=+\-@])/g, '$1\'$2'); // [fix-csv-injection] neutraliza formulas CSV
}

// ── Limite de tamanho de texto processado (anti DoS) ──
const MAX_TEXT_CHARS = 2_000_000; // 2MB de texto

// ── Validação de nome de arquivo ──
function validateFileName(name) {
  // Bloqueia path traversal e nomes suspeitos
  if (!name || typeof name !== 'string') return false;
  // [fix] Null bytes e caracteres de controle (< 0x20 exceto espaço)
  if (/[\x00-\x1F\x7F]/.test(name)) return false;
  if (/[\/\\:*?"<>|]/.test(name)) return false;
  if (name.startsWith('.')) return false;
  if (name.length > 200) return false;
  return true;
}

// ── Input length caps em todos os campos de auth ──
const AUTH_INPUT_LIMITS = { email: 254, nome: 80, senha: 128 };
function capAuthInput(value, type) {
  return String(value).slice(0, AUTH_INPUT_LIMITS[type] || 128);
}


const SUPA_URL  = 'https://nnhbxyuggmcemqwzdxbg.supabase.co';
const SUPA_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaGJ4eXVnZ21jZW1xd3pkeGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTc1NDQsImV4cCI6MjA5NDMzMzU0NH0.0KMETdyHYs0NR8qQKp2KZeSnp5Al58JVDrSGDJEG_WQ';

let sb = null;
let _currentUser = null;

// Inicializa Supabase com guard — se CDN falhar, UI continua funcionando
function _initSupabase() {
  try {
    if (typeof supabase === 'undefined') { console.warn('[GuardiaoFiscal] Supabase CDN não carregou'); return; }
    const { createClient } = supabase;
    sb = createClient(SUPA_URL, SUPA_KEY);
  } catch(e) {
    console.warn('[GuardiaoFiscal] Supabase não disponível:', e.message);
  }
}
// Popula navAuthArea imediatamente para evitar flash de UI vazia
setUser(null);

// Inicializa sessão ao carregar — aguarda Supabase se carregando async
async function _initSession() {
  if (!sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) setUser(session.user);
    sb.auth.onAuthStateChange((_event, session) => {
      setUser(session ? session.user : null);
      if (session) closeAllOverlays();
    });
    handleMpReturn();
  } catch(e) {
    console.warn('[GuardiaoFiscal] Erro ao inicializar sessao:', e.message);
  }
}

// Ponto único de inicialização — evita instância dupla do GoTrueClient
function _bootSupabase() {
  _initSupabase();
  _initSession();
}

if (typeof supabase !== 'undefined') {
  _bootSupabase();
} else {
  // Supabase está em modo lazy — aguarda o loader sinalizarthrough a queue
  window._supabaseQueue = window._supabaseQueue || [];
  window._supabaseQueue.push(_bootSupabase);
}

function setUser(user) {
  _currentUser = user;
  const area = document.getElementById('navAuthArea');

  // Busca plano do banco quando usuário loga
  if (user && sb) {
    sb.from('profiles')
      .select('plano, expires_at')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const plano = data.plano;
        const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
        const isExpired = expiresAt && expiresAt < new Date();
        // Se tem plano ativo e não expirou — libera acesso direto
        if ((plano === 'pro' || plano === 'avulso') && !isExpired) {
          _currentUser._plano = plano;
          // Se já tem análise feita e está no extrato — desbloqueia resultado
          if (_eConsolidated) eUnlockResult();
        }
      })
      .catch(() => {});
  }
  if (user) {
    const rawName = user.user_metadata?.nome || user.email.split('@')[0];
    const firstName = rawName.split(' ')[0]; // só primeiro nome
    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-size:13px;color:var(--muted2);font-family:var(--ff);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:none';
    nameEl.id = 'navUserName';
    nameEl.textContent = firstName;
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'nav-btn-login';
    logoutBtn.style.cssText = 'background:rgba(255,77,79,0.08);border-color:rgba(255,77,79,0.2);color:var(--red);font-size:12px;padding:7px 14px';
    logoutBtn.textContent = 'Sair';
    logoutBtn.onclick = doLogout;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px';
    wrap.appendChild(nameEl);
    wrap.appendChild(logoutBtn);
    area.innerHTML = '';
    area.appendChild(wrap);
    // Drawer auth — mostra nome + sair
    const da2 = document.getElementById('drawerAuthArea');
    if (da2) {
      da2.innerHTML = '';
      const drawerName = document.createElement('div');
      drawerName.style.cssText = 'font-size:13px;color:var(--muted2);padding:8px 16px;font-family:var(--ff)';
      drawerName.textContent = firstName;
      const drawerLogout = document.createElement('button');
      drawerLogout.className = 'nav-drawer-link';
      drawerLogout.style.cssText = 'color:var(--red)';
      drawerLogout.textContent = '← Sair da conta';
      drawerLogout.onclick = () => { doLogout(); closeDrawer(); };
      da2.appendChild(drawerName);
      da2.appendChild(drawerLogout);
    }
    // Mostra nome só em telas maiores — listener único (sem leak)
    if (window.innerWidth >= 480) nameEl.style.display = 'block';
    if (!window._navResizeListenerSet) {
      window._navResizeListenerSet = true;
      window.addEventListener('resize', () => {
        const el = document.getElementById('navUserName');
        if (el) el.style.display = window.innerWidth >= 480 ? 'block' : 'none';
      }, { passive: true });
    }
    autoSkipExtStep1(user.email);
    // Mostrar item histórico no menu
    const nh = document.getElementById('navHistorico');
    const dh = document.getElementById('drawerHistorico');
    if (nh) nh.style.display = 'inline-block';
    if (dh) dh.style.display = 'block';
  } else {
    area.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'nav-btn-login';
    btn.textContent = 'Entrar';
    btn.onclick = openLogin;
    area.appendChild(btn);
    // Drawer auth
    const da = document.getElementById('drawerAuthArea');
    if (da) da.innerHTML = '<button class="nav-btn-login" style="width:100%;text-align:center;padding:12px" onclick="openLogin();closeDrawer()">Entrar</button>';
    // Ocultar item histórico no menu
    const _nh = document.getElementById('navHistorico');
    const _dh = document.getElementById('drawerHistorico');
    if (_nh) _nh.style.display = 'none';
    if (_dh) _dh.style.display = 'none';
  }
}

function sanitizeText(str) {
  return String(str).replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;','&':'&amp;'}[c]));
}

function autoSkipExtStep1(email) {
  const run = () => {
    const s1 = document.getElementById('extStep1');
    if (!s1) return;
    // Oculta o Step 1 completamente após login
    s1.style.display = 'none';
    const s2 = document.getElementById('extStep2');
    if (s2) { s2.style.opacity = '1'; s2.style.pointerEvents = 'auto'; }
    const s2num = document.getElementById('s2num');
    if (s2num) { s2num.classList.remove('locked'); }
    // Retoma análise pendente se o usuário clicou Analisar antes de logar
    if (window._pendingAnalysis) {
      window._pendingAnalysis = false;
      setTimeout(() => eRunAll(), 300);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    setTimeout(run, 0);
  }
}

async function doLogout() {
  if (!sb) return;
  await sb.auth.signOut();
}

// ===== LOGIN MODAL =====
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('authLoginPane').style.display   = isLogin ? 'block' : 'none';
  document.getElementById('authCadastroPane').style.display = isLogin ? 'none' : 'block';
  document.getElementById('tabLoginBtn').style.background   = isLogin ? 'var(--surface)' : 'transparent';
  document.getElementById('tabLoginBtn').style.color        = isLogin ? 'var(--text)' : 'var(--muted)';
  document.getElementById('tabCadastroBtn').style.background = isLogin ? 'transparent' : 'var(--surface)';
  document.getElementById('tabCadastroBtn').style.color      = isLogin ? 'var(--muted)' : 'var(--text)';
}

// Abre login preservando o plano pendente no checkout
let _checkoutPendingPlan = null;
function openLoginFromCheckout() {
  _checkoutPendingPlan = currentPlan || 'pro';
  closeCheckoutDirect();
  openLogin();
}

async function doLogin() {
  const email = capAuthInput(document.getElementById('loginEmail').value.trim(), 'email');
  const senha  = capAuthInput(document.getElementById('loginSenha').value, 'senha');
  const err    = document.getElementById('loginErr');
  const btn    = document.getElementById('loginBtnTxt');
  err.style.display = 'none';
  if (!email.includes('@') || senha.length < 6) { err.textContent='E-mail ou senha inválidos.'; err.style.display='block'; return; }
  const blocked = authRateLimit(email);
  if (blocked) { err.textContent = blocked; err.style.display='block'; return; }
  btn.textContent = 'Entrando...';
  if (!sb) { err.textContent = 'Serviço indisponível. Tente novamente.'; err.style.display='block'; return; }
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  btn.textContent = 'Entrar →';
  if (error) { err.textContent = traduzErro(error.message); err.style.display='block'; return; }
  authSuccess(email);
  closeLoginDirect();
  // Retoma checkout se veio de openLoginFromCheckout
  if (_checkoutPendingPlan) {
    const plan = _checkoutPendingPlan;
    _checkoutPendingPlan = null;
    setTimeout(() => {
      currentPlan = plan;
      document.getElementById('checkoutOverlay').classList.add('show');
      setCheckoutStep(2);
    }, 400);
  }
}

async function doCadastro() {
  const nome  = capAuthInput(document.getElementById('cadNome').value.trim(), 'nome');
  const email = capAuthInput(document.getElementById('cadEmail').value.trim(), 'email');
  const senha = capAuthInput(document.getElementById('cadSenha').value, 'senha');
  const err   = document.getElementById('cadErr');
  const ok    = document.getElementById('cadOk');
  const btn   = document.getElementById('cadBtnTxt');
  err.style.display='none'; ok.style.display='none';
  if (!nome)                    { err.textContent='Informe seu nome.'; err.style.display='block'; return; }
  if (!email.includes('@'))     { err.textContent='E-mail inválido.'; err.style.display='block'; return; }
  if (senha.length < 8)         { err.textContent='Senha mínima de 8 caracteres.'; err.style.display='block'; return; }
  const pwCheck = checkPasswordStrength(senha);
  if (!pwCheck.strong) { err.textContent=`Senha fraca — adicione: ${pwCheck.failed.map(r=>r.msg).join(', ')}.`; err.style.display='block'; return; }
  btn.textContent = 'Criando conta...';
  if (!sb) { err.textContent = 'Serviço indisponível. Tente novamente.'; err.style.display='block'; return; }
  const { error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome } } });
  btn.textContent = 'Criar conta →';
  if (error) { err.textContent = traduzErro(error.message); err.style.display='block'; return; }
  ok.textContent = '✓ Conta criada! Verifique seu e-mail para confirmar (pode estar no spam).';
  ok.style.display = 'block';
  // Fecha o overlay após 2s para o usuário ler a mensagem
  setTimeout(() => closeLoginDirect(), 2000);
}

// ===== EXTRATO STEP 1 AUTH =====
let _extTab = 'cad'; // 'cad' | 'log'

function extSwitchTab(tab) {
  _extTab = tab;
  const isCad = tab === 'cad';
  document.getElementById('extCadPane').style.display = isCad ? 'block' : 'none';
  document.getElementById('extLogPane').style.display = isCad ? 'none' : 'block';
  document.getElementById('extTabCad').style.background = isCad ? 'var(--surface)' : 'transparent';
  document.getElementById('extTabCad').style.color      = isCad ? 'var(--text)' : 'var(--muted)';
  document.getElementById('extTabLog').style.background = isCad ? 'transparent' : 'var(--surface)';
  document.getElementById('extTabLog').style.color      = isCad ? 'var(--muted)' : 'var(--text)';
  document.getElementById('extAuthBtnTxt').textContent  = isCad ? 'Criar conta e continuar →' : 'Entrar e continuar →';
}

// Rate limiter de auth — máx 5 tentativas por 2 minutos
const _authRL = { count: 0, resetAt: 0 };
function _authRateOk() {
  const now = Date.now();
  if (now > _authRL.resetAt) { _authRL.count = 0; _authRL.resetAt = now + 120000; }
  if (_authRL.count >= 5) return false;
  _authRL.count++;
  return true;
}

async function extStep1Done() {
  // Se já logado, avança direto
  if (_currentUser) { autoSkipExtStep1(_currentUser.email); return; }
  // Rate limit
  if (!_authRateOk()) {
    const err = document.getElementById('extAuthErr');
    if (err) { err.textContent = 'Muitas tentativas. Aguarde 2 minutos.'; err.style.display = 'block'; }
    return;
  }

  const err = document.getElementById('extAuthErr');
  const btn = document.getElementById('extAuthBtnTxt');
  err.style.display = 'none';

  if (_extTab === 'cad') {
    const email = capAuthInput(document.getElementById('extEmail').value.trim(), 'email');
    const senha = capAuthInput(document.getElementById('extSenha').value, 'senha');
    // Validação do aceite de termos
    const _termosEl = document.getElementById('termosAceite');
    if (_termosEl && !_termosEl.checked) { err.textContent='Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.'; err.style.display='block'; return; }
    if (!email.includes('@') || senha.length < 8) { err.textContent='E-mail inválido ou senha com menos de 8 caracteres.'; err.style.display='block'; return; }
    const pwCheck = checkPasswordStrength(senha);
    if (!pwCheck.strong) { err.style.color='var(--red)'; err.textContent=`Senha fraca — adicione: ${pwCheck.failed.map(r=>r.msg).join(', ')}.`; err.style.display='block'; return; }
    btn.textContent = 'Criando conta...';
    if (!sb) { err.textContent = 'Serviço indisponível. Tente novamente.'; err.style.display='block'; return; }
    const { data, error } = await sb.auth.signUp({ email, password: senha });
    btn.textContent = 'Criar conta e continuar →';
    if (error) { err.textContent = traduzErro(error.message); err.style.display='block'; return; }
    if (data.session) {
      authSuccess(email);
      autoSkipExtStep1(email);
    } else {
      err.style.color = 'var(--accent)';
      err.textContent = '✓ Conta criada! Confirme seu e-mail e volte para continuar.';
      err.style.display = 'block';
    }
  } else {
    const email = capAuthInput(document.getElementById('extLoginEmail').value.trim(), 'email');
    const senha = capAuthInput(document.getElementById('extLoginSenha').value, 'senha');
    if (!email.includes('@') || senha.length < 6) { err.textContent='E-mail ou senha inválidos.'; err.style.display='block'; return; }
    const blocked = authRateLimit(email);
    if (blocked) { err.textContent = blocked; err.style.display='block'; return; }
    btn.textContent = 'Entrando...';
    if (!sb) { err.textContent = 'Serviço indisponível. Tente novamente.'; err.style.display='block'; return; }
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    btn.textContent = 'Entrar e continuar →';
    if (error) { err.textContent = traduzErro(error.message); err.style.display='block'; return; }
    authSuccess(email);
    autoSkipExtStep1(email);
  }
}

function traduzErro(msg) {
  if (msg.includes('Invalid login')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('already registered')) return 'Este e-mail já está cadastrado. Tente entrar.';
  if (msg.includes('Password should')) return 'Senha muito fraca — use letras, números e símbolos.';
  return msg;
}

// ===== VALIDADOR DE SENHA FORTE =====
function checkPasswordStrength(senha) {
  const rules = [
    { ok: senha.length >= 8,          msg: 'Mínimo 8 caracteres' },
    { ok: /[A-Z]/.test(senha),        msg: 'Uma letra maiúscula' },
    { ok: /[a-z]/.test(senha),        msg: 'Uma letra minúscula' },
    { ok: /[0-9]/.test(senha),        msg: 'Um número' },
    { ok: /[^A-Za-z0-9]/.test(senha), msg: 'Um símbolo (!@#$...)' },
  ];
  const passed = rules.filter(r => r.ok).length;
  const failed = rules.filter(r => !r.ok);
  return { passed, total: rules.length, rules, failed, strong: passed >= 4 };
}

function renderPasswordMeter(containerId, senha) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!senha) { container.innerHTML = ''; return; }
  const { passed, total, rules } = checkPasswordStrength(senha);
  const pct = Math.round((passed / total) * 100);
  const color = passed <= 2 ? '#f87171' : passed <= 3 ? '#F5A623' : '#7CFF4F';
  const label = passed <= 2 ? 'Fraca' : passed <= 3 ? 'Razoável' : passed === 5 ? 'Excelente' : 'Boa';
  container.innerHTML = `
    <div style="margin-top:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;color:var(--muted)">Força da senha</span>
        <span style="font-size:11px;font-weight:600;color:${color}">${label}</span>
      </div>
      <div style="height:4px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:8px">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.3s,background 0.3s"></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${rules.map(r => `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${r.ok ? 'rgba(124,255,79,0.12)' : 'rgba(255,255,255,0.04)'};color:${r.ok ? '#7CFF4F' : 'var(--muted)'};">${r.ok ? '✓' : '○'} ${r.msg}</span>`).join('')}
      </div>
    </div>`;
}

// ===== LOGIN =====
function openLogin() {
  closeAllOverlays();
  document.getElementById('loginOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeLogin(e) {
  if (e.target === document.getElementById('loginOverlay')) closeLoginDirect();
}
function closeLoginDirect() {
  document.getElementById('loginOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

// ===== SIMULADOR =====
// ═══════════════════════════════
// PERFIS — mesma fonte do quiz landing
// Scores derivados dos pesos do motor (÷20×100)
// ═══════════════════════════════
const PROFILES = [
  {
    id: 'freelancer',
    nome: 'Freelancer Recorrente',
    desc: 'Autônomo · Pix de clientes todo mês · sem nota fiscal sistemática',
    icon: '💻',
    score: 55, nivel: 'elevado', gaugePct: 55,
    alertsData: [
      { cls:'alert-red',    icon:'🚨', title:'Pix recorrentes sem nota fiscal', text:'Bancos reportam à Receita via e-Financeira toda movimentação mensal. Pix frequentes sem justificativa são o principal gatilho de malha fina em autônomos.' },
      { cls:'alert-red',    icon:'🚨', title:'Renda declarada vs. recebida', text:'A Receita já possui os dados bancários antes de você declarar. Qualquer entrada não justificada é cruzada automaticamente.' },
    ],
    lockedData: [
      { label:'Volume Pix × renda declarada', val:'🔒 crítico' },
      { label:'Padrão de recorrência mensal', val:'🔒 crítico' },
      { label:'Anomalia temporal detectada', val:'🔒 crítico' },
    ],
    ctaCopy: 'Ver exatamente onde está o risco no seu extrato →',
    perfilTag: 'autonomo',
  },
  {
    id: 'mei',
    nome: 'MEI Ativo',
    desc: 'MEI · clientes fixos · mistura de conta PJ e pessoal',
    icon: '🏪',
    score: 48, nivel: 'moderado', gaugePct: 48,
    alertsData: [
      { cls:'alert-yellow', icon:'⚠️', title:'Limite de faturamento MEI', text:'MEI tem limite de R$81k/ano. Se sua conta pessoal recebe além do registrado no CNPJ, o sistema detecta automaticamente.' },
      { cls:'alert-yellow', icon:'⚠️', title:'Mistura PJ e CPF', text:'Recebimentos no CPF além do registrado no CNPJ geram padrão detectável no e-Financeira.' },
    ],
    lockedData: [
      { label:'Faturamento CPF × CNPJ', val:'🔒 bloqueado' },
      { label:'Recorrência de Pix PF', val:'🔒 bloqueado' },
      { label:'Limite MEI × movimentação', val:'🔒 bloqueado' },
    ],
    ctaCopy: 'Ver quais fatores a Receita está cruzando →',
    perfilTag: 'mei',
  },
  {
    id: 'socio',
    nome: 'Sócio na Conta Pessoal',
    desc: 'Empresário · recebe pró-labore ou repasse na conta pessoal',
    icon: '🏢',
    score: 65, nivel: 'elevado', gaugePct: 65,
    alertsData: [
      { cls:'alert-red', icon:'🚨', title:'Recebimentos da empresa na conta pessoal', text:'Receber valores da empresa na conta pessoal sem documentação adequada é um dos padrões que mais ativa cruzamento automático.' },
      { cls:'alert-red', icon:'🚨', title:'Mistura PJ/PF sensível', text:'Pró-labore e distribuição de lucros têm regras fiscais distintas. Confusão entre os dois é filtro primário do e-Financeira.' },
    ],
    lockedData: [
      { label:'Repasses PJ → CPF', val:'🔒 crítico' },
      { label:'Compatibilidade pró-labore', val:'🔒 crítico' },
      { label:'Circularidade financeira', val:'🔒 crítico' },
    ],
    ctaCopy: 'Ver exatamente onde está o risco no seu extrato →',
    perfilTag: 'empresario',
  },
  {
    id: 'clt_extra',
    nome: 'CLT com Extra',
    desc: 'CLT formal · freela eventual · Pix esporádico de terceiros',
    icon: '💼',
    score: 15, nivel: 'baixo', gaugePct: 15,
    alertsData: [
      { cls:'alert-green', icon:'✅', title:'Base CLT protege o perfil principal', text:'Emprego formal com holerite é o perfil de menor risco. O cruzamento automático da Receita prioriza perfis sem vínculo empregatício.' },
      { cls:'alert-green', icon:'💡', title:'Atenção aos extras', text:'Recebimentos esporádicos de freela têm risco baixo se declarados. Vale confirmar que constam na declaração.' },
    ],
    lockedData: [
      { label:'Pix extras × declaração', val:'Aguarda extrato' },
      { label:'Padrão de recebimento', val:'Aguarda extrato' },
      { label:'Anomalia temporal', val:'Aguarda extrato' },
    ],
    ctaCopy: 'Confirmar se os extras estão todos declarados →',
    perfilTag: 'clt',
  },
  {
    id: 'investidor',
    nome: 'Investidor PF',
    desc: 'Renda variável · FII · dividendos · sem carnê-leão organizado',
    icon: '📈',
    score: 47, nivel: 'moderado', gaugePct: 47,
    alertsData: [
      { cls:'alert-yellow', icon:'⚠️', title:'Obrigações fiscais de investimentos', text:'Dividendos, FII e ganho de capital têm obrigações específicas. Cada tipo tem regra própria de declaração e apuração de DARF.' },
      { cls:'alert-yellow', icon:'⚠️', title:'Informes de rendimentos × declaração', text:'Corretoras e fundos enviam informes diretamente à Receita. Inconsistência entre o informe e o declarado gera cruzamento automático.' },
    ],
    lockedData: [
      { label:'Ganho de capital apurado', val:'🔒 bloqueado' },
      { label:'DARF pendente detectado', val:'🔒 bloqueado' },
      { label:'FII × rendimentos declarados', val:'🔒 bloqueado' },
    ],
    ctaCopy: 'Ver quais fatores a Receita está cruzando →',
    perfilTag: 'investidor',
  },
];

// ═══════════════════════════════
// ENGINE COMPARTILHADO — desktop e mobile usam as mesmas funções
// ═══════════════════════════════
function renderProfileCards(bodyId) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  body.innerHTML = `
    <div style="font-size:13px;color:var(--muted2);margin-bottom:14px;line-height:1.5">Qual descreve melhor como você movimenta dinheiro?</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${PROFILES.map(p => `
        <button class="opt" onclick="selectProfile('${p.id}','${bodyId}')" style="text-align:left;flex-direction:column;align-items:flex-start;gap:4px;padding:12px 14px;min-height:56px;word-break:break-word">
          <div style="display:flex;align-items:center;gap:8px;width:100%">
            <span style="font-size:16px">${p.icon}</span>
            <span style="font-size:13px;font-weight:700;color:var(--text)">${p.nome}</span>
          </div>
          <div style="font-size:11px;color:var(--muted2);padding-left:24px">${p.desc}</div>
        </button>`).join('')}
    </div>`;
}

function selectProfile(id, bodyId) {
  const p = PROFILES.find(x => x.id === id);
  if (!p) return;

  // Pixel
  if (typeof fbq === 'function' && window.PIXEL_ATIVO) {
    fbq('trackCustom', 'ProfileSelected', { perfil: id, risco: p.nivel }, { eventID: 'ps_' + Date.now() });
  }

  const isDesktop = bodyId === 'qBody';
  const heroId    = isDesktop ? 'resultHero'   : 'mResultHero';
  const alertsId  = isDesktop ? 'resultAlerts' : 'mResultAlerts';
  const panelQ    = isDesktop ? 'questionPanel' : 'mQuestionPanel';
  const panelR    = isDesktop ? 'resultPanel'   : 'mResultPanel';

  // Loading
  const body = document.getElementById(bodyId);
  if (body) body.innerHTML = `
    <div style="text-align:center;padding:32px 0;color:var(--muted2);font-size:13px;font-weight:600;letter-spacing:0.5px">
      Cruzando com critérios do e-Financeira…
    </div>`;

  setTimeout(() => {
    document.getElementById(panelQ).style.display = 'none';
    document.getElementById(panelR).style.display = 'block';
    revealResult(p, heroId, alertsId, isDesktop);
  }, 900);
}

// Paleta de risco — constantes globais usadas em eRenderPreview, revealResult e motor
const C_BAIXO    = '#7CFF4F';
const C_ATENCAO  = '#F5A623';
const C_MODERADO = '#f97316';
const C_ELEVADO  = '#f04f60';
const C_CRITICO  = '#FF4D4F';
const CORES = { baixo: C_BAIXO, moderado: C_MODERADO, elevado: C_ELEVADO, critico: C_CRITICO };

function revealResult(p, heroId, alertsId, isDesktop) {
  const LABELS = {
    baixo:   'Perfil compatível',
    moderado:'Sinais que merecem atenção',
    elevado: 'Perfil requer análise urgente',
    critico: 'Perfil crítico — ação imediata recomendada',
  };
  const DESCS = {
    baixo:   'Seu perfil não apresenta sinais evidentes de incompatibilidade com o declarado. Confirmar com o extrato real é a forma mais segura de garantir.',
    moderado:'Identificamos possíveis incompatibilidades para o seu perfil. Esses padrões são os mesmos que o e-Financeira usa para cruzar com sua declaração.',
    elevado: 'As combinações do seu perfil são exatamente as que o sistema da Receita prioriza no cruzamento entre extrato e declaração. Sem verificar os dados reais, você não sabe o que o sistema já viu.',
    critico: 'Seu perfil reúne as principais características que ativam cruzamento automático no e-Financeira. A análise com o extrato real precisa acontecer antes que uma notificação chegue.',
  };

  const color = CORES[p.nivel];
  const level = LABELS[p.nivel];
  const desc  = DESCS[p.nivel];

  // Gauge SVG
  const gaugeR = 70, cx = 110, cy = 100;
  const startAngle = 210, totalDeg = 300;
  const targetDeg = (p.gaugePct / 100) * totalDeg;

  function polarToXY(deg, r) {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function arcPath(s, e, r) {
    const sp = polarToXY(s, r), ep = polarToXY(e, r);
    const large = (e - s + 360) % 360 > 180 ? 1 : 0;
    return `M ${sp.x} ${sp.y} A ${r} ${r} 0 ${large} 1 ${ep.x} ${ep.y}`;
  }
  const needleStart = polarToXY(startAngle, gaugeR - 14);

  const rh = document.getElementById(heroId);
  if (rh) rh.innerHTML = `
    <div class="result-glow" style="background:${color}"></div>
    <div style="padding:${isDesktop ? '28px 28px 16px' : '28px 20px 16px'}">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:16px;text-align:center;font-family:var(--ff)">// score de coerência fiscal</div>
      <div style="display:flex;${isDesktop ? 'align-items:center;gap:24px' : 'flex-direction:column;align-items:center;gap:12px'}">
        <div style="${isDesktop ? 'flex-shrink:0;max-width:220px;overflow:hidden' : 'width:100%;max-width:240px'}">
          <svg width="${isDesktop ? '220' : '100%'}" viewBox="0 0 220 130" style="${isDesktop ? 'flex-shrink:0' : 'width:100%;max-width:240px'}"
            <path d="${arcPath(startAngle, startAngle + totalDeg, gaugeR)}"
              fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="14" stroke-linecap="round"/>
            <path id="${heroId}Arc" d="${arcPath(startAngle, startAngle, gaugeR)}"
              fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
              style="transition:all 1.4s cubic-bezier(0.4,0,0.2,1)"/>
            <line id="${heroId}Needle" x1="${cx}" y1="${cy}" x2="${needleStart.x}" y2="${needleStart.y}"
              stroke="${color}" stroke-width="2.5" stroke-linecap="round"
              style="transform-origin:${cx}px ${cy}px;transition:transform 1.4s cubic-bezier(0.4,0,0.2,1)"/>
            <circle cx="${cx}" cy="${cy}" r="5" fill="${color}"/>
            <text x="${cx}" y="${cy - 14}" text-anchor="middle"
              style="font-family:var(--ff);font-size:32px;font-weight:800;fill:${color};letter-spacing:-2px"
              id="${heroId}Num">0</text>
            <text x="${cx}" y="${cy + 4}" text-anchor="middle"
              style="font-family:var(--ff);font-size:10px;fill:var(--muted);letter-spacing:1px">ÍNDICE</text>
            <text x="38"  y="122" text-anchor="middle" style="font-family:var(--ff);font-size:9px;fill:var(--muted)">BAIXO</text>
            <text x="${cx}" y="128" text-anchor="middle" style="font-family:var(--ff);font-size:9px;fill:var(--muted)">MÉDIO</text>
            <text x="182" y="122" text-anchor="middle" style="font-family:var(--ff);font-size:9px;fill:var(--muted)">ALTO</text>
          </svg>
        </div>
        <div style="flex:1;min-width:0;overflow:hidden">
          <div style="font-family:var(--ff);font-size:clamp(15px,3vw,20px);font-weight:800;color:${color};line-height:1.2;margin-bottom:8px">${level}</div>
          <div style="font-size:clamp(12px,2vw,14px);color:var(--muted2);line-height:1.65">${desc}</div>
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    const arc   = document.getElementById(heroId + 'Arc');
    const ndl   = document.getElementById(heroId + 'Needle');
    const numEl = document.getElementById(heroId + 'Num');
    if (arc) arc.setAttribute('d', arcPath(startAngle, startAngle + targetDeg, gaugeR));
    if (ndl) ndl.style.transform = `rotate(${targetDeg}deg)`;
    let n = 0;
    const step = () => { n = Math.min(n + 2, p.score); if (numEl) numEl.textContent = n; if (n < p.score) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, 100);

  // Alertas + paywall
  const ra = document.getElementById(alertsId);
  if (!ra) return;
  ra.innerHTML = '';

  p.alertsData.forEach((a, i) => {
    setTimeout(() => {
      const div = document.createElement('div');
      div.className = `alert-item ${a.cls}`;
      div.style.cssText = 'opacity:0;transform:translateY(8px);transition:all 0.35s ease';
      div.innerHTML = `<span class="alert-icon">${a.icon}</span><span><strong style="font-weight:600;display:block;margin-bottom:2px">${sanitize(a.title)}</strong>${sanitize(a.text)}</span>`;
      ra.appendChild(div);
      setTimeout(() => { div.style.opacity='1'; div.style.transform='translateY(0)'; }, 30);
    }, i * 400);
  });

  setTimeout(() => {
    // Blur paywall
    const blurBlock = document.createElement('div');
    blurBlock.style.cssText = 'margin-top:8px;border-radius:14px;overflow:hidden;position:relative;box-sizing:border-box;width:100%';
    blurBlock.innerHTML = `
      <div style="filter:blur(5px);user-select:none;pointer-events:none;background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:14px 16px;box-sizing:border-box">
        ${p.lockedData.map(d => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;gap:8px;min-width:0">
            <span style="color:var(--muted2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.label}</span>
            <span style="font-family:var(--ff);font-weight:700;color:var(--red);flex-shrink:0">${d.val}</span>
          </div>`).join('')}
      </div>
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(17,24,39,0.2) 0%,rgba(17,24,39,0.92) 55%);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:16px">
        <div style="font-size:20px;margin-bottom:6px">🔒</div>
        <div style="font-family:var(--ff);font-size:13px;font-weight:700;color:var(--text);text-align:center;margin-bottom:4px">Detectamos ${p.lockedData.length} padrões no seu perfil</div>
        <div style="font-size:11px;color:var(--muted2);text-align:center;line-height:1.5">Confirme com seu extrato real para ver os detalhes exatos</div>
      </div>`;
    ra.appendChild(blurBlock);

    // Próximo passo + CTA — dinâmico por nível de risco
    setTimeout(() => {
      const URGENCIA = {
        critico:  { badge: '🚨 Risco crítico detectado', sub: 'Seu perfil ativa cruzamento automático no e-Financeira. Confirme os valores reais antes que a Receita notifique.', btnColor: '#FF4D4F', btnText: '#fff', btnLabel: 'Ver os valores exatos no meu extrato →', trust: '⚡ Análise em menos de 2 min · sem envio de dados' },
        elevado:  { badge: '⚠️ Atenção — risco elevado', sub: 'Identificamos padrões que a Receita prioriza no cruzamento. Veja quais transações específicas estão em risco.', btnColor: '#FF4D4F', btnText: '#fff', btnLabel: 'Ver quais transações estão em risco →', trust: '🔒 Extrato processado localmente · Nenhum dado sai do seu dispositivo' },
        moderado: { badge: '🟡 Sinais que merecem atenção', sub: 'Esses padrões podem gerar inconsistência com sua declaração. Vale confirmar antes da Receita fazer o cruzamento.', btnColor: '#7CFF4F', btnText: '#000', btnLabel: 'Confirmar se minha movimentação está compatível →', trust: '🔒 Análise 100% local · Gratuito para começar' },
        baixo:    { badge: '✅ Perfil com baixo risco', sub: 'Seu perfil não apresenta sinais críticos. Confirme com o extrato real para ter certeza antes da declaração.', btnColor: '#7CFF4F', btnText: '#000', btnLabel: 'Confirmar que está tudo certo no extrato →', trust: '🔒 Análise 100% local · Gratuito para começar' },
      };
      const u = URGENCIA[p.nivel] || URGENCIA.moderado;

      const ctaBlock = document.createElement('div');
      ctaBlock.style.cssText = 'margin-top:16px;opacity:0;transform:translateY(10px);transition:all 0.4s ease;box-sizing:border-box;width:100%';
      ctaBlock.innerHTML = `
        <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:5px 12px;font-size:11px;font-weight:700;color:var(--text2);margin-bottom:10px;white-space:nowrap">
          ${u.badge}
        </div>
        <div style="font-size:12px;color:var(--muted2);line-height:1.65;margin-bottom:14px;box-sizing:border-box;word-break:break-word">
          ${u.sub}
        </div>
        <button onclick="showPage('extrato')" style="width:100%;padding:16px;background:${u.btnColor};border:none;border-radius:12px;color:${u.btnText};font-family:var(--ff);font-size:clamp(13px,3.5vw,15px);font-weight:800;cursor:pointer;transition:all 0.2s;letter-spacing:-0.01em;box-sizing:border-box;word-break:break-word;${(p.nivel==='critico'||p.nivel==='elevado') ? 'box-shadow:0 0 20px rgba(255,77,79,0.4)' : 'box-shadow:var(--glow-green)'}">
          ${u.btnLabel}
        </button>
        <div style="text-align:center;font-size:11px;color:var(--muted);margin-top:10px;line-height:1.6">${u.trust}</div>`;
      ra.appendChild(ctaBlock);
      setTimeout(() => { ctaBlock.style.opacity='1'; ctaBlock.style.transform='translateY(0)'; }, 30);
    }, 300);
  }, p.alertsData.length * 400 + 300);

  // Pixels
  if (typeof fbq === 'function' && window.PIXEL_ATIVO) {
    fbq('trackCustom', 'QuizCompleted', { origem: isDesktop ? 'site_principal' : 'site_principal_mobile', risco: p.nivel, score: p.score }, { eventID: 'qc_' + Date.now() });
    fbq('track', 'Lead', { content_name: 'quiz_site_principal', content_category: p.nivel }, { eventID: 'lead_site_' + Date.now() });
  }
}

function restart() {
  document.getElementById('resultPanel').style.display = 'none';
  document.getElementById('questionPanel').style.display = 'block';
  document.getElementById('resultHero').innerHTML = '';
  document.getElementById('resultAlerts').innerHTML = '';
  renderProfileCards('qBody');
}

function mRestart() {
  document.getElementById('mResultPanel').style.display = 'none';
  document.getElementById('mQuestionPanel').style.display = 'block';
  document.getElementById('mResultHero').innerHTML = '';
  document.getElementById('mResultAlerts').innerHTML = '';
  renderProfileCards('mQBody');
}

// ───── inicializar ambos os quizzes ─────
document.addEventListener('DOMContentLoaded', function () {
  renderProfileCards('qBody');
  renderProfileCards('mQBody');
});




// Abre o quiz sempre limpo — usado pelo botão "Fazer quiz gratuito"
function openQuiz() {
  const current = document.querySelector('.page.active')?.id?.replace('page-', '');
  if (current !== 'home') {
    try { history.pushState({ page: 'home' }, '', '#home'); } catch(e) {}
    _applyPage('home');
  }
  switchSimTab('perguntas');
  if (typeof fbq === 'function' && window.PIXEL_ATIVO) fbq('trackCustom', 'QuizStarted', { origem: 'site_principal' }, { eventID: 'qs_' + Date.now() });
  // Reseta para tela de seleção de perfil
  const rp = document.getElementById('resultPanel');
  const qp = document.getElementById('questionPanel');
  if (rp) rp.style.display = 'none';
  if (qp) qp.style.display = 'block';
  renderProfileCards('qBody');
  // Scroll suave até o simulador
  setTimeout(() => {
    const isMobile = window.innerWidth < 1100;
    const target = isMobile
      ? document.getElementById('quizWrap')
      : document.querySelector('.sim-wrap');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

// ── FEED DE DETECÇÕES (estático — sem animação contínua) ─────────────────────
(function() {
  const feed = document.getElementById('detectFeed');
  if (!feed) return;
  const items = [
    { type: 'red',    icon: '🚨', label: 'Incompatibilidade de renda',       val: '+162% acima do declarado' },
    { type: 'yellow', icon: '⚠️', label: 'Pix recorrentes sem origem',        val: 'R$ 32.880 em 4 meses' },
    { type: 'red',    icon: '🚨', label: 'Atividade comercial não declarada', val: '7 recebimentos mensais' },
    { type: 'green',  icon: '✅', label: 'Score de coerência fiscal',         val: '23/100 — perfil compatível' },
  ];
  const colors = {
    red:    { bg: 'rgba(255,77,79,0.07)',    border: 'rgba(255,77,79,0.18)',    text: '#f87171' },
    yellow: { bg: 'rgba(245,166,35,0.07)',   border: 'rgba(245,166,35,0.18)',   text: '#fbbf24' },
    green:  { bg: 'rgba(124,255,79,0.07)',   border: 'rgba(124,255,79,0.18)',   text: '#34d399' },
  };
  feed.innerHTML = items.map(d => {
    const c = colors[d.type];
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:${c.bg};border:1px solid ${c.border};border-radius:8px;flex-shrink:0">
      <span style="font-size:13px;flex-shrink:0">${d.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:600;color:${c.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.label}</div>
        <div style="font-size:10px;color:var(--muted2);margin-top:1px">${d.val}</div>
      </div>
    </div>`;
  }).join('');
  window._stopDetectionFeed = () => {};
})();

// ── FIM FEED DETECÇÕES ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // inicialização dos quiz cards já feita no listener DOMContentLoaded do engine
  if (typeof fbq === 'function' && window.PIXEL_ATIVO) fbq('trackCustom', 'QuizStarted', { origem: 'site_principal' }, { eventID: 'qs_' + Date.now() });
  initProFreeMode();
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

  // ── VINCULAÇÃO COM QUIZ DA LANDING ──────────────────────────────────
  // Lê parâmetros enviados pela landing: ?perfil=autonomo&risco=elevado&dor=pix#extrato
  (function() {
    try {
      const p = new URLSearchParams(window.location.search);
      const perfil = p.get('perfil');
      const risco  = p.get('risco');
      const dor    = p.get('dor') || '';

      // Só executa se vier da landing (precisa de perfil e risco)
      if (!perfil || !risco) return;

      const riscoLabel = {
        baixo:    'baixo risco identificado',
        moderado: 'atenção moderada identificada',
        elevado:  'risco elevado identificado',
        critico:  'risco crítico identificado'
      }[risco] || risco;

      const riscoColor = {
        baixo:    '#7CFF4F',
        moderado: C_ATENCAO,
        elevado:  C_ELEVADO,
        critico:  'var(--red)'
      }[risco] || '#7CFF4F';

      const perfilLabel = decodeURIComponent(perfil).replace(/,/g, ' + ');

      // Navega para a página de extrato
      showPage('extrato');

      // Injeta banner personalizado após renderização da página
      setTimeout(() => {
        const wrap = document.querySelector('#page-extrato .page-inner');
        if (!wrap) return;

        // Evita duplicar o banner em navegações repetidas
        if (document.getElementById('quiz-welcome-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'quiz-welcome-banner';
        banner.style.cssText = [
          'display:flex', 'align-items:flex-start', 'gap:12px',
          'padding:14px 16px', 'margin-bottom:20px',
          'background:rgba(59,130,246,0.07)',
          'border:1px solid rgba(59,130,246,0.18)',
          'border-radius:10px',
          'font-size:13.5px', 'color:var(--text2)',
          'line-height:1.55', 'position:relative'
        ].join(';');

        banner.innerHTML = `
          <span style="font-size:18px;flex-shrink:0;margin-top:1px">🔍</span>
          <div style="flex:1">
            <div style="font-weight:600;color:var(--text);margin-bottom:3px">Pré-análise concluída</div>
            <div>Perfil: <strong style="color:var(--text)">${perfilLabel}</strong> &nbsp;·&nbsp;
            Nível: <strong style="color:${riscoColor}">${riscoLabel}</strong></div>
            <div style="margin-top:6px;font-size:12.5px;color:var(--muted2)">
              Envie seu extrato bancário abaixo para ver a análise completa com seus dados reais.
            </div>
          </div>
          <button
            onclick="this.closest('#quiz-welcome-banner').remove()"
            style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:0;flex-shrink:0;line-height:1"
            aria-label="Fechar">×</button>
        `;

        wrap.insertBefore(banner, wrap.firstChild);

        // Scroll suave até o banner
        setTimeout(() => {
          banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);

        // Pré-preenche email do cadastro se veio da landing com ?email=
        try {
          const emailParam = p.get('email');
          if (emailParam) {
            const tryFill = () => {
              const el = document.getElementById('coEmail');
              if (el && !el.value) el.value = decodeURIComponent(emailParam);
            };
            tryFill();
            const observer = new MutationObserver(() => { tryFill(); });
            const overlay = document.getElementById('checkoutOverlay');
            if (overlay) observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
            setTimeout(() => observer.disconnect(), 120000);
          }
        } catch(e) {}

        // Limpa params da URL sem recarregar (mantém o hash #extrato)
        try {
          history.replaceState({page: 'extrato'}, '', window.location.pathname + '#extrato');
        } catch(e) {}

      }, 120);

    } catch(err) {
      // Falha silenciosa — não quebra o site principal
      console.warn('[GF quiz-link] erro ao processar parâmetros:', err);
    }
  })();
  // ── FIM VINCULAÇÃO ───────────────────────────────────────────────────
});

// ===== PARSER V3 ENGINE =====
// pdf.js worker configurado dinamicamente em _loadPdfJs()

const MAX_FILES=5;
const SRC_COLORS=['#7CFF4F','#4d9fff','#f5a623','#c084fc','#fb7185'];

// ── ENGINE CONFIG — limites centralizados e ajustáveis ───────
const ENGINE_CONFIG = {
  // Limites de reporte e-Financeira (Receita Federal)
  // Fonte: gov.br/receitafederal — FAQ e-Financeira jan/2025
  MONTHLY_REPORT_LIMIT_PF:  5000,   // total mensal consolidado PF (credito + debito)
  MONTHLY_REPORT_LIMIT_PJ:  15000,  // total mensal consolidado PJ
  // Aliases de compatibilidade
  PIX_LIMIT_PF:     5000,
  PIX_LIMIT_PJ:     15000,
  PIX_LIMIT:        5000,
  // Heuristicas internas (nao sao regras oficiais da Receita)
  CASH_ALERT_THRESHOLD: 2000,
  ESPECIE_LIMIT:        2000,  // [v4-FIX] corrigido para o limite real da e-Financeira (era 3000)
  // Split Pix
  SPLIT_PIX_DELTA:  500,
  SPLIT_PIX_MIN:    4500,
  SPLIT_PIX_WINDOW: 7,
  // Circularidade
  CIRCULAR_RATIO:   0.85,
  CIRCULAR_HOURS:   24,
  CIRCULAR_MIN_VALUE: 7000,   // [fix-circ] era 3000 — muito agressivo para extratos sem hora; só detecta movimentações realmente suspeitas
  // PDF seguranca
  PDF_MAX_PAGES:    60,
  PDF_TIMEOUT_MS:   15000,
  // Score e confianca
  MIN_EVIDENCIAS_ALTO_RISCO: 2,
  CONFIDENCE_REBAIXAR:       0.35,
  // Janelas de analise
  JANELA_TRIMESTRAL: 3,
  JANELA_SEMESTRAL:  6,
  JANELA_ANUAL:      12,
  // Calibracao de severidade por fator (multiplicadores contextuais)
  // risco_final = severidade * impacto * contexto
  SEVERIDADE: {
    F1_omissao_renda:         1.0,
    F2_pix_limite:            0.85,
    F3_especie:               0.90,
    F4_comercial_oculta:      0.80,
    F5_anomalia_temporal:     0.75,
    F6_investimento_aluguel:  0.70,
    F6c_circularidade:        0.90,
    F6d_split_pix:            0.95,
    F7_compatibilidade:       1.0,
    F8_conta_auxiliar:        0.65,
  },
};

// ── AGREGAÇÃO MENSAL CANÔNICA (modelo e-Financeira) ─────────
// Consolida créditos + débitos por mês e por tipo de canal
// A e-Financeira usa totais mensais, não transações isoladas
function aggregateMonthly(txns) {
  // [fix-XBK] Pré-computar pares cross-bank: Pix entrada+saída mesmo valor mesmo dia
  // Esses pares não devem inflar o pixConsolidado (modelo e-Financeira)
  const _pixCrossBankSet = new Set();
  const _pixPorValorDia = {};
  txns.forEach((t, idx) => {
    if (!t.date || !(t.date instanceof Date) || isNaN(t.date)) return;
    const isPix = normalizeDesc(t.desc||'').includes('pix');
    if (!isPix) return;
    const diaKey = t.date.toISOString().slice(0,10);
    const valKey = Math.abs(t.value).toFixed(2) + '|' + diaKey;
    if (!_pixPorValorDia[valKey]) _pixPorValorDia[valKey] = { pos: [], neg: [] };
    if (t.value > 0) _pixPorValorDia[valKey].pos.push(idx);
    else             _pixPorValorDia[valKey].neg.push(idx);
  });
  // Marcar pares: para cada valor+dia com entrada E saída Pix, é cross-bank
  Object.values(_pixPorValorDia).forEach(({ pos, neg }) => {
    if (pos.length > 0 && neg.length > 0) {
      const n = Math.min(pos.length, neg.length);
      for (let i = 0; i < n; i++) {
        _pixCrossBankSet.add(pos[i]);
        _pixCrossBankSet.add(neg[i]);
      }
    }
  });

  const months = {};
  for (let idx = 0; idx < txns.length; idx++) {
    const t = txns[idx];
    if (!t.date || !(t.date instanceof Date) || isNaN(t.date)) continue;
    const key = t.date.getFullYear() + '-' + String(t.date.getMonth()+1).padStart(2,'0');
    if (!months[key]) months[key] = {
      credits: 0, debits: 0,
      cashIn: 0,  cashOut: 0,
      pixIn: 0,   pixOut: 0,
      pixConsolidado: 0,  // crédito + débito Pix (modelo e-Financeira)
      pixConsolidadoLiquido: 0, // idem excluindo cross-bank/internos
      especie: 0,
      formal: 0,
      txns: [], count: 0
    };
    const b = months[key];
    const v = Math.abs(t.value);
    const d = normalizeDesc(t.desc);
    const isCrossBank = _pixCrossBankSet.has(idx);
    if (t.value > 0) {
      b.credits += v;
      if (d.includes('pix'))  { b.pixIn += v; }
      if (d.includes('saque') || d.includes('especie')) b.cashIn += v;
      if (d.includes('salario') || d.includes('holerite')) b.formal += v;
    } else {
      b.debits += v;
      if (d.includes('pix'))  { b.pixOut += v; }
      if (d.includes('saque')) b.cashOut += v;
    }
    b.pixConsolidado = b.pixIn + b.pixOut;
    // Versão líquida: exclui pares cross-bank detectados
    if (!isCrossBank) {
      b.pixConsolidadoLiquido = (b.pixConsolidadoLiquido||0) + (d.includes('pix') ? v : 0);
    } else {
      b.pixConsolidadoLiquido = b.pixConsolidadoLiquido||0; // não incrementa
    }
    b.txns.push(t);
    b.count++;
  }
  return months;
}

// ── PERFIL HISTÓRICO (médias 3/6/12 meses) ───────────────────
// ── Helpers estatísticos ──────────────────────────────────────
// Mediana: mais robusta que média quando há outliers (ex: mês com herança, rescisão, venda de bem)
function _median(arr) {
  if (!arr || arr.length === 0) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
// Desvio absoluto mediano (MAD) — mais robusto que desvio padrão com outliers
function _mad(arr, med) {
  if (!arr || arr.length === 0) return 0;
  const m = med !== undefined ? med : _median(arr);
  return _median(arr.map(v => Math.abs(v - m)));
}

function calcProfile(months) {
  const keys = Object.keys(months).filter(k => k !== 'unk').sort();
  const values  = keys.map(k => months[k].credits + months[k].debits);
  const credits = keys.map(k => months[k].credits);
  const pixVals = keys.map(k => months[k].pixConsolidado);

  const avg  = (arr) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  const last = (arr, n) => arr.slice(-n);

  const medCredits = _median(credits);
  const madCredits = _mad(credits, medCredits);

  return {
    avgTotal3:   avg(last(values, 3)),
    avgTotal6:   avg(last(values, 6)),
    avgTotal12:  avg(last(values, 12)),
    avgCredits:  avg(credits),
    // Mediana e MAD: baseline robusta contra outliers (venda de bem, herança, 13º acumulado)
    medCredits,
    madCredits,
    avgPix:      avg(pixVals),
    totalMeses:  keys.length,
    mesCritico: keys.reduce((best, k) => {
      const v = months[k].credits + months[k].debits;
      return (!best || v > (months[best].credits + months[best].debits)) ? k : best;
    }, null),
  };
}

// ── VALIDAÇÃO DE TRANSAÇÃO ────────────────────────────────────
function isValidTxn(t) {
  return (
    t.date instanceof Date &&
    !isNaN(t.date) &&
    typeof t.value === 'number' &&
    !isNaN(t.value) &&
    t.value !== 0 &&
    typeof t.desc === 'string' &&
    t.desc.trim().length >= 2
  );
}

// ── FINGERPRINT REFORÇADO (banco incluso) ────────────────────
function txnFingerprintV2(t) {
  // [fix] instanceof Date não garante data válida — isNaN verifica
  const dateStr = (t.date instanceof Date && !isNaN(t.date)) ? t.date.toISOString().slice(0,10) : String(t.date||'');
  const valStr  = Math.abs(t.value).toFixed(2);
  const descStr = normalizeDesc(t.desc).slice(0, 50);
  const bank    = normalizeDesc(t.bank || '').slice(0, 20);
  return dateStr + '|' + valStr + '|' + descStr + '|' + bank;
}

// ── NORMALIZAÇÃO SEMÂNTICA ────────────────────────────────────
function normalizeDesc(desc) {
  if (!desc) return '';
  let s = desc.toLowerCase();
  // remove acentos
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // remove emojis (faixa Unicode)
  s = s.replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
  // remove IDs/códigos longos (6+ dígitos)
  s = s.replace(/\b\d{6,}\b/g, '');
  // remove pontuação
  s = s.replace(/[^\w\s]/g, ' ');
  // comprime espaços
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// ── DEDUPLICAÇÃO POR FINGERPRINT ─────────────────────────────
function txnFingerprint(t, includeSign) {
  const dateStr = (t.date instanceof Date && !isNaN(t.date))
    ? t.date.toISOString().slice(0, 10)
    : String(t.date || '');
  // Inclui sinal do valor para diferenciar crédito/débito de mesmo valor
  const valStr  = (includeSign ? (t.value >= 0 ? '+' : '-') : '') + Math.abs(t.value).toFixed(2);
  const descStr = normalizeDesc(t.desc).slice(0, 40);
  const bankStr = normalizeDesc(t.bank || '').slice(0, 15);
  return dateStr + '|' + valStr + '|' + descStr + '|' + bankStr;
}

// Deduplicação simples dentro de um grupo (mesmo banco)
function deduplicateTxns(txns) {
  const seen = new Set();
  return txns.filter(function(t) {
    const fp = txnFingerprint(t, true);
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}

// Deduplicação cruzada entre múltiplas fontes
// Remove transações que aparecem em mais de um extrato (mesmo dia, valor, descrição similar)
function deduplicateCrossSource(allTxns) {
  const seen = new Set();
  return allTxns.filter(t => {
    // Fingerprint sem banco para capturar duplicatas cross-source
    const dateStr = (t.date instanceof Date && !isNaN(t.date)) ? t.date.toISOString().slice(0, 10) : String(t.date || '');
    const valStr  = (t.value >= 0 ? '+' : '-') + Math.abs(t.value).toFixed(2);
    const descStr = normalizeDesc(t.desc).slice(0, 25);
    const fp = dateStr + '|' + valStr + '|' + descStr;
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}
const fmtBRL=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2}).format(isNaN(v)?0:v);
const fmtDate=d=>d?d.toLocaleDateString('pt-BR'):'—';

function eParseBRL(s){
  if(!s)return 0;
  s=String(s).trim().replace(/\s/g,'');
  const neg=s.startsWith('-');
  const abs=s.replace(/^-/,'');
  let parsed;
  if(/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(abs))parsed=parseFloat(abs.replace(/\./g,'').replace(',','.'));
  else parsed=parseFloat(abs.replace(',','.'));
  return (neg?-1:1)*(parsed||0);
}
function eParseDate(s){
  if(!s)return null;
  s=s.trim().replace(/['"]/g,'');
  let m;
  if((m=s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)))return new Date(+m[3],+m[2]-1,+m[1]);
  if((m=s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)))return new Date(+m[1],+m[2]-1,+m[3]);
  if((m=s.match(/^(\d{4})(\d{2})(\d{2})/)))return new Date(+m[1],+m[2]-1,+m[3]);
  if((m=s.match(/^(\d{2})[\/\-](\d{2})$/)))return new Date(new Date().getFullYear(),+m[2]-1,+m[1]);
  return null;
}
function eDetectFormat(c,fn){
  const ext=fn.split('.').pop().toLowerCase();
  const h=c.substring(0,3000).toUpperCase();
  const l=c.split('\n').slice(0,15).join('\n').toLowerCase();

  let format, bankInfo;

  if(ext==='pdf'){
    format='pdf';
    bankInfo=eDetectBankReal(c,'pdf',fn);
    return{format,bank:bankInfo.label,conta:bankInfo.conta,banco:bankInfo.banco};
  }
  if(ext==='ofx'||ext==='qfx'||h.includes('<OFX')||h.includes('OFXHEADER')){
    format='ofx';
    bankInfo=eDetectBankReal(c,'ofx',fn);
    return{format,bank:bankInfo.label,conta:bankInfo.conta,banco:bankInfo.banco};
  }
  if(l.includes('"date"')&&l.includes('"title"')&&l.includes('"amount"')){
    format='nubank_cartao';
    bankInfo=eDetectBankReal(c,'nubank_cartao',fn);
    return{format,bank:bankInfo.label||'Nubank (cartão)',conta:bankInfo.conta,banco:bankInfo.banco};
  }
  // Inter — deve vir antes do Nubank conta
  if(l.includes('banco inter')||l.includes('extrato conta corrente')||(l.includes('histórico')&&l.includes('descrição')&&l.includes(';'))){
    format='inter';
    bankInfo=eDetectBankReal(c,'inter',fn);
    return{format,bank:bankInfo.label,conta:bankInfo.conta,banco:bankInfo.banco};
  }
  // Nubank conta
  const isNubankConta=(
    ((l.includes('lançamento')||l.includes('lancamento'))&&l.includes('valor'))||
    (l.includes('data')&&l.includes('valor')&&l.includes('identificador'))||
    (l.includes('data')&&l.includes('descrição')&&l.includes('valor')&&!l.includes(';'))||
    (l.includes('data')&&l.includes('description')&&l.includes('amount')&&l.includes('identifier'))
  )&&!l.includes('"date"')&&!l.includes('"title"');
  if(isNubankConta){
    format='nubank_conta';
    bankInfo=eDetectBankReal(c,'nubank_conta',fn);
    return{format,bank:bankInfo.label||'Nubank (conta)',conta:bankInfo.conta,banco:bankInfo.banco};
  }
  if(l.includes('data;histórico')||l.includes('data;historico')){
    format='bb';
    bankInfo=eDetectBankReal(c,'bb',fn);
    return{format,bank:bankInfo.label||'Banco do Brasil',conta:bankInfo.conta,banco:bankInfo.banco};
  }
  bankInfo=eDetectBankReal(c,'generic',fn);
  return{format:'generic',bank:bankInfo.label||'CSV genérico',conta:bankInfo.conta,banco:bankInfo.banco};
}
// ── Mapa de códigos COMPE → nome do banco ──────────────────────
const BANCO_COMPE = {
  '001':'Banco do Brasil','033':'Santander','041':'Banrisul','077':'Banco Inter',
  '104':'Caixa Econômica','208':'BTG Pactual','212':'Banco Original','237':'Bradesco',
  '260':'Nu Pagamentos','290':'PagBank','341':'Itaú','348':'XP','376':'JP Morgan',
  '422':'Safra','633':'Rendimento','637':'Sofisa','655':'Votorantim','745':'Citibank',
  '756':'Sicoob','748':'Sicredi','336':'C6 Bank','380':'PicPay','323':'Mercado Pago',
  '403':'Cora','461':'Asaas','084':'CC Uniprime','085':'Cooperativa Central',
};

// ── Extrai banco e conta de qualquer tipo de arquivo ───────────
function eDetectBankReal(content, format, filename) {
  const u = content.substring(0, 3000).toUpperCase();
  const raw = content.substring(0, 3000);

  let banco = null;
  let conta = null;
  let agencia = null;

  // ── OFX: extrai via tags XML ──
  if (format === 'ofx') {
    // Banco via FID (código COMPE)
    const fid = raw.match(/<FID>(\d+)/i)?.[1];
    if (fid && BANCO_COMPE[fid]) banco = BANCO_COMPE[fid];

    // Banco via ORG
    if (!banco) {
      const org = raw.match(/<ORG>([^<\n]+)/i)?.[1]?.trim();
      if (org) banco = eBancoNomeFromText(org);
    }

    // Conta
    conta = raw.match(/<ACCTID>([^<\n]+)/i)?.[1]?.trim();
    agencia = raw.match(/<BRANCHID>([^<\n]+)/i)?.[1]?.trim();
  }

  // ── CSV/TXT: extrai via cabeçalho de metadados ──
  if (!banco || format === 'inter' || format === 'nubank_conta' || format === 'bb') {
    // Número de conta em linha de metadado "Conta ;32238762"
    const contaM = raw.match(/conta\s*[;:]\s*(\d[\d\-\.]+)/i);
    if (contaM) conta = contaM[1].replace(/[.\-]/g, '').trim();

    // Agência
    const agM = raw.match(/agência?\s*[;:]\s*([\d\-]+)/i);
    if (agM) agencia = agM[1].replace(/[.\-]/g, '').trim();

    // Banco via texto
    if (!banco) banco = eBancoNomeFromText(raw.substring(0, 500));
  }

  // ── PDF: tenta extrair do texto ──
  if (format === 'pdf' || !banco) {
    banco = eBancoNomeFromText(u);
    const contaM = u.match(/CONTA[^:]*:\s*([\d\.\-]+)/);
    if (contaM && !conta) conta = contaM[1].replace(/[.\-]/g, '').trim();
  }

  // Fallback: usa o nome do arquivo
  if (!banco) banco = eBancoNomeFromText(filename);

  // Monta label do banco — inclui conta se disponível
  const label = banco
    ? (conta ? `${banco} ···${conta.slice(-4)}` : banco)
    : (conta ? `Conta ···${conta.slice(-4)}` : 'Extrato');

  return { banco: banco || 'Extrato', conta: conta || null, agencia: agencia || null, label };
}

// ── Identifica nome do banco a partir de texto livre ───────────
function eBancoNomeFromText(text) {
  const u = text.toUpperCase();
  if (u.includes('BANCO INTER') || u.includes('INTERMEDIUM') || u.includes('INTER S/A')) return 'Banco Inter';
  if (u.includes('NUBANK') || u.includes('NU PAGAMENTOS') || u.includes('NU FINANCEIRA')) return 'Nubank';
  if (u.includes('ITAU') || u.includes('ITAÚ')) return 'Itaú';
  if (u.includes('BRADESCO')) return 'Bradesco';
  if (u.includes('BANCO DO BRASIL') || u.includes('BANCOBRASIL')) return 'Banco do Brasil';
  if (u.includes('CAIXA ECONÔMICA') || u.includes('CAIXA ECONOMICA') || u.includes('CEF')) return 'Caixa Econômica';
  if (u.includes('SANTANDER')) return 'Santander';
  if (u.includes('SICOOB')) return 'Sicoob';
  if (u.includes('SICREDI')) return 'Sicredi';
  if (u.includes('C6 BANK') || u.includes('C6BANK')) return 'C6 Bank';
  if (u.includes('BTG')) return 'BTG Pactual';
  if (u.includes('ORIGINAL')) return 'Banco Original';
  if (u.includes('PAGBANK') || u.includes('PAG BANK')) return 'PagBank';
  if (u.includes('XP INVESTIMENTOS') || u.includes('XP INC')) return 'XP';
  if (u.includes('PICPAY')) return 'PicPay';
  if (u.includes('MERCADO PAGO')) return 'Mercado Pago';
  if (u.includes('BANRISUL')) return 'Banrisul';
  if (u.includes('SAFRA')) return 'Safra';
  if (u.includes('VOTORANTIM')) return 'Votorantim';
  return null;
}

function eDetectBankOFX(c){ return eDetectBankReal(c,'ofx','').label; }
function eSplitCSV(line,sep=','){
  const r=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){q=!q;continue}if(c===sep&&!q){r.push(cur.trim());cur='';continue}cur+=c;}
  r.push(cur.trim());return r;
}
function eDetectSep(l){const s={',':0,';':0,'\t':0};for(const c of l)if(s[c]!==undefined)s[c]++;return Object.keys(s).reduce((a,b)=>s[a]>s[b]?a:b);}
function eParseNubankCartao(lines){return lines.slice(1).filter(l=>l.trim()).map(l=>{const c=eSplitCSV(l);if(c.length<3)return null;const date=eParseDate(c[0]),desc=(c[1]||'').trim(),value=eParseBRL(c[2]);return date&&desc?{date,desc,value}:null;}).filter(Boolean);}
function eParseNubankConta(lines){
  if(lines.length<2)return[];
  // detecta colunas pelo cabeçalho
  const hdr=eSplitCSV(lines[0]).map(c=>c.toLowerCase().replace(/['"]/g,'').trim());
  const iDate=hdr.findIndex(h=>h.includes('data')||h==='date');
  const iDesc=hdr.findIndex(h=>h.includes('descri')||h.includes('description')||h.includes('histórico')||h.includes('historico'));
  const iVal =hdr.findIndex(h=>h==='valor'||h==='value'||h==='amount'||h.includes('valor'));
  const iId  =hdr.findIndex(h=>h.includes('identif'));
  return lines.slice(1).filter(l=>l.trim()).map(l=>{
    const c=eSplitCSV(l);
    if(c.length<2)return null;
    // usa índices detectados ou fallback posicional
    const date=eParseDate(c[iDate>=0?iDate:0]);
    const desc=(iDesc>=0?c[iDesc]:(iId>=0?c[iId]:c[1]||'')).replace(/['"]/g,'').trim();
    const value=iVal>=0?eParseBRL(c[iVal]):eParseBRL(c[c.length-1]);
    return date&&desc?{date,desc,value}:null;
  }).filter(Boolean);
}
function eParseInter(lines){
  let s=0;
  for(let i=0;i<lines.length;i++){
    const l=lines[i].toLowerCase();
    if(l.includes('data')&&(l.includes('histórico')||l.includes('historico'))){s=i;break;}
  }
  const sep=eDetectSep(lines[s]||lines[0]||'');
  const hdr=lines[s].split(sep).map(x=>x.replace(/['"]/g,'').trim().toLowerCase());
  const iDt  =hdr.findIndex(h=>h.includes('data'));
  const iHist=hdr.findIndex(h=>h.includes('hist'));
  const iDesc=hdr.findIndex(h=>h.includes('descri'));
  const iVal =hdr.findIndex(h=>h==='valor'||h.includes('valor'));
  return lines.slice(s+1).filter(l=>l.trim()).map(l=>{
    const c=l.split(sep).map(x=>x.replace(/['"]/g,'').trim());
    if(c.length<3)return null;
    const date=eParseDate(c[iDt>=0?iDt:0]);
    const hist=iHist>=0?c[iHist]:'';
    const desc=iDesc>=0?c[iDesc]:c[1]||'';
    const label=[hist,desc].filter(Boolean).join(' — ').trim();
    const value=iVal>=0?eParseBRL(c[iVal]):eParseBRL(c[c.length-2]||c[c.length-1]);
    if(!date||!label)return null;
    // Extrai nome do remetente do formato Inter: "Cp :CNPJ-Nome Remetente"
    // Permite que o motor identifique transferências do mesmo titular
    let senderName = null;
    const mInter = desc.match(/Cp\s*:\d+-(.+)/i);
    if(mInter) senderName = mInter[1].trim().toUpperCase();
    return {date, desc:label, value, senderName};
  }).filter(Boolean);
}
function eParseBB(lines){let s=0;for(let i=0;i<lines.length;i++){if(lines[i].toLowerCase().includes('data')&&lines[i].includes(';')){s=i+1;break}}return lines.slice(s).filter(l=>l.trim()).map(l=>{const c=l.split(';').map(x=>x.replace(/"/g,'').trim());if(c.length<4)return null;const date=eParseDate(c[0]),desc=c[1]||'',cr=eParseBRL(c[3]),db=eParseBRL(c[4]||'');return date?{date,desc,value:cr>0?cr:-Math.abs(db)}:null;}).filter(Boolean);}
function eParseOFX(content){const txns=[];const re=/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;let m;while((m=re.exec(content))!==null){const b=m[1],date=eParseDate(eGetTag(b,'DTPOSTED')),value=parseFloat(eGetTag(b,'TRNAMT')||'0'),desc=(eGetTag(b,'MEMO')||eGetTag(b,'NAME')||'Sem descrição').trim();if(date)txns.push({date,desc,value});}if(txns.length>0)return txns;const lines=content.split('\n');let cur={};for(const line of lines){const t=line.trim();if(t==='<STMTTRN>'){cur={};continue}if(t==='</STMTTRN>'){if(cur.date&&cur.value!==undefined)txns.push({...cur});cur={};continue}const mm=t.match(/^<([A-Z]+)>(.+)$/);if(mm){const[,tg,v]=mm;if(tg==='DTPOSTED')cur.date=eParseDate(v);if(tg==='TRNAMT')cur.value=parseFloat(v)||0;if((tg==='MEMO'||tg==='NAME')&&!cur.desc)cur.desc=v.trim();}}return txns;}
function eGetTag(str,name){const r=new RegExp(`<${name}>([^<]+)`,'i');const m=str.match(r);return m?m[1].trim():null;}
function eParseGeneric(lines){if(lines.length<2)return[];const sep=eDetectSep(lines[0]);const hdr=eSplitCSV(lines[0],sep).map(c=>c.toLowerCase().replace(/"/g,'').trim());const ci=h=>{for(const n of h){const i=hdr.findIndex(x=>x.includes(n));if(i>=0)return i;}return -1;};const iDt=ci(['data','date','dt lançamento','dt mov']);const iDsc=ci(['descrição','descricao','histórico','historico','memo','title','nome','name']);const iVl=ci(['valor','value','amount','vlr']);const iCr=ci(['crédito','credito','créd']);const iDb=ci(['débito','debito','déb']);return lines.slice(1).filter(l=>l.trim()).map(l=>{const c=eSplitCSV(l,sep);if(c.length<2)return null;const date=iDt>=0?eParseDate(c[iDt]):eParseDate(c[0]);const desc=iDsc>=0?c[iDsc].replace(/"/g,'').trim():c[1]?.trim()||'';let value=0;if(iVl>=0)value=eParseBRL(c[iVl]);else if(iCr>=0&&iDb>=0){const cr=eParseBRL(c[iCr]||''),db=eParseBRL(c[iDb]||'');value=cr>0?cr:-Math.abs(db);}else for(let j=c.length-1;j>=0;j--){const v=eParseBRL(c[j]);if(!isNaN(v)&&v!==0){value=v;break}}return desc?{date,desc,value}:null;}).filter(Boolean);}
async function eParsePDF(buffer){
  const copy=buffer.slice(0);
  let pdf;
  try {
    const loadTask = pdfjsLib.getDocument({data:copy});
    const timeout = new Promise((_,rej)=>setTimeout(()=>rej(new Error('PDF timeout')), ENGINE_CONFIG.PDF_TIMEOUT_MS));
    try {
      pdf = await Promise.race([loadTask.promise, timeout]);
    } catch(e) {
      throw new Error('PDF corrompido ou ilegível: ' + e.message);
    }
    if (pdf.numPages > ENGINE_CONFIG.PDF_MAX_PAGES) {
      throw new Error('PDF com mais de ' + ENGINE_CONFIG.PDF_MAX_PAGES + ' páginas. Exporte apenas o período necessário (ex: 12 meses).');
    }
    let text = '';
    const MAX_TEXT_CHARS = 400000; // ~400KB de texto — extrato de 12 meses tem ~50KB
    for(let p = 1; p <= pdf.numPages; p++){
      // yield a cada página — não trava a UI durante parse de PDFs grandes
      await new Promise(r => setTimeout(r, 0));
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      let lastY = null, line = '';
      for(const item of tc.items){
        const y = Math.round(item.transform[5]);
        if(lastY !== null && Math.abs(y - lastY) > 3){ text += line.trim() + '\n'; line = ''; }
        line += (item.str || '') + ' ';
        lastY = y;
      }
      if(line.trim()) text += line.trim() + '\n';
      page.cleanup();
      // Limite por volume de texto — evita processar PDFs de centenas de páginas
      if(text.length > MAX_TEXT_CHARS) {
        console.warn('[GuardiaoFiscal] PDF truncado em ' + p + ' páginas por volume de texto');
        break;
      }
    }
    // Detecção de PDF escaneado — texto extraído é muito curto para ter transações
    if(text.replace(/\s/g, '').length < 100) {
      throw new Error('PDF_ESCANEADO');
    }
    return text;
  } finally {
    if(pdf) await pdf.destroy();
  }
}
function eParsePDFText(text){
  const lines = text.split('\n').filter(l => l.trim());
  const u = text.substring(0, 2000).toUpperCase();

  // ── Detecção de banco pelo conteúdo do PDF ──
  const isNubank    = u.includes('NUBANK') || u.includes('NU PAGAMENTOS');
  const isInter     = u.includes('BANCO INTER') || u.includes('INTERMEDIUM') || u.includes('INTER S/A');
  const isItau      = u.includes('ITAÚ') || u.includes('ITAU UNIBANCO');
  const isBradesco  = u.includes('BRADESCO');
  const isBB        = u.includes('BANCO DO BRASIL') || u.includes('BANCOBRASIL');
  const isCaixa     = u.includes('CAIXA ECONÔMICA') || u.includes('CAIXA ECONOMICA') || u.includes('CEF');
  const isSantander = u.includes('SANTANDER');
  const isC6        = u.includes('C6 BANK') || u.includes('C6BANK');
  const isSicoob    = u.includes('SICOOB');
  const isSicredi   = u.includes('SICREDI');

  // Parser Nubank — formato: "DD MMM · Descrição R$ X,XX"
  if (isNubank) {
    const txns = [];
    const reNu = /(\d{2}\s+\w{3})\s+(.+?)\s+R?\$?\s*([\-\+]?\d[\d.,]+)\s*$/;
    const months = {jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
    for(const line of lines){
      const m = line.match(reNu);
      if(!m) continue;
      const parts = m[1].trim().split(/\s+/);
      const day = parseInt(parts[0]), monStr = (parts[1]||'').toLowerCase().substring(0,3);
      const mon = months[monStr];
      if(!day || !mon) continue;
      const year = new Date().getFullYear();
      const date = new Date(year, mon-1, day);
      if(isNaN(date.getTime())) continue;
      const value = eParseBRL(m[3].replace(/\s/g,''));
      if(m[2].trim() && value !== 0) txns.push({date, desc: m[2].trim(), value: -Math.abs(value)});
    }
    if(txns.length > 0) return txns;
  }

  // Parser Inter — formato tabular: "DD/MM/YYYY Descrição Valor"
  if (isInter) {
    const txns = [];
    const reInter = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\-\+]?\d[\d.,]+(?:,\d{2})?)\s*$/;
    for(const line of lines){
      const m = line.match(reInter);
      if(!m) continue;
      const date = eParseDate(m[1]);
      const value = eParseBRL(m[3]);
      if(date && m[2].trim() && value !== 0) txns.push({date, desc: m[2].trim(), value});
    }
    if(txns.length > 0) return txns;
  }

  // Parser Itaú — formato: "DD/MM HISTÓRICO VALOR DOC"
  if (isItau) {
    const txns = [];
    const reItau = /(\d{2}\/\d{2})\s+(.+?)\s+([\-\+]?\d[\d.,]+(?:,\d{2})?)\s*(?:[\d.,]+)?\s*$/;
    const year = new Date().getFullYear();
    for(const line of lines){
      const skip = /saldo|total|data|histórico|extrato|itaú/i;
      if(skip.test(line)) continue;
      const m = line.match(reItau);
      if(!m) continue;
      const date = eParseDate(m[1] + '/' + year);
      const value = eParseBRL(m[3]);
      if(date && m[2].trim() && value !== 0) txns.push({date, desc: m[2].trim(), value});
    }
    if(txns.length > 0) return txns;
  }

  // Parser Bradesco — formato: "DD/MM/YYYY Documento Histórico Valor"
  if (isBradesco) {
    const txns = [];
    const reBrad = /(\d{2}\/\d{2}\/\d{4})\s+\d*\s+(.+?)\s+([\-\+]?\d[\d.,]+(?:,\d{2})?)\s*$/;
    for(const line of lines){
      const skip = /saldo|total|data|histórico|extrato|bradesco/i;
      if(skip.test(line)) continue;
      const m = line.match(reBrad);
      if(!m) continue;
      const date = eParseDate(m[1]);
      const value = eParseBRL(m[3]);
      if(date && m[2].trim() && value !== 0) txns.push({date, desc: m[2].trim(), value});
    }
    if(txns.length > 0) return txns;
  }

  // Parser BB — formato: "DD/MM/YYYY Histórico Documento Valor"
  if (isBB) {
    const txns = [];
    const reBB = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+\d*\s+([\-\+]?\d[\d.,]+(?:,\d{2})?)\s*$/;
    for(const line of lines){
      const skip = /saldo|total|data|histórico|extrato|banco do brasil/i;
      if(skip.test(line)) continue;
      const m = line.match(reBB);
      if(!m) continue;
      const date = eParseDate(m[1]);
      const value = eParseBRL(m[3]);
      if(date && m[2].trim() && value !== 0) txns.push({date, desc: m[2].trim(), value});
    }
    if(txns.length > 0) return txns;
  }

  // Parser Caixa, Santander, C6, Sicoob, Sicredi e genérico
  // Regex genérica: DD/MM/YYYY? + descrição + valor no final da linha
  const skip = /saldo anterior|saldo final|data\s+descri|período|agência|conta\s*:|cliente|extrato|banco\s+/i;
  const re   = /(\d{2}[\/\-]\d{2}(?:[\/\-]\d{2,4})?)\s+(.+?)\s+([\-\+]?\s*\d[\d.,]*(?:\.\d{3})*(?:,\d{2})?)\s*(?:[\d.,]+)?\s*$/;
  const txns = [];
  for(const line of lines){
    if(skip.test(line)) continue;
    const m = line.match(re);
    if(!m) continue;
    const date = eParseDate(m[1]);
    const desc = m[2].trim();
    const value = eParseBRL(m[3].replace(/\s/g,''));
    if(date && desc && value !== 0) txns.push({date, desc, value});
  }
  // Se genérico também falhou, tenta eParseGeneric como último recurso
  return txns.length > 0 ? txns : eParseGeneric(lines);
}

// ═══════════════════════════════════════════════════════════════
// MOTOR DE COERÊNCIA FISCAL — Guardião Fiscal v2
// Baseado em: compatibilidade financeira, detecção comportamental,
// análise temporal, score tributário ponderado e explicação causal
// ═══════════════════════════════════════════════════════════════

// ── Dicionários de categorização semântica ──────────────────────
const CAT = {
  formal:    ['salário','salario','holerite','folha pgto','pagamento folha','fgts','inss','irrf','pro-labore','pró-labore','beneficio','benefício','aposentadoria','pensão','pensao','rendimento prev','13 salario','13° salario','férias','ferias','rescisão','rescisao','clt'],
  invest:    ['btc','bitcoin','cripto','crypto','ethereum','xrp','usdt','binance','foxbit','mercado bitcoin','novadax','tesouro direto','tesouro selic','tesouro ipca','dividendo','jscp','jcp','rendimento fundo','resgate cdb','resgate lci','resgate lca','resgate rdb','resgate fundo','rendimento aplicacao','rendimento poupanca'],
  aluguel:   ['aluguel','locação','locacao','imóvel','imovel','alugar','locatário','locatario'],
  comercial: ['ifood','rappi','uber eats','99food','shopee','mercado livre','mercadolivre','ame digital','pagseguro','mercado pago','stone','cielo','getnet','rede ','sumup','ton ','pagar.me','venda','vend.','nota fiscal','nf-e','recebimento vendas','vendas online'],
  // P04: equipamentos de criador de conteúdo — despesa profissional, não consumo pessoal
  equip_creator: ['ring light','anel de luz','microfone','tripé','tripe','softbox','lente camera','lente câmera','estabilizador','drone dji','memoria sd','cartao sd','cabo hdmi','placa de video','placa de captura','mixer audio','interface audio'],
  especie:   ['saque','caixa eletronico','atm','deposito especie','dep especie','deposito em especie','dinheiro','cdas','cofre'],
  // marcador interno: depósito espécie precedido de saque de valor similar no mesmo dia/dia anterior
  // sera resolvido em applyInternalDetection via pares saque→especie
  interno:   ['entre contas','conta própria','conta propria','transferência interna','transf interna','tid própria','tid propria','portabilidade'],
  pix:       ['pix recebido','pix credit','recebido pix','pix enviado','pix debitado','chave pix'],
  transf:    ['transferência recebida','transferencia recebida','ted recebida','doc recebido','depósito recebido','deposito recebido','transf. recebida','transf recebida'],
};

function catMatch(desc, cats) {
  const d = desc.toLowerCase();
  return cats.some(k => d.includes(k));
}

// ── Classificação por natureza econômica ─────────────────────
// Determina a NATUREZA do crédito antes de calcular risco.
// Isso evita falsos positivos: um reembolso, empréstimo ou venda de bem
// tem aparência de "crédito suspeito" mas não é renda nova tributável.
//
// Naturezas: renda_trabalho | renda_capital | transf_propria |
//            emprestimo | devolucao_reembolso | alienacao_bem |
//            heranca_doacao | fgts_rescisao |
//            receita_recorrente | indefinida
//
// IMPORTANTE: a ordem importa — fgts_rescisao e heranca_doacao devem vir
// ANTES de renda_trabalho para evitar que "FGTS" ou "rescisão" sejam capturados
// pela regra genérica antes de chegar na regra específica de isenção.
const NATUREZA_KW = {
  // [v4-NEW] FGTS e verbas rescisórias — PRIMEIRO para não cair em renda_trabalho
  // isentas de IR (art. 6º Lei 7.713/88)
  fgts_rescisao: [
    'fgts rescisão','fgts rescisao','saldo fgts','liberação fgts','liberacao fgts',
    'verba rescisória','verba rescisoria','indenização rescisória','indenizacao rescisoria',
    'aviso prévio','aviso previo','multa fgts','multa 40%','rescisão contrato',
    'rescisao contrato','acerto rescisório','acerto rescisorio','verbas indenizatórias',
    'verbas indenizatorias',
  ],
  // [v4-NEW] Herança e doação — PRIMEIRO para não cair em outros fatores
  // isentas de IR para o beneficiário (ITCMD é do doador/espólio)
  heranca_doacao: [
    'herança','heranca','doação','doacao','inventário','inventario','espólio','espolio',
    'itcmd','itcd','causa mortis','partilha','meação','meacao','legado','testamento',
    'transferência herança','recebimento herança','doação familiar',
  ],
  renda_trabalho: [
    'salário','salario','holerite','folha pgto','pagamento folha','inss','irrf',
    'pro-labore','pró-labore','beneficio','benefício','aposentadoria','pensão','pensao',
    'rendimento prev','13 salario','13° salario','férias','ferias',
    'clt','rpa ','mei ','honorarios','honorários',
    'plr','participacao lucros','participação lucros','bonus','bônus',
    'participação resultados','participacao resultados','ppr ','premio ','prêmio ',
    'gratificacao','gratificação','adicional','bonificacao','bonificação',
  ],
  renda_capital: [
    'dividendo','dividendos','jscp','jcp','rendimento fundo','resgate cdb','resgate lci','resgate lca',
    'resgate rdb','resgate fundo','rendimento aplicacao','rendimento poupanca',
    'tesouro direto','tesouro selic','tesouro ipca','btc','bitcoin','cripto','ethereum',
    // P05: FII e ações — rendimentos de capital, isentos ou com tributação específica
    'rendimento fii','fii rendimento','rendimento fiagro','rendimento cri','rendimento cra',
    'proventos ações','proventos acoes','proventos fii','rendimento reit',
    'venda acoes','venda ações','liquido venda','liq venda','liquido operacao',
    'ganho capital','ganho de capital',
    // Corretoras: créditos de operações — não são renda do trabalho
    'xp investimentos','rico corretora','clear corretora','modal mais','btg pactual invest',
    'avenue securities','nuinvest','inter invest',
  ],
  transf_propria: [
    'entre contas','conta própria','conta propria','transferência interna','transf interna',
    'tid própria','tid propria','portabilidade','conta corrente propria','mesma titularidade',
    'minha conta','meu banco','conta salario propria','conta digital propria',
    'nubank propria','inter propria','c6 propria','bradesco propria','itau propria',
    'santander propria','caixa propria','bb propria','sicoob propria','sicredi propria',
    // P05: movimentações de conta investimento → não são renda nova
    'ted corretora','ted retorno corretora','retorno corretora','aporte corretora',
    'transferencia corretora','ted xp ','ted rico ','ted clear ','ted modal ','ted btg ',
    'ted avenue','ted inter invest','ted nubank invest','ted itau invest',
    'resgate corretora','aporte investimento','transferencia investimento',
  ],
  retirada_empresa: [
    // P06: retiradas societárias com labels ambíguos — renda tributável não declarada
    'antecipacao lucro','antecipação lucro','distribuicao lucro','distribuição lucro',
    'retirada socio','retirada sócio','pro labore','pró labore','prolabore',
    'sangria empresa','retirada empresa','distribuicao isenta','distribuição isenta',
    'antecipacao de resultado','antecipação resultado',
  ],
  emprestimo: [
    'empréstimo','emprestimo','crédito pessoal','credito pessoal','financiamento recebido',
    'cdc ','fgts emprestimo','adiantamento salario','antecipação','antecipacao',
    'cheque especial','limite','liberação crédito','liberacao credito',
    // empréstimo formalizado — não é renda nova
    'ccb ','cédula de crédito','cedula de credito','cédula bancária','cedula bancaria',
    'emprestimo bancario','empréstimo bancário','emprestimo consignado','empréstimo consignado',
    'crédito consignado','credito consignado','refinanciamento','portabilidade credito',
    'portabilidade crédito','emprestimo entre amigos','emprestimo familiar',
    'contrato emprestimo','mutuo ','mútuo ','liberacao emprestimo','liberação empréstimo',
    'credito liberado emprestimo','parcela emprestimo',
  ],
  devolucao_reembolso: [
    'reembolso','ressarcimento','devolução','devolucao','estorno','cancelamento',
    'chargeback','restituição','restituicao','reemb.','devol.','refund',
    'cashback','volta ','retorno ','crédito cancelamento',
  ],
  alienacao_bem: [
    'venda imóvel','venda imovel','venda veículo','venda veiculo','venda carro',
    'venda moto','alienação','alienacao','escritura','cartório','cartorio',
    'leilão','leilao','consórcio recebido','consoricio recebido',
  ],
  aposta_jogo: [
    'bet365','sportingbet','betano','pixbet','betnacional','estrela bet','esportiva bet',
    'blaze','fortune tiger','vai de bet','betfair','superbet','galera bet','br4 bet',
    'casino','cassino','jogo online','aposta esportiva','loteria','mega sena',
  ],
};

function detectNatureza(desc) {
  const d = desc.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [natureza, kws] of Object.entries(NATUREZA_KW)) {
    if (kws.some(k => d.includes(k.normalize('NFD').replace(/[̀-ͯ]/g, '')))) {
      return natureza;
    }
  }
  return 'indefinida';
}

// ── Classificador semântico de transação ───────────────────────
function detectChannel(desc) {
  // Identifica o canal da transação para schema canônico
  const d = normalizeDesc(desc);
  if (d.includes('pix')) return 'pix';
  if (d.includes('ted') || d.includes('doc recebido')) return 'ted';
  if (d.includes('saque') || d.includes('caixa eletronico') || d.includes('atm')) return 'saque';
  if (d.includes('deposito especie') || d.includes('dep especie') || d.includes('deposito em especie')) return 'especie';
  if (d.includes('entre contas') || d.includes('conta propria') || d.includes('transf interna')) return 'proprio';
  if (d.includes('cartao') || d.includes('credito') || d.includes('debito')) return 'cartao';
  if (d.includes('boleto') || d.includes('tributo') || d.includes('pagamento')) return 'boleto';
  return 'outros';
}

function eClassifyTxn(t) {
  const d       = normalizeDesc(t.desc);
  const v       = t.value;
  const channel = detectChannel(t.desc);
  // Natureza econômica — determina o "porquê" do crédito antes de avaliar risco
  const natureza = v > 0 ? detectNatureza(t.desc) : 'saida';

  if (v <= 0) return { risk: 'normal', flag: null, cat: 'saida', channel, natureza };

  // ── Naturezas que não constituem renda nova tributável ──────
  // Transferência própria: dinheiro mudando de conta, não de patrimônio
  if (channel === 'proprio' || catMatch(d, CAT.interno) || natureza === 'transf_propria')
    return { risk: 'normal', flag: null, cat: 'interno', channel, natureza };

  // Empréstimo recebido: passivo, não renda — não vai à malha fina por si só
  if (natureza === 'emprestimo')
    return { risk: 'normal', flag: 'Empréstimo', cat: 'emprestimo', channel, natureza };

  // Devolução/reembolso: retorno de dinheiro já tributado
  if (natureza === 'devolucao_reembolso')
    return { risk: 'normal', flag: 'Reembolso', cat: 'reembolso', channel, natureza };

  // [v4-NEW] Herança e doação: isenta de IR para o beneficiário (ITCMD é obrigação do espólio/doador)
  if (natureza === 'heranca_doacao')
    return { risk: 'normal', flag: 'Herança/Doação', cat: 'reembolso', channel, natureza };

  // [v4-NEW] FGTS e verbas rescisórias: isentas de IR (art. 6º Lei 7.713/88)
  if (natureza === 'fgts_rescisao')
    return { risk: 'normal', flag: 'FGTS/Rescisão', cat: 'reembolso', channel, natureza };

  // Alienação de bem: tributação via ganho de capital (declarado separado)
  // Mantém atenção pois exige DARF de ganho de capital se houver lucro
  if (natureza === 'alienacao_bem')
    return { risk: 'attention', flag: 'Venda de bem', cat: 'alienacao', channel, natureza };

  // ── Renda do trabalho — baixo risco, já declarável via holerite ──
  if (catMatch(d, CAT.formal) || natureza === 'renda_trabalho')
    return { risk: 'normal', flag: 'Renda formal', cat: 'formal', channel, natureza };

  // ── Renda de capital — atenção (declaração obrigatória) ──────
  if (catMatch(d, CAT.invest) || natureza === 'renda_capital')
    return { risk: 'attention', flag: 'Investimento', cat: 'invest', channel, natureza };

  // Aluguel recebido — atenção
  if (catMatch(d, CAT.aluguel))
    return { risk: 'attention', flag: 'Aluguel', cat: 'aluguel', channel, natureza };

  // Atividade comercial — atenção
  if (catMatch(d, CAT.comercial))
    return { risk: 'attention', flag: 'Comercial', cat: 'comercial', channel, natureza };

  // Depósito em espécie — alto risco
  if (catMatch(d, CAT.especie)) {
    if (v >= 3000) return { risk: 'suspicious', flag: 'Espécie ≥ R$3k', cat: 'especie', channel, natureza };
    return { risk: 'attention', flag: 'Espécie', cat: 'especie', channel, natureza };
  }

  // Pix recebido — risco gradual por valor
  const isPix   = catMatch(d, CAT.pix) || (d.includes('pix') && v > 0);
  const isTransf = catMatch(d, CAT.transf) || (d.includes('transf') && v > 0 && !catMatch(d, CAT.interno));

  if (isPix || isTransf) {
    if (v >= 10000) return { risk: 'suspicious', flag: 'Pix ≥ R$10k', cat: 'pix', channel, natureza };
    if (v >= 5000)  return { risk: 'suspicious', flag: 'Pix ≥ R$5k',  cat: 'pix', channel, natureza };
    if (v >= 2000)  return { risk: 'attention',  flag: 'Pix relevante', cat: 'pix', channel, natureza };
    if (v >= 500)   return { risk: 'attention',  flag: 'Pix', cat: 'pix', channel, natureza };
    // PIX pequenos (< R$50): padrão de vaquinha/racha/grupo — baixo risco individual
    // A recorrência desses valores entre MUITOS remetentes distintos
    // é tratada em detectarRecorrencia com threshold mais alto
    if (v < 50)     return { risk: 'normal', flag: null, cat: 'pix_pequeno', channel, natureza };
    return { risk: 'normal', flag: null, cat: 'pix', channel, natureza };
  }

  // Crédito genérico alto — natureza indefinida é onde mora o risco real
  if (v >= 15000) return { risk: 'suspicious', flag: 'Crédito alto', cat: 'outros', channel, natureza };
  if (v >= 5000)  return { risk: 'attention',  flag: 'Valor relevante', cat: 'outros', channel, natureza };

  return { risk: 'normal', flag: null, cat: 'outros', channel, natureza };
}

// ── Detecção de recorrência comportamental ─────────────────────
function detectarRecorrencia(txns) {
  // Agrupa por descrição normalizada e detecta padrões de frequência
  // [v6-FIX-F] Excluir créditos formais (salário, FGTS) da análise de recorrência comercial
  // [fix-CLT] _formalKw expandido para cobrir todos os termos de renda formal
  // Sem 'holerite', 'aposentadoria', 'pensao', etc → falso positivo F4
  const _formalKw = [
    'salario','salário','holerite','folha pgto','pagamento folha','folha pagamento',
    'pagamento salario','pagamento salário','fgts','inss','irrf',
    '13 salario','13 salário','13° salario','ferias','férias',
    'rescisao','rescisão','pro-labore','pró-labore','clt',
    'beneficio','benefício','aposentadoria','pensao','pensão',
    'rendimento prev','inss previdencia','inss previdência',
    'bolsa estagio','bolsa estágio','estagio remunerado','estágio remunerado',
  ];
  const _isFormal = d => _formalKw.some(k => d.toLowerCase().includes(k));
  // [fix-bug4] Excluir entradas cross-bank: entrada Pix com saída de mesmo valor no mesmo dia
  // "PIX RECEBIDO NUBANK" no mesmo dia que "PIX ENVIADO NUBANK -5000" = transferência própria
  const _crossBankIdx = new Set();
  const _pixPorDiaValor = {};
  txns.forEach((t, idx) => {
    if (!t.date || !(t.date instanceof Date) || isNaN(t.date)) return;
    const isPix = (t.desc||'').toLowerCase().includes('pix');
    if (!isPix) return;
    const chave = Math.abs(t.value).toFixed(2) + '|' + t.date.toISOString().slice(0,10);
    if (!_pixPorDiaValor[chave]) _pixPorDiaValor[chave] = { pos: [], neg: [] };
    if (t.value > 0) _pixPorDiaValor[chave].pos.push(idx);
    else             _pixPorDiaValor[chave].neg.push(idx);
  });
  Object.values(_pixPorDiaValor).forEach(({ pos, neg }) => {
    if (pos.length > 0 && neg.length > 0) {
      const n = Math.min(pos.length, neg.length);
      for (let i = 0; i < n; i++) { _crossBankIdx.add(pos[i]); _crossBankIdx.add(neg[i]); }
    }
  });
  // Também excluir entradas com keywords de conta própria/transferência interna
  const _propKw = ['conta propria','conta própria','propria conta','nubank propria','inter propria',
                   'transferencia propria','transf propria','mesma titularidade','portabilidade'];
  const _isPropria = d => _propKw.some(k => (d||'').toLowerCase().includes(k));
  // Remetentes bidirecionais: pessoas que aparecem como EMISSORES e RECEPTORES
  // de PIX frequentemente = troca familiar/parceiro, não renda comercial
  // Deduz pelo senderName se disponível, senão pela descrição normalizada
  const _saldoLiqPorRemetente = {};
  txns.forEach(t => {
    const nome = t.senderName || normalizeDesc(t.desc).replace(/^pix\s+(recebido|enviado)\s*/i,'').slice(0,30);
    if(!_saldoLiqPorRemetente[nome]) _saldoLiqPorRemetente[nome] = {cred:0, deb:0, count:0};
    if(t.value > 0) { _saldoLiqPorRemetente[nome].cred += t.value; _saldoLiqPorRemetente[nome].count++; }
    else            { _saldoLiqPorRemetente[nome].deb  += Math.abs(t.value); }
  });
  // Bidirecional: envia >= 30% do que recebe E recebe pelo menos R$500
  const _isBidirecional = nome => {
    const s = _saldoLiqPorRemetente[nome];
    if(!s || s.cred < 500) return false;
    return (s.deb / s.cred) >= 0.30;
  };

  const grupos = {};
  txns.filter((t, idx) => {
    if(t.value <= 0) return false;
    if(_isFormal(t.desc)) return false;
    if(_crossBankIdx.has(idx)) return false;
    if(_isPropria(t.desc)) return false;
    // [fix-P05] Excluir créditos de investimento — dividendos/TED corretora/resgates não são atividade comercial
    const _d = (t.desc||'').toLowerCase();
    const _investKw = ['dividend','dividendo','fii','cri','cra','lci','lca','cdb','ltn','ntn','tesouro','ação','acao',
      'ted recebida xp','ted recebida btg','ted recebida rico','ted recebida clear','ted recebida nu invest',
      'resgate cdb','resgate lci','resgate lca','resgate renda fixa','rendimento investimento',
      'investimentos cctvm','corretora','bolsa de valores','b3 '];
    if(_investKw.some(k => _d.includes(k))) return false;
    // Excluir remetentes bidirecionais — padrão familiar, não comercial
    const nome = t.senderName || normalizeDesc(t.desc).replace(/^pix\s+(recebido|enviado)\s*/i,'').slice(0,30);
    if(_isBidirecional(nome)) return false;
    return true;
  }).forEach(t => {
    const chave = t.desc.toLowerCase()
      .replace(/\d{2}\/\d{2}\/\d{4}/g, '')
      .replace(/\d{2}\/\d{2}/g, '')
      .replace(/r\$[\d.,]+/gi, '')
      .replace(/\s+/g, ' ').trim().substring(0, 40);
    if (!grupos[chave]) grupos[chave] = { count: 0, total: 0, valores: [] };
    grupos[chave].count++;
    grupos[chave].total += t.value;
    grupos[chave].valores.push(t.value);
  });

  const recorrentes = Object.entries(grupos)
    .filter(([, g]) => g.count >= 4)
    .map(([desc, g]) => {
      const media = g.total / g.count;
      const desvioPct = g.valores.length > 1
        ? Math.sqrt(g.valores.reduce((a, v) => a + Math.pow(v - media, 2), 0) / g.valores.length) / media
        : 0;
      return { desc, count: g.count, total: g.total, media, desvioPct };
    });

  // Recorrência com ticket parecido = sinal de atividade comercial
  // Threshold mais seletivo: exige 8+ ocorrências (antes era 6) e valor médio >= R$400
  // para reduzir falsos positivos em autônomos com clientes fixos declaráveis
  const _kwEmpresa = ['ltda','s/a','sa ','me ','eireli','mei ','cnpj','empresa','comercio','servicos','consultoria','industria'];
  const _temVinculoDeclaravel = d => _kwEmpresa.some(k => d.toLowerCase().includes(k));
  const comercialOculta = recorrentes.filter(r =>
    r.desvioPct < 0.25 &&   // ticket ainda mais regular (era 0.30)
    r.count >= 8 &&          // mais ocorrências exigidas (era 6)
    r.media >= 400 &&        // valor mínimo maior (era 200)
    !_temVinculoDeclaravel(r.desc) // não conta se parece empresa/CNPJ declarável
  );
  return { recorrentes, comercialOculta };
}

// ── Análise temporal — variação mensal com mediana + MAD ─────
// Usa mediana como baseline e MAD como dispersão — robusto contra outliers pontuais
// (ex: mês de rescisão, venda de bem, herança não distorce a "normalidade" do histórico)
function analiseTemporal(monthly) {
  const meses = Object.values(monthly).filter(m => m.total > 0);
  if (meses.length < 2) return { anomalias: [], mediaHistorica: 0, mediaMediana: 0, pico: 0 };

  const totais = meses.map(m => m.total);

  // Baseline robusta: mediana em vez de média
  const mediana = _median(totais);
  const mad     = _mad(totais, mediana);

  // Fallback para desvio padrão clássico se MAD = 0 (todos os meses iguais)
  const media  = totais.reduce((a, v) => a + v, 0) / totais.length;
  const desvio = Math.sqrt(totais.reduce((a, v) => a + Math.pow(v - media, 2), 0) / totais.length);

  const anomalias = meses.filter(m => {
    // Anomalia via MAD-z: |x - mediana| / (1.4826 * MAD)
    const zMad = mad > 0 ? Math.abs(m.total - mediana) / (1.4826 * mad) : 0;
    const zClassico = desvio > 0 ? Math.abs(m.total - media) / desvio : 0;
    const z = mad > 0 ? zMad : zClassico;
    return z > 1.8;
  });

  return {
    anomalias,
    mediaHistorica: mediana,
    mediaMedia:     media,
    pico: Math.max(...totais),
    // Pico excluindo créditos de natureza neutra (para F5 não ser disparado por empréstimo/alienação)
    picoRisco: Math.max(...totais), // será recalculado no motor com txns classificadas
  };
}

// ── Motor principal — análise de um extrato ────────────────────
// ── DETECCAO DE CIRCULARIDADE FINANCEIRA ─────────────────────
// Dinheiro que entra e sai em <= CIRCULAR_HOURS horas
function detectarCircularidade(txns) {
  // [v6-FIX-E] Converter date string DD/MM/YYYY para timestamp antes de comparar
  function toTs(d) {
    if (!d) return 0;
    if (typeof d === 'number') return d;
    const p = String(d).split('/');
    if (p.length === 3) return new Date(+p[2], +p[1]-1, +p[0]).getTime();
    return new Date(d).getTime() || 0;
  }
  const sample = txns.length > 500 ? txns.slice(-500) : txns;
  const sorted = sample.slice().sort((a, b) => toTs(a.date) - toTs(b.date));
  const eventos = [];
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (t.value <= 0) continue;
    if (t.value < ENGINE_CONFIG.CIRCULAR_MIN_VALUE) continue; // ignorar entradas pequenas
    // procurar saida equivalente nas proximas CIRCULAR_HOURS horas
    const tTs = toTs(t.date);
    let saidaAcum = 0;
    for (let j = i + 1; j < sorted.length; j++) {
      const u = sorted[j];
      if (!u.date || !t.date) break;
      const diffH = (toTs(u.date) - tTs) / 3600000;
      if (diffH > ENGINE_CONFIG.CIRCULAR_HOURS) break;
      if (u.value < 0) saidaAcum += Math.abs(u.value);
    }
    const ratio = t.value > 0 ? saidaAcum / t.value : 0;
    if (ratio >= ENGINE_CONFIG.CIRCULAR_RATIO) {
      eventos.push({ entrada: t.value, saidaRatio: Math.round(ratio * 100), desc: t.desc });
    }
  }
  return eventos;
}

// ── DETECCAO DE SPLIT PIX ─────────────────────────────────────
// Series de Pix proximos ao threshold para evitar notificacao
function detectarSplitPix(txns) {
  const pixAltos = txns.filter(t =>
    t.date instanceof Date && !isNaN(t.date) &&
    t.value >= ENGINE_CONFIG.SPLIT_PIX_MIN &&
    t.value < ENGINE_CONFIG.PIX_LIMIT &&
    normalizeDesc(t.desc).includes('pix')
  ).sort((a, b) => (a.date || 0) - (b.date || 0));

  // [fix-F6] Extrair nome do remetente para comparar apenas split do mesmo remetente
  // "PIX RECEBIDO JOAO SILVA" → "joao silva"
  // "PIX RECEBIDO MARIA SOUZA" → "maria souza"
  // Sem remetente identificável: usar descrição normalizada completa
  function _extrairRemetente(desc) {
    const d = normalizeDesc(desc||'');
    // Remove prefixos comuns de Pix
    const semPrefixo = d
      .replace(/^pix\s+(recebido|enviado|transferencia|transf)\s*/i, '')
      .replace(/^recebido\s+de\s+/i, '')
      .trim();
    // Pega os 3 primeiros tokens (nome da pessoa/empresa) como assinatura
    return semPrefixo.split(/\s+/).slice(0,3).join(' ') || d.slice(0,20);
  }

  const series = [];
  for (let i = 0; i < pixAltos.length - 1; i++) {
    const a = pixAltos[i], b = pixAltos[i + 1];
    if (!a.date || !b.date) continue;
    const diffDays = (b.date - a.date) / 86400000;
    const valueDiff = Math.abs(a.value - b.value);
    // [fix-F6] Verificar mesmo remetente antes de detectar split
    const remetA = _extrairRemetente(a.desc);
    const remetB = _extrairRemetente(b.desc);
    const mesmoRemetente = remetA.length >= 3 && remetA === remetB;
    // P01: exige similaridade de valor para ser split — valores muito distintos
    // (ex: R$850 + R$120) são pagamentos separados, não split de R$970
    const _menorVal = Math.min(a.value, b.value);
    const _maiorVal = Math.max(a.value, b.value);
    const _similaridade = _menorVal / _maiorVal; // 1.0 = idênticos, 0 = completamente distintos
    const _eSplit = _similaridade >= 0.70; // exige pelo menos 70% de similaridade
    if (
      diffDays <= ENGINE_CONFIG.SPLIT_PIX_WINDOW &&
      valueDiff <= ENGINE_CONFIG.SPLIT_PIX_DELTA &&
      mesmoRemetente &&
      _eSplit  // P01: não penaliza pagamentos distintos do mesmo cliente
    ) {
      series.push({ valores: [a.value, b.value], diffDays: Math.round(diffDays), remetente: remetA });
    }
  }
  return series;
}

// ── CONFIDENCE SCORE ──────────────────────────────────────────
// Pontua a confianca da classificacao com base em sinais multiplos
function calcConfidence(signals) {
  // signals: array de booleanos/pesos que corroboram o risco
  const hits = signals.filter(Boolean).length;
  const base = hits / signals.length;
  // Escala nao-linear: 1 sinal = 0.4, 2 = 0.65, 3+ = 0.80+
  if (hits === 0) return 0.10;
  if (hits === 1) return 0.40;
  if (hits === 2) return 0.65;
  if (hits === 3) return 0.80;
  return Math.min(0.97, 0.80 + (hits - 3) * 0.05);
}

// ── DETECÇÃO DE MOVIMENTO INTERNO (mesmo titular) ───────────
// Documento: a Receita trata transferências entre contas do mesmo
// titular como lançamento específico — não conta como renda nova

function normalizeAccountId(v) {
  if (!v) return '';
  return String(v).replace(/\D/g, '').slice(-8);
}

function sameOwnerHeuristic(a, b) {
  if (!a || !b) return false;

  // 1. Mesmo banco + mesma conta (duplicata direta)
  if (a.bank && b.bank && a.bank === b.bank &&
      a.account && b.account &&
      normalizeAccountId(a.account) === normalizeAccountId(b.account)) return true;

  // 2. Bancos diferentes mas contas conhecidas — TED/PIX entre contas do titular
  // Se a descrição do crédito menciona o banco de onde saiu o débito (e vice-versa)
  if (a.bank && b.bank && a.bank !== b.bank) {
    const descA = normalizeDesc(a.desc);
    const descB = normalizeDesc(b.desc);
    const bankA = normalizeDesc(a.bank);
    const bankB = normalizeDesc(b.bank);
    // Crédito no banco B menciona banco A (ex: "TED do Inter" aparece no Nubank)
    if (descA.includes(bankB.split(' ')[0]) || descB.includes(bankA.split(' ')[0])) return true;
  }

  // 3. Mesmo nome do titular em ambas as transações
  if (a.ownerName && b.ownerName) {
    const x = normalizeDesc(a.ownerName);
    const y = normalizeDesc(b.ownerName);
    if (x && y && x === y && x.length > 3) return true;
  }

  // 3b. senderName do Inter — nome extraído do campo "Cp :CNPJ-Nome"
  // Se o remetente do crédito tem o mesmo nome que aparece nos débitos, é transferência própria
  if (a.senderName && b.senderName) {
    const sx = normalizeDesc(a.senderName);
    const sy = normalizeDesc(b.senderName);
    if (sx && sy && sx === sy && sx.length > 5) return true;
  }

  // 4. Descrições simétricas (TED enviada / TED recebida, mesmo valor)
  const sa = normalizeDesc(a.desc);
  const sb = normalizeDesc(b.desc);
  if (sa && sb) {
    // Ambas mencionam "ted" ou "doc" ou "pix" com valor idêntico
    const bothTransfer = /ted|doc|pix|transf/.test(sa) && /ted|doc|pix|transf/.test(sb);
    if (bothTransfer && Math.abs(Math.abs(a.value) - Math.abs(b.value)) <= 0.02) return true;
  }

  return false;
}

// Verifica se uma transação é provavelmente uma movimentação interna
// entre contas do mesmo titular (não conta como renda nova no score)
function isInternalTransfer(txn, allTxns, _byValue) {
  // 1. Detecção por keywords explícitas (alta confiança)
  const s = normalizeDesc(txn.desc);
  if (/transferencia entre contas|entre minhas contas|aporte|resgate/.test(s)) return 'confirmed';
  if (catMatch(s, CAT.interno)) return 'confirmed';
  if (txn.channel === 'proprio') return 'confirmed';
  // TED/DOC/PIX de/para mesma titularidade por keywords
  if (/transf.*propria|transf.*propri|conta.*propria|propri.*conta/.test(s)) return 'confirmed';

  // 2. Apenas créditos precisam ser verificados como internos
  //    (débitos não inflam o score de risco de renda)
  if (txn.value <= 0) return null;

  const k = Math.abs(txn.value).toFixed(2);
  const candidates = _byValue ? (_byValue.get(k) || []) : allTxns;

  // 3. Pareamento ida/volta cross-source — mesmo valor, janela de 3 dias, sentido oposto
  //    Detecta: TED saindo do banco A aparecendo como crédito no banco B
  const sameValueOpposite = candidates.filter(t =>
    t !== txn &&
    Math.abs(Math.abs(t.value) - Math.abs(txn.value)) <= 0.02 &&
    Math.sign(t.value) !== Math.sign(txn.value) &&
    t.date instanceof Date && txn.date instanceof Date &&
    Math.abs((t.date - txn.date) / 86400000) <= 3
  );

  if (sameValueOpposite.some(t => sameOwnerHeuristic(txn, t))) return 'probable';

  // 4. Mesmo valor, mesmo banco, janela de 1 dia (possível duplicata de arquivo)
  const espelhos = candidates.filter(t =>
    t !== txn &&
    Math.abs(t.value) === Math.abs(txn.value) &&
    Math.sign(t.value) === Math.sign(txn.value) &&  // mesmo sentido = possível duplicata
    t.bank === txn.bank &&
    t.date instanceof Date && txn.date instanceof Date &&
    Math.abs((t.date - txn.date) / 86400000) <= 1 &&
    normalizeDesc(t.desc).slice(0,20) === normalizeDesc(txn.desc).slice(0,20)
  );
  if (espelhos.length > 0) return 'uncertain';

  // 5. Crédito de valor exato igual a um débito recente no mesmo grupo
  //    com descrição indicando TED/PIX/DOC de saída
  const tedSaidas = candidates.filter(t =>
    t !== txn &&
    t.value < 0 &&
    Math.abs(Math.abs(t.value) - Math.abs(txn.value)) <= 0.02 &&
    t.date instanceof Date && txn.date instanceof Date &&
    Math.abs((t.date - txn.date) / 86400000) <= 2 &&
    /ted|doc|pix|transf/.test(normalizeDesc(t.desc))
  );
  if (tedSaidas.length > 0) return 'probable';

  return null;
}

// Aplica detecção interna no array de transações classificadas
// Retorna array com campo internalMove e riskWeight ajustado
function applyInternalDetection(classified) {
  // P02: Detectar saque PJ → depósito espécie PF (janela 2 dias, valor ±5%)
  // Marca depósitos em espécie que têm um saque de valor similar na janela como prováveis internos
  const _saques = classified.filter(t =>
    t.value < 0 &&
    (normalizeDesc(t.desc).includes('saque') || normalizeDesc(t.desc).includes('caixa eletronico') || normalizeDesc(t.desc).includes('atm'))
  );
  const _depositos_especie = classified.filter(t =>
    t.value > 0 && t.cat === 'especie'
  );
  const _especie_de_saque = new Set();
  _depositos_especie.forEach((dep, di) => {
    const depVal = dep.value;
    const depTs  = dep.date instanceof Date ? dep.date.getTime() : 0;
    for (const saq of _saques) {
      const saqVal = Math.abs(saq.value);
      const saqTs  = saq.date instanceof Date ? saq.date.getTime() : 0;
      const diffDays = Math.abs(depTs - saqTs) / 86400000;
      const diffPct  = Math.abs(depVal - saqVal) / saqVal;
      if (diffDays <= 2 && diffPct <= 0.05) {
        _especie_de_saque.add(di);
        break;
      }
    }
  });
  const _byValue = new Map();
  for (const t of classified) {
    const k = Math.abs(t.value).toFixed(2);
    if (!_byValue.has(k)) _byValue.set(k, []);
    _byValue.get(k).push(t);
  }
  return classified.map((txn, txnIdx) => {
    // P02: depósito espécie originado de saque próprio — reduz peso de espécie
    const _especieOrigem = _depositos_especie.indexOf(txn);
    if (_especieOrigem >= 0 && _especie_de_saque.has(_especieOrigem)) {
      return {
        ...txn,
        internalMove: 'probable',
        riskWeight: 0.1,
        flag: 'Depósito em espécie com saque de valor similar nos últimos 2 dias — provável movimentação própria',
      };
    }
    const result = isInternalTransfer(txn, classified, _byValue);
    if (!result) return txn;

    const riskWeight = result === 'confirmed' ? 0 :
                       result === 'probable'  ? 0.1 :
                       result === 'uncertain' ? 0.3 : 1;

    const flag = result === 'confirmed' ? 'Movimento interno — excluído do score' :
                 result === 'probable'  ? 'Provável transferência entre contas do mesmo titular' :
                 'Possível movimentação interna (baixo peso)';

    return {
      ...txn,
      internalMove: result,
      riskWeight,
      risk: result === 'confirmed' ? 'normal' :
            result === 'probable'  ? 'normal' : txn.risk,
      cat: result === 'confirmed' || result === 'probable' ? 'interno' : txn.cat,
      flag,
    };
  });
}

// ── ESTRUTURA CANÔNICA DE ALERTA ─────────────────────────────
// Cada alerta tem: code, title, weight, confidence, evidence[], severity
// Score final = soma(weight * confidence) por alerta ativo
function criarAlerta(code, title, weight, confidence, evidence, severity) {
  return { code, title, weight, confidence, evidence: evidence || [], severity: severity || 'medium' };
}

function scoreDeAlertas(alertas) {
  return Math.min(100, Math.round(
    alertas.reduce((acc, a) => acc + (a.weight * Math.min(1, a.confidence)), 0)
  ));
}

function eAnalyzeSingle(txns, bank, rendaDeclarada, perfilUsuario) {
  rendaDeclarada = rendaDeclarada || 0;
  perfilUsuario = perfilUsuario || null;
  // Multiplicadores de threshold por perfil — reduz falsos positivos
  // CLT: renda formal previsível → tolerância menor para anomalias
  // MEI/Autônomo: recebimentos variáveis são normais → tolerância maior para Pix recorrente e volume
  // Investidor/Aposentado: créditos de investimentos/benefícios → neutraliza F1 e F3
  // Normaliza perfis do quiz para os 3 perfis do motor
  const _perfilNorm = perfilUsuario === 'freelancer' ? 'mei'
    : perfilUsuario === 'socio' ? 'mei'
    : perfilUsuario === 'clt_extra' ? 'clt'
    : perfilUsuario;

  const _perfilMult = {
    pix:      _perfilNorm === 'mei' ? 1.5 : _perfilNorm === 'investidor' ? 1.4 : 1.0,
    comercial: _perfilNorm === 'mei' ? 0.4 : _perfilNorm === 'investidor' ? 0.6 : 1.0,
    especie:  1.0, // espécie é suspeita em todos os perfis
    f7compat: perfilUsuario === 'investidor' ? 0.5 : 1.0, // aposentado/investidor tem créditos que não são renda trabalho
  };
  // [fix-bug1b] Array vazio ou null → retornar objeto seguro com score=0 (não null/undefined)
  if (!txns || txns.length === 0) return {
    bank: bank||'', totalTxns: 0, creditCount: 0, totalCredits: 0, totalDebits: 0,
    pixTotal: 0, especieTotal: 0, formalTotal: 0, comercialTotal: 0,
    suspCount: 0, attCount: 0, monthsOverLimit: 0, months: 0,
    score: 0, confidence: 0, numEvidencias: 0,
    classified: [], fatores: [], recorrentes: [], comercialOculta: [],
    anomalias: [], mediaHistorica: 0, pico: 0, circularidade: [], splitPix: [],
    internos: [], quarterly: {}, perfil: {},
    mesCritico: null, indiceEspecie: 0, indiceConsumo: 0,
    extratoMuitoCurto: true, extratoCurto: false,
    parserConfidence: 0, txnsValidas: 0, txnsDescartadas: 0,
    tipoAnalise: 'indicador_compatibilidade_fiscal', versaoEngine: 'v7.0',
    rendaDeclarada: rendaDeclarada || 0, mesesAnalisados: 0,
  };

  // P6: Validar transacoes antes de processar
  const txnsValidas = txns.filter(isValidTxn);
  const parserConfidence = txns.length > 0 ? txnsValidas.length / txns.length : 0;
  const txnsDescartadas = txns.length - txnsValidas.length;
  // [fix-bug1] Extrato vazio após filtragem → retornar score=0 seguro
  if (txnsValidas.length === 0) return {
    bank, totalTxns: txns.length, creditCount: 0, totalCredits: 0, totalDebits: 0,
    pixTotal: 0, especieTotal: 0, formalTotal: 0, comercialTotal: 0,
    suspCount: 0, attCount: 0, monthsOverLimit: 0, months: 0,
    score: 0, confidence: 0, numEvidencias: 0,
    classified: [], fatores: [], recorrentes: [], comercialOculta: [],
    anomalias: [], mediaHistorica: 0, pico: 0, circularidade: [], splitPix: [],
    internos: [], quarterly: {}, perfil: {},
    mesCritico: null, indiceEspecie: 0, indiceConsumo: 0,
    extratoMuitoCurto: true, extratoCurto: false,
    parserConfidence: 0, txnsValidas: 0, txnsDescartadas,
    tipoAnalise: 'indicador_compatibilidade_fiscal', versaoEngine: 'v7.0',
    rendaDeclarada: rendaDeclarada || 0, mesesAnalisados: 0,
  };

  // P1+P3: Agregacao mensal canonica usando aggregateMonthly()
  const monthly = aggregateMonthly(txnsValidas);

  // Compat: mapear para estrutura antiga usada pelo resto do codigo
  Object.entries(monthly).forEach(([k, m]) => {
    monthly[k].total     = m.credits;
    monthly[k].totalDebito = m.debits;
    monthly[k].pix       = m.pixIn;
    monthly[k].pixDebito = m.pixOut;
    monthly[k].especie   = m.cashIn;
    monthly[k].consolidado = m.pixConsolidado;
    monthly[k].count     = m.count;
  });

  // P4: Perfil historico — medias de 3/6/12 meses
  const perfil = calcProfile(monthly);

  // Analise trimestral — padrao de 3 meses consecutivos
  // [fix-raiz] quarterly é calculado ANTES de classified estar disponível.
  // Será recalculado abaixo após classified com pixConsolidadoLiquido.
  const quarterly = {};
  Object.entries(monthly).forEach(([k, m]) => {
    if (k === 'unk') return;
    const [y, mo] = k.split('-').map(Number);
    const q = y + '-Q' + Math.ceil(mo / 3);
    if (!quarterly[q]) quarterly[q] = { total: 0, pix: 0, consolidado: 0, meses: 0 };
    quarterly[q].total += m.credits;
    quarterly[q].pix += m.pixIn;
    quarterly[q].consolidado += m.pixConsolidado;
    quarterly[q].meses++;
  });

  // Ordem: classify → isInternal → score (dedup já aplicado antes via deduplicateTxns)
  const classifiedRaw = txns.map(t => ({ ...t, ...eClassifyTxn(t), bank }));
  // Aplica detecção de movimento interno antes de calcular risco
  const classified  = applyInternalDetection(classifiedRaw);

  // [fix-raiz] Reconstruir quarterly com pixConsolidadoLiquido
  // Exclui do consolidado Pix os movimentos internos (cross-bank, conta própria)
  // e os pares entrada+saída de mesmo valor no mesmo dia (transferências)
  const _pixInternosMes = {};
  classified.forEach(t => {
    if (!t.date || !(t.date instanceof Date)) return;
    const mesK = t.date.getFullYear()+'-'+String(t.date.getMonth()+1).padStart(2,'0');
    const isInterno = t.internalMove==='confirmed' || t.internalMove==='probable'
                   || t.natureza==='transf_propria' || t.cat==='interno';
    const isPix = normalizeDesc(t.desc||'').includes('pix');
    if (isInterno && isPix) {
      _pixInternosMes[mesK] = (_pixInternosMes[mesK]||0) + Math.abs(t.value);
    }
  });
  // Reconstituir quarterly com consolidado líquido
  Object.keys(quarterly).forEach(q => quarterly[q].consolidadoLiquido = 0);
  Object.entries(monthly).forEach(([k, m]) => {
    if (k === 'unk') return;
    const [y, mo] = k.split('-').map(Number);
    const q = y + '-Q' + Math.ceil(mo / 3);
    if (quarterly[q]) {
      const _interno = _pixInternosMes[k] || 0;
      quarterly[q].consolidadoLiquido += Math.max(0, m.pixConsolidado - _interno);
    }
  });
  const credits     = classified.filter(t => t.value > 0);
  const debits      = classified.filter(t => t.value < 0);
  // Naturezas que não constituem renda nova tributável — excluídas do cálculo de risco F1
  const _naturezasNeutras = new Set(['transf_propria','emprestimo','devolucao_reembolso','interno','saida','heranca_doacao','fgts_rescisao']);
  // Internos confirmados/prováveis + naturezas neutras excluídos do cálculo de risco
  const creditsRisco = credits.filter(t =>
    (!t.internalMove || t.internalMove === 'uncertain') &&
    !_naturezasNeutras.has(t.natureza) &&
    t.cat !== 'interno' && t.cat !== 'emprestimo' && t.cat !== 'reembolso'
  );
  const suspicious  = classified.filter(t => t.risk === 'suspicious' && t.value > 0 && t.riskWeight !== 0);
  const attention   = classified.filter(t => t.risk === 'attention'  && t.value > 0);
  const internos    = classified.filter(t => t.internalMove === 'confirmed' || t.internalMove === 'probable');

  const totalCredits  = credits.reduce((a, t) => a + t.value, 0);
  const totalDebits   = Math.abs(debits.reduce((a, t) => a + t.value, 0));
  const pixTotal      = credits.filter(t => t.cat === 'pix').reduce((a, t) => a + t.value, 0);
  const especieTotal  = credits.filter(t => t.cat === 'especie').reduce((a, t) => a + t.value, 0);
  const formalTotal   = credits.filter(t => t.cat === 'formal').reduce((a, t) => a + t.value, 0);
  const comercialTotal= credits.filter(t => t.cat === 'comercial').reduce((a, t) => a + t.value, 0);
  const suspTotal     = suspicious.reduce((a, t) => a + t.value, 0);
  const months        = Object.keys(monthly).filter(k => k !== 'unk').sort();
  // [fix-L3_02/L4_10] Detecção de sazonalidade legítima
  // Perfil: meses com volume muito alto + meses com volume muito baixo = padrão sazonal
  // Ex: comerciante de verão, vendedor de natal, profissional com safra agrícola
  const _mesesKeys = Object.keys(monthly).filter(k=>k!=='unk').sort();
  const _volumesMensais = _mesesKeys.map(k => monthly[k].credits);
  const _medVol = _volumesMensais.length > 0
    ? _volumesMensais.reduce((a,b)=>a+b,0) / _volumesMensais.length : 0;
  const _mesesAltos  = _volumesMensais.filter(v => _medVol > 0 && v > _medVol * 1.8).length;
  const _mesesBaixos = _volumesMensais.filter(v => _medVol > 0 && v < _medVol * 0.55).length;
  // [fix-NAT] Coeficiente de variação — alta dispersão mensal indica sazonalidade
  // CV = desviopadrao/media. CV > 0.5 com ≥6 meses = padrão sazonal provável
  const _cvVolume = _medVol > 0 && _volumesMensais.length >= 6
    ? Math.sqrt(_volumesMensais.reduce((a,v)=>a+Math.pow(v-_medVol,2),0)/_volumesMensais.length) / _medVol
    : 0;
  // [fix-NAT+linear] Sazonalidade: picos altos E meses baixos (não apenas crescimento)
  // Crescimento linear (1x→12x) tem CV alto mas não é sazonal — não tem meses baixos
  // Natal (10m normais + 2m pico) tem CV moderado + pico claro — É sazonal
  const _medianaVol = (() => {
    const sv = _volumesMensais.slice().sort((a,b)=>a-b);
    const mid = Math.floor(sv.length/2);
    return sv.length%2!==0 ? sv[mid] : (sv[mid-1]+sv[mid])/2;
  })();
  const _mesesPicoClaro = _volumesMensais.filter(v => v > _medianaVol * 1.8).length;
  // Meses "normais" = entre 0.5x e 2x a mediana (nem pico nem baixo)
  const _mesesNormais = _volumesMensais.filter(v => v >= _medianaVol*0.5 && v <= _medianaVol*2.0).length;
  // Para ser sazonal via CV: precisa ter meses normais (base estável) + picos acima
  // Crescimento linear não tem meses normais — todos meses são diferentes
  const _temBaseEstavel = _mesesNormais >= Math.floor(_mesesKeys.length * 0.4);
  const _padraoSazonal = _mesesKeys.length >= 6 && (
    (_mesesAltos >= 2 && _mesesBaixos >= 2) ||
    (_cvVolume > 0.5 && _mesesPicoClaro >= 2 && _temBaseEstavel) ||
    (_cvVolume > 0.6 && _mesesAltos >= 1 && _mesesBaixos >= 1 && _temBaseEstavel)
  );
  // Sazonal forte: assimetria extrema (verão/inverno) — meses baixos próximos de zero
  const _mesesQuaseZero = _volumesMensais.filter(v => _medVol > 0 && v < _medVol * 0.15).length;
  const _padraoSazonalForte = _padraoSazonal && _mesesQuaseZero >= 2;

  // [fix-L4_02] Recalcula pixConsolidado descontando cross-bank confirmado
  // Entrada+saída de mesmo valor Pix no mesmo dia = transferência própria
  const _crossBankDesconto = {};
  classified.filter(t => t.value < 0 && t.date instanceof Date && normalizeDesc(t.desc||'').includes('pix')).forEach(saida => {
    const entrPar = classified.filter(e =>
      e.value > 0 && e.date instanceof Date && !isNaN(e.date) &&
      Math.abs(e.value - Math.abs(saida.value)) < 0.02 &&
      e.date.toISOString().slice(0,10) === saida.date.toISOString().slice(0,10) &&
      (e.internalMove === 'confirmed' || e.internalMove === 'probable' ||
       /conta.{0,10}propria|propria.{0,10}conta|nubank|inter|bradesco|itau|santander|caixa|sicoob/.test(normalizeDesc(e.desc||'')))
    );
    if (entrPar.length > 0) {
      const mesK = saida.date.getFullYear()+'-'+String(saida.date.getMonth()+1).padStart(2,'0');
      _crossBankDesconto[mesK] = (_crossBankDesconto[mesK]||0) + Math.abs(saida.value)*2;
    }
  });
  // [fix-NAT/SAZ] Para perfil sazonal: usar mediana do consolidado Pix
  // em vez de contar meses acima do limite — evita que picos de natal/verão
  // inflem monthsOverLimit artificialmente (ex: 6000 Pix/mês em todos os 12 meses)
  // [fix-raiz] usar pixConsolidadoLiquido como base (cross-bank já excluído em aggregateMonthly)
  const _consolidadoAjustado = (k) => {
    const desconto = _crossBankDesconto[k] || 0;
    const base = monthly[k] ? (monthly[k].pixConsolidadoLiquido ?? monthly[k].pixConsolidado ?? 0) : 0;
    return Math.max(0, base - desconto);
  };
  // [fix-NAT] Para sazonal: usar pixIn (entradas) em vez de consolidado (entrada+saída)
  // pixConsolidado = pixIn + pixOut infla quando o autônomo também paga via Pix
  // O relevante para risco fiscal é o RECEBIMENTO via Pix, não o pagamento
  const monthsOverLimit = _padraoSazonal
    ? (() => {
        // Sazonal: contar meses onde ENTRADA Pix excede o limite
        // (não consolidado — saídas Pix de despesas não são renda)
        const _pixInVals = _mesesKeys.map(k => monthly[k] ? (monthly[k].pixIn||0) : 0).sort((a,b)=>a-b);
        const _mid = Math.floor(_pixInVals.length/2);
        const _medPixIn = _pixInVals.length%2!==0 ? _pixInVals[_mid] : (_pixInVals[_mid-1]+_pixInVals[_mid])/2;
        // Só meses onde entrada Pix é 1.5x a mediana E acima do limite (picos reais)
        return _mesesKeys.filter(k => {
          const pin = monthly[k] ? (monthly[k].pixIn||0) : 0;
          return pin >= ENGINE_CONFIG.PIX_LIMIT_PF && pin > _medPixIn * 1.5;
        }).length;
      })()
    : Object.entries(monthly).filter(([k,m]) => {
        const desconto = _crossBankDesconto[k] || 0;
        return (m.consolidado - desconto) >= ENGINE_CONFIG.PIX_LIMIT_PF;
      }).length;

  // Recorrência, análise temporal, circularidade e split Pix
  const { recorrentes, comercialOculta } = detectarRecorrencia(txns);
  const { anomalias, mediaHistorica, pico } = analiseTemporal(monthly);
  // [fix-A4+L4_02] Excluir transacoes internas/proprias da deteccao de circularidade
  // Transferencia entre contas proprias no mesmo dia nao e conta-passagem
  // Tambem exclui cross-bank: saida Pix com entrada de mesmo valor no mesmo dia
  const _entradaPorValorDia = new Map();
  // [fix-crash] instanceof Date não garante data válida — isNaN é obrigatório
  classified.filter(t => t.value > 0 && t.date instanceof Date && !isNaN(t.date)).forEach(t => {
    const _chk = t.value.toFixed(2) + '|' + t.date.toISOString().slice(0,10);
    if (!_entradaPorValorDia.has(_chk)) _entradaPorValorDia.set(_chk, []);
    _entradaPorValorDia.get(_chk).push(t);
  });
  const _txnsParaCirc = classified.filter(t => {
    if (t.internalMove === 'confirmed' || t.internalMove === 'probable') return false;
    if (t.natureza === 'transf_propria' || t.cat === 'interno') return false;
    const _d = normalizeDesc(t.desc || '');
    if (/conta.{0,10}propria|propria.{0,10}conta|investimento|poupan|aplicac|resgate|aporte/.test(_d)) return false;
    // [fix-L4_02] Cross-bank: saida Pix com entrada de mesmo valor no mesmo dia = transf propria
    if (t.value < 0 && t.date instanceof Date && !isNaN(t.date)) {
      const _chk = Math.abs(t.value).toFixed(2) + '|' + t.date.toISOString().slice(0,10);
      const _entradas = _entradaPorValorDia.get(_chk) || [];
      if (_entradas.length > 0 && _d.includes('pix')) return false;
    }
    return true;
  });
  const circularidade = detectarCircularidade(_txnsParaCirc);
  const splitPix = detectarSplitPix(txns);

  // ── Motor v7 — anti-dupla-contagem + explicações auditáveis ──
  // Cada transação recebe riskSource único. Fatores têm confiança explícita.
  // Relatório: acesse via resultado.fatores[i].{peso, motivo, porqueImporta, quandoNaoERisco, confianca}


  let score = 0;
  const fatores = [];

  // Mapa de IDs já contados — evita dupla contagem do mesmo evento
  const _contados = new Set();
  function _marcar(ids) { ids.forEach(id => _contados.add(id)); }
  function _jaContado(ids) { return ids.some(id => _contados.has(id)); }
  // risco_final = severidade × impacto × contexto
  // severidade: calibração por tipo de fator (ENGINE_CONFIG.SEVERIDADE)
  // impacto: peso bruto calculado pelo fator
  // contexto: fator de ajuste por renda declarada, cobertura, etc (padrão 1.0)
  function _fator(peso, motivo, porqueImporta, quandoNaoERisco, confianca, ids, fatorKey, contexto) {
    const severidade = (fatorKey && ENGINE_CONFIG.SEVERIDADE[fatorKey]) || 1.0;
    const ctx = contexto || 1.0;
    const pesoFinal = Math.round(peso * severidade * ctx);
    _marcar(ids || []);
    fatores.push({
      peso: pesoFinal,
      pesoOriginal: peso,
      severidade,
      contexto: ctx,
      motivo,
      porqueImporta,
      quandoNaoERisco,
      confianca: confianca || 1,
      // Evidências estruturadas para exibição no relatório
      evidencias: [],
    });
    score += pesoFinal;
  }

  // F1 — Créditos sem justificativa fiscal clara
  // Anti-dupla-contagem: IDs das transações suspicious marcados aqui, não recontados em F4
  const totalCreditsRisco = creditsRisco.reduce((a, t) => a + t.value, 0);
  const _suspIds = suspicious.map((t, i) => 'susp_' + i);
  const _comercialRecorTotal = recorrentes
    .filter(r => r.ocorrencias >= 3 && r.total > 0)
    .filter(r => { const d = r.desc.toLowerCase(); return d.includes('recebimento') || d.includes('serviço') || d.includes('servico') || d.includes('nota fiscal') || d.includes('honorar'); })
    .reduce((a, r) => a + r.total, 0);
  const suspTotalV4 = suspTotal + _comercialRecorTotal * 0.5;
  const infRatio = totalCreditsRisco > 0 ? suspTotalV4 / totalCreditsRisco : 0;
  // Quando renda declarada explica uma parte significativa da movimentação,
  // limitar F1 — o autônomo pode ter créditos não identificáveis mas cobertos pela declaração
  const _nMesesF1 = Object.keys(monthly).filter(k=>k!=='unk').length || 1;
  const _cobertura = rendaDeclarada > 0 && totalCreditsRisco > 0
    ? (rendaDeclarada * _nMesesF1) / totalCreditsRisco
    : 0;
  const _rendaExplicaMovim = _cobertura >= 0.6;
  const _rendaCobreTotal   = _cobertura >= 0.8; // renda cobre 80%+ → F1 irrelevante
  const f1raw = Math.round(Math.min(30, infRatio * 30));
  const _circularidadeAlta = circularidade.length >= 3;
  // P03: CLT com renda extra — salário cobre o total mas há créditos extras de PF/PJ
  // sem DARF. Não zerar F1 completamente se houver créditos de natureza "indefinida"
  // de origens distintas do empregador (padrão de freelancer paralelo sem declaração)
  const _temRendaExtra = (() => {
    if (formalTotal <= 0) return false;
    const _credExtras = creditsRisco.filter(t =>
      t.cat !== 'formal' && t.natureza === 'indefinida' && t.value >= 300
    );
    return _credExtras.length >= 3; // 3+ créditos extras de natureza indefinida
  })();
  const f1 = _rendaCobreTotal && !_temRendaExtra
    ? 0                                                // renda cobre 80%+ e sem extras: sem F1
    : _rendaCobreTotal && _temRendaExtra
      ? Math.min(12, Math.round(f1raw * 0.4))         // P03: CLT cobre mas há extras — F1 leve
      : _rendaExplicaMovim
        ? Math.min(8, Math.round(f1raw * 0.5))        // renda cobre 60%+: F1 reduzido
        : _circularidadeAlta
          ? Math.round(f1raw * 0.7)                   // circularidade captura parte
          : f1raw;
  if (f1 > 0) {
    _fator(f1,
      `Foram identificados sinais compatíveis com possível omissão de rendimentos — ${Math.round(infRatio * 100)}% das entradas sem origem fiscal identificável`,
      'A Receita Federal cruza automaticamente as entradas bancárias com o que foi declarado. Créditos sem justificativa clara (salário, nota fiscal, CNPJ) são o principal gatilho de malha fina.',
      'Não se caracteriza como risco quando as entradas são salário identificado, transferências entre contas próprias, reembolsos documentados, herança ou verbas rescisórias.',
      infRatio > 0.4 ? 0.9 : infRatio > 0.2 ? 0.7 : 0.5,
      _suspIds,
      'F1_omissao_renda',
      1.0
    );
    fatores[fatores.length-1].evidencias = [
      { ok: infRatio > 0,    texto: `${Math.round(infRatio * 100)}% das entradas sem origem identificável` },
      { ok: suspTotal > 0,   texto: `${fmtBRL(suspTotal)} em créditos sem justificativa fiscal` },
      { ok: _cobertura > 0,  texto: _cobertura > 0 ? `Renda declarada cobre ${Math.round(_cobertura*100)}% da movimentação` : 'Renda declarada não informada' },
    ];
  }

  // F2 — Pix mensal acima do limite e-Financeira
  // Desconta peso quando renda declarada já explica o volume (autônomo/MEI legítimo)
  const _nMesesF2 = Math.max(1, Object.keys(monthly).filter(k=>k!=='unk').length);
  // [fix-XBK+NAT] usar pixIn (só entradas Pix) como base — pixConsolidado inclui saídas e infla
  const _pixMediaMensal = Object.values(monthly).reduce((a,m)=>a+(m.pixIn||0),0) / _nMesesF2;
  // [fix-NAT/SAZ/N04] _rendaCobre compara ENTRADAS Pix com renda (não consolidado entrada+saída)
  // pixConsolidado = pixIn + pixOut inflaciona artificialmente quando autônomo também paga via Pix
  // O relevante para cobertura é: renda cobre as ENTRADAS Pix (receita do autônomo)
  // [fix-N07] Apostas: descontar do pixIn o volume "reciclado" de apostas
  // (recebeu 8k da bet, enviou 2.5k → saldo real é 5.5k, não 8k de renda nova)
  const _pixApostaDesconto = {};
  classified.forEach(t => {
    if (!t.date || !(t.date instanceof Date)) return;
    const mesK = t.date.getFullYear()+'-'+String(t.date.getMonth()+1).padStart(2,'0');
    if (t.natureza === 'aposta_jogo' && t.value > 0) {
      // Entrada de aposta: calcular quanto saiu para aposta no mesmo mês
      const saidaAposta = classified
        .filter(s => s.natureza === 'aposta_jogo' && s.value < 0 && s.date instanceof Date &&
                     s.date.getFullYear()+'-'+String(s.date.getMonth()+1).padStart(2,'0') === mesK)
        .reduce((a,s) => a + Math.abs(s.value), 0);
      // Desconta do pixIn apenas o volume que "voltou" (min entrada, saída)
      const entradaAposta = classified
        .filter(e => e.natureza === 'aposta_jogo' && e.value > 0 && e.date instanceof Date &&
                     e.date.getFullYear()+'-'+String(e.date.getMonth()+1).padStart(2,'0') === mesK)
        .reduce((a,e) => a + e.value, 0);
      _pixApostaDesconto[mesK] = Math.min(entradaAposta, saidaAposta);
    }
  });
  // Aplicar desconto de apostas ao pix do monthly (pixEntrada líquido)
  Object.entries(_pixApostaDesconto).forEach(([mesK, desconto]) => {
    if (monthly[mesK]) monthly[mesK].pixApostaDesconto = desconto;
  });

  const _pixEntradaMediaMensal = _mesesKeys.length > 0
    ? _mesesKeys.reduce((a,k) => a + Math.max(0, (monthly[k] ? (monthly[k].pixIn||0) : 0) - (monthly[k]?.pixApostaDesconto||0)), 0) / _mesesKeys.length
    : 0;
  const _pixEntradaParaCobertura = _padraoSazonal && _mesesKeys.length >= 6
    ? (() => {
        // Sazonal: usar mediana das ENTRADAS (não consolidado) — robusta contra picos
        const _vals = _mesesKeys.map(k => monthly[k] ? (monthly[k].pixIn||0) : 0).sort((a,b)=>a-b);
        const _mid = Math.floor(_vals.length/2);
        return _vals.length%2!==0 ? _vals[_mid] : (_vals[_mid-1]+_vals[_mid])/2;
      })()
    : _pixEntradaMediaMensal;
  // _rendaCobre: renda declarada cobre as ENTRADAS Pix do período (com margem 30%)
  // [v5-PERFIL] MEI/Autônomo: Pix recorrente é normal — margem de cobertura ampliada
  // Investidor/Aposentado: créditos de rendimentos não são renda de trabalho — margem ainda maior
  const _pixCoberturaMargem = 1.3 * (_perfilMult ? _perfilMult.pix : 1.0);
  const _rendaCobre = rendaDeclarada > 0 && _pixEntradaParaCobertura <= rendaDeclarada * _pixCoberturaMargem;
  const _pixMediaParaCobertura = _pixEntradaParaCobertura; // alias para compatibilidade
  const _pesoF2base = Math.min(15, monthsOverLimit * 5);
  // Reduz 60% do peso se renda declarada cobre o volume de Pix
  // Quando renda declarada cobre o volume de Pix: gera alerta mas peso mínimo (2pts)
  // pois o risco fiscal real é baixo — o autônomo é declarável
  // [fix-NAT/SAZ] Sazonal + renda cobre → F2 não aciona (picos de temporada são esperados)
  const f2 = (_padraoSazonal && _rendaCobre) ? 0 : _rendaCobre ? Math.min(2, _pesoF2base) : _pesoF2base;
  if (f2 > 0) {
    _fator(f2,
      `Foram encontrados sinais que merecem conferência: Pix consolidado acima de ${fmtBRL(ENGINE_CONFIG.PIX_LIMIT_PF)} em ${monthsOverLimit} mês(es)${_rendaCobre ? ' (parcialmente coberto pela renda declarada)' : ''}`,
      'Bancos são obrigados por lei a reportar à Receita toda movimentação mensal de Pix acima de R$5.000. Isso acontece automaticamente, sem necessidade de denúncia.',
      'Não se caracteriza como risco quando o volume de Pix for compatível com a renda declarada ou com atividade profissional documentada (MEI, autônomo com notas).',
      monthsOverLimit >= 3 ? 0.95 : 0.75,
      ['pix_limit_' + monthsOverLimit],
      'F2_pix_limite',
      1.0
    );
    fatores[fatores.length-1].evidencias = [
      { ok: true,                      texto: `${monthsOverLimit} mês(es) com Pix acima de ${fmtBRL(ENGINE_CONFIG.PIX_LIMIT_PF)}` },
      { ok: _pixMediaMensal > 0,       texto: `Média mensal de Pix: ${fmtBRL(_pixMediaMensal)}` },
      { ok: _rendaCobre,               texto: _rendaCobre ? 'Renda declarada cobre o volume de Pix' : 'Renda declarada não cobre o volume detectado' },
    ];
  }

  // [fix-L3_02/L4_10] Suavizar F2 para perfil sazonal confirmado
  // Pix alto em meses de pico sazonal é esperado — desconta do score bruto
  if (_padraoSazonal && fatores.length > 0) {
    const _f2saz = [...fatores].reverse().find(f => f.ids && f.ids.some(id=>id.startsWith('pix_limit')));
    if (_f2saz) {
      const _reducaoF2Sazonal = _padraoSazonalForte ? 0.30 : 0.55;
      const _pesoF2orig = _f2saz.peso;
      const _pesoF2pos = Math.round(_pesoF2orig * _reducaoF2Sazonal);
      const _deltaF2 = _pesoF2orig - _pesoF2pos;
      _f2saz.peso = _pesoF2pos;
      score = Math.max(0, score - _deltaF2);
      _f2saz.motivo = (_f2saz.motivo||'').replace(' [sazonalidade detectada — peso reduzido]','') + ' [sazonalidade detectada — peso reduzido]';
    }
  }

  // F2b — Padrão trimestral elevado
  // Anti-dupla-contagem: só ativa se F2 não cobriu todos os trimestres
  // [fix-raiz] usar consolidadoLiquido (exclui internos/cross-bank)
  const trimestresElevados = Object.values(quarterly).filter(q => q.meses >= 2 && (q.consolidadoLiquido ?? q.consolidado) / q.meses >= ENGINE_CONFIG.PIX_LIMIT_PF).length;
  // F2b trimestral: só aciona se renda NÃO cobre — evitar dupla penalização
  // de autônomo legítimo que já foi suavizado em F2
  // [fix-B1] Se renda cobre E padrão sazonal: F2b não aciona
  // F2b: não aciona se renda cobre | sazonal | extrato curto (<3 trimestres)
  const _trimTotal = Object.keys(quarterly).length;
  if (trimestresElevados > 0 && !_rendaCobre && !_padraoSazonal && _trimTotal >= 3) {
    const f2b = Math.min(8, trimestresElevados * 4);
    const _jaF2 = _jaContado(['pix_limit_' + monthsOverLimit]);
    _fator(_jaF2 ? Math.round(f2b * 0.5) : f2b,
      `Padrão de Pix elevado em ${trimestresElevados} trimestre(s) consecutivo(s)`,
      'Movimentação consistentemente alta por múltiplos trimestres indica padrão estrutural, não evento isolado — o que aumenta a relevância do cruzamento pelo e-Financeira.',
      'Não é risco se o padrão for consistente com atividade profissional declarada.',
      0.7,
      ['trim_' + trimestresElevados]
    );
  }

  // F3 — Depósito em espécie
  // P04: índice de consumo — excluir compras de equipamento profissional do cálculo
  // iPhone, câmera, microfone etc. são ferramentas de trabalho de criadores de conteúdo
  // Um mês de compra de equipamento não deve disparar anomalia temporal
  const _debEquipCreator = classified.filter(t =>
    t.value < 0 &&
    (['ring light','anel de luz','microfone','tripé','tripe','softbox',
      'lente camera','estabilizador','drone','placa de captura','interface audio',
      'iphone','smartphone profissional'].some(k => normalizeDesc(t.desc).includes(k)))
  ).reduce((a,t) => a + Math.abs(t.value), 0);
  // Nota: _debEquipCreator é informativo — usado para contexto nos alertas

  const especieRatio = totalCredits > 0 ? especieTotal / totalCredits : 0;
  const _especieAlta = especieRatio > 0.3;
  const f3 = Math.round(Math.min(15, especieRatio * 60));
  if (f3 > 0) {
    _fator(f3,
      `Foram identificados sinais de movimentação em dinheiro físico que merecem atenção — ${Math.round(especieRatio * 100)}% das entradas em espécie (${fmtBRL(especieTotal)})`,
      'Depósitos em espécie são um dos critérios diretos do e-Financeira. Qualquer depósito em dinheiro acima de R$2.000/mês é registrado pelo banco e pode ser cruzado com a declaração.',
      'Não se caracteriza como risco quando o valor for compatível com saques anteriores (troco de retirada) ou atividade reconhecidamente em dinheiro como feira, mercado ou aluguel residencial.',
      especieRatio > 0.3 ? 0.9 : 0.65,
      ['especie_total'],
      'F3_especie',
      1.0
    );
    fatores[fatores.length-1].evidencias = [
      { ok: true,              texto: `${fmtBRL(especieTotal)} em depósitos em espécie` },
      { ok: especieRatio>0.3,  texto: `${Math.round(especieRatio*100)}% das entradas em dinheiro físico` },
      { ok: _especieAlta,      texto: _especieAlta ? 'Concentração de espécie acima do padrão' : 'Concentração dentro da faixa normal' },
    ];
  }

  // F4 — Atividade comercial recorrente sem vínculo declarado
  // Anti-dupla-contagem: verifica se os padrões já foram contados em F1
  // F4: padrão comercial oculto — reduz peso quando renda declarada é compatível
  // com o volume total dos padrões detectados (autônomo com clientes declaráveis)
  const _totalComercOculto = comercialOculta.reduce((a,r)=>a+r.total,0);
  const _nMesesF4 = Math.max(1, Object.keys(monthly).filter(k=>k!=='unk').length);
  const _comercMediaMensal = _totalComercOculto / _nMesesF4;
  // [fix-bug4b] _f4RendaCobre: quando _rendaCobre (pixIn cobre renda), F4 não deve acionar
  // Autônomo declarado com clientes Pix não é atividade oculta
  // [v5-PERFIL] MEI: recebimentos recorrentes são esperados — ampliar margem de cobertura
  const _f4CoberturaFator = _perfilMult ? _perfilMult.comercial : 1.0;
  const _f4RendaCobre = rendaDeclarada > 0 && (_comercMediaMensal <= rendaDeclarada * 1.5 * (1 / Math.max(0.3, _f4CoberturaFator)) || _rendaCobre)
    || (perfilUsuario === 'mei' && _comercMediaMensal <= rendaDeclarada * 2.5); // MEI: margem extra
  const _comercOcultoNovo = comercialOculta.filter(r => !_jaContado(['comrc_' + r.desc]));
  const _f4base = Math.min(15, _comercOcultoNovo.length * 5);
  // Reduz 70% quando renda declarada já cobre; 40% quando F7 já punirá a incompatibilidade
  const _f7Ativo = rendaDeclarada > 0;
  // Quando F2 já está ativo com peso cheio: F4 reduzido (evitar acumulação excessiva)
  const _f2Cheio = !_rendaCobre && monthsOverLimit > 0;
  const _f7f2Dupla = _f2Cheio && _f7Ativo; // F2 + F7 ambos ativos = dupla captura
  const f4 = _f4RendaCobre
    ? Math.round(_f4base * 0.3)
    : _f7f2Dupla
      ? Math.min(5, Math.round(_f4base * 0.35)) // F2+F7 já cobrem: F4 mínimo
      : _f2Cheio
        ? Math.min(8, Math.round(_f4base * 0.6))
        : (_f7Ativo ? Math.round(_f4base * 0.6) : _f4base);
  if (f4 > 0) {
    _fator(f4,
      `Foram encontrados sinais compatíveis com possível atividade comercial recorrente sem vínculo declarado — ${_comercOcultoNovo.length} padrão(ões) de recebimento regular identificado(s)`,
      'Recebimentos repetidos do mesmo pagador com valor similar são interpretados pelo sistema da Receita como prestação de serviço. Se não houver nota fiscal ou registro de MEI/autônomo, pode ser caracterizado como omissão de receita.',
      'Não se caracteriza como risco quando os recebimentos forem salário, pensão, aluguel declarado, reembolso recorrente ou transferência entre contas próprias.',
      _comercOcultoNovo.length >= 2 ? 0.8 : 0.6,
      _comercOcultoNovo.map(r => 'comrc_' + r.desc),
      'F4_comercial_oculta',
      1.0
    );
    fatores[fatores.length-1].evidencias = [
      { ok: true,                          texto: `${_comercOcultoNovo.length} padrão(ões) de recebimento recorrente detectado(s)` },
      { ok: _comercMediaMensal > 0,        texto: `Média de ${fmtBRL(_comercMediaMensal)}/mês em recebimentos recorrentes` },
      { ok: !_f4RendaCobre,                texto: _f4RendaCobre ? 'Renda declarada cobre o volume detectado' : 'Volume não coberto pela renda declarada' },
    ];
  }

  // F5 — Anomalia temporal
  // Calcula pico apenas sobre créditos de natureza de risco (exclui empréstimo, reembolso, alienação)
  // para não punir eventos documentáveis pontuais (venda de imóvel, 13o, PLR, empréstimo)
  // Pico: soma apenas créditos de natureza de risco (exclui neutros)
  // Isso evita que empréstimo pontual ou venda de imóvel dispare F5
  // MAS mantém 13o/PLR/férias como renda_trabalho que SÃO fiscalmente relevantes (declaráveis)
  const _naturezasNeutrasPico = new Set(['transf_propria','emprestimo','devolucao_reembolso','interno','saida','reembolso','alienacao_bem','heranca_doacao','fgts_rescisao']);
  const _creditsRiscoPorMes = {};
  classified.filter(t => t.value > 0 && !_naturezasNeutrasPico.has(t.natureza) && t.cat !== 'interno' && t.cat !== 'emprestimo' && t.cat !== 'reembolso').forEach(t => {
    const k = t.date instanceof Date
      ? t.date.getFullYear() + '-' + String(t.date.getMonth()+1).padStart(2,'0')
      : 'unk';
    _creditsRiscoPorMes[k] = (_creditsRiscoPorMes[k] || 0) + t.value;
  });
  const _totaisRisco = Object.values(_creditsRiscoPorMes);
  const _picoRisco   = _totaisRisco.length > 0 ? Math.max(..._totaisRisco) : pico;
  const _medRisco    = _totaisRisco.length > 0 ? _median(_totaisRisco) : mediaHistorica;
  const pctPico = (_medRisco > 0 ? _picoRisco / _medRisco : mediaHistorica > 0 ? pico / mediaHistorica : 1);
  // Usa mediana como referência principal — mais robusta contra meses atípicos pontuais
  // Se mediana = 0 (extrato curto), cai para média histórica como fallback
  const mediaRef = (perfil.medCredits > 0 ? perfil.medCredits : perfil.avgCredits > 0 ? perfil.avgCredits : mediaHistorica);
  // Comparar média mensal excluindo alienação de bem (venda imóvel não é renda recorrente)
  const _nMesesAtual = Math.max(1, Object.keys(monthly).filter(k => k !== 'unk').length);
  const _totalSemAlienacao = classified
    .filter(t => t.value > 0 && t.natureza !== 'alienacao_bem' && t.cat !== 'interno' && t.cat !== 'emprestimo')
    .reduce((a,t)=>a+t.value,0);
  const _mediaAtual  = _totalSemAlienacao / _nMesesAtual;
  const ratioAtual   = mediaRef > 0 && _mediaAtual > 0 ? _mediaAtual / mediaRef : 1;
  // Para créditos de natureza renda_trabalho no mês de pico, usar threshold maior
  // (13o+PLR+férias podem gerar pico 4-5x sem risco real — são declaráveis)
  const _mesPico = Object.entries(_creditsRiscoPorMes).sort(([,a],[,b])=>b-a)[0]?.[0];
  const _txnsMesPico = _mesPico ? classified.filter(t => {
    if (!t.date || t.value <= 0) return false;
    const k = t.date.getFullYear()+'-'+String(t.date.getMonth()+1).padStart(2,'0');
    return k === _mesPico;
  }) : [];
  const _picoEhRendaTrabalho = _txnsMesPico.length > 0 &&
    _txnsMesPico.filter(t=>t.natureza==='renda_trabalho').reduce((a,t)=>a+t.value,0) /
    _txnsMesPico.filter(t=>t.value>0).reduce((a,t)=>a+t.value,0.001) > 0.6;
  // [fix-L2_02] Detectar padrão anual de múltiplos picos de renda_trabalho
  // PLR em março + bônus em junho = dois picos ao longo do ano, cada um 4-5x a média
  // Mesmo que o mês de pico máximo não seja dominado por renda_trabalho, se o padrão
  // anual tem ≥2 meses com pico de renda_trabalho, suavizar F5 de forma global
  const _mesesComPicoRenda = Object.keys(_creditsRiscoPorMes).filter(mes => {
    const txnsMes = classified.filter(t => {
      if (!t.date || t.value <= 0) return false;
      const k = t.date.getFullYear()+'-'+String(t.date.getMonth()+1).padStart(2,'0');
      return k === mes;
    });
    const rendaTrabalhoMes = txnsMes.filter(t=>t.natureza==='renda_trabalho').reduce((a,t)=>a+t.value,0);
    const totalMes = txnsMes.filter(t=>t.value>0).reduce((a,t)=>a+t.value,0.001);
    return rendaTrabalhoMes/totalMes > 0.5 && (_creditsRiscoPorMes[mes]||0) > mediaRef*2;
  }).length;
  const _padraoAnualRendaTrabalho = _mesesComPicoRenda >= 2;
  // Threshold maior se pico dominado por renda_trabalho (13o, PLR, férias, bônus)
  // renda_trabalho: 13o+PLR+férias no mesmo mês = 3-5x normal — declaráveis, não é risco
  // Padrão anual (≥2 meses): empresa com PLR semestral + bônus — suavizar ainda mais
  const _threshold5 = _picoEhRendaTrabalho
    ? (_padraoAnualRendaTrabalho ? {t1:12, t2:9, t3:6} : {t1:8, t2:6, t3:4})
    : (_padraoAnualRendaTrabalho ? {t1:6,  t2:4, t3:3} : {t1:3, t2:2, t3:1.5});
  const _f5raw = pctPico >= _threshold5.t1 ? 15 : pctPico >= _threshold5.t2 ? 10 : pctPico >= _threshold5.t3 ? 5 : 0;
  // Redução: 60% se pico é renda_trabalho; 40% extra se padrão anual confirmado
  const f5 = _picoEhRendaTrabalho
    ? (_padraoAnualRendaTrabalho ? Math.round(_f5raw * 0.25) : Math.round(_f5raw * 0.4))
    : (_padraoAnualRendaTrabalho ? Math.round(_f5raw * 0.7)  : _f5raw);
  if (f5 > 0) {
    _fator(f5,
      `Foram identificados sinais de variação atípica no extrato — pico de ${(Math.round(pctPico * 10)/10)}x acima da média histórica`,
      'Um mês com movimentação muito acima do padrão chama atenção no cruzamento automático da Receita — especialmente se não houver explicação como 13º, férias ou venda de bem.',
      'Não se caracteriza como risco quando o pico coincidir com recebimento pontual documentável: venda de imóvel, herança, rescisão, 13º salário ou empréstimo.',
      pctPico >= 3 ? 0.85 : 0.65,
      ['anomalia_pico'],
      'F5_anomalia_temporal',
      1.0
    );
    fatores[fatores.length-1].evidencias = [
      { ok: true,              texto: `Pico de ${(Math.round(pctPico*10)/10)}x acima da média do período` },
      { ok: _mesPico != null,  texto: _mesPico ? `Mês de pico: ${_mesPico}` : 'Mês de pico não identificado' },
      { ok: !_picoEhRendaTrabalho, texto: _picoEhRendaTrabalho ? 'Pico associado a renda de trabalho (13º/PLR — menor risco)' : 'Pico sem associação clara a renda de trabalho' },
    ];
  }
  // [fix-L3_02/L4_10] Suavizar F5 retroativamente se padrão sazonal detectado
  // Sazonalidade legítima: pico estrutural não é risco — desconta do score bruto
  if (_padraoSazonal && fatores.length > 0) {
    const _f5idx = fatores.map((f,i)=>({f,i})).reverse().find(({f})=>f.ids&&f.ids.includes('anomalia_pico'));
    if (_f5idx) {
      const _f5 = _f5idx.f;
      const _reducaoSazonal = _padraoSazonalForte ? 0.25 : 0.45;
      const _pesoOriginal = _f5.peso;
      const _pesoPosReducao = Math.round(_pesoOriginal * _reducaoSazonal);
      const _delta = _pesoOriginal - _pesoPosReducao;
      _f5.peso = _pesoPosReducao;
      score = Math.max(0, score - _delta); // desconta do score bruto antes da escala log
      _f5.motivo = (_f5.motivo||'').replace(' [sazonalidade detectada — peso reduzido]','') + ' [sazonalidade detectada — peso reduzido]';
    }
  }

  // F5b — volume total acima da média histórica (peso reduzido para evitar dupla contagem com F5)
  if (ratioAtual >= 1.8 && perfil.avgCredits > 0 && !_jaContado(['anomalia_pico'])) {
    const f5b = ratioAtual >= 3 ? 8 : ratioAtual >= 2 ? 5 : 3;
    _fator(f5b,
      `Volume total ${(Math.round(ratioAtual * 10)/10)}x acima da média histórica`,
      'O volume acumulado do período é significativamente maior que o histórico do próprio extrato — sinal de mudança de patamar de renda não declarada.',
      'Não é risco se o período analisado incluir recebimentos atípicos documentáveis.',
      0.6,
      ['anomalia_volume']
    );
  } else if (ratioAtual >= 1.8 && perfil.avgCredits > 0) {
    // F5 já foi contado — F5b entra com peso reduzido para não duplicar
    const f5b = Math.round((ratioAtual >= 3 ? 8 : ratioAtual >= 2 ? 5 : 3) * 0.5);
    if (f5b > 0) {
      _fator(f5b,
        `Volume total ${(Math.round(ratioAtual * 10)/10)}x acima da média (sinal adicional ao pico mensal)`,
        'Combinação de pico mensal e volume total elevado reforça o padrão de risco.',
        'Não é risco se houver documentação do recebimento atípico.',
        0.55,
        ['anomalia_volume']
      );
    }
  }

  // F6a — Alienação de bem (venda de imóvel, veículo, etc.)
  // Não é renda recorrente, mas exige DARF de ganho de capital — item de atenção
  const _alienacoes = classified.filter(t => t.value > 0 && t.natureza === 'alienacao_bem');
  if (_alienacoes.length > 0 && !_jaContado(['alienacao'])) {
    const _totalAlienacao = _alienacoes.reduce((a,t)=>a+t.value,0);
    _fator(5,
      `Alienação de bem detectada — ${fmtBRL(_totalAlienacao)} em ${_alienacoes.length} operação(ões)`,
      'Venda de imóvel, veículo ou outros bens exige recolhimento de DARF de ganho de capital (15–22,5%) até o último dia útil do mês seguinte. A Receita Federal recebe automaticamente informações de cartórios e DETRANs.',
      'Não é risco se o bem foi vendido pelo mesmo valor de compra (sem ganho de capital) ou se se enquadra nas isenções (imóvel único abaixo de R$440k, reinvestimento em imóvel em 180 dias).',
      0.7,
      ['alienacao']
    );
  }

  // F6 — Investimentos e aluguel
  if (classified.some(t => t.flag === 'Investimento') && !_jaContado(['invest'])) {
    // [fix-P05] Investidor/aposentado: investimentos são renda esperada do perfil — peso zero, só aviso
    const _f6InvestPeso = (perfilUsuario === 'investidor' || perfilUsuario === 'investidor_aposentado') ? 0 : 8;
    const _f6InvestConf = (perfilUsuario === 'investidor' || perfilUsuario === 'investidor_aposentado') ? 0.4 : 0.75;
    _fator(_f6InvestPeso,
      'Rendimentos de investimentos identificados no extrato',
      'Rendimentos de renda fixa, dividendos e ganhos de capital devem ser declarados separadamente no IR. A instituição financeira já reporta esses dados à Receita.',
      'Não é risco se os rendimentos já estiverem incluídos na declaração de IR.',
      _f6InvestConf,
      ['invest']
    );
  }
  if (classified.some(t => t.flag === 'Aluguel') && !_jaContado(['aluguel'])) {
    _fator(6,
      'Recebimento de aluguel identificado',
      'Receitas de aluguel devem ser declaradas mensalmente na ficha "Rendimentos Tributáveis Recebidos de Pessoa Física/Jurídica". A omissão é um dos itens mais cruzados pela Receita.',
      'Não é risco se o aluguel já estiver declarado ou se o valor estiver abaixo do limite de isenção.',
      0.7,
      ['aluguel']
    );
  }

  // F6c — Circularidade financeira
  // Anti-dupla-contagem: circularidade e split-pix são sinais distintos, ambos permitidos
  if (circularidade.length > 0) {
    const f6c = Math.min(12, circularidade.length * 6);
    _fator(f6c,
      `${circularidade.length} entrada(s) com saída equivalente no mesmo dia`,
      'Dinheiro que entra e sai em poucas horas em valor similar pode indicar conta usada como passagem — prática monitorada pelo COAF e pela Receita Federal.',
      'Não é risco se for pagamento recebido e repassado no mesmo dia por motivo documentável (ex: repasse de condomínio, grupo de compra, rateio).',
      circularidade.length >= 3 ? 0.8 : 0.55,
      circularidade.map((_, i) => 'circ_' + i)
    );
  }

  // F6d — Split de Pix
  if (splitPix.length > 0 && !_jaContado(splitPix.map((_, i) => 'circ_' + i))) {
    const f6d = Math.min(10, splitPix.length * 5);
    _fator(f6d,
      `${splitPix.length} série(s) de Pix fracionados próximos ao limite de R$${ENGINE_CONFIG.PIX_LIMIT.toLocaleString('pt-BR')}`,
      'Pix enviados em valores ligeiramente abaixo do limite de notificação, em sequência rápida, são um padrão conhecido de tentativa de evasão do e-Financeira — monitorado automaticamente.',
      'Não é risco se os pagamentos fracionados tiverem destinatários distintos com finalidade clara (ex: rateio de despesa entre pessoas diferentes).',
      splitPix.length >= 2 ? 0.85 : 0.6,
      splitPix.map((_, i) => 'split_' + i)
    );
  }

  // F7 — Compatibilidade com renda declarada
  if (rendaDeclarada > 0) {
    const _mesesN = Math.max(1, Object.keys(monthly).filter(k => k !== 'unk').length);
    // Exclui créditos de natureza neutra do cálculo de renda média
    // alienacao_bem mantida: DARF de ganho de capital é obrigação fiscal real
    // alienacao_bem excluída: venda de imóvel não é renda recorrente (tem DARF separado)
    const _naturezasNeutrasF7 = new Set(['transf_propria','emprestimo','devolucao_reembolso','interno','reembolso','alienacao_bem','heranca_doacao','fgts_rescisao']);
    const _totalRendaTributavel = classified
      .filter(t => t.value > 0 && !_naturezasNeutrasF7.has(t.natureza) && t.cat !== 'interno' && t.cat !== 'emprestimo' && t.cat !== 'reembolso')
      .reduce((a,t) => a + t.value, 0);
    const _movMedia = _totalRendaTributavel / _mesesN;
    const _compatRatio = _movMedia / rendaDeclarada;
    let _f7 = 0, _compatNivel = '', _conf7 = 0;
    if (_compatRatio > 6)      { _f7 = 20; _compatNivel = 'severa';   _conf7 = 0.95; }
    else if (_compatRatio > 3) { _f7 = 12; _compatNivel = 'moderada'; _conf7 = 0.85; }
    else if (_compatRatio > 2) { _f7 =  6; _compatNivel = 'leve';     _conf7 = 0.7;  }
    // Quando circularidade alta: a incompatibilidade de renda é consequência da conta passagem
    // já capturada por F6c — reduzir F7 para evitar dupla penalização
    if (circularidade.length >= 4) _f7 = Math.round(_f7 * 0.6);
    if (_f7 > 0) {
      _fator(_f7,
        `Foram encontradas informações que merecem conferência antes da declaração — movimentação média de ${fmtBRL(_movMedia)}/mês é ${_compatRatio.toFixed(1)}x a renda declarada`,
        'A Receita compara diretamente o volume de créditos bancários com o que foi declarado como renda. Uma diferença acima de 2x é sinal de alerta direto no sistema.',
        'Não se caracteriza como risco quando parte da movimentação for de empréstimos recebidos, herança, venda de bens ou outras entradas não tributáveis devidamente documentadas.',
        _conf7,
        ['compat_renda'],
        'F7_compatibilidade',
        1.0
      );
      fatores[fatores.length-1].evidencias = [
        { ok: true,             texto: `Movimentação média: ${fmtBRL(_movMedia)}/mês` },
        { ok: true,             texto: `Renda declarada: ${fmtBRL(rendaDeclarada)}/mês` },
        { ok: _compatRatio > 2, texto: `Razão movimentação/renda: ${_compatRatio.toFixed(1)}x ${_compatNivel === 'severa' ? '(severa)' : _compatNivel === 'moderada' ? '(moderada)' : '(leve)'}` },
      ];
    }
  }

  // F8 — Conta auxiliar (consumo muito baixo)
  const _indiceConsumoScore = totalCredits > 0 ? totalDebits / totalCredits : 1;
  const _movMensalScore = totalCredits / Math.max(1, Object.keys(monthly).filter(k => k !== 'unk').length);
  if (_indiceConsumoScore < 0.05 && _movMensalScore > 14120) {
    _fator(8,
      `Saídas representam apenas ${Math.round(_indiceConsumoScore * 100)}% das entradas`,
      'Uma conta com muito mais entrada do que saída pode indicar que é usada apenas para receber e transferir — padrão de conta auxiliar ou de passagem que a Receita identifica no cruzamento.',
      'Não é risco se a conta for usada exclusivamente para recebimento e os valores forem transferidos para outra conta própria identificável.',
      0.65,
      ['consumo_baixo']
    );
  }

  // [fix-N10] Suavizar F7 quando renda cresce de forma consistente (declarável)
  // Influencer/freelancer com publi crescente: cada mês acima do anterior não é risco
  // Critério: ≥6 meses dos últimos 8 com crédito acima do mês anterior = tendência crescente
  if (_mesesKeys.length >= 8 && fatores.length > 0) {
    const _creditsPorMes = _mesesKeys.map(k => monthly[k]?.credits||0);
    let _mesesCrescentes = 0;
    for (let i = 1; i < _creditsPorMes.length; i++) {
      if (_creditsPorMes[i] > _creditsPorMes[i-1] * 1.05) _mesesCrescentes++;
    }
    const _padraoRendaCrescente = _mesesCrescentes >= Math.floor(_creditsPorMes.length * 0.65);
    if (_padraoRendaCrescente) {
      const _f7idx = [...fatores].reverse().find(f => f.ids && f.ids.some(id=>id.startsWith('omissao')));
      if (_f7idx && _f7idx.peso > 0) {
        const _pesoF7orig = _f7idx.peso;
        const _pesoF7pos = Math.round(_pesoF7orig * 0.5);
        const _deltaF7 = _pesoF7orig - _pesoF7pos;
        _f7idx.peso = _pesoF7pos;
        score = Math.max(0, score - _deltaF7);
        _f7idx.motivo = (_f7idx.motivo||'') + ' [renda crescente — pode ser declarável]';
      }
    }
  }

  // Escala logarítmica — denominador calibrado em 185pts brutos = 100% no display
  // [fix-escala] era 160; 185 distribui melhor as 4 bandas com os pesos atuais
  const _rawScore = score;
  score = Math.round(100 * Math.log(1 + _rawScore) / Math.log(1 + 185));
  score = Math.min(100, Math.max(0, score));

  // Confidence score — baseado em número de fatores corroborados
  const evidencias = [
    infRatio > 0.2,
    monthsOverLimit > 0,
    especieRatio > 0.1,
    comercialOculta.length > 0,
    anomalias.length > 0,
    circularidade.length > 0,
    splitPix.length > 0,
  ];
  const confidence = calcConfidence(evidencias);
  const numEvidencias = evidencias.filter(Boolean).length;

  // Rebaixar score se confidence baixa (documento: "rebaixar alertas com baixa confiança")
  if (confidence < ENGINE_CONFIG.CONFIDENCE_REBAIXAR && score > 40) {
    score = Math.round(score * 0.7); // reduz 30% do score se pouca evidência corrobora
    fatores.push({ peso: 0, motivo: `Score ajustado: baixa confiança nos sinais detectados (${Math.round(confidence * 100)}%)` });
  }

  // Documento: "alto risco exige 2+ evidências fortes"
  // Se score >= 70 mas apenas 1 evidência, rebaixa para "atenção" (máx 69)
  if (score >= 70 && numEvidencias < ENGINE_CONFIG.MIN_EVIDENCIAS_ALTO_RISCO) {
    score = 69;
    fatores.push({ peso: 0, motivo: 'Indicador de atenção: múltiplas evidências necessárias para classificação de risco elevado' });
  }

  score = Math.min(100, Math.max(0, score));

  // [v4-NEW] Aviso de extrato curto — precisão limitada com menos de 3 meses
  const _nMesesFinal = Object.keys(monthly).filter(k => k !== 'unk').length;
  const extratoMuitoCurto = _nMesesFinal === 1;
  const extratoCurto      = _nMesesFinal === 2;
  if (extratoMuitoCurto) {
    fatores.push({
      peso: 0, pesoOriginal: 0, severidade: 1, contexto: 1,
      motivo: 'Análise baseada em apenas 1 mês de extrato — precisão limitada',
      porqueImporta: 'Com apenas 1 mês não é possível calcular média histórica nem detectar anomalias temporais. Importe pelo menos 3 meses para uma análise mais confiável.',
      quandoNaoERisco: '',
      confianca: 0,
      evidencias: [{ ok: false, texto: 'Extrato de 1 mês: média histórica indisponível — F5 e F5b não calculados' }],
      tipo: 'aviso',
    });
  }

  return {
    bank, totalTxns: txns.length, creditCount: credits.length,
    totalCredits, totalDebits, pixTotal, especieTotal, formalTotal, comercialTotal,
    suspCount: suspicious.length, attCount: attention.length,
    monthsOverLimit, months: _nMesesFinal, score, confidence, numEvidencias,
    classified, fatores, recorrentes, comercialOculta,
    anomalias, mediaHistorica, pico,
    circularidade, splitPix,
    internos,
    quarterly, perfil,
    mesCritico: perfil.mesCritico,
    indiceEspecie: especieRatio,
    indiceConsumo: totalCredits > 0 ? totalDebits / totalCredits : 0,
    extratoMuitoCurto, extratoCurto,
    // P6: qualidade do parsing
    parserConfidence: Math.round(parserConfidence * 100) / 100,
    txnsValidas: txnsValidas.length,
    txnsDescartadas,
    // Schema canonico
    tipoAnalise: 'indicador_compatibilidade_fiscal',
    versaoEngine: 'v8.0',
    rendaDeclarada: rendaDeclarada || 0,
    perfilUsuario: perfilUsuario || null,
    mesesAnalisados: Object.keys(monthly).filter(k => k !== 'unk').length,
  };
}

// ── Consolidação multi-extrato com explicação causal ──────────
function eConsolidate(results) {
  // [fix-bug] Guard: array vazio, null, undefined ou itens inválidos
  if (!results || !Array.isArray(results)) return null;
  const _rv = results.filter(r => r && r.classified && Array.isArray(r.classified));
  if (_rv.length === 0) return {
    score: 0, confidence: 0, alerts: [], fatores: [], comercialOculta: [],
    totalCredits: 0, totalDebits: 0, pixTotal: 0, especieTotal: 0,
    suspCount: 0, attCount: 0, monthsOverLimit: 0, months: 0,
    tipoAnalise: 'indicador_compatibilidade_fiscal', versaoEngine: 'v7.0',
  };
  // Deduplicação cruzada: remove transações idênticas que aparecem em múltiplos extratos
  // (ex: mesma TED exportada de dois bancos diferentes, ou CSV + OFX do mesmo banco)
  const allRaw  = _rv.flatMap(r => r.classified);
  const allDedup = deduplicateCrossSource(allRaw);
  // Detecção de internos cross-source: TED saindo do banco A = crédito no banco B
  const allC    = applyInternalDetection(allDedup);
  const credits   = allC.filter(t => t.value > 0);
  const debits    = allC.filter(t => t.value < 0);
  const suspicious= allC.filter(t => t.risk === 'suspicious' && t.value > 0);
  const attention = allC.filter(t => t.risk === 'attention'  && t.value > 0);

  const totalCredits   = credits.reduce((a, t) => a + t.value, 0);
  const totalDebits    = Math.abs(debits.reduce((a, t) => a + t.value, 0));
  const pixTotal       = credits.filter(t => t.cat === 'pix').reduce((a, t) => a + t.value, 0);
  const especieTotal   = credits.filter(t => t.cat === 'especie').reduce((a, t) => a + t.value, 0);
  const formalTotal    = credits.filter(t => t.cat === 'formal').reduce((a, t) => a + t.value, 0);
  const suspTotal      = suspicious.reduce((a, t) => a + t.value, 0);
  const totalMOL       = _rv.reduce((a, r) => a + r.monthsOverLimit, 0);

  // Score consolidado ponderado por volume
  const totalVol = _rv.reduce((a, r) => a + r.totalCredits, 0);
  let score = totalVol > 0
    ? _rv.reduce((a, r) => a + r.score * (r.totalCredits / totalVol), 0)
    : _rv.reduce((a, r) => a + r.score, 0) / _rv.length;

  // Bônus se múltiplos extratos com score alto
  if (_rv.filter(r => r.score > 55).length >= 2) score = Math.min(100, score + 10);
  score = Math.round(score);

  // Todos os fatores de todos os extratos
  const todosFatores = _rv.flatMap(r => r.fatores);
  const todasComerciais = _rv.flatMap(r => r.comercialOculta);
  const totalRecorrentes = _rv.reduce((a, r) => a + r.recorrentes.length, 0);

  // ── Geração de alertas causais com números reais ────────────
  const alerts = [];

  // Créditos suspeitos com valor exato
  if (suspicious.length > 0) {
    alerts.push({
      type: 'red', icon: '🚨',
      title: `${suspicious.length} crédito(s) de alto risco — ${fmtBRL(suspTotal)}`,
      text: `Representam ${Math.round(suspTotal/totalCredits*100)}% das entradas totais sem justificativa fiscal clara. A Receita Federal cruza via e-Financeira em todos os bancos simultaneamente.`
    });
  }

  // Pix acima do limite com meses exatos
  if (totalMOL > 0) {
    alerts.push({
      type: 'red', icon: '⚠️',
      title: `Pix acima de R$5.000/mês em ${totalMOL} mês(es) — ${fmtBRL(pixTotal)} total`,
      text: `Movimentações mensais de Pix nesse patamar podem ser objeto de cruzamentos fiscais via sistema e-Financeira. Cada mês é reportado individualmente.`
    });
  }

  // Depósito em espécie
  if (especieTotal > 0) {
    const pctEspecie = Math.round(especieTotal / totalCredits * 100);
    alerts.push({
      type: pctEspecie >= 20 ? 'red' : 'yellow', icon: '💵',
      title: `Depósitos em espécie: ${fmtBRL(especieTotal)} (${pctEspecie}% das entradas)`,
      text: `Depósitos em espécie acima de R$2.000/mês devem ser informados pelo banco à Receita. Percentual acima de 20% eleva significativamente o índice de risco.`
    });
  }

  // Atividade comercial oculta
  if (todasComerciais.length > 0) {
    const totalComercial = todasComerciais.reduce((a, r) => a + r.total, 0);
    alerts.push({
      type: 'red', icon: '🏪',
      title: `${todasComerciais.length} padrão(ões) de atividade comercial recorrente — ${fmtBRL(totalComercial)}`,
      text: `Recebimentos com frequência e ticket médio regulares indicam possível atividade comercial. Se não declarado como MEI, autônomo ou empresa, pode ser caracterizado como omissão de receita.`
    });
  }

  // Investimentos
  if (allC.some(t => t.flag === 'Investimento')) {
    const t = allC.filter(x => x.flag === 'Investimento').reduce((a, x) => a + x.value, 0);
    alerts.push({
      type: 'yellow', icon: '📈',
      title: `Rendimentos de investimentos: ${fmtBRL(t)}`,
      text: `CDB, fundos, cripto e dividendos precisam ser declarados como rendimentos tributáveis ou isentos conforme o tipo.`
    });
  }

  // Aluguel
  if (allC.some(t => t.flag === 'Aluguel')) {
    const t = allC.filter(x => x.flag === 'Aluguel').reduce((a, x) => a + x.value, 0);
    alerts.push({
      type: 'yellow', icon: '🏠',
      title: `Recebimentos de aluguel: ${fmtBRL(t)}`,
      text: `Devem ser informados mensalmente no carnê-leão e na declaração anual. A Receita recebe informe do inquilino pessoa jurídica automaticamente.`
    });
  }

  // Atenção geral sem suspeitos
  if (attention.length > 0 && suspicious.length === 0) {
    alerts.push({
      type: 'yellow', icon: '⚠️',
      title: `${attention.length} transação(ões) merecem revisão`,
      text: `Créditos que podem ser questionados. Tenha comprovantes de origem disponíveis.`
    });
  }

  // Internos detectados — transparência para o usuário
  const internos = allC.filter(t => t.internalMove === 'confirmed' || t.internalMove === 'probable');
  if (internos.length > 0) {
    const totalInterno = internos.filter(t => t.value > 0).reduce((a, t) => a + t.value, 0);
    alerts.push({
      type: 'green', icon: '🔁',
      title: `${internos.length} movimentação(ões) interna(s) identificada(s) — ${fmtBRL(totalInterno)} excluídos do score`,
      text: `Transferências entre contas do mesmo titular (TED, PIX próprio, aportes) foram identificadas e excluídas do cálculo de risco de renda. Isso evita contagem duplicada de valores.`
    });
  }

  // Score ok
  if (alerts.length === 0) {
    alerts.push({
      type: 'green', icon: '✅',
      title: 'Perfil de créditos dentro do esperado',
      text: `Nenhum crédito de alto risco encontrado nos ${_rv.length} extrato(s) analisados.`
    });
  }

  // Explicação causal do score — SEMPRE presente
  if (todosFatores.length > 0) {
    const top3 = todosFatores.sort((a, b) => b.peso - a.peso).slice(0, 3);
    const explicacao = top3.map(f => `• ${f.motivo}`).join(' ');
    alerts.push({
      type: 'blue', icon: '🧠',
      title: `Por que o score é ${score}%`,
      text: `O risco aumentou porque: ${explicacao}. Score = soma ponderada de compatibilidade financeira, padrão de Pix, espécie, recorrência e variação temporal.`
    });
  }

  // Próximo passo
  alerts.push({
    type: 'blue', icon: '💡',
    title: 'Próximo passo',
    text: `Compare os ${credits.length} créditos (${fmtBRL(totalCredits)}) com o total declarado no IR. Qualquer diferença acima de 10% precisa de comprovante de origem.`
  });

  return {
    score, totalCredits, totalDebits, pixTotal, especieTotal, formalTotal,
    suspCount: suspicious.length, attCount: attention.length,
    creditCount: credits.length, totalTxns: allC.length,
    indiceConsumo: totalCredits > 0 ? totalDebits / totalCredits : 0,
    indiceEspecie: totalCredits > 0 ? especieTotal / totalCredits : 0,
    recorrentes: totalRecorrentes, comercialOculta: todasComerciais.length,
    alerts, all: allC,
  };
}


// ── sanitizador XSS ──────────────────────────────────────

let eFiles=[];
let eAllTxns=[];
let eActiveBankTab='all';
let _eConsolidated=null;
let _eSources=null;

function eDov(e){e.preventDefault();document.getElementById('dz').classList.add('drag')}
function eDlv(){document.getElementById('dz').classList.remove('drag')}
function eDrp(e){e.preventDefault();eDlv();Array.from(e.dataTransfer.files).forEach(eAddFile)}
function eOnSel(e){Array.from(e.target.files).forEach(eAddFile);e.target.value='';}

function eAddFile(file){
  eShowErr('');
  if(eFiles.length>=MAX_FILES){eShowErr(`Limite de ${MAX_FILES} extratos atingido.`);return;}
  if(!validateFileName(file.name)){eShowErr('Nome de arquivo inválido ou suspeito.');return;}
  if(eFiles.find(f=>f.name===file.name)){eShowErr(`"${sanitize(file.name)}" já foi adicionado.`);return;}
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if(file.size > MAX_SIZE){eShowErr(`"${sanitize(file.name)}" excede o limite de 10MB.`);return;}
  const allowedExt = ['pdf','csv','ofx','qfx','txt'];
  const ext = file.name.split('.').pop().toLowerCase();
  if(!allowedExt.includes(ext)){eShowErr(`Formato não suportado: .${sanitize(ext)}. Use PDF, CSV, OFX ou TXT.`);return;}
  const entry={name:file.name,content:null,type:null,detected:null,status:'loading'};
  eFiles.push(entry);eRenderFileList();
  if(ext==='pdf'){
    const r=new FileReader();
    r.onload=async e=>{
      try {
        await validatePDFMagicBytes(e.target.result);
        // Carrega pdf.js só agora, quando realmente precisamos
        await _loadPdfJs();
        entry.content=e.target.result;entry.type='pdf';entry.detected={format:'pdf',bank:'PDF'};entry.status='ok';
      } catch(err) {
        entry.status='err';
        eShowErr(`"${sanitize(file.name)}": ${err.message}`);
      }
      eRenderFileList();eUpdateActionBar();
    };
    r.readAsArrayBuffer(file);
  } else {
    const enc=['UTF-8','ISO-8859-1','windows-1252'];let idx=0;
    const tryNext=()=>{
      if(idx>=enc.length){entry.status='err';eRenderFileList();return;}
      const r=new FileReader();
      r.onload=e=>{
        let c=e.target.result;
        const bad=(c.match(/\uFFFD/g)||[]).length;
        if(bad>20&&idx<enc.length-1){idx++;tryNext();return;}
        if(c.length > MAX_TEXT_CHARS){eShowErr(`"${sanitize(file.name)}" tem conteúdo excessivo.`);entry.status='err';eRenderFileList();return;}
        // OFX/QFX usam tags XML como estrutura — não sanitizar (removeria os dados)
        const isOFX=ext==='ofx'||ext==='qfx'||c.substring(0,500).toUpperCase().includes('OFXHEADER');
        if(!isOFX) c=sanitizeFileContent(c);
        entry.content=c;entry.type='text';entry.detected=eDetectFormat(c,file.name);entry.status='ok';
        eRenderFileList();eUpdateActionBar();
      };
      r.readAsText(file,enc[idx]);
    };
    tryNext();
  }
}

function eRemoveFile(idx){eFiles.splice(idx,1);eRenderFileList();eUpdateActionBar();if(eFiles.length===0)document.getElementById('actBar').style.display='none';}

function eRenderFileList(){
  document.getElementById('fileList').innerHTML=eFiles.map((f,i)=>`
    <div class="file-item ${f.status==='ok'?'ok':f.status==='err'?'err':''}">
      <span class="file-ico">${f.status==='loading'?'⏳':f.status==='err'?'❌':'📄'}</span>
      <div class="file-info"><div class="file-name">${sanitize(f.name)}</div><div class="file-bank">${f.detected?sanitize(f.detected.bank):'Detectando...'}</div></div>
      <span class="file-status ${f.status==='ok'?'fs-ok':f.status==='err'?'fs-err':'fs-load'}">${f.status==='ok'?'PRONTO':f.status==='err'?'ERRO':'...'}</span>
      <span class="file-rm" onclick="eRemoveFile(${i})">✕</span>
    </div>`).join('');
  const lb=document.getElementById('limitBar');
  if(eFiles.length>0){
    lb.style.display='flex';
    document.getElementById('limitTxt').textContent=`${eFiles.length} de ${MAX_FILES}`;
    document.getElementById('dzIco').textContent=eFiles.length>=MAX_FILES?'✅':'📂';
    document.getElementById('dzTtl').textContent=eFiles.length>=MAX_FILES?`${MAX_FILES} extratos carregados`:'Adicione mais ou clique em Analisar';
    document.getElementById('limitNote').textContent=eFiles.length>=MAX_FILES?'Limite atingido':'';
    document.getElementById('ldots').innerHTML=Array.from({length:MAX_FILES},(_,i)=>`<div class="ldot ${i<eFiles.length?i===MAX_FILES-1&&eFiles.length>=MAX_FILES?'full':'used':''}">${i<eFiles.length?'✓':''}</div>`).join('');
  }else{lb.style.display='none';document.getElementById('dzIco').textContent='📂';document.getElementById('dzTtl').textContent='Arraste os extratos ou clique para selecionar';}
}

function eUpdateActionBar(){
  const ready=eFiles.filter(f=>f.status==='ok').length;
  const ab=document.getElementById('actBar');
  if(ready>0){ab.style.display='flex';document.getElementById('actMsg').textContent=`${ready} extrato(s) prontos`;document.getElementById('btnGo').classList.add('on');}
  else document.getElementById('btnGo').classList.remove('on');
}
function eShowErr(msg){const b=document.getElementById('errExt');b.textContent=msg;b.classList.toggle('show',!!msg);}
function eSetProgress(pct,msg){document.getElementById('pFillExt').style.width=pct+'%';document.getElementById('actMsg').textContent=msg;}

async function eRunAll(){
  const ready=eFiles.filter(f=>f.status==='ok');
  if(ready.length===0)return;
  document.getElementById('btnGo').classList.remove('on');
  eShowErr('');
  // Pixel — análise iniciada
  if(typeof fbq==='function' && window.PIXEL_ATIVO) fbq('trackCustom','AnalysisStarted',{files:ready.length},{ eventID: Date.now().toString() });
  // Clarity — análise iniciada
  if(typeof clarity==='function') clarity('event','AnalysisStarted');
  // Captura renda declarada do campo (opcional — ativa F7 compatibilidade)
  const _rInput = document.getElementById('rendaDeclaradaInput');
  // Leitura robusta — aceita vírgula como decimal (R$ 5.000,00 → 5000)
  const _rawRenda = _rInput ? _rInput.value.replace(/\./g,'').replace(',','.').trim() : '';
  window._rendaDeclaradaMensal = _rawRenda ? Math.max(0, parseFloat(_rawRenda) || 0) : 0;
  const results=[];
  const parsed=[]; // {txns, bank, conta, banco, label}

  // ── Etapa 1: parsear todos os arquivos ──
  for(let i=0;i<ready.length;i++){
    const f=ready[i];
    eSetProgress(Math.round((i/ready.length)*60),`Processando ${f.name}...`);
    await new Promise(r=>setTimeout(r,200));
    try{
      let txns=[];
      if(f.type==='pdf'){
        let text;
        try {
          text = await eParsePDF(f.content);
        } catch(pdfErr) {
          if(pdfErr.message === 'PDF_ESCANEADO') {
            eShowErr(`"${f.name}" parece ser um PDF escaneado (imagem). O Guardião precisa de texto digital. Exporte o extrato em PDF digital pelo app do banco, ou use o formato CSV ou OFX.`);
          } else {
            eShowErr(`Erro ao abrir "${f.name}": ${pdfErr.message}`);
          }
          continue;
        }
        txns = eParsePDFText(text);
        if(txns.length === 0){
          // Identifica banco para dar dica específica
          const bankHint = f.detected?.banco || f.detected?.bank || '';
          const dica = bankHint
            ? `Banco detectado: ${bankHint}. Tente exportar o extrato no formato CSV pelo app do banco.`
            : 'Tente exportar o extrato no formato CSV ou OFX pelo app do banco.';
          eShowErr(`Não foi possível extrair transações de "${f.name}". ${dica}`);
          continue;
        }
        // Atualiza banco real após extração do texto
        const pdfBankInfo=eDetectBankReal(text,'pdf',f.name);
        if(pdfBankInfo.banco) f.detected.banco=pdfBankInfo.banco;
        if(pdfBankInfo.conta) f.detected.conta=pdfBankInfo.conta;
        f.detected.bank=pdfBankInfo.label||`PDF (${txns.length} transações)`;
      } else {
        const lines=f.content.split('\n');
        const fmt=f.detected.format;
        if(fmt==='nubank_cartao') txns=eParseNubankCartao(lines);
        else if(fmt==='nubank_conta'){txns=eParseNubankConta(lines);if(txns.length===0)txns=eParseGeneric(lines);}
        else if(fmt==='inter') txns=eParseInter(lines);
        else if(fmt==='bb') txns=eParseBB(lines);
        else if(fmt==='ofx') txns=eParseOFX(f.content);
        else txns=eParseGeneric(lines);
      }
      if(txns.length===0){
        eShowErr(`Nenhuma transação encontrada em "${f.name}". Verifique se o arquivo está completo e no formato correto (CSV com vírgula/ponto-e-vírgula, ou OFX válido).`);
        continue;
      }
      parsed.push({
        txns,
        banco: f.detected.banco||f.detected.bank,
        conta: f.detected.conta||null,
        label: f.detected.bank,
        formato: f.detected.format,
      });
    }catch(e){
      const msg=`Erro em "${f.name}" (${f.detected?.format||'?'}): ${e.message}`;
      eShowErr(msg);
      console.error('[GuardiaoFiscal]', msg, e);
    }
  }

  if(parsed.length===0){eSetProgress(0,'Erro — nenhum extrato processado');document.getElementById('btnGo').classList.add('on');return;}

  // ── Libera buffers dos arquivos originais — não são mais necessários ──
  eFiles.forEach(f => { f.content = null; });

  // ── Etapa 2: agrupar por banco+conta ──
  // Arquivos do mesmo banco e mesma conta → um único resultado consolidado
  eSetProgress(70,'Identificando contas...');
  const grupos={};
  parsed.forEach(p=>{
    // Chave de agrupamento: banco + conta (se disponível)
    const chave = p.conta
      ? `${p.banco}|${p.conta}`
      : `${p.banco}|${p.label}`; // sem conta, agrupa por label
    if(!grupos[chave]) grupos[chave]={txns:[],banco:p.banco,conta:p.conta,label:p.label,formatos:[]};
    grupos[chave].txns.push(...p.txns);
    if(!grupos[chave].formatos.includes(p.formato)) grupos[chave].formatos.push(p.formato);
  });

  // ── Etapa 3: analisar cada grupo ──
  const grupoKeys=Object.keys(grupos);
  for(let i=0;i<grupoKeys.length;i++){
    const g=grupos[grupoKeys[i]];
    eSetProgress(70+Math.round((i/grupoKeys.length)*25),`Analisando ${g.banco}...`);
    await new Promise(r=>setTimeout(r,100));
    // Label mostra banco + conta + formatos usados
    const fmtLabel=g.formatos.length>1?` [${g.formatos.join('+')}]`:'';
    const bankLabel=g.conta?`${g.banco} ···${g.conta.slice(-4)}${fmtLabel}`:g.banco+fmtLabel;
    const r=eAnalyzeSingle(deduplicateTxns(g.txns),bankLabel,window._rendaDeclaradaMensal||0,window._perfilUsuario||null);
    if(r){
      results.push(r);
      // Expõe dados de debug apenas em ambiente local
      if(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1'){
        window._debugMotor=r;
      }
    }
  }

  if(results.length===0){eSetProgress(0,'Erro — nenhum extrato processado');document.getElementById('btnGo').classList.add('on');return;}
  eSetProgress(95,'Consolidando...');
  await new Promise(r=>setTimeout(r,300));
  const consolidated=eConsolidate(results);
  if (!consolidated) {
    eShowErr('Não foi possível consolidar os extratos. Verifique se o arquivo está no formato correto (CSV, OFX ou PDF).');
    document.getElementById('btnGo').classList.add('on');
    return;
  }
  eAllTxns=consolidated.all;
  eSetProgress(100,`${consolidated.totalTxns} transações analisadas`);

  // lock step 2, show step 3
  document.getElementById('extStep2').style.opacity='0.6';
  document.getElementById('extStep2').style.pointerEvents='none';
  document.getElementById('s2num').textContent='✓';
  document.getElementById('s2num').style.background='var(--green)';
  document.getElementById('s2num').style.color='#000';
  const s3=document.getElementById('extStep3');
  s3.style.display='block';
  document.getElementById('s3num').classList.remove('locked');

  // Mensagem inteligente: 1 conta vs múltiplas
  const nContas=results.length;
  const nArquivos=parsed.length;
  const msg=nArquivos>nContas
    ? `${nArquivos} arquivo(s) → ${nContas} conta(s) identificada(s)`
    : `${nContas} extrato(s) analisado(s)`;
  document.getElementById('s3sub').textContent=`${msg} — análise concluída`;

  _eConsolidated=consolidated;
  _eSources=results;

  // ── [v5] Salvar análise no Supabase (fire-and-forget) ────────────────────
  // Não bloqueia a UI — erro silencioso para o usuário
  if (_currentUser && sb) {
    (async () => {
      try {
        const _nivel = consolidated.score >= 71 ? 'critico'
                     : consolidated.score >= 46 ? 'elevado'
                     : consolidated.score >= 21 ? 'atencao'
                     : 'baixo';
        const _payload = {
          user_id:           _currentUser.id,
          score:             consolidated.score,
          nivel_risco:       _nivel,
          nivel_label:       consolidated.score <= 20 ? 'Baixo risco' : consolidated.score <= 45 ? 'Atenção' : consolidated.score <= 70 ? 'Risco elevado' : 'Risco crítico',
          perfil_usuario:    window._perfilUsuario || null,
          renda_declarada:   window._rendaDeclaradaMensal || null,
          total_creditos:    Math.round(consolidated.totalCredits || 0),
          total_debitos:     Math.round(consolidated.totalDebits || 0),
          total_txns:        consolidated.totalTxns || 0,
          pix_total:         Math.round(consolidated.pixTotal || 0),
          especie_total:     Math.round(consolidated.especieTotal || 0),
          indice_consumo:    Math.round((consolidated.indiceConsumo || 0) * 100),
          pix_pct:           consolidated.totalCredits > 0 ? Math.round(consolidated.pixTotal / consolidated.totalCredits * 100) : 0,
          num_alertas:       (consolidated.alerts || []).length,
          num_fontes:        results.length,
          versao_engine:     'v8.0',
          created_at:        new Date().toISOString(),
          // Dados interpretados — sem dados bancários originais (LGPD)
          fatores: JSON.stringify((results || []).flatMap(r => (r.fatores || []).filter(f => f.peso > 0)).sort((a,b) => b.peso - a.peso).slice(0, 6).map(f => ({
            motivo:          f.motivo || '',
            peso:            f.peso || 0,
            fatorKey:        f.fatorKey || '',
            quandoNaoERisco: f.quandoNaoERisco || '',
            confianca:       Math.round((f.confianca || 0) * 100),
          }))),
          alertas: JSON.stringify((consolidated.alerts || []).map(a => ({
            type:  a.type || '',
            icon:  a.icon || '',
            title: a.title || '',
            text:  a.text || '',
          }))),
        };
        await sb.from('analyses').insert(_payload);
      } catch(e) {
        console.warn('[GuardiaoFiscal] analyses insert falhou:', e.message);
      }
    })();
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Preenche preview com dados REAIS
  eRenderPreview(consolidated, results);



  s3.scrollIntoView({behavior:'smooth',block:'start'});
}


function eRenderPreview(c, sources) {
  // Guard: consolidated pode ser null se todos os extratos falharam
  if (!c) {
    document.getElementById('previewReal').style.display = 'none';
    document.getElementById('previewPlaceholder').style.display = 'block';
    document.getElementById('previewPlaceholder').innerHTML =
      '<div style="font-size:28px;margin-bottom:12px">⚠️</div>' +
      '<div style="font-family:var(--ff);font-size:14px;font-weight:600;color:var(--red);margin-bottom:6px">Não foi possível processar o extrato</div>' +
      '<div style="font-size:12px;color:var(--muted2);line-height:1.6">Verifique se o arquivo é CSV, OFX ou PDF de um banco compatível e tente novamente.</div>';
    return;
  }
  // Garantir que alerts é sempre um array mesmo que eConsolidate tenha retornado objeto parcial
  if (!Array.isArray(c.alerts)) c.alerts = [];

  // Mostra preview real, esconde placeholder
  document.getElementById('previewReal').style.display = 'block';
  document.getElementById('previewPlaceholder').style.display = 'none';

  // Score e nível
  let emoji, level, color;
  if (c.score <= 20)      { emoji='🟢'; level='BAIXO RISCO';   color='#7CFF4F'; }
  else if (c.score <= 45) { emoji='🟡'; level='ATENÇÃO';       color='#f5a623'; }
  else if (c.score <= 70) { emoji='🟠'; level='RISCO ELEVADO'; color=C_ELEVADO; }
  else                    { emoji='🔴'; level='RISCO CRÍTICO'; color=C_CRITICO; }

  document.getElementById('pvEmoji').textContent = emoji;
  document.getElementById('pvLevel').textContent = level;
  document.getElementById('pvLevel').style.color = color;
  document.getElementById('pvScore').textContent = c.score + '%';
  document.getElementById('pvScore').style.color = color;

  // Atualiza copy do paywall dinamicamente pelo score real
  (function _updatePaywallCopy(score) {
    const badge = document.getElementById('paywallDynamicBadge');
    const sub   = document.getElementById('paywallDynamicSub');
    const proBtn = document.getElementById('paywallProText');
    if (!badge || !sub) return;
    if (score > 70) {
      badge.innerHTML = '🚨 Risco crítico — ação necessária';
      badge.style.color = '#FF4D4F';
      badge.style.borderColor = 'rgba(255,77,79,0.3)';
      sub.textContent = 'Seu extrato apresenta ' + score + '% de score de risco. Veja cada transação que ativou o alerta antes que a Receita notifique.';
      if (proBtn) proBtn.textContent = 'Ver análise completa — R$29,90/mês';
    } else if (score > 45) {
      badge.innerHTML = '⚠️ Risco elevado — ' + score + '% de score';
      badge.style.color = C_ELEVADO;
      badge.style.borderColor = 'rgba(240,79,96,0.3)';
      sub.textContent = 'Identificamos padrões no seu extrato que coincidem com os critérios de cruzamento do e-Financeira. Veja os detalhes.';
    } else if (score > 20) {
      badge.innerHTML = '🟡 Atenção — ' + score + '% de score';
      badge.style.color = '#f5a623';
      badge.style.borderColor = 'rgba(245,166,35,0.3)';
      sub.textContent = 'Alguns fatores merecem atenção. Confirme se estão todos compatíveis com sua declaração de IR.';
    } else {
      badge.innerHTML = '✅ Baixo risco — ' + score + '% de score';
      badge.style.color = '#7CFF4F';
      badge.style.borderColor = 'rgba(124,255,79,0.3)';
      sub.textContent = 'Perfil com baixo risco aparente. Acesse a análise completa para confirmar cada transação.';
    }
  })(c.score);
  const evidStr = c.numEvidencias !== undefined ? ' · ' + c.numEvidencias + ' indicador(es)' : '';
  const confStr = c.confidence !== undefined ? ' · confiança ' + Math.round(c.confidence * 100) + '%' : '';
  const parseStr = c.parserConfidence !== undefined ? ' · leitura ' + Math.round(c.parserConfidence * 100) + '%' : '';
  const descStr = c.txnsDescartadas > 0 ? ' (' + c.txnsDescartadas + ' descartadas)' : '';
  document.getElementById('pvSub').textContent =
    sources.length + ' extrato(s) · ' + c.totalTxns + ' transações analisadas' +
    evidStr + confStr + parseStr + descStr;
  document.getElementById('pvBarFill').style.background = color;
  setTimeout(() => { document.getElementById('pvBarFill').style.width = c.score + '%'; }, 300);

  // Métricas rápidas (4 cards)
  const pixPct = c.totalCredits > 0 ? Math.round(c.pixTotal / c.totalCredits * 100) : 0;
  const icConsumo = Math.round((c.indiceConsumo || 0) * 100);
  // Threshold de Pix ajustado por perfil — MEI/freelancer/autônomo têm tolerância maior
  const _perfil = window._perfilUsuario || c._usuario || null;
  const _isMei = _perfil === 'mei' || _perfil === 'freelancer' || _perfil === 'socio';
  const _isInv = _perfil === 'investidor';
  const _pixRedLim  = _isMei ? 80 : _isInv ? 70 : 50;
  const _pixYelLim  = _isMei ? 60 : _isInv ? 50 : 30;
  // BUG-6: aviso de extrato curto quando meses analisados < 3
  const _mesesMin = sources.reduce((min, r) => Math.min(min, r.mesesAnalisados || 12), 12);
  if (_mesesMin < 3 && c.rendaDeclarada > 0) {
    const _avisoEl = document.getElementById('pAlertList');
    if (_avisoEl) {
      const _avisoDiv = document.createElement('div');
      _avisoDiv.className = 'alert-item alert-yellow';
      _avisoDiv.style.cssText = 'margin-top:8px;padding:10px 14px;border-radius:10px;font-size:12px;display:flex;gap:10px;align-items:flex-start';
      _avisoDiv.innerHTML = '<span>⚠️</span><span><strong>Extrato com menos de 3 meses</strong> — o índice de compatibilidade com a renda pode estar distorcido. Para maior precisão, use um extrato com 3+ meses de movimentação.</span>';
      if (_avisoEl.firstChild) _avisoEl.insertBefore(_avisoDiv, _avisoEl.firstChild);
      else _avisoEl.appendChild(_avisoDiv);
    }
  }
  document.getElementById('pvMetrics').innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Total créditos</div>
      <div style="font-family:var(--ff);font-size:16px;font-weight:800;color:var(--green)">${fmtBRL(c.totalCredits)}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${c.creditCount} entradas</div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Suspeitos</div>
      <div style="font-family:var(--ff);font-size:16px;font-weight:800;color:${c.suspCount>0?'var(--red)':'var(--green)'}">${c.suspCount}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">de ${c.creditCount} entradas</div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Pix recebidos</div>
      <div style="font-family:var(--ff);font-size:16px;font-weight:800;color:${pixPct>=_pixRedLim?'var(--red)':pixPct>=_pixYelLim?'var(--yellow)':'var(--text)'}">${pixPct}%</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">das entradas</div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Índice consumo</div>
      <div style="font-family:var(--ff);font-size:16px;font-weight:800;color:${icConsumo>=120?'var(--red)':icConsumo>=90?'var(--yellow)':'var(--green)'}">${icConsumo}%</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">saídas/entradas</div>
    </div>`;

  // Primeiros 2 alertas REAIS visíveis — guard defensivo: c.alerts pode ser undefined
  const _safeAlerts = Array.isArray(c.alerts) ? c.alerts : [];
  const alertsVisiveis = _safeAlerts.slice(0, 2);
  const alertsBloqueados = _safeAlerts.slice(2);
  const _pvLC = document.getElementById('pvLockedCount'); if(_pvLC) _pvLC.textContent = alertsBloqueados.length;

  // P8: Card mês mais crítico e confiança do parser
  // Card movimentos internos detectados
  if (c.internos && c.internos.length > 0) {
    const internCard = document.createElement('div');
    internCard.style.cssText = 'grid-column:1/-1;margin-top:4px';
    const confirmedCount = c.internos.filter(t => t.internalMove === 'confirmed').length;
    const probableCount  = c.internos.filter(t => t.internalMove === 'probable').length;
    internCard.innerHTML =
      '<div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:8px;padding:8px 12px;font-size:11px;color:var(--muted2)">' +
      '🔄 <strong style="color:var(--text)">' + c.internos.length + ' movimentação(ões) interna(s) identificada(s)</strong> — ' +
      (confirmedCount > 0 ? confirmedCount + ' confirmada(s)' : '') +
      (confirmedCount > 0 && probableCount > 0 ? ', ' : '') +
      (probableCount > 0  ? probableCount  + ' provável(is)' : '') +
      ' · Excluídas do cálculo de renda nova' +
      '</div>';
    document.getElementById('pvMetrics').appendChild(internCard);
  }

  if (c.mesCritico || c.parserConfidence !== undefined) {
    const extra = document.createElement('div');
    extra.style.cssText = 'grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;margin-top:4px';
    if (c.mesCritico) {
      const m = c.mesCritico;
      extra.innerHTML += '<div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:8px;padding:8px 12px;font-size:11px;color:var(--muted2)">' +
        '<strong style="color:var(--text)">📅 Mês mais crítico: ' + m + '</strong>' +
        (c.perfil && c.perfil.avgCredits > 0 ? ' · Média histórica de créditos: ' + fmtBRL(Math.round(c.perfil.avgCredits)) : '') +
        '</div>';
    }
    if (c.parserConfidence !== undefined) {
      const pct = Math.round(c.parserConfidence * 100);
      const pColor = pct >= 90 ? 'var(--green)' : pct >= 70 ? 'var(--orange)' : 'var(--red)';
      extra.innerHTML += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:11px;color:var(--muted2)">' +
        'Confiança de leitura: <strong style="color:' + pColor + '">' + pct + '%</strong>' +
        (c.txnsDescartadas > 0 ? ' · ' + c.txnsDescartadas + ' transações descartadas' : '') +
        '</div>';
    }
    document.getElementById('pvMetrics').appendChild(extra);
  }

  document.getElementById('pvAlerts').innerHTML = alertsVisiveis.map(a => {
    const cls = a.type==='red'?'p-red':a.type==='yellow'?'p-yel':a.type==='green'?'p-grn':'p-blu';
    const showText = a.type !== 'green'; // alertas verdes: só título, sem subtexto desnecessário
    return `<div class="pal ${cls}">
      <span class="pal-ico">${a.icon}</span>
      <div><strong>${sanitize(a.title||'')}</strong>${showText ? '<br><span style="font-size:12px;opacity:0.85">'+sanitize(a.text||'')+'</span>' : ''}
      </div>
    </div>`;
  }).join('');
}

async function _verifyPlanBeforeUnlock() {
  // PRO_FREE_MODE ativo — libera sem verificar banco
  if (PRO_FREE_MODE) return true;
  // Sem sessão — bloqueia
  if (!sb || !_currentUser) return false;
  try {
    const { data } = await sb.from('profiles').select('plano').eq('id', _currentUser.id).single();
    const plano = data?.plano;
    if (plano === 'pro' || plano === 'avulso') {
      _currentUser._plano = plano; // sincroniza em memória
      return true;
    }
    return false;
  } catch(e) {
    console.warn('[GuardiaoFiscal] Erro ao verificar plano:', e);
    return false;
  }
}

let _eCatFilter = 'all'; // categoria ativa no filtro de transações
async function eUnlockResult(){
  const allowed = await _verifyPlanBeforeUnlock();
  if (!allowed) {
    console.warn('[GuardiaoFiscal] Acesso bloqueado — plano não verificado');
    document.getElementById('paywallBlock').style.display='block';
    return;
  }
  document.getElementById('paywallBlock').style.display='none';
  document.getElementById('realResultBlock').style.display='block';
  setTimeout(() => document.getElementById('realResultBlock').scrollIntoView({behavior:'smooth',block:'start'}), 100);
  const c=_eConsolidated,sources=_eSources;
  if(!c||!sources)return;

  // Cores e níveis
  let emoji,level,color,levelHumano;
  if(c.score<=20){emoji='🟢';level='BAIXO RISCO';color='#7CFF4F';levelHumano='Sua movimentação está dentro do padrão esperado.';}
  else if(c.score<=45){emoji='🟡';level='ATENÇÃO';color='#f5a623';levelHumano='Encontramos pontos que merecem uma revisão.';}
  else if(c.score<=70){emoji='🟠';level='RISCO ELEVADO';color=C_MODERADO;levelHumano='Sua movimentação apresenta padrões que chamam atenção.';}
  else{emoji='🔴';level='RISCO CRÍTICO';color=C_CRITICO;levelHumano='Sua movimentação tem inconsistências relevantes que precisam de atenção.';}

  // Métricas
  const totalMeses = sources.reduce((acc,r)=>acc+(r.months||0),0);
  const mediaCreditos = totalMeses>0 ? c.totalCredits/totalMeses : c.totalCredits;
  const todosFatoresCtx = (sources||[]).flatMap(r=>r.fatores||[]).filter(f=>f.peso>0);
  const nPontos = todosFatoresCtx.length;
  const _perfil = window._perfilUsuario || c._usuario || null;
  const _isMei = _perfil==='mei'||_perfil==='freelancer'||_perfil==='socio';
  const _isInv = _perfil==='investidor';
  const _pixRedLim = _isMei?80:_isInv?70:50;
  const _pixYelLim = _isMei?60:_isInv?50:30;
  const icConsumo = Math.round((c.indiceConsumo||0)*100);
  const icEspecie = Math.round((c.indiceEspecie||0)*100);
  const pixPct = c.totalCredits>0?Math.round(c.pixTotal/c.totalCredits*100):0;

  // ── BLOCO 1: Score + Nível (hero do resultado) ──
  const ctxEl = document.getElementById('pContextoBlock');
  if(ctxEl){
    ctxEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px">
        <div style="font-size:48px;line-height:1;flex-shrink:0">${emoji}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:clamp(26px,7vw,38px);font-weight:800;color:${color};letter-spacing:-1.5px;line-height:1;font-family:var(--ff)">${c.score}<span style="font-size:0.55em;letter-spacing:-0.5px">%</span></div>
          <div style="font-size:clamp(13px,3.5vw,16px);font-weight:700;color:var(--text);margin:3px 0 4px;letter-spacing:0.2px">${level}</div>
          <div style="font-size:12px;color:var(--muted2);line-height:1.5">${levelHumano}</div>
        </div>
      </div>
      <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;margin-bottom:12px">
        <div id="pBarFill" style="height:100%;border-radius:4px;width:0%;background:${color};transition:width 1.2s cubic-bezier(0.4,0,0.2,1)"></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px">
        <span style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);padding:4px 10px;color:var(--muted2)">${sources.length} extrato(s)</span>
        <span style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);padding:4px 10px;color:var(--muted2)">${c.totalTxns} transações</span>
        <span style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);padding:4px 10px;color:var(--muted2)">${totalMeses} mês(es)</span>
        ${nPontos>0
          ? `<span style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.25);border-radius:var(--radius-card);padding:4px 10px;color:var(--risk-moderado);font-weight:600">${nPontos} ponto(s) de atenção</span>`
          : `<span style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:var(--radius-card);padding:4px 10px;color:var(--accent);font-weight:600">✓ nenhum padrão de risco</span>`
        }
      </div>`;
    setTimeout(()=>{const b=document.getElementById('pBarFill');if(b)b.style.width=c.score+'%';},200);
  }

  // Limpar elementos legados
  document.getElementById('ovEmoji').textContent='';
  document.getElementById('ovLevel').textContent='';
  document.getElementById('ovSub').textContent='';
  document.getElementById('pScoreVal').textContent='';
  document.getElementById('pBarFill2') && (document.getElementById('pBarFill2').style.width='0%');

  // ── BLOCO 2: 3 métricas principais ──
  document.getElementById('pStatsGrid').innerHTML=`
    <div class="p-stat">
      <div class="p-sl">Movimentação total</div>
      <div class="p-sv" style="color:var(--green)">${fmtBRL(c.totalCredits)}</div>
      <div class="p-sn">${c.creditCount} entradas · ${totalMeses} mês(es)</div>
    </div>
    <div class="p-stat">
      <div class="p-sl">Transações de atenção</div>
      <div class="p-sv" style="color:${c.suspCount>0?'var(--red)':'var(--green)'}">
        ${c.suspCount} <span style="font-size:12px;font-weight:400">de ${c.creditCount}</span>
      </div>
      <div class="p-sn">${c.suspCount>0?'requerem verificação':'perfil dentro do esperado'}</div>
    </div>
    <div class="p-stat">
      <div class="p-sl">Recebimentos via Pix</div>
      <div class="p-sv" style="color:${pixPct>=_pixRedLim?'var(--red)':pixPct>=_pixYelLim?'var(--yellow)':'var(--text)'}">${pixPct}%</div>
      <div class="p-sn">das entradas · ${fmtBRL(c.pixTotal)}</div>
    </div>`;

  // ── BLOCO 3: Extratos analisados (compacto) ──
  document.getElementById('srcList').innerHTML=sources.map((r,i)=>`
    <div class="src-item">
      <div class="src-dot" style="background:${SRC_COLORS[i%SRC_COLORS.length]}"></div>
      <span class="src-bank">${sanitize(r.bank)}</span>
      <span class="src-txns">${sanitize(String(r.totalTxns))} transações · ${sanitize(String(r.months))} mês(es)</span>
      <span class="src-val">${fmtBRL(r.totalCredits)}</span>
      <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:${r.score<=20?'rgba(0,217,110,0.1)':r.score<=45?'rgba(245,166,35,0.1)':r.score<=70?'rgba(249,115,22,0.1)':'rgba(240,79,96,0.1)'};color:${r.score<=20?'var(--green)':r.score<=45?'var(--yellow)':r.score<=70?C_MODERADO:'var(--red)'}">${sanitize(String(r.score))}%</span>
    </div>`).join('');

  // ── BLOCO 4: Fatores de risco (redesenhados) ──
  const _fundamento = {
    'F1_omissao_renda':    'A Receita cruza créditos bancários com a renda declarada via e-Financeira.',
    'F2_pix_limite':       'Bancos reportam à Receita movimentações Pix acima de R$5.000/mês automaticamente.',
    'F3_especie':          'Depósitos em espécie acima de R$2.000/mês são reportados ao Fisco pelos bancos.',
    'F4_comercial_oculta': 'Recebimentos recorrentes sem nota fiscal ou CNPJ são gatilho de fiscalização.',
    'F5_anomalia_temporal':'Variação brusca entre meses é detectada no cruzamento anual da declaração.',
    'F7_compatibilidade':  'Incompatibilidade entre movimentação e renda declarada acima de 20% é gatilho automático.',
    'F8_conta_auxiliar':   'Contas secundárias são consolidadas pela e-Financeira com a conta principal do CPF.',
  };

  const todosFatores = (sources||[]).flatMap(r=>r.fatores||[]).filter(f=>f.peso>0||f.tipo==='aviso');
  const fatoresOrdenados = todosFatores.sort((a,b)=>b.peso-a.peso).slice(0,6);
  const fatoresEl = document.getElementById('pFatoresList');
  if(fatoresEl){
    if(fatoresOrdenados.length===0){
      fatoresEl.innerHTML='';
    } else {
      // Mapeamento de peso → badge de criticidade
      function _getBadge(peso, tipo){
        if(tipo==='aviso') return '<span class="res-badge res-badge--atencao">⚠ Atenção</span>';
        if(peso>=25) return '<span class="res-badge res-badge--critico">🔴 Crítico</span>';
        if(peso>=15) return '<span class="res-badge res-badge--moderado">🟠 Moderado</span>';
        if(peso>=5)  return '<span class="res-badge res-badge--atencao">🟡 Atenção</span>';
        return '<span class="res-badge res-badge--ok">✓ Baixo</span>';
      }

      let fatoresHtml = '<div class="res-section-label">Pontos identificados</div>';
      fatoresOrdenados.forEach(function(f, idx){
        const fund = _fundamento[f.fatorKey]||'';
        let evidHtml = '';
        (f.evidencias||[]).forEach(function(e){
          evidHtml += '<div class="res-fator-ev">'
            + '<span style="color:'+(e.ok?'var(--red)':'var(--accent)')+';font-weight:700;flex-shrink:0;margin-top:1px">'+(e.ok?'▸':'✓')+'</span>'
            + '<span>'+sanitize(e.texto)+'</span>'
            + '</div>';
        });
        const cardClass = f.tipo==='aviso' ? 'res-fator-card res-fator-card--aviso' : 'res-fator-card';
        const detailId = 'rfdetail_'+idx;
        const hasDetails = !!(fund || evidHtml || f.quandoNaoERisco);

        fatoresHtml += '<div class="'+cardClass+'" onclick="_toggleFator(\''+detailId+'\')" role="button" aria-expanded="false">'
          + '<div class="res-fator-header" style="align-items:flex-start">'
          + '<div class="res-fator-peso">+'+f.peso+'</div>'
          + '<div class="res-fator-titulo" style="padding-top:3px">'+sanitize((f.motivo||'').split('.')[0])+'</div>'
          + _getBadge(f.peso, f.tipo)
          + (hasDetails ? '<span class="res-fator-toggle" id="'+detailId+'_tog">ver ▾</span>' : '')
          + '</div>';

        if(hasDetails){
          fatoresHtml += '<div class="res-fator-details" id="'+detailId+'">'
            + (fund ? '<div class="res-fator-fundamento" style="margin-left:0">'+sanitize(fund)+'</div>' : '')
            + (evidHtml ? '<div class="res-fator-evidencias" style="margin-left:0">'+evidHtml+'</div>' : '')
            + (f.quandoNaoERisco ? '<div class="res-fator-nao-risco" style="margin-left:0;margin-top:8px"><strong>Pode não ser risco</strong> — '+sanitize(f.quandoNaoERisco)+'</div>' : '')
            + '</div>';
        }
        fatoresHtml += '</div>';
      });
      fatoresEl.innerHTML = fatoresHtml;
    }
  }

  // ── BLOCO 5: Alertas (com badges) ──
  const alertasVisiveis = (c.alerts||[]).filter(function(a){return a.type!=='green';});
  const alertasPositivos = (c.alerts||[]).filter(function(a){return a.type==='green';});
  let alertHtml = '';
  if(alertasVisiveis.length>0){
    alertHtml += '<div class="res-section-label">Alertas</div>';
    alertasVisiveis.forEach(function(a){
      const cls = a.type==='red'?'res-alert--red':a.type==='yellow'?'res-alert--yellow':'res-alert--blue';
      const badge = a.type==='red'
        ? '<span class="res-badge res-badge--critico" style="margin-left:auto;flex-shrink:0">Crítico</span>'
        : a.type==='yellow'
        ? '<span class="res-badge res-badge--atencao" style="margin-left:auto;flex-shrink:0">Atenção</span>'
        : '';
      alertHtml += '<div class="res-alert '+cls+'" style="align-items:center">'
        + '<span class="res-alert-icon" style="flex-shrink:0">'+a.icon+'</span>'
        + '<div style="flex:1;min-width:0"><div class="res-alert-title">'+sanitize(a.title||'')+'</div>'
        + '<div class="res-alert-text">'+sanitize(a.text||'')+'</div></div>'
        + badge
        + '</div>';
    });
  }
  if(alertasPositivos.length>0){
    if(alertasVisiveis.length===0) alertHtml += '<div class="res-section-label">Destaques positivos</div>';
    alertasPositivos.forEach(function(a){
      alertHtml += '<div class="res-alert res-alert--green" style="align-items:center">'
        + '<span class="res-alert-icon" style="flex-shrink:0">'+a.icon+'</span>'
        + '<div style="flex:1;min-width:0"><div class="res-alert-title">'+sanitize(a.title||'')+'</div></div>'
        + '<span class="res-badge res-badge--ok" style="margin-left:auto;flex-shrink:0">OK</span>'
        + '</div>';
    });
  }
  document.getElementById('pAlertList').innerHTML = alertHtml;

  // Aviso extrato curto
  if(c.extratoMuitoCurto){
    const avisoEl=document.createElement('div');
    avisoEl.className='res-alert res-alert--yellow';
    avisoEl.style.marginBottom='8px';
    avisoEl.innerHTML='<span class="res-alert-icon">⚠️</span><div><div class="res-alert-title">Extrato com menos de 3 meses</div><div class="res-alert-text">Para maior precisão, importe pelo menos 3 meses de extrato.</div></div>';
    const alertList=document.getElementById('pAlertList');
    if(alertList)alertList.parentNode.insertBefore(avisoEl,alertList);
  }

  // Bank tabs e transações
  const bankTabsEl=document.getElementById('bankTabs');
  bankTabsEl.innerHTML='';
  ['all',...sources.map(r=>r.bank)].forEach((b,i)=>{
    const btn=document.createElement('button');
    btn.className='btab'+(b==='all'?' on':'');
    btn.textContent=b==='all'?'Todos':b;
    btn.onclick=()=>eSwitchBank(b);
    bankTabsEl.appendChild(btn);
  });
  eActiveBankTab='all';

  document.getElementById('pDbgPre').textContent = 'Motor: v8.0 · Site: v15.1.0\nExtratos: '+sources.length+'\nTotal txns: '+c.totalTxns+'\nScore: '+c.score+'%\nÍndice consumo: '+Math.round((c.indiceConsumo||0)*100)+'%\nÍndice espécie: '+Math.round((c.indiceEspecie||0)*100)+'%\nPadrões recorrentes: '+c.recorrentes+'\n'+sources.map(function(r){return '['+r.bank+'] '+r.totalTxns+' txns · score '+r.score+'% · fatores: '+(r.fatores||[]).map(function(f){return f.motivo;}).join(', ');}).join('\n');

  _eCatFilter = 'all'; // reset categoria ao carregar novo resultado
  eRenderTxns('all');
  setTimeout(_initCatCounts, 100); // inicializa contadores após render

  setTimeout(()=>{
    if(!document.getElementById('gFeedbackCard')&&typeof gRenderFeedbackCard==='function'){
      const target=document.getElementById('pAlertList')?.parentElement||document.getElementById('realResultBlock');
      if(target)gRenderFeedbackCard(target,c);
    }
  },300);
}


function histToggle(el) {
  var id = el.getAttribute('data-histid');
  var d = document.getElementById(id);
  if (!d) return;
  var open = d.style.display !== 'none';
  d.style.display = open ? 'none' : 'block';
  var chev = el.querySelector('.hist-chevron');
  if (chev) chev.textContent = open ? '▼' : '▲';
}

function eSwitchBank(bank){
  eActiveBankTab=bank;
  document.querySelectorAll('.btab').forEach(b=>b.classList.toggle('on',b.textContent.trim()===(bank==='all'?'Todos':bank)));
  const currentFilter=document.getElementById('pfRisk')?.classList.contains('on')?'risk':'all';
  eRenderTxns(currentFilter);
}

// ── Accordion dos fatores ──
window._toggleFator = function(detailId){
  const el = document.getElementById(detailId);
  const tog = document.getElementById(detailId+'_tog');
  if(!el) return;
  const open = el.classList.toggle('open');
  if(tog) tog.textContent = open ? 'fechar ▴' : 'ver ▾';
  // Atualiza aria-expanded no card pai
  const card = el.closest('[role="button"]');
  if(card) card.setAttribute('aria-expanded', open ? 'true' : 'false');
};

// ── Filtro por categoria de transação ──
window.eCatFilt = function(cat){
  _eCatFilter = cat;
  // Resetar visual de todos os botões de categoria
  ['rcAll','rcPix','rcSusp','rcEspecie','rcSaida'].forEach(function(id){
    const btn = document.getElementById(id);
    if(!btn) return;
    btn.className = 'res-cat-btn';
    // Reaplica classe especial para o botão de suspeitas
    if(id === 'rcSusp') btn.classList.add('on-red');
  });
  const activeId = cat==='all'?'rcAll':cat==='pix'?'rcPix':cat==='susp'?'rcSusp':cat==='especie'?'rcEspecie':'rcSaida';
  const activeBtn = document.getElementById(activeId);
  if(activeBtn){
    if(cat === 'susp') { activeBtn.className = 'res-cat-btn on-red'; }
    else { activeBtn.classList.add('on'); }
  }
  const riskFilter = document.getElementById('pfRisk')?.classList.contains('on') ? 'risk' : 'all';
  eRenderTxns(riskFilter);
};

function eRenderTxns(filter){
  let list = eActiveBankTab==='all' ? [...eAllTxns] : eAllTxns.filter(t=>t.bank===eActiveBankTab);

  // Filtro risco/todas
  if(filter==='risk') list = list.filter(t=>t.risk!=='normal');

  // Filtro categoria
  if(_eCatFilter==='pix')     list = list.filter(t=> (t.desc||'').toLowerCase().includes('pix'));
  if(_eCatFilter==='susp')    list = list.filter(t=> t.risk==='suspicious');
  if(_eCatFilter==='especie') list = list.filter(t=> {
    const d = (t.desc||'').toLowerCase();
    return d.includes('espécie')||d.includes('especie')||d.includes('dinheiro')||d.includes('depósito em')||d.includes('deposito em');
  });
  if(_eCatFilter==='saida')   list = list.filter(t=> t.value < 0);

  list.sort((a,b)=>{const o={suspicious:0,attention:1,normal:2};if(o[a.risk]!==o[b.risk])return o[a.risk]-o[b.risk];return b.value-a.value;});

  document.getElementById('pTxnList').innerHTML = list.map(t=>{
    const dc = t.risk==='suspicious'?'pdr':t.risk==='attention'?'pdy':t.value>0?'pdg':'pdm';
    const cls = t.risk==='suspicious'?' s':t.risk==='attention'?' a':'';
    return `<div class="pti${cls}"><div class="pdot ${dc}"></div><div class="ptinfo"><div class="ptd">${sanitize(t.desc||'—')}</div><div class="ptt">${fmtDate(t.date)}</div></div><div class="ptv ${t.value>=0?'p':'n'}">${fmtBRL(t.value)}</div>${t.flag?'<span class="ptf '+(t.risk==="suspicious"?'r':'y')+'">'+sanitize(t.flag||'')+' </span>':''}<span class="ptbank">${sanitize(t.bank||'')} </span></div>`;
  }).join('') || '<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px">Nenhuma transação nesta categoria</div>';
}

// Inicializa contadores das categorias após render das transações
function _initCatCounts(){
  const all = eAllTxns || [];
  const pix = all.filter(t=>(t.desc||'').toLowerCase().includes('pix'));
  const susp = all.filter(t=>t.risk==='suspicious');
  const especie = all.filter(t=>{ const d=(t.desc||'').toLowerCase(); return d.includes('espécie')||d.includes('especie')||d.includes('dinheiro'); });
  const saida = all.filter(t=>t.value<0);

  const _setCount = (id, n) => { const el=document.getElementById(id); if(el) el.textContent=n; };
  _setCount('rcAllCount', all.length);
  _setCount('rcSaidaCount', saida.length);

  // Só mostra botão Pix se existirem transações Pix
  if(pix.length > 0){
    _setCount('rcPixCount', pix.length);
    const btn = document.getElementById('rcPix');
    if(btn) btn.style.display = '';
  }
  // Só mostra botão Suspeitas se existirem
  if(susp.length > 0){
    _setCount('rcSuspCount', susp.length);
    const btn = document.getElementById('rcSusp');
    if(btn) btn.style.display = '';
  }
  // Só mostra botão Espécie se existirem
  if(especie.length > 0){
    _setCount('rcEspecieCount', especie.length);
    const btn = document.getElementById('rcEspecie');
    if(btn) btn.style.display = '';
  }
}

function eFilt(f){
  document.getElementById('pfAll')?.classList.toggle('on',f==='all');
  document.getElementById('pfRisk')?.classList.toggle('on',f==='risk');
  eRenderTxns(f);
}
function eToggleDbg(){const b=document.getElementById('pDbgBd'),open=b.classList.toggle('open');document.getElementById('pDbgTog').textContent=open?'▲ recolher':'▼ ver';}
// Painel de debug só em desenvolvimento
if(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1'){
  const dbgHd=document.getElementById('pDbgHd');
  if(dbgHd){dbgHd.style.display='flex';document.getElementById('pDbgBd').style.display='';}
}
async function gerarRelatorioPDF() {
  const c = _eConsolidated;
  const sources = _eSources;
  if (!c || !sources) { alert('Dados da análise não encontrados. Refaça a análise.'); return; }

  const btn = document.getElementById('btnExportPDF');
  if (btn) { btn.textContent = '⏳ Gerando PDF...'; btn.style.opacity = '0.7'; btn.disabled = true; }

  try {
    await _loadJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, M = 14, CW = W - M * 2;
    let Y = 0;

    // ── Paleta limpa (fundo branco, acentos coloridos) ─────────────────
    const C = {
      white:   [255, 255, 255],
      bg:      [248, 249, 251],     // cinza muito claro
      surface: [255, 255, 255],
      card:    [243, 244, 246],     // card neutro
      border:  [229, 231, 235],
      text:    [17,  24,  39],      // quase preto
      muted:   [107, 114, 128],     // cinza médio
      muted2:  [156, 163, 175],
      green:   [16,  185, 129],     // emerald
      yellow:  [245, 158, 11],      // amber
      red:     [239, 68,  68],      // red
      orange:  [249, 115, 22],      // orange
      blue:    [59,  130, 246],     // blue
      greenBg: [236, 253, 245],
      yellowBg:[254, 243, 199],
      redBg:   [254, 226, 226],
      blueBg:  [239, 246, 255],
      accent:  [59,  130, 246],     // cor principal da marca
    };

    function sColor(s) {
      if (s <= 20) return { line: C.green,  bg: C.greenBg,  label: 'Perfil Compatível' };
      if (s <= 45) return { line: C.yellow, bg: C.yellowBg, label: 'Sinais de Atenção' };
      if (s <= 70) return { line: C.orange, bg: C.yellowBg, label: 'Nível de Atenção Elevado' };
      return       { line: C.red,    bg: C.redBg,   label: 'Requer Análise Urgente' };
    }

    function aColor(type) {
      if (type === 'red')    return { line: C.red,    bg: C.redBg    };
      if (type === 'yellow') return { line: C.yellow, bg: C.yellowBg };
      if (type === 'green')  return { line: C.green,  bg: C.greenBg  };
      return                        { line: C.blue,   bg: C.blueBg   };
    }

    // ── Helpers ────────────────────────────────────────────────────────
    function txt(text, x, y, opts = {}) {
      const { size = 9, color = C.text, bold = false, maxW = CW, align = 'left', italic = false } = opts;
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const style = bold ? 'bold' : italic ? 'italic' : 'normal';
      doc.setFont('helvetica', style);
      const lines = doc.splitTextToSize(String(text), maxW);
      doc.text(lines, x, y, { align });
      return lines.length * (size * 0.42);
    }

    function rect(x, y, w, h, fill, stroke = null, r = 1.5) {
      doc.setFillColor(...fill);
      if (stroke) { doc.setDrawColor(...stroke); doc.setLineWidth(0.3); doc.roundedRect(x, y, w, h, r, r, 'FD'); }
      else { doc.roundedRect(x, y, w, h, r, r, 'F'); }
    }

    function section(label, y) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.accent);
      doc.text(label.toUpperCase(), M, y);
      doc.setDrawColor(...C.accent);
      doc.setLineWidth(0.2);
      doc.line(M + doc.getTextWidth(label.toUpperCase()) + 2, y - 0.5, W - M, y - 0.5);
      return y + 6;
    }

    function newPage() {
      doc.addPage();
      // linha de topo
      doc.setFillColor(...C.accent);
      doc.rect(0, 0, W, 1.5, 'F');
      // rodapé
      drawFooter(doc.internal.getNumberOfPages());
      return 14;
    }

    function checkY(needed) {
      if (Y + needed > 272) { Y = newPage(); }
    }

    function drawFooter(p) {
      doc.setFillColor(...C.bg);
      doc.rect(0, 285, W, 12, 'F');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.muted2);
      doc.text('Guardião Fiscal · oguardiaofiscal.com.br · Diagnóstico preventivo e educacional', M, 290);
      doc.text('Este documento não substitui orientação de contador ou advogado tributarista.', M, 294);
      doc.setTextColor(...C.muted);
      doc.text('Pág. ' + p, W - M, 290, { align: 'right' });
      doc.text('Processamento 100% local · LGPD', W - M, 294, { align: 'right' });
    }

    // ════════════════════════════════════════════════════════════════════
    // CAPA / HEADER
    // ════════════════════════════════════════════════════════════════════
    // Barra superior azul
    doc.setFillColor(...C.accent);
    doc.rect(0, 0, W, 2, 'F');

    // Fundo do header
    rect(0, 2, W, 46, C.bg, null, 0);

    // Logo / título
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.accent);
    doc.text('Guardião', M, 20);
    doc.setTextColor(...C.text);
    doc.text(' Fiscal', M + doc.getTextWidth('Guardião'), 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text('Relatório de Análise de Coerência Fiscal', M, 27);

    const now = new Date();
    const dataStr = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
    txt(dataStr, W - M, 20, { size: 8, color: C.muted, align: 'right' });
    txt(sources.length + ' extrato(s) · ' + c.totalTxns + ' transações analisadas', W - M, 27, { size: 8, color: C.muted2, align: 'right' });

    // Linha divisória
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(M, 36, W - M, 36);

    // Tagline de privacidade
    txt('🔒 Processamento 100% local — nenhum dado bancário foi enviado a servidores externos', M, 42, { size: 7.5, color: C.muted, italic: true });

    Y = 56;

    // ════════════════════════════════════════════════════════════════════
    // SCORE PRINCIPAL
    // ════════════════════════════════════════════════════════════════════
    const sc = c.score;
    const scTheme = sColor(sc);

    // Card principal do score
    rect(M, Y, CW, 38, C.surface, C.border, 3);

    // Faixa lateral colorida
    doc.setFillColor(...scTheme.line);
    doc.roundedRect(M, Y, 4, 38, 1.5, 1.5, 'F');

    // Número grande
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...scTheme.line);
    doc.text(sc + '%', M + 12, Y + 24);

    // Barra de progresso
    const barX = M + 52, barY = Y + 10, barW = CW - 62, barH = 4;
    rect(barX, barY, barW, barH, C.card, null, 1);
    rect(barX, barY, Math.max(2, Math.round(barW * sc / 100)), barH, scTheme.line, null, 1);

    // Nível e label
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...scTheme.line);
    doc.text(scTheme.label, barX, Y + 22);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text('Score de Coerência Fiscal · Motor v8 · ' + sources.length + ' fonte(s)', barX, Y + 28);
    doc.text('Índice calculado por 6 fatores ponderados: compatibilidade, Pix, espécie, recorrência, anomalia temporal e perfil.', barX, Y + 33, { maxWidth: barW });

    Y += 46;

    // ════════════════════════════════════════════════════════════════════
    // FATORES QUE COMPÕEM O SCORE
    // ════════════════════════════════════════════════════════════════════
    const todosFatores = (sources || []).flatMap(r => r.fatores || []);
    const fatoresTop = todosFatores.filter(f => f.peso > 0).sort((a, b) => b.peso - a.peso).slice(0, 6);

    if (fatoresTop.length > 0) {
      checkY(10 + fatoresTop.length * 10 + 6);
      Y = section('Fatores que compõem o score', Y);

      fatoresTop.forEach((f, i) => {
        checkY(12);
        const fColor = f.peso >= 15 ? C.red : f.peso >= 8 ? C.yellow : C.muted;
        rect(M, Y, CW, 9, i % 2 === 0 ? C.bg : C.surface, null, 1);

        // nome do fator
        txt(f.motivo, M + 4, Y + 5.5, { size: 8, maxW: CW - 40 });

        // peso visual — barra pequena
        const pw = Math.min(CW - 10, Math.round((f.peso / 20) * 40));
        const barFX = W - M - 46;
        doc.setFillColor(...C.card);
        doc.roundedRect(barFX, Y + 2.5, 40, 4, 1, 1, 'F');
        doc.setFillColor(...fColor);
        doc.roundedRect(barFX, Y + 2.5, pw, 4, 1, 1, 'F');

        // valor +N
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...fColor);
        doc.text('+' + f.peso, W - M - 2, Y + 5.5, { align: 'right' });

        Y += 10;
      });
      Y += 4;
    }

    // ════════════════════════════════════════════════════════════════════
    // EXTRATOS ANALISADOS
    // ════════════════════════════════════════════════════════════════════
    checkY(20 + sources.length * 14);
    Y = section('Extratos analisados', Y);

    sources.forEach((r, i) => {
      checkY(14);
      const rTheme = sColor(r.score);
      rect(M, Y, CW, 12, i % 2 === 0 ? C.surface : C.bg, C.border, 2);
      doc.setFillColor(...rTheme.line);
      doc.roundedRect(M, Y, 3, 12, 1, 1, 'F');
      txt(r.bank, M + 6, Y + 4.5, { size: 9, bold: true });
      txt(r.totalTxns + ' transações · ' + r.months + ' mês(es)', M + 6, Y + 9, { size: 7.5, color: C.muted });
      txt(fmtBRL(r.totalCredits), W - M - 20, Y + 4.5, { size: 9, bold: true, color: C.green, align: 'right' });
      txt(r.score + '%', W - M, Y + 4.5, { size: 9, bold: true, color: rTheme.line, align: 'right' });
      txt(rTheme.label, W - M, Y + 9, { size: 7, color: C.muted2, align: 'right' });
      Y += 13;
    });
    Y += 4;

    // ════════════════════════════════════════════════════════════════════
    // INDICADORES FISCAIS — grid 3 colunas
    // ════════════════════════════════════════════════════════════════════
    const icConsumo = Math.round((c.indiceConsumo || 0) * 100);
    const icEspecie = Math.round((c.indiceEspecie || 0) * 100);
    const pixPct    = c.totalCredits > 0 ? Math.round(c.pixTotal / c.totalCredits * 100) : 0;

    const metricas = [
      { label: 'Total de créditos',          val: fmtBRL(c.totalCredits), sub: c.creditCount + ' entradas',      color: C.green  },
      { label: 'Pix recebidos',              val: fmtBRL(c.pixTotal),     sub: pixPct + '% das entradas',        color: pixPct >= 50 ? C.red : pixPct >= 30 ? C.yellow : C.text },
      { label: 'Índice de consumo',          val: icConsumo + '%',        sub: 'saídas ÷ entradas',              color: icConsumo >= 120 ? C.red : icConsumo >= 90 ? C.yellow : C.green },
      { label: 'Movimentações em espécie',   val: icEspecie + '%',        sub: 'das entradas',                   color: icEspecie >= 20 ? C.red : icEspecie >= 10 ? C.yellow : C.green },
      { label: 'Movimentos para revisão',    val: String(c.suspCount),    sub: 'merecem atenção',                color: c.suspCount > 0 ? C.red : C.green },
      { label: 'Padrões recorrentes',        val: String(c.recorrentes),  sub: 'atividade regular detectada',    color: c.recorrentes > 3 ? C.yellow : C.text },
    ];

    checkY(20 + Math.ceil(metricas.length / 3) * 22);
    Y = section('Indicadores fiscais', Y);

    const cw3 = (CW - 4) / 3;
    metricas.forEach((m, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const mx = M + col * (cw3 + 2), my = Y + row * 22;
      checkY(22);
      rect(mx, my, cw3, 19, C.surface, C.border, 2);
      txt(m.label,  mx + 4, my + 5,  { size: 7,    color: C.muted,  maxW: cw3 - 6 });
      txt(m.val,    mx + 4, my + 12, { size: 11.5, color: m.color,  maxW: cw3 - 6, bold: true });
      txt(m.sub,    mx + 4, my + 17, { size: 6.5,  color: C.muted2, maxW: cw3 - 6 });
    });
    Y += Math.ceil(metricas.length / 3) * 22 + 6;

    // ════════════════════════════════════════════════════════════════════
    // ALERTAS — com fundo colorido suave
    // ════════════════════════════════════════════════════════════════════
    if (c.alerts && c.alerts.length > 0) {
      checkY(16);
      Y = section('Sinais e orientações', Y);

      c.alerts.forEach(a => {
        const ac = aColor(a.type);
        const titleLines = doc.splitTextToSize(a.title || '', CW - 12);
        const textLines  = doc.splitTextToSize(a.text  || '', CW - 14);
        const bH = 5 + titleLines.length * 4.5 + textLines.length * 3.8 + 4;
        checkY(bH + 3);

        rect(M, Y, CW, bH, ac.bg, null, 2);
        // borda lateral fina
        doc.setFillColor(...ac.line);
        doc.roundedRect(M, Y, 2.5, bH, 1, 1, 'F');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...ac.line);
        doc.text(titleLines, M + 6, Y + 5.5);
        const tH = titleLines.length * 4.5;

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.muted);
        doc.text(textLines, M + 6, Y + 5.5 + tH + 1);
        Y += bH + 3;
      });
      Y += 4;
    }

    // ════════════════════════════════════════════════════════════════════
    // MOVIMENTAÇÕES RECORRENTES AGRUPADAS
    // ════════════════════════════════════════════════════════════════════
    const todasComerciais = (sources || []).flatMap(r => r.comercialOculta || []);
    if (todasComerciais.length > 0) {
      checkY(16);
      Y = section('Padrões recorrentes detectados', Y);
      txt('Recebimentos com frequência e ticket regular — possível atividade comercial não declarada.', M, Y, { size: 7.5, color: C.muted, italic: true });
      Y += 7;

      todasComerciais.slice(0, 8).forEach((r, i) => {
        checkY(14);
        rect(M, Y, CW, 12, i % 2 === 0 ? C.surface : C.bg, C.border, 2);
        const label = r.desc ? r.desc.slice(0, 38) : ('Padrão ' + (i + 1));
        txt(label, M + 4, Y + 4.5, { size: 8.5, bold: true });
        txt(r.count + ' recebimentos · Ticket médio: ' + fmtBRL(Math.round(r.media)) + ' · Total: ' + fmtBRL(r.total), M + 4, Y + 9, { size: 7.5, color: C.muted });
        rect(W - M - 30, Y + 2, 28, 8, C.yellowBg, null, 2);
        txt('Periodicidade regular', W - M - 2, Y + 6.5, { size: 6.5, color: C.yellow, align: 'right' });
        Y += 13;
      });
      Y += 4;
    }

    // ════════════════════════════════════════════════════════════════════
    // MOVIMENTAÇÕES QUE MERECEM REVISÃO (ex-"suspeitas")
    // ════════════════════════════════════════════════════════════════════
    const txnsRevisao = eAllTxns
      .filter(t => t.risk !== 'normal')
      .sort((a, b) => {
        const o = { suspicious: 0, attention: 1 };
        return (o[a.risk] || 2) - (o[b.risk] || 2) || b.value - a.value;
      })
      .slice(0, 25);

    if (txnsRevisao.length > 0) {
      checkY(20);
      Y = section('Movimentações que merecem revisão', Y);
      txt('Lista das transações com maior relevância fiscal, ordenadas por prioridade de revisão.', M, Y, { size: 7.5, color: C.muted, italic: true });
      Y += 7;

      // Cabeçalho
      rect(M, Y, CW, 7, C.card, null, 1);
      const cols = [
        { label: 'Data',       x: M + 2,   w: 22 },
        { label: 'Descrição',  x: M + 26,  w: 82 },
        { label: 'Banco',      x: M + 110, w: 28 },
        { label: 'Valor',      x: M + 140, w: 30 },
        { label: 'Revisão',    x: M + 172, w: 24 },
      ];
      cols.forEach(col => {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.muted);
        doc.text(col.label, col.x, Y + 4.5);
      });
      Y += 8;

      txnsRevisao.forEach((t, i) => {
        checkY(8);
        const rTheme = t.risk === 'suspicious'
          ? { bg: [254,226,226], color: C.red,    label: 'Prioritária' }
          : { bg: [254,243,199], color: C.yellow, label: 'Moderada'    };
        rect(M, Y, CW, 6.5, i % 2 === 0 ? C.surface : C.bg, null, 0);
        // faixinha lateral
        doc.setFillColor(...rTheme.color);
        doc.rect(M, Y, 1.5, 6.5, 'F');

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.text);
        doc.text(fmtDate(t.date), cols[0].x, Y + 4.2);
        const dsc = doc.splitTextToSize(t.desc || '—', cols[1].w)[0];
        doc.text(dsc, cols[1].x, Y + 4.2);
        doc.setTextColor(...C.muted);
        doc.text((t.bank || '').slice(0, 10), cols[2].x, Y + 4.2);
        if (t.value >= 0) { doc.setTextColor(...C.green); } else { doc.setTextColor(...C.text); }
        doc.text(fmtBRL(t.value), cols[3].x, Y + 4.2);
        doc.setTextColor(...rTheme.color);
        doc.text(rTheme.label, cols[4].x, Y + 4.2);
        Y += 7;
      });
      Y += 4;
    }

    // ════════════════════════════════════════════════════════════════════
    // ORIENTAÇÕES FINAIS
    // ════════════════════════════════════════════════════════════════════
    checkY(38);
    Y = section('Próximos passos recomendados', Y);

    const orientacoes = [
      { icon: '📊', text: 'Compare os créditos identificados com o total declarado no IR. Divergências superiores a 20% são as mais frequentemente retidas.' },
      { icon: '📁', text: 'Tenha comprovantes de origem disponíveis para todas as entradas relevantes — especialmente transferências, Pix recorrentes e depósitos em espécie.' },
      { icon: '👨‍💼', text: 'Consulte um contador antes da entrega da declaração para validar os pontos de atenção identificados neste relatório.' },
      { icon: '🔄', text: 'Se já entregou a declaração, avalie a possibilidade de retificação preventiva. Após notificação, multas e juros se aplicam automaticamente.' },
    ];

    orientacoes.forEach((o, i) => {
      checkY(14);
      rect(M, Y, CW, 11, i % 2 === 0 ? C.bg : C.surface, C.border, 2);
      txt(o.icon, M + 3, Y + 7, { size: 9 });
      txt(o.text, M + 12, Y + 4.5, { size: 7.5, color: C.text, maxW: CW - 16 });
      Y += 12;
    });

    // ════════════════════════════════════════════════════════════════════
    // DISCLAIMER LEGAL
    // ════════════════════════════════════════════════════════════════════
    checkY(20);
    Y += 6;
    rect(M, Y, CW, 16, C.card, C.border, 2);
    txt('⚠️  Aviso Legal', M + 4, Y + 5, { size: 8, bold: true, color: C.muted });
    txt('Este relatório é uma ferramenta de diagnóstico educacional e preventivo. Os resultados são estimativas com base em padrões fiscais conhecidos e não constituem parecer jurídico, contábil ou auditoria fiscal. O Guardião Fiscal não tem acesso à sua declaração de IR nem ao sistema da Receita Federal. Consulte sempre um profissional habilitado para decisões fiscais.', M + 4, Y + 9.5, { size: 7, color: C.muted, maxW: CW - 6, italic: true });
    Y += 18;

    // ════════════════════════════════════════════════════════════════════
    // RODAPÉS em todas as páginas
    // ════════════════════════════════════════════════════════════════════
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter(p);
    }

    const filename = 'guardiao-fiscal-' + now.toISOString().slice(0, 10) + '.pdf';
    doc.save(filename);

  } catch(err) {
    console.error('[GuardiaoFiscal] Erro ao gerar PDF:', err);
    alert('Erro ao gerar o PDF: ' + err.message);
  } finally {
    if (btn) { btn.innerHTML = '📄 Exportar relatório em PDF'; btn.style.opacity = '1'; btn.disabled = false; }
  }
}


// ── Seletor de perfil ────────────────────────────────────────────────────────
window._perfilUsuario = null; // 'clt' | 'mei' | 'investidor'

function selecionarPerfil(perfil, btn) {
  window._perfilUsuario = perfil;
  // Reset visual de todos os botões
  document.querySelectorAll('#perfilBtns button').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.color = 'var(--muted2)';
    b.style.background = 'var(--surface2)';
  });
  // Ativa o selecionado
  btn.style.borderColor = 'rgba(0,217,110,0.6)';
  btn.style.color = 'var(--green)';
  btn.style.background = 'rgba(0,217,110,0.06)';
}

function eResetAll(){
  eFiles=[];eAllTxns=[];eActiveBankTab='all';
  _eConsolidated=null;_eSources=null;
  // Reset filtro de categoria
  _eCatFilter='all';
  ['rcAll','rcPix','rcSusp','rcEspecie','rcSaida'].forEach(function(id){
    const btn=document.getElementById(id);
    if(!btn) return;
    btn.className='res-cat-btn';
    if(id==='rcAll') btn.classList.add('on');
    if(id==='rcPix'||id==='rcSusp'||id==='rcEspecie') btn.style.display='none';
  });
  window._rendaDeclaradaMensal=0;
  window._perfilUsuario=null;
  // Reset visual botões de perfil
  document.querySelectorAll('#perfilBtns button').forEach(b=>{
    b.style.borderColor='var(--border)';b.style.color='var(--muted2)';b.style.background='var(--surface2)';
  });
  const _ri=document.getElementById('rendaDeclaradaInput');if(_ri)_ri.value='';
  document.getElementById('fileList').innerHTML='';
  document.getElementById('limitBar').style.display='none';
  document.getElementById('actBar').style.display='none';
  document.getElementById('extStep3').style.display='none';
  document.getElementById('pFillExt').style.width='0%';
  document.getElementById('dzIco').textContent='📂';
  document.getElementById('dzTtl').textContent='Arraste os extratos ou clique para selecionar';
  document.getElementById('paywallBlock').style.display='block';
  // Tracking — só dispara PaywallHit se o usuário NÃO tinha acesso ao resultado completo
  const _tinhaAcesso = document.getElementById('realResultBlock').style.display !== 'none';
  if (!_tinhaAcesso) {
    if(typeof fbq==='function' && window.PIXEL_ATIVO) {
      fbq('trackCustom','PaywallHit',{},{ eventID: Date.now().toString() });
      fbq('track','ViewContent',{ content_name:'paywall_guardiao', content_category:'fiscal' },{ eventID:'vc_'+Date.now().toString() });
    }
    if(typeof clarity==='function') clarity('event','PaywallHit');
  }
  document.getElementById('realResultBlock').style.display='none';
  // Reset preview
  const previewReal = document.getElementById('previewReal');
  const previewPlaceholder = document.getElementById('previewPlaceholder');
  if(previewReal) previewReal.style.display='none';
  if(previewPlaceholder) previewPlaceholder.style.display='block';
  const pvBar = document.getElementById('pvBarFill');
  if(pvBar) pvBar.style.width='0%';
  const s2=document.getElementById('extStep2');
  if(_currentUser){s2.style.opacity='1';s2.style.pointerEvents='auto';}
  else{s2.style.opacity='0.45';s2.style.pointerEvents='none';}
  const s2num=document.getElementById('s2num');
  if(s2num){s2num.textContent='2';s2num.style.background='';s2num.style.color='';}
  eShowErr('');
}

// extrato step 1 — handled by Supabase auth above

// ═══════════════════════════════════════════════════════════════════
// ██ MÓDULO: EXTRATOS SINTÉTICOS DE TESTE
// ═══════════════════════════════════════════════════════════════════
// Gera transações sintéticas para validar o motor sem usuários reais.
// Cada perfil tem um score esperado. Rode gSyntheticTest() no console.
// ───────────────────────────────────────────────────────────────────

const SYNTHETIC_PROFILES = {

  // ── PERFIL 1: CLT puro ──────────────────────────────────────────
  // Salário fixo todo mês, poucos gastos variáveis.
  // ESPERADO: score baixo (0–20). Motor não deve sinalizar risco.
  clt_puro: {
    label: 'CLT Puro — baixo risco esperado',
    rendaDeclarada: 5000,
    scoreEsperado: { min: 0, max: 25 },
    txns: (() => {
      const t = [];
      for (let m = 1; m <= 6; m++) {
        const mm = String(m).padStart(2,'0');
        t.push({ date: new Date(`2024-${mm}-05`), desc: 'SALARIO EMPRESA LTDA', value: 5000 });
        t.push({ date: new Date(`2024-${mm}-10`), desc: 'DEBITO ALUGUEL', value: -1500 });
        t.push({ date: new Date(`2024-${mm}-15`), desc: 'PIX SUPERMERCADO', value: -800 });
        t.push({ date: new Date(`2024-${mm}-20`), desc: 'PIX CONTA LUZ', value: -200 });
        if (m === 12) t.push({ date: new Date(`2024-${mm}-20`), desc: '13 SALARIO', value: 5000 });
      }
      return t;
    })(),
  },

  // ── PERFIL 2: Autônomo informal com alto Pix ─────────────────────
  // Recebimentos irregulares via Pix, sem nota fiscal, sem renda declarada.
  // ESPERADO: score elevado (55–85). F2 (pix limite) e F4 (comercial oculta) devem acionar.
  autonomo_informal: {
    label: 'Autônomo Informal — risco elevado esperado',
    rendaDeclarada: 0,
    scoreEsperado: { min: 45, max: 90 },
    txns: (() => {
      const t = [];
      const clientes = ['JOAO SILVA', 'MARIA SOUZA', 'PEDRO COSTA', 'ANA LIMA'];
      for (let m = 1; m <= 6; m++) {
        const mm = String(m).padStart(2,'0');
        clientes.forEach((c, i) => {
          t.push({ date: new Date(`2024-${mm}-${String(5+i*4).padStart(2,'0')}`), desc: `PIX RECEBIDO ${c}`, value: 1800 + i * 200 });
        });
        t.push({ date: new Date(`2024-${mm}-28`), desc: 'PIX MERCADO', value: -600 });
        t.push({ date: new Date(`2024-${mm}-25`), desc: 'PIX ALUGUEL', value: -1200 });
      }
      return t;
    })(),
  },

  // ── PERFIL 3: MEI com espécie alta ──────────────────────────────
  // Depósitos em dinheiro físico recorrentes. Renda declarada coerente.
  // ESPERADO: score médio (25–55). F3 (espécie) deve acionar mas não explodir.
  mei_especie: {
    label: 'MEI com Espécie Alta — risco médio esperado',
    rendaDeclarada: 4000,
    scoreEsperado: { min: 20, max: 60 },
    txns: (() => {
      const t = [];
      for (let m = 1; m <= 6; m++) {
        const mm = String(m).padStart(2,'0');
        t.push({ date: new Date(`2024-${mm}-05`), desc: 'DEPOSITO ESPECIE CAIXA', value: 2500 });
        t.push({ date: new Date(`2024-${mm}-12`), desc: 'PIX RECEBIDO CLIENTE', value: 1200 });
        t.push({ date: new Date(`2024-${mm}-20`), desc: 'SAQUE ESPECIE', value: -800 });
        t.push({ date: new Date(`2024-${mm}-25`), desc: 'PIX FORNECEDOR', value: -900 });
        t.push({ date: new Date(`2024-${mm}-28`), desc: 'PIX ALUGUEL PONTO', value: -600 });
      }
      return t;
    })(),
  },

  // ── PERFIL 4: Incompatibilidade severa ───────────────────────────
  // Movimentação 8x acima da renda declarada. Sem transações neutras.
  // ESPERADO: score crítico (70–100). F7 (compatibilidade) severo.
  incompatibilidade_severa: {
    label: 'Incompatibilidade Severa — score crítico esperado',
    rendaDeclarada: 3000,
    scoreEsperado: { min: 60, max: 100 },
    txns: (() => {
      const t = [];
      for (let m = 1; m <= 6; m++) {
        const mm = String(m).padStart(2,'0');
        t.push({ date: new Date(`2024-${mm}-02`), desc: 'PIX RECEBIDO EMPRESA', value: 12000 });
        t.push({ date: new Date(`2024-${mm}-10`), desc: 'PIX RECEBIDO CLIENTE 2', value: 8000 });
        t.push({ date: new Date(`2024-${mm}-18`), desc: 'PIX PAGAMENTO SERVICO', value: -4000 });
        t.push({ date: new Date(`2024-${mm}-25`), desc: 'PIX SUPERMERCADO', value: -1500 });
      }
      return t;
    })(),
  },

  // ── PERFIL 5: Anomalia temporal isolada ─────────────────────────
  // Meses normais + 1 mês com pico inexplicado (10x a média).
  // ESPERADO: score médio-alto (30–65). F5 (anomalia temporal) deve acionar pontualmente.
  anomalia_temporal: {
    label: 'Anomalia Temporal — F5 deve acionar',
    rendaDeclarada: 5000,
    scoreEsperado: { min: 25, max: 65 },
    txns: (() => {
      const t = [];
      for (let m = 1; m <= 6; m++) {
        const mm = String(m).padStart(2,'0');
        if (m === 4) {
          // Mês 4: pico inexplicado 10x
          t.push({ date: new Date(`2024-${mm}-05`), desc: 'SALARIO EMPRESA LTDA', value: 5000 });
          t.push({ date: new Date(`2024-${mm}-10`), desc: 'PIX RECEBIDO DESCONHECIDO', value: 48000 });
          t.push({ date: new Date(`2024-${mm}-20`), desc: 'PIX PAGAMENTO', value: -3000 });
        } else {
          t.push({ date: new Date(`2024-${mm}-05`), desc: 'SALARIO EMPRESA LTDA', value: 5000 });
          t.push({ date: new Date(`2024-${mm}-15`), desc: 'PIX MERCADO', value: -900 });
          t.push({ date: new Date(`2024-${mm}-20`), desc: 'PIX ALUGUEL', value: -1400 });
        }
      }
      return t;
    })(),
  },

  // ── PERFIL 6: Split Pix (estruturação) ──────────────────────────
  // Vários Pix logo abaixo de R$5.000 em sequência, mesmo remetente.
  // ESPERADO: score médio-alto (35–75). F6d (split pix) deve acionar.
  split_pix: {
    label: 'Split Pix — estruturação detectada',
    rendaDeclarada: 4000,
    scoreEsperado: { min: 30, max: 75 },
    txns: (() => {
      const t = [];
      for (let m = 1; m <= 6; m++) {
        const mm = String(m).padStart(2,'0');
        t.push({ date: new Date(`2024-${mm}-05`), desc: 'SALARIO EMPRESA', value: 4000 });
        // 3 Pix abaixo de 5000 no mesmo dia, mesmo remetente
        t.push({ date: new Date(`2024-${mm}-12`), desc: 'PIX RECEBIDO JOSE SANTOS', value: 4800 });
        t.push({ date: new Date(`2024-${mm}-12`), desc: 'PIX RECEBIDO JOSE SANTOS', value: 4700 });
        t.push({ date: new Date(`2024-${mm}-13`), desc: 'PIX RECEBIDO JOSE SANTOS', value: 4600 });
        t.push({ date: new Date(`2024-${mm}-25`), desc: 'PIX PAGAMENTO DESPESAS', value: -5000 });
      }
      return t;
    })(),
  },
};

// ── Runner do teste sintético ──────────────────────────────────────
// Uso: gSyntheticTest() no console do navegador
// Retorna relatório com score obtido vs esperado e status PASS/FAIL
window.gSyntheticTest = function(perfilKey) {
  const perfis = perfilKey ? { [perfilKey]: SYNTHETIC_PROFILES[perfilKey] } : SYNTHETIC_PROFILES;
  const resultados = [];

  for (const [key, perfil] of Object.entries(perfis)) {
    try {
      const r = eAnalyzeSingle(perfil.txns, `[SINTÉTICO] ${perfil.label}`, perfil.rendaDeclarada || 0);
      if (!r) { resultados.push({ key, status: 'ERRO', msg: 'eAnalyzeSingle retornou null' }); continue; }
      const { min, max } = perfil.scoreEsperado;
      const pass = r.score >= min && r.score <= max;
      resultados.push({
        key,
        label: perfil.label,
        scoreObtido: r.score,
        scoreEsperado: `${min}–${max}`,
        status: pass ? '✅ PASS' : '❌ FAIL',
        fatoresAtivados: (r.fatores||[]).filter(f=>f.peso>0).map(f=>f.motivo?.slice(0,60)+'…'),
        confidence: Math.round((r.confidence||0)*100)+'%',
        numEvidencias: r.numEvidencias,
      });
    } catch(e) {
      resultados.push({ key, status: '💥 EXCEÇÃO', msg: e.message });
    }
  }

  console.group('%c🛡️ Guardião Fiscal — Teste Sintético', 'font-size:14px;font-weight:bold;color:#7CFF4F');
  resultados.forEach(r => {
    const cor = r.status?.includes('PASS') ? '#7CFF4F' : r.status?.includes('FAIL') ? 'var(--red)' : '#f5a623';
    console.group(`%c${r.status} ${r.key}`, `color:${cor};font-weight:bold`);
    console.log('Label:', r.label);
    console.log('Score obtido:', r.scoreObtido, '| Esperado:', r.scoreEsperado);
    console.log('Confiança:', r.confidence, '| Evidências:', r.numEvidencias);
    if (r.fatoresAtivados?.length) console.log('Fatores ativados:', r.fatoresAtivados);
    if (r.msg) console.warn('Erro:', r.msg);
    console.groupEnd();
  });
  const pass = resultados.filter(r=>r.status?.includes('PASS')).length;
  console.log(`%c\nResultado: ${pass}/${resultados.length} perfis dentro do range esperado`, 'font-weight:bold;font-size:13px');
  console.groupEnd();

  return resultados;
};

// Atalho rápido: testa um perfil específico
// Ex: gSyntheticTest('clt_puro')  →  só o CLT
// gSyntheticTest()                 →  todos os perfis
window.gListProfiles = function() {
  console.log('%c🛡️ Perfis disponíveis:', 'font-weight:bold;color:#7CFF4F');
  Object.entries(SYNTHETIC_PROFILES).forEach(([k, p]) => {
    console.log(`  ${k} — ${p.label} (esperado: ${p.scoreEsperado.min}–${p.scoreEsperado.max})`);
  });
};


// ═══════════════════════════════════════════════════════════════════
// ██ MÓDULO: DIAGNÓSTICO DO MOTOR
// ═══════════════════════════════════════════════════════════════════
// Auditoria de calibração dos pesos e detecção de problemas.
// Uso: gMotorDiag() no console após uma análise real ou sintética.
// ───────────────────────────────────────────────────────────────────

window.gMotorDiag = function(resultado) {
  const r = resultado || window._debugMotor;
  if (!r) {
    console.warn('Rode uma análise primeiro ou passe o resultado: gMotorDiag(resultado)');
    console.log('Dica: window._debugMotor fica disponível em localhost após análise');
    return null;
  }

  const fatores = (r.fatores || []).filter(f => f.peso > 0);
  const pesoTotal = fatores.reduce((a, f) => a + (f.peso || 0), 0);
  const scoreRaw = pesoTotal; // antes da escala log
  const scoreFinal = r.score;

  console.group('%c🛡️ Guardião Fiscal — Diagnóstico do Motor', 'font-size:14px;font-weight:bold;color:#7CFF4F');

  // Resumo geral
  console.group('%cResumo', 'font-weight:bold');
  console.log('Score final (log-scale):', scoreFinal + '%');
  console.log('Peso bruto (antes da escala):', scoreRaw + 'pts');
  console.log('Confiança geral:', Math.round((r.confidence||0)*100) + '%');
  console.log('Evidências corroboradas:', r.numEvidencias || 0);
  console.log('Transações analisadas:', r.totalTxns);
  console.log('Meses de extrato:', r.months);
  console.groupEnd();

  // Breakdown dos fatores
  console.group('%cFatores Ativados (ordenados por peso)', 'font-weight:bold');
  fatores.sort((a,b)=>(b.peso||0)-(a.peso||0)).forEach(f => {
    const pct = pesoTotal > 0 ? Math.round((f.peso/pesoTotal)*100) : 0;
    const bar = '█'.repeat(Math.round(pct/5)) + '░'.repeat(20-Math.round(pct/5));
    console.log(
      `%c${bar} ${pct}% (${f.peso}pts)%c ${(f.motivo||'').slice(0,70)}`,
      'color:#7CFF4F;font-family:monospace',
      'color:inherit'
    );
    if (f.porqueImporta) console.log('  ↳', f.porqueImporta.slice(0,100));
    if (f.confianca) console.log('  ↳ Confiança do fator:', Math.round(f.confianca*100)+'%');
  });
  console.groupEnd();

  // Alertas de calibração
  const alertasCalibracao = [];

  // Detectar possível acumulação excessiva (F2+F7 dupla captura)
  const f2 = fatores.find(f=>f.motivo?.includes('Pix') && f.motivo?.includes('limite'));
  const f7 = fatores.find(f=>f.motivo?.includes('compatib') || f.motivo?.includes('renda declarada'));
  if (f2 && f7) alertasCalibracao.push('⚠️  F2 + F7 ambos ativos — verificar se há dupla penalização de renda');

  // Score alto com confiança baixa
  if (scoreFinal > 50 && (r.confidence||0) < 0.35) alertasCalibracao.push('⚠️  Score alto com confiança baixa — possível falso positivo');

  // Score máximo com poucos meses
  if (scoreFinal > 70 && r.months < 3) alertasCalibracao.push('⚠️  Score crítico com extrato curto — resultado pode ser impreciso');

  // Fator dominante > 60% do peso total
  const dominant = fatores[0];
  if (dominant && pesoTotal > 0 && (dominant.peso/pesoTotal) > 0.6) {
    alertasCalibracao.push(`⚠️  Fator único domina ${Math.round(dominant.peso/pesoTotal*100)}% do score — verificar peso de "${(dominant.motivo||'').slice(0,40)}"`);
  }

  if (alertasCalibracao.length) {
    console.group('%c⚠️ Alertas de Calibração', 'color:#f5a623;font-weight:bold');
    alertasCalibracao.forEach(a => console.warn(a));
    console.groupEnd();
  } else {
    console.log('%c✅ Nenhum alerta de calibração detectado', 'color:#7CFF4F');
  }

  // Índices financeiros calculados
  console.group('%cÍndices Financeiros', 'font-weight:bold');
  console.log('Total créditos:', fmtBRL(r.totalCredits));
  console.log('Total débitos:', fmtBRL(r.totalDebits));
  console.log('Pix total:', fmtBRL(r.pixTotal));
  console.log('Índice espécie:', Math.round((r.indiceEspecie||0)*100)+'%');
  console.log('Índice consumo:', Math.round((r.indiceConsumo||0)*100)+'%');
  if (r.anomalias?.length) console.log('Anomalias temporais:', r.anomalias.length);
  if (r.splitPix?.length) console.log('Split Pix detectados:', r.splitPix.length);
  if (r.circularidade?.length) console.log('Padrões circulares:', r.circularidade.length);
  console.groupEnd();

  console.groupEnd();
  return { scoreFinal, scoreRaw, fatores, alertasCalibracao, confidence: r.confidence };
};


// ═══════════════════════════════════════════════════════════════════
// ██ MÓDULO: FEEDBACK DO USUÁRIO
// ═══════════════════════════════════════════════════════════════════
// Mecanismo "discordo deste resultado" — captura contestações reais.
// Cada contestação é um dado: motor disse X, usuário disse que X não
// reflete a realidade. Com volume, revela padrões de falso positivo.
// ───────────────────────────────────────────────────────────────────

// Estado interno do feedback
window._gFeedback = {
  sessao: null,         // resultado atual da análise
  historico: [],        // feedbacks da sessão (em memória)
};

// ── Motivos pré-definidos de contestação ─────────────────────────
const FEEDBACK_MOTIVOS = [
  { id: 'falso_especie',    label: 'Espécie é troco de saques anteriores' },
  { id: 'falso_pix',        label: 'Pix são transferências entre contas próprias' },
  { id: 'falso_comercial',  label: 'Recebimentos recorrentes são salário/pensão' },
  { id: 'falso_anomalia',   label: 'Pico foi herança, venda de bem ou rescisão' },
  { id: 'falso_compat',     label: 'Movimentação inclui empréstimos/devoluções' },
  { id: 'score_alto',       label: 'Score parece alto para minha situação' },
  { id: 'score_baixo',      label: 'Score parece baixo — existe risco que não apareceu' },
  { id: 'outro',            label: 'Outro motivo' },
];

// ── Renderiza o card de feedback no resultado ─────────────────────
function gRenderFeedbackCard(containerEl, resultado) {
  if (!containerEl || !resultado) return;
  window._gFeedback.sessao = resultado;

  const card = document.createElement('div');
  card.id = 'gFeedbackCard';
  card.style.cssText = [
    'margin-top:20px',
    'background:rgba(59,130,246,0.04)',
    'border:1px solid rgba(59,130,246,0.15)',
    'border-radius:14px',
    'padding:18px 20px',
    'font-family:var(--ff)',
  ].join(';');

  card.innerHTML = `
    <div style="font-size:12px;font-weight:700;letter-spacing:0.8px;color:var(--muted);text-transform:uppercase;margin-bottom:10px">
      // este resultado faz sentido para você?
    </div>
    <p style="font-size:13px;color:var(--muted2);line-height:1.6;margin:0 0 14px">
      Seu feedback melhora a precisão do motor — se algum alerta não reflete sua realidade, nos conte.
    </p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <button id="gFbBtnOk" onclick="gFeedbackSubmit('ok')"
        style="padding:9px 18px;background:rgba(0,217,110,0.1);border:1px solid rgba(0,217,110,0.25);border-radius:9px;
               color:#7CFF4F;font-family:var(--ff);font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s">
        ✅ Faz sentido
      </button>
      <button id="gFbBtnDiscordo" onclick="gFeedbackAbrir()"
        style="padding:9px 18px;background:rgba(239,68,68,0.08);border:1px solid rgba(255,77,79,0.2);border-radius:9px;
               color:var(--red);font-family:var(--ff);font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s">
        ✋ Discordo deste resultado
      </button>
    </div>
    <div id="gFbDetalhes" style="display:none">
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px;font-weight:600">Qual parte não reflete sua realidade?</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        ${FEEDBACK_MOTIVOS.map(m => `
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;
                         background:var(--surface2);border:1px solid var(--border);border-radius:8px;
                         padding:7px 12px;font-size:12px;color:var(--muted2);transition:all 0.15s"
                 onmouseover="this.style.borderColor='rgba(59,130,246,0.4)'"
                 onmouseout="this.style.borderColor='var(--border)'">
            <input type="checkbox" value="${m.id}"
                   style="accent-color:var(--green);cursor:pointer"
                   onchange="gFeedbackCheckChange(this)">
            ${m.label}
          </label>
        `).join('')}
      </div>
      <div id="gFbOutroWrap" style="display:none;margin-bottom:12px">
        <textarea id="gFbOutroText" placeholder="Descreva o que não faz sentido..."
          style="width:100%;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);
                 border-radius:9px;color:var(--text2);font-family:var(--ff);font-size:13px;
                 line-height:1.5;resize:vertical;min-height:72px;outline:none"
          onfocus="this.style.borderColor='rgba(59,130,246,0.4)'"
          onblur="this.style.borderColor='var(--border)'"></textarea>
      </div>
      <button onclick="gFeedbackEnviar()"
        style="width:100%;padding:11px;background:var(--green);border:none;border-radius:10px;
               color:#000;font-family:var(--ff);font-size:13px;font-weight:700;cursor:pointer;transition:opacity 0.2s"
        onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
        Enviar feedback →
      </button>
    </div>
    <div id="gFbSucesso" style="display:none;text-align:center;padding:10px 0">
      <div style="font-size:20px;margin-bottom:6px">🙏</div>
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">Obrigado pelo feedback</div>
      <div style="font-size:12px;color:var(--muted)">Isso ajuda a calibrar o motor para perfis como o seu.</div>
    </div>
  `;

  containerEl.appendChild(card);
}

// ── Handlers de interação do feedback ────────────────────────────
window.gFeedbackAbrir = function() {
  const d = document.getElementById('gFbDetalhes');
  if (d) d.style.display = 'block';
  // tracking
  if (typeof fbq === 'function' && window.PIXEL_ATIVO) fbq('trackCustom', 'FeedbackDiscordo', { score: window._gFeedback.sessao?.score }, { eventID: Date.now().toString() });
  if (typeof clarity === 'function') clarity('event', 'FeedbackDiscordo');
};

window.gFeedbackCheckChange = function(el) {
  const outroWrap = document.getElementById('gFbOutroWrap');
  if (!outroWrap) return;
  const checkboxes = document.querySelectorAll('#gFbDetalhes input[type=checkbox]');
  const temOutro = Array.from(checkboxes).some(c => c.value === 'outro' && c.checked);
  outroWrap.style.display = temOutro ? 'block' : 'none';
};

window.gFeedbackSubmit = function(tipo) {
  const r = window._gFeedback.sessao;
  const payload = {
    tipo,
    score: r?.score,
    meses: r?.months,
    numEvidencias: r?.numEvidencias,
    confidence: r?.confidence,
    fatores: (r?.fatores||[]).filter(f=>f.peso>0).map(f=>({ motivo: (f.motivo||'').slice(0,60), peso: f.peso })),
    ts: new Date().toISOString(),
    motivos: [],
    texto: '',
  };

  window._gFeedback.historico.push(payload);

  // Logar no console (visível no Clarity e em ferramentas de dev)

  // tracking Meta
  if (typeof fbq === 'function' && window.PIXEL_ATIVO) fbq('trackCustom', 'FeedbackOk', { score: r?.score }, { eventID: Date.now().toString() });
  if (typeof clarity === 'function') clarity('event', 'FeedbackOk');

  // Esconder card, mostrar agradecimento
  const det = document.getElementById('gFbDetalhes');
  const suc = document.getElementById('gFbSucesso');
  const btns = document.getElementById('gFbDetalhes')?.parentElement?.querySelector('div[style*="flex"]');
  if (btns) btns.style.display = 'none';
  if (det) det.style.display = 'none';
  if (suc) suc.style.display = 'block';

  // Persistir no Supabase se usuário logado (fire-and-forget)
  gFeedbackPersistir(payload).catch(e => console.warn('[Feedback] Erro ao persistir:', e));
};

window.gFeedbackEnviar = function() {
  const checkboxes = document.querySelectorAll('#gFbDetalhes input[type=checkbox]:checked');
  const motivos = Array.from(checkboxes).map(c => c.value);
  const texto = document.getElementById('gFbOutroText')?.value?.trim() || '';

  if (!motivos.length && !texto) {
    alert('Selecione ao menos um motivo antes de enviar.');
    return;
  }

  const r = window._gFeedback.sessao;
  const payload = {
    tipo: 'discordo',
    score: r?.score,
    meses: r?.months,
    numEvidencias: r?.numEvidencias,
    confidence: r?.confidence,
    indiceEspecie: r?.indiceEspecie,
    indiceConsumo: r?.indiceConsumo,
    fatores: (r?.fatores||[]).filter(f=>f.peso>0).map(f=>({ motivo: (f.motivo||'').slice(0,60), peso: f.peso })),
    motivos,
    texto: texto.slice(0, 500),
    ts: new Date().toISOString(),
  };

  window._gFeedback.historico.push(payload);

  if (typeof fbq === 'function' && window.PIXEL_ATIVO) fbq('trackCustom', 'FeedbackDiscordoEnviado', { score: r?.score, motivos }, { eventID: Date.now().toString() });
  if (typeof clarity === 'function') clarity('event', 'FeedbackDiscordoEnviado');

  const det = document.getElementById('gFbDetalhes');
  const suc = document.getElementById('gFbSucesso');
  const btnsRow = document.querySelector('#gFeedbackCard > div[style*="flex"]');
  if (btnsRow) btnsRow.style.display = 'none';
  if (det) det.style.display = 'none';
  if (suc) suc.style.display = 'block';

  gFeedbackPersistir(payload).catch(e => console.warn('[Feedback] Erro ao persistir:', e));
};

// ── Persistência no Supabase (tabela guardiao_feedback) ──────────
// A tabela precisa existir: ver SQL abaixo nos comentários.
// Se não existir, apenas loga — não quebra o fluxo.
async function gFeedbackPersistir(payload) {
  // SQL para criar a tabela no Supabase (rode uma vez no SQL Editor):
  // --------------------------------------------------------------------
  // create table if not exists guardiao_feedback (
  //   id uuid default gen_random_uuid() primary key,
  //   created_at timestamptz default now(),
  //   user_id uuid references auth.users(id) on delete set null,
  //   tipo text,
  //   score int,
  //   meses int,
  //   num_evidencias int,
  //   confidence float,
  //   indice_especie float,
  //   indice_consumo float,
  //   motivos text[],
  //   texto text,
  //   fatores jsonb,
  //   ts timestamptz
  // );
  // alter table guardiao_feedback enable row level security;
  // create policy "insert_own" on guardiao_feedback for insert with check (auth.uid() = user_id or user_id is null);
  // --------------------------------------------------------------------

  if (typeof supabase === 'undefined') return; // Supabase não carregado

  const userId = (await supabase.auth.getUser())?.data?.user?.id || null;

  const { error } = await supabase.from('guardiao_feedback').insert([{
    user_id: userId,
    tipo: payload.tipo,
    score: payload.score,
    meses: payload.meses,
    num_evidencias: payload.numEvidencias,
    confidence: payload.confidence,
    indice_especie: payload.indiceEspecie,
    indice_consumo: payload.indiceConsumo,
    motivos: payload.motivos || [],
    texto: payload.texto || '',
    fatores: payload.fatores || [],
    ts: payload.ts,
  }]);

  if (error) {
    // Tabela não existe ou RLS bloqueou — loga sem quebrar
    console.warn('[Feedback] Supabase insert falhou (tabela não criada ainda?):', error.message);
  } else {
  }
}

// ── Hook: injeta o card de feedback após unlock do resultado ──────
// Patcheia eUnlockResult para injetar o card automaticamente
const _gOriginalUnlock = window.eUnlockResult || function(){};
// O hook é feito via MutationObserver no realResultBlock
// para não depender de patching da função (que pode ser redefinida)
(function() {
  const observer = new MutationObserver(() => {
    const realBlock = document.getElementById('realResultBlock');
    if (!realBlock || realBlock.style.display === 'none') return;
    if (document.getElementById('gFeedbackCard')) return; // já existe

    // Encontra o container de alertas ou usa o próprio realBlock
    const target = document.getElementById('pAlertList')?.parentElement || realBlock;
    const r = window._eConsolidated;
    if (r) gRenderFeedbackCard(target, r);
  });

  // Observa o bloco de resultado
  const waitBlock = setInterval(() => {
    const el = document.getElementById('realResultBlock');
    if (el) {
      observer.observe(el, { attributes: true, attributeFilter: ['style'] });
      clearInterval(waitBlock);
    }
  }, 500);
})();

// ── Exposição do histórico de feedbacks para análise ────────────
// No console: gFeedbackHistorico() → array com todos os feedbacks da sessão
// ── Histórico Pro ────────────────────────────────────────────────────────────
async function eCarregarHistorico() {
  const el = document.getElementById('historicoList');
  if (!el) return;

  if (!_currentUser || !sb) {
    el.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--muted2);font-size:13px">Faça login para ver seu histórico.</div>';
    return;
  }

  el.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--muted2);font-size:13px">Carregando...</div>';

  try {
    const { data, error } = await sb
      .from('analyses')
      .select('id,score,nivel_risco,nivel_label,perfil_usuario,renda_declarada,total_creditos,total_txns,num_alertas,indice_consumo,pix_pct,fatores,alertas,versao_engine,created_at')
      .eq('user_id', _currentUser.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!data || data.length === 0) {
      el.innerHTML = `
        <div style="text-align:center;padding:48px 16px">
          <div style="font-size:32px;margin-bottom:12px">📂</div>
          <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px">Nenhuma análise ainda</div>
          <div style="font-size:13px;color:var(--muted2);margin-bottom:20px">Faça sua primeira análise de extrato para começar o histórico.</div>
          <button onclick="showPage('extrato')" style="padding:11px 24px;background:var(--green);border:none;border-radius:10px;color:#000;font-family:var(--ff);font-size:13px;font-weight:700;cursor:pointer">
            Analisar extrato →
          </button>
        </div>`;
      return;
    }

    const nivelCor = { baixo: C_BAIXO, atencao: C_ATENCAO, elevado: C_MODERADO, critico: C_CRITICO };
    const nivelLabel = { baixo: 'Baixo risco', atencao: 'Atenção', elevado: 'Elevado', critico: 'Crítico' };
    const perfilLabel = { clt: 'CLT / Servidor', mei: 'MEI / Autônomo', investidor: 'Investidor / Aposent.' };

    el.innerHTML = data.map(function(a, i) {
      const cor = nivelCor[a.nivel_risco] || '#888';
      const data_fmt = new Date(a.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
      const hora_fmt = new Date(a.created_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
      const creditos_fmt = a.total_creditos ? 'R$ ' + (a.total_creditos).toLocaleString('pt-BR', {minimumFractionDigits:2}) : '—';
      const cardId = 'hist-card-' + i;

      const fatores = (function(){ try { return JSON.parse(a.fatores || '[]'); } catch(e) { return []; } })();
      const alertas = (function(){ try { return JSON.parse(a.alertas || '[]'); } catch(e) { return []; } })();

      let fatoresHtml = '';
      fatores.forEach(function(f) {
        fatoresHtml += '<div style="display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-bottom:0.5px solid rgba(255,255,255,0.06)">'
          + '<div style="width:26px;height:26px;border-radius:6px;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--risk-moderado);flex-shrink:0">+'+f.peso+'</div>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:12px;font-weight:600;color:var(--text);line-height:1.4;margin-bottom:2px">'+sanitize(f.motivo||'')+'</div>'
          + (f.quandoNaoERisco ? '<div style="font-size:11px;color:var(--green);margin-top:4px;padding:4px 8px;background:rgba(0,217,110,0.06);border-radius:6px;line-height:1.4"><strong>Pode não ser risco</strong> — '+sanitize(f.quandoNaoERisco)+'</div>' : '')
          + '</div></div>';
      });

      let alertasHtml = '';
      alertas.forEach(function(al) {
        const cls = al.type==='red'?'p-red':al.type==='yellow'?'p-yel':al.type==='green'?'p-grn':'p-blu';
        alertasHtml += '<div class="pal '+cls+'" style="margin-bottom:6px">'
          + '<span class="pal-ico">'+sanitize(al.icon||'')+'</span>'
          + '<div><strong>'+sanitize(al.title)+'</strong><br>'
          + '<span style="font-size:11px;opacity:0.85">'+sanitize(al.text)+'</span></div>'
          + '</div>';
      });

      const header = '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;margin-bottom:10px;position:relative;overflow:hidden">'
        + '<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:'+cor+';border-radius:3px 0 0 3px"></div>'
        + '<div style="padding:14px 16px;cursor:pointer;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap" data-histid="'+cardId+'" onclick="histToggle(this)">'
        + '<div>'
        + '<div style="font-size:11px;color:var(--muted2);margin-bottom:4px">'+data_fmt+' · '+hora_fmt+'</div>'
        + '<div style="font-size:18px;font-weight:700;color:'+cor+';margin-bottom:4px">'+a.score+'% <span style="font-size:13px;font-weight:600">'+(a.nivel_label||nivelLabel[a.nivel_risco]||a.nivel_risco||'')+'</span></div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
        + (a.perfil_usuario ? '<span style="font-size:11px;padding:2px 7px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:var(--radius-card);color:#60a5fa">'+(perfilLabel[a.perfil_usuario]||a.perfil_usuario)+'</span>' : '')
        + (a.total_txns ? '<span style="font-size:11px;padding:2px 7px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-card);color:var(--muted2)">'+a.total_txns+' transações</span>' : '')
        + (a.num_alertas ? '<span style="font-size:11px;padding:2px 7px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);border-radius:var(--radius-card);color:#f87171">'+a.num_alertas+' alerta(s)</span>' : '')
        + (a.renda_declarada ? '<span style="font-size:11px;padding:2px 7px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-card);color:var(--muted2)">Renda: R$ '+Number(a.renda_declarada).toLocaleString('pt-BR')+'/mês</span>' : '')
        + '</div></div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">'
        + '<div style="text-align:right">'
        + '<div style="font-size:11px;color:var(--muted2);margin-bottom:2px">Movimentação</div>'
        + '<div style="font-size:15px;font-weight:600;color:var(--text)">'+creditos_fmt+'</div>'
        + '</div>'
        + '<span class="hist-chevron" style="font-size:12px;color:var(--muted)">▼</span>'
        + '</div></div>';

      const detalhe = '<div id="'+cardId+'" style="display:none;padding:0 16px 14px;border-top:0.5px solid rgba(255,255,255,0.06)">'
        + (fatores.length > 0 ? '<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin:12px 0 8px">Fatores de risco</div>' + fatoresHtml : '')
        + (alertas.length > 0 ? '<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin:12px 0 8px">Alertas</div>' + alertasHtml : '')
        + (a.indice_consumo ? '<div style="font-size:11px;color:var(--muted2);margin-top:8px">Índice consumo: '+a.indice_consumo+'% · Pix: '+(a.pix_pct||0)+'% das entradas</div>' : '')
        + '</div>';

      return header + detalhe + '</div>';
    }).join('')

  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--muted2);font-size:13px">Erro ao carregar histórico. Tente novamente.</div>';
    console.warn('[GuardiaoFiscal] histórico erro:', e.message);
  }
}

window.gFeedbackHistorico = function() {
  const h = window._gFeedback.historico;
  if (!h.length) return [];
  console.group('%c🛡️ Feedbacks da Sessão', 'font-weight:bold;color:#7CFF4F');
  h.forEach((f, i) => {
    console.group(`Feedback #${i+1} — ${f.tipo} | score ${f.score}%`);
    console.log(f);
    console.groupEnd();
  });
  const discordos = h.filter(f=>f.tipo==='discordo');
  if (discordos.length) {
    const freq = {};
    discordos.flatMap(f=>f.motivos||[]).forEach(m => freq[m]=(freq[m]||0)+1);
    console.log('Motivos mais frequentes:', freq);
  }
  console.groupEnd();
  return h;
};

// extrato step 1 — handled by Supabase auth above


