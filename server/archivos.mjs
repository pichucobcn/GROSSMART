// Archivos que Grossman sube a cada proyecto (dossier, rider, contratos,
// fotos…). Viven en datos/proyectos/<id>/archivos/ y Secretaría puede
// adjuntarlos a borradores. Nunca se ejecutan ni se sirven como página.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export const MAX_ARCHIVO = 15 * 1024 * 1024;
const MAX_POR_PROYECTO = 300;
const EXTENSIONES = new Set([
  "pdf", "doc", "docx", "odt", "rtf", "txt", "md", "csv",
  "xls", "xlsx", "ods", "ppt", "pptx", "odp", "key", "pages", "numbers",
  "jpg", "jpeg", "png", "gif", "webp", "heic", "svg",
  "mp3", "wav", "m4a", "mp4", "mov", "zip",
]);

export class Archivos {
  constructor(dirDatos) {
    this.dirDatos = dirDatos;
  }

  dir(proyecto) {
    if (!/^[\w-]+$/.test(proyecto)) throw new Error("Proyecto no válido.");
    return path.join(this.dirDatos, "proyectos", proyecto, "archivos");
  }

  listar(proyecto) {
    const dir = this.dir(proyecto);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((n) => !n.startsWith("."))
      .map((nombre) => {
        const st = statSync(path.join(dir, nombre));
        return { nombre, tamano: st.size, fecha: st.mtime.toISOString() };
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  guardar(proyecto, nombreOriginal, contenido) {
    const nombre = nombreSeguro(nombreOriginal);
    if (contenido.length > MAX_ARCHIVO) throw new Error("El archivo supera los 15 MB.");
    if (!contenido.length) throw new Error("El archivo está vacío.");
    const dir = this.dir(proyecto);
    mkdirSync(dir, { recursive: true });
    if (readdirSync(dir).length >= MAX_POR_PROYECTO) throw new Error("Este proyecto ya tiene demasiados archivos.");
    let final = nombre;
    const { name, ext } = path.parse(nombre);
    for (let i = 2; existsSync(path.join(dir, final)); i++) final = `${name} (${i})${ext}`;
    writeFileSync(path.join(dir, final), contenido, { mode: 0o640 });
    return { nombre: final, tamano: contenido.length };
  }

  leer(proyecto, nombre) {
    const ruta = this.#ruta(proyecto, nombre);
    if (!existsSync(ruta)) throw new Error(`No existe el archivo «${nombre}».`);
    return readFileSync(ruta);
  }

  existe(proyecto, nombre) {
    try {
      return existsSync(this.#ruta(proyecto, nombre));
    } catch {
      return false;
    }
  }

  tamano(proyecto, nombre) {
    return statSync(this.#ruta(proyecto, nombre)).size;
  }

  borrar(proyecto, nombre) {
    rmSync(this.#ruta(proyecto, nombre), { force: true });
  }

  #ruta(proyecto, nombre) {
    const dir = this.dir(proyecto);
    const ruta = path.join(dir, path.basename(String(nombre)));
    if (path.dirname(ruta) !== dir || path.basename(ruta).startsWith(".")) throw new Error("Nombre de archivo no válido.");
    return ruta;
  }
}

export function nombreSeguro(original) {
  let nombre = path
    .basename(String(original || ""))
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} ._()\-]/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (nombre.length > 120) {
    const { name, ext } = path.parse(nombre);
    nombre = name.slice(0, 120 - ext.length) + ext;
  }
  const ext = path.extname(nombre).slice(1).toLowerCase();
  if (!nombre || !EXTENSIONES.has(ext)) throw new Error(`Tipo de archivo no admitido${ext ? ` (.${ext})` : ""}. Se admiten documentos, hojas de cálculo, presentaciones, imágenes, audio, vídeo y zip.`);
  return nombre;
}
