// La puerta de la oficina.
//
// Desde el propio ordenador se entra sin más. Desde otro aparato (el móvil en
// la misma wifi) hace falta la clave de la oficina: la oficina ejecuta Claude
// Code en este ordenador y no puede quedar abierta a cualquiera de la red.

import { createHash, timingSafeEqual } from "node:crypto";

const LOCALES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const COOKIE = "oficina_llave";

// Lo que se puede servir sin clave: la propia página de entrada y los iconos.
const LIBRES = new Set(["/entrar", "/oficina.css", "/manifest.webmanifest", "/icono.svg", "/icono-192.png", "/icono-512.png", "/icono-apple.png", "/sombrero.svg"]);

export function crearPuerta(clave) {
  const llave = clave ? createHash("sha256").update(`la-oficina:${clave}`).digest("hex") : null;

  // Del propio ordenador, o de un aparato de tu red privada de Tailscale
  // (`tailscale serve` reenvía desde este mismo ordenador y firma al usuario).
  // Algo reenviado sin esa firma (un túnel público, por ejemplo) pide clave.
  function esLocal(req) {
    if (!LOCALES.has(req.socket.remoteAddress)) return false;
    return !req.headers["x-forwarded-for"] || Boolean(req.headers["tailscale-user-login"]);
  }

  function tieneLlave(req) {
    if (!llave) return false;
    const valor = (req.headers.cookie || "")
      .split(";")
      .map((c) => c.trim().split("="))
      .find(([k]) => k === COOKIE)?.[1];
    if (!valor || valor.length !== llave.length) return false;
    return timingSafeEqual(Buffer.from(valor), Buffer.from(llave));
  }

  function claveCorrecta(intento) {
    if (!clave) return false;
    const a = createHash("sha256").update(String(intento)).digest();
    const b = createHash("sha256").update(clave).digest();
    return timingSafeEqual(a, b);
  }

  // Devuelve true si la petición puede pasar; si no, responde y devuelve false.
  async function atender(req, res, ruta) {
    if (esLocal(req) || tieneLlave(req)) {
      if (ruta === "/entrar") {
        res.writeHead(303, { location: "/" });
        res.end();
        return false;
      }
      return true;
    }

    if (ruta === "/entrar" && req.method === "POST") {
      let cuerpo = "";
      for await (const trozo of req) {
        cuerpo += trozo;
        if (cuerpo.length > 2000) break;
      }
      const intento = new URLSearchParams(cuerpo).get("clave") || "";
      if (claveCorrecta(intento)) {
        res.writeHead(303, {
          location: "/",
          "set-cookie": `${COOKIE}=${llave}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`,
        });
        res.end();
      } else {
        await new Promise((r) => setTimeout(r, 1200)); // freno a quien pruebe claves
        paginaEntrada(res, 401, "Esa no es la clave de la oficina.");
      }
      return false;
    }

    if (LIBRES.has(ruta)) {
      if (ruta === "/entrar") {
        paginaEntrada(res, 200, clave ? null : "Esta oficina no tiene clave y solo se abre desde su propio ordenador.");
        return false;
      }
      return true;
    }

    if (ruta.startsWith("/api/")) {
      res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Hace falta la clave de la oficina." }));
    } else {
      res.writeHead(303, { location: "/entrar" });
      res.end();
    }
    return false;
  }

  return { atender, conClave: Boolean(clave) };
}

function paginaEntrada(res, codigo, mensaje) {
  res.writeHead(codigo, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#4A3024">
  <title>La Oficina</title>
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/icono-apple.png">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&family=Playfair+Display:wght@800&family=Special+Elite&display=swap">
  <link rel="stylesheet" href="/oficina.css">
</head>
<body class="entrada">
  <main class="puerta">
    <h1>La Oficina</h1>
    <p class="subtitulo">La mente de Grossman</p>
    <form method="post" action="/entrar" class="formulario-encargo">
      <label class="encargo-rotulo" for="clave">Clave de la oficina</label>
      <input id="clave" name="clave" type="password" autocomplete="current-password" required autofocus>
      ${mensaje ? `<p class="puerta-aviso">${mensaje}</p>` : ""}
      <button class="boton boton-principal" type="submit">Entrar</button>
    </form>
  </main>
</body>
</html>`);
}
