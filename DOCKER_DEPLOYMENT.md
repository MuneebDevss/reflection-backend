# Docker Deployment Guide

## 📦 What's Included

- **Dockerfile**: Multi-stage production-ready Docker image
- **.dockerignore**: Optimizes build context and image size
- **docker-compose.yml**: Optional local testing setup
- **.env.example**: Environment variables template

## 🚀 Local Testing

### 1. Build the Docker Image
```bash
docker build -t reflection-backend .
```

### 2. Run with Environment Variables
```bash
docker run -p 3001:3001 \
  -e DATABASE_URL="your_postgres_connection_string" \
  -e JWT_SECRET="your_jwt_secret" \
  -e GEMINI_API_KEY="your_api_key" \
  reflection-backend
```

### 3. Or Use Docker Compose
```bash
# Copy .env.example to .env and fill in your values
cp .env.example .env

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

## 🔧 Render Deployment

### Option 1: Deploy from Dockerfile (Recommended)

1. **Connect your GitHub repository** to Render
2. **Create a new Web Service**
3. **Configure settings**:
   - **Build Command**: Leave empty (Render auto-detects Dockerfile)
   - **Start Command**: Leave empty (uses Dockerfile CMD)
   - **Docker Command**: Leave empty
   
4. **Add Environment Variables**:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/dbname
   JWT_SECRET=your-super-secret-jwt-key
   PORT=3001
   NODE_ENV=production
   GEMINI_API_KEY=your-api-key
   ```

5. **Run Database Migrations** (IMPORTANT):
   - Go to "Shell" tab in Render dashboard
   - Run: `npx prisma migrate deploy`
   - Or add as a "Build Command": `npm ci && npm run prisma:generate && npm run build`

### Option 2: Traditional Node Deployment

If you prefer not to use Docker on Render:
- **Build Command**: `npm ci && npm run prisma:generate && npm run build`
- **Start Command**: `npm start`

## 🗄️ Database Migrations

**CRITICAL**: Migrations are NOT run automatically in the Docker container for safety reasons.

### Run migrations manually:
```bash
# Local
npm run prisma:migrate

# In Docker container
docker exec -it reflection-backend npx prisma migrate deploy

# On Render (via Shell or Build Command)
npx prisma migrate deploy
```

### Why not auto-migrate?
- Multiple containers could conflict
- Failed migrations break all instances
- Production requires controlled review
- Best practice: Run migrations as separate deployment step

## 🔍 Verify Deployment

### Check Health Endpoint
```bash
curl http://localhost:3001/health
# or on Render:
curl https://your-app.onrender.com/health
```

### Check Logs
```bash
# Docker
docker logs reflection-backend

# Docker Compose
docker-compose logs -f

# Render
View in Render dashboard "Logs" tab
```

## 📊 Image Size Optimization

The multi-stage build reduces image size by:
- Excluding devDependencies (~150-200MB saved)
- Excluding source TypeScript files
- Excluding build tools
- Using Alpine Linux base (~5MB vs ~100MB)

Expected final image size: **~300-400MB** (vs 600-800MB single-stage)

## 🔐 Security Best Practices

✅ Non-root user (nestjs:nodejs)
✅ No secrets in Dockerfile
✅ Production dependencies only
✅ Health checks enabled
✅ Graceful shutdown with dumb-init
✅ Alpine Linux (minimal attack surface)

## 🐛 Troubleshooting

### Container crashes immediately
- Check DATABASE_URL is correct
- Verify JWT_SECRET is set
- Check logs: `docker logs reflection-backend`

### Prisma errors
- Ensure `prisma generate` ran during build
- Verify DATABASE_URL format
- Check database is accessible from container

### Port conflicts
- Change host port: `docker run -p 3002:3001 ...`
- Or set PORT env var to different value

### Can't connect to database
- Use host.docker.internal instead of localhost (on Mac/Windows)
- Ensure database accepts external connections
- Check firewall rules

## 📝 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | ✅ Yes | - | PostgreSQL connection string |
| JWT_SECRET | ✅ Yes | - | Secret key for JWT tokens |
| PORT | ❌ No | 3001 | Server port |
| NODE_ENV | ❌ No | production | Node environment |
| GEMINI_API_KEY | ❌ No | - | Google Gemini API key |

## 🎯 Quick Commands

```bash
# Build
docker build -t reflection-backend .

# Run
docker run -p 3001:3001 --env-file .env reflection-backend

# Run with shell access
docker run -it -p 3001:3001 --env-file .env reflection-backend sh

# Stop all containers
docker stop $(docker ps -q)

# Remove all containers
docker rm $(docker ps -aq)

# Remove image
docker rmi reflection-backend

# View container stats
docker stats reflection-backend
```
