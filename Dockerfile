# =============================================================================
# STAGE 1: Builder
# Purpose: Install all dependencies, generate Prisma Client, and build the app
# =============================================================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
# We copy these first to leverage Docker layer caching
# If dependencies haven't changed, Docker will use cached layers
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy Prisma schema
# Prisma generate must run BEFORE the TypeScript build because:
# - NestJS code imports @prisma/client
# - The Prisma Client is generated based on schema.prisma
# - Without it, the TypeScript compilation will fail
COPY prisma ./prisma

# Generate Prisma Client
# This creates the type-safe database client in node_modules/@prisma/client
RUN npm run prisma:generate

# Copy source code and TypeScript config
COPY src ./src
COPY tsconfig.json ./

# Build the NestJS application
# This compiles TypeScript to JavaScript in the dist/ folder
RUN npm run build

# Install production dependencies only
# This creates a clean node_modules with only runtime dependencies
RUN npm ci --omit=dev

# =============================================================================
# STAGE 2: Production
# Purpose: Create a lightweight image with only runtime necessities
# Why multi-stage? 
# - Reduces final image size by 60-70%
# - Removes build tools, dev dependencies, and source code
# - Improves security by minimizing attack surface
# =============================================================================
FROM node:20-alpine AS production

# Install dumb-init to handle signals properly
# This ensures graceful shutdown when container stops
RUN apk add --no-cache dumb-init

# Create a non-root user for security
# Running as root is a security risk in production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy compiled application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy Prisma files
# Why copy Prisma folder?
# - Required for Prisma Client to function at runtime
# - Contains schema.prisma which some Prisma features reference
# - Needed if you ever want to run introspection or similar commands
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Copy package.json for npm scripts and metadata
COPY --chown=nestjs:nodejs package.json ./

# Switch to non-root user
USER nestjs

# Expose the port the app runs on
# Default is 3001 but can be overridden via PORT env var
EXPOSE 3001

# Environment variables (defaults - override these in production)
ENV NODE_ENV=production
ENV PORT=3001

# Health check (optional but recommended for container orchestration)
# Checks if the app is responding on the health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Why NOT run migrations automatically?
# 1. Migrations should be a controlled, separate deployment step
# 2. Multiple container instances might try to run migrations simultaneously
# 3. Failed migrations could break all containers
# 4. In production, you want to review and test migrations before applying
# 5. Render and most platforms provide better ways to run migrations as a separate job
#
# Instead, run migrations manually or as a pre-deploy hook:
# - Locally: npm run prisma:migrate
# - On Render: Use a "Build Command" or separate migration job
# - Via CI/CD: Run migrations in deployment pipeline before deploying containers

# Use dumb-init to properly handle signals (SIGTERM, SIGINT)
# Run the application using the compiled JavaScript
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
