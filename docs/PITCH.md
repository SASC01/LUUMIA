# LuumIA · Pitch de entrega

NASA Space Apps Challenge 2026 · Field Shift: Adapting Farms with NASA Data. [Enunciado del reto](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/)

## Guion en vivo · 2 minutos

### 0:00–0:20 · El problema

Imagina que acabas de levantar tu cosecha. Llevas seis ciclos sembrando maíz y tienes que decidir qué poner en esas mismas doce hectáreas. ¿Qué cultivo le conviene al suelo? ¿Cuánto vas a poder vender? ¿Te alcanza para cubrir tus costos? Don Tino, nuestro caso de demostración en Hopelchén, Campeche, necesita responder esas preguntas antes de sembrar.

### 0:20–0:45 · Datos para decidir

LuumIA combina lluvia y temperatura regionales de NASA POWER con una escena HLS que muestra vigor de la vegetación. También incorpora registros de campo en la ficha. Aquí se ven 18,4 milímetros de lluvia regional y una lectura de pluviómetro de 13,75 milímetros simulados, enviada desde KoboCollect. Cada actualización conserva la ficha anterior.

### 0:45–1:20 · El plan de siembra

En la parcela de ejemplo, Don Tino decide qué sembrar y cuánto. Reparte diez hectáreas en seis de calabaza y cuatro de frijol. El croquis muestra el reparto y el simulador estima 52,2 toneladas de cosecha. La ganancia depende del precio, los costos y el cupo de cada cultivo. Al guardar y compartir, la cooperativa puede consultar esa versión del plan.

### 1:20–2:00 · De la estimación a las ventas

En Métricas de ejemplo, la cooperativa puede documentar un cupo y registrar por zona los kilos vendidos, el precio y los costos. LuumIA compara lo registrado con la estimación del plan. Si alguien corrige o anula una venta, el total cambia y el dato anterior sigue en el historial. Así Don Tino y la cooperativa pueden revisar lo que se planeó y lo que ocurrió. LuumIA. La rotación que ya sabían los abuelos, ahora con ojos en el cielo.

## Recorrido en pantalla

| Momento | Qué abrir | Qué mostrar |
| --- | --- | --- |
| 0:00 | [Demo](http://127.0.0.1:5174/#demo) | Hopelchén, 12 ha declaradas y secuencia previa de maíz. |
| 0:20 | [Clima regional](http://127.0.0.1:5174/#region), [Vigor](http://127.0.0.1:5174/#vigor) y [Observación de campo](http://127.0.0.1:5174/#observacion) | Semana de NASA POWER, fecha de escena HLS y acuse de KoboCollect en la ficha v10. |
| 0:45 | [Cultivos y rotaciones de ejemplo](http://127.0.0.1:5174/#demo-cultivos) | Abre el simulador, conserva 10 ha con 6 de calabaza y 4 de frijol, y pulsa «Ver mi plan». |
| 1:20 | [Métricas de ejemplo](http://127.0.0.1:5174/#demo-metricas) | Abre el plan compartido y «Ventas por zona». Para mostrar un registro o su anulación usa una copia de la demo con ventas de prueba identificadas. Descarga el CSV de la versión seleccionada. |

Si hay tiempo para preguntas, [Siguiente ciclo](http://127.0.0.1:5174/#siguiente-ciclo) permite contrastar el ranking agronómico con el margen estimado. Si desmarcas «Conservar cobertura del suelo» para calabaza y actualizas la comparación, la recomendación de la demo pasa a frijol. En [Venta de la cosecha](http://127.0.0.1:5174/#venta) puedes cambiar el cupo o el precio por volumen y verificar kilos vendidos, excedente y margen.

## Guion para video de entrega · hasta 30 s

| Tiempo | Mostrar | Narración en inglés |
| --- | --- | --- |
| 0–6 s | Ficha de Don Tino, Hopelchén | After six corn cycles, Don Tino has to choose what to plant and what he can sell. |
| 6–13 s | NASA POWER, HLS y registro de campo | LuumIA combines NASA rainfall and satellite imagery with local field records. |
| 13–23 s | Reparto por zonas en Parcela | Don Tino splits ten hectares between squash and beans, then reviews his estimated harvest before sharing the plan. |
| 23–30 s | Comparación de ventas de prueba en Métricas | His cooperative can track recorded sales against that plan and keep a record of any changes. |

La organización indica que el archivo demostrativo puede ser un video de hasta 30 segundos o una presentación de hasta siete diapositivas. El [PDF de seis diapositivas en inglés](../entregables/LuumIA_NASA_Space_Apps_2026_Final.pdf) y su [PowerPoint editable](../entregables/LuumIA_NASA_Space_Apps_2026_Final.pptx) usan capturas de la demo local. [Formato de demostración de NASA Space Apps 2026](https://github.com/nasa/spaceapps/discussions/1947)

## Datos para responder preguntas

- Don Tino es un personaje compuesto. La parcela, secuencia de cultivos, compra y lectura KoboCollect son simuladas. KoboCollect sí envió el formulario Android que quedó registrado en la ficha. [Verificación de KoboCollect](KOBOCOLLECT.md)
- NASA POWER aporta lluvia y temperatura regionales. La escena HLS muestra vigor en una fecha. SMAP e IMERG se consultan como contexto regional adicional. El potencial de cuidado del suelo se evalúa con alternancia de familias y cobertura prevista. [Capas regionales](VERIFICACION-P2-CAPAS.md) · [Reglas de rotación](VERIFICACION-SIGUIENTE-CICLO.md)
- Las cotizaciones mensuales mexicanas más recientes incorporadas son de noviembre de 2025. El análisis de sensibilidad usa maíz blanco a $5,48/kg y frijol negro a $14,53/kg. Para el pronóstico, la demo aplica la variación de las referencias internacionales a precios locales editables de maíz y frijol. Calabaza conserva su precio local supuesto. [Fuentes de precios](FUENTES-PRECIOS-PRODUCTOR.md)
- Para octubre de 2027, en la simulación de 12 ha, el margen estimado del maíz es $114.000 MXN, el de la calabaza $106.000 y el del frijol $70.000. Con los precios nacionales observados, los márgenes quedan en $113.360, $106.000 y $35.300, respectivamente. El orden se conserva. [Verificación de la comparación](VERIFICACION-SIGUIENTE-CICLO.md)
- El motor aplica las restricciones y calcula el ranking. El asistente local Qwen explica el resultado y sus supuestos. La exclusión de Saladette permite mostrar la explicación. [Verificación funcional](VERIFICACION-P0.md)
- WeatherLink puede consultar una estación Davis configurada. La demo ofrece un ejemplo fechado de la documentación de Davis y mantiene la verificación con una estación real pendiente de credenciales.

## Entrega en la plataforma

- Publicar la presentación de demostración y comprobar el acceso desde una ventana privada.
- Añadir un enlace accesible al proyecto final, separado del enlace de la presentación. La instancia de esta guía funciona en el equipo donde corre LuumIA.
- Citar NASA POWER, HLS, SMAP e IMERG en la ficha del reto. Incluir esta declaración de IA: «We used OpenAI Codex to assist with coding and writing. A local Qwen model explains the application’s calculated results. Deterministic rules calculate eligibility, rankings and margins.»

[Instrucciones de publicación de NASA Space Apps](https://github.com/nasa/spaceapps/discussions/1991) · [Fuentes del proyecto](FUENTES.md)
