# Using node:20-slim (Debian/glibc) rather than alpine — @libsql/client
# ships native bindings that are more reliable on glibc than musl.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd -r nodejs && useradd -r -g nodejs nextjs
COPY --from=builder /app ./
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
VOLUME ["/app/data"]

# Applies any pending Prisma migrations, then starts the server.
CMD ["npm", "run", "docker:start"]
