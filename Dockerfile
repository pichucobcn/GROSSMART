# Grossmart en un servidor.
#
# Variables obligatorias (en el panel de la plataforma, nunca en el código):
#   OFICINA_CLAVE            clave para entrar (12 caracteres o más)
#   CLAUDE_CODE_OAUTH_TOKEN  la llave de tu suscripción (`claude setup-token`)
# Disco persistente montado en /datos (encargos, tareas, memoria).
FROM node:22-slim

WORKDIR /app
COPY package.json package-lock.json ./
# Versiones exactas del package-lock y sin scripts de instalación.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY config ./config
COPY server ./server
COPY public ./public

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    OFICINA_DATOS=/datos \
    OFICINA_EN_LA_NUBE=1 \
    OFICINA_USUARIO=node
# El servidor arranca como root solo para adueñarse de /datos (las plataformas
# montan los discos como root) y enseguida pasa al usuario «node».
# Sin VOLUME ni HEALTHCHECK: Railway no los admite. El disco se monta en /datos
# desde el panel de la plataforma y la comprobación de salud está en /salud.
RUN mkdir -p /datos
EXPOSE 4321
CMD ["node", "server/index.mjs"]
