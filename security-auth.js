// security-auth.js — sanitize, validateMagicBytes, Supabase, login, cadastro

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
try {
  const { createClient } = supabase;
  sb = createClient(SUPA_URL, SUPA_KEY);
} catch(e) {
  console.warn('[GuardiaoFiscal] Supabase não disponível:', e.message);
}

// Popula navAuthArea imediatamente (sem esperar Supabase) para evitar flash de UI vazia
setUser(null);

// Inicializa sessão ao carregar
(async () => {
  if (!sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) setUser(session.user);
    sb.auth.onAuthStateChange((_event, session) => {
      setUser(session ? session.user : null);
      // Fecha qualquer overlay de auth aberto ao logar/deslogar
      if (session) closeAllOverlays();
    });
    handleMpReturn();
  } catch(e) {
    console.warn('[GuardiaoFiscal] Erro ao inicializar sessao:', e.message);
  }
})();

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

