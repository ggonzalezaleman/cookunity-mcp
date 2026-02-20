# syntax=docker/dockerfile:1

# Use Node.js LTS as the base image
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

# Copy source code
COPY . .

# Build the package
RUN --mount=type=cache,target=/root/.npm npm run build

# Minimal image for runtime
FROM node:20-slim

WORKDIR /app

# Copy built package from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Set entrypoint to run the server
ENTRYPOINT ["node", "dist/index.js"]
