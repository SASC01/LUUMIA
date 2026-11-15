# LuumIA V.2 · Verificación de P1

14 de noviembre de 2026, hora de Campeche. Demo de Don Tino en [Mi parcela](http://127.0.0.1:5174/).

| Vista | Comprobación |
|---|---|
| Vigor | Recorte de Landsat 9 del 23 de febrero de 2023, `HLS.L30.T16QBG.2023054T162247.v2.0`. Bandas B04 y B05 a 30 m, con Fmask en la misma cuadrícula. La máscara dejó 76 de 148 píxeles válidos y descartó 72 por aerosol alto dentro del polígono sintético. NDVI mediano 0,4387 y rango 0,1884–0,7636. Se verificaron la leyenda, el enlace al gránulo, el PNG y los metadatos en navegador y en el build. |
| Humedad del suelo | Lectura simulada de 0,24 m³/m³ a 20 cm. Un registro con referencia a TEROS 12, fecha y calibración para suelo mineral marcadas como supuestas. Se comprobó que mostrarla y calcular un margen de vista previa conserva la versión y las observaciones guardadas de la ficha. |
| Cooperativa | La semana del 8 al 14 de marzo de 2027 agrupa tres lotes simulados de maíz que suman 10.800 kg. Comprador y cupo figuran por confirmar. El motor P0 devolvió −$20.000 a +$40.000 MXN para spot y $0 a +$20.000 para cooperativa, con centro de cupo de 9.000 kg en ambos. La gráfica compara intervalos sobre una misma escala y el texto da sus amplitudes de $60.000 y $20.000 MXN. |

Chrome verificó las tres vistas a 320, 390, 1024 y 1440 px, sin desbordamiento ni errores de JavaScript. Al bloquear el PNG, la vista conservó las estadísticas y explicó la falta de la imagen. Pasaron siete pruebas, la sincronización de contratos y la compilación. El checker de layout de `design-taste-frontend` conserva avisos por la cabecera compacta y la rejilla de la aplicación.

La escena describe vigor relativo en su fecha y tiene cobertura parcial. Para derivar el cultivo de cada ciclo se necesitarían escenas comparables por ciclo, fechas, etiquetas de campo y validación. La secuencia visible se toma del historial sintético de Don Tino. [Fuentes y método](FUENTES.md)
