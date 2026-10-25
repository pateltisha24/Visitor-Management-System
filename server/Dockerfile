# Always-on API image (Railway, Render, Fly.io, any VM). Unlike the Vercel
# deployment, a long-running process also serves the realtime WebSocket gateway
# (/ws/agent, /ws/dashboard) and runs the scheduled jobs in-process.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server.js"]
