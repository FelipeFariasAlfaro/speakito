// Extracción de documentos que Readability no puede leer: Google Docs/Slides,
// PDFs (incluido el visor de Chrome y Drive) y Office 365 online.
// Se usa desde el side panel, que puede hacer fetch con las cookies del usuario
// e importar pdf.js como módulo ESM.
//
// Devuelve { title, text } o null si la URL no es un documento reconocido.

/** ¿Esta URL corresponde a un documento especial (no HTML normal)? */
export function esDocumentoEspecial(url = '') {
  return !!(detectarGoogleDoc(url) || esPdf(url) || esOffice(url))
}

/** Punto de entrada: intenta extraer según el tipo de documento. */
export async function extraerDocumento(url = '') {
  const g = detectarGoogleDoc(url)
  if (g) return extraerGoogleDoc(g)
  if (esPdf(url)) return extraerPdf(url)
  // Office 365 se maneja en el content script (DOM); aquí no aplica.
  return null
}

/* ─────────── Google Docs / Slides / Sheets ─────────── */

function detectarGoogleDoc(url) {
  // https://docs.google.com/document/d/<ID>/edit  (también presentation / spreadsheets)
  const m = url.match(/https:\/\/docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/)
  if (!m) return null
  return { tipo: m[1], id: m[2] }
}

async function extraerGoogleDoc({ tipo, id }) {
  // La API de export entrega el texto si el usuario tiene sesión y permiso.
  let exportUrl
  if (tipo === 'document') exportUrl = `https://docs.google.com/document/d/${id}/export?format=txt`
  else if (tipo === 'presentation') exportUrl = `https://docs.google.com/presentation/d/${id}/export/txt`
  else exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`

  const r = await fetch(exportUrl, { credentials: 'include' })
  if (!r.ok) {
    throw new Error(
      r.status === 401 || r.status === 403
        ? 'No tengo permiso para leer este documento de Google. Ábrelo con tu cuenta o compártelo.'
        : `No se pudo exportar el documento (HTTP ${r.status}).`
    )
  }
  const text = (await r.text()).trim()
  if (!text) throw new Error('El documento está vacío o no se pudo leer.')
  return { title: 'Documento de Google', text }
}

/* ─────────── PDF ─────────── */

function esPdf(url) {
  if (/\.pdf(\?|#|$)/i.test(url)) return true
  // Visor de PDF de Drive: /file/d/<id>/view  (puede no ser PDF, se valida al bajar)
  if (/https:\/\/drive\.google\.com\/file\/d\//.test(url)) return true
  return false
}

function pdfDownloadUrl(url) {
  const drive = url.match(/https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}`
  return url
}

async function extraerPdf(url) {
  const pdfjs = await import('./pdf.min.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.mjs')

  const r = await fetch(pdfDownloadUrl(url), { credentials: 'include' })
  if (!r.ok) throw new Error(`No se pudo descargar el PDF (HTTP ${r.status}).`)
  const buf = await r.arrayBuffer()

  const pdf = await pdfjs.getDocument({ data: buf }).promise
  const MAX_PAGINAS = 50
  const total = Math.min(pdf.numPages, MAX_PAGINAS)
  const partes = []
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const linea = content.items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim()
    if (linea) partes.push(linea)
  }
  const text = partes.join('\n\n').trim()
  if (!text) throw new Error('El PDF no tiene texto seleccionable (podría ser escaneado).')
  const title = (pdf._pdfInfo?.title) || 'Documento PDF'
  return { title, text: pdf.numPages > MAX_PAGINAS ? `${text}\n\n[...PDF truncado a ${MAX_PAGINAS} páginas...]` : text }
}

/* ─────────── Office 365 (detección; extracción en content script) ─────────── */

function esOffice(url) {
  return /https:\/\/[^/]*(officeapps\.live\.com|office\.com|sharepoint\.com|onedrive\.live\.com|1drv\.ms)/.test(url)
}
