# Validación de la entrega

Fecha: 6 de octubre de 2026, zona de referencia America/Bogota.

Resultado: **12 pruebas automatizadas aprobadas**, 0 fallos, ejecutadas con `node --test`.

Cobertura:

- Token cifrado, expiración, manipulación y cambio de clave.
- `.ics` con un VEVENT, recurrencia DAILY/COUNT=2 y dos noches de dos horas.
- Conversión UTC → America/Chicago: comienzo 18:00 y fin 20:00.
- Descripción completa, caracteres Unicode y plegado de líneas ICS en UTF-8.
- URLs de Google, Outlook, Office 365 y Yahoo: Zoom con `?`, `&`, `%` y descripción intacta después de codificar/decodificar.
- Webhook autenticado, escritura del campo token y reutilización en reintentos.
- Las cinco rutas y descarga universal; no se modifica GHL al hacer clic.
- Tokens revocados, errores temporales de GHL y respuesta sin credenciales expuestas.
- Herramienta setup autenticada que devuelve IDs sin URLs personales.
- URLs nativas demasiado largas: se conserva el archivo ICS y no se emite un Location excesivo.
- Rechazo de contactos de otra subcuenta.
- Rechazo de provisión si falta el Join URL.
- Detección de una escritura de token que GHL no haya persistido.

Las respuestas de GHL se simularon para estas pruebas. No se utilizaron credenciales reales. No se ha desplegado en Vercel ni validado la importación en cuentas reales de Apple, Google, Microsoft o Yahoo. Sigue la prueba de aceptación de README.md antes de enviar la campaña.
