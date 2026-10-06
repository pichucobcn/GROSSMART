# LA OFICINA

*La mente de Grossman.* Una oficina de mediados del siglo XX donde los empleados son agentes de inteligencia artificial. Grossman dice lo que necesita y la oficina se encarga del resto: entiende el encargo, decide a qué proyecto pertenece, lo reparte, lo ejecuta, guarda lo hecho y recuerda lo pendiente.

```
IDEA → ENCARGO → PLAN → TAREAS → EJECUCIÓN → RESULTADO → SEGUIMIENTO
```

## Puesta en marcha

Requisitos: Node 20 o superior y **Claude Code con la sesión iniciada** en esta máquina (`claude`, y dentro `/login`). La oficina trabaja con la cuenta de Claude del usuario: sin claves de API ni servicios de pago aparte.

```bash
cd oficina
npm install      # instala el puente ACP de Claude Code
npm start        # abre http://127.0.0.1:4321
```

Para ensayar la interfaz sin llamar a Claude Code: `npm run simulado`.
Pruebas: `npm test`.

## Desde el móvil

Los agentes trabajan en el ordenador, así que el móvil es un mando a distancia: **el ordenador tiene que estar encendido con la oficina abierta**.

**Opción A · Desde cualquier sitio, con Tailscale (recomendada).** Tailscale crea una red privada entre tus aparatos. Es gratis para uso personal.
1. Instala Tailscale en el ordenador y en el móvil ([tailscale.com/download](https://tailscale.com/download)) y entra con la misma cuenta en los dos.
2. En el ordenador, con la oficina abierta (`npm start`): `tailscale serve --bg 4321`
3. Tailscale muestra una dirección del tipo `https://tu-ordenador.tu-red.ts.net`. Ábrela en el móvil.

Solo tus aparatos ven esa dirección. No uses `tailscale funnel`, que la publicaría en internet; aun así, la oficina pediría la clave a lo que llegue por ahí.

**Opción B · En casa, por wifi.**
```bash
OFICINA_CLAVE="una-clave-larga" npm run movil
```
La consola muestra la dirección para el móvil (por ejemplo `http://192.168.1.20:4321`). La primera vez pide la clave; después la recuerda. Sin `OFICINA_CLAVE` no arranca en este modo.

**Como app.** Con la oficina abierta en el móvil: en iPhone, Safari → Compartir → «Añadir a pantalla de inicio»; en Android, Chrome → menú → «Añadir a pantalla de inicio». Aparece el icono del sombrero y se abre a pantalla completa.

## En la nube (sin depender de tu ordenador)

La Oficina puede vivir en un servidor que esté siempre encendido. Los agentes siguen usando **tu suscripción de Claude**: nada de API de pago. Solo se paga el servidor (unos 5 € al mes).

1. **La llave de tu suscripción.** En tu ordenador, con Claude Code instalado: `claude setup-token`. Inicia sesión en el navegador y copia el código que empieza por `sk-ant-oat…`. Es como una contraseña: no la compartas ni la subas al repositorio.
2. **El servidor.** Cualquier servicio que ejecute un `Dockerfile` y tenga disco persistente. Ejemplo con [Railway](https://railway.com):
   - *New Project → Deploy from GitHub repo* → este repositorio. En *Settings → Source*, carpeta raíz: `oficina`.
   - *Variables*: `OFICINA_CLAVE` (la clave para entrar) y `CLAUDE_CODE_OAUTH_TOKEN` (la llave del paso 1).
   - *Volume*: añadir uno montado en `/datos`. Ahí se guardan encargos, tareas y memoria. Sin él, se pierden en cada actualización.
   - *Settings → Networking → Generate Domain*. Esa dirección (https) es tu oficina.
3. Abre la dirección en el móvil, escribe la clave y añádela a la pantalla de inicio.

Sin `OFICINA_CLAVE`, la oficina se niega a arrancar abierta a la red. La comprobación de salud está en `/salud`.

## Cómo funciona

```
Navegador (planta) ──► Coordinación ──► Agente ──► ACP ──► Claude Code ──► resultado ──► Oficina
```

1. **Encargo general.** La barra de arriba siempre está a mano. El encargo va a Coordinación (Ernesto), que le pide a Claude Code un plan en JSON: proyecto, objetivo y tareas, cada una con su agente, prioridad y dependencias. Si el plan no llega o no se entiende, Coordinación reparte por palabras clave.
2. **Cola.** Cada agente atiende una tarea a la vez. Como mucho `EJECUTOR.concurrencia` agentes escriben a la vez. Una tarea que depende de otra espera a que esa termine y recibe su resultado completo.
3. **Ejecución real.** Cada tarea abre una sesión ACP con el puente de Claude Code (`@agentclientprotocol/claude-agent-acp`), con la carpeta del proyecto como directorio de trabajo. El texto llega en vivo a la planta: lámpara encendida, máquina de escribir en marcha, el documento se escribe en pantalla.
4. **Informe.** Cuando el equipo termina, Coordinación redacta un informe consolidado para Grossman.
5. **Seguimiento.** Si un agente no puede seguir sin una decisión, termina con `PREGUNTA PARA GROSSMAN: …`. La tarea queda *Esperando* y aparece en «Para Grossman». Al responder, el agente continúa. Lo que pongan bajo `## Para la memoria del proyecto` se guarda en la memoria de ese proyecto.

También se puede encargar algo directamente a un agente desde su expediente (al pulsar su escritorio), elegir el proyecto o dejar que la oficina lo detecte, y dejarlo *pendiente* para más adelante.

### AionUi

AionUi lanza Claude Code mediante el **Agent Client Protocol (ACP)**. La Oficina usa exactamente ese protocolo y ese puente, así que comparte con AionUi la misma infraestructura: Claude Code, la cuenta del usuario y la configuración de `~/.claude`. AionUi no documenta una API externa para enviarle encargos desde otra aplicación. Por eso La Oficina hace de cliente ACP por sí misma (`server/acp.mjs`) en lugar de pasar por la ventana de AionUi. Si AionUi usa otro puente ACP, basta con indicarlo en `EJECUTOR.comando` / `argumentos`, o con la variable `OFICINA_ACP_COMANDO`.

### Estados de una tarea

Pendiente · Asignada · Trabajando · Esperando · Terminada · Error. Una tarea con error se puede volver a intentar; cualquiera se puede dar por terminada o descartar.

## Configuración

Todo está en **`config/oficina.config.mjs`**: proyectos, departamentos, agentes (nombre, función, capacidades, sombrero y traje), estados, prioridades, ejecutor y servidor. La planta se dibuja a partir de ahí.

- **Nuevo proyecto:** añadir una entrada a `PROYECTOS`, o pulsar «Abrir expediente nuevo» en la pestaña *Proyectos* (se guarda en `datos/proyectos.json`). Aparece su archivador en la planta.
- **Nuevo empleado:** añadir una entrada a `AGENTES` (y su departamento, si es nuevo). Aparece su escritorio y Coordinación ya puede asignarle trabajo.
- **Permisos:** `EJECUTOR.autoAprobarPermisos: true` deja que los agentes usen sus herramientas (buscar en la web, escribir archivos en la carpeta del proyecto). Con `false` las peticiones se rechazan y trabajan solo con texto.

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
server/acceso.mjs           la puerta: clave para entrar desde otro aparato
Dockerfile                  para instalarla en un servidor
server/almacen.mjs          archivo en disco
public/                     la planta (SVG) y los expedientes
test/                       pruebas (node --test)
```

Sin frameworks: Node y el navegador. La única dependencia es el puente ACP de Claude Code.
