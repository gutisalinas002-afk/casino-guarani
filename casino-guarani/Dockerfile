FROM node:22-alpine AS build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package*.json server/
RUN cd server && npm install --omit=dev
COPY server server
COPY --from=build /app/client/dist client/dist
RUN mkdir -p /app/data && chown -R node:node /app/data
WORKDIR /app/server
USER node
VOLUME /app/data
EXPOSE 4000
CMD ["node", "--disable-warning=ExperimentalWarning", "index.js"]
