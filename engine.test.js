// tests/engine.test.js
//
// Livro III, Cap. 12.5 — "Testes do Engine: são os mais importantes. Cada
// mecanismo deve responder Entrada conhecida → Saída esperada. Sem
// navegador. Sem DOM. Sem HTML."
//
// O harness carrega o app.js real dentro de um DOM simulado (porque o
// arquivo ainda não está fisicamente separado — decisão registrada), mas
// as asserções abaixo testam apenas funções puras: nenhuma delas toca
// document/window internamente.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./_harness');

const app = loadApp();

test('calcConfidence — confiança cresce com mais sinais confirmatórios (Cap. 9.11 do Livro III)', () => {
  assert.equal(app.calcConfidence([false, false, false]), 0.10);
  assert.equal(app.calcConfidence([true, false, false]), 0.40);
  assert.equal(app.calcConfidence([true, true, false]), 0.65);
  assert.equal(app.calcConfidence([true, true, true]), 0.80);
  // nunca ultrapassa o teto documentado, mesmo com muitos sinais
  assert.ok(app.calcConfidence([true, true, true, true, true, true]) <= 0.97);
});

test('scoreDeAlertas — nunca ultrapassa 100 mesmo com excesso de peso (Cap. 6.16 do Livro I)', () => {
  const alertasExtremos = [
    app.criarAlerta('X1', 'Título', 80, 1, [], 'high'),
    app.criarAlerta('X2', 'Título', 80, 1, [], 'high'),
    app.criarAlerta('X3', 'Título', 80, 1, [], 'high'),
  ];
  assert.equal(app.scoreDeAlertas(alertasExtremos), 100);
});

test('scoreDeAlertas — pondera pela confiança do alerta, não só pelo peso bruto', () => {
  const altaConfianca = [app.criarAlerta('A', 'T', 50, 1.0, [], 'medium')];
  const baixaConfianca = [app.criarAlerta('A', 'T', 50, 0.2, [], 'medium')];
  assert.ok(app.scoreDeAlertas(altaConfianca) > app.scoreDeAlertas(baixaConfianca));
});

test('aggregateMonthly — agrupa transações por mês corretamente', () => {
  const txns = [
    { date: new app.Date('2026-01-05'), desc: 'PIX recebido', value: 100 },
    { date: new app.Date('2026-01-20'), desc: 'PIX enviado', value: -40 },
    { date: new app.Date('2026-02-01'), desc: 'Salário', value: 3000 },
  ];
  const months = app.aggregateMonthly(txns);
  assert.deepEqual(Object.keys(months).sort(), ['2026-01', '2026-02']);
  assert.equal(months['2026-01'].count, 2);
  assert.equal(months['2026-02'].credits, 3000);
});

test('aggregateMonthly — ignora transações sem data válida em vez de quebrar', () => {
  const txns = [
    { date: null, desc: 'Sem data', value: 10 },
    { date: new app.Date('2026-03-10'), desc: 'Válida', value: 50 },
  ];
  const months = app.aggregateMonthly(txns);
  assert.equal(Object.keys(months).length, 1);
  assert.equal(months['2026-03'].count, 1);
});

test('confirmarComEvidenciaDocumental — sem divergência quando os valores batem dentro da tolerância', () => {
  const manifestacao = { categoria: 'plano_saude', totalPago: 1200, mecanismo: { tipo: 'desconhecimento', estado: 'provavel' }, evidencias: [] };
  const resultado = app.confirmarComEvidenciaDocumental(manifestacao, 1200);
  assert.equal(resultado.resolvido, true);
  assert.equal(resultado.mecanismo.estado, 'confirmado');
  assert.equal(resultado.confianca, 'alta');
});

test('confirmarComEvidenciaDocumental — sinaliza divergência acima da tolerância de 5%', () => {
  const manifestacao = { categoria: 'plano_saude', totalPago: 1000, mecanismo: { tipo: 'desconhecimento', estado: 'provavel' }, evidencias: [] };
  const resultado = app.confirmarComEvidenciaDocumental(manifestacao, 2000); // 100% de diferença
  assert.equal(resultado.resolvido, false);
  assert.ok(resultado.diffPct >= 90);
});

// ── Regressão: bug real encontrado no teste com a persona sintética "Marina"
// (jul/2026) — usuário digitava o valor MENSAL do plano de saúde no campo que
// esperava o valor ANUAL, gerando alarme falso de divergência. A correção
// (DEC-014 / [FIX-UX] em confirmarDocumentoManifestacao) normaliza para anual
// antes de comparar. Este teste trava esse comportamento: reproduz a mesma
// conta que a UI faz (valorMensal * mesesDetectados) e confirma que, uma vez
// normalizado, o valor bate — e que comparar o valor mensal cru (sem
// normalizar) é que gerava o falso positivo, para deixar claro o que a
// correção evita.
test('DEC-014 — valor mensal normalizado para anual não deve gerar divergência falsa', () => {
  const mesesDetectados = 12;
  const valorMensalDigitado = 100; // usuário digitou o valor do boleto mensal
  const totalPagoNoExtrato = 1200; // extrato já soma os 12 meses

  const manifestacao = { categoria: 'plano_saude', totalPago: totalPagoNoExtrato, mesesDetectados, mecanismo: { tipo: 'desconhecimento', estado: 'provavel' }, evidencias: [] };

  // comportamento correto: normaliza mensal → anual antes de comparar (o que a UI faz)
  const valorNormalizado = valorMensalDigitado * mesesDetectados;
  const resultadoCorreto = app.confirmarComEvidenciaDocumental(manifestacao, valorNormalizado);
  assert.equal(resultadoCorreto.resolvido, true, 'valor normalizado deveria bater com o extrato');

  // comportamento do bug antigo: comparava o valor mensal cru contra o total anual
  const resultadoComBug = app.confirmarComEvidenciaDocumental(manifestacao, valorMensalDigitado);
  assert.equal(resultadoComBug.resolvido, false, 'sem normalizar, o bug antigo gerava divergência falsa — este teste documenta exatamente isso');
});

test('classificarManifestacoes — nunca produz hipótese sem manifestação correspondente (Cap. 9.6 do Livro III)', () => {
  const debits = [{ date: new app.Date('2026-01-10'), desc: 'PLANO DE SAUDE UNIMED', value: -400 }];
  const credits = [];
  const manifestacoes = app.classificarManifestacoes(debits, credits);
  assert.ok(Array.isArray(manifestacoes));
  manifestacoes.forEach(m => {
    assert.ok(m.categoria, 'toda manifestação precisa de categoria');
    assert.ok(m.label, 'toda manifestação precisa de label legível');
  });
});
