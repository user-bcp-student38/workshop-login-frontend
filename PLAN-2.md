# Propuesta de corrección

Documento de planificación: no autoriza ni ejecuta cambios de código o dependencias. Se interpreta la referencia solicitada **H-2** como **H-02**, el ID existente en [HALLAZGOS.md](HALLAZGOS.md). El seguimiento continúa exclusivamente en esa matriz.

## Item: H-02 — Dependencia declarada axios 0.31.0

### Identificación y alcance

- Estado actual: **Pendiente**; tipo **Sugerencia**, severidad **media**.
- Evidencia: [package.json:19](package.json#L19) declara axios `0.31.0`. Lo consumen directamente [login.component.ts:41](src/app/login/login.component.ts#L41) y [dashboard.component.ts:43](src/app/dashboard/dashboard.component.ts#L43).
- El hallazgo exige verificar avisos aplicables y compatibilidad antes de actualizar o sustituir la dependencia. La versión declarada, por sí sola, no demuestra una vulnerabilidad ni identifica la versión efectivamente instalada.
- Alcance elegido: **evaluar y actualizar axios a una versión estable exacta y verificada**, manteniendo la biblioteca y su API de consumo. No migrar a HttpClient ni extraer servicios en esta intervención: eso ampliaría H-05 y cambiaría el mecanismo de errores y transporte innecesariamente.
- No corregir lodash, almacenamiento de sesión, mensajes de tareas, validación de esquemas, navegación cancelada ni los bugs H-10 a H-16. No modificar las expectativas de sus regresiones para obtener una suite verde.

### Cambio propuesto

1. **Establecer la línea base antes de instalar:** contrastar manifiesto, lockfile existente y árbol instalado (`npm ls axios --all`), registrar versiones y ejecutar las pruebas actuales. El lockfile está presente y no versionado en el estado inspeccionado; conservarlo y revisar su contenido previo, sin regenerarlo a ciegas.
2. **Verificar la candidata:** consultar los avisos públicos de axios y sus notas de migración/publicación. Registrar fecha, versión afectada/corregida, identificador de aviso y aplicabilidad al navegador frente a Node; no confundir un aviso de adaptador Node con una explotación del frontend. No se fija aquí una versión por suposición ni se promete ausencia absoluta de vulnerabilidades.
3. Elegir una versión estable exacta compatible con el Node y TypeScript del proyecto, sin avisos conocidos aplicables pendientes en la fecha de verificación. Si ninguna satisface esas condiciones, registrar el bloqueo en H-02 y solicitar decisión; no sustituir axios o cambiar el contrato sin autorización.
4. **Escribir y ejecutar primero las pruebas de caracterización descritas abajo**, todavía con la dependencia anterior.
5. Actualizar exclusivamente axios mediante el gestor existente: `npm install --save-exact axios@<version-verificada>`, sustituyendo el marcador por la versión realmente evaluada. Revisar el diff de manifiesto y lockfile y limitar cambios transitivos a los derivados de axios; no usar `npm update` global ni `npm audit fix --force`.
6. Mantener intactas las llamadas actuales. Si el cambio de tipos o empaquetado exige una adaptación mínima de imports o dobles tipados, hacerla solo con evidencia de compilación y sin casts inseguros. Una reescritura de componentes, un cambio de adaptador con efectos funcionales o una alteración de contrato requiere revisar el plan, no una excepción silenciosa.
7. Repetir caracterización, suite, cobertura, comprobación de tipos y build. Registrar los avisos reales y las diferencias de versión sin ocultar resultados previos. Actualizar documentos directamente afectados por la versión/defaults y el resultado de H-02 únicamente después de verificar.

No se agregan bibliotecas nuevas de aplicación ni de testing. Los cambios transitivos propios de la actualización deben quedar justificados por el lockfile.

### Contrato que no debe cambiar

Según [docs/ENDPOINTS.md](docs/ENDPOINTS.md):

| Superficie | Invariante a verificar |
|---|---|
| Login | POST a `http://localhost:8080/auth/login`; body con username/password originales y client `angular-workshop`; JSON, Accept actual, sin Authorization añadido y timeout de 5000 ms. |
| Respuesta de login | Body en `response.data`, sin wrapper nuevo; condición de token actual, mensaje de respuesta sin token, persistencia y navegación en el mismo orden. No introducir validadores nuevos dentro de H-02. |
| Tareas | GET a `http://localhost:8000/api/tasks?owner=` concatenado como hoy; header Authorization con esquema Bearer y token local; sin body ni timeout propio. No codificar owner como corrección oculta. |
| Estados HTTP | Aceptación 200–299 por defecto; rechazos HTTP disponibles para el catch con `response.data`; 204 tratado según el body y la lógica actuales, sin convertirlo en éxito funcional inventado. |
| Errores | Login conserva mensaje genérico y restablece busy. Tareas conserva prioridad detail → message → alternativo y actualización de loading/vista; sin logout, refresh ni reintentos nuevos. |
| Vista y sesión | Filtrado, comparación de prioridades, etiquetas, claves de almacenamiento y logout local sin endpoint remoto se mantienen. |

Los mensajes predeterminados que genere axios para errores de transporte pueden variar entre versiones. Si esa diferencia llega a la UI de tareas, debe compararse y explicitarse antes de aceptar la candidata; no se cambiará el mensaje del cliente ni la documentación para ocultar una incompatibilidad.

### Archivos previstos

| Archivo | Intervención prevista y límite |
|---|---|
| [package.json](package.json) | Sustituir solo la versión de axios por la versión exacta verificada. No modificar scripts o demás dependencias por conveniencia. |
| [package-lock.json](package-lock.json) | Actualizar con npm y revisar únicamente axios y su árbol transitivo afectado. Respetar cambios previos; el archivo aún no está versionado. |
| [src/app/login/login.component.spec.ts](src/app/login/login.component.spec.ts) | Ampliar caracterización de headers/cuerpo y datos de error si falta; ajustar tipos de mocks solo cuando la nueva API lo requiera. |
| [src/app/dashboard/dashboard.component.spec.ts](src/app/dashboard/dashboard.component.spec.ts) | Verificar Bearer, query, ausencia de timeout propio y formas de error. Conservar las nueve regresiones fallidas existentes. |
| `src/app/utils/axios-contract.spec.ts` (nuevo) | Probar la configuración y transformación de solicitudes de axios real mediante un adaptador de prueba tipado; no reemplazar axios.post/get por spies en estos casos. |
| [src/app/login/login.component.ts](src/app/login/login.component.ts) y [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts) | **Solo condicionalmente:** compatibilidad mínima de import/tipos si una validación demuestra que hace falta. La propuesta base no cambia estos archivos. |
| [docs/ENDPOINTS.md](docs/ENDPOINTS.md) | Actualizar referencias a versión/defaults internos únicamente si cambian sus ubicaciones; mantener contrato y comportamiento descritos. Si se detecta una diferencia de contrato, detenerse en lugar de reescribirlo para aceptarla. |
| [docs/TESTING.md](docs/TESTING.md) | Añadir pruebas y resultados reales antes/después, versiones, códigos de salida y límites de mocks. |
| [HALLAZGOS.md](HALLAZGOS.md) | Registrar en H-02 versión adoptada, avisos contrastados y verificaciones; no cerrar otros items. Si hay bloqueo, mantener Pendiente y explicarlo. |

No se tocan templates, estilos, rutas, utilidades de formato, reglas del laboratorio ni configuración global de cobertura.

### Prueba de caracterización que se escribe antes de cambiar la dependencia

Las pruebas actuales simulan axios.post/get y ya verifican requests y reacción de componentes. Eso **no detecta** cambios en serialización, defaults, selección de adaptador o construcción interna de errores de la biblioteca real. Añadir:

| Caso previo | Qué se prueba y resultado esperado |
|---|---|
| POST real de axios con adaptador de prueba sin red | Capturar config después de transformar el request: body JSON con los tres campos exactos, Content-Type JSON, Accept actual, timeout 5000 y sin Authorization incorporado. Usar valores inertes, no credenciales del laboratorio. |
| GET real de axios con adaptador de prueba | URL con query concatenada, header Bearer preservado, sin body y timeout efectivo 0 por defecto. La representación interna de headers puede cambiar; verificar valores efectivos, no la clase interna de headers. |
| Política de estados y transformación de respuesta | Comprobar validateStatus para 200/201/204 y 400/401/403/429/500; transformación de JSON de login/tareas sin wrapper nuevo y 204 vacío. Aclarar que un adaptador ficticio que resuelve cualquier status no prueba por sí solo el rechazo del adaptador de navegador. |
| Errores que consumen los componentes | Añadir o reutilizar escenarios explícitos de 401 con response.data.message/detail, backend no disponible y timeout: mensajes, busy/loading y persistencia iguales a la línea base. No exigir igualdad de stack traces ni de detalles irrelevantes. |
| Flujo integrado entre clases | Reutilizar login correcto → tareas → logout y caso de token rechazado. Deben conservar request, sesión y navegación; no acreditar integración externa real. |

El adaptador debe retornar una respuesta tipada compatible con la versión anterior y su migración posterior; no usar `any` para evitar diferencias ni reproducir la lógica del componente en el test. No afirmar que un adaptador simulado ejercita CORS, el reloj de timeout real o el rechazo nativo del adaptador XHR.

**Verificación de navegador posterior necesaria:** con respuestas controladas e interceptadas, comprobar JSON/headers efectivos, 401, red rechazada, 204 y login → tareas → logout. Comprobar timeout del POST reteniendo la respuesta más de 5000 ms y observando el aborto real. No usar adaptador Node como sustituto de esa prueba del frontend. No modificar ni inspeccionar backends ajenos al ámbito. La posible actualización visual tardía ya documentada debe registrarse sin corregirla silenciosamente aquí.

### Validación y cierre previstos

Todos los comandos se ejecutarán desde `workshop-login-frontend`. Son **comandos propuestos, no ejecutados en esta planificación**:

```powershell
npm ls axios --all
npm test -- src/app/utils/axios-contract.spec.ts src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts
npm run test:coverage -- --coverage.reportOnFailure=true
npm run build
git --no-pager diff --check
```

La prueba nueva debe existir antes de ejecutar su selector. Verificar tipos de specs con el comando TypeScript documentado en [docs/TESTING.md](docs/TESTING.md), incorporando el nuevo archivo.

Para obtener evidencia de avisos, preferir consulta de avisos públicos de axios. Si se utiliza `npm audit --audit-level=moderate`, hacerlo solo con autorización para enviar al registro los metadatos de dependencias necesarios; no enviar código, credenciales ni lockfiles privados a servicios externos. No ejecutar correcciones automáticas ni interpretar un código no cero como prueba de que axios es la dependencia afectada. Diferenciar advertencias de otras dependencias, sin incluir su corrección en H-02.

La última ejecución **documentada**, no repetida ahora, registra 75 casos: 66 aprobados y 9 fallidos por H-10 a H-16. Antes de actualizar se debe confirmar una línea base nueva y comparar casos individualmente después; no exigir un verde ficticio, excluir fallos ni usar `.fails`. La validación de H-02 exige que su caracterización y compatibilidad pasen y que no haya regresiones nuevas; la suite global seguirá explícitamente no aprobada mientras persistan los fallos preexistentes.

Meta: cobertura mínima del 85 % del código de producción que se modifique, según [REGLAS.md](REGLAS.md). Si solo se cambia manifiesto/lockfile, no atribuirles cobertura V8; mantener y reportar la cobertura de login/dashboard, probar el transporte y no confundirla con cobertura del código interno de axios. El informe existente de 100 % de esos componentes es histórico, no un resultado nuevo.

Cerrar H-02 solo con versión y avisos verificables, lockfile coherente, caracterización aprobada, build/tipos compatibles, revisión del comportamiento en navegador y ausencia de nuevas regresiones atribuibles a la actualización. Los otros bugs y avisos quedan pendientes y no deben desaparecer del reporte.

### Convenciones y límites

Se aplica la convención de dependencias verificadas de [docs/GOOD_PRACTICES.md](docs/GOOD_PRACTICES.md), sin introducir servicios, configuración o tipado global como alcance adicional. Cualquier adaptación necesaria debe ser tipada, sin duplicar lógica, añadir anidamiento ni nuevos valores mágicos. Actualizar axios no resuelve por sí solo la falta de servicios ni los riesgos de localStorage.

Se consultaron [docs/ENDPOINTS.md](docs/ENDPOINTS.md), [docs/GOOD_PRACTICES.md](docs/GOOD_PRACTICES.md), [HALLAZGOS.md](HALLAZGOS.md), [REGLAS.md](REGLAS.md), [docs/TESTING.md](docs/TESTING.md), el manifiesto y los componentes consumidores; se contrastaron referencias a axios de sus pruebas. En esta tarea **solo se crea PLAN-2.md**: no se ejecutan auditorías, instalaciones ni tests, no se aprueba la implementación y no se altera el backlog.
