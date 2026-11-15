# Rendimiento por cultivo y ciclo · LuumIA V.2

En [Venta de la cosecha](http://127.0.0.1:5174/#venta) se elige el ciclo agrícola del cultivo de forma explícita. Primavera–verano y otoño–invierno identifican el filtro del cierre oficial. El número de paso del cultivo en la rotación y la ventana de venta se conservan por separado.

La referencia municipal de DGSIAP usa el cierre agrícola de Hopelchén, Campeche, en temporal. Cada rendimiento anual se calcula como la suma del volumen de producción de los CADER 2 y 3 dividida entre su superficie cosechada total. La serie de maíz grano de primavera–verano tiene cinco registros 2021–2025. La mediana es **3,585342 t/ha**, el rango va de 2,006084 a 4,526951 t/ha y el máximo corresponde a 2025, con 43.492 ha cosechadas. El recorte incluye enlaces, fechas, huellas y líneas del CSV. [Cierres DGSIAP](https://nube.agricultura.gob.mx/datosAbiertos/Agricola.php)

El rendimiento de la parcela se conserva como supuesto editable. Para usar la mediana, el servidor comprueba la referencia y el valor, además de cultivo, ciclo, municipio y modalidad. Para combinaciones sin registros comparables se permite el supuesto manual. Las estadísticas describen el municipio. La aplicación conserva el método, el rendimiento utilizado, la superficie, el origen del supuesto y el periodo de referencia en la evaluación guardada.

La cosecha antes de merma se calcula como `superficie_ha × rendimiento_t_ha × 1.000`. Con **12 ha** y la mediana adoptada, la demo obtiene **43.024,104 kg**. Con merma cero y cupo alto de 12.000 kg, vende como máximo 12.000 kg y quedan **31.024,104 kg** sin salida en ese extremo. El margen alto es $28.000 MXN con el supuesto por tramos de la ficha v8, porque el cupo limita la venta. Con merma simulada de 10%, la prueba automática obtiene 38.721,6936 kg disponibles antes de aplicar el cupo.

En Chrome se comprobó que consultar primavera–verano no sustituye el valor manual hasta pulsar «Usar mediana como supuesto». Otoño–invierno y Saladette se probaron como casos sin referencia comparable. Se guardó el escenario de maíz en la **ficha v9**, se recuperó al recargar y la **v8** conservó su cálculo histórico de 12.000 kg. Se verificaron ancho y funcionamiento a 320, 390 y 1024 px, además de la procedencia citada por la explicación de la ficha.

Para comprobar el catálogo contra DGSIAP, ejecuta `python scripts/prepare_crop_yield.py --check`. La demo lee el recorte versionado y puede consultarlo sin descargar nuevamente los cierres.
