# Propuesta: Primer paso con ahorro medido

## Why

Kamai no sabe decirle a una dueña por dónde empezar ni demostrarle cuánto le ahorró lo que hizo. Hoy cuatro lugares recomiendan cosas distintas sin guardar por qué, y el «ahorro» es la resta de dos facturas: en febrero le dijo a Inés «ahorraste S/ 117» cuando por día consumió 1,7 % más, sin haber hecho ningún cambio. De cada 10 negocios que eligen una ecoinnovación, 3 la completan y 1 deja facturas de antes y después, así que casi nadie llega a un ahorro medible y los aliados reciben impacto declarado, no medido.

## Goal

**Meta del caso:** que cada negocio vea un ahorro real en su factura en sus primeros 90 días en Kamai, y que Kamai pueda mostrarles a los aliados un ahorro medido, no declarado.

**Cómo sabemos que funciona** (indicadores que la capacidad deja registrados):
- % de negocios que **completan** el primer paso recomendado en 21 días o menos.
- % que suben **al menos una factura posterior** a la implementación.
- % con **resultado concluyente a los 90 días** (indicador principal).
- Motivos de cada «todavía no podemos saberlo», para saber qué arreglar.

Mostrar un número de ahorro a cualquier costo **no** cuenta como éxito: un «ahorraste» falso destruye la confianza de la usuaria y la credibilidad ante los aliados.

## What Changes

- **Recomendación única y explicada:** un motor de reglas con puntaje transparente elige la primera ecoinnovación según las restricciones reales del negocio (objetivo, sector, equipos, presupuesto, horas, nivel de diagnóstico) y la probabilidad de que la complete. La explica con motivos verdaderos, guarda por qué la eligió y la usuaria puede elegir otra. Los cuatro lugares que hoy recomiendan pasan a mostrar la misma.
- **Plan que no se pierde:** un plan estancado se puede poner en pausa; cada cambio de estado queda como evento, y al completar se pide la fecha de implementación, que es el límite entre «antes» y «después».
- **Facturas confiables:** días inclusivos, sin superposición por servicio, verificación de valores atípicos, moneda por país, edición y borrado con historial, revisión de calidad de la foto en el teléfono (oscura, movida o chica) y nivel de evidencia de cada factura. El historial de 12 meses del recibo se puede cargar a mano como dato estimado.
- **Perfil asistido con IA, opcional:** a partir de la descripción libre del negocio, un modelo elige de listas cerradas el rubro (CIIU), los equipos y el tipo de horno, y extrae presupuesto y horas solo si están escritos en el texto. Cada valor se verifica contra las listas y el texto, la usuaria confirma todo, hay alternativa por palabras clave y se puede apagar por configuración. Completa los datos que Kamai hoy no guarda y que la recomendación necesita.
- **Medición honesta del ahorro:**
  - compara en kWh por día, primero contra las mismas fechas del año anterior y, si no las hay, contra los periodos cercanos;
  - excluye la factura del cambio y aplica una banda de ruido propia del negocio;
  - tiene tres resultados posibles: medido, todavía no, no vemos ahorro;
  - valoriza a la tarifa vigente y muestra el efecto de la tarifa aparte;
  - se recalcula de forma determinista, sin doble conteo.
- **Avisos y correos:** avisos dentro de la app como canal principal, recordatorio de factura por ciclo y correos con bandeja de salida, reintentos y una clave por persona, plantilla y referencia.
- **Reporte para la usuaria** (para mostrar a clientes, bancos o aliados) e **informe para aliados**: solo datos agregados con umbral de 5 negocios, lo medido separado de lo declarado, por nivel de evidencia y método, con cierre de periodo.

## Capabilities

### New Capabilities

- `primer-paso-ahorro-medido`: recomendar a cada negocio una primera ecoinnovación y explicar por qué, y medir después cuánto le ahorró en su factura, con la honestidad que permitan sus datos, para la usuaria y, en conjunto, para los aliados. Es la capacidad que nombra el reto; agrupa un solo recorrido de la usuaria, de punta a punta.

### Modified Capabilities

Ninguna. El repositorio no tiene especificaciones previas. Los cambios a contratos existentes (estado `paused` del plan, campos nuevos de factura y catálogo) se describen en `design.md` y son compatibles hacia atrás.

## Where We Go Deep

El reto pide elegir dónde profundizar. Profundizamos en dos piezas, porque son las que hoy le fallan a Inés y las que decide la meta.

1. **La medición del ahorro (la pieza más profunda).**
   - *Por qué:* es lo que hoy engaña («ahorraste S/ 117» en un febrero en que consumió más por día), lo que pide la meta (ahorro medido, no declarado, para los aliados) y lo que no se puede deshacer: una cifra mostrada queda en la memoria de la usuaria y en los informes.
   - *Hasta dónde:* comparación en kWh por día con jerarquía de métodos, exclusión de la factura del cambio, banda de ruido propia del negocio, tres resultados con su motivo, valorización a la tarifa vigente con la tarifa aparte y recálculo determinista con versión y huella. Es lógica pura, sin dependencias, con escenarios de números exactos calculados por script y pruebas de propiedades.
2. **La recomendación del primer paso.**
   - *Por qué:* la recomendación actual dejó a Inés siete semanas trabada en algo que no podía terminar, y con 1 a 11 casos por ecoinnovación el orden ingenuo elige mal.
   - *Hasta dónde:* filtros por sus restricciones reales, puntaje con contracción, explicación con motivos verdaderos y una sola recomendación, guardada con su porqué, para las cuatro superficies.

Con menos profundidad, a propósito:
- **Perfil asistido con IA:** opcional y apagado por defecto. Antes de activarlo hace falta la evaluación de impacto (DPIA) de Agora.
- **Informe para aliados:** agregados trimestrales con umbral de privacidad. El formato final se define con Agora y sus aliados.
- **Integraciones:** simuladas con los contratos del anexo y sus modos de falla.
- **Temporada en negocios nuevos:** se compara contra los meses cercanos y se rotula así. El grupo de comparación queda como evolución.

**La interfaz salió más completa de lo que el reto pedía.** El reto no esperaba una interfaz pulida, y el razonamiento no está ahí: se construyó con el sistema visual de Kamai para probar la medición y la recomendación como las vería Inés en el celular, con datos móviles.

**Si hay que recortar.** Lo esencial, y lo que alcanza para responder el reto, es:
1. esta especificación;
2. la medición y la recomendación en el paquete de dominio, con sus tests sobre los datos del anexo;
3. una pantalla, «Tu ahorro», con sus tres estados.

El resto se puede sacar sin tocar esas piezas, empezando por lo que más se aleja de la pregunta de Inés: el informe para aliados, la bandeja de correos y los recordatorios, el perfil asistido, la app instalable con borrador sin conexión, las facturas de agua, la conversión a USD y el CO₂e, el panel de demostración y las demás pantallas.

## Out of Scope

- Integrar los servicios reales de Kamai (correo, subtareas con IA, conversión de moneda, almacenamiento): van simulados con sus mismos contratos y modos de falla.
- Reescribir o corregir el código existente (por ejemplo, migrar de MongoDB). Las superficies existentes solo pasan a leer la recomendación nueva.
- **Más usos de IA:** la lectura de la factura (PDF o foto), las respuestas a preguntas sobre el ahorro, la búsqueda en el catálogo con las palabras de la usuaria y un modelo que ordena quedan diseñados en `design.md` («Evolución: qué más se puede hacer con IA»), con la condición para encender cada uno. No se implementan en esta instancia, porque no se pueden probar ni verificar sin datos reales. La foto se guarda como comprobante y los números los escribe la usuaria.
- Entrenar modelos o un modelo que aprenda a ordenar: no hay datos suficientes (29 elecciones, 12 resultados). Se guardan los registros que lo harían posible.
- Corregir por clima con regresión (grados-día): con 6 a 12 puntos por negocio no se sostiene.
- Montos de inversión o de ahorro esperado en el catálogo: Kamai no los tiene y no se inventan.
- Recomendaciones para agua, residuos u otras categorías más allá del modelo general: el reto y el caso se centran en la luz. El motor es el mismo, pero los parámetros por categoría quedan por calibrar.
- Canal de WhatsApp, autenticación propia (se usa la existente) y despliegue a producción.

## Impact

- **API (Node.js + TypeScript, Express 5, MongoDB):**
  - rutas nuevas de recomendación, ahorro, perfil asistido, avisos, reportes e informe para aliados;
  - cambios compatibles en `/user-bill` (validaciones, servicio, origen y evidencia, borrado lógico) y en `/user-eco-card` (fecha de implementación, pausa, eventos).
- **Datos:**
  - colecciones nuevas: recomendaciones, mediciones versionadas, eventos de plan, historial de consumo estimado, avisos, bandeja de salida de correos, informes cerrados y estadísticas de pares;
  - campos opcionales nuevos en catálogo (`targetEquipment`) y perfil (equipos, tipo de horno, restricciones, consentimiento de IA).
- **Frontend (React + Vite):** pantallas para celular de primer paso, plan, subir factura, ahorro, facturas, reporte y avisos; informe para aliados.
- **Dependencias:** SDK de OpenAI (compatible con OpenRouter) para el perfil asistido; sin otras integraciones externas nuevas.
- **Privacidad y gobierno de IA:** el perfil asistido es un uso nuevo de IA y necesita la evaluación de impacto (DPIA) que exige la política [POL-IT-003](https://docs.google.com/document/d/1X2oA3M6yCOnjSBFxJoP7cDsV7mdDlNh2l7J1FfKeuoc/preview) de Agora antes de activarse en producción. Por eso viene apagado por defecto fuera de desarrollo.
