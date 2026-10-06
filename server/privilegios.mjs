// Si Grossmart arranca como root (pasa en contenedores: los discos de las
// plataformas se montan como root), prepara su carpeta de datos y se convierte
// en un usuario normal antes de hacer nada más. Así, ni Grossmart ni los
// agentes que lanza tienen permisos de administrador.

import { chownSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export function soltarPrivilegios(usuario, dirDatos) {
  if (!usuario || typeof process.getuid !== "function" || process.getuid() !== 0) return null;
  const linea = readFileSync("/etc/passwd", "utf8")
    .split("\n")
    .find((l) => l.split(":")[0] === usuario);
  if (!linea) throw new Error(`No existe el usuario ${usuario}.`);
  const [, , uid, gid, , home] = linea.split(":");
  mkdirSync(dirDatos, { recursive: true });
  cambiarDueno(dirDatos, Number(uid), Number(gid));
  process.setgroups([]);
  process.setgid(Number(gid));
  process.setuid(Number(uid));
  process.env.HOME = home;
  process.env.USER = usuario;
  return { uid: Number(uid), gid: Number(gid) };
}

function cambiarDueno(ruta, uid, gid) {
  chownSync(ruta, uid, gid);
  for (const entrada of readdirSync(ruta, { withFileTypes: true })) {
    const hija = path.join(ruta, entrada.name);
    if (entrada.isDirectory()) cambiarDueno(hija, uid, gid);
    else if (!entrada.isSymbolicLink()) chownSync(hija, uid, gid);
  }
}
