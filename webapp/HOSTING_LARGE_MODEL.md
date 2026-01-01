# Hosting Guide for Large Model (1.6GB)

The Sharp model is ~1.6GB, which creates challenges for hosting. Here are the best solutions:

## Option 1: Download on First Run (Recommended for Most Platforms)

The model downloads automatically from Apple's CDN on first run. This is the simplest approach:

**Pros:**
- No need to store model in repo
- Works on most platforms
- Model caches locally

**Cons:**
- Slow first request (5-10 minutes)
- Uses temporary storage (may be cleared)
- Needs good internet connection

**Implementation:** Already done! The code downloads from:
```
https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt
```

**Best for:** Render, Railway, Fly.io, most cloud platforms

---

## Option 2: Use Persistent Storage (Recommended for Production)

Mount persistent storage and pre-download the model:

### Render (with Persistent Disk)

1. Add a persistent disk in Render dashboard
2. Mount it to `/cache`
3. Download model on startup if not exists:

```python
# In app.py, modify model loading:
import os
from pathlib import Path

CACHE_DIR = Path(os.getenv("CACHE_DIR", "~/.cache/torch/hub/checkpoints"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH = CACHE_DIR / "sharp_2572gikvuh.pt"

if not MODEL_PATH.exists():
    logger.info("Downloading model...")
    state_dict = torch.hub.load_state_dict_from_url(DEFAULT_MODEL_URL, progress=True)
    torch.save(state_dict, MODEL_PATH)
else:
    logger.info("Loading model from cache")
    state_dict = torch.load(MODEL_PATH, weights_only=True)
```

### AWS/GCP with Persistent Disk

- **AWS EBS**: Attach persistent volume, mount to `/cache`
- **Google Cloud Persistent Disk**: Mount to your container
- **Azure**: Use Azure Files or Managed Disks

---

## Option 3: Pre-download in Docker Image (Fastest Startup)

Download the model during Docker build:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt webapp/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r webapp/requirements.txt

# Download model during build
RUN python -c "import torch; torch.hub.load_state_dict_from_url('https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt', progress=True, model_dir='/app/models')"

# Copy application
COPY . .

EXPOSE 8000
CMD ["uvicorn", "webapp.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Pros:** Fast startup, model always available
**Cons:** Large Docker image (~2GB), slower builds

**Best for:** Docker-based deployments, production environments

---

## Option 4: Use Object Storage (Recommended for Scalability)

Store model in cloud storage (S3, GCS, Azure Blob) and download on startup:

### AWS S3 Example

```python
import boto3
from io import BytesIO

def load_model_from_s3():
    s3 = boto3.client('s3')
    bucket = 'your-model-bucket'
    key = 'sharp_2572gikvuh.pt'
    
    # Try to load from S3
    try:
        obj = s3.get_object(Bucket=bucket, Key=key)
        return torch.load(BytesIO(obj['Body'].read()), weights_only=True)
    except:
        # Fallback to downloading
        return torch.hub.load_state_dict_from_url(DEFAULT_MODEL_URL, progress=True)
```

### Google Cloud Storage

```python
from google.cloud import storage

def load_model_from_gcs():
    client = storage.Client()
    bucket = client.bucket('your-model-bucket')
    blob = bucket.blob('sharp_2572gikvuh.pt')
    
    if blob.exists():
        return torch.load(BytesIO(blob.download_as_bytes()), weights_only=True)
    else:
        return torch.hub.load_state_dict_from_url(DEFAULT_MODEL_URL, progress=True)
```

**Pros:** Scalable, fast for multiple instances, cost-effective
**Cons:** Requires cloud account, additional setup

---

## Option 5: Use Hugging Face Model Hub (If Available)

If the model is on Hugging Face:

```python
from huggingface_hub import hf_hub_download
import torch

MODEL_PATH = hf_hub_download(
    repo_id="apple/sharp",
    filename="sharp_2572gikvuh.pt",
    cache_dir="./models"
)
state_dict = torch.load(MODEL_PATH, weights_only=True)
```

**Note:** Check if Apple has uploaded it to HF Hub

---

## Platform-Specific Recommendations

### Render (Free/Starter Tier)
- **Use:** Option 1 (download on first run)
- **Note:** Free tier has limited storage, model may be cleared
- **Upgrade to:** Paid tier with persistent disk for Option 2

### Railway
- **Use:** Option 1 or 2 (with persistent volume)
- Railway supports persistent volumes on paid plans

### Fly.io
- **Use:** Option 2 (persistent volumes) or Option 3 (Docker)
- Fly.io has volume support

### AWS (EC2/ECS/Lambda)
- **Use:** Option 2 (EBS), Option 3 (Docker), or Option 4 (S3)
- **Lambda:** Not recommended (1.6GB exceeds limits)
- **ECS/Fargate:** Use Option 3 or 4

### Google Cloud
- **Use:** Option 2 (Persistent Disk), Option 3 (Container), or Option 4 (GCS)
- **Cloud Run:** Option 4 (GCS) is best for serverless

### Azure
- **Use:** Option 2 (Managed Disk), Option 3 (Container), or Option 4 (Blob Storage)

---

## Recommended Approach by Use Case

### Personal Project / Demo
→ **Option 1**: Download on first run
- Simplest, works everywhere
- Accept slow first startup

### Production / Multiple Users
→ **Option 4**: Object Storage (S3/GCS/Azure)
- Fast, scalable, cost-effective
- Model available immediately

### Single Server Deployment
→ **Option 2**: Persistent Disk
- Simple, fast after first download
- Good for dedicated servers

### Docker/Kubernetes
→ **Option 3**: Pre-download in image
- Fastest startup
- Predictable deployments

---

## Cost Considerations

- **Storage:** ~$0.023/GB/month (AWS S3, GCS standard)
- **Transfer:** ~$0.09/GB for first 10TB (AWS)
- **Persistent Disk:** ~$0.10/GB/month (AWS EBS)

For 1.6GB model:
- Storage: ~$0.04/month
- Transfer (one-time): ~$0.14

**Object Storage is cheapest for multiple instances!**

---

## Implementation Example (Option 1 - Current)

The current implementation already uses Option 1. No changes needed, just be aware:
- First request will be slow (5-10 min download)
- Model cached in `~/.cache/torch/hub/checkpoints/`
- May be cleared on server restart (ephemeral storage)

This works fine for demos and low-traffic sites!

