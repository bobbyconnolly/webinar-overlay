# Built with the REPO ROOT as context (see scripts/deploy.sh) so the image can
# include art shared with the overlay. The root .dockerignore keeps the upload small.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY relay/package.json relay/package-lock.json ./
RUN npm ci --omit=dev
COPY relay/server.js ./
COPY relay/public ./public
# Shared art served at /assets/<file>: reagents, trinkets and Ginger the cat.
COPY public/reagents/ ./public/assets/
COPY public/trinkets/ ./public/assets/
COPY public/cat-ginger.svg ./public/assets/
EXPOSE 8080
USER node
CMD ["node", "server.js"]
