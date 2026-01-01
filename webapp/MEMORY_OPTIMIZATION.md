# Memory Optimization for Render Deployment

## Issue
The free tier (512MB RAM) runs out of memory during build when installing PyTorch and dependencies.

## Solutions

### Option 1: Upgrade to Starter Plan (Recommended)
- **Cost**: ~$7/month
- **Memory**: 512MB → 2GB RAM
- **Update render.yaml**: Change `plan: free` to `plan: starter`

### Option 2: Optimize Build Process
We've already added:
- `--no-cache-dir` to pip installs (saves disk space)
- `PIP_NO_CACHE_DIR=1` environment variable

### Option 3: Use CPU-only PyTorch (Lighter)
If you don't need CUDA support, you could use CPU-only PyTorch which is smaller:
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

However, this won't work well for the Sharp model which benefits from GPU.

### Option 4: Alternative Platforms
- **Railway**: $5/month, 512MB RAM (might still struggle)
- **Fly.io**: Free tier with 256MB, but can scale
- **Google Cloud Run**: Pay per use, 2GB default
- **AWS Lambda**: Not suitable (15min timeout, model too large)

## Recommended: Upgrade to Starter Plan
The Sharp model needs memory for:
- Model loading (~1.6GB model file)
- Inference (2-4GB RAM)
- PyTorch overhead

512MB is not enough. The starter plan (2GB) should work, but you may still need to monitor memory usage.

## Quick Fix
Update your Render service settings:
1. Go to Settings → Plan
2. Change from "Free" to "Starter" ($7/month)
3. Redeploy

The updated `render.yaml` already has `plan: starter` configured.

