# Grossmart

*La mente de Grossman.* Grossmart es la empresa de Grossman: una oficina de mediados del siglo XX donde los empleados son agentes de inteligencia artificial. Grossman dice lo que necesita y Grossmart se encarga del resto: entiende el encargo, decide a qué proyecto pertenece, lo reparte, lo ejecuta, guarda lo hecho y recuerda lo pendiente.

```
IDEA → ENCARGO → PLAN → TAREAS → EJECUCIÓN → RESULTADO → SEGUIMIENTO
```

## Puesta en marcha

Requisitos: Node 20 o superior y **Claude Code con la sesión iniciada** en esta máquina (`claude`, y dentro `/login`). Grossmart trabaja con la cuenta de Claude del usuario: sin claves de API ni servicios de pago aparte.

```bash
git clone https://github.com/pichucobcn/grossmart.git
cd grossmart
npm install      # instala el puente ACP de Claude Code
npm start        # abre http://127.0.0.1:4321
```

Para ensayar la interfaz sin llamar a Claude Code: `npm run simulado`.
Pruebas: `npm test`.

## Desde el móvil

Los agentes trabajan en el ordenador, así que el móvil es un mando a distancia: **el ordenador tiene que estar encendido con Grossmart abierto**.

**Opción A · Desde cualquier sitio, con Tailscale (recomendada).** Tailscale crea una red privada entre tus aparatos. Es gratis para uso personal.
1. Instala Tailscale en el ordenador y en el móvil ([tailscale.com/download](https://tailscale.com/download)) y entra con la misma cuenta en los dos.
2. En el ordenador, con Grossmart abierto (`npm start`): `tailscale serve --bg 4321`
3. Tailscale muestra una dirección del tipo `https://tu-ordenador.tu-red.ts.net`. Ábrela en el móvil.

Solo tus aparatos ven esa dirección. No uses `tailscale funnel`, que la publicaría en internet; aun así, Grossmart pediría la clave a lo que llegue por ahí.

**Opción B · En casa, por wifi.**
```bash
OFICINA_CLAVE="una-clave-larga" npm run movil
```
La consola muestra la dirección para el móvil (por ejemplo `http://192.168.1.20:4321`). La primera vez pide la clave; después la recuerda. Sin `OFICINA_CLAVE` no arranca en este modo.

**Como app.** Con Grossmart abierto en el móvil: en iPhone, Safari → Compartir → «Añadir a pantalla de inicio»; en Android, Chrome → menú → «Añadir a pantalla de inicio». Aparece el icono del sombrero y se abre a pantalla completa.

## En la nube (sin depender de tu ordenador)

Grossmart puede vivir en un servidor que esté siempre encendido. Los agentes siguen usando **tu suscripción de Claude**: nada de API de pago. Solo se paga el servidor (unos 5 € al mes).

1. **La llave de tu suscripción.** En tu ordenador, con Claude Code instalado: `claude setup-token`. Inicia sesión en el navegador y copia el código que empieza por `sk-ant-oat…`. Es como una contraseña: no la compartas ni la subas al repositorio.
2. **El servidor.** Cualquier servicio que ejecute un `Dockerfile` y tenga disco persistente. Ejemplo con [Railway](https://railway.com):
   - *New Project → Deploy from GitHub repo* → `pichucobcn/grossmart`. Railway encuentra el `Dockerfile` solo.
   - *Variables*: `OFICINA_CLAVE` (la clave para entrar) y `CLAUDE_CODE_OAUTH_TOKEN` (la llave del paso 1).
   - *Volume*: añadir uno montado en `/datos`. Ahí se guardan encargos, tareas y memoria. Sin él, se pierden en cada actualización.
   - *Settings → Networking → Generate Domain*. Esa dirección (https) es tu oficina.
3. Abre la dirección en el móvil, escribe la clave y añádela a la pantalla de inicio.

Grossmart se niega a arrancar en la nube sin una `OFICINA_CLAVE` de 12 caracteres o más. La comprobación de salud está en `/salud`.

## Cómo funciona

```
Navegador (planta) ──► Coordinación ──► Agente ──► ACP ──► Claude Code ──► resultado ──► Oficina
```

1. **Encargo general.** La barra de arriba siempre está a mano. El encargo va a Coordinación (Ernesto), que le pide a Claude Code un plan en JSON: proyecto, objetivo y tareas, cada una con su agente, prioridad y dependencias. Si el plan no llega o no se entiende, Coordinación reparte por palabras clave.
2. **Cola.** Cada agente atiende una tarea a la vez. Como mucho `EJECUTOR.concurrencia` agentes escriben a la vez. Una tarea que depende de otra espera a que esa termine y recibe su resultado completo.
3. **Ejecución real.** Cada tarea abre una sesión ACP con el puente de Claude Code (`@agentclientprotocol/claude-agent-acp`), con la carpeta del proyecto como directorio de trabajo. El texto llega en vivo a la planta: lámpara encendida, máquina de escribir en marcha, el documento se escribe en pantalla.
4. **Informe.** Cuando el equipo termina, Coordinación redacta un informe consolidado para Grossman.
5. **Seguimiento.** Si un agente no puede seguir sin una decisión, termina con `PREGUNTA PARA GROSSMAN: …`. La tarea queda *Esperando* y aparece en «Para Grossman». Al responder, el agente continúa. Lo que pongan bajo `## Para la memoria del proyecto` se guarda en la memoria de ese proyecto.

También se puede encargar algo directamente a un agente desde su expediente (al pulsar su escritorio), elegir el proyecto o dejar que Grossmart lo detecte, y dejarlo *pendiente* para más adelante.

### AionUi

AionUi lanza Claude Code mediante el **Agent Client Protocol (ACP)**. Grossmart usa exactamente ese protocolo y ese puente, así que comparte con AionUi la misma infraestructura: Claude Code, la cuenta del usuario y la configuración de `~/.claude`. AionUi no documenta una API externa para enviarle encargos desde otra aplicación. Por eso GROSSMART hace de cliente ACP por sí misma (`server/acp.mjs`) en lugar de pasar por la ventana de AionUi. Si AionUi usa otro puente ACP, basta con indicarlo en `EJECUTOR.comando` / `argumentos`, o con la variable `OFICINA_ACP_COMANDO`.

### Estados de una tarea

Pendiente · Asignada · Trabajando · Esperando · Terminada · Error. Una tarea con error se puede volver a intentar; cualquiera se puede dar por terminada o descartar.

## Configuración

Todo está en **`config/oficina.config.mjs`**: proyectos, departamentos, agentes (nombre, función, capacidades, sombrero y traje), estados, prioridades, ejecutor y servidor. La planta se dibuja a partir de ahí.

- **Nuevo proyecto:** añadir una entrada a `PROYECTOS`, o pulsar «Abrir expediente nuevo» en la pestaña *Proyectos* (se guarda en `datos/proyectos.json`). Aparece su archivador en la planta.
- **Fichas de los empleados desde Grossmart:** en el expediente de cada uno, «Editar ficha» cambia el nombre, el departamento, la función, lo que sabe hacer (habilidades que se añaden y se quitan) y cómo trabaja. Se guarda en `datos/agentes.json`, por encima de la configuración, y «Volver a la ficha original» lo deshace.
- **Sobre Grossman:** pestaña *Proyectos* → «Sobre Grossman». Es una ficha que todos los agentes leen antes de cada trabajo. Desde ahí se puede **traer lo que Claude ya sabe de ti**: Grossmart da una pregunta para hacerle a Claude en claude.ai, se pega la respuesta y Coordinación la reparte entre esa ficha y el contexto de cada proyecto (sin mezclar proyectos).
- **Nuevo empleado:** añadir una entrada a `AGENTES` (y su departamento, si es nuevo). Aparece su escritorio y Coordinación ya puede asignarle trabajo.
- **Herramientas de los agentes:** `EJECUTOR.herramientas`. Por defecto solo `WebSearch` y `WebFetch`. Lo que no está en la lista no existe para ellos. Ver «Seguridad».

## Correo (Secretaría)

Amelia, de Secretaría, lleva el correo: lo lee **a las 9:00 y a las 15:00 (hora de Barcelona)** y cuando se le pide, lo ordena por proyecto, avisa de lo importante y de lo sospechoso, y propone acciones y borradores. **Nada se toca hasta que Grossman lo aprueba** en la pestaña *Correo*. Grossmart **no puede enviar ni borrar** correos: no tiene código para ello. Los borradores quedan en la carpeta de Borradores para revisarlos y enviarlos uno mismo.

- Acciones posibles, siempre con visto bueno: etiquetar (Gmail: etiqueta «Grossmart/…»; Hotmail: carpeta), marcar como leído, archivar (sale de la bandeja, no se borra) y guardar borrador.
- Adjuntos: archivos subidos a un proyecto (en su archivo, «Archivos del proyecto») o adjuntos de correos recibidos. Como mucho 20 MB por borrador.
- Encargos concretos: en el expediente de Amelia («prepara un borrador para gestor@… con la factura de la luz»). Puede escribir solo a las personas del hilo o a las direcciones que Grossman escribe en su encargo.

### Conectar Gmail
1. En tu cuenta de Google, activa la **verificación en dos pasos** (myaccount.google.com → Seguridad).
2. Crea una **contraseña de aplicación**: myaccount.google.com/apppasswords → nombre «Grossmart» → copia las 16 letras.
3. En Railway → *Variables*: `GMAIL_USUARIO` = tu dirección de Gmail y `GMAIL_CLAVE_APP` = esas 16 letras.

La contraseña de aplicación solo sirve para el correo y se revoca en esa misma página sin tocar tu contraseña de Google.

### Conectar Hotmail / Outlook.com
Microsoft ya no admite contraseñas de aplicación: se entra con su inicio de sesión oficial. Se hace una vez:
1. Entra en **entra.microsoft.com** (o portal.azure.com) con tu cuenta de Microsoft → *Registros de aplicaciones* → *Nuevo registro*. Nombre: «Grossmart». Tipo de cuenta: *solo cuentas personales de Microsoft*. Sin URI de redirección.
2. En la aplicación creada: *Autenticación* → **Permitir flujos de clientes públicos: Sí** → Guardar.
3. *Permisos de API* → *Agregar un permiso* → *Microsoft Graph* → *Permisos delegados* → marca **IMAP.AccessAsUser.All** y **offline_access**.
4. Copia el **Id. de aplicación (cliente)** de la página *Información general*.
5. En Railway → *Variables*: `HOTMAIL_USUARIO` = tu dirección de Hotmail y `MICROSOFT_CLIENT_ID` = ese id.
6. En Grossmart → pestaña *Correo* → **Conectar Hotmail**: te da un código para escribir en la web de Microsoft. Aceptas y queda conectada. El permiso se renueva solo y se guarda cifrado con `OFICINA_CLAVE` (si cambias esa clave, hay que volver a conectar).

## Seguridad

Grossmart recibe órdenes y las convierte en trabajo de agentes, así que está pensado para que nadie más pueda usarlo y para que un agente no pueda ser engañado.

**Quién entra**
- Desde tu ordenador (`localhost`) se entra sin clave. Desde cualquier otro sitio hace falta `OFICINA_CLAVE`. En la nube siempre, sin excepciones.
- Abierto a la red, Grossmart **se niega a arrancar** sin clave o con una de menos de 12 caracteres.
- Sesión: cookie firmada (HMAC) con un secreto aleatorio del servidor (`datos/secreto-sesiones`). Es `HttpOnly`, `SameSite=Strict`, `Secure` con https, y caduca en 30 días. Cambiar la clave o borrar ese archivo cierra todas las sesiones. Botón «Salir» en el móvil.
- Contra quien prueba claves: 5 fallos desde una dirección la bloquean 15 minutos; 30 fallos en total bloquean la puerta para todos durante 15 minutos. Cada intento queda en el registro.
- Contra webs maliciosas abiertas en tu navegador: las escrituras solo se aceptan en JSON y desde el mismo origen (CSRF). En modo local se exige que la petición vaya dirigida a `localhost` (DNS rebinding). Un reenvío público sin firma de Tailscale pide clave.

**Qué ve el navegador**
- Política de contenido (CSP) estricta: solo se ejecutan los scripts de la propia oficina. Los documentos de los agentes se escapan antes de mostrarse.
- Además: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS en la nube y `noindex` para buscadores.

**Qué pueden hacer los agentes**
- Solo tienen las herramientas de `EJECUTOR.herramientas`, por defecto **buscar y leer en la web**. No pueden ejecutar comandos ni leer archivos del servidor: no es que se les pida que no lo hagan, es que no tienen con qué. Por eso una web maliciosa no puede conseguir que un agente robe la llave de Claude o instale nada.
- No cargan ajustes personales ni conectores (`settingSources: []`). Un agente no puede escribirse permisos a sí mismo.
- Si se amplían sus herramientas en un ordenador propio, Grossmart solo concede lectura, búsqueda o edición dentro de la carpeta de su proyecto. `Bash` está siempre prohibido.
- Los agentes no reciben los secretos de Grossmart (`OFICINA_*`). Además, sus instrucciones les dicen que lo leído en webs o documentos es información, nunca órdenes.

**El servidor**
- El contenedor no trabaja como administrador: arranca, se adueña de `/datos` y pasa al usuario `node`. Si no puede, no arranca.
- Entradas comprobadas: tamaños máximos, tipos, colores y fechas validados, rutas de archivos encerradas en `public/`, peticiones raras que no tumban el servidor.
- Dependencias: el puente ACP de Claude Code y las tres del correo, con versiones fijadas (publicadas hace más de diez días) y el `package-lock`. Se instalan sin scripts (`--ignore-scripts`). `npm audit`: 0 vulnerabilidades.
- Pruebas de ataque automáticas en `test/seguridad.test.mjs` (`npm test`).

**El correo**
- Amelia **no tiene ninguna herramienta**: no navega, no lee archivos y no puede enviar nada. Los correos le llegan como datos entre marcas aleatorias que un correo no puede imitar, con la instrucción de no obedecer nunca lo que digan.
- Sus propuestas pasan por reglas fijas antes de guardarse: solo acciones permitidas, etiquetas saneadas, borradores solo a personas del hilo o a direcciones escritas por Grossman, adjuntos solo existentes y hasta 20 MB. Lo que no cumple se descarta y se explica.
- Nada se ejecuta sin la aprobación de Grossman. No existe código para enviar ni para borrar.
- Contraseñas y tokens del correo, solo en las variables de Railway. El token de Hotmail se guarda cifrado.
- El texto de los correos se muestra siempre como texto, nunca como página (el HTML de un correo no se ejecuta).

**Lo que te toca a ti**
1. Una clave larga e inventada (por ejemplo, cuatro palabras al azar), que no uses en otro sitio.
2. La llave `CLAUDE_CODE_OAUTH_TOKEN` y la clave, solo en las variables de la plataforma. Nunca en el código, ni en un correo, ni en un chat.
3. Verificación en dos pasos (2FA) en GitHub, en la plataforma del servidor y en tu cuenta de Claude.
4. El repositorio, privado.
5. Si sospechas que la llave se ha filtrado: genera otra con `claude setup-token`, cámbiala en la plataforma y cambia también `OFICINA_CLAVE`.

**Lo que ninguna medida evita del todo:** un agente que lee la web puede encontrar textos escritos para engañarlo. Por eso no tiene herramientas peligrosas, no recibe secretos y sus resultados son siempre documentos que revisas tú. No los conectes a correo, pagos ni cuentas sin pensarlo antes.

## Memoria y archivo

Todo vive en `datos/` (no se sube al repositorio):

```
datos/oficina.json                  encargos y contadores
datos/proyectos/<id>/tareas.json    tareas del proyecto
datos/proyectos/<id>/memoria.json   contexto, decisiones, instrucciones y notas
datos/proyectos/<id>/documentos/    cada resultado entregado, en Markdown
datos/proyectos/<id>/archivo/       carpeta de trabajo de los agentes
```

Cada tarea recibe solo la memoria de **su** proyecto: contexto, decisiones, instrucciones permanentes, notas y los últimos trabajos. Así Pichuco no se mezcla con Barnabeat y un agente puede continuar un trabajo sin que Grossman lo explique de nuevo. Las tareas pendientes sobreviven a un reinicio. Lo que se estaba escribiendo al cerrar vuelve a la bandeja.

## Estructura

```
config/oficina.config.mjs   la configuración central
server/index.mjs            servidor HTTP + avisos en vivo (SSE)
server/oficina.mjs          Coordinación: plan, reparto, cola, prompts, memoria
server/ejecutor.mjs         ejecutores: ACP (Claude Code) y ensayo
server/acp.mjs              cliente del Agent Client Protocol
server/acceso.mjs           la puerta: clave, sesiones firmadas y freno a intentos
server/privilegios.mjs      deja de ser root antes de trabajar (contenedores)
server/archivos.mjs         archivos subidos a cada proyecto
server/correo/              Secretaría: buzones IMAP, inicio de sesión de Microsoft y propuestas
Dockerfile                  para instalarla en un servidor
server/almacen.mjs          archivo en disco
public/                     la planta (SVG) y los expedientes
test/                       pruebas (node --test)
```

Sin frameworks: Node y el navegador. Dependencias, con versión fijada: el puente ACP de Claude Code y, para el correo, `imapflow`, `mailparser` y `nodemailer` (solo para componer borradores; nunca envía).
