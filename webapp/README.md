# Sharp Gaussian Splat Web Application

A web application that allows users to upload images and interactively view the generated 3D Gaussian splats using the Sharp model.

## Features

- 🖼️ **Drag-and-drop image upload** - Easy image upload interface
- 🎨 **Interactive 3D navigation** - Navigate through Gaussian splats with mouse and keyboard
- ⚡ **Real-time rendering** - View different camera angles in real-time
- 🎯 **Intuitive controls** - Mouse drag to rotate, scroll to zoom, arrow keys to move

## Requirements

- Python 3.9+
- CUDA-capable GPU (for rendering) - CPU/MPS can be used for prediction but rendering requires CUDA
- All dependencies from the main Sharp project

## Installation

1. Install the main Sharp dependencies:
```bash
pip install -r requirements.txt
```

2. Install web app dependencies:
```bash
cd webapp
pip install -r requirements.txt
```

## Running the Application

**Important:** Run from the project root directory (where `src/sharp` is located) to ensure imports work correctly.

1. Start the FastAPI server using the provided script:
```bash
./webapp/run.sh
```

Or manually using uvicorn:
```bash
# From project root
python -m uvicorn webapp.app:app --host 0.0.0.0 --port 8000 --reload
```

Or if you prefer to run from the webapp directory:
```bash
cd webapp
# Make sure sharp is installed or PYTHONPATH includes the project root
PYTHONPATH=.. python app.py
```

2. Open your browser and navigate to:
```
http://localhost:8000
```

## Usage

1. **Upload an image**: Drag and drop an image onto the upload area or click to browse
2. **Wait for processing**: The model will process your image (takes a few seconds)
3. **Navigate the splat**:
   - **Mouse drag**: Rotate the camera around the scene
   - **Mouse wheel**: Zoom in/out
   - **Arrow keys**: Move the camera position
   - **W/S keys**: Move forward/backward

## API Endpoints

- `POST /api/upload` - Upload an image and generate Gaussian splat
- `POST /api/render` - Render a view from a specific camera position
  - Parameters:
    - `session_id`: Session ID from upload
    - `eye_x`, `eye_y`, `eye_z`: Camera position
    - `width`, `height`: Render resolution (default: 800x600)

## Notes

- The model checkpoint will be automatically downloaded on first run
- Server-side rendering requires CUDA. If CUDA is not available, you'll see an error when trying to render
- Generated Gaussians are stored in memory per session
- For production use, consider adding authentication, rate limiting, and persistent storage

## Troubleshooting

**"Rendering requires CUDA GPU" error:**
- The rendering endpoint requires CUDA. You can still generate Gaussians on CPU/MPS, but rendering won't work.

**Model download fails:**
- Check your internet connection
- The model file is ~500MB and will be cached at `~/.cache/torch/hub/checkpoints/`

**Port already in use:**
- Change the port in `app.py` or use: `uvicorn app:app --port 8001`

