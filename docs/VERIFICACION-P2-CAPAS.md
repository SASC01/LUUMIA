# LuumIA V.2 · Capas regionales

14 de noviembre de 2026. Demo de Don Tino en [Mi parcela → Región](http://127.0.0.1:5174/#region).

| Capa | Datos del recorte verificado |
|---|---|
| SMAP | Humedad volumétrica superficial de 0–5 cm en m³/m³. Análisis `SPL4SMAU` V008 de las 12:00 UTC del 1 de noviembre de 2026. Malla del producto de 9 km. |
| IMERG | Visualización diaria UTC del 1 de noviembre de 2026 de tasa de precipitación en mm/h, con resolución de origen de 0,1° × 0,1°. Las zonas transparentes pueden representar tasas inferiores a 0,1 mm/h o datos ausentes. |

Ambos recortes son imágenes NASA GIBS de 512 × 512 píxeles en EPSG:4326, con el mismo encuadre de 92° O a 87,5° O y de 17,5° N a 22° N. El tamaño del PNG es de presentación. El mapa de índices HLS y el pluviómetro tienen escalas y procedencias distintas. El marcador localiza la geometría sintética sin asignar un valor puntual a la parcela. Estas capas se consultan como contexto regional independiente del motor.

Se verificaron la alternancia entre capas, la carga de sus leyendas, los enlaces y la alineación del marcador y la costa en Chrome a 320, 390, 1024 y 1440 px. La demo cargó los archivos precargados con las peticiones externas bloqueadas. También se verificaron el reintento ante un manifiesto ausente y la conservación de la leyenda ante la ausencia del PNG. Las consultas mantuvieron la versión y el ID de evaluación de la ficha vigente.

Pasaron siete pruebas existentes, la verificación de contratos y el build web. Los siete archivos regionales del build coinciden por SHA-256 con los archivos precargados. El checker visual conservó avisos de cabecera compacta y alineación de columnas. No detectó desbordamiento horizontal.

Los manifiestos de `frontend/public/regional/` registran la fecha, la consulta original y las huellas de los mapas. Los scripts `scripts/prepare_smap.py`, `scripts/prepare_imerg.py` y `scripts/prepare_regional_basemap.py` permiten actualizar los recortes desde NASA GIBS. El argumento `--chrome` del script de IMERG permite regenerar el PNG de su leyenda.

El resto de P2 se mantiene en el alcance posterior descrito en [Fuentes](FUENTES.md).
