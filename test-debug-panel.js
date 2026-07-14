// test-debug-panel.js
// [Fase 2b — ViewModel/Renderer do Painel de Debug]
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
  window.fbq = function () {};
  window.clarity = function () {};
  window.requestAnimationFrame = function (cb) { return setTimeout(cb, 0); };
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  const context = vm.createContext(window);
  vm.runInContext(src, context, { filename: 'app.js' });
  return window;
}

function mockC(overrides) {
  return Object.assign({ score: 33, totalTxns: 120, indiceConsumo: 0.61 }, overrides);
}

function mockSources() {
  return [
    { bank: 'Nubank', totalTxns: 80, score: 20 },
    { bank: 'Itaú', totalTxns: 40, score: 55 },
  ];
}

test('montarViewModelDebug é pura — não acessa document/window', () => {
  const srcOriginal = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  const inicio = srcOriginal.indexOf('function montarViewModelDebug');
  const corpo = srcOriginal.slice(inicio, srcOriginal.indexOf('function renderDebug'));
  assert.ok(!/document\./.test(corpo), 'montarViewModelDebug não deve referenciar document.*');
  assert.ok(!/window\.location/.test(corpo), 'montarViewModelDebug não deve ler window.location — a decisão de ambiente é de quem chama');
});

test('renderDebug não lê `c`, `sources` nem `_eConsolidated` — só o ViewModel', () => {
  const srcOriginal = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  const inicio = srcOriginal.indexOf('function renderDebug');
  const corpo = srcOriginal.slice(inicio, srcOriginal.indexOf('\n}', inicio) + 2);
  assert.ok(!/\bsources\b/.test(corpo));
  assert.ok(!/\bc\.\w/.test(corpo));
  assert.ok(!/_eConsolidated/.test(corpo));
});

test('modo ativo — serialização byte-a-byte igual ao formato original de pDbgPre', () => {
  const win = carregarAppNoContexto();
  const vmDebug = win.montarViewModelDebug(mockC(), mockSources(), null, true);
  assert.equal(vmDebug.ativo, true);
  const esperado = 'Motor: v8.0\nExtratos: 2\nTotal txns: 120\nÍndice de atenção: 33/100\nÍndice consumo: 61%\n[Nubank] 80 txns · índice 20/100\n[Itaú] 40 txns · índice 55/100';
  assert.equal(vmDebug.texto, esperado);
});

test('modo desativado — não monta texto (produção)', () => {
  const win = carregarAppNoContexto();
  const vmDebug = win.montarViewModelDebug(mockC(), mockSources(), null, false);
  assert.equal(vmDebug.ativo, false);
  assert.equal(vmDebug.texto, '');
});

test('ausência de dados — sources vazio não quebra e não lista extratos', () => {
  const win = carregarAppNoContexto();
  const vmDebug = win.montarViewModelDebug(mockC({ totalTxns: 0, score: 0 }), [], null, true);
  assert.equal(vmDebug.ativo, true);
  assert.equal(vmDebug.texto, 'Motor: v8.0\nExtratos: 0\nTotal txns: 0\nÍndice de atenção: 0/100\nÍndice consumo: 61%\n');
});

test('renderDebug — modo ativo preenche #pDbgPre com o texto do ViewModel', () => {
  const win = carregarAppNoContexto();
  win.document.body.innerHTML = '<pre id="pDbgPre"></pre>';
  const vmDebug = win.montarViewModelDebug(mockC(), mockSources(), null, true);
  win.renderDebug(vmDebug);
  assert.equal(win.document.getElementById('pDbgPre').textContent, vmDebug.texto);
  assert.match(win.document.getElementById('pDbgPre').textContent, /Nubank/);
});

test('renderDebug — modo desativado deixa #pDbgPre vazio (não preenche em produção)', () => {
  const win = carregarAppNoContexto();
  win.document.body.innerHTML = '<pre id="pDbgPre">lixo residual de uma análise anterior</pre>';
  const vmDebug = win.montarViewModelDebug(mockC(), mockSources(), null, false);
  win.renderDebug(vmDebug);
  assert.equal(win.document.getElementById('pDbgPre').textContent, '');
});

test('renderDebug — não quebra se #pDbgPre não existir no DOM', () => {
  const win = carregarAppNoContexto();
  win.document.body.innerHTML = '';
  assert.doesNotThrow(() => win.renderDebug({ ativo: true, texto: 'x' }));
});
