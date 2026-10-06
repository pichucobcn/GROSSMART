// Inicio de sesión con Microsoft para Hotmail/Outlook.com (OAuth, «código de
// dispositivo»): Grossmart muestra un código, Grossman lo escribe en la web de
// Microsoft y acepta. Grossmart nunca ve su contraseña.
//
// El permiso que se pide es solo IMAP (leer y organizar el correo, y guardar
// borradores) más «offline_access» para renovarlo. El token de renovación se
// guarda cifrado (AES-256-GCM) con una llave que sale de OFICINA_CLAVE.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ALCANCE = "https://outlook.office.com/IMAP.AccessAsUser.All offline_access";

export class SesionMicrosoft {
  constructor({ clientId, tenant = "consumers", dirDatos, llave, registro = console }) {
    this.clientId = clientId;
    this.base = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0`;
    this.archivo = path.join(dirDatos, "correo", "microsoft.json");
    this.llave = derivarLlave(llave, dirDatos);
    this.registro = registro;
    this.acceso = null; // { token, caduca }
    this.pendiente = null; // inicio de sesión en curso
  }

  get conectada() {
    return existsSync(this.archivo);
  }

  // Paso 1: pedir a Microsoft un código para que Grossman lo escriba.
  async iniciar() {
    const r = await this.#post("devicecode", { client_id: this.clientId, scope: ALCANCE });
    const pendiente = {
      codigo: r.user_code,
      enlace: r.verification_uri,
      caduca: Date.now() + r.expires_in * 1000,
      estado: "esperando",
    };
    this.pendiente = pendiente;
    this.#esperar(r.device_code, (r.interval || 5) * 1000, pendiente);
    return { codigo: pendiente.codigo, enlace: pendiente.enlace, caduca: new Date(pendiente.caduca).toISOString() };
  }

  estadoInicio() {
    return this.pendiente ? { estado: this.pendiente.estado, error: this.pendiente.error || null } : null;
  }

  // Paso 2 (en segundo plano): esperar a que Grossman acepte.
  async #esperar(deviceCode, intervalo, pendiente) {
    while (Date.now() < pendiente.caduca && this.pendiente === pendiente) {
      await new Promise((r) => setTimeout(r, intervalo));
      try {
        const r = await this.#post("token", {
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          client_id: this.clientId,
          device_code: deviceCode,
        });
        this.#guardar(r);
        pendiente.estado = "conectada";
        this.registro.log("[correo] Hotmail conectada.");
        return;
      } catch (e) {
        if (e.codigo === "authorization_pending") continue;
        if (e.codigo === "slow_down") {
          intervalo += 5000;
          continue;
        }
        pendiente.estado = "error";
        pendiente.error = e.message;
        return;
      }
    }
    if (pendiente.estado === "esperando") pendiente.estado = "caducado";
  }

  // Token de acceso vigente (lo renueva si hace falta).
  async token() {
    if (this.acceso && this.acceso.caduca > Date.now() + 60_000) return this.acceso.token;
    const refresco = this.#leer();
    if (!refresco) throw new Error("Hotmail no está conectada. Conéctela desde la pestaña Correo.");
    const r = await this.#post("token", { grant_type: "refresh_token", client_id: this.clientId, refresh_token: refresco, scope: ALCANCE });
    this.#guardar(r);
    return this.acceso.token;
  }

  desconectar() {
    rmSync(this.archivo, { force: true });
    this.acceso = null;
    this.pendiente = null;
  }

  #guardar(r) {
    this.acceso = { token: r.access_token, caduca: Date.now() + (r.expires_in || 3600) * 1000 };
    if (r.refresh_token) {
      mkdirSync(path.dirname(this.archivo), { recursive: true });
      const iv = randomBytes(12);
      const c = createCipheriv("aes-256-gcm", this.llave, iv);
      const datos = Buffer.concat([c.update(r.refresh_token, "utf8"), c.final()]);
      writeFileSync(this.archivo, JSON.stringify({ iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), datos: datos.toString("base64") }), { mode: 0o600 });
    }
  }

  #leer() {
    if (!existsSync(this.archivo)) return null;
    try {
      const { iv, tag, datos } = JSON.parse(readFileSync(this.archivo, "utf8"));
      const d = createDecipheriv("aes-256-gcm", this.llave, Buffer.from(iv, "base64"));
      d.setAuthTag(Buffer.from(tag, "base64"));
      return Buffer.concat([d.update(Buffer.from(datos, "base64")), d.final()]).toString("utf8");
    } catch {
      // Cambió OFICINA_CLAVE o el archivo está dañado: hay que volver a conectar.
      return null;
    }
  }

  async #post(ruta, campos) {
    const res = await fetch(`${this.base}/${ruta}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(campos),
      signal: AbortSignal.timeout(20_000),
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(datos.error_description?.split("\r\n")[0] || datos.error || `Microsoft respondió ${res.status}`);
      e.codigo = datos.error;
      throw e;
    }
    return datos;
  }
}

function derivarLlave(llave, dirDatos) {
  const archivoSal = path.join(dirDatos, "correo", "sal");
  mkdirSync(path.dirname(archivoSal), { recursive: true });
  if (!existsSync(archivoSal)) writeFileSync(archivoSal, randomBytes(16), { mode: 0o600 });
  return scryptSync(String(llave || "grossmart-local"), readFileSync(archivoSal), 32);
}
