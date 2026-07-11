// tests/contract.test.js
//
// Livro III, Cap. 6.9 e Cap. 6 "Contract Validation Layer" — garante que o
// contrato entregue pelo Motor ao Renderer sempre possui a estrutura mínima
// obrigatória, e que a camada de validação pega contratos malformados antes
// que cheguem à Interface.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./_harness');

const app = loadApp();

function manifestacaoBase(overrides) {
  return Object.assign({
    categoria: 'plano_saude',
    label: 'Plano de saúde pago recorrente',
    mesesDetectados: 6,
    totalPago: 2400,
    mediaMensal: 400,
    mecanismo: { tipo: 'desconhecimento', estado: 'provavel' },
    resolvido: null,
    confianca: 'baixa',
    evidencias: [{ ok: true, texto: 'Padrão recorrente de 6 meses identificado no extrato.' }],
    proximaEtapa: 'Confira o informe da operadora antes de declarar.',
  }, overrides || {});
}

test('montarModeloDeResultado — contrato vazio (sem manifestações) ainda é válido e honesto', () => {
  const modelo = app.montarModeloDeResultado({ manifestacoes: [], totalTxns: 50, mesesAnalisados: 3 }, [{ bank: 'Nubank' }]);
  const v = app.validarContrato(modelo);
  assert.equal(v.valido, true, v.erros.join('; '));
  assert.ok(modelo.limitacoes.length > 0, 'Cap. 6.12 — limitações nunca ficam escondidas, mesmo sem achados');
  assert.match(modelo.resumoExecutivo, /Não foram identificadas/);
});

test('montarModeloDeResultado — contrato com manifestações produz hipóteses e evidências rastreáveis (Cap. 6.10/6.11)', () => {
  const c = { manifestacoes: [manifestacaoBase()], totalTxns: 120, mesesAnalisados: 6 };
  const modelo = app.montarModeloDeResultado(c, [{ bank: 'Itaú' }]);
  const v = app.validarContrato(modelo);
  assert.equal(v.valido, true, v.erros.join('; '));

  assert.equal(modelo.hipoteses.length, 1);
  const h = modelo.hipoteses[0];
  assert.equal(h.categoria, 'plano_saude');
  assert.ok(h.confianca, 'toda hipótese precisa de confiança (Cap. 6.10)');
  assert.ok(h.estado, 'toda hipótese precisa de estado (Cap. 6.10)');

  assert.equal(modelo.evidencias.length, 1);
  const e = modelo.evidencias[0];
  assert.ok(e.origem, 'toda evidência precisa de origem (Cap. 6.11)');
  assert.equal(typeof e.peso, 'number', 'toda evidência precisa de peso numérico (Cap. 6.11)');
  assert.equal(e.relacionamentos.manifestacao, 'plano_saude');
});

test('montarModeloDeResultado — nunca inclui score ou fatores F1-F8 (Cap. 6.5 — motor não devolve o que pertence ao Renderer)', () => {
  const c = { manifestacoes: [manifestacaoBase()], score: 42, fatores: [{ peso: 5 }] };
  const modelo = app.montarModeloDeResultado(c, []);
  assert.equal(modelo.score, undefined);
  assert.equal(modelo.fatores, undefined);
});

test('montarModeloDeResultado — cada recomendação (próximo passo) deriva de uma manifestação real, nunca solta (Cap. 6.13)', () => {
  const c = { manifestacoes: [manifestacaoBase(), manifestacaoBase({ categoria: 'informe_rendimentos', label: 'Divergência em informe de rendimentos', proximaEtapa: null })] };
  const modelo = app.montarModeloDeResultado(c, []);
  modelo.proximosPassos.forEach(p => {
    assert.ok(p.categoria, 'todo próximo passo deve apontar para a manifestação de origem');
    const existeManifestacao = modelo.manifestacoes.some(m => m.categoria === p.categoria);
    assert.ok(existeManifestacao, `próximo passo "${p.categoria}" não corresponde a nenhuma manifestação do contrato`);
  });
});

test('montarModeloDeResultado — identificador e versão presentes e estáveis por chamada (Cap. 6.9/6.16)', () => {
  const c = { manifestacoes: [] };
  const m1 = app.montarModeloDeResultado(c, []);
  const m2 = app.montarModeloDeResultado(c, []);
  assert.ok(m1.id, 'contrato precisa de identificador');
  assert.notEqual(m1.id, m2.id, 'cada análise gera um contrato com identidade própria');
  assert.equal(m1.versao, m2.versao, 'a versão do contrato é estável entre chamadas');
});

test('validarContrato — rejeita contrato malformado com mensagens específicas', () => {
  const v1 = app.validarContrato(null);
  assert.equal(v1.valido, false);

  const v2 = app.validarContrato({ id: 'x', versao: 'v1', estado: 'concluido', resumoExecutivo: 'ok', hipoteses: [], evidencias: [], limitacoes: [], proximosPassos: [], metadados: {} });
  assert.equal(v2.valido, false, 'limitacoes vazio deveria falhar (Cap. 6.12)');

  const v3 = app.validarContrato({ id: 'x', versao: 'v999', estado: 'concluido', resumoExecutivo: 'ok', hipoteses: [], evidencias: [], limitacoes: ['nenhuma'], proximosPassos: [], metadados: {} });
  assert.equal(v3.valido, false, 'versão desconhecida deveria falhar (Cap. 6.16/6.17)');
});

test('validarContrato — aceita um contrato real gerado pelo motor', () => {
  const c = { manifestacoes: [manifestacaoBase()], totalTxns: 80, mesesAnalisados: 4 };
  const modelo = app.montarModeloDeResultado(c, [{ bank: 'Bradesco' }]);
  const v = app.validarContrato(modelo);
  assert.equal(v.valido, true, v.erros.join('; '));
});
