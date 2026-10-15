# Tareas: Primer paso con ahorro medido

> En orden de dependencias. Cada tarea dice cómo se verifica, y cada grupo trae sus propios tests. **Trazabilidad:** el título de cada test de dominio o de API incluye el nombre exacto del escenario que cubre, y el script `npm run trace` (tarea 1.7) falla si algún escenario de `spec.md` no tiene test.

## 1. Base del repositorio

- [ ] 1.1 Crear el monorepo con workspaces de npm (`apps/api`, `apps/web`, `apps/mocks`, `packages/domain`, `e2e`) y `engines.node >= 24`; verificar que `npm install` termina sin errores desde un clon limpio
- [ ] 1.2 Configurar TypeScript estricto (referencias de proyecto), ESLint y Prettier compartidos; verificar que `npm run typecheck` y `npm run lint` pasan sobre los paquetes vacíos
- [ ] 1.3 Configurar Vitest para todos los paquetes, con cobertura (v8) y umbral del 95 % en `packages/domain`; verificar que `npm test` corre y reporta cobertura
- [ ] 1.4 Crear el lanzador de MongoDB local (`mongodb-memory-server` en modo réplica, persistente en `./.data`, o `MONGODB_URI` si existe); verificar con un test que una transacción confirma y otra se revierte
- [ ] 1.5 Crear `npm run dev` (API en 4100, web en 5180 y simulaciones en 4110, en paralelo) y `.env.example` con todas las variables documentadas (incluida la configuración de IA de desarrollo, comentada como «solo desarrollo, por costos»); verificar que levanta y que `GET /health` responde 200
- [ ] 1.6 Crear los Dockerfile de `api`, `mocks` y `web` (etapas, Node 24 con versión fija, nginx para la web) y `docker-compose.yml` con `mongo` en una sola réplica (healthcheck que inicia `rs0`, volumen, sin puerto en el host), healthchecks y dependencias; verificar que `docker compose up --build` levanta todo y que `localhost:5180` y `localhost:4100/health` responden
- [ ] 1.7 Crear `npm run trace`: lee los `#### Scenario:` de `spec.md` y busca cada nombre en los títulos de los tests; verificar que hoy lista todos los escenarios como pendientes y sale con error
- [ ] 1.8 Crear el workflow de GitHub Actions (instalación, lint, tipos, tests, `trace`, build); verificar que corre en local con `npm run ci`
- [ ] 1.9 Escribir el README inicial (requisitos, `docker compose up --build`, `npm install`, `npm run dev`, `npm test`, qué es real, simulado o sintético) y verificar que los comandos documentados funcionan tal cual

## 2. Dominio: fechas, dinero y formatos

- [ ] 2.1 Implementar fechas sin hora (`AAAA-MM-DD`): días inclusivos, comparación, superposición, desplazamiento de un año y meses calendario, con bisiestos; verificar con tests de los escenarios «Meses de distinta duración» y «Zona horaria»
- [ ] 2.2 Implementar dinero en céntimos enteros (multiplicación por tarifa, redondeos a S/ 5 y S/ 10, porcentaje entero); verificar con tests que `1690 × 0.78` da 131820 céntimos exactos
- [ ] 2.3 Implementar formatos por país con `Intl` (`es-PE`: «S/ 1,200», «31 de agosto de 2026»; `es-BO` para Bolivia); verificar con un test del escenario «Monto en Perú»
- [ ] 2.4 Implementar la huella canónica (JSON con claves ordenadas → SHA-256); verificar con un test de propiedades que dos objetos iguales con claves en distinto orden dan la misma huella

## 3. Dominio: medición del ahorro

- [ ] 3.1 Implementar la normalización por factura (días, kWh por día, validez de 20 a 40 días) y la clasificación antes, día del cambio y después; verificar con tests de «Exclusión de la factura del cambio» y «Periodo corto»
- [ ] 3.2 Implementar la línea de base de periodos cercanos (últimas 3 completas, mínimo 2, ponderada por días); verificar que da 58,90 kWh por día para abril a junio de Inés («Periodos cercanos para Inés»)
- [ ] 3.3 Implementar el método interanual (cobertura del 80 % por solapamiento de días, ajuste por tendencia con 2 pares o más, marca «sin ajuste por crecimiento», prioridad de la factura real sobre el historial estimado); verificar con los escenarios sintéticos «Interanual», «Negocio que ya venía creciendo», «Sin pares previos» e «Historial superpuesto con una factura»
- [ ] 3.4 Implementar la variación propia (σ con 4 facturas o más, 3 % si no) y la banda; verificar que σ de Inés es 2,57 % y las bandas son ±5,94 % y ±4,69 % («Variación de Inés»)
- [ ] 3.5 Implementar la clasificación en tres resultados con sus motivos (`NO_IMPLEMENTATION_DATE`, `NO_AFTER_BILL`, `NOT_ENOUGH_BASELINE`, `WITHIN_NOISE`, `HIGH_SEASON`); verificar con los escenarios «Inés hoy», «Sin factura posterior», «Línea de base insuficiente», «Solo agosto», «Agosto y septiembre», «Tres facturas sin cambio claro» y «Diciembre de una panadería»
- [ ] 3.6 Implementar la valorización a la tarifa vigente, el rango y el efecto de la tarifa; verificar 3,66 kWh por día, 109,7 kWh y S/ 92,11 por mes, y una suba de tarifa del 7,7 % («Ahorro de Inés valorizado», «Efecto de la tarifa»)
- [ ] 3.7 Implementar los textos para la usuaria (frase principal, rango, línea del método, nota de tarifa, «todavía no» por motivo, fecha estimada de la próxima factura); verificar con «Resultado medido de Inés», «Todavía no» y «Próxima factura»
- [ ] 3.8 Escribir tests de propiedades: permutar facturas, cambiar tarifas (los kWh no cambian), no contar días dos veces, banda no negativa, misma huella con los mismos datos; verificar con `fast-check` y 1.000 casos por propiedad («Orden de carga», «Mismos datos»)
- [ ] 3.9 Escribir el test de regresión «La resta simple ya no engaña» y «Febrero contra enero» con las seis facturas del caso; verificar que ningún resultado contiene «ahorraste» sin `MEASURED`

## 4. Dominio: recomendación

- [ ] 4.1 Implementar los filtros duros con motivos (objetivo, sector, equipo, presupuesto, horas, complejidad por nivel, plan existente); verificar con «El aislamiento térmico queda excluido para Inés», «Equipo que el negocio no tiene», «Sector del catálogo» y «Dato de equipo desconocido»
- [ ] 4.2 Implementar los rangos por país (compatible, con penalización, excluido); verificar con «Inversión con los rangos de referencia de Perú (sintéticos)» y «Horas por semana»
- [ ] 4.3 Implementar el puntaje con contracción, penalizaciones y desempate; verificar el orden y los puntajes 2,08, 1,80 y 0,66 («Orden para Inés con los datos del caso»), «Un caso único no domina», «Efecto que no se vería en la factura» y «Empate»
- [ ] 4.4 Implementar la explicación por motivos con las reglas de privacidad; verificar con «Explicación para Inés», «Sin efecto de pares por debajo del umbral» y «Sin dinero inventado»
- [ ] 4.5 Implementar la recomendación sin facturas (σ por defecto, sin el motivo de equipo si falta el dato); verificar con «Negocio nuevo con respuestas (sintético)» y «Negocio nuevo sin respuestas»

## 5. Dominio: agregados con privacidad

- [ ] 5.1 Implementar los agregados con umbral (5 negocios con número, 3 o 4 con texto, menos de 3 nada) y la supresión complementaria; verificar con «Panaderías por ecoinnovación» y «Supresión complementaria»
- [ ] 5.2 Implementar la exclusión de combinaciones y el desglose por evidencia, método y moneda; verificar con «Dos ecoinnovaciones a la vez (sintético)» y «Informe con ambos tipos de dato (sintético)»
- [ ] 5.3 Implementar las frases para la usuaria sobre otros negocios; verificar con «El caso único nunca se muestra» y «Frase cualitativa»

## 6. Dominio: validación del perfil asistido

- [ ] 6.1 Definir las listas cerradas (subconjunto de CIIU para mipymes con su etiqueta, equipos, tipos de horno) y el esquema JSON estricto de la respuesta del modelo; verificar que el esquema rechaza propiedades extra
- [ ] 6.2 Implementar la verificación de sugerencias: solo valores de las listas, y montos y horas solo si aparecen en el texto (normalizando «1200», «1.200», «mil doscientos» no cuenta); verificar con «Monto que no está en el texto», «Descripción sin montos» y «Código fuera de la lista»
- [ ] 6.3 Implementar el extractor por palabras clave (rubros, equipos y sinónimos regionales como refrigeradora, congeladora o heladera; montos y horas con unidades); verificar con «Sin IA» usando la descripción de Inés

## 7. Servicios simulados

- [ ] 7.1 Crear `apps/mocks` en el puerto 4010 con mensajería (`POST /v1/email/send` con `x-api-key`), subtareas (`POST /ia/ecoinnovation/sub-tasks`) y conversión de moneda; verificar con tests que cada contrato del anexo responde como describe el reto
- [ ] 7.2 Agregar los modos de falla controlables (`POST /__control`: 500, demora, 402, 400, rebote con llamada al webhook, conversión caída) y su reinicio; verificar con tests que cada modo se activa y se desactiva

## 8. API: base

- [ ] 8.1 Crear la app Express 5 con id de pedido, registros pino sin datos personales, helmet, validación zod y manejador de errores uniforme; verificar con «Error inesperado» que no se filtran detalles internos
- [ ] 8.2 Crear el adaptador de autenticación (Firebase en Kamai; `X-Demo-User` solo con `DEMO_MODE=true`) con el guardián que impide arrancar en producción con demo; verificar con tests de los dos casos
- [ ] 8.3 Definir los modelos de Mongoose y los índices del diseño; verificar con un test que los índices únicos existen después de arrancar
- [ ] 8.4 Implementar el aislamiento por negocio y los roles; verificar con «Factura de otro negocio» (404) y «Aliado que pide una factura» (403)
- [ ] 8.5 Implementar la respuesta 503 ante MongoDB caído; verificar con «Guardar una factura sin base de datos» deteniendo el servidor en memoria

## 9. API: facturas, fotos e historial

- [ ] 9.1 Implementar `POST /uploads` con límites de tipo, tamaño y cantidad; verificar con «Archivo no permitido» y «Tercera foto»
- [ ] 9.2 Implementar `POST /user-bill` con los campos del anexo, `totalCost` y `co2Equivalent` calculados, moneda por país y evidencia; verificar con «Factura de febrero del anexo», «Moneda de Inés», «Factura con foto correcta» y «Factura sin foto»
- [ ] 9.3 Implementar el chequeo de superposición por servicio dentro de una transacción; verificar con «Superposición de luz», «Luz y agua del mismo mes» y un test de dos envíos simultáneos donde solo uno se guarda
- [ ] 9.4 Implementar las validaciones de valores y la confirmación de atípicos; verificar con «Fechas invertidas», «Tarifa fuera de rango» y «Un cero de más»
- [ ] 9.5 Implementar `PATCH` y `DELETE` con versiones y borrado lógico, y el reemplazo de foto sin recalcular; verificar con «Editar», «Borrar» y «Reemplazar la foto después»
- [ ] 9.6 Implementar `PUT /consumption-history` (12 meses como máximo, estimados, sin crear facturas); verificar con «Historial cargado (sintético)»

## 10. API: planes y subtareas

- [ ] 10.1 Implementar `GET /user-eco-card/:id` con `stalled`, `implementedAt` y eventos; verificar con «Plan de Inés estancado» con la fecha 2026-07-10
- [ ] 10.2 Implementar `PATCH` con pausa, reanudación, completado con `implementedAt` y registro de eventos; verificar con «Pausar y reanudar», «Reabrir no borra la implementación», «Completar sin fecha», «Fecha futura» y «Completar con fecha»
- [ ] 10.3 Implementar las ideas por paso con el servicio de subtareas (10 s, 402, error) y su guardado; verificar contra las simulaciones con «Sin cupo», «Servicio caído o lento» y «Sin consumo automático»

## 11. API: medición y recálculo

- [ ] 11.1 Implementar `GET /user-eco-card/:id/savings` sobre el dominio, con `display` incluido; verificar de punta a punta con las facturas del caso y las sintéticas de agosto y septiembre que el resultado coincide con los escenarios del grupo 3
- [ ] 11.2 Implementar el recálculo ante cambios de facturas, historial o `implementedAt`, con versión y huella; verificar con «Factura editada» y «Borrar una factura posterior (sintético)»
- [ ] 11.3 Implementar el aviso de recálculo cuando cambia una cifra ya mostrada; verificar con «Corrección de una factura»

## 12. API: recomendación y superficies

- [ ] 12.1 Cargar `peerStats` desde la tabla del caso (rotulada `case_table`) y el catálogo con `targetEquipment`; verificar que los totales coinciden con la tabla (29 elecciones, 20 completadas, 12 con facturas)
- [ ] 12.2 Implementar `GET /first-step` y la persistencia con estados vigente y reemplazada; verificar con «Consulta repetida sin cambios» y «Registro auditable»
- [ ] 12.3 Implementar `POST /first-step/decision`; verificar con «Aceptar», «Elegir otra» y «¿Por qué esto?»
- [ ] 12.4 Implementar los disparadores de recálculo; verificar con «Cambio de presupuesto» y «Sin cambios en el resultado»
- [ ] 12.5 Implementar `GET /catalog` con la recomendación fijada, los tres primeros para el diagnóstico y `GET /welcome-email/preview`; verificar con «Catálogo», «Diagnóstico por etapas» y «Correo de bienvenida»

## 13. API: perfil asistido con IA

- [ ] 13.1 Crear el adaptador de IA con el SDK `openai` (URL base y modelo por variables de entorno, `response_format` con esquema JSON estricto, preferencias de OpenRouter `require_parameters` y `data_collection: "deny"`, espera de 10 s); verificar con un servidor HTTP falso que el pedido sale con el esquema y las preferencias
- [ ] 13.2 Implementar `POST /profile/assist` con la verificación del dominio, la alternativa por palabras clave, el aviso de primer uso y el límite de 20 por día; verificar con respuestas grabadas «Descripción de Inés», «Modelo lento» y «Límite superado»
- [ ] 13.3 Implementar `PATCH /profile` con la confirmación y el recálculo de la recomendación; verificar con «Corrección antes de confirmar»
- [ ] 13.4 Verificar la privacidad con «Primer uso» y «Registros»: el texto de la descripción no aparece en ningún registro
- [ ] 13.5 Crear `npm run eval:profile` (necesita clave, fuera de CI): 40 descripciones sintéticas con su respuesta correcta; mide aciertos por campo, costo y demora, y guarda el informe en `eval/`. Verificar que sin clave termina con un mensaje claro

## 14. Avisos, correos y workers

- [ ] 14.1 Implementar `notifications` y sus rutas; verificar con «Correo caído» (el aviso existe aunque la mensajería falle)
- [ ] 14.2 Implementar la bandeja de salida con clave por persona, plantilla y referencia, y el worker con reintentos; verificar contra las simulaciones con «Error temporal», «Recordatorios de meses distintos», «Mismo recordatorio dos veces» y «Error permanente»
- [ ] 14.3 Implementar el webhook de rebote y la supresión; verificar con «Correo rebotado»
- [ ] 14.4 Implementar el recordatorio por ciclo (sin repetir periodo); verificar con «Factura de agosto que no llega»
- [ ] 14.5 Implementar el job de estadísticas de pares (excluye combinaciones) y los eventos del embudo; verificar con «Recorrido completo (sintético)»

## 15. Reportes

- [ ] 15.1 Implementar `GET /savings/report`; verificar con «Reporte con resultado medido (sintético)» y «Reporte sin resultado»
- [ ] 15.2 Implementar `GET /partners/report` con agregados, evidencia, método, monedas y USD con alternativa; verificar con «Informe del trimestre (sintético)» y «Conversión caída»
- [ ] 15.3 Implementar el cierre de periodo y los ajustes; verificar con «Corrección después del cierre (sintético)»

## 16. Datos de prueba y modo demostración

- [ ] 16.1 Crear la carga inicial: Inés (perfil, diagnóstico, seis facturas, `plan_552`), catálogo con las 5 ecoinnovaciones del caso más 8 sintéticas, 22 panaderías sintéticas que reproducen la tabla y un negocio nuevo; verificar con un test que los agregados de la carga coinciden con la tabla del caso
- [ ] 16.2 Implementar el reloj de demostración (2026-07-10) y «Simular el paso del tiempo» (julio, agosto y septiembre sintéticos); verificar que el resultado pasa de `NO_IMPLEMENTATION_DATE` a `WITHIN_NOISE` y después a `MEASURED`
- [ ] 16.3 Implementar el panel de demostración («Ver como», modos de falla de las simulaciones, bandeja de correos); verificar que no se monta fuera de `DEMO_MODE`
- [ ] 16.4 Documentar en el README el guion de prueba de 8 pasos para quien evalúa; verificar siguiéndolo en una instalación limpia

## 17. Web: base, sistema visual y navegación

- [ ] 17.1 Crear la app React + Vite + TypeScript con los tokens de Kamai en Tailwind v4, Mona Sans servida desde el proyecto y el rótulo de prototipo; verificar el contraste de cada par texto-fondo con un test (AA)
- [ ] 17.2 Construir el shell (`/impeccable layout`): barra lateral de 248 px con grupos, pestañas de 56 px abajo en 900 px o menos, cortes en 1100, 900, 760 y 400, un solo `<nav>` y enlace para saltar al contenido; verificar con «Celular», «Computadora» y capturas a 390 y 1440 px
- [ ] 17.3 Configurar TanStack Query, el manejo de errores de la API (mensajes del servidor), el estado sin conexión y la PWA con la estructura en caché; verificar con un test de componente que un 503 muestra el mensaje y conserva el formulario
- [ ] 17.4 Configurar el chequeo del peso del bundle (120 KB o menos de JavaScript inicial comprimido) en CI; verificar con «Peso de la aplicación»

## 18. Web: pantallas de Inés

- [ ] 18.1 «Tu primer paso»: recomendación, motivos, lo que no sabemos, pausa del plan estancado, «¿Por qué esto?» y «Prefiero otra»; verificar con tests de componente y el escenario «Plan de Inés estancado» en pantalla
- [ ] 18.2 «Tu plan»: pasos, ideas a pedido con sus mensajes de falla, «Terminé» con fecha y la factura que confirmará el resultado; verificar con tests de componente de 402 y demora
- [ ] 18.3 «Subir factura»: compresión y revisión de calidad en el teléfono, formulario con validaciones del servidor, confirmación de atípicos, borrador sin conexión y reintento; verificar con «Foto oscura o movida», «Foto chica», «Foto grande» y «Corte de conexión»
- [ ] 18.4 «Tu ahorro» con la estructura elegida en la ronda de diseño: los tres resultados, la línea del método, la nota de la tarifa aparte, el gráfico SVG de kWh por día con la franja de lo normal y el aviso de recálculo; verificar con tests de componente de los tres estados
- [ ] 18.5 «Mis facturas» (lista, editar, borrar con aviso), «Avisos» y «Tu reporte» imprimible (estilos de impresión); verificar con tests de componente y una captura de impresión
- [ ] 18.6 «Negocio nuevo» con el perfil asistido (aviso de privacidad, sugerencias marcadas por origen, confirmación) y la carga del historial del recibo; verificar con tests de componente de las dos fuentes de sugerencias

## 19. Web: informe para aliados

- [ ] 19.1 Pantalla de escritorio del informe: resultados, celdas ocultas con su leyenda, medido separado de declarado, monedas y USD, y cierre de periodo; verificar con tests de componente y una captura a 1440 px

## 20. Verificación integral

- [ ] 20.1 e2e con Playwright en 390 px con red lenta simulada: primer paso → aceptar → completar → simular el tiempo → «Tu ahorro» medido; verificar que pasa y que el control de accesibilidad no tiene violaciones graves
- [ ] 20.2 e2e: perfil asistido sin IA (simulación caída) y factura con foto oscura guardada igual; verificar que pasa en 390 px
- [ ] 20.3 e2e: aliado en 1440 px ve el informe con celdas ocultas y no puede abrir datos de un negocio; verificar que pasa
- [ ] 20.4 Revisión de diseño: correr `impeccable detect` sobre la web, corregir lo mecánico, revisión final con `impeccable-finish-reviewer` y `DESIGN.md` con `impeccable-documenter`; verificar que la revisión termina en `ship`
- [ ] 20.5 Prueba de humo con Docker: `npm run smoke:docker` construye, levanta el `compose` con la carga inicial, espera los healthchecks y corre el recorrido e2e 20.1 contra `localhost:5180`; verificar que pasa y que `docker compose down -v` deja todo limpio
- [ ] 20.6 Correr `npm run ci` completo (lint, tipos, tests con cobertura, `trace` sin escenarios pendientes, build, peso y e2e); verificar que todo pasa en verde con un solo comando

## Workflow follow-up

- Revisión de código y aprobación antes de publicar.
- Crear el repositorio público en GitHub, subir la rama y verificar los enlaces en una ventana de incógnito.
- Archivar el cambio con `openspec archive primer-paso-ahorro-medido` después de la revisión y verificar que la spec queda en `openspec/specs/`.
