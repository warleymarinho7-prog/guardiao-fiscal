// test-ponte-indice-manifestacao.js
// [Fase 2c — achado da homologação: índice elevado/crítico + 0 manifestações]
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
  window.requestAnimationFrame = cb => setTimeout(cb, 0);
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  const context = vm.createContext(window);
  vm.runInContext(src, context, { filename: 'app.js' });
  return window;
}

test('montarViewModelPonteIndiceManifestacao é pura — não acessa document/window', () => {
  const srcOriginal = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  const inicio = srcOriginal.indexOf('function montarViewModelPonteIndiceManifestacao');
  const corpo = srcOriginal.slice(inicio, srcOriginal.indexOf('function renderPonteIndiceManifestacao'));
  assert.ok(!/document\./.test(corpo));
  assert.ok(!/window\./.test(corpo));
});

test('mostra a ponte só quando nível é elevado/crítico E não há manifestações', () => {
  const win = carregarAppNoContexto();
  const casos = [
    { nivel: 'baixo', total: 0, esperado: false },
    { nivel: 'atencao', total: 0, esperado: true },
    { nivel: 'elevado', total: 0, esperado: true },
    { nivel: 'critico', total: 0, esperado: true },
    { nivel: 'elevado', total: 1, esperado: false },
    { nivel: 'critico', total: 2, esperado: false },
    { nivel: 'baixo', total: 1, esperado: false },
  ];
  for (const c of casos) {
    const vmObj = win.montarViewModelPonteIndiceManifestacao(c.nivel, c.total);
    assert.equal(vmObj.mostrar, c.esperado, `nivel=${c.nivel} total=${c.total}`);
    assert.equal(vmObj.texto.length > 0, c.esperado);
  }
});

test('ênfase visual: crítico é "forte" (âmbar), atenção/elevado são "neutra" (azul) — mesmo texto nos dois', () => {
  const win = carregarAppNoContexto();
  const critico = win.montarViewModelPonteIndiceManifestacao('critico', 0);
  const atencao = win.montarViewModelPonteIndiceManifestacao('atencao', 0);
  const elevado = win.montarViewModelPonteIndiceManifestacao('elevado', 0);
  assert.equal(critico.enfase, 'forte');
  assert.equal(atencao.enfase, 'neutra');
  assert.equal(elevado.enfase, 'neutra');
  assert.equal(critico.texto, atencao.texto, 'texto deve ser idêntico entre níveis — só a ênfase visual muda');
  assert.equal(critico.texto, elevado.texto);
});

test('renderPonteIndiceManifestacao — classe CSS reflete a ênfase, nunca usa vermelho (não deve parecer erro)', () => {
  const win = carregarAppNoContexto();
  win.document.body.innerHTML = '<div id="pManifestacoesList"></div>';
  win.renderPonteIndiceManifestacao({ mostrar: true, enfase: 'forte', texto: 'x' });
  let html = win.document.getElementById('pManifestacoesList').innerHTML;
  assert.match(html, /res-alert--yellow/);
  assert.ok(!/res-alert--red/.test(html));

  win.document.getElementById('pManifestacoesList').innerHTML = '';
  win.renderPonteIndiceManifestacao({ mostrar: true, enfase: 'neutra', texto: 'x' });
  html = win.document.getElementById('pManifestacoesList').innerHTML;
  assert.match(html, /res-alert--blue/);
  assert.ok(!/res-alert--red/.test(html));
});

test('renderPonteIndiceManifestacao — wrapper de texto tem flex:1;min-width:0 (evita overflow horizontal em mobile)', () => {
  // [Revisão mobile] Mesmo padrão de _alertaRiscoHtml/_alertaPositivoHtml —
  // sem min-width:0, um item flex com texto longo pode empurrar o card pra
  // fora da tela em telas estreitas.
  const win = carregarAppNoContexto();
  win.document.body.innerHTML = '<div id="pManifestacoesList"></div>';
  win.renderPonteIndiceManifestacao({ mostrar: true, enfase: 'neutra', texto: 'texto de teste' });
  const html = win.document.getElementById('pManifestacoesList').innerHTML;
  assert.match(html, /style="flex:1;min-width:0"/);
});

test('renderPonteIndiceManifestacao não escreve nada quando mostrar=false', () => {
  const win = carregarAppNoContexto();
  win.document.body.innerHTML = '<div id="pManifestacoesList">conteúdo existente</div>';
  win.renderPonteIndiceManifestacao({ mostrar: false, texto: '' });
  assert.equal(win.document.getElementById('pManifestacoesList').innerHTML, 'conteúdo existente');
});

test('renderPonteIndiceManifestacao acrescenta a nota quando mostrar=true, sem apagar o que já havia', () => {
  const win = carregarAppNoContexto();
  win.document.body.innerHTML = '<div id="pManifestacoesList"></div>';
  win.renderPonteIndiceManifestacao({ mostrar: true, texto: 'texto de teste da ponte' });
  const html = win.document.getElementById('pManifestacoesList').innerHTML;
  assert.match(html, /texto de teste da ponte/);
  assert.match(html, /Sinais de atenção sem manifestação causal específica/);
});

test('renderPonteIndiceManifestacao não quebra se #pManifestacoesList não existir', () => {
  const win = carregarAppNoContexto();
  win.document.body.innerHTML = '';
  assert.doesNotThrow(() => win.renderPonteIndiceManifestacao({ mostrar: true, texto: 'x' }));
});

test('integração — cenário "risco crítico sem manifestação" mostra a ponte no DOM causal', () => {
  const win = carregarAppNoContexto();
  const mkTxn = (y, m, d, desc, value) => ({ date: new win.Date(y, m - 1, d), desc, value });
  const txns = [];
  for (let i = 0; i < 4; i++) {
    txns.push(mkTxn(2026, i + 1, 5, 'PIX RECEBIDO CLIENTE', 12000));
    txns.push(mkTxn(2026, i + 1, 10, 'DEPOSITO EM ESPECIE', 4000));
    txns.push(mkTxn(2026, i + 1, 15, 'PIX RECEBIDO CLIENTE 2', 9000));
  }
  const r = win.eAnalyzeSingle(txns, 'Nubank', 1200 * 12, null);
  const c = win.eConsolidate([r]);
  const modelo = win.montarModeloDeResultado(c, [r]);
  assert.equal(modelo.manifestacoes.length, 0, 'pré-condição do cenário: sem manifestações');
  assert.ok(c.score > 70, 'pré-condição do cenário: score crítico (>70)');

  win.renderResultadoCausal(modelo);
  const vmIndice = win.montarViewModelIndiceComplementar(c, [r]);
  const vmPonte = win.montarViewModelPonteIndiceManifestacao(vmIndice.classificacao.nivel, modelo.manifestacoes.length);
  win.renderPonteIndiceManifestacao(vmPonte);

  const html = win.document.getElementById('pManifestacoesList').innerHTML;
  assert.match(html, /não sustentam uma hipótese fiscal individualizada/);
});

test('integração — cenário G real (score 42, faixa "atenção", 0 manifestações) também mostra a ponte', () => {
  // [Regressão] Este é o caso que a homologação pegou: score 42 cai na faixa
  // "atenção" (21-45), não "elevado" — a condição original só cobria
  // elevado/crítico e deixava esse caso sem explicação.
  const win = carregarAppNoContexto();
  const mkTxn = (y, m, d, desc, value) => ({ date: new win.Date(y, m - 1, d), desc, value });
  const txns = [];
  for (let i = 0; i < 4; i++) {
    txns.push(mkTxn(2026, i + 1, 3, 'TRANSFERENCIA ENTRE CONTAS PROPRIA MESMA TITULARIDADE', 1000));
    txns.push(mkTxn(2026, i + 1, 3, 'TRANSFERENCIA ENTRE CONTAS PROPRIA MESMA TITULARIDADE', -1000));
    txns.push(mkTxn(2026, i + 1, 10, 'RECEBIMENTO ALUGUEL IMOVEL', 1800));
    txns.push(mkTxn(2026, i + 1, 18, 'PIX RECEBIDO DESCONHECIDO', 11000));
  }
  const r = win.eAnalyzeSingle(txns, 'Nubank', 3000 * 12, null);
  const c = win.eConsolidate([r]);
  const modelo = win.montarModeloDeResultado(c, [r]);
  assert.equal(modelo.manifestacoes.length, 0, 'pré-condição: sem manifestações');

  win.renderResultadoCausal(modelo);
  const vmIndice = win.montarViewModelIndiceComplementar(c, [r]);
  assert.equal(vmIndice.classificacao.nivel, 'atencao', 'pré-condição: score cai na faixa "atenção", não "elevado"');
  const vmPonte = win.montarViewModelPonteIndiceManifestacao(vmIndice.classificacao.nivel, modelo.manifestacoes.length);
  win.renderPonteIndiceManifestacao(vmPonte);

  const html = win.document.getElementById('pManifestacoesList').innerHTML;
  assert.match(html, /não sustentam uma hipótese fiscal individualizada/);
});
