// parsers.js — parsers CSV/OFX/PDF por banco

function eParseBRL(s){
  if(!s)return 0;
  s=String(s).trim().replace(/\s/g,'');
  const neg=s.startsWith('-');
  const abs=s.replace(/^-/,'');
  let parsed;
  if(/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(abs))parsed=parseFloat(abs.replace(/\./g,'').replace(',','.'));
  else parsed=parseFloat(abs.replace(',','.'));
  return (neg?-1:1)*(parsed||0);
}
function eParseDate(s){
  if(!s)return null;
  s=s.trim().replace(/['"]/g,'');
  let m;
  if((m=s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)))return new Date(+m[3],+m[2]-1,+m[1]);
  if((m=s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)))return new Date(+m[1],+m[2]-1,+m[3]);
  if((m=s.match(/^(\d{4})(\d{2})(\d{2})/)))return new Date(+m[1],+m[2]-1,+m[3]);
  if((m=s.match(/^(\d{2})[\/\-](\d{2})$/)))return new Date(new Date().getFullYear(),+m[2]-1,+m[1]);
  return null;
}
function eDetectFormat(c,fn){
  const ext=fn.split('.').pop().toLowerCase();
  const h=c.substring(0,3000).toUpperCase();
  const l=c.split('\n').slice(0,15).join('\n').toLowerCase();

  let format, bankInfo;

  if(ext==='pdf'){
    format='pdf';
    bankInfo=eDetectBankReal(c,'pdf',fn);
    return{format,bank:bankInfo.label,conta:bankInfo.conta,banco:bankInfo.banco};
  }
  if(ext==='ofx'||ext==='qfx'||h.includes('<OFX')||h.includes('OFXHEADER')){
    format='ofx';
    bankInfo=eDetectBankReal(c,'ofx',fn);
    return{format,bank:bankInfo.label,conta:bankInfo.conta,banco:bankInfo.banco};
  }
  if(l.includes('"date"')&&l.includes('"title"')&&l.includes('"amount"')){
    format='nubank_cartao';
    bankInfo=eDetectBankReal(c,'nubank_cartao',fn);
    return{format,bank:bankInfo.label||'Nubank (cartão)',conta:bankInfo.conta,banco:bankInfo.banco};
  }
  // Inter — deve vir antes do Nubank conta
  if(l.includes('banco inter')||l.includes('extrato conta corrente')||(l.includes('histórico')&&l.includes('descrição')&&l.includes(';'))){
    format='inter';
    bankInfo=eDetectBankReal(c,'inter',fn);
    return{format,bank:bankInfo.label,conta:bankInfo.conta,banco:bankInfo.banco};
  }
  // Nubank conta
  const isNubankConta=(
    ((l.includes('lançamento')||l.includes('lancamento'))&&l.includes('valor'))||
    (l.includes('data')&&l.includes('valor')&&l.includes('identificador'))||
    (l.includes('data')&&l.includes('descrição')&&l.includes('valor')&&!l.includes(';'))||
    (l.includes('data')&&l.includes('description')&&l.includes('amount')&&l.includes('identifier'))
  )&&!l.includes('"date"')&&!l.includes('"title"');
  if(isNubankConta){
    format='nubank_conta';
    bankInfo=eDetectBankReal(c,'nubank_conta',fn);
    return{format,bank:bankInfo.label||'Nubank (conta)',conta:bankInfo.conta,banco:bankInfo.banco};
  }
  if(l.includes('data;histórico')||l.includes('data;historico')){
    format='bb';
    bankInfo=eDetectBankReal(c,'bb',fn);
    return{format,bank:bankInfo.label||'Banco do Brasil',conta:bankInfo.conta,banco:bankInfo.banco};
  }
  bankInfo=eDetectBankReal(c,'generic',fn);
  return{format:'generic',bank:bankInfo.label||'CSV genérico',conta:bankInfo.conta,banco:bankInfo.banco};
}
// ── Mapa de códigos COMPE → nome do banco ──────────────────────
const BANCO_COMPE = {
  '001':'Banco do Brasil','033':'Santander','041':'Banrisul','077':'Banco Inter',
  '104':'Caixa Econômica','208':'BTG Pactual','212':'Banco Original','237':'Bradesco',
  '260':'Nu Pagamentos','290':'PagBank','341':'Itaú','348':'XP','376':'JP Morgan',
  '422':'Safra','633':'Rendimento','637':'Sofisa','655':'Votorantim','745':'Citibank',
  '756':'Sicoob','748':'Sicredi','336':'C6 Bank','380':'PicPay','323':'Mercado Pago',
  '403':'Cora','461':'Asaas','084':'CC Uniprime','085':'Cooperativa Central',
};

// ── Extrai banco e conta de qualquer tipo de arquivo ───────────
function eDetectBankReal(content, format, filename) {
  const u = content.substring(0, 3000).toUpperCase();
  const raw = content.substring(0, 3000);

  let banco = null;
  let conta = null;
  let agencia = null;

  // ── OFX: extrai via tags XML ──
  if (format === 'ofx') {
    // Banco via FID (código COMPE)
    const fid = raw.match(/<FID>(\d+)/i)?.[1];
    if (fid && BANCO_COMPE[fid]) banco = BANCO_COMPE[fid];

    // Banco via ORG
    if (!banco) {
      const org = raw.match(/<ORG>([^<\n]+)/i)?.[1]?.trim();
      if (org) banco = eBancoNomeFromText(org);
    }

    // Conta
    conta = raw.match(/<ACCTID>([^<\n]+)/i)?.[1]?.trim();
    agencia = raw.match(/<BRANCHID>([^<\n]+)/i)?.[1]?.trim();
  }

  // ── CSV/TXT: extrai via cabeçalho de metadados ──
  if (!banco || format === 'inter' || format === 'nubank_conta' || format === 'bb') {
    // Número de conta em linha de metadado "Conta ;32238762"
    const contaM = raw.match(/conta\s*[;:]\s*(\d[\d\-\.]+)/i);
    if (contaM) conta = contaM[1].replace(/[.\-]/g, '').trim();

    // Agência
    const agM = raw.match(/agência?\s*[;:]\s*([\d\-]+)/i);
    if (agM) agencia = agM[1].replace(/[.\-]/g, '').trim();

    // Banco via texto
    if (!banco) banco = eBancoNomeFromText(raw.substring(0, 500));
  }

  // ── PDF: tenta extrair do texto ──
  if (format === 'pdf' || !banco) {
    banco = eBancoNomeFromText(u);
    const contaM = u.match(/CONTA[^:]*:\s*([\d\.\-]+)/);
    if (contaM && !conta) conta = contaM[1].replace(/[.\-]/g, '').trim();
  }

  // Fallback: usa o nome do arquivo
  if (!banco) banco = eBancoNomeFromText(filename);

  // Monta label do banco — inclui conta se disponível
  const label = banco
    ? (conta ? `${banco} ···${conta.slice(-4)}` : banco)
    : (conta ? `Conta ···${conta.slice(-4)}` : 'Extrato');

  return { banco: banco || 'Extrato', conta: conta || null, agencia: agencia || null, label };
}

// ── Identifica nome do banco a partir de texto livre ───────────
function eBancoNomeFromText(text) {
  const u = text.toUpperCase();
  if (u.includes('BANCO INTER') || u.includes('INTERMEDIUM') || u.includes('INTER S/A')) return 'Banco Inter';
  if (u.includes('NUBANK') || u.includes('NU PAGAMENTOS') || u.includes('NU FINANCEIRA')) return 'Nubank';
  if (u.includes('ITAU') || u.includes('ITAÚ')) return 'Itaú';
  if (u.includes('BRADESCO')) return 'Bradesco';
  if (u.includes('BANCO DO BRASIL') || u.includes('BANCOBRASIL')) return 'Banco do Brasil';
  if (u.includes('CAIXA ECONÔMICA') || u.includes('CAIXA ECONOMICA') || u.includes('CEF')) return 'Caixa Econômica';
  if (u.includes('SANTANDER')) return 'Santander';
  if (u.includes('SICOOB')) return 'Sicoob';
  if (u.includes('SICREDI')) return 'Sicredi';
  if (u.includes('C6 BANK') || u.includes('C6BANK')) return 'C6 Bank';
  if (u.includes('BTG')) return 'BTG Pactual';
  if (u.includes('ORIGINAL')) return 'Banco Original';
  if (u.includes('PAGBANK') || u.includes('PAG BANK')) return 'PagBank';
  if (u.includes('XP INVESTIMENTOS') || u.includes('XP INC')) return 'XP';
  if (u.includes('PICPAY')) return 'PicPay';
  if (u.includes('MERCADO PAGO')) return 'Mercado Pago';
  if (u.includes('BANRISUL')) return 'Banrisul';
  if (u.includes('SAFRA')) return 'Safra';
  if (u.includes('VOTORANTIM')) return 'Votorantim';
  return null;
}

function eDetectBankOFX(c){ return eDetectBankReal(c,'ofx','').label; }
function eSplitCSV(line,sep=','){
  const r=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){q=!q;continue}if(c===sep&&!q){r.push(cur.trim());cur='';continue}cur+=c;}
  r.push(cur.trim());return r;
}
function eDetectSep(l){const s={',':0,';':0,'\t':0};for(const c of l)if(s[c]!==undefined)s[c]++;return Object.keys(s).reduce((a,b)=>s[a]>s[b]?a:b);}
function eParseNubankCartao(lines){return lines.slice(1).filter(l=>l.trim()).map(l=>{const c=eSplitCSV(l);if(c.length<3)return null;const date=eParseDate(c[0]),desc=(c[1]||'').trim(),value=eParseBRL(c[2]);return date&&desc?{date,desc,value}:null;}).filter(Boolean);}
function eParseNubankConta(lines){
  if(lines.length<2)return[];
  // detecta colunas pelo cabeçalho
  const hdr=eSplitCSV(lines[0]).map(c=>c.toLowerCase().replace(/['"]/g,'').trim());
  const iDate=hdr.findIndex(h=>h.includes('data')||h==='date');
  const iDesc=hdr.findIndex(h=>h.includes('descri')||h.includes('description')||h.includes('histórico')||h.includes('historico'));
  const iVal =hdr.findIndex(h=>h==='valor'||h==='value'||h==='amount'||h.includes('valor'));
  const iId  =hdr.findIndex(h=>h.includes('identif'));
  return lines.slice(1).filter(l=>l.trim()).map(l=>{
    const c=eSplitCSV(l);
    if(c.length<2)return null;
    // usa índices detectados ou fallback posicional
    const date=eParseDate(c[iDate>=0?iDate:0]);
    const desc=(iDesc>=0?c[iDesc]:(iId>=0?c[iId]:c[1]||'')).replace(/['"]/g,'').trim();
    const value=iVal>=0?eParseBRL(c[iVal]):eParseBRL(c[c.length-1]);
    return date&&desc?{date,desc,value}:null;
  }).filter(Boolean);
}
function eParseInter(lines){
  let s=0;
  for(let i=0;i<lines.length;i++){
    const l=lines[i].toLowerCase();
    if(l.includes('data')&&(l.includes('histórico')||l.includes('historico'))){s=i;break;}
  }
  const sep=eDetectSep(lines[s]||lines[0]||'');
  const hdr=lines[s].split(sep).map(x=>x.replace(/['"]/g,'').trim().toLowerCase());
  const iDt  =hdr.findIndex(h=>h.includes('data'));
  const iHist=hdr.findIndex(h=>h.includes('hist'));
  const iDesc=hdr.findIndex(h=>h.includes('descri'));
  const iVal =hdr.findIndex(h=>h==='valor'||h.includes('valor'));
  return lines.slice(s+1).filter(l=>l.trim()).map(l=>{
    const c=l.split(sep).map(x=>x.replace(/['"]/g,'').trim());
    if(c.length<3)return null;
    const date=eParseDate(c[iDt>=0?iDt:0]);
    const hist=iHist>=0?c[iHist]:'';
    const desc=iDesc>=0?c[iDesc]:c[1]||'';
    const label=[hist,desc].filter(Boolean).join(' — ').trim();
    const value=iVal>=0?eParseBRL(c[iVal]):eParseBRL(c[c.length-2]||c[c.length-1]);
    return date&&label?{date,desc:label,value}:null;
  }).filter(Boolean);
}
function eParseBB(lines){let s=0;for(let i=0;i<lines.length;i++){if(lines[i].toLowerCase().includes('data')&&lines[i].includes(';')){s=i+1;break}}return lines.slice(s).filter(l=>l.trim()).map(l=>{const c=l.split(';').map(x=>x.replace(/"/g,'').trim());if(c.length<4)return null;const date=eParseDate(c[0]),desc=c[1]||'',cr=eParseBRL(c[3]),db=eParseBRL(c[4]||'');return date?{date,desc,value:cr>0?cr:-Math.abs(db)}:null;}).filter(Boolean);}
function eParseOFX(content){const txns=[];const re=/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;let m;while((m=re.exec(content))!==null){const b=m[1],date=eParseDate(eGetTag(b,'DTPOSTED')),value=parseFloat(eGetTag(b,'TRNAMT')||'0'),desc=(eGetTag(b,'MEMO')||eGetTag(b,'NAME')||'Sem descrição').trim();if(date)txns.push({date,desc,value});}if(txns.length>0)return txns;const lines=content.split('\n');let cur={};for(const line of lines){const t=line.trim();if(t==='<STMTTRN>'){cur={};continue}if(t==='</STMTTRN>'){if(cur.date&&cur.value!==undefined)txns.push({...cur});cur={};continue}const mm=t.match(/^<([A-Z]+)>(.+)$/);if(mm){const[,tg,v]=mm;if(tg==='DTPOSTED')cur.date=eParseDate(v);if(tg==='TRNAMT')cur.value=parseFloat(v)||0;if((tg==='MEMO'||tg==='NAME')&&!cur.desc)cur.desc=v.trim();}}return txns;}
function eGetTag(str,name){const r=new RegExp(`<${name}>([^<]+)`,'i');const m=str.match(r);return m?m[1].trim():null;}
function eParseGeneric(lines){if(lines.length<2)return[];const sep=eDetectSep(lines[0]);const hdr=eSplitCSV(lines[0],sep).map(c=>c.toLowerCase().replace(/"/g,'').trim());const ci=h=>{for(const n of h){const i=hdr.findIndex(x=>x.includes(n));if(i>=0)return i;}return -1;};const iDt=ci(['data','date','dt lançamento','dt mov']);const iDsc=ci(['descrição','descricao','histórico','historico','memo','title','nome','name']);const iVl=ci(['valor','value','amount','vlr']);const iCr=ci(['crédito','credito','créd']);const iDb=ci(['débito','debito','déb']);return lines.slice(1).filter(l=>l.trim()).map(l=>{const c=eSplitCSV(l,sep);if(c.length<2)return null;const date=iDt>=0?eParseDate(c[iDt]):eParseDate(c[0]);const desc=iDsc>=0?c[iDsc].replace(/"/g,'').trim():c[1]?.trim()||'';let value=0;if(iVl>=0)value=eParseBRL(c[iVl]);else if(iCr>=0&&iDb>=0){const cr=eParseBRL(c[iCr]||''),db=eParseBRL(c[iDb]||'');value=cr>0?cr:-Math.abs(db);}else for(let j=c.length-1;j>=0;j--){const v=eParseBRL(c[j]);if(!isNaN(v)&&v!==0){value=v;break}}return desc?{date,desc,value}:null;}).filter(Boolean);}
async function eParsePDF(buffer){
  await _loadPdfJs();
  const copy=buffer.slice(0);
  let pdf;
  try {
    const loadTask = pdfjsLib.getDocument({data:copy});
    const timeout = new Promise((_,rej)=>setTimeout(()=>rej(new Error('PDF timeout')), ENGINE_CONFIG.PDF_TIMEOUT_MS));
    pdf = await Promise.race([loadTask.promise, timeout]);
  } catch(e) {
    throw new Error('PDF corrompido ou ilegivel: ' + e.message);
  }
  if (pdf.numPages > ENGINE_CONFIG.PDF_MAX_PAGES) {
    throw new Error('PDF com mais de ' + ENGINE_CONFIG.PDF_MAX_PAGES + ' paginas. Exporte apenas o periodo necessario.');
  }
  let text='';for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p);const tc=await page.getTextContent();let lastY=null,line='';for(const item of tc.items){const y=Math.round(item.transform[5]);if(lastY!==null&&Math.abs(y-lastY)>3){text+=line.trim()+'\n';line='';}line+=(item.str||'')+' ';lastY=y;}if(line.trim())text+=line.trim()+'\n';}return text;}
function eParsePDFText(text){
  const lines=text.split('\n').filter(l=>l.trim());
  const txns=[];
  const skip=/saldo anterior|saldo final|data\s+descri|período|agência|conta\s*:|cliente|extrato|banco\s+/i;
  // aceita DD/MM/YYYY ou DD/MM
  const re=/(\d{2}[\/\-]\d{2}(?:[\/\-]\d{4})?)\s+(.+?)\s+([\-\+]?\s*\d[\d.,]*(?:\.\d{3})*(?:,\d{2})?)\s*(?:[\d.,]+)?\s*$/;
  for(const line of lines){
    if(skip.test(line))continue;
    const m=line.match(re);
    if(!m)continue;
    const date=eParseDate(m[1]),desc=m[2].trim(),value=eParseBRL(m[3].replace(/\s/g,''));
    if(date&&desc&&value!==0)txns.push({date,desc,value});
  }
  return txns.length>0?txns:eParseGeneric(lines);
}

// ═══════════════════════════════════════════════════════════════
// MOTOR DE COERÊNCIA FISCAL — Guardião Fiscal v2
// Baseado em: compatibilidade financeira, detecção comportamental,
// análise temporal, score tributário ponderado e explicação causal
// ═══════════════════════════════════════════════════════════════

// ── Dicionários de categorização semântica ──────────────────────
const CAT = {
  formal:    ['salário','salario','holerite','folha pgto','pagamento folha','fgts','inss','irrf','pro-labore','pró-labore','beneficio','benefício','aposentadoria','pensão','pensao','rendimento prev','13 salario','13° salario','férias','ferias','rescisão','rescisao','clt'],
  invest:    ['btc','bitcoin','cripto','crypto','ethereum','xrp','usdt','binance','foxbit','mercado bitcoin','novadax','tesouro direto','tesouro selic','tesouro ipca','dividendo','jscp','jcp','rendimento fundo','resgate cdb','resgate lci','resgate lca','resgate rdb','resgate fundo','rendimento aplicacao','rendimento poupanca'],
  aluguel:   ['aluguel','locação','locacao','imóvel','imovel','alugar','locatário','locatario'],
  comercial: ['ifood','rappi','uber eats','99food','shopee','mercado livre','mercadolivre','ame digital','pagseguro','mercado pago','stone','cielo','getnet','rede ','sumup','ton ','pagar.me','venda','vend.','nota fiscal','nf-e','recebimento vendas','vendas online'],
  especie:   ['saque','caixa eletronico','atm','deposito especie','dep especie','deposito em especie','dinheiro','cdas','cofre'],
  interno:   ['entre contas','conta própria','conta propria','transferência interna','transf interna','tid própria','tid propria','portabilidade'],
  pix:       ['pix recebido','pix credit','recebido pix','pix enviado','pix debitado','chave pix'],
  transf:    ['transferência recebida','transferencia recebida','ted recebida','doc recebido','depósito recebido','deposito recebido','transf. recebida','transf recebida'],
};

function catMatch(desc, cats) {
  const d = desc.toLowerCase();
  return cats.some(k => d.includes(k));
}

// ── Classificador semântico de transação ───────────────────────
function detectChannel(desc) {
  // Identifica o canal da transação para schema canônico
  const d = normalizeDesc(desc);
  if (d.includes('pix')) return 'pix';
  if (d.includes('ted') || d.includes('doc recebido')) return 'ted';
  if (d.includes('saque') || d.includes('caixa eletronico') || d.includes('atm')) return 'saque';
  if (d.includes('deposito especie') || d.includes('dep especie') || d.includes('deposito em especie')) return 'especie';
  if (d.includes('entre contas') || d.includes('conta propria') || d.includes('transf interna')) return 'proprio';
  if (d.includes('cartao') || d.includes('credito') || d.includes('debito')) return 'cartao';
  if (d.includes('boleto') || d.includes('tributo') || d.includes('pagamento')) return 'boleto';
  return 'outros';
}

function eClassifyTxn(t) {
  const d = normalizeDesc(t.desc);
  const v = t.value;
  const channel = detectChannel(t.desc);

  if (v <= 0) return { risk: 'normal', flag: null, cat: 'saida', channel };

  // Transferência entre contas do próprio titular — não infla risco
  if (channel === 'proprio' || catMatch(d, CAT.interno))
    return { risk: 'normal', flag: null, cat: 'interno', channel };

  // Renda formal — baixo risco
  if (catMatch(d, CAT.formal)) return { risk: 'normal', flag: 'Renda formal', cat: 'formal', channel };

  // Investimentos — atenção (precisam ser declarados)
  if (catMatch(d, CAT.invest)) return { risk: 'attention', flag: 'Investimento', cat: 'invest', channel };

  // Aluguel recebido — atenção
  if (catMatch(d, CAT.aluguel)) return { risk: 'attention', flag: 'Aluguel', cat: 'aluguel', channel };

  // Atividade comercial — suspeito se recorrente
  if (catMatch(d, CAT.comercial)) return { risk: 'attention', flag: 'Comercial', cat: 'comercial' };

  // Depósito em espécie — alto risco
  if (catMatch(d, CAT.especie)) {
    if (v >= 3000) return { risk: 'suspicious', flag: 'Espécie ≥ R$3k', cat: 'especie' };
    return { risk: 'attention', flag: 'Espécie', cat: 'especie' };
  }

  // Pix recebido
  const isPix = catMatch(d, CAT.pix) || (d.includes('pix') && v > 0);
  const isTransf = catMatch(d, CAT.transf) || (d.includes('transf') && v > 0 && !catMatch(d, CAT.interno));

  if (isPix || isTransf) {
    if (v >= 10000) return { risk: 'suspicious', flag: 'Pix ≥ R$10k', cat: 'pix' };
    if (v >= 5000)  return { risk: 'suspicious', flag: 'Pix ≥ R$5k',  cat: 'pix' };
    if (v >= 2000)  return { risk: 'attention',  flag: 'Pix relevante', cat: 'pix' };
    if (v >= 500)   return { risk: 'attention',  flag: 'Pix', cat: 'pix' };
    return { risk: 'normal', flag: null, cat: 'pix' };
  }

  // Crédito genérico alto
  if (v >= 15000) return { risk: 'suspicious', flag: 'Crédito alto', cat: 'outros' };
  if (v >= 5000)  return { risk: 'attention',  flag: 'Valor relevante', cat: 'outros' };

  return { risk: 'normal', flag: null, cat: 'outros' };
}

// ── Detecção de recorrência comportamental ─────────────────────
function detectarRecorrencia(txns) {
  // Agrupa por descrição normalizada e detecta padrões de frequência
  const grupos = {};
  txns.filter(t => t.value > 0).forEach(t => {
    const chave = t.desc.toLowerCase()
      .replace(/\d{2}\/\d{2}\/\d{4}/g, '')
      .replace(/\d{2}\/\d{2}/g, '')
      .replace(/r\$[\d.,]+/gi, '')
      .replace(/\s+/g, ' ').trim().substring(0, 40);
    if (!grupos[chave]) grupos[chave] = { count: 0, total: 0, valores: [] };
    grupos[chave].count++;
    grupos[chave].total += t.value;
    grupos[chave].valores.push(t.value);
  });

  const recorrentes = Object.entries(grupos)
    .filter(([, g]) => g.count >= 4)
    .map(([desc, g]) => {
      const media = g.total / g.count;
      const desvioPct = g.valores.length > 1
        ? Math.sqrt(g.valores.reduce((a, v) => a + Math.pow(v - media, 2), 0) / g.valores.length) / media
        : 0;
      return { desc, count: g.count, total: g.total, media, desvioPct };
    });

  // Recorrência com ticket parecido = sinal de atividade comercial
  const comercialOculta = recorrentes.filter(r => r.desvioPct < 0.3 && r.count >= 6 && r.media >= 200);
  return { recorrentes, comercialOculta };
}

// ── Análise temporal — variação mensal (z-score simplificado) ──
