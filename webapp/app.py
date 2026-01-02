"""FastAPI backend for Sharp Gaussian Splat web application.

For licensing see accompanying LICENSE file.
Copyright (C) 2025 Apple Inc. All Rights Reserved.
"""

from __future__ import annotations

import logging
import tempfile
import uuid
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
import io

from sharp.models import PredictorParams, create_predictor
from sharp.utils import io as sharp_io
from sharp.utils import camera, gsplat
from sharp.utils.gaussians import Gaussians3D, SceneMetaData, save_ply
from sharp.cli.render import render_gaussians
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Sharp Gaussian Splat Web App")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
predictor = None
device = None
DEFAULT_MODEL_URL = "https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt"

# Storage for generated Gaussians (session-based)
gaussian_storage: dict[str, tuple[Gaussians3D, SceneMetaData]] = {}
ply_storage: dict[str, str] = {}  # Session ID -> PLY file path


def get_device():
    """Get the best available device."""
    if torch.cuda.is_available():
        return torch.device("cuda")
    try:
        if torch.backends.mps.is_available():  # type: ignore
            return torch.device("mps")
    except AttributeError:
        pass
    return torch.device("cpu")


def load_model():
    """Load the Sharp model."""
    global predictor, device
    if predictor is not None:
        return

    device = get_device()
    logger.info(f"Loading model on device: {device}")

    # Download or load checkpoint
    # Note: Model is ~1.6GB, downloads to ~/.cache/torch/hub/checkpoints/
    # This happens once and is cached. See HOSTING_LARGE_MODEL.md for optimization options.
    try:
        logger.info("Downloading default model (~1.6GB, may take several minutes on first run)...")
        state_dict = torch.hub.load_state_dict_from_url(DEFAULT_MODEL_URL, progress=True)
        logger.info("Model download complete!")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise

    gaussian_predictor = create_predictor(PredictorParams())
    gaussian_predictor.load_state_dict(state_dict)
    gaussian_predictor.eval()
    gaussian_predictor.to(device)
    predictor = gaussian_predictor
    logger.info("Model loaded successfully")


@app.on_event("startup")
async def startup_event():
    """Load model on startup."""
    load_model()


@app.get("/")
async def root():
    """Serve the main HTML page."""
    static_dir = Path(__file__).parent / "static"
    return FileResponse(static_dir / "index.html")


@app.get("/api/check")
async def check_system():
    """Check system capabilities."""
    return JSONResponse({
        "cuda_available": torch.cuda.is_available(),
        "device": str(device) if device else "unknown",
    })


@app.get("/api/ply/{session_id}")
async def get_ply(session_id: str):
    """Get PLY file for a session."""
    if session_id not in ply_storage:
        raise HTTPException(status_code=404, detail="PLY file not found")
    
    ply_path = Path(ply_storage[session_id])
    if not ply_path.exists():
        raise HTTPException(status_code=404, detail="PLY file does not exist")
    
    return FileResponse(
        ply_path,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="gaussians_{session_id}.ply"',
        },
    )


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image and generate Gaussian splat."""
    try:
        # Read image
        contents = await file.read()
        image_pil = Image.open(io.BytesIO(contents))
        
        # Convert to RGB numpy array
        image_np = np.array(image_pil.convert("RGB"))
        height, width = image_np.shape[:2]
        
        # Estimate focal length (simplified - using default)
        f_px = sharp_io.convert_focallength(width, height, 30.0)
        
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Predict Gaussians
        logger.info(f"Processing image for session {session_id}")
        if device is None:
            raise HTTPException(status_code=500, detail="Device not initialized")
        gaussians = predict_image(predictor, image_np, f_px, device)
        
        # Store Gaussians
        metadata = SceneMetaData(f_px, (width, height), "linearRGB")
        gaussian_storage[session_id] = (gaussians, metadata)
        
        # Save PLY file for browser rendering
        with tempfile.NamedTemporaryFile(delete=False, suffix=".ply") as tmp:
            ply_path = Path(tmp.name)
            save_ply(gaussians, f_px, (height, width), ply_path)
            ply_storage[session_id] = str(ply_path)
        
        logger.info(f"Generated Gaussians for session {session_id}")
        
        return JSONResponse({
            "session_id": session_id,
            "width": width,
            "height": height,
            "focal_length": float(f_px),
            "ply_path": f"/api/ply/{session_id}",
        })
    except Exception as e:
        logger.error(f"Error processing image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/render")
async def render_view(
    session_id: str,
    eye_x: float = 0.0,
    eye_y: float = 0.0,
    eye_z: float = 0.0,
    width: int = 800,
    height: int = 600,
):
    """Render Gaussian splat from a specific camera position."""
    if session_id not in gaussian_storage:
        raise HTTPException(status_code=404, detail="Session not found")
    
    gaussians, metadata = gaussian_storage[session_id]
    
    # Check if CUDA is available for rendering
    if not torch.cuda.is_available():
        raise HTTPException(
            status_code=503,
            detail="Rendering requires CUDA GPU. Server-side rendering is not available on this system."
        )
    
    try:
        render_device = torch.device("cuda")
        f_px = metadata.focal_length_px
        orig_width, orig_height = metadata.resolution_px
        
        # Create intrinsics
        intrinsics = torch.tensor(
            [
                [f_px, 0, (width - 1) / 2.0, 0],
                [0, f_px, (height - 1) / 2.0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1],
            ],
            device=render_device,
            dtype=torch.float32,
        )
        
        # Create camera model
        camera_model = camera.create_camera_model(
            gaussians, intrinsics, resolution_px=(width, height)
        )
        
        # Create eye position
        eye_position = torch.tensor([eye_x, eye_y, eye_z], dtype=torch.float32)
        camera_info = camera_model.compute(eye_position)
        
        # Render
        renderer = gsplat.GSplatRenderer(color_space=metadata.color_space)
        rendering_output = renderer(
            gaussians.to(render_device),
            extrinsics=camera_info.extrinsics[None].to(render_device),
            intrinsics=camera_info.intrinsics[None].to(render_device),
            image_width=width,
            image_height=height,
        )
        
        # Convert to image
        color = rendering_output.color[0].permute(1, 2, 0)
        color_np = (color.detach().cpu().numpy() * 255.0).astype(np.uint8)
        
        # Save to temporary file
        tmp_path = Path(tempfile.gettempdir()) / f"sharp_render_{uuid.uuid4()}.png"
        sharp_io.save_image(color_np, tmp_path)
        
        # Clean up old temp files (keep last 10)
        # Note: In production, use a proper cleanup mechanism
        
        return FileResponse(
            tmp_path,
            media_type="image/png",
            headers={"Cache-Control": "no-cache"},
        )
    except Exception as e:
        logger.error(f"Error rendering: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@torch.no_grad()
def predict_image(
    predictor_model,
    image: np.ndarray,
    f_px: float,
    device: torch.device,
) -> Gaussians3D:
    """Predict Gaussians from an image."""
    internal_shape = (1536, 1536)
    
    logger.info("Running preprocessing.")
    image_pt = torch.from_numpy(image.copy()).float().to(device).permute(2, 0, 1) / 255.0
    _, height, width = image_pt.shape
    disparity_factor = torch.tensor([f_px / width]).float().to(device)
    
    image_resized_pt = F.interpolate(
        image_pt[None],
        size=(internal_shape[1], internal_shape[0]),
        mode="bilinear",
        align_corners=True,
    )
    
    # Predict Gaussians in the NDC space.
    logger.info("Running inference.")
    gaussians_ndc = predictor_model(image_resized_pt, disparity_factor)
    
    logger.info("Running postprocessing.")
    intrinsics = (
        torch.tensor(
            [
                [f_px, 0, width / 2, 0],
                [0, f_px, height / 2, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1],
            ]
        )
        .float()
        .to(device)
    )
    intrinsics_resized = intrinsics.clone()
    intrinsics_resized[0] *= internal_shape[0] / width
    intrinsics_resized[1] *= internal_shape[1] / height
    
    # Convert Gaussians to metrics space.
    from sharp.utils.gaussians import unproject_gaussians
    gaussians = unproject_gaussians(
        gaussians_ndc, torch.eye(4).to(device), intrinsics_resized, internal_shape
    )
    
    return gaussians


@app.post("/api/generate-video")
async def generate_video(session_id: str):
    """Generate a video with 90-degree left/right rotation."""
    if session_id not in gaussian_storage:
        raise HTTPException(status_code=404, detail="Session not found")
    
    gaussians, metadata = gaussian_storage[session_id]
    
    # Check for CUDA (required for rendering)
    if not torch.cuda.is_available():
        raise HTTPException(
            status_code=503, 
            detail="Video generation requires CUDA. Server-side rendering is not available on this system."
        )
    
    try:
        width, height = metadata.resolution_px
        f_px = metadata.focal_length_px
        
        # Create trajectory params for rotation
        # We'll use a custom trajectory that rotates 90 degrees left and right
        params = camera.TrajectoryParams(
            type="rotate",
            num_steps=120,  # Smooth rotation
            num_repeats=1,
            max_disparity=0.08,  # This controls the rotation range
        )
        
        # Calculate max offset for 90-degree rotation
        # 90 degrees = 0.25 of full circle, so we need to adjust the trajectory
        max_offset = camera.compute_max_offset(
            gaussians, params, metadata.resolution_px, f_px
        )
        
        # Create custom trajectory: rotate from -90 to +90 degrees
        # We'll create a trajectory that goes from -0.25 to 0.25 of a full rotation
        num_steps = 120
        trajectory = []
        for i in range(num_steps):
            # t goes from -0.25 to 0.25 (90 degrees left to 90 degrees right)
            t = (i / (num_steps - 1) - 0.5) * 0.5  # -0.25 to 0.25
            x = max_offset[0] * np.sin(2 * np.pi * t)
            y = max_offset[1] * np.cos(2 * np.pi * t)
            z = 0.0
            trajectory.append(torch.tensor([x, y, z], dtype=torch.float32))
        
        # Create temporary video file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            video_path = Path(tmp.name)
        
        device = torch.device("cuda")
        
        intrinsics = torch.tensor(
            [
                [f_px, 0, (width - 1) / 2.0, 0],
                [0, f_px, (height - 1) / 2.0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1],
            ],
            device=device,
            dtype=torch.float32,
        )
        
        camera_model = camera.create_camera_model(
            gaussians, intrinsics, resolution_px=metadata.resolution_px
        )
        
        renderer = gsplat.GSplatRenderer(color_space=metadata.color_space)
        video_writer = sharp_io.VideoWriter(video_path)
        
        logger.info(f"Rendering {len(trajectory)} frames for video...")
        for i, eye_position in enumerate(trajectory):
            if i % 20 == 0:
                logger.info(f"Rendering frame {i}/{len(trajectory)}")
            eye_tensor = eye_position.to(device)
            camera_info = camera_model.compute(eye_tensor)
            rendering_output = renderer(
                gaussians.to(device),
                extrinsics=camera_info.extrinsics[None].to(device),
                intrinsics=camera_info.intrinsics[None].to(device),
                image_width=camera_info.width,
                image_height=camera_info.height,
            )
            color = (rendering_output.color[0].permute(1, 2, 0) * 255.0).to(dtype=torch.uint8)
            depth = rendering_output.depth[0]
            video_writer.add_frame(color, depth)
        
        video_writer.close()
        logger.info(f"Video saved to {video_path}")
        
        # Return the video file
        return FileResponse(
            video_path,
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'attachment; filename="gaussian-rotation-{session_id}.mp4"',
            },
        )
    except Exception as e:
        logger.error(f"Error generating video: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Mount static files
static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

