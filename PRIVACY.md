# Política de Privacidad de Speakito

**Última actualización:** 5 de octubre de 2026

Speakito es una extensión de navegador de código abierto que lee en voz alta el contenido de la página web actual y permite hacer preguntas sobre él mediante un proveedor de inteligencia artificial elegido por el usuario. Esta política explica qué datos maneja la extensión y cómo.

## Resumen

- Speakito **no tiene servidores propios** ni recopila datos personales.
- No se usan rastreadores, analítica ni publicidad.
- Tu configuración se guarda **localmente** en tu navegador.
- El contenido de la página solo se envía al **proveedor de IA que tú configures**, usando **tu propia API key**.

## Datos que maneja la extensión

### Configuración del usuario
Speakito guarda localmente (mediante el almacenamiento del navegador) tus preferencias:
- Proveedor de IA seleccionado y su API key.
- Modelo elegido y, si aplica, la URL de Ollama.
- Idioma de salida, voz, velocidad de lectura y tema de color.

Estos datos permanecen en tu navegador y no se transmiten a los desarrolladores de Speakito.

### Contenido de la página
Cuando invocas una acción de lectura o consulta, Speakito extrae el texto de la página activa (o del documento abierto) y lo utiliza para:
- Generar la lectura en voz alta.
- Enviarlo al proveedor de IA que configuraste, para resumir, explicar, analizar o responder tus preguntas.

Este contenido solo se envía al proveedor de IA que **tú** elegiste y se procesa según la política de privacidad de ese proveedor. Si usas Ollama de forma local, el contenido no sale de tu equipo.

## Terceros

Speakito puede comunicarse con el proveedor de IA que configures (por ejemplo Gemini, Claude, OpenAI, DeepSeek u Ollama). El tratamiento de los datos enviados a esos servicios se rige por sus respectivas políticas de privacidad. Speakito no comparte tus datos con ningún otro tercero.

## Lo que Speakito NO hace

- No recopila ni almacena tu historial de navegación.
- No vende ni comparte datos personales.
- No incluye rastreadores, analítica ni publicidad.
- No envía datos a servidores controlados por los desarrolladores.

## Permisos

Speakito solicita únicamente los permisos necesarios para su funcionamiento (acceso a la pestaña activa cuando lo invocas, almacenamiento de preferencias, síntesis de voz y gestión de pestañas para las funciones de lectura). Cada permiso se usa solo para la finalidad descrita en la ficha de la extensión.

## Cambios en esta política

Si esta política cambia, se actualizará en el repositorio del proyecto con una nueva fecha de "Última actualización".

## Contacto

Para dudas o reportes relacionados con la privacidad, abre un issue en el repositorio del proyecto:
https://github.com/FelipeFariasAlfaro/speakito

Creado por Felipe Farías A.
