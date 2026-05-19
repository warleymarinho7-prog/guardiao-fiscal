// extrato-ui.js — upload, resultado, paywall

function eDov(e){e.preventDefault();document.getElementById('dz').classList.add('drag')}
function eDlv(){document.getElementById('dz').classList.remove('drag')}
function eDrp(e){e.preventDefault();eDlv();Array.from(e.dataTransfer.files).forEach(eAddFile)}
function eOnSel(e){Array.from(e.target.files).forEach(eAddFile);e.target.value='';}

function eAddFile(file){
  eShowErr('');
  if(eFiles.length>=MAX_FILES){eShowErr(`Limite de ${MAX_FILES} extratos atingido.`);return;}
  if(!validateFileName(file.name)){eShowErr('Nome de arquivo inválido ou suspeito.');return;}
  if(eFiles.find(f=>f.name===file.name)){eShowErr(`"${sanitize(file.name)}" já foi adicionado.`);return;}
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if(file.size > MAX_SIZE){eShowErr(`"${sanitize(file.name)}" excede o limite de 10MB.`);return;}
  const allowedExt = ['pdf','csv','ofx','txt','xlsx'];
  const ext = file.name.split('.').pop().toLowerCase();
  if(!allowedExt.includes(ext)){eShowErr(`Formato não suportado: .${sanitize(ext)}. Use PDF, CSV, OFX ou TXT.`);return;}
  const entry={name:file.name,content:null,type:null,detected:null,status:'loading'};
  eFiles.push(entry);eRenderFileList();
  if(ext==='pdf'){
    if(typeof pdfjsLib==='undefined'){
      eShowErr('Biblioteca PDF ainda carregando. Aguarde 2 segundos e tente novamente.');
      entry.status='err';eRenderFileList();return;
    }
    const r=new FileReader();
    r.onload=async e=>{
      try {
        await validatePDFMagicBytes(e.target.result);
        entry.content=e.target.result;entry.type='pdf';entry.detected={format:'pdf',bank:'PDF'};entry.status='ok';
      } catch(err) {
        entry.status='err';
        eShowErr(`"${sanitize(file.name)}": ${err.message}`);
      }
      eRenderFileList();eUpdateActionBar();
    };
    r.readAsArrayBuffer(file);
  } else {
    const enc=['UTF-8','ISO-8859-1','windows-1252'];let idx=0;
    const tryNext=()=>{
      if(idx>=enc.length){entry.status='err';eRenderFileList();return;}
      const r=new FileReader();
      r.onload=e=>{
        let c=e.target.result;
        const bad=(c.match(/\uFFFD/g)||[]).length;
        if(bad>20&&idx<enc.length-1){idx++;tryNext();return;}
        if(c.length > MAX_TEXT_CHARS){eShowErr(`"${sanitize(file.name)}" tem conteúdo excessivo.`);entry.status='err';eRenderFileList();return;}
        // OFX/QFX usam tags XML como estrutura — não sanitizar (removeria os dados)
        const isOFX=ext==='ofx'||ext==='qfx'||c.substring(0,500).toUpperCase().includes('OFXHEADER');
        if(!isOFX) c=sanitizeFileContent(c);
        entry.content=c;entry.type='text';entry.detected=eDetectFormat(c,file.name);entry.status='ok';
        eRenderFileList();eUpdateActionBar();
      };
      r.readAsText(file,enc[idx]);
    };
    tryNext();
  }
}

function eRemoveFile(idx){eFiles.splice(idx,1);eRenderFileList();eUpdateActionBar();if(eFiles.length===0)document.getElementById('actBar').style.display='none';}

function eRenderFileList(){
  document.getElementById('fileList').innerHTML=eFiles.map((f,i)=>`
    <div class="file-item ${f.status==='ok'?'ok':f.status==='err'?'err':''}">
      <span class="file-ico">${f.status==='loading'?'⏳':f.status==='err'?'❌':'📄'}</span>
      <div class="file-info"><div class="file-name">${sanitize(f.name)}</div><div class="file-bank">${f.detected?sanitize(f.detected.bank):'Detectando...'}</div></div>
      <span class="file-status ${f.status==='ok'?'fs-ok':f.status==='err'?'fs-err':'fs-load'}">${f.status==='ok'?'PRONTO':f.status==='err'?'ERRO':'...'}</span>
      <span class="file-rm" onclick="eRemoveFile(${i})">✕</span>
    </div>`).join('');
  const lb=document.getElementById('limitBar');
  if(eFiles.length>0){
    lb.style.display='flex';
    document.getElementById('limitTxt').textContent=`${eFiles.length} de ${MAX_FILES}`;
    document.getElementById('dzIco').textContent=eFiles.length>=MAX_FILES?'✅':'📂';
    document.getElementById('dzTtl').textContent=eFiles.length>=MAX_FILES?`${MAX_FILES} extratos carregados`:'Adicione mais ou clique em Analisar';
    document.getElementById('limitNote').textContent=eFiles.length>=MAX_FILES?'Limite atingido':'';
    document.getElementById('ldots').innerHTML=Array.from({length:MAX_FILES},(_,i)=>`<div class="ldot ${i<eFiles.length?i===MAX_FILES-1&&eFiles.length>=MAX_FILES?'full':'used':''}">${i<eFiles.length?'✓':''}</div>`).join('');
  }else{lb.style.display='none';document.getElementById('dzIco').textContent='📂';document.getElementById('dzTtl').textContent='Arraste os extratos ou clique para selecionar';}
}

function eUpdateActionBar(){
  const ready=eFiles.filter(f=>f.status==='ok').length;
  const ab=document.getElementById('actBar');
  if(ready>0){ab.style.display='flex';document.getElementById('actMsg').textContent=`${ready} extrato(s) prontos`;document.getElementById('btnGo').classList.add('on');}
  else document.getElementById('btnGo').classList.remove('on');
}
function eShowErr(msg){const b=document.getElementById('errExt');b.textContent=msg;b.classList.toggle('show',!!msg);}
function eSetProgress(pct,msg){document.getElementById('pFillExt').style.width=pct+'%';document.getElementById('actMsg').textContent=msg;}

async function eRunAll(){
  const ready=eFiles.filter(f=>f.status==='ok');
  if(ready.length===0)return;
  document.getElementById('btnGo').classList.remove('on');
  eShowErr('');
  // Captura renda declarada do campo (opcional — ativa F7 compatibilidade)
  const _rInput = document.getElementById('rendaDeclaradaInput');
  // Leitura robusta — aceita vírgula como decimal (R$ 5.000,00 → 5000)
  const _rawRenda = _rInput ? _rInput.value.replace(/\./g,'').replace(',','.').trim() : '';
  window._rendaDeclaradaMensal = _rawRenda ? Math.max(0, parseFloat(_rawRenda) || 0) : 0;
  const results=[];
  const parsed=[]; // {txns, bank, conta, banco, label}

  // ── Etapa 1: parsear todos os arquivos ──
  for(let i=0;i<ready.length;i++){
    const f=ready[i];
    eSetProgress(Math.round((i/ready.length)*60),`Processando ${f.name}...`);
    await new Promise(r=>setTimeout(r,200));
    try{
      let txns=[];
      if(f.type==='pdf'){
        const text=await eParsePDF(f.content);
        txns=eParsePDFText(text);
        if(txns.length===0){eShowErr(`Não foi possível extrair de "${f.name}". Tente CSV ou OFX.`);continue;}
        // Para PDF, atualiza banco real após extração do texto
        const pdfBankInfo=eDetectBankReal(text,'pdf',f.name);
        if(pdfBankInfo.banco) f.detected.banco=pdfBankInfo.banco;
        if(pdfBankInfo.conta) f.detected.conta=pdfBankInfo.conta;
        f.detected.bank=pdfBankInfo.label||`PDF (${txns.length} transações)`;
      } else {
        const lines=f.content.split('\n');
        const fmt=f.detected.format;
        if(fmt==='nubank_cartao') txns=eParseNubankCartao(lines);
        else if(fmt==='nubank_conta'){txns=eParseNubankConta(lines);if(txns.length===0)txns=eParseGeneric(lines);}
        else if(fmt==='inter') txns=eParseInter(lines);
        else if(fmt==='bb') txns=eParseBB(lines);
        else if(fmt==='ofx') txns=eParseOFX(f.content);
        else txns=eParseGeneric(lines);
      }
      if(txns.length===0){eShowErr(`Nenhuma transação em "${f.name}".`);continue;}
      parsed.push({
        txns,
        banco: f.detected.banco||f.detected.bank,
        conta: f.detected.conta||null,
        label: f.detected.bank,
        formato: f.detected.format,
      });
    }catch(e){
      const msg=`Erro em "${f.name}" (${f.detected?.format||'?'}): ${e.message}`;
      eShowErr(msg);
      console.error('[GuardiaoFiscal]', msg, e);
    }
  }

  if(parsed.length===0){eSetProgress(0,'Erro — nenhum extrato processado');document.getElementById('btnGo').classList.add('on');return;}

  // ── Etapa 2: agrupar por banco+conta ──
  // Arquivos do mesmo banco e mesma conta → um único resultado consolidado
  eSetProgress(70,'Identificando contas...');
  const grupos={};
  parsed.forEach(p=>{
    // Chave de agrupamento: banco + conta (se disponível)
    const chave = p.conta
      ? `${p.banco}|${p.conta}`
      : `${p.banco}|${p.label}`; // sem conta, agrupa por label
    if(!grupos[chave]) grupos[chave]={txns:[],banco:p.banco,conta:p.conta,label:p.label,formatos:[]};
    grupos[chave].txns.push(...p.txns);
    if(!grupos[chave].formatos.includes(p.formato)) grupos[chave].formatos.push(p.formato);
  });

  // ── Etapa 3: analisar cada grupo ──
  const grupoKeys=Object.keys(grupos);
  for(let i=0;i<grupoKeys.length;i++){
    const g=grupos[grupoKeys[i]];
    eSetProgress(70+Math.round((i/grupoKeys.length)*25),`Analisando ${g.banco}...`);
    await new Promise(r=>setTimeout(r,100));
    // Label mostra banco + conta + formatos usados
    const fmtLabel=g.formatos.length>1?` [${g.formatos.join('+')}]`:'';
    const bankLabel=g.conta?`${g.banco} ···${g.conta.slice(-4)}${fmtLabel}`:g.banco+fmtLabel;
    const r=eAnalyzeSingle(deduplicateTxns(g.txns),bankLabel,window._rendaDeclaradaMensal||0);
    if(r) results.push(r);
  }

  if(results.length===0){eSetProgress(0,'Erro — nenhum extrato processado');document.getElementById('btnGo').classList.add('on');return;}
  eSetProgress(95,'Consolidando...');
  await new Promise(r=>setTimeout(r,300));
  const consolidated=eConsolidate(results);
  eAllTxns=consolidated.all;
  eSetProgress(100,`${consolidated.totalTxns} transações analisadas`);

  // lock step 2, show step 3
  document.getElementById('extStep2').style.opacity='0.6';
  document.getElementById('extStep2').style.pointerEvents='none';
  document.getElementById('s2num').textContent='✓';
  document.getElementById('s2num').style.background='var(--green)';
  document.getElementById('s2num').style.color='#000';
  const s3=document.getElementById('extStep3');
  s3.style.display='block';
  document.getElementById('s3num').classList.remove('locked');

  // Mensagem inteligente: 1 conta vs múltiplas
  const nContas=results.length;
  const nArquivos=parsed.length;
  const msg=nArquivos>nContas
    ? `${nArquivos} arquivo(s) → ${nContas} conta(s) identificada(s)`
    : `${nContas} extrato(s) analisado(s)`;
  document.getElementById('s3sub').textContent=`${msg} — análise concluída`;

  _eConsolidated=consolidated;
  _eSources=results;

  // Preenche preview com dados REAIS
  eRenderPreview(consolidated, results);

  s3.scrollIntoView({behavior:'smooth',block:'start'});
}


// ── Renderiza prévia real no paywallBlock ──────────────────────────
function eRenderPreview(c, sources) {
  // Mostra preview real, esconde placeholder
  document.getElementById('previewReal').style.display = 'block';
  document.getElementById('previewPlaceholder').style.display = 'none';

  // Score e nível
  let emoji, level, color;
  if (c.score <= 20)      { emoji='🟢'; level='BAIXO RISCO';   color='#00d96e'; }
  else if (c.score <= 45) { emoji='🟡'; level='ATENÇÃO';       color='#f5a623'; }
  else if (c.score <= 70) { emoji='🟠'; level='RISCO ELEVADO'; color='#f97316'; }
  else                    { emoji='🔴'; level='ATENÇÃO ELEVADA'; color='#f04f60'; }

  document.getElementById('pvEmoji').textContent = emoji;
  document.getElementById('pvLevel').textContent = level;
  document.getElementById('pvLevel').style.color = color;
  document.getElementById('pvScore').textContent = c.score + '%';
  document.getElementById('pvScore').style.color = color;
  const evidStr = c.numEvidencias !== undefined ? ' · ' + c.numEvidencias + ' indicador(es)' : '';
  const confStr = c.confidence !== undefined ? ' · confiança ' + Math.round(c.confidence * 100) + '%' : '';
  const parseStr = c.parserConfidence !== undefined ? ' · leitura ' + Math.round(c.parserConfidence * 100) + '%' : '';
  const descStr = c.txnsDescartadas > 0 ? ' (' + c.txnsDescartadas + ' descartadas)' : '';
  document.getElementById('pvSub').textContent =
    sources.length + ' extrato(s) · ' + c.totalTxns + ' transações analisadas' +
    evidStr + confStr + parseStr + descStr;
  document.getElementById('pvBarFill').style.background = color;
  setTimeout(() => { document.getElementById('pvBarFill').style.width = c.score + '%'; }, 300);

  // Métricas rápidas (4 cards)
  const pixPct = c.totalCredits > 0 ? Math.round(c.pixTotal / c.totalCredits * 100) : 0;
  const icConsumo = Math.round((c.indiceConsumo || 0) * 100);
  // BUG-6: aviso de extrato curto quando meses analisados < 3
  const _mesesMin = sources.reduce((min, r) => Math.min(min, r.mesesAnalisados || 12), 12);
  if (_mesesMin < 3 && c.rendaDeclarada > 0) {
    const _avisoEl = document.getElementById('pAlertList');
    if (_avisoEl) {
      const _avisoDiv = document.createElement('div');
      _avisoDiv.className = 'alert-item alert-yellow';
      _avisoDiv.style.cssText = 'margin-top:8px;padding:10px 14px;border-radius:10px;font-size:12px;display:flex;gap:10px;align-items:flex-start';
      _avisoDiv.innerHTML = '<span>⚠️</span><span><strong>Extrato com menos de 3 meses</strong> — o índice de compatibilidade com a renda pode estar distorcido. Para maior precisão, use um extrato com 3+ meses de movimentação.</span>';
      if (_avisoEl.firstChild) _avisoEl.insertBefore(_avisoDiv, _avisoEl.firstChild);
      else _avisoEl.appendChild(_avisoDiv);
    }
  }
  document.getElementById('pvMetrics').innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Total créditos</div>
      <div style="font-family:Manrope,sans-serif;font-size:16px;font-weight:800;color:var(--green)">${fmtBRL(c.totalCredits)}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${c.creditCount} entradas</div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Suspeitos</div>
      <div style="font-family:Manrope,sans-serif;font-size:16px;font-weight:800;color:${c.suspCount>0?'var(--red)':'var(--green)'}">${c.suspCount}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">transações de risco</div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Pix recebidos</div>
      <div style="font-family:Manrope,sans-serif;font-size:16px;font-weight:800;color:${pixPct>=50?'var(--red)':pixPct>=30?'var(--yellow)':'var(--text)'}">${pixPct}%</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">das entradas</div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Índice consumo</div>
      <div style="font-family:Manrope,sans-serif;font-size:16px;font-weight:800;color:${icConsumo>=120?'var(--red)':icConsumo>=90?'var(--yellow)':'var(--green)'}">${icConsumo}%</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">saídas/entradas</div>
    </div>`;

  // Primeiros 2 alertas REAIS visíveis
  const alertsVisiveis = c.alerts.slice(0, 2);
  const alertsBloqueados = c.alerts.slice(2);
  document.getElementById('pvLockedCount').textContent = alertsBloqueados.length;

  // P8: Card mês mais crítico e confiança do parser
  // Card movimentos internos detectados
  if (c.internos && c.internos.length > 0) {
    const internCard = document.createElement('div');
    internCard.style.cssText = 'grid-column:1/-1;margin-top:4px';
    const confirmedCount = c.internos.filter(t => t.internalMove === 'confirmed').length;
    const probableCount  = c.internos.filter(t => t.internalMove === 'probable').length;
    internCard.innerHTML =
      '<div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:8px;padding:8px 12px;font-size:11px;color:var(--muted2)">' +
      '🔄 <strong style="color:var(--text)">' + c.internos.length + ' movimentação(ões) interna(s) identificada(s)</strong> — ' +
      (confirmedCount > 0 ? confirmedCount + ' confirmada(s)' : '') +
      (confirmedCount > 0 && probableCount > 0 ? ', ' : '') +
      (probableCount > 0  ? probableCount  + ' provável(is)' : '') +
      ' · Excluídas do cálculo de renda nova' +
      '</div>';
    document.getElementById('pvMetrics').appendChild(internCard);
  }

  if (c.mesCritico || c.parserConfidence !== undefined) {
    const extra = document.createElement('div');
    extra.style.cssText = 'grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;margin-top:4px';
    if (c.mesCritico) {
      const m = c.mesCritico;
      extra.innerHTML += '<div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:8px;padding:8px 12px;font-size:11px;color:var(--muted2)">' +
        '<strong style="color:var(--text)">📅 Mês mais crítico: ' + m + '</strong>' +
        (c.perfil && c.perfil.avgCredits > 0 ? ' · Média histórica de créditos: ' + fmtBRL(Math.round(c.perfil.avgCredits)) : '') +
        '</div>';
    }
    if (c.parserConfidence !== undefined) {
      const pct = Math.round(c.parserConfidence * 100);
      const pColor = pct >= 90 ? 'var(--green)' : pct >= 70 ? 'var(--orange)' : 'var(--red)';
      extra.innerHTML += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:11px;color:var(--muted2)">' +
        'Confiança de leitura: <strong style="color:' + pColor + '">' + pct + '%</strong>' +
        (c.txnsDescartadas > 0 ? ' · ' + c.txnsDescartadas + ' transações descartadas' : '') +
        '</div>';
    }
    document.getElementById('pvMetrics').appendChild(extra);
  }

  document.getElementById('pvAlerts').innerHTML = alertsVisiveis.map(a => {
    const cls = a.type==='red'?'p-red':a.type==='yellow'?'p-yel':a.type==='green'?'p-grn':'p-blu';
    return `<div class="pal ${cls}">
      <span class="pal-ico">${a.icon}</span>
      <div><strong>${sanitize(a.title||'')}</strong><br>
      <span style="font-size:12px;opacity:0.85">${sanitize(a.text||'')}</span></div>
    </div>`;
  }).join('');
}

function eUnlockResult(){
  document.getElementById('paywallBlock').style.display='none';
  document.getElementById('realResultBlock').style.display='block';
  // Scroll suave até o resultado
  setTimeout(() => document.getElementById('realResultBlock').scrollIntoView({behavior:'smooth',block:'start'}), 100);
  const c=_eConsolidated,sources=_eSources;
  if(!c||!sources)return;
  let emoji,level,color;
  if(c.score<=20){emoji='🟢';level='BAIXO RISCO';color='#00d96e';}
  else if(c.score<=45){emoji='🟡';level='ATENÇÃO';color='#f5a623';}
  else if(c.score<=70){emoji='🟠';level='NÍVEL DE ATENÇÃO';color='#f97316';}
  else{emoji='🔴';level='REQUER ANÁLISE';color='#f04f60';}
  document.getElementById('ovEmoji').textContent=emoji;
  document.getElementById('ovLevel').textContent=level;
  document.getElementById('ovLevel').style.color=color;
  document.getElementById('ovSub').textContent=`${sources.length} extrato(s) · ${c.totalTxns} transações · Motor fiscal v3`;
  document.getElementById('pScoreVal').textContent=c.score+'%';
  document.getElementById('pScoreVal').style.color=color;
  document.getElementById('pBarFill').style.background=color;
  setTimeout(()=>{document.getElementById('pBarFill').style.width=c.score+'%';},200);

  // Índices do motor v2
  const icConsumo=Math.round((c.indiceConsumo||0)*100);
  const icEspecie=Math.round((c.indiceEspecie||0)*100);
  const pixPct=c.totalCredits>0?Math.round(c.pixTotal/c.totalCredits*100):0;
  document.getElementById('pStatsGrid').innerHTML=`
    <div class="p-stat"><div class="p-sl">Total créditos</div><div class="p-sv" style="color:var(--green)">${fmtBRL(c.totalCredits)}</div><div class="p-sn">${c.creditCount} entradas</div></div>
    <div class="p-stat"><div class="p-sl">Pix (% das entradas)</div><div class="p-sv" style="color:${pixPct>=50?'var(--red)':pixPct>=30?'var(--yellow)':'var(--text)'}">${fmtBRL(c.pixTotal)}</div><div class="p-sn">${pixPct}% das entradas</div></div>
    <div class="p-stat"><div class="p-sl">Índice de consumo</div><div class="p-sv" style="color:${icConsumo>=120?'var(--red)':icConsumo>=90?'var(--yellow)':'var(--green)'}">${icConsumo}%</div><div class="p-sn">saídas/entradas</div></div>
    <div class="p-stat"><div class="p-sl">Espécie</div><div class="p-sv" style="color:${icEspecie>=20?'var(--red)':icEspecie>=10?'var(--yellow)':'var(--green)'}">${icEspecie}%</div><div class="p-sn">das entradas</div></div>
    <div class="p-stat"><div class="p-sl">Para revisão</div><div class="p-sv" style="color:${c.suspCount>0?'var(--red)':'var(--green)'}">${c.suspCount}</div><div class="p-sn">alto risco</div></div>
    <div class="p-stat"><div class="p-sl">Padrões recorrentes</div><div class="p-sv" style="color:${c.recorrentes>3?'var(--yellow)':'var(--text)'}">${c.recorrentes}</div><div class="p-sn">detectados</div></div>`;

  document.getElementById('srcList').innerHTML=sources.map((r,i)=>`
    <div class="src-item"><div class="src-dot" style="background:${SRC_COLORS[i%SRC_COLORS.length]}"></div>
    <span class="src-bank">${sanitize(r.bank)}</span><span class="src-txns">${sanitize(String(r.totalTxns))} transações · ${sanitize(String(r.months))} mês(es)</span>
    <span class="src-val">${fmtBRL(r.totalCredits)}</span>
    <span style="font-size:10px;font-family:Manrope,sans-serif;font-weight:700;padding:2px 7px;border-radius:4px;background:${r.score<=20?'rgba(0,217,110,0.1)':r.score<=45?'rgba(245,166,35,0.1)':r.score<=70?'rgba(249,115,22,0.1)':'rgba(240,79,96,0.1)'};color:${r.score<=20?'var(--green)':r.score<=45?'var(--yellow)':r.score<=70?'#f97316':'var(--red)'}">${sanitize(String(r.score))}%</span></div>`).join('');

  document.getElementById('pAlertList').innerHTML=c.alerts.map(a=>`
    <div class="pal ${a.type==='red'?'p-red':a.type==='yellow'?'p-yel':a.type==='green'?'p-grn':'p-blu'}">
    <span class="pal-ico">${a.icon}</span><div><strong>${sanitize(a.title||'')}</strong><br><span style="font-size:12px;opacity:0.85">${sanitize(a.text||'')}</span></div></div>`).join('');

  const bankTabsEl = document.getElementById('bankTabs');
  bankTabsEl.innerHTML = '';
  ['all', ...sources.map(r => r.bank)].forEach((b, i) => {
    const btn = document.createElement('button');
    btn.className = 'btab' + (b === 'all' ? ' on' : '');
    btn.textContent = b === 'all' ? 'Todos' : b;
    btn.onclick = () => eSwitchBank(b);
    bankTabsEl.appendChild(btn);
  });
  eActiveBankTab='all';
  document.getElementById('pDbgPre').textContent=`Motor: v4.0\nExtratos: ${sources.length}\nTotal txns: ${c.totalTxns}\nScore: ${c.score}%\nÍndice consumo: ${Math.round((c.indiceConsumo||0)*100)}%\nÍndice espécie: ${Math.round((c.indiceEspecie||0)*100)}%\nPadrões recorrentes: ${c.recorrentes}\nAtividade comercial oculta: ${c.comercialOculta}\n`+sources.map(r=>`[${r.bank}] ${r.totalTxns} txns · score ${r.score}% · fatores: ${(r.fatores||[]).map(f=>f.motivo).join(', ')}`).join('\n');
  eRenderTxns('all');
}

function eSwitchBank(bank){
  eActiveBankTab=bank;
  document.querySelectorAll('.btab').forEach(b=>b.classList.toggle('on',b.textContent.trim()===(bank==='all'?'Todos':bank)));
  const currentFilter=document.getElementById('pfRisk').classList.contains('on')?'risk':'all';
  eRenderTxns(currentFilter);
}
function eRenderTxns(filter){
  let list=eActiveBankTab==='all'?[...eAllTxns]:eAllTxns.filter(t=>t.bank===eActiveBankTab);
  if(filter==='risk')list=list.filter(t=>t.risk!=='normal');
  list.sort((a,b)=>{const o={suspicious:0,attention:1,normal:2};if(o[a.risk]!==o[b.risk])return o[a.risk]-o[b.risk];return b.value-a.value;});
  document.getElementById('pTxnList').innerHTML=list.map(t=>{
    const dc=t.risk==='suspicious'?'pdr':t.risk==='attention'?'pdy':t.value>0?'pdg':'pdm';
    const cls=t.risk==='suspicious'?' s':t.risk==='attention'?' a':'';
    return`<div class="pti${cls}"><div class="pdot ${dc}"></div><div class="ptinfo"><div class="ptd">${sanitize(t.desc||'—')}</div><div class="ptt">${fmtDate(t.date)}</div></div><div class="ptv ${t.value>=0?'p':'n'}">${fmtBRL(t.value)}</div>${t.flag?`<span class="ptf ${t.risk==='suspicious'?'r':'y'}">${t.flag}</span>`:''}<span class="ptbank">${sanitize(t.bank||'')} </span></div>`;
  }).join('')||'<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px">Nenhuma transação</div>';
}
function eFilt(f){document.getElementById('pfAll').classList.toggle('on',f==='all');document.getElementById('pfRisk').classList.toggle('on',f==='risk');eRenderTxns(f);}
function eToggleDbg(){const b=document.getElementById('pDbgBd'),open=b.classList.toggle('open');document.getElementById('pDbgTog').textContent=open?'▲ recolher':'▼ ver';}
// Painel de debug só em desenvolvimento
if(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1'){
  const dbgHd=document.getElementById('pDbgHd');
  if(dbgHd){dbgHd.style.display='flex';document.getElementById('pDbgBd').style.display='';}
}
