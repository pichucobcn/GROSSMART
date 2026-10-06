// LA OFICINA · interfaz
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => window.escapar(s ?? "");

  let CONFIG = null;
  let ESTADO = { encargos: [], tareas: [], proyectos: [], ejecutor: {} };
  const PROGRESO = new Map();
  let pestana = "operaciones";
  let vista = null; // expediente abierto: { refrescar(), tareaId? }

  // ── utilidades ─────────────────────────────────────────────────────────────
  const proyecto = (id) => ESTADO.proyectos.find((p) => p.id === id) || CONFIG.proyectos.find((p) => p.id === id) || { id, nombre: id, color: "#8B7355" };
  const agente = (id) => CONFIG.agentes.find((a) => a.id === id) || { id, nombre: id, departamento: "" };
  const departamento = (id) => CONFIG.departamentos.find((d) => d.id === id) || { id, nombre: id };
  const estadoTarea = (id) => CONFIG.estados.find((e) => e.id === id) || { id, nombre: id, color: "#8C8273" };
  const tarea = (id) => ESTADO.tareas.find((t) => t.id === id);
  const peso = (p) => CONFIG.prioridades.find((x) => x.id === p)?.peso ?? 2;
  const abierta = (t) => t.estado !== "terminada";
  const ordenar = (a, b) => peso(a.prioridad) - peso(b.prioridad) || (a.fechaLimite || "9").localeCompare(b.fechaLimite || "9") || a.creada.localeCompare(b.creada);

  const ESTADOS_ENCARGO = {
    analizando: { nombre: "En estudio", color: "#B18A4A" },
    "en-curso": { nombre: "En curso", color: "#4E7A4F" },
    atencion: { nombre: "Necesita a Grossman", color: "#862820" },
    entregado: { nombre: "Entregado", color: "#315447" },
  };

  function fecha(iso, conHora = true) {
    if (!iso) return "—";
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    return d.toLocaleString("es-ES", conHora ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "long", year: "numeric" });
  }

  function vencida(t) {
    return t.fechaLimite && abierta(t) && t.fechaLimite < new Date().toISOString().slice(0, 10);
  }

  function sello(nombre, color, clase = "") {
    return `<span class="sello ${clase}" style="--color-sello:${color}">${esc(nombre)}</span>`;
  }
  function selloTarea(t) {
    if (t.descartada) return sello("Descartada", "#8C8273");
    if (t.esperaGrossman) return sello("Para Grossman", "#862820");
    const e = estadoTarea(t.estado);
    return sello(e.nombre, e.color);
  }
  function etiquetaProyecto(id) {
    const p = proyecto(id);
    return `<span class="etiqueta-proyecto" style="--color-proyecto:${p.color}">${esc(p.nombre)}</span>`;
  }

  async function api(ruta, cuerpo) {
    const res = await fetch(ruta, cuerpo === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
    const datos = await res.json();
    if (!res.ok) throw new Error(datos.error || "La oficina no pudo atender la petición.");
    return datos;
  }

  let relojAviso;
  function aviso(texto, mal = false) {
    const el = $("#aviso");
    el.textContent = texto;
    el.classList.toggle("mal", mal);
    el.hidden = false;
    clearTimeout(relojAviso);
    relojAviso = setTimeout(() => (el.hidden = true), 4200);
  }

  function retrato(a, tam = 84) {
    return `<svg class="retrato" width="${tam}" height="${tam}" viewBox="-42 -42 84 84" aria-hidden="true">
      <circle r="42" fill="#7d5134"/>
      <g transform="translate(0 6) scale(1.35)">
        <ellipse rx="27" ry="14" fill="${a.traje || "#3A3530"}"/>
        <path d="M-4 6 L0 11 L4 6 Z" fill="#efe6d4"/>
        <g transform="translate(0 -2)">${window.Planta.sombrero(a.sombrero?.tipo, a.sombrero?.color)}</g>
      </g>
    </svg>`;
  }

  function lineaTarea(t, { conAgente = true, conProyecto = false } = {}) {
    const a = agente(t.agente);
    const e = estadoTarea(t.estado);
    const meta = [
      conAgente ? a.nombre : null,
      conProyecto ? proyecto(t.proyecto).nombre : null,
      t.fechaLimite ? `vence ${fecha(t.fechaLimite, false)}` : null,
      t.prioridad !== "normal" ? `prioridad ${t.prioridad}` : null,
    ].filter(Boolean);
    return `<button class="tarea-linea" data-tarea="${t.id}">
      <span class="tarea-texto"><span class="punto" style="--color-estado:${t.esperaGrossman ? "#862820" : e.color}"></span>${esc(t.titulo)}
        <small><span class="id-exp">${t.id}</span>${meta.length ? " · " + esc(meta.join(" · ")) : ""}${vencida(t) ? " · <strong>vencida</strong>" : ""}</small>
      </span>
      ${selloTarea(t)}
    </button>`;
  }

  function fichaTarea(t, extra = "") {
    const a = agente(t.agente);
    return `<button class="ficha ${t.esperaGrossman || t.estado === "error" ? "alerta" : ""}" style="--color-proyecto:${proyecto(t.proyecto).color}" data-tarea="${t.id}">
      <div class="ficha-linea"><span class="ficha-titulo">${esc(t.titulo)}</span>${selloTarea(t)}</div>
      <div class="ficha-meta"><span class="id-exp">${t.id}</span> · ${esc(a.nombre)} · ${esc(proyecto(t.proyecto).nombre)}${t.fechaLimite ? ` · vence ${fecha(t.fechaLimite, false)}` : ""}${vencida(t) ? " · <strong>vencida</strong>" : ""}</div>
      ${extra}
    </button>`;
  }

  function fichaEncargo(e) {
    const info = ESTADOS_ENCARGO[e.estado] || { nombre: e.estado, color: "#8C8273" };
    const sub = e.tareas.map(tarea).filter(Boolean);
    const hechas = sub.filter((t) => t.estado === "terminada").length;
    const p = e.proyecto ? proyecto(e.proyecto) : null;
    return `<button class="ficha" style="--color-proyecto:${p?.color || "#B18A4A"}" data-encargo="${e.id}">
      <div class="ficha-linea"><span class="ficha-titulo">${esc(recortar(e.texto, 110))}</span>${sello(info.nombre, info.color)}</div>
      <div class="ficha-meta"><span class="id-exp">${e.id}</span> · ${p ? esc(p.nombre) : "proyecto por decidir"} · ${sub.length ? `${hechas}/${sub.length} tareas` : e.estado === "analizando" ? "Coordinación lo estudia" : "respuesta directa"}</div>
      ${sub.length ? `<div class="barra"><span style="width:${Math.round((hechas / sub.length) * 100)}%"></span></div>` : ""}
    </button>`;
  }

  function recortar(s, n) {
    s = String(s || "");
    return s.length > n ? `${s.slice(0, n - 1)}…` : s;
  }

  // ── centro de operaciones ──────────────────────────────────────────────────
  function pintarCentro() {
    const cuerpo = $("#centro");
    if (pestana === "operaciones") cuerpo.innerHTML = vistaOperaciones();
    else if (pestana === "proyectos") cuerpo.innerHTML = vistaProyectos();
    else cuerpo.innerHTML = vistaDepartamentos();
  }

  function vistaOperaciones() {
    const tareas = ESTADO.tareas;
    const encargosAbiertos = ESTADO.encargos.filter((e) => e.estado !== "entregado").reverse();
    const entregados = ESTADO.encargos.filter((e) => e.estado === "entregado").slice(-4).reverse();
    const alertas = tareas.filter((t) => t.esperaGrossman || t.estado === "error");
    const enMarcha = tareas.filter((t) => t.estado === "trabajando");
    const pendientes = tareas.filter((t) => t.tipo === "tarea" && abierta(t));
    const agentesOcupados = new Set(enMarcha.map((t) => t.agente)).size;

    const porProyecto = new Map();
    for (const t of pendientes.sort(ordenar)) {
      if (!porProyecto.has(t.proyecto)) porProyecto.set(t.proyecto, []);
      porProyecto.get(t.proyecto).push(t);
    }

    return `
      <div class="resumen">
        <div class="cifra"><strong>${encargosAbiertos.length}</strong><span>encargos en curso</span></div>
        <div class="cifra"><strong>${pendientes.length}</strong><span>tareas abiertas</span></div>
        <div class="cifra"><strong>${agentesOcupados}</strong><span>trabajando</span></div>
        <div class="cifra ${alertas.length ? "alerta" : ""}"><strong>${alertas.length}</strong><span>para Grossman</span></div>
      </div>

      <section class="seccion">
        <h3>Para Grossman</h3>
        ${
          alertas.length
            ? alertas
                .map((t) => fichaTarea(t, t.pregunta ? `<div class="pregunta">«${esc(t.pregunta)}»</div>` : t.error ? `<div class="pregunta">${esc(recortar(t.error, 140))}</div>` : ""))
                .join("")
            : `<p class="vacio">Nada requiere su atención.</p>`
        }
      </section>

      <section class="seccion">
        <h3>Encargos <small>${ESTADO.encargos.length} en el libro</small></h3>
        ${encargosAbiertos.length ? encargosAbiertos.map(fichaEncargo).join("") : `<p class="vacio">No hay encargos en curso.</p>`}
        ${entregados.length ? `<h3 style="margin-top:12px">Entregados recientemente</h3>${entregados.map(fichaEncargo).join("")}` : ""}
      </section>

      <section class="seccion">
        <h3>En marcha</h3>
        ${
          enMarcha.length
            ? enMarcha.map((t) => fichaTarea(t)).join("")
            : `<p class="vacio">Todos los escritorios están en calma.</p>`
        }
      </section>

      <section class="seccion">
        <h3>Pendientes por proyecto</h3>
        ${
          porProyecto.size
            ? [...porProyecto]
                .map(([p, lista]) => `<div style="margin-bottom:10px">${etiquetaProyecto(p)}${lista.map((t) => lineaTarea(t)).join("")}</div>`)
                .join("")
            : `<p class="vacio">No hay tareas pendientes.</p>`
        }
      </section>`;
  }

  function vistaProyectos() {
    return (
      ESTADO.proyectos
        .map((p) => {
          const suyas = ESTADO.tareas.filter((t) => t.proyecto === p.id && t.tipo === "tarea");
          const abiertas = suyas.filter(abierta);
          const enMarcha = suyas.filter((t) => t.estado === "trabajando");
          const atencion = suyas.filter((t) => t.esperaGrossman || t.estado === "error");
          return `<div class="carpeta-proyecto" data-proyecto="${p.id}" data-nombre="${esc(p.nombre)}" style="--color-proyecto:${p.color}" tabindex="0" role="button">
            <p><em>${esc(p.descripcion || "")}</em></p>
            <p class="ficha-meta">${abiertas.length} abiertas · ${enMarcha.length} en marcha · ${suyas.length - abiertas.length} terminadas${atencion.length ? ` · <strong>${atencion.length} para Grossman</strong>` : ""}</p>
          </div>`;
        })
        .join("") + `<div class="acciones" style="justify-content:flex-start;margin-top:18px"><button class="boton" data-accion="nuevo-proyecto">Abrir expediente nuevo</button></div>`
    );
  }

  function vistaDepartamentos() {
    const li = CONFIG.departamentos
      .map((d) => {
        const suyos = CONFIG.agentes.filter((a) => a.departamento === d.id);
        if (!suyos.length) return "";
        return `<li class="rama-dep">${esc(d.nombre)}<ul>${suyos
          .map((a) => {
            const tareas = ESTADO.tareas.filter((t) => t.agente === a.id && t.tipo === "tarea");
            const proyectos = [...new Set(tareas.map((t) => t.proyecto))];
            const trabajando = tareas.some((t) => t.estado === "trabajando");
            return `<li style="font-family:var(--letra-texto);letter-spacing:0;text-transform:none;font-size:1rem;color:var(--tinta)">
              <button class="enlace agente-nombre" data-agente="${a.id}"><span class="punto" style="--color-estado:${trabajando ? "#4E7A4F" : "#8C8273"}"></span>${esc(a.nombre)}</button>
              ${
                proyectos.length
                  ? `<ul>${proyectos
                      .map((p) => {
                        const deEse = tareas.filter((t) => t.proyecto === p);
                        const visibles = [...deEse.filter(abierta).sort(ordenar), ...deEse.filter((t) => !abierta(t)).slice(-2)];
                        return `<li><button class="enlace" data-proyecto="${p}">${etiquetaProyecto(p)}</button><ul>${visibles
                          .map(
                            (t) =>
                              `<li><button class="enlace" data-tarea="${t.id}"><span class="punto" style="--color-estado:${estadoTarea(t.estado).color}"></span>${esc(recortar(t.titulo, 60))}</button></li>`,
                          )
                          .join("")}</ul></li>`;
                      })
                      .join("")}</ul>`
                  : ""
              }
            </li>`;
          })
          .join("")}</ul></li>`;
      })
      .join("");
    return `<ul class="arbol">${li}</ul>`;
  }

  // ── expedientes ────────────────────────────────────────────────────────────
  // Cada expediente se abre en un contenedor nuevo: sus escuchas mueren con él.
  function abrirCarpeta(html, v) {
    const raiz = document.createElement("div");
    raiz.innerHTML = html;
    $("#carpeta-contenido").replaceChildren(raiz);
    $("#velo").hidden = false;
    $("#velo").scrollTop = 0;
    document.body.style.overflow = "hidden";
    vista = v;
    vista.refrescar?.();
    $("#carpeta-cerrar").focus();
    return raiz;
  }

  function cerrarCarpeta() {
    $("#velo").hidden = true;
    document.body.style.overflow = "";
    vista = null;
  }

  // Expediente del empleado
  function abrirAgente(id) {
    const a = agente(id);
    const dep = departamento(a.departamento);
    const opciones = ESTADO.proyectos.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("");
    const html = `
      <header class="ficha-tecnica">
        ${retrato(a)}
        <div>
          <p class="rotulo">Expediente del empleado · ${esc(dep.nombre)}</p>
          <h2 id="carpeta-titulo">${esc(a.nombre)}</h2>
          <p class="funcion">${esc(a.funcion)}</p>
        </div>
        <div class="vivo-sello"></div>
      </header>
      <dl class="campos">
        <div><dt>Departamento</dt><dd>${esc(dep.nombre)}</dd></div>
        <div class="ancho"><dt>Capacidades</dt><dd>${esc((a.capacidades || []).join(", "))}</dd></div>
      </dl>
      <div class="vivo"></div>
      <section class="bloque">
        <h3>${a.coordinador ? "Encargo para Coordinación" : "Encargo"}</h3>
        <form class="formulario-encargo" id="form-agente">
          <div class="fila-campos">
            <label>Proyecto
              <select name="proyecto">
                <option value="${a.coordinador ? "" : "auto"}">${a.coordinador ? "Que Coordinación lo decida" : "Que la oficina lo detecte"}</option>
                ${opciones}
              </select>
            </label>
            ${
              a.coordinador
                ? ""
                : `<label>Prioridad
              <select name="prioridad">${CONFIG.prioridades.map((p) => `<option value="${p.id}" ${p.id === "normal" ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select>
            </label>
            <label>Fecha límite <input type="date" name="fechaLimite"></label>`
            }
          </div>
          <textarea name="texto" required placeholder="${a.coordinador ? "Lo que necesita, con sus palabras. Coordinación decidirá quién interviene." : `Instrucción para ${esc(a.nombre)}…`}"></textarea>
          <div class="fila-campos" style="justify-content:space-between;margin:10px 0 0">
            ${a.coordinador ? "<span></span>" : `<label class="casilla"><input type="checkbox" name="pendiente"> Dejarlo pendiente, sin empezar todavía</label>`}
            <button class="boton boton-principal" type="submit">Enviar encargo</button>
          </div>
        </form>
      </section>`;

    abrirCarpeta(html, {
      refrescar() {
        const suyas = ESTADO.tareas.filter((t) => t.agente === id);
        const trabajando = suyas.find((t) => t.estado === "trabajando");
        const actuales = suyas.filter(abierta).sort(ordenar);
        const hechas = suyas
          .filter((t) => t.estado === "terminada" && !t.descartada && t.resultado)
          .sort((x, y) => (y.terminadaEn || "").localeCompare(x.terminadaEn || ""))
          .slice(0, 6);
        const proyectosActivos = [...new Set(actuales.map((t) => t.proyecto))];
        const espera = suyas.some((t) => t.esperaGrossman);
        $(".vivo-sello").innerHTML = trabajando
          ? sello("Trabajando", "#4E7A4F", "sello-grande")
          : espera
            ? sello("Espera a Grossman", "#862820", "sello-grande")
            : sello("Libre", "#8C8273", "sello-grande");

        const porProyecto = proyectosActivos
          .map((p) => `<div style="margin:6px 0 10px">${etiquetaProyecto(p)}${actuales.filter((t) => t.proyecto === p).map((t) => lineaTarea(t, { conAgente: false })).join("")}</div>`)
          .join("");
        $(".vivo").innerHTML = `
          ${trabajando ? `<section class="bloque"><h3>Ahora mismo</h3>${lineaTarea(trabajando, { conAgente: false, conProyecto: true })}</section>` : ""}
          <section class="bloque"><h3>Proyectos activos</h3>
            ${proyectosActivos.length ? `<div class="chips">${proyectosActivos.map((p) => `<span class="chip" data-proyecto="${p}" style="--color-proyecto:${proyecto(p).color}">${esc(proyecto(p).nombre)}</span>`).join("")}</div>` : `<p class="vacio">Sin proyectos activos.</p>`}
          </section>
          <section class="bloque"><h3>Tareas actuales</h3>${porProyecto || `<p class="vacio">Su bandeja está vacía.</p>`}</section>
          <section class="bloque"><h3>Últimos resultados</h3>
            ${hechas.length ? hechas.map((t) => fichaTarea(t, `<div class="ficha-meta">${esc(recortar(t.extracto, 200))}</div>`)).join("") : `<p class="vacio">Todavía no ha entregado documentos.</p>`}
          </section>`;
      },
    });

    $("#form-agente").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const boton = f.querySelector("[type=submit]");
      boton.disabled = true;
      try {
        if (a.coordinador) {
          const e = await api("/api/encargos", { texto: f.texto.value, proyecto: f.proyecto.value || undefined });
          aviso(`Encargo ${e.id} entregado a Coordinación.`);
          abrirEncargo(e.id);
        } else {
          const t = await api("/api/tareas", {
            agente: id,
            texto: f.texto.value,
            proyecto: f.proyecto.value,
            prioridad: f.prioridad.value,
            fechaLimite: f.fechaLimite.value || null,
            ejecutar: !f.pendiente.checked,
          });
          aviso(`${a.nombre} recibe el encargo ${t.id} (${proyecto(t.proyecto).nombre}).`);
          f.texto.value = "";
        }
      } catch (e) {
        aviso(e.message, true);
      } finally {
        boton.disabled = false;
      }
    });
  }

  // Documento de una tarea
  function abrirTarea(id) {
    let claveFormulario = null;
    const html = `
      <header class="ficha-tecnica" style="grid-template-columns:1fr auto">
        <div>
          <p class="rotulo vivo-rotulo"></p>
          <h2 id="carpeta-titulo" class="vivo-titulo" style="font-size:1.45rem"></h2>
        </div>
        <div class="vivo-sello"></div>
      </header>
      <div class="vivo-campos"></div>
      <div class="zona-formulario"></div>
      <div class="vivo-documento"></div>
      <div class="vivo-acciones"></div>
      <section class="bloque" style="margin-top:22px"><h3>Historial</h3><ul class="historial vivo-historial"></ul></section>`;

    abrirCarpeta(html, {
      tareaId: id,
      refrescar() {
        const t = tarea(id);
        if (!t) return;
        const a = agente(t.agente);
        const enc = t.encargo && ESTADO.encargos.find((e) => e.id === t.encargo);
        const tipo = { plan: "Plan de Coordinación", informe: "Informe consolidado", tarea: "Tarea" }[t.tipo];
        $(".vivo-rotulo").textContent = `Expediente ${t.id} · ${tipo}`;
        $(".vivo-titulo").textContent = t.titulo;
        $(".vivo-sello").innerHTML = selloTarea(t).replace("sello", "sello sello-grande");

        const enlacesTareas = (ids) => ids.map((x) => `<button class="enlace id-exp" data-tarea="${x}">${x}</button>`).join(", ");
        $(".vivo-campos").innerHTML = `
          <dl class="campos">
            <div><dt>Proyecto</dt><dd><button class="enlace" data-proyecto="${t.proyecto}">${etiquetaProyecto(t.proyecto)}</button></dd></div>
            <div><dt>Responsable</dt><dd><button class="enlace" data-agente="${t.agente}">${esc(a.nombre)}</button> · ${esc(departamento(a.departamento).nombre)}</dd></div>
            <div><dt>Prioridad</dt><dd><select class="cambiar-prioridad" aria-label="Prioridad">${CONFIG.prioridades.map((p) => `<option value="${p.id}" ${p.id === t.prioridad ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></dd></div>
            <div><dt>Creada</dt><dd>${fecha(t.creada)}</dd></div>
            <div><dt>Fecha límite</dt><dd>${t.fechaLimite ? fecha(t.fechaLimite, false) : "—"}${vencida(t) ? " · <strong>vencida</strong>" : ""}</dd></div>
            ${t.terminadaEn ? `<div><dt>Entregada</dt><dd>${fecha(t.terminadaEn)}</dd></div>` : ""}
            ${enc ? `<div><dt>Encargo</dt><dd><button class="enlace id-exp" data-encargo="${enc.id}">${enc.id}</button></dd></div>` : ""}
            ${t.dependeDe?.length ? `<div><dt>Depende de</dt><dd>${enlacesTareas(t.dependeDe)}</dd></div>` : ""}
            ${t.relacionadas?.length ? `<div><dt>Relacionadas</dt><dd>${enlacesTareas(t.relacionadas)}</dd></div>` : ""}
            ${t.documento ? `<div><dt>Archivo</dt><dd class="id-exp">${esc(t.proyecto)}/documentos/${esc(t.documento)}</dd></div>` : ""}
          </dl>
          ${t.descripcion && t.descripcion !== t.titulo ? `<section class="bloque"><h3>Instrucción</h3><p style="margin:0;white-space:pre-wrap">${esc(t.descripcion)}</p></section>` : ""}
          ${t.respuestas?.length ? `<section class="bloque"><h3>Respuestas de Grossman</h3>${t.respuestas.map((r) => `<p style="margin:0 0 6px"><em>«${esc(r.pregunta || "")}»</em> — ${esc(r.texto)}</p>`).join("")}</section>` : ""}
          ${t.estado === "error" ? `<div class="recuadro-error"><strong>Error.</strong> ${esc(t.error)}</div>` : ""}
          ${t.estado === "esperando" && !t.esperaGrossman && t.motivoEspera ? `<p class="vacio" style="margin-bottom:14px">${esc(t.motivoEspera)}.</p>` : ""}`;

        // Formulario de respuesta: solo se rehace si cambia la pregunta.
        const clave = t.esperaGrossman ? t.pregunta : null;
        if (clave !== claveFormulario) {
          claveFormulario = clave;
          $(".zona-formulario").innerHTML = t.esperaGrossman
            ? `<form class="recuadro-pregunta" id="form-respuesta">
                <p><strong>Pregunta para Grossman</strong></p>
                <p style="font-size:1.1rem"><em>«${esc(t.pregunta)}»</em></p>
                <textarea class="campo-texto" name="respuesta" required style="min-height:80px" placeholder="Su respuesta…"></textarea>
                <div class="acciones"><button class="boton boton-principal" type="submit">Responder y seguir</button></div>
              </form>`
            : "";
        }

        const progreso = PROGRESO.get(id);
        let doc;
        if (t.estado === "trabajando") {
          const texto = progreso?.texto ?? t.progreso ?? "";
          const usadas = progreso?.herramientas || t.herramientas || [];
          doc = `<div class="documento en-curso">
            <div class="documento-membrete"><span>La Oficina · ${esc(a.nombre)}</span><span>${t.id}</span></div>
            ${usadas.length ? `<p class="herramientas">Consultando: ${esc(usadas.slice(-4).join(" · "))}</p>` : ""}
            ${texto ? window.markdown(texto) : `<p class="documento-vacio">${esc(a.nombre)} se pone a trabajar…</p>`}<span class="cursor"></span>
          </div>`;
        } else if (t.resultado) {
          doc = `<div class="documento">
            <div class="documento-membrete"><span>La Oficina · ${esc(a.nombre)} · ${esc(proyecto(t.proyecto).nombre)}</span><span>${t.id}</span></div>
            ${window.markdown(t.resultado)}
          </div>`;
        } else {
          doc = `<div class="documento"><p class="documento-vacio">${t.estado === "pendiente" ? "Pendiente: todavía no se ha puesto en marcha." : "Aún no hay documento."}</p></div>`;
        }
        $(".vivo-documento").innerHTML = doc;

        const botones = [];
        if (["pendiente", "error"].includes(t.estado)) botones.push(`<button class="boton boton-principal" data-accion-tarea="ejecutar">${t.estado === "error" ? "Volver a intentar" : "Ponerla en marcha"}</button>`);
        if (t.estado === "terminada" && t.tipo !== "plan") botones.push(`<button class="boton" data-accion-tarea="ejecutar">Rehacer</button>`);
        if (abierta(t)) botones.push(`<button class="boton" data-accion-tarea="terminar">Dar por terminada</button>`, `<button class="boton boton-rojo" data-accion-tarea="descartar">Descartar</button>`);
        $(".vivo-acciones").innerHTML = botones.length ? `<div class="acciones" style="margin-top:18px">${botones.join("")}</div>` : "";

        $(".vivo-historial").innerHTML = t.historial
          .slice()
          .reverse()
          .map((h) => `<li><time>${fecha(h.fecha)}</time> ${esc(h.texto)}</li>`)
          .join("");
      },
    });
  }

  // Encargo y su informe
  function abrirEncargo(id) {
    const html = `
      <header class="ficha-tecnica" style="grid-template-columns:1fr auto">
        <div>
          <p class="rotulo vivo-rotulo"></p>
          <h2 id="carpeta-titulo" style="font-size:1.3rem;text-transform:none;letter-spacing:0;font-style:italic;font-family:var(--letra-texto);font-weight:500" class="vivo-titulo"></h2>
        </div>
        <div class="vivo-sello"></div>
      </header>
      <div class="vivo"></div>`;
    abrirCarpeta(html, {
      encargoId: id,
      refrescar() {
        const e = ESTADO.encargos.find((x) => x.id === id);
        if (!e) return;
        const info = ESTADOS_ENCARGO[e.estado] || { nombre: e.estado, color: "#8C8273" };
        $(".vivo-rotulo").textContent = `Encargo ${e.id} · recibido el ${fecha(e.creado)}`;
        $(".vivo-titulo").textContent = `«${e.texto}»`;
        $(".vivo-sello").innerHTML = sello(info.nombre, info.color, "sello-grande");
        const plan = tarea(e.tareaPlan);
        const informe = e.tareaInforme && tarea(e.tareaInforme);
        const sub = e.tareas.map(tarea).filter(Boolean);
        let informeHtml;
        if (informe?.resultado && informe.estado === "terminada") {
          informeHtml = `<div class="documento"><div class="documento-membrete"><span>La Oficina · Coordinación · Informe para Grossman</span><span>${e.id}</span></div>${window.markdown(informe.resultado)}</div>`;
        } else if (informe?.estado === "trabajando") {
          const texto = PROGRESO.get(informe.id)?.texto ?? informe.progreso ?? "";
          informeHtml = `<div class="documento en-curso"><div class="documento-membrete"><span>La Oficina · Coordinación</span><span>${e.id}</span></div>${texto ? window.markdown(texto) : `<p class="documento-vacio">Coordinación redacta el informe…</p>`}<span class="cursor"></span></div>`;
        } else {
          informeHtml = `<p class="vacio">${e.estado === "analizando" ? "Coordinación está estudiando el encargo." : "Coordinación redactará el informe cuando el equipo termine."}</p>`;
        }
        $(".vivo").innerHTML = `
          <dl class="campos">
            <div><dt>Proyecto</dt><dd>${e.proyecto ? `<button class="enlace" data-proyecto="${e.proyecto}">${etiquetaProyecto(e.proyecto)}</button>` : "por decidir"}</dd></div>
            <div class="ancho"><dt>Objetivo</dt><dd>${esc(e.objetivo || "—")}</dd></div>
            ${e.entregado ? `<div><dt>Entregado</dt><dd>${fecha(e.entregado)}</dd></div>` : ""}
          </dl>
          ${e.resumen ? `<p style="margin:0 0 18px"><em>${esc(e.resumen)}</em></p>` : ""}
          <section class="bloque"><h3>Reparto del trabajo</h3>
            ${plan ? lineaTarea(plan) : ""}
            ${sub.map((t) => lineaTarea(t)).join("")}
            ${informe ? lineaTarea(informe) : ""}
          </section>
          <section class="bloque"><h3>Informe consolidado</h3>${informeHtml}</section>`;
      },
    });
  }

  // Archivo de un proyecto: tareas + memoria
  function abrirProyecto(id) {
    const p = proyecto(id);
    let memoria = null;
    const lista = (campo, titulo, ayuda) => `
      <section class="bloque"><h3>${titulo}</h3>
        <ul class="lista-memoria" data-lista="${campo}"></ul>
        ${ayuda ? `<form class="agregar" data-campo="${campo}"><input type="text" name="texto" placeholder="${ayuda}" aria-label="${titulo}"><button class="boton" type="submit">Anotar</button></form>` : ""}
      </section>`;
    const html = `
      <header class="ficha-tecnica" style="grid-template-columns:auto 1fr">
        <div style="width:18px;align-self:stretch;background:${p.color};border:1px solid rgba(0,0,0,.2)"></div>
        <div>
          <p class="rotulo">Archivo de proyecto</p>
          <h2 id="carpeta-titulo">${esc(p.nombre)}</h2>
          <p class="funcion">${esc(p.descripcion || "")}</p>
        </div>
      </header>
      <div class="vivo"></div>
      <section class="bloque"><h3>Contexto del proyecto</h3>
        <form id="form-contexto">
          <textarea class="campo-texto" name="contexto" placeholder="Qué es, en qué punto está, quién participa, tono, cifras clave… Todo agente que trabaje en ${esc(p.nombre)} lo leerá antes de empezar."></textarea>
          <div class="acciones"><button class="boton" type="submit">Guardar contexto</button></div>
        </form>
      </section>
      ${lista("decisiones", "Decisiones tomadas", "Nueva decisión…")}
      ${lista("instrucciones", "Instrucciones permanentes", "Nueva instrucción para todos los agentes…")}
      ${lista("notas", "Notas del archivo", "Nota…")}`;

    const pintarMemoria = () => {
      if (!memoria) return;
      for (const ul of document.querySelectorAll(".lista-memoria")) {
        const campo = ul.dataset.lista;
        const items = memoria[campo] || [];
        ul.innerHTML = items.length
          ? items
              .map(
                (n) => `<li><span>${esc(n.texto)} <small>· ${esc(n.autor || "")} · ${fecha(n.fecha)}${n.tarea ? ` · <button class="enlace id-exp" data-tarea="${n.tarea}">${n.tarea}</button>` : ""}</small></span>
                <button class="boton boton-discreto" data-quitar="${n.id}" data-campo="${campo}" aria-label="Quitar">quitar</button></li>`,
              )
              .join("")
          : `<li class="vacio">Nada anotado.</li>`;
      }
    };

    const cargarMemoria = async (primera) => {
      try {
        memoria = await api(`/api/proyectos/${encodeURIComponent(id)}/memoria`);
        if (primera) $("#form-contexto").contexto.value = memoria.contexto || "";
        pintarMemoria();
      } catch (e) {
        aviso(e.message, true);
      }
    };

    const carpeta = abrirCarpeta(html, {
      proyectoId: id,
      refrescar() {
        const suyas = ESTADO.tareas.filter((t) => t.proyecto === id && t.tipo !== "plan");
        const abiertas = suyas.filter(abierta).sort(ordenar);
        const hechas = suyas
          .filter((t) => t.estado === "terminada" && !t.descartada && t.resultado)
          .sort((x, y) => (y.terminadaEn || "").localeCompare(x.terminadaEn || ""));
        const agentes = [...new Set(abiertas.map((t) => t.agente))];
        const encargos = ESTADO.encargos.filter((e) => e.proyecto === id).slice().reverse().slice(0, 6);
        $(".vivo").innerHTML = `
          <section class="bloque"><h3>Tareas abiertas</h3>
            ${
              agentes.length
                ? `<ul class="arbol">${agentes
                    .map((a) => `<li><button class="enlace agente-nombre" data-agente="${a}">${esc(agente(a).nombre)}</button> <small class="id-exp">${esc(departamento(agente(a).departamento).nombre)}</small><ul>${abiertas.filter((t) => t.agente === a).map((t) => `<li>${lineaTarea(t, { conAgente: false })}</li>`).join("")}</ul></li>`)
                    .join("")}</ul>`
                : `<p class="vacio">No hay tareas abiertas en ${esc(p.nombre)}.</p>`
            }
          </section>
          ${encargos.length ? `<section class="bloque"><h3>Encargos</h3>${encargos.map(fichaEncargo).join("")}</section>` : ""}
          <section class="bloque"><h3>Documentos entregados</h3>
            ${hechas.length ? hechas.slice(0, 12).map((t) => lineaTarea(t)).join("") : `<p class="vacio">El archivo aún no tiene documentos.</p>`}
          </section>`;
        cargarMemoria(false);
      },
    });
    cargarMemoria(true);

    $("#form-contexto").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try {
        memoria = await api(`/api/proyectos/${encodeURIComponent(id)}/memoria`, { campo: "contexto", texto: ev.target.contexto.value });
        aviso(`Contexto de ${p.nombre} guardado.`);
      } catch (e) {
        aviso(e.message, true);
      }
    });
    carpeta.addEventListener("submit", async (ev) => {
      const f = ev.target.closest("form.agregar");
      if (!f) return;
      ev.preventDefault();
      try {
        memoria = await api(`/api/proyectos/${encodeURIComponent(id)}/memoria`, { campo: f.dataset.campo, texto: f.texto.value });
        f.texto.value = "";
        pintarMemoria();
      } catch (e) {
        aviso(e.message, true);
      }
    });
    carpeta.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-quitar]");
      if (!b) return;
      memoria = await api(`/api/proyectos/${encodeURIComponent(id)}/memoria`, { campo: b.dataset.campo, quitar: b.dataset.quitar });
      pintarMemoria();
    });
  }

  function abrirNuevoProyecto() {
    abrirCarpeta(
      `<header class="ficha-tecnica" style="grid-template-columns:1fr"><div><p class="rotulo">Archivo de proyectos</p><h2 id="carpeta-titulo">Expediente nuevo</h2>
        <p class="funcion">El proyecto tendrá su propio archivador, su memoria y su carpeta de trabajo. Los empleados de la oficina trabajarán para él como para los demás.</p></div></header>
      <form class="formulario-encargo" id="form-proyecto">
        <div class="fila-campos">
          <label style="flex:1">Nombre <input type="text" name="nombre" required></label>
          <label>Color <input type="color" name="color" value="#8B7355" style="height:36px;width:60px;padding:2px"></label>
        </div>
        <div class="fila-campos"><label style="flex:1">Descripción <input type="text" name="descripcion"></label></div>
        <div class="acciones"><button class="boton boton-principal" type="submit">Abrir expediente</button></div>
      </form>`,
      {},
    );
    $("#form-proyecto").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      try {
        const p = await api("/api/proyectos", { nombre: f.nombre.value, descripcion: f.descripcion.value, color: f.color.value });
        await recargarConfig();
        aviso(`Expediente de ${p.nombre} abierto.`);
        abrirProyecto(p.id);
      } catch (e) {
        aviso(e.message, true);
      }
    });
  }

  // ── navegación por clics (planta, centro, expedientes) ────────────────────
  function navegar(ev) {
    const el = ev.target.closest("[data-tarea],[data-agente],[data-proyecto],[data-encargo],[data-accion],[data-vista]");
    if (!el || el.closest("form")) return;
    if (el.dataset.tarea) abrirTarea(el.dataset.tarea);
    else if (el.dataset.encargo) abrirEncargo(el.dataset.encargo);
    else if (el.dataset.agente) abrirAgente(el.dataset.agente);
    else if (el.dataset.proyecto) abrirProyecto(el.dataset.proyecto);
    else if (el.dataset.accion === "nuevo-proyecto") abrirNuevoProyecto();
    else if (el.dataset.vista) cambiarPestana(el.dataset.vista);
  }

  function cambiarPestana(p) {
    pestana = p;
    for (const b of document.querySelectorAll("[data-pestana]")) b.setAttribute("aria-selected", String(b.dataset.pestana === p));
    pintarCentro();
  }

  // ── estado en vivo ─────────────────────────────────────────────────────────
  function pintarTodo() {
    const porId = Object.fromEntries(ESTADO.proyectos.map((p) => [p.id, p]));
    window.Planta.actualizar(ESTADO, porId);
    pintarCentro();
    vista?.refrescar?.();

    const e = ESTADO.ejecutor || {};
    const linea = $("#linea");
    linea.classList.toggle("ok", e.ok === true);
    linea.classList.toggle("mal", e.ok === false);
    linea.querySelector(".linea-texto").textContent =
      e.ok === false ? `Sin línea con Claude Code: ${e.detalle}` : e.tipo === "simulado" ? "Modo ensayo · sin Claude Code" : `Línea con Claude Code${e.detalle && e.ok ? ` · ${e.detalle}` : ""}`;
  }

  function conectar() {
    const fuente = new EventSource("/api/eventos");
    fuente.addEventListener("estado", (ev) => {
      ESTADO = JSON.parse(ev.data);
      for (const id of PROGRESO.keys()) if (tarea(id)?.estado !== "trabajando") PROGRESO.delete(id);
      if (ESTADO.proyectos.length !== CONFIG.proyectos.length) recargarConfig();
      pintarTodo();
    });
    fuente.addEventListener("progreso", (ev) => {
      const p = JSON.parse(ev.data);
      const previo = PROGRESO.get(p.id) || { herramientas: [] };
      PROGRESO.set(p.id, { texto: p.texto, herramientas: p.herramienta ? [...previo.herramientas, p.herramienta] : previo.herramientas });
      const informe = vista?.encargoId && ESTADO.encargos.find((e) => e.id === vista.encargoId)?.tareaInforme;
      if (vista && (vista.tareaId === p.id || informe === p.id)) vista.refrescar();
    });
    fuente.onerror = () => {
      const linea = $("#linea");
      linea.classList.remove("ok");
      linea.classList.add("mal");
      linea.querySelector(".linea-texto").textContent = "Sin conexión con la oficina…";
    };
  }

  async function recargarConfig() {
    CONFIG = await api("/api/config");
    ESTADO.proyectos = CONFIG.proyectos;
    window.Planta.dibujar($("#planta"), CONFIG, CONFIG.proyectos);
    const sel = $("#encargo-proyecto");
    const actual = sel.value;
    sel.innerHTML = `<option value="">Que Coordinación decida el proyecto</option>` + CONFIG.proyectos.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("");
    sel.value = actual;
    $("#leyenda").textContent = [...CONFIG.proyectos.filter((p) => p.id !== CONFIG.proyectoGeneral).map((p) => p.nombre.toUpperCase()), "OTROS PROYECTOS"].join(" · ");
  }

  async function iniciar() {
    $("#fecha").textContent = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    await recargarConfig();

    // Encargo general, siempre a mano.
    const texto = $("#encargo-texto");
    const crecer = () => {
      texto.style.height = "auto";
      texto.style.height = `${Math.min(texto.scrollHeight, 180)}px`;
    };
    texto.addEventListener("input", crecer);
    $("#encargo-general").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const boton = ev.target.querySelector("[type=submit]");
      boton.disabled = true;
      try {
        const e = await api("/api/encargos", { texto: texto.value, proyecto: $("#encargo-proyecto").value || undefined });
        texto.value = "";
        crecer();
        aviso(`Encargo ${e.id} entregado a Coordinación.`);
        abrirEncargo(e.id);
      } catch (e) {
        aviso(e.message, true);
      } finally {
        boton.disabled = false;
      }
    });
    // Ctrl/⌘ + Intro envía cualquier encargo.
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey) && ev.target.matches("textarea")) {
        ev.preventDefault();
        ev.target.form?.requestSubmit();
      }
      if (ev.key === "Escape" && vista) cerrarCarpeta();
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches("svg [role=button], .carpeta-proyecto")) {
        ev.preventDefault();
        navegar(ev);
      }
    });

    $("#planta").addEventListener("click", navegar);
    $("#centro").addEventListener("click", navegar);
    $("#carpeta-contenido").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-accion-tarea]");
      if (b && vista?.tareaId) {
        accionTarea(vista.tareaId, b.dataset.accionTarea);
        return;
      }
      navegar(ev);
    });
    $("#carpeta-contenido").addEventListener("change", (ev) => {
      if (ev.target.matches(".cambiar-prioridad") && vista?.tareaId) accionTarea(vista.tareaId, "prioridad", { prioridad: ev.target.value });
    });
    $("#carpeta-contenido").addEventListener("submit", async (ev) => {
      if (ev.target.id !== "form-respuesta") return;
      ev.preventDefault();
      await accionTarea(vista.tareaId, "responder", { respuesta: ev.target.respuesta.value });
    });
    for (const b of document.querySelectorAll("[data-pestana]")) b.addEventListener("click", () => cambiarPestana(b.dataset.pestana));
    $("#carpeta-cerrar").addEventListener("click", cerrarCarpeta);
    $("#velo").addEventListener("click", (ev) => ev.target.id === "velo" && cerrarCarpeta());

    ESTADO = await api("/api/estado");
    pintarTodo();
    conectar();
  }

  async function accionTarea(id, accion, datos = {}) {
    if (accion === "descartar" && !confirm("¿Descartar esta tarea? Quedará archivada como descartada.")) return;
    try {
      await api(`/api/tareas/${id}/accion`, { accion, ...datos });
      if (accion !== "prioridad") aviso({ ejecutar: "En marcha.", terminar: "Tarea dada por terminada.", descartar: "Tarea descartada.", responder: "Respuesta entregada; el agente sigue." }[accion]);
    } catch (e) {
      aviso(e.message, true);
    }
  }

  iniciar().catch((e) => aviso(`No se pudo abrir la oficina: ${e.message}`, true));
})();
