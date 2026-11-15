# Parcela y Métricas

## Parcela

Registra tu terreno con un nombre y su superficie. Puedes indicar el municipio, el estado y si es de temporal o riego. Si tienes varias parcelas, el selector abre la ficha y el plan de cada una.

Desde el resumen, abre la sección que necesites.

- **Resumen** muestra la ubicación, la superficie, el cultivo si está confirmado, las mediciones disponibles, las alertas de la evaluación y un siguiente paso.
- **Análisis ambiental** reúne el clima de referencia y las observaciones de campo de la ficha.
- **Cultivos y rotaciones** reúne la captura de ciclos, la comparación para la siguiente siembra y el croquis. En Demo también permite simular una venta.
- **Historial** muestra los ciclos con sus fechas, los registros de campo, el clima por período y los cambios de superficie. Una sola medición regional se presenta como registro fechado.
- **Análisis avanzado** conserva los valores de origen, los métodos y las fuentes. En Demo incluye las capas NASA, HLS, la sonda y las referencias de SNIIM y USDA.

## Registrar cultivos

En «Cultivos y rotaciones», usa «Registrar cultivo actual» con la fecha en que empezó y su fecha prevista de fin. Usa «Agregar ciclo anterior» con las fechas registradas de un período ya terminado. Los ciclos de la ficha se ordenan por fecha y cada guardado crea una versión. Dos ciclos de la misma parcela no pueden compartir fechas.

En «Cultivos registrados», abre los ciclos vigentes para corregir el cultivo o sus fechas, o confirma la anulación de un registro. El motivo es opcional. En «Historial de cambios de cultivo» puedes consultar el registro anterior, el corregido cuando corresponda, la fecha del cambio y el enlace a la ficha anterior.

El Resumen muestra el cultivo que está en curso y el Historial lista los ciclos. Al guardar un ciclo se recalcula la alternancia de familias para la siguiente siembra usando el último ciclo fechado. Si faltan datos para otros criterios, el motor les da el mismo puntaje para todas las opciones. Cuando hay un empate, el Resumen muestra los cultivos que comparten el primer lugar.
Al anular el ciclo más reciente, la evaluación usa el ciclo fechado que sigue vigente. Si se anulan todos, el Resumen vuelve a pedir un ciclo y el historial de cambios sigue accesible.

## Plan de siembra

«Cambiar superficie registrada» modifica el límite de hectáreas disponible para nuevos planes. Guarda la nueva cifra como superficie declarada en una versión de la ficha, por separado del polígono. «Historial de superficie» muestra el valor anterior, el nuevo y el enlace a la ficha previa. Cada plan compartido conserva la versión de la ficha con la que se guardó.

1. Indica las hectáreas de primavera–verano que quieres considerar, dentro de la superficie declarada. Si reduces el área por debajo del reparto, el croquis ajusta las zonas en proporción al nuevo tamaño. Si aumentas el área, el sobrante se muestra como superficie sin asignar.
2. Elige el cultivo de cada zona. Arrastra el separador del croquis para trasladar hectáreas entre zonas vecinas o entre una zona y el espacio sin asignar. También puedes usar las flechas del teclado sobre el separador o escribir directamente las hectáreas con hasta tres decimales, con punto o coma.
3. Abre «Datos para estimar la cosecha y la ganancia» para ingresar rendimiento, precio, merma, costo por hectárea y cupo de venta. En «Documentar origen de las cifras» puedes registrar una referencia para los datos reportados. Si la ficha tiene un cupo confirmado aplicable al mes de venta, se usa el mínimo del rango documentado.
4. El resumen muestra la cosecha y la ganancia estimadas con las cifras capturadas y las referencias oficiales aplicables. Si faltan datos, indica cuáles y muestra las estimaciones que puede calcular. Para estimar semilla se necesita una dosis por cultivo.
5. Guarda el borrador y, cuando quieras que aparezca en Métricas, pulsa «Compartir para revisión». Cada versión guarda las cifras del cálculo y queda vinculada a la ficha que se usó. Un conflicto de versión obliga a revisar el cálculo antes de guardar otra vez.

En «Análisis ambiental», abre «Observaciones de campo» para registrar la lluvia medida y los días que abarca. La lectura se guarda en una nueva versión de la ficha. «Fechas y fuentes» muestra el período y el origen.

## Demo

El botón «Demo» abre el resumen de Don Tino. Usa la misma navegación de Parcela para consultar sus observaciones de KoboCollect y sus análisis. «Métricas de ejemplo» abre los reportes y datos comerciales del caso.

## Métricas

En «Cupos confirmados de la cooperativa» abre «Registrar cupo confirmado». Indica cultivo, fechas de entrega, fecha de confirmación, kilos mínimos y máximos, y fuente o folio. Puedes agregar un enlace HTTPS al documento. Al guardar, el cupo se registra en una nueva versión de la ficha. Si la ficha tenía una evaluación vigente, queda disponible en el historial para recalcularla con la nueva evidencia comercial.

«Corregir cupo» abre los datos vigentes para editarlos. El cupo corregido sustituye al anterior. «Cancelar cupo» pide confirmar la cancelación antes de retirarlo. Ambos cambios guardan la fecha, la versión y el motivo si se indicó. «Historial de cupos» permite consultar el valor anterior y, para una corrección, el nuevo. Si se cancela la única confirmación aplicable, Parcela recupera el cupo de respaldo.

En Parcela vuelve a calcular el plan para aplicar el cupo que corresponda. Guarda y comparte el nuevo resultado para llevarlo a Métricas. El reporte anterior sigue asociado a la ficha y al cálculo con los que se publicó.

En «Ventas por zona» elige el plan compartido y registra zona, fecha, kilos vendidos, precio por kilo y costos en MXN. El folio o referencia es opcional. Si hay varias ventas de la misma zona, asigna a cada una únicamente su parte de los costos para evitar contarlos dos veces. La ganancia de cada venta se calcula con los kilos vendidos por el precio menos el costo capturado. Las ventas se acumulan por zona y plan. La diferencia resta a la ganancia acumulada la estimación del plan completo, por lo que puede cambiar al capturar más ventas. El historial conserva cada venta en la versión con la que se registró.

En «Ventas vigentes», «Corregir venta» abre los datos para editar kilos, precio, costos y demás datos de captura. «Anular venta» solicita una confirmación. Ambos cambios admiten un motivo opcional y quedan fechados en «Historial de cambios». La comparación y el CSV usan una sola revisión vigente por venta. Si todas las ventas se anulan, la ganancia real aparece como «Sin ventas vigentes». El CSV incluye por separado los datos anteriores y corregidos, o el dato que se anuló.

«Descargar ventas y cambios (CSV)» exporta la versión seleccionada en «Plan compartido», incluidas versiones anteriores. El archivo identifica tanto el plan como la ficha y conserva la estimación, las ventas vigentes y el historial de esa versión.

La demostración presenta el plan compartido de Don Tino, con hectáreas asignadas, cosecha y ganancia estimadas por zona y versión de la ficha. Los reportes técnico y comercial se pueden consultar y descargar en CSV. El reporte técnico usa la versión asociada al plan para incluir sus registros de campo y alternativas de rotación. El reporte comercial muestra el cálculo guardado, el mes simulado de venta, el origen del precio, del costo y del cupo, y las ventas registradas para esa versión. También reúne los escenarios que comparan cada cultivo sobre la parcela completa.

La cosecha disponible para venta descuenta la merma. Si un cultivo ocupa varias zonas, el cupo se reparte en proporción a los kilos disponibles en cada zona. La ganancia estimada resta el costo de toda la superficie sembrada al ingreso de los kilos vendidos. El costo por hectárea precargado prorratea los costos de la demo de 12 ha. El cupo se toma de la confirmación vigente más reciente para el cultivo y ciclo, del respaldo capturado o del supuesto precargado, en ese orden. El reporte conserva el rango, la ventana, la fecha y la fuente de la confirmación aplicada. Los precios históricos oficiales y las proyecciones se identifican por separado de los precios asumidos para la demo. [Fuentes de precio al productor](FUENTES-PRECIOS-PRODUCTOR.md)

La versión de la ficha y la versión del plan se guardan por separado en PostgreSQL. Un borrador posterior queda en la vista de edición hasta que se comparte. Las fichas propias y la demo se guardan por separado en esta instancia local.

## Verificación del flujo

En una copia aislada de PostgreSQL se registró una parcela propia de 100 ha, se ajustó el croquis con el ratón y el teclado y se compartió un plan de maíz y frijol desde Parcela. Los datos de prueba dieron 258 t de cosecha y $1,125,000.00 MXN de ganancia estimada. Una observación manual de lluvia persistió al recargar. Se verificaron el historial de registro, corrección y anulación de una venta y la descarga del CSV. En Demo se verificó la presentación del registro KoboCollect a 320 px, además de la ficha v11 y el plan v5 de Don Tino.

El plan compartido v5 usa la ficha v11. Reparte 10 de las 12 ha declaradas en 6 ha de calabaza y 4 ha de frijol, con una cosecha estimada de 48 t y 4,2 t, respectivamente. Para la venta simulada de octubre de 2027, calcula una ganancia de $151,000.00 MXN en calabaza y $19,477.25 MXN en frijol, para un total de $170,477.25 MXN. Los costos, cupos, mermas y el precio de calabaza son supuestos. El frijol usa como referencia el precio medio rural nacional de frijol negro de noviembre de 2025, de $14.53 MXN/kg. La ficha de Don Tino carece de registros de venta y cupos confirmados. [Balanza de frijol de DGSIAP](https://nube.agricultura.gob.mx/Balanza/Frijol/diciembre2025.php)

En una copia aislada de Don Tino se probó un documento ficticio de cooperativa con un cupo de calabaza de 20,000 a 24,000 kg. Al aplicar 20,000 kg en lugar de los 28,000 kg de respaldo, la ganancia estimada de la calabaza bajó de $151,000.00 a $95,000.00 MXN. El frijol conservó sus $19,477.25 MXN, para un total de $114,477.25 MXN. Se comprobó que el cupo se asigna una sola vez al repartir la calabaza en dos zonas, que el plan compartido conserva sus cifras al guardar un borrador y que el reporte y su CSV incluyen el rango y la fuente. El caso de prueba se verificó en Chrome y PostgreSQL, con la ficha principal v11 y su plan v5 intactos.

El mismo caso ficticio se registró desde el formulario de Métricas en una copia aislada de PostgreSQL. El guardado creó la ficha v12 y un reintento idéntico devolvió la misma versión. Se verificó que un formulario abierto sobre una ficha anterior conserva los campos al encontrar un conflicto. Parcela obtuvo el cupo al cambiar de pestaña, calculó $114,477.25 MXN y conservó el plan v5 publicado hasta que se compartió el v6 en la copia. El CSV del v6 incluyó el folio, el rango y la fuente del cupo. La ficha v11 de la demo principal conservó sus datos.

En una nueva copia aislada se registraron 20,000–24,000 kg, se corrigió el cupo a 32,000–36,000 kg y luego se canceló. Al recalcular y compartir tras cada cambio, Métricas pasó de $114,477.25 a $198,477.25 MXN y volvió a $170,477.25 MXN con el respaldo de 28,000 kg. Los tres CSV y las fichas históricas conservaron sus cifras y fuentes. La demo principal mantiene la ficha v11 y el plan publicado v5.

En una copia aislada se capturaron tres ventas ficticias en el plan v5, incluida una con pérdida. Las ventas acumularon 23,500 kg, ingresos de $199,000.00 MXN y costos de $81,000.00 MXN. La ganancia registrada de $118,000.00 MXN quedó $52,477.25 MXN por debajo de la estimación de $170,477.25 MXN. El historial y el CSV conservaron las ventas de v5 después de publicar v6 en la copia. La ficha principal v11 sigue sin ventas de prueba.

Para verificar cambios de ventas, una copia aislada del plan v5 recibió dos ventas ficticias por $118,000.00 MXN de ganancia. La corrección de la venta de calabaza actualizó el total a $134,000.00 MXN. Tras anular la venta de frijol, quedó en $121,000.00 MXN, con una diferencia de −$49,477.25 MXN frente a la estimación. El historial y el CSV conservaron la corrección y la anulación después de recargar. Se comprobó el reintento sin duplicados, el rechazo de una revisión obsoleta y la conservación de la ficha principal.

En una copia aislada de Don Tino se cambió la superficie de 12 a 120 ha y se guardó y compartió un plan de 100 ha, con 60 ha de calabaza y 40 ha de frijol. El resultado de 522 t estimadas persistió al recargar. Después se verificó una reducción a 4.004 ha, la exactitud del límite y la conservación tanto de la ficha v11 como del plan anterior. La demo principal conserva su ficha de 12 ha.

En Chrome también se comprobó la validación de superficies y fuentes, la recuperación del borrador al recargar y el margen negativo con cupo cero. Los formularios se probaron con teclado entre 320 y 1440 px. Las 87 pruebas automatizadas, la generación de contratos y la compilación web pasaron. Queda por validar la facilidad de uso con productores y asesores en campo.

## Referencias de diseño

El simulador amplía el croquis y muestra el avance de sus tres pasos. Métricas destaca la acción de registro y el margen estimado. El indicador de operaciones muestra el estado de carga y la confirmación con texto accesible, y reduce el movimiento según la preferencia del sistema. [Stepper de React Bits](https://reactbits.dev/components/stepper) · [Status Mark de React Bits](https://reactbits.dev/micro/status-mark)

Para los flujos agrícolas se revisaron la consulta de datos por terreno en Cropwise y la planificación por campo en FieldView. [Cropwise Field Dashboard](https://help.ca.cropwise.com/hc/en-us/articles/44982709444243-Field-Dashboard) · [Climate FieldView](https://dev.fieldview.com/)
