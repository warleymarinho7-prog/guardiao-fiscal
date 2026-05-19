// checkout.js — openCheckout, Mercado Pago Bricks, fluxo de pagamento

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
