# Estación WeatherLink

El panel de [Observación de campo](http://127.0.0.1:5174/#weatherlink) consulta condiciones exteriores de una estación configurada en el servidor. Muestra temperatura en °C, humedad relativa y lluvia acumulada desde la medianoche de la estación en mm. Cada sensor conserva su propia hora de lectura. Un cero se muestra como dato válido y un campo ausente se muestra como «Sin dato». La consulta es de lectura y sirve como contexto de una estación. El registro de observaciones en la ficha tiene su propio flujo de captura y versionado. [Catálogo oficial de sensores](https://weatherlink.github.io/v2-api/resources/universal-sensor-catalog.json) · [Formato de respuesta](https://weatherlink.github.io/v2-api/api-response)

## Activación en el servidor

Establece `WEATHERLINK_API_KEY`, `WEATHERLINK_API_SECRET` y `WEATHERLINK_STATION_ID` en el entorno que inicia `scripts/start-api.ps1`. El ID admite un número o UUID. `WEATHERLINK_STATION_LABEL` permite identificar la localidad y el alcance de la estación. La clave y el secreto se envían solamente desde el backend al dominio oficial. Davis admite estaciones propias o compartidas con los permisos correspondientes. La estación de demostración de Davis también exige credenciales y se identifica como estación de EE. UU. [Autenticación](https://weatherlink.github.io/v2-api/authentication) · [Permisos](https://weatherlink.github.io/v2-api/data-permissions) · [Modo de demostración de Davis](https://weatherlink.github.io/v2-api/demo-mode)

## Verificación

- La demo local sin estación configurada explica el estado y permite abrir expresamente un ejemplo fechado de la documentación de Davis. La vista lo identifica como ajeno a Don Tino y conserva la etiqueta al mostrar el valor de `0 mm`.
- La prueba HTTP controla la respuesta del proveedor para verificar autenticación, campos de estación exterior en WeatherLink Console y EnviroMonitor, conversiones, memoria temporal y rechazo `403`. El ejemplo público verifica además el formato de WeatherLink Live. La API externa devolvió `401` al probar el modo público sin credenciales.
- Queda pendiente confirmar una lectura real de una estación autorizada asociada a la zona de Don Tino. Al corte del 14 de noviembre de 2026, LuumIA conserva NASA POWER y el pluviómetro del recorrido en la ficha versionada.
