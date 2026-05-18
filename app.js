
// ── Lazy loaders para bibliotecas pesadas ──────────────────────────
// pdf.js (~500KB): carrega só quando usuário faz upload de PDF
let _pdfjsLoading = false;
function _loadPdfJs() {
  if (typeof pdfjsLib !== 'undefined' || _pdfjsLoading) return Promise.resolve();
  _pdfjsLoading = true;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
    };
    s.onerror = () => reject(new Error('Falha ao carregar pdf.js'));
    document.head.appendChild(s);
  });
}

// jsPDF (~250KB): carrega só quando usuário clica em Exportar PDF
let _jspdfLoading = false;
function _loadJsPDF() {
  if (typeof jspdf !== 'undefined' || _jspdfLoading) return Promise.resolve();
  _jspdfLoading = true;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Falha ao carregar jsPDF'));
    document.head.appendChild(s);
  });
}


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

// ===== CHECKOUT =====
const plans = {
  avulso: {
    icon: '📄', name: 'Análise Avulsa', desc: '1 análise completa por extrato + relatório PDF',
    price: 'R$34,90', period: 'uso único',
    successMsg: 'Sua análise avulsa está ativa! Acesse "Extrato" no menu para fazer o upload e ver os resultados.'
  },
  pro: {
    icon: '🛡️', name: 'Plano Pro', desc: 'Análises ilimitadas + múltiplos extratos + histórico',
    price: 'R$29,90', period: '/mês',
    successMsg: 'Bem-vindo ao Pro! Acesso completo liberado — análises ilimitadas e múltiplos extratos disponíveis agora.'
  }
};

let currentPlan = 'pro';


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

function openCheckout(plan) {
  // Se usuário já tem plano ativo — vai direto para análise
  if (_currentUser?._plano === 'pro' || (_currentUser?._plano === 'avulso' && plan === 'avulso')) {
    if (_eConsolidated) { eUnlockResult(); return; }
    showPage('extrato'); return;
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
  document.getElementById('orderSummary').innerHTML = `
    <div class="os-icon">${p.icon}</div>
    <div class="os-info">
      <div class="os-name">${p.name}</div>
      <div class="os-desc">${p.desc}</div>
    </div>
    <div class="os-price">${p.price}<span style="font-size:11px;color:var(--muted);font-family:'Inter',sans-serif;font-weight:400"> ${p.period}</span></div>
  `;

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
        <button onclick="switchPayTab('outros')" style="padding:10px 20px;background:var(--green);border:none;border-radius:8px;color:#000;font-family:Manrope,sans-serif;font-size:13px;font-weight:700;cursor:pointer">Usar Pix ou Boleto →</button>
      </div>`;
    return;
  }

  container.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:13px">Carregando formulário de pagamento...</div>';

  // Verifica se SDK carregou (flag definida logo após o script no head)
  console.log('[MP Brick] iniciando — SDK disponível:', typeof MercadoPago !== 'undefined', '| flag:', window._mpSDKLoaded);

  if (typeof MercadoPago === 'undefined') {
    // Tenta carregar o SDK dinamicamente
    container.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:13px">Carregando formulário de pagamento...</div>';
    console.log('[MP Brick] tentando carregar SDK dinamicamente...');

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload  = () => { console.log('[MP SDK] carregado dinamicamente OK'); resolve(); };
      script.onerror = (e) => { console.error('[MP SDK] falha ao carregar:', e); reject(new Error('Não foi possível carregar o SDK do Mercado Pago. Tente desativar extensões do navegador (ex: ad blocker) e recarregue a página.')); };
      document.head.appendChild(script);
    }).catch(err => {
      showBrickFallback(container, err.message);
      return null;
    });

    if (typeof MercadoPago === 'undefined') {
      showBrickFallback(container, 'SDK bloqueado. Desative extensões como ad blocker e tente novamente, ou use Pix/Boleto.');
      return;
    }
  }

  try {
    const mp = getMpInstance();
    const bricksBuilder = mp.bricks();
    const amountVal = currentPlan === 'pro' ? 29.90 : 34.90;

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
          console.log('[MP Brick] pronto');
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
        <button onclick="_mpBrick=null;initMpBrick()" style="padding:10px 20px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:Manrope,sans-serif;font-size:13px;font-weight:600;cursor:pointer">🔄 Tentar novamente</button>
        <button onclick="switchPayTab('outros')" style="padding:10px 20px;background:var(--green);border:none;border-radius:8px;color:#000;font-family:Manrope,sans-serif;font-size:13px;font-weight:700;cursor:pointer">Usar Pix ou Boleto →</button>
      </div>
    </div>`;
}

// ── Processa pagamento por cartão via Edge Function ───────────
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
    setTimeout(() => switchPayTab('cartao'), 100);
  }
}

// ── MERCADO PAGO — CHECKOUT PRO (Pix/Boleto redirect) ────────
async function goToMercadoPago() {
  const btn = document.getElementById('btnMpTxt');
  const errEl = document.getElementById('mpPayErrOutros');
  if (errEl) errEl.style.display = 'none';
  if (btn) btn.textContent = 'Gerando link de pagamento...';
  document.getElementById('btnMpPay').disabled = true;

  try {
    // Verifica sessão
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
      // Erro de rede/CORS — mostra mensagem mais útil
      throw new Error('Não foi possível conectar ao servidor de pagamento. Verifique sua conexão e tente novamente.');
    }

    if (!res.ok) {
      let errMsg = `Erro ${res.status}`;
      try { const j = await res.json(); errMsg = j.error || errMsg; } catch(_) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    const url = data.init_point || data.sandbox_url;
    if (!url) throw new Error('Link de pagamento inválido. Tente novamente.');

    window.location.href = url;

  } catch (e) {
    errEl.textContent = e.message || 'Erro inesperado. Tente novamente.';
    errEl.style.display = 'block';
    btn.textContent = 'Ir para o pagamento →';
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
    // Aguarda webhook processar (até ~3s) e busca plano atualizado
    await new Promise(r => setTimeout(r, 2500));
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const { data: profile } = await sb
        .from('profiles')
        .select('plano')
        .eq('id', session.user.id)
        .single();

      const planoAtualizado = profile?.plano;

      // Mostra modal de sucesso
      const planKey = planoAtualizado ?? 'pro';
      currentPlan = planKey === 'avulso' ? 'avulso' : 'pro';
      setCheckoutStep(3);
      document.getElementById('successMsg').textContent =
        plans[currentPlan]?.successMsg ?? 'Pagamento confirmado! Seu acesso está liberado.';
      document.getElementById('checkoutOverlay').classList.add('show');

      if (_eConsolidated) {
        setTimeout(() => { closeCheckoutDirect(); eUnlockResult(); }, 1500);
      }
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
function sanitizeFileContent(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, '')  // remove blocos script
    .replace(/<[^>]{0,200}>/g, '')                // remove tags HTML (limite 200 chars para evitar ReDoS)
    .replace(/javascript:/gi, '')                 // remove JS URI
    .replace(/data:text\/html/gi, '')             // remove data URIs perigosos
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // remove control chars exceto \t \n \r
}

// ── Limite de tamanho de texto processado (anti DoS) ──
const MAX_TEXT_CHARS = 2_000_000; // 2MB de texto

// ── Validação de nome de arquivo ──
function validateFileName(name) {
  // Bloqueia path traversal e nomes suspeitos
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
  window.addEventListener('load', _bootSupabase, { once: true });
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
    nameEl.style.cssText = 'font-size:13px;color:var(--muted2);font-family:\'Inter\',sans-serif;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:none';
    nameEl.id = 'navUserName';
    nameEl.textContent = firstName;
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'nav-btn-login';
    logoutBtn.style.cssText = 'background:rgba(255,100,100,0.08);border-color:rgba(255,100,100,0.2);color:#f87171;font-size:12px;padding:7px 14px';
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
      drawerName.style.cssText = 'font-size:13px;color:var(--muted2);padding:8px 16px;font-family:Inter,sans-serif';
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
  }
}

function sanitizeText(str) {
  return String(str).replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;','&':'&amp;'}[c]));
}

function autoSkipExtStep1(email) {
  // defer para garantir que o DOM já está montado
  const run = () => {
    const s1 = document.getElementById('extStep1');
    if (!s1) return;
    if (s1.style.opacity === '0.6') return; // já pulou
    s1.style.opacity = '0.6';
    if (s1.querySelector('.ext-card-body')) s1.querySelector('.ext-card-body').style.display = 'none';
    const s1num = document.getElementById('s1num');
    if (s1num) { s1num.classList.add('done'); s1num.textContent = '✓'; }
    const sub = s1.querySelector('.ext-step-sub');
    if (sub) sub.textContent = email;
    const s2 = document.getElementById('extStep2');
    if (s2) { s2.style.opacity = '1'; s2.style.pointerEvents = 'auto'; }
    const s2num = document.getElementById('s2num');
    if (s2num) { s2num.classList.remove('locked'); s2num.textContent = '2'; }
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

async function extStep1Done() {
  // Se já logado, avança direto
  if (_currentUser) { autoSkipExtStep1(_currentUser.email); return; }

  const err = document.getElementById('extAuthErr');
  const btn = document.getElementById('extAuthBtnTxt');
  err.style.display = 'none';

  if (_extTab === 'cad') {
    const email = capAuthInput(document.getElementById('extEmail').value.trim(), 'email');
    const senha = capAuthInput(document.getElementById('extSenha').value, 'senha');
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
  const color = passed <= 2 ? '#f87171' : passed <= 3 ? '#f59e0b' : '#10b981';
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
        ${rules.map(r => `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${r.ok ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)'};color:${r.ok ? '#10b981' : 'var(--muted)'};">${r.ok ? '✓' : '○'} ${r.msg}</span>`).join('')}
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
const questions = [
  {
    tag: "01 — Fontes de renda",
    title: "Quais foram suas fontes de renda no ano?",
    sub: "Selecione todas que se aplicam. A Receita cruza todas as entradas bancárias — fontes não declaradas são a causa nº1 de malha fina.",
    multi: true,
    opts: [
      { label: "Salário CLT", desc: "Empregador formal com holerite", risk: 0, pill: "rp-green", pillText: "BAIXO RISCO" },
      { label: "Freelance ou prestação de serviço", desc: "Renda extra sem vínculo empregatício", risk: 2, pill: "rp-yellow", pillText: "ATENÇÃO" },
      { label: "Aluguel de imóvel", desc: "Recebi valores mensais de locação", risk: 2, pill: "rp-yellow", pillText: "ATENÇÃO" },
      { label: "Pró-labore ou MEI", desc: "Remuneração como sócio ou microempreendedor", risk: 2, pill: "rp-yellow", pillText: "ATENÇÃO" },
      { label: "Investimentos (ações, fundos, cripto)", desc: "Rendimentos de aplicações financeiras", risk: 2, pill: "rp-yellow", pillText: "ATENÇÃO" },
      { label: "Aposentadoria ou pensão", desc: "Benefício do INSS ou pensão alimentícia", risk: 1, pill: "rp-yellow", pillText: "ATENÇÃO" },
    ]
  },
  {
    tag: "02 — Recebimentos informais",
    title: "Você costuma receber Pix ou TED de pessoas físicas sem emitir nota ou recibo?",
    sub: "Bancos reportam à Receita toda movimentação acima de R$5.000/mês via e-Financeira. Pix sem justificativa são sinal de alerta.",
    opts: [
      { label: "Não, nunca", desc: "Tudo formalizado com nota ou holerite", risk: 0, pill: "rp-green", pillText: "BAIXO RISCO" },
      { label: "Raramente, valores pequenos", desc: "Esporadicamente abaixo de R$2.000", risk: 1, pill: "rp-yellow", pillText: "ATENÇÃO" },
      { label: "Sim, com frequência", desc: "Recebimentos regulares sem nota fiscal", risk: 4, pill: "rp-red", pillText: "RISCO ALTO" },
    ]
  },
  {
    tag: "03 — Declaração",
    title: "Na sua declaração mais recente, você incluiu todas as suas fontes de renda?",
    sub: "Isso vale tanto para quem já entregou quanto para quem ainda está preparando. A Receita cruza o que foi declarado com os dados que os bancos já enviaram.",
    opts: [
      { label: "Sim, declarei tudo", desc: "Todas as fontes constam na declaração", risk: 0, pill: "rp-green", pillText: "BAIXO RISCO" },
      { label: "Acho que sim, mas não tenho certeza", desc: "Pode ter algo esquecido", risk: 2, pill: "rp-yellow", pillText: "ATENÇÃO" },
      { label: "Não declarei algumas rendas", desc: "Ficou algo de fora da declaração", risk: 5, pill: "rp-red", pillText: "RISCO ALTO" },
    ]
  },
  {
    tag: "04 — Patrimônio",
    title: "Você fez compras ou investimentos de alto valor no período declarado?",
    sub: "Carro, imóvel, cripto ou investimentos cujo valor supera a renda declarada geram inconsistência patrimonial.",
    opts: [
      { label: "Não, gastos dentro da renda", desc: "Padrão de vida compatível com o declarado", risk: 0, pill: "rp-green", pillText: "BAIXO RISCO" },
      { label: "Sim, usando reservas ou herança", desc: "Recursos de origem anterior ou doação", risk: 1, pill: "rp-yellow", pillText: "ATENÇÃO" },
      { label: "Sim — cripto ou ações não declaradas", desc: "Rendimentos de investimentos fora da declaração", risk: 4, pill: "rp-red", pillText: "RISCO ALTO" },
      { label: "Sim, valor superior à renda declarada", desc: "Compra incompatível com o que foi declarado", risk: 4, pill: "rp-red", pillText: "RISCO ALTO" },
    ]
  },
  {
    tag: "05 — Deduções",
    title: "Você deduziu despesas médicas ou educação na sua declaração?",
    sub: "A Receita cruza deduções com dados de planos de saúde, hospitais e faculdades. Valores sem comprovante geram divergência automática.",
    opts: [
      { label: "Não fiz deduções", desc: "Usei o desconto simplificado", risk: 0, pill: "rp-green", pillText: "BAIXO RISCO" },
      { label: "Sim, com todos os comprovantes", desc: "Tenho notas e recibos de tudo", risk: 0, pill: "rp-green", pillText: "BAIXO RISCO" },
      { label: "Sim, mas sem todos os comprovantes", desc: "Alguns valores foram estimados", risk: 3, pill: "rp-red", pillText: "RISCO ALTO" },
    ]
  },
  {
    tag: "06 — Dependentes",
    title: "Você possui dependentes declarados no seu IR?",
    sub: "Dependente declarado por duas pessoas ao mesmo tempo gera malha fina automática — é um dos erros mais comuns.",
    opts: [
      { label: "Não tenho dependentes", desc: "Declaração individual sem dependentes", risk: 0, pill: "rp-green", pillText: "BAIXO RISCO" },
      { label: "Sim, com certeza só eu declarei", desc: "Coordenado com o outro responsável", risk: 0, pill: "rp-green", pillText: "BAIXO RISCO" },
      { label: "Sim, mas não sei se outra pessoa declarou também", desc: "Pode ter duplicidade", risk: 3, pill: "rp-red", pillText: "RISCO ALTO" },
    ]
  }
];

let cur = 0, answers = [], sel = null;

function renderQ() {
  const q = questions[cur];
  const isMulti = !!q.multi;
  const multiSel = answers[cur]?.multiSel || [];

  const bar = document.getElementById('stepsBar');
  bar.innerHTML = questions.map((_,i) => {
    let cls = 'step-dot';
    if(i < cur) cls += ' done';
    else if(i === cur) cls += ' active';
    return `<div class="${cls}"></div>`;
  }).join('');

  const body = document.getElementById('qBody');
  body.innerHTML = `
    <div class="q-num">${q.tag}</div>
    <div class="q-title">${q.title}</div>
    <div class="q-sub">${q.sub}${isMulti ? '<br><span style="font-size:11px;color:var(--green);font-family:Manrope,sans-serif;font-weight:600;letter-spacing:0.5px;margin-top:5px;display:inline-block">✦ Selecione todas que se aplicam</span>' : ''}</div>
    <div class="options">
      ${q.opts.map((o,i) => {
        const isSel = isMulti ? multiSel.includes(i) : (sel?.index === i);
        const radioStyle = isMulti ? 'border-radius:5px' : '';
        return `<button class="opt${isSel?' sel':''}" onclick="${isMulti ? `toggleMulti(${i})` : `choose(${i},${o.risk})`}">
          <div class="opt-radio" style="${radioStyle}">${isSel?'<span style="font-size:10px;color:#000;font-weight:800">✓</span>':''}</div>
          <div class="opt-text">
            <div class="opt-label">${o.label}</div>
            <div class="opt-desc">${o.desc}</div>
          </div>
          <span class="risk-pill ${o.pill}">${o.pillText}</span>
        </button>`;
      }).join('')}
    </div>
  `;

  body.classList.remove('q-slide');
  void body.offsetWidth;
  body.classList.add('q-slide');

  document.getElementById('btnBack').disabled = cur === 0;
  const nx = document.getElementById('btnNext');
  nx.disabled = false;
  const hasAns = isMulti ? multiSel.length > 0 : sel !== null;
  nx.classList.toggle('on', hasAns);
  nx.textContent = cur === questions.length-1 ? 'Ver resultado →' : 'Continuar →';
}

function choose(index, risk) {
  sel = { index, risk };
  document.querySelectorAll('.opt').forEach((el,i) => {
    el.classList.toggle('sel', i===index);
    el.querySelector('.opt-radio').innerHTML = i===index ? '<span style="font-size:10px;color:#000;font-weight:800">✓</span>' : '';
  });
  document.getElementById('btnNext').classList.add('on');
}

function toggleMulti(index) {
  const q = questions[cur];
  if (!answers[cur]) answers[cur] = { multiSel: [], risk: 0 };
  const ms = answers[cur].multiSel;
  const pos = ms.indexOf(index);
  if (pos === -1) ms.push(index); else ms.splice(pos, 1);
  const total = ms.reduce((a,i) => a + q.opts[i].risk, 0);
  answers[cur].risk = Math.min(5, total + (ms.length >= 3 ? 1 : 0));
  document.querySelectorAll('.opt').forEach((el,i) => {
    const isSel = ms.includes(i);
    el.classList.toggle('sel', isSel);
    el.querySelector('.opt-radio').innerHTML = isSel ? '<span style="font-size:10px;color:#000;font-weight:800">✓</span>' : '';
  });
  document.getElementById('btnNext').classList.toggle('on', ms.length > 0);
}

function nextQ() {
  const q = questions[cur];
  if (q.multi) {
    if (!answers[cur] || answers[cur].multiSel.length === 0) return;
  } else {
    if (!sel) return;
    answers[cur] = sel;
  }
  if (cur < questions.length-1) {
    cur++;
    sel = (answers[cur] && !questions[cur].multi) ? answers[cur] : null;
    // Desabilita botões + microfeedback
    const nx = document.getElementById('btnNext');
    const bk = document.getElementById('btnBack');
    if (nx) { nx.disabled = true; nx.classList.remove('on'); }
    if (bk) bk.disabled = true;
    const body = document.getElementById('qBody');
    const msgs = [
      'Analisando compatibilidade financeira…',
      'Detectando possíveis sinais…',
      'Cruzando com critérios do e-Financeira…',
      'Calculando índice de coerência fiscal…',
    ];
    if (body) {
      body.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--muted2);font-family:Manrope,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.5px">${msgs[(cur-1) % msgs.length]}</div>`;
    }
    setTimeout(() => renderQ(), 250);
  } else {
    showResult();
  }
}

function prevQ() {
  if (cur > 0) {
    cur--;
    sel = (answers[cur] && !questions[cur].multi) ? answers[cur] : null;
    renderQ();
  }
}

function showResult() {
  document.getElementById('questionPanel').style.display = 'none';
  const rp = document.getElementById('resultPanel');
  rp.style.display = 'block';

  const total = answers.reduce((a,b) => a + (b?.risk || 0), 0);
  const pct   = Math.min(100, Math.round((total / 19) * 100));

  const scanLines = [
    'Cruzando movimentações com critérios e-Financeira…',
    'Verificando compatibilidade renda × extrato…',
    'Detectando padrões de Pix e espécie…',
    'Calculando Score de Coerência Fiscal…',
    'Consolidando diagnóstico…',
  ];

  const rh = document.getElementById('resultHero');
  const ra = document.getElementById('resultAlerts');

  if (rh) rh.innerHTML = `
    <div style="padding:28px 20px 24px;text-align:center">
      <div style="font-family:Manrope,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:20px">// processando análise</div>
      <div id="dScanAnim" style="display:flex;flex-direction:column;gap:10px;text-align:left;margin-bottom:24px;max-width:400px;margin-left:auto;margin-right:auto"></div>
      <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:8px;max-width:400px;margin-left:auto;margin-right:auto">
        <div id="dScanBar" style="height:100%;background:var(--green);border-radius:2px;width:0%;transition:width 0.4s ease"></div>
      </div>
      <div id="dScanPct" style="font-family:Manrope,sans-serif;font-size:12px;color:var(--muted)">0%</div>
    </div>`;
  if (ra) ra.innerHTML = '';

  const scanEl = document.getElementById('dScanAnim');
  const barEl  = document.getElementById('dScanBar');
  const pctEl  = document.getElementById('dScanPct');
  let lineIdx  = 0;

  function addScanLine() {
    if (!scanEl || lineIdx >= scanLines.length) return;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted2);opacity:0;transition:opacity 0.3s';
    div.innerHTML = `<span style="color:var(--green);font-size:10px">▶</span>${scanLines[lineIdx]}`;
    scanEl.appendChild(div);
    setTimeout(() => { div.style.opacity = '1'; }, 30);
    lineIdx++;
    const prog = Math.round((lineIdx / scanLines.length) * 100);
    if (barEl) barEl.style.width = prog + '%';
    if (pctEl) pctEl.textContent = prog + '%';
  }

  for (let i = 0; i < scanLines.length; i++) {
    setTimeout(addScanLine, i * 350);
  }

  setTimeout(() => dRevealResult(pct, answers), scanLines.length * 350 + 400);
}

function dRevealResult(pct, answers) {
  let level, color, emoji, desc, ctaCopy;
  const alertsData = [];
  const lockedData = [];

  if (pct <= 20) {
    level = 'Perfil compatível'; color = '#00d96e'; emoji = '🟢';
    desc  = 'Seu perfil não apresenta sinais evidentes de incompatibilidade com o declarado. Confirmar com o extrato real é a forma mais segura de garantir.';
    ctaCopy = 'Confirmar que está tudo certo →';
    alertsData.push({ cls:'alert-green', icon:'✅', title:'Fontes de renda consistentes', text:'Seu perfil não apresenta sinais de incompatibilidade entre movimentação bancária e o que a Receita espera declarado.' });
    alertsData.push({ cls:'alert-green', icon:'✅', title:'Sem padrões informais detectados', text:'Nenhum padrão de recebimento recorrente sem justificativa que ative o sistema e-Financeira foi identificado.' });
    alertsData.push({ cls:'alert-green', icon:'💡', title:'Recomendação preventiva', text:'Mantenha comprovantes de todas as deduções por pelo menos 5 anos. A Receita pode auditar retroativamente mesmo declarações aprovadas.' });
    lockedData.push({ label:'Padrão de Pix recebidos', val:'Aguarda extrato' });
    lockedData.push({ label:'Índice de espécie', val:'Aguarda extrato' });
    lockedData.push({ label:'Anomalia temporal', val:'Aguarda extrato' });
  } else if (pct <= 55) {
    level = 'Sinais que merecem atenção'; color = '#f5a623'; emoji = '🟡';
    desc  = 'Identificamos possíveis incompatibilidades. Esses padrões são os mesmos que o e-Financeira usa para cruzar com sua declaração.';
    ctaCopy = 'Confirmar sinais no meu extrato →';
    if (answers[0]?.multiSel?.length > 2) alertsData.push({ cls:'alert-yellow', icon:'⚠️', title:'Múltiplas fontes de renda', text:'Cada fonte adicional aumenta a chance de divergência entre dados bancários e o declarado. Todas precisam estar detalhadas na declaração.' });
    if (answers[1]?.risk > 0) alertsData.push({ cls:'alert-yellow', icon:'⚠️', title:'Pix recebidos sem justificativa', text:'Bancos reportam à Receita via e-Financeira toda movimentação mensal acima de R$5.000. Pix frequentes sem nota fiscal são o principal gatilho de malha fina em autônomos.' });
    if (answers[2]?.risk > 0) alertsData.push({ cls:'alert-yellow', icon:'⚠️', title:'Declaração possivelmente incompleta', text:'A Receita já possui os dados bancários antes de você declarar. Qualquer entrada não justificada é cruzada automaticamente.' });
    if (answers[4]?.risk > 0) alertsData.push({ cls:'alert-yellow', icon:'⚠️', title:'Deduções sem comprovante', text:'Planos de saúde, hospitais e faculdades enviam dados à Receita independentemente. Valores divergentes geram malha fina automática.' });
    if (!alertsData.length) alertsData.push({ cls:'alert-yellow', icon:'⚠️', title:'Pontos que merecem revisão', text:'Seus dados apresentam aspectos que um contador deve avaliar antes do prazo de entrega.' });
    alertsData.push({ cls:'alert-green', icon:'💡', title:'Ainda dá tempo de regularizar', text:'Uma retificação preventiva custa muito menos do que uma autuação. Após notificado, multas e juros se aplicam automaticamente.' });
    lockedData.push({ label:'Divergência renda × movimentação', val:'🔒 bloqueado' });
    lockedData.push({ label:'Padrão Pix suspeito', val:'🔒 bloqueado' });
    lockedData.push({ label:'Variação patrimonial', val:'🔒 bloqueado' });
  } else {
    level = 'Perfil requer análise urgente'; color = '#f04f60'; emoji = '🔴';
    desc  = 'Seu perfil ativou múltiplos critérios de atenção. Esses são os mesmos sinais que a Receita Federal cruza automaticamente com extratos bancários.';
    ctaCopy = 'Ver o que a Receita pode estar vendo →';
    if (answers[2]?.risk >= 4) alertsData.push({ cls:'alert-red', icon:'🚨', title:'Possível omissão de renda', text:'É o motivo número 1 de malha fina no Brasil. A Receita recebe os dados bancários diretamente dos bancos — a declaração precisa bater exatamente.' });
    if (answers[1]?.risk >= 3) alertsData.push({ cls:'alert-red', icon:'🚨', title:'Pix informais recorrentes', text:'Recebimentos regulares sem nota fiscal são detectados automaticamente pelo e-Financeira. Não precisa de denúncia para a Receita identificar.' });
    if (answers[3]?.risk >= 3) alertsData.push({ cls:'alert-red', icon:'🚨', title:'Incompatibilidade patrimonial', text:'Compras ou investimentos acima da renda declarada acionam o IRPF de ofício — a Receita lança o imposto automaticamente sobre a diferença.' });
    if (answers[5]?.risk >= 2) alertsData.push({ cls:'alert-red', icon:'🚨', title:'Dependente declarado por mais de uma pessoa', text:'Quando duas pessoas declaram o mesmo dependente, o sistema retém as duas declarações automaticamente para revisão.' });
    if (!alertsData.length) alertsData.push({ cls:'alert-red', icon:'🚨', title:'Múltiplos fatores de risco simultâneos', text:'Seu perfil ativa vários critérios de atenção da Receita ao mesmo tempo. Risco real de notificação.' });
    alertsData.push({ cls:'alert-yellow', icon:'💡', title:'Ação urgente recomendada', text:'É possível retificar antes de qualquer notificação. Após notificado, multas e juros se aplicam automaticamente. Procure um contador agora.' });
    lockedData.push({ label:'Incompatibilidade renda declarada', val:'🔒 crítico' });
    lockedData.push({ label:'Pix informais recorrentes', val:'🔒 crítico' });
    lockedData.push({ label:'Anomalia temporal detectada', val:'🔒 crítico' });
  }

  // gauge
  const gaugeR = 70, cx = 110, cy = 100;
  const startAngle = 210, endAngle = 330;
  const totalDeg  = 360 - startAngle + endAngle;
  const targetDeg = (pct / 100) * totalDeg;

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

  const rh = document.getElementById('resultHero');
  if (rh) rh.innerHTML = `
    <div class="result-glow" style="background:${color}"></div>
    <div style="padding:28px 28px 16px">
      <div style="font-family:Manrope,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:16px;text-align:center">// score de coerência fiscal</div>
      <div style="display:flex;align-items:center;gap:24px">
        <div style="flex-shrink:0">
          <svg width="220" height="130" viewBox="0 0 220 130">
            <path d="${arcPath(startAngle, startAngle + totalDeg, gaugeR)}"
              fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="14" stroke-linecap="round"/>
            <path id="dGaugeArc" d="${arcPath(startAngle, startAngle, gaugeR)}"
              fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
              style="transition:all 1.4s cubic-bezier(0.4,0,0.2,1)"/>
            <line id="dNeedle" x1="${cx}" y1="${cy}" x2="${needleStart.x}" y2="${needleStart.y}"
              stroke="${color}" stroke-width="2.5" stroke-linecap="round"
              style="transform-origin:${cx}px ${cy}px;transition:transform 1.4s cubic-bezier(0.4,0,0.2,1)"/>
            <circle cx="${cx}" cy="${cy}" r="5" fill="${color}"/>
            <text x="${cx}" y="${cy - 14}" text-anchor="middle"
              style="font-family:Manrope,sans-serif;font-size:32px;font-weight:800;fill:${color};letter-spacing:-2px"
              id="dGaugeNum">0</text>
            <text x="${cx}" y="${cy + 4}" text-anchor="middle"
              style="font-family:Inter,sans-serif;font-size:10px;fill:#64748b;letter-spacing:1px">ÍNDICE</text>
            <text x="38"  y="122" text-anchor="middle" style="font-family:Inter,sans-serif;font-size:9px;fill:#64748b">BAIXO</text>
            <text x="${cx}" y="128" text-anchor="middle" style="font-family:Inter,sans-serif;font-size:9px;fill:#64748b">MÉDIO</text>
            <text x="182" y="122" text-anchor="middle" style="font-family:Inter,sans-serif;font-size:9px;fill:#64748b">ALTO</text>
          </svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-family:Manrope,sans-serif;font-size:20px;font-weight:800;color:${color};line-height:1.2;margin-bottom:8px">${level}</div>
          <div style="font-size:14px;color:var(--muted2);line-height:1.65">${desc}</div>
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    const arc   = document.getElementById('dGaugeArc');
    const ndl   = document.getElementById('dNeedle');
    const numEl = document.getElementById('dGaugeNum');
    if (arc) arc.setAttribute('d', arcPath(startAngle, startAngle + targetDeg, gaugeR));
    if (ndl) ndl.style.transform = `rotate(${targetDeg}deg)`;
    let n = 0;
    const step = () => { n = Math.min(n + 2, pct); if (numEl) numEl.textContent = n; if (n < pct) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, 100);

  // alertas progressivos
  const ra = document.getElementById('resultAlerts');
  if (!ra) return;
  ra.innerHTML = '';

  const visiveis  = alertsData.slice(0, 2);
  const bloqueados = alertsData.slice(2);

  visiveis.forEach((a, i) => {
    setTimeout(() => {
      const div = document.createElement('div');
      div.className = `alert-item ${a.cls}`;
      div.style.cssText = 'opacity:0;transform:translateY(8px);transition:all 0.35s ease';
      div.innerHTML = `<span class="alert-icon">${a.icon}</span><span><strong style="font-weight:600;display:block;margin-bottom:2px">${sanitize(a.title)}</strong>${sanitize(a.text)}</span>`;
      ra.appendChild(div);
      setTimeout(() => { div.style.opacity='1'; div.style.transform='translateY(0)'; }, 30);
    }, i * 400);
  });

  // blur paywall
  setTimeout(() => {
    if (bloqueados.length > 0 || lockedData.length > 0) {
      const blurBlock = document.createElement('div');
      blurBlock.style.cssText = 'margin-top:8px;border-radius:14px;overflow:hidden;position:relative';
      blurBlock.innerHTML = `
        <div style="filter:blur(5px);user-select:none;pointer-events:none;background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:14px 16px">
          ${lockedData.map(d => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
              <span style="color:var(--muted2)">${d.label}</span>
              <span style="font-family:Manrope,sans-serif;font-weight:700;color:var(--red)">${d.val}</span>
            </div>`).join('')}
          ${bloqueados.map(a => `
            <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px">
              <span>${a.icon}</span>
              <span style="color:var(--muted2)">${a.title}</span>
            </div>`).join('')}
        </div>
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(17,24,39,0.2) 0%,rgba(17,24,39,0.92) 55%);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:16px">
          <div style="font-size:20px;margin-bottom:6px">🔒</div>
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:700;color:var(--text);text-align:center;margin-bottom:4px">Detectamos ${lockedData.length + bloqueados.length} padrões na sua simulação</div>
          <div style="font-size:11px;color:var(--muted2);text-align:center;line-height:1.5">Confirme com seu extrato real para ver os detalhes exatos</div>
        </div>`;
      ra.appendChild(blurBlock);
    }

    // CTA contextual
    setTimeout(() => {
      const ctaBlock = document.createElement('div');
      ctaBlock.style.cssText = 'margin-top:16px;opacity:0;transform:translateY(10px);transition:all 0.4s ease';
      ctaBlock.innerHTML = `
        <button onclick="showPage('extrato')" style="width:100%;padding:16px;background:${color === '#00d96e' ? 'var(--green)' : color};border:none;border-radius:12px;color:${color === '#f04f60' ? '#fff' : '#000'};font-family:Manrope,sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all 0.2s;letter-spacing:0.01em">${ctaCopy}</button>
        <div style="text-align:center;font-size:11px;color:var(--muted);margin-top:8px">🔒 Seus arquivos são processados localmente · Nenhum dado enviado</div>`;
      ra.appendChild(ctaBlock);
      setTimeout(() => { ctaBlock.style.opacity='1'; ctaBlock.style.transform='translateY(0)'; }, 30);
    }, 300);
  }, visiveis.length * 400 + 300);
}

function restart() {
  cur = 0; answers = []; sel = null;
  document.getElementById('resultPanel').style.display = 'none';
  document.getElementById('questionPanel').style.display = 'block';
  document.getElementById('resultHero').innerHTML = '';
  document.getElementById('resultAlerts').innerHTML = '';
  renderQ();
}

// ===== QUIZ MOBILE — mesmo engine, IDs m* =====
let mCur = 0, mAnswers = [], mSel = null;

function mRenderQ() {
  const q = questions[mCur];
  const isMulti = !!q.multi;
  const multiSel = mAnswers[mCur]?.multiSel || [];

  const bar = document.getElementById('mStepsBar');
  if (bar) bar.innerHTML = questions.map((_,i) => {
    let cls = 'step-dot';
    if(i < mCur) cls += ' done';
    else if(i === mCur) cls += ' active';
    return `<div class="${cls}"></div>`;
  }).join('');

  const body = document.getElementById('mQBody');
  if (!body) return;
  body.innerHTML = `
    <div class="q-num">${q.tag}</div>
    <div class="q-title">${q.title}</div>
    <div class="q-sub">${q.sub}${isMulti ? '<br><span style="font-size:11px;color:var(--green);font-family:Manrope,sans-serif;font-weight:600;letter-spacing:0.5px;margin-top:5px;display:inline-block">✦ Selecione todas que se aplicam</span>' : ''}</div>
    <div class="options">
      ${q.opts.map((o,i) => {
        const isSel = isMulti ? multiSel.includes(i) : (mSel?.index === i);
        const radioStyle = isMulti ? 'border-radius:5px' : '';
        return `<button class="opt${isSel?' sel':''}" onclick="${isMulti ? `mToggleMulti(${i})` : `mChoose(${i},${o.risk})`}">
          <div class="opt-radio" style="${radioStyle}">${isSel?'<span style="font-size:10px;color:#000;font-weight:800">✓</span>':''}</div>
          <div class="opt-text">
            <div class="opt-label">${o.label}</div>
            <div class="opt-desc">${o.desc}</div>
          </div>
          <span class="risk-pill ${o.pill}">${o.pillText}</span>
        </button>`;
      }).join('')}
    </div>
  `;

  body.classList.remove('q-slide');
  requestAnimationFrame(() => body.classList.add('q-slide'));

  const bb = document.getElementById('mBtnBack');
  const nx = document.getElementById('mBtnNext');
  if (bb) { bb.disabled = mCur === 0; }
  if (nx) {
    nx.disabled = false;
    const hasAns = isMulti ? multiSel.length > 0 : mSel !== null;
    nx.classList.toggle('on', hasAns);
    nx.textContent = mCur === questions.length-1 ? 'Ver resultado →' : 'Continuar →';
  }
}

function mChoose(index, risk) {
  mSel = { index, risk };
  const body = document.getElementById('mQBody');
  if (!body) return;
  body.querySelectorAll('.opt').forEach((el,i) => {
    el.classList.toggle('sel', i===index);
    el.querySelector('.opt-radio').innerHTML = i===index ? '<span style="font-size:10px;color:#000;font-weight:800">✓</span>' : '';
  });
  const nx = document.getElementById('mBtnNext');
  if (nx) nx.classList.add('on');
}

function mToggleMulti(index) {
  const q = questions[mCur];
  if (!mAnswers[mCur]) mAnswers[mCur] = { multiSel: [], risk: 0 };
  const ms = mAnswers[mCur].multiSel;
  const pos = ms.indexOf(index);
  if (pos === -1) ms.push(index); else ms.splice(pos, 1);
  const total = ms.reduce((a,i) => a + q.opts[i].risk, 0);
  mAnswers[mCur].risk = Math.min(5, total + (ms.length >= 3 ? 1 : 0));
  const body2 = document.getElementById('mQBody');
  if (body2) body2.querySelectorAll('.opt').forEach((el,i) => {
    const isSel = ms.includes(i);
    el.classList.toggle('sel', isSel);
    el.querySelector('.opt-radio').innerHTML = isSel ? '<span style="font-size:10px;color:#000;font-weight:800">✓</span>' : '';
  });
  const nx = document.getElementById('mBtnNext');
  if (nx) nx.classList.toggle('on', ms.length > 0);
}

function mNextQ() {
  const q = questions[mCur];
  if (q.multi) {
    if (!mAnswers[mCur] || mAnswers[mCur].multiSel.length === 0) return;
  } else {
    if (!mSel) return;
    mAnswers[mCur] = mSel;
  }
  if (mCur < questions.length-1) {
    mCur++;
    mSel = (mAnswers[mCur] && !questions[mCur].multi) ? mAnswers[mCur] : null;
    // Desabilita botões durante microfeedback — evita duplo clique/travamento
    const nx = document.getElementById('mBtnNext');
    const bk = document.getElementById('mBtnBack');
    if (nx) { nx.disabled = true; nx.classList.remove('on'); }
    if (bk) bk.disabled = true;
    // Microfeedback entre perguntas
    const body = document.getElementById('mQBody');
    const msgs = [
      'Analisando compatibilidade financeira…',
      'Detectando possíveis sinais…',
      'Cruzando com critérios do e-Financeira…',
      'Calculando índice de coerência fiscal…',
    ];
    if (body) {
      body.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--muted2);font-family:Manrope,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.5px">${msgs[(mCur-1) % msgs.length]}</div>`;
    }
    setTimeout(() => mRenderQ(), 250);
  } else {
    mShowResult();
  }
}

function mPrevQ() {
  if (mCur > 0) {
    mCur--;
    mSel = (mAnswers[mCur] && !questions[mCur].multi) ? mAnswers[mCur] : null;
    mRenderQ();
  }
}

function mShowResult() {
  const qp = document.getElementById('mQuestionPanel');
  const rp = document.getElementById('mResultPanel');
  if (qp) qp.style.display = 'none';

  // ── FASE 1: tela de análise simulada (2.2s) ──────────────────────────
  const rh = document.getElementById('mResultHero');
  const ra = document.getElementById('mResultAlerts');
  if (rp) rp.style.display = 'block';

  const total = mAnswers.reduce((a,b) => a + (b?.risk || 0), 0);
  const pct   = Math.min(100, Math.round((total / 19) * 100));

  const scanLines = [
    'Cruzando movimentações com critérios e-Financeira…',
    'Verificando compatibilidade renda × extrato…',
    'Detectando padrões de Pix e espécie…',
    'Calculando Score de Coerência Fiscal…',
    'Consolidando diagnóstico…',
  ];

  if (rh) rh.innerHTML = `
    <div style="padding:28px 20px 24px;text-align:center">
      <div style="font-family:Manrope,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:20px">// processando análise</div>
      <div id="mScanAnim" style="display:flex;flex-direction:column;gap:10px;text-align:left;margin-bottom:24px"></div>
      <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:8px">
        <div id="mScanBar" style="height:100%;background:var(--green);border-radius:2px;width:0%;transition:width 0.4s ease"></div>
      </div>
      <div id="mScanPct" style="font-family:Manrope,sans-serif;font-size:12px;color:var(--muted)">0%</div>
    </div>`;
  if (ra) ra.innerHTML = '';

  // anima linhas de scan
  const scanEl = document.getElementById('mScanAnim');
  const barEl  = document.getElementById('mScanBar');
  const pctEl  = document.getElementById('mScanPct');
  let lineIdx = 0;

  function addScanLine() {
    if (!scanEl) return;
    if (lineIdx < scanLines.length) {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted2);opacity:0;transition:opacity 0.3s';
      div.innerHTML = `<span style="color:var(--green);font-size:10px">▶</span>${scanLines[lineIdx]}`;
      scanEl.appendChild(div);
      setTimeout(() => { div.style.opacity = '1'; }, 30);
      lineIdx++;
      const prog = Math.round((lineIdx / scanLines.length) * 100);
      if (barEl) barEl.style.width = prog + '%';
      if (pctEl) pctEl.textContent = prog + '%';
    }
  }

  for (let i = 0; i < scanLines.length; i++) {
    setTimeout(addScanLine, i * 380);
  }

  // ── FASE 2: revelar resultado após scan ───────────────────────────────
  setTimeout(() => mRevealResult(pct), scanLines.length * 380 + 400);
}

function mRevealResult(pct) {
  let level, color, emoji, desc, ctaCopy, alertsData = [], lockedData = [];

  if (pct <= 20) {
    level   = 'Perfil compatível';
    color   = '#00d96e'; emoji = '🟢';
    desc    = 'Seu perfil não apresenta sinais evidentes de incompatibilidade com o declarado. Ainda assim, confirmar com o extrato real é a forma mais segura de garantir.';
    ctaCopy = 'Confirmar que está tudo certo →';
    alertsData.push({ cls:'alert-green', icon:'✅', title:'Coerência fiscal dentro do esperado', text:'Movimentações e renda declarada apresentam compatibilidade dentro dos critérios do e-Financeira.' });
    alertsData.push({ cls:'alert-green', icon:'💡', title:'Recomendação preventiva', text:'Mesmo perfis compatíveis podem ter pontos de atenção no extrato real que o simulador não captura.' });
    lockedData = [
      { label:'Padrão de Pix recebidos', val:'Aguarda extrato' },
      { label:'Índice de espécie', val:'Aguarda extrato' },
      { label:'Anomalia temporal', val:'Aguarda extrato' },
    ];
  } else if (pct <= 55) {
    level   = 'Sinais que merecem atenção';
    color   = '#f5a623'; emoji = '🟡';
    desc    = 'Identificamos possíveis incompatibilidades. Esses padrões são os mesmos que o e-Financeira usa para cruzar com sua declaração.';
    ctaCopy = 'Confirmar sinais no meu extrato →';
    alertsData.push({ cls:'alert-yellow', icon:'⚠️', title:'Possíveis incompatibilidades detectadas', text:'Seu perfil apresenta aspectos que podem divergir do esperado pela Receita antes da declaração.' });
    alertsData.push({ cls:'alert-yellow', icon:'⚠️', title:'Movimentações a verificar', text:'Pix recorrentes, recebimentos informais e variações de padrão são os principais gatilhos de malha fina.' });
    lockedData = [
      { label:'Divergência renda × movimentação', val:'🔒 bloqueado' },
      { label:'Padrão Pix suspeito', val:'🔒 bloqueado' },
      { label:'Variação patrimonial', val:'🔒 bloqueado' },
    ];
  } else {
    level   = 'Perfil requer análise urgente';
    color   = '#f04f60'; emoji = '🔴';
    desc    = 'Seu perfil ativou múltiplos critérios de atenção. Esses são os mesmos sinais que a Receita Federal cruza automaticamente com extratos bancários.';
    ctaCopy = 'Ver o que a Receita pode estar vendo →';
    alertsData.push({ cls:'alert-red', icon:'🚨', title:'Divergências financeiras identificadas', text:'Seu perfil ativa critérios do e-Financeira. A Receita já possui esses dados — sua declaração precisa bater.' });
    alertsData.push({ cls:'alert-red', icon:'🚨', title:'Risco de malha fina detectado', text:'Padrões identificados na simulação coincidem com os principais motivos de retenção em declarações de IR.' });
    lockedData = [
      { label:'Incompatibilidade renda declarada', val:'🔒 crítico' },
      { label:'Pix informais recorrentes', val:'🔒 crítico' },
      { label:'Anomalia temporal detectada', val:'🔒 crítico' },
    ];
  }

  // gauge SVG
  const gaugeR = 70, cx = 110, cy = 100;
  const startAngle = 210, endAngle = 330;
  const totalDeg = 360 - startAngle + endAngle;
  const targetDeg = (pct / 100) * totalDeg;

  function polarToXY(deg, r) {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function arcPath(startDeg, endDeg, r) {
    const s = polarToXY(startDeg, r);
    const e = polarToXY(endDeg, r);
    const large = (endDeg - startDeg + 360) % 360 > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }
  const needleEnd = polarToXY(startAngle, gaugeR - 14); // posição inicial do ponteiro

  const rh = document.getElementById('mResultHero');
  if (rh) rh.innerHTML = `
    <div class="result-glow" style="background:${color}"></div>
    <div style="padding:28px 20px 16px">
      <div style="font-family:Manrope,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:16px;text-align:center">// score de coerência fiscal</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
        <div style="width:100%;max-width:240px">
          <svg width="100%" viewBox="0 0 220 130">
            <!-- trilha cinza -->
            <path d="${arcPath(startAngle, startAngle + totalDeg, gaugeR)}"
              fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="14" stroke-linecap="round"/>
            <!-- arco colorido animado -->
            <path id="mGaugeArc" d="${arcPath(startAngle, startAngle, gaugeR)}"
              fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
              style="transition:all 1.4s cubic-bezier(0.4,0,0.2,1)"/>
            <!-- ponteiro -->
            <line id="mNeedle"
              x1="${cx}" y1="${cy}"
              x2="${needleEnd.x}" y2="${needleEnd.y}"
              stroke="${color}" stroke-width="2.5" stroke-linecap="round"
              style="transform-origin:${cx}px ${cy}px;transition:transform 1.4s cubic-bezier(0.4,0,0.2,1)"/>
            <circle cx="${cx}" cy="${cy}" r="5" fill="${color}"/>
            <!-- score central -->
            <text x="${cx}" y="${cy - 14}" text-anchor="middle"
              style="font-family:Manrope,sans-serif;font-size:32px;font-weight:800;fill:${color};letter-spacing:-2px"
              id="mGaugeNum">0</text>
            <text x="${cx}" y="${cy + 4}" text-anchor="middle"
              style="font-family:Inter,sans-serif;font-size:10px;fill:#64748b;letter-spacing:1px">ÍNDICE</text>
            <!-- labels extremos -->
            <text x="38" y="122" text-anchor="middle"
              style="font-family:Inter,sans-serif;font-size:9px;fill:#64748b">BAIXO</text>
            <text x="${cx}" y="128" text-anchor="middle"
              style="font-family:Inter,sans-serif;font-size:9px;fill:#64748b">MÉDIO</text>
            <text x="182" y="122" text-anchor="middle"
              style="font-family:Inter,sans-serif;font-size:9px;fill:#64748b">ALTO</text>
          </svg>
        </div>
        <div style="text-align:center;padding:0 8px">
          <div style="font-family:Manrope,sans-serif;font-size:18px;font-weight:800;color:${color};line-height:1.2;margin-bottom:8px">${level}</div>
          <div style="font-size:13px;color:var(--muted2);line-height:1.65">${desc}</div>
        </div>
      </div>
    </div>`;

  // anima gauge após render
  setTimeout(() => {
    const arc    = document.getElementById('mGaugeArc');
    const needle = document.getElementById('mNeedle');
    const numEl  = document.getElementById('mGaugeNum');
    if (arc) arc.setAttribute('d', arcPath(startAngle, startAngle + targetDeg, gaugeR));
    if (needle) needle.style.transform = `rotate(${targetDeg}deg)`;
    // contador do número
    let cur = 0;
    const step = () => {
      cur = Math.min(cur + 2, pct);
      if (numEl) numEl.textContent = cur;
      if (cur < pct) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, 100);

  // ── alertas com reveal progressivo ───────────────────────────────────
  const ra = document.getElementById('mResultAlerts');
  if (!ra) return;
  ra.innerHTML = '';

  function addAlert(a, delay) {
    setTimeout(() => {
      const div = document.createElement('div');
      div.className = `alert-item ${a.cls}`;
      div.style.cssText = 'opacity:0;transform:translateY(8px);transition:all 0.35s ease';
      div.innerHTML = `<span class="alert-icon">${a.icon}</span><span><strong style="font-weight:600;display:block;margin-bottom:2px">${sanitize(a.title)}</strong>${sanitize(a.text)}</span>`;
      ra.appendChild(div);
      setTimeout(() => { div.style.opacity='1'; div.style.transform='translateY(0)'; }, 30);
    }, delay);
  }

  alertsData.forEach((a, i) => addAlert(a, i * 400));

  // ── bloco bloqueado com blur ──────────────────────────────────────────
  setTimeout(() => {
    const blurBlock = document.createElement('div');
    blurBlock.style.cssText = 'margin-top:8px;border-radius:14px;overflow:hidden;position:relative';
    blurBlock.innerHTML = `
      <div style="filter:blur(5px);user-select:none;pointer-events:none;background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:14px 16px">
        ${lockedData.map(d => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
            <span style="color:var(--muted2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${d.label}</span>
            <span style="font-family:Manrope,sans-serif;font-weight:700;color:var(--red);flex-shrink:0;margin-left:8px">${d.val}</span>
          </div>`).join('')}
      </div>
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(17,24,39,0.2) 0%,rgba(17,24,39,0.92) 55%);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:16px">
        <div style="font-size:20px;margin-bottom:6px">🔒</div>
        <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:700;color:var(--text);text-align:center;margin-bottom:4px">Detectamos ${lockedData.length} padrões na sua simulação</div>
        <div style="font-size:11px;color:var(--muted2);text-align:center;line-height:1.5">Confirme com seu extrato real para ver os detalhes exatos</div>
      </div>`;
    ra.appendChild(blurBlock);

    // ── CTA contextual ────────────────────────────────────────────────
    setTimeout(() => {
      const ctaBlock = document.createElement('div');
      ctaBlock.style.cssText = 'margin-top:16px;opacity:0;transform:translateY(10px);transition:all 0.4s ease';
      ctaBlock.innerHTML = `
        <button onclick="showPage('extrato')" style="width:100%;padding:16px;background:${color === '#00d96e' ? 'var(--green)' : color};border:none;border-radius:12px;color:${color === '#f04f60' ? '#fff' : '#000'};font-family:Manrope,sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all 0.2s;letter-spacing:0.01em">${ctaCopy}</button>
        <div style="text-align:center;font-size:11px;color:var(--muted);margin-top:8px">🔒 Seus arquivos são processados localmente · Nenhum dado enviado</div>`;
      ra.appendChild(ctaBlock);
      setTimeout(() => { ctaBlock.style.opacity='1'; ctaBlock.style.transform='translateY(0)'; }, 30);

      // esconde o upgrade-cards e btn-restart padrão — CTA contextual substitui
      const upgradeArea = document.querySelector('#mResultPanel .result-upgrade');
      const restartBtn  = document.querySelector('#mResultPanel .result-cta');
      if (upgradeArea) upgradeArea.style.display = 'none';
      if (restartBtn)  restartBtn.style.display  = 'none';
    }, 300);
  }, alertsData.length * 400 + 300);
}

function mRestart() {
  mCur = 0; mAnswers = []; mSel = null;
  const rp = document.getElementById('mResultPanel');
  const qp = document.getElementById('mQuestionPanel');
  if (rp) rp.style.display = 'none';
  if (qp) qp.style.display = 'block';
  // restaura elementos ocultados pelo resultado
  const upgradeArea = document.querySelector('#mResultPanel .result-upgrade');
  const restartBtn  = document.querySelector('#mResultPanel .result-cta');
  if (upgradeArea) upgradeArea.style.display = '';
  if (restartBtn)  restartBtn.style.display  = '';
  mRenderQ();
}

// Abre o quiz sempre limpo — usado pelo botão "Fazer quiz gratuito"
function openQuiz() {
  // Navega para home se necessário
  const current = document.querySelector('.page.active')?.id?.replace('page-', '');
  if (current !== 'home') {
    try { history.pushState({ page: 'home' }, '', '#home'); } catch(e) {}
    _applyPage('home');
  }
  // Garante tab perguntas ativa
  switchSimTab('perguntas');
  // Sempre reseta estado — independente de onde o quiz estava
  cur = 0; answers = []; sel = null;
  const rp = document.getElementById('resultPanel');
  const qp = document.getElementById('questionPanel');
  if (rp) rp.style.display = 'none';
  if (qp) qp.style.display = 'block';
  renderQ();
  // Scroll suave até o simulador
  setTimeout(() => {
    const isMobile = window.innerWidth < 1100;
    const target = isMobile
      ? document.getElementById('quizWrap')
      : document.querySelector('.sim-wrap');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

// ── FEED DE DETECÇÕES AO VIVO (demo animada na home) ─────────────────────────
(function() {
  const detections = [
    { type: 'red',    icon: '🚨', label: 'Incompatibilidade de renda',       val: '+162% acima do declarado' },
    { type: 'yellow', icon: '⚠️', label: 'Pix recorrentes sem origem',        val: 'R$ 32.880 em 4 meses' },
    { type: 'red',    icon: '🚨', label: 'Atividade comercial não declarada', val: '7 recebimentos mensais' },
    { type: 'yellow', icon: '⚠️', label: 'Movimentação em espécie',           val: '18% das entradas' },
    { type: 'red',    icon: '🚨', label: 'Anomalia temporal detectada',       val: 'Pico 340% acima da média' },
    { type: 'yellow', icon: '⚠️', label: 'Circularidade financeira',          val: 'Saída = entrada em 2 dias' },
    { type: 'green',  icon: '✅', label: 'Renda formal identificada',         val: 'Holerite + depósito consistente' },
    { type: 'red',    icon: '🚨', label: 'Split Pix detectado',               val: '6 Pix abaixo de R$5k no mesmo dia' },
    { type: 'yellow', icon: '⚠️', label: 'Índice de consumo elevado',         val: 'Saídas = 134% das entradas' },
    { type: 'green',  icon: '✅', label: 'Score de coerência fiscal',         val: '23/100 — perfil compatível' },
  ];

  const colors = {
    red:    { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.18)',   text: '#f87171' },
    yellow: { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.18)',  text: '#fbbf24' },
    green:  { bg: 'rgba(16,185,129,0.07)',  border: 'rgba(16,185,129,0.18)', text: '#34d399' },
  };

  let idx = 0;
  const MAX_ITEMS = 4;

  function addDetection() {
    const feed = document.getElementById('detectFeed');
    if (!feed) return;

    const d = detections[idx % detections.length];
    const c = colors[d.type];
    idx++;

    const el = document.createElement('div');
    el.style.cssText = `display:flex;align-items:center;gap:8px;padding:8px 10px;background:${c.bg};border:1px solid ${c.border};border-radius:8px;animation:slideIn 0.35s ease;flex-shrink:0`;
    el.innerHTML = `
      <span style="font-size:13px;flex-shrink:0">${d.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:600;color:${c.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.label}</div>
        <div style="font-size:10px;color:var(--muted2);margin-top:1px">${d.val}</div>
      </div>
      <span style="font-size:9px;color:var(--muted);flex-shrink:0;font-family:Inter,sans-serif">agora</span>`;

    feed.insertBefore(el, feed.firstChild);

    // Remove excesso
    while (feed.children.length > MAX_ITEMS) {
      const last = feed.lastChild;
      last.style.opacity = '0';
      last.style.transition = 'opacity 0.3s';
      setTimeout(() => last.remove(), 300);
    }
  }

  // Inicia após carregamento — delay escalonado para parecer orgânico
  const delays = [800, 2200, 3800, 5000];
  delays.forEach((d, i) => setTimeout(() => { addDetection(); }, d));
  // Continua em loop — guarda referência para poder cancelar
  let _detectionInterval = null;
  setTimeout(() => {
    _detectionInterval = setInterval(addDetection, 3500);
  }, 6000);
  window._stopDetectionFeed = () => {
    if (_detectionInterval) { clearInterval(_detectionInterval); _detectionInterval = null; }
  };
})();

// ── FIM FEED DETECÇÕES ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  renderQ();
  mRenderQ();
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
});

// ===== PARSER V3 ENGINE =====
// pdf.js worker configurado dinamicamente em _loadPdfJs()

const MAX_FILES=5;
const SRC_COLORS=['#00d96e','#4d9fff','#f5a623','#c084fc','#fb7185'];

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
  CASH_ALERT_THRESHOLD: 3000,
  ESPECIE_LIMIT:        3000,
  // Split Pix
  SPLIT_PIX_DELTA:  500,
  SPLIT_PIX_MIN:    4500,
  SPLIT_PIX_WINDOW: 7,
  // Circularidade
  CIRCULAR_RATIO:   0.85,
  CIRCULAR_HOURS:   72,
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
};

// ── AGREGAÇÃO MENSAL CANÔNICA (modelo e-Financeira) ─────────
// Consolida créditos + débitos por mês e por tipo de canal
// A e-Financeira usa totais mensais, não transações isoladas
function aggregateMonthly(txns) {
  const months = {};
  for (const t of txns) {
    if (!t.date || !(t.date instanceof Date) || isNaN(t.date)) continue;
    const key = t.date.getFullYear() + '-' + String(t.date.getMonth()+1).padStart(2,'0');
    if (!months[key]) months[key] = {
      credits: 0, debits: 0,
      cashIn: 0,  cashOut: 0,
      pixIn: 0,   pixOut: 0,
      pixConsolidado: 0,  // crédito + débito Pix (modelo e-Financeira)
      especie: 0,
      formal: 0,
      txns: [], count: 0
    };
    const b = months[key];
    const v = Math.abs(t.value);
    const d = normalizeDesc(t.desc);
    if (t.value > 0) {
      b.credits += v;
      if (d.includes('pix'))  b.pixIn   += v;
      if (d.includes('saque') || d.includes('especie')) b.cashIn += v;
      if (d.includes('salario') || d.includes('holerite')) b.formal += v;
    } else {
      b.debits += v;
      if (d.includes('pix'))  b.pixOut  += v;
      if (d.includes('saque')) b.cashOut += v;
    }
    b.pixConsolidado = b.pixIn + b.pixOut;
    b.txns.push(t);
    b.count++;
  }
  return months;
}

// ── PERFIL HISTÓRICO (médias 3/6/12 meses) ───────────────────
function calcProfile(months) {
  const keys = Object.keys(months).filter(k => k !== 'unk').sort();
  const values = keys.map(k => months[k].credits + months[k].debits);
  const credits = keys.map(k => months[k].credits);
  const pixVals = keys.map(k => months[k].pixConsolidado);

  const avg = (arr) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  const last = (arr, n) => arr.slice(-n);

  return {
    avgTotal3:  avg(last(values, 3)),
    avgTotal6:  avg(last(values, 6)),
    avgTotal12: avg(last(values, 12)),
    avgCredits: avg(credits),
    avgPix:     avg(pixVals),
    totalMeses: keys.length,
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
  const dateStr = t.date instanceof Date ? t.date.toISOString().slice(0,10) : String(t.date||'');
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
  const dateStr = t.date instanceof Date
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
    const dateStr = t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date || '');
    const valStr  = (t.value >= 0 ? '+' : '-') + Math.abs(t.value).toFixed(2);
    const descStr = normalizeDesc(t.desc).slice(0, 25);
    const fp = dateStr + '|' + valStr + '|' + descStr;
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}
let eFiles=[];
let eAllTxns=[];
let eActiveBankTab='all';
let _eConsolidated=null;
let _eSources=null;

const fmtBRL=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
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
    return date&&label?{date,desc:label,value}:null;
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
      throw new Error('PDF corrompido ou ilegivel: ' + e.message);
    }
    if (pdf.numPages > ENGINE_CONFIG.PDF_MAX_PAGES) {
      throw new Error('PDF com mais de ' + ENGINE_CONFIG.PDF_MAX_PAGES + ' paginas. Exporte apenas o periodo necessario.');
    }
    let text='';
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p);
      const tc=await page.getTextContent();
      let lastY=null,line='';
      for(const item of tc.items){
        const y=Math.round(item.transform[5]);
        if(lastY!==null&&Math.abs(y-lastY)>3){text+=line.trim()+'\n';line='';}
        line+=(item.str||'')+' ';
        lastY=y;
      }
      if(line.trim())text+=line.trim()+'\n';
      page.cleanup(); // libera recursos canvas/stream da página
    }
    return text;
  } finally {
    if(pdf) await pdf.destroy(); // destrói documento PDF.js e libera memória do worker
  }
}
function eParsePDFText(text){
  const lines=text.split('\n').filter(l=>l.trim());
  const txns=[];
  const skip=/saldo anterior|saldo final|data\s+descri|período|agência|conta\s*:|cliente|extrato|banco\s+/i;
  // aceita DD/MM/YYYY ou DD/MM
  const re=/(\d{2}[\/\-]\d{2}(?:[\/\-]\d{4})?)\s+(.+?)\s+([\-\+]?\s*\d[\d.,]*(?:\.\d{3})*(?:,\d{2})?)\s*(?:[\d.,]+)?\s*$/;
  for(const line of lines){
    if(skip.test(line))continue;
    const m=line.match(re);
    if(!m)continue;
    const date=eParseDate(m[1]),desc=m[2].trim(),value=eParseBRL(m[3].replace(/\s/g,''));
    if(date&&desc&&value!==0)txns.push({date,desc,value});
  }
  return txns.length>0?txns:eParseGeneric(lines);
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
  especie:   ['saque','caixa eletronico','atm','deposito especie','dep especie','deposito em especie','dinheiro','cdas','cofre'],
  interno:   ['entre contas','conta própria','conta propria','transferência interna','transf interna','tid própria','tid propria','portabilidade'],
  pix:       ['pix recebido','pix credit','recebido pix','pix enviado','pix debitado','chave pix'],
  transf:    ['transferência recebida','transferencia recebida','ted recebida','doc recebido','depósito recebido','deposito recebido','transf. recebida','transf recebida'],
};

function catMatch(desc, cats) {
  const d = desc.toLowerCase();
  return cats.some(k => d.includes(k));
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
  const d = normalizeDesc(t.desc);
  const v = t.value;
  const channel = detectChannel(t.desc);

  if (v <= 0) return { risk: 'normal', flag: null, cat: 'saida', channel };

  // Transferência entre contas do próprio titular — não infla risco
  if (channel === 'proprio' || catMatch(d, CAT.interno))
    return { risk: 'normal', flag: null, cat: 'interno', channel };

  // Renda formal — baixo risco
  if (catMatch(d, CAT.formal)) return { risk: 'normal', flag: 'Renda formal', cat: 'formal', channel };

  // Investimentos — atenção (precisam ser declarados)
  if (catMatch(d, CAT.invest)) return { risk: 'attention', flag: 'Investimento', cat: 'invest', channel };

  // Aluguel recebido — atenção
  if (catMatch(d, CAT.aluguel)) return { risk: 'attention', flag: 'Aluguel', cat: 'aluguel', channel };

  // Atividade comercial — suspeito se recorrente
  if (catMatch(d, CAT.comercial)) return { risk: 'attention', flag: 'Comercial', cat: 'comercial' };

  // Depósito em espécie — alto risco
  if (catMatch(d, CAT.especie)) {
    if (v >= 3000) return { risk: 'suspicious', flag: 'Espécie ≥ R$3k', cat: 'especie' };
    return { risk: 'attention', flag: 'Espécie', cat: 'especie' };
  }

  // Pix recebido
  const isPix = catMatch(d, CAT.pix) || (d.includes('pix') && v > 0);
  const isTransf = catMatch(d, CAT.transf) || (d.includes('transf') && v > 0 && !catMatch(d, CAT.interno));

  if (isPix || isTransf) {
    if (v >= 10000) return { risk: 'suspicious', flag: 'Pix ≥ R$10k', cat: 'pix' };
    if (v >= 5000)  return { risk: 'suspicious', flag: 'Pix ≥ R$5k',  cat: 'pix' };
    if (v >= 2000)  return { risk: 'attention',  flag: 'Pix relevante', cat: 'pix' };
    if (v >= 500)   return { risk: 'attention',  flag: 'Pix', cat: 'pix' };
    return { risk: 'normal', flag: null, cat: 'pix' };
  }

  // Crédito genérico alto
  if (v >= 15000) return { risk: 'suspicious', flag: 'Crédito alto', cat: 'outros' };
  if (v >= 5000)  return { risk: 'attention',  flag: 'Valor relevante', cat: 'outros' };

  return { risk: 'normal', flag: null, cat: 'outros' };
}

// ── Detecção de recorrência comportamental ─────────────────────
function detectarRecorrencia(txns) {
  // Agrupa por descrição normalizada e detecta padrões de frequência
  const grupos = {};
  txns.filter(t => t.value > 0).forEach(t => {
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
  const comercialOculta = recorrentes.filter(r => r.desvioPct < 0.3 && r.count >= 6 && r.media >= 200);
  return { recorrentes, comercialOculta };
}

// ── Análise temporal — variação mensal (z-score simplificado) ──
function analiseTemporal(monthly) {
  const meses = Object.values(monthly).filter(m => m.total > 0);
  if (meses.length < 2) return { anomalias: [], mediaHistorica: 0, pico: 0 };

  const totais = meses.map(m => m.total);
  const media = totais.reduce((a, v) => a + v, 0) / totais.length;
  const desvio = Math.sqrt(totais.reduce((a, v) => a + Math.pow(v - media, 2), 0) / totais.length);

  const anomalias = meses.filter(m => {
    const z = desvio > 0 ? Math.abs(m.total - media) / desvio : 0;
    return z > 1.5; // 1.5 desvios padrão = anomalia relevante
  });

  return { anomalias, mediaHistorica: media, pico: Math.max(...totais) };
}

// ── Motor principal — análise de um extrato ────────────────────
// ── DETECCAO DE CIRCULARIDADE FINANCEIRA ─────────────────────
// Dinheiro que entra e sai em <= CIRCULAR_HOURS horas
function detectarCircularidade(txns) {
  const sorted = txns.slice().sort((a, b) => (a.date || 0) - (b.date || 0));
  const eventos = [];
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (t.value <= 0) continue;
    // procurar saida equivalente nas proximas CIRCULAR_HOURS horas
    let saidaAcum = 0;
    for (let j = i + 1; j < sorted.length; j++) {
      const u = sorted[j];
      if (!u.date || !t.date) break;
      const diffH = (u.date - t.date) / 3600000;
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

  const series = [];
  for (let i = 0; i < pixAltos.length - 1; i++) {
    const a = pixAltos[i], b = pixAltos[i + 1];
    if (!a.date || !b.date) continue;
    const diffDays = (b.date - a.date) / 86400000;
    const valueDiff = Math.abs(a.value - b.value);
    if (diffDays <= ENGINE_CONFIG.SPLIT_PIX_WINDOW && valueDiff <= ENGINE_CONFIG.SPLIT_PIX_DELTA) {
      series.push({ valores: [a.value, b.value], diffDays: Math.round(diffDays) });
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
function isInternalTransfer(txn, allTxns) {
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

  // 3. Pareamento ida/volta cross-source — mesmo valor, janela de 3 dias, sentido oposto
  //    Detecta: TED saindo do banco A aparecendo como crédito no banco B
  const sameValueOpposite = allTxns.filter(t =>
    t !== txn &&
    Math.abs(Math.abs(t.value) - Math.abs(txn.value)) <= 0.02 &&
    Math.sign(t.value) !== Math.sign(txn.value) &&
    t.date instanceof Date && txn.date instanceof Date &&
    Math.abs((t.date - txn.date) / 86400000) <= 3
  );

  if (sameValueOpposite.some(t => sameOwnerHeuristic(txn, t))) return 'probable';

  // 4. Mesmo valor, mesmo banco, janela de 1 dia (possível duplicata de arquivo)
  const espelhos = allTxns.filter(t =>
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
  const tedSaidas = allTxns.filter(t =>
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
  return classified.map(txn => {
    const result = isInternalTransfer(txn, classified);
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

function eAnalyzeSingle(txns, bank, rendaDeclarada) {
  rendaDeclarada = rendaDeclarada || 0;
  if (!txns || txns.length === 0) return null;

  // P6: Validar transacoes antes de processar
  const txnsValidas = txns.filter(isValidTxn);
  const parserConfidence = txns.length > 0 ? txnsValidas.length / txns.length : 0;
  const txnsDescartadas = txns.length - txnsValidas.length;

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
  const credits     = classified.filter(t => t.value > 0);
  const debits      = classified.filter(t => t.value < 0);
  // Internos confirmados/prováveis excluídos do cálculo de risco
  const creditsRisco= credits.filter(t => !t.internalMove || t.internalMove === 'uncertain');
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
  const monthsOverLimit = Object.values(monthly).filter(m => m.consolidado >= ENGINE_CONFIG.PIX_LIMIT_PF).length;

  // Recorrência, análise temporal, circularidade e split Pix
  const { recorrentes, comercialOculta } = detectarRecorrencia(txns);
  const { anomalias, mediaHistorica, pico } = analiseTemporal(monthly);
  const circularidade = detectarCircularidade(txns);
  const splitPix = detectarSplitPix(txns);

  // ── Cálculo de score com pesos ponderados — Motor v4 ──────────
  // v4: [FIX-1] IHH só em créditos não-formais | [FIX-2] F7 compatibilidade renda peso 25
  //     [FIX-3] Comercial recorrente = suspicious parcial | [FIX-4] F8 consumo baixo
  //     [FIX-5] Thresholds compatibilidade graduados
  let score = 0;
  const fatores = [];

  // [FIX-3] Comercial recorrente sem CNPJ visível conta 50% como suspeito
  const _comercialRecorTotal = recorrentes
    .filter(r => r.ocorrencias >= 2 && r.total > 0)
    .filter(r => { const d = r.desc.toLowerCase(); return d.includes('recebimento') || d.includes('serviço') || d.includes('servico') || d.includes('nota fiscal') || d.includes('honorar'); })
    .reduce((a, r) => a + r.total, 0);
  const suspTotalV4 = suspTotal + _comercialRecorTotal * 0.5;

  // F1 — Proporção de créditos suspeitos (peso reduzido 40→30 para abrir espaço ao F7)
  const totalCreditsRisco = creditsRisco.reduce((a, t) => a + t.value, 0);
  const infRatio = totalCreditsRisco > 0 ? suspTotalV4 / totalCreditsRisco : 0;
  const f1 = Math.round(Math.min(30, infRatio * 30));
  if (f1 > 0) fatores.push({ peso: f1, motivo: `${Math.round(infRatio * 100)}% dos créditos sem justificativa fiscal clara` });
  score += f1;

  // F2 — Movimentação Pix mensal consolidada acima do limite e-Financeira (peso 15, era 20)
  const f2 = Math.min(15, monthsOverLimit * 5);
  if (f2 > 0) fatores.push({
    peso: f2,
    motivo: `Movimentação Pix consolidada (crédito+débito) acima de R$${ENGINE_CONFIG.PIX_LIMIT_PF.toLocaleString('pt-BR')} em ${monthsOverLimit} mês(es) — perfil reportável ao e-Financeira`
  });
  score += f2;

  // F2b — Padrão trimestral elevado (peso 8, sem alteração)
  const trimestresElevados = Object.values(quarterly).filter(q => q.meses >= 2 && q.consolidado / q.meses >= ENGINE_CONFIG.PIX_LIMIT_PF).length;
  if (trimestresElevados > 0) {
    const f2b = Math.min(8, trimestresElevados * 4);
    score += f2b;
    fatores.push({ peso: f2b, motivo: `Padrão trimestral elevado: ${trimestresElevados} trimestre(s) com média mensal acima do limite e-Financeira` });
  }

  // F3 — Depósito em espécie (peso 15, era 20)
  const especieRatio = totalCredits > 0 ? especieTotal / totalCredits : 0;
  const f3 = Math.round(Math.min(15, especieRatio * 60));
  if (f3 > 0) fatores.push({ peso: f3, motivo: `${Math.round(especieRatio * 100)}% das entradas em espécie (R$${especieTotal.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0})})` });
  score += f3;

  // F4 — Atividade comercial oculta (peso 15, sem alteração)
  const f4 = Math.min(15, comercialOculta.length * 5);
  if (f4 > 0) fatores.push({ peso: f4, motivo: `${comercialOculta.length} padrão(ões) de atividade comercial recorrente sem vínculo declarado` });
  score += f4;

  // F5 — Anomalia temporal com perfil histórico (peso 15, sem alteração)
  const pctPico = mediaHistorica > 0 ? pico / mediaHistorica : 1;
  const mediaRef = perfil.avgCredits > 0 ? perfil.avgCredits : mediaHistorica;
  const ratioAtual = mediaRef > 0 && totalCredits > 0 ? totalCredits / mediaRef : 1;
  const f5 = pctPico >= 3 ? 15 : pctPico >= 2 ? 10 : pctPico >= 1.5 ? 5 : 0;
  if (f5 > 0) fatores.push({
    peso: f5,
    motivo: 'Pico de ' + (Math.round(pctPico * 10)/10) + 'x acima da média histórica' +
      (perfil.avgCredits > 0 ? ' (média ref: ' + fmtBRL(Math.round(perfil.avgCredits)) + ')' : '')
  });
  score += f5;
  if (ratioAtual >= 1.8 && perfil.avgCredits > 0) {
    const f5b = ratioAtual >= 3 ? 8 : ratioAtual >= 2 ? 5 : 3;
    score += f5b;
    fatores.push({
      peso: f5b,
      motivo: 'Créditos totais ' + (Math.round(ratioAtual * 10)/10) + 'x acima da média histórica — ' +
        'Média: ' + fmtBRL(Math.round(perfil.avgCredits)) + ' | Atual: ' + fmtBRL(Math.round(totalCredits))
    });
  }

  // F6 — Investimentos e aluguel não declarados (sem alteração)
  if (classified.some(t => t.flag === 'Investimento')) { score += 8; fatores.push({ peso: 8, motivo: 'Rendimentos de investimentos — verificar declaração' }); }
  if (classified.some(t => t.flag === 'Aluguel'))       { score += 6; fatores.push({ peso: 6, motivo: 'Recebimento de aluguel identificado' }); }

  // F6c — Circularidade financeira (peso 12, sem alteração)
  if (circularidade.length > 0) {
    const f6c = Math.min(12, circularidade.length * 6);
    score += f6c;
    fatores.push({ peso: f6c, motivo: `${circularidade.length} entrada(s) com saída rápida (possível circularidade financeira)` });
  }

  // F6d — Split de Pix abaixo do threshold (peso 10, sem alteração)
  if (splitPix.length > 0) {
    const f6d = Math.min(10, splitPix.length * 5);
    score += f6d;
    fatores.push({ peso: f6d, motivo: `${splitPix.length} série(s) de Pix fracionados próximos a R$${ENGINE_CONFIG.PIX_LIMIT.toLocaleString('pt-BR')}` });
  }

  // [FIX-2 + FIX-5] F7 — Compatibilidade com renda declarada (NOVO — peso 25)
  // Gradação: >2x leve (+7), >3x moderado (+15), >6x crítico (+25)
  if (rendaDeclarada > 0) {
    const _mesesN = Math.max(1, Object.keys(monthly).filter(k => k !== 'unk').length);
    const _movMedia = totalCredits / _mesesN;
    const _compatRatio = _movMedia / rendaDeclarada;
    let _f7 = 0, _compatNivel = '';
    if (_compatRatio > 6)      { _f7 = 25; _compatNivel = 'severa'; }
    else if (_compatRatio > 3) { _f7 = 15; _compatNivel = 'moderada'; }
    else if (_compatRatio > 2) { _f7 =  7; _compatNivel = 'leve'; }
    if (_f7 > 0) {
      score += _f7;
      fatores.push({
        peso: _f7,
        motivo: `Incompatibilidade ${_compatNivel}: movimentação média de ${fmtBRL(_movMedia)}/mês é ${_compatRatio.toFixed(1)}x a renda declarada de ${fmtBRL(rendaDeclarada)}/mês`
      });
    }
  }

  // [FIX-4] F8 — Consumo anormalmente baixo = provável conta auxiliar (NOVO — peso 8)
  // Saídas < 5% das entradas com movimentação > 10x salário mínimo = sinal forte
  const _indiceConsumoScore = totalCredits > 0 ? totalDebits / totalCredits : 1;
  const _movMensalScore = totalCredits / Math.max(1, Object.keys(monthly).filter(k => k !== 'unk').length);
  if (_indiceConsumoScore < 0.05 && _movMensalScore > 14120) { // 10x SM 2024
    score += 8;
    fatores.push({
      peso: 8,
      motivo: `Saídas representam apenas ${Math.round(_indiceConsumoScore * 100)}% das entradas — padrão atípico que pode indicar uso de conta auxiliar não analisada`
    });
  }

  score = Math.min(100, Math.max(0, Math.round(score)));

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

  return {
    bank, totalTxns: txns.length, creditCount: credits.length,
    totalCredits, totalDebits, pixTotal, especieTotal, formalTotal, comercialTotal,
    suspCount: suspicious.length, attCount: attention.length,
    monthsOverLimit, months: Object.keys(monthly).length, score, confidence, numEvidencias,
    classified, fatores, recorrentes, comercialOculta,
    anomalias, mediaHistorica, pico,
    circularidade, splitPix,
    internos,
    quarterly, perfil,
    mesCritico: perfil.mesCritico,
    indiceEspecie: especieRatio,
    indiceConsumo: totalCredits > 0 ? totalDebits / totalCredits : 0,
    // P6: qualidade do parsing
    parserConfidence: Math.round(parserConfidence * 100) / 100,
    txnsValidas: txnsValidas.length,
    txnsDescartadas,
    // Schema canonico
    tipoAnalise: 'indicador_compatibilidade_fiscal',
    versaoEngine: 'v4.0',
    rendaDeclarada: rendaDeclarada || 0,
    mesesAnalisados: Object.keys(monthly).filter(k => k !== 'unk').length,
  };
}

// ── Consolidação multi-extrato com explicação causal ──────────
function eConsolidate(results) {
  // Deduplicação cruzada: remove transações idênticas que aparecem em múltiplos extratos
  // (ex: mesma TED exportada de dois bancos diferentes, ou CSV + OFX do mesmo banco)
  const allRaw  = results.flatMap(r => r.classified);
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
  const totalMOL       = results.reduce((a, r) => a + r.monthsOverLimit, 0);

  // Score consolidado ponderado por volume
  const totalVol = results.reduce((a, r) => a + r.totalCredits, 0);
  let score = totalVol > 0
    ? results.reduce((a, r) => a + r.score * (r.totalCredits / totalVol), 0)
    : results.reduce((a, r) => a + r.score, 0) / results.length;

  // Bônus se múltiplos extratos com score alto
  if (results.filter(r => r.score > 55).length >= 2) score = Math.min(100, score + 10);
  score = Math.round(score);

  // Todos os fatores de todos os extratos
  const todosFatores = results.flatMap(r => r.fatores);
  const todasComerciais = results.flatMap(r => r.comercialOculta);
  const totalRecorrentes = results.reduce((a, r) => a + r.recorrentes.length, 0);

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
      text: `Nenhum crédito de alto risco encontrado nos ${results.length} extrato(s) analisados.`
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
function sanitize(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ── UI extrato ──
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
  const allowedExt = ['pdf','csv','ofx','txt','xlsx'];
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
        const text=await eParsePDF(f.content);
        txns=eParsePDFText(text);
        if(txns.length===0){eShowErr(`Não foi possível extrair de "${f.name}". Tente CSV ou OFX.`);continue;}
        // Para PDF, atualiza banco real após extração do texto
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
      if(txns.length===0){eShowErr(`Nenhuma transação em "${f.name}".`);continue;}
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
    const r=eAnalyzeSingle(deduplicateTxns(g.txns),bankLabel,window._rendaDeclaradaMensal||0);
    if(r) results.push(r);
  }

  if(results.length===0){eSetProgress(0,'Erro — nenhum extrato processado');document.getElementById('btnGo').classList.add('on');return;}
  eSetProgress(95,'Consolidando...');
  await new Promise(r=>setTimeout(r,300));
  const consolidated=eConsolidate(results);
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

  // Preenche preview com dados REAIS
  eRenderPreview(consolidated, results);

  s3.scrollIntoView({behavior:'smooth',block:'start'});
}


// ── Renderiza prévia real no paywallBlock ──────────────────────────
function eRenderPreview(c, sources) {
  // Mostra preview real, esconde placeholder
  document.getElementById('previewReal').style.display = 'block';
  document.getElementById('previewPlaceholder').style.display = 'none';

  // Score e nível
  let emoji, level, color;
  if (c.score <= 20)      { emoji='🟢'; level='BAIXO RISCO';   color='#00d96e'; }
  else if (c.score <= 45) { emoji='🟡'; level='ATENÇÃO';       color='#f5a623'; }
  else if (c.score <= 70) { emoji='🟠'; level='RISCO ELEVADO'; color='#f97316'; }
  else                    { emoji='🔴'; level='ATENÇÃO ELEVADA'; color='#f04f60'; }

  document.getElementById('pvEmoji').textContent = emoji;
  document.getElementById('pvLevel').textContent = level;
  document.getElementById('pvLevel').style.color = color;
  document.getElementById('pvScore').textContent = c.score + '%';
  document.getElementById('pvScore').style.color = color;
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
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Total créditos</div>
      <div style="font-family:Manrope,sans-serif;font-size:16px;font-weight:800;color:var(--green)">${fmtBRL(c.totalCredits)}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${c.creditCount} entradas</div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Suspeitos</div>
      <div style="font-family:Manrope,sans-serif;font-size:16px;font-weight:800;color:${c.suspCount>0?'var(--red)':'var(--green)'}">${c.suspCount}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">transações de risco</div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Pix recebidos</div>
      <div style="font-family:Manrope,sans-serif;font-size:16px;font-weight:800;color:${pixPct>=50?'var(--red)':pixPct>=30?'var(--yellow)':'var(--text)'}">${pixPct}%</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">das entradas</div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Índice consumo</div>
      <div style="font-family:Manrope,sans-serif;font-size:16px;font-weight:800;color:${icConsumo>=120?'var(--red)':icConsumo>=90?'var(--yellow)':'var(--green)'}">${icConsumo}%</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">saídas/entradas</div>
    </div>`;

  // Primeiros 2 alertas REAIS visíveis
  const alertsVisiveis = c.alerts.slice(0, 2);
  const alertsBloqueados = c.alerts.slice(2);
  document.getElementById('pvLockedCount').textContent = alertsBloqueados.length;

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
    return `<div class="pal ${cls}">
      <span class="pal-ico">${a.icon}</span>
      <div><strong>${sanitize(a.title||'')}</strong><br>
      <span style="font-size:12px;opacity:0.85">${sanitize(a.text||'')}</span></div>
    </div>`;
  }).join('');
}

function eUnlockResult(){
  document.getElementById('paywallBlock').style.display='none';
  document.getElementById('realResultBlock').style.display='block';
  // Scroll suave até o resultado
  setTimeout(() => document.getElementById('realResultBlock').scrollIntoView({behavior:'smooth',block:'start'}), 100);
  const c=_eConsolidated,sources=_eSources;
  if(!c||!sources)return;
  let emoji,level,color;
  if(c.score<=20){emoji='🟢';level='BAIXO RISCO';color='#00d96e';}
  else if(c.score<=45){emoji='🟡';level='ATENÇÃO';color='#f5a623';}
  else if(c.score<=70){emoji='🟠';level='NÍVEL DE ATENÇÃO';color='#f97316';}
  else{emoji='🔴';level='REQUER ANÁLISE';color='#f04f60';}
  document.getElementById('ovEmoji').textContent=emoji;
  document.getElementById('ovLevel').textContent=level;
  document.getElementById('ovLevel').style.color=color;
  document.getElementById('ovSub').textContent=`${sources.length} extrato(s) · ${c.totalTxns} transações · Motor fiscal v3`;
  document.getElementById('pScoreVal').textContent=c.score+'%';
  document.getElementById('pScoreVal').style.color=color;
  document.getElementById('pBarFill').style.background=color;
  setTimeout(()=>{document.getElementById('pBarFill').style.width=c.score+'%';},200);

  // Índices do motor v2
  const icConsumo=Math.round((c.indiceConsumo||0)*100);
  const icEspecie=Math.round((c.indiceEspecie||0)*100);
  const pixPct=c.totalCredits>0?Math.round(c.pixTotal/c.totalCredits*100):0;
  document.getElementById('pStatsGrid').innerHTML=`
    <div class="p-stat"><div class="p-sl">Total créditos</div><div class="p-sv" style="color:var(--green)">${fmtBRL(c.totalCredits)}</div><div class="p-sn">${c.creditCount} entradas</div></div>
    <div class="p-stat"><div class="p-sl">Pix (% das entradas)</div><div class="p-sv" style="color:${pixPct>=50?'var(--red)':pixPct>=30?'var(--yellow)':'var(--text)'}">${fmtBRL(c.pixTotal)}</div><div class="p-sn">${pixPct}% das entradas</div></div>
    <div class="p-stat"><div class="p-sl">Índice de consumo</div><div class="p-sv" style="color:${icConsumo>=120?'var(--red)':icConsumo>=90?'var(--yellow)':'var(--green)'}">${icConsumo}%</div><div class="p-sn">saídas/entradas</div></div>
    <div class="p-stat"><div class="p-sl">Espécie</div><div class="p-sv" style="color:${icEspecie>=20?'var(--red)':icEspecie>=10?'var(--yellow)':'var(--green)'}">${icEspecie}%</div><div class="p-sn">das entradas</div></div>
    <div class="p-stat"><div class="p-sl">Para revisão</div><div class="p-sv" style="color:${c.suspCount>0?'var(--red)':'var(--green)'}">${c.suspCount}</div><div class="p-sn">alto risco</div></div>
    <div class="p-stat"><div class="p-sl">Padrões recorrentes</div><div class="p-sv" style="color:${c.recorrentes>3?'var(--yellow)':'var(--text)'}">${c.recorrentes}</div><div class="p-sn">detectados</div></div>`;

  document.getElementById('srcList').innerHTML=sources.map((r,i)=>`
    <div class="src-item"><div class="src-dot" style="background:${SRC_COLORS[i%SRC_COLORS.length]}"></div>
    <span class="src-bank">${sanitize(r.bank)}</span><span class="src-txns">${sanitize(String(r.totalTxns))} transações · ${sanitize(String(r.months))} mês(es)</span>
    <span class="src-val">${fmtBRL(r.totalCredits)}</span>
    <span style="font-size:10px;font-family:Manrope,sans-serif;font-weight:700;padding:2px 7px;border-radius:4px;background:${r.score<=20?'rgba(0,217,110,0.1)':r.score<=45?'rgba(245,166,35,0.1)':r.score<=70?'rgba(249,115,22,0.1)':'rgba(240,79,96,0.1)'};color:${r.score<=20?'var(--green)':r.score<=45?'var(--yellow)':r.score<=70?'#f97316':'var(--red)'}">${sanitize(String(r.score))}%</span></div>`).join('');

  document.getElementById('pAlertList').innerHTML=c.alerts.map(a=>`
    <div class="pal ${a.type==='red'?'p-red':a.type==='yellow'?'p-yel':a.type==='green'?'p-grn':'p-blu'}">
    <span class="pal-ico">${a.icon}</span><div><strong>${sanitize(a.title||'')}</strong><br><span style="font-size:12px;opacity:0.85">${sanitize(a.text||'')}</span></div></div>`).join('');

  const bankTabsEl = document.getElementById('bankTabs');
  bankTabsEl.innerHTML = '';
  ['all', ...sources.map(r => r.bank)].forEach((b, i) => {
    const btn = document.createElement('button');
    btn.className = 'btab' + (b === 'all' ? ' on' : '');
    btn.textContent = b === 'all' ? 'Todos' : b;
    btn.onclick = () => eSwitchBank(b);
    bankTabsEl.appendChild(btn);
  });
  eActiveBankTab='all';
  document.getElementById('pDbgPre').textContent=`Motor: v4.0\nExtratos: ${sources.length}\nTotal txns: ${c.totalTxns}\nScore: ${c.score}%\nÍndice consumo: ${Math.round((c.indiceConsumo||0)*100)}%\nÍndice espécie: ${Math.round((c.indiceEspecie||0)*100)}%\nPadrões recorrentes: ${c.recorrentes}\nAtividade comercial oculta: ${c.comercialOculta}\n`+sources.map(r=>`[${r.bank}] ${r.totalTxns} txns · score ${r.score}% · fatores: ${(r.fatores||[]).map(f=>f.motivo).join(', ')}`).join('\n');
  eRenderTxns('all');
}

function eSwitchBank(bank){
  eActiveBankTab=bank;
  document.querySelectorAll('.btab').forEach(b=>b.classList.toggle('on',b.textContent.trim()===(bank==='all'?'Todos':bank)));
  const currentFilter=document.getElementById('pfRisk').classList.contains('on')?'risk':'all';
  eRenderTxns(currentFilter);
}
function eRenderTxns(filter){
  let list=eActiveBankTab==='all'?[...eAllTxns]:eAllTxns.filter(t=>t.bank===eActiveBankTab);
  if(filter==='risk')list=list.filter(t=>t.risk!=='normal');
  list.sort((a,b)=>{const o={suspicious:0,attention:1,normal:2};if(o[a.risk]!==o[b.risk])return o[a.risk]-o[b.risk];return b.value-a.value;});
  document.getElementById('pTxnList').innerHTML=list.map(t=>{
    const dc=t.risk==='suspicious'?'pdr':t.risk==='attention'?'pdy':t.value>0?'pdg':'pdm';
    const cls=t.risk==='suspicious'?' s':t.risk==='attention'?' a':'';
    return`<div class="pti${cls}"><div class="pdot ${dc}"></div><div class="ptinfo"><div class="ptd">${sanitize(t.desc||'—')}</div><div class="ptt">${fmtDate(t.date)}</div></div><div class="ptv ${t.value>=0?'p':'n'}">${fmtBRL(t.value)}</div>${t.flag?`<span class="ptf ${t.risk==='suspicious'?'r':'y'}">${t.flag}</span>`:''}<span class="ptbank">${sanitize(t.bank||'')} </span></div>`;
  }).join('')||'<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px">Nenhuma transação</div>';
}
function eFilt(f){document.getElementById('pfAll').classList.toggle('on',f==='all');document.getElementById('pfRisk').classList.toggle('on',f==='risk');eRenderTxns(f);}
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
    doc.text('Score de Coerência Fiscal · Motor v3 · ' + sources.length + ' fonte(s)', barX, Y + 28);
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


function eResetAll(){
  eFiles=[];eAllTxns=[];eActiveBankTab='all';
  _eConsolidated=null;_eSources=null;
  window._rendaDeclaradaMensal=0;
  const _ri=document.getElementById('rendaDeclaradaInput');if(_ri)_ri.value='';
  document.getElementById('fileList').innerHTML='';
  document.getElementById('limitBar').style.display='none';
  document.getElementById('actBar').style.display='none';
  document.getElementById('extStep3').style.display='none';
  document.getElementById('pFillExt').style.width='0%';
  document.getElementById('dzIco').textContent='📂';
  document.getElementById('dzTtl').textContent='Arraste os extratos ou clique para selecionar';
  document.getElementById('paywallBlock').style.display='block';
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


