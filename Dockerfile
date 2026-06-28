# ---------------------------------------------------------------------------
# Container image for the Model Inventory & Risk Tracker.
#
# Build once, push to your internal container registry, deploy to Azure
# Container Apps / App Service / AKS / internal Kubernetes. No per-machine
# internet downloads at runtime.
#
# Banks: swap the base image below for your approved/golden Node LTS base
# image, and run `npm ci` against your internal npm mirror if the public
# registry is blocked (see DEPLOYMENT.md "Air-gapped / internal mirrors").
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Install dependencies first for better layer caching (only Express is needed).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy the application source.
COPY . .

# data/ holds data.json; make the app dir writable by the built-in non-root user.
RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 3000

# Health check (the slim image has no curl, so use Node's built-in fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
