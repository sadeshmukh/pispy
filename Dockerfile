# Stage 1: Install all dependencies
FROM oven/bun:1 AS deps
WORKDIR /app

# Copy configuration files
COPY package.json bun.lockb ./

# Install dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# Stage 2: Build the application
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy node_modules from deps stage and all other source files
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Astro application (standalone Node.js server output)
RUN bun run build

# Stage 3: Install production-only dependencies
FROM oven/bun:1 AS production-deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Stage 4: Runtime environment (Node.js)
FROM node:22-slim AS runner
WORKDIR /app

# Set default production environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Copy build output, production dependencies, and package config
COPY --from=builder /app/dist ./dist
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose the application port
EXPOSE 4321

# Start the Astro SSR server
CMD ["node", "dist/server/entry.mjs"]
