// La puerta de Grossmart.
//
// · Desde el propio ordenador se entra sin clave (solo si la petición viene de
//   este ordenador Y va dirigida a "localhost": así una web maliciosa no puede
//   colarse con trucos de DNS).
// · Desde Tailscale (`tailscale serve`) también, porque Tailscale firma a la
//   persona de tu red privada.
// · Desde cualquier otro sitio hace falta la clave. En la nube
//   (OFICINA_EN_LA_NUBE) siempre hace falta, sin excepciones.
//
// La sesión es una cookie firmada que caduca a los 30 días. Cambiar la clave
// (o el secreto del servidor) cierra todas las sesiones abiertas. Tras varios
// intentos fallidos, la puerta se cierra un rato para esa dirección, y para
// todos si los fallos vienen de muchas direcciones a la vez.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const LOCALES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const COOKIE = "oficina_sesion";
const DURACION_SESION = 30 * 24 * 60 * 60 * 1000;
const VENTANA = 15 * 60 * 1000;
const FALLOS_POR_IP = 5;
const FALLOS_GLOBALES = 30;
export const LARGO_MINIMO_CLAVE = 12;

// Lo que se puede servir sin clave: la propia página de entrada, su estilo y los iconos.
const LIBRES = new Set([
  "/entrar",
  "/salud",
  "/oficina.css",
  "/manifest.webmanifest",
  "/icono.svg",
  "/icono-192.png",
  "/icono-512.png",
  "/icono-apple.png",
]);

export function crearPuerta({ clave, enLaNube = false, dirDatos, registro = console }) {
  clave = clave || "";
  const secreto = clave ? leerSecreto(dirDatos) : null;
  const llaveFirma = clave ? createHmac("sha256", secreto).update(`clave:${clave}`).digest() : null;
  const fallos = new Map(); // ip → [instantes]
  let fallosGlobales = [];

  // ── identidad de quien llama ──
  function ipCliente(req) {
    // En la nube, el proxy de la plataforma añade la IP real al final.
    if (enLaNube) {
      const reenvio = String(req.headers["x-forwarded-for"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (reenvio.length) return reenvio.at(-1);
    }
    return req.socket.remoteAddress || "?";
  }

  function esLocal(req) {
    if (enLaNube) return false;
    if (!LOCALES.has(req.socket.remoteAddress)) return false;
    if (req.headers["tailscale-user-login"]) return true; // tailscale serve
    if (req.headers["x-forwarded-for"]) return false; // otro reenvío: clave
    // Contra DNS rebinding: la petición tiene que ir dirigida a este ordenador.
    const host = String(req.headers.host || "").replace(/:\d+$/, "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  }

  // ── sesiones firmadas ──
  function firmar(emitida) {
    return createHmac("sha256", llaveFirma).update(`sesion:${emitida}`).digest("hex");
  }

  function crearSesion() {
    const emitida = Date.now();
    return `v1.${emitida}.${firmar(emitida)}`;
  }

  function sesionValida(req) {
    if (!llaveFirma) return false;
    const valor = leerCookie(req, COOKIE);
    const m = /^v1\.(\d{13})\.([0-9a-f]{64})$/.exec(valor || "");
    if (!m) return false;
    const emitida = Number(m[1]);
    if (Date.now() - emitida > DURACION_SESION || emitida > Date.now() + 60_000) return false;
    return iguales(m[2], firmar(emitida));
  }

  function claveCorrecta(intento) {
    if (!clave) return false;
    const a = createHash("sha256").update(String(intento)).digest();
    const b = createHash("sha256").update(clave).digest();
    return timingSafeEqual(a, b);
  }

  // ── freno a quien pruebe claves ──
  function recientes(lista) {
    const limite = Date.now() - VENTANA;
    return lista.filter((t) => t > limite);
  }

  function bloqueada(ip) {
    fallosGlobales = recientes(fallosGlobales);
    const deEsa = recientes(fallos.get(ip) || []);
    fallos.set(ip, deEsa);
    return deEsa.length >= FALLOS_POR_IP || fallosGlobales.length >= FALLOS_GLOBALES;
  }

  function apuntarFallo(ip) {
    const ahora = Date.now();
    fallos.set(ip, [...recientes(fallos.get(ip) || []), ahora]);
    fallosGlobales.push(ahora);
    if (fallos.size > 10_000) fallos.clear(); // que nadie llene la memoria con IPs falsas
    registro.warn(`[puerta] clave incorrecta desde ${ip} (${fallos.get(ip).length} en 15 min, ${fallosGlobales.length} en total)`);
  }

  // Devuelve true si la petición puede pasar; si no, responde y devuelve false.
  async function atender(req, res, ruta) {
    const segura = req.headers["x-forwarded-proto"] === "https" || Boolean(req.socket.encrypted);

    if (ruta === "/salir" && req.method === "POST") {
      res.writeHead(303, { location: "/entrar", "set-cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${segura ? "; Secure" : ""}` });
      res.end();
      return false;
    }

    if (esLocal(req) || sesionValida(req)) {
      if (ruta === "/entrar") {
        res.writeHead(303, { location: "/" });
        res.end();
        return false;
      }
      return true;
    }

    if (ruta === "/entrar" && req.method === "POST") {
      const ip = ipCliente(req);
      if (bloqueada(ip)) {
        registro.warn(`[puerta] intento bloqueado desde ${ip}`);
        paginaEntrada(res, 429, "Demasiados intentos. Espere un cuarto de hora.");
        return false;
      }
      let cuerpo = "";
      for await (const trozo of req) {
        cuerpo += trozo;
        if (cuerpo.length > 2000) break;
      }
      const intento = new URLSearchParams(cuerpo).get("clave") || "";
      if (claveCorrecta(intento)) {
        fallos.delete(ip);
        registro.log(`[puerta] entrada correcta desde ${ip}`);
        res.writeHead(303, {
          location: "/",
          "set-cookie": `${COOKIE}=${crearSesion()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DURACION_SESION / 1000}${segura ? "; Secure" : ""}`,
        });
        res.end();
      } else {
        apuntarFallo(ip);
        await new Promise((r) => setTimeout(r, 1000));
        paginaEntrada(res, 401, "Esa no es la clave de Grossmart.");
      }
      return false;
    }

    if (LIBRES.has(ruta)) {
      if (ruta === "/entrar") {
        paginaEntrada(res, 200, clave ? null : "Grossmart no tiene clave y solo se abre desde su propio ordenador.");
        return false;
      }
      return true;
    }

    if (ruta.startsWith("/api/")) {
      res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Hace falta la clave de Grossmart." }));
    } else {
      res.writeHead(303, { location: "/entrar" });
      res.end();
    }
    return false;
  }

  return { atender, conClave: Boolean(clave), ipCliente };
}

// Secreto aleatorio del servidor, guardado junto al archivo de Grossmart.
// Borrarlo cierra todas las sesiones.
function leerSecreto(dirDatos) {
  const archivo = path.join(dirDatos, "secreto-sesiones");
  if (existsSync(archivo)) {
    const s = readFileSync(archivo);
    if (s.length >= 32) return s;
  }
  mkdirSync(dirDatos, { recursive: true });
  const nuevo = randomBytes(32);
  writeFileSync(archivo, nuevo, { mode: 0o600 });
  return nuevo;
}

function leerCookie(req, nombre) {
  for (const parte of String(req.headers.cookie || "").split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim();
  }
  return null;
}

function iguales(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function paginaEntrada(res, codigo, mensaje) {
  res.writeHead(codigo, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#4A3024">
  <meta name="robots" content="noindex, nofollow">
  <title>Grossmart</title>
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/icono-apple.png">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&family=Playfair+Display:wght@800&family=Special+Elite&display=swap">
  <link rel="stylesheet" href="/oficina.css">
</head>
<body class="entrada">
  <main class="puerta">
    <h1>Grossmart</h1>
    <p class="subtitulo">La mente de Grossman</p>
    <form method="post" action="/entrar" class="formulario-encargo">
      <label class="encargo-rotulo" for="clave">Clave de Grossmart</label>
      <input id="clave" name="clave" type="password" autocomplete="current-password" required autofocus>
      ${mensaje ? `<p class="puerta-aviso">${mensaje}</p>` : ""}
      <button class="boton boton-principal" type="submit">Entrar</button>
    </form>
  </main>
</body>
</html>`);
}
