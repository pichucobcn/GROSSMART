// Markdown → HTML, lo justo para los documentos de los agentes.
// Escapa todo el HTML de entrada: los documentos nunca inyectan marcado.
(function () {
  function escapar(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function enLinea(texto) {
    const codigos = [];
    let s = escapar(texto).replace(/`([^`]+)`/g, (_, c) => {
      codigos.push(c);
      return `\u0000${codigos.length - 1}\u0000`;
    });
    s = s
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/(^|[^\w])_([^_\s][^_]*)_(?!\w)/g, "$1<em>$2</em>");
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codigos[i]}</code>`);
  }

  function celdas(linea) {
    return linea
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
  }

  function markdown(md) {
    const lineas = String(md || "").replace(/\r\n?/g, "\n").split("\n");
    const html = [];
    let i = 0;
    while (i < lineas.length) {
      const l = lineas[i];

      if (/^```/.test(l)) {
        const bloque = [];
        i++;
        while (i < lineas.length && !/^```/.test(lineas[i])) bloque.push(lineas[i++]);
        i++;
        html.push(`<pre><code>${escapar(bloque.join("\n"))}</code></pre>`);
        continue;
      }
      if (!l.trim()) {
        i++;
        continue;
      }
      const titulo = l.match(/^(#{1,6})\s+(.*)$/);
      if (titulo) {
        const n = Math.min(titulo[1].length, 4);
        html.push(`<h${n}>${enLinea(titulo[2])}</h${n}>`);
        i++;
        continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) {
        html.push("<hr>");
        i++;
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?[\s:|-]+\|?\s*$/.test(lineas[i + 1] || "") && lineas[i + 1].includes("-")) {
        const cabecera = celdas(l);
        i += 2;
        const filas = [];
        while (i < lineas.length && /^\s*\|.*\|\s*$/.test(lineas[i])) filas.push(celdas(lineas[i++]));
        html.push(
          `<table><thead><tr>${cabecera.map((c) => `<th>${enLinea(c)}</th>`).join("")}</tr></thead><tbody>${filas
            .map((f) => `<tr>${f.map((c) => `<td>${enLinea(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`,
        );
        continue;
      }
      if (/^\s*>/.test(l)) {
        const bloque = [];
        while (i < lineas.length && /^\s*>/.test(lineas[i])) bloque.push(lineas[i++].replace(/^\s*>\s?/, ""));
        html.push(`<blockquote>${markdown(bloque.join("\n"))}</blockquote>`);
        continue;
      }
      const lista = l.match(/^(\s*)([-*+]|\d+[.)])\s+/);
      if (lista) {
        const ordenada = /\d/.test(lista[2]);
        const items = [];
        while (i < lineas.length) {
          const m = lineas[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
          if (m) {
            const sangria = m[1].length > 1;
            items.push({ texto: m[3], sangria });
            i++;
          } else if (lineas[i].trim() && /^\s{2,}/.test(lineas[i]) && items.length) {
            items[items.length - 1].texto += " " + lineas[i].trim();
            i++;
          } else break;
        }
        const etiqueta = ordenada ? "ol" : "ul";
        let s = `<${etiqueta}>`;
        let abierta = false;
        for (const it of items) {
          if (it.sangria && !abierta) {
            s = s.replace(/<\/li>$/, "") + "<ul>";
            abierta = true;
          } else if (!it.sangria && abierta) {
            s += "</ul></li>";
            abierta = false;
          }
          s += `<li>${enLinea(it.texto)}</li>`;
        }
        if (abierta) s += "</ul></li>";
        html.push(s + `</${etiqueta}>`);
        continue;
      }
      const parrafo = [];
      while (
        i < lineas.length &&
        lineas[i].trim() &&
        !/^(#{1,6}\s|```|\s*>|\s*([-*+]|\d+[.)])\s+)/.test(lineas[i]) &&
        !/^\s*\|.*\|\s*$/.test(lineas[i])
      ) {
        parrafo.push(lineas[i++]);
      }
      if (!parrafo.length) parrafo.push(lineas[i++]);
      html.push(`<p>${parrafo.map(enLinea).join("<br>")}</p>`);
    }
    return html.join("\n");
  }

  window.markdown = markdown;
  window.escapar = escapar;
})();
