# Dockerfile
FROM node:22-slim

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files first for caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY dashboard/package.json ./dashboard/

# Install ALL dependencies (including devDeps for TypeScript)
RUN pnpm install --frozen-lockfile

# Copy all source code
COPY . .

# Compile TypeScript inside container
RUN pnpm run build

ENV PORT=8080
EXPOSE 8080

# Run the compiled JS file
CMD ["node", "dist/proxy.js"]
