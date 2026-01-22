
# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/web

# Copy frontend config
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

# Copy source and build
COPY apps/web .
# Vite builds to 'dist' by default. We need to ensure we copy 'docs' assets if needed?
# Vite config publicDir is set to ../../docs. So we need docs available.
COPY docs /app/docs
RUN npm run build

# Stage 2: Production Backend
FROM python:3.10-slim

WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY apps/server /app/server
# Copy Built Frontend to 'static' logic in main.py
COPY --from=frontend-builder /app/web/dist /app/static

# Expose port
EXPOSE 3001

# Run Server
# Note: We run from /app, so module path is server.main
CMD ["python", "server/main.py"]
