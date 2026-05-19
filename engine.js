// engine.js — motor fiscal v3, score, alertas

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
