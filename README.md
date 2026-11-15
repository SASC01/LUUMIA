# LuumIA

**LUUMIA** toma su nombre de *luum*, tierra en maya. La rotación que ya sabían los abuelos, ahora con ojos en el cielo.

Demo de apoyo a la rotación y venta para productores de temporal del sureste de México. El motor calcula elegibilidad, ranking y margen. El asistente usa la evaluación guardada para responder.

## Arranque en Windows

Requiere Python 3.12+, Node 22.12+ y una base PostgreSQL dedicada. Ejecuta desde esta carpeta.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
npm.cmd ci
```

Configura `DATABASE_URL` en la terminal. En este equipo el script puede leerla desde `%LOCALAPPDATA%\LuumIAV2\database-url.txt`. PostgreSQL de la demo escucha en `127.0.0.1:55435` con almacenamiento dedicado. Si se detuvo, puedes iniciarlo en este equipo con los binarios de PostgreSQL ya instalados.

```powershell
& 'C:\Program Files\Odoo 19.0.20251013\PostgreSQL\bin\pg_ctl.exe' -D "$env:LOCALAPPDATA\LuumIAV2\postgres" -l "$env:LOCALAPPDATA\LuumIAV2\postgres.log" -w start
```

```powershell
# Terminal 1
.\scripts\start-api.ps1

# Terminal 2
npm.cmd run dev:web
```

Con una base vacía, `start-api.ps1` crea las tablas y carga el caso sintético de Don Tino, con la ficha evaluada v11, la lectura de KoboCollect de la ficha v10 y el plan v5 publicado. La carga incluye las versiones de ejemplo y usa identificadores de captura de demostración. Si la base ya contiene una ficha de Don Tino, el arranque respeta ese historial. Los datos de parcelas propias se capturan desde Parcela. [Carga de demostración](data/demo/don-tino.json)

- **Parcela** abre un resumen con el cultivo actual, las condiciones disponibles y un siguiente paso. En «Cultivos y rotaciones» puedes registrar ciclos con sus fechas, comparar opciones para la siguiente siembra y usar el croquis para estimar cosecha y ganancia. [Abrir Parcela](http://127.0.0.1:5174/#parcela)
- **Métricas** muestra el plan compartido de la parcela seleccionada. Permite documentar cupos, comparar la ganancia de las ventas registradas con la estimada y descargar los reportes. [Abrir Métricas](http://127.0.0.1:5174/#metricas) · [Recorrido de Parcela y Métricas](docs/PARCELA-Y-METRICAS.md)
- **Demo** reúne la ficha de Don Tino, sus datos precargados, las vistas de NASA y los reportes del caso de ejemplo. [Abrir Demo](http://127.0.0.1:5174/#demo) · [Métricas de ejemplo](http://127.0.0.1:5174/#demo-metricas)
- **API** en [127.0.0.1:8042/docs](http://127.0.0.1:8042/docs).
- En «Demo», abre «Análisis ambiental» para consultar y registrar observaciones y «Cultivos y rotaciones» para comparar cultivos o simular una venta. En «Historial» puedes abrir la versión anterior. «Recalcular ficha» vuelve a aplicar el motor a la versión nueva.

### Vistas de demostración

- «Vigor» abre el recorte precargado de NASA HLS. La leyenda identifica el NDVI, los píxeles descartados por calidad y el contorno sintético de Don Tino. «Fuente y máscara de calidad» muestra el gránulo y el método.
- «Humedad del suelo» muestra una lectura sintética de 0,24 m³/m³ a 20 cm, con una calibración supuesta para suelo mineral.
- «Cooperativa» agrupa lotes simulados por semana y compara, en la misma escala, los márgenes que calcula el motor de P0 para venta spot y cooperativa. Las dos vistas simuladas de P1 son de consulta y tienen su propio contexto de demostración.
- «Región» permite alternar entre humedad superficial SMAP y tasa de precipitación IMERG para el 1 de noviembre de 2026. Las dos capas se sirven desde el proyecto, con sus ventanas horarias y leyendas. El punto de Don Tino es una referencia en la región y estas vistas quedan fuera del motor de rotaciones y márgenes. [Verificación de las capas regionales](docs/VERIFICACION-P2-CAPAS.md)
- «Precio mayorista de Saladette» consulta SNIIM y distingue la serie estacional de Campeche, la semana reciente de Mérida y la semana histórica fija. «Producción nacional de maíz» consulta USDA FAS PSD Online. Sus estados distinguen la consulta al proveedor, la respuesta reciente en memoria y el respaldo local, con su periodo original. [Verificación de los conectores](docs/VERIFICACION-P2-CONECTORES.md)
- «Venta de la cosecha» permite cambiar de precio fijo a precio por volumen vendido. Los primeros kilos se pagan al precio base hasta el umbral y cada kilo adicional usa la segunda tarifa. Ambas tarifas son supuestos editables. El escenario guardado conserva las tarifas, kilos vendidos, ingreso, margen y precio efectivo. [Modelo y verificación](docs/VERIFICACION-P2-PRECIO-VOLUMEN.md)
- En «Rendimiento» elige el ciclo agrícola del cultivo. Para maíz grano de temporal en primavera–verano se puede adoptar como supuesto la mediana municipal de Hopelchén. También puedes ingresar un rendimiento propio. La cosecha usa la superficie evaluada y el rendimiento aplicado, y de ahí se restan la merma y el excedente sin salida. [Modelo y verificación](docs/VERIFICACION-P2-RENDIMIENTO.md)
- «Observación de campo» muestra las lecturas recibidas desde KoboCollect y la versión en la que se guardaron. [Conexión y formulario](docs/KOBOCOLLECT.md)
- «Estación WeatherLink» consulta condiciones de una estación autorizada cuando se configura en el servidor. La demo permite abrir por separado el ejemplo de Davis. [Configuración y verificación](docs/WEATHERLINK.md)
- «Siguiente ciclo» permite consultar precios al productor, proyectar doce meses, editar supuestos de venta y comparar el mérito agronómico con el margen de cada cultivo. [Modelo y verificación](docs/VERIFICACION-SIGUIENTE-CICLO.md) · [Fuentes descargadas](docs/FUENTES-PRECIOS-PRODUCTOR.md) · [Guion del pitch](docs/PITCH.md)

Para regenerar el recorte HLS, instala `rasterio` y `Pillow` en un entorno Python y ejecuta `python scripts/prepare_hls.py`. El script descarga bandas públicas de Planetary Computer y escribe el PNG y sus metadatos. Los archivos precargados bastan para la demo. [Fuentes](docs/FUENTES.md) · [Verificación de P1](docs/VERIFICACION-P1.md)

## Asistente

El backend devuelve primero el motivo principal y la evidencia del filtro. El modelo selecciona el énfasis de la explicación entre opciones acotadas. Las cifras, el estado y el texto factual salen de la evaluación y de plantillas del servidor. Si el proveedor está indisponible o la ficha está pendiente, se obtiene una respuesta `deterministic`. La proyección omite sensores crudos y permisos de escritura.

En el equipo de la demo se instaló **Qwen2.5-1.5B-Instruct Q4_K_M** con **llama.cpp** CPU, en `%LOCALAPPDATA%\LuumIAV2\llm`. Si se detuvo, abre otra terminal con `\.\scripts\start-model.ps1`. El script de API usa el token de ese runtime si está disponible. Se puede usar también `GEMINI_API_KEY` en el servidor sin configurar la URL del modelo local.

- [llama.cpp b12377, MIT](https://github.com/ggml-org/llama.cpp/releases/tag/b12377). ZIP de Windows CPU x64 SHA-256 `d3b60c5abbe3a131c77e568310547492438bc7c785721eb765d2d817fe4424c5`.
- [Qwen2.5-1.5B-Instruct-GGUF, Apache-2.0](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/tree/91cad51170dc346986eccefdc2dd33a9da36ead9). Q4_K_M SHA-256 `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e`.

## Verificación

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe scripts/import_sniim.py --check
.\.venv\Scripts\python.exe scripts/export_contracts.py --check
npm.cmd run contracts:check-types
npm.cmd run build:web
```

Para regenerar los contratos ejecuta `python scripts/export_contracts.py` y `npm.cmd run contracts:types`. Las fichas `0.1.0` se leen con campos nuevos opcionales. La tabla JSONB conserva el nombre de V.1 para admitir instantáneas históricas con el mismo esquema. [Verificación integral de entrega](docs/VERIFICACION-ENTREGA.md) · [Fuentes y alcance](docs/FUENTES.md)
