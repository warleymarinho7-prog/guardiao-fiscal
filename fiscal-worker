/**
 * fiscal-worker.js — Guardião Fiscal
 * Roda o motor fiscal (eParsePDFText + eAnalyzeSingle + eConsolidate)
 * completamente fora do main thread, eliminando os 6.691ms de [unattributed].
 *
 * Comunicação via postMessage:
 *   → { type: 'ANALYZE', payload: { grupos, rendaDeclarada, perfilUsuario } }
 *   ← { type: 'PROGRESS', payload: { pct, msg } }
 *   ← { type: 'RESULT',   payload: consolidated }
 *   ← { type: 'ERROR',    payload: { message } }
 *
 *   → { type: 'PARSE_PDF_TEXT', payload: { text, filename } }
 *   ← { type: 'PDF_TEXT_RESULT', payload: { txns, banco, conta } }
 *   ← { type: 'ERROR', payload: { message } }
 */

'use strict';

// ─── Utilitários ──────────────────────────────────────────────────────────────

const fmtBRL = v => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
  minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(isNaN(v) ? 0 : v);

function eParseBRL(s) {
  if (!s) return 0;
  const c = String(s).replace(/\s/g, '').replace(/[^\d,.\-+]/g, '');
  const hasBothSep = c.includes('.') && c.includes(',');
  if (hasBothSep) {
    const dotPos = c.lastIndexOf('.'), commaPos = c.lastIndexOf(',');
    if (commaPos > dotPos) return parseFloat(c.replace(/\./g, '').replace(',', '.')) || 0;
    return parseFloat(c.replace(/,/g, '')) || 0;
  }
  if (c.includes(',') && !c.includes('.')) return parseFloat(c.replace(',', '.')) || 0;
  return parseFloat(c) || 0;
}

function eParseDate(s) {
  if (!s) return null;
  s = String(s).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) { const d = new Date(+iso[1], +iso[2] - 1, +iso[3]); return isNaN(d) ? null : d; }
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) { const d = new Date(+br[3], +br[2] - 1, +br[1]); return isNaN(d) ? null : d; }
  const br2 = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (br2) { const y = +br2[3] < 50 ? 2000 + +br2[3] : 1900 + +br2[3]; const d = new Date(y, +br2[2] - 1, +br2[1]); return isNaN(d) ? null : d; }
  const brshort = s.match(/^(\d{2})\/(\d{2})$/);
  if (brshort) { const d = new Date(new Date().getFullYear(), +brshort[2] - 1, +brshort[1]); return isNaN(d) ? null : d; }
  const ofx = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofx) { const d = new Date(+ofx[1], +ofx[2] - 1, +ofx[3]); return isNaN(d) ? null : d; }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// ─── ENGINE CONFIG ─────────────────────────────────────────────────────────────

const ENGINE_CONFIG = {
  MONTHLY_REPORT_LIMIT_PF: 5000, MONTHLY_REPORT_LIMIT_PJ: 15000,
  PIX_LIMIT_PF: 5000, PIX_LIMIT_PJ: 15000, PIX_LIMIT: 5000,
  CASH_ALERT_THRESHOLD: 2000, ESPECIE_LIMIT: 2000,
  SPLIT_PIX_DELTA: 500, SPLIT_PIX_MIN: 4500, SPLIT_PIX_WINDOW: 7,
  CIRCULAR_RATIO: 0.85, CIRCULAR_HOURS: 24, CIRCULAR_MIN_VALUE: 7000,
  PDF_MAX_PAGES: 60, PDF_TIMEOUT_MS: 15000,
  MIN_EVIDENCIAS_ALTO_RISCO: 2, CONFIDENCE_REBAIXAR: 0.35,
  JANELA_TRIMESTRAL: 3, JANELA_SEMESTRAL: 6, JANELA_ANUAL: 12,
  SEVERIDADE: {
    F1_omissao_renda: 1.0, F2_pix_limite: 0.85, F3_especie: 0.90,
    F4_comercial_oculta: 0.80, F5_anomalia_temporal: 0.75,
    F6_investimento_aluguel: 0.70, F6c_circularidade: 0.90,
    F6d_split_pix: 0.95, F7_compatibilidade: 1.0, F8_conta_auxiliar: 0.65
  },
};

const CAT = {
  formal: ['salário','salario','holerite','folha pgto','pagamento folha','fgts','inss','irrf','pro-labore','pró-labore','beneficio','benefício','aposentadoria','pensão','pensao','rendimento prev','13 salario','13° salario','férias','ferias','rescisão','rescisao','clt'],
  invest: ['btc','bitcoin','cripto','crypto','ethereum','xrp','usdt','binance','foxbit','mercado bitcoin','novadax','tesouro direto','tesouro selic','tesouro ipca','dividendo','jscp','jcp','rendimento fundo','resgate cdb','resgate lci','resgate lca','resgate rdb','resgate fundo','rendimento aplicacao','rendimento poupanca'],
  aluguel: ['aluguel','locação','locacao','imóvel','imovel','alugar','locatário','locatario'],
  comercial: ['ifood','rappi','uber eats','99food','shopee','mercado livre','mercadolivre','ame digital','pagseguro','mercado pago','stone','cielo','getnet','rede ','sumup','ton ','pagar.me','venda','vend.','nota fiscal','nf-e','recebimento vendas','vendas online'],
  especie: ['saque','caixa eletronico','atm','deposito especie','dep especie','deposito em especie','dinheiro','cdas','cofre'],
  interno: ['entre contas','conta própria','conta propria','transferência interna','transf interna','tid própria','tid propria','portabilidade'],
  pix: ['pix recebido','pix credit','recebido pix','pix enviado','pix debitado','chave pix'],
  transf: ['transferência recebida','transferencia recebida','ted recebida','doc recebido','depósito recebido','deposito recebido','transf. recebida','transf recebida'],
};

const NATUREZA_KW = {
  fgts_rescisao: ['fgts rescisão','fgts rescisao','saldo fgts','liberação fgts','liberacao fgts','verba rescisória','verba rescisoria','indenização rescisória','indenizacao rescisoria','aviso prévio','aviso previo','multa fgts','multa 40%','rescisão contrato','rescisao contrato','acerto rescisório','acerto rescisorio','verbas indenizatórias','verbas indenizatorias'],
  heranca_doacao: ['herança','heranca','doação','doacao','inventário','inventario','espólio','espolio','itcmd','itcd','causa mortis','partilha','meação','meacao','legado','testamento','transferência herança','recebimento herança','doação familiar'],
  renda_trabalho: ['salário','salario','holerite','folha pgto','pagamento folha','inss','irrf','pro-labore','pró-labore','beneficio','benefício','aposentadoria','pensão','pensao','rendimento prev','13 salario','13° salario','férias','ferias','clt','rpa ','mei ','honorarios','honorários','plr','participacao lucros','participação lucros','bonus','bônus','participação resultados','participacao resultados','ppr ','premio ','prêmio ','gratificacao','gratificação','adicional','bonificacao','bonificação'],
  renda_capital: ['dividendo','dividendos','jscp','jcp','rendimento fundo','resgate cdb','resgate lci','resgate lca','resgate rdb','resgate fundo','rendimento aplicacao','rendimento poupanca','tesouro direto','tesouro selic','tesouro ipca','btc','bitcoin','cripto','ethereum','rendimento fii','fii rendimento','rendimento fiagro','rendimento cri','rendimento cra','proventos ações','proventos acoes','proventos fii','rendimento reit','venda acoes','venda ações','liquido venda','liq venda','liquido operacao','ganho capital','ganho de capital','xp investimentos','rico corretora','clear corretora','modal mais','btg pactual invest','avenue securities','nuinvest','inter invest'],
  transf_propria: ['entre contas','conta própria','conta propria','transferência interna','transf interna','tid própria','tid propria','portabilidade','conta corrente propria','mesma titularidade','minha conta','meu banco','conta salario propria','conta digital propria','nubank propria','inter propria','c6 propria','bradesco propria','itau propria','santander propria','caixa propria','bb propria','sicoob propria','sicredi propria','ted corretora','ted retorno corretora','retorno corretora','aporte corretora','transferencia corretora','ted xp ','ted rico ','ted clear ','ted modal ','ted btg ','ted avenue','ted inter invest','ted nubank invest','ted itau invest','resgate corretora','aporte investimento','transferencia investimento'],
  retirada_empresa: ['antecipacao lucro','antecipação lucro','distribuicao lucro','distribuição lucro','retirada socio','retirada sócio','pro labore','pró labore','prolabore','sangria empresa','retirada empresa','distribuicao isenta','distribuição isenta','antecipacao de resultado','antecipação resultado'],
  emprestimo: ['empréstimo','emprestimo','crédito pessoal','credito pessoal','financiamento recebido','cdc ','fgts emprestimo','adiantamento salario','antecipação','antecipacao','cheque especial','limite','liberação crédito','liberacao credito','ccb ','cédula de crédito','cedula de credito','cédula bancária','cedula bancaria','emprestimo bancario','empréstimo bancário','emprestimo consignado','empréstimo consignado','crédito consignado','credito consignado','refinanciamento','portabilidade credito','portabilidade crédito','emprestimo entre amigos','emprestimo familiar','contrato emprestimo','mutuo ','mútuo ','liberacao emprestimo','liberação empréstimo','credito liberado emprestimo','parcela emprestimo'],
  devolucao_reembolso: ['reembolso','ressarcimento','devolução','devolucao','estorno','cancelamento','chargeback','restituição','restituicao','reemb.','devol.','refund','cashback','volta ','retorno ','crédito cancelamento'],
  alienacao_bem: ['venda imóvel','venda imovel','venda veículo','venda veiculo','venda carro','venda moto','alienação','alienacao','escritura','cartório','cartorio','leilão','leilao','consórcio recebido','consoricio recebido'],
  aposta_jogo: ['bet365','sportingbet','betano','pixbet','betnacional','estrela bet','esportiva bet','blaze','fortune tiger','vai de bet','betfair','superbet','galera bet','br4 bet','casino','cassino','jogo online','aposta esportiva','loteria','mega sena'],
};

// ─── Funções do motor (copiadas do app.js, sem alteração de lógica) ───────────

function catMatch(desc, cats) { const d = desc.toLowerCase(); return cats.some(k => d.includes(k)); }

function detectNatureza(desc) {
  const d = desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [natureza, kws] of Object.entries(NATUREZA_KW)) {
    if (kws.some(k => d.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) return natureza;
  }
  return 'indefinida';
}

function detectChannel(desc) {
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

function normalizeDesc(desc) {
  if (!desc) return '';
  let s = desc.toLowerCase();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
  s = s.replace(/\b\d{6,}\b/g, '');
  s = s.replace(/[^\w\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function eClassifyTxn(t) {
  const d = normalizeDesc(t.desc);
  const v = t.value;
  const channel = detectChannel(t.desc);
  const natureza = v > 0 ? detectNatureza(t.desc) : 'saida';
  if (v <= 0) return { risk: 'normal', flag: null, cat: 'saida', channel, natureza };
  if (channel === 'proprio' || catMatch(d, CAT.interno) || natureza === 'transf_propria') return { risk: 'normal', flag: null, cat: 'interno', channel, natureza };
  if (natureza === 'emprestimo') return { risk: 'normal', flag: 'Empréstimo', cat: 'emprestimo', channel, natureza };
  if (natureza === 'devolucao_reembolso') return { risk: 'normal', flag: 'Reembolso', cat: 'reembolso', channel, natureza };
  if (natureza === 'heranca_doacao') return { risk: 'normal', flag: 'Herança/Doação', cat: 'reembolso', channel, natureza };
  if (natureza === 'fgts_rescisao') return { risk: 'normal', flag: 'FGTS/Rescisão', cat: 'reembolso', channel, natureza };
  if (natureza === 'alienacao_bem') return { risk: 'attention', flag: 'Venda de bem', cat: 'alienacao', channel, natureza };
  if (catMatch(d, CAT.formal) || natureza === 'renda_trabalho') return { risk: 'normal', flag: 'Renda formal', cat: 'formal', channel, natureza };
  if (catMatch(d, CAT.invest) || natureza === 'renda_capital') return { risk: 'attention', flag: 'Investimento', cat: 'invest', channel, natureza };
  if (catMatch(d, CAT.aluguel)) return { risk: 'attention', flag: 'Aluguel', cat: 'aluguel', channel, natureza };
  if (catMatch(d, CAT.comercial)) return { risk: 'attention', flag: 'Comercial', cat: 'comercial', channel, natureza };
  if (catMatch(d, CAT.especie)) {
    if (v >= 3000) return { risk: 'suspicious', flag: 'Espécie ≥ R$3k', cat: 'especie', channel, natureza };
    return { risk: 'attention', flag: 'Espécie', cat: 'especie', channel, natureza };
  }
  const isPix = catMatch(d, CAT.pix) || (d.includes('pix') && v > 0);
  const isTransf = catMatch(d, CAT.transf) || (d.includes('transf') && v > 0 && !catMatch(d, CAT.interno));
  if (isPix || isTransf) {
    if (v >= 10000) return { risk: 'suspicious', flag: 'Pix ≥ R$10k', cat: 'pix', channel, natureza };
    if (v >= 5000) return { risk: 'suspicious', flag: 'Pix ≥ R$5k', cat: 'pix', channel, natureza };
    if (v >= 2000) return { risk: 'attention', flag: 'Pix relevante', cat: 'pix', channel, natureza };
    if (v >= 500) return { risk: 'attention', flag: 'Pix', cat: 'pix', channel, natureza };
    if (v < 50) return { risk: 'normal', flag: null, cat: 'pix_pequeno', channel, natureza };
    return { risk: 'normal', flag: null, cat: 'pix', channel, natureza };
  }
  if (v >= 15000) return { risk: 'suspicious', flag: 'Crédito alto', cat: 'outros', channel, natureza };
  if (v >= 5000) return { risk: 'attention', flag: 'Valor relevante', cat: 'outros', channel, natureza };
  return { risk: 'normal', flag: null, cat: 'outros', channel, natureza };
}

function _median(arr) { if (!arr || arr.length === 0) return 0; const s = arr.slice().sort((a, b) => a - b); const mid = Math.floor(s.length / 2); return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2; }
function _mad(arr, med) { if (!arr || arr.length === 0) return 0; const m = med !== undefined ? med : _median(arr); return _median(arr.map(v => Math.abs(v - m))); }
function isValidTxn(t) { return (t.date instanceof Date && !isNaN(t.date) && typeof t.value === 'number' && !isNaN(t.value) && t.value !== 0 && typeof t.desc === 'string' && t.desc.trim().length >= 2); }
function txnFingerprint(t, includeSign) { const dateStr = (t.date instanceof Date && !isNaN(t.date)) ? t.date.toISOString().slice(0, 10) : String(t.date || ''); const valStr = (includeSign ? (t.value >= 0 ? '+' : '-') : '') + Math.abs(t.value).toFixed(2); const descStr = normalizeDesc(t.desc).slice(0, 40); const bankStr = normalizeDesc(t.bank || '').slice(0, 15); return dateStr + '|' + valStr + '|' + descStr + '|' + bankStr; }
function deduplicateTxns(txns) { const seen = new Set(); return txns.filter(function (t) { const fp = txnFingerprint(t, true); if (seen.has(fp)) return false; seen.add(fp); return true; }); }
function deduplicateCrossSource(allTxns) { const seen = new Set(); return allTxns.filter(t => { const dateStr = (t.date instanceof Date && !isNaN(t.date)) ? t.date.toISOString().slice(0, 10) : String(t.date || ''); const valStr = (t.value >= 0 ? '+' : '-') + Math.abs(t.value).toFixed(2); const descStr = normalizeDesc(t.desc).slice(0, 25); const fp = dateStr + '|' + valStr + '|' + descStr; if (seen.has(fp)) return false; seen.add(fp); return true; }); }

function aggregateMonthly(txns) {
  const _pixPorValorDia = {};
  txns.forEach((t, idx) => { if (!t.date || !(t.date instanceof Date) || isNaN(t.date)) return; const isPix = normalizeDesc(t.desc || '').includes('pix'); if (!isPix) return; const diaKey = t.date.toISOString().slice(0, 10); const valKey = Math.abs(t.value).toFixed(2) + '|' + diaKey; if (!_pixPorValorDia[valKey]) _pixPorValorDia[valKey] = { pos: [], neg: [] }; if (t.value > 0) _pixPorValorDia[valKey].pos.push(idx); else _pixPorValorDia[valKey].neg.push(idx); });
  const _pixCrossBankSet = new Set();
  Object.values(_pixPorValorDia).forEach(({ pos, neg }) => { if (pos.length > 0 && neg.length > 0) { const n = Math.min(pos.length, neg.length); for (let i = 0; i < n; i++) { _pixCrossBankSet.add(pos[i]); _pixCrossBankSet.add(neg[i]); } } });
  const months = {};
  for (let idx = 0; idx < txns.length; idx++) {
    const t = txns[idx];
    if (!t.date || !(t.date instanceof Date) || isNaN(t.date)) continue;
    const key = t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0');
    if (!months[key]) months[key] = { credits: 0, debits: 0, cashIn: 0, cashOut: 0, pixIn: 0, pixOut: 0, pixConsolidado: 0, pixConsolidadoLiquido: 0, especie: 0, formal: 0, txns: [], count: 0 };
    const b = months[key]; const v = Math.abs(t.value); const d = normalizeDesc(t.desc); const isCrossBank = _pixCrossBankSet.has(idx);
    if (t.value > 0) { b.credits += v; if (d.includes('pix')) { b.pixIn += v; } if (d.includes('saque') || d.includes('especie')) b.cashIn += v; if (d.includes('salario') || d.includes('holerite')) b.formal += v; }
    else { b.debits += v; if (d.includes('pix')) { b.pixOut += v; } if (d.includes('saque')) b.cashOut += v; }
    b.pixConsolidado = b.pixIn + b.pixOut;
    if (!isCrossBank) { b.pixConsolidadoLiquido = (b.pixConsolidadoLiquido || 0) + (d.includes('pix') ? v : 0); }
    else { b.pixConsolidadoLiquido = b.pixConsolidadoLiquido || 0; }
    b.txns.push(t); b.count++;
  }
  return months;
}

function calcProfile(months) {
  const keys = Object.keys(months).filter(k => k !== 'unk').sort();
  const values = keys.map(k => months[k].credits + months[k].debits);
  const credits = keys.map(k => months[k].credits);
  const pixVals = keys.map(k => months[k].pixConsolidado);
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const last = (arr, n) => arr.slice(-n);
  const medCredits = _median(credits);
  const madCredits = _mad(credits, medCredits);
  return { avgTotal3: avg(last(values, 3)), avgTotal6: avg(last(values, 6)), avgTotal12: avg(last(values, 12)), avgCredits: avg(credits), medCredits, madCredits, avgPix: avg(pixVals), totalMeses: keys.length, mesCritico: keys.reduce((best, k) => { const v = months[k].credits + months[k].debits; return (!best || v > (months[best].credits + months[best].debits)) ? k : best; }, null) };
}

function detectarRecorrencia(txns) {
  const _formalKw = ['salario','salário','holerite','folha pgto','pagamento folha','folha pagamento','pagamento salario','pagamento salário','fgts','inss','irrf','13 salario','13 salário','13° salario','ferias','férias','rescisao','rescisão','pro-labore','pró-labore','clt','beneficio','benefício','aposentadoria','pensao','pensão','rendimento prev','inss previdencia','inss previdência','bolsa estagio','bolsa estágio','estagio remunerado','estágio remunerado'];
  const _isFormal = d => _formalKw.some(k => d.toLowerCase().includes(k));
  const _pixPorDiaValor = {};
  txns.forEach((t, idx) => { if (!t.date || !(t.date instanceof Date) || isNaN(t.date)) return; const isPix = (t.desc || '').toLowerCase().includes('pix'); if (!isPix) return; const chave = Math.abs(t.value).toFixed(2) + '|' + t.date.toISOString().slice(0, 10); if (!_pixPorDiaValor[chave]) _pixPorDiaValor[chave] = { pos: [], neg: [] }; if (t.value > 0) _pixPorDiaValor[chave].pos.push(idx); else _pixPorDiaValor[chave].neg.push(idx); });
  const _crossBankIdx = new Set();
  Object.values(_pixPorDiaValor).forEach(({ pos, neg }) => { if (pos.length > 0 && neg.length > 0) { const n = Math.min(pos.length, neg.length); for (let i = 0; i < n; i++) { _crossBankIdx.add(pos[i]); _crossBankIdx.add(neg[i]); } } });
  const _propKw = ['conta propria','conta própria','propria conta','nubank propria','inter propria','transferencia propria','transf propria','mesma titularidade','portabilidade'];
  const _isPropria = d => _propKw.some(k => (d || '').toLowerCase().includes(k));
  const _saldoLiqPorRemetente = {};
  txns.forEach(t => { const nome = t.senderName || normalizeDesc(t.desc).replace(/^pix\s+(recebido|enviado)\s*/i, '').slice(0, 30); if (!_saldoLiqPorRemetente[nome]) _saldoLiqPorRemetente[nome] = { cred: 0, deb: 0, count: 0 }; if (t.value > 0) { _saldoLiqPorRemetente[nome].cred += t.value; _saldoLiqPorRemetente[nome].count++; } else { _saldoLiqPorRemetente[nome].deb += Math.abs(t.value); } });
  const _isBidirecional = nome => { const s = _saldoLiqPorRemetente[nome]; if (!s || s.cred < 500) return false; return (s.deb / s.cred) >= 0.30; };
  const grupos = {};
  txns.filter((t, idx) => {
    if (t.value <= 0) return false; if (_isFormal(t.desc)) return false; if (_crossBankIdx.has(idx)) return false; if (_isPropria(t.desc)) return false;
    const _d = (t.desc || '').toLowerCase(); const _investKw = ['dividend','dividendo','fii','cri','cra','lci','lca','cdb','ltn','ntn','tesouro','ação','acao','ted recebida xp','ted recebida btg','ted recebida rico','ted recebida clear','ted recebida nu invest','resgate cdb','resgate lci','resgate lca','resgate renda fixa','rendimento investimento','investimentos cctvm','corretora','bolsa de valores','b3 '];
    if (_investKw.some(k => _d.includes(k))) return false;
    const nome = t.senderName || normalizeDesc(t.desc).replace(/^pix\s+(recebido|enviado)\s*/i, '').slice(0, 30);
    if (_isBidirecional(nome)) return false; return true;
  }).forEach(t => {
    const chave = t.desc.toLowerCase().replace(/\d{2}\/\d{2}\/\d{4}/g, '').replace(/\d{2}\/\d{2}/g, '').replace(/r\$[\d.,]+/gi, '').replace(/\s+/g, ' ').trim().substring(0, 40);
    if (!grupos[chave]) grupos[chave] = { count: 0, total: 0, valores: [] }; grupos[chave].count++; grupos[chave].total += t.value; grupos[chave].valores.push(t.value);
  });
  const recorrentes = Object.entries(grupos).filter(([, g]) => g.count >= 4).map(([desc, g]) => { const media = g.total / g.count; const desvioPct = g.valores.length > 1 ? Math.sqrt(g.valores.reduce((a, v) => a + Math.pow(v - media, 2), 0) / g.valores.length) / media : 0; return { desc, count: g.count, total: g.total, media, desvioPct }; });
  const _kwEmpresa = ['ltda','s/a','sa ','me ','eireli','mei ','cnpj','empresa','comercio','servicos','consultoria','industria'];
  const _temVinculoDeclaravel = d => _kwEmpresa.some(k => d.toLowerCase().includes(k));
  const comercialOculta = recorrentes.filter(r => r.desvioPct < 0.25 && r.count >= 8 && r.media >= 400 && !_temVinculoDeclaravel(r.desc));
  return { recorrentes, comercialOculta };
}

function analiseTemporal(monthly) {
  const meses = Object.values(monthly).filter(m => m.total > 0);
  if (meses.length < 2) return { anomalias: [], mediaHistorica: 0, mediaMediana: 0, pico: 0 };
  const totais = meses.map(m => m.total);
  const mediana = _median(totais); const mad = _mad(totais, mediana);
  const media = totais.reduce((a, v) => a + v, 0) / totais.length;
  const desvio = Math.sqrt(totais.reduce((a, v) => a + Math.pow(v - media, 2), 0) / totais.length);
  const anomalias = meses.filter(m => { const zMad = mad > 0 ? Math.abs(m.total - mediana) / (1.4826 * mad) : 0; const zClassico = desvio > 0 ? Math.abs(m.total - media) / desvio : 0; const z = mad > 0 ? zMad : zClassico; return z > 1.8; });
  return { anomalias, mediaHistorica: mediana, mediaMedia: media, pico: Math.max(...totais) };
}

function detectarCircularidade(txns) {
  function toTs(d) { if (!d) return 0; if (typeof d === 'number') return d; const p = String(d).split('/'); if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]).getTime(); return new Date(d).getTime() || 0; }
  const sample = txns.length > 500 ? txns.slice(-500) : txns;
  const sorted = sample.slice().sort((a, b) => toTs(a.date) - toTs(b.date));
  const eventos = [];
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]; if (t.value <= 0) continue; if (t.value < ENGINE_CONFIG.CIRCULAR_MIN_VALUE) continue;
    const tTs = toTs(t.date); let saidaAcum = 0;
    for (let j = i + 1; j < sorted.length; j++) { const u = sorted[j]; if (!u.date || !t.date) break; const diffH = (toTs(u.date) - tTs) / 3600000; if (diffH > ENGINE_CONFIG.CIRCULAR_HOURS) break; if (u.value < 0) saidaAcum += Math.abs(u.value); }
    const ratio = t.value > 0 ? saidaAcum / t.value : 0;
    if (ratio >= ENGINE_CONFIG.CIRCULAR_RATIO) eventos.push({ entrada: t.value, saidaRatio: Math.round(ratio * 100), desc: t.desc });
  }
  return eventos;
}

function detectarSplitPix(txns) {
  const pixAltos = txns.filter(t => t.date instanceof Date && !isNaN(t.date) && t.value >= ENGINE_CONFIG.SPLIT_PIX_MIN && t.value < ENGINE_CONFIG.PIX_LIMIT && normalizeDesc(t.desc).includes('pix')).sort((a, b) => (a.date || 0) - (b.date || 0));
  function _extrairRemetente(desc) { const d = normalizeDesc(desc || ''); const semPrefixo = d.replace(/^pix\s+(recebido|enviado|transferencia|transf)\s*/i, '').replace(/^recebido\s+de\s+/i, '').trim(); return semPrefixo.split(/\s+/).slice(0, 3).join(' ') || d.slice(0, 20); }
  const series = [];
  for (let i = 0; i < pixAltos.length - 1; i++) {
    const a = pixAltos[i], b = pixAltos[i + 1]; if (!a.date || !b.date) continue;
    const diffDays = (b.date - a.date) / 86400000; const valueDiff = Math.abs(a.value - b.value);
    const remetA = _extrairRemetente(a.desc); const remetB = _extrairRemetente(b.desc);
    const mesmoRemetente = remetA.length >= 3 && remetA === remetB;
    const _menorVal = Math.min(a.value, b.value); const _maiorVal = Math.max(a.value, b.value);
    const _similaridade = _menorVal / _maiorVal; const _eSplit = _similaridade >= 0.70;
    if (diffDays <= ENGINE_CONFIG.SPLIT_PIX_WINDOW && valueDiff <= ENGINE_CONFIG.SPLIT_PIX_DELTA && mesmoRemetente && _eSplit) series.push({ valores: [a.value, b.value], diffDays: Math.round(diffDays), remetente: remetA });
  }
  return series;
}

function calcConfidence(signals) { const hits = signals.filter(Boolean).length; if (hits === 0) return 0.10; if (hits === 1) return 0.40; if (hits === 2) return 0.65; if (hits === 3) return 0.80; return Math.min(0.97, 0.80 + (hits - 3) * 0.05); }

function normalizeAccountId(v) { if (!v) return ''; return String(v).replace(/\D/g, '').slice(-8); }
function sameOwnerHeuristic(a, b) {
  if (!a || !b) return false;
  if (a.bank && b.bank && a.bank === b.bank && a.account && b.account && normalizeAccountId(a.account) === normalizeAccountId(b.account)) return true;
  if (a.bank && b.bank && a.bank !== b.bank) { const descA = normalizeDesc(a.desc); const descB = normalizeDesc(b.desc); const bankA = normalizeDesc(a.bank); const bankB = normalizeDesc(b.bank); if (descA.includes(bankB.split(' ')[0]) || descB.includes(bankA.split(' ')[0])) return true; }
  if (a.ownerName && b.ownerName) { const x = normalizeDesc(a.ownerName); const y = normalizeDesc(b.ownerName); if (x && y && x === y && x.length > 3) return true; }
  if (a.senderName && b.senderName) { const sx = normalizeDesc(a.senderName); const sy = normalizeDesc(b.senderName); if (sx && sy && sx === sy && sx.length > 5) return true; }
  const sa = normalizeDesc(a.desc); const sb = normalizeDesc(b.desc);
  if (sa && sb) { const bothTransfer = /ted|doc|pix|transf/.test(sa) && /ted|doc|pix|transf/.test(sb); if (bothTransfer && Math.abs(Math.abs(a.value) - Math.abs(b.value)) <= 0.02) return true; }
  return false;
}

function isInternalTransfer(txn, allTxns, _byValue) {
  const s = normalizeDesc(txn.desc);
  if (/transferencia entre contas|entre minhas contas|aporte|resgate/.test(s)) return 'confirmed';
  if (catMatch(s, CAT.interno)) return 'confirmed';
  if (txn.channel === 'proprio') return 'confirmed';
  if (/transf.*propria|transf.*propri|conta.*propria|propri.*conta/.test(s)) return 'confirmed';
  if (txn.value <= 0) return null;
  const k = Math.abs(txn.value).toFixed(2);
  const candidates = _byValue ? (_byValue.get(k) || []) : allTxns;
  const sameValueOpposite = candidates.filter(t => t !== txn && Math.abs(Math.abs(t.value) - Math.abs(txn.value)) <= 0.02 && Math.sign(t.value) !== Math.sign(txn.value) && t.date instanceof Date && txn.date instanceof Date && Math.abs((t.date - txn.date) / 86400000) <= 3);
  if (sameValueOpposite.some(t => sameOwnerHeuristic(txn, t))) return 'probable';
  const espelhos = candidates.filter(t => t !== txn && Math.abs(t.value) === Math.abs(txn.value) && Math.sign(t.value) === Math.sign(txn.value) && t.bank === txn.bank && t.date instanceof Date && txn.date instanceof Date && Math.abs((t.date - txn.date) / 86400000) <= 1 && normalizeDesc(t.desc).slice(0, 20) === normalizeDesc(txn.desc).slice(0, 20));
  if (espelhos.length > 0) return 'uncertain';
  const tedSaidas = candidates.filter(t => t !== txn && t.value < 0 && Math.abs(Math.abs(t.value) - Math.abs(txn.value)) <= 0.02 && t.date instanceof Date && txn.date instanceof Date && Math.abs((t.date - txn.date) / 86400000) <= 2 && /ted|doc|pix|transf/.test(normalizeDesc(t.desc)));
  if (tedSaidas.length > 0) return 'probable';
  return null;
}

function applyInternalDetection(classified) {
  const _saques = classified.filter(t => t.value < 0 && (normalizeDesc(t.desc).includes('saque') || normalizeDesc(t.desc).includes('caixa eletronico') || normalizeDesc(t.desc).includes('atm')));
  const _depositos_especie = classified.filter(t => t.value > 0 && t.cat === 'especie');
  const _especie_de_saque = new Set();
  _depositos_especie.forEach((dep, di) => { const depVal = dep.value; const depTs = dep.date instanceof Date ? dep.date.getTime() : 0; for (const saq of _saques) { const saqVal = Math.abs(saq.value); const saqTs = saq.date instanceof Date ? saq.date.getTime() : 0; const diffDays = Math.abs(depTs - saqTs) / 86400000; const diffPct = Math.abs(depVal - saqVal) / saqVal; if (diffDays <= 2 && diffPct <= 0.05) { _especie_de_saque.add(di); break; } } });
  const _byValue = new Map();
  for (const t of classified) { const k = Math.abs(t.value).toFixed(2); if (!_byValue.has(k)) _byValue.set(k, []); _byValue.get(k).push(t); }
  return classified.map((txn, txnIdx) => {
    const _especieOrigem = _depositos_especie.indexOf(txn);
    if (_especieOrigem >= 0 && _especie_de_saque.has(_especieOrigem)) return { ...txn, internalMove: 'probable', riskWeight: 0.1, flag: 'Depósito em espécie com saque de valor similar nos últimos 2 dias — provável movimentação própria' };
    const result = isInternalTransfer(txn, classified, _byValue);
    if (!result) return txn;
    const riskWeight = result === 'confirmed' ? 0 : result === 'probable' ? 0.1 : result === 'uncertain' ? 0.3 : 1;
    const flag = result === 'confirmed' ? 'Movimento interno — excluído do score' : result === 'probable' ? 'Provável transferência entre contas do mesmo titular' : 'Possível movimentação interna (baixo peso)';
    return { ...txn, internalMove: result, riskWeight, risk: result === 'confirmed' ? 'normal' : result === 'probable' ? 'normal' : txn.risk, cat: result === 'confirmed' || result === 'probable' ? 'interno' : txn.cat, flag };
  });
}

// ─── eAnalyzeSingle (copiado integralmente do app.js) ─────────────────────────
// [Nota: função extensa preservada sem modificação de lógica]

function eAnalyzeSingle(txns, bank, rendaDeclarada, perfilUsuario) {
  rendaDeclarada = rendaDeclarada || 0; perfilUsuario = perfilUsuario || null;
  const _perfilNorm = perfilUsuario === 'freelancer' ? 'mei' : perfilUsuario === 'socio' ? 'mei' : perfilUsuario === 'clt_extra' ? 'clt' : perfilUsuario;
  const _perfilMult = { pix: _perfilNorm === 'mei' ? 1.5 : _perfilNorm === 'investidor' ? 1.4 : 1.0, comercial: _perfilNorm === 'mei' ? 0.4 : _perfilNorm === 'investidor' ? 0.6 : 1.0, especie: 1.0, f7compat: perfilUsuario === 'investidor' ? 0.5 : 1.0 };
  const _emptyResult = { bank: bank || '', totalTxns: 0, creditCount: 0, totalCredits: 0, totalDebits: 0, pixTotal: 0, especieTotal: 0, formalTotal: 0, comercialTotal: 0, suspCount: 0, attCount: 0, monthsOverLimit: 0, months: 0, score: 0, confidence: 0, numEvidencias: 0, classified: [], fatores: [], recorrentes: [], comercialOculta: [], anomalias: [], mediaHistorica: 0, pico: 0, circularidade: [], splitPix: [], internos: [], quarterly: {}, perfil: {}, mesCritico: null, indiceEspecie: 0, indiceConsumo: 0, extratoMuitoCurto: true, extratoCurto: false, parserConfidence: 0, txnsValidas: 0, txnsDescartadas: 0, tipoAnalise: 'indicador_compatibilidade_fiscal', versaoEngine: 'v8.0', rendaDeclarada: rendaDeclarada || 0, mesesAnalisados: 0 };
  if (!txns || txns.length === 0) return _emptyResult;

  // Reconstrói Date objects (foram serializados como strings no postMessage)
  txns = txns.map(t => ({ ...t, date: t.date ? new Date(t.date) : null }));

  const txnsValidas = txns.filter(isValidTxn);
  const parserConfidence = txns.length > 0 ? txnsValidas.length / txns.length : 0;
  const txnsDescartadas = txns.length - txnsValidas.length;
  if (txnsValidas.length === 0) return { ..._emptyResult, txnsDescartadas };

  const monthly = aggregateMonthly(txnsValidas);
  Object.entries(monthly).forEach(([k, m]) => { monthly[k].total = m.credits; monthly[k].totalDebito = m.debits; monthly[k].pix = m.pixIn; monthly[k].pixDebito = m.pixOut; monthly[k].especie = m.cashIn; monthly[k].consolidado = m.pixConsolidado; monthly[k].count = m.count; });
  const perfil = calcProfile(monthly);
  const quarterly = {};
  Object.entries(monthly).forEach(([k, m]) => { if (k === 'unk') return; const [y, mo] = k.split('-').map(Number); const q = y + '-Q' + Math.ceil(mo / 3); if (!quarterly[q]) quarterly[q] = { total: 0, pix: 0, consolidado: 0, meses: 0 }; quarterly[q].total += m.credits; quarterly[q].pix += m.pixIn; quarterly[q].consolidado += m.pixConsolidado; quarterly[q].meses++; });
  const classifiedRaw = txns.map(t => ({ ...t, ...eClassifyTxn(t), bank }));
  const classified = applyInternalDetection(classifiedRaw);
  const _pixInternosMes = {};
  classified.forEach(t => { if (!t.date || !(t.date instanceof Date)) return; const mesK = t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0'); const isInterno = t.internalMove === 'confirmed' || t.internalMove === 'probable' || t.natureza === 'transf_propria' || t.cat === 'interno'; const isPix = normalizeDesc(t.desc || '').includes('pix'); if (isInterno && isPix) { _pixInternosMes[mesK] = (_pixInternosMes[mesK] || 0) + Math.abs(t.value); } });
  Object.keys(quarterly).forEach(q => quarterly[q].consolidadoLiquido = 0);
  Object.entries(monthly).forEach(([k, m]) => { if (k === 'unk') return; const [y, mo] = k.split('-').map(Number); const q = y + '-Q' + Math.ceil(mo / 3); if (quarterly[q]) { const _interno = _pixInternosMes[k] || 0; quarterly[q].consolidadoLiquido += Math.max(0, m.pixConsolidado - _interno); } });
  const credits = classified.filter(t => t.value > 0);
  const debits = classified.filter(t => t.value < 0);
  const _naturezasNeutras = new Set(['transf_propria', 'emprestimo', 'devolucao_reembolso', 'interno', 'saida', 'heranca_doacao', 'fgts_rescisao']);
  const creditsRisco = credits.filter(t => (!t.internalMove || t.internalMove === 'uncertain') && !_naturezasNeutras.has(t.natureza) && t.cat !== 'interno' && t.cat !== 'emprestimo' && t.cat !== 'reembolso');
  const suspicious = classified.filter(t => t.risk === 'suspicious' && t.value > 0 && t.riskWeight !== 0);
  const attention = classified.filter(t => t.risk === 'attention' && t.value > 0);
  const internos = classified.filter(t => t.internalMove === 'confirmed' || t.internalMove === 'probable');
  const totalCredits = credits.reduce((a, t) => a + t.value, 0);
  const totalDebits = Math.abs(debits.reduce((a, t) => a + t.value, 0));
  const pixTotal = credits.filter(t => t.cat === 'pix').reduce((a, t) => a + t.value, 0);
  const especieTotal = credits.filter(t => t.cat === 'especie').reduce((a, t) => a + t.value, 0);
  const formalTotal = credits.filter(t => t.cat === 'formal').reduce((a, t) => a + t.value, 0);
  const comercialTotal = credits.filter(t => t.cat === 'comercial').reduce((a, t) => a + t.value, 0);
  const suspTotal = suspicious.reduce((a, t) => a + t.value, 0);
  const months = Object.keys(monthly).filter(k => k !== 'unk').sort();
  const _mesesKeys = Object.keys(monthly).filter(k => k !== 'unk').sort();
  const _volumesMensais = _mesesKeys.map(k => monthly[k].credits);
  const _medVol = _volumesMensais.length > 0 ? _volumesMensais.reduce((a, b) => a + b, 0) / _volumesMensais.length : 0;
  const _mesesAltos = _volumesMensais.filter(v => _medVol > 0 && v > _medVol * 1.8).length;
  const _mesesBaixos = _volumesMensais.filter(v => _medVol > 0 && v < _medVol * 0.55).length;
  const _cvVolume = _medVol > 0 && _volumesMensais.length >= 6 ? Math.sqrt(_volumesMensais.reduce((a, v) => a + Math.pow(v - _medVol, 2), 0) / _volumesMensais.length) / _medVol : 0;
  const _medianaVol = (() => { const sv = _volumesMensais.slice().sort((a, b) => a - b); const mid = Math.floor(sv.length / 2); return sv.length % 2 !== 0 ? sv[mid] : (sv[mid - 1] + sv[mid]) / 2; })();
  const _mesesPicoClaro = _volumesMensais.filter(v => v > _medianaVol * 1.8).length;
  const _mesesNormais = _volumesMensais.filter(v => v >= _medianaVol * 0.5 && v <= _medianaVol * 2.0).length;
  const _temBaseEstavel = _mesesNormais >= Math.floor(_mesesKeys.length * 0.4);
  const _padraoSazonal = _mesesKeys.length >= 6 && ((_mesesAltos >= 2 && _mesesBaixos >= 2) || (_cvVolume > 0.5 && _mesesPicoClaro >= 2 && _temBaseEstavel) || (_cvVolume > 0.6 && _mesesAltos >= 1 && _mesesBaixos >= 1 && _temBaseEstavel));
  const _mesesQuaseZero = _volumesMensais.filter(v => _medVol > 0 && v < _medVol * 0.15).length;
  const _padraoSazonalForte = _padraoSazonal && _mesesQuaseZero >= 2;
  const _crossBankDesconto = {};
  classified.filter(t => t.value < 0 && t.date instanceof Date && normalizeDesc(t.desc || '').includes('pix')).forEach(saida => { const entrPar = classified.filter(e => e.value > 0 && e.date instanceof Date && !isNaN(e.date) && Math.abs(e.value - Math.abs(saida.value)) < 0.02 && e.date.toISOString().slice(0, 10) === saida.date.toISOString().slice(0, 10) && (e.internalMove === 'confirmed' || e.internalMove === 'probable' || /conta.{0,10}propria|propria.{0,10}conta|nubank|inter|bradesco|itau|santander|caixa|sicoob/.test(normalizeDesc(e.desc || '')))); if (entrPar.length > 0) { const mesK = saida.date.getFullYear() + '-' + String(saida.date.getMonth() + 1).padStart(2, '0'); _crossBankDesconto[mesK] = (_crossBankDesconto[mesK] || 0) + Math.abs(saida.value) * 2; } });
  const _pixMediaMensal = Object.values(monthly).reduce((a, m) => a + (m.pixIn || 0), 0) / Math.max(1, _mesesKeys.length);
  const _pixApostaDesconto = {};
  classified.forEach(t => { if (!t.date || !(t.date instanceof Date)) return; const mesK = t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0'); if (t.natureza === 'aposta_jogo' && t.value > 0) { const saidaAposta = classified.filter(s => s.natureza === 'aposta_jogo' && s.value < 0 && s.date instanceof Date && s.date.getFullYear() + '-' + String(s.date.getMonth() + 1).padStart(2, '0') === mesK).reduce((a, s) => a + Math.abs(s.value), 0); const entradaAposta = classified.filter(e => e.natureza === 'aposta_jogo' && e.value > 0 && e.date instanceof Date && e.date.getFullYear() + '-' + String(e.date.getMonth() + 1).padStart(2, '0') === mesK).reduce((a, e) => a + e.value, 0); _pixApostaDesconto[mesK] = Math.min(entradaAposta, saidaAposta); } });
  Object.entries(_pixApostaDesconto).forEach(([mesK, desconto]) => { if (monthly[mesK]) monthly[mesK].pixApostaDesconto = desconto; });
  const _pixEntradaMediaMensal = _mesesKeys.length > 0 ? _mesesKeys.reduce((a, k) => a + Math.max(0, (monthly[k] ? (monthly[k].pixIn || 0) : 0) - (monthly[k]?.pixApostaDesconto || 0)), 0) / _mesesKeys.length : 0;
  const _pixEntradaParaCobertura = _padraoSazonal && _mesesKeys.length >= 6 ? (() => { const _vals = _mesesKeys.map(k => monthly[k] ? (monthly[k].pixIn || 0) : 0).sort((a, b) => a - b); const _mid = Math.floor(_vals.length / 2); return _vals.length % 2 !== 0 ? _vals[_mid] : (_vals[_mid - 1] + _vals[_mid]) / 2; })() : _pixEntradaMediaMensal;
  const _pixCoberturaMargem = 1.3 * (_perfilMult ? _perfilMult.pix : 1.0);
  const _rendaCobre = rendaDeclarada > 0 && _pixEntradaParaCobertura <= rendaDeclarada * _pixCoberturaMargem;
  const monthsOverLimit = _padraoSazonal ? (() => { const _pixInVals = _mesesKeys.map(k => monthly[k] ? (monthly[k].pixIn || 0) : 0).sort((a, b) => a - b); const _mid = Math.floor(_pixInVals.length / 2); const _medPixIn = _pixInVals.length % 2 !== 0 ? _pixInVals[_mid] : (_pixInVals[_mid - 1] + _pixInVals[_mid]) / 2; return _mesesKeys.filter(k => { const pin = monthly[k] ? (monthly[k].pixIn || 0) : 0; return pin >= ENGINE_CONFIG.PIX_LIMIT_PF && pin > _medPixIn * 1.5; }).length; })() : Object.entries(monthly).filter(([k, m]) => { const desconto = _crossBankDesconto[k] || 0; return (m.consolidado - desconto) >= ENGINE_CONFIG.PIX_LIMIT_PF; }).length;
  const { recorrentes, comercialOculta } = detectarRecorrencia(txns);
  const { anomalias, mediaHistorica, pico } = analiseTemporal(monthly);
  const _entradaPorValorDia = new Map();
  classified.filter(t => t.value > 0 && t.date instanceof Date && !isNaN(t.date)).forEach(t => { const _chk = t.value.toFixed(2) + '|' + t.date.toISOString().slice(0, 10); if (!_entradaPorValorDia.has(_chk)) _entradaPorValorDia.set(_chk, []); _entradaPorValorDia.get(_chk).push(t); });
  const _txnsParaCirc = classified.filter(t => { if (t.internalMove === 'confirmed' || t.internalMove === 'probable') return false; if (t.natureza === 'transf_propria' || t.cat === 'interno') return false; const _d = normalizeDesc(t.desc || ''); if (/conta.{0,10}propria|propria.{0,10}conta|investimento|poupan|aplicac|resgate|aporte/.test(_d)) return false; if (t.value < 0 && t.date instanceof Date && !isNaN(t.date)) { const _chk = Math.abs(t.value).toFixed(2) + '|' + t.date.toISOString().slice(0, 10); const _entradas = _entradaPorValorDia.get(_chk) || []; if (_entradas.length > 0 && _d.includes('pix')) return false; } return true; });
  const circularidade = detectarCircularidade(_txnsParaCirc);
  const splitPix = detectarSplitPix(txns);

  let score = 0; const fatores = [];
  const _contados = new Set();
  function _marcar(ids) { ids.forEach(id => _contados.add(id)); }
  function _jaContado(ids) { return ids.some(id => _contados.has(id)); }
  function _fator(peso, motivo, porqueImporta, quandoNaoERisco, confianca, ids, fatorKey, contexto) {
    const severidade = (fatorKey && ENGINE_CONFIG.SEVERIDADE[fatorKey]) || 1.0;
    const ctx = contexto || 1.0; const pesoFinal = Math.round(peso * severidade * ctx);
    _marcar(ids || []);
    fatores.push({ peso: pesoFinal, pesoOriginal: peso, severidade, contexto: ctx, motivo, porqueImporta, quandoNaoERisco, confianca: confianca || 1, evidencias: [] });
    score += pesoFinal;
  }

  // F1
  const totalCreditsRisco = creditsRisco.reduce((a, t) => a + t.value, 0);
  const _suspIds = suspicious.map((t, i) => 'susp_' + i);
  const infRatio = totalCreditsRisco > 0 ? suspTotal / totalCreditsRisco : 0;
  const _nMesesF1 = Object.keys(monthly).filter(k => k !== 'unk').length || 1;
  const _cobertura = rendaDeclarada > 0 && totalCreditsRisco > 0 ? (rendaDeclarada * _nMesesF1) / totalCreditsRisco : 0;
  const _rendaExplicaMovim = _cobertura >= 0.6; const _rendaCobreTotal = _cobertura >= 0.8;
  const _temRendaExtra = (() => { if (formalTotal <= 0) return false; const _credExtras = creditsRisco.filter(t => t.cat !== 'formal' && t.natureza === 'indefinida' && t.value >= 300); return _credExtras.length >= 3; })();
  const f1raw = Math.round(Math.min(30, infRatio * 30));
  const _circularidadeAlta = circularidade.length >= 3;
  const f1 = _rendaCobreTotal && !_temRendaExtra ? 0 : _rendaCobreTotal && _temRendaExtra ? Math.min(12, Math.round(f1raw * 0.4)) : _rendaExplicaMovim ? Math.min(8, Math.round(f1raw * 0.5)) : _circularidadeAlta ? Math.round(f1raw * 0.7) : f1raw;
  if (f1 > 0) { _fator(f1, `Foram identificados sinais compatíveis com possível omissão de rendimentos — ${Math.round(infRatio * 100)}% das entradas sem origem fiscal identificável`, 'A Receita Federal cruza automaticamente as entradas bancárias com o que foi declarado. Créditos sem justificativa clara são o principal gatilho de malha fina.', 'Não se caracteriza como risco quando as entradas são salário identificado, transferências entre contas próprias, reembolsos documentados, herança ou verbas rescisórias.', infRatio > 0.4 ? 0.9 : infRatio > 0.2 ? 0.7 : 0.5, _suspIds, 'F1_omissao_renda', 1.0); fatores[fatores.length - 1].evidencias = [{ ok: infRatio > 0, texto: `${Math.round(infRatio * 100)}% das entradas sem origem identificável` }, { ok: suspTotal > 0, texto: `${fmtBRL(suspTotal)} em créditos sem justificativa fiscal` }, { ok: _cobertura > 0, texto: _cobertura > 0 ? `Renda declarada cobre ${Math.round(_cobertura * 100)}% da movimentação` : 'Renda declarada não informada' }]; }

  // F2
  const _nMesesF2 = Math.max(1, Object.keys(monthly).filter(k => k !== 'unk').length);
  const _pesoF2base = Math.min(15, monthsOverLimit * 5);
  const f2 = (_padraoSazonal && _rendaCobre) ? 0 : _rendaCobre ? Math.min(2, _pesoF2base) : _pesoF2base;
  if (f2 > 0) { _fator(f2, `Foram encontrados sinais que merecem conferência: Pix consolidado acima de ${fmtBRL(ENGINE_CONFIG.PIX_LIMIT_PF)} em ${monthsOverLimit} mês(es)${_rendaCobre ? ' (parcialmente coberto pela renda declarada)' : ''}`, 'Bancos são obrigados por lei a reportar à Receita toda movimentação mensal de Pix acima de R$5.000.', 'Não se caracteriza como risco quando o volume de Pix for compatível com a renda declarada ou com atividade profissional documentada (MEI, autônomo com notas).', monthsOverLimit >= 3 ? 0.95 : 0.75, ['pix_limit_' + monthsOverLimit], 'F2_pix_limite', 1.0); fatores[fatores.length - 1].evidencias = [{ ok: true, texto: `${monthsOverLimit} mês(es) com Pix acima de ${fmtBRL(ENGINE_CONFIG.PIX_LIMIT_PF)}` }, { ok: _pixMediaMensal > 0, texto: `Média mensal de Pix: ${fmtBRL(_pixMediaMensal)}` }, { ok: _rendaCobre, texto: _rendaCobre ? 'Renda declarada cobre o volume de Pix' : 'Renda declarada não cobre o volume detectado' }]; }
  if (_padraoSazonal && fatores.length > 0) { const _f2saz = [...fatores].reverse().find(f => f.ids && f.ids.some(id => id.startsWith('pix_limit'))); if (_f2saz) { const _reducaoF2Sazonal = _padraoSazonalForte ? 0.30 : 0.55; const _pesoF2orig = _f2saz.peso; const _pesoF2pos = Math.round(_pesoF2orig * _reducaoF2Sazonal); const _deltaF2 = _pesoF2orig - _pesoF2pos; _f2saz.peso = _pesoF2pos; score = Math.max(0, score - _deltaF2); _f2saz.motivo = (_f2saz.motivo || '').replace(' [sazonalidade detectada — peso reduzido]', '') + ' [sazonalidade detectada — peso reduzido]'; } }

  // F2b
  const trimestresElevados = Object.values(quarterly).filter(q => q.meses >= 2 && (q.consolidadoLiquido ?? q.consolidado) / q.meses >= ENGINE_CONFIG.PIX_LIMIT_PF).length;
  const _trimTotal = Object.keys(quarterly).length;
  if (trimestresElevados > 0 && !_rendaCobre && !_padraoSazonal && _trimTotal >= 3) { const f2b = Math.min(8, trimestresElevados * 4); const _jaF2 = _jaContado(['pix_limit_' + monthsOverLimit]); _fator(_jaF2 ? Math.round(f2b * 0.5) : f2b, `Padrão de Pix elevado em ${trimestresElevados} trimestre(s) consecutivo(s)`, 'Movimentação consistentemente alta por múltiplos trimestres indica padrão estrutural.', 'Não é risco se o padrão for consistente com atividade profissional declarada.', 0.7, ['trim_' + trimestresElevados]); }

  // F3
  const especieRatio = totalCredits > 0 ? especieTotal / totalCredits : 0;
  const f3 = Math.round(Math.min(15, especieRatio * 60));
  if (f3 > 0) { _fator(f3, `Foram identificados sinais de movimentação em dinheiro físico — ${Math.round(especieRatio * 100)}% das entradas em espécie (${fmtBRL(especieTotal)})`, 'Depósitos em espécie são um dos critérios diretos do e-Financeira. Qualquer depósito em dinheiro acima de R$2.000/mês é registrado pelo banco.', 'Não se caracteriza como risco quando o valor for compatível com saques anteriores ou atividade reconhecidamente em dinheiro.', especieRatio > 0.3 ? 0.9 : 0.65, ['especie_total'], 'F3_especie', 1.0); fatores[fatores.length - 1].evidencias = [{ ok: true, texto: `${fmtBRL(especieTotal)} em depósitos em espécie` }, { ok: especieRatio > 0.3, texto: `${Math.round(especieRatio * 100)}% das entradas em dinheiro físico` }]; }

  // F4
  const _totalComercOculto = comercialOculta.reduce((a, r) => a + r.total, 0);
  const _nMesesF4 = Math.max(1, Object.keys(monthly).filter(k => k !== 'unk').length);
  const _comercMediaMensal = _totalComercOculto / _nMesesF4;
  const _f4CoberturaFator = _perfilMult ? _perfilMult.comercial : 1.0;
  const _f4RendaCobre = (rendaDeclarada > 0 && (_comercMediaMensal <= rendaDeclarada * 1.5 * (1 / Math.max(0.3, _f4CoberturaFator)) || _rendaCobre)) || (perfilUsuario === 'mei' && _comercMediaMensal <= rendaDeclarada * 2.5);
  const _comercOcultoNovo = comercialOculta.filter(r => !_jaContado(['comrc_' + r.desc]));
  const _f4base = Math.min(15, _comercOcultoNovo.length * 5);
  const _f2Cheio = !_rendaCobre && monthsOverLimit > 0; const _f7Ativo = rendaDeclarada > 0; const _f7f2Dupla = _f2Cheio && _f7Ativo;
  const f4 = _f4RendaCobre ? Math.round(_f4base * 0.3) : _f7f2Dupla ? Math.min(5, Math.round(_f4base * 0.35)) : _f2Cheio ? Math.min(8, Math.round(_f4base * 0.6)) : (_f7Ativo ? Math.round(_f4base * 0.6) : _f4base);
  if (f4 > 0) { _fator(f4, `Foram encontrados sinais compatíveis com possível atividade comercial recorrente — ${_comercOcultoNovo.length} padrão(ões) de recebimento regular`, 'Recebimentos repetidos do mesmo pagador com valor similar são interpretados pela Receita como prestação de serviço.', 'Não se caracteriza como risco quando os recebimentos forem salário, pensão, aluguel declarado, reembolso recorrente ou transferência entre contas próprias.', _comercOcultoNovo.length >= 2 ? 0.8 : 0.6, _comercOcultoNovo.map(r => 'comrc_' + r.desc), 'F4_comercial_oculta', 1.0); fatores[fatores.length - 1].evidencias = [{ ok: true, texto: `${_comercOcultoNovo.length} padrão(ões) de recebimento recorrente detectado(s)` }, { ok: _comercMediaMensal > 0, texto: `Média de ${fmtBRL(_comercMediaMensal)}/mês em recebimentos recorrentes` }, { ok: !_f4RendaCobre, texto: _f4RendaCobre ? 'Renda declarada cobre o volume detectado' : 'Volume não coberto pela renda declarada' }]; }

  // F5
  const _naturezasNeutrasPico = new Set(['transf_propria', 'emprestimo', 'devolucao_reembolso', 'interno', 'saida', 'reembolso', 'alienacao_bem', 'heranca_doacao', 'fgts_rescisao']);
  const _creditsRiscoPorMes = {};
  classified.filter(t => t.value > 0 && !_naturezasNeutrasPico.has(t.natureza) && t.cat !== 'interno' && t.cat !== 'emprestimo' && t.cat !== 'reembolso').forEach(t => { const k = t.date instanceof Date ? t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0') : 'unk'; _creditsRiscoPorMes[k] = (_creditsRiscoPorMes[k] || 0) + t.value; });
  const _totaisRisco = Object.values(_creditsRiscoPorMes);
  const _picoRisco = _totaisRisco.length > 0 ? Math.max(..._totaisRisco) : pico;
  const _medRisco = _totaisRisco.length > 0 ? _median(_totaisRisco) : mediaHistorica;
  const pctPico = (_medRisco > 0 ? _picoRisco / _medRisco : mediaHistorica > 0 ? pico / mediaHistorica : 1);
  const mediaRef = (perfil.medCredits > 0 ? perfil.medCredits : perfil.avgCredits > 0 ? perfil.avgCredits : mediaHistorica);
  const _nMesesAtual = Math.max(1, Object.keys(monthly).filter(k => k !== 'unk').length);
  const _totalSemAlienacao = classified.filter(t => t.value > 0 && t.natureza !== 'alienacao_bem' && t.cat !== 'interno' && t.cat !== 'emprestimo').reduce((a, t) => a + t.value, 0);
  const _mediaAtual = _totalSemAlienacao / _nMesesAtual;
  const ratioAtual = mediaRef > 0 && _mediaAtual > 0 ? _mediaAtual / mediaRef : 1;
  const _mesPico = Object.entries(_creditsRiscoPorMes).sort(([, a], [, b]) => b - a)[0]?.[0];
  const _txnsMesPico = _mesPico ? classified.filter(t => { if (!t.date || t.value <= 0) return false; const k = t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0'); return k === _mesPico; }) : [];
  const _picoEhRendaTrabalho = _txnsMesPico.length > 0 && _txnsMesPico.filter(t => t.natureza === 'renda_trabalho').reduce((a, t) => a + t.value, 0) / _txnsMesPico.filter(t => t.value > 0).reduce((a, t) => a + t.value, 0.001) > 0.6;
  const _mesesComPicoRenda = Object.keys(_creditsRiscoPorMes).filter(mes => { const txnsMes = classified.filter(t => { if (!t.date || t.value <= 0) return false; const k = t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0'); return k === mes; }); const rendaTrabalhoMes = txnsMes.filter(t => t.natureza === 'renda_trabalho').reduce((a, t) => a + t.value, 0); const totalMes = txnsMes.filter(t => t.value > 0).reduce((a, t) => a + t.value, 0.001); return rendaTrabalhoMes / totalMes > 0.5 && (_creditsRiscoPorMes[mes] || 0) > mediaRef * 2; }).length;
  const _padraoAnualRendaTrabalho = _mesesComPicoRenda >= 2;
  const _threshold5 = _picoEhRendaTrabalho ? (_padraoAnualRendaTrabalho ? { t1: 12, t2: 9, t3: 6 } : { t1: 8, t2: 6, t3: 4 }) : (_padraoAnualRendaTrabalho ? { t1: 6, t2: 4, t3: 3 } : { t1: 3, t2: 2, t3: 1.5 });
  const _f5raw = pctPico >= _threshold5.t1 ? 15 : pctPico >= _threshold5.t2 ? 10 : pctPico >= _threshold5.t3 ? 5 : 0;
  const f5 = _picoEhRendaTrabalho ? (_padraoAnualRendaTrabalho ? Math.round(_f5raw * 0.25) : Math.round(_f5raw * 0.4)) : (_padraoAnualRendaTrabalho ? Math.round(_f5raw * 0.7) : _f5raw);
  if (f5 > 0) { _fator(f5, `Foram identificados sinais de variação atípica no extrato — pico de ${(Math.round(pctPico * 10) / 10)}x acima da média histórica`, 'Um mês com movimentação muito acima do padrão chama atenção no cruzamento automático da Receita.', 'Não se caracteriza como risco quando o pico coincidir com recebimento pontual documentável: venda de imóvel, herança, rescisão, 13º salário ou empréstimo.', pctPico >= 3 ? 0.85 : 0.65, ['anomalia_pico'], 'F5_anomalia_temporal', 1.0); fatores[fatores.length - 1].evidencias = [{ ok: true, texto: `Pico de ${(Math.round(pctPico * 10) / 10)}x acima da média do período` }, { ok: _mesPico != null, texto: _mesPico ? `Mês de pico: ${_mesPico}` : 'Mês de pico não identificado' }, { ok: !_picoEhRendaTrabalho, texto: _picoEhRendaTrabalho ? 'Pico associado a renda de trabalho (13º/PLR — menor risco)' : 'Pico sem associação clara a renda de trabalho' }]; }
  if (_padraoSazonal && fatores.length > 0) { const _f5idx = fatores.map((f, i) => ({ f, i })).reverse().find(({ f }) => f.ids && f.ids.includes('anomalia_pico')); if (_f5idx) { const _f5 = _f5idx.f; const _reducaoSazonal = _padraoSazonalForte ? 0.25 : 0.45; const _pesoOriginal = _f5.peso; const _pesoPosReducao = Math.round(_pesoOriginal * _reducaoSazonal); const _delta = _pesoOriginal - _pesoPosReducao; _f5.peso = _pesoPosReducao; score = Math.max(0, score - _delta); _f5.motivo = (_f5.motivo || '').replace(' [sazonalidade detectada — peso reduzido]', '') + ' [sazonalidade detectada — peso reduzido]'; } }
  if (ratioAtual >= 1.8 && perfil.avgCredits > 0 && !_jaContado(['anomalia_pico'])) { const f5b = ratioAtual >= 3 ? 8 : ratioAtual >= 2 ? 5 : 3; _fator(f5b, `Volume total ${(Math.round(ratioAtual * 10) / 10)}x acima da média histórica`, 'O volume acumulado do período é significativamente maior que o histórico do próprio extrato.', 'Não é risco se o período analisado incluir recebimentos atípicos documentáveis.', 0.6, ['anomalia_volume']); }
  else if (ratioAtual >= 1.8 && perfil.avgCredits > 0) { const f5b = Math.round((ratioAtual >= 3 ? 8 : ratioAtual >= 2 ? 5 : 3) * 0.5); if (f5b > 0) _fator(f5b, `Volume total ${(Math.round(ratioAtual * 10) / 10)}x acima da média (sinal adicional ao pico mensal)`, 'Combinação de pico mensal e volume total elevado reforça o padrão de risco.', 'Não é risco se houver documentação do recebimento atípico.', 0.55, ['anomalia_volume']); }

  // F6a
  const _alienacoes = classified.filter(t => t.value > 0 && t.natureza === 'alienacao_bem');
  if (_alienacoes.length > 0 && !_jaContado(['alienacao'])) { const _totalAlienacao = _alienacoes.reduce((a, t) => a + t.value, 0); _fator(5, `Alienação de bem detectada — ${fmtBRL(_totalAlienacao)} em ${_alienacoes.length} operação(ões)`, 'Venda de imóvel, veículo ou outros bens exige recolhimento de DARF de ganho de capital até o último dia útil do mês seguinte.', 'Não é risco se o bem foi vendido pelo mesmo valor de compra (sem ganho de capital) ou se se enquadra nas isenções.', 0.7, ['alienacao']); }
  if (classified.some(t => t.flag === 'Investimento') && !_jaContado(['invest'])) { const _f6InvestPeso = (perfilUsuario === 'investidor' || perfilUsuario === 'investidor_aposentado') ? 0 : 8; const _f6InvestConf = (perfilUsuario === 'investidor' || perfilUsuario === 'investidor_aposentado') ? 0.4 : 0.75; _fator(_f6InvestPeso, 'Rendimentos de investimentos identificados no extrato', 'Rendimentos de renda fixa, dividendos e ganhos de capital devem ser declarados separadamente no IR.', 'Não é risco se os rendimentos já estiverem incluídos na declaração de IR.', _f6InvestConf, ['invest']); }
  if (classified.some(t => t.flag === 'Aluguel') && !_jaContado(['aluguel'])) _fator(6, 'Recebimento de aluguel identificado', 'Receitas de aluguel devem ser declaradas mensalmente na ficha de rendimentos tributáveis.', 'Não é risco se o aluguel já estiver declarado ou se o valor estiver abaixo do limite de isenção.', 0.7, ['aluguel']);
  if (circularidade.length > 0) { const f6c = Math.min(12, circularidade.length * 6); _fator(f6c, `${circularidade.length} entrada(s) com saída equivalente no mesmo dia`, 'Dinheiro que entra e sai em poucas horas em valor similar pode indicar conta usada como passagem.', 'Não é risco se for pagamento recebido e repassado no mesmo dia por motivo documentável.', circularidade.length >= 3 ? 0.8 : 0.55, circularidade.map((_, i) => 'circ_' + i)); }
  if (splitPix.length > 0 && !_jaContado(splitPix.map((_, i) => 'circ_' + i))) { const f6d = Math.min(10, splitPix.length * 5); _fator(f6d, `${splitPix.length} série(s) de Pix fracionados próximos ao limite de R$${ENGINE_CONFIG.PIX_LIMIT.toLocaleString('pt-BR')}`, 'Pix enviados em valores ligeiramente abaixo do limite de notificação, em sequência rápida, são monitorados automaticamente.', 'Não é risco se os pagamentos fracionados tiverem destinatários distintos com finalidade clara.', splitPix.length >= 2 ? 0.85 : 0.6, splitPix.map((_, i) => 'split_' + i)); }

  // F7
  if (rendaDeclarada > 0) {
    const _mesesN = Math.max(1, Object.keys(monthly).filter(k => k !== 'unk').length);
    const _naturezasNeutrasF7 = new Set(['transf_propria', 'emprestimo', 'devolucao_reembolso', 'interno', 'reembolso', 'alienacao_bem', 'heranca_doacao', 'fgts_rescisao']);
    const _totalRendaTributavel = classified.filter(t => t.value > 0 && !_naturezasNeutrasF7.has(t.natureza) && t.cat !== 'interno' && t.cat !== 'emprestimo' && t.cat !== 'reembolso').reduce((a, t) => a + t.value, 0);
    const _movMedia = _totalRendaTributavel / _mesesN; const _compatRatio = _movMedia / rendaDeclarada;
    let _f7 = 0, _compatNivel = '', _conf7 = 0;
    if (_compatRatio > 6) { _f7 = 20; _compatNivel = 'severa'; _conf7 = 0.95; }
    else if (_compatRatio > 3) { _f7 = 12; _compatNivel = 'moderada'; _conf7 = 0.85; }
    else if (_compatRatio > 2) { _f7 = 6; _compatNivel = 'leve'; _conf7 = 0.7; }
    if (circularidade.length >= 4) _f7 = Math.round(_f7 * 0.6);
    if (_f7 > 0) { _fator(_f7, `Foram encontradas informações que merecem conferência — movimentação média de ${fmtBRL(_movMedia)}/mês é ${_compatRatio.toFixed(1)}x a renda declarada`, 'A Receita compara diretamente o volume de créditos bancários com o que foi declarado como renda. Uma diferença acima de 2x é sinal de alerta direto.', 'Não se caracteriza como risco quando parte da movimentação for de empréstimos, herança, venda de bens ou outras entradas não tributáveis documentadas.', _conf7, ['compat_renda'], 'F7_compatibilidade', 1.0); fatores[fatores.length - 1].evidencias = [{ ok: true, texto: `Movimentação média: ${fmtBRL(_movMedia)}/mês` }, { ok: true, texto: `Renda declarada: ${fmtBRL(rendaDeclarada)}/mês` }, { ok: _compatRatio > 2, texto: `Razão movimentação/renda: ${_compatRatio.toFixed(1)}x ${_compatNivel === 'severa' ? '(severa)' : _compatNivel === 'moderada' ? '(moderada)' : '(leve)'}` }]; }
  }

  // F8
  const _indiceConsumoScore = totalCredits > 0 ? totalDebits / totalCredits : 1;
  const _movMensalScore = totalCredits / Math.max(1, Object.keys(monthly).filter(k => k !== 'unk').length);
  if (_indiceConsumoScore < 0.05 && _movMensalScore > 14120) _fator(8, `Saídas representam apenas ${Math.round(_indiceConsumoScore * 100)}% das entradas`, 'Uma conta com muito mais entrada do que saída pode indicar conta auxiliar ou de passagem.', 'Não é risco se a conta for usada exclusivamente para recebimento e os valores forem transferidos para outra conta própria identificável.', 0.65, ['consumo_baixo']);

  // Score final
  const _rawScore = score;
  score = Math.round(100 * Math.log(1 + _rawScore) / Math.log(1 + 185));
  score = Math.min(100, Math.max(0, score));
  const evidencias = [infRatio > 0.2, monthsOverLimit > 0, especieRatio > 0.1, comercialOculta.length > 0, anomalias.length > 0, circularidade.length > 0, splitPix.length > 0];
  const confidence = calcConfidence(evidencias); const numEvidencias = evidencias.filter(Boolean).length;
  if (confidence < ENGINE_CONFIG.CONFIDENCE_REBAIXAR && score > 40) { score = Math.round(score * 0.7); fatores.push({ peso: 0, motivo: `Score ajustado: baixa confiança nos sinais detectados (${Math.round(confidence * 100)}%)` }); }
  if (score >= 70 && numEvidencias < ENGINE_CONFIG.MIN_EVIDENCIAS_ALTO_RISCO) { score = 69; fatores.push({ peso: 0, motivo: 'Indicador de atenção: múltiplas evidências necessárias para classificação de risco elevado' }); }
  score = Math.min(100, Math.max(0, score));
  const _nMesesFinal = Object.keys(monthly).filter(k => k !== 'unk').length;
  const extratoMuitoCurto = _nMesesFinal === 1; const extratoCurto = _nMesesFinal === 2;
  if (extratoMuitoCurto) fatores.push({ peso: 0, pesoOriginal: 0, severidade: 1, contexto: 1, motivo: 'Análise baseada em apenas 1 mês de extrato — precisão limitada', porqueImporta: 'Com apenas 1 mês não é possível calcular média histórica nem detectar anomalias temporais.', quandoNaoERisco: '', confianca: 0, evidencias: [{ ok: false, texto: 'Extrato de 1 mês: média histórica indisponível' }], tipo: 'aviso' });

  return { bank, totalTxns: txns.length, creditCount: credits.length, totalCredits, totalDebits, pixTotal, especieTotal, formalTotal, comercialTotal, suspCount: suspicious.length, attCount: attention.length, monthsOverLimit, months: _nMesesFinal, score, confidence, numEvidencias, classified, fatores, recorrentes, comercialOculta, anomalias, mediaHistorica, pico, circularidade, splitPix, internos, quarterly, perfil, mesCritico: perfil.mesCritico, indiceEspecie: especieRatio, indiceConsumo: totalCredits > 0 ? totalDebits / totalCredits : 0, extratoMuitoCurto, extratoCurto, parserConfidence: Math.round(parserConfidence * 100) / 100, txnsValidas: txnsValidas.length, txnsDescartadas, tipoAnalise: 'indicador_compatibilidade_fiscal', versaoEngine: 'v8.0', rendaDeclarada: rendaDeclarada || 0, perfilUsuario: perfilUsuario || null, mesesAnalisados: Object.keys(monthly).filter(k => k !== 'unk').length };
}

// ─── eConsolidate ──────────────────────────────────────────────────────────────

function eConsolidate(results) {
  if (!results || !Array.isArray(results)) return null;
  const _rv = results.filter(r => r && r.classified && Array.isArray(r.classified));
  if (_rv.length === 0) return { score: 0, confidence: 0, alerts: [], fatores: [], comercialOculta: [], totalCredits: 0, totalDebits: 0, pixTotal: 0, especieTotal: 0, suspCount: 0, attCount: 0, monthsOverLimit: 0, months: 0, tipoAnalise: 'indicador_compatibilidade_fiscal', versaoEngine: 'v8.0' };
  const allRaw = _rv.flatMap(r => r.classified);
  const allDedup = deduplicateCrossSource(allRaw);
  const allC = applyInternalDetection(allDedup);
  const credits = allC.filter(t => t.value > 0);
  const debits = allC.filter(t => t.value < 0);
  const suspicious = allC.filter(t => t.risk === 'suspicious' && t.value > 0);
  const attention = allC.filter(t => t.risk === 'attention' && t.value > 0);
  const totalCredits = credits.reduce((a, t) => a + t.value, 0);
  const totalDebits = Math.abs(debits.reduce((a, t) => a + t.value, 0));
  const pixTotal = credits.filter(t => t.cat === 'pix').reduce((a, t) => a + t.value, 0);
  const especieTotal = credits.filter(t => t.cat === 'especie').reduce((a, t) => a + t.value, 0);
  const formalTotal = credits.filter(t => t.cat === 'formal').reduce((a, t) => a + t.value, 0);
  const suspTotal = suspicious.reduce((a, t) => a + t.value, 0);
  const totalMOL = _rv.reduce((a, r) => a + r.monthsOverLimit, 0);
  const totalVol = _rv.reduce((a, r) => a + r.totalCredits, 0);
  let score = totalVol > 0 ? _rv.reduce((a, r) => a + r.score * (r.totalCredits / totalVol), 0) : _rv.reduce((a, r) => a + r.score, 0) / _rv.length;
  if (_rv.filter(r => r.score > 55).length >= 2) score = Math.min(100, score + 10);
  score = Math.round(score);
  const todosFatores = _rv.flatMap(r => r.fatores);
  const todasComerciais = _rv.flatMap(r => r.comercialOculta);
  const totalRecorrentes = _rv.reduce((a, r) => a + r.recorrentes.length, 0);
  const alerts = [];
  if (suspicious.length > 0) alerts.push({ type: 'red', icon: '🚨', title: `${suspicious.length} crédito(s) de alto risco — ${fmtBRL(suspTotal)}`, text: `Representam ${Math.round(suspTotal / totalCredits * 100)}% das entradas totais sem justificativa fiscal clara.` });
  if (totalMOL > 0) alerts.push({ type: 'red', icon: '⚠️', title: `Pix acima de R$5.000/mês em ${totalMOL} mês(es) — ${fmtBRL(pixTotal)} total`, text: `Movimentações mensais de Pix nesse patamar podem ser objeto de cruzamentos fiscais via sistema e-Financeira.` });
  if (especieTotal > 0) { const pctEspecie = Math.round(especieTotal / totalCredits * 100); alerts.push({ type: pctEspecie >= 20 ? 'red' : 'yellow', icon: '💵', title: `Depósitos em espécie: ${fmtBRL(especieTotal)} (${pctEspecie}% das entradas)`, text: `Depósitos em espécie acima de R$2.000/mês devem ser informados pelo banco à Receita.` }); }
  if (todasComerciais.length > 0) { const totalComercial = todasComerciais.reduce((a, r) => a + r.total, 0); alerts.push({ type: 'red', icon: '🏪', title: `${todasComerciais.length} padrão(ões) de atividade comercial recorrente — ${fmtBRL(totalComercial)}`, text: `Recebimentos com frequência e ticket médio regulares indicam possível atividade comercial.` }); }
  if (allC.some(t => t.flag === 'Investimento')) { const t = allC.filter(x => x.flag === 'Investimento').reduce((a, x) => a + x.value, 0); alerts.push({ type: 'yellow', icon: '📈', title: `Rendimentos de investimentos: ${fmtBRL(t)}`, text: `CDB, fundos, cripto e dividendos precisam ser declarados como rendimentos tributáveis ou isentos conforme o tipo.` }); }
  if (allC.some(t => t.flag === 'Aluguel')) { const t = allC.filter(x => x.flag === 'Aluguel').reduce((a, x) => a + x.value, 0); alerts.push({ type: 'yellow', icon: '🏠', title: `Recebimentos de aluguel: ${fmtBRL(t)}`, text: `Devem ser informados mensalmente no carnê-leão e na declaração anual.` }); }
  if (attention.length > 0 && suspicious.length === 0) alerts.push({ type: 'yellow', icon: '⚠️', title: `${attention.length} transação(ões) merecem revisão`, text: `Créditos que podem ser questionados. Tenha comprovantes de origem disponíveis.` });
  const internos = allC.filter(t => t.internalMove === 'confirmed' || t.internalMove === 'probable');
  if (internos.length > 0) { const totalInterno = internos.filter(t => t.value > 0).reduce((a, t) => a + t.value, 0); alerts.push({ type: 'green', icon: '🔁', title: `${internos.length} movimentação(ões) interna(s) — ${fmtBRL(totalInterno)} excluídos do score`, text: `Transferências entre contas do mesmo titular foram identificadas e excluídas do cálculo de risco.` }); }
  if (alerts.length === 0) alerts.push({ type: 'green', icon: '✅', title: 'Perfil de créditos dentro do esperado', text: `Nenhum crédito de alto risco encontrado nos ${_rv.length} extrato(s) analisados.` });
  if (todosFatores.length > 0) { const top3 = todosFatores.sort((a, b) => b.peso - a.peso).slice(0, 3); const explicacao = top3.map(f => `• ${f.motivo}`).join(' '); alerts.push({ type: 'blue', icon: '🧠', title: `Por que o score é ${score}%`, text: `O risco aumentou porque: ${explicacao}.` }); }
  alerts.push({ type: 'blue', icon: '💡', title: 'Próximo passo', text: `Compare os ${credits.length} créditos (${fmtBRL(totalCredits)}) com o total declarado no IR.` });
  return { score, totalCredits, totalDebits, pixTotal, especieTotal, formalTotal, suspCount: suspicious.length, attCount: attention.length, creditCount: credits.length, totalTxns: allC.length, indiceConsumo: totalCredits > 0 ? totalDebits / totalCredits : 0, indiceEspecie: totalCredits > 0 ? especieTotal / totalCredits : 0, recorrentes: totalRecorrentes, comercialOculta: todasComerciais.length, alerts, all: allC, fatores: todosFatores, internos, mesCritico: _rv[0]?.mesCritico || null, perfil: _rv[0]?.perfil || {}, parserConfidence: _rv.length > 0 ? _rv.reduce((a, r) => a + (r.parserConfidence || 0), 0) / _rv.length : 0, txnsDescartadas: _rv.reduce((a, r) => a + (r.txnsDescartadas || 0), 0), confidence: _rv.length > 0 ? _rv.reduce((a, r) => a + (r.confidence || 0), 0) / _rv.length : 0, numEvidencias: Math.max(..._rv.map(r => r.numEvidencias || 0)) };
}

// ─── Handler de mensagens ──────────────────────────────────────────────────────

self.onmessage = function (e) {
  const { type, payload } = e.data;

  if (type === 'ANALYZE') {
    try {
      const { grupos, rendaDeclarada, perfilUsuario } = payload;
      const grupoKeys = Object.keys(grupos);
      const results = [];

      for (let i = 0; i < grupoKeys.length; i++) {
        const g = grupos[grupoKeys[i]];
        self.postMessage({
          type: 'PROGRESS',
          payload: { pct: 70 + Math.round((i / grupoKeys.length) * 25), msg: `Analisando ${g.banco}...` }
        });

        // Reconstrói dates que foram serializadas pelo postMessage
        const txnsComDatas = g.txns.map(t => ({ ...t, date: t.date ? new Date(t.date) : null }));

        const fmtLabel = g.formatos && g.formatos.length > 1 ? ` [${g.formatos.join('+')}]` : '';
        const bankLabel = g.conta ? `${g.banco} ···${g.conta.slice(-4)}${fmtLabel}` : g.banco + fmtLabel;

        const r = eAnalyzeSingle(
          deduplicateTxns(txnsComDatas),
          bankLabel,
          rendaDeclarada || 0,
          perfilUsuario || null
        );
        if (r) results.push(r);
      }

      if (results.length === 0) {
        self.postMessage({ type: 'ERROR', payload: { message: 'Nenhum resultado gerado pelo motor fiscal.' } });
        return;
      }

      self.postMessage({ type: 'PROGRESS', payload: { pct: 95, msg: 'Consolidando...' } });
      const consolidated = eConsolidate(results);
      self.postMessage({ type: 'RESULT', payload: { consolidated, sources: results } });

    } catch (err) {
      self.postMessage({ type: 'ERROR', payload: { message: err.message } });
    }
  }
};
