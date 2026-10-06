# Speakito

Extensión de Chrome (Manifest V3) que **lee en voz alta** el contenido de la página actual —incluso **traduciéndolo** o **explicándolo en simple**— y te deja **preguntar sobre su contenido** usando el proveedor de IA que elijas.

El audio corre en segundo plano, así que **sigue sonando aunque cierres el panel lateral**.

---

## Funcionalidades

- **Leer página**: extrae el contenido principal y lo lee en voz alta.
- **Documentos**: lee Google Docs/Slides, PDFs (incluido el visor de Chrome y Drive) y Office 365 online, que los lectores comunes no alcanzan.
- **Explícame simple**: reexplica la página en lenguaje sencillo antes de leerla.
- **Detectar sesgo**: analiza el texto buscando afirmaciones sin fuente, lenguaje tendencioso y posibles sesgos.
- **Léemelo navegando**: sigue leyendo la nueva página cada vez que cambias de pestaña.
- **Leer pestañas (playlist)**: encola todas las pestañas abiertas y las lee una tras otra, como un podcast.
- **Preguntar**: chat sobre el contenido de la página, con respuestas en formato legible.
- **Selección**: menú contextual para leer o preguntar sobre el texto que seleccionaste.
- **Audio en segundo plano**: la reproducción continúa con el panel cerrado; el ícono de la barra muestra el estado.
- **Exportar**: guarda el texto generado en `.txt`, `.md` o `.docx`.
- **Personalización**: 16 temas de color, selección de voz del sistema, idioma de salida y velocidad.

## Proveedores de IA soportados

Gemini, Claude (Anthropic), OpenAI, DeepSeek y Ollama (local). La API key se guarda localmente y las llamadas se centralizan en el service worker (no se expone al contenido de la página).

## Instalación (modo desarrollador)

1. Clona el repositorio:
   ```bash
   git clone https://github.com/FelipeFariasAlfaro/speakito.git
   ```
2. Abre `chrome://extensions` en Chrome (o un navegador basado en Chromium).
3. Activa el **Modo de desarrollador** (arriba a la derecha).
4. Pulsa **Cargar extensión sin empaquetar** y selecciona la carpeta del proyecto.
5. Abre Speakito desde el ícono de la barra de extensiones.

## Configuración

1. Abre el panel y pulsa el ícono de ajustes.
2. Elige el proveedor de IA e ingresa tu API key (salvo Ollama, que es local).
3. Pulsa **Validar y traer modelos** y selecciona un modelo.
4. Ajusta idioma de salida, voz y tema a gusto.
5. Guarda.

## Arquitectura

- `sidepanel.*` — interfaz del panel lateral: extracción, chat, controles y UI.
- `background.js` — service worker: llamadas a IA, menú contextual y gestión del offscreen.
- `offscreen.*` — reproduce el audio (`speechSynthesis`) para que persista con el panel cerrado.
- `content-extract.js` / `content-select.js` — extracción de contenido y selección en la página.
- `lib/` — `Readability.js`, `pdf.js` y utilidades de extracción de documentos.

## Privacidad

El contenido de la página solo se envía al proveedor de IA que **tú** configures, usando **tu** API key. No hay servidores intermedios propios.

## Contribuir

Las ideas y reportes son bienvenidos. Usa las [plantillas de issues](.github/ISSUE_TEMPLATE) para reportar un bug o pedir una funcionalidad.

## Licencia

Proyecto de código abierto bajo licencia MIT.

## Autor

Creado por **Felipe Farías A.**
- LinkedIn: https://www.linkedin.com/in/felipefariasalfaro/
- GitHub del proyecto: https://github.com/FelipeFariasAlfaro/speakito
