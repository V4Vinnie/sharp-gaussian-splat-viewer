# Sharp Gaussian Splat Web Viewer

A web application for generating and interactively viewing 3D Gaussian splats from single images using the [Sharp](https://github.com/apple/ml-sharp) model.

## Features

- 🖼️ **Drag-and-drop image upload** - Easy image upload interface
- 🎨 **Interactive 3D navigation** - Navigate through Gaussian splats with mouse and keyboard
- ⚡ **Browser-based rendering** - Works on Mac, Windows, Linux (no CUDA required for viewing)
- 🎯 **Intuitive controls** - Mouse drag to rotate, scroll to zoom

## Live Demo

[Add your deployment URL here]

## Screenshots

[Add screenshots here]

## How It Works

1. Upload an image through the web interface
2. The Sharp model generates a 3D Gaussian splat representation (server-side)
3. The splat is rendered in your browser using WebGL (Three.js)
4. Navigate the 3D scene interactively

## Installation

### Prerequisites

- Python 3.9+
- All dependencies from the main [Sharp project](https://github.com/apple/ml-sharp)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/sharp-gaussian-splat-viewer.git
cd sharp-gaussian-splat-viewer
```

2. Install dependencies:
```bash
# Install Sharp dependencies (from parent directory)
pip install -r requirements.txt

# Install web app dependencies
cd webapp
pip install -r requirements.txt
```

3. Run the application:
```bash
# From the project root
python -m uvicorn webapp.app:app --host 0.0.0.0 --port 8000
```

4. Open your browser:
```
http://localhost:8000
```

## Usage

1. **Upload an image**: Drag and drop an image onto the upload area or click to browse
2. **Wait for processing**: The model will process your image (takes a few seconds)
3. **Navigate the splat**:
   - **Mouse drag**: Rotate the camera around the scene
   - **Mouse wheel**: Zoom in/out
   - **Keyboard** (optional): Arrow keys to move, W/S to zoom

## Architecture

- **Backend**: FastAPI (Python) - Handles image upload, Gaussian splat generation, and PLY file serving
- **Frontend**: Vanilla JavaScript + Three.js - Browser-based 3D rendering with WebGL
- **Model**: Sharp - Monocular view synthesis model for generating 3D Gaussian splats

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment instructions to various platforms:
- Render
- Railway
- Fly.io
- AWS/GCP/Azure
- Docker

## Technical Details

- The model checkpoint (~500MB) downloads automatically on first run
- Gaussian generation works on CPU/MPS/CUDA
- Browser rendering works on all systems with WebGL support
- PLY files are parsed as binary format for efficiency

## Requirements

- Server: Python 3.9+, PyTorch, Sharp model dependencies
- Client: Modern browser with WebGL support (Chrome, Firefox, Safari, Edge)

## Limitations

- Server-side rendering requires CUDA (browser rendering doesn't)
- Model download required on first run (~500MB)
- Large images may take longer to process

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is based on [Sharp](https://github.com/apple/ml-sharp). Please check the original project's LICENSE file for details.

## Acknowledgments

- [Sharp](https://github.com/apple/ml-sharp) by Apple Inc. for the Gaussian splat generation model
- [Three.js](https://threejs.org/) for WebGL rendering
- FastAPI for the web framework

## Roadmap

- [ ] Add support for exporting rendered views
- [ ] Add support for multiple image upload
- [ ] Improve point cloud rendering quality
- [ ] Add preset camera positions
- [ ] Add support for video upload

## Support

For issues related to:
- **Sharp model**: See the [original Sharp repository](https://github.com/apple/ml-sharp)
- **Web app**: Open an issue in this repository

