import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import * as config from "../config/oficina.config.mjs";
import { Almacen } from "../server/almacen.mjs";
import { Oficina } from "../server/oficina.mjs";

// Ejecutor de prueba: guarda los textos que recibe y responde lo que se le diga.
function ejecutorFalso(responder) {
  const recibidos = [];
  return {
    tipo: "prueba",
    descripcion: "prueba",
    recibidos,
    async ejecutar(trabajo) {
      recibidos.push(trabajo);
      return { texto: await responder(trabajo) };
    },
    cancelar() {},
    async comprobar() {
      return { ok: true, detalle: "prueba" };
    },
  };
}

function montar(responder, dir = mkdtempSync(path.join(tmpdir(), "oficina-"))) {
  const almacen = new Almacen(dir);
  const ejecutor = ejecutorFalso(responder);
  const oficina = new Oficina({ config, almacen, ejecutor });
  oficina.iniciar();
  return { oficina, almacen, ejecutor, dir };
}

const esperar = (cond, ms = 3000) =>
  new Promise((ok, mal) => {
    const inicio = Date.now();
    const mirar = () => (cond() ? ok() : Date.now() - inicio > ms ? mal(new Error("tiempo agotado")) : setTimeout(mirar, 10));
    mirar();
  });

test("Coordinación reconoce el proyecto por nombre y palabras clave", () => {
  const { oficina } = montar(() => "");
  assert.equal(oficina.detectarProyecto("Qué tenemos pendiente de Barnabeat antes del festival"), "barnabeat");
  assert.equal(oficina.detectarProyecto("Vender las pizzas congeladas en Alemania"), "pichuco");
  assert.equal(oficina.detectarProyecto("Lanzamiento de Open Folk"), "open-folk");
  assert.equal(oficina.detectarProyecto("Revisar el seguro del coche"), null);
});

test("un encargo general se planifica, se reparte con dependencias y se consolida", async () => {
  const { oficina, almacen, ejecutor } = montar(({ tipoTrabajo, prompt }) => {
    if (tipoTrabajo === "plan") {
      return "```json\n" +
        JSON.stringify({
          proyecto: "pichuco",
          objetivo: "Estudiar la venta en Alemania",
          resumen: "Investigación primero, después costes.",
          tareas: [
            { agente: "investigacion", titulo: "Mercado alemán", descripcion: "Analizar", prioridad: "alta", dependeDe: [] },
            { agente: "finanzas", titulo: "Costes", descripcion: "Calcular", prioridad: "normal", dependeDe: [0] },
            { agente: "coordinacion", titulo: "No debe asignarse", descripcion: "x", dependeDe: [] },
            { agente: "inexistente", titulo: "Tampoco", descripcion: "x", dependeDe: [] },
          ],
        }) +
        "\n```";
    }
    if (prompt.includes("== TU TAREA ==\nCostes")) {
      assert.match(prompt, /Mercado alemán/, "Finanzas recibe el resultado de Investigación");
      return "# Costes\nTodo en orden.";
    }
    return "# Documento\nHecho.\n\n## Para la memoria del proyecto\n- El distribuidor alemán se llama Müller.";
  });

  const encargo = oficina.recibirEncargo({ texto: "Quiero estudiar si podemos vender las pizzas congeladas en Alemania." });
  await esperar(() => almacen.encargo(encargo.id).estado === "entregado");

  const e = almacen.encargo(encargo.id);
  assert.equal(e.proyecto, "pichuco");
  assert.equal(e.tareas.length, 2, "descarta al coordinador y a agentes desconocidos");
  const [inv, fin] = e.tareas.map((id) => almacen.tarea(id));
  assert.deepEqual(fin.dependeDe, [inv.id]);
  assert.ok(e.informe, "Coordinación entrega el informe");
  const orden = ejecutor.recibidos.map((r) => r.tipoTrabajo + ":" + (r.prompt.match(/== TU TAREA ==\n(.+)/) || [])[1]);
  assert.ok(orden.indexOf("tarea:Mercado alemán") < orden.indexOf("tarea:Costes"), "respeta dependencias");
  assert.equal(orden.at(-1).startsWith("informe"), true);
  assert.ok(almacen.memoria("pichuco").notas.some((n) => n.texto.includes("Müller")), "la memoria del proyecto se alimenta");
});

test("el contexto de un proyecto no se mezcla con otro", async () => {
  const { oficina, almacen, ejecutor } = montar(() => "# Hecho\nResultado secreto de Barnabeat");
  oficina.editarMemoria("barnabeat", { campo: "contexto", texto: "Cartel confidencial de Barnabeat" });
  oficina.editarMemoria("pichuco", { campo: "decisiones", texto: "Masa madre de 48 horas" });
  const t1 = oficina.asignarTarea({ agente: "marketing", texto: "Comunicación del festival", proyecto: "barnabeat" });
  await esperar(() => almacen.tarea(t1.id).estado === "terminada");
  const t2 = oficina.asignarTarea({ agente: "marketing", texto: "Campaña de octubre", proyecto: "pichuco" });
  await esperar(() => almacen.tarea(t2.id).estado === "terminada");

  const promptPichuco = ejecutor.recibidos.at(-1).prompt;
  assert.match(promptPichuco, /Masa madre de 48 horas/);
  assert.doesNotMatch(promptPichuco, /Barnabeat/);
  assert.match(ejecutor.recibidos.at(-1).cwd, /proyectos[\\/]pichuco[\\/]archivo$/);
});

test("una pregunta para Grossman deja la tarea esperando hasta que responde", async () => {
  let vueltas = 0;
  const { oficina, almacen, ejecutor } = montar(() =>
    ++vueltas === 1 ? "# Avance\nFalta un dato.\n\nPREGUNTA PARA GROSSMAN: ¿Qué presupuesto hay?" : "# Plan final\nCon 3.000 €.",
  );
  const t = oficina.asignarTarea({ agente: "marketing", texto: "Campaña", proyecto: "isla" });
  await esperar(() => almacen.tarea(t.id).esperaGrossman);
  assert.equal(almacen.tarea(t.id).estado, "esperando");
  assert.equal(almacen.tarea(t.id).pregunta, "¿Qué presupuesto hay?");

  oficina.accion(t.id, "responder", { respuesta: "3.000 euros" });
  await esperar(() => almacen.tarea(t.id).estado === "terminada");
  assert.match(ejecutor.recibidos.at(-1).prompt, /3\.000 euros/);
  assert.match(almacen.tarea(t.id).resultado, /Plan final/);
});

test("las tareas pendientes y su memoria sobreviven a un reinicio", async () => {
  const { oficina, almacen, dir } = montar(() => "# ok");
  const t = oficina.asignarTarea({ agente: "legal", texto: "Revisar licencias", proyecto: "open-folk", ejecutar: false });
  oficina.editarMemoria("open-folk", { campo: "instrucciones", texto: "Siempre en catalán y castellano" });
  almacen.volcar();

  const otra = montar(() => "# ok", dir);
  assert.equal(otra.almacen.tarea(t.id).estado, "pendiente");
  assert.equal(otra.almacen.memoria("open-folk").instrucciones[0].texto, "Siempre en catalán y castellano");
  assert.equal(otra.almacen.nuevoId("tarea"), "T-0002");
});

test("si Claude Code no devuelve un plan válido, Coordinación reparte por palabras clave", async () => {
  const { oficina, almacen } = montar(({ tipoTrabajo }) => (tipoTrabajo === "plan" ? "no sé" : "# ok"));
  const e = oficina.recibirEncargo({ texto: "Necesito un presupuesto y una campaña de marketing para Barnabeat" });
  await esperar(() => almacen.encargo(e.id).estado === "entregado");
  const agentes = almacen.encargo(e.id).tareas.map((id) => almacen.tarea(id).agente);
  assert.ok(agentes.includes("finanzas") && agentes.includes("marketing"), agentes.join());
  assert.equal(almacen.encargo(e.id).proyecto, "barnabeat");
});

test("un agente atiende una tarea a la vez", async () => {
  let enCurso = 0;
  let maximo = 0;
  const { oficina, almacen } = montar(async () => {
    enCurso++;
    maximo = Math.max(maximo, enCurso);
    await new Promise((r) => setTimeout(r, 20));
    enCurso--;
    return "# ok";
  });
  const ids = [1, 2, 3].map((n) => oficina.asignarTarea({ agente: "datos", texto: `Informe ${n}`, proyecto: "isla" }).id);
  await esperar(() => ids.every((id) => almacen.tarea(id).estado === "terminada"));
  assert.equal(maximo, 1);
});

test("el informe consolidado se entrega aunque deje una decisión pendiente", async () => {
  const { oficina, almacen } = montar(({ tipoTrabajo }) =>
    tipoTrabajo === "plan" ? '{"proyecto":"isla","objetivo":"x","resumen":"x","tareas":[]}' : "# Estado\nTodo listo.\n\nPREGUNTA PARA GROSSMAN: ¿Lanzamos el lunes?",
  );
  const e = oficina.recibirEncargo({ texto: "Qué tenemos pendiente de ISLA" });
  await esperar(() => almacen.encargo(e.id).estado === "entregado");
  assert.match(almacen.encargo(e.id).informe, /Decisión pendiente de Grossman:\*\* ¿Lanzamos el lunes\?/);
});

test("la ficha de un empleado se edita, se guarda y llega a sus encargos", async () => {
  const { oficina, almacen, ejecutor, dir } = montar(() => "# ok");
  oficina.editarAgente("marketing", { nombre: "Bruno Vidal", capacidades: ["TikTok", "tiktok", " Prensa "], instrucciones: "Siempre con cifras." });
  const a = oficina.agente("marketing");
  assert.equal(a.nombre, "Bruno Vidal");
  assert.deepEqual(a.capacidades, ["TikTok", "Prensa"], "sin repetidas ni espacios");
  assert.throws(() => oficina.editarAgente("marketing", { departamento: "inventado" }), /departamento/);
  assert.throws(() => oficina.editarAgente("marketing", { nombre: "" }), /nombre/);
  assert.throws(() => oficina.editarAgente("nadie", { nombre: "X" }), /no trabaja/);

  const t = oficina.asignarTarea({ agente: "marketing", texto: "Campaña", proyecto: "isla" });
  await esperar(() => almacen.tarea(t.id).estado === "terminada");
  assert.match(ejecutor.recibidos.at(-1).prompt, /Eres Bruno Vidal/);
  assert.match(ejecutor.recibidos.at(-1).prompt, /TikTok, Prensa/);
  assert.match(ejecutor.recibidos.at(-1).prompt, /Siempre con cifras/);

  const otra = montar(() => "# ok", dir);
  assert.equal(otra.oficina.agente("marketing").nombre, "Bruno Vidal", "sobrevive a un reinicio");
  otra.oficina.restablecerAgente("marketing");
  assert.equal(otra.oficina.agente("marketing").nombre, "Bruno");
});

test("lo que Claude sabe de Grossman se reparte entre su ficha y cada proyecto", async () => {
  const { oficina, almacen, ejecutor } = montar(({ tipoTrabajo }) =>
    tipoTrabajo === "importacion"
      ? '```json\n{"perfil":"Grossman es directo y odia los rodeos.","proyectos":{"pichuco":"Pizzería en Barcelona, masa de 72 horas.","barnabeat":"Festival en junio.","inventado":"no debe guardarse"},"otros":"Un libro de recetas."}\n```'
      : "# ok",
  );
  const t = oficina.importar({ texto: "Sobre mí: … Pichuco: … Barnabeat: …" });
  await esperar(() => almacen.tarea(t.id).estado === "terminada");
  assert.match(oficina.perfil().texto, /directo/);
  assert.match(almacen.memoria("pichuco").contexto, /72 horas/);
  assert.match(almacen.memoria("barnabeat").contexto, /junio/);
  assert.equal(almacen.memoria("isla").contexto, "");
  assert.match(almacen.tarea(t.id).resultado, /libro de recetas/);

  // A partir de ahora, todos los agentes lo saben, y cada uno solo su proyecto.
  const t2 = oficina.asignarTarea({ agente: "contenido", texto: "Texto para Instagram", proyecto: "pichuco" });
  await esperar(() => almacen.tarea(t2.id).estado === "terminada");
  const prompt = ejecutor.recibidos.at(-1).prompt;
  assert.match(prompt, /QUIÉN ES GROSSMAN[\s\S]*odia los rodeos/);
  assert.match(prompt, /72 horas/);
  assert.doesNotMatch(prompt, /Festival en junio/);
});
