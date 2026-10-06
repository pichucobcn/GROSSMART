// Cliente mínimo del Agent Client Protocol (ACP): JSON-RPC 2.0 sobre stdio,
// un mensaje por línea. La Oficina hace de "cliente" (como AionUi o Zed) y el
// puente de Claude Code hace de "agente".

import { spawn } from "node:child_process";

const VERSION_PROTOCOLO = 1;

export class SesionACP {
  constructor({ comando, argumentos = [], entorno = {}, cwd, autoAprobar = true, alTexto, alEvento }) {
    this.comando = comando;
    this.argumentos = argumentos;
    this.entorno = entorno;
    this.cwd = cwd;
    this.autoAprobar = autoAprobar;
    this.alTexto = alTexto || (() => {});
    this.alEvento = alEvento || (() => {});
    this.siguienteId = 0;
    this.pendientes = new Map();
    this.buffer = "";
    this.stderr = "";
    this.proceso = null;
    this.sessionId = null;
  }

  arrancar() {
    this.proceso = spawn(this.comando, this.argumentos, {
      cwd: this.cwd,
      env: { ...process.env, ...this.entorno },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.proceso.stdout.setEncoding("utf8");
    this.proceso.stdout.on("data", (d) => this.#recibir(d));
    this.proceso.stderr.setEncoding("utf8");
    this.proceso.stderr.on("data", (d) => {
      this.stderr = (this.stderr + d).slice(-4000);
    });
    const fallar = (motivo) => {
      for (const { rechazar } of this.pendientes.values()) rechazar(new Error(motivo));
      this.pendientes.clear();
    };
    this.proceso.on("error", (e) => fallar(`No se pudo iniciar el puente ACP (${this.comando}): ${e.message}`));
    this.proceso.on("exit", (codigo) => {
      if (this.pendientes.size) {
        fallar(`El puente ACP se cerró (código ${codigo}). ${this.stderr.trim().slice(-600)}`);
      }
    });
  }

  saludar() {
    this.arrancar();
    return this.#llamar("initialize", {
      protocolVersion: VERSION_PROTOCOLO,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: "la-oficina", version: "0.1.0" },
    });
  }

  async abrir() {
    const init = await this.saludar();
    const sesion = await this.#llamar("session/new", { cwd: this.cwd, mcpServers: [] });
    this.sessionId = sesion.sessionId;
    return init;
  }

  async preguntar(texto) {
    const resultado = await this.#llamar("session/prompt", {
      sessionId: this.sessionId,
      prompt: [{ type: "text", text: texto }],
    });
    return resultado;
  }

  cancelar() {
    if (this.sessionId) this.#enviar({ jsonrpc: "2.0", method: "session/cancel", params: { sessionId: this.sessionId } });
  }

  cerrar() {
    if (this.proceso && this.proceso.exitCode === null) {
      this.proceso.stdin.end();
      this.proceso.kill("SIGTERM");
      setTimeout(() => this.proceso.exitCode === null && this.proceso.kill("SIGKILL"), 3000).unref();
    }
  }

  #enviar(mensaje) {
    if (this.proceso?.stdin.writable) this.proceso.stdin.write(JSON.stringify(mensaje) + "\n");
  }

  #llamar(method, params) {
    return new Promise((resolver, rechazar) => {
      const id = ++this.siguienteId;
      this.pendientes.set(id, { resolver, rechazar });
      this.#enviar({ jsonrpc: "2.0", id, method, params });
    });
  }

  #recibir(trozo) {
    this.buffer += trozo;
    let n;
    while ((n = this.buffer.indexOf("\n")) >= 0) {
      const linea = this.buffer.slice(0, n).trim();
      this.buffer = this.buffer.slice(n + 1);
      if (!linea) continue;
      let mensaje;
      try {
        mensaje = JSON.parse(linea);
      } catch {
        continue;
      }
      this.#procesar(mensaje);
    }
  }

  #procesar(m) {
    // Respuesta a una llamada nuestra.
    if (m.id != null && !m.method) {
      const p = this.pendientes.get(m.id);
      if (!p) return;
      this.pendientes.delete(m.id);
      if (m.error) p.rechazar(new Error(m.error.message || JSON.stringify(m.error)));
      else p.resolver(m.result);
      return;
    }
    // Notificaciones del agente.
    if (m.method === "session/update") {
      const u = m.params?.update || {};
      if (u.sessionUpdate === "agent_message_chunk" && u.content?.type === "text") {
        this.alTexto(u.content.text);
      } else if (u.sessionUpdate === "tool_call") {
        this.alEvento({ tipo: "herramienta", titulo: u.title || u.kind || "herramienta" });
      }
      return;
    }
    // Peticiones del agente al cliente.
    if (m.id != null) {
      if (m.method === "session/request_permission") {
        const opciones = m.params?.options || [];
        const permitir = opciones.find((o) => o.kind === "allow_once") || opciones.find((o) => o.kind?.startsWith("allow"));
        const rechazar = opciones.find((o) => o.kind?.startsWith("reject"));
        const elegida = this.autoAprobar ? permitir : rechazar;
        this.alEvento({ tipo: "permiso", titulo: m.params?.toolCall?.title || "herramienta", concedido: elegida === permitir });
        this.#enviar({
          jsonrpc: "2.0",
          id: m.id,
          result: { outcome: elegida ? { outcome: "selected", optionId: elegida.optionId } : { outcome: "cancelled" } },
        });
        return;
      }
      this.#enviar({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: `La Oficina no implementa ${m.method}` } });
    }
  }
}
