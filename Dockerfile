# LA OFICINA en un servidor.
# Variables necesarias:
#   OFICINA_CLAVE            clave para entrar
#   CLAUDE_CODE_OAUTH_TOKEN  la llave de tu suscripción (`claude setup-token`)
# Volumen: /datos (encargos, tareas y memoria de los proyectos)
FROM node:22-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY config ./config
COPY server ./server
COPY public ./public

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    OFICINA_DATOS=/datos \
    OFICINA_EN_LA_NUBE=1
# Sin USER: los discos de Railway, Render o Fly se montan como root y la
# oficina tiene que poder escribir su archivo en ellos.
RUN mkdir -p /datos
VOLUME ["/datos"]
EXPOSE 4321
HEALTHCHECK --interval=60s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/salud').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
