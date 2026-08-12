# Brief de handoff — App móvil y control de cápsulas IoT

**Fecha:** 2026-08-12
**Destinatario:** equipo técnico externo
**Qué se espera de vuelta:** requerimientos funcionales, propuesta de arquitectura, cronograma y costeo del MVP

---

## 1. Resumen ejecutivo

Se está construyendo una **cápsula de cultivo de hongos instrumentada**: un ambiente cerrado con sensores y actuadores que mantiene automáticamente las condiciones que el hongo necesita, y que registra todo lo que ocurre dentro.

La cápsula es un **producto que se venderá a clientes**. El primero ya está definido; habrá otros. Se requiere el software que la acompaña:

1. Una **app móvil** para monitorear la cápsula, ver su interior por cámara y ajustar los parámetros de cultivo.
2. El **firmware** que corre dentro de la cápsula.
3. La **industrialización del hardware**, partiendo del diseño y prototipo existentes.

Este documento entrega el contexto necesario para escribir los requerimientos. No es una especificación cerrada: varias decisiones técnicas se dejan explícitamente al criterio del equipo, y están marcadas como tales.

---

## 2. Contexto: qué problema resuelve el producto

El hongo gourmet y funcional disponible en el mercado local se cultiva **a ciegas**. Es importado —y por tanto sin información sobre su origen— o producido de forma artesanal, sin datos ni registro de las condiciones en las que creció. No hay manera de saber si un lote se cultivó bien o mal, ni de repetir un buen resultado.

La cápsula ataca eso por dos vías:

- **Control**: mantiene las condiciones correctas automáticamente, en vez de depender de que una persona revise varias veces al día.
- **Trazabilidad**: cada lote queda con su historia completa de temperatura, humedad, CO₂, luz e imágenes. Esa historia es parte del valor comercial del producto final.

**El dato es el producto, no un accesorio.** Un sistema que controle bien pero registre mal falla en la mitad del propósito.

### Por qué las variables importan

Este contexto es necesario para dimensionar bien el sistema de control. El equipo no necesita ser experto en micología, pero sí entender que **los objetivos no son fijos**.

Un cultivo atraviesa fases con necesidades opuestas:

| Fase | Temperatura | Humedad | CO₂ | Luz |
|---|---|---|---|---|
| **Incubación** — el micelio coloniza el sustrato | Más alta | Moderada | Alto, se tolera | Oscuridad |
| **Fructificación** — aparecen y crecen los hongos | Más baja | Muy alta | Bajo, requiere renovación de aire | Fotoperiodo |

El paso de una fase a otra es un cambio deliberado de condiciones que dispara la fructificación. Y los errores tienen firma visible: exceso de CO₂ produce hongos deformes, de tallo largo y sombrero pequeño; humedad insuficiente los agrieta y los seca.

Tres consecuencias de diseño:

1. El sistema necesita **perfiles de cultivo** (especie + fase → rangos objetivo), no un único juego de valores. Cambiar de fase debe ser una acción, no una reconfiguración manual de cada variable.
2. Los valores objetivo cambian en el orden de **horas y días**, nunca de segundos. Esto permite cadencias de telemetría modestas y descarta la necesidad de tiempo real estricto.
3. Existen ya protocolos de cultivo escritos que se convertirán en esos perfiles. El equipo no tiene que inventarlos.

---

## 3. La cápsula

Un ambiente cerrado, de escala pequeña, pensado para instalarse en interiores.

**Mide:** temperatura, humedad relativa, CO₂, luz. Más una **cámara** para seguimiento visual del cultivo.

**Controla:** iluminación con fotoperiodo programable, ventilación y extracción para renovar aire y bajar CO₂, humidificación, y regulación térmica.

El prototipo está en construcción. El diseño electrónico, la selección de sensores y actuadores, y un firmware base existen ya y se entregarán como punto de partida. **El encargo no es diseñar desde cero, es llevar ese diseño a un producto vendible**: firmware productivo, actualizable en campo, con aprovisionamiento para un cliente que no es técnico, y la app que lo opera.

---

## 4. Usuarios

Tres perfiles, con necesidades distintas:

**Dueño de la cápsula.** Compró el equipo. Quiere saber si su cultivo está bien sin tener que entender qué es el CO₂. Ve el estado, recibe avisos cuando algo se sale de rango, mira las fotos. No configura nada complejo.

**Operador.** Trabaja el cultivo día a día. Aplica perfiles, cambia de fase, ajusta parámetros, registra lo que observa. Es quien más usa la app.

**Asesor técnico.** Acompaña remotamente a varios clientes. Necesita ver el estado de las cápsulas que asesora y diagnosticar problemas a distancia. Es el perfil que hace valioso el histórico.

Ya existe una plataforma web con un modelo de roles equivalente y funcionando. La app debe integrarse a esa identidad, no crear una paralela — ver sección 6.

---

## 5. Decisiones ya tomadas

Estas cinco decisiones están cerradas. Se documentan con su razón para que se entienda el porqué, no para reabrirlas. Si el equipo considera que alguna es un error, es una conversación válida — pero explícita, no un cambio silencioso durante la implementación.

### 5.1 La cápsula es autónoma

**La lógica de control vive en el dispositivo, no en la nube.** La cápsula guarda sus objetivos localmente y los ejecuta por su cuenta. La app cambia objetivos; no da órdenes momento a momento.

*Por qué:* si se cae internet, el cultivo debe seguir funcionando. Un lote representa semanas de trabajo y no espera a que vuelva la conexión. Una arquitectura donde la nube ordena y el dispositivo obedece convierte cualquier caída de red en una pérdida potencial de producción.

*Implicación:* debe existir además una **anulación manual temporal** —encender una luz para revisar el cultivo, por ejemplo— que expire sola y devuelva el control al programa automático. Una anulación que no expira es un modo de falla silencioso.

### 5.2 Multi-cliente desde el modelo de datos

Cada cápsula tiene un dueño identificable, y ningún cliente puede ver datos de otro. Esto aplica **desde el primer día**, aunque el MVP atienda una sola cápsula.

*Por qué:* la cápsula se venderá a más clientes. Añadir aislamiento entre clientes a un sistema que no lo tuvo desde el inicio implica reescribir las reglas de acceso y migrar datos en producción, con riesgo real de filtración entre clientes durante la transición. El costo de hacerlo bien ahora es marginal; el de corregirlo después no lo es.

*Nota de alcance:* multi-cliente se refiere al **modelo de datos y las reglas de acceso**. La funcionalidad del MVP puede asumir una cápsula por usuario.

### 5.3 Fotos periódicas y timelapse — no video en vivo

La cápsula sube una imagen cada cierto intervalo. La app muestra la más reciente y permite reproducir la secuencia como timelapse del crecimiento.

*Por qué:* el cultivo cambia en horas. Un streaming en vivo exigiría infraestructura de señalización, hardware más capaz y ancho de banda sostenido, para mostrar una imagen que es prácticamente idéntica a la de hace diez minutos. El timelapse, en cambio, es una función que el usuario efectivamente quiere: ver crecer su cultivo.

### 5.4 Conexión por WiFi del sitio

La cápsula se conecta a la red WiFi del lugar donde se instale.

*Implicación:* se necesita un **flujo de aprovisionamiento desde la app** que permita a un cliente no técnico conectar su cápsula a su red WiFi, y reconectarla si la red cambia. Este flujo es una de las partes que más determina si el producto se percibe como terminado o como prototipo. Debe recibir atención de diseño, no tratarse como un detalle de configuración.

### 5.5 Identidad compartida con la plataforma existente

La autenticación es la misma que ya usa la plataforma web: inicio de sesión con Google, gestionado por Supabase. No se construye un sistema de cuentas nuevo.

---

## 6. La plataforma que ya existe

Hay una aplicación web en producción, propiedad del primer cliente, que gestiona su operación de cultivo. Su stack:

- **Next.js** (App Router) + TypeScript, desplegado en **Vercel**
- **Supabase** — Postgres, autenticación con Google OAuth, Row Level Security en todas las tablas
- Interfaz en **español**

Ya tiene funcionando: autenticación con aprobación manual de usuarios, roles diferenciados, gestión de **lotes** de cultivo, bitácora de registros por lote, asignación de tareas y auditoría de acciones.

**El punto de integración es el lote.** Un lote ya existe en la base de datos como entidad con especie, sustrato, fecha de inicio y estado. La telemetría de una cápsula debe poder asociarse a un lote, para que el histórico ambiental quede unido al registro humano de ese cultivo. Esa unión es exactamente lo que produce la trazabilidad que da valor comercial al producto.

### Arquitectura de datos propuesta

**Un solo proyecto Supabase**, compartido entre la plataforma web y el sistema IoT. Las tablas nuevas del sistema IoT (cápsulas, lecturas, objetivos, comandos, capturas) viven ahí, con aislamiento entre clientes aplicado mediante Row Level Security.

**El compromiso que esto implica, dicho con claridad:** acopla el producto comercial de las cápsulas a la plataforma de un cliente específico. Con un número reducido de cápsulas es la opción correcta y barata — evita duplicar identidad, datos y operación. Si el producto escala a decenas de clientes independientes, habrá que separar ambos sistemas. Se acepta ese costo futuro a cambio de simplicidad hoy.

Si el equipo ve un problema serio en este enfoque, es el momento de decirlo.

---

## 7. Funcionalidad esperada de la app

Lo que el sistema debe permitir hacer. **No** es una lista de pantallas ni una especificación de interfaz — el diseño es parte de lo que se espera de vuelta.

**Monitoreo.** Ver el estado actual de cada variable y si está dentro o fuera de rango. Consultar el histórico y entender cómo evolucionó el ambiente durante el cultivo.

**Cámara.** Ver la imagen más reciente del interior. Reproducir el timelapse del lote en curso.

**Parámetros.** Consultar y modificar los objetivos de cada variable. Aplicar un perfil de cultivo predefinido según especie y fase. Cambiar de fase como una sola acción.

**Anulación manual.** Accionar luces o ventilación temporalmente, con expiración automática y retorno al programa.

**Alertas.** Aviso cuando una variable permanece fuera de rango, cuando la cápsula deja de reportar, o cuando un actuador parece no responder.

**Aprovisionamiento.** Conectar una cápsula nueva al WiFi del sitio y vincularla a su dueño, sin asistencia técnica.

**Vinculación con el lote.** Asociar la cápsula al lote de cultivo que está corriendo dentro, para que el histórico quede unido a ese lote.

---

## 8. Requisitos no funcionales

Los que consideramos críticos. El equipo debe completar esta lista como parte de su propuesta.

**Seguridad a prueba de fallos.** El firmware debe tener límites duros que ninguna orden remota pueda sobrescribir. Un error de configuración desde el teléfono no puede traducirse en un calefactor sin límite. Definir también el comportamiento ante sensor que falla o entrega lecturas absurdas: apagar el actuador asociado es preferible a controlar contra un dato falso.

**Operación sin conexión.** La cápsula mantiene su programa y acumula lecturas mientras esté sin internet, y las sincroniza al reconectar. Debe quedar explícito cuánto tiempo de datos puede retener.

**Comandos autenticados.** Cada cápsula con credencial propia. Ningún comando anónimo o reproducible por un tercero. El aprovisionamiento no puede dejar credenciales compartidas entre unidades.

**Actualización en campo.** El firmware debe poder actualizarse remotamente, con capacidad de revertir si una actualización falla. Un producto vendido al que hay que ir físicamente a reprogramar no es sostenible.

**Retención de datos.** Definir cuánto histórico se conserva y a qué resolución. La telemetría de un lote debe sobrevivir al lote, porque ese es el registro de trazabilidad.

**Idioma.** Interfaz en español.

---

## 9. Alcance del MVP

**Objetivo del MVP: validar el prototipo en operación real, con un cultivo completo de principio a fin.** No es una demo; es una cápsula funcionando sola durante un ciclo de cultivo real.

### Dentro del MVP

- Una cápsula operando de forma autónoma con sus objetivos configurados
- Lecturas actuales e histórico consultables desde la app
- Imagen más reciente y timelapse
- Modificación de objetivos y aplicación de un perfil de cultivo
- Cambio de fase
- Alerta cuando una variable sale de rango o la cápsula deja de reportar
- Aprovisionamiento WiFi desde la app
- Continuidad de operación sin internet, con sincronización posterior
- Modelo de datos con aislamiento entre clientes ya implementado

### Fuera del MVP

- Gestión de flotas o vistas de múltiples clientes
- Actualización de firmware remota sofisticada — basta un mecanismo mínimo
- Analítica, predicción o recomendaciones automáticas
- Integración profunda con la plataforma web más allá de vincular cápsula y lote
- Publicación pública de trazabilidad por QR
- Video en vivo

### No-objetivos del encargo completo

Comercio electrónico, facturación o cobros. Modificaciones a la landing pública. Soporte para hardware de terceros. Aplicación de escritorio.

---

## 10. Preguntas abiertas — decisiones del equipo

Se dejan deliberadamente abiertas. Se espera que la propuesta las resuelva y justifique.

1. **Tecnología de la app.** Nativa o multiplataforma. Interesa la razón, no solo la elección.
2. **Protocolo dispositivo ↔ nube.** Qué protocolo y por qué, considerando que la infraestructura de datos es Supabase y que puede requerir un componente intermedio.
3. **Almacenamiento de imágenes.** Dónde viven, con qué compresión, cuánto se retiene, cómo se arma el timelapse sin descargar todo el histórico.
4. **Estrategia de actualización de firmware** y su mecanismo de reversión.
5. **Aprovisionamiento.** Qué método concreto para conectar la cápsula al WiFi sin asistencia técnica.
6. **Normativa y certificación.** Qué aplica a un equipo eléctrico vendido a consumidores en Colombia, y cuál es su impacto en costo y plazo.
7. **Costo operativo por cápsula.** Cuánto cuesta mensualmente mantener una cápsula conectada, en infraestructura y almacenamiento.

---

## 11. Qué se espera de vuelta

**1. Requerimientos funcionales.** Escritos como reglas verificables desde el punto de vista del usuario, no como detalles de implementación.

**2. Propuesta de arquitectura.** Componentes, flujo de datos, respuestas a las preguntas abiertas de la sección 10, y decisiones de industrialización del hardware.

**3. Cronograma del MVP**, con hitos verificables.

**4. Costeo del MVP**, desglosado en:
- Desarrollo — el costo único de llegar al prototipo validado
- Costo unitario de fabricación de una cápsula
- Costo operativo mensual por cápsula en funcionamiento

Ese desglose importa: el primero se paga una vez, los otros dos determinan si el producto es viable comercialmente al venderse.

**5. Riesgos y supuestos.** Qué podría salir mal y qué se está asumiendo como cierto.

### Cómo se evaluará la propuesta

- Si respeta y entiende las cinco decisiones cerradas de la sección 5
- Si el MVP propuesto realmente permite validar un ciclo de cultivo completo
- Si el costo unitario y operativo son compatibles con vender el producto
- Si la seguridad a prueba de fallos está tratada como requisito, no como detalle posterior

---

## 12. Material de apoyo disponible

A solicitud, se puede entregar:

- Diseño electrónico, selección de componentes y firmware base del prototipo actual
- Protocolos de cultivo escritos, base de los perfiles de especie y fase
- Acceso al esquema de datos y al código de la plataforma web existente
- Acompañamiento técnico en la parte de cultivo durante todo el desarrollo

**El conocimiento de cultivo no es un vacío que el equipo deba llenar.** Existe y está disponible. Lo que se necesita del equipo es la ingeniería de producto.
