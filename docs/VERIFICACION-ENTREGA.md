# Verificación de entrega de LuumIA V.2

14 de noviembre de 2026 · Hora de Campeche · Ficha de Don Tino v11.

| Módulo | Resultado comprobado |
| --- | --- |
| P0 · Rotación, venta y explicación | La demo muestra las rotaciones elegibles, la exclusión de Saladette y su motivo, la evidencia por bloque y los extremos del cupo. El asistente local Qwen respondió en la v11 y empezó por la restricción del comprador. La cooperativa reduce la dispersión del margen simulado con cupos de igual centro. |
| P1 · Evidencia visual | Chrome cargó el recorte de vigor NASA HLS y su máscara, la lectura de sonda simulada y la concentración de lotes de la cooperativa. |
| P2 · Contexto regional | Se cargaron y alternaron las imágenes SMAP e IMERG junto al punto de referencia de Don Tino. NASA POWER conserva la lluvia regional semanal de 18,4 mm. |
| P2 · Referencias de mercado | SNIIM Mérida respondió en vivo con cinco cotizaciones mayoristas del 9 al 13 de noviembre de 2026. USDA FAS entregó en vivo su serie nacional de producción de maíz de México. La demo distingue consultas recientes y respaldos precargados por fuente y periodo. |
| P2 · Precio por volumen y rendimiento | La vista previa aplicó la tarifa a kilos adicionales y usó la mediana municipal de maíz como supuesto de rendimiento. El rendimiento se aplicó a la superficie antes de merma y cupo. |
| P2 · KoboCollect | El XML original de la app Android se reenvió por OpenRosa a una base PostgreSQL aislada. Creó la ficha v10 pendiente de recálculo, conservó el margen histórico de v9, aceptó el reenvío idéntico sin duplicar y devolvió `409` al cambiar el contenido con el mismo ID. Chrome recalculó y abrió la v11 vigente. La ficha principal conservó su versión y acuse. |
| P2 · WeatherLink | El panel mostró el estado de estación sin configurar y el ejemplo oficial bajo petición. Se probaron con respuestas controladas la autenticación del cliente, las unidades, el valor cero, la memoria temporal y el rechazo de permisos. Falta validar una estación autorizada de la región. |
| Ampliación · Siguiente ciclo | Se alternaron el pronóstico con referencias internacionales y la sensibilidad con precios mexicanos observados. Se mantuvieron frijol como líder agronómico, maíz como líder por margen y calabaza como recomendación conjunta bajo los supuestos de la demo. |

Las comprobaciones técnicas pasaron con 80 pruebas automatizadas, contratos OpenAPI y TypeScript sincronizados, importación reproducible de 60 cotizaciones mensuales de Campeche y cinco cotizaciones diarias de Mérida, y compilación de producción. Chrome volvió a cargar HLS, SMAP, IMERG, el acuse de KoboCollect y la comparación del siguiente ciclo. [Guion de demostración](PITCH.md)

## Recorrido integrado de Don Tino

Prueba en Chrome y PostgreSQL aislado, con copia de la ficha v11 y sin planes ni ventas precargados. Los cupos y las ventas capturados durante la prueba fueron ficticios.

| Paso | Resultado |
| --- | --- |
| Repartir y publicar | Parcela rechazó 13 ha y un reparto de 11 ha en un plan de 10. Con 6 ha de calabaza y 4 ha de frijol estimó 52,200 kg. Métricas mostró el plan v1 tras compartirlo, con $170,477.25 MXN de ganancia estimada. |
| Gestionar el cupo | Registrar, corregir y cancelar el cupo de calabaza generó las fichas v12 a v14. Tras recalcular y compartir cada plan, las estimaciones fueron $114,477.25 MXN, $198,477.25 MXN y $170,477.25 MXN al recuperar el respaldo. |
| Registrar y revisar ventas | Dos ventas sumaron $118,000 MXN de ganancia registrada. La corrección elevó el total a $134,000 MXN. La anulación lo redujo a $121,000 MXN, $49,477.25 MXN por debajo de la estimación del plan. PostgreSQL conservó las filas originales. |
| Recuperar y exportar | Los datos y el reporte comercial se recuperaron después de reiniciar la API. Tras compartir un plan nuevo, el anterior conservó sus ventas y cambios en el selector y su CSV exportó los datos de esa versión. Un reintento idéntico se aceptó con `200` y una revisión obsoleta devolvió `409`. |

Se revisaron 320, 390, 1024 y 1440 px, uso con teclado y texto al 200 %. La ficha v11 y el plan v5 de la demo principal se conservaron sin ventas ni cambios ficticios. [Recorrido manual](PARCELA-Y-METRICAS.md)

## Arranque desde una base vacía

El arranque con `scripts/start-api.ps1` en una base PostgreSQL sin tablas cargó 11 fichas de Don Tino, cinco planes y tres publicaciones. En Chrome a 390 y 1440 px, Observación de campo mostró la lectura de 13.75 mm con acuse en la ficha v10. Métricas mostró el plan v5 de 10 ha, con 52,200 kg de cosecha estimada y $170,477.25 MXN de ganancia estimada. La carga contiene únicamente el caso de demostración y sus planes. [Datos de arranque](../data/demo/don-tino.json)

En esa misma base de prueba se guardó un cambio de superficie a 12.5 ha en la ficha v12 y se reinició la API. Al volver a abrir la demo, la ficha v12 y el plan v5 seguían disponibles. Pasaron las 103 pruebas automatizadas y la compilación web.

## Pendientes para el piloto y la publicación

- Publicar los materiales de entrega en una URL externa y comprobar el acceso anónimo. Las direcciones locales de esta guía se usan para la demostración en el equipo.
- Para un piloto de cooperativa, habilitar autenticación y permisos por parcela, asignar usuarios a cada perfil y validar el flujo con productores y asesores con datos de campo.
- Conectar una estación WeatherLink autorizada de la región y verificar sus mediciones. El conector arranca en estado sin configurar y tiene un ejemplo documental explícito. [WeatherLink](WEATHERLINK.md)
- Ampliar las series mensuales mexicanas comparables si el piloto requiere un pronóstico local de 12 meses al productor. El catálogo actual identifica referencias históricas y supuestos por cultivo. [Fuentes de precios](FUENTES-PRECIOS-PRODUCTOR.md)

Telegram, RAG, PostGIS y el escenario climático por cultivo corresponden al alcance posterior. [Fuentes y alcance](FUENTES.md)
