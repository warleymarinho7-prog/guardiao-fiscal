// quiz-desktop.js — questions[], renderQ, showResult (desktop)

// quiz.js — simulador de risco fiscal

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

