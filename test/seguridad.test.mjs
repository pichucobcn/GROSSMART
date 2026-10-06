// Pruebas de seguridad: se arranca la oficina de verdad (en modo ensayo) y se
// la ataca como lo haría alguien de fuera.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { permisoSeguro } from "../server/acp.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLAVE = "una-clave-de-prueba-larga";

function arrancar(entorno, args = []) {
  const puerto = 20000 + Math.floor(Math.random() * 20000);
  const proceso = spawn(process.execPath, ["server/index.mjs", ...args], {
    cwd: RAIZ,
    env: {
      ...process.env,
      OFICINA_EJECUTOR: "simulado",
      OFICINA_DATOS: mkdtempSync(path.join(tmpdir(), "oficina-seg-")),
      PORT: String(puerto),
      // Como en el contenedor: si las pruebas corren como root, la oficina baja a un usuario normal.
      ...(process.getuid?.() === 0 ? { OFICINA_USUARIO: "nobody" } : {}),
      ...entorno,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let salida = "";
  proceso.stdout.on("data", (d) => (salida += d));
  proceso.stderr.on("data", (d) => (salida += d));
  const listo = new Promise((ok, mal) => {
    const reloj = setTimeout(() => mal(new Error(`no arrancó: ${salida}`)), 8000);
    proceso.stdout.on("data", () => salida.includes("abre sus puertas") && (clearTimeout(reloj), ok()));
    proceso.on("exit", (codigo) => (clearTimeout(reloj), mal(Object.assign(new Error(salida), { codigo }))));
  });
  listo.catch(() => {}); // las pruebas de arranque fallido esperan la salida, no esto
  return { proceso, puerto, listo, salida: () => salida };
}

// Petición «a mano»: permite rutas y cabeceras que fetch corrige o prohíbe.
function crudo(puerto, ruta, cabeceras = {}) {
  return new Promise((ok, mal) => {
    http.get({ host: "127.0.0.1", port: puerto, path: ruta, headers: cabeceras }, (res) => (res.resume(), ok(res.statusCode))).on("error", mal);
  });
}

function salidaDe(proceso) {
  return new Promise((ok) => proceso.on("exit", (codigo) => ok(codigo)));
}

describe("arranque", () => {
  test("abierta a la red sin clave, no arranca", async () => {
    const { proceso } = arrancar({ HOST: "0.0.0.0", OFICINA_CLAVE: "" });
    assert.equal(await salidaDe(proceso), 1);
  });
  test("en la nube con una clave corta, no arranca", async () => {
    const { proceso } = arrancar({ HOST: "0.0.0.0", OFICINA_EN_LA_NUBE: "1", OFICINA_CLAVE: "corta" });
    assert.equal(await salidaDe(proceso), 1);
  });
});

describe("en la nube", () => {
  let srv;
  let base;
  before(async () => {
    srv = arrancar({ HOST: "127.0.0.1", OFICINA_EN_LA_NUBE: "1", OFICINA_CLAVE: CLAVE });
    await srv.listo;
    base = `http://127.0.0.1:${srv.puerto}`;
  });
  after(() => srv.proceso.kill());

  const pedir = (ruta, opciones = {}) => fetch(base + ruta, { redirect: "manual", ...opciones });
  const entrar = (clave, ip = "203.0.113.1") =>
    pedir("/entrar", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": ip, "x-forwarded-proto": "https" },
      body: new URLSearchParams({ clave }),
    });

  test("cabeceras de seguridad en todas las respuestas", async () => {
    const r = await pedir("/salud");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-security-policy"), /script-src 'self'/);
    assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.match(r.headers.get("strict-transport-security"), /max-age/);
  });

  test("sin sesión no se ve nada (ni siquiera desde el propio servidor)", async () => {
    assert.equal((await pedir("/")).status, 303);
    assert.equal((await pedir("/api/estado")).status, 401);
    assert.equal((await pedir("/api/eventos")).status, 401);
    assert.equal((await pedir("/app.js")).status, 303);
    assert.equal((await pedir("/api/estado", { headers: { "tailscale-user-login": "intruso@x" } })).status, 401);
  });

  test("una cookie inventada o manipulada no sirve", async () => {
    for (const cookie of [
      "oficina_sesion=v1.1791300000000.0000000000000000000000000000000000000000000000000000000000000000",
      "oficina_sesion=admin",
      "oficina_llave=" + "a".repeat(64),
    ]) {
      assert.equal((await pedir("/api/estado", { headers: { cookie } })).status, 401, cookie);
    }
  });

  test("con la clave buena se entra; la cookie es segura", async () => {
    const r = await entrar(CLAVE, "203.0.113.9");
    assert.equal(r.status, 303);
    const cookie = r.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Secure/);
    const sesion = cookie.split(";")[0];
    assert.equal((await pedir("/api/estado", { headers: { cookie: sesion } })).status, 200);
    // Cambiar un solo carácter de la firma invalida la sesión.
    const manipulada = sesion.slice(0, -1) + (sesion.endsWith("0") ? "1" : "0");
    assert.equal((await pedir("/api/estado", { headers: { cookie: manipulada } })).status, 401);
  });

  test("tras 5 claves malas, esa dirección queda bloqueada aunque acierte", async () => {
    for (let i = 0; i < 5; i++) assert.equal((await entrar("probando-" + i, "198.51.100.7")).status, 401);
    assert.equal((await entrar(CLAVE, "198.51.100.7")).status, 429);
    assert.equal((await entrar(CLAVE, "203.0.113.50")).status, 303, "otra dirección sigue pudiendo entrar");
  });

  test("escrituras: solo desde la propia oficina y en JSON", async () => {
    const sesion = (await entrar(CLAVE, "203.0.113.10")).headers.get("set-cookie").split(";")[0];
    const encargo = (cabeceras) =>
      pedir("/api/tareas", {
        method: "POST",
        headers: { cookie: sesion, ...cabeceras },
        body: JSON.stringify({ agente: "marketing", texto: "Prueba", proyecto: "isla", ejecutar: false }),
      });
    assert.equal((await encargo({ "content-type": "text/plain", origin: base })).status, 403, "formulario de otra web");
    assert.equal((await encargo({ "content-type": "application/json", origin: "https://malvada.example" })).status, 403, "otro origen");
    assert.equal((await encargo({ "content-type": "application/json", "sec-fetch-site": "cross-site" })).status, 403, "cross-site");
    assert.equal((await encargo({ "content-type": "application/json" })).status, 403, "sin origen, en la nube");
    assert.equal((await encargo({ "content-type": "application/json", origin: base })).status, 200, "la propia oficina");
  });

  test("datos maliciosos se rechazan", async () => {
    const sesion = (await entrar(CLAVE, "203.0.113.11")).headers.get("set-cookie").split(";")[0];
    const post = (ruta, cuerpo) =>
      pedir(ruta, { method: "POST", headers: { cookie: sesion, "content-type": "application/json", origin: base }, body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) });
    assert.equal((await post("/api/proyectos", { nombre: "X", color: '#000" onmouseover="alert(1)' })).status, 400, "color con código");
    assert.equal((await post("/api/proyectos", { nombre: "x".repeat(500) })).status, 400, "nombre enorme");
    assert.equal((await post("/api/encargos", { texto: { $gt: "" } })).status, 400, "objeto en vez de texto");
    assert.equal((await post("/api/encargos", "[]")).status, 400, "lista en vez de objeto");
    assert.equal((await post("/api/encargos", "{no es json")).status, 400, "JSON roto");
    assert.equal((await post("/api/encargos", { texto: "x".repeat(300_000) })).status, 400, "cuerpo gigante");
    assert.equal((await post("/api/proyectos/..%2f..%2fetc/memoria", { campo: "contexto", texto: "x" })).status, 404, "ruta con ../");
  });

  test("rutas raras no tumban el servidor ni sacan archivos de fuera", async () => {
    const sesion = (await entrar(CLAVE, "203.0.113.12")).headers.get("set-cookie").split(";")[0];
    for (const ruta of ["/..%2f..%2fpackage.json", "/%2e%2e/server/index.mjs", "/%E0%A4%A", "/%00", "/....//config/oficina.config.mjs"]) {
      assert.equal(await crudo(srv.puerto, ruta, { cookie: sesion }), 404, ruta);
    }
    assert.equal((await pedir("/api/estado", { method: "DELETE", headers: { cookie: sesion } })).status, 405);
    assert.equal((await pedir("/salud")).status, 200, "sigue en pie");
  });
});

describe("en un ordenador propio", () => {
  let srv;
  let base;
  before(async () => {
    srv = arrancar({ OFICINA_CLAVE: "" });
    await srv.listo;
    base = `http://127.0.0.1:${srv.puerto}`;
  });
  after(() => srv.proceso.kill());

  test("desde este ordenador se entra sin clave", async () => {
    assert.equal((await fetch(`${base}/api/estado`)).status, 200);
  });

  test("una web que se hace pasar por localhost (DNS rebinding) no entra", async () => {
    assert.equal(await crudo(srv.puerto, "/api/estado", { host: "malvada.example" }), 401);
    assert.equal(await crudo(srv.puerto, "/api/estado", { host: `localhost:${srv.puerto}` }), 200);
  });

  test("un reenvío público (túnel) sin Tailscale no entra", async () => {
    assert.equal((await fetch(`${base}/api/estado`, { headers: { "x-forwarded-for": "1.2.3.4" } })).status, 401);
  });
});

describe("privilegios", () => {
  test("como root en la nube y sin usuario al que bajar, no arranca", { skip: process.getuid?.() !== 0 }, async () => {
    const { proceso } = arrancar({ HOST: "0.0.0.0", OFICINA_EN_LA_NUBE: "1", OFICINA_CLAVE: CLAVE, OFICINA_USUARIO: "" });
    assert.equal(await salidaDe(proceso), 1);
  });
});

describe("permisos de los agentes", () => {
  const cwd = "/datos/proyectos/isla/archivo";
  test("nunca ejecutar comandos", () => {
    assert.equal(permisoSeguro({ kind: "execute", title: "rm -rf /" }, cwd), false);
    assert.equal(permisoSeguro({ kind: "delete" }, cwd), false);
    assert.equal(permisoSeguro({ kind: "other" }, cwd), false);
    assert.equal(permisoSeguro(undefined, cwd), false);
  });
  test("leer y editar solo dentro de la carpeta del proyecto", () => {
    assert.equal(permisoSeguro({ kind: "read", locations: [{ path: `${cwd}/notas.md` }] }, cwd), true);
    assert.equal(permisoSeguro({ kind: "edit", locations: [{ path: "informe.md" }] }, cwd), true);
    assert.equal(permisoSeguro({ kind: "read", locations: [{ path: "/proc/self/environ" }] }, cwd), false);
    assert.equal(permisoSeguro({ kind: "edit", locations: [{ path: "../../pichuco/archivo/x.md" }] }, cwd), false);
    assert.equal(permisoSeguro({ kind: "read", locations: [{ path: `${cwd}-falso/x` }] }, cwd), false);
  });
  test("buscar en la web, sí", () => {
    assert.equal(permisoSeguro({ kind: "fetch", title: "https://example.com" }, cwd), true);
    assert.equal(permisoSeguro({ kind: "search" }, cwd), true);
  });
});
