# Pruebas de login y consulta de tareas

**Lectura temporal:** los resultados de 75 casos de las primeras secciones corresponden a la ampliación inicial de pruebas. La validación posterior de H-02, con 87 casos y axios 1.20.0, está al final en «H-02: actualización de axios». No reemplaza ni oculta los nueve fallos de producto.

Fecha de ejecución: 19 de octubre de 2026. Contrato de referencia: [ENDPOINTS.md](ENDPOINTS.md). Se amplían únicamente pruebas y documentación; no se cambia código de producción, endpoints, dependencias ni configuración de Vitest.

**Resultado real final: 75 pruebas ejecutadas, 66 aprobadas y 9 fallidas; código de salida 1.** No es una suite aprobada. Los nueve fallos son regresiones explícitas de bugs agrupadas bajo `BUG regressions`, sin `skip`, `todo`, `fails`, filtros de exclusión ni expectativas que validen el defecto como comportamiento correcto.

## Matriz de casos

La tabla separa expectativas correctas de caracterización documentada. Los códigos de error son respuestas simuladas para probar al cliente, no garantías de los backends. La tabla agrupa casos parametrizados; no equivale a contar una fila como una sola prueba.

| flujo | caso | tipo | resultado esperado |
|---|---|---|---|
| Login → tareas → logout | Login válido, guardar sesión, consultar con Bearer y propietario, cerrar sesión | Camino feliz | Request y timeout de login exactos; navegación a dashboard; tareas visibles etiquetadas; archivadas excluidas; logout borra token/usuario y conserva preferencias. Aprobado. |
| Login | Usuario null, undefined, vacío o espacios | Borde | Mensaje de usuario requerido; no HTTP, sesión ni navegación. Cuatro casos aprobados. |
| Login | Contraseña null, undefined, vacía o espacios | Borde | Mensaje de contraseña requerida; no HTTP, sesión ni navegación. Cuatro casos aprobados. |
| Login | Respuesta sin token o data ausente/null | Borde | «El backend respondió sin token.»; sin nueva sesión ni navegación. Cinco casos aprobados. |
| Login | HTTP 204 con body vacío | Borde | Mensaje de respuesta sin token y busy false. Aprobado. |
| Login | Credenciales con espacios | Borde | Se envían originales, con client y timeout 5000; se guarda sesión antes de navegar. Aprobado. |
| Login | Promesa HTTP pendiente | Borde | Limpia mensaje anterior, busy true hasta resolver y luego false. Aprobado. |
| Login | Preferencias guardadas válidas | Borde | Combina tema guardado con defaults restantes. Aprobado. |
| Login | Preferencias JSON malformadas | Error | Conserva defaults y registra error; constructor no aborta. Aprobado. |
| Login | HTTP 401/403 | Error | Mensaje local genérico; no detalla error remoto ni crea sesión. Dos casos aprobados. |
| Login | HTTP 429/500/503 | Error | Mismo mensaje genérico, busy false, sin reintento automático. Tres casos aprobados. |
| Login | Backend caído/red/CORS | Error | Mensaje genérico y busy false. Rechazos simulados de transporte aprobados; no se prueba una política CORS real. |
| Login | Timeout 5000 ms | Error | Ante ECONNABORTED, mensaje genérico, busy false y configuración timeout 5000. Aprobado; no se esperan cinco segundos reales. |
| Login | Detalle HTTP, error.message o error sin campos | Error | Todos convergen en mensaje genérico y registro diagnóstico. Tres casos aprobados. |
| Login | Usuario/detalle con marcado y caracteres especiales | Error | Ningún contenido externo se incluye en el mensaje; plantilla usa interpolación. Aprobado. |
| Login | Fallo de escritura en localStorage | Error | Mensaje genérico, busy false, no navega. Aprobado. No acredita rollback de escrituras parciales. |
| Login | Navegación que rechaza con excepción | Error | Mensaje genérico y busy false. Aprobado. |
| Login | Navegación que resuelve false | Error / regresión | Debe informar que no completó navegación; **falla**, mensaje vacío. H-16. |
| Login | Respuesta con token pero sin usuario | Error / regresión | No debe completar una sesión incompatible; **falla**, navega y persiste usuario ausente. H-15. |
| Login | Error con sesión anterior / reintento válido | Error / recuperación | El rechazo HTTP no borra sesión previa; un siguiente intento válido puede completar login. Aprobado. |
| Tareas | Sin token y usuario parseable | Borde | Navega a login sin consultar. Aprobado. |
| Tareas | Falta usuario guardado | Borde / caracterización | Usa owner vacío y no inventa filtros ni campos. Aprobado. |
| Tareas | Lista vacía / solo ARCHIVED | Borde | loading false, error vacío, lista visible vacía. Dos casos aprobados. |
| Tareas | Mezcla de prioridades y estado archived en minúsculas | Borde / caracterización | Orden por comparación JavaScript, excluye únicamente ARCHIVED exacto. Aprobado; no se impone un ranking semántico nuevo. |
| Tareas | Faltan campos de presentación | Borde / caracterización | Etiqueta NORMAL · SIN-ASIGNAR y estado vacío. Aprobado; obligatoriedad del backend sigue abierta. |
| Tareas | Traducciones de estados conocidos y desconocido | Borde | Mapa documentado, case-insensitive en traducción; desconocido se conserva. Seis casos aprobados. |
| Tareas | Token rechazado 401/403 | Error | Detalle remoto, loading false, sin logout/refresh/redirección automáticos. Aprobado. |
| Login → tareas | Token truthy recién guardado que tareas rechaza con 401 | Error | Envía ese token, muestra detalle de invalidez; no inventa validación JWT local. Aprobado. |
| Tareas | HTTP 429/500/503 | Error | Catch común, sin reintento ni navegación. Aprobado. |
| Tareas | Backend caído/red/CORS | Error | Muestra error.message, detiene carga y solicita actualización de vista. Aprobado mediante rechazo simulado. |
| Tareas | Timeout del transporte | Error | Catch común con mensaje del error y loading false. Aprobado. |
| Tareas | Petición pendiente más de 5000 ms | Borde / caracterización | No inventa timeout: loading sigue true tras 10000 ms virtuales; resuelve al completar la promesa. Aprobado. |
| Tareas | Rechazo sin detail ni message | Error | Usa «No se pudo cargar el dashboard». Aprobado. |
| Tareas | data null / elemento null | Error | Captura excepción de procesamiento, no publica lista parcial, detiene carga y solicita actualización. Dos casos aprobados; no fija texto dependiente del motor JS. |
| Tareas | Body vacío de 204, objeto o wrapper tasks | Error / regresión | Debe informar incompatibilidad, no éxito vacío; **tres fallos**. H-12. |
| Sesión → tareas | JSON local malformado | Error / regresión | Debe recuperar control y detener carga; **falla**, ngOnInit rechaza fuera del try. H-10. |
| Sesión → tareas | Lectura de storage lanza | Error / regresión | Debe informar error controlado; **falla**, inicialización rechaza. H-11. |
| Sesión → tareas | Usuario local null | Error / regresión | Modelo seguro para saludo y error controlado; **falla**, user permanece null. H-13. |
| Tareas | status numérico | Error / regresión | Debe detectar incompatibilidad antes del render; **falla**, publica la tarea. H-14. |
| Utilidad | Tarea null/undefined o sin prioridad/propietario | Borde | SIN-DATOS o defaults de etiqueta. Tres casos nuevos aprobados. |

## Código de los tests implementados

Los archivos enlazados contienen el **código completo ejecutado**, incluidos setup, fixtures, dobles tipados, limpieza y casos parametrizados:

- [login.component.spec.ts](../src/app/login/login.component.spec.ts): 34 pruebas; ampliado con HTTP por código, transporte, timeout, 204, sesión previa, escritura fallida y navegación rechazada.
- [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts): 35 pruebas; nuevo. Contiene flujo entre componentes, consulta, logout, errores y nueve regresiones que fallan.
- [login-template.spec.ts](../src/app/login/login-template.spec.ts): dos pruebas estructurales existentes; no sustituyen un DOM.
- [legacy-format.spec.ts](../src/app/utils/legacy-format.spec.ts): cuatro pruebas; ampliado con null, undefined y defaults.

### Camino feliz entre componentes

Código ejecutado dentro del setup de dashboard (extracto del caso completo enlazado, no pseudocódigo):

```ts
storage.clear();
const post = vi.spyOn(axios, 'post').mockResolvedValue({
  status: 200,
  data: { token: 'flow-test-token', user: { username: 'flow-user', displayName: 'Flow User' } }
});
const tasks = [
  { title: 'Visible task', description: 'Test fixture', status: 'TODO', priority: 'high', owner: 'flow-user' },
  { title: 'Archived task', status: 'ARCHIVED', priority: 'low', owner: 'flow-user' }
];
get.mockResolvedValueOnce({ status: 200, data: tasks });
const login = new LoginComponent(injector.get(Router));
login.username = 'flow-user';
login.password = 'test-password';
await login.login();
expect(navigate).toHaveBeenNthCalledWith(1, ['/dashboard']);
await component.ngOnInit();
expect(get).toHaveBeenCalledExactlyOnceWith(
  'http://localhost:8000/api/tasks?owner=flow-user',
  { headers: { Authorization: 'Bearer flow-test-token' } }
);
expect(component.visibleTasks).toEqual([{ ...tasks[0], label: 'HIGH · FLOW-USER' }]);
```

El caso completo también verifica POST, almacenamiento, actualización de vista y logout. Es integración **entre clases** con almacenamiento compartido y HTTP/Router simulados, no navegación real del router ni E2E.

### Timeout y backend caído

La prueba parametrizada de login ejecuta estos rechazos:

```ts
it.each([
  { name: 'backend unavailable', code: 'ERR_NETWORK', message: 'Network Error' },
  { name: 'CORS or transport failure', code: 'ERR_NETWORK', message: 'Blocked request' },
  { name: '5000 ms timeout', code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' }
])('recovers from $name', async ({ code, message }) => {
  post.mockRejectedValueOnce(Object.assign(new Error(message), { code }));
  await component.login();
  expect(component.message).toBe('No se pudo iniciar sesión. Verifica tus credenciales o inténtalo nuevamente.');
  expect(post.mock.calls[0][2]).toEqual({ timeout: 5000 });
  expectNoSession();
});
```

`expectNoSession` comprueba ausencia de token/usuario y navegación, y busy false. Las pruebas verifican la **reacción** al rechazo de axios y la configuración de timeout; no verifican el temporizador interno del adaptador HTTP ni un servidor caído de verdad.

### Token inválido y errores HTTP de tareas

```ts
it.each([401, 403, 429, 500, 503])('handles HTTP %i without automatic logout or retry', async (status) => {
  get.mockRejectedValueOnce({
    response: { status, data: { detail: 'Request rejected' } },
    message: 'HTTP error'
  });
  await component.ngOnInit();
  expectTaskError('Request rejected');
  expect(storage.getItem('workshop_token')).toBe('test-token');
});
```

`expectTaskError` verifica mensaje, loading false, ausencia de tareas, una llamada a NgZone y detectChanges, ausencia de navegación y una sola consulta. Es la reacción documentada, no se cambia la expectativa para forzar logout cuando el contrato actual no lo hace.

### Regresión de bug: no convertir un defecto en éxito del test

```ts
it('BUG: malformed saved JSON must not escape initialization', async () => {
  storage.setItem('workshop_user', '{invalid');
  await expect(component.ngOnInit()).resolves.toBeUndefined();
  expect(component.loading).toBe(false);
  expect(component.error).not.toBe('');
});
```

Esta prueba **falla** porque la promesa rechaza con SyntaxError. No se reemplazó `resolves` por `rejects` para hacerla pasar. Las demás regresiones siguen la misma política: no aceptan respuesta incompatible como lista vacía, usuario inseguro ni navegación incompleta como éxito. Los bugs están rastreados en [HALLAZGOS.md](../HALLAZGOS.md), H-10 a H-16.

## Entorno, comandos y resultados ejecutados

Directorio de **todos** los comandos:

```powershell
Set-Location 'C:\Users\Usuario\Documents\U19196-moises-daniel-chang-armas\reqflow-workspace\workshop-login-frontend'
```

Vitest 3.2.4 con el entorno Node existente. Angular compiler habilita la importación del componente; las instancias usan Injector con dobles de Router, ChangeDetectorRef y NgZone. No se sustituye la lógica de producción. Cada caso dispone de almacenamiento en memoria aislado; se restauran spies, globals y temporizadores. Ninguna prueba llama a otros componentes del workspace o usa tokens reales.

### Ejecuciones

| Comando / herramienta | Código de salida | Resultado real |
|---|---:|---|
| Runner integrado de VS Code sobre archivos concretos | No proporcionó código | Informó «No tests found»; no se interpretó como ejecución aprobada. Se utilizó el runner del repositorio. |
| `npm run test:coverage` (primera ejecución) | 1 | 75 pruebas: 65 aprobadas y 10 fallidas. Nueve fallos de producto y un error de parametrización del test de lista vacía. Sin reporte final de cobertura en esa ejecución. |
| TypeScript explícito, antes y después del ajuste de fixture | 0 | Sin errores de tipos en los cuatro archivos de pruebas. |
| `npm run test:coverage -- --coverage.reportOnFailure=true --reporter=json --outputFile=coverage\testing-results.json` | **1** | **75 pruebas: 66 aprobadas, 9 fallidas, 0 pendientes.** Cuatro archivos: tres aprobados y uno fallido. Reporte de cobertura generado pese a los fallos. |
| `git --no-pager diff --check` | 0 | Sin errores de whitespace en el diff versionado. No ejecuta tests ni acredita corrección funcional. |

El error del propio test se corrigió usando filas `{ tasks: [] }` y `{ tasks: [...] }` en `it.each`: las filas que eran arreglos se expandían como argumentos y la fila vacía pasaba undefined. Se corrigió el fixture, **no** la expectativa ni producción. Tras repetir quedaron únicamente las nueve regresiones de bugs.

Comando exacto de comprobación de tipos:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit --module ES2022 --target ES2022 --moduleResolution bundler --experimentalDecorators --esModuleInterop --skipLibCheck src\app\login\login.component.spec.ts src\app\login\login-template.spec.ts src\app\dashboard\dashboard.component.spec.ts src\app\utils\legacy-format.spec.ts
```

Para repetir la suite sin reporte de cobertura puede usarse `npm test`; **ese comando no se volvió a ejecutar en esta tarea**, la suite completa se ejecutó mediante `test:coverage`. Sin corregir los bugs, debe devolver 1 por las mismas regresiones. No se propone excluirlas para obtener verde.

### Resultado final por archivo

| Archivo | Aprobadas | Fallidas | Total |
|---|---:|---:|---:|
| login.component.spec.ts | 34 | 0 | 34 |
| login-template.spec.ts | 2 | 0 | 2 |
| dashboard.component.spec.ts | 26 | 9 | 35 |
| legacy-format.spec.ts | 4 | 0 | 4 |
| **Total** | **66** | **9** | **75** |

El runner generó originalmente `coverage/testing-results.json`, ignorado por Git. La ejecución posterior de H-02 limpió ese archivo al regenerar coverage; ya no se enlaza como evidencia disponible. El resultado de 75 casos queda registrado arriba y puede reproducirse con el comando correspondiente sobre aquella versión de las pruebas. El reporte actual de 87 casos se enlaza en el apartado H-02.

### Cobertura real

| Código de producción ejercitado | Líneas | Sentencias | Ramas | Funciones |
|---|---:|---:|---:|---:|
| LoginComponent | 100 % | 100 % | 100 % | 100 % |
| DashboardComponent | 100 % | 100 % | 100 % | 100 % |
| legacy-format.ts | 100 % | 100 % | 100 % | 100 % |
| **Global del proyecto** | **82,82 %** | **82,82 %** | **96,15 %** | **80 %** |

Se supera el 85 % en el código objetivo de login, tareas y utilidad. No se modificó producción en esta tarea. El reporte V8 mide código ejecutado, no la corrección de las aserciones: puede mostrar 100 % aunque haya tests rojos. El 82,82 % global **no** se presenta como cumplimiento del 85 % global; el arranque y las rutas no están cubiertos.

Fuentes: [coverage-summary.json](../coverage/coverage-summary.json) e [informe HTML](../coverage/index.html). No se alteraron umbrales ni se excluyeron archivos para elevar el porcentaje.

## Fallos observados: separados de los casos aprobados

| Referencia de seguimiento | Regresión | Resultado real |
|---|---|---|
| H-10 | JSON guardado malformado | Inicialización rechazada con SyntaxError en vez de recuperación controlada. |
| H-11 | Lectura de storage lanza | Inicialización rechazada con «Storage unavailable». |
| H-12 | Body vacío, objeto vacío o wrapper tasks | Tres fallos: error sigue vacío; parece lista vacía exitosa. |
| H-13 | Usuario guardado null | El modelo sigue siendo null. |
| H-14 | Status numérico | No informa error antes de publicar tarea incompatible. |
| H-15 | Login con token sin usuario | Navega cuando debería impedir completar una sesión rota. |
| H-16 | Router devuelve false | Mensaje sigue vacío aunque no hubo navegación completada. |

Son siete grupos de defectos y nueve casos fallidos. El seguimiento de estados se mantiene únicamente en [HALLAZGOS.md](../HALLAZGOS.md); aquí se registran resultados de ejecución, no aprobaciones de corrección.

## Pendientes y pruebas propuestas — no ejecutadas

- **Corrección de los nueve fallos:** requiere cambios de producción, fuera de la ampliación de tests; no se implementaron ni se marcaron resueltos.
- **Actualización visual tras axios en login:** sigue pendiente automatizar en DOM real el defecto ya observado y registrado en HALLAZGOS. El doble de NgZone/ChangeDetectorRef verifica llamadas, no que un navegador actualice el botón o pinte el mensaje.
- **UI real y plantillas:** se propone ejecutar validaciones, errores, lista vacía y reintento en navegador con respuestas controladas; no se realizó una nueva ejecución de navegador en esta tarea. Las pruebas estructurales de plantilla no sustituyen esta verificación.
- **Integración con backend real:** confirmar códigos HTTP, esquemas, autorización por owner, expiración real y CORS; no ejecutada. Los mocks no acreditan ninguna de esas garantías externas.
- **Temporizador real de axios:** se propone una prueba de adaptador con servidor controlado dentro del ámbito si se requiere verificar el disparo real a los 5000 ms. Aquí solo se simula el rechazo y se comprueba la configuración.
- **Fallos parciales de persistencia y revocación:** no se valida atomicidad ni se inventa un endpoint de logout. Solo se probó la excepción al escribir y el logout local documentado.
- **Build:** no se volvió a ejecutar; no cambió código de producción. Sí se verificaron tipos de todos los tests.

No hay tests omitidos ni pendientes dentro del runner: estos pendientes son verificaciones que todavía no están implementadas o ejecutadas, no pases implícitos.

## Documentos consultados

- [ENDPOINTS.md](ENDPOINTS.md): solicitudes, respuestas, casos borde, errores y límites del comportamiento actual.
- [REGLAS.md](../REGLAS.md): meta de cobertura del código objetivo y reglas del laboratorio.
- [HALLAZGOS.md](../HALLAZGOS.md): línea base de H-04 y riesgo visual residual; se amplía el seguimiento de bugs reproducidos.
- [vitest.config.ts](../vitest.config.ts): descubrimiento de specs, entorno Node y proveedor V8.
- Código y pruebas de [login](../src/app/login/login.component.ts), [dashboard](../src/app/dashboard/dashboard.component.ts), [utilidad](../src/app/utils/legacy-format.ts) y sus specs enlazados arriba.

Los resultados y la cobertura citados proceden de comandos realmente ejecutados en esta tarea. Las propuestas y limitaciones están separadas explícitamente.

## H-02: actualización de axios — 19 de octubre de 2026

Implementación del único item de [PLAN-2.md](../PLAN-2.md), aprobado por el usuario antes de empezar. El estado y la nota de resolución están únicamente en H-02 de [HALLAZGOS.md](../HALLAZGOS.md). No se corrigieron otros items ni se modificaron los componentes, templates, estilos, rutas o gates en esta intervención.

### Diff local y versión

```diff
--- package.json (antes de H-02)
+++ package.json (después de H-02)
@@ dependencies
-    "axios": "0.31.0",
+    "axios": "1.20.0",
```

- `npm ls axios --all` confirmó **0.31.0** en la línea base y **1.20.0** tras instalar. Manifiesto, paquete instalado y lockfile coinciden.
- Se ejecutó `npm install --save-exact axios@1.20.0 --no-audit --no-fund --ignore-scripts`, salida 0. No hubo auditoría que enviara el árbol privado al registro, ni ejecución de scripts de instalación, ni actualización global de dependencias.
- El lockfile previo ya existía sin versionar. La actualización conserva su contenido ajeno a axios. Cambios propios: entrada raíz de axios, axios 1.20.0, proxy-from-env 1.1.0 → 2.1.0 y nuevas entradas anidadas de https-proxy-agent 5.0.1 / agent-base 6.0.2. debug 4.4.3 y ms 2.1.3 conservan versiones y pasan a ser requeridos también por esa cadena, dejando de ser exclusivamente de desarrollo.
- follow-redirects y form-data ya satisfacían los nuevos rangos; no se actualizaron sus versiones por conveniencia.
- npm eliminó inicialmente entradas opcionales de Vitest ajenas a axios del lockfile. Se restauraron esas entradas mediante una transformación JSON por claves desde la copia previa, conservando solo la cadena de cambios anterior. `npm ci --dry-run --ignore-scripts --no-audit --no-fund` terminó con **0**, validando consistencia sin reinstalar todo. Es un ajuste de preservación del lockfile, no una ampliación de alcance.
- Nuevo archivo: [axios-contract.spec.ts](../src/app/utils/axios-contract.spec.ts), **12 pruebas** sobre axios real con adaptador tipado, sin spies de post/get. No requirió adaptar tipos de los specs existentes ni código de producción.

### Evidencia pública de la candidata y seguridad

Se consultaron el [dist-tag latest público](https://registry.npmjs.org/axios/latest), la [publicación estable v1.20.0](https://github.com/axios/axios/releases/tag/v1.20.0), su [guía de migración 0.x → 1.x](https://github.com/axios/axios/blob/v1.20.0/MIGRATION_GUIDE.md) y la [lista pública de avisos del mantenedor](https://api.github.com/repos/axios/axios/security-advisories?per_page=100). No se envió código, credenciales o lockfiles a esos servicios.

La versión estable publicada y ofrecida por latest en la fecha de consulta fue 1.20.0. Las notas advierten de cambios de configuración, errores, XHR y adaptadores; por ello se verificaron contratos reales, no solo mocks. En los avisos públicos consultados no se identificó un parche necesario posterior a 1.20.0 para el flujo usado. Esto **no** certifica ausencia absoluta de vulnerabilidades ni equivale a una auditoría de todas las dependencias transitivas.

| Aviso contrastado | Rango publicado relevante / corrección | Aplicabilidad al cliente |
|---|---|---|
| [GHSA-w9j2-pvgh-6h63 / CVE-2026-42041](https://github.com/axios/axios/security/advisories/GHSA-w9j2-pvgh-6h63) | <=0.31.0 y <=1.15.0; corregido en >=0.31.1 y >=1.15.1 | Gadget de validateStatus, requiere contaminación previa del prototipo. Política HTTP relevante; no se demostró esa condición en esta app. |
| [GHSA-xx6v-rp6x-q39c / CVE-2026-42042](https://github.com/axios/axios/security/advisories/GHSA-xx6v-rp6x-q39c) | <=0.31.0 y <=1.15.0; corregido en >=0.31.1 y >=1.15.1 | Exclusivo de navegador/XSRF; requiere configuración no booleana o contaminación previa. La app no configura withXSRFToken; no se afirma una fuga real. |
| [GHSA-mmx7-hfxf-jppx / CVE-2026-68944](https://github.com/axios/axios/security/advisories/GHSA-mmx7-hfxf-jppx) | <=0.32.0 y >=1.0.0; versiones corregidas >=0.33.0 y >=1.18.0 | Lectura de data heredado en aliases sin body, incluido get. La app usa get, pero no se demostró la contaminación previa requerida. |
| [GHSA-9fr6-4gfg-395g / CVE-2026-101902](https://github.com/axios/axios/security/advisories/GHSA-9fr6-4gfg-395g) | >=0.27.2 y >=1.0.0; correcciones >=0.34.0 y >=1.20.0 | El propio aviso excluye los aliases get/post del camino de método confirmado; no se atribuye explotación a estas llamadas. |
| [GHSA-542g-h47m-68v8 / CVE-2026-101901](https://github.com/axios/axios/security/advisories/GHSA-542g-h47m-68v8) | >=1.13.0; versión corregida >=1.20.0 | HTTP/2 de Node, no el adaptador XHR utilizado en este navegador. No era prueba de una vulnerabilidad del frontend anterior. |

Los rangos de origen se muestran junto a sus versiones corregidas; una expresión sin límite superior en el texto del aviso no significa que su versión parcheada siga afectada. La evaluación diferencia dependencia afectada de condiciones de explotación verificadas, y Node de navegador.

### Caracterización antes y después

Las 12 pruebas nuevas verifican POST transformado a JSON con valores originales, Content-Type/Accept y ausencia de Authorization, timeout 5000, GET con query/Bearer sin body y timeout 0, transformación de respuesta sin wrapper, 204 vacío y aceptación/rechazo de nueve códigos HTTP.

| Ejecución real, desde workshop-login-frontend | Salida | Resultado |
|---|---:|---|
| `npm test -- src/app/utils/axios-contract.spec.ts`, con 0.31.0 antes de instalar | 0 | **12/12 aprobadas**. |
| `npm test -- --reporter=json --outputFile=coverage\h02-before.json`, con 0.31.0 | 1 | **87 casos: 78 aprobados, 9 fallidos**, mismos bugs H-10 a H-16. |
| Primera repetición de caracterización con 1.20.0 | 1 | 11 aprobadas y una fallida: el helper convertía un valor interno undefined en el string `"undefined"` al leer headers. No era un header enviado. |
| `npm test -- src/app/utils/axios-contract.spec.ts`, tras normalizar ausencia de header | 0 | **12/12 aprobadas**. No se cambió la expectativa de GET sin Content-Type; solo se corrigió la lectura para ignorar undefined/null/false, valores que no se envían. |
| `npm run test:coverage -- --coverage.reportOnFailure=true --reporter=json --outputFile=coverage\h02-after.json` | 1 | **87 casos: 78 aprobados, 9 fallidos**, sin nuevas regresiones. |
| TypeScript explícito con los cinco specs | 0 | Compatibilidad de tipos con axios 1.20.0, sin casts ni cambios de componentes. |
| `npm run build` | 0 | Compilación aprobada; desaparece advertencia CommonJS de axios. Persiste la de lodash/merge, fuera de alcance. |
| `npm ci --dry-run --ignore-scripts --no-audit --no-fund` | 0 | Lockfile consistente con manifiesto, sin instalar ni borrar el árbol. |

Comando de tipos:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit --module ES2022 --target ES2022 --moduleResolution bundler --experimentalDecorators --esModuleInterop --skipLibCheck src\app\utils\axios-contract.spec.ts src\app\login\login.component.spec.ts src\app\login\login-template.spec.ts src\app\dashboard\dashboard.component.spec.ts src\app\utils\legacy-format.spec.ts
```

El reporte posterior está en [h02-after.json](../coverage/h02-after.json). La generación de cobertura limpia el directorio coverage: el JSON temporal de línea base y la copia de lockfile se usaron antes de esa limpieza y ya no se conservan; sus conteos fueron leídos y registrados antes. No se presentan como archivos persistentes disponibles.

Fallos antes/después, identificados individualmente: JSON malformado, storage inaccesible, tres cuerpos incompatibles (vacío, objeto, wrapper tasks), usuario null, status numérico, token sin usuario y navigate false. No se modificaron tests de esos bugs ni se ocultaron con filtros o fallos esperados. **La prueba específica de H-02 está verde; la suite global sigue roja.**

Cobertura posterior: login, dashboard y utilidad **100 %** en líneas/sentencias/ramas/funciones; global **82,82 %** de líneas y sentencias, **96,15 %** de ramas y **80 %** de funciones. No se atribuye cobertura a manifiesto/lockfile ni al interior de axios. No cambió producción y se mantiene la cobertura del código consumidor por encima del 85 %; no se afirma cumplimiento de un 85 % global.

### Verificación real en navegador posterior

Se inició el frontend local y respondió HTTP **200**. Se reutilizó la página compartida con recarga de la aplicación actualizada y se interceptaron únicamente las URLs de los dos endpoints. No hubo consultas a backends reales ni acceso a otros proyectos.

- **Login → tareas → logout:** verificados body JSON, client, headers efectivos Content-Type/Accept, ausencia de Authorization en login, GET sin body/Content-Type y con Bearer, tarea visible, archivada excluida, borrado de token/usuario y conservación de preferencias.
- **Login 401, 204 y rechazo de red:** mensajes exactos genérico/sin token, busy false y ausencia de éxito inventado.
- **Timeout XHR real:** se retuvo el POST sin respuesta; el navegador abortó a los **5010 ms**, mostró el error `timeout of 5000ms exceeded` en diagnóstico y dejó mensaje genérico con busy false. No se simuló ECONNABORTED para esta comprobación.
- **Tareas 401 y red fallida:** mostró respectivamente `Token invalid fixture` y `Network Error`; sesión conservada, sin refresh ni redirección nuevos.
- Se usaron eventos click del DOM vía Playwright `dispatchEvent` después de que las acciones click basadas en estabilidad agotaran su espera en la pestaña compartida. No es una prueba de posicionamiento/actionability del ratón; sí recorrió los handlers Angular y el adaptador real de navegador.
- Para los errores de login se disparó después un evento de entrada para comprobar la vista, conforme al riesgo de sincronización ya documentado; también se comprobó el estado del componente sin alterar su lógica. No se corrigió ni se dio por resuelto ese riesgo residual.
- Los adaptadores ficticios de las pruebas unitarias no acreditan CORS, DNS, revocación real ni el temporizador interno; la verificación XHR complementa únicamente las comprobaciones controladas anteriores.

### Límites y cierre del item

La actualización y su caracterización cumplen el alcance aprobado sin cambiar contratos. Las únicas correcciones auxiliares fueron normalizar la lectura de headers en el test y preservar entradas ajenas del lockfile. No se rediseñaron servicios, sesión, errores o validadores. No se realizó npm audit ni se afirma que todas las dependencias estén libres de avisos.

H-02 queda Resuelto por la versión verificada, diff de dependencia, prueba específica verde, build/tipos y navegador. Los nueve bugs preexistentes y los demás hallazgos continúan pendientes, con la suite global explícitamente no aprobada.
