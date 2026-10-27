# The production image (deployed on Render): builds the dashboard and serves it
# from the API, so a single URL carries the dashboard, the REST API and the
# realtime WebSockets. The same process runs the scheduled jobs.
FROM node:20-alpine AS client
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
# No VITE_API_URL: the built dashboard talks to the origin that serves it.
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client /client/dist ./public
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server.js"]
