# Endpoints externos y comportamiento actual del frontend

Actualizado el 19 de octubre de 2026 a partir del código actual. La aplicación consume dos endpoints: autenticación y tareas. El cambio de H-04 ya está aplicado: el login muestra texto por interpolación y no interpreta mensajes como HTML. HTTP y sesión todavía viven en los componentes, no en servicios.

Actualización H-02 del mismo día: axios pasó de 0.31.0 a **1.20.0**, fijado en [package.json](../package.json) y [package-lock.json](../package-lock.json). Las pruebas de [axios-contract.spec.ts](../src/app/utils/axios-contract.spec.ts) y la verificación de navegador conservaron los contratos, headers, serialización, política de estados y timeouts descritos aquí. No se modificaron las llamadas de los componentes. La evidencia y los fallos preexistentes se registran en [TESTING.md](TESTING.md).

Este documento describe el **contrato que consume el cliente**, no certifica el backend. No se hicieron solicitudes reales a los servicios. Los ejemplos de login proceden de fixtures existentes; el de tareas reutiliza el objeto real de la prueba de la utilidad, indicando sus limitaciones. Ningún token o credencial de los ejemplos acredita una sesión real.

El arranque registra las rutas `/login` y `/dashboard`; la ruta vacía y las desconocidas redirigen a login. No hay guards declarados. El recorrido es: validar credenciales → POST de login → guardar sesión → navegar a dashboard → GET de tareas → logout local. Fuentes: [src/main.ts:6](../src/main.ts#L6), [src/app/app.routes.ts:3](../src/app/app.routes.ts#L3).

## Login — `POST http://localhost:8080/auth/login`

### 1. Quién lo llama

`LoginComponent.login()`, directamente mediante `axios.post`, al pulsar **Ingresar**. No intervienen un servicio de autenticación, interceptor ni `HttpClient`.

Antes de enviar, limpia el mensaje y valida usuario y contraseña: rechaza `null`, `undefined` y texto vacío después de convertirlo con `String(...).trim()`. El trim **solo valida**: los valores originales, incluidos espacios, se envían sin normalización. Si las validaciones pasan, activa `busy`; el botón queda deshabilitado y muestra **Ingresando...** durante la operación.

Fuentes: [login.component.ts:31](../src/app/login/login.component.ts#L31), [login.component.ts:41](../src/app/login/login.component.ts#L41), [login.component.html:34](../src/app/login/login.component.html#L34).

### 2. Qué envía: headers, body y query params

| Parte | Nombre | Valor y comportamiento |
|---|---|---|
| Método y URL | POST | `http://localhost:8080/auth/login`, URL fija en el componente. |
| Header de biblioteca | `Content-Type` | `application/json` para este objeto de body, serializado por axios; no lo configura explícitamente el componente. |
| Header de biblioteca | `Accept` | Por defecto de axios: `application/json, text/plain, */*`. |
| Autorización | `Authorization` | No se configura en esta llamada, aunque exista una sesión previa en almacenamiento. |
| Body | `username` | Valor del campo Usuario; normalmente string, sin interfaz ni validación de tipo estricta. |
| Body | `password` | Valor del campo Contraseña; normalmente string, sin trim al enviar. |
| Body | `client` | Literal fijo `angular-workshop`. |
| Query params | Ninguno | No se añaden parámetros a la URL. |
| Opción de transporte | `timeout` | 5000 ms. No es un campo del body ni un header. |

Ejemplo concreto verificable en la configuración de [login.component.spec.ts:35](../src/app/login/login.component.spec.ts#L35):

```http
POST http://localhost:8080/auth/login
Content-Type: application/json
Accept: application/json, text/plain, */*

{"username":"test-user","password":"test-password","client":"angular-workshop"}
```

Son valores de prueba, no credenciales del backend. La prueba de preservación del request verifica además el envío de `" test-user "` y `" test-password "` con sus espacios originales.

Fuente del request: [login.component.ts:41](../src/app/login/login.component.ts#L41). Los defaults de serialización, Accept y estados se contrastaron con [axios/lib/defaults/index.js](../node_modules/axios/lib/defaults/index.js) en la instalación local; no son headers añadidos manualmente por la aplicación.

### 3. Qué espera recibir en éxito: estado, campos y ejemplo

**Estado HTTP:** el componente no inspecciona `response.status`. Con el `validateStatus` por defecto de axios, se resuelven las respuestas **200–299**; además, el cliente exige `response.data.token` truthy. No puede afirmarse desde este frontend si el servidor promete exactamente 200, 201 u otro código. Un 204 sin body no completa el login: entra en la rama «sin token».

| Campo JSON | Forma esperada por el uso | Consumo y validación real |
|---|---|---|
| `token` | String de autenticación no vacío | Es la única comprobación de éxito del body, mediante truthiness; no se comprueba que sea string ni su formato, firma o vencimiento. Se guarda en `workshop_token`. |
| `user` | Objeto de usuario | Se serializa con `JSON.stringify` y guarda en `workshop_user`, sin validar estructura ni presencia. Tener token no garantiza que el usuario sea utilizable después. |
| `user.username` | String | Dashboard lo usa para `owner` y como alternativa en el saludo. No se verifica durante login. |
| `user.displayName` | String opcional para presentación | Dashboard lo prioriza en el saludo sobre `username`; no es condición de autenticación. |

Ejemplo del body real del **fixture de pruebas**, no de una captura del servidor:

```json
{
  "token": "test-token",
  "user": {
    "username": "test-user",
    "displayName": "Test User"
  }
}
```

Procedencia: `sessionResponse.data` y `user` de [login.component.spec.ts:10](../src/app/login/login.component.spec.ts#L10). El wrapper `data` pertenece a la respuesta axios simulada; **no** se espera que el servidor envíe `{"data": ...}`.

Con token truthy, escribe en este orden: `workshop_token`, `workshop_user` y `workshop_preferences`; después espera `router.navigate(['/dashboard'])`. Las preferencias son locales: se leen al construir el login y se combinan con `{ theme: 'light', showTips: true, compact: false }`; no se envían al backend. Al terminar el intento, `finally` pone `busy = false`.

Fuentes: [login.component.ts:20](../src/app/login/login.component.ts#L20), [login.component.ts:46](../src/app/login/login.component.ts#L46), [dashboard.component.ts:36](../src/app/dashboard/dashboard.component.ts#L36), [dashboard.component.html:6](../src/app/dashboard/dashboard.component.html#L6).

**Preguntas abiertas:** ¿qué código HTTP exacto garantiza el backend? ¿Cuáles son los campos obligatorios completos de `user`? ¿El token es JWT u opaco, cuánto dura y cómo se renueva? El cliente no permite responderlas.

### 4. Cómo reacciona ante errores y respuestas inesperadas

Mensaje genérico de autenticación: **«No se pudo iniciar sesión. Verifica tus credenciales o inténtalo nuevamente.»**

| Situación | Reacción actual del cliente y de la UI |
|---|---|
| Usuario inválido según la validación local | No envía HTTP; muestra «Ingrese un usuario.». No navega ni escribe sesión. |
| Contraseña inválida según la validación local | No envía HTTP; muestra «Ingrese una contraseña.». No navega ni escribe sesión. |
| HTTP 401/403, incluidas credenciales rechazadas | Mismo catch genérico: muestra el mensaje local, registra `console.error(error)` y pone `busy = false`. No hay mensaje específico por código ni redirección. Los códigos son escenarios manejables, no una promesa del servidor. |
| HTTP 4xx/5xx restantes, por ejemplo 429 o 500 | El mismo catch: no distingue límites de uso, errores de servidor ni `Retry-After`; no reintenta automáticamente. |
| Timeout de 5000 ms | Si axios rechaza por timeout, usa el mismo mensaje genérico, sin notificación específica de timeout. Se restablece `busy`. |
| Red inaccesible, rechazo CORS o error de transporte | Mismo catch genérico; no muestra `error.message` ni el detalle remoto en pantalla. |
| Respuesta resuelta sin `data` utilizable o con token ausente, vacío o falsy | Muestra «El backend respondió sin token.». No guarda nueva sesión ni navega. La prueba cubre respuesta undefined, `{}`, `data: null`, `data: {}` y token vacío. |
| Token truthy pero inválido o expirado | El cliente no puede detectarlo: lo guarda y navega. Solo la consulta de tareas podría ser rechazada por el servidor; véase su apartado de errores. |
| Token truthy con `user` ausente o incompatible | No se rechaza en login. Puede almacenarse un valor no recuperable o producirse un fallo al inicializar dashboard. No hay validación de esquema ni rollback de la sesión. |
| Falla de escritura en almacenamiento o navegación que rechaza con excepción | Está dentro del mismo try/catch: mensaje genérico y `busy = false`. No se revierten las escrituras ya realizadas. Si la navegación devuelve `false` sin excepción, el código no lo distingue y no genera mensaje específico. |
| Preferencias locales con JSON inválido al abrir login | Constructor registra «Preferences could not be loaded» en consola, conserva valores por defecto y no muestra un mensaje de autenticación. |

Un error HTTP no borra una sesión anterior. En la rama de error no hay refresh de token ni cierre de sesión automático. Un usuario puede volver a pulsar Ingresar cuando el botón refleje `busy = false`.

**Límite de actualización visual:** el login no utiliza `NgZone.run` ni `detectChanges()` al completar axios. La verificación de navegador registrada en [HALLAZGOS.md](../HALLAZGOS.md) observó que, tras un 401, hizo falta un evento de entrada Angular para refrescar el mensaje y el botón. Por tanto, restablecer el estado no garantiza actualización visual inmediata; no se documenta como solucionado.

Fuentes: [login.component.ts:22](../src/app/login/login.component.ts#L22), [login.component.ts:31](../src/app/login/login.component.ts#L31), [login.component.ts:51](../src/app/login/login.component.ts#L51), [login.component.spec.ts:122](../src/app/login/login.component.spec.ts#L122). No hay una clasificación exhaustiva de códigos de error del backend: todos los rechazos HTTP convergen en el mismo catch.

### 5. Notas de seguridad relevantes

- **H-04 aplicado:** `message` es string y se presenta con `{{ message }}`. No hay `[innerHTML]`, bypass del sanitizador ni concatenación de usuario o detalle remoto en el mensaje. No se deduce de esto que existiera un XSS explotable antes.
- **Sesión aún en componentes y `localStorage`:** no se migró a cookies HttpOnly, memoria ni un servicio centralizado. Un script del mismo origen puede leer el token; este cambio no resuelve H-01.
- **Transporte local HTTP:** la URL no cifra credenciales ni token. El laboratorio no debe publicarse en Internet ni usarse con credenciales reales.
- El catch conserva `console.error(error)`; no se implementó un saneamiento de posibles detalles sensibles en los objetos de error.
- No se valida el esquema de respuesta ni autenticidad del token en el navegador. No existe una llamada de refresh o revocación en este frontend.

Fuentes: [login.component.ts:19](../src/app/login/login.component.ts#L19), [login.component.ts:47](../src/app/login/login.component.ts#L47), [login.component.ts:54](../src/app/login/login.component.ts#L54), [login.component.html:39](../src/app/login/login.component.html#L39), [README.md](../README.md).

## Tareas — `GET http://localhost:8000/api/tasks?owner=...`

### 1. Quién lo llama

`DashboardComponent.ngOnInit()`, directamente mediante `axios.get`, cuando se inicializa `/dashboard` después del login o al abrir esa ruta. No hay servicio de tareas ni guard de ruta.

Lee `workshop_token`, parsea `workshop_user` desde `localStorage` y solo después comprueba el token. Si no hay token y el parseo no falla, navega a `/login` y retorna sin enviar HTTP. Con token truthy, consulta una vez; no hay polling ni botón de reintento.

Fuentes: [dashboard.component.ts:35](../src/app/dashboard/dashboard.component.ts#L35), [app.routes.ts:9](../src/app/app.routes.ts#L9).

### 2. Qué envía: headers, body y query params

| Parte | Nombre | Valor y comportamiento |
|---|---|---|
| Método y URL | GET | Base fija `http://localhost:8000/api/tasks`. |
| Query param | `owner` | Concatena `user.username` o `''` si es falsy. No usa `params` de axios ni codificación explícita del valor; caracteres como `&` pueden alterar la query. |
| Header explícito | `Authorization` | Esquema `Bearer`, un espacio y el token leído de `workshop_token`. |
| Header de biblioteca | `Accept` | Default axios: `application/json, text/plain, */*`. |
| Body | Ninguno | No envía un cuerpo. No configura `Content-Type` para este GET. |
| Opción de transporte | `timeout` | No configura timeout propio; el default local de axios es `0` (sin temporizador de timeout de axios). No hereda los 5000 ms del POST. |

Ejemplo con el usuario y token del fixture de login:

```http
GET http://localhost:8000/api/tasks?owner=test-user
Authorization: Bearer test-token
Accept: application/json, text/plain, */*
```

`test-token` es ficticio y no debe usarse como credencial de un backend. El ejemplo reproduce la concatenación del componente a partir de los valores de [login.component.spec.ts:10](../src/app/login/login.component.spec.ts#L10); no es una captura de tráfico real.

Fuentes: [dashboard.component.ts:36](../src/app/dashboard/dashboard.component.ts#L36), [dashboard.component.ts:43](../src/app/dashboard/dashboard.component.ts#L43), defaults locales de [axios/lib/defaults/index.js](../node_modules/axios/lib/defaults/index.js).

### 3. Qué espera recibir en éxito: estado, campos y ejemplo

**Estado HTTP:** el componente no compara códigos; con axios sin personalizar `validateStatus`, 200–299 resuelven la solicitud. El backend no tiene aquí un código exacto documentado. Un 2xx no asegura un formato válido ni una UI exitosa.

Espera que `response.data` sea **directamente un arreglo de tareas**, no un objeto envolvente con `tasks` o `data`. No valida `Array.isArray` ni un esquema.

| Campo JSON | Forma esperada por el uso | Qué hace el frontend |
|---|---|---|
| Raíz | Arreglo de objetos de tarea | Recorre `length` e índices; conserva el resultado original en `tasks`. |
| `status` | String, opcional en la práctica | Excluye solo el valor exacto `ARCHIVED`. Para otros valores genera una clase `pill-` con el estado en minúsculas y lo traduce según el mapa local. Falsy produce estado vacío. |
| `priority` | Valor comparable y convertible a string; el fixture usa `"high"` | Ordena con comparación JavaScript `>` descendente; no hay ranking semántico de prioridades. En la etiqueta usa mayúsculas o `NORMAL` si es falsy. |
| `owner` | Convertible a string; el fixture usa `"student"` | Se muestra en mayúsculas en la etiqueta, o `SIN-ASIGNAR` si es falsy. No se compara con el usuario para autorizar o filtrar localmente. |
| `title` | Texto para presentación | Interpolado como título de la tarjeta; no hay validación ni texto alternativo. |
| `description` | Texto para presentación | Interpolado como descripción; no hay validación ni texto alternativo. |
| `label` | **Derivado local**, no requerido en la respuesta | Se asigna a cada tarea visible como `PRIORIDAD · PROPIETARIO`. Un `label` recibido se sobrescribe para las tareas no archivadas. |

Ejemplo mínimo con los campos y valores del objeto real de [legacy-format.spec.ts:6](../src/app/utils/legacy-format.spec.ts#L6), colocado en el arreglo que consume dashboard:

```json
[
  {
    "priority": "high",
    "owner": "student"
  }
]
```

**Límite del ejemplo:** es un fixture de utilidad, no una respuesta capturada ni un fixture de integración del endpoint. El código actual permite procesar este objeto sin `status`, `title` ni `description`: produce la etiqueta `HIGH · STUDENT`, con título, descripción y estado sin contenido. No se inventa una tarea completa ni se asegura que el backend permita esas omisiones. Se necesita una respuesta real del servidor para confirmar ese contrato; es una pregunta abierta.

Con una respuesta válida, descarta tareas archivadas, agrega etiquetas y ordena las visibles. El comparador devuelve `-1` si `a.priority > b.priority`, y `1` en cualquier otro caso, incluso prioridades iguales: no debe interpretarse como orden estable garantizado. Los estados `TODO`, `IN_PROGRESS`, `DONE`, `RESUELTO` y `COMPLETED` se muestran como «Por hacer», «En progreso», «Completado», «Resuelto» y «Completado»; otros strings se muestran sin traducción.

Al terminar correctamente, dentro de `NgZone.run` asigna `tasks` y `visibleTasks`, cambia `loading` a false y llama `detectChanges()`. Un arreglo vacío o compuesto solo por archivadas muestra **«No hay tareas para mostrar todavía.»**.

Fuentes: [dashboard.component.ts:7](../src/app/dashboard/dashboard.component.ts#L7), [dashboard.component.ts:31](../src/app/dashboard/dashboard.component.ts#L31), [dashboard.component.ts:46](../src/app/dashboard/dashboard.component.ts#L46), [legacy-format.ts:1](../src/app/utils/legacy-format.ts#L1), [dashboard.component.html:20](../src/app/dashboard/dashboard.component.html#L20).

**Preguntas abiertas:** ¿cuál es el código HTTP exacto de éxito? ¿Qué campos son obligatorios, de qué tipos y con qué valores admitidos? ¿Hay paginación, IDs u otros metadatos? No los consume ni define este cliente; no deben añadirse al contrato por suposición.

### 4. Cómo reacciona ante errores y respuestas inesperadas

En errores dentro del try, selecciona el primer valor truthy entre `error.response.data.detail`, `error.message` y **«No se pudo cargar el dashboard»**. Lo presenta por interpolación en el párrafo de error. Dentro de `NgZone.run` pone `loading = false` y ejecuta `detectChanges()`; oculta la sección de tareas mientras `error` sea truthy.

| Situación | Reacción actual del cliente y de la UI |
|---|---|
| No existe token, con usuario local parseable | No envía GET y navega a `/login`. No establece un mensaje de error de tareas. |
| Token inválido o expirado, o falta de permisos, si el servidor devuelve 401/403 | Catch común: muestra el detalle remoto o mensaje de axios según la prioridad anterior; detiene los indicadores de carga. No elimina la sesión, no refresca token y no redirige. Se conserva el botón Cerrar sesión. |
| Otros rechazos HTTP, incluidos 4xx/5xx | Mismo catch; no hay tratamiento especial por código, reintento ni backoff automático. |
| Red caída, CORS o rechazo de transporte | Muestra el mensaje disponible del error o el alternativo, detiene la carga y no navega. El detalle concreto depende de axios y del navegador. |
| Petición que no termina | No hay timeout propio ni temporizador de axios por defecto. Mientras no resuelva o rechace, `loading` permanece true y la UI muestra los indicadores de carga. Un timeout impuesto por navegador/red que sí rechace entra en el catch común. |
| Respuesta 204 vacía, `data: null` o forma sin `length` utilizable | No hay validador. `null` provoca error al leer `length` y entra al catch; una cadena vacía, un objeto `{}` o `{ tasks: [...] }` pueden saltarse el bucle y mostrarse como lista vacía. No se garantiza detección de respuesta inválida. |
| Elemento null dentro del arreglo o propiedades incompatibles al procesarlo | Accesos como `tasks[i].status` pueden lanzar dentro del try: catch común, mensaje del error de ejecución y carga detenida; no se publica una nueva lista visible completa. |
| Campos ausentes en un objeto de tarea | No se rechaza por esquema: pueden verse textos vacíos y los defaults de etiqueta. La omisión de campos no es prueba de compatibilidad con el servidor. |
| `status` truthy que no es string | Puede pasar el procesamiento inicial y fallar después en el template o en `statusLabel` al usar métodos de string. El catch HTTP no garantiza capturar errores de renderizado posteriores; no hay UI de recuperación específica. |
| JSON malformado en `workshop_user`, usuario parseado como null o acceso a almacenamiento que lanza | La lectura y el parseo ocurren **antes del try**. JSON inválido deja una promesa de inicialización rechazada sin mensaje controlado y puede mantener la carga activa. Un usuario null con token falla al construir la URL dentro del try; aunque establece error, el saludo también accede a propiedades del usuario y puede fallar al renderizar. No hay recuperación fiable específica. |

El cliente no define un esquema de errores remotos ni obliga a que `detail` sea string. Si se recibe un objeto u otro valor truthy, se asigna tal cual; no hay extracción de errores de validación ni un formateador estructurado.

**Salida manual:** Cerrar sesión elimina `workshop_token` y `workshop_user`, conserva `workshop_preferences` y navega a `/login`. No llama a un endpoint de logout, no revoca el token en el servidor y no configura cancelación de una consulta de tareas en curso.

Fuentes: [dashboard.component.ts:35](../src/app/dashboard/dashboard.component.ts#L35), [dashboard.component.ts:43](../src/app/dashboard/dashboard.component.ts#L43), [dashboard.component.ts:65](../src/app/dashboard/dashboard.component.ts#L65), [dashboard.component.ts:74](../src/app/dashboard/dashboard.component.ts#L74), [dashboard.component.html:6](../src/app/dashboard/dashboard.component.html#L6), [dashboard.component.html:13](../src/app/dashboard/dashboard.component.html#L13).

### 5. Notas de seguridad relevantes

- La sesión sigue gestionándose directamente en login y dashboard con `localStorage`; la presencia del token no prueba su validez. No hay verificación de firma o expiración ni un guard de ruta.
- El token viaja en el header Authorization, no en la query. La URL actual es HTTP local sin TLS; no es una configuración apta para producción.
- `owner` procede de un usuario local editable y se concatena sin codificar. El servidor debe decidir qué tareas puede consultar la identidad autenticada; el frontend no demuestra esa autorización.
- Títulos, descripciones, etiquetas, saludo y errores se muestran por interpolación de Angular, no con `[innerHTML]`. El mensaje de error de tareas **sí conserva detalles remotos**; no se le aplicó la sustitución por mensaje genérico de H-04 del login.
- El cierre local no acredita revocación remota ni eliminación de sesiones de otras pestañas. No hay un listener de cambios de almacenamiento que sincronice la sesión.

**Preguntas abiertas de seguridad:** ¿el backend valida Bearer y limita `owner` a la identidad o permisos del token? ¿Qué política CORS aplica? ¿Cómo expira o revoca tokens? Estas garantías no se pueden verificar en los archivos de este frontend.

Fuentes: [dashboard.component.ts:36](../src/app/dashboard/dashboard.component.ts#L36), [dashboard.component.ts:43](../src/app/dashboard/dashboard.component.ts#L43), [dashboard.component.ts:67](../src/app/dashboard/dashboard.component.ts#L67), [dashboard.component.ts:74](../src/app/dashboard/dashboard.component.ts#L74), [dashboard.component.html](../src/app/dashboard/dashboard.component.html).

## Documentos consultados y fuentes de verificación

- [README.md](../README.md): ejecución local, servicios y advertencia del laboratorio. Su mención general a `innerHTML` es histórica; para el comportamiento actual prevalece el código.
- [RETO.md](../RETO.md): lista de casos sembrados; no acredita por sí sola el estado actual de los componentes.
- [HALLAZGOS.md](../HALLAZGOS.md): corrección H-04 y observación previa de actualización visual tras un 401. El seguimiento permanece exclusivamente allí.
- Versión anterior de este documento: flujo legacy a contrastar, no fuente de contratos nuevos.
- Código de [login.component.ts](../src/app/login/login.component.ts), [login.component.html](../src/app/login/login.component.html), [dashboard.component.ts](../src/app/dashboard/dashboard.component.ts), [dashboard.component.html](../src/app/dashboard/dashboard.component.html), [legacy-format.ts](../src/app/utils/legacy-format.ts), [app.routes.ts](../src/app/app.routes.ts) y [main.ts](../src/main.ts): llamadas, condiciones, transformaciones y UI actuales.
- [login.component.spec.ts](../src/app/login/login.component.spec.ts) y [legacy-format.spec.ts](../src/app/utils/legacy-format.spec.ts): procedencia de los ejemplos y expectativas existentes; no sustituyen un contrato confirmado por los backends.
- [package.json](../package.json) y defaults de la instalación local de [axios](../node_modules/axios/lib/defaults/index.js): transporte, serialización, aceptación de estados y timeout por defecto. La versión declarada en el manifiesto no se presenta como verificación de versión instalada.

Solo se actualiza documentación. No se modificó código ni se ejecutaron nuevas pruebas o consultas a los backends para esta actualización.
