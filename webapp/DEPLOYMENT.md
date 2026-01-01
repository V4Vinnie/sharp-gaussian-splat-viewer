# Deployment Guide for Sharp Gaussian Splat Web App

## Quick Deploy Options

### 1. Render (Recommended - Easiest)

1. Push your code to GitHub
2. Go to https://render.com and sign up
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Settings:
   - **Build Command**: `cd webapp && pip install -r requirements.txt`
   - **Start Command**: `cd webapp && uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Environment**: Python 3
6. Deploy!

**Note**: Free tier has limitations. For production with CUDA rendering, use paid tiers.

### 2. Railway

1. Install Railway CLI: `npm i -g @railway/cli`
2. Run `railway login` then `railway init`
3. Set start command: `cd webapp && uvicorn app:app --host 0.0.0.0 --port $PORT`
4. Deploy with `railway up`

### 3. Fly.io

1. Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
2. Run `fly launch` in project root
3. Follow prompts
4. Create `fly.toml`:

```toml
app = "sharp-gaussian-splat"
primary_region = "sjc"

[build]

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[services]]
  processes = ["app"]
  http_checks = []
  internal_port = 8000
  protocol = "tcp"
  script_checks = []
```

### 4. AWS/GCP/Azure (For CUDA Support)

For production with CUDA GPU support:

**AWS EC2:**
- Launch GPU instance (g4dn.xlarge or similar)
- Install dependencies
- Use systemd or supervisor to run the app
- Use nginx as reverse proxy

**Google Cloud Run with GPU:**
- Requires custom Dockerfile
- More complex setup but scalable

### 5. Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt webapp/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -r webapp/requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run application
WORKDIR /app
CMD ["uvicorn", "webapp.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

Then deploy to:
- Docker Hub + any container hosting
- Google Cloud Run
- AWS ECS/Fargate
- Azure Container Instances

## Environment Variables

Set these if needed:
- `PORT`: Server port (usually set by platform)
- `PYTHONUNBUFFERED=1`: For better logging

## Important Notes

1. **CUDA Support**: Server-side rendering requires CUDA. For CPU-only deployment:
   - The prediction (Gaussian generation) works on CPU/MPS
   - Browser rendering works on all devices (recommended for Mac users)
   - Server-side rendering endpoint will return 503 on non-CUDA systems

2. **Model Download**: The model (~500MB) downloads on first run and caches. Ensure enough disk space.

3. **Memory**: The app needs ~2-4GB RAM for model inference.

4. **Static Files**: Make sure static files are included in deployment (webapp/static/)

5. **Temporary Files**: PLY files are stored in temp directory. For production, consider:
   - Using object storage (S3, GCS) for PLY files
   - Adding cleanup for old files
   - Using a proper session store (Redis, database)

## Quick Local Testing Before Deployment

```bash
# Test the app locally
cd webapp
uvicorn app:app --host 0.0.0.0 --port 8000

# Test with production-like settings
PYTHONUNBUFFERED=1 uvicorn app:app --host 0.0.0.0 --port 8000
```

## Recommended for Your Use Case

- **Free/Personal**: Render or Railway (free tier)
- **Mac Users**: Browser rendering works great, no CUDA needed!
- **Production with CUDA**: AWS EC2 GPU instance or Google Cloud with GPU
- **Docker**: Best for consistent deployments across platforms

