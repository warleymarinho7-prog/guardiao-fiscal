'use strict';
// [Fase 2 — Homologação do pipeline] Harness compartilhado que carrega o
// app.js/index.html REAIS em um contexto vm+jsdom e expõe helpers para gerar
// transações sintéticas. Usado por test-homologacao-pipeline.js.
//
// [Nota] Datas DEVEM ser criadas com `new win.Date(...)` (o construtor do
// PRÓPRIO contexto vm), nunca `new Date(...)` do processo Node principal —
// checks de `instanceof Date` dentro do app.js (ex. classificarManifestacoes)
// falham silenciosamente em comparações cross-realm, fazendo manifestações
// sumirem sem erro nenhum. Este foi um bug real encontrado durante a
// homologação de USE_CAUSAL_RESULT_RENDERER — do harness, não do app.js.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

function carregarApp() {
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

function mkTxn(win, y, m, d, desc, value) {
  return { date: new win.Date(y, m - 1, d), desc, value };
}

module.exports = { carregarApp, mkTxn };
