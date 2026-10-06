// Documento offscreen: ejecuta speechSynthesis fuera del side panel, para que
// el audio siga sonando aunque el panel se cierre. El panel y el service worker
// lo controlan por mensajes { type: 'TTS_*' }. Emite su estado con 'TTS_STATE'.

const tts = {
  chunks: [],
  index: 0,
  playing: false,
  paused: false,
  lang: 'es-ES',
  voiceName: null,
  rate: 1,
}

function emitState(extra = {}) {
  chrome.runtime.sendMessage({
    type: 'TTS_STATE',
    state: {
      playing: tts.playing,
      paused: tts.paused,
      index: tts.index,
      total: tts.chunks.length,
      ...extra,
    },
  }).catch(() => {})
}

function pickVoice() {
  const voices = speechSynthesis.getVoices() || []
  if (tts.voiceName) {
    const v = voices.find((x) => x.name === tts.voiceName)
    if (v) return v
  }
  const pref = tts.lang.startsWith('en') ? 'en' : 'es'
  return voices.find((v) => (v.lang || '').toLowerCase().startsWith(pref)) || voices[0] || null
}

// Las voces cargan de forma asíncrona en el offscreen; esperar a tenerlas antes
// de hablar, si no, el utterance se encola sin sonar.
function ensureVoices() {
  return new Promise((resolve) => {
    if ((speechSynthesis.getVoices() || []).length) return resolve()
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    speechSynthesis.onvoiceschanged = finish
    speechSynthesis.getVoices()
    setTimeout(finish, 1500)   // fallback si el evento no dispara
  })
}

function playCurrent() {
  if (tts.paused || tts.index >= tts.chunks.length) {
    if (tts.index >= tts.chunks.length) {
      tts.playing = false
      emitState({ done: true })
    }
    return
  }
  tts.playing = true
  const u = new SpeechSynthesisUtterance(tts.chunks[tts.index])
  u.lang = tts.lang
  const v = pickVoice()
  if (v) u.voice = v
  u.rate = tts.rate
  u.onend = () => {
    if (tts.paused || !tts.playing) return
    tts.index++
    emitState()
    if (tts.index >= tts.chunks.length) {
      tts.playing = false
      emitState({ done: true })
      return
    }
    playCurrent()
  }
  u.onerror = () => { /* se ignora: puede dispararse al cancelar */ }
  speechSynthesis.speak(u)
  emitState()
}

async function start({ chunks, lang, voiceName, rate }) {
  speechSynthesis.cancel()
  tts.chunks = Array.isArray(chunks) ? chunks : []
  tts.index = 0
  tts.paused = false
  tts.playing = false
  tts.lang = lang || 'es-ES'
  tts.voiceName = voiceName || null
  tts.rate = rate || 1
  if (!tts.chunks.length) { emitState({ done: true }); return }
  await ensureVoices()
  playCurrent()
}

function pause() {
  if (!tts.playing) return
  tts.paused = true
  tts.playing = false
  speechSynthesis.cancel()
  emitState()
}

function resume() {
  if (!tts.paused) return
  tts.paused = false
  playCurrent()
}

function stop() {
  tts.playing = false
  tts.paused = false
  tts.chunks = []
  tts.index = 0
  speechSynthesis.cancel()
  emitState({ done: true })
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg?.type?.startsWith('TTS_')) return
  if (msg.type === 'TTS_START') start(msg.payload || {})
  else if (msg.type === 'TTS_PAUSE') pause()
  else if (msg.type === 'TTS_RESUME') resume()
  else if (msg.type === 'TTS_STOP') stop()
  else if (msg.type === 'TTS_GET_STATE') emitState()
})

// Avisar que el offscreen está listo (las voces pueden tardar en cargar).
speechSynthesis.onvoiceschanged = () => {}
chrome.runtime.sendMessage({ type: 'TTS_READY' }).catch(() => {})
