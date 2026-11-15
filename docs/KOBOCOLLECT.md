# KoboCollect · Pluviómetro de Don Tino

LuumIA recibe el formulario desde la app Android KoboCollect mediante OpenRosa. El receptor publica el formulario `don-tino-rain` y traduce el XML multipart a la observación versionada de la parcela `parcel-don-tino`. El formulario registra lluvia en mm, ventana de acumulación, hora de lectura, autor, origen y versión esperada. La captura de prueba se etiqueta como simulada. Para registrar una lectura observada, se requiere confirmarla explícitamente en la app.

## Conectar la app a la demo local

El script `scripts/start-api.ps1` lee la credencial de `%LOCALAPPDATA%\LuumIAV2\kobo-password.txt` cuando existe. También acepta `LUUMIA_KOBO_PASSWORD` y el usuario opcional `LUUMIA_KOBO_USER`, cuyo valor por defecto es `don-tino`. La credencial permanece fuera del proyecto. La API escucha en `127.0.0.1:8042`.

1. Conecta un emulador o dispositivo Android por ADB. Si hay varios, añade `-s <dispositivo>` al comando de ADB.
2. Ejecuta `adb reverse tcp:8042 tcp:8042` para que el dispositivo pueda usar el puerto local del equipo.
3. En KoboCollect agrega un proyecto con configuración manual. URL `http://127.0.0.1:8042/integrations/kobo`, usuario `don-tino` y la credencial del runtime. Descarga «LuumIA · Pluviómetro de Don Tino».
4. Consulta `context_version` en la [ficha vigente de Don Tino](http://127.0.0.1:8042/v1/contexts/parcel-don-tino), anótalo en el formulario, registra una lectura y envía el formulario finalizado. Para compararla con la semana NASA POWER de la demo, usa inicio `2026-10-26 00:00` y fin exclusivo `2026-11-02 00:00`, hora de Campeche, y una hora de lectura igual o posterior al fin.
5. En [Observación de campo](http://127.0.0.1:5174/#observacion), selecciona «Actualizar ficha tras un envío de KoboCollect». La ficha nueva declara pendiente de recálculo, muestra KoboCollect como origen y conserva el margen anterior en el historial. «Recalcular ficha» recupera una evaluación vigente para la nueva evidencia.

HTTP se usa únicamente en la demo local a través de ADB. KoboCollect 2025.2.3 usa Digest en ese enlace. Si se configura acceso remoto, se requiere HTTPS y una credencial administrada fuera del repositorio. Un proxy debe conservar el host y el esquema públicos en las URL de OpenRosa.

## Versionado y archivos

- El receptor responde `201` al guardar o al reconocer un reenvío idéntico. Conserva el identificador de instancia de KoboCollect, el hash del contenido validado y el número de versión original. Ante dos envíos nuevos con la misma versión esperada, solo puede prosperar uno. Un envío con versión desactualizada o un identificador reutilizado con contenido distinto responde `409`.
- Un formulario nuevo puede guardarse fuera de línea en KoboCollect. Si la versión de la ficha cambió antes de enviarlo, comprueba la ficha y prepara una captura corregida con la versión vigente. Cada captura usa su propio ID de instancia.
- El [XForm](../integrations/kobo/don-tino-rain.xml) es el archivo servido a KoboCollect. El [XLSForm](../integrations/kobo/don-tino-rain.xlsx) permite abrir el formulario en KoboToolbox. LuumIA actúa como receptor OpenRosa directo para este recorrido. Un proyecto alojado en KoboToolbox requeriría configurar de manera independiente su despliegue y la entrega de sus datos.

## Verificación con Don Tino

El 14 de noviembre de 2026 se descargó el formulario y se envió desde KoboCollect 2025.2.3 en un emulador Android. La app recibió el acuse de la ficha v10. La captura registró 13,75 mm simulados para la ventana del 26 de octubre a las 00:00 al 2 de noviembre a las 00:00, hora de Campeche. La demo mostró esa lectura junto a los 18,4 mm regionales de NASA POWER para el mismo periodo.

Al actualizar la ficha desde la web se mostró la v10 pendiente de recálculo y se pudo abrir la evaluación histórica de la v9. Después de reiniciar la API, reenviar el XML original devolvió el mismo acuse sin crear una versión. Reutilizar el identificador con otro valor devolvió `409`. El recálculo desde la web generó la evaluación vigente de la v11 y conservó el recibo de la v10.

[KoboCollect](https://support.kobotoolbox.org/kobocollect_on_android_latest.html) · [Descarga OpenRosa](https://docs.getodk.org/openrosa-form-list/) · [Envío OpenRosa](https://docs.getodk.org/openrosa-form-submission/)
