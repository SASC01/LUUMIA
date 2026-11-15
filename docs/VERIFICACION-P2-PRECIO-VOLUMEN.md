# Precio por volumen vendido · LuumIA V.2

En [Venta de la cosecha](http://127.0.0.1:5174/#venta) se puede elegir precio fijo o precio por volumen vendido. El modelo usa dos tramos marginales. Los kilos vendidos son el menor valor entre la cosecha disponible y el cupo. Hasta el umbral se cobra el precio base por kilo. El excedente se cobra con la segunda tarifa. El ingreso suma los dos tramos y el margen resta los costos totales. El precio efectivo es el ingreso dividido entre los kilos vendidos. El precio promedio de equilibrio es costos divididos entre kilos vendidos. Si las ventas son cero, el ingreso es cero y los dos precios promedio quedan ausentes.

Precios y umbral son supuestos del escenario. Las cotizaciones mayoristas de SNIIM y la producción nacional de USDA conservan su procedencia y se muestran como referencias. El modelo funciona a partir de los supuestos ingresados. El ranking de rotaciones sigue usando restricciones y proporción de venta.

Para la demo se eligió un umbral de 6.000 kg y una tarifa de $8 MXN/kg en el excedente. Con $10 MXN/kg de base, 12.000 kg disponibles y $80.000 MXN de costos:

| Vendidos | Ingreso | Precio efectivo | Margen |
|---:|---:|---:|---:|
| 6.000 kg | $60.000 MXN | $10 MXN/kg | −$20.000 MXN |
| 12.000 kg | $108.000 MXN | $9 MXN/kg | +$28.000 MXN |

El escenario fijo da +$40.000 MXN a 12.000 kg vendidos con los demás parámetros iguales. Desde Chrome se calcularon ambos modos, se guardó el escenario por tramos en la **ficha v8**, se recuperó al recargar y se comprobó que la v7 sigue mostrando su cálculo histórico. La explicación guardada citó el umbral y las tarifas. Se revisaron 320, 390 y 1024 px sin desbordamiento ni errores JavaScript.

Las pruebas cubren cero ventas, una cosecha inferior al cupo, tarifa marginal cero, validación de supuestos y lectura de resultados históricos sin los campos nuevos. El cálculo por tramos registra el método `commercial-price-volume-1` y el nivel `simulated_assumption` en los resultados guardados.
