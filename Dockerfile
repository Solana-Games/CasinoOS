# ============================================================
# CasinoOS Elite - Production Dockerfile
# Version: 1.0.0-elite
# Audit ID: DOCK-CASINOOS-20260531-010
# GLI Certification: GLI-2026-1668
#
# Multi-stage build with:
# - Security hardening (non-root user, distroless runtime)
# - Layer caching optimization
# - Vulnerability scanning
# - Minimal production image (<200MB)
# ============================================================

# ============================================================
# STAGE 1: Dependencies (cached layer)
# ============================================================
FROM node:20.18-alpine AS deps
WORKDIR /app

# Install system dependencies for native modules (if any)
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Clean install with exact versions
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# ============================================================
# STAGE 2: Builder (compiles Next.js app)
# ============================================================
FROM node:20.18-alpine AS builder
WORKDIR /app

# Copy dependencies from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js application with production optimizations
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ============================================================
# STAGE 3: Security Scanner (vulnerability check)
# ============================================================
FROM alpine:3.19 AS scanner
RUN apk add --no-cache curl
# Install Trivy (vulnerability scanner)
ADD https://github.com/aquasecurity/trivy/releases/download/v0.49.0/trivy_0.49.0_Linux-64bit.tar.gz /tmp/
RUN tar zxvf /tmp/trivy_0.49.0_Linux-64bit.tar.gz -C /usr/local/bin && \
    chmod +x /usr/local/bin/trivy

COPY --from=builder /app /app
RUN trivy filesystem --severity CRITICAL,HIGH --exit-code 1 --no-progress /app || \
    (echo "❌ Security vulnerabilities found" && exit 1)

# ============================================================
# STAGE 4: Production Runtime (Distroless for minimal attack surface)
# ============================================================
FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app

# Create non-root user (though distroless already uses non-root)
# No shell access, no package manager - reduces attack surface

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy package.json for metadata (optional)
COPY --from=builder /app/package.json ./package.json

# Expose port
EXPOSE 3000

# Health check (distroless compatible)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD ["node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]

# Start the Next.js standalone server
CMD ["server.js"]