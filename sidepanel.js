// Lógica del side panel: extraer contenido, llamar a la IA, chat y TTS.

const $ = (id) => document.getElementById(id)
const chat = $('chat')

let lastSpeakRate = 1

// ───────── Ajustes ─────────
const settingsPanel = $('settings-backdrop')
const openSettings = () => settingsPanel.classList.remove('hidden')
const closeSettings = () => settingsPanel.classList.add('hidden')
$('btn-settings').addEventListener('click', openSettings)
$('btn-settings-close').addEventListener('click', closeSettings)
// Cerrar al hacer clic fuera del cuadro o con Escape.
settingsPanel.addEventListener('click', (e) => { if (e.target === settingsPanel) closeSettings() })
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !settingsPanel.classList.contains('hidden')) closeSettings() })

// Modal "Acerca de"
const aboutBackdrop = $('about-backdrop')
const closeAbout = () => aboutBackdrop.classList.add('hidden')
$('btn-about').addEventListener('click', () => aboutBackdrop.classList.remove('hidden'))
$('btn-about-close').addEventListener('click', closeAbout)
aboutBackdrop.addEventListener('click', (e) => { if (e.target === aboutBackdrop) closeAbout() })
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !aboutBackdrop.classList.contains('hidden')) closeAbout() })

function needsKey(provider) {
  return provider !== 'ollama'
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'ocean')
}

async function loadSettings() {
  const s = await chrome.storage.sync.get({
    provider: 'gemini', apiKey: '', model: '',
    ollamaUrl: 'http://localhost:11434', targetLang: 'español', theme: 'ocean', voiceName: '',
  })
  $('set-provider').value = s.provider
  $('set-key').value = s.apiKey
  $('set-ollama-url').value = s.ollamaUrl
  $('set-lang').value = s.targetLang
  $('set-theme').value = s.theme
  applyTheme(s.theme)
  populateVoices()
  if (s.voiceName) $('set-voice').value = s.voiceName
  toggleProviderFields(s.provider)
  // Si ya hay un modelo guardado, mostrarlo como única opción (sin forzar revalidar).
  if (s.model) {
    const sel = $('set-model')
    sel.innerHTML = `<option value="${s.model}">${s.model}</option>`
    $('model-group').classList.remove('hidden')
    $('btn-save').disabled = false
  }
  return s
}

function toggleProviderFields(provider) {
  const isOllama = provider === 'ollama'
  $('key-group').classList.toggle('hidden', isOllama)
  $('ollama-group').classList.toggle('hidden', !isOllama)
  // Al cambiar de proveedor, invalidar el modelo hasta revalidar.
  $('model-group').classList.add('hidden')
  $('set-model').innerHTML = ''
  $('btn-save').disabled = true
  $('validate-msg').textContent = ''
}
$('set-provider').addEventListener('change', (e) => toggleProviderFields(e.target.value))
// Previsualizar y persistir el tema al instante (independiente de guardar el modelo).
$('set-theme').addEventListener('change', (e) => {
  applyTheme(e.target.value)
  chrome.storage.sync.set({ theme: e.target.value })
})

// 3-4-5. Validar la key y traer los modelos disponibles.
$('btn-validate').addEventListener('click', async () => {
  const provider = $('set-provider').value
  const apiKey = $('set-key').value.trim()
  const ollamaUrl = $('set-ollama-url').value.trim() || 'http://localhost:11434'
  const msg = $('validate-msg')

  if (needsKey(provider) && !apiKey) {
    msg.textContent = '⚠️ Ingresa la API key primero.'
    msg.className = 'hint err'
    return
  }
  msg.textContent = 'Validando y buscando modelos...'
  msg.className = 'hint'
  $('btn-validate').disabled = true

  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'LIST_MODELS', payload: { provider, apiKey, ollamaUrl },
    })
    if (!resp?.ok) {
      msg.textContent = '❌ ' + (resp?.error || 'No se pudo validar.')
      msg.className = 'hint err'
      $('model-group').classList.add('hidden')
      $('btn-save').disabled = true
      return
    }
    const models = resp.models || []
    if (!models.length) {
      msg.textContent = '⚠️ Key válida pero no se encontraron modelos.'
      msg.className = 'hint err'
      return
    }
    const sel = $('set-model')
    sel.innerHTML = models.map((m) => `<option value="${m}">${m}</option>`).join('')
    $('model-group').classList.remove('hidden')
    $('btn-save').disabled = false
    msg.textContent = `✅ Validado. ${models.length} modelos disponibles.`
    msg.className = 'hint ok'
  } catch (e) {
    msg.textContent = '❌ ' + String(e?.message || e)
    msg.className = 'hint err'
  } finally {
    $('btn-validate').disabled = false
  }
})

// 6. Guardar la selección.
$('btn-save').addEventListener('click', async () => {
  const provider = $('set-provider').value
  const model = $('set-model').value
  if (!model) return
  await chrome.storage.sync.set({
    provider,
    apiKey: $('set-key').value.trim(),
    model,
    ollamaUrl: $('set-ollama-url').value.trim() || 'http://localhost:11434',
    targetLang: $('set-lang').value.trim() || 'español',
  })
  settingsPanel.classList.add('hidden')
  addMsg('bot', `Ajustes guardados. Proveedor: ${provider}, modelo: ${model}.`)
})

// Último texto generado por el bot (lectura/resumen/respuesta), para exportar.
let lastBotText = ''
let lastTitle = 'speakito'

// ───────── Chat UI ─────────
function addMsg(role, text, { speakable = false } = {}) {
  const div = document.createElement('div')
  div.className = `msg ${role}`
  // Los mensajes del bot pueden traer markdown de la IA: se renderiza de forma
  // segura (sin innerHTML). El usuario y otros roles van como texto plano.
  if (role === 'bot') renderMarkdown(div, text)
  else div.textContent = text
  if (speakable) {
    const btn = document.createElement('button')
    btn.className = 'speak'
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" style="vertical-align:-2px">' +
      '<path d="M4 10v4a1 1 0 0 0 1 1h2.5l3.5 3V6L7.5 9H5a1 1 0 0 0-1 1z" fill="currentColor"/>' +
      '<path d="M15 9c1.3.9 1.3 5.1 0 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path d="M17.5 7c2.3 1.6 2.3 8.4 0 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Escuchar'
    btn.addEventListener('click', () => speak(text))
    div.appendChild(document.createElement('br'))
    div.appendChild(btn)
    lastBotText = text
    $('btn-export').disabled = false
  }
  chat.appendChild(div)
  chat.scrollTop = chat.scrollHeight
  return div
}

function addLoading(label = 'Pensando...') {
  const div = addMsg('bot', label)
  div.classList.add('loading')
  return div
}

// ───────── Extraer contenido de la pestaña activa (incluye iframes) ─────────
async function getPageContent(targetTab = null) {
  const tab = targetTab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
  if (!tab?.id) throw new Error('No hay pestaña activa.')

  // Documentos que Readability no puede leer (Google Docs/Slides, PDF, Drive):
  // se extraen por fetch/pdf.js desde el panel. Office 365 cae al scraping del
  // DOM de abajo porque su texto sí está en el documento.
  try {
    const docx = await import('./lib/doc-extract.js')
    if (docx.esDocumentoEspecial(tab.url || '')) {
      const doc = await docx.extraerDocumento(tab.url)
      if (doc?.text) {
        let text = doc.text
        const MAX = 24000
        if (text.length > MAX) text = text.slice(0, MAX) + '\n\n[...contenido truncado...]'
        return { title: doc.title || tab.title || '', text, url: tab.url }
      }
    }
  } catch (e) {
    // Si falla la ruta de documento, informamos claro (p. ej. sin permiso).
    throw new Error(e.message || 'No se pudo leer el documento.')
  }

  // Inyectar en TODOS los frames (muchos sitios ponen el contenido real en un
  // iframe: cursos, visores, docs embebidos). Así no se pierde ese texto.
  let results = []
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['lib/Readability.js', 'content-extract.js'],
    })
  } catch (e) {
    throw new Error('No se pudo acceder al contenido de la página.')
  }

  // Combinar el texto de todos los frames, el más largo primero (suele ser el
  // contenido principal), descartando los vacíos/basura.
  const frames = results
    .map((r) => r.result)
    .filter((x) => x && x.text && x.text.trim().length > 40)
    .sort((a, b) => b.text.length - a.text.length)

  if (!frames.length) throw new Error('No se pudo extraer texto de la página.')

  const title = frames[0].title || tab.title || ''
  let text = frames.map((f) => f.text).join('\n\n────────\n\n')
  const MAX = 24000
  if (text.length > MAX) text = text.slice(0, MAX) + '\n\n[...contenido truncado...]'
  return { title, text, url: tab.url }
}

// ───────── IA ─────────
async function callAI({ mode, question, selection, skipPage, tab }) {
  const settings = await chrome.storage.sync.get({ targetLang: 'español' })
  let page = { text: '', title: '' }
  if (!skipPage) {
    page = await getPageContent(tab)
    if (!page?.text) throw new Error('No se pudo extraer texto de la página.')
    if (page.title) lastTitle = page.title
  }
  const resp = await chrome.runtime.sendMessage({
    type: 'ASK_AI',
    payload: {
      pageText: page.text,
      pageTitle: page.title,
      question,
      mode,
      selection,
      targetLang: settings.targetLang,
    },
  })
  if (!resp?.ok) throw new Error(resp?.error || 'Error de IA.')
  return resp.text
}

// ───────── Acciones ─────────
$('btn-read').addEventListener('click', async () => {
  const loading = addLoading('Preparando lectura...')
  try {
    const text = await callAI({ mode: 'read' })
    loading.remove()
    addMsg('bot', text, { speakable: true })
    speak(text)
  } catch (e) {
    loading.remove()
    addMsg('bot', '⚠️ ' + e.message)
  }
})

// Explícame simple
$('btn-simple').addEventListener('click', async () => {
  const loading = addLoading('Explicando en simple...')
  try {
    const text = await callAI({ mode: 'simple' })
    loading.remove()
    addMsg('bot', text, { speakable: true })
    speak(text)
  } catch (e) {
    loading.remove()
    addMsg('bot', '⚠️ ' + e.message)
  }
})

// Detectar sesgo / fuentes
$('btn-bias').addEventListener('click', async () => {
  const loading = addLoading('Analizando sesgos y fuentes...')
  try {
    const text = await callAI({ mode: 'bias' })
    loading.remove()
    addMsg('bot', text, { speakable: true })
  } catch (e) {
    loading.remove()
    addMsg('bot', '⚠️ ' + e.message)
  }
})

// Highlight + preguntar: llega desde content-select.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'SELECTION_ASK' && msg.selection) handleSelection(msg.selection)
  if (msg?.type === 'SELECTION_READ' && msg.selection) handleReadSelection(msg.selection)
})
async function handleSelection(selection) {
  addMsg('user', `🔎 "${selection.slice(0, 160)}${selection.length > 160 ? '…' : ''}"`)
  const loading = addLoading('Analizando selección...')
  try {
    const text = await callAI({ mode: 'selection', selection })
    loading.remove()
    addMsg('bot', text, { speakable: true })
  } catch (e) {
    loading.remove()
    addMsg('bot', '⚠️ ' + e.message)
  }
}
// Leer la selección en voz alta directamente (sin pasar por la IA).
function handleReadSelection(selection) {
  addMsg('user', `🔊 "${selection.slice(0, 160)}${selection.length > 160 ? '…' : ''}"`)
  addMsg('bot', selection, { speakable: true })
  speak(selection)
}

// ───────── Léemelo mientras navego (sigue leyendo al cambiar de pestaña) ─────────
let navReadOn = false
$('btn-navread').addEventListener('click', async () => {
  navReadOn = !navReadOn
  $('btn-navread').classList.toggle('active', navReadOn)
  if (navReadOn) {
    addMsg('bot', '🎧 Modo "léemelo navegando" activado. Leeré el contenido de cada página que abras.')
    await readCurrentForNav()
  } else {
    addMsg('bot', 'Modo "léemelo navegando" desactivado.')
    ttsSend('TTS_STOP')
  }
})
async function readCurrentForNav() {
  if (!navReadOn) return
  const loading = addLoading('Preparando lectura...')
  try {
    const text = await callAI({ mode: 'read' })
    loading.remove()
    addMsg('bot', text, { speakable: true })
    speak(text)
  } catch (e) {
    loading.remove()
    addMsg('bot', '⚠️ ' + e.message)
  }
}
// Al cambiar de pestaña activa o navegar, leer la nueva página.
chrome.tabs.onActivated.addListener(() => { if (navReadOn) readCurrentForNav() })
chrome.tabs.onUpdated.addListener((_id, info, tab) => {
  if (navReadOn && info.status === 'complete' && tab.active) readCurrentForNav()
})

// ───────── Playlist: leer todas las pestañas abiertas, una tras otra ─────────
let playlistOn = false
$('btn-playlist').addEventListener('click', async () => {
  if (playlistOn) { stopPlaylist(); return }
  const tabs = (await chrome.tabs.query({ currentWindow: true }))
    .filter((t) => /^https?:\/\//.test(t.url || ''))
  if (!tabs.length) { addMsg('bot', 'No hay pestañas con contenido para leer.'); return }
  playlistOn = true
  $('btn-playlist').classList.add('active')
  addMsg('bot', `🎵 Playlist: leeré ${tabs.length} pestaña(s), una tras otra.`)
  readPlaylist(tabs, 0)
})
function stopPlaylist() {
  playlistOn = false
  $('btn-playlist').classList.remove('active')
  tts.onDone = null
  ttsSend('TTS_STOP')
  hidePlayer()
  addMsg('bot', 'Playlist detenida.')
}
async function readPlaylist(tabs, i) {
  if (!playlistOn || i >= tabs.length) {
    if (playlistOn) { playlistOn = false; $('btn-playlist').classList.remove('active'); addMsg('bot', '✅ Playlist terminada.') }
    return
  }
  const tab = tabs[i]
  const loading = addLoading(`Leyendo ${i + 1}/${tabs.length}: ${(tab.title || tab.url).slice(0, 60)}…`)
  try {
    const text = await callAI({ mode: 'read', tab })
    loading.remove()
    if (!playlistOn) return
    addMsg('bot', `📄 ${tab.title || tab.url}`)
    addMsg('bot', text, { speakable: true })
    speak(text, () => readPlaylist(tabs, i + 1))   // al terminar, siguiente pestaña
  } catch (e) {
    loading.remove()
    addMsg('bot', `⚠️ (${i + 1}/${tabs.length}) ${e.message}`)
    readPlaylist(tabs, i + 1)   // saltar la que falle
  }
}

async function sendQuestion() {
  const q = $('question').value.trim()
  if (!q) return
  $('question').value = ''
  addMsg('user', q)
  const loading = addLoading()
  try {
    const text = await callAI({ mode: 'ask', question: q })
    loading.remove()
    addMsg('bot', text, { speakable: true })
  } catch (e) {
    loading.remove()
    addMsg('bot', '⚠️ ' + e.message)
  }
}
$('btn-ask').addEventListener('click', sendQuestion)
$('question').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendQuestion()
  }
})

// ───────── Text-to-Speech (voz en español) ─────────
$('rate').addEventListener('input', (e) => {
  lastSpeakRate = parseFloat(e.target.value)
})


function pickSpanishVoice() {
  const voices = speechSynthesis.getVoices()
  return voices.find((v) => /es(-|_)/i.test(v.lang)) ||
         voices.find((v) => v.lang?.toLowerCase().startsWith('es')) || null
}

function pickVoice(prefix) {
  // Si el usuario eligió una voz concreta en Ajustes, úsala.
  const chosen = $('set-voice')?.value
  if (chosen) {
    const v = speechSynthesis.getVoices().find((x) => x.name === chosen)
    if (v) return v
  }
  const re = new RegExp(`^${prefix}`, 'i')
  return speechSynthesis.getVoices().find((v) => re.test(v.lang)) || null
}

// Llena el selector de voces (se re-llama al cargar voces de forma asíncrona).
function populateVoices() {
  const sel = $('set-voice')
  if (!sel) return
  const prev = sel.value
  const voices = speechSynthesis.getVoices() || []
  sel.innerHTML = '<option value="">Automática (según idioma)</option>' +
    voices.map((v) => `<option value="${v.name}">${v.name} (${v.lang})</option>`).join('')
  // Restaurar selección previa o la guardada.
  if (prev && voices.some((v) => v.name === prev)) sel.value = prev
}
$('set-voice').addEventListener('change', (e) => {
  chrome.storage.sync.set({ voiceName: e.target.value })
})

// Render seguro de markdown básico (sin innerHTML): párrafos, viñetas, listas
// numeradas, encabezados, **negrita**, *cursiva* y `código`. Construye nodos DOM
// con textContent, así el texto de la IA nunca se interpreta como HTML.
function appendInline(parent, texto) {
  // Divide por **negrita**, *cursiva*/_cursiva_ y `código`.
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g
  let last = 0
  let m
  while ((m = re.exec(texto)) !== null) {
    if (m.index > last) parent.appendChild(document.createTextNode(texto.slice(last, m.index)))
    const tok = m[0]
    let el, inner
    if (tok.startsWith('**') || tok.startsWith('__')) { el = document.createElement('strong'); inner = tok.slice(2, -2) }
    else if (tok.startsWith('`')) { el = document.createElement('code'); inner = tok.slice(1, -1) }
    else { el = document.createElement('em'); inner = tok.slice(1, -1) }
    el.textContent = inner
    parent.appendChild(el)
    last = m.index + tok.length
  }
  if (last < texto.length) parent.appendChild(document.createTextNode(texto.slice(last)))
}

function renderMarkdown(container, text) {
  container.textContent = ''
  const lineas = String(text ?? '').split(/\r?\n/)
  let lista = null       // <ul> o <ol> en curso
  for (const raw of lineas) {
    const linea = raw.trimEnd()
    const viñeta = linea.match(/^\s*[-*+]\s+(.*)$/)
    const numerada = linea.match(/^\s*\d+[.)]\s+(.*)$/)
    const encabezado = linea.match(/^\s*(#{1,6})\s+(.*)$/)

    if (viñeta || numerada) {
      const tag = viñeta ? 'ul' : 'ol'
      if (!lista || lista.tagName.toLowerCase() !== tag) { lista = document.createElement(tag); container.appendChild(lista) }
      const li = document.createElement('li')
      appendInline(li, (viñeta ? viñeta[1] : numerada[1]))
      lista.appendChild(li)
      continue
    }
    lista = null
    if (!linea.trim()) continue
    if (encabezado) {
      const h = document.createElement('strong')
      h.className = 'md-h'
      appendInline(h, encabezado[2])
      container.appendChild(h)
    } else {
      const p = document.createElement('p')
      appendInline(p, linea)
      container.appendChild(p)
    }
  }
  if (!container.childNodes.length) container.textContent = text
}

// Quita marcas de markdown para que el TTS no lea "asterisco", "almohadilla", etc.
function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')      // bloques de código
    .replace(/`([^`]+)`/g, '$1')           // código en línea
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // imágenes
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // enlaces -> texto
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')    // encabezados #
    .replace(/^\s*>+\s?/gm, '')            // citas >
    .replace(/^\s*[-*+]\s+/gm, '')         // viñetas - * +
    .replace(/^\s*\d+\.\s+/gm, '')         // listas numeradas
    .replace(/(\*\*\*|___)(.*?)\1/g, '$2') // negrita+cursiva
    .replace(/(\*\*|__)(.*?)\1/g, '$2')    // negrita
    .replace(/(\*|_)(.*?)\1/g, '$2')       // cursiva
    .replace(/~~(.*?)~~/g, '$1')           // tachado
    .replace(/^\s*([-*_]\s*){3,}$/gm, ' ') // separadores ---
    .replace(/[*_#`~]/g, ' ')              // cualquier marca suelta restante
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

// ───────── Reproductor ─────────
const player = $('player')
const plBar = $('pl-bar')
const plToggle = $('pl-toggle')
const plStatus = $('pl-status')

const ICON_PAUSE = '<svg class="pl-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor"/></svg>'
const ICON_PLAY = '<svg class="pl-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10-6.5a1 1 0 0 0 0-1.72l-10-6.5A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>'

// El audio corre en un documento OFFSCREEN (vía background), así sigue sonando
// aunque se cierre el panel. Aquí solo reflejamos el estado y enviamos comandos.
const tts = {
  total: 0,
  index: 0,
  playing: false,
  paused: false,
  onDone: null,       // callback para encadenar la playlist al terminar
}

function showPlayer() {
  player.classList.remove('hidden')
  plToggle.innerHTML = ICON_PAUSE
  plToggle.title = 'Pausar'
  plStatus.textContent = 'Reproduciendo…'
  updateProgress()
}
function hidePlayer() {
  player.classList.add('hidden')
  plBar.style.width = '0%'
}
function updateProgress() {
  const pct = tts.total ? Math.round((tts.index / tts.total) * 100) : 0
  plBar.style.width = pct + '%'
}

// Comandos al offscreen (a través del service worker).
function ttsSend(type, payload) {
  chrome.runtime.sendMessage(payload ? { type, payload } : { type }).catch(() => {})
}

// Estado emitido por el offscreen: refresca el reproductor del panel.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'TTS_STATE') return
  const s = msg.state || {}
  tts.playing = s.playing
  tts.paused = s.paused
  tts.index = s.index || 0
  tts.total = s.total || 0
  if (s.done || (!s.playing && !s.paused)) {
    hidePlayer()
    const cb = tts.onDone; tts.onDone = null
    if (s.done && cb) cb()   // encadenar siguiente ítem de la playlist
    return
  }
  player.classList.remove('hidden')
  if (s.paused) {
    plToggle.innerHTML = ICON_PLAY; plToggle.title = 'Continuar'; plStatus.textContent = 'En pausa'
  } else {
    plToggle.innerHTML = ICON_PAUSE; plToggle.title = 'Pausar'; plStatus.textContent = 'Reproduciendo…'
  }
  updateProgress()
})

plToggle.addEventListener('click', () => {
  if (!tts.total) return
  if (tts.paused) ttsSend('TTS_RESUME')
  else if (tts.playing) ttsSend('TTS_PAUSE')
})
$('pl-stop').addEventListener('click', () => {
  tts.onDone = null
  if (playlistOn) { playlistOn = false; $('btn-playlist').classList.remove('active') }
  ttsSend('TTS_STOP')
  hidePlayer()
})

function speak(text, onDone = null) {
  tts.onDone = onDone
  text = stripMarkdown(text)
  const lang = ($('set-lang')?.value || 'español').toLowerCase()
  const isEnglish = lang.startsWith('ing') || lang.startsWith('eng')
  const voice = pickVoice(isEnglish ? 'en' : 'es')
  // SpeechSynthesis corta textos largos: trocear por oraciones.
  const chunks = (text.match(/[^.!?\n]+[.!?\n]*/g) || [text])
    .map((c) => c.trim()).filter(Boolean)
  if (!chunks.length) return

  tts.total = chunks.length
  tts.index = 0
  tts.playing = true
  tts.paused = false
  showPlayer()
  ttsSend('TTS_START', {
    chunks,
    lang: voice?.lang || (isEnglish ? 'en-US' : 'es-ES'),
    voiceName: voice?.name || null,
    rate: lastSpeakRate,
  })
}

// Las voces cargan de forma asíncrona: repoblar el selector al estar listas.
speechSynthesis.onvoiceschanged = async () => {
  populateVoices()
  const { voiceName } = await chrome.storage.sync.get({ voiceName: '' })
  if (voiceName) $('set-voice').value = voiceName
}

// Al abrir el panel, re-sincronizar por si quedó audio sonando con el panel cerrado.
ttsSend('TTS_GET_STATE')

// ───────── Exportar (txt / md / docx) ─────────
function safeName(name) {
  return (name || 'speakito').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'speakito'
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function exportTxt(text, base) {
  download(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${base}.txt`)
}

function exportMd(text, base, title) {
  const md = `# ${title}\n\n${text}\n`
  download(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${base}.md`)
}

// DOCX = ZIP (store, sin compresión) con el OOXML mínimo. Se arma a mano para
// no depender de librerías externas.
function exportDocx(text, base, title) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const paras = [title, '', ...text.split(/\n/)]
  const body = paras.map((p) => {
    if (!p) return '<w:p/>'
    return `<w:p><w:r><w:t xml:space="preserve">${esc(p)}</w:t></w:r></w:p>`
  }).join('')

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr/></w:body></w:document>`

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

  const files = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: documentXml },
  ]
  const blob = buildZip(files)
  download(blob, `${base}.docx`)
}

// ZIP mínimo sin compresión (método store). Suficiente para Word.
function buildZip(files) {
  const enc = new TextEncoder()
  const chunks = []
  const central = []
  let offset = 0

  const crcTable = (() => {
    const t = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })()
  const crc32 = (bytes) => {
    let c = 0xffffffff
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }

  const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff]
  const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]

  for (const f of files) {
    const nameBytes = enc.encode(f.name)
    const dataBytes = enc.encode(f.data)
    const crc = crc32(dataBytes)
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(dataBytes.length), ...u32(dataBytes.length),
      ...u16(nameBytes.length), ...u16(0),
      ...nameBytes, ...dataBytes,
    ]
    chunks.push(new Uint8Array(local))
    central.push({
      crc, size: dataBytes.length, nameBytes, offset,
    })
    offset += local.length
  }

  const centralStart = offset
  const centralChunks = []
  for (const c of central) {
    const rec = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(c.crc), ...u32(c.size), ...u32(c.size),
      ...u16(c.nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(c.offset), ...c.nameBytes,
    ]
    centralChunks.push(new Uint8Array(rec))
    offset += rec.length
  }
  const centralSize = offset - centralStart
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length),
    ...u32(centralSize), ...u32(centralStart), ...u16(0),
  ])

  return new Blob([...chunks, ...centralChunks, end], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

$('btn-export').addEventListener('click', () => {
  if (!lastBotText) return
  const base = safeName(lastTitle)
  const fmt = $('export-format').value
  if (fmt === 'txt') exportTxt(lastBotText, base)
  else if (fmt === 'md') exportMd(lastBotText, base, lastTitle)
  else exportDocx(lastBotText, base, lastTitle)
})

loadSettings()
