// Se inyecta vía chrome.scripting.executeScript en CADA frame. La última
// expresión es el valor devuelto a executeScript (result por frame).
(() => {
  let title = document.title || ''
  let text = ''

  // Office 365 / Word·PowerPoint online: el texto vive en runs del editor, no
  // en nodos legibles por Readability. Lo extraemos directo del DOM.
  try {
    const host = location.hostname
    const esOffice = /(officeapps\.live\.com|office\.com|sharepoint\.com|onedrive\.live\.com)/.test(host)
    if (esOffice) {
      const runs = document.querySelectorAll(
        '.NormalTextRun, .OutlineElement [contenteditable] span, [role="textbox"] span, .Paragraph span'
      )
      const partes = []
      runs.forEach((n) => { const t = n.textContent?.trim(); if (t) partes.push(t) })
      const office = partes.join(' ').replace(/\s+/g, ' ').trim()
      if (office.length > 40) return { title, text: office, url: location.href }
    }
  } catch (e) { /* seguimos con Readability */ }

  try {
    const docClone = document.cloneNode(true)
    const article = new Readability(docClone).parse()
    if (article && article.textContent && article.textContent.trim().length > 200) {
      title = article.title || title
      text = article.textContent
    }
  } catch (e) { /* usamos el fallback */ }

  if (!text) {
    const sel = window.getSelection?.().toString?.() || ''
    text = sel.trim().length > 40 ? sel : (document.body?.innerText || '')
  }
  return { title, text: (text || '').trim(), url: location.href }
})()
