# Minimal production image for the Velox API.
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching — only re-runs on
# package.json changes, not on every source file edit).
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Then copy the rest of the source.
COPY . .

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "server.js"]
