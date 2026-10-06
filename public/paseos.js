// Los ratos libres de la oficina.
//
// Cuando un empleado no tiene nada entre manos, de vez en cuando se levanta:
// a por un café, a leer el periódico en el sofá, a consultar el archivo de un
// proyecto o, si hay otro libre, a jugar una partida de ajedrez. Si le llega
// trabajo, vuelve a su escritorio enseguida.
(function () {
  const VELOCIDAD = 62; // px por segundo
  const MAX_PASEANTES = 4;
  const sosegado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let svg = null;
  let capa = null;
  const paseantes = new Map(); // agente → paseo
  const ocupados = new Set(); // destinos en uso
  let reloj = null;

  const azar = (a, b) => a + Math.random() * (b - a);
  const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

  function libre(id) {
    const g = svg?.querySelector(`.agente[data-agente="${CSS.escape(id)}"]`);
    return Boolean(g && g.classList.contains("libre") && !g.classList.contains("con-bandeja"));
  }

  // ── la figura que camina ────────────────────────────────────────────────────
  function crearFigura(sitio) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "paseante andando");
    g.dataset.agente = sitio.agente.id;
    g.innerHTML = `<title>${window.escapar(sitio.agente.nombre)} · un rato libre</title><g class="cuerpo">${window.Planta.persona(sitio.agente)}</g><g class="accesorio"></g>`;
    capa.appendChild(g);
    return g;
  }

  function colocar(p, x, y, giro) {
    p.x = x;
    p.y = y;
    p.giro = giro;
    p.figura.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${giro.toFixed(1)})`);
  }

  function accesorio(p, tipo) {
    const g = p.figura.querySelector(".accesorio");
    g.innerHTML =
      tipo === "taza"
        ? `<circle cx="13" cy="27" r="4.6" fill="#F7F0E1" stroke="#a89a80" stroke-width=".8"/><circle cx="13" cy="27" r="2.4" fill="#5a3a22"/>`
        : tipo === "periodico"
          ? `<g transform="translate(0 30)"><rect x="-21" y="-8" width="42" height="26" fill="#efe6d4" stroke="#bfb196" stroke-width=".7"/><line x1="0" y1="-8" x2="0" y2="18" stroke="#bfb196" stroke-width=".7"/>${[-3, 2, 7, 12].map((y) => `<line x1="-17" y1="${y}" x2="-4" y2="${y}" stroke="#8b8172" stroke-width=".8"/><line x1="4" y1="${y}" x2="17" y2="${y}" stroke="#8b8172" stroke-width=".8"/>`).join("")}<rect x="-17" y="-6" width="13" height="4" fill="#4a433d"/></g>`
          : tipo === "carpeta"
            ? `<g transform="translate(0 29)"><rect x="-15" y="-9" width="30" height="20" rx="1.5" fill="#d9b978" stroke="#a88752" stroke-width=".8"/><rect x="-14" y="-7" width="13" height="16" fill="#F7F0E1"/><line x1="-12" y1="-3" x2="-4" y2="-3" stroke="#8b8172" stroke-width=".7"/></g>`
            : "";
  }

  // Recorre una lista de puntos; se puede interrumpir cambiando p.turno.
  function recorrer(p, puntos, rapidez = 1) {
    const turno = ++p.turno;
    p.figura.classList.add("andando");
    return new Promise((fin) => {
      let i = 0;
      let antes = performance.now();
      const paso = (ahora) => {
        if (turno !== p.turno) return fin(false);
        const dt = Math.min(0.1, (ahora - antes) / 1000);
        antes = ahora;
        let avance = VELOCIDAD * rapidez * dt;
        while (avance > 0 && i < puntos.length) {
          const d = puntos[i];
          const dx = d.x - p.x;
          const dy = d.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 0.5) {
            i++;
            continue;
          }
          const giro = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
          const tramo = Math.min(avance, dist);
          colocar(p, p.x + (dx / dist) * tramo, p.y + (dy / dist) * tramo, giro);
          avance -= tramo;
          p.hechos = p.ruta.indexOf(d);
        }
        if (i >= puntos.length) {
          p.figura.classList.remove("andando");
          return fin(true);
        }
        requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
  }

  const esperar = (p, segundos) =>
    new Promise((fin) => {
      const turno = p.turno;
      setTimeout(() => fin(turno === p.turno), segundos * 1000);
    });

  // ── un rato libre ───────────────────────────────────────────────────────────
  function ruta(sitio, destino) {
    const pasillo = sitio.pasillo;
    return [
      ...sitio.salida,
      { x: destino.carril, y: pasillo },
      ...(destino.via || []),
      destino.punto,
    ];
  }

  async function rato(sitio, destino, clave, segundos, alLlegar) {
    const g = svg.querySelector(`.agente[data-agente="${CSS.escape(sitio.agente.id)}"]`);
    const p = { sitio, figura: crearFigura(sitio), turno: 0, ruta: [], hechos: -1, clave };
    paseantes.set(sitio.agente.id, p);
    ocupados.add(clave);
    g.classList.add("paseando");
    colocar(p, sitio.silla.x, sitio.silla.y, sitio.silla.giro);
    p.ruta = ruta(sitio, destino);

    const llego = await recorrer(p, p.ruta);
    if (llego) {
      colocar(p, destino.punto.x, destino.punto.y, destino.giro);
      accesorio(p, destino.accesorio);
      alLlegar?.(p);
      if (await esperar(p, segundos)) {
        accesorio(p, null);
        await volver(p, 1);
      }
    }
  }

  async function volver(p, rapidez) {
    const vuelta = [...p.ruta.slice(0, Math.max(0, p.hechos)).reverse(), { x: p.sitio.silla.x, y: p.sitio.silla.y }];
    p.ruta = vuelta;
    const llego = await recorrer(p, vuelta, rapidez);
    if (llego) terminar(p);
  }

  function terminar(p) {
    p.turno++;
    p.figura.remove();
    paseantes.delete(p.sitio.agente.id);
    ocupados.delete(p.clave);
    if (p.clave === "ajedrez") svg.querySelector(".mesa-ajedrez")?.classList.remove("partida");
    svg.querySelector(`.agente[data-agente="${CSS.escape(p.sitio.agente.id)}"]`)?.classList.remove("paseando");
  }

  // ── quién se levanta ────────────────────────────────────────────────────────
  function quizas() {
    if (!svg || document.hidden || paseantes.size >= MAX_PASEANTES) return;
    const geo = window.Planta.geometria();
    if (!geo) return;
    const candidatos = geo.sitios.filter((s) => libre(s.agente.id) && !paseantes.has(s.agente.id));
    if (!candidatos.length || Math.random() > 0.45) return;

    // Partida de ajedrez: hacen falta dos.
    if (candidatos.length >= 2 && !ocupados.has("ajedrez") && !ocupados.has("ajedrez-2") && Math.random() < 0.4) {
      const a = elegir(candidatos);
      const b = elegir(candidatos.filter((c) => c !== a));
      const duracion = azar(70, 140);
      let sentados = 0;
      const empezar = () => {
        if (++sentados === 2) svg.querySelector(".mesa-ajedrez")?.classList.add("partida");
      };
      rato(a, geo.destinos.ajedrez[0], "ajedrez", duracion, empezar);
      rato(b, geo.destinos.ajedrez[1], "ajedrez-2", duracion + azar(-4, 4), empezar);
      return;
    }

    const opciones = [
      ...geo.destinos.cafe.map((d, i) => ({ d, clave: `cafe-${i}`, t: azar(18, 35) })),
      ...geo.destinos.sofa.map((d, i) => ({ d, clave: `sofa-${i}`, t: azar(35, 70) })),
      ...geo.destinos.archivo.map((d, i) => ({ d, clave: `archivo-${i}`, t: azar(15, 30) })),
    ].filter((o) => !ocupados.has(o.clave));
    if (!opciones.length) return;
    const o = elegir(opciones);
    rato(elegir(candidatos), o.d, o.clave, o.t);
  }

  // Si a alguien le llega trabajo mientras pasea, vuelve rápido a su sitio.
  function actualizar() {
    for (const p of [...paseantes.values()]) {
      if (!libre(p.sitio.agente.id) && !p.volviendo) {
        p.volviendo = true;
        accesorio(p, null);
        if (p.clave.startsWith("ajedrez")) svg.querySelector(".mesa-ajedrez")?.classList.remove("partida");
        volver(p, 3);
      }
    }
  }

  function iniciar(elemento) {
    for (const p of [...paseantes.values()]) terminar(p);
    svg = elemento;
    capa = svg.querySelector("#paseantes");
    clearInterval(reloj);
    if (sosegado || !capa) return;
    setTimeout(quizas, 6000);
    reloj = setInterval(quizas, 11000);
  }

  window.Paseos = { iniciar, actualizar, ahora: quizas };
})();
