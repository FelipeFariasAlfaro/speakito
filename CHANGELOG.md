# Changelog

Todas las novedades relevantes de Speakito se documentan en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

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
