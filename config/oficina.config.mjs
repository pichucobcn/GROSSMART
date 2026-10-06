// ─────────────────────────────────────────────────────────────────────────────
//  Grossmart · configuración central
//
//  Todo lo que define Grossmart vive aquí: proyectos, departamentos, agentes,
//  estados, prioridades y el ejecutor. La lógica (server/) y la planta
//  (public/) se construyen a partir de este archivo: para añadir un proyecto
//  o un empleado basta con añadir una entrada y reiniciar el servidor.
// ─────────────────────────────────────────────────────────────────────────────

// Paleta de la casa. Prohibido el morado.
export const PALETA = {
  crema: "#F2E8D5",
  papel: "#E7D8BC",
  madera: "#4A3024",
  nogal: "#684735",
  verdeBiblioteca: "#315447",
  verdeLampara: "#55705A",
  rojoLadrillo: "#862820",
  doradoEnvejecido: "#B18A4A",
  tinta: "#211C18",
};

// ── PROYECTOS ────────────────────────────────────────────────────────────────
// Los trabajos que entran a Grossmart. Cada uno tiene su propio archivo
// (cajón en la planta) y su propia memoria, separada de los demás.
// `palabrasClave` ayuda a Coordinación a reconocer el proyecto en un encargo.
// También se pueden abrir proyectos nuevos desde la propia oficina
// (Archivo → "Abrir expediente nuevo"); se guardan en datos/proyectos.json.
export const PROYECTOS = [
  {
    id: "pichuco",
    nombre: "Pichuco",
    descripcion: "Pizzería y proyectos derivados",
    color: "#862820",
    palabrasClave: ["pizza", "pizzas", "pizzería", "pizzeria", "masa", "horno", "congeladas"],
  },
  {
    id: "open-folk",
    nombre: "Open Folk",
    descripcion: "Proyecto musical y cultural",
    color: "#8B7355",
    palabrasClave: ["openfolk", "folk"],
  },
  {
    id: "isla",
    nombre: "ISLA",
    descripcion: "Plataforma / proyecto cultural",
    color: "#55705A",
    palabrasClave: ["songwriter", "faros", "faro", "salas", "plataforma"],
  },
  {
    id: "barnabeat",
    nombre: "Barnabeat",
    descripcion: "Festival y proyectos musicales",
    color: "#A67C52",
    palabrasClave: ["festival", "barna"],
  },
  // {
  //   id: "nuevo-proyecto",
  //   nombre: "Nuevo Proyecto",
  //   descripcion: "Descripción",
  //   color: "#...",
  // },
];

// Expediente para lo que no pertenece a ningún proyecto concreto.
export const PROYECTO_GENERAL = {
  id: "general",
  nombre: "Asuntos generales",
  descripcion: "Encargos de Grossman que no pertenecen a un proyecto concreto",
  color: "#6B5D4F",
  palabrasClave: [],
};

// ── DEPARTAMENTOS ────────────────────────────────────────────────────────────
export const DEPARTAMENTOS = [
  { id: "coordinacion", nombre: "Coordinación", color: PALETA.doradoEnvejecido },
  { id: "produccion", nombre: "Producción", color: PALETA.nogal },
  { id: "administracion", nombre: "Administración", color: "#7A6A55" },
  { id: "finanzas", nombre: "Finanzas", color: PALETA.verdeBiblioteca },
  { id: "marketing", nombre: "Marketing", color: PALETA.rojoLadrillo },
  { id: "contenido", nombre: "Contenido", color: "#8B7355" },
  { id: "diseno", nombre: "Diseño", color: "#A67C52" },
  { id: "investigacion", nombre: "Investigación", color: PALETA.verdeLampara },
  { id: "datos", nombre: "Datos", color: "#5E6B5A" },
  { id: "automatizacion", nombre: "Automatización", color: "#6B5D4F" },
  { id: "legal", nombre: "Legal / Documentación", color: "#5A3A2E" },
  { id: "secretaria", nombre: "Secretaría", color: "#7A6A55" },
];

// ── AGENTES ──────────────────────────────────────────────────────────────────
// Los empleados permanentes. No pertenecen a un proyecto: trabajan para todos.
//
//  sombrero.tipo: fedora · homburg · bombin · cloche · canotier · boina · gorra
//  traje: color del saco visto desde arriba
//  instrucciones: cómo trabaja (se añade a cada encargo que recibe)
//
// El agente con `coordinador: true` es el jefe de operaciones: recibe los
// encargos generales, los reparte y redacta el informe consolidado.
export const AGENTES = [
  {
    id: "coordinacion",
    nombre: "Ernesto",
    departamento: "coordinacion",
    funcion: "Jefe de operaciones. Recibe los encargos, los reparte y consolida los resultados.",
    capacidades: ["planificar", "priorizar", "repartir trabajo", "consolidar informes", "seguimiento"],
    sombrero: { tipo: "homburg", color: "#2E2925" },
    traje: "#3A3530",
    coordinador: true,
    instrucciones:
      "Piensas como un jefe de operaciones veterano: ordenado, concreto, sin rodeos. Priorizas y detectas lo que necesita una decisión de Grossman.",
  },
  {
    id: "produccion",
    nombre: "Mercedes",
    departamento: "produccion",
    funcion: "Convierte ideas en planes, calendarios y tareas concretas.",
    capacidades: ["planes de trabajo", "calendarios", "logística", "proveedores", "operaciones"],
    sombrero: { tipo: "cloche", color: "#5A3A2E" },
    traje: "#55705A",
    instrucciones: "Entregas planes accionables: pasos, responsables, plazos y riesgos.",
  },
  {
    id: "administracion",
    nombre: "Ramón",
    departamento: "administracion",
    funcion: "Gestiona documentación, vencimientos y asuntos administrativos.",
    capacidades: ["trámites", "vencimientos", "documentación", "proveedores", "seguimiento administrativo"],
    sombrero: { tipo: "bombin", color: "#211C18" },
    traje: "#4A4038",
    instrucciones: "Eres meticuloso con fechas, plazos y papeles. Siempre señalas vencimientos.",
  },
  {
    id: "finanzas",
    nombre: "Clara",
    departamento: "finanzas",
    funcion: "Presupuestos, costes, ingresos, facturas y análisis económico.",
    capacidades: ["presupuestos", "costes", "escandallos", "previsiones", "rentabilidad", "facturación"],
    sombrero: { tipo: "cloche", color: "#315447" },
    traje: "#6B5D4F",
    instrucciones: "Trabajas con números claros, supuestos explícitos y tablas. Indicas el margen de error.",
  },
  {
    id: "marketing",
    nombre: "Bruno",
    departamento: "marketing",
    funcion: "Estrategia, campañas, posicionamiento y comunicación.",
    capacidades: ["campañas", "redes sociales", "posicionamiento", "público objetivo", "calendario de comunicación"],
    sombrero: { tipo: "fedora", color: "#684735" },
    traje: "#862820",
    instrucciones: "Propones campañas concretas con objetivo, público, mensajes, canales y calendario.",
  },
  {
    id: "contenido",
    nombre: "Inés",
    departamento: "contenido",
    funcion: "Redacción, textos, dossiers, propuestas y documentación.",
    capacidades: ["redacción", "dossiers", "propuestas", "notas de prensa", "copys"],
    sombrero: { tipo: "canotier", color: "#D9C38E" },
    traje: "#7A6A55",
    instrucciones: "Escribes con estilo cuidado y adaptado al tono de cada proyecto. Entregas textos listos para usar.",
  },
  {
    id: "diseno",
    nombre: "Tomás",
    departamento: "diseno",
    funcion: "Identidad visual, piezas gráficas y dirección estética.",
    capacidades: ["identidad visual", "dirección de arte", "briefs gráficos", "piezas", "tipografía"],
    sombrero: { tipo: "boina", color: "#2E2925" },
    traje: "#315447",
    instrucciones: "Describes las piezas con precisión: formato, composición, tipografía, paleta y referencias.",
  },
  {
    id: "investigacion",
    nombre: "Beatriz",
    departamento: "investigacion",
    funcion: "Busca información, analiza mercados y genera informes.",
    capacidades: ["investigación de mercado", "competencia", "normativa", "fuentes", "informes"],
    sombrero: { tipo: "fedora", color: "#55705A" },
    traje: "#4A3024",
    instrucciones: "Citas tus fuentes, distingues datos de suposiciones y terminas con conclusiones.",
  },
  {
    id: "datos",
    nombre: "Aníbal",
    departamento: "datos",
    funcion: "Analiza información y métricas.",
    capacidades: ["métricas", "análisis", "indicadores", "hojas de cálculo", "informes de resultados"],
    sombrero: { tipo: "gorra", color: "#6B5D4F" },
    traje: "#3A3530",
    instrucciones: "Defines indicadores, explicas cómo medirlos y qué decisión permite cada dato.",
  },
  {
    id: "automatizacion",
    nombre: "Lidia",
    departamento: "automatizacion",
    funcion: "Busca tareas repetitivas que puedan automatizarse.",
    capacidades: ["procesos", "automatizaciones", "herramientas", "flujos de trabajo", "integraciones"],
    sombrero: { tipo: "cloche", color: "#862820" },
    traje: "#5E6B5A",
    instrucciones: "Detectas lo repetitivo y propones automatizaciones sencillas, con herramientas concretas y su coste.",
  },
  {
    id: "legal",
    nombre: "Hugo",
    departamento: "legal",
    funcion: "Organiza contratos, licencias, documentación y cuestiones legales.",
    capacidades: ["contratos", "licencias", "permisos", "registro sanitario", "propiedad intelectual", "normativa"],
    sombrero: { tipo: "homburg", color: "#4A3024" },
    traje: "#211C18",
    instrucciones: "Señalas obligaciones, riesgos y documentos necesarios. Recuerdas que no sustituyes a un abogado colegiado.",
  },
  {
    id: "secretaria",
    nombre: "Amelia",
    departamento: "secretaria",
    funcion: "Lleva el correo de Grossman: lo lee, lo ordena por proyecto y prepara borradores de respuesta.",
    capacidades: ["correo electrónico", "clasificar por proyecto", "resúmenes", "borradores de respuesta", "detectar fraudes", "seguimiento"],
    sombrero: { tipo: "cloche", color: "#684735" },
    traje: "#4A4038",
    // Lleva el correo (ver server/correo/). No tiene herramientas: no navega
    // ni toca nada; propone, y Grossman aprueba.
    correo: true,
    herramientas: [],
    instrucciones:
      "Eres discreta, ordenada y precisa. Nunca envías nada ni borras nada: propones, y Grossman decide. Desconfías de los correos que meten prisa o piden datos o pagos.",
  },
];

// ── ESTADOS DE LAS TAREAS ────────────────────────────────────────────────────
export const ESTADOS = [
  { id: "pendiente", nombre: "Pendiente", color: "#8C8273", descripcion: "Registrada, sin poner en marcha" },
  { id: "asignada", nombre: "Asignada", color: PALETA.doradoEnvejecido, descripcion: "En la bandeja del agente" },
  { id: "trabajando", nombre: "Trabajando", color: "#4E7A4F", descripcion: "El agente está en ello" },
  { id: "esperando", nombre: "Esperando", color: "#B07A2A", descripcion: "Espera otra tarea o una respuesta de Grossman" },
  { id: "terminada", nombre: "Terminada", color: PALETA.verdeBiblioteca, descripcion: "Resultado entregado" },
  { id: "error", nombre: "Error", color: PALETA.rojoLadrillo, descripcion: "Algo falló; se puede volver a ejecutar" },
];

export const PRIORIDADES = [
  { id: "urgente", nombre: "Urgente", peso: 0 },
  { id: "alta", nombre: "Alta", peso: 1 },
  { id: "normal", nombre: "Normal", peso: 2 },
  { id: "baja", nombre: "Baja", peso: 3 },
];

// ── EJECUTOR ─────────────────────────────────────────────────────────────────
// Cómo trabajan realmente los agentes:
//   Oficina → Coordinación → Agente → ACP → Claude Code (cuenta del usuario)
//
// "acp": habla el Agent Client Protocol (el mismo que usa AionUi para lanzar
// Claude Code) con el puente de Claude Code. Usa la sesión de `claude` ya
// iniciada en esta máquina: ni claves de API ni servicios de pago aparte.
// Si AionUi usa otro puente ACP, basta con cambiar `comando`/`argumentos`.
//
// "simulado": respuestas de prueba, sin llamar a nadie (para ensayar la
// interfaz). Se activa también con OFICINA_EJECUTOR=simulado.
export const EJECUTOR = {
  tipo: "acp",
  // Vacío = el puente instalado con `npm install` (node_modules/.bin/claude-agent-acp).
  comando: "",
  argumentos: [],
  entorno: {},
  // Cuántos agentes pueden escribir a la vez (cada uno atiende una tarea).
  concurrencia: 3,
  // Minutos antes de dar una tarea por colgada.
  tiempoMaximoMinutos: 25,
  // Herramientas de Claude Code que tienen los agentes. Lo que no está en la
  // lista no existe para ellos (no se les puede convencer de usarlo).
  //   Por defecto: solo buscar y leer en la web.
  //   En un ordenador propio se puede añadir "Read", "Write", "Edit", "Glob"
  //   y "Grep" para que trabajen con archivos en la carpeta del proyecto.
  //   "Bash" (ejecutar comandos) no se recomienda nunca: con él, una web
  //   maliciosa podría intentar que un agente ejecute órdenes en la máquina.
  herramientas: ["WebSearch", "WebFetch"],
  // Cuando Claude Code pide permiso para una herramienta de la lista, la
  // oficina lo concede solo si es de lectura, búsqueda o edición dentro de la
  // carpeta del proyecto (datos/proyectos/<id>/archivo). Nunca ejecutar.
  autoAprobarPermisos: true,
};

export const SERVIDOR = {
  puerto: 4321,
  // "127.0.0.1": solo este ordenador (y Tailscale con `tailscale serve`).
  // "0.0.0.0": también otros aparatos de la wifi, como el móvil (o `npm run movil`).
  host: "127.0.0.1",
  // Clave para entrar desde otro aparato. Mejor no escribirla aquí sino
  // arrancar con OFICINA_CLAVE="…" (así no acaba en el repositorio).
  clave: "",
};

// ── CORREO ───────────────────────────────────────────────────────────────────
// Las cuentas se conectan con variables del servidor (ver README):
//   Gmail:   GMAIL_USUARIO + GMAIL_CLAVE_APP (contraseña de aplicación de Google)
//   Hotmail: HOTMAIL_USUARIO + MICROSOFT_CLIENT_ID (y luego «Conectar» en Grossmart)
export const CORREO = {
  // Revisiones automáticas, hora de Barcelona.
  revisiones: ["09:00", "15:00"],
  zona: "Europe/Madrid",
  // La primera vez, cuántos días hacia atrás se leen.
  diasPrimeraVez: 3,
  // Como mucho, cuántos correos por cuenta en cada revisión.
  maxPorRevision: 40,
};

// Cuánta memoria del proyecto se entrega a un agente en cada tarea.
export const MEMORIA = {
  trabajosAnteriores: 8,
  extractoPorTrabajo: 900,
};
