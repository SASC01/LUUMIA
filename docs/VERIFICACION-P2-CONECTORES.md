# LuumIA V.2 · Conectores de SNIIM y USDA

Verificación del 14 de noviembre de 2026, hora de Campeche, en la [demo de Don Tino](http://127.0.0.1:5174/).

| Conector | Evidencia de consulta real |
|---|---|
| SNIIM Campeche | 60 registros mensuales del mercado Pedro Sáinz de Baranda para Saladette de primera en 2021–2025. Septiembre tiene mediana $11,32 MXN/kg, rango $9,58–$13,98 y `n=5`. Se observó un tiempo de espera agotado y después una consulta en vivo exitosa. |
| SNIIM Mérida | Cinco cotizaciones comparables del 9 al 13 de noviembre de 2026 a $27,86 MXN/kg. La serie fija del 21 al 25 de septiembre de 2026 trae cinco cotizaciones a $24,29 MXN/kg. |
| USDA FAS | El ZIP oficial de PSD Online devolvió cinco campañas de producción nacional de maíz en México. La última campaña, 2026/27, publicó 24.000 miles de toneladas métricas. El archivo anuncia modificación del 10 de noviembre de 2026. La serie puede revisarse en publicaciones posteriores. |

Las rutas `/v1/market-references/{series_id}` y `/v1/usda-references/mexico-corn-production` identifican entrega `live`, `cache` o `snapshot`. Una consulta exitosa se reutiliza durante diez minutos. Después de un fallo se conserva el respaldo durante treinta segundos, con botón para volver a consultar. La fecha de consulta y el periodo de los datos se muestran por separado.

En un servidor de prueba aislado se provocó un fallo de red en ambos proveedores. El flujo web mantuvo el aviso y el motivo de respaldo. Al seleccionar semana reciente de Mérida, la app mostró las fechas originales de septiembre y sus $24,29 MXN/kg. USDA sirvió el extracto verificable precargado. Se comprobaron respuestas `503` en ausencia también del respaldo USDA.

Chrome comprobó las dos vistas a 320, 390 y 1024 px, sin desbordamiento ni errores de JavaScript. Las consultas conservaron la versión 7 de Don Tino y el mismo ID de evaluación. SNIIM sigue siendo una referencia mayorista. La serie USDA es nacional y queda fuera del cálculo de precio, rendimiento y margen de la parcela.

El respaldo SNIIM se verifica con `python scripts/import_sniim.py --check`. El importador comparte los analizadores HTML con el conector. Para curar nuevamente el respaldo USDA desde el archivo oficial, ejecuta `python -m luumia.usda_live` con `backend/src` en `PYTHONPATH` o el paquete instalado. [Fuentes](FUENTES.md)
