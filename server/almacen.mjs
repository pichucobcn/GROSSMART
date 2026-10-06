// El archivo de Grossmart. Todo se guarda en disco, en datos/:
//
//   datos/oficina.json                    contadores y encargos
//   datos/proyectos.json                  proyectos abiertos desde Grossmart
//   datos/agentes.json                    fichas de los empleados editadas desde Grossmart
//   datos/perfil.json                     «Sobre Grossman»: lo que todos los agentes saben de él
//   datos/proyectos/<id>/tareas.json      tareas de ese proyecto
//   datos/proyectos/<id>/memoria.json     contexto, decisiones, instrucciones, notas
//   datos/proyectos/<id>/documentos/      resultados entregados (.md)
//   datos/proyectos/<id>/archivo/         carpeta de trabajo de los agentes
//
// Cada proyecto tiene su carpeta: el contexto de uno no se mezcla con otro.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export class Almacen {
  constructor(raiz) {
    this.raiz = raiz;
    mkdirSync(path.join(raiz, "proyectos"), { recursive: true });
    const oficina = this.#leer("oficina.json", { contadores: { tarea: 0, encargo: 0, nota: 0 }, encargos: [] });
    this.contadores = oficina.contadores;
    this.encargos = oficina.encargos;
    this.proyectosExtra = this.#leer("proyectos.json", []);
    this.fichas = this.#leer("agentes.json", {});
    this.perfil = this.#leer("perfil.json", { texto: "" });
    this.tareas = new Map();
    this.memorias = new Map();
    this.sucios = new Set();
    this.temporizador = null;
  }

  // ── proyectos ──
  cargarProyecto(id) {
    if (this.memorias.has(id)) return;
    const dir = this.dirProyecto(id);
    mkdirSync(path.join(dir, "documentos"), { recursive: true });
    mkdirSync(path.join(dir, "archivo"), { recursive: true });
    for (const t of this.#leer(path.join("proyectos", id, "tareas.json"), [])) this.tareas.set(t.id, t);
    this.memorias.set(
      id,
      this.#leer(path.join("proyectos", id, "memoria.json"), { contexto: "", decisiones: [], instrucciones: [], notas: [] }),
    );
  }

  dirProyecto(id) {
    return path.join(this.raiz, "proyectos", id);
  }

  guardarProyectoExtra(proyecto) {
    this.proyectosExtra.push(proyecto);
    this.#escribir("proyectos.json", this.proyectosExtra);
  }

  // Lectura y escritura genéricas (las usa Correspondencia en datos/correo/).
  leerJSON(relativo, porDefecto) {
    return this.#leer(relativo, porDefecto);
  }

  escribirJSON(relativo, datos) {
    this.#escribir(relativo, datos);
  }

  guardarFichas() {
    this.#escribir("agentes.json", this.fichas);
  }

  guardarPerfil() {
    this.#escribir("perfil.json", this.perfil);
  }

  // ── tareas ──
  nuevoId(tipo) {
    this.contadores[tipo] = (this.contadores[tipo] || 0) + 1;
    this.marcar("oficina");
    const prefijo = { tarea: "T", encargo: "E", nota: "N" }[tipo];
    return `${prefijo}-${String(this.contadores[tipo]).padStart(4, "0")}`;
  }

  tarea(id) {
    return this.tareas.get(id);
  }

  listaTareas() {
    return [...this.tareas.values()];
  }

  guardarTarea(t) {
    t.actualizada = new Date().toISOString();
    this.tareas.set(t.id, t);
    this.marcar(`tareas:${t.proyecto}`);
  }

  // ── encargos ──
  encargo(id) {
    return this.encargos.find((e) => e.id === id);
  }

  guardarEncargo(e) {
    e.actualizado = new Date().toISOString();
    if (!this.encargo(e.id)) this.encargos.push(e);
    this.marcar("oficina");
  }

  // ── memoria ──
  memoria(proyecto) {
    this.cargarProyecto(proyecto);
    return this.memorias.get(proyecto);
  }

  guardarMemoria(proyecto) {
    this.marcar(`memoria:${proyecto}`);
  }

  guardarDocumento(t, contenido) {
    const nombre = `${t.id}-${t.agente}.md`;
    writeFileSync(path.join(this.dirProyecto(t.proyecto), "documentos", nombre), contenido);
    return nombre;
  }

  // ── escritura diferida y atómica ──
  marcar(clave) {
    this.sucios.add(clave);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.volcar(), 200);
  }

  volcar() {
    const sucios = [...this.sucios];
    this.sucios.clear();
    for (const clave of sucios) {
      if (clave === "oficina") {
        this.#escribir("oficina.json", { contadores: this.contadores, encargos: this.encargos });
      } else if (clave.startsWith("tareas:")) {
        const id = clave.slice(7);
        const tareas = this.listaTareas()
          .filter((t) => t.proyecto === id)
          .map(({ progreso, ...resto }) => resto); // eslint-disable-line no-unused-vars
        this.#escribir(path.join("proyectos", id, "tareas.json"), tareas);
      } else if (clave.startsWith("memoria:")) {
        const id = clave.slice(8);
        this.#escribir(path.join("proyectos", id, "memoria.json"), this.memorias.get(id));
      }
    }
  }

  #leer(relativo, porDefecto) {
    const archivo = path.join(this.raiz, relativo);
    if (!existsSync(archivo)) return porDefecto;
    try {
      return JSON.parse(readFileSync(archivo, "utf8"));
    } catch (e) {
      console.error(`No se pudo leer ${archivo}: ${e.message}`);
      return porDefecto;
    }
  }

  #escribir(relativo, datos) {
    const archivo = path.join(this.raiz, relativo);
    mkdirSync(path.dirname(archivo), { recursive: true });
    const temporal = `${archivo}.tmp`;
    writeFileSync(temporal, JSON.stringify(datos, null, 2));
    renameSync(temporal, archivo);
  }
}
