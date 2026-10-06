// Highlight + preguntar: al seleccionar texto en la página aparece un botón
// flotante "Preguntar a Speakito"; al pulsarlo se envía la selección al panel.
(() => {
  if (window.__speakitoSelectInit) return
  window.__speakitoSelectInit = true

  let btn = null

  function removeBtn() {
    if (btn) { btn.remove(); btn = null }
  }

  function showBtn(x, y, text) {
    removeBtn()
    btn = document.createElement('button')
    btn.textContent = '🗣️ Preguntar a Speakito'
    Object.assign(btn.style, {
      position: 'absolute', left: `${x}px`, top: `${y}px`, zIndex: 2147483647,
      background: '#26a8e0', color: '#04121b', border: 'none', borderRadius: '8px',
      padding: '6px 10px', font: '600 12px system-ui, sans-serif', cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(0,0,0,.3)',
    })
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      chrome.runtime.sendMessage({ type: 'SELECTION_ASK', selection: text }).catch(() => {})
      removeBtn()
    })
    document.body.appendChild(btn)
  }

  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const sel = window.getSelection()
      const text = sel ? sel.toString().trim() : ''
      if (text.length < 3) { removeBtn(); return }
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const x = window.scrollX + rect.left
      const y = window.scrollY + rect.bottom + 6
      showBtn(x, y, text)
    }, 10)
  })

  document.addEventListener('mousedown', (e) => {
    if (btn && e.target !== btn) removeBtn()
  })
  document.addEventListener('scroll', removeBtn, true)
})()
