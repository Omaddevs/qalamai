# QalamAI API (Fastify). Built from the repository root: the server reads ../shared.
FROM node:22-bookworm-slim
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev && npm cache clean --force
COPY shared ./shared
COPY server ./server
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "src/index.js"]
