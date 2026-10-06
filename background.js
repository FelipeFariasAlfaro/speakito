// Service worker: abre el side panel y centraliza las llamadas a la IA
// (Gemini, Claude, OpenAI, DeepSeek, Ollama) para no exponer la API key al
// content script. Expone validación de key + listado de modelos y chat.

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId != null) chrome.sidePanel.open({ windowId: tab.windowId })
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
  // Menú contextual: leer o preguntar sobre la selección sin abrir el panel a mano.
  chrome.contextMenus.create({ id: 'speakito-read', title: '🔊 Léemelo (Speakito)', contexts: ['selection'] }, () => chrome.runtime.lastError)
  chrome.contextMenus.create({ id: 'speakito-ask', title: '🗣️ Preguntar a Speakito sobre esto', contexts: ['selection'] }, () => chrome.runtime.lastError)
})

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  const selection = (info.selectionText || '').trim()
  if (!selection) return
  if (tab?.windowId != null) { try { await chrome.sidePanel.open({ windowId: tab.windowId }) } catch (_) {} }
  const type = info.menuItemId === 'speakito-read' ? 'SELECTION_READ' : 'SELECTION_ASK'
  // El panel puede tardar en montar; reintentar el envío un par de veces.
  for (let i = 0; i < 6; i++) {
    try { await chrome.runtime.sendMessage({ type, selection }); break }
    catch (_) { await new Promise((r) => setTimeout(r, 300)) }
  }
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'ASK_AI') {
    askAI(msg.payload).then(sendResponse).catch((e) =>
      sendResponse({ ok: false, error: String(e?.message || e) }))
    return true
  }
  if (msg?.type === 'LIST_MODELS') {
    listModels(msg.payload).then(sendResponse).catch((e) =>
      sendResponse({ ok: false, error: String(e?.message || e) }))
    return true
  }
  // Comandos de audio: el panel pide reproducir/pausar; se reenvían al offscreen.
  if (msg?.type === 'TTS_START') {
    ensureOffscreen().then(() => chrome.runtime.sendMessage(msg)).catch(() => {})
    return false
  }
  // El offscreen informa su estado: reflejarlo en el badge del ícono.
  if (msg?.type === 'TTS_STATE') {
    updateActionBadge(msg.state)
    return false
  }
})

// ───────── Offscreen para TTS en segundo plano ─────────
let creatingOffscreen = null
async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument?.()
  if (has) return
  if (creatingOffscreen) return creatingOffscreen
  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Reproducir texto en voz alta aunque el panel esté cerrado.',
  }).finally(() => { creatingOffscreen = null })
  return creatingOffscreen
}

function updateActionBadge(state) {
  const activo = state && (state.playing || state.paused)
  chrome.action.setBadgeText({ text: activo ? (state.paused ? '❚❚' : '▶') : '' }).catch(() => {})
  chrome.action.setBadgeBackgroundColor({ color: '#26a8e0' }).catch(() => {})
  chrome.action.setTitle({ title: activo ? 'Speakito — reproduciendo (clic para abrir)' : 'Abrir Speakito' }).catch(() => {})
}

// ───────── Config ─────────
async function getSettings() {
  return chrome.storage.sync.get({
    provider: 'gemini',
    apiKey: '',          // key del proveedor en nube activo
    model: '',           // modelo elegido
    ollamaUrl: 'http://localhost:11434',
  })
}

function needsKey(provider) {
  return provider !== 'ollama'
}

// ───────── Validar key + listar modelos ─────────
// payload: { provider, apiKey, ollamaUrl }
async function listModels({ provider, apiKey, ollamaUrl }) {
  if (needsKey(provider) && !apiKey) {
    return { ok: false, error: 'Ingresa la API key primero.' }
  }
  try {
    if (provider === 'gemini') return await listGemini(apiKey)
    if (provider === 'openai') return await listOpenAI(apiKey)
    if (provider === 'deepseek') return await listDeepSeek(apiKey)
    if (provider === 'claude') return await listClaude(apiKey)
    if (provider === 'ollama') return await listOllama(ollamaUrl)
    return { ok: false, error: 'Proveedor no soportado.' }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

async function listGemini(key) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`)
  if (!r.ok) return { ok: false, error: `Gemini HTTP ${r.status}: ${(await r.text()).slice(0, 150)}` }
  const data = await r.json()
  const models = (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .sort()
  return { ok: true, models }
}

async function listOpenAI(key) {
  const r = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!r.ok) return { ok: false, error: `OpenAI HTTP ${r.status}: ${(await r.text()).slice(0, 150)}` }
  const data = await r.json()
  const models = (data.data || [])
    .map((m) => m.id)
    .filter((id) => /^(gpt|o1|o3|o4|chatgpt)/i.test(id))
    .sort()
  return { ok: true, models: models.length ? models : (data.data || []).map((m) => m.id).sort() }
}

async function listDeepSeek(key) {
  const r = await fetch('https://api.deepseek.com/models', {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!r.ok) return { ok: false, error: `DeepSeek HTTP ${r.status}: ${(await r.text()).slice(0, 150)}` }
  const data = await r.json()
  const models = (data.data || []).map((m) => m.id).sort()
  return { ok: true, models }
}

async function listClaude(key) {
  const r = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  })
  if (!r.ok) return { ok: false, error: `Claude HTTP ${r.status}: ${(await r.text()).slice(0, 150)}` }
  const data = await r.json()
  const models = (data.data || []).map((m) => m.id).sort()
  return { ok: true, models }
}

async function listOllama(ollamaUrl) {
  const base = (ollamaUrl || 'http://localhost:11434').replace(/\/$/, '')
  const r = await fetch(`${base}/api/tags`)
  if (!r.ok) return { ok: false, error: `Ollama HTTP ${r.status}. ¿Está corriendo en ${base}?` }
  const data = await r.json()
  const models = (data.models || []).map((m) => m.name).sort()
  return { ok: true, models }
}

// ───────── Chat ─────────
async function askAI({ pageText, pageTitle, question, mode, targetLang, selection }) {
  const s = await getSettings()
  if (needsKey(s.provider) && !s.apiKey) {
    return { ok: false, error: 'Falta configurar el proveedor y la API key (⚙️ Ajustes).' }
  }
  if (!s.model) return { ok: false, error: 'Falta elegir y guardar un modelo (⚙️ Ajustes).' }

  const sys = buildSystemPrompt(mode, targetLang)
  const user = buildUserPrompt({ pageText, pageTitle, question, mode, selection })

  if (s.provider === 'gemini') return askGemini(s, sys, user)
  if (s.provider === 'openai') return askOpenAICompatible('https://api.openai.com/v1/chat/completions', s.apiKey, s.model, sys, user, 'OpenAI')
  if (s.provider === 'deepseek') return askOpenAICompatible('https://api.deepseek.com/chat/completions', s.apiKey, s.model, sys, user, 'DeepSeek')
  if (s.provider === 'claude') return askClaude(s, sys, user)
  if (s.provider === 'ollama') return askOllama(s, sys, user)
  return { ok: false, error: 'Proveedor no soportado.' }
}

function buildSystemPrompt(mode, targetLang) {
  const lang = targetLang || 'español'
  if (mode === 'read') {
    return `Eres un asistente que reescribe el contenido de una página web para ` +
      `leerlo en voz alta de forma clara y natural en ${lang}. Resume o traduce ` +
      `si hace falta, mantén el sentido, elimina menús/anuncios/basura. Devuelve ` +
      `solo el texto a leer, sin markdown ni encabezados.`
  }
  if (mode === 'simple') {
    return `Eres un asistente que explica el contenido de una página web en ${lang} ` +
      `con palabras muy simples, como si hablaras con alguien sin conocimientos del tema ` +
      `(nivel escolar). Usa frases cortas, evita tecnicismos y, si aparece uno, explícalo. ` +
      `Mantén las ideas principales y el sentido. Devuelve solo el texto a leer, sin markdown.`
  }
  if (mode === 'bias') {
    return `Eres un analista crítico de medios. Analiza el contenido en ${lang} y ` +
      `detecta: 1) afirmaciones sin respaldo o sin fuente, 2) lenguaje tendencioso, ` +
      `emotivo o cargado, 3) posibles sesgos (político, comercial, ideológico), ` +
      `4) datos que convendría verificar. Sé objetivo y señala también si el texto ` +
      `parece equilibrado. Devuelve un informe breve con viñetas por categoría; si ` +
      `una categoría no aplica, omítela.`
  }
  if (mode === 'selection') {
    return `Eres un asistente que explica y responde sobre un fragmento de texto ` +
      `seleccionado por el usuario en una página web. Responde SIEMPRE en ${lang}, ` +
      `de forma clara y concisa, usando el contexto de la página si ayuda.`
  }
  return `Eres un asistente que responde preguntas sobre el contenido de una ` +
    `página web. Responde SIEMPRE en ${lang}, de forma concisa y basándote solo ` +
    `en el contenido proporcionado. Si la respuesta no está en el contenido, dilo.`
}

function buildUserPrompt({ pageText, pageTitle, question, mode, selection }) {
  if (mode === 'selection') {
    const ctx = pageText ? `\n\nCONTEXTO DE LA PÁGINA:\n${pageText.slice(0, 4000)}` : ''
    return `FRAGMENTO SELECCIONADO:\n"${selection || ''}"${ctx}` +
      (question ? `\n\nPREGUNTA: ${question}` : `\n\nExplica este fragmento.`)
  }
  const base = `TÍTULO: ${pageTitle || '(sin título)'}\n\nCONTENIDO:\n${pageText || '(vacío)'}`
  if (mode === 'ask') return `${base}\n\nPREGUNTA: ${question}`
  return base
}

async function askGemini(s, sys, user) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${s.model}:generateContent?key=${encodeURIComponent(s.apiKey)}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: sys }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
    }),
  })
  if (!r.ok) return { ok: false, error: `Gemini HTTP ${r.status}: ${(await r.text()).slice(0, 200)}` }
  const data = await r.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
  return { ok: true, text }
}

// OpenAI y DeepSeek comparten el formato /chat/completions.
async function askOpenAICompatible(url, key, model, sys, user, label) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!r.ok) return { ok: false, error: `${label} HTTP ${r.status}: ${(await r.text()).slice(0, 200)}` }
  const data = await r.json()
  const text = data?.choices?.[0]?.message?.content || ''
  return { ok: true, text }
}

async function askClaude(s, sys, user) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': s.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: s.model,
      max_tokens: 4096,
      system: sys,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!r.ok) return { ok: false, error: `Claude HTTP ${r.status}: ${(await r.text()).slice(0, 200)}` }
  const data = await r.json()
  const text = (data?.content || []).map((b) => b.text || '').join('') || ''
  return { ok: true, text }
}

async function askOllama(s, sys, user) {
  const base = (s.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '')
  const r = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: s.model,
      stream: false,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!r.ok) return { ok: false, error: `Ollama HTTP ${r.status}. ¿Está corriendo en ${base}?` }
  const data = await r.json()
  return { ok: true, text: data?.message?.content || '' }
}
