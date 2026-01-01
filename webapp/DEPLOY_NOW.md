# Quick Deployment Guide

## Option 1: Render.com (Recommended - Easiest)

### Steps:

1. **Go to Render.com**
   - Visit https://render.com
   - Sign up or log in (you can use GitHub to sign in)

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub account if not already connected
   - Select repository: `V4Vinnie/sharp-gaussian-splat-viewer`

3. **Configure Service**
   - **Name**: `sharp-gaussian-splat` (or any name you prefer)
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: Leave empty (or set to `.` if needed)
   - **Environment**: `Python 3`
   - **Build Command**: `cd webapp && pip install -r requirements.txt`
   - **Start Command**: `cd webapp && uvicorn app:app --host 0.0.0.0 --port $PORT`

4. **Environment Variables** (Optional - add if needed):
   - `PYTHONPATH`: `/opt/render/project/src`
   - `PYTHONUNBUFFERED`: `1`

5. **Deploy!**
   - Click "Create Web Service"
   - Render will automatically build and deploy
   - First deployment will take 5-10 minutes (downloads model ~1.6GB)
   - You'll get a URL like: `https://sharp-gaussian-splat.onrender.com`

### Notes:
- **Free tier**: Service spins down after 15 min of inactivity, takes ~30s to wake up
- **Model download**: Happens on first request (takes ~2-3 minutes)
- **Memory**: Free tier has 512MB RAM (may need paid tier for larger images)

---

## Option 2: Railway.app

1. **Install Railway CLI**:
   ```bash
   npm i -g @railway/cli
   ```

2. **Login and Initialize**:
   ```bash
   railway login
   cd /Users/vandevi/sharp
   railway init
   ```

3. **Configure**:
   - Railway will detect the project
   - Set start command: `cd webapp && uvicorn app:app --host 0.0.0.0 --port $PORT`
   - Add environment variable: `PYTHONPATH=/app`

4. **Deploy**:
   ```bash
   railway up
   ```

---

## Option 3: Fly.io

1. **Install flyctl**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create fly.toml** in project root:
   ```toml
   app = "sharp-gaussian-splat"
   primary_region = "sjc"

   [build]

   [http_service]
     internal_port = 8000
     force_https = true

   [[services]]
     processes = ["app"]
     internal_port = 8000
     protocol = "tcp"
   ```

3. **Deploy**:
   ```bash
   fly launch
   fly deploy
   ```

---

## After Deployment

1. **Test the app**: Visit your deployment URL
2. **Upload an image**: Try generating a Gaussian splat
3. **Check logs**: Monitor for any errors

## Troubleshooting

- **503 errors**: Service might be spinning up (free tier)
- **Model download slow**: First request takes time, subsequent requests are faster
- **Memory errors**: Consider upgrading to paid tier
- **Static files not loading**: Check that `webapp/static/` is included in deployment

## Recommended: Render.com

Render is the easiest option with:
- ✅ Free tier available
- ✅ Automatic HTTPS
- ✅ GitHub integration
- ✅ Easy environment variable management
- ✅ Good documentation

Your code is already pushed to GitHub and ready to deploy!

