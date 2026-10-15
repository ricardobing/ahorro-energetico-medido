# Primer paso con ahorro medido

Prototipo para el reto técnico de Agora Partnerships: recomendarle a un pequeño negocio una primera ecoinnovación, explicarle por qué, y después mostrarle cuánto le ahorró, con la honestidad que permitan sus datos.

> Prototipo para un reto técnico. No es un producto oficial de Kamai. Todos los nombres, montos y datos son ficticios.

## Estado

**Etapa 2 de 5: plan y tests en rojo.**
- La especificación está aprobada.
- Están escritos los tests de los 122 escenarios, y cada uno falla porque la lógica todavía no existe.
- La implementación es la etapa 3.

| Etapa | Estado |
|---|---|
| 1. Especificación OpenSpec | ✅ [`openspec/changes/primer-paso-ahorro-medido/`](openspec/changes/primer-paso-ahorro-medido/) |
| 2. Plan y tests en rojo | 🟥 en curso: [trazabilidad escenario → test](docs/trazabilidad.md) |
| 3. Implementación verificada | — |
| 4. Revisión y publicación | — |
| 5. Video | — |

## Cómo correrlo

Requisito: **Node 22.22 o más** (probado en 22 y 24). No hace falta instalar MongoDB ni Docker.

```bash
npm install
npm run dev        # API :4100 · simulaciones :4110 · web http://localhost:5180 (desde la etapa 3)
npm test           # tests unitarios, de propiedades e integración
npm run trace      # verifica que cada escenario de la spec tenga su test
```

| Comando | Qué hace |
|---|---|
| `npm run typecheck` · `npm run lint` | Tipos estrictos y lint |
| `npm run test:coverage` | Tests con cobertura (dominio: 95 % o más) |
| `npm run build` · `npm run test:bundle` | Versión de producción de la web y su peso (120 KB o menos de JavaScript inicial) |
| `npm run test:e2e` | Recorridos en celular y escritorio con Playwright (`npx playwright install chromium` la primera vez) |
| `npm run ci` | Todo lo anterior, en el orden de la CI |

## Qué hay en el repositorio

| Carpeta | Contenido |
|---|---|
| `openspec/` | La especificación: propuesta, requisitos con escenarios WHEN / THEN, diseño y tareas |
| `packages/domain` | Lógica pura: recomendación, medición del ahorro, agregados con privacidad, perfil asistido, fechas y dinero |
| `packages/fixtures` | Datos del caso y datos sintéticos rotulados |
| `apps/api` | API Node.js + TypeScript (Express 5, MongoDB) |
| `apps/mocks` | Simulaciones de los servicios existentes de Kamai (correo, subtareas con IA, conversión de moneda), con modos de falla |
| `apps/web` | Web React + Vite para celular, con el sistema visual de Kamai |
| `e2e` | Pruebas de punta a punta con Playwright |
| `docs/trazabilidad.md` | Tabla escenario → test, generada por `npm run trace` |

## Qué es real, qué es simulado y qué es sintético

- **Del caso del reto:** las seis facturas de Inés, el plan `plan_552`, la ecoinnovación `eco_118` del anexo y la tabla de 23 panaderías.
- **Simulado:** los servicios existentes de Kamai (mensajería, subtareas con IA, conversión de moneda). Responden con los contratos del anexo y se pueden hacer fallar.
- **Sintético y rotulado:** las facturas de julio a septiembre de la simulación, las otras 22 panaderías (que reproducen la tabla del caso), el negocio nuevo, el catálogo ampliado, los rangos de inversión por país y el factor de CO₂e.
- **IA:** el perfil asistido usa el SDK de OpenAI. En desarrollo va con OpenRouter y un modelo económico, siempre con datos ficticios. Sin clave, la app sugiere por palabras clave.
