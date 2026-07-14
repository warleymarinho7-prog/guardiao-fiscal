// test-indice-complementar.js
// [Fase 1 — ViewModel/Renderer do Índice Complementar F1-F8]
// Segue o mesmo padrão dos testes existentes do projeto: Node native test
// runner + jsdom, carregando o app.js real (não uma reimplementação).
//
// Cobertura exigida pelo critério de conclusão da Fase 1:
//   - montarViewModelIndiceComplementar() não acessa DOM
//   - renderIndiceComplementar() não lê `c`
//   - score, limites de nível (20/45/70), ordenação de fatores, filtros de
//     alertas, e ausência de dados (fatores=[], alertas=[])
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

function carregarAppNoContexto() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.test/', runScripts: 'outside-only' });
  const { window } = dom;
  // Stubs mínimos que o app.js espera do ambiente real do browser e que não
  // existem em jsdom / não são relevantes para as funções puras testadas aqui.
  window.fbq = function () {};
  window.clarity = function () {};
  window.requestAnimationFrame = function (cb) { return setTimeout(cb, 0); };
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  const context = vm.createContext(window);
  vm.runInContext(src, context, { filename: 'app.js' });
  return window;
}

// Motor consolidado (`c`) mínimo e válido para os testes — mesmo shape que
// eConsolidate() produz, reduzido aos campos que montarViewModelIndiceComplementar usa.
function mockC(overrides) {
  return Object.assign({
    score: 10,
    totalCredits: 10000,
    creditCount: 20,
    suspCount: 0,
    pixTotal: 1000,
    totalTxns: 40,
    alerts: [],
    extratoMuitoCurto: false,
    indiceConsumo: 0.5,
  }, overrides);
}

function mockSources(overrides) {
  return overrides || [{ bank: 'Nubank', months: 3, fatores: [] }];
}

test('montarViewModelIndiceComplementar é pura — não acessa document/window', () => {
  const win = carregarAppNoContexto();
  const srcOriginal = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  const corpo = srcOriginal.slice(
    srcOriginal.indexOf('function montarViewModelIndiceComplementar'),
    srcOriginal.indexOf('const _RISK_DOT_VAR')
  );
  assert.ok(!/document\./.test(corpo), 'montarViewModelIndiceComplementar não deve referenciar document.*');
  assert.ok(!/window\./.test(corpo), 'montarViewModelIndiceComplementar não deve referenciar window.*');
});

test('renderIndiceComplementar não lê `c` (parâmetro do motor bruto) — só o ViewModel', () => {
  const srcOriginal = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  const inicio = srcOriginal.indexOf('function renderIndiceComplementar');
  const corpo = srcOriginal.slice(inicio, srcOriginal.indexOf('\n}', inicio) + 2);
  // A única variável de entrada deve ser `vm` — nunca `c.` ou `sources.`
  assert.ok(!/\bc\.\w/.test(corpo), 'renderIndiceComplementar não deve acessar campos de `c`');
  assert.ok(!/\bsources\./.test(corpo), 'renderIndiceComplementar não deve acessar `sources`');
});

test('score e classificação — limites de nível (20/45/70)', () => {
  const win = carregarAppNoContexto();
  const casos = [
    { score: 0, nivelEsperado: 'baixo' },
    { score: 20, nivelEsperado: 'baixo' },
    { score: 21, nivelEsperado: 'atencao' },
    { score: 45, nivelEsperado: 'atencao' },
    { score: 46, nivelEsperado: 'elevado' },
    { score: 70, nivelEsperado: 'elevado' },
    { score: 71, nivelEsperado: 'critico' },
    { score: 100, nivelEsperado: 'critico' },
  ];
  for (const caso of casos) {
    const vmObj = win.montarViewModelIndiceComplementar(mockC({ score: caso.score }), mockSources());
    assert.equal(vmObj.score, caso.score);
    assert.equal(vmObj.classificacao.nivel, caso.nivelEsperado, `score ${caso.score} deveria mapear para nível ${caso.nivelEsperado}`);
  }
});

test('fatores — ordenados por peso decrescente e limitados a 6', () => {
  const win = carregarAppNoContexto();
  const fatores = [
    { peso: 5, motivo: 'A.', fatorKey: 'F2_pix_limite', evidencias: [] },
    { peso: 25, motivo: 'B.', fatorKey: 'F1_omissao_renda', evidencias: [] },
    { peso: 15, motivo: 'C.', fatorKey: 'F3_especie', evidencias: [] },
    { peso: 30, motivo: 'D.', fatorKey: 'F4_comercial_oculta', evidencias: [] },
    { peso: 1, motivo: 'E.', fatorKey: 'F5_anomalia_temporal', evidencias: [] },
    { peso: 12, motivo: 'F.', fatorKey: 'F7_compatibilidade', evidencias: [] },
    { peso: 8, motivo: 'G.', fatorKey: 'F8_conta_auxiliar', evidencias: [] },
    { peso: 0, tipo: 'aviso', motivo: 'H.', evidencias: [] }, // aviso entra mesmo com peso 0
  ];
  const sources = [{ bank: 'Nubank', months: 3, fatores }];
  const vmObj = win.montarViewModelIndiceComplementar(mockC(), sources);
  const pesos = vmObj.fatores.map(f => f.peso);
  assert.deepEqual(pesos, [30, 25, 15, 12, 8, 5], 'deve ordenar por peso desc e cortar em 6 — o de peso 1 e o aviso de peso 0 ficam de fora do top 6');
  assert.equal(vmObj.fatores[0].titulo, 'D');
  assert.equal(vmObj.fatores[0].fundamento, 'Recebimentos recorrentes sem nota fiscal ou CNPJ são gatilho de fiscalização.');
});

test('fatores — item tipo "aviso" entra na lista mesmo com peso 0, badge correto', () => {
  const win = carregarAppNoContexto();
  const sources = [{ bank: 'Nubank', months: 3, fatores: [
    { peso: 0, tipo: 'aviso', motivo: 'Extrato curto.', evidencias: [] },
  ] }];
  const vmObj = win.montarViewModelIndiceComplementar(mockC(), sources);
  assert.equal(vmObj.fatores.length, 1);
  assert.equal(vmObj.fatores[0].badge.tipo, 'aviso');
});

test('fatores — badges por faixa de peso', () => {
  const win = carregarAppNoContexto();
  const sources = [{ bank: 'X', months: 1, fatores: [
    { peso: 25, motivo: 'a.', evidencias: [] },
    { peso: 15, motivo: 'b.', evidencias: [] },
    { peso: 5, motivo: 'c.', evidencias: [] },
    { peso: 1, motivo: 'd.', evidencias: [] },
  ] }];
  const vmObj = win.montarViewModelIndiceComplementar(mockC(), sources);
  const badgesPorPeso = Object.fromEntries(vmObj.fatores.map(f => [f.peso, f.badge.tipo]));
  assert.equal(badgesPorPeso[25], 'critico');
  assert.equal(badgesPorPeso[15], 'moderado');
  assert.equal(badgesPorPeso[5], 'atencao');
  assert.equal(badgesPorPeso[1], 'ok');
});

test('alertas — riscos (não-verdes) e positivos (verdes) separados corretamente', () => {
  const win = carregarAppNoContexto();
  const alerts = [
    { type: 'red', title: 'Crítico 1', text: 'x', icon: '<i></i>' },
    { type: 'yellow', title: 'Atenção 1', text: 'y', icon: '<i></i>' },
    { type: 'green', title: 'Positivo 1', icon: '<i></i>' },
    { type: 'blue', title: 'Info 1', text: 'z', icon: '<i></i>' },
  ];
  const vmObj = win.montarViewModelIndiceComplementar(mockC({ alerts }), mockSources());
  assert.equal(vmObj.alertas.riscos.length, 3);
  assert.equal(vmObj.alertas.positivos.length, 1);
  assert.equal(vmObj.alertas.positivos[0].titulo, 'Positivo 1');
  const tipos = vmObj.alertas.riscos.map(a => a.tipo);
  assert.deepEqual(tipos, ['critico', 'atencao', 'info']);
  assert.equal(vmObj.alertas.riscos[0].badge, 'Crítico');
  assert.equal(vmObj.alertas.riscos[1].badge, 'Atenção');
  assert.equal(vmObj.alertas.riscos[2].badge, null);
});

test('ausência de dados — sem fatores e sem alertas retorna arrays vazios (não quebra)', () => {
  const win = carregarAppNoContexto();
  const vmObj = win.montarViewModelIndiceComplementar(mockC({ alerts: [] }), [{ bank: 'X', months: 1, fatores: [] }]);
  assert.deepEqual(vmObj.fatores, []);
  assert.deepEqual(vmObj.alertas.riscos, []);
  assert.deepEqual(vmObj.alertas.positivos, []);
  assert.equal(vmObj.resumo.pontosAtencao, 0);
});

test('resumo — extratos/transações/meses/pontosAtencao calculados corretamente', () => {
  const win = carregarAppNoContexto();
  const sources = [
    { bank: 'Nubank', months: 2, fatores: [{ peso: 5, motivo: 'a.', evidencias: [] }] },
    { bank: 'Itaú', months: 3, fatores: [{ peso: 0, motivo: 'b.', evidencias: [] }] }, // peso 0, não conta
  ];
  const vmObj = win.montarViewModelIndiceComplementar(mockC({ totalTxns: 77 }), sources);
  assert.equal(vmObj.resumo.extratos, 2);
  assert.equal(vmObj.resumo.transacoes, 77);
  assert.equal(vmObj.resumo.meses, 5);
  assert.equal(vmObj.resumo.pontosAtencao, 1);
});

test('estatísticas — cores condicionais (suspCount e % Pix)', () => {
  const win = carregarAppNoContexto();
  const semRisco = win.montarViewModelIndiceComplementar(mockC({ suspCount: 0, pixTotal: 0, totalCredits: 1000 }), mockSources());
  assert.equal(semRisco.estatisticas[1].cor, 'green');
  assert.equal(semRisco.estatisticas[2].cor, 'neutral');

  const comRisco = win.montarViewModelIndiceComplementar(mockC({ suspCount: 3, pixTotal: 600, totalCredits: 1000 }), mockSources());
  assert.equal(comRisco.estatisticas[1].cor, 'red');
  assert.equal(comRisco.estatisticas[2].cor, 'red'); // 60% >= 50%

  const pixModerado = win.montarViewModelIndiceComplementar(mockC({ pixTotal: 350, totalCredits: 1000 }), mockSources());
  assert.equal(pixModerado.estatisticas[2].cor, 'yellow'); // 35% entre 30 e 50
});

test('renderIndiceComplementar — popula o DOM a partir do ViewModel (integração leve)', () => {
  const win = carregarAppNoContexto();
  const doc = win.document;
  doc.body.innerHTML = `
    <div id="pContextoBlock"></div>
    <div id="pStatsGrid"></div>
    <div id="pFatoresList"></div>
    <div id="pAlertList"></div>
  `;
  const c = mockC({ score: 55, suspCount: 2, alerts: [{ type: 'red', title: 'Risco X', text: 'txt', icon: '<i></i>' }], extratoMuitoCurto: true });
  const sources = [{ bank: 'Nubank', months: 2, fatores: [{ peso: 20, motivo: 'Motivo.', fatorKey: 'F1_omissao_renda', evidencias: [{ ok: true, texto: 'ev' }] }] }];
  const vmObj = win.montarViewModelIndiceComplementar(c, sources);
  win.renderIndiceComplementar(vmObj);

  assert.match(doc.getElementById('pContextoBlock').innerHTML, /55/);
  assert.match(doc.getElementById('pContextoBlock').innerHTML, /elevado/);
  assert.equal(doc.getElementById('pStatsGrid').querySelectorAll('.p-stat').length, 3);
  assert.match(doc.getElementById('pFatoresList').innerHTML, /Fatores técnicos/);
  assert.match(doc.getElementById('pAlertList').innerHTML, /Risco X/);
  // Aviso de extrato curto inserido ANTES de pAlertList, como sibling
  assert.match(doc.getElementById('pAlertList').previousElementSibling.className, /res-alert--yellow/);
});

test('IDs mortos (ovEmoji/ovLevel/ovSub/pScoreVal/pCausasTop) não existem mais no app.js', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  for (const id of ['ovEmoji', 'ovLevel', 'ovSub', 'pScoreVal', 'pCausasTop']) {
    assert.ok(!src.includes(id), `${id} não deveria mais existir em app.js`);
  }
});
