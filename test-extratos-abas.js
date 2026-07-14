// test-extratos-abas.js
// [Fase 2a — ViewModel/Renderer de Extratos e Abas de Banco]
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

function mockSources() {
  return [
    { bank: 'Nubank', months: 3, totalTxns: 40, totalCredits: 10000, score: 15, extratoMuitoCurto: false, extratoCurto: false },
    { bank: 'Itaú', months: 1, totalTxns: 5, totalCredits: 500, score: 55, extratoMuitoCurto: true, extratoCurto: false },
    { bank: 'BB', months: 2, totalTxns: 12, totalCredits: 2000, score: 80, extratoMuitoCurto: false, extratoCurto: true },
  ];
}

test('montarViewModelExtratos é pura — não acessa document/window', () => {
  const srcOriginal = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  const corpo = srcOriginal.slice(
    srcOriginal.indexOf('function montarViewModelExtratos'),
    srcOriginal.indexOf('function montarViewModelAbasBanco')
  );
  assert.ok(!/document\./.test(corpo));
  assert.ok(!/window\./.test(corpo));
});

test('montarViewModelAbasBanco é pura — não acessa document/window', () => {
  const srcOriginal = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  const corpo = srcOriginal.slice(
    srcOriginal.indexOf('function montarViewModelAbasBanco'),
    srcOriginal.indexOf('function _extratoItemHtml')
  );
  assert.ok(!/document\./.test(corpo));
  assert.ok(!/window\./.test(corpo));
});

test('renderExtratos e renderAbasBanco não leem `sources`/`c` — só o ViewModel', () => {
  const srcOriginal = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  for (const nome of ['renderExtratos', 'renderAbasBanco']) {
    const inicio = srcOriginal.indexOf('function ' + nome);
    const corpo = srcOriginal.slice(inicio, srcOriginal.indexOf('\n}', inicio) + 2);
    assert.ok(!/\bsources\b/.test(corpo), nome + ' não deveria referenciar `sources`');
    assert.ok(!/\bc\.\w/.test(corpo), nome + ' não deveria acessar campos de `c`');
  }
});

test('montarViewModelExtratos — mapeia banco/meses/transações/estado corretamente', () => {
  const win = carregarAppNoContexto();
  const vmExtratos = win.montarViewModelExtratos(mockSources());
  assert.equal(vmExtratos.length, 3);
  assert.deepEqual(vmExtratos.map(e => e.banco), ['Nubank', 'Itaú', 'BB']);
  assert.deepEqual(vmExtratos.map(e => e.meses), [3, 1, 2]);
  assert.deepEqual(vmExtratos.map(e => e.transacoes), [40, 5, 12]);
  assert.deepEqual(vmExtratos.map(e => e.estado), ['completo', 'muito_curto', 'curto']);
});

test('montarViewModelExtratos — nível do índice por faixa de score (20/45/70)', () => {
  const win = carregarAppNoContexto();
  const vmExtratos = win.montarViewModelExtratos(mockSources());
  assert.equal(vmExtratos[0].indiceAtencao.nivel, 'baixo');   // score 15
  assert.equal(vmExtratos[1].indiceAtencao.nivel, 'elevado'); // score 55
  assert.equal(vmExtratos[2].indiceAtencao.nivel, 'critico'); // score 80
});

test('montarViewModelExtratos — lista vazia não quebra', () => {
  const win = carregarAppNoContexto();
  // [Nota] Arrays vindos do contexto vm (jsdom) são de um realm diferente do
  // Node principal — Array.from() normaliza antes do deepEqual para evitar
  // falso-negativo por identidade de construtor entre realms.
  assert.deepEqual(Array.from(win.montarViewModelExtratos([])), []);
  assert.deepEqual(Array.from(win.montarViewModelExtratos(undefined)), []);
});

test('montarViewModelAbasBanco — sempre inclui "all" como primeira aba', () => {
  const win = carregarAppNoContexto();
  const abas = win.montarViewModelAbasBanco(mockSources());
  assert.equal(abas[0].id, 'all');
  assert.equal(abas[0].label, 'Todos');
  assert.deepEqual(Array.from(abas.slice(1).map(a => a.id)), ['Nubank', 'Itaú', 'BB']);
});

test('renderExtratos — popula #srcList a partir do ViewModel', () => {
  const win = carregarAppNoContexto();
  win.document.body.innerHTML = '<div id="srcList"></div>';
  const vmExtratos = win.montarViewModelExtratos(mockSources());
  win.renderExtratos(vmExtratos);
  const html = win.document.getElementById('srcList').innerHTML;
  assert.match(html, /Nubank/);
  assert.match(html, /Itaú/);
  assert.match(html, /BB/);
  assert.equal(win.document.querySelectorAll('.src-item').length, 3);
});

test('renderAbasBanco — popula #bankTabs com "Todos" marcado como ativo', () => {
  const win = carregarAppNoContexto();
  win.document.body.innerHTML = '<div id="bankTabs"></div>';
  const abas = win.montarViewModelAbasBanco(mockSources());
  win.renderAbasBanco(abas);
  const botoes = win.document.querySelectorAll('#bankTabs button');
  assert.equal(botoes.length, 4); // all + 3 bancos
  assert.equal(botoes[0].textContent, 'Todos');
  assert.ok(botoes[0].className.includes('on'));
  assert.ok(!botoes[1].className.includes('on'));
});
