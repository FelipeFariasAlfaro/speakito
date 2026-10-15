// Página dedicada para solicitar el permiso de micrófono. En las extensiones
// MV3, getUserMedia no muestra el diálogo de forma fiable desde el side panel,
// el popup o el service worker. Una página de extensión cargada como pestaña
// SÍ muestra el prompt, y el permiso concedido queda disponible para toda la
// extensión (incluido el side panel), que luego puede usar el reconocimiento.

const msg = document.getElementById('msg')
const btn = document.getElementById('btn-grant')

async function requestMic() {
  msg.textContent = 'Esperando tu respuesta en el aviso del navegador…'
  msg.className = ''
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // No necesitamos el audio aquí: solo queríamos que Chrome registre el permiso.
    stream.getTracks().forEach((t) => t.stop())
    msg.textContent = '✅ Micrófono habilitado. Ya puedes cerrar esta pestaña y usar el dictado por voz en Speakito.'
    msg.className = 'ok'
    btn.style.display = 'none'
    // Avisar al resto de la extensión (por si el panel quiere reaccionar).
    chrome.runtime.sendMessage({ type: 'MIC_GRANTED' }).catch(() => {})
  } catch (e) {
    msg.textContent = '❌ No se concedió el micrófono. Si lo bloqueaste, actívalo desde el ícono de la barra de direcciones y vuelve a intentarlo.'
    msg.className = 'err'
  }
}

btn.addEventListener('click', requestMic)
// Intentar automáticamente al abrir (el clic que abrió la pestaña ya es un gesto).
requestMic()
