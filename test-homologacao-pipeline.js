// test-homologacao-pipeline.js
// [Fase 2 — Homologação USE_CAUSAL_RESULT_RENDERER, jul/2026]
// Protege a fronteira mais importante do sistema: transações → motor →
// consolidação → Contrato → renderers. Roda o pipeline REAL (não mocks) para
// cenários fixos e verifica que o Contrato substitui o objeto bruto sem
// perder informação, coerência ou comportamento (mesmo critério usado na
// homologação manual desta flag).
//
// Escopo desta suíte: tudo que dá pra automatizar sem browser real ou backend
// (Supabase). NÃO cobre: paywall (usuário gratuito/pago), responsividade
// mobile/desktop, nem o painel de feedback — esses continuam manuais.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregarApp, mkTxn } = require('./pipeline-harness-motor.js');

// Roda o cenário pelo pipeline real e devolve tudo que os testes precisam
// inspecionar — sem decidir sozinho o que é sucesso/falha (isso fica nos
// asserts de cada test(), não aqui).
function rodarPipeline(buildTxnsPorFonte) {
  const win = carregarApp();
  const fontes = buildTxnsPorFonte(win, mkTxn);
  const sources = fontes.map(f => win.eAnalyzeSingle(f.txns, f.bank, f.renda, null));
  const c = win.eConsolidate(sources);
  const modelo = win.montarModeloDeResultado(c, sources);
  const validacao = win.validarContrato(modelo);

  const erros = [];
  const origError = win.console.error;
  win.console.error = (...args) => erros.push(args.map(String).join(' '));

  win.renderResultadoCausal(modelo);
  const vmIndice = win.montarViewModelIndiceComplementar(c, sources);
  win.renderIndiceComplementar(vmIndice);
  win.renderExtratos(win.montarViewModelExtratos(sources));
  win.renderAbasBanco(win.montarViewModelAbasBanco(sources));
  const vmPonte = win.montarViewModelPonteIndiceManifestacao(vmIndice.classificacao.nivel, modelo.manifestacoes.length);
  win.renderPonteIndiceManifestacao(vmPonte);

  win.console.error = origError;

  // Comparação lado a lado com o legado (mesmo `c`, outro caminho). O legado
  // faz early-return SEM limpar a lista quando não há manifestações — por
  // isso o DOM precisa ser resetado manualmente antes, senão sobra conteúdo
  // do render causal anterior e a comparação fica falsa.
  win.document.getElementById('pManifestacoesList').innerHTML = '';
  win.renderManifestacoesPilar1(c);
  const legadoMostrouManifestacoes = win.document.getElementById('pManifestacoesList').innerHTML.trim().length > 0;
  // Re-renderiza o causal por cima (o legado sobrescreveu #pManifestacoesList)
  win.renderResultadoCausal(modelo);
  // Captura ANTES da ponte — comparação legado×causal deve olhar só pra
  // manifestações, não pra ponte explicativa (que é um bloco à parte).
  const causalManifestacoesHtml = win.document.getElementById('pManifestacoesList').innerHTML;
  win.renderPonteIndiceManifestacao(vmPonte);
  const causalHtml = win.document.getElementById('pManifestacoesList').innerHTML;

  return { win, c, sources, modelo, validacao, erros, vmIndice, vmPonte, causalHtml, causalManifestacoesHtml, legadoMostrouManifestacoes };
}

function asserirInvariantesBasicas(t, nome, r) {
  assert.equal(r.validacao.valido, true, `[${nome}] Contrato inválido: ${JSON.stringify(r.validacao.erros)}`);
  assert.equal(r.erros.length, 0, `[${nome}] console.error disparado: ${r.erros.join(' | ')}`);
  assert.match(r.win.document.getElementById('pContextoBlock').innerHTML, /Índice interno de atenção/, `[${nome}] índice deixou de estar rotulado como complementar`);
  const abas = r.win.document.querySelectorAll('#bankTabs button');
  assert.equal(abas.length, r.sources.length + 1, `[${nome}] abas de banco não batem com as fontes`);
  const extratos = r.win.document.querySelectorAll('#srcList .src-item');
  assert.equal(extratos.length, r.sources.length, `[${nome}] itens de extrato não batem com as fontes`);
  (r.modelo.proximosPassos || []).forEach(p => {
    const origemValida = !p.categoria || (r.modelo.manifestacoes || []).some(m => m.categoria === p.categoria);
    assert.ok(origemValida, `[${nome}] próximo passo sem manifestação correspondente: ${JSON.stringify(p)}`);
  });
  const causalMostrouManifestacoes = r.causalManifestacoesHtml.trim().length > 0;
  assert.equal(causalMostrouManifestacoes, r.legadoMostrouManifestacoes, `[${nome}] legado e causal divergem sobre mostrar manifestações`);
}

test('A) sem manifestações — pipeline real, contrato válido, sem erros', () => {
  const r = rodarPipeline((win, mk) => [{
    bank: 'Nubank', renda: 18000 * 4,
    txns: Array.from({ length: 4 }, (_, i) => [
      mk(win, 2026, i + 1, 5, 'TRANSFERENCIA PIX RECEBIDA JOAO', 1500),
      mk(win, 2026, i + 1, 12, 'COMPRA CARTAO MERCADO', -800),
    ]).flat(),
  }]);
  asserirInvariantesBasicas(null, 'A', r);
  assert.equal(r.modelo.manifestacoes.length, 0);
});

test('B) risco baixo — pipeline real, contrato válido, sem erros', () => {
  const r = rodarPipeline((win, mk) => [{
    bank: 'Nubank', renda: 4000 * 12,
    txns: Array.from({ length: 4 }, (_, i) => [
      mk(win, 2026, i + 1, 5, 'SALARIO EMPRESA XPTO LTDA', 4000),
      mk(win, 2026, i + 1, 12, 'COMPRA CARTAO MERCADO', -1200),
    ]).flat(),
  }]);
  asserirInvariantesBasicas(null, 'B', r);
  assert.equal(r.vmIndice.classificacao.nivel, 'baixo');
  assert.equal(r.vmPonte.mostrar, false);
});

test('C) risco moderado — pipeline real, contrato válido, sem erros', () => {
  const r = rodarPipeline((win, mk) => [{
    bank: 'Nubank', renda: 3000 * 12,
    txns: Array.from({ length: 4 }, (_, i) => [
      mk(win, 2026, i + 1, 5, 'SALARIO EMPRESA XPTO LTDA', 3000),
      mk(win, 2026, i + 1, 15, 'PIX RECEBIDO MARIA', 6000),
      mk(win, 2026, i + 1, 20, 'COMPRA CARTAO MERCADO', -1200),
    ]).flat(),
  }]);
  asserirInvariantesBasicas(null, 'C', r);
});

test('D) risco crítico sem manifestação — ponte explicativa aparece (achado da homologação)', () => {
  const r = rodarPipeline((win, mk) => [{
    bank: 'Nubank', renda: 1200 * 12,
    txns: Array.from({ length: 4 }, (_, i) => [
      mk(win, 2026, i + 1, 5, 'PIX RECEBIDO CLIENTE', 12000),
      mk(win, 2026, i + 1, 10, 'DEPOSITO EM ESPECIE', 4000),
      mk(win, 2026, i + 1, 15, 'PIX RECEBIDO CLIENTE 2', 9000),
    ]).flat(),
  }]);
  asserirInvariantesBasicas(null, 'D', r);
  assert.equal(r.modelo.manifestacoes.length, 0);
  assert.ok(r.c.score > 70, 'pré-condição do cenário: score crítico');
  assert.equal(r.vmPonte.mostrar, true, 'score crítico sem manifestação DEVE mostrar a ponte explicativa');
  assert.match(r.causalHtml, /não sustentam uma hipótese fiscal individualizada/);
});

test('E) extrato curto (1 mês) — pipeline real, contrato válido, sem erros', () => {
  const r = rodarPipeline((win, mk) => [{
    bank: 'Nubank', renda: 4000 * 12,
    txns: [
      mk(win, 2026, 6, 5, 'SALARIO EMPRESA XPTO LTDA', 4000),
      mk(win, 2026, 6, 12, 'COMPRA CARTAO MERCADO', -1200),
    ],
  }]);
  asserirInvariantesBasicas(null, 'E', r);
  assert.equal(r.sources[0].extratoMuitoCurto, true);
});

test('F) múltiplos bancos — pipeline real, contrato válido, sem erros', () => {
  const r = rodarPipeline((win, mk) => [
    {
      bank: 'Nubank', renda: 3500 * 12,
      txns: Array.from({ length: 4 }, (_, i) => [
        mk(win, 2026, i + 1, 5, 'SALARIO EMPRESA XPTO LTDA', 3500),
        mk(win, 2026, i + 1, 12, 'COMPRA CARTAO MERCADO', -900),
      ]).flat(),
    },
    {
      bank: 'Itaú', renda: 3500 * 12,
      txns: Array.from({ length: 4 }, (_, i) => [
        mk(win, 2026, i + 1, 8, 'PIX RECEBIDO CLIENTE', 2500),
        mk(win, 2026, i + 1, 20, 'PAGAMENTO ALUGUEL', -1100),
      ]).flat(),
    },
  ]);
  asserirInvariantesBasicas(null, 'F', r);
  assert.equal(r.sources.length, 2);
});

test('G) alertas positivos e negativos, faixa "atenção" sem manifestação — ponte aparece', () => {
  const r = rodarPipeline((win, mk) => [{
    bank: 'Nubank', renda: 3000 * 12,
    txns: Array.from({ length: 4 }, (_, i) => [
      mk(win, 2026, i + 1, 3, 'TRANSFERENCIA ENTRE CONTAS PROPRIA MESMA TITULARIDADE', 1000),
      mk(win, 2026, i + 1, 3, 'TRANSFERENCIA ENTRE CONTAS PROPRIA MESMA TITULARIDADE', -1000),
      mk(win, 2026, i + 1, 10, 'RECEBIMENTO ALUGUEL IMOVEL', 1800),
      mk(win, 2026, i + 1, 18, 'PIX RECEBIDO DESCONHECIDO', 11000),
    ]).flat(),
  }]);
  asserirInvariantesBasicas(null, 'G', r);
  const tipos = new Set((r.c.alerts || []).map(a => a.type));
  assert.ok(tipos.has('green'), 'cenário deveria gerar ao menos um alerta positivo');
  assert.ok(tipos.has('red') || tipos.has('yellow'), 'cenário deveria gerar ao menos um alerta negativo');
  // [Regressão] score 42 cai na faixa "atenção" (21-45), não "elevado" — este
  // é o caso que a homologação pegou e que motivou ampliar a condição da ponte.
  assert.equal(r.vmIndice.classificacao.nivel, 'atencao');
  assert.equal(r.modelo.manifestacoes.length, 0);
  assert.equal(r.vmPonte.mostrar, true);
  assert.match(r.causalHtml, /não sustentam uma hipótese fiscal individualizada/);
});
