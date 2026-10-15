# Changelog

Todas las novedades relevantes de Speakito se documentan en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [1.2.11] - 2026-10-08

### Agregado
- Ajuste "Reproducir por audio automáticamente las respuestas de la IA": cuando está activo, las respuestas del chat, el análisis de sesgo y las respuestas sobre una selección se leen en voz alta al llegar (antes solo se podían oír pulsando "Escuchar").

### Cambiado
- Las opciones de voz en Ajustes se agruparon en una subsección "Voz y audio" (autoenvío del dictado + lectura automática de respuestas).

## [1.2.10] - 2026-10-08

### Corregido
- El dictado por voz no mostraba el diálogo de permiso de micrófono: `getUserMedia` no funciona de forma fiable dentro del panel lateral. Ahora, si el micrófono no está autorizado, Speakito abre una página dedicada (`request-mic.html`) donde Chrome sí muestra el diálogo; una vez concedido, el permiso vale para toda la extensión y el dictado funciona en el panel.

## [1.2.9] - 2026-10-08

### Agregado
- Dictado por voz: botón de micrófono junto al cuadro del chat. Usa el reconocimiento de voz nativo del navegador (Web Speech API); el idioma sigue al "Idioma de salida" configurado. El micrófono se solicita en runtime con el diálogo nativo de Chrome (no requiere permisos nuevos en el manifiesto).
- Ajuste "Enviar el dictado de voz directamente (sin editar)": si está activo, la pregunta dictada se envía automáticamente a la IA al terminar de hablar; si no, el texto queda en el cuadro para revisarlo antes de enviar.

## [1.2.8] - 2026-10-08

### Corregido
- La lectura fallaba con "Esta página no se puede leer (no es una página web http/https)" incluso en sitios https válidos (p. ej. Gmail). La causa: sin permiso de host, `chrome.tabs.query` no devuelve la URL de la pestaña, así que la validación por protocolo fallaba. Ahora el permiso de host se solicita primero (patrones amplios opcionales) y la URL queda disponible después.
- La solicitud de permiso (`chrome.permissions.request`) se ejecuta como primera acción al pulsar los botones del panel, dentro del gesto del usuario, para que Chrome no la bloquee por falta de gesto reciente.

## [1.2.7] - 2026-10-08

### Corregido
- La lectura de páginas fallaba siempre ("Para leer esta página, haz clic en el ícono...") porque `activeTab` por sí solo no da acceso fiable al inyectar desde el panel lateral persistente.

### Cambiado
- El acceso amplio a sitios (`http://*/*`, `https://*/*`) pasó a `optional_host_permissions`: no se solicita en la instalación (no dispara la revisión en profundidad), sino en runtime la primera vez que el usuario pulsa "Leer página" sobre un sitio. Chrome muestra el diálogo nativo de permiso; una vez concedido, la lectura funciona en cualquier pestaña sin más pasos.
- El clic en el ícono vuelve a solo abrir el panel; la lectura la dispara el usuario con los botones del panel (gesto válido para solicitar el permiso).
- El análisis de una selección (menú contextual) ya no fuerza la extracción de toda la página.

## [1.2.6] - 2026-10-08

### Cambiado
- Se quitaron los permisos de host amplios (`http://*/*`, `https://*/*`) que disparaban una revisión en profundidad en Chrome Web Store. La lectura de páginas web normales ahora se apoya en `activeTab`: al hacer clic en el ícono de Speakito se concede el acceso a esa pestaña y el panel lee su contenido automáticamente.
- Los hosts declarados se limitan a los que requieren `fetch` directo: `https://docs.google.com/*` y `https://drive.google.com/*` (exportación de Google Docs/Slides/Sheets y PDFs de Drive) y `http://localhost/*` (Ollama).

### Nota de uso
- Para leer una pestaña nueva, el usuario debe hacer clic en el ícono de Speakito (gesto que concede `activeTab`). Si se pulsa "Leer página" sobre una pestaña aún no habilitada, la extensión guía al usuario a hacer ese clic.

## [1.2.5] - 2026-10-08

### Agregado
- Botón "Limpiar" en la barra de controles para vaciar el chat y su historial guardado.

### Corregido
- El chat se vaciaba al cerrar y reabrir el panel lateral. Ahora el historial se guarda en el almacenamiento local del navegador y se restaura al abrir el panel (tope de 200 mensajes). Los indicadores de carga no se persisten.

## [1.2.4] - 2026-10-08

### Verificado
- Lectura de páginas web normales, PDF y Google Docs confirmada en Chrome tras el ajuste de permisos. Versión preparada para reenvío a Chrome Web Store.

### Permisos solicitados
- Permisos de API: `activeTab`, `scripting`, `storage`, `sidePanel`, `contextMenus`, `offscreen`. Todos en uso activo. No se solicitan `tabs` ni `tts`.
- Hosts: `http://*/*` y `https://*/*`, necesarios para extraer el contenido de la página que el usuario pide leer (función principal). Incluyen Google Docs/Drive y Ollama en localhost. El texto se procesa solo en el momento de la lectura; no se rastrea ni almacena navegación.

## [1.2.3] - 2026-10-08

### Corregido
- La lectura de páginas web normales dejó de funcionar en 1.2.2 ("No se pudo acceder al contenido de la página"). Al quitar el permiso `tabs`, `activeTab` por sí solo no bastaba para inyectar el extractor de contenido en el flujo del panel lateral.

### Cambiado
- Se añadieron los hosts `http://*/*` y `https://*/*`, necesarios para extraer el contenido de la página que el usuario pide leer (función principal de la extensión). Incluyen Google Docs/Drive y Ollama en localhost, por lo que ya no se listan por separado. El texto se procesa solo en el momento de la lectura; no se rastrea ni almacena navegación.

## [1.2.2] - 2026-10-08

### Eliminado
- Permiso `tabs`: ya no se solicita. La extracción de la pestaña activa funciona con `activeTab` bajo gesto del usuario.
- Permiso `tts`: ya no se solicita. La lectura en voz alta usa la Web Speech API (`speechSynthesis`) del navegador, que no requiere permiso en el manifiesto.
- Funciones "Leer pestañas" (lectura secuencial de todas las pestañas) y "Léemelo navegando" (lectura automática al cambiar de pestaña): requerían acceder a `url`/`title` de pestañas distintas a la activa, lo que exigía el permiso `tabs`. Se retiraron para cumplir con la política de permisos mínimos de Chrome Web Store.

### Permisos solicitados
- Permisos de API: `activeTab`, `scripting`, `storage`, `sidePanel`, `contextMenus`, `offscreen`. Todos en uso activo.
- Hosts: `http://*/*` y `https://*/*`, necesarios para extraer el contenido de la página que el usuario pide leer (función principal de la extensión), incluidos Google Docs/Drive y Ollama en localhost. El texto se procesa en el momento de la lectura; no se rastrea ni almacena navegación.

## [1.2.0] - 2026-10-05

### Cambiado
- Se eliminó el permiso de host amplio (`<all_urls>`). Ahora la extracción de la página usa `activeTab` + `scripting` (bajo gesto del usuario) y los permisos de host se limitan a Google Docs, Google Drive y localhost (Ollama).

### Eliminado
- Botón flotante "Preguntar a Speakito" al seleccionar texto (requería un content script en todas las páginas). La misma función sigue disponible desde el menú contextual.

## [1.0.0] - 2026-10-05

Primera versión pública.

### Agregado
- Lectura en voz alta del contenido principal de la página.
- Lectura de documentos: Google Docs/Slides, PDF (visor de Chrome y Drive) y Office 365 online.
- "Explícame simple": reexplica la página en lenguaje sencillo.
- "Detectar sesgo": análisis de afirmaciones sin fuente, lenguaje tendencioso y sesgos.
- "Léemelo navegando": continúa la lectura al cambiar de pestaña.
- "Leer pestañas": playlist que lee todas las pestañas abiertas en secuencia.
- Chat para preguntar sobre el contenido de la página, con render de markdown.
- Lectura y preguntas sobre texto seleccionado vía menú contextual.
- Reproducción de audio en segundo plano (documento offscreen) que persiste con el panel cerrado, con estado reflejado en el ícono de la barra.
- Exportación del texto a `.txt`, `.md` y `.docx`.
- Soporte de proveedores de IA: Gemini, Claude, OpenAI, DeepSeek y Ollama.
- Ajustes en modal: proveedor y API key, selección de modelo, idioma de salida, selección de voz del sistema y 16 temas de color.
