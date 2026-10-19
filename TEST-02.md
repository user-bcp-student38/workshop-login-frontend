# TEST-02 — Resultado de pruebas

- Fecha: 19 de octubre de 2026.
- Inicio reportado por Vitest: 15:56:59.
- Directorio de ejecución: `workshop-login-frontend`.
- Comando: `npm test` (`vitest run`).
- Runner: Vitest 3.2.4.
- Código de salida: **0**.
- Resultado: **25 pruebas aprobadas, 0 fallos**, en **3 archivos**.
- Duración total reportada: **1,16 s**.

## Resultados por archivo

| Archivo | Pruebas aprobadas | Duración |
|---|---:|---:|
| [src/app/login/login-template.spec.ts](src/app/login/login-template.spec.ts) | 2 | 5 ms |
| [src/app/utils/legacy-format.spec.ts](src/app/utils/legacy-format.spec.ts) | 1 | 3 ms |
| [src/app/login/login.component.spec.ts](src/app/login/login.component.spec.ts) | 22 | 20 ms |
| **Total** | **25** | **29 ms de ejecución de pruebas** |

## Salida de la ejecución

```text
> workshop-login-frontend@0.1.0 test
> vitest run

RUN v3.2.4

src/app/login/login-template.spec.ts (2 tests) 5ms — PASS
src/app/utils/legacy-format.spec.ts (1 test) 3ms — PASS
src/app/login/login.component.spec.ts (22 tests) 20ms — PASS

Test Files  3 passed (3)
     Tests  25 passed (25)
  Start at  15:56:59
  Duration  1.16s (transform 133ms, setup 0ms, collect 750ms,
                  tests 29ms, environment 1ms, prepare 536ms)
```

La salida anterior conserva los resultados del runner, normalizando sus indicadores visuales a `PASS`.

## Alcance

Se ejecutó la suite existente sin modificar código. Esta ejecución no incluye medición de cobertura, compilación, comprobación de navegador ni integración con backends reales; no acredita resultados nuevos de esas verificaciones. El seguimiento de hallazgos permanece exclusivamente en [HALLAZGOS.md](HALLAZGOS.md).
