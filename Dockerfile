# Backend image — runs the example Express server that exposes
# Mendel Framework's client + admin routes.
FROM node:22-alpine

WORKDIR /app

# Install deps first (better layer caching).
# We need devDependencies because mongoose + celebrate live there.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund && npm cache clean --force

# Copy application source
COPY index.js ./index.js
COPY lib ./lib
COPY express ./express
COPY examples ./examples

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "examples/server.js"]
