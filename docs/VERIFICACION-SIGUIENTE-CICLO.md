# Planeación del siguiente ciclo

La ficha ya comparaba secuencias de varios ciclos mediante restricciones y puntajes. Los escenarios de venta calculaban cosecha, cupo y margen con precios editables y admitían una segunda tarifa por volumen. En el flujo anterior, el porcentaje de cosecha con salida era la dimensión comercial del ranking. «Siguiente ciclo» añade una comparación por cultivo inicial y mes de venta sobre la misma superficie y ficha. Los supuestos de esta comparación se editan en la vista y se aplican a la solicitud de cálculo.

## Precio y margen

El modelo compara el último precio publicado con los precios de la misma época del año. Para cada fecha histórica de prueba usa únicamente datos disponibles hasta esa fecha. Selecciona el método con menor error absoluto medio sobre meses comparables. Los escenarios bajo y alto se construyen con errores retrospectivos por horizonte. El resumen anual promedia las doce estimaciones mensuales y su rango promedia los escenarios bajos y altos. Requiere 30 cotizaciones en 36 meses, cobertura estacional y un máximo de tres meses completos de rezago. [Métodos de referencia](https://otexts.com/fpp3/simple-methods.html) · [Fuentes mensuales](FUENTES-PRECIOS-PRODUCTOR.md)

La demo simula un ciclo agrícola de primavera–verano de 12 ha. Usa octubre de 2027 como mes de venta editable dentro de la ventana general de cosecha. La ventana de cada cultivo y parcela queda por confirmar. Para maíz y frijol, el precio base supuesto en MXN/kg se multiplica por el cociente entre el pronóstico de la referencia estadounidense y su último precio observado. Ese factor es un supuesto de transmisión con base local editable. Para calabaza y Saladette el precio base se mantiene fijo y no se muestra un rango de precios futuros. La mediana municipal de maíz es un insumo del escenario. Rendimientos restantes, costos, merma y cupo son supuestos editables. [Calendario DGSIAP](https://nube.agricultura.gob.mx/calendario_agricola/) · [Rendimiento municipal](VERIFICACION-P2-RENDIMIENTO.md)

Se usa la misma fórmula comercial de la plataforma. Cosecha = hectáreas × rendimiento en t/ha × 1.000. Los kilos vendidos son el menor valor entre cosecha tras merma y cupo. El margen resta el costo total de los ingresos por kilo vendido. En el comparador se usa un precio uniforme para comparar la venta; el escenario detallado de «Venta de la cosecha» permite aplicar tramos.

## Ranking y prueba de Don Tino

El ranking agronómico puntúa el cambio de familia y el potencial del cultivo como leguminosa. La recomendación exige cambio de familia, práctica de cobertura asumida, restricciones de la ficha satisfechas y margen central positivo. Entre esas opciones elige el mayor margen. Hace falta evidencia de suelo y manejo para medir la regeneración y el balance de nitrógeno en la parcela. [Rotación y prácticas de suelo](https://www.nrcs.usda.gov/conservation-basics/soil/soil-health/soil-health-on-cropland)

| Cultivo | Ranking agronómico | Cosecha estimada (kg) | Venta (kg) | Precio (MXN/kg) | Margen simulado (MXN) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Frijol | 1 | 12.600 | 10.000 | 18,00 | 70.000 |
| Calabaza | 2 | 96.000 | 28.000 | 7,00 | 106.000 |
| Maíz | 3 | 43.024,10 | 32.000 | 5,50 | 114.000 |

Con ficha v11 y corte del 14 de noviembre de 2026, el frijol encabeza el ranking agronómico, el maíz gana en margen y la calabaza resulta recomendada. Saladette queda fuera de la recomendación por falta de salida confirmada para la ventana evaluada. Las referencias de tomate genérico y calabacín de España se pueden consultar en la gráfica.

Se comprobó en Chrome que seleccionar septiembre y quitar la cobertura de calabaza mueve la recomendación a frijol, que las series mexicanas conservan su historia sin proyección vigente y que el selector presenta doce meses para los pronósticos disponibles. La prueba conservó la ficha v11 y su historial de KoboCollect.

## Comparación con precios mexicanos observados

Al calcular el pronóstico, el comparador prioriza una serie mexicana compatible en MXN con cobertura vigente. Para una parcela de Hopelchén, primero evalúa el municipio y luego Campeche y México. Una serie por variedad específica requiere conocer la variedad de la parcela para aplicarla como pronóstico. El comparador usa la referencia internacional y el supuesto editable cuando los datos mexicanos disponibles son insuficientes. El historial distingue registros nacionales, estatales, municipales, regionales e internacionales.

En «Sensibilidad con precios mexicanos observados» se toman como referencia maíz blanco y frijol negro de las Balanzas DGSIAP. Se fija el precio observado en noviembre de 2025 para ver cuánto variaría el margen de octubre de 2027 con los mismos supuestos de producción y venta. Las cotizaciones de febrero y septiembre de 2026 del Bajío están en el historial regional. Se presentan como cotizaciones puntuales y se excluyen del cálculo anual de Don Tino. [Fuentes y descargas](FUENTES-PRECIOS-PRODUCTOR.md)

| Cultivo | Pronóstico y supuestos (MXN) | Escenario con observaciones mexicanas (MXN) | Cambio (MXN) |
| --- | ---: | ---: | ---: |
| Maíz | 114.000 | 113.360 | −640 |
| Calabaza | 106.000 | 106.000 | 0 |
| Frijol | 70.000 | 35.300 | −34.700 |

El ranking de Don Tino conserva al frijol en primer lugar agronómico, al maíz en primer lugar por margen y a la calabaza como recomendación conjunta. Se probó el selector de escenarios en Chrome a 320, 390, 1024 y 1440 px. La misma ficha v11 conserva el acuse KoboCollect v10.
