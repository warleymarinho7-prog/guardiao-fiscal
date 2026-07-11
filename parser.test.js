// tests/parser.test.js
//
// Livro III, Cap. 12.4 — "O Parser deve responder 'Este documento foi lido
// corretamente?'. Jamais 'A hipótese está correta?'" Os testes abaixo nunca
// avaliam risco fiscal, apenas se Arquivo → Modelo Interno está correto
// (Cap. 8.1).

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./_harness');

const app = loadApp();

test('eParseBRL — formato brasileiro com milhar e decimal', () => {
  assert.equal(app.eParseBRL('1.234,56'), 1234.56);
  assert.equal(app.eParseBRL('-1.234,56'), -1234.56);
  assert.equal(app.eParseBRL('50,00'), 50);
  assert.equal(app.eParseBRL(''), 0);
  assert.equal(app.eParseBRL(null), 0);
});

test('eParseDate — formatos dd/mm/aaaa e aaaa-mm-dd', () => {
  const d1 = app.eParseDate('15/03/2026');
  assert.equal(d1.getFullYear(), 2026);
  assert.equal(d1.getMonth(), 2); // março = índice 2
  assert.equal(d1.getDate(), 15);

  const d2 = app.eParseDate('2026-03-15');
  assert.equal(d2.getFullYear(), 2026);
  assert.equal(d2.getMonth(), 2);

  assert.equal(app.eParseDate(''), null);
  assert.equal(app.eParseDate('não é data'), null);
});

test('eDetectSep — identifica o separador dominante da linha', () => {
  assert.equal(app.eDetectSep('a;b;c'), ';');
  assert.equal(app.eDetectSep('a,b,c'), ',');
});

test('eSplitCSV — respeita aspas ao dividir campos', () => {
  const campos = app.eSplitCSV('"PIX, transferência",100,50', ',');
  assert.equal(campos[0], 'PIX, transferência');
  assert.equal(campos.length, 3);
});

test('eParseOFX — extrai transações de um bloco OFX mínimo', () => {
  const ofx = `
    <STMTTRN>
      <TRNTYPE>DEBIT
      <DTPOSTED>20260115
      <TRNAMT>-150.00
      <MEMO>Pagamento boleto
    </STMTTRN>
    <STMTTRN>
      <TRNTYPE>CREDIT
      <DTPOSTED>20260120
      <TRNAMT>3000.00
      <MEMO>Salário
    </STMTTRN>
  `;
  const txns = app.eParseOFX(ofx);
  assert.equal(txns.length, 2);
  assert.equal(txns[0].value, -150);
  assert.equal(txns[1].value, 3000);
  assert.equal(txns[1].desc, 'Salário');
});

// ── Regressão: linhas de saldo ("SALDO ANTERIOR", "SALDO", "Total") viravam
// transações fantasma de valor zero em CSVs de extrato real (achado em
// auditoria de parser, jul/2026). O fix filtra essas linhas antes de
// convertê-las em transação. Este teste trava esse comportamento.
test('eParseGeneric — nunca transforma linha de "SALDO ANTERIOR" em transação fantasma', () => {
  const csv = [
    'Data,Descrição,Valor',
    '01/01/2026,SALDO ANTERIOR,0',
    '02/01/2026,PIX recebido,500',
    '03/01/2026,SALDO,0',
    '04/01/2026,Total,0',
  ].join('\n');
  const lines = csv.split('\n');
  const txns = app.eParseGeneric(lines);
  assert.equal(txns.length, 1, 'apenas a transação real (PIX recebido) deveria sobreviver ao filtro');
  assert.equal(txns[0].desc, 'PIX recebido');
});

test('eParseGeneric — mantém transações reais com valor legítimo', () => {
  const csv = [
    'Data,Descrição,Valor',
    '10/02/2026,Compra supermercado,-250.50',
    '11/02/2026,Depósito,1000',
  ].join('\n');
  const txns = app.eParseGeneric(csv.split('\n'));
  assert.equal(txns.length, 2);
  assert.equal(txns[0].value, -250.5);
  assert.equal(txns[1].value, 1000);
});

test('isValidTxn — rejeita transações com dados incompletos (Cap. 8.7 do Livro III — validação antes do Motor)', () => {
  assert.equal(app.isValidTxn({ date: new app.Date('2026-01-01'), value: 100, desc: 'ok' }), true);
  assert.equal(app.isValidTxn({ date: null, value: 100, desc: 'sem data' }), false);
  assert.equal(app.isValidTxn({ date: new app.Date('2026-01-01'), value: 0, desc: 'valor zero' }), false);
  assert.equal(app.isValidTxn({ date: new app.Date('2026-01-01'), value: 100, desc: 'a' }), false); // descrição curta demais
});

test('deduplicateTxns — remove duplicatas exatas mantendo transações distintas', () => {
  const txns = [
    { date: new app.Date('2026-01-01'), desc: 'PIX', value: 100 },
    { date: new app.Date('2026-01-01'), desc: 'PIX', value: 100 }, // duplicata exata
    { date: new app.Date('2026-01-02'), desc: 'PIX', value: 100 }, // data diferente
  ];
  const result = app.deduplicateTxns(txns);
  assert.equal(result.length, 2);
});
