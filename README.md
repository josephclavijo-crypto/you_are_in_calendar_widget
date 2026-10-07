# RYM Live Calendar — configuración completa

Proyecto listo para desplegar en Vercel, sin AddEvent, sin base de datos y sin dependencias de producción. Incluye endpoint, widget HTML para GHL y pruebas locales. **Todavía no está desplegado ni conectado a tu cuenta de GHL.** Necesitas completar los valores de configuración y hacer la prueba de aceptación indicada al final.

## Evento conservado

**Replace Your Mortgage LIVE: 2-Night Event**

- Noche 1: 19 de octubre de 2026, 6–8 PM Central.
- Noche 2: 20 de octubre de 2026, 6–8 PM Central.
- Zona: `America/Chicago`; en estas fechas es CDT, UTC−05:00.
- El `.ics` contiene **un evento recurrente**: `RRULE:FREQ=DAILY;COUNT=2`.
- Primera ocurrencia: `20261019T230000Z` a `20261020T010000Z`; la segunda empieza 24 horas después. No es un evento continuo de 26 horas.
- `Location` contiene exclusivamente el Zoom Join URL único del contacto.
- La descripción completa original está en `lib/core.js`, función `description()`. Conserva todos los párrafos, las tres viñetas, Michael & Cody y ambos enlaces. Se añade el año 2026 a la fecha. Los marcadores Markdown se convierten en texto de calendario; los URLs completos aparecen debajo de **Your Join Link HERE** y **Re-register HERE** para que el calendario pueda reconocerlos.

## Qué hace cada icono

Todos los enlaces del email llevan solo un token cifrado, nunca la descripción, el Zoom URL ni una clave de la API.

| Ruta | Comportamiento |
|---|---|
| `/apple?t=TOKEN` | Descarga el `.ics` con las dos noches recurrentes. Abrir/importar en Apple Calendar. |
| `/google?t=TOKEN` | Página con `.ics`, botón de serie Google y botones separados para las noches 1 y 2. |
| `/office365?t=TOKEN` | Página con `.ics` recurrente y botones de noche 1 y 2 para Outlook empresarial. |
| `/outlook?t=TOKEN` | Página con `.ics` recurrente y botones de noche 1 y 2 para Outlook personal. |
| `/yahoo?t=TOKEN` | Página con `.ics` recurrente y botones de noche 1 y 2 para Yahoo. |
| `/event.ics?t=TOKEN` | Descarga universal del mismo archivo recurrente. |

La importación del `.ics` es el método común para conservar la recurrencia. Los botones de noche 1 y 2 crean **dos eventos individuales**: hay que guardar ambos. No se inventan parámetros de recurrencia para Outlook o Yahoo.

El enlace Google utiliza `recur=RRULE:FREQ=DAILY;COUNT=2`, igual que la versión de tu conversación que mostraba “Daily, 2 times”. Es un enlace de interfaz y no un contrato público de la API: el usuario debe verificar ese indicador antes de guardar, o importar el `.ics`. Los otros enlaces web también son mecanismos de interfaz susceptibles a cambios del proveedor. Siempre está disponible el archivo estándar; si un URL nativo supera el límite preventivo de 6000 bytes, se ofrece únicamente la importación, preservando toda la descripción.

No se pueden añadir eventos silenciosamente a los calendarios del usuario desde un email. El usuario debe guardarlos o importarlos. Crear series directamente por Google Calendar API o Microsoft Graph exigiría que cada usuario concediera acceso OAuth; este proyecto evita ese requisito.

## 1. Preparar GoHighLevel

En la **subcuenta** del evento:

1. Confirma que el contacto registrado tiene el Custom Field `contact.rym_live__join_url`, con su URL único de Zoom. Debe ser el enlace personal, no el de registro general.
2. Confirma el Custom Value `custom_values._rym_workflows__zoom_link_1st2nd_day`, con el registration URL general del evento.
3. Crea un Custom Field de contacto, tipo texto, llamado **RYM Calendar Token**. El HTML presupone la merge key `{{contact.rym_calendar_token}}`. GHL puede generar otra clave: selecciona la variable real con su selector y reemplázala en los cinco enlaces del HTML si es diferente.
4. Crea una **Private Integration** de esa subcuenta y guarda su token. Otorga estos scopes:

   - `contacts.readonly`
   - `contacts.write`
   - `locations/customFields.readonly` (para la herramienta de configuración)
   - `locations/customValues.readonly` (para consultar el registration URL general)

No uses una API key antigua ni un token de agencia para acceder a un contacto de otra subcuenta. La aplicación comprueba que `contact.locationId` coincide con `GHL_LOCATION_ID`.

Fuente: [Private Integrations de HighLevel](https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/index.html) y [scopes oficiales](https://marketplace.gohighlevel.com/docs/Authorization/Scopes/index.html).

## 2. Variables de entorno

Copia `.env.example` a `.env.local` para las herramientas locales. `.env.local` está excluido de Git. En Vercel configura las mismas variables de ejecución en **Project → Settings → Environment Variables → Production**. Para pruebas en Preview, usa valores de una subcuenta de prueba.

| Variable | Necesaria | Valor |
|---|---|---|
| `GHL_API_TOKEN` | Sí | Token de la Private Integration de la subcuenta. Solo servidor. |
| `GHL_API_VERSION` | Predeterminada | `v3`, según la documentación actual de los endpoints. Se puede configurar otra versión soportada por tu integración; no cambies el valor sin verificar los endpoints. |
| `GHL_LOCATION_ID` | Sí | ID de la subcuenta. |
| `GHL_JOIN_FIELD_ID` | Sí | ID del Custom Field `contact.rym_live__join_url`. Es un ID, no la merge key. |
| `GHL_CALENDAR_TOKEN_FIELD_ID` | Sí | ID del Custom Field **RYM Calendar Token**. |
| `GHL_REGISTRATION_VALUE_ID` | Opcional, recomendado | ID del Custom Value general. Si se define, tiene prioridad sobre la búsqueda por merge key. |
| `GHL_REGISTRATION_VALUE_KEY` | Predeterminada | `custom_values._rym_workflows__zoom_link_1st2nd_day`. El código tolera espacios y llaves en el `fieldKey` devuelto por GHL. |
| `ZOOM_REGISTRATION_URL` | Opcional | Override fijo del URL general. Dejar vacío para leer el Custom Value desde GHL. |
| `TOKEN_KEY` | Sí | Clave AES de 32 bytes, escrita como 64 caracteres hexadecimales. |
| `WEBHOOK_SECRET` | Sí | Secreto aleatorio independiente, mínimo 32 caracteres, compartido con el webhook de GHL. |
| `TOKEN_EXPIRES_AT` | Predeterminada | `2026-11-01T00:00:00Z`. Después de esa fecha los enlaces vencen. |
| `PUBLIC_BASE_URL` | Solo herramientas locales | Dominio real de producción, por ejemplo `https://calendar.tudominio.com`. Las herramientas setup/provision lo usan; el endpoint no lo necesita. |

En una terminal dentro de esta carpeta ejecuta:

```powershell
npm run secrets
```

Genera `TOKEN_KEY` y `WEBHOOK_SECRET` nuevos. Guarda los resultados en `.env.local` y Vercel. No los pegues en el email. Cambiar `TOKEN_KEY` invalida todos los tokens enviados; cambiar la fecha de vencimiento solo afecta a los tokens nuevos.

### Obtener los IDs sin adivinarlos

La ruta `/api/setup` acepta un GET autenticado con `Authorization: Bearer WEBHOOK_SECRET`. Devuelve solo nombres, claves e IDs de campos/valores de la subcuenta, sin sus valores.

Puedes usarla después del primer despliegue, configurando antes `GHL_API_TOKEN`, `GHL_LOCATION_ID`, `GHL_API_VERSION` y `WEBHOOK_SECRET`. En `.env.local` configura también `PUBLIC_BASE_URL` y ejecuta:

```powershell
npm run setup
```

Busca los IDs correspondientes a `contact.rym_live__join_url`, al nuevo campo de token y al Custom Value de registro. Añádelos a Vercel y **redespliega**. Si ya conoces esos IDs, configura todo desde el primer despliegue.

Fuentes: [Get Custom Fields](https://marketplace.gohighlevel.com/docs/ghl/locations/get-custom-fields/) y [Get Custom Values](https://marketplace.gohighlevel.com/docs/ghl/locations/get-custom-values/).

## 3. Desplegar en Vercel

1. Extrae el ZIP. La raíz del proyecto es la carpeta que contiene `package.json`, `vercel.json`, `api/` y `lib/`.
2. Sube esa carpeta a un repositorio Git privado e impórtalo en Vercel con **Add New → Project**. Si subes una carpeta contenedora, selecciona `rym-live-calendar` como Root Directory.
3. Framework Preset: **Other**. Node.js: **22.x**. No requiere framework ni build command. Deja las opciones de build sin override. Los archivos en `api/` son Vercel Functions; `vercel.json` configura las rutas cortas.
4. Añade las variables de ejecución de la tabla anterior al entorno Production y despliega.
5. Opcionalmente conecta `calendar.tudominio.com` en **Settings → Domains** y completa los registros DNS que indique Vercel. También puedes usar el dominio `tu-proyecto.vercel.app`.
6. La URL de producción debe ser accesible a los destinatarios sin iniciar sesión en Vercel. Revisa **Deployment Protection** para ese dominio de producción. Puedes mantener protección en las previews.
7. Al cambiar variables, haz un nuevo despliegue para que las funciones reciban los valores nuevos.

Alternativa, si ya utilizas la CLI de Vercel:

```powershell
npx vercel
# Configura las variables de Production en el panel de Vercel.
npx vercel --prod
```

La publicación usa tu cuenta y tu proyecto; no se ha ejecutado desde esta entrega. [Documentación oficial de Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js).

## 4. Conectar el workflow de GHL

Coloca estas acciones **después de registrar al usuario en Zoom y guardar su Join URL personal**, antes del email que contiene el widget.

### Acción A: Custom Webhook

Usa una acción de GHL que permita configurar método, headers y body, como **Custom Webhook**. Si tu plan no la ofrece, un paso de Make/Zapier o tu integración de registro puede ejecutar exactamente la misma llamada.

```text
Method: POST
URL: https://calendar.tudominio.com/api/provision
Headers:
  Authorization: Bearer TU_WEBHOOK_SECRET
  Content-Type: application/json
```

Body JSON:

```json
{
  "contactId": "{{contact.id}}"
}
```

El merge field `{{contact.id}}` debe resolverse al ID real del contacto. No envíes el Join URL en el webhook: el servidor lo lee del contacto para evitar exponerlo en el body.

La ruta:

1. Valida el secreto, el contacto y la subcuenta.
2. Comprueba que el Join URL personal y el registration URL general existen y son HTTPS de Zoom.
3. Genera un token autenticado y cifrado ligado a este evento, al contacto y a la fecha de vencimiento.
4. Actualiza **solo** el campo RYM Calendar Token mediante `PUT /contacts/:contactId`.
5. Vuelve a leer el contacto para comprobar que GHL guardó el token.
6. Devuelve HTTP 200 con `{"ok":true}`.

No necesitas mapear la respuesta del webhook a un campo: el endpoint ya escribe el token. Si el workflow reintenta la misma llamada, reutiliza el token válido guardado. [Update Contact oficial](https://marketplace.gohighlevel.com/docs/ghl/contacts/update-contact/).

### Acción B: comprobar que el token existe

Tras el webhook, comprueba que **RYM Calendar Token** no está vacío antes de enviar el email. Si la acción permite usar el estado HTTP, exige también respuesta 200. Si GHL no refresca inmediatamente el contacto en el workflow, usa una espera corta y vuelve a comprobar el campo; no presupongas éxito por haber esperado.

En la rama de fallo, reintenta la generación o detén ese email y corrige el registro. No envíes un widget con token vacío. Evita ejecutar varios workflows de provisión simultáneamente para el mismo contacto: la generación inicial no usa una transacción compartida.

### Acción C: enviar el widget

1. Abre `widget-ghl.html`.
2. Reemplaza **las cinco apariciones** de `https://calendar.example.com` por el dominio real de producción.
3. Si GHL asignó otra clave al campo Calendar Token, reemplaza **las cinco apariciones** de `{{contact.rym_calendar_token}}` por su merge field real.
4. Pega el HTML completo en un bloque **Custom HTML** del email.

El widget conserva el diseño del HTML de la conversación: título Georgia de 16 px, iconos de 27×27 px, separación de 9 px por lado, orden Apple → Google → Office 365 → Outlook → Yahoo y pie **Powered by RYM**. Conserva los mismos URLs de imágenes y el Yahoo “Y” morado. La imagen recuperada de la conversación muestra el formulario de Google Calendar; el diseño del widget se reconstruyó desde el HTML original, no desde esa captura.

Puedes conservar el click tracking de GHL: los URLs del email son cortos y no contienen parámetros de Zoom. **Haz la prueba con un envío real del workflow**, porque una vista previa o un envío genérico de prueba podría no resolver los merge fields del contacto. El título y los alt de las imágenes permiten identificar el calendario si el cliente bloquea imágenes.

Los iconos son los originales alojados en Flaticon y siguen siendo un recurso externo. Si deseas alojarlos en tu CDN, utiliza copias para las que tengas los permisos correspondientes y reemplaza únicamente `src`. Esta entrega no incluye esas imágenes dentro del ZIP.

## 5. Prueba de aceptación antes de activar el envío

Usa dos contactos de prueba registrados en Zoom, cada uno con Join URL diferente:

1. Ejecuta el workflow y confirma que el campo Calendar Token se llena para cada contacto. También puedes probar manualmente con `npm run provision -- ID_REAL_DEL_CONTACTO` usando `.env.local`.
2. Envía un email real a cada uno. Comprueba que las cinco URLs contienen un token resuelto y ningún `{{...}}` literal.
3. Apple: descarga/importa el archivo en Calendar. Comprueba las dos noches, 19 y 20, ambas 6–8 PM Central, y la recurrencia de dos ocurrencias. En macOS abre el `.ics` con Calendar; en iPhone/iPad el flujo puede variar según navegador, aplicación de email y versión. Verifica el dispositivo real de tus destinatarios: una descarga web no garantiza que iOS abra el diálogo de importación.
4. Google: prueba el botón de serie y verifica **Daily, 2 times**. Importa el `.ics` desde un ordenador si la interfaz no conserva la recurrencia. Usa un calendario de prueba para evitar duplicados.
5. Office 365 y Outlook: **Calendar → Add calendar → Upload from file**, selecciona el `.ics`, el calendario y **Import**. Confirma ambas ocurrencias. Como alternativa prueba los botones separados y guarda ambos.
6. Yahoo: importa el `.ics` desde la interfaz web de escritorio; los nombres del menú pueden variar. Si no aparece la importación, guarda ambas noches con sus botones individuales.
7. Abre el evento: **Your Join Link HERE** y **Location** deben contener el Join URL del contacto correcto. **Re-register HERE** debe contener el URL general.
8. Comprueba el último párrafo, las tres viñetas, Michael & Cody y los parámetros completos de Zoom (`?`, `&`, `%`). Deben sobrevivir sin truncarse.
9. Prueba un token manipulado: debe devolver 403. Prueba un contacto sin Join URL: el webhook debe fallar y el email no debe enviarse por esa rama.
10. Si el usuario ve el evento en otra zona horaria, el calendario convertirá la hora local; el instante sigue siendo 6–8 PM en Chicago.

Guías oficiales: [importar en Google Calendar](https://support.google.com/calendar/answer/37118?hl=en), [importar en Outlook web](https://support.microsoft.com/en-us/office/import-or-subscribe-to-a-calendar-in-outlook-com-cff1429c-5af6-41ec-a5b4-74f2c278e98c) y [formato ICS en Yahoo](https://help.yahoo.com/kb/mail/SLN3850.html).

## Desarrollo y validación

Requiere Node.js 22. No hay paquetes de producción que instalar.

```powershell
npm test
# Para probar con una subcuenta real, completa .env.local antes:
npm run dev
```

Servidor local: `http://localhost:3000`. Para ejecutar setup/provision contra él, cambia solo `PUBLIC_BASE_URL` de `.env.local` a esa dirección.

Las pruebas usan respuestas GHL simuladas y verifican recurrencia, horarios, descripción completa, codificación de URLs, plegado ICS UTF-8 de 75 octetos, autenticación, revocación, provisión y ausencia de escrituras al hacer clic. No equivalen a una validación contra GHL o contra cuentas de calendario reales. Esas pruebas requieren tus credenciales y los pasos de aceptación anteriores.

## Operación

- Cada clic vuelve a consultar GHL: usa el Join URL actual guardado para ese contacto y el Custom Value actual. No cambies el valor general a otro evento mientras estos emails sigan en uso; si necesitas fijarlo, usa el override `ZOOM_REGISTRATION_URL` para este despliegue.
- Las importaciones no actualizan eventos ya guardados si luego cambia el Join URL en GHL. El usuario tendrá que actualizar o volver a importar el evento.
- El token es una credencial de acceso al evento personal. Un email reenviado permite al receptor usar ese mismo enlace, igual que reenviar el enlace personal de Zoom. No se usa email/contact ID como autenticación pública.
- Borrar o sustituir el Calendar Token del contacto revoca los enlaces enviados. Después de borrar, ejecuta provision y envía un nuevo email. Los calendarios ya importados no se revocan con esta acción.
- Las funciones usan `no-store`, no-referrer y noindex. No registran tokens, payloads de contactos ni URLs personales. Los logs de plataforma pueden contener rutas/query strings: limita su acceso y no uses analítica externa que capture tokens.
- No hay almacenamiento local persistente ni caché de contactos: no se depende de que dos funciones compartan memoria.
- Ante 429 de GHL o fallos temporales se devuelve 503, sin filtrar respuestas de la API. Reintenta después. Para volúmenes altos, configura límites de solicitudes en Vercel y revisa los límites de tu integración GHL.
- El endpoint rechaza URLs que no sean HTTPS de `zoom.us`/`zoom.com` y sus subdominios. Si tu organización usa enlaces de redirección de otro dominio, guarda el enlace real de Zoom o amplía conscientemente la validación.
- Código sin credenciales incluidas. El ZIP se puede subir a Git; nunca subas `.env.local`.

## Archivos

```text
api/calendar.js     Cinco proveedores y descarga ICS
api/provision.js    Webhook autenticado que guarda el token en GHL
api/setup.js        Consulta autenticada de IDs
lib/core.js         Evento, descripción, cifrado, ICS y páginas
lib/ghl.js          API de HighLevel
widget-ghl.html     HTML completo del widget de email
.env.example       Variables y valores de ejemplo
vercel.json        Rutas cortas
dev.mjs            Servidor de desarrollo local
scripts/           Herramientas para secretos, setup y provisión
test/              Pruebas automatizadas
```
