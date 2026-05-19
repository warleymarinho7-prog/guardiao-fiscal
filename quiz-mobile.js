// quiz-mobile.js — mRenderQ, mShowResult (mobile)

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
(window.requestIdleCallback || (cb => setTimeout(cb, 200)))(function() { (function() {
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
  // Continua em loop — para quando aba está oculta
  let _feedInterval = null;
  setTimeout(() => {
    _feedInterval = setInterval(addDetection, 3500);
  }, 6000);

  // Pausa quando aba perde foco, retoma quando volta
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (_feedInterval) { clearInterval(_feedInterval); _feedInterval = null; }
    } else {
      if (!_feedInterval) { _feedInterval = setInterval(addDetection, 3500); }
    }
  });
})(); });

// ── FIM FEED DETECÇÕES ────────────────────────────────────────────────────────
