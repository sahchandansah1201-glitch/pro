FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client

COPY backend/self-hosted ./backend/self-hosted
COPY public/clinical-body-atlas-regions ./public/clinical-body-atlas-regions

ENV BACKEND_PORT=3001
EXPOSE 3001

CMD ["node", "backend/self-hosted/server.mjs"]
