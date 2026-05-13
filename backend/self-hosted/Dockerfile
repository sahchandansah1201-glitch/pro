FROM node:20-alpine

WORKDIR /app

COPY backend/self-hosted ./backend/self-hosted

ENV BACKEND_PORT=3001
EXPOSE 3001

CMD ["node", "backend/self-hosted/server.mjs"]
