// Grossmart · servidor
//   node server/index.mjs          → http://127.0.0.1:4321
//   node server/index.mjs --movil  → también desde el móvil (wifi), con clave

import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as config from "../config/oficina.config.mjs";
import { crearPuerta, LARGO_MINIMO_CLAVE } from "./acceso.mjs";
import { Almacen } from "./almacen.mjs";
import { crearEjecutor } from "./ejecutor.mjs";
import { Oficina } from "./oficina.mjs";
import { soltarPrivilegios } from "./privilegios.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLICO = path.join(RAIZ, "public");
const DATOS = process.env.OFICINA_DATOS || path.join(RAIZ, "datos");

// Antes que nada: si somos root, pasar a un usuario normal (ver privilegios.mjs).
const soltado = soltarPrivilegios(process.env.OFICINA_USUARIO, DATOS);
if (process.getuid?.() === 0 && (process.env.OFICINA_EN_LA_NUBE || process.env.OFICINA_USUARIO)) {
  console.error("\n  Grossmart no trabaja como administrador (root). Defina OFICINA_USUARIO.\n");
  process.exit(1);
}

const almacen = new Almacen(DATOS);
const ejecutor = crearEjecutor(config.EJECUTOR);
const oficina = new Oficina({ config, almacen, ejecutor });
const EN_LA_NUBE = Boolean(process.env.OFICINA_EN_LA_NUBE);
const puerta = crearPuerta({ clave: process.env.OFICINA_CLAVE || config.SERVIDOR.clave, enLaNube: EN_LA_NUBE, dirDatos: DATOS });
const MAX_OYENTES = 20;

// Cabeceras de seguridad en todas las respuestas. La política de contenido
// (CSP) solo deja ejecutar los scripts de la propia oficina: aunque un
// documento trajera código escondido, el navegador no lo ejecutaría.
const CABECERAS = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join("; "),
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "x-robots-tag": "noindex, nofollow",
};

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
};

// ── avisos en vivo (Server-Sent Events) ──────────────────────────────────────
const oyentes = new Set();
function avisar(evento, datos) {
  const linea = `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
  for (const res of oyentes) res.write(linea);
}
let pendienteCambio = null;
oficina.on("cambio", () => {
  if (pendienteCambio) return;
  pendienteCambio = setTimeout(() => {
    pendienteCambio = null;
    avisar("estado", oficina.estado());
  }, 120);
});
oficina.on("progreso", (p) => avisar("progreso", p));
setInterval(() => {
  for (const res of oyentes) res.write(": latido\n\n");
}, 25_000).unref();

// ── rutas ────────────────────────────────────────────────────────────────────
const NOMBRES_HERRAMIENTAS = {
  WebSearch: "Buscar en la web",
  WebFetch: "Leer páginas web",
  Read: "Leer archivos del proyecto",
  Write: "Escribir archivos del proyecto",
  Edit: "Editar archivos del proyecto",
  Glob: "Buscar archivos",
  Grep: "Buscar dentro de archivos",
};

function configPublica() {
  return {
    proyectos: oficina.proyectos(),
    proyectoGeneral: config.PROYECTO_GENERAL.id,
    departamentos: config.DEPARTAMENTOS,
    agentes: oficina.agentes(),
    // Herramientas reales de los agentes (iguales para todos), con nombre legible.
    herramientas: (config.EJECUTOR.herramientas || []).map((h) => NOMBRES_HERRAMIENTAS[h] || h),
    estados: config.ESTADOS,
    prioridades: config.PRIORIDADES,
    paleta: config.PALETA,
  };
}

const rutas = [
  ["GET", /^\/api\/config$/, () => configPublica()],
  ["GET", /^\/api\/estado$/, () => oficina.estado()],
  ["POST", /^\/api\/encargos$/, (_, cuerpo) => oficina.recibirEncargo(cuerpo)],
  ["POST", /^\/api\/tareas$/, (_, cuerpo) => oficina.asignarTarea(cuerpo)],
  ["POST", /^\/api\/tareas\/([\w-]+)\/accion$/, ([id], cuerpo) => oficina.accion(id, cuerpo.accion, cuerpo)],
  ["POST", /^\/api\/proyectos$/, (_, cuerpo) => oficina.abrirProyecto(cuerpo)],
  ["GET", /^\/api\/proyectos\/([\w-]+)\/memoria$/, ([id]) => oficina.memoria(id)],
  ["POST", /^\/api\/agentes\/([\w-]+)$/, ([id], cuerpo) => oficina.editarAgente(id, cuerpo)],
  ["POST", /^\/api\/agentes\/([\w-]+)\/restablecer$/, ([id]) => oficina.restablecerAgente(id)],
  ["GET", /^\/api\/perfil$/, () => oficina.perfil()],
  ["POST", /^\/api\/perfil$/, (_, cuerpo) => oficina.editarPerfil(cuerpo)],
  ["POST", /^\/api\/importar$/, (_, cuerpo) => oficina.importar(cuerpo)],
  ["POST", /^\/api\/proyectos\/([\w-]+)\/memoria$/, ([id], cuerpo) => oficina.editarMemoria(id, cuerpo)],
];

async function leerCuerpo(req) {
  let datos = "";
  for await (const trozo of req) {
    datos += trozo;
    if (datos.length > 200_000) throw Object.assign(new Error("Encargo demasiado largo."), { cerrar: true });
  }
  let cuerpo;
  try {
    cuerpo = datos ? JSON.parse(datos) : {};
  } catch {
    throw new Error("Petición mal formada.");
  }
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) throw new Error("Petición mal formada.");
  return cuerpo;
}

// Una escritura solo vale si viene de la propia oficina abierta en el
// navegador: mismo origen y en JSON (un formulario de otra web no puede).
function mismoOrigen(req) {
  if (!String(req.headers["content-type"] || "").startsWith("application/json")) return false;
  const sitio = req.headers["sec-fetch-site"];
  if (sitio && sitio !== "same-origin") return false;
  const origen = req.headers.origin;
  if (origen) {
    try {
      return new URL(origen).host === req.headers.host;
    } catch {
      return false;
    }
  }
  return Boolean(sitio) || !EN_LA_NUBE;
}

function json(res, codigo, datos) {
  res.writeHead(codigo, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(datos));
}

const servidor = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(CABECERAS)) res.setHeader(k, v);
  if (EN_LA_NUBE) res.setHeader("strict-transport-security", "max-age=31536000");
  try {
    await atender(req, res);
  } catch (e) {
    // Nada de lo que llegue de fuera debe tumbar Grossmart.
    console.error(`[servidor] ${req.method} ${String(req.url).slice(0, 200)}: ${e.message}`);
    if (!res.headersSent) json(res, 500, { error: "Grossmart no pudo atender la petición." });
    else res.end();
  }
});
servidor.headersTimeout = 20_000;
servidor.requestTimeout = 60_000;

async function atender(req, res) {
  if (!["GET", "POST", "HEAD"].includes(req.method)) return json(res, 405, { error: "Método no permitido." });
  const url = new URL(req.url, "http://oficina");
  if (!(await puerta.atender(req, res, url.pathname))) return;

  if (url.pathname === "/salud") return json(res, 200, { ok: true });

  if (url.pathname === "/api/eventos") {
    if (oyentes.size >= MAX_OYENTES) return json(res, 429, { error: "Demasiadas pantallas abiertas." });
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write(`event: estado\ndata: ${JSON.stringify(oficina.estado())}\n\n`);
    oyentes.add(res);
    req.on("close", () => oyentes.delete(res));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (req.method === "POST" && !mismoOrigen(req)) {
      console.warn(`[servidor] escritura rechazada: origen ${req.headers.origin || "?"} desde ${puerta.ipCliente(req)}`);
      return json(res, 403, { error: "Origen no permitido." });
    }
    const ruta = rutas.find(([m, r]) => m === req.method && r.test(url.pathname));
    if (!ruta) return json(res, 404, { error: "No existe." });
    try {
      const cuerpo = req.method === "POST" ? await leerCuerpo(req) : {};
      const resultado = await ruta[2](url.pathname.match(ruta[1]).slice(1), cuerpo);
      return json(res, 200, resultado);
    } catch (e) {
      // Si el cuerpo quedó a medio leer, la conexión no se reutiliza.
      if (e.cerrar) res.setHeader("connection", "close");
      return json(res, 400, { error: e.message });
    }
  }

  // Archivos de la planta (solo de public/, nada más).
  let relativo;
  try {
    relativo = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  } catch {
    relativo = "";
  }
  const archivo = path.resolve(PUBLICO, relativo);
  if (!relativo || relativo.includes("\0") || !archivo.startsWith(PUBLICO + path.sep) || !existsSync(archivo) || !statSync(archivo).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("No existe.");
  }
  res.writeHead(200, { "content-type": TIPOS[path.extname(archivo)] || "application/octet-stream", "cache-control": "no-cache" });
  if (req.method === "HEAD") return res.end();
  createReadStream(archivo).pipe(res);
}

const puerto = Number(process.env.PORT || config.SERVIDOR.puerto);
const host = process.argv.includes("--movil") ? "0.0.0.0" : process.env.HOST || config.SERVIDOR.host;
const abierta = host !== "127.0.0.1" && host !== "localhost";
const clave = process.env.OFICINA_CLAVE || config.SERVIDOR.clave || "";
if ((abierta || EN_LA_NUBE) && clave.length < LARGO_MINIMO_CLAVE) {
  console.error(
    clave
      ? `\n  La clave es demasiado corta: abierto a la red, Grossmart pide al menos ${LARGO_MINIMO_CLAVE} caracteres.\n`
      : `\n  Grossmart no se abre a la red sin clave. Arranque con OFICINA_CLAVE="…" (${LARGO_MINIMO_CLAVE} caracteres o más).\n`,
  );
  process.exit(1);
}
servidor.on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `\n  El puerto ${puerto} ya está ocupado: ¿Grossmart ya está abierto en otra ventana?\n` : e);
  process.exit(1);
});
// Grossmart solo empieza a trabajar cuando tiene la puerta abierta.
servidor.listen(puerto, host, () => {
  oficina.iniciar();
  console.log(`\n  Grossmart abre sus puertas en http://${host}:${puerto}`);
  console.log(`  Ejecutor: ${ejecutor.descripcion}`);
  console.log(`  Archivo:  ${DATOS}${soltado ? `  (usuario ${process.env.OFICINA_USUARIO})` : ""}\n`);
  if (abierta && !process.env.OFICINA_EN_LA_NUBE) {
    const ips = Object.values(networkInterfaces())
      .flat()
      .filter((i) => i && i.family === "IPv4" && !i.internal)
      .map((i) => i.address);
    console.log("  Desde el móvil (misma wifi):");
    for (const ip of ips) console.log(`    http://${ip}:${puerto}`);
    console.log("");
  }
});

function cerrar() {
  almacen.volcar();
  process.exit(0);
}
process.on("SIGINT", cerrar);
process.on("SIGTERM", cerrar);
