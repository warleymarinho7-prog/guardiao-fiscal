// tests/_harness.js
//
// Guardião Fiscal — Livro III, Cap. 12 (Arquitetura de Testes)
//
// Por que este arquivo existe:
//   O Cap. 12.5 exige que o Engine seja testável "sem navegador, sem DOM,
//   sem HTML, sem componentes". O app.js real ainda não está fisicamente
//   separado em módulos (Engine/Parser/Renderer) — essa reorganização foi
//   deliberadamente adiada (ver decisão registrada sobre não reorganizar
//   fisicamente o app.js em zonas durante o sprint atual).
//
//   Este harness resolve a tensão sem violar essa decisão: carrega o
//   app.js **exatamente como ele é hoje**, dentro de um DOM simulado
//   (jsdom), e expõe as funções puras do Motor/Parser/Contrato para
//   serem testadas isoladamente. Nenhuma linha do app.js é copiada,
//   movida ou reescrita — o teste sempre roda contra o código real.
//
//   Os handlers de DOMContentLoaded presentes no app.js NUNCA são
//   disparados aqui, então nada de rede (Supabase, Mercado Pago, Meta
//   Pixel) é acionado durante os testes.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function loadApp() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');

  const dom = new JSDOM(
    '<!doctype html><html><body>' +
      '<div id="app"></div>' +
      '<div id="navAuthArea"></div>' + // setUser(null) roda no top-level do app.js
    '</body></html>',
    {
      url: 'https://oguardiaofiscal.com.br/',
      runScripts: 'outside-only',
    }
  );

  const { window } = dom;

  // Guarda mínima para globais opcionais que o app.js checa com typeof
  // antes de usar (supabase, fbq, Tone etc.) — não precisam existir de
  // verdade para que as funções puras do Engine/Parser sejam testáveis.
  window.eval(src);

  return window;
}

module.exports = { loadApp };
