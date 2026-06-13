# =============================================================================
# STAGE 1: Builder
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy database rules
COPY prisma ./prisma

# Copy application files and compile TypeScript to JavaScript
COPY src ./src
COPY tsconfig.json ./
RUN npm run build

# Prune development tools (Removes dev version of Prisma CLI)
RUN npm ci --omit=dev

# CRITICAL FIX: Re-generate a fresh production client inside node_modules
# This prevents npm prune from stripping the query engine binaries
RUN npx prisma generate

# =============================================================================
# STAGE 2: Production
# =============================================================================
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
WORKDIR /app

# Copy the completely hydrated node_modules folder containing your final query engines
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --chown=nestjs:nodejs package.json ./

USER nestjs
EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]