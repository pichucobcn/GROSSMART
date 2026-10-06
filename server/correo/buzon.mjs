// Un buzón de correo, por IMAP. Es lo único de Grossmart que toca el correo.
//
// Lo que sabe hacer está cerrado a propósito: leer, etiquetar (Gmail) o mover
// a una carpeta (Outlook), archivar, marcar como leído, mandar a la PAPELERA y
// GUARDAR BORRADORES. No hay código para enviar ni para borrar definitivamente:
// lo que va a la papelera se puede recuperar (Gmail y Outlook la vacían a los
// 30 días). Aunque alguien engañara a un agente, Grossmart no podría más.

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import MailComposer from "nodemailer/lib/mail-composer/index.js";

const MAX_FUENTE = 400_000; // bytes de cada correo que se leen (sin adjuntos enormes)
const MAX_TEXTO = 6000;
export const MAX_ADJUNTOS = 20 * 1024 * 1024;

export class Buzon {
  // cuenta: { id, tipo: "gmail" | "outlook" | "imap", usuario, host, puerto, clave?, obtenerToken? }
  constructor(cuenta, { registro = console } = {}) {
    this.cuenta = cuenta;
    this.registro = registro;
    this.cliente = null;
  }

  async abrir() {
    const c = this.cuenta;
    const auth = c.obtenerToken ? { user: c.usuario, accessToken: await c.obtenerToken() } : { user: c.usuario, pass: c.clave };
    this.cliente = new ImapFlow({
      host: c.host,
      port: c.puerto || 993,
      secure: c.seguro !== false,
      auth,
      logger: false,
      // En pruebas locales (servidor IMAP de ensayo) no hay certificado.
      ...(c.sinTLS ? { secure: false, doSTARTTLS: false } : {}),
    });
    this.cliente.on("error", (e) => this.registro.warn(`[correo ${c.id}] ${e.message}`));
    await this.cliente.connect();
    return this;
  }

  async cerrar() {
    try {
      await this.cliente?.logout();
    } catch {
      this.cliente?.close();
    }
  }

  get esGmail() {
    return this.cuenta.tipo === "gmail";
  }

  // ── leer ──────────────────────────────────────────────────────────────────
  // Correos de la bandeja de entrada con UID mayor que `desdeUid`, o de los
  // últimos `dias` si es la primera vez. Como mucho `max`, los más recientes.
  async leerNuevos({ desdeUid = 0, uidValidity = null, dias = 3, max = 40 }) {
    const candado = await this.cliente.getMailboxLock("INBOX");
    try {
      const buzon = this.cliente.mailbox;
      const validez = String(buzon.uidValidity);
      const reinicio = uidValidity && String(uidValidity) !== validez;
      const criterio = desdeUid && !reinicio ? { uid: `${desdeUid + 1}:*` } : { since: new Date(Date.now() - dias * 86_400_000) };
      let uids = (await this.cliente.search(criterio, { uid: true })) || [];
      uids = uids.filter((u) => !desdeUid || reinicio || u > desdeUid).sort((a, b) => a - b);
      const ultimoUid = uids.length ? uids.at(-1) : desdeUid;
      uids = uids.slice(-max);
      const mensajes = [];
      if (uids.length) {
        const crudos = [];
        for await (const m of this.cliente.fetch(uids.join(","), { uid: true, envelope: true, bodyStructure: true, internalDate: true, size: true, flags: true, source: { maxLength: MAX_FUENTE } }, { uid: true })) {
          crudos.push(m);
        }
        for (const m of crudos) {
          // Algunos servidores no devuelven el contenido al pedir varios a la vez: se pide de nuevo.
          if (!m.source?.length && m.size > 0) {
            const solo = await this.cliente.fetchOne(String(m.uid), { source: { maxLength: MAX_FUENTE } }, { uid: true });
            if (solo?.source) m.source = solo.source;
          }
          mensajes.push(await this.#convertir(m, validez));
        }
      }
      return { mensajes, ultimoUid: Math.max(ultimoUid || 0, desdeUid && !reinicio ? desdeUid : 0), uidValidity: validez };
    } finally {
      candado.release();
    }
  }

  async #convertir(m, validez) {
    let texto = "";
    let cabeceras = {};
    try {
      const p = await simpleParser(m.source, { skipHtmlToText: false, skipImageLinks: true, skipTextLinks: true });
      texto = (p.text || "").trim();
      cabeceras = { messageId: p.messageId, inReplyTo: p.inReplyTo, references: [].concat(p.references || []), responderA: direcciones(p.replyTo) };
    } catch (e) {
      texto = `(No se pudo leer el contenido: ${e.message})`;
    }
    const env = m.envelope || {};
    return {
      uid: m.uid,
      uidValidity: validez,
      messageId: cabeceras.messageId || env.messageId || null,
      inReplyTo: cabeceras.inReplyTo || env.inReplyTo || null,
      references: cabeceras.references || [],
      de: (env.from || []).map(dir)[0] || { nombre: "", direccion: "" },
      para: (env.to || []).map(dir),
      cc: (env.cc || []).map(dir),
      responderA: cabeceras.responderA?.length ? cabeceras.responderA : (env.replyTo || []).map(dir),
      asunto: env.subject || "(sin asunto)",
      fecha: (env.date || m.internalDate || new Date()).toISOString?.() || String(env.date),
      leido: m.flags?.has?.("\\Seen") || false,
      texto: recortar(texto, MAX_TEXTO) + (m.size > MAX_FUENTE ? "\n[…correo largo: se leyó solo el principio…]" : ""),
      adjuntos: adjuntosDe(m.bodyStructure),
    };
  }

  // ── organizar ─────────────────────────────────────────────────────────────
  async marcarLeido(uid) {
    return this.#enBandeja(() => this.cliente.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }));
  }

  // Gmail: etiqueta «Grossmart/<etiqueta>». Outlook/IMAP: carpeta con ese nombre.
  async etiquetar(uid, etiqueta) {
    const ruta = `Grossmart/${etiqueta}`;
    if (this.esGmail) {
      return this.#enBandeja(() => this.cliente.messageFlagsAdd(String(uid), [ruta], { uid: true, useLabels: true }));
    }
    await this.#asegurarCarpeta(ruta);
    return this.#enBandeja(() => this.cliente.messageMove(String(uid), ruta, { uid: true }));
  }

  // Sacar de la bandeja de entrada sin borrar.
  async archivar(uid) {
    if (this.esGmail) {
      return this.#enBandeja(() => this.cliente.messageFlagsRemove(String(uid), ["\\Inbox"], { uid: true, useLabels: true }));
    }
    const archivo = (await this.#especial("\\Archive")) || "Archive";
    await this.#asegurarCarpeta(archivo);
    return this.#enBandeja(() => this.cliente.messageMove(String(uid), archivo, { uid: true }));
  }

  // A la papelera (recuperable). Nunca se usa EXPUNGE ni \Deleted.
  async aPapelera(uid) {
    const papelera = (await this.#especial("\\Trash")) || (await this.#porNombre(["[Gmail]/Trash", "[Gmail]/Papelera", "Deleted", "Deleted Items", "Elementos eliminados", "Trash", "Papelera"]));
    if (!papelera) throw new Error("No se encuentra la carpeta Papelera de esta cuenta.");
    return this.#enBandeja(() => this.cliente.messageMove(String(uid), papelera, { uid: true }));
  }

  // ── borradores ────────────────────────────────────────────────────────────
  async descargarAdjunto(uid, parte) {
    return this.#enBandeja(async () => {
      const { content } = await this.cliente.download(String(uid), parte, { uid: true });
      const trozos = [];
      let total = 0;
      for await (const t of content) {
        total += t.length;
        if (total > MAX_ADJUNTOS) throw new Error("El adjunto es demasiado grande.");
        trozos.push(t);
      }
      return Buffer.concat(trozos);
    });
  }

  // Guarda un borrador en la carpeta de Borradores. NO lo envía.
  async guardarBorrador({ para, cc = [], asunto, cuerpo, inReplyTo, references = [], adjuntos = [] }) {
    const mensaje = new MailComposer({
      from: this.cuenta.nombre ? { name: this.cuenta.nombre, address: this.cuenta.usuario } : this.cuenta.usuario,
      to: para,
      cc,
      subject: asunto,
      text: cuerpo,
      inReplyTo: inReplyTo || undefined,
      references: references.length ? references : undefined,
      attachments: adjuntos.map((a) => ({ filename: a.nombre, content: a.contenido })),
    });
    const fuente = await new Promise((ok, mal) => mensaje.compile().build((e, b) => (e ? mal(e) : ok(b))));
    const borradores = (await this.#especial("\\Drafts")) || (this.esGmail ? "[Gmail]/Drafts" : "Drafts");
    await this.cliente.append(borradores, fuente, ["\\Draft", "\\Seen"]);
    return { carpeta: borradores };
  }

  // ── utilidades ────────────────────────────────────────────────────────────
  async #enBandeja(fn) {
    const candado = await this.cliente.getMailboxLock("INBOX");
    try {
      return await fn();
    } finally {
      candado.release();
    }
  }

  async #especial(uso) {
    if (!this.carpetas) this.carpetas = await this.cliente.list();
    return this.carpetas.find((c) => c.specialUse === uso)?.path || null;
  }

  async #porNombre(nombres) {
    if (!this.carpetas) this.carpetas = await this.cliente.list();
    for (const n of nombres) {
      const c = this.carpetas.find((x) => x.path.toLowerCase() === n.toLowerCase());
      if (c) return c.path;
    }
    return null;
  }

  async #asegurarCarpeta(ruta) {
    if (!this.carpetas) this.carpetas = await this.cliente.list();
    if (this.carpetas.some((c) => c.path === ruta)) return;
    try {
      await this.cliente.mailboxCreate(ruta.split("/"));
    } catch (e) {
      if (!/exist/i.test(e.message || "") && !/ALREADYEXISTS/i.test(e.serverResponseCode || "")) throw e;
    }
    this.carpetas = null;
  }
}

function dir(d) {
  return { nombre: d?.name || "", direccion: (d?.address || "").toLowerCase() };
}

function direcciones(campo) {
  return (campo?.value || []).map((v) => ({ nombre: v.name || "", direccion: (v.address || "").toLowerCase() })).filter((d) => d.direccion);
}

// Adjuntos a partir de la estructura del mensaje (sin descargarlos).
function adjuntosDe(nodo, lista = []) {
  if (!nodo) return lista;
  const nombre = nodo.dispositionParameters?.filename || nodo.parameters?.name;
  if (nombre && nodo.part && (nodo.disposition === "attachment" || !String(nodo.type || "").startsWith("text/"))) {
    lista.push({ nombre: String(nombre).slice(0, 200), tipo: nodo.type || "application/octet-stream", tamano: nodo.size || 0, parte: nodo.part });
  }
  for (const hijo of nodo.childNodes || []) adjuntosDe(hijo, lista);
  return lista;
}

function recortar(texto, max) {
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
}
