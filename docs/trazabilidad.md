# Trazabilidad escenario → test

Generado por `npm run trace` a partir de `openspec/changes/primer-paso-ahorro-medido/specs/primer-paso-ahorro-medido/spec.md`. Cada escenario de la especificación tiene al menos un test cuyo título es el nombre exacto del escenario.

**Cobertura:** 122 de 122 escenarios con test.

| # | Requisito | Escenario | Tests |
|---|---|---|---|
| 1 | Recomendación vigente única y auditable | Consulta repetida sin cambios | `apps/api/test/recommendation.api.test.ts:14` |
| 2 | Recomendación vigente única y auditable | Registro auditable | `apps/api/test/recommendation.api.test.ts:22` |
| 3 | Exclusión por restricciones del negocio | El aislamiento térmico queda excluido para Inés | `packages/domain/test/recommendation.test.ts:66` |
| 4 | Exclusión por restricciones del negocio | Equipo que el negocio no tiene | `packages/domain/test/recommendation.test.ts:74` |
| 5 | Exclusión por restricciones del negocio | Sector del catálogo | `packages/domain/test/recommendation.test.ts:78` |
| 6 | Exclusión por restricciones del negocio | Dato de equipo desconocido | `packages/domain/test/recommendation.test.ts:88` |
| 7 | Rangos de presupuesto y horas | Inversión con los rangos de referencia de Perú (sintéticos) | `packages/domain/test/recommendation.test.ts:102` |
| 8 | Rangos de presupuesto y horas | Horas por semana | `packages/domain/test/recommendation.test.ts:109` |
| 9 | Orden por probabilidad de completar y efecto contraído | Orden para Inés con los datos del caso | `packages/domain/test/recommendation.test.ts:117` |
| 10 | Orden por probabilidad de completar y efecto contraído | Un caso único no domina | `packages/domain/test/recommendation.test.ts:129` |
| 11 | Orden por probabilidad de completar y efecto contraído | Efecto que no se vería en la factura | `packages/domain/test/recommendation.test.ts:145` |
| 12 | Orden por probabilidad de completar y efecto contraído | Empate | `packages/domain/test/recommendation.test.ts:152` |
| 13 | Explicación con motivos verdaderos | Explicación para Inés | `packages/domain/test/recommendation.test.ts:168` |
| 14 | Explicación con motivos verdaderos | Sin efecto de pares por debajo del umbral | `packages/domain/test/recommendation.test.ts:180` |
| 15 | Explicación con motivos verdaderos | Sin dinero inventado | `packages/domain/test/recommendation.test.ts:186` |
| 16 | Recomendación sin facturas | Negocio nuevo con respuestas (sintético) | `packages/domain/test/recommendation.test.ts:204` |
| 17 | Recomendación sin facturas | Negocio nuevo sin respuestas | `packages/domain/test/recommendation.test.ts:215` |
| 18 | Una sola recomendación en todas las superficies | Catálogo | `apps/api/test/recommendation.api.test.ts:44` |
| 19 | Una sola recomendación en todas las superficies | Diagnóstico por etapas | `apps/api/test/recommendation.api.test.ts:51` |
| 20 | Una sola recomendación en todas las superficies | Correo de bienvenida | `apps/api/test/recommendation.api.test.ts:56` |
| 21 | Recálculo solo ante cambios de entrada | Cambio de presupuesto | `apps/api/test/recommendation.api.test.ts:64` |
| 22 | Recálculo solo ante cambios de entrada | Sin cambios en el resultado | `apps/api/test/recommendation.api.test.ts:79` |
| 23 | La usuaria decide | Aceptar | `apps/api/test/recommendation.api.test.ts:103` |
| 24 | La usuaria decide | Elegir otra | `apps/api/test/recommendation.api.test.ts:115` |
| 25 | La usuaria decide | ¿Por qué esto? | `apps/api/test/recommendation.api.test.ts:133` |
| 26 | Plan estancado y pausa | Plan de Inés estancado | `apps/api/test/plans.api.test.ts:13` |
| 27 | Plan estancado y pausa | Pausar y reanudar | `apps/api/test/plans.api.test.ts:30` |
| 28 | Historial de eventos del plan | Reabrir no borra la implementación | `apps/api/test/plans.api.test.ts:47` |
| 29 | Fecha de implementación al completar | Completar sin fecha | `apps/api/test/plans.api.test.ts:63` |
| 30 | Fecha de implementación al completar | Fecha futura | `apps/api/test/plans.api.test.ts:70` |
| 31 | Fecha de implementación al completar | Completar con fecha | `apps/api/test/plans.api.test.ts:78` |
| 32 | Subtareas con IA opcionales y sin bloqueo | Sin cupo | `apps/api/test/plans.api.test.ts:101` |
| 33 | Subtareas con IA opcionales y sin bloqueo | Servicio caído o lento | `apps/api/test/plans.api.test.ts:117` |
| 34 | Subtareas con IA opcionales y sin bloqueo | Sin consumo automático | `apps/api/test/plans.api.test.ts:131` |
| 35 | Alta de factura con el contrato existente | Factura de febrero del anexo | `apps/api/test/bills.api.test.ts:35` |
| 36 | Días inclusivos y fechas sin hora | Meses de distinta duración | `packages/domain/test/dates-money-format.test.ts:30` |
| 37 | Días inclusivos y fechas sin hora | Zona horaria | `packages/domain/test/dates-money-format.test.ts:37` |
| 38 | Sin superposición por servicio | Superposición de luz | `apps/api/test/bills.api.test.ts:60` |
| 39 | Sin superposición por servicio | Luz y agua del mismo mes | `apps/api/test/bills.api.test.ts:72` |
| 40 | Validación de valores de factura | Fechas invertidas | `apps/api/test/bills.api.test.ts:88` |
| 41 | Validación de valores de factura | Tarifa fuera de rango | `apps/api/test/bills.api.test.ts:98` |
| 42 | Confirmación de valores atípicos | Un cero de más | `apps/api/test/bills.api.test.ts:116` |
| 43 | Moneda por país | Moneda de Inés | `apps/api/test/bills.api.test.ts:139` |
| 44 | Edición y borrado con historial | Editar | `apps/api/test/bills.api.test.ts:148` |
| 45 | Edición y borrado con historial | Borrar | `apps/api/test/bills.api.test.ts:155` |
| 46 | Origen y evidencia de cada factura | Factura con foto correcta | `apps/api/test/bills.api.test.ts:165` |
| 47 | Origen y evidencia de cada factura | Factura sin foto | `apps/api/test/bills.api.test.ts:171` |
| 48 | Revisión de calidad de la foto en el dispositivo | Foto oscura o movida | `apps/web/test/photo-quality.test.ts:25` |
| 49 | Revisión de calidad de la foto en el dispositivo | Foto chica | `apps/web/test/photo-quality.test.ts:36` |
| 50 | Revisión de calidad de la foto en el dispositivo | Reemplazar la foto después | `apps/api/test/bills.api.test.ts:188` |
| 51 | Historial de consumo del recibo | Historial cargado (sintético) | `apps/api/test/bills.api.test.ts:221` |
| 52 | Historial de consumo del recibo | Historial superpuesto con una factura | `packages/domain/test/measurement.test.ts:238` |
| 53 | Perfil asistido desde una descripción libre | Descripción de Inés | `apps/api/test/profile.api.test.ts:24` |
| 54 | Perfil asistido desde una descripción libre | Corrección antes de confirmar | `apps/api/test/profile.api.test.ts:39` |
| 55 | Valores del perfil asistido verificados contra el texto | Monto que no está en el texto | `packages/domain/test/privacy-profile.test.ts:147` |
| 56 | Valores del perfil asistido verificados contra el texto | Descripción sin montos | `packages/domain/test/privacy-profile.test.ts:157` |
| 57 | Valores del perfil asistido verificados contra el texto | Código fuera de la lista | `packages/domain/test/privacy-profile.test.ts:168` |
| 58 | Perfil asistido con alternativa sin IA | Sin IA | `packages/domain/test/privacy-profile.test.ts:207` |
| 59 | Perfil asistido con alternativa sin IA | Modelo lento | `apps/api/test/profile.api.test.ts:52` |
| 60 | Privacidad del perfil asistido | Primer uso | `apps/api/test/profile.api.test.ts:77` |
| 61 | Privacidad del perfil asistido | Registros | `apps/api/test/profile.api.test.ts:89` |
| 62 | Límite de uso del perfil asistido | Límite superado | `apps/api/test/profile.api.test.ts:102` |
| 63 | Comparación en kWh por día | Febrero contra enero | `packages/domain/test/measurement.test.ts:17` |
| 64 | Ningún ahorro sin implementación ni factura posterior | Inés hoy | `packages/domain/test/measurement.test.ts:29` |
| 65 | Ningún ahorro sin implementación ni factura posterior | La resta simple ya no engaña | `packages/domain/test/display.test.ts:66` |
| 66 | Ningún ahorro sin implementación ni factura posterior | Sin factura posterior | `packages/domain/test/measurement.test.ts:37` |
| 67 | Exclusión de la factura del cambio | Julio de Inés (sintético) | `packages/domain/test/measurement.test.ts:46` |
| 68 | Elección del método de comparación | Periodos cercanos para Inés (sintético desde agosto) | `packages/domain/test/measurement.test.ts:58` |
| 69 | Elección del método de comparación | Interanual (sintético) | `packages/domain/test/measurement.test.ts:67` |
| 70 | Elección del método de comparación | Línea de base insuficiente | `packages/domain/test/measurement.test.ts:78` |
| 71 | Ajuste por crecimiento en el método interanual | Negocio que ya venía creciendo (sintético) | `packages/domain/test/measurement.test.ts:97` |
| 72 | Ajuste por crecimiento en el método interanual | Sin pares previos | `packages/domain/test/measurement.test.ts:106` |
| 73 | Temporada alta del rubro | Diciembre de una panadería (sintético) | `packages/domain/test/measurement.test.ts:116` |
| 74 | Banda de ruido propia del negocio | Variación de Inés | `packages/domain/test/measurement.test.ts:138` |
| 75 | Tres resultados posibles | Solo agosto (sintético) | `packages/domain/test/measurement.test.ts:152` |
| 76 | Tres resultados posibles | Agosto y septiembre (sintético) | `packages/domain/test/measurement.test.ts:161` |
| 77 | Tres resultados posibles | Tres facturas sin cambio claro (sintético) | `packages/domain/test/measurement.test.ts:171` |
| 78 | Valorización a la tarifa vigente y efecto de la tarifa aparte | Ahorro de Inés valorizado (sintético) | `packages/domain/test/measurement.test.ts:189` |
| 79 | Valorización a la tarifa vigente y efecto de la tarifa aparte | Efecto de la tarifa | `packages/domain/test/measurement.test.ts:199` |
| 80 | Lo que ve la usuaria | Resultado medido de Inés (sintético) | `packages/domain/test/display.test.ts:37` |
| 81 | Lo que ve la usuaria | Todavía no (sintético) | `packages/domain/test/display.test.ts:56` |
| 82 | Recálculo determinista y versionado | Mismos datos | `packages/domain/test/measurement.properties.test.ts:14` |
| 83 | Recálculo determinista y versionado | Factura editada | `apps/api/test/savings.api.test.ts:42` |
| 84 | Cada día cuenta una vez | Orden de carga | `packages/domain/test/measurement.properties.test.ts:25` |
| 85 | Cada día cuenta una vez | Borrar una factura posterior (sintético) | `apps/api/test/savings.api.test.ts:65` |
| 86 | Aviso de recálculo y una sola cifra vigente | Corrección de una factura | `apps/api/test/savings.api.test.ts:74` |
| 87 | Qué falta y cuándo | Próxima factura | `packages/domain/test/measurement.test.ts:209` |
| 88 | Periodos atípicos | Periodo corto | `packages/domain/test/measurement.test.ts:216` |
| 89 | Avisos dentro de la app como canal principal | Correo caído | `apps/api/test/notifications.api.test.ts:51` |
| 90 | Correos con bandeja de salida y sin duplicados | Error temporal | `apps/api/test/notifications.api.test.ts:61` |
| 91 | Correos con bandeja de salida y sin duplicados | Recordatorios de meses distintos | `apps/api/test/notifications.api.test.ts:73` |
| 92 | Correos con bandeja de salida y sin duplicados | Mismo recordatorio dos veces | `apps/api/test/notifications.api.test.ts:85` |
| 93 | Correos con bandeja de salida y sin duplicados | Error permanente | `apps/api/test/notifications.api.test.ts:94` |
| 94 | Rebotes | Correo rebotado | `apps/api/test/notifications.api.test.ts:108` |
| 95 | Recordatorio de factura por ciclo | Factura de agosto que no llega | `apps/api/test/notifications.api.test.ts:29` |
| 96 | Reporte de ahorro para la usuaria | Reporte con resultado medido (sintético) | `apps/api/test/reports.api.test.ts:22` |
| 97 | Reporte de ahorro para la usuaria | Reporte sin resultado | `apps/api/test/reports.api.test.ts:42` |
| 98 | Informe para aliados solo con datos agregados | Informe del trimestre (sintético) | `apps/api/test/reports.api.test.ts:52` |
| 99 | Umbral de 5 negocios | Panaderías por ecoinnovación | `packages/domain/test/privacy-profile.test.ts:35` |
| 100 | Umbral de 5 negocios | Supresión complementaria | `packages/domain/test/privacy-profile.test.ts:64` |
| 101 | Datos de otros negocios para la usuaria | El caso único nunca se muestra | `packages/domain/test/privacy-profile.test.ts:86` |
| 102 | Datos de otros negocios para la usuaria | Frase cualitativa | `packages/domain/test/privacy-profile.test.ts:91` |
| 103 | Medido separado de declarado | Informe con ambos tipos de dato (sintético) | `apps/api/test/reports.api.test.ts:70` |
| 104 | Montos por moneda y equivalente en USD | Conversión caída | `apps/api/test/reports.api.test.ts:85` |
| 105 | Cierre de periodo del informe | Corrección después del cierre (sintético) | `apps/api/test/reports.api.test.ts:101` |
| 106 | Combinaciones de ecoinnovaciones | Dos ecoinnovaciones a la vez (sintético) | `packages/domain/test/privacy-profile.test.ts:100` |
| 107 | Cada negocio ve solo lo suyo | Factura de otro negocio | `apps/api/test/security.api.test.ts:25` |
| 108 | Rol de aliado | Aliado que pide una factura | `apps/api/test/security.api.test.ts:57` |
| 109 | Errores con formato uniforme | Error inesperado | `apps/api/test/security.api.test.ts:64` |
| 110 | Límites de las fotos de factura | Archivo no permitido | `apps/api/test/bills.api.test.ts:250` |
| 111 | Límites de las fotos de factura | Tercera foto | `apps/api/test/bills.api.test.ts:256` |
| 112 | Base de datos no disponible | Guardar una factura sin base de datos | `apps/api/test/security.api.test.ts:75` |
| 113 | Uso en celular | Pantalla chica | `e2e/tests/ines.spec.ts:13` |
| 114 | Navegación según el ancho | Celular | `e2e/tests/ines.spec.ts:35` |
| 115 | Navegación según el ancho | Computadora | `e2e/tests/escritorio.spec.ts:10` |
| 116 | Accesibilidad | Control automático | `e2e/tests/ines.spec.ts:51` |
| 117 | Accesibilidad | Color de acento | `apps/web/test/tokens.test.ts:19` |
| 118 | Datos móviles limitados | Peso de la aplicación | `apps/web/test/bundle-size.test.ts:15` |
| 119 | Datos móviles limitados | Foto grande | `e2e/tests/ines.spec.ts:66` |
| 120 | Borradores sin conexión | Corte de conexión | `e2e/tests/ines.spec.ts:83` |
| 121 | Idioma y formatos | Monto en Perú | `packages/domain/test/dates-money-format.test.ts:100` |
| 122 | Eventos para medir la meta | Recorrido completo (sintético) | `apps/api/test/reports.api.test.ts:122` |
