// loaders.js — lazy loaders pdf.js e jsPDF



// ── LAZY LOADERS ──────────────────────────────────────────────────
let _pdfjsLoading = !1;

function _loadPdfJs() {
  return "undefined" != typeof pdfjsLib || _pdfjsLoading ? Promise.resolve() : (_pdfjsLoading = !0, new Promise((e, t) => {
    const n = document.createElement("script");
    n.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", n.crossOrigin = "anonymous", n.onload = () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js", e()
    }, n.onerror = () => t(new Error("Falha ao carregar pdf.js")), document.head.appendChild(n)
  }))
}
let _jspdfLoading = !1;

function _loadJsPDF() {
  return "undefined" != typeof jspdf || _jspdfLoading ? Promise.resolve() : (_jspdfLoading = !0, new Promise((e, t) => {
    const n = document.createElement("script");
    n.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", n.crossOrigin = "anonymous", n.onload = e, n.onerror = () => t(new Error("Falha ao carregar jsPDF")), document.head.appendChild(n)
  }))
}



