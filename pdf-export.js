// pdf-export.js — geração de relatório PDF

async function gerarRelatorioPDF() {
  await _loadJsPDF();
  if (typeof jspdf === 'undefined' || !jspdf || !jspdf.jsPDF) {
    alert('O módulo de PDF ainda está carregando. Aguarde alguns segundos e tente novamente.');
    return;
  }
  const c = _eConsolidated;
  const sources = _eSources;
  if (!c || !sources) { alert('Dados da análise não encontrados. Refaça a análise.'); return; }

  const btn = document.getElementById('btnExportPDF');
  if (btn) { btn.textContent = '⏳ Gerando PDF...'; btn.style.opacity = '0.7'; btn.disabled = true; }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, M = 14, CW = W - M * 2;
    let Y = 0;

    // ── Paleta limpa (fundo branco, acentos coloridos) ─────────────────
    const C = {
      white:   [255, 255, 255],
      bg:      [248, 249, 251],     // cinza muito claro
      surface: [255, 255, 255],
      card:    [243, 244, 246],     // card neutro
      border:  [229, 231, 235],
      text:    [17,  24,  39],      // quase preto
      muted:   [107, 114, 128],     // cinza médio
      muted2:  [156, 163, 175],
      green:   [16,  185, 129],     // emerald
      yellow:  [245, 158, 11],      // amber
      red:     [239, 68,  68],      // red
      orange:  [249, 115, 22],      // orange
      blue:    [59,  130, 246],     // blue
      greenBg: [236, 253, 245],
      yellowBg:[254, 243, 199],
      redBg:   [254, 226, 226],
      blueBg:  [239, 246, 255],
      accent:  [59,  130, 246],     // cor principal da marca
    };

    function sColor(s) {
      if (s <= 20) return { line: C.green,  bg: C.greenBg,  label: 'Perfil Compatível' };
      if (s <= 45) return { line: C.yellow, bg: C.yellowBg, label: 'Sinais de Atenção' };
      if (s <= 70) return { line: C.orange, bg: C.yellowBg, label: 'Nível de Atenção Elevado' };
      return       { line: C.red,    bg: C.redBg,   label: 'Requer Análise Urgente' };
    }

    function aColor(type) {
      if (type === 'red')    return { line: C.red,    bg: C.redBg    };
      if (type === 'yellow') return { line: C.yellow, bg: C.yellowBg };
      if (type === 'green')  return { line: C.green,  bg: C.greenBg  };
      return                        { line: C.blue,   bg: C.blueBg   };
    }

    // ── Helpers ────────────────────────────────────────────────────────
    function txt(text, x, y, opts = {}) {
      const { size = 9, color = C.text, bold = false, maxW = CW, align = 'left', italic = false } = opts;
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const style = bold ? 'bold' : italic ? 'italic' : 'normal';
      doc.setFont('helvetica', style);
      const lines = doc.splitTextToSize(String(text), maxW);
      doc.text(lines, x, y, { align });
      return lines.length * (size * 0.42);
    }

    function rect(x, y, w, h, fill, stroke = null, r = 1.5) {
      doc.setFillColor(...fill);
      if (stroke) { doc.setDrawColor(...stroke); doc.setLineWidth(0.3); doc.roundedRect(x, y, w, h, r, r, 'FD'); }
      else { doc.roundedRect(x, y, w, h, r, r, 'F'); }
    }

    function section(label, y) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.accent);
      doc.text(label.toUpperCase(), M, y);
      doc.setDrawColor(...C.accent);
      doc.setLineWidth(0.2);
      doc.line(M + doc.getTextWidth(label.toUpperCase()) + 2, y - 0.5, W - M, y - 0.5);
      return y + 6;
    }

    function newPage() {
      doc.addPage();
      // linha de topo
      doc.setFillColor(...C.accent);
      doc.rect(0, 0, W, 1.5, 'F');
      // rodapé
      drawFooter(doc.internal.getNumberOfPages());
      return 14;
    }

    function checkY(needed) {
      if (Y + needed > 272) { Y = newPage(); }
    }

    function drawFooter(p) {
      doc.setFillColor(...C.bg);
      doc.rect(0, 285, W, 12, 'F');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.muted2);
      doc.text('Guardião Fiscal · oguardiaofiscal.com.br · Diagnóstico preventivo e educacional', M, 290);
      doc.text('Este documento não substitui orientação de contador ou advogado tributarista.', M, 294);
      doc.setTextColor(...C.muted);
      doc.text('Pág. ' + p, W - M, 290, { align: 'right' });
      doc.text('Processamento 100% local · LGPD', W - M, 294, { align: 'right' });
    }

    // ════════════════════════════════════════════════════════════════════
    // CAPA / HEADER
    // ════════════════════════════════════════════════════════════════════
    // Barra superior azul
    doc.setFillColor(...C.accent);
    doc.rect(0, 0, W, 2, 'F');

    // Fundo do header
    rect(0, 2, W, 46, C.bg, null, 0);

    // Logo / título
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.accent);
    doc.text('Guardião', M, 20);
    doc.setTextColor(...C.text);
    doc.text(' Fiscal', M + doc.getTextWidth('Guardião'), 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text('Relatório de Análise de Coerência Fiscal', M, 27);

    const now = new Date();
    const dataStr = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
    txt(dataStr, W - M, 20, { size: 8, color: C.muted, align: 'right' });
    txt(sources.length + ' extrato(s) · ' + c.totalTxns + ' transações analisadas', W - M, 27, { size: 8, color: C.muted2, align: 'right' });

    // Linha divisória
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(M, 36, W - M, 36);

    // Tagline de privacidade
    txt('🔒 Processamento 100% local — nenhum dado bancário foi enviado a servidores externos', M, 42, { size: 7.5, color: C.muted, italic: true });

    Y = 56;

    // ════════════════════════════════════════════════════════════════════
    // SCORE PRINCIPAL
    // ════════════════════════════════════════════════════════════════════
    const sc = c.score;
    const scTheme = sColor(sc);

    // Card principal do score
    rect(M, Y, CW, 38, C.surface, C.border, 3);

    // Faixa lateral colorida
    doc.setFillColor(...scTheme.line);
    doc.roundedRect(M, Y, 4, 38, 1.5, 1.5, 'F');

    // Número grande
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...scTheme.line);
    doc.text(sc + '%', M + 12, Y + 24);

    // Barra de progresso
    const barX = M + 52, barY = Y + 10, barW = CW - 62, barH = 4;
    rect(barX, barY, barW, barH, C.card, null, 1);
    rect(barX, barY, Math.max(2, Math.round(barW * sc / 100)), barH, scTheme.line, null, 1);

    // Nível e label
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...scTheme.line);
    doc.text(scTheme.label, barX, Y + 22);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text('Score de Coerência Fiscal · Motor v3 · ' + sources.length + ' fonte(s)', barX, Y + 28);
    doc.text('Índice calculado por 6 fatores ponderados: compatibilidade, Pix, espécie, recorrência, anomalia temporal e perfil.', barX, Y + 33, { maxWidth: barW });

    Y += 46;

    // ════════════════════════════════════════════════════════════════════
    // FATORES QUE COMPÕEM O SCORE
    // ════════════════════════════════════════════════════════════════════
    const todosFatores = (sources || []).flatMap(r => r.fatores || []);
    const fatoresTop = todosFatores.filter(f => f.peso > 0).sort((a, b) => b.peso - a.peso).slice(0, 6);

    if (fatoresTop.length > 0) {
      checkY(10 + fatoresTop.length * 10 + 6);
      Y = section('Fatores que compõem o score', Y);

      fatoresTop.forEach((f, i) => {
        checkY(12);
        const fColor = f.peso >= 15 ? C.red : f.peso >= 8 ? C.yellow : C.muted;
        rect(M, Y, CW, 9, i % 2 === 0 ? C.bg : C.surface, null, 1);

        // nome do fator
        txt(f.motivo, M + 4, Y + 5.5, { size: 8, maxW: CW - 40 });

        // peso visual — barra pequena
        const pw = Math.min(CW - 10, Math.round((f.peso / 20) * 40));
        const barFX = W - M - 46;
        doc.setFillColor(...C.card);
        doc.roundedRect(barFX, Y + 2.5, 40, 4, 1, 1, 'F');
        doc.setFillColor(...fColor);
        doc.roundedRect(barFX, Y + 2.5, pw, 4, 1, 1, 'F');

        // valor +N
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...fColor);
        doc.text('+' + f.peso, W - M - 2, Y + 5.5, { align: 'right' });

        Y += 10;
      });
      Y += 4;
    }

    // ════════════════════════════════════════════════════════════════════
    // EXTRATOS ANALISADOS
    // ════════════════════════════════════════════════════════════════════
    checkY(20 + sources.length * 14);
    Y = section('Extratos analisados', Y);

    sources.forEach((r, i) => {
      checkY(14);
      const rTheme = sColor(r.score);
      rect(M, Y, CW, 12, i % 2 === 0 ? C.surface : C.bg, C.border, 2);
      doc.setFillColor(...rTheme.line);
      doc.roundedRect(M, Y, 3, 12, 1, 1, 'F');
      txt(r.bank, M + 6, Y + 4.5, { size: 9, bold: true });
      txt(r.totalTxns + ' transações · ' + r.months + ' mês(es)', M + 6, Y + 9, { size: 7.5, color: C.muted });
      txt(fmtBRL(r.totalCredits), W - M - 20, Y + 4.5, { size: 9, bold: true, color: C.green, align: 'right' });
      txt(r.score + '%', W - M, Y + 4.5, { size: 9, bold: true, color: rTheme.line, align: 'right' });
      txt(rTheme.label, W - M, Y + 9, { size: 7, color: C.muted2, align: 'right' });
      Y += 13;
    });
    Y += 4;

    // ════════════════════════════════════════════════════════════════════
    // INDICADORES FISCAIS — grid 3 colunas
    // ════════════════════════════════════════════════════════════════════
    const icConsumo = Math.round((c.indiceConsumo || 0) * 100);
    const icEspecie = Math.round((c.indiceEspecie || 0) * 100);
    const pixPct    = c.totalCredits > 0 ? Math.round(c.pixTotal / c.totalCredits * 100) : 0;

    const metricas = [
      { label: 'Total de créditos',          val: fmtBRL(c.totalCredits), sub: c.creditCount + ' entradas',      color: C.green  },
      { label: 'Pix recebidos',              val: fmtBRL(c.pixTotal),     sub: pixPct + '% das entradas',        color: pixPct >= 50 ? C.red : pixPct >= 30 ? C.yellow : C.text },
      { label: 'Índice de consumo',          val: icConsumo + '%',        sub: 'saídas ÷ entradas',              color: icConsumo >= 120 ? C.red : icConsumo >= 90 ? C.yellow : C.green },
      { label: 'Movimentações em espécie',   val: icEspecie + '%',        sub: 'das entradas',                   color: icEspecie >= 20 ? C.red : icEspecie >= 10 ? C.yellow : C.green },
      { label: 'Movimentos para revisão',    val: String(c.suspCount),    sub: 'merecem atenção',                color: c.suspCount > 0 ? C.red : C.green },
      { label: 'Padrões recorrentes',        val: String(c.recorrentes),  sub: 'atividade regular detectada',    color: c.recorrentes > 3 ? C.yellow : C.text },
    ];

    checkY(20 + Math.ceil(metricas.length / 3) * 22);
    Y = section('Indicadores fiscais', Y);

    const cw3 = (CW - 4) / 3;
    metricas.forEach((m, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const mx = M + col * (cw3 + 2), my = Y + row * 22;
      checkY(22);
      rect(mx, my, cw3, 19, C.surface, C.border, 2);
      txt(m.label,  mx + 4, my + 5,  { size: 7,    color: C.muted,  maxW: cw3 - 6 });
      txt(m.val,    mx + 4, my + 12, { size: 11.5, color: m.color,  maxW: cw3 - 6, bold: true });
      txt(m.sub,    mx + 4, my + 17, { size: 6.5,  color: C.muted2, maxW: cw3 - 6 });
    });
    Y += Math.ceil(metricas.length / 3) * 22 + 6;

    // ════════════════════════════════════════════════════════════════════
    // ALERTAS — com fundo colorido suave
    // ════════════════════════════════════════════════════════════════════
    if (c.alerts && c.alerts.length > 0) {
      checkY(16);
      Y = section('Sinais e orientações', Y);

      c.alerts.forEach(a => {
        const ac = aColor(a.type);
        const titleLines = doc.splitTextToSize(a.title || '', CW - 12);
        const textLines  = doc.splitTextToSize(a.text  || '', CW - 14);
        const bH = 5 + titleLines.length * 4.5 + textLines.length * 3.8 + 4;
        checkY(bH + 3);

        rect(M, Y, CW, bH, ac.bg, null, 2);
        // borda lateral fina
        doc.setFillColor(...ac.line);
        doc.roundedRect(M, Y, 2.5, bH, 1, 1, 'F');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...ac.line);
        doc.text(titleLines, M + 6, Y + 5.5);
        const tH = titleLines.length * 4.5;

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.muted);
        doc.text(textLines, M + 6, Y + 5.5 + tH + 1);
        Y += bH + 3;
      });
      Y += 4;
    }

    // ════════════════════════════════════════════════════════════════════
    // MOVIMENTAÇÕES RECORRENTES AGRUPADAS
    // ════════════════════════════════════════════════════════════════════
    const todasComerciais = (sources || []).flatMap(r => r.comercialOculta || []);
    if (todasComerciais.length > 0) {
      checkY(16);
      Y = section('Padrões recorrentes detectados', Y);
      txt('Recebimentos com frequência e ticket regular — possível atividade comercial não declarada.', M, Y, { size: 7.5, color: C.muted, italic: true });
      Y += 7;

      todasComerciais.slice(0, 8).forEach((r, i) => {
        checkY(14);
        rect(M, Y, CW, 12, i % 2 === 0 ? C.surface : C.bg, C.border, 2);
        const label = r.desc ? r.desc.slice(0, 38) : ('Padrão ' + (i + 1));
        txt(label, M + 4, Y + 4.5, { size: 8.5, bold: true });
        txt(r.count + ' recebimentos · Ticket médio: ' + fmtBRL(Math.round(r.media)) + ' · Total: ' + fmtBRL(r.total), M + 4, Y + 9, { size: 7.5, color: C.muted });
        rect(W - M - 30, Y + 2, 28, 8, C.yellowBg, null, 2);
        txt('Periodicidade regular', W - M - 2, Y + 6.5, { size: 6.5, color: C.yellow, align: 'right' });
        Y += 13;
      });
      Y += 4;
    }

    // ════════════════════════════════════════════════════════════════════
    // MOVIMENTAÇÕES QUE MERECEM REVISÃO (ex-"suspeitas")
    // ════════════════════════════════════════════════════════════════════
    const txnsRevisao = eAllTxns
      .filter(t => t.risk !== 'normal')
      .sort((a, b) => {
        const o = { suspicious: 0, attention: 1 };
        return (o[a.risk] || 2) - (o[b.risk] || 2) || b.value - a.value;
      })
      .slice(0, 25);

    if (txnsRevisao.length > 0) {
      checkY(20);
      Y = section('Movimentações que merecem revisão', Y);
      txt('Lista das transações com maior relevância fiscal, ordenadas por prioridade de revisão.', M, Y, { size: 7.5, color: C.muted, italic: true });
      Y += 7;

      // Cabeçalho
      rect(M, Y, CW, 7, C.card, null, 1);
      const cols = [
        { label: 'Data',       x: M + 2,   w: 22 },
        { label: 'Descrição',  x: M + 26,  w: 82 },
        { label: 'Banco',      x: M + 110, w: 28 },
        { label: 'Valor',      x: M + 140, w: 30 },
        { label: 'Revisão',    x: M + 172, w: 24 },
      ];
      cols.forEach(col => {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.muted);
        doc.text(col.label, col.x, Y + 4.5);
      });
      Y += 8;

      txnsRevisao.forEach((t, i) => {
        checkY(8);
        const rTheme = t.risk === 'suspicious'
          ? { bg: [254,226,226], color: C.red,    label: 'Prioritária' }
          : { bg: [254,243,199], color: C.yellow, label: 'Moderada'    };
        rect(M, Y, CW, 6.5, i % 2 === 0 ? C.surface : C.bg, null, 0);
        // faixinha lateral
        doc.setFillColor(...rTheme.color);
        doc.rect(M, Y, 1.5, 6.5, 'F');

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.text);
        doc.text(fmtDate(t.date), cols[0].x, Y + 4.2);
        const dsc = doc.splitTextToSize(t.desc || '—', cols[1].w)[0];
        doc.text(dsc, cols[1].x, Y + 4.2);
        doc.setTextColor(...C.muted);
        doc.text((t.bank || '').slice(0, 10), cols[2].x, Y + 4.2);
        if (t.value >= 0) { doc.setTextColor(...C.green); } else { doc.setTextColor(...C.text); }
        doc.text(fmtBRL(t.value), cols[3].x, Y + 4.2);
        doc.setTextColor(...rTheme.color);
        doc.text(rTheme.label, cols[4].x, Y + 4.2);
        Y += 7;
      });
      Y += 4;
    }

    // ════════════════════════════════════════════════════════════════════
    // ORIENTAÇÕES FINAIS
    // ════════════════════════════════════════════════════════════════════
    checkY(38);
    Y = section('Próximos passos recomendados', Y);

    const orientacoes = [
      { icon: '📊', text: 'Compare os créditos identificados com o total declarado no IR. Divergências superiores a 20% são as mais frequentemente retidas.' },
      { icon: '📁', text: 'Tenha comprovantes de origem disponíveis para todas as entradas relevantes — especialmente transferências, Pix recorrentes e depósitos em espécie.' },
      { icon: '👨‍💼', text: 'Consulte um contador antes da entrega da declaração para validar os pontos de atenção identificados neste relatório.' },
      { icon: '🔄', text: 'Se já entregou a declaração, avalie a possibilidade de retificação preventiva. Após notificação, multas e juros se aplicam automaticamente.' },
    ];

    orientacoes.forEach((o, i) => {
      checkY(14);
      rect(M, Y, CW, 11, i % 2 === 0 ? C.bg : C.surface, C.border, 2);
      txt(o.icon, M + 3, Y + 7, { size: 9 });
      txt(o.text, M + 12, Y + 4.5, { size: 7.5, color: C.text, maxW: CW - 16 });
      Y += 12;
    });

    // ════════════════════════════════════════════════════════════════════
    // DISCLAIMER LEGAL
    // ════════════════════════════════════════════════════════════════════
    checkY(20);
    Y += 6;
    rect(M, Y, CW, 16, C.card, C.border, 2);
    txt('⚠️  Aviso Legal', M + 4, Y + 5, { size: 8, bold: true, color: C.muted });
    txt('Este relatório é uma ferramenta de diagnóstico educacional e preventivo. Os resultados são estimativas com base em padrões fiscais conhecidos e não constituem parecer jurídico, contábil ou auditoria fiscal. O Guardião Fiscal não tem acesso à sua declaração de IR nem ao sistema da Receita Federal. Consulte sempre um profissional habilitado para decisões fiscais.', M + 4, Y + 9.5, { size: 7, color: C.muted, maxW: CW - 6, italic: true });
    Y += 18;

    // ════════════════════════════════════════════════════════════════════
    // RODAPÉS em todas as páginas
    // ════════════════════════════════════════════════════════════════════
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter(p);
    }

    const filename = 'guardiao-fiscal-' + now.toISOString().slice(0, 10) + '.pdf';
    doc.save(filename);

  } catch(err) {
    console.error('[GuardiaoFiscal] Erro ao gerar PDF:', err);
    alert('Erro ao gerar o PDF: ' + err.message);
  } finally {
    if (btn) { btn.innerHTML = '📄 Exportar relatório em PDF'; btn.style.opacity = '1'; btn.disabled = false; }
  }
}


function eResetAll(){
  eFiles=[];eAllTxns=[];eActiveBankTab='all';
  _eConsolidated=null;_eSources=null;
  window._rendaDeclaradaMensal=0;
  const _ri=document.getElementById('rendaDeclaradaInput');if(_ri)_ri.value='';
  document.getElementById('fileList').innerHTML='';
  document.getElementById('limitBar').style.display='none';
  document.getElementById('actBar').style.display='none';
  document.getElementById('extStep3').style.display='none';
  document.getElementById('pFillExt').style.width='0%';
  document.getElementById('dzIco').textContent='📂';
  document.getElementById('dzTtl').textContent='Arraste os extratos ou clique para selecionar';
  document.getElementById('paywallBlock').style.display='block';
  document.getElementById('realResultBlock').style.display='none';
  // Reset preview
  const previewReal = document.getElementById('previewReal');
  const previewPlaceholder = document.getElementById('previewPlaceholder');
  if(previewReal) previewReal.style.display='none';
  if(previewPlaceholder) previewPlaceholder.style.display='block';
  const pvBar = document.getElementById('pvBarFill');
  if(pvBar) pvBar.style.width='0%';
  const s2=document.getElementById('extStep2');
  if(_currentUser){s2.style.opacity='1';s2.style.pointerEvents='auto';}
  else{s2.style.opacity='0.45';s2.style.pointerEvents='none';}
  const s2num=document.getElementById('s2num');
  if(s2num){s2num.textContent='2';s2num.style.background='';s2num.style.color='';}
  eShowErr('');
}

// extrato step 1 — handled by Supabase auth above





