// dedup.js — deduplicação de transações

// ===== PARSER V3 ENGINE =====
// workerSrc: gerenciado por _loadPdfJs()

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

