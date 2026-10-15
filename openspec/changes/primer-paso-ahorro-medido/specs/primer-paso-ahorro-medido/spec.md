# Spec Delta: primer-paso-ahorro-medido

## Purpose

Recomendar a cada negocio una primera ecoinnovación que pueda completar, explicarle por qué con datos verdaderos y medir después cuánto le ahorró en su factura, con la honestidad que permitan sus datos: para la usuaria y, en conjunto y sin exponer a ningún negocio, para los aliados que financian el programa.

> **Convenciones de lectura.** SHALL y MUST se leen como «DEBE». «La usuaria» es la persona dueña del negocio autenticado. Los escenarios usan los datos del caso: las seis facturas de Inés (enero a junio de 2026), su plan `plan_552` (aislamiento térmico, `eco_071`), el catálogo `eco_118` (burletes) y la tabla de panaderías similares. Lo que no está en el caso se rotula como **sintético**. Salvo que se diga otra cosa, la fecha actual de los escenarios es el **2026-07-10** y la tarifa es la de cada factura.
>
> **Datos de Inés usados en varios escenarios:** Perú (moneda PEN), CIIU 1071 (panadería), nivel de diagnóstico Crecimiento, presupuesto del trimestre S/ 1.200, 4 horas por semana, equipos: horno eléctrico y refrigeración (la iluminación se da por presente en todo negocio).

## ADDED Requirements

### Requirement: Recomendación vigente única y auditable
El sistema SHALL mantener para cada negocio una única recomendación de primer paso vigente, guardada con la ecoinnovación elegida, las alternativas elegibles ordenadas con su puntaje, las excluidas con su motivo, los datos de entrada usados, la versión de las reglas y la fecha. Las recomendaciones anteriores SHALL conservarse marcadas como reemplazadas.

#### Scenario: Consulta repetida sin cambios
- **WHEN** Inés consulta su primer paso dos veces sin que cambie ninguno de sus datos
- **THEN** recibe la misma recomendación, con el mismo identificador y la misma fecha de cálculo

#### Scenario: Registro auditable
- **WHEN** un integrante del equipo de Kamai consulta la recomendación vigente de Inés
- **THEN** ve la ecoinnovación elegida, las alternativas con su puntaje, las excluidas con su motivo, los datos usados (presupuesto, horas, nivel, equipos, estadísticas de pares y su versión) y la versión de las reglas

### Requirement: Exclusión por restricciones del negocio
El sistema SHALL excluir las ecoinnovaciones que no apunten al objetivo declarado, no apliquen al sector, actúen sobre equipos que el negocio no tiene, superen su presupuesto o sus horas, superen la complejidad admitida por su nivel de diagnóstico, o ya estén activas, en pausa o completadas. SHALL registrar el motivo de cada exclusión.

#### Scenario: El aislamiento térmico queda excluido para Inés
- **WHEN** se calcula la recomendación de Inés
- **THEN** «Aislamiento térmico del horno» (`eco_071`) queda excluida
- **AND** sus motivos registrados son: inversión ALTA (más de S/ 2.000) por encima del presupuesto de S/ 1.200, complejidad ALTA por encima de la admitida para el nivel Crecimiento (MEDIA) y plan ya existente

#### Scenario: Equipo que el negocio no tiene
- **WHEN** se evalúa «Calentador solar de agua», que actúa sobre un termo eléctrico, para Inés, que no declaró termo eléctrico
- **THEN** queda excluida con el motivo «actúa sobre un equipo que el negocio no tiene»

#### Scenario: Sector del catálogo
- **WHEN** una ecoinnovación tiene `ciiuCodes` vacío
- **THEN** aplica a todos los sectores
- **AND WHEN** tiene `ciiuCodes` con códigos que no incluyen el del negocio
- **THEN** queda excluida con el motivo «no aplica a tu sector»

#### Scenario: Dato de equipo desconocido
- **WHEN** una ecoinnovación del catálogo no tiene informado sobre qué equipo actúa
- **THEN** no se excluye por equipo y su explicación no usa el motivo de equipo

### Requirement: Rangos de presupuesto y horas
El sistema SHALL traducir los niveles BAJA, MEDIA y ALTA de inversión y de tiempo a rangos de referencia por país, configurables. Un nivel cuyo máximo no supera lo disponible SHALL contar como compatible; uno cuyo mínimo es menor que lo disponible y su máximo lo supera SHALL contar como compatible con penalización; uno cuyo mínimo iguala o supera lo disponible SHALL excluirse.

#### Scenario: Inversión con los rangos de referencia de Perú (sintéticos)
- **WHEN** los rangos de Perú son BAJA hasta S/ 500, MEDIA de S/ 500 a S/ 2.000 y ALTA más de S/ 2.000, y el presupuesto es S/ 1.200
- **THEN** una ecoinnovación de inversión BAJA es compatible
- **AND** una MEDIA es compatible con penalización («puede superar tu presupuesto»)
- **AND** una ALTA se excluye

#### Scenario: Horas por semana
- **WHEN** los rangos de tiempo son BAJA hasta 2 h, MEDIA de 2 a 4 h y ALTA más de 4 h por semana, y la usuaria dispone de 4 h
- **THEN** BAJA y MEDIA son compatibles y ALTA se excluye

### Requirement: Orden por probabilidad de completar y efecto contraído
El sistema SHALL ordenar las elegibles por la probabilidad estimada de que el negocio la complete multiplicada por su efecto esperado, ambos contraídos hacia una referencia conservadora (tasa general de 30 % con peso 5; efecto 0 con peso 3), de modo que pocos casos no dominen el orden. SHALL aplicar las penalizaciones de presupuesto (×0,8) y de efecto no detectable (×0,5).

#### Scenario: Orden para Inés con los datos del caso
- **WHEN** se ordenan las elegibles de Inés con la tabla de panaderías similares
- **THEN** el orden es: «Mantenimiento de burletes y descongelamiento de refrigeradoras» (puntaje 2,08), «Hornear por tandas y apagar el horno entre ellas» (1,80), «Iluminación LED» (0,66)
- **AND** la primera es la recomendación vigente

#### Scenario: Un caso único no domina
- **WHEN** dos ecoinnovaciones pasan los filtros, una con 2 elecciones, 1 completada y 1 medida con −18 %, y otra con 9 elecciones, 7 completadas y 4 medidas con −6 %
- **THEN** la segunda queda primera (2,08 contra 1,61)

#### Scenario: Efecto que no se vería en la factura
- **WHEN** la mediana de una ecoinnovación (LED, −4 %) es menor que el cambio mínimo que se puede distinguir en el negocio con 3 facturas antes y 2 después (4,69 % para Inés)
- **THEN** su puntaje se multiplica por 0,5

#### Scenario: Empate
- **WHEN** dos elegibles tienen el mismo puntaje
- **THEN** queda primero la de menor complejidad, luego la de menor inversión, luego la de mayor probabilidad de completar y, por último, la de menor identificador

### Requirement: Explicación con motivos verdaderos
El sistema SHALL explicar la recomendación con hasta tres motivos, tomados de los factores que la eligieron, y una frase sobre lo que todavía no se sabe. SHALL NOT mostrar montos de inversión ni de ahorro en dinero que el catálogo no tiene, ni datos de otros negocios por debajo del umbral de privacidad.

#### Scenario: Explicación para Inés
- **WHEN** Inés ve su primer paso
- **THEN** ve como motivos: que cabe en su presupuesto y en sus horas, que apunta a sus refrigeradoras, y que «7 de cada 9 panaderías que la eligieron la terminaron»
- **AND** ve la frase «Todavía no sabemos cuánto te va a ahorrar a ti. Lo vamos a medir con tus próximas facturas de luz.»

#### Scenario: Sin efecto de pares por debajo del umbral
- **WHEN** la ecoinnovación recomendada tiene 4 negocios con medición (menos de 5)
- **THEN** la explicación no menciona su porcentaje de cambio (−6 %)

#### Scenario: Sin dinero inventado
- **WHEN** se arma cualquier explicación
- **THEN** no contiene montos de inversión ni de ahorro esperado en moneda

### Requirement: Recomendación sin facturas
El sistema SHALL recomendar a un negocio sin facturas usando el perfil, el diagnóstico y tres datos (rubro, equipos que más consumen, horno eléctrico o a gas), cargados a mano o con el perfil asistido, y SHALL pedirle su última factura de luz como línea de base. Si faltan esos datos, SHALL recomendar igual e invitar a completarlos.

#### Scenario: Negocio nuevo con respuestas (sintético)
- **WHEN** una panadería nueva de Perú, con horno eléctrico y refrigeración, presupuesto de S/ 800 y 3 h por semana, sin facturas, pide su primer paso
- **THEN** recibe una recomendación con su explicación
- **AND** se le pide subir su última factura de luz
- **AND** el cambio mínimo detectable se calcula con una variación por defecto del 3 % (5,48 % con 3 facturas antes y 2 después)

#### Scenario: Negocio nuevo sin respuestas
- **WHEN** un negocio sin facturas no respondió las tres preguntas
- **THEN** recibe una recomendación sin el motivo de equipo y una invitación a contar qué equipos usa

### Requirement: Una sola recomendación en todas las superficies
Las superficies que recomiendan (inicio, catálogo, diagnóstico por etapas y correo de bienvenida) SHALL mostrar la recomendación vigente del negocio y sus alternativas en el mismo orden.

#### Scenario: Catálogo
- **WHEN** Inés abre el catálogo
- **THEN** ve arriba, fijada como «Tu primer paso», la misma ecoinnovación que en el inicio

#### Scenario: Diagnóstico por etapas
- **WHEN** el diagnóstico muestra tres recomendaciones
- **THEN** son las tres primeras del orden vigente

#### Scenario: Correo de bienvenida
- **WHEN** se genera el correo de bienvenida de un negocio
- **THEN** sugiere la recomendación vigente y no una lista fija

### Requirement: Recálculo solo ante cambios de entrada
El sistema SHALL recalcular la recomendación solo cuando cambian sus datos de entrada: diagnóstico, perfil o restricciones, facturas, estado de los planes, catálogo o estadísticas de pares. Si el resultado cambia, la anterior SHALL quedar como reemplazada; si no cambia, SHALL NOT generar una versión nueva ni un aviso.

#### Scenario: Cambio de presupuesto
- **WHEN** Inés cambia su presupuesto del trimestre
- **THEN** la recomendación se recalcula y, si cambia, la anterior queda como reemplazada

#### Scenario: Sin cambios en el resultado
- **WHEN** Inés sube una factura y el orden resultante es el mismo
- **THEN** la recomendación vigente se mantiene y no se genera un aviso

### Requirement: La usuaria decide
El sistema SHALL permitir aceptar la recomendación o elegir cualquier otra alternativa elegible, sin pedir justificación, y SHALL registrar la decisión. Desde la recomendación SHALL poder consultarse por qué se eligió: factores, datos usados y cantidad de casos de pares.

#### Scenario: Aceptar
- **WHEN** Inés acepta «Mantenimiento de burletes y descongelamiento de refrigeradoras»
- **THEN** se crea un plan en progreso con los pasos del catálogo («Revisar burletes», «Programar descongelamiento», «Registrar consumo»)
- **AND** la decisión queda registrada como aceptada

#### Scenario: Elegir otra
- **WHEN** Inés elige «Hornear por tandas y apagar el horno entre ellas»
- **THEN** se crea ese plan y la decisión queda registrada como «eligió otra alternativa»

#### Scenario: ¿Por qué esto?
- **WHEN** Inés toca «¿Por qué esto?»
- **THEN** ve los factores del puntaje, los datos usados y cuántos negocios similares sustentan cada dato, sin identificar a ninguno

### Requirement: Plan estancado y pausa
El sistema SHALL marcar como estancado un plan en progreso cuyos pasos no cambian hace 28 días o más, y SHALL permitir ponerlo en pausa y reanudarlo sin perder sus pasos ni su historial. Un plan en pausa SHALL NOT contar como abandonado.

#### Scenario: Plan de Inés estancado
- **WHEN** el plan `plan_552` está `in_progress`, su último cambio es del 2026-04-12 y la fecha actual es el 2026-07-10
- **THEN** el plan figura como estancado
- **AND** el primer paso le ofrece a Inés ponerlo en pausa

#### Scenario: Pausar y reanudar
- **WHEN** Inés pone en pausa el plan de aislamiento
- **THEN** su estado pasa a `paused`, los pasos quedan intactos y se registra un evento de pausa
- **AND WHEN** lo reanuda
- **THEN** vuelve a `in_progress` y se registra un evento de reanudación

### Requirement: Historial de eventos del plan
El sistema SHALL registrar cada cambio de estado de un plan como un evento inmutable con su fecha, de modo que las fechas de inicio, pausa e implementación se conserven aunque el estado cambie después.

#### Scenario: Reabrir no borra la implementación
- **WHEN** un plan se completa con fecha de implementación 2026-07-08 y luego se reabre
- **THEN** el evento de implementación del 2026-07-08 sigue registrado y el estado actual es `in_progress`

### Requirement: Fecha de implementación al completar
El sistema SHALL exigir la fecha en que se terminó de implementar (`implementedAt`) para marcar un plan como completado. SHALL rechazar fechas futuras o de más de 365 días atrás, y SHALL informar qué factura permitirá medir el resultado.

#### Scenario: Completar sin fecha
- **WHEN** se intenta completar un plan sin `implementedAt`
- **THEN** la respuesta es un error 422 con código `IMPLEMENTED_AT_REQUIRED` y el plan no cambia

#### Scenario: Fecha futura
- **WHEN** se intenta completar con `implementedAt` 2026-07-20 y la fecha actual es el 2026-07-10
- **THEN** la respuesta es un error 422 con código `IMPLEMENTED_AT_INVALID`

#### Scenario: Completar con fecha
- **WHEN** Inés completa el plan de burletes con `implementedAt` 2026-07-08
- **THEN** el plan queda `completed`
- **AND** se le informa que su factura de julio no cuenta porque incluye el día del cambio, y que el resultado se va a ver con la factura que cierra alrededor del 2026-08-31

### Requirement: Subtareas con IA opcionales y sin bloqueo
El sistema SHALL mostrar siempre los pasos del catálogo y SHALL pedir subtareas al servicio de IA existente solo cuando la usuaria lo pida, guardando las recibidas. Si el servicio responde 402, falla o tarda más de 10 segundos, la usuaria SHALL poder seguir con sus pasos sin cobro ni bloqueo.

#### Scenario: Sin cupo
- **WHEN** Inés pide ideas para un paso y el servicio responde 402
- **THEN** ve «Se terminó el cupo gratis de ideas de este mes. Tus pasos siguen aquí.» y puede marcar los pasos igual

#### Scenario: Servicio caído o lento
- **WHEN** el servicio de subtareas no responde en 10 segundos o responde un error
- **THEN** ve «Ahora no pudimos sugerir ideas extra. Tus pasos siguen aquí.» y puede reintentar más tarde

#### Scenario: Sin consumo automático
- **WHEN** Inés abre su plan
- **THEN** no se pide ninguna subtarea al servicio de IA hasta que ella lo solicite

### Requirement: Alta de factura con el contrato existente
El sistema SHALL aceptar facturas de luz con los campos `kwhConsumed`, `costPerKwh`, `billingStartDate`, `billingEndDate` y `uploadedFiles`, y SHALL responder agregando `totalCost` y `co2Equivalent`, calculados por el sistema.

#### Scenario: Factura de febrero del anexo
- **WHEN** Inés registra `kwhConsumed` 1690, `costPerKwh` 0.78, `billingStartDate` 2026-02-01, `billingEndDate` 2026-02-28 y `uploadedFiles` ["factura-febrero.jpg"]
- **THEN** la factura se guarda con 28 días, `totalCost` 1318.20 y `co2Equivalent` calculado con el factor de Perú

### Requirement: Días inclusivos y fechas sin hora
El sistema SHALL contar los días de un periodo incluyendo el primero y el último, y SHALL tratar las fechas de periodo como fechas sin hora, de modo que se muestren igual en cualquier zona horaria.

#### Scenario: Meses de distinta duración
- **WHEN** se registran periodos del 2026-02-01 al 2026-02-28, del 2026-03-01 al 2026-03-31, del 2026-04-01 al 2026-04-30 y del 2028-02-01 al 2028-02-29
- **THEN** sus días son 28, 31, 30 y 29

#### Scenario: Zona horaria
- **WHEN** la usuaria ve una factura con `billingEndDate` 2026-02-28 desde Perú (UTC−5) o Bolivia (UTC−4)
- **THEN** la fecha que se muestra es el 28 de febrero de 2026

### Requirement: Sin superposición por servicio
El sistema SHALL rechazar una factura cuyo periodo se superponga con otra vigente del mismo negocio y del mismo servicio, indicando el periodo en conflicto. Las facturas de luz y de agua del mismo periodo SHALL poder convivir.

#### Scenario: Superposición de luz
- **WHEN** Inés registra una factura de luz del 2026-02-15 al 2026-03-14 y ya tiene febrero y marzo
- **THEN** la respuesta es un error 409 con código `BILL_PERIOD_OVERLAP` que indica el periodo del 2026-02-01 al 2026-02-28

#### Scenario: Luz y agua del mismo mes
- **WHEN** Inés registra una factura de agua de febrero de 2026 y ya tiene la de luz de febrero
- **THEN** la factura de agua se guarda

### Requirement: Validación de valores de factura
El sistema SHALL rechazar fechas invertidas o futuras, periodos de más de 92 días, consumos no positivos o mayores a 1.000.000 kWh y tarifas fuera del rango configurado para el país, con un mensaje que diga qué corregir.

#### Scenario: Fechas invertidas
- **WHEN** se registra una factura con `billingStartDate` 2026-03-31 y `billingEndDate` 2026-03-01
- **THEN** la respuesta es un error 400 con código `VALIDATION_ERROR` y el mensaje «La fecha de inicio tiene que ser anterior a la de cierre.»

#### Scenario: Tarifa fuera de rango
- **WHEN** se registra una factura de Perú con `costPerKwh` 78 (en lugar de 0.78)
- **THEN** la respuesta es un error 400 que indica el rango de tarifa aceptado para Perú

### Requirement: Confirmación de valores atípicos
El sistema SHALL pedir una confirmación explícita antes de guardar una factura cuyo consumo por día sea menor a 0,3 veces o mayor a 3 veces la mediana del consumo por día de las facturas anteriores del mismo servicio, y SHALL marcar la factura confirmada como atípica.

#### Scenario: Un cero de más
- **WHEN** Inés registra julio con `kwhConsumed` 17900 (577 kWh por día, frente a una mediana de 60,0)
- **THEN** la respuesta es un error 422 con código `BILL_NEEDS_CONFIRMATION` y el mensaje «Es mucho más que tu consumo habitual. ¿Está bien el número?»
- **AND WHEN** reenvía la misma factura confirmando el valor
- **THEN** la factura se guarda marcada como atípica

### Requirement: Moneda por país
El sistema SHALL asociar a cada factura la moneda del país del negocio (PEN para Perú, BOB para Bolivia) y SHALL NOT sumar montos de monedas distintas sin convertirlos.

#### Scenario: Moneda de Inés
- **WHEN** Inés registra una factura
- **THEN** su total queda en PEN y se muestra como «S/»

### Requirement: Edición y borrado con historial
El sistema SHALL permitir editar y borrar facturas conservando sus versiones anteriores. El borrado SHALL ser lógico: la factura deja de usarse en recomendaciones y mediciones, pero queda registrada para auditoría.

#### Scenario: Editar
- **WHEN** Inés corrige marzo de 1910 a 1810 kWh
- **THEN** la factura vigente tiene 1810 kWh y la versión anterior queda registrada

#### Scenario: Borrar
- **WHEN** Inés borra la factura de mayo
- **THEN** mayo deja de aparecer en sus facturas y en los cálculos, y queda registrada como borrada con su fecha

### Requirement: Origen y evidencia de cada factura
El sistema SHALL registrar para cada factura el origen de sus números (carga de la usuaria o historial estimado del recibo) y el estado de su comprobante: foto correcta, foto para volver a tomar o sin foto. Para los aliados, solo una factura con foto correcta SHALL contar como «con comprobante».

#### Scenario: Factura con foto correcta
- **WHEN** Inés registra agosto con una foto que pasa la revisión de calidad
- **THEN** la factura queda con comprobante «foto correcta» y cuenta como «con comprobante» en el informe

#### Scenario: Factura sin foto
- **WHEN** Inés registra una factura sin adjuntar foto
- **THEN** la factura se guarda con comprobante «sin foto» y cuenta como «declarada» en el informe

### Requirement: Revisión de calidad de la foto en el dispositivo
Antes de subir una foto de factura, la interfaz SHALL revisar en el teléfono su tamaño, su luz y su nitidez. Si no pasa la revisión, SHALL sugerir tomarla de nuevo con consejos concretos y SHALL permitir guardar la factura igual, marcada con «foto para volver a tomar».

#### Scenario: Foto oscura o movida
- **WHEN** Inés elige una foto muy oscura o movida
- **THEN** ve «La foto se ve oscura o movida. Tómala con buena luz y que se lean los kWh.» con las opciones «Tomar otra» y «Guardar igual»
- **AND WHEN** elige «Guardar igual»
- **THEN** la factura se guarda con sus números y el comprobante «foto para volver a tomar»

#### Scenario: Foto chica
- **WHEN** la foto mide menos de 1000 px de lado largo
- **THEN** recibe la misma sugerencia de volver a tomarla

#### Scenario: Reemplazar la foto después
- **WHEN** Inés sube más tarde una foto correcta para esa factura
- **THEN** el comprobante pasa a «foto correcta» sin cambiar los números, y la medición no se recalcula

### Requirement: Historial de consumo del recibo
El sistema SHALL permitir cargar a mano el consumo mensual de hasta 12 meses anteriores que muestra el gráfico del recibo. Ese historial SHALL guardarse como estimado, sin crear facturas, SHALL usarse solo como referencia del mismo periodo del año anterior y SHALL rotularse como estimado en todo resultado que lo use.

#### Scenario: Historial cargado (sintético)
- **WHEN** Inés carga el consumo mensual de julio de 2025 a diciembre de 2025 que muestra su recibo de junio
- **THEN** esos meses se guardan como historial estimado y no aparecen en «Mis facturas»
- **AND** una medición que los use dice «Comparado con los mismos meses del año pasado (datos aproximados del gráfico de tu recibo).»

#### Scenario: Historial superpuesto con una factura
- **WHEN** existe una factura real para un mes que también está en el historial estimado
- **THEN** la medición usa la factura real y descarta el valor estimado de ese mes

### Requirement: Perfil asistido desde una descripción libre
El sistema SHALL ofrecer completar el perfil del negocio a partir de una descripción libre escrita por la usuaria: un modelo de IA sugiere el rubro (CIIU), los equipos y el tipo de horno, eligiendo solo de listas cerradas. SHALL NOT guardar ninguna sugerencia hasta que la usuaria la confirme o la corrija.

#### Scenario: Descripción de Inés
- **WHEN** Inés escribe «Tengo una panadería en Arequipa, somos 6. El horno es eléctrico y tenemos dos refrigeradoras. Este trimestre puedo poner unos 1200 soles y 4 horas por semana.»
- **THEN** recibe como sugerencias: rubro 1071 (elaboración de productos de panadería), equipos «horno eléctrico» y «refrigeración», tipo de horno «eléctrico», presupuesto S/ 1.200 y 4 horas por semana
- **AND** el perfil no cambia hasta que ella confirma

#### Scenario: Corrección antes de confirmar
- **WHEN** Inés quita «refrigeración» de las sugerencias y confirma
- **THEN** el perfil guarda solo «horno eléctrico» como equipo y la recomendación se recalcula con ese dato

### Requirement: Valores del perfil asistido verificados contra el texto
El sistema SHALL aceptar del perfil asistido solo los códigos, equipos y tipos de horno de sus listas cerradas, y solo los montos y las horas que aparecen escritos en la descripción. SHALL descartar cualquier otro valor y SHALL NOT deducir montos que la usuaria no escribió.

#### Scenario: Monto que no está en el texto
- **WHEN** la descripción dice «unos 1200 soles» y el modelo devuelve un presupuesto de 1500
- **THEN** el presupuesto sugerido se descarta y el campo queda vacío para que lo complete ella

#### Scenario: Descripción sin montos
- **WHEN** la descripción no menciona dinero ni horas
- **THEN** presupuesto y horas quedan vacíos, sin valores supuestos

#### Scenario: Código fuera de la lista
- **WHEN** el modelo devuelve un código CIIU o un equipo que no está en las listas
- **THEN** ese valor se descarta y no se muestra

### Requirement: Perfil asistido con alternativa sin IA
El sistema SHALL permitir desactivar el perfil asistido por configuración. Si está desactivado, no hay clave configurada, el modelo tarda más de 10 segundos o falla, SHALL sugerir por palabras clave con el mismo formulario y marcar el origen de cada sugerencia.

#### Scenario: Sin IA
- **WHEN** el perfil asistido está desactivado y Inés escribe la misma descripción
- **THEN** recibe sugerencias por palabras clave (rubro 1071, «horno eléctrico», «refrigeración», S/ 1.200 y 4 horas) marcadas con origen «palabras clave»

#### Scenario: Modelo lento
- **WHEN** el modelo no responde en 10 segundos
- **THEN** la usuaria recibe las sugerencias por palabras clave sin ver un error

### Requirement: Privacidad del perfil asistido
Antes del primer envío, el sistema SHALL avisar que la descripción se manda a un servicio de IA externo solo para sugerir datos del perfil y SHALL pedir no incluir nombres ni teléfonos. SHALL enviar solo el texto de la descripción y SHALL NOT guardar la respuesta completa del modelo ni registrar la descripción en los registros técnicos.

#### Scenario: Primer uso
- **WHEN** Inés usa el perfil asistido por primera vez
- **THEN** ve «Tu descripción se envía a un servicio de IA solo para sugerir estos datos. No escribas nombres ni teléfonos.» antes de enviarla

#### Scenario: Registros
- **WHEN** se procesa una descripción
- **THEN** los registros técnicos guardan la duración, el modelo y el resultado (aceptado o alternativa), pero no el texto

### Requirement: Límite de uso del perfil asistido
El sistema SHALL limitar el perfil asistido a 20 pedidos por negocio por día. Al superarlo, SHALL usar las palabras clave y avisarlo.

#### Scenario: Límite superado
- **WHEN** un negocio hace su pedido número 21 del día
- **THEN** recibe sugerencias por palabras clave y el aviso «Por hoy te sugerimos sin IA.»

### Requirement: Comparación en kWh por día
El sistema SHALL comparar consumos en kWh por día de cada periodo, ponderando por días al agrupar varios periodos, y SHALL NOT comparar totales del mes ni montos en dinero para medir ahorro.

#### Scenario: Febrero contra enero
- **WHEN** se comparan las facturas de enero (1840 kWh, 31 días) y febrero (1690 kWh, 28 días) de Inés
- **THEN** el consumo por día de febrero es 1,7 % mayor que el de enero (60,36 contra 59,35)
- **AND** no se informa ningún ahorro

### Requirement: Ningún ahorro sin implementación ni factura posterior
El sistema SHALL NOT informar ahorro de una ecoinnovación sin fecha de implementación y sin al menos una factura completa posterior. En esos casos SHALL informar «todavía no podemos saberlo» con el motivo.

#### Scenario: Inés hoy
- **WHEN** se mide el plan de Inés con sus seis facturas y sin fecha de implementación
- **THEN** el resultado es `INSUFFICIENT_DATA` con motivo `NO_IMPLEMENTATION_DATE`

#### Scenario: La resta simple ya no engaña
- **WHEN** se procesan las seis facturas de Inés en cualquier orden y sin implementación
- **THEN** ninguna vista ni aviso dice «ahorraste»

#### Scenario: Sin factura posterior
- **WHEN** el plan tiene `implementedAt` 2026-07-08 y no hay facturas que empiecen después de esa fecha
- **THEN** el resultado es `INSUFFICIENT_DATA` con motivo `NO_AFTER_BILL`

### Requirement: Exclusión de la factura del cambio
El sistema SHALL excluir de la comparación la factura cuyo periodo contiene la fecha de implementación. Son «antes» las facturas que terminan antes de esa fecha y «después» las que empiezan después.

#### Scenario: Julio de Inés (sintético)
- **WHEN** `implementedAt` es 2026-07-08 y existe la factura del 2026-07-01 al 2026-07-31
- **THEN** julio no se usa ni como «antes» ni como «después», y el resultado lo dice

### Requirement: Elección del método de comparación
El sistema SHALL comparar contra las mismas fechas del año anterior cuando haya facturas o consumo histórico que cubran al menos el 80 % de los días de cada periodo posterior. Si no, SHALL comparar contra el consumo por día, ponderado por días, de las últimas tres facturas completas anteriores a la implementación (mínimo dos).

#### Scenario: Periodos cercanos para Inés (sintético desde agosto)
- **WHEN** `implementedAt` es 2026-07-08 e Inés no tiene datos de 2025
- **THEN** el método es `RECENT_PERIODS`, con línea de base de abril a junio: (1760 + 1880 + 1720) / (30 + 31 + 30) = 58,90 kWh por día
- **AND** el resultado lleva la marca «sin corrección por temporada»

#### Scenario: Interanual (sintético)
- **WHEN** existen facturas de agosto y septiembre de 2025 que cubren esos meses
- **THEN** el método es `YEAR_OVER_YEAR` y cada periodo posterior se compara con los mismos días de 2025

#### Scenario: Línea de base insuficiente
- **WHEN** no hay datos del año anterior y solo hay una factura completa antes de la implementación
- **THEN** el resultado es `INSUFFICIENT_DATA` con motivo `NOT_ENOUGH_BASELINE`

### Requirement: Ajuste por crecimiento en el método interanual
En el método interanual, el sistema SHALL ajustar la referencia por la tendencia propia del negocio cuando haya al menos dos facturas anteriores a la implementación con su par del año anterior. Si no las hay, SHALL marcar el resultado como «sin ajuste por crecimiento».

#### Scenario: Negocio que ya venía creciendo (sintético)
- **WHEN** antes de implementar el negocio consumía en promedio 5 % más por día que en los mismos meses del año anterior
- **THEN** la referencia de cada periodo posterior es su par del año anterior multiplicado por 1,05

#### Scenario: Sin pares previos
- **WHEN** solo hay datos del año anterior para los meses posteriores a la implementación
- **THEN** el resultado lleva la marca «sin ajuste por crecimiento»

### Requirement: Temporada alta del rubro
En el método de periodos cercanos, el sistema SHALL NOT comparar periodos posteriores que se superpongan 7 días o más con la temporada alta configurada para el rubro (panaderías: noviembre y diciembre) si la línea de base no la incluye. En ese caso SHALL informar «todavía no podemos saberlo» con motivo `HIGH_SEASON`.

#### Scenario: Diciembre de una panadería (sintético)
- **WHEN** una panadería implementa en octubre, no tiene datos del año anterior y su única factura posterior es de noviembre
- **THEN** el resultado es `INSUFFICIENT_DATA` con motivo `HIGH_SEASON` y el mensaje explica que la campaña de fin de año mueve el horno

### Requirement: Banda de ruido propia del negocio
El sistema SHALL calcular una banda de ruido igual a 2 × σ × √(1/n_antes + 1/n_después), donde σ es la variación relativa del consumo por día del negocio en sus facturas válidas anteriores a la implementación (3 % si tiene menos de cuatro). SHALL considerar un cambio como medido solo si supera la banda.

#### Scenario: Variación de Inés
- **WHEN** se calcula σ con las seis facturas de Inés
- **THEN** σ es 2,57 %
- **AND** la banda con 3 facturas antes y 1 después es ±5,94 %, y con 2 después, ±4,69 %

### Requirement: Tres resultados posibles
El sistema SHALL clasificar cada medición como `MEASURED` si el cambio es una baja mayor que la banda; `NO_SAVINGS_DETECTED` si es una suba mayor que la banda, o si queda dentro de la banda con tres o más facturas posteriores; y `INSUFFICIENT_DATA` con motivo `WITHIN_NOISE` si queda dentro de la banda con menos de tres.

#### Scenario: Solo agosto (sintético)
- **WHEN** después de implementar el 2026-07-08 solo está agosto (1770 kWh, 31 días: 57,10 por día)
- **THEN** el cambio es −3,06 %, dentro de la banda de ±5,94 %
- **AND** el resultado es `INSUFFICIENT_DATA` con motivo `WITHIN_NOISE`

#### Scenario: Agosto y septiembre (sintético)
- **WHEN** además está septiembre (1600 kWh, 30 días), con lo que los dos periodos dan 3370 kWh en 61 días (55,25 por día)
- **THEN** el cambio es −6,21 %, mayor que la banda de ±4,69 %
- **AND** el resultado es `MEASURED`

#### Scenario: Tres facturas sin cambio claro (sintético)
- **WHEN** hay tres facturas posteriores y el cambio queda dentro de la banda
- **THEN** el resultado es `NO_SAVINGS_DETECTED`

### Requirement: Valorización a la tarifa vigente y efecto de la tarifa aparte
El sistema SHALL valorizar el ahorro en kWh a la tarifa del periodo posterior más reciente y SHALL informar por separado el cambio de tarifa entre la factura más antigua de los últimos 12 meses y la más reciente.

#### Scenario: Ahorro de Inés valorizado (sintético)
- **WHEN** la medición de agosto y septiembre da 3,66 kWh por día menos y la tarifa de septiembre es 0,84
- **THEN** el ahorro mensual equivalente es 109,7 kWh, unos S/ 92,11 por mes

#### Scenario: Efecto de la tarifa
- **WHEN** la factura más antigua de los últimos 12 meses es enero (0,78) y la más reciente tiene 0,84
- **THEN** el resultado informa una suba de tarifa del 7,7 %, separada del ahorro

### Requirement: Lo que ve la usuaria
El sistema SHALL mostrarle a la usuaria el cambio en porcentaje entero, el ahorro mensual redondeado a S/ 5 con un rango redondeado a S/ 10, la línea del método usado y, aparte, la nota de la tarifa, sin jerga estadística.

#### Scenario: Resultado medido de Inés (sintético)
- **WHEN** Inés abre «Tu ahorro» con la medición de agosto y septiembre
- **THEN** ve «Desde que cambiaste los burletes usas 6 % menos de luz por día. A la tarifa de hoy son unos S/ 90 menos por mes (entre S/ 20 y S/ 160).»
- **AND** ve «Comparado con tus 3 meses antes del cambio. Todavía no podemos corregir por temporada.»
- **AND** ve aparte «Tu tarifa subió 8 % desde enero: por eso tu factura puede subir aunque uses menos luz. Eso no depende de ti.»

#### Scenario: Todavía no (sintético)
- **WHEN** Inés abre «Tu ahorro» con solo agosto
- **THEN** ve «Todavía no podemos saberlo. Parece que bajó un poco, pero todavía está dentro de lo que tu consumo varía de un mes a otro. Lo sabremos con tu factura que cierra alrededor del 30 de septiembre.»

### Requirement: Recálculo determinista y versionado
El sistema SHALL recalcular la medición completa cada vez que cambian sus datos (facturas, fecha de implementación o versión del método), con el mismo resultado para los mismos datos. SHALL guardar cada resultado distinto como una versión nueva, con la huella de los datos usados.

#### Scenario: Mismos datos
- **WHEN** se recalcula una medición sin cambios en sus datos
- **THEN** la huella es la misma y no se crea una versión nueva

#### Scenario: Factura editada
- **WHEN** Inés corrige la factura de septiembre
- **THEN** se crea una versión nueva de la medición con otra huella, y la anterior queda registrada

### Requirement: Cada día cuenta una vez
El sistema SHALL contar cada día de consumo una sola vez en cada cálculo, sin importar el orden de carga, las ediciones o los borrados de facturas.

#### Scenario: Orden de carga
- **WHEN** las mismas facturas se cargan en distinto orden
- **THEN** la medición es idéntica

#### Scenario: Borrar una factura posterior (sintético)
- **WHEN** Inés borra septiembre después de tener un resultado `MEASURED`
- **THEN** la medición vuelve a calcularse solo con agosto y pasa a `INSUFFICIENT_DATA` con motivo `WITHIN_NOISE`

### Requirement: Aviso de recálculo y una sola cifra vigente
Cuando una medición ya mostrada cambia de resultado o de monto por una edición o un borrado, el sistema SHALL avisarle a la usuaria qué cambió y por qué, y SHALL mostrar solo la cifra vigente.

#### Scenario: Corrección de una factura
- **WHEN** Inés corrige una factura y su ahorro mensual pasa de unos S/ 90 a unos S/ 75
- **THEN** recibe el aviso «Recalculamos tu ahorro porque corregiste tu factura de septiembre: antes unos S/ 90, ahora unos S/ 75.»
- **AND** «Tu ahorro» muestra solo S/ 75

### Requirement: Qué falta y cuándo
Cuando el resultado sea «todavía no podemos saberlo», el sistema SHALL indicar qué falta y la fecha aproximada de cierre de la próxima factura, estimada con la duración habitual de los periodos del negocio.

#### Scenario: Próxima factura
- **WHEN** la última factura de Inés cierra el 2026-08-31 y sus periodos duran en mediana 31 días
- **THEN** el resultado indica que la próxima factura cierra alrededor del 2026-09-30

### Requirement: Periodos atípicos
El sistema SHALL excluir de la comparación los periodos de menos de 20 o más de 40 días y SHALL informar cuáles excluyó y por qué.

#### Scenario: Periodo corto
- **WHEN** una factura cubre del 2026-08-01 al 2026-08-12 (12 días)
- **THEN** no se usa en la medición y el resultado lo informa como «periodo demasiado corto»

### Requirement: Avisos dentro de la app como canal principal
El sistema SHALL registrar dentro de la app todo aviso importante (recordatorio de factura, recálculo de ahorro, correo rebotado, cambio de recomendación), de modo que ninguno dependa solo del correo.

#### Scenario: Correo caído
- **WHEN** el servicio de correo no está disponible y corresponde recordarle a Inés su factura
- **THEN** Inés ve el recordatorio en sus avisos dentro de la app

### Requirement: Correos con bandeja de salida y sin duplicados
El sistema SHALL enviar los correos a través de una bandeja de salida con una clave única por persona, plantilla y referencia. SHALL reintentar ante errores temporales (429, 5xx o falta de respuesta) con espera creciente hasta 5 intentos, y SHALL NOT reenviar un correo ya aceptado.

#### Scenario: Error temporal
- **WHEN** el servicio de mensajería responde 500 al primer intento y 200 al segundo
- **THEN** el correo queda enviado una sola vez

#### Scenario: Recordatorios de meses distintos
- **WHEN** corresponde recordar la factura de agosto y, después, la de septiembre
- **THEN** se envían los dos, porque su referencia es distinta

#### Scenario: Mismo recordatorio dos veces
- **WHEN** el recordatorio de agosto se encola dos veces
- **THEN** se envía una sola vez

#### Scenario: Error permanente
- **WHEN** el servicio responde 400
- **THEN** el correo queda como fallido sin reintentos y el aviso sigue visible en la app

### Requirement: Rebotes
El sistema SHALL dejar de escribir a una dirección que rebotó y SHALL avisarle a la usuaria dentro de la app que revise su correo.

#### Scenario: Correo rebotado
- **WHEN** llega el aviso de rebote de la dirección de Inés
- **THEN** los correos pendientes para esa dirección se suprimen y Inés ve «No pudimos escribirte a tu correo. Revisa que esté bien escrito.»

### Requirement: Recordatorio de factura por ciclo
El sistema SHALL recordarle a la usuaria subir su factura cuando pasaron cinco días desde la fecha estimada de cierre de un periodo sin factura, si tiene un plan en curso o una medición pendiente. SHALL NOT recordar dos veces el mismo periodo.

#### Scenario: Factura de agosto que no llega
- **WHEN** la fecha estimada de cierre de agosto es el 2026-08-31, hoy es el 2026-09-05 y no hay factura de agosto
- **THEN** Inés recibe el recordatorio de agosto en la app y por correo

### Requirement: Reporte de ahorro para la usuaria
El sistema SHALL generar un reporte imprimible y para compartir con el resultado vigente, el método, el periodo comparado, el nivel de evidencia y la fecha de cálculo. Cuando no haya resultado medido, el reporte SHALL decirlo y SHALL NOT mostrar cifras de ahorro.

#### Scenario: Reporte con resultado medido (sintético)
- **WHEN** Inés genera su reporte con el resultado de agosto y septiembre
- **THEN** incluye el cambio de −6 %, el ahorro de unos S/ 90 por mes con su rango, el método «periodos cercanos, sin corrección por temporada», el periodo comparado y la evidencia «con comprobante»

#### Scenario: Reporte sin resultado
- **WHEN** Inés genera su reporte sin una medición `MEASURED`
- **THEN** el reporte dice «Todavía no hay un ahorro medido» y no muestra cifras de ahorro

### Requirement: Informe para aliados solo con datos agregados
El sistema SHALL ofrecer a los aliados un informe por periodo con datos agregados: negocios por resultado, kWh ahorrados, montos, CO₂e, nivel de evidencia y método. SHALL NOT identificar a ningún negocio.

#### Scenario: Informe del trimestre (sintético)
- **WHEN** un aliado abre el informe de 2026-T3
- **THEN** ve totales por resultado (medido, todavía no, sin ahorro, sin datos) y no ve nombres, identificadores ni ubicaciones más finas que el país

### Requirement: Umbral de 5 negocios
El sistema SHALL mostrar un número agregado (mediana, total o porcentaje) solo cuando proviene de al menos 5 negocios distintos. SHALL ocultar las celdas con menos negocios y también las que permitirían deducirlas a partir de un total.

#### Scenario: Panaderías por ecoinnovación
- **WHEN** el informe agrupa panaderías por ecoinnovación con los datos del caso
- **THEN** «Iluminación LED» (5 negocios medidos) muestra su mediana
- **AND** «Mantenimiento de burletes» (4), «Hornear por tandas» (2) y «Aislamiento térmico» (1) aparecen como «menos de 5 negocios»

#### Scenario: Supresión complementaria
- **WHEN** en una fila con total visible queda oculta una sola celda
- **THEN** también se oculta la siguiente celda más chica, para que la oculta no se deduzca restando

### Requirement: Datos de otros negocios para la usuaria
El sistema SHALL mostrarle a la usuaria datos de otros negocios solo agregados y con el mismo umbral: con 5 o más, un número; con 3 o 4, solo una frase cualitativa; con menos de 3, nada.

#### Scenario: El caso único nunca se muestra
- **WHEN** Inés consulta «Aislamiento térmico del horno» (1 negocio medido con −18 %)
- **THEN** no ve ningún dato de otros negocios sobre su efecto

#### Scenario: Frase cualitativa
- **WHEN** una ecoinnovación tiene 4 negocios medidos
- **THEN** la usuaria ve «Algunas panaderías ya la midieron» sin cifras

### Requirement: Medido separado de declarado
El sistema SHALL presentar por separado el ahorro medido con facturas y el impacto declarado en el formulario de impacto percibido, y SHALL desglosar lo medido por nivel de evidencia (con comprobante o declarado) y por método.

#### Scenario: Informe con ambos tipos de dato (sintético)
- **WHEN** el periodo tiene mediciones y formularios de impacto percibido
- **THEN** el informe muestra el impacto declarado en un bloque aparte, rotulado «declarado por las usuarias, no medido»

### Requirement: Montos por moneda y equivalente en USD
El sistema SHALL informar los montos agrupados por moneda local y su equivalente en USD con el tipo de cambio del periodo. Si el servicio de conversión no responde, SHALL informar solo las monedas locales e indicarlo.

#### Scenario: Conversión caída
- **WHEN** el servicio de conversión de moneda no responde al generar el informe
- **THEN** el informe muestra los montos en PEN y BOB por separado con la nota «Equivalente en USD no disponible en este momento»

### Requirement: Cierre de periodo del informe
El sistema SHALL permitir cerrar el informe de un periodo, que queda inmutable. Las correcciones posteriores que lo afecten SHALL aparecer como ajustes en el informe del periodo siguiente.

#### Scenario: Corrección después del cierre (sintético)
- **WHEN** el informe de 2026-T3 está cerrado y una usuaria corrige una factura de septiembre
- **THEN** el informe cerrado de 2026-T3 no cambia
- **AND** el informe de 2026-T4 muestra el ajuste con su diferencia

### Requirement: Combinaciones de ecoinnovaciones
El sistema SHALL excluir de las estadísticas por ecoinnovación a los negocios que implementaron más de una con periodos de medición superpuestos, y SHALL contarlos aparte como «combinación».

#### Scenario: Dos ecoinnovaciones a la vez (sintético)
- **WHEN** un negocio implementa burletes y LED con dos semanas de diferencia y mide los mismos meses
- **THEN** su resultado no entra en la mediana de ninguna de las dos y se cuenta como combinación

### Requirement: Cada negocio ve solo lo suyo
El sistema SHALL limitar cada consulta y modificación a los datos del negocio autenticado. Un pedido sobre datos de otro negocio SHALL responder 404, como si no existieran.

#### Scenario: Factura de otro negocio
- **WHEN** Inés pide la factura de otro negocio por su identificador
- **THEN** la respuesta es un error 404 con código `NOT_FOUND`

### Requirement: Rol de aliado
Los usuarios con rol de aliado SHALL acceder solo al informe agregado y SHALL NOT acceder a datos de negocios individuales.

#### Scenario: Aliado que pide una factura
- **WHEN** un aliado pide la lista de facturas de un negocio
- **THEN** la respuesta es un error 403 con código `FORBIDDEN`

### Requirement: Errores con formato uniforme
El sistema SHALL responder los errores con un código estable, un mensaje en español para la usuaria y un identificador del pedido, y SHALL NOT exponer detalles internos (pilas de error, consultas o claves).

#### Scenario: Error inesperado
- **WHEN** ocurre un error no previsto en el servidor
- **THEN** la respuesta es un 500 con código `INTERNAL_ERROR`, el mensaje «Algo falló de nuestro lado. Intenta de nuevo en un rato.» y un identificador del pedido, sin detalles internos

### Requirement: Límites de las fotos de factura
El sistema SHALL aceptar fotos de factura solo en JPEG, PNG o WebP, de hasta 5 MB cada una y como máximo dos por factura.

#### Scenario: Archivo no permitido
- **WHEN** se sube un PDF como foto de factura
- **THEN** la respuesta es un error 415 con código `FILE_TYPE_NOT_ALLOWED`

#### Scenario: Tercera foto
- **WHEN** se intenta adjuntar una tercera foto a una factura
- **THEN** la respuesta es un error 400 con código `TOO_MANY_FILES`

### Requirement: Base de datos no disponible
Si la base de datos no está disponible, el sistema SHALL responder 503 con un mensaje de reintento, y la interfaz SHALL conservar lo que la usuaria escribió.

#### Scenario: Guardar una factura sin base de datos
- **WHEN** Inés guarda una factura y la base de datos no responde
- **THEN** la respuesta es un error 503 con código `SERVICE_UNAVAILABLE`
- **AND** el formulario conserva sus datos y la foto para reintentar

### Requirement: Uso en celular
La interfaz SHALL funcionar desde 360 px de ancho sin desplazamiento horizontal y con zonas táctiles de al menos 44 × 44 px.

#### Scenario: Pantalla chica
- **WHEN** se abre cualquier pantalla de la usuaria en 360 × 740 px
- **THEN** no hay desplazamiento horizontal y todos los controles miden al menos 44 × 44 px

### Requirement: Navegación según el ancho
La interfaz SHALL ofrecer una barra lateral con grupos en pantallas de más de 900 px y una barra de pestañas fija abajo en pantallas de hasta 900 px, con una sola navegación en el documento y el destino activo marcado con más de una señal además del color.

#### Scenario: Celular
- **WHEN** el ancho es de 390 px
- **THEN** la navegación es una barra de pestañas fija abajo de 56 px de alto, que no tapa el contenido

#### Scenario: Computadora
- **WHEN** el ancho es de 1280 px
- **THEN** la navegación es una barra lateral fija con grupos con etiqueta, y cada identificador de prueba de la navegación existe una sola vez en el documento

### Requirement: Accesibilidad
La interfaz SHALL cumplir el contraste WCAG 2.2 AA, ser operable con teclado, tener nombres accesibles en todos los controles y anunciar los errores de formulario a los lectores de pantalla.

#### Scenario: Control automático
- **WHEN** se ejecuta el control automático de accesibilidad sobre cada pantalla
- **THEN** no hay violaciones graves ni críticas

#### Scenario: Color de acento
- **WHEN** se usa el color lima de la marca
- **THEN** se usa solo como fondo con texto oscuro y nunca como color de texto sobre blanco

### Requirement: Datos móviles limitados
La interfaz SHALL cargar la primera pantalla con no más de 120 KB de JavaScript comprimido y SHALL comprimir cada foto en el dispositivo a no más de 250 KB antes de subirla.

#### Scenario: Peso de la aplicación
- **WHEN** se construye la versión de producción de la interfaz
- **THEN** el JavaScript necesario para la primera pantalla pesa 120 KB o menos comprimido

#### Scenario: Foto grande
- **WHEN** Inés elige una foto de 4 MB
- **THEN** la foto que se sube pesa 250 KB o menos y sigue siendo legible

### Requirement: Borradores sin conexión
La interfaz SHALL conservar en el dispositivo el borrador de una factura (números y foto) si se pierde la conexión, y SHALL ofrecer reintentar el envío cuando vuelva.

#### Scenario: Corte de conexión
- **WHEN** Inés pierde la conexión al enviar una factura
- **THEN** ve «No hay conexión. Guardamos tu factura en el teléfono y la enviamos cuando vuelva.»
- **AND** al recargar la página el borrador sigue ahí

### Requirement: Idioma y formatos
La interfaz SHALL usar español neutro con «tú», sin jerga estadística, y SHALL formatear montos y fechas con la configuración regional del país del negocio (es-PE para Perú).

#### Scenario: Monto en Perú
- **WHEN** se muestra un monto de 1.200 soles a una usuaria de Perú
- **THEN** se muestra como «S/ 1,200» y las fechas como «31 de agosto de 2026»

### Requirement: Eventos para medir la meta
El sistema SHALL registrar sin datos personales los eventos de recomendación mostrada, recomendación aceptada o cambiada, plan completado, factura posterior subida y resultado de medición, con su fecha, para calcular los indicadores de la meta de 90 días.

#### Scenario: Recorrido completo (sintético)
- **WHEN** Inés acepta la recomendación, completa el plan, sube agosto y septiembre y obtiene un resultado `MEASURED`
- **THEN** quedan registrados los cinco eventos con su fecha y sin datos personales
