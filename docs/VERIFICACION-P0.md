# LuumIA V.2 · verificación del recorrido P0

14 de noviembre de 2026, hora de Campeche. Proyecto independiente, basado en los contratos y cálculos de V.1.

| Paso | Comprobación ejecutada |
|---|---|
| P0-1 | NASA POWER real, 14 valores y semana regional completa. Ranking reproducible con las dos rotaciones base en 52,5. API y web reprodujeron los márgenes spot de −$20.000 a $40.000 y cooperativa de $0 a $20.000, con centro de cupo de 9.000 kg. El caso de cero ventas conservó el motivo de ausencia del precio de equilibrio. |
| P0-2 | El importador reprodujo 60 meses de Campeche y cinco días de Mérida a partir de las capturas verificadas. La API devolvió mediana de septiembre de $11,32 MXN/kg en Campeche y $24,29 MXN/kg para la semana de Mérida. Los valores son referencias mayoristas. |
| P0-3 | Ficha guardada con cuatro bloques de evidencia. Se verificaron dos agregados regionales disponibles, margen bajo supuestos, el historial de seis ciclos simulados y el cambio del bloque local al guardar. |
| P0-4 | Desde el navegador se guardó un pluviómetro simulado de 0 mm para la ventana equivalente a 18,4 mm regionales. Se recuperó la ficha pendiente v6 después de reiniciar Uvicorn, junto con el margen histórico v5. Se rechazó una escritura sobre v5 con `409` y se recalculó v7 con su propio `request_snapshot`. |
| P0-5 | Una llamada real a Qwen2.5-1.5B-Instruct local respondió desde la exclusión de Saladette. El texto empieza con la negativa sintética del comprador. Una prueba comprobó `needs_confirmation` al retirar la negativa y otra verificó la explicación determinista sin proveedor. |

El modelo elige el énfasis de una respuesta cuyos hechos generan el motor y el servidor. El adaptador Gemini queda disponible para configurar y su credencial no se probó. La observación de lluvia local y el escenario comercial de esta demo están identificados como simulados.

La compilación web y la sincronización de contratos se comprobaron. Se revisó el layout de Chrome a 320, 390 y 1024 px sin desbordamiento. El checker de la skill conserva avisos de composición promocional por la cabecera compacta y la estructura de aplicación.
