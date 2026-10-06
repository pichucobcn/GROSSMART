// La planta de Grossmart, vista estrictamente desde arriba.
// Todo se dibuja a partir de la configuración: si se añade un agente o un
// proyecto, aparece su escritorio o su archivador sin tocar este archivo.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const P = {
    crema: "#F2E8D5",
    papel: "#E7D8BC",
    papelClaro: "#F7F0E1",
    madera: "#4A3024",
    nogal: "#684735",
    verdeBiblioteca: "#315447",
    verdeLampara: "#55705A",
    rojo: "#862820",
    dorado: "#B18A4A",
    tinta: "#211C18",
    cuero: "#5A2A22",
  };

  const esc = (s) => window.escapar(s);

  function mezclar(hex, otro, t) {
    const a = parseInt(hex.slice(1), 16);
    const b = parseInt(otro.slice(1), 16);
    const c = [16, 8, 0].map((s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t));
    return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }
  const oscuro = (c, t = 0.3) => mezclar(c, "#000000", t);
  const claro = (c, t = 0.3) => mezclar(c, "#ffffff", t);

  // ── piezas ─────────────────────────────────────────────────────────────────
  function sombrero(tipo, color) {
    const c = color || "#2E2925";
    const cinta = tipo === "canotier" ? P.tinta : oscuro(c, 0.45);
    switch (tipo) {
      case "bombin":
        return `
          <ellipse rx="15.5" ry="14" fill="${oscuro(c, 0.1)}"/>
          <ellipse rx="15.5" ry="14" fill="none" stroke="${claro(c, 0.15)}" stroke-width="1.2"/>
          <circle r="11" fill="${c}" stroke="${cinta}" stroke-width="2"/>
          <ellipse cx="-3" cy="-3.5" rx="5" ry="3.5" fill="#fff" opacity=".13"/>`;
      case "homburg":
        return `
          <ellipse rx="17.5" ry="15.5" fill="${oscuro(c, 0.08)}"/>
          <ellipse rx="16" ry="14" fill="none" stroke="${claro(c, 0.22)}" stroke-width="1.6"/>
          <ellipse rx="10.5" ry="12" fill="${c}" stroke="${cinta}" stroke-width="2.2"/>
          <path d="M0 -8 L0 7" stroke="${oscuro(c, 0.5)}" stroke-width="1.6" stroke-linecap="round"/>`;
      case "cloche":
        return `
          <circle r="14.5" fill="${oscuro(c, 0.12)}"/>
          <circle r="11.5" fill="${c}"/>
          <circle r="11.5" fill="none" stroke="${claro(c, 0.3)}" stroke-width="1.6"/>
          <ellipse cx="9" cy="6" rx="3.2" ry="2" fill="${claro(c, 0.35)}" transform="rotate(35 9 6)"/>
          <ellipse cx="11" cy="3" rx="3" ry="1.8" fill="${claro(c, 0.35)}" transform="rotate(-20 11 3)"/>`;
      case "canotier":
        return `
          <circle r="17" fill="${c}"/>
          <circle r="15" fill="none" stroke="${oscuro(c, 0.18)}" stroke-width=".7"/>
          <circle r="13" fill="none" stroke="${oscuro(c, 0.18)}" stroke-width=".7"/>
          <circle r="10.5" fill="${claro(c, 0.08)}" stroke="${cinta}" stroke-width="2.6"/>
          <circle r="7" fill="none" stroke="${oscuro(c, 0.15)}" stroke-width=".6"/>`;
      case "boina":
        return `
          <ellipse cx="1" cy="-1" rx="14" ry="13" fill="${c}"/>
          <ellipse cx="2" cy="-2" rx="9" ry="8" fill="${claro(c, 0.06)}"/>
          <circle cx="2" cy="-2" r="1.8" fill="${oscuro(c, 0.4)}"/>`;
      case "gorra":
        return `
          <path d="M-13 -9 Q0 -17 13 -9 Q15 2 11 9 L-11 9 Q-15 2 -13 -9 Z" fill="${c}"/>
          <path d="M-11 9 Q0 17 11 9 Z" fill="${oscuro(c, 0.3)}"/>
          <path d="M-9 -6 Q0 -11 9 -6" fill="none" stroke="${oscuro(c, 0.2)}" stroke-width=".8"/>
          <circle cy="-3" r="1.6" fill="${oscuro(c, 0.35)}"/>`;
      case "fedora":
      default:
        return `
          <ellipse rx="18" ry="16" fill="${oscuro(c, 0.08)}"/>
          <ellipse rx="18" ry="16" fill="none" stroke="${claro(c, 0.14)}" stroke-width="1"/>
          <ellipse rx="10.5" ry="12.5" fill="${c}" stroke="${cinta}" stroke-width="2.4"/>
          <path d="M0 -8 Q-1.5 0 0 6" fill="none" stroke="${oscuro(c, 0.45)}" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M-4 5 Q0 8 4 5" fill="none" stroke="${oscuro(c, 0.35)}" stroke-width="1.2"/>`;
    }
  }

  function persona(agente) {
    const traje = agente.traje || "#3A3530";
    return `
      <g class="persona">
        <ellipse class="brazo brazo-izq" cx="-20" cy="16" rx="6" ry="13" fill="${oscuro(traje, 0.08)}" transform="rotate(14 -20 16)"/>
        <ellipse class="brazo brazo-der" cx="20" cy="16" rx="6" ry="13" fill="${oscuro(traje, 0.08)}" transform="rotate(-14 20 16)"/>
        <circle class="brazo brazo-izq" cx="-17" cy="28" r="4" fill="#d2a989"/>
        <circle class="brazo brazo-der" cx="17" cy="28" r="4" fill="#d2a989"/>
        <ellipse rx="27" ry="14" fill="${traje}"/>
        <path d="M-8 4 L0 13 L8 4" fill="none" stroke="${claro(traje, 0.18)}" stroke-width="1.4"/>
        <path d="M-4 6 L0 11 L4 6 Z" fill="#efe6d4"/>
        <g transform="translate(0 -2)">${sombrero(agente.sombrero?.tipo, agente.sombrero?.color)}</g>
      </g>`;
  }

  function silla() {
    return `
      <g class="silla" filter="url(#sombra-suave)">
        <path d="M-25 -6 Q0 -32 25 -6" fill="none" stroke="#2f211a" stroke-width="9" stroke-linecap="round"/>
        <circle r="22" fill="#3b2a22"/>
        <circle r="18" fill="${P.cuero}"/>
        <circle r="18" fill="none" stroke="#3b1c17" stroke-width="1" stroke-dasharray="2 3"/>
      </g>`;
  }

  function maquina(ancho = 60) {
    const m = ancho / 2;
    let teclas = "";
    for (let fila = 0; fila < 3; fila++) {
      const n = 8 - fila;
      for (let k = 0; k < n; k++) {
        const x = -m + 9 + fila * 3 + k * ((ancho - 18 - fila * 6) / (n - 1));
        teclas += `<circle cx="${x.toFixed(1)}" cy="${-27 + fila * 6}" r="2" fill="#e9dfc9" stroke="#111" stroke-width=".6"/>`;
      }
    }
    return `
      <g class="maquina">
        <rect x="${-m}" y="-34" width="${ancho}" height="34" rx="6" fill="#2a2522" filter="url(#sombra-suave)"/>
        <rect x="${-m + 3}" y="-31" width="${ancho - 6}" height="22" rx="3" fill="#221d1a"/>
        ${teclas}
        <rect x="${-m + 14}" y="-9" width="${ancho - 28}" height="4" rx="2" fill="#151210"/>
        <g class="carro">
          <rect x="${-m - 6}" y="-3" width="${ancho + 12}" height="7" rx="3.5" fill="#151210"/>
          <circle cx="${-m - 7}" cy=".5" r="4" fill="#3a332e"/>
          <circle cx="${m + 7}" cy=".5" r="4" fill="#3a332e"/>
          <rect class="hoja" x="-17" y="4" width="34" height="26" fill="${P.papelClaro}" stroke="#d8ccb3" stroke-width=".6"/>
          <g opacity=".55">
            <line x1="-12" y1="10" x2="10" y2="10" stroke="#6d6458" stroke-width=".8"/>
            <line x1="-12" y1="14" x2="12" y2="14" stroke="#6d6458" stroke-width=".8"/>
          </g>
        </g>
      </g>`;
  }

  function lampara(x, y, r = 13) {
    return `
      <g transform="translate(${x} ${y})">
        <circle class="lampara-luz" r="${r * 5}" fill="url(#luz-lampara)"/>
        <rect x="-3" y="2" width="6" height="${r + 2}" rx="2" fill="${P.dorado}"/>
        <ellipse cy="${r + 4}" rx="${r * 0.62}" ry="${r * 0.42}" fill="#8f6d36" stroke="#5f4720" stroke-width="1"/>
        <rect x="${-r - 4}" y="${-r * 0.55}" width="${2 * r + 8}" height="${r * 1.1}" rx="${r * 0.55}" fill="${P.verdeBiblioteca}" stroke="${P.dorado}" stroke-width="1.6" filter="url(#sombra-suave)"/>
        <rect x="${-r}" y="${-r * 0.32}" width="${2 * r}" height="${r * 0.64}" rx="${r * 0.32}" fill="${P.verdeLampara}" opacity=".7"/>
        <rect class="pantalla-brillo" x="${-r}" y="${-r * 0.32}" width="${2 * r}" height="${r * 0.64}" rx="${r * 0.32}" fill="#9fbf8e" opacity="0"/>
      </g>`;
  }

  function telefono(x, y, giro = 0) {
    return `
      <g transform="translate(${x} ${y}) rotate(${giro})" filter="url(#sombra-suave)">
        <rect x="-12" y="-9" width="24" height="19" rx="6" fill="#1d1a18"/>
        <rect x="-14" y="-13" width="28" height="7" rx="3.5" fill="#2b2623"/>
        <circle cy="3" r="5.5" fill="none" stroke="${P.dorado}" stroke-width="1.2"/>
        <circle cy="3" r="1.8" fill="${P.dorado}"/>
      </g>`;
  }

  function hojas(x, y, n, giroBase = -8) {
    let s = "";
    for (let i = 0; i < n; i++) {
      const g = giroBase + ((i * 37) % 17) - 8;
      s += `<g transform="translate(${x + i * 1.2} ${y - i * 1.5}) rotate(${g})">
        <rect x="-14" y="-18" width="28" height="36" fill="${i % 2 ? "#f4ecd9" : P.papelClaro}" stroke="#d6c9ae" stroke-width=".6"/>
        <line x1="-9" y1="-11" x2="9" y2="-11" stroke="#8b8172" stroke-width=".7"/>
        <line x1="-9" y1="-6" x2="7" y2="-6" stroke="#8b8172" stroke-width=".7"/>
        <line x1="-9" y1="-1" x2="9" y2="-1" stroke="#8b8172" stroke-width=".7"/>
      </g>`;
    }
    return s;
  }

  function carpetas(x, y, colores) {
    return colores
      .map(
        (color, i) => `
        <g class="papel-nuevo" transform="translate(${x - i * 4} ${y + i * 6}) rotate(${-4 + i * 7})">
          <rect x="-19" y="-14" width="38" height="28" rx="1.5" fill="#d9b978" stroke="#a88752" stroke-width=".8"/>
          <rect x="-19" y="-18" width="16" height="6" rx="1.5" fill="${color}"/>
          <line x1="-14" y1="-4" x2="10" y2="-4" stroke="#a88752" stroke-width=".7"/>
        </g>`,
      )
      .join("");
  }

  function veta(w, h) {
    let s = "";
    for (let i = 1; i < 6; i++) {
      const y = -h / 2 + (h / 6) * i;
      s += `<path d="M${-w / 2 + 4} ${y} Q${-w / 6} ${y - 2} 0 ${y + 1} T${w / 2 - 4} ${y}" fill="none" stroke="#5a3a2a" stroke-width=".7" opacity=".45"/>`;
    }
    return s;
  }

  function escritorio(w, h) {
    return `
      <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="4" fill="${P.madera}" filter="url(#sombra)"/>
      <rect class="escritorio-tablero" x="${-w / 2 + 4}" y="${-h / 2 + 4}" width="${w - 8}" height="${h - 8}" rx="2" fill="#6a4532"/>
      ${veta(w - 8, h - 8)}
      <rect x="${-w / 2 + 4}" y="${-h / 2 + 4}" width="${w - 8}" height="${h - 8}" rx="2" fill="none" stroke="#3a241b" stroke-width="1"/>`;
  }

  function puestoAgente(agente, departamento, x, y, abajo) {
    // Coordenadas locales: el agente se sienta al norte del escritorio.
    const giro = abajo ? 180 : 0;
    const placaY = abajo ? y - 78 : y + 78;
    return `
      <g class="agente libre" data-agente="${esc(agente.id)}" tabindex="0" role="button" aria-label="${esc(agente.nombre)}, ${esc(departamento.nombre)}">
        <title>${esc(agente.nombre)} · ${esc(departamento.nombre)}</title>
        <g transform="translate(${x} ${y}) rotate(${giro})">
          <g transform="translate(0 -74)">${silla()}</g>
          ${escritorio(184, 92)}
          <rect x="-40" y="-10" width="80" height="44" rx="2" fill="${P.verdeBiblioteca}" stroke="${P.dorado}" stroke-width="1"/>
          <g transform="translate(0 -6)">${maquina(58)}</g>
          ${telefono(-68, -22, -12)}
          <g class="papeles" transform="translate(-60 18)"></g>
          <g class="carpetas"></g>
          <circle cx="52" cy="-30" r="5" fill="#1b1714" stroke="${P.dorado}" stroke-width="1"/>
          <line x1="40" y1="-24" x2="62" y2="-34" stroke="#3a2a20" stroke-width="2" stroke-linecap="round"/>
          ${lampara(70, -12, 12)}
          <g transform="translate(0 -66)">${persona(agente)}</g>
        </g>
        <g class="placa" transform="translate(${x} ${placaY})">
          <rect class="placa-fondo" x="-66" y="-17" width="132" height="34" rx="2" fill="${P.dorado}" stroke="#7d5f2c" stroke-width="1.2" filter="url(#sombra-suave)"/>
          <rect x="-62" y="-13" width="124" height="26" rx="1" fill="none" stroke="#7d5f2c" stroke-width=".6"/>
          <circle class="piloto-agente" cx="-50" cy="0" r="5" stroke="#3a2a12" stroke-width="1"/>
          <text x="6" y="-1.5" text-anchor="middle" class="placa-nombre">${esc(agente.nombre.toUpperCase())}</text>
          <text x="6" y="10" text-anchor="middle" class="placa-dep"${departamento.nombre.length > 16 ? ' textLength="104" lengthAdjust="spacingAndGlyphs"' : ""}>${esc(departamento.nombre.toUpperCase())}</text>
        </g>
      </g>`;
  }

  function puestoCoordinacion(agente, x, y) {
    return `
      <g class="agente mesa-coordinacion libre" data-agente="${esc(agente.id)}" tabindex="0" role="button" aria-label="${esc(agente.nombre)}, Coordinación">
        <title>${esc(agente.nombre)} · Coordinación</title>
        <g transform="translate(${x} ${y})">
          <g transform="translate(0 -86)">${silla()}</g>
          ${escritorio(290, 112)}
          <rect x="-50" y="-14" width="100" height="54" rx="2" fill="${P.verdeBiblioteca}" stroke="${P.dorado}" stroke-width="1"/>
          <g transform="translate(0 -10)">${maquina(62)}</g>
          ${telefono(-118, -26, -10)}
          ${telefono(-86, -30, 8)}
          <g transform="translate(-100 20)">
            <rect x="-26" y="-18" width="52" height="36" fill="#5a3a2a" stroke="#2f1f17" stroke-width="1.5"/>
            <g class="bandeja-entrada"></g>
            <text y="27" text-anchor="middle" class="rotulo-bandeja">ENTRADA</text>
          </g>
          <g transform="translate(96 22)">
            <rect x="-26" y="-18" width="52" height="36" fill="#5a3a2a" stroke="#2f1f17" stroke-width="1.5"/>
            <g class="bandeja-salida"></g>
            <text y="27" text-anchor="middle" class="rotulo-bandeja">SALIDA</text>
          </g>
          <g transform="translate(70 -28)">
            <rect x="-18" y="-11" width="36" height="22" rx="2" fill="#7b5a3c" stroke="#3a2a20"/>
            <g fill="${P.papelClaro}" stroke="#bfae8c" stroke-width=".5">
              <rect x="-15" y="-8" width="30" height="3"/><rect x="-15" y="-3" width="30" height="3"/><rect x="-15" y="2" width="30" height="3"/>
            </g>
          </g>
          ${lampara(124, -24, 14)}
          <g transform="translate(0 -78)">${persona(agente)}</g>
        </g>
        <g class="placa" transform="translate(${x} ${y + 92})">
          <rect class="placa-fondo" x="-88" y="-18" width="176" height="36" rx="2" fill="${P.dorado}" stroke="#7d5f2c" stroke-width="1.2" filter="url(#sombra-suave)"/>
          <rect x="-84" y="-14" width="168" height="28" rx="1" fill="none" stroke="#7d5f2c" stroke-width=".6"/>
          <circle class="piloto-agente" cx="-70" cy="0" r="5" stroke="#3a2a12" stroke-width="1"/>
          <text x="8" y="-2" text-anchor="middle" class="placa-nombre">${esc(agente.nombre.toUpperCase())}</text>
          <text x="8" y="10" text-anchor="middle" class="placa-dep">COORDINACIÓN</text>
        </g>
      </g>`;
  }

  function alfombra(x, y, w, h, colores) {
    const [fondo, borde, centro] = colores;
    let flecos = "";
    for (let i = 8; i < h - 4; i += 7) {
      flecos += `<line x1="${x - 8}" y1="${y + i}" x2="${x}" y2="${y + i}" stroke="#e8dcc2" stroke-width="1.4"/>`;
      flecos += `<line x1="${x + w}" y1="${y + i}" x2="${x + w + 8}" y2="${y + i}" stroke="#e8dcc2" stroke-width="1.4"/>`;
    }
    let motivos = "";
    const paso = 22;
    for (let i = x + 30; i < x + w - 24; i += paso) {
      motivos += `<path d="M${i} ${y + 16} l5 -5 l5 5 l-5 5 z" fill="${P.dorado}" opacity=".8"/>`;
      motivos += `<path d="M${i} ${y + h - 16} l5 -5 l5 5 l-5 5 z" fill="${P.dorado}" opacity=".8"/>`;
    }
    for (let j = y + 34; j < y + h - 28; j += paso) {
      motivos += `<path d="M${x + 16} ${j} l5 -5 l5 5 l-5 5 z" fill="${P.dorado}" opacity=".8"/>`;
      motivos += `<path d="M${x + w - 26} ${j} l5 -5 l5 5 l-5 5 z" fill="${P.dorado}" opacity=".8"/>`;
    }
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = Math.min(w * 0.28, 150);
    const ry = Math.min(h * 0.3, 90);
    return `
      <g class="alfombra" filter="url(#sombra-suave)">
        ${flecos}
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${borde}"/>
        <rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" fill="none" stroke="${P.dorado}" stroke-width="1.5"/>
        <rect x="${x + 28}" y="${y + 28}" width="${w - 56}" height="${h - 56}" fill="${fondo}" stroke="${P.dorado}" stroke-width="2"/>
        <rect x="${x + 34}" y="${y + 34}" width="${w - 68}" height="${h - 68}" fill="url(#trama-alfombra)" opacity=".5"/>
        ${motivos}
        <path d="M${cx - rx} ${cy} L${cx} ${cy - ry} L${cx + rx} ${cy} L${cx} ${cy + ry} Z" fill="${centro}" stroke="${P.dorado}" stroke-width="2"/>
        <path d="M${cx - rx * 0.6} ${cy} L${cx} ${cy - ry * 0.6} L${cx + rx * 0.6} ${cy} L${cx} ${cy + ry * 0.6} Z" fill="${borde}" stroke="${P.dorado}" stroke-width="1.2"/>
        <circle cx="${cx}" cy="${cy}" r="${Math.min(rx, ry) * 0.22}" fill="${P.dorado}"/>
        ${[
          [x + 28, y + 28],
          [x + w - 28, y + 28],
          [x + 28, y + h - 28],
          [x + w - 28, y + h - 28],
        ]
          .map(([a, b]) => `<path d="M${a} ${b} m-14 0 l14 -14 l14 14 l-14 14 z" fill="${centro}" stroke="${P.dorado}" stroke-width="1" />`)
          .join("")}
      </g>`;
  }

  function planta(cx, cy, r = 26) {
    let hojasPlanta = "";
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 360;
      const verde = ["#55705A", "#3f5f48", "#6b8a5e"][i % 3];
      hojasPlanta += `<ellipse cx="0" cy="${-r * 0.55}" rx="${r * 0.22}" ry="${r * 0.62}" fill="${verde}" transform="rotate(${a})"/>`;
    }
    return `
      <g transform="translate(${cx} ${cy})" filter="url(#sombra-suave)">
        <circle r="${r * 0.62}" fill="#9c5b3a" stroke="#6d3c24" stroke-width="2"/>
        ${hojasPlanta}
        <circle r="${r * 0.18}" fill="#2f4a37"/>
      </g>`;
  }

  function archivador(proyecto, x, y) {
    const nombre = proyecto.nombre.toUpperCase();
    const tam = nombre.length > 9 ? Math.max(7, 10 - (nombre.length - 9) * 0.45) : 10;
    return `
      <g class="archivador" data-proyecto="${esc(proyecto.id)}" tabindex="0" role="button" aria-label="Archivo del proyecto ${esc(proyecto.nombre)}">
        <title>Archivo · ${esc(proyecto.nombre)}</title>
        <rect x="${x}" y="${y}" width="96" height="64" rx="2" fill="#5b3b2b" stroke="#2f1f17" stroke-width="1.5" filter="url(#sombra)"/>
        <rect x="${x + 4}" y="${y + 4}" width="88" height="56" fill="#6e4a35"/>
        <rect x="${x + 90}" y="${y + 4}" width="6" height="56" fill="#3f291e"/>
        <rect x="${x + 94}" y="${y + 13}" width="4" height="10" rx="1" fill="${P.dorado}"/>
        <rect x="${x + 94}" y="${y + 41}" width="4" height="10" rx="1" fill="${P.dorado}"/>
        <rect x="${x + 4}" y="${y + 4}" width="7" height="56" fill="${proyecto.color}"/>
        <g class="cajon-etiqueta">
          <rect x="${x + 15}" y="${y + 20}" width="72" height="24" fill="${P.papelClaro}" stroke="#a88752" stroke-width=".8"/>
          <text x="${x + 51}" y="${y + 36}" text-anchor="middle" class="etiqueta-archivo" style="font-size:${tam.toFixed(1)}px">${esc(abreviar(nombre, 16))}</text>
        </g>
        <g class="archivo-pendientes"></g>
      </g>`;
  }

  function abreviar(s, n) {
    return s.length > n ? `${s.slice(0, n - 1)}.` : s;
  }

  // ── la planta completa ─────────────────────────────────────────────────────
  let svgRef = null;
  const firmas = new Map();

  function dibujar(svg, config, proyectos) {
    svgRef = svg;
    firmas.clear();
    const deps = Object.fromEntries(config.departamentos.map((d) => [d.id, d]));
    const coord = config.agentes.find((a) => a.coordinador) || config.agentes[0];
    const resto = config.agentes.filter((a) => a !== coord);
    const porFila = Math.max(1, Math.ceil(resto.length / 2));
    const izquierda = 260;
    const derecha = 250;
    const paso = 236;
    const W = Math.max(1600, izquierda + derecha + porFila * paso);
    const H = 1000;
    const muro = 22;

    const zonaX0 = izquierda;
    const zonaX1 = W - derecha;
    const xs = (n) => Array.from({ length: n }, (_, i) => zonaX0 + ((zonaX1 - zonaX0) / n) * (i + 0.5));
    const filaArriba = resto.slice(0, porFila);
    const filaAbajo = resto.slice(porFila);
    const cx = (zonaX0 + zonaX1) / 2;
    const cy = H / 2 + 6;

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    let s = `
      <defs>
        <pattern id="parquet" width="192" height="40" patternUnits="userSpaceOnUse">
          <rect width="192" height="40" fill="#865838"/>
          <rect x="0" y="0" width="74" height="20" fill="#8c5d3c"/>
          <rect x="74" y="0" width="118" height="20" fill="#7d5134"/>
          <rect x="0" y="20" width="36" height="20" fill="#7f5336"/>
          <rect x="36" y="20" width="96" height="20" fill="#93643f"/>
          <rect x="132" y="20" width="60" height="20" fill="#845739"/>
          <g stroke="#3c2519" stroke-opacity=".55" stroke-width=".9">
            <line x1="0" y1="0" x2="192" y2="0"/><line x1="0" y1="20" x2="192" y2="20"/>
            <line x1="74" y1="0" x2="74" y2="20"/><line x1="36" y1="20" x2="36" y2="40"/><line x1="132" y1="20" x2="132" y2="40"/>
          </g>
          <g stroke="#5b3a26" stroke-opacity=".25" stroke-width=".6" fill="none">
            <path d="M4 7 Q40 5 70 8"/><path d="M80 13 Q130 10 188 13"/><path d="M40 27 Q80 30 128 26"/><path d="M136 33 Q160 31 190 34"/>
          </g>
        </pattern>
        <pattern id="trama-alfombra" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M7 0 L14 7 L7 14 L0 7 Z" fill="none" stroke="#B18A4A" stroke-width=".6"/>
        </pattern>
        <radialGradient id="luz-lampara">
          <stop offset="0" stop-color="#FFE7AE" stop-opacity=".85"/>
          <stop offset=".45" stop-color="#FFD98A" stop-opacity=".28"/>
          <stop offset="1" stop-color="#FFD98A" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="luz-sala" cx=".5" cy=".45" r=".7">
          <stop offset="0" stop-color="#FFE4B0" stop-opacity=".16"/>
          <stop offset="1" stop-color="#1c120d" stop-opacity=".32"/>
        </radialGradient>
        <linearGradient id="luz-ventana" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#FFF1CF" stop-opacity=".32"/>
          <stop offset="1" stop-color="#FFF1CF" stop-opacity="0"/>
        </linearGradient>
        <filter id="sombra" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="3" dy="5" stdDeviation="3" flood-color="#1a100b" flood-opacity=".45"/>
        </filter>
        <filter id="sombra-suave" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="1.5" dy="2.5" stdDeviation="1.6" flood-color="#1a100b" flood-opacity=".4"/>
        </filter>
      </defs>
      <style>
        .placa-nombre { font: 700 12.5px "Playfair Display", Georgia, serif; letter-spacing: .14em; fill: #211C18; }
        .placa-dep { font: 8.5px "Special Elite", "Courier New", monospace; letter-spacing: .12em; fill: #3a2a12; }
        .etiqueta-archivo { font: 10px "Special Elite", "Courier New", monospace; letter-spacing: .06em; fill: #211C18; }
        .rotulo-bandeja { font: 7.5px "Special Elite", "Courier New", monospace; letter-spacing: .14em; fill: #E7D8BC; }
        .rotulo-suelo { font: 13px "Special Elite", "Courier New", monospace; letter-spacing: .32em; fill: #E7D8BC; opacity: .75; }
        .rotulo-casa { font: 800 13px "Playfair Display", Georgia, serif; letter-spacing: .12em; fill: #D2B57A; }
        .contador { font: 700 11px "Playfair Display", Georgia, serif; fill: #F2E8D5; }
      </style>

      <rect width="${W}" height="${H}" fill="#e6d7b9"/>
      <rect x="${muro}" y="${muro}" width="${W - 2 * muro}" height="${H - 2 * muro}" fill="url(#parquet)"/>
      <rect x="${muro}" y="${muro}" width="${W - 2 * muro}" height="${H - 2 * muro}" fill="none" stroke="${P.madera}" stroke-width="6"/>`;

    // Ventanas en el muro norte, entre escritorios, y su luz sobre el suelo.
    const pasoFila = (zonaX1 - zonaX0) / porFila;
    const ventanas = [zonaX0 - 60, ...Array.from({ length: porFila - 1 }, (_, i) => zonaX0 + pasoFila * (i + 1))];
    for (const vx of ventanas) {
      s += `<path d="M${vx - 46} ${muro} L${vx + 46} ${muro} L${vx + 84} ${muro + 230} L${vx - 84} ${muro + 230} Z" fill="url(#luz-ventana)"/>`;
      s += `<rect x="${vx - 48}" y="2" width="96" height="${muro - 2}" fill="#dfe3d4" stroke="${P.nogal}" stroke-width="2"/>`;
      s += `<line x1="${vx}" y1="2" x2="${vx}" y2="${muro}" stroke="${P.nogal}" stroke-width="2"/>`;
      s += `<line x1="${vx - 48}" y1="${muro / 2 + 1}" x2="${vx + 48}" y2="${muro / 2 + 1}" stroke="${P.nogal}" stroke-width="1"/>`;
    }

    // Puerta de entrada (muro este) abierta hacia dentro, con su barrido y felpudo.
    const py = H - 210;
    const pared = W - muro;
    s += `<rect x="${pared - 3}" y="${py}" width="${muro + 6}" height="90" fill="url(#parquet)"/>`;
    // Felpudo con el nombre de la casa.
    s += `<g filter="url(#sombra-suave)">
      <rect x="${pared - 72}" y="${py - 4}" width="52" height="98" rx="3" fill="#6e241c"/>
      <rect x="${pared - 67}" y="${py + 1}" width="42" height="88" rx="2" fill="none" stroke="${P.dorado}" stroke-width="1.2"/>
      <text x="${pared - 46}" y="${py + 45}" text-anchor="middle" dominant-baseline="central" class="rotulo-casa" transform="rotate(-90 ${pared - 46} ${py + 45})" textLength="80" lengthAdjust="spacingAndGlyphs">GROSSMART</text>
    </g>`;
    s += `<path d="M${pared - 90} ${py} A90 90 0 0 0 ${pared} ${py + 90}" fill="none" stroke="${P.tinta}" stroke-width="1" stroke-dasharray="4 4" opacity=".5"/>`;
    s += `<rect x="${pared - 90}" y="${py - 3}" width="90" height="6" fill="${P.nogal}" stroke="${P.tinta}" stroke-width=".8"/>`;
    s += `<circle cx="${pared - 82}" cy="${py + 6}" r="2.5" fill="${P.dorado}"/>`;

    // Alfombras persas: el centro de operaciones y la sala de espera.
    s += alfombra(cx - 280, cy - 165, 560, 330, ["#7d2a20", "#2f4639", "#a7472f"]);
    s += alfombra(W - derecha + 40, 150, 170, 250, ["#315447", "#5a2a22", "#862820"]);
    s += `<text x="${cx}" y="${cy - 180}" text-anchor="middle" class="rotulo-suelo">GROSSMART · CENTRO DE OPERACIONES</text>`;

    // Archivo de proyectos (muro oeste).
    s += `<text x="58" y="${H / 2}" text-anchor="middle" class="rotulo-suelo" transform="rotate(-90 40 ${H / 2})">ARCHIVO DE PROYECTOS</text>`;
    const altoCajon = 74;
    const porColumna = Math.max(1, Math.floor((H - 2 * muro - 140) / altoCajon));
    proyectos.forEach((p, i) => {
      const col = Math.floor(i / porColumna);
      const fila = i % porColumna;
      s += archivador(p, 64 + col * 106, 80 + fila * altoCajon);
    });

    // Mesa de encargos (las fichas de lo que ha entrado).
    const mx = cx - 400;
    s += `
      <g class="mesa-encargos" data-vista="operaciones" tabindex="0" role="button" aria-label="Mesa de encargos">
        <title>Mesa de encargos</title>
        <rect x="${mx - 70}" y="${cy - 60}" width="140" height="120" rx="6" fill="${P.madera}" filter="url(#sombra)"/>
        <rect x="${mx - 66}" y="${cy - 56}" width="132" height="112" rx="4" fill="#6a4532"/>
        <rect x="${mx - 56}" y="${cy - 46}" width="112" height="92" rx="2" fill="${P.verdeBiblioteca}" stroke="${P.dorado}" stroke-width="1"/>
        <g class="fichas-encargos"></g>
        ${lampara(mx + 52, cy - 44, 11)}
        <text x="${mx}" y="${cy + 80}" text-anchor="middle" class="rotulo-suelo" font-size="10">MESA DE ENCARGOS</text>
      </g>`;

    // Mobiliario de época: perchero, sofá de espera, biblioteca, plantas.
    const sx = W - derecha + 125;
    s += `
      <g filter="url(#sombra)">
        <rect x="${sx - 30}" y="170" width="60" height="210" rx="10" fill="#5a2a22"/>
        <rect x="${sx + 12}" y="170" width="18" height="210" rx="8" fill="#4a211b"/>
        <rect x="${sx - 30}" y="170" width="60" height="16" rx="8" fill="#4a211b"/>
        <rect x="${sx - 30}" y="364" width="60" height="16" rx="8" fill="#4a211b"/>
        ${[205, 245, 285, 325].map((yy) => `<circle cx="${sx - 6}" cy="${yy}" r="1.6" fill="#2d1411"/>`).join("")}
      </g>
      <g filter="url(#sombra-suave)">
        <circle cx="${sx - 70}" cy="275" r="24" fill="${P.nogal}"/>
        <circle cx="${sx - 70}" cy="275" r="20" fill="#7a5540"/>
        <rect x="${sx - 86}" y="262" width="26" height="20" fill="${P.papelClaro}" transform="rotate(-12 ${sx - 73} 272)"/>
        <circle cx="${sx - 62}" cy="284" r="5" fill="#b9b0a0" stroke="#7a6d5e"/>
      </g>
      <g transform="translate(${W - muro - 40} ${py + 140})" filter="url(#sombra-suave)">
        <circle r="15" fill="#3b2a22"/>
        <circle r="4" fill="${P.dorado}"/>
        <g transform="translate(-10 -16)">${sombrero("fedora", "#3a3530")}</g>
        <g transform="translate(14 8) scale(.9)">${sombrero("bombin", "#211C18")}</g>
      </g>
      <g filter="url(#sombra)">
        <rect x="${W - derecha + 10}" y="${muro + 2}" width="${derecha - 40}" height="26" fill="#3f291e"/>
        ${Array.from({ length: 28 }, (_, i) => {
          const colores = ["#862820", "#315447", "#B18A4A", "#684735", "#55705A", "#5a3a2a", "#8B7355"];
          const ancho = 5 + ((i * 7) % 4);
          return `<rect x="${W - derecha + 14 + i * 7.2}" y="${muro + 5}" width="${ancho}" height="${17 + ((i * 5) % 4)}" fill="${colores[(i * 3) % colores.length]}"/>`;
        }).join("")}
      </g>`;
    // Mesa de ajedrez (para los ratos libres) y aparador del café.
    const ajedrez = { x: zonaX1 - 110, y: cy };
    s += mesaAjedrez(ajedrez.x, ajedrez.y);
    const cafeY = cy + 34;
    s += aparadorCafe(W - muro - 22, cafeY);

    s += planta(muro + 40, H - muro - 40, 30);
    s += planta(W - muro - 42, muro + 64, 26);
    s += planta(cx + 330, cy - 120, 20);
    s += planta(cx + 330, cy + 120, 20);

    // Escritorios.
    filaArriba.forEach((a, i) => (s += puestoAgente(a, deps[a.departamento] || { nombre: a.departamento }, xs(filaArriba.length)[i], 160, false)));
    filaAbajo.forEach((a, i) => (s += puestoAgente(a, deps[a.departamento] || { nombre: a.departamento }, xs(filaAbajo.length)[i], H - 160, true)));
    s += puestoCoordinacion(coord, cx, cy + 6);

    // Capa de los que se levantan a dar una vuelta (paseos.js).
    s += `<g id="paseantes"></g>`;

    // Luz cálida de la sala.
    s += `<rect width="${W}" height="${H}" fill="url(#luz-sala)" pointer-events="none"/>`;

    svg.innerHTML = s;

    // Geometría para los paseos: dónde se sienta cada uno, por dónde sale de
    // su escritorio y a qué pasillo da. Los pasillos son horizontales (uno
    // sobre la alfombra central, otro debajo) y se cruzan por carriles verticales.
    const arriba = muro + 273;
    const abajo = H - 285;
    const sitios = [];
    const salidaFila = (lista, yPersona, pasillo) =>
      lista.forEach((a, i) => {
        const x = xs(lista.length)[i];
        const sx2 = x + (zonaX1 - zonaX0) / lista.length / 2;
        sitios.push({ agente: a, silla: { x, y: yPersona, giro: yPersona > cy ? 180 : 0 }, salida: [{ x: sx2, y: yPersona }, { x: sx2, y: pasillo }], pasillo });
      });
    salidaFila(filaArriba, 160 - 66, arriba);
    salidaFila(filaAbajo, H - 160 + 66, abajo);
    sitios.push({ agente: coord, silla: { x: cx, y: cy + 6 - 78, giro: 0 }, salida: [{ x: cx + 175, y: cy + 6 - 78 }, { x: cx + 175, y: arriba }], pasillo: arriba });

    const destinos = {
      ajedrez: [
        { carril: ajedrez.x - 48, punto: { x: ajedrez.x - 48, y: ajedrez.y }, giro: -90, accesorio: null },
        { carril: ajedrez.x + 48, punto: { x: ajedrez.x + 48, y: ajedrez.y }, giro: 90, accesorio: null },
      ],
      cafe: [{ carril: zonaX1, via: [{ x: zonaX1, y: cafeY }], punto: { x: W - muro - 70, y: cafeY }, giro: -90, accesorio: "taza" }],
      sofa: [215, 335].map((yy) => ({ carril: zonaX1, via: [{ x: zonaX1, y: yy }], punto: { x: sx - 4, y: yy }, giro: 90, accesorio: "periodico" })),
      archivo: proyectos.map((_, i) => {
        const col = Math.floor(i / porColumna);
        const yy = 80 + (i % porColumna) * altoCajon + 33;
        return { carril: 64 + col * 106 + 136, punto: { x: 64 + col * 106 + 136, y: yy }, giro: 90, accesorio: "carpeta" };
      }),
    };
    geometria = { sitios, destinos, arriba, abajo };
  }

  function mesaAjedrez(x, y) {
    let casillas = "";
    for (let f = 0; f < 8; f++)
      for (let c = 0; c < 8; c++)
        if ((f + c) % 2) casillas += `<rect x="${x - 20 + c * 5}" y="${y - 20 + f * 5}" width="5" height="5" fill="#4A3024"/>`;
    const piezas = [
      [-17.5, -17.5, 1], [-7.5, -17.5, 1], [2.5, -12.5, 1], [12.5, -17.5, 1], [-12.5, -7.5, 1],
      [-17.5, 12.5, 0], [-2.5, 17.5, 0], [7.5, 12.5, 0], [17.5, 17.5, 0], [12.5, 7.5, 0],
    ]
      .map(([dx, dy, n], i) => `<circle class="pieza${i === 4 ? " pieza-viva" : ""}" cx="${x + dx}" cy="${y + dy}" r="1.9" fill="${n ? "#211C18" : "#F7F0E1"}" stroke="${n ? "#000" : "#a89a80"}" stroke-width=".5"/>`)
      .join("");
    return `
      <g class="mesa-ajedrez" filter="url(#sombra-suave)">
        <circle cx="${x - 48}" cy="${y}" r="17" fill="#3b2a22"/><circle cx="${x - 48}" cy="${y}" r="13" fill="${P.cuero}"/>
        <circle cx="${x + 48}" cy="${y}" r="17" fill="#3b2a22"/><circle cx="${x + 48}" cy="${y}" r="13" fill="${P.cuero}"/>
        <circle cx="${x}" cy="${y}" r="31" fill="${P.madera}"/>
        <circle cx="${x}" cy="${y}" r="28" fill="#6a4532"/>
        <rect x="${x - 21}" y="${y - 21}" width="42" height="42" fill="#E7D8BC" stroke="${P.dorado}" stroke-width="1"/>
        ${casillas}${piezas}
      </g>`;
  }

  function aparadorCafe(x, y) {
    return `
      <g class="aparador-cafe" filter="url(#sombra)">
        <rect x="${x - 34}" y="${y - 62}" width="34" height="124" rx="2" fill="${P.madera}"/>
        <rect x="${x - 31}" y="${y - 59}" width="28" height="118" fill="#6a4532"/>
        <rect x="${x - 28}" y="${y - 44}" width="22" height="26" rx="3" fill="#8a8178" stroke="#3a332e"/>
        <circle cx="${x - 17}" cy="${y - 31}" r="6" fill="#2a2522"/>
        <rect x="${x - 26}" y="${y - 12}" width="18" height="6" rx="2" fill="${P.dorado}"/>
        ${[8, 22, 36].map((d) => `<circle cx="${x - 17}" cy="${y + d}" r="5" fill="#F7F0E1" stroke="#a89a80" stroke-width=".8"/><circle cx="${x - 17}" cy="${y + d}" r="2.6" fill="#5a3a22"/>`).join("")}
      </g>`;
  }

  // ── lo que cambia con el trabajo ───────────────────────────────────────────
  function poner(sel, contenedor, clave, html) {
    if (firmas.get(clave) === html) return;
    firmas.set(clave, html);
    const g = contenedor.querySelector(sel);
    if (g) g.innerHTML = html;
  }

  function actualizar(estado, proyectosPorId) {
    if (!svgRef) return;
    const tareas = estado.tareas;
    for (const g of svgRef.querySelectorAll(".agente")) {
      const id = g.dataset.agente;
      const suyas = tareas.filter((t) => t.agente === id);
      const trabajando = suyas.find((t) => t.estado === "trabajando");
      const abiertas = suyas.filter((t) => !["terminada"].includes(t.estado));
      const espera = suyas.some((t) => t.esperaGrossman);
      const error = suyas.some((t) => t.estado === "error");
      const clase = trabajando ? "trabajando" : espera ? "esperando" : error ? "error" : "libre";
      g.classList.remove("libre", "trabajando", "esperando", "error");
      g.classList.add(clase);
      // Con trabajo en la bandeja (a punto de empezar) nadie se levanta.
      g.classList.toggle("con-bandeja", suyas.some((x) => x.estado === "asignada"));

      const t = g.querySelector("title");
      const nombre = t.textContent.split(" — ")[0];
      t.textContent = trabajando ? `${nombre} — trabajando en: ${trabajando.titulo}` : `${nombre} — ${abiertas.length ? `${abiertas.length} en la bandeja` : "libre"}`;

      if (!g.classList.contains("mesa-coordinacion")) {
        poner(".papeles", g, `papeles:${id}`, hojas(0, 0, Math.min(abiertas.length, 5)));
        const activos = [...new Set(abiertas.map((x) => x.proyecto))].slice(0, 3);
        poner(".carpetas", g, `carpetas:${id}`, carpetas(-62 + 120, 22, activos.map((p) => proyectosPorId[p]?.color || P.dorado)));
      }
    }

    // Bandejas de Coordinación y mesa de encargos.
    const abiertos = estado.encargos.filter((e) => e.estado !== "entregado");
    const entregados = estado.encargos.filter((e) => e.estado === "entregado");
    poner(".bandeja-entrada", svgRef, "entrada", hojas(0, 2, Math.min(abiertos.length, 6), 0).replace(/<g transform/g, '<g class="papel-nuevo" transform') + contador(abiertos.length));
    poner(".bandeja-salida", svgRef, "salida", hojas(0, 2, Math.min(entregados.length, 6), 4) + contador(entregados.length));
    const mesa = svgRef.querySelector(".mesa-encargos");
    if (mesa) {
      mesa.classList.toggle("trabajando", abiertos.length > 0);
      const box = mesa.querySelector("rect").getBBox();
      const fichas = abiertos
        .slice(-8)
        .map((e, i) => {
          const x = box.x + 30 + (i % 3) * 38;
          const y = box.y + 30 + Math.floor(i / 3) * 30;
          const color = proyectosPorId[e.proyecto]?.color || P.dorado;
          return `<g class="papel-nuevo" transform="translate(${x} ${y}) rotate(${((i * 23) % 14) - 7})">
            <rect x="-16" y="-11" width="32" height="22" fill="${P.papelClaro}" stroke="#bfae8c" stroke-width=".6"/>
            <line x1="-11" y1="-3" x2="11" y2="-3" stroke="#8b8172" stroke-width=".7"/><line x1="-11" y1="2" x2="6" y2="2" stroke="#8b8172" stroke-width=".7"/>
            <circle cx="0" cy="-9" r="2.6" fill="${color}" stroke="#211C18" stroke-width=".5"/>
          </g>`;
        })
        .join("");
      poner(".fichas-encargos", svgRef, "fichas", fichas);
    }

    // Pendientes de cada archivo de proyecto.
    for (const g of svgRef.querySelectorAll(".archivador")) {
      const id = g.dataset.proyecto;
      const n = tareas.filter((t) => t.proyecto === id && t.tipo === "tarea" && t.estado !== "terminada").length;
      const r = g.querySelector("rect").getBBox();
      poner(
        ".archivo-pendientes",
        g,
        `arch:${id}`,
        n ? `<circle cx="${r.x + r.width - 4}" cy="${r.y + 4}" r="10" fill="${P.rojo}" stroke="${P.crema}" stroke-width="1.5"/><text x="${r.x + r.width - 4}" y="${r.y + 8}" text-anchor="middle" class="contador">${n}</text>` : "",
      );
    }
  }

  function contador(n) {
    return n ? `<text x="20" y="-10" text-anchor="end" class="contador">${n}</text>` : "";
  }

  let geometria = null;
  window.Planta = { dibujar, actualizar, sombrero, persona, geometria: () => geometria };
})();
