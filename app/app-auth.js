// ═══════════════════════════════════════════════
// app-auth.js — Guardião Fiscal
// Módulo de autenticação e checkout — carregado sob demanda
// Supabase + Login + Cadastro + Mercado Pago
// ═══════════════════════════════════════════════

async function openCheckout(plan) {
  // Se usuário já tem plano ativo — verifica antes de disparar Pixel
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

  // [FIX-PIXEL] Pixel só dispara aqui — depois de confirmar que não tem plano ativo
  if (typeof window.trackFb === 'function') {
    window.trackFb('track', 'InitiateCheckout', { content_name: 'plano_' + plan, currency: 'BRL', value: plan === 'pro' ? 29.90 : 19.90 }, { eventID: 'ic_' + Date.now() });
    window.trackFb('trackCustom', 'CheckoutStarted', { plan: plan }, { eventID: 'cs_' + Date.now() });
  }
  if(typeof clarity==='function') clarity('event','CheckoutStarted');

  if (PRO_FREE_MODE && plan !== 'avulso') {
    if (_eConsolidated) {
      closeCheckoutDirect();
      eUnlockResult();
    } else {
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

// ── MERCADO PAGO ─────────────────────────────────────────────
var MP_PUBLIC_KEY = 'APP_USR-60e9c4f7-757b-48da-a367-8b3785a4cf72';
var _mpInstance = null;
var _mpBrick    = null;
// [FIX-TIMEOUT] Referência do setTimeout do checkout para cancelamento
var _checkoutStepTimer = null;

function getMpInstance() {
  if (!_mpInstance) _mpInstance = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
  return _mpInstance;
}

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
    // Checkout Pro: não inicializa Brick aqui
  } else {
    paneCartao.style.display = 'none';
    paneOutros.style.display = 'block';
    tabC.style.background = 'transparent';
    tabC.style.color      = 'var(--muted)';
    tabO.style.background = 'var(--surface)';
    tabO.style.color      = 'var(--text)';
  }
}

async function initMpBrick() {
  const container = document.getElementById('mpBrickContainer');
  if (!container) return;

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

  if (typeof MercadoPago === 'undefined') {
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

    if (typeof MercadoPago === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.onload  = () => resolve();
        script.onerror = (e) => { reject(new Error('Não foi possível carregar o SDK do Mercado Pago. Tente desativar extensões do navegador (ex: ad blocker) e recarregue a página.')); };
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

    const brickTimeout = setTimeout(() => {
      if (container && container.innerHTML.includes('Carregando')) {
        showBrickFallback(container, 'Tempo limite excedido ao carregar o formulário.');
      }
    }, 15000);

    _mpBrick = await bricksBuilder.create('cardPayment', 'mpBrickContainer', {
      initialization: {
        amount: amountVal,
        payer: { email: _currentUser?.email || '' },
      },
      customization: {
        visual: { style: { theme: 'dark' }, hideFormTitle: true, hidePaymentButton: false },
        paymentMethods: { maxInstallments: currentPlan === 'pro' ? 1 : 3 },
      },
      callbacks: {
        onReady: () => { clearTimeout(brickTimeout); },
        onSubmit: async (cardData) => { clearTimeout(brickTimeout); await processCardPayment(cardData); },
        onError: (err) => {
          clearTimeout(brickTimeout);
          const cause = err?.cause?.[0]?.description || err?.message || JSON.stringify(err);
          showBrickFallback(container, cause);
        },
      },
    });
  } catch (e) {
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

function _initAvulsoCheckoutProUI() {
  const container = document.getElementById('mpBrickContainer');
  if (!container) return;
  if (_mpBrick) { try { _mpBrick.unmount(); } catch(e) {} _mpBrick = null; }

  container.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:14px;padding:22px 20px;text-align:center">
      <div style="font-size:13px;color:var(--muted2);line-height:1.9;margin-bottom:18px">
        💳 <strong style="color:var(--text)">Cartão, Pix ou Boleto</strong> — pagamento único<br>
        <span style="font-size:11px;color:var(--muted)">Você será redirecionado para finalizar o pagamento no Mercado Pago</span>
      </div>
      <div id="mpAvulsoErr" style="display:none;color:var(--red);font-size:12px;margin-bottom:12px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;padding:10px"></div>
      <button class="btn-pay" id="btnAvulsoPay" onclick="startAvulsoCheckoutPro()" style="margin-bottom:0">
        <span id="btnAvulsoTxt">Pagar R$19,90 →</span>
      </button>
      <div style="font-size:11px;color:var(--muted);margin-top:10px">🔒 Pagamento processado pelo Mercado Pago · PCI DSS</div>
    </div>`;
}

async function startAvulsoCheckoutPro() {
  const btn = document.getElementById('btnAvulsoTxt');
  const errEl = document.getElementById('mpAvulsoErr');
  if (errEl) errEl.style.display = 'none';
  if (btn) btn.textContent = 'Gerando link de pagamento...';
  document.getElementById('btnAvulsoPay').disabled = true;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const newWin = !isMobile ? window.open('', '_blank') : null;

  try {
    if (!sb) throw new Error('Serviço indisponível. Recarregue a página.');
    const { data: { session }, error: sessErr } = await sb.auth.getSession();
    if (sessErr || !session) throw new Error('Sessão expirada. Faça login novamente.');

    const res = await fetch(`${SUPA_URL}/functions/v1/create-mp-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan: 'avulso' }),
    });

    if (!res.ok) {
      let errMsg = `Erro ${res.status}`;
      try { const j = await res.json(); errMsg = j.error || errMsg; } catch(_) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    const url = data.init_point || data.sandbox_url;
    const _urlOk = url && (url.startsWith('https://www.mercadopago.com') || url.startsWith('https://mercadopago.com') || url.startsWith('https://sandbox.mercadopago.com'));
    if (!_urlOk) throw new Error('Link de pagamento inválido. Tente novamente.');

    if (newWin) {
      newWin.location.href = url;
      if (btn) btn.textContent = 'Prosseguir no Mercado Pago →';
      document.getElementById('btnAvulsoPay').disabled = false;
    } else {
      if (btn) btn.textContent = 'Prosseguir no Mercado Pago →';
      const btnEl = document.getElementById('btnAvulsoPay');
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
    if (btn) btn.textContent = 'Pagar R$19,90 →';
    document.getElementById('btnAvulsoPay').disabled = false;
  }
}

async function startProSubscription() {
  const btn = document.getElementById('btnProSubTxt');
  const errEl = document.getElementById('mpProErr');
  if (errEl) errEl.style.display = 'none';
  if (btn) btn.textContent = 'Gerando link da assinatura...';
  document.getElementById('btnProSubscribe').disabled = true;

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

    const res = await fetch(`${SUPA_URL}/functions/v1/create-mp-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan: currentPlan, paymentMethod: 'card', cardData }),
    });

    if (!res.ok) {
      let errMsg = `Erro ${res.status}`;
      try { const j = await res.json(); errMsg = j.error || errMsg; } catch(_) {}
      throw new Error(errMsg);
    }

    const data = await res.json();

    if (data.status === 'approved') {
      if (_mpBrick) { try { _mpBrick.unmount(); } catch(e) {} _mpBrick = null; }
      showCheckoutSuccess();
    } else if (data.status === 'in_process' || data.status === 'pending') {
      if (_mpBrick) { try { _mpBrick.unmount(); } catch(e) {} _mpBrick = null; }
      document.getElementById('stepPay').querySelector('.modal-title').textContent = 'Pagamento em análise';
      document.getElementById('stepPay').querySelector('.modal-sub').textContent = 'Seu pagamento está sendo processado. Assim que aprovado você receberá acesso por e-mail.';
    } else if (data.init_point) {
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
  if(typeof fbq==='function' && window.PIXEL_ATIVO) {
    const valor = currentPlan==='pro' ? 29.90 : (PRICES?.avulso?.value ?? 19.90);
    fbq('track','Purchase',{ value: valor, currency:'BRL', content_name:'plano_'+currentPlan },{ eventID:'purchase_'+Date.now().toString() });
  }
  if (_eConsolidated) setTimeout(() => { closeCheckoutDirect(); eUnlockResult(); }, 2000);
}

function closeCheckoutDirect() {
  // [FIX-TIMEOUT] Cancela o timer do setCheckoutStep para evitar init do Brick em modal fechado
  if (_checkoutStepTimer) { clearTimeout(_checkoutStepTimer); _checkoutStepTimer = null; }
  if (_mpBrick) { try { _mpBrick.unmount(); } catch(e) {} _mpBrick = null; }
  const el = document.getElementById('checkoutOverlay');
  if (el) el.classList.remove('show');
  document.body.style.overflow = '';
}

function setCheckoutStep(n) {
  ['stepAccount','stepPay','stepSuccess'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', i + 1 === n);
  });
  ['csn1','csn2','csn3'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', i + 1 <= n);
  });
  if (n === 2) {
    // [FIX-TIMEOUT] Guarda referência para cancelamento em closeCheckoutDirect
    _checkoutStepTimer = setTimeout(() => {
      _checkoutStepTimer = null;
      switchPayTab('cartao');
      const tabOutros = document.getElementById('tabOutros');
      const payPaneOutros = document.getElementById('payPaneOutros');
      if (currentPlan === 'pro') {
        if (tabOutros) tabOutros.style.display = 'none';
        if (payPaneOutros) payPaneOutros.style.display = 'none';
        _initProSubscriptionUI();
      } else {
        if (tabOutros) tabOutros.style.display = 'none';
        if (payPaneOutros) payPaneOutros.style.display = 'none';
        _initAvulsoCheckoutProUI();
      }
    }, 100);
  }
}

async function goToMercadoPago() {
  const btn = document.getElementById('btnMpTxt');
  const errEl = document.getElementById('mpPayErrOutros');
  if (errEl) errEl.style.display = 'none';
  if (btn) btn.textContent = 'Gerando link de pagamento...';
  document.getElementById('btnMpPay').disabled = true;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const newWin = (!isMobile) ? window.open('', '_blank') : null;

  try {
    if (!sb) throw new Error('Serviço de autenticação indisponível. Recarregue a página.');
    const { data: { session }, error: sessErr } = await sb.auth.getSession();
    if (sessErr) throw new Error('Erro de autenticação. Faça login novamente.');
    if (!session) throw new Error('Sessão expirada. Faça login novamente.');

    let res;
    try {
      res = await fetch(`${SUPA_URL}/functions/v1/create-mp-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan: currentPlan }),
      });
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

    if (newWin) newWin.close();
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

async function handleMpReturn() {
  const params = new URLSearchParams(window.location.search);
  const mp = params.get('mp');
  if (!mp) return;

  try { history.replaceState({}, '', window.location.pathname); } catch(e) {}

  if (mp === 'success') {
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

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
}

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

  if (!_currentUser) {
    const btn = document.querySelector('#stepAccount .btn-pay');
    if (btn) btn.textContent = 'Criando conta...';
    if (!sb) { shake('coEmail'); return; }

    const { error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome: name } } });

    if (btn) btn.textContent = 'Continuar para pagamento →';

    if (error) {
      // [FIX-AUTH] "already registered" — tentar login com a senha fornecida
      if (error.message.includes('already registered')) {
        const { error: loginErr } = await sb.auth.signInWithPassword({ email, password: senha });
        if (loginErr) {
          // Senha diferente — pedir para fazer login
          const errEl = document.querySelector('#stepAccount .auth-err');
          if (errEl) { errEl.textContent = 'Este e-mail já está cadastrado. Use a senha correta ou clique em "Entrar com e-mail e senha".'; errEl.style.display = 'block'; }
          shake('coEmail');
          return;
        }
        // Login bem-sucedido — continua para step 2
      } else {
        shake('coEmail');
        return;
      }
    }
  }

  setCheckoutStep(2);
  document.getElementById('checkoutModal').scrollTop = 0;
}

function goToAccount() {
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

function closeCheckout(e) {
  if (e.target === document.getElementById('checkoutOverlay')) closeCheckoutDirect();
}

// ╔══════════════════════════════════════════════════╗
// ║         MÓDULO DE SEGURANÇA — GUARDIÃO FISCAL   ║
// ╚══════════════════════════════════════════════════╝

var _authAttempts = {};
function authRateLimit(email) {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  if (!_authAttempts[key]) _authAttempts[key] = { count: 0, first: now, blocked: false };
  const a = _authAttempts[key];
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

async function validatePDFMagicBytes(buffer) {
  const bytes = new Uint8Array(buffer.slice(0, 5));
  const magic = String.fromCharCode(...bytes);
  if (!magic.startsWith('%PDF-')) throw new Error('Arquivo corrompido ou não é um PDF real.');
  return true;
}

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
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]{0,200}>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/(^|[\n,\t])([=+\-@])/g, '$1\'$2');
}

var MAX_TEXT_CHARS = 2_000_000;

function validateFileName(name) {
  if (!name || typeof name !== 'string') return false;
  if (/[\x00-\x1F\x7F]/.test(name)) return false;
  if (/[\/\\:*?"<>|]/.test(name)) return false;
  if (name.startsWith('.')) return false;
  if (name.length > 200) return false;
  return true;
}

var AUTH_INPUT_LIMITS = { email: 254, nome: 80, senha: 128 };
function capAuthInput(value, type) {
  return String(value).slice(0, AUTH_INPUT_LIMITS[type] || 128);
}

var SUPA_URL  = 'https://nnhbxyuggmcemqwzdxbg.supabase.co';
var SUPA_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaGJ4eXVnZ21jZW1xd3pkeGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTc1NDQsImV4cCI6MjA5NDMzMzU0NH0.0KMETdyHYs0NR8qQKp2KZeSnp5Al58JVDrSGDJEG_WQ';

var sb = null;
var _currentUser = null;

function _initSupabase() {
  try {
    if (typeof supabase === 'undefined') { return; }
    const { createClient } = supabase;
    sb = createClient(SUPA_URL, SUPA_KEY);
  } catch(e) {
    // Silencioso em produção
  }
}
setUser(null);

async function _initSession() {
  if (!sb) return;
  try {
    // [FIX-TIMEOUT] getSession com timeout de 8s — evita travamento em 4G lento
    const sessionResult = await Promise.race([
      sb.auth.getSession(),
      new Promise(resolve => setTimeout(() => resolve({ data: { session: null }, error: null }), 8000))
    ]);
    const session = sessionResult?.data?.session;
    if (session) setUser(session.user);
    sb.auth.onAuthStateChange((_event, session) => {
      setUser(session ? session.user : null);
      if (session) closeAllOverlays();
    });
    handleMpReturn();
  } catch(e) {
    // Silencioso em produção
  }
}

function _bootSupabase() {
  _initSupabase();
  _initSession();
}

if (typeof supabase !== 'undefined') {
  _bootSupabase();
} else {
  window._supabaseQueue = window._supabaseQueue || [];
  window._supabaseQueue.push(_bootSupabase);
}

function setUser(user) {
  _currentUser = user;
  const area = document.getElementById('navAuthArea');

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
        if ((plano === 'pro' || plano === 'avulso') && !isExpired) {
          _currentUser._plano = plano;
          if (_eConsolidated) eUnlockResult();
        }
      })
      .catch(() => {});
  }
  if (user) {
    const rawName = user.user_metadata?.nome || user.email.split('@')[0];
    const firstName = rawName.split(' ')[0];
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
    if (window.innerWidth >= 480) nameEl.style.display = 'block';
    if (!window._navResizeListenerSet) {
      window._navResizeListenerSet = true;
      window.addEventListener('resize', () => {
        const el = document.getElementById('navUserName');
        if (el) el.style.display = window.innerWidth >= 480 ? 'block' : 'none';
      }, { passive: true });
    }
    autoSkipExtStep1(user.email);
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
    const da = document.getElementById('drawerAuthArea');
    if (da) da.innerHTML = '<button class="nav-btn-login" style="width:100%;text-align:center;padding:12px" onclick="openLogin();closeDrawer()">Entrar</button>';
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
    s1.style.display = 'none';
    const s2 = document.getElementById('extStep2');
    if (s2) { s2.style.opacity = '1'; s2.style.pointerEvents = 'auto'; }
    const s2num = document.getElementById('s2num');
    if (s2num) { s2num.classList.remove('locked'); }
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

var _checkoutPendingPlan = null;
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
  setTimeout(() => closeLoginDirect(), 2000);
}

var _extTab = 'cad';

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

var _authRL = { count: 0, resetAt: 0 };
function _authRateOk() {
  const now = Date.now();
  if (now > _authRL.resetAt) { _authRL.count = 0; _authRL.resetAt = now + 120000; }
  if (_authRL.count >= 5) return false;
  _authRL.count++;
  return true;
}

async function extStep1Done() {
  if (_currentUser) { autoSkipExtStep1(_currentUser.email); return; }
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

// ===== SIMULADOR / QUIZ =====
var PROFILES = [
  {
    id: 'freelancer', nome: 'Freelancer Recorrente',
    desc: 'Autônomo · Pix de clientes todo mês · sem nota fiscal sistemática', icon: '💻',
    score: 55, nivel: 'elevado', gaugePct: 55,
    alertsData: [
      { cls:'alert-red', icon:'🚨', title:'Pix recorrentes sem nota fiscal', text:'Bancos reportam à Receita via e-Financeira toda movimentação mensal. Pix frequentes sem justificativa são o principal gatilho de malha fina em autônomos.' },
      { cls:'alert-red', icon:'🚨', title:'Renda declarada vs. recebida', text:'A Receita já possui os dados bancários antes de você declarar. Qualquer entrada não justificada é cruzada automaticamente.' },
    ],
    lockedData: [
      { label:'Volume Pix × renda declarada', val:'🔒 crítico' },
      { label:'Padrão de recorrência mensal', val:'🔒 crítico' },
      { label:'Anomalia temporal detectada', val:'🔒 crítico' },
    ],
    ctaCopy: 'Ver exatamente onde está o risco no seu extrato →', perfilTag: 'autonomo',
  },
  {
    id: 'mei', nome: 'MEI Ativo',
    desc: 'MEI · clientes fixos · mistura de conta PJ e pessoal', icon: '🏪',
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
    ctaCopy: 'Ver quais fatores a Receita está cruzando →', perfilTag: 'mei',
  },
  {
    id: 'socio', nome: 'Sócio na Conta Pessoal',
    desc: 'Empresário · recebe pró-labore ou repasse na conta pessoal', icon: '🏢',
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
    ctaCopy: 'Ver exatamente onde está o risco no seu extrato →', perfilTag: 'empresario',
  },
  {
    id: 'clt_extra', nome: 'CLT com Extra',
    desc: 'CLT formal · freela eventual · Pix esporádico de terceiros', icon: '💼',
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
    ctaCopy: 'Confirmar se os extras estão todos declarados →', perfilTag: 'clt',
  },
  {
    id: 'investidor', nome: 'Investidor PF',
    desc: 'Renda variável · FII · dividendos · sem carnê-leão organizado', icon: '📈',
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
    ctaCopy: 'Ver quais fatores a Receita está cruzando →', perfilTag: 'investidor',
  },
];

var C_BAIXO    = '#7CFF4F';
var C_ATENCAO  = '#F5A623';
var C_MODERADO = '#f97316';
var C_ELEVADO  = '#f04f60';
var C_CRITICO  = '#FF4D4F';
var CORES = { baixo: C_BAIXO, moderado: C_MODERADO, elevado: C_ELEVADO, critico: C_CRITICO };

// [FIX-CLS #3] renderProfileCards preenche divs vazias no HTML (qBody/mQBody)
// O HTML foi esvaziado para eliminar o CLS causado pela sobreescrita de conteúdo inline
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

  if (typeof fbq === 'function' && window.PIXEL_ATIVO) {
    fbq('trackCustom', 'ProfileSelected', { perfil: id, risco: p.nivel }, { eventID: 'ps_' + Date.now() });
  }

  const isDesktop = bodyId === 'qBody';
  const heroId    = isDesktop ? 'resultHero'   : 'mResultHero';
  const alertsId  = isDesktop ? 'resultAlerts' : 'mResultAlerts';
  const panelQ    = isDesktop ? 'questionPanel' : 'mQuestionPanel';
  const panelR    = isDesktop ? 'resultPanel'   : 'mResultPanel';

  const body = document.getElementById(bodyId);
  if (body) body.innerHTML = `
    <div style="text-align:center;padding:32px 0;color:var(--muted2);font-size:13px;font-weight:600;letter-spacing:0.5px">
      Cruzando com critérios do e-Financeira…
    </div>`;

  setTimeout(() => {
    if (isDesktop) {
      const demo = document.getElementById('liveDetectDemo');
      if (demo) demo.style.visibility = 'hidden';
    }
    // 1. Popula conteúdo com painéis ainda invisíveis
    revealResult(p, heroId, alertsId, isDesktop);

    if (!isDesktop) {
      // [FIX-CLS v2] Reserva altura ANTES de trocar visibilidade — zero layout shift
      // rAF1: quizWrap ainda exibe mQuestionPanel (visível) + mResultPanel (invisível mas populado)
      //       scrollHeight captura altura total real — visibility:hidden não zera o pai
      // rAF2: troca visibilidade com espaço já reservado — browser não precisa reajustar layout
      requestAnimationFrame(() => {
        const qw = document.getElementById('quizWrap');
        if (qw) qw.style.minHeight = qw.scrollHeight + 'px';
        requestAnimationFrame(() => {
          document.getElementById(panelQ).style.visibility = 'hidden';
          document.getElementById(panelR).style.visibility = 'visible';
          // [FIX-BUG2] Revela o botão junto com o resultado — estava sendo ocultado e nunca revelado
          const btn = document.getElementById('quizExtratoBtn');
          if (btn) btn.style.visibility = 'visible';
        });
      });
    } else {
      requestAnimationFrame(() => {
        document.getElementById(panelQ).style.visibility = 'hidden';
        document.getElementById(panelR).style.visibility = 'visible';
      });
    }
  }, 0); // [FIX-INP] era 900ms — bloqueava resposta visual ao clique
}

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
  const URGENCIA = {
    critico:  { badge: '🚨 Risco crítico detectado', sub: 'Seu perfil ativa cruzamento automático no e-Financeira. Confirme os valores reais antes que a Receita notifique.', btnColor: '#FF4D4F', btnText: '#fff', btnLabel: 'Ver os valores exatos no meu extrato →', trust: '⚡ Análise em menos de 2 min · sem envio de dados' },
    elevado:  { badge: '⚠️ Atenção — risco elevado', sub: 'Identificamos padrões que a Receita prioriza no cruzamento. Veja quais transações específicas estão em risco.', btnColor: '#FF4D4F', btnText: '#fff', btnLabel: 'Ver quais transações estão em risco →', trust: '🔒 Extrato processado localmente · Nenhum dado sai do seu dispositivo' },
    moderado: { badge: '🟡 Sinais que merecem atenção', sub: 'Esses padrões podem gerar inconsistência com sua declaração. Vale confirmar antes da Receita fazer o cruzamento.', btnColor: '#7CFF4F', btnText: '#000', btnLabel: 'Confirmar se minha movimentação está compatível →', trust: '🔒 Análise 100% local · Gratuito para começar' },
    baixo:    { badge: '✅ Perfil com baixo risco', sub: 'Seu perfil não apresenta sinais críticos. Confirme com o extrato real para ter certeza antes da declaração.', btnColor: '#7CFF4F', btnText: '#000', btnLabel: 'Confirmar que está tudo certo no extrato →', trust: '🔒 Análise 100% local · Gratuito para começar' },
  };

  const color = CORES[p.nivel];
  const level = LABELS[p.nivel];
  const desc  = DESCS[p.nivel];
  const u     = URGENCIA[p.nivel] || URGENCIA.moderado;

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

  // [FIX-CLS] Renderiza TODO o conteúdo de uma vez — sem setTimeout escalonados
  // Animações de entrada via CSS (não causam CLS)
  const alertsHtml = p.alertsData.map((a, i) => `
    <div class="alert-item ${a.cls}" style="animation:_fadeUp 0.35s ease both;animation-delay:${i * 80}ms">
      <span class="alert-icon">${a.icon}</span>
      <span><strong style="font-weight:600;display:block;margin-bottom:2px">${sanitize(a.title)}</strong>${sanitize(a.text)}</span>
    </div>`).join('');

  const lockedHtml = p.lockedData.map(d => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;gap:8px;min-width:0">
      <span style="color:var(--muted2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.label}</span>
      <span style="font-family:var(--ff);font-weight:700;color:var(--red);flex-shrink:0">${d.val}</span>
    </div>`).join('');

  // Gauge HTML
  const rh = document.getElementById(heroId);
  if (rh) rh.innerHTML = `
    <div class="result-glow" style="background:${color}"></div>
    <div style="padding:${isDesktop ? '28px 28px 16px' : '28px 20px 16px'}">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:16px;text-align:center;font-family:var(--ff)">// score de coerência fiscal</div>
      <div style="display:flex;${isDesktop ? 'align-items:center;gap:24px' : 'flex-direction:column;align-items:center;gap:12px'}">
        <div style="${isDesktop ? 'flex-shrink:0;max-width:220px;overflow:hidden' : 'width:100%;max-width:240px'}">
          <svg width="${isDesktop ? '220' : '100%'}" viewBox="0 0 220 130" style="${isDesktop ? 'flex-shrink:0' : 'width:100%;max-width:240px'}">
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

  // Alertas + blurBlock + CTA — tudo de uma vez no alertsId
  const ra = document.getElementById(alertsId);
  if (!ra) return;
  ra.innerHTML = `
    ${alertsHtml}
    <div style="margin-top:8px;border-radius:14px;overflow:hidden;position:relative;box-sizing:border-box;width:100%">
      <div style="filter:blur(5px);user-select:none;pointer-events:none;background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:14px 16px;box-sizing:border-box">
        ${lockedHtml}
      </div>
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(17,24,39,0.2) 0%,rgba(17,24,39,0.92) 55%);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:16px">
        <div style="font-size:20px;margin-bottom:6px">🔒</div>
        <div style="font-family:var(--ff);font-size:13px;font-weight:700;color:var(--text);text-align:center;margin-bottom:4px">Detectamos ${p.lockedData.length} padrões no seu perfil</div>
        <div style="font-size:11px;color:var(--muted2);text-align:center;line-height:1.5">Confirme com seu extrato real para ver os detalhes exatos</div>
      </div>
    </div>
    <div style="margin-top:16px;box-sizing:border-box;width:100%;animation:_fadeUp 0.4s ease 0.2s both">
      <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:5px 12px;font-size:11px;font-weight:700;color:var(--text2);margin-bottom:10px;white-space:nowrap">${u.badge}</div>
      <div style="font-size:12px;color:var(--muted2);line-height:1.65;margin-bottom:14px;box-sizing:border-box;word-break:break-word">${u.sub}</div>
      <button onclick="showPage('extrato')" style="width:100%;padding:16px;background:${u.btnColor};border:none;border-radius:12px;color:${u.btnText};font-family:var(--ff);font-size:clamp(13px,3.5vw,15px);font-weight:800;cursor:pointer;transition:all 0.2s;letter-spacing:-0.01em;box-sizing:border-box;word-break:break-word;${(p.nivel==='critico'||p.nivel==='elevado') ? 'box-shadow:0 0 20px rgba(255,77,79,0.4)' : 'box-shadow:var(--glow-green)'}">
        ${u.btnLabel}
      </button>
      <div style="text-align:center;font-size:11px;color:var(--muted);margin-top:10px;line-height:1.6">${u.trust}</div>
    </div>`;

  // Anima gauge após render (só SVG/CSS — sem injeção de DOM)
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

  if (typeof fbq === 'function' && window.PIXEL_ATIVO) {
    fbq('trackCustom', 'QuizCompleted', { origem: isDesktop ? 'site_principal' : 'site_principal_mobile', risco: p.nivel, score: p.score }, { eventID: 'qc_' + Date.now() });
    fbq('track', 'Lead', { content_name: 'quiz_site_principal', content_category: p.nivel }, { eventID: 'lead_site_' + Date.now() });
  }
}

function restart() {
  document.getElementById('resultPanel').style.visibility = 'hidden';
  document.getElementById('questionPanel').style.visibility = 'visible';
  document.getElementById('resultHero').innerHTML = '';
  document.getElementById('resultAlerts').innerHTML = '';
  const demo = document.getElementById('liveDetectDemo');
  if (demo) demo.style.visibility = 'visible';
  renderProfileCards('qBody');
}

function mRestart() {
  document.getElementById('mResultPanel').style.visibility = 'hidden';
  document.getElementById('mQuestionPanel').style.visibility = 'visible';
  const btn = document.getElementById('quizExtratoBtn');
  if (btn) btn.style.visibility = 'visible';
  document.getElementById('mResultHero').innerHTML = '';
  document.getElementById('mResultAlerts').innerHTML = '';
  renderProfileCards('mQBody');
}

// [FIX-CLS #3] DOMContentLoaded: renderiza quiz nos divs vazios do HTML
// Não há mais dupla renderização — HTML está vazio, JS preenche uma única vez
document.addEventListener('DOMContentLoaded', function () {
  renderProfileCards('qBody');
  renderProfileCards('mQBody');
});

function openQuiz() {
  const current = document.querySelector('.page.active')?.id?.replace('page-', '');
  if (current !== 'home') {
    try { history.pushState({ page: 'home' }, '', '#home'); } catch(e) {}
    _applyPage('home');
  }
  switchSimTab('perguntas');
  if (typeof fbq === 'function' && window.PIXEL_ATIVO) fbq('trackCustom', 'QuizStarted', { origem: 'site_principal' }, { eventID: 'qs_' + Date.now() });
  // [FIX-BUG3] visibility em vez de display — consistente com o resto do código do quiz
  const rp = document.getElementById('resultPanel');
  const qp = document.getElementById('questionPanel');
  if (rp) rp.style.visibility = 'hidden';
  if (qp) qp.style.visibility = 'visible';
  renderProfileCards('qBody');
  setTimeout(() => {
    const isMobile = window.innerWidth < 1100;
    const target = isMobile
      ? document.getElementById('quizWrap')
      : document.querySelector('.sim-wrap');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

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
  // detectFeed já renderizado estaticamente no HTML — sem JS para evitar CLS
  window._stopDetectionFeed = () => {};
})();

document.addEventListener('DOMContentLoaded', function() {
  if (typeof fbq === 'function' && window.PIXEL_ATIVO) fbq('trackCustom', 'QuizStarted', { origem: 'site_principal' }, { eventID: 'qs_' + Date.now() });
  initProFreeMode();
  setTimeout(() => {
    const bar = document.getElementById('mockBar');
    if (bar) bar.style.width = '38%';
  }, 600);
  const hashPage = window.location.hash.replace('#', '');
  const validPages = ['home', 'extrato', 'planos', 'institucional'];
  if (hashPage && validPages.includes(hashPage)) {
    _applyPage(hashPage);
  }
  const activePage = document.querySelector('.page.active')?.id?.replace('page-', '') || 'home';
  try { history.replaceState({ page: activePage }, '', window.location.href); } catch(e) {}

  (function() {
    try {
      const p = new URLSearchParams(window.location.search);
      const perfil = p.get('perfil');
      const risco  = p.get('risco');
      const dor    = p.get('dor') || '';
      if (!perfil || !risco) return;
      const riscoLabel = { baixo: 'baixo risco identificado', moderado: 'atenção moderada identificada', elevado: 'risco elevado identificado', critico: 'risco crítico identificado' }[risco] || risco;
      const riscoColor = { baixo: '#7CFF4F', moderado: C_ATENCAO, elevado: C_ELEVADO, critico: 'var(--red)' }[risco] || '#7CFF4F';
      const perfilLabel = decodeURIComponent(perfil).replace(/,/g, ' + ');
      showPage('extrato');
      setTimeout(() => {
        const wrap = document.querySelector('#page-extrato .page-inner');
        if (!wrap) return;
        if (document.getElementById('quiz-welcome-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'quiz-welcome-banner';
        banner.style.cssText = 'display:flex;align-items:flex-start;gap:12px;padding:14px 16px;margin-bottom:20px;background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.18);border-radius:10px;font-size:13.5px;color:var(--text2);line-height:1.55;position:relative';
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
          <button onclick="this.closest('#quiz-welcome-banner').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:0;flex-shrink:0;line-height:1" aria-label="Fechar">×</button>
        `;
        wrap.insertBefore(banner, wrap.firstChild);
        setTimeout(() => { banner.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
        try {
          const emailParam = p.get('email');
          if (emailParam) {
            const tryFill = () => { const el = document.getElementById('coEmail'); if (el && !el.value) el.value = decodeURIComponent(emailParam); };
            tryFill();
            const observer = new MutationObserver(() => { tryFill(); });
            const overlay = document.getElementById('checkoutOverlay');
            if (overlay) observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
            setTimeout(() => observer.disconnect(), 120000);
          }
        } catch(e) {}
        try { history.replaceState({page: 'extrato'}, '', window.location.pathname + '#extrato'); } catch(e) {}
      }, 120);
    } catch(err) {}
  })();
});

// Boot Supabase quando módulo carrega
if (typeof _bootSupabase === 'function' && !window._supabaseBooted) {
  window._supabaseBooted = true;
  _bootSupabase();
}

// Expõe implementações para os stubs do app-core.js
window._openLoginImpl        = openLogin;
window._closeLoginImpl       = closeLogin;
window._closeLoginDirectImpl = closeLoginDirect;
window._openCheckoutImpl     = openCheckout;
window._closeCheckoutImpl    = closeCheckout;
window._closeCheckoutDirectImpl = closeCheckoutDirect;
window._doLoginImpl          = doLogin;
window._doCadastroImpl       = doCadastro;
window._doLogoutImpl         = doLogout;
window._goToPayImpl          = goToPay;
window._extStep1DoneImpl     = extStep1Done;
window._switchAuthTabImpl    = switchAuthTab;
window._extSwitchTabImpl     = extSwitchTab;
