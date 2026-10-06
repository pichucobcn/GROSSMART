// LA OFICINA · servidor
//   node server/index.mjs          → http://127.0.0.1:4321
//   node server/index.mjs --movil  → también desde el móvil (wifi), con clave

import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as config from "../config/oficina.config.mjs";
import { crearPuerta } from "./acceso.mjs";
import { Almacen } from "./almacen.mjs";
import { crearEjecutor } from "./ejecutor.mjs";
import { Oficina } from "./oficina.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLICO = path.join(RAIZ, "public");
const DATOS = process.env.OFICINA_DATOS || path.join(RAIZ, "datos");

const almacen = new Almacen(DATOS);
const ejecutor = crearEjecutor(config.EJECUTOR);
const oficina = new Oficina({ config, almacen, ejecutor });
const puerta = crearPuerta(process.env.OFICINA_CLAVE || config.SERVIDOR.clave);

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
function configPublica() {
  return {
    proyectos: oficina.proyectos(),
    proyectoGeneral: config.PROYECTO_GENERAL.id,
    departamentos: config.DEPARTAMENTOS,
    agentes: config.AGENTES,
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
  ["POST", /^\/api\/proyectos\/([\w-]+)\/memoria$/, ([id], cuerpo) => oficina.editarMemoria(id, cuerpo)],
];

async function leerCuerpo(req) {
  let datos = "";
  for await (const trozo of req) {
    datos += trozo;
    if (datos.length > 1_000_000) throw new Error("Encargo demasiado largo.");
  }
  return datos ? JSON.parse(datos) : {};
}

function json(res, codigo, datos) {
  res.writeHead(codigo, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(datos));
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://oficina");
  if (!(await puerta.atender(req, res, url.pathname))) return;

  if (url.pathname === "/api/eventos") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write(`event: estado\ndata: ${JSON.stringify(oficina.estado())}\n\n`);
    oyentes.add(res);
    req.on("close", () => oyentes.delete(res));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    // Solo peticiones de la propia oficina (evita que otra web abierta en el
    // navegador envíe encargos a este servidor local).
    if (req.method === "POST") {
      const origen = req.headers.origin;
      if (origen && new URL(origen).host !== req.headers.host) return json(res, 403, { error: "Origen no permitido." });
    }
    const ruta = rutas.find(([m, r]) => m === req.method && r.test(url.pathname));
    if (!ruta) return json(res, 404, { error: "No existe." });
    try {
      const cuerpo = req.method === "POST" ? await leerCuerpo(req) : {};
      const resultado = await ruta[2](url.pathname.match(ruta[1]).slice(1), cuerpo);
      return json(res, 200, resultado);
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  // Archivos de la planta.
  const relativo = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const archivo = path.join(PUBLICO, relativo);
  if (!archivo.startsWith(PUBLICO + path.sep) || !existsSync(archivo) || !statSync(archivo).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("No existe.");
  }
  res.writeHead(200, { "content-type": TIPOS[path.extname(archivo)] || "application/octet-stream", "cache-control": "no-cache" });
  createReadStream(archivo).pipe(res);
});

const puerto = Number(process.env.PORT || config.SERVIDOR.puerto);
const host = process.argv.includes("--movil") ? "0.0.0.0" : process.env.HOST || config.SERVIDOR.host;
servidor.on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `\n  El puerto ${puerto} ya está ocupado: ¿la oficina ya está abierta en otra ventana?\n` : e);
  process.exit(1);
});
// La oficina solo empieza a trabajar cuando tiene la puerta abierta.
servidor.listen(puerto, host, () => {
  oficina.iniciar();
  console.log(`\n  LA OFICINA abre sus puertas en http://${host}:${puerto}`);
  console.log(`  Ejecutor: ${ejecutor.descripcion}`);
  console.log(`  Archivo:  ${DATOS}\n`);
  if (host !== "127.0.0.1" && host !== "localhost") {
    const ips = Object.values(networkInterfaces())
      .flat()
      .filter((i) => i && i.family === "IPv4" && !i.internal)
      .map((i) => i.address);
    if (puerta.conClave) {
      console.log("  Desde el móvil (misma wifi):");
      for (const ip of ips) console.log(`    http://${ip}:${puerto}`);
      console.log("");
    } else {
      console.log("  Aviso: la oficina no tiene clave (OFICINA_CLAVE), así que solo se abre desde este ordenador.\n");
    }
  }
});

function cerrar() {
  almacen.volcar();
  process.exit(0);
}
process.on("SIGINT", cerrar);
process.on("SIGTERM", cerrar);
