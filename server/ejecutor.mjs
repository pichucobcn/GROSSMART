// El ejecutor: la línea entre Grossmart y Claude Code.
//   tipo "acp"      → puente ACP de Claude Code (cuenta del usuario)
//   tipo "simulado" → respuestas de ensayo, sin llamar a nadie

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SesionACP } from "./acp.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function crearEjecutor(config) {
  const tipo = process.env.OFICINA_EJECUTOR || config.tipo;
  if (tipo === "simulado") return ejecutorSimulado();
  return ejecutorACP(config);
}

function resolverComando(config) {
  if (process.env.OFICINA_ACP_COMANDO) return { comando: process.env.OFICINA_ACP_COMANDO, argumentos: [] };
  if (config.comando) return { comando: config.comando, argumentos: config.argumentos || [] };
  const local = path.join(RAIZ, "node_modules", ".bin", process.platform === "win32" ? "claude-agent-acp.cmd" : "claude-agent-acp");
  if (existsSync(local)) return { comando: local, argumentos: [] };
  return { comando: "npx", argumentos: ["-y", "@agentclientprotocol/claude-agent-acp"] };
}

function ejecutorACP(config) {
  const { comando, argumentos } = resolverComando(config);
  const enCurso = new Map();

  return {
    tipo: "acp",
    descripcion: `Claude Code vía ACP (${path.basename(comando)})`,

    async ejecutar({ id, prompt, cwd, alTexto, alEvento }) {
      mkdirSync(cwd, { recursive: true });
      const sesion = new SesionACP({
        comando,
        argumentos,
        entorno: config.entorno,
        cwd,
        autoAprobar: config.autoAprobarPermisos,
        herramientas: config.herramientas,
        alTexto: (t) => {
          texto += t;
          alTexto?.(t);
        },
        alEvento,
      });
      let texto = "";
      enCurso.set(id, sesion);
      const limite = (config.tiempoMaximoMinutos || 25) * 60_000;
      let reloj;
      try {
        await sesion.abrir();
        const resultado = await Promise.race([
          sesion.preguntar(prompt),
          new Promise((_, rechazar) => {
            reloj = setTimeout(() => {
              sesion.cancelar();
              rechazar(new Error(`La tarea superó los ${config.tiempoMaximoMinutos} minutos y se detuvo.`));
            }, limite);
          }),
        ]);
        if (resultado?.stopReason === "cancelled") throw new Error("La tarea fue cancelada.");
        if (resultado?.stopReason === "refusal") throw new Error("Claude Code rechazó la tarea.");
        if (!texto.trim()) throw new Error("Claude Code no devolvió texto.");
        return { texto, motivo: resultado?.stopReason };
      } finally {
        clearTimeout(reloj);
        enCurso.delete(id);
        sesion.cerrar();
      }
    },

    cancelar(id) {
      enCurso.get(id)?.cancelar();
    },

    // Comprueba que el puente arranca y responde al saludo ACP (no abre sesión).
    async comprobar() {
      const sesion = new SesionACP({ comando, argumentos, entorno: config.entorno, cwd: RAIZ });
      let reloj;
      try {
        const init = await Promise.race([
          sesion.saludar(),
          new Promise((_, r) => {
            reloj = setTimeout(() => r(new Error("El puente ACP no respondió.")), 30_000);
          }),
        ]);
        const info = init?.agentInfo;
        return { ok: true, detalle: info ? `${info.title || info.name} ${info.version || ""}`.trim() : "puente ACP listo" };
      } catch (e) {
        return { ok: false, detalle: e.message };
      } finally {
        clearTimeout(reloj);
        sesion.cerrar();
      }
    },
  };
}

// ── Ensayo ───────────────────────────────────────────────────────────────────
function ejecutorSimulado() {
  return {
    tipo: "simulado",
    descripcion: "Modo ensayo (sin Claude Code)",
    async ejecutar({ prompt, alTexto, tipoTrabajo }) {
      if (tipoTrabajo === "plan") return { texto: "(modo ensayo: Coordinación reparte por palabras clave)" };
      if (tipoTrabajo === "importacion") {
        const nombres = [...prompt.matchAll(/^- ([\w-]+): /gm)].map((m) => m[1]);
        const texto = (prompt.split("== TEXTO DE GROSSMAN ==\n")[1] || "").split("\n== FIN DEL TEXTO ==")[0];
        const proyectos = Object.fromEntries(nombres.filter((id) => texto.toLowerCase().includes(id.replace(/-/g, " "))).map((id) => [id, `(ensayo) Mencionado en el texto importado.`]));
        return { texto: "```json\n" + JSON.stringify({ perfil: "(ensayo) Perfil de prueba.", proyectos, otros: "" }) + "\n```" };
      }
      const tarea = (prompt.match(/== TU TAREA ==\n([^\n]+)/) || [])[1] || "el encargo";
      const texto = [
        `# ${tarea.slice(0, 90)}`,
        "",
        "*Documento de ensayo: Grossmart está en modo simulado y no ha llamado a Claude Code.*",
        "",
        "## Resumen",
        "",
        "Se ha revisado el encargo y el contexto del proyecto. Este texto ocupa el lugar del resultado real.",
        "",
        "## Próximos pasos",
        "",
        "1. Revisar el planteamiento.",
        "2. Confirmar prioridades con Grossman.",
        "3. Ejecutar con el ejecutor ACP.",
        "",
      ].join("\n");
      const pausa = Number(process.env.OFICINA_SIMULADO_PAUSA || 60);
      for (const trozo of texto.match(/[\s\S]{1,24}/g)) {
        await new Promise((r) => setTimeout(r, pausa));
        alTexto?.(trozo);
      }
      return { texto };
    },
    cancelar() {},
    async comprobar() {
      return { ok: true, detalle: "modo ensayo" };
    },
  };
}
