# Plan de corrección de H-04

## Alcance y selección

Se selecciona únicamente **H-04**, confirmado por el usuario y marcado **Pendiente** en [HALLAZGOS.md](HALLAZGOS.md). Motivo: el renderizado de mensajes es un cambio acotado que permite retirar la interpretación de HTML dinámico sin cambiar el transporte HTTP ni la política de sesión.

Este documento es una propuesta, no una implementación ni un registro de avances. El seguimiento y los estados permanecen exclusivamente en [HALLAZGOS.md](HALLAZGOS.md); no se cambia su estado. No se incluyen H-01, H-02, H-03 ni H-05 a H-09 como correcciones independientes.

Fuentes: [docs/ENDPOINTS.md](docs/ENDPOINTS.md), [docs/GOOD_PRACTICES.md](docs/GOOD_PRACTICES.md), [REGLAS.md](REGLAS.md) y revisión del componente, plantilla, estilos y configuración de pruebas actuales.

## H-04 — Mensaje dinámico construido como HTML

### Problema y evidencia

- El estado `message` está declarado como `any` en [src/app/login/login.component.ts:19](src/app/login/login.component.ts#L19).
- Las validaciones y la respuesta sin token producen cadenas con etiquetas `strong` en [src/app/login/login.component.ts:34](src/app/login/login.component.ts#L34), [src/app/login/login.component.ts:37](src/app/login/login.component.ts#L37) y [src/app/login/login.component.ts:52](src/app/login/login.component.ts#L52).
- El catch concatena el usuario y un detalle procedente de la respuesta HTTP o del error dentro de HTML en [src/app/login/login.component.ts:55](src/app/login/login.component.ts#L55) y [src/app/login/login.component.ts:56](src/app/login/login.component.ts#L56).
- La plantilla interpreta el resultado mediante `[innerHTML]` en [src/app/login/login.component.html:39](src/app/login/login.component.html#L39).

El riesgo confirmado es mezclar contenido externo y presentación HTML. Angular sanitiza ese binding de forma predeterminada: no se ha demostrado XSS ejecutable ni un bypass. La propuesta no parte de afirmar una explotación.

### Cambio propuesto

1. Mantener `message` como un único estado de presentación, pero tiparlo como `string`. Todas sus asignaciones producirán texto, nunca etiquetas.
2. Sustituir `[innerHTML]="message"` por interpolación de texto en el mismo contenedor, conservando `*ngIf="message"` y la clase `message`. No introducir `DomSanitizer`, `bypassSecurityTrustHtml`, escapes manuales, filtros por expresiones regulares ni un componente nuevo.
3. Mantener los textos de usuario requerido, contraseña requerida y respuesta sin token, retirando únicamente las etiquetas de formato.
4. Para el error de autenticación, mostrar un mensaje local estable, por ejemplo «No se pudo iniciar sesión. Verifica tus credenciales o inténtalo nuevamente». No concatenar el nombre de usuario, `response.data.message` ni `error.message` en la interfaz. Es un cambio intencional de presentación conforme a la convención de no exponer detalles internos; no altera códigos, cuerpos ni headers HTTP. La extracción actual de `backendMessage` deja de ser necesaria.
5. Conservar la señalización del fallo y el registro diagnóstico existente; no convertir excepciones en éxitos ni incorporar registros adicionales de contraseñas, tokens o respuestas completas. El rediseño del logging queda fuera de este cambio.
6. No cambiar estilos salvo que la comprobación visual demuestre un problema causado por retirar las etiquetas. La propuesta base no requiere modificar CSS: el contenedor ya proporciona color, espaciado y altura de línea.

**Cambio visible deliberado:** desaparecen la negrita y el salto de línea generados por las etiquetas; el error remoto se reemplaza por texto local. Se conservan ubicación, visibilidad condicional, estado de carga y posibilidad de reintentar. No se añaden rechazos de respuestas válidas ni nuevas reglas de autenticación.

### Archivos a tocar durante la implementación posterior

| Archivo | Intervención prevista |
|---|---|
| [src/app/login/login.component.ts](src/app/login/login.component.ts) | Tipar `message`, retirar HTML de todas sus asignaciones y sustituir el detalle externo por el mensaje local. |
| [src/app/login/login.component.html](src/app/login/login.component.html) | Reemplazar el binding HTML por interpolación, sin modificar formulario, botón ni navegación. |
| `src/app/login/login.component.spec.ts` (nuevo) | Escribir primero las pruebas de caracterización de lógica y después las expectativas de regresión del cambio aprobado. |
| `src/app/login/login-template.spec.ts` (nuevo) | Comprobar con Vitest y lectura de la plantilla que se usa interpolación en el contenedor y no reaparece un binding HTML; esta prueba estructural no sustituye verificar el DOM real. |
| [HALLAZGOS.md](HALLAZGOS.md) | Actualizar únicamente la fila H-04 cuando la implementación y sus verificaciones estén terminadas, con evidencia real. No actualizarla en esta fase de planificación. |

No se prevén cambios en manifiesto, lockfile, dashboard, utilidad de tareas, rutas, documentación de endpoints ni configuración global de TypeScript. No se crean servicios HTTP o de sesión como requisito oculto de este arreglo.

### Pruebas de caracterización a escribir antes de modificar producción

Usar el Vitest existente. Simular `axios.post`, `Router`, consola y almacenamiento con dobles tipados, sin llamadas reales al backend. Restaurar mocks y globals después de cada caso. No usar credenciales ni tokens reales.

| Caso previo | Qué debe caracterizar en el código actual |
|---|---|
| Inicio y validaciones | Mensaje inicialmente vacío; usuario vacío y contraseña vacía producen sus respectivos mensajes actuales con formato HTML, sin HTTP, persistencia ni navegación. |
| Solicitud en curso | Se limpia el mensaje anterior y `busy` permanece verdadero hasta resolver o rechazar una promesa HTTP controlada. |
| Autenticación correcta | POST exacto a `http://localhost:8080/auth/login`, cuerpo con valores originales y `client: 'angular-workshop'`, timeout 5000; guarda token, usuario y preferencias antes de navegar a `/dashboard`; finaliza con `busy = false`. |
| Respuesta sin token | Muestra el mensaje actual específico, no persiste nueva sesión ni navega y restablece `busy`. |
| Error HTTP y error de red | Documenta la prioridad actual de `response.data.message`, `error.message` y el texto alternativo; caracteriza la cadena HTML generada, la ausencia de navegación y el restablecimiento de `busy`. |
| Reintento | Tras un fallo, una nueva llamada limpia el mensaje y permite completar correctamente el flujo. |

Las expectativas de cadenas HTML y detalles externos registran la línea base; después se actualizarán explícitamente para el cambio de presentación aprobado. No se debe conservar HTML únicamente para que pasen las pruebas anteriores.

**Viabilidad del entorno:** [vitest.config.ts:5](vitest.config.ts#L5) utiliza `environment: 'node'`, no un DOM. Antes de escribir los casos se debe preparar el mínimo arranque de Angular necesario para importar el componente y sus recursos externos, utilizando las bibliotecas ya declaradas; verificar ese montaje con un primer caso. No suponer que `TestBed.createComponent` funciona directamente ni instalar jsdom/happy-dom por defecto. Si el montaje exige una dependencia o configuración adicional, justificarla y acordarla antes de incorporarla; no sustituir el comportamiento del componente por una copia de su lógica.

### Pruebas de regresión y aceptación después del cambio

- Actualizar las expectativas de mensajes: los tres errores locales conservan su contenido textual sin etiquetas y el catch muestra el mensaje genérico aprobado.
- Añadir casos de error con detalle HTTP, error de red y valor ausente: todos muestran el mismo mensaje local, sin contenido externo ni falsos éxitos.
- Usar datos de prueba inertes con caracteres `<`, `>`, `&`, comillas y una etiqueta de formato en el usuario y en el mensaje remoto. Comprobar que no aparecen en el mensaje genérico ni se interpretan como marcado. No hacen falta payloads ejecutables.
- En la prueba de plantilla, verificar el contenedor condicional con interpolación y la ausencia de `[innerHTML]`, sin fijar innecesariamente espacios o formato del archivo.
- Verificar en navegador real la vista vacía, validación y fallo de autenticación: texto visible, ausencia de elementos derivados de datos dinámicos, botón deshabilitado durante la petición y recuperación posterior. Usar un fallo controlado y datos de laboratorio; esta verificación no requiere modificar otros componentes del workspace.
- Repetir el caso correcto para demostrar que se preservan exactamente HTTP, persistencia y navegación. La prueba de plantilla por sí sola no acredita el flujo ni el escape del DOM.

### Contrato funcional y HTTP que permanece intacto

- Se preserva `POST /auth/login`, su host actual, cuerpo, timeout y criterio actual de éxito por presencia truthy de token; no se normalizan las credenciales antes de enviarlas.
- Se preservan las claves y el orden funcional de guardado de token, usuario y preferencias, así como la navegación posterior.
- No se modifica `GET /api/tasks`, su parámetro `owner`, el header de autorización con esquema Bearer, el procesamiento de tareas ni el logout local.
- Se conservan la validación previa a HTTP, el mensaje específico de respuesta sin token y la recuperación de `busy`.
- [docs/ENDPOINTS.md](docs/ENDPOINTS.md) permanece intacto como línea base. La única diferencia planificada respecto de su descripción de presentación es retirar el HTML y dejar de mostrar detalles externos; no es un cambio del contrato HTTP.

### Clean Code y límites de la intervención

La construcción de mensajes sigue siendo responsabilidad de presentación del login y no añade responsabilidades HTTP o de sesión. No se crean abstracciones ni servicios para un único texto. Se elimina la concatenación HTML y la selección anidada de detalles externos, sin introducir duplicación, anidamiento nuevo ni valores de configuración sueltos. Un mensaje local de UI no se trata como URL o clave de almacenamiento.

La extracción general de HTTP y sesión, las URLs y claves ya incrustadas, los demás `any` y el anidamiento existente pertenecen a H-05, H-06, H-08 y H-09. Este arreglo acotado no los empeora ni los declara resueltos. Cumplir globalmente esas reglas requiere seleccionar esos hallazgos en otra iteración, no ampliar silenciosamente H-04.

### Riesgos funcionales y controles

| Riesgo | Control previsto |
|---|---|
| Mostrar literalmente etiquetas antiguas al cambiar solo la plantilla | Retirar el HTML de todas las asignaciones y probar cada rama del componente. |
| Perder información útil para reintentar al ocultar el detalle remoto | Usar un mensaje local accionable y comprobar que el reintento sigue funcionando. |
| Cambiar accidentalmente sesión, HTTP o `busy` al editar el catch | Caracterizar solicitud, persistencia, navegación y finalización antes de tocar código. |
| Suponer protección demostrada por un test de cadenas o de archivo | Complementarlo con inspección de DOM y comportamiento en navegador; no afirmar XSS explotable. |
| Reducir legibilidad visual sin negrita ni salto de línea | Revisar el contenedor existente en navegador antes de considerar cambios adicionales de estilo. |

### Secuencia y validación prevista

1. Escribir y ejecutar las pruebas de caracterización sobre el código original; resolver el montaje de Angular sin alterar producción.
2. Implementar únicamente los cambios de mensaje y plantilla descritos.
3. Actualizar las expectativas deliberadamente afectadas y agregar las pruebas de regresión.
4. Ejecutar `npm test -- src/app/login/login.component.spec.ts src/app/login/login-template.spec.ts`.
5. Ejecutar `npm run test:coverage -- src/app/login/login.component.spec.ts src/app/login/login-template.spec.ts` y revisar el reporte del componente modificado: meta mínima de **85 %** de cobertura del código modificado según REGLAS. No inferirla del porcentaje global; agregar casos si no se alcanza. El reporte V8 no mide la plantilla: verificarla por separado.
6. Ejecutar `npm run build` para validar compilación y plantilla, y realizar la comprobación de navegador indicada.
7. Registrar el resultado real únicamente en H-04 de [HALLAZGOS.md](HALLAZGOS.md), sin cerrar otros hallazgos.

No se han ejecutado estas pruebas ni se afirma que hayan pasado. En esta fase solo se crea PLAN.md; no se modifica código, configuración ni contratos.
