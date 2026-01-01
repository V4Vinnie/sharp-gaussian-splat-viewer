// Browser-based Gaussian Splat renderer using Three.js
// This works on Mac and any system with WebGL support

class GaussianSplatViewer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.gaussians = null;
        this.points = null;
        
        this.init();
    }
    
    init() {
        if (!this.canvas) {
            throw new Error('Canvas element not provided');
        }
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000); // Black background
        
        // Add a simple test cube to verify rendering works
        // const geometry = new THREE.BoxGeometry();
        // const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        // const cube = new THREE.Mesh(geometry, material);
        // this.scene.add(cube);
        
        // Get canvas size - use offsetWidth/offsetHeight as fallback
        let width = this.canvas.clientWidth || this.canvas.offsetWidth || 800;
        let height = this.canvas.clientHeight || this.canvas.offsetHeight || 600;
        
        // Ensure minimum size
        if (width === 0) width = 800;
        if (height === 0) height = 600;
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(0, 0, 3);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true 
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        
        // Controls - wait a bit for OrbitControls to load if needed
        this.initControls();
        
        // Lighting - not needed for point clouds with vertex colors, but add for compatibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);
        
        // Add a helper to show coordinate axes (for debugging)
        // const axesHelper = new THREE.AxesHelper(1);
        // this.scene.add(axesHelper);
        
        // Handle resize
        window.addEventListener('resize', () => this.onResize());
        
        // Start animation loop
        this.animate();
    }
    
    initControls() {
        // Simple mouse controls implementation
        this.mouseState = {
            isDown: false,
            lastX: 0,
            lastY: 0,
            rotateSpeed: 0.005,
            zoomSpeed: 0.01,
        };
        
        // Mouse down
        this.canvas.addEventListener('mousedown', (e) => {
            this.mouseState.isDown = true;
            this.mouseState.lastX = e.clientX;
            this.mouseState.lastY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        });
        
        // Mouse up
        document.addEventListener('mouseup', () => {
            this.mouseState.isDown = false;
            this.canvas.style.cursor = 'grab';
        });
        
        // Mouse move - rotate
        document.addEventListener('mousemove', (e) => {
            if (!this.mouseState.isDown || !this.camera) return;
            
            const deltaX = (e.clientX - this.mouseState.lastX) * this.mouseState.rotateSpeed;
            const deltaY = (e.clientY - this.mouseState.lastY) * this.mouseState.rotateSpeed;
            
            // Spherical coordinates rotation
            const target = (this.controls && this.controls.target) ? this.controls.target : new THREE.Vector3(0, 0, 0);
            const offset = new THREE.Vector3().subVectors(this.camera.position, target);
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(offset);
            spherical.theta -= deltaX;
            spherical.phi += deltaY;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi)); // Limit phi
            
            offset.setFromSpherical(spherical);
            this.camera.position.copy(target).add(offset);
            this.camera.lookAt(target);
            
            this.mouseState.lastX = e.clientX;
            this.mouseState.lastY = e.clientY;
        });
        
        // Mouse wheel - zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (!this.camera) return;
            
            const target = (this.controls && this.controls.target) ? this.controls.target : new THREE.Vector3(0, 0, 0);
            const direction = new THREE.Vector3()
                .subVectors(this.camera.position, target)
                .normalize();
            
            const distance = this.camera.position.distanceTo(target);
            const newDistance = distance * (1 + e.deltaY * this.mouseState.zoomSpeed);
            
            // Clamp distance
            const clampedDistance = Math.max(0.1, Math.min(100, newDistance));
            direction.multiplyScalar(clampedDistance);
            this.camera.position.copy(target).add(direction);
            this.camera.lookAt(target);
        });
        
        this.canvas.style.cursor = 'grab';
        console.log('Mouse controls initialized');
    }
    
    onResize() {
        if (!this.canvas || !this.camera || !this.renderer) return;
        
        const width = this.canvas.clientWidth || this.canvas.offsetWidth || 800;
        const height = this.canvas.clientHeight || this.canvas.offsetHeight || 600;
        
        if (width > 0 && height > 0) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
    }
    
    async loadPLY(url) {
        try {
            console.log('Loading PLY from:', url);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load PLY: ${response.status} ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            console.log('PLY file size:', arrayBuffer.byteLength);
            const data = this.parsePLY(arrayBuffer);
            console.log('Parsed positions:', data.positions.length, 'colors:', data.colors.length);
            
            if (data.positions.length === 0) {
                throw new Error('No positions found in PLY file');
            }
            
            // Create point cloud from Gaussian splats
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(data.positions);
            const colors = new Float32Array(data.colors);
            
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            // Calculate appropriate point size based on scene scale
            let maxDist = 0;
            const sampleSize = Math.min(1000, data.positions.length);
            for (let i = 0; i < sampleSize; i += 3) {
                const x = data.positions[i];
                const y = data.positions[i + 1];
                const z = data.positions[i + 2];
                const dist = Math.sqrt(x*x + y*y + z*z);
                maxDist = Math.max(maxDist, dist);
            }
            const pointSize = Math.max(0.02, Math.min(0.2, maxDist / 50)); // Adaptive point size
            
            console.log('Max distance from origin (sample):', maxDist);
            console.log('Using point size:', pointSize);
            
            const material = new THREE.PointsMaterial({
                size: pointSize,
                vertexColors: true,
                transparent: false, // Disable transparency for better performance
                opacity: 1.0,
                sizeAttenuation: true,
            });
            
            if (this.points) {
                this.scene.remove(this.points);
            }
            
            this.points = new THREE.Points(geometry, material);
            this.scene.add(this.points);
            
            // Center camera on the scene
            geometry.computeBoundingBox();
            const box = geometry.boundingBox;
            
            if (!box || box.isEmpty()) {
                console.warn('Bounding box is empty, using default camera position');
                this.camera.position.set(0, 0, 3);
                // Store target for mouse controls
                if (!this.controls) {
                    this.controls = { target: new THREE.Vector3(0, 0, 0) };
                } else {
                    this.controls.target = new THREE.Vector3(0, 0, 0);
                }
                return true;
            }
            
            const center = new THREE.Vector3();
            box.getCenter(center);
            
            const size = new THREE.Vector3();
            box.getSize(size);
            
            console.log('Bounding box min:', box.min);
            console.log('Bounding box max:', box.max);
            console.log('Scene center:', center);
            console.log('Scene size:', size);
            
            // Validate values
            const isValid = (v) => !isNaN(v) && isFinite(v) && Math.abs(v) < 1e10;
            
            if (!isValid(center.x) || !isValid(center.y) || !isValid(center.z) ||
                !isValid(size.x) || !isValid(size.y) || !isValid(size.z)) {
                console.warn('Invalid bounding box values, computing from positions directly');
                
                // Compute center and size manually from positions
                const positions = geometry.attributes.position.array;
                let minX = Infinity, minY = Infinity, minZ = Infinity;
                let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
                let validCount = 0;
                
                for (let i = 0; i < positions.length; i += 3) {
                    const x = positions[i];
                    const y = positions[i + 1];
                    const z = positions[i + 2];
                    
                    if (isValid(x) && isValid(y) && isValid(z)) {
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        minZ = Math.min(minZ, z);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                        maxZ = Math.max(maxZ, z);
                        validCount++;
                    }
                }
                
                if (validCount === 0) {
                    console.error('No valid positions found');
                    this.camera.position.set(0, 0, 3);
                    return true;
                }
                
                center.set(
                    (minX + maxX) / 2,
                    (minY + maxY) / 2,
                    (minZ + maxZ) / 2
                );
                
                size.set(
                    maxX - minX,
                    maxY - minY,
                    maxZ - minZ
                );
                
                console.log('Computed center:', center);
                console.log('Computed size:', size);
            }
            
            // Calculate max dimension and clamp it to reasonable values
            const rawMaxDim = Math.max(size.x, size.y, size.z);
            console.log('Raw max dimension:', rawMaxDim);
            
            // If the size seems unreasonable (too large), filter positions aggressively
            let distance;
            let maxDim;
            if (rawMaxDim > 50 || !isFinite(rawMaxDim) || rawMaxDim < 0.01) {
                console.warn(`Scene size seems unreasonable (${rawMaxDim} units), filtering positions aggressively...`);
                
                // Filter positions to reasonable range and recompute
                const positions = geometry.attributes.position.array;
                const filteredPositions = [];
                const filteredColors = [];
                const colors = geometry.attributes.color.array;
                
                // Use a more aggressive filter - only keep positions in a reasonable range
                const maxReasonable = 50; // Only keep positions within 50 units
                let filteredCount = 0;
                
                for (let i = 0; i < positions.length; i += 3) {
                    const x = positions[i];
                    const y = positions[i + 1];
                    const z = positions[i + 2];
                    
                    // Only keep positions in reasonable range
                    if (Math.abs(x) < maxReasonable && Math.abs(y) < maxReasonable && Math.abs(z) < maxReasonable &&
                        isFinite(x) && isFinite(y) && isFinite(z)) {
                        filteredPositions.push(x, y, z);
                        filteredColors.push(colors[i], colors[i+1], colors[i+2]);
                        filteredCount++;
                    }
                }
                
                if (filteredPositions.length > 0) {
                    console.log(`Filtered from ${positions.length/3} to ${filteredCount} positions (kept ${(filteredCount/(positions.length/3)*100).toFixed(1)}%)`);
                    
                    // Update geometry with filtered data
                    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(filteredPositions), 3));
                    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(filteredColors), 3));
                    geometry.computeBoundingBox();
                    
                    const newBox = geometry.boundingBox;
                    const newCenter = new THREE.Vector3();
                    const newSize = new THREE.Vector3();
                    newBox.getCenter(newCenter);
                    newBox.getSize(newSize);
                    
                    center.copy(newCenter);
                    size.copy(newSize);
                    
                    const newMaxDim = Math.max(size.x, size.y, size.z);
                    maxDim = Math.min(Math.max(newMaxDim, 0.1), 50);
                    distance = Math.max(maxDim * 1.5, 0.5);
                    distance = Math.min(distance, 10.0);
                    
                    console.log('After filtering - center:', center, 'size:', size, 'distance:', distance);
                } else {
                    console.error('No valid positions after filtering! Using default camera.');
                    maxDim = 2.0;
                    distance = 3.0;
                }
            } else {
                maxDim = Math.min(Math.max(rawMaxDim, 0.1), 50); // Clamp between 0.1 and 50
                distance = Math.max(maxDim * 1.5, 0.5);
                distance = Math.min(distance, 10.0);
            }
            
            console.log('Scene size (maxDim):', maxDim);
            console.log('Camera distance:', distance);
            console.log('Scene center:', center);
            
            // Position camera to view the scene
            if (isValid(center.x) && isValid(center.y) && isValid(center.z) && isValid(distance) && distance > 0) {
                // Position camera to view the scene from a good angle
                // Three.js convention: camera looks down -Z axis, so position it at +Z relative to center
                const camZ = center.z + distance;
                this.camera.position.set(center.x, center.y, camZ);
                this.camera.lookAt(center);
                this.camera.updateMatrixWorld();
                
                console.log('Camera positioned at:', this.camera.position);
                console.log('Camera looking at:', center);
                console.log('Camera distance from center:', distance);
                
                // Store target for mouse controls
                if (!this.controls) {
                    this.controls = { target: center.clone() };
                } else {
                    this.controls.target = center.clone();
                }
                
                console.log('Camera positioned at:', this.camera.position);
                console.log('Looking at:', center);
                console.log('Distance:', distance);
                console.log('Number of points in scene:', positions.length / 3);
            console.log('Point material size:', material.size);
            console.log('Scene background:', this.scene.background);
            } else {
                console.warn('Invalid camera position values, using default');
                this.camera.position.set(0, 0, 3);
                this.camera.lookAt(0, 0, 0);
                // Store target for mouse controls
                if (!this.controls) {
                    this.controls = { target: new THREE.Vector3(0, 0, 0) };
                } else {
                    this.controls.target = new THREE.Vector3(0, 0, 0);
                }
            }
            
            // Force render
            this.renderer.render(this.scene, this.camera);
            
            return true;
        } catch (error) {
            console.error('Error loading PLY:', error);
            throw error;
        }
    }
    
    parsePLY(arrayBuffer) {
        // Check if file is binary or ASCII
        const textStart = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer.slice(0, Math.min(100, arrayBuffer.byteLength)));
        const isBinary = textStart.includes('format binary') || !textStart.startsWith('ply');
        
        if (isBinary) {
            return this.parseBinaryPLY(arrayBuffer);
        } else {
            return this.parseASCIIPLY(arrayBuffer);
        }
    }
    
    parseASCIIPLY(arrayBuffer) {
        const text = new TextDecoder().decode(arrayBuffer);
        const lines = text.split('\n');
        
        let headerEnd = -1;
        let vertexCount = 0;
        let properties = [];
        let format = 'ascii';
        let xIdx = -1, yIdx = -1, zIdx = -1;
        let fdc0Idx = -1, fdc1Idx = -1, fdc2Idx = -1;
        
        // Parse header
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('element vertex')) {
                const parts = line.split(/\s+/);
                vertexCount = parseInt(parts[2]);
                console.log('Found vertex count:', vertexCount);
            } else if (line.startsWith('property')) {
                const parts = line.split(/\s+/);
                const propName = parts[parts.length - 1];
                const propIdx = properties.length;
                properties.push({ type: parts[1], name: propName });
                
                if (propName === 'x') xIdx = propIdx;
                else if (propName === 'y') yIdx = propIdx;
                else if (propName === 'z') zIdx = propIdx;
                else if (propName === 'f_dc_0') fdc0Idx = propIdx;
                else if (propName === 'f_dc_1') fdc1Idx = propIdx;
                else if (propName === 'f_dc_2') fdc2Idx = propIdx;
            } else if (line.startsWith('format')) {
                format = line.split(' ')[1];
                console.log('PLY format:', format);
            } else if (line === 'end_header') {
                headerEnd = i;
                break;
            }
        }
        
        if (headerEnd === -1) {
            throw new Error('Invalid PLY file: no end_header found');
        }
        
        if (xIdx < 0 || yIdx < 0 || zIdx < 0) {
            throw new Error('Missing position properties (x, y, z) in PLY file');
        }
        
        console.log('Property indices - x:', xIdx, 'y:', yIdx, 'z:', zIdx);
        console.log('Color indices - f_dc_0:', fdc0Idx, 'f_dc_1:', fdc1Idx, 'f_dc_2:', fdc2Idx);
        console.log('Total properties:', properties.length);
        
        const positions = [];
        const colors = [];
        
        // Parse vertex data (ASCII format)
        // Find where data actually starts (skip empty lines after header)
        let dataStart = headerEnd + 1;
        while (dataStart < lines.length && !lines[dataStart].trim()) {
            dataStart++;
        }
        
        console.log('Data starts at line:', dataStart);
        console.log('Total lines in file:', lines.length);
        console.log('Expected properties per vertex:', properties.length);
        
        // Debug first few data lines
        for (let i = 0; i < Math.min(5, lines.length - dataStart); i++) {
            const line = lines[dataStart + i];
            if (line) {
                const values = line.trim().split(/\s+/).filter(v => v.length > 0);
                console.log(`Line ${dataStart + i}: ${values.length} values, first 5:`, values.slice(0, 5));
            }
        }
        
        // Parse all vertex lines
        let parsedCount = 0;
        let lineIndex = dataStart;
        let skippedCount = 0;
        
        while (parsedCount < vertexCount && lineIndex < lines.length) {
            const line = lines[lineIndex].trim();
            lineIndex++;
            
            // Skip empty lines
            if (!line) {
                continue;
            }
            
            // Split by whitespace (handles multiple spaces/tabs)
            // Filter out empty strings from split
            const values = line.split(/\s+/).filter(v => v.length > 0).map(v => {
                const num = parseFloat(v);
                return isNaN(num) ? null : num;
            }).filter(v => v !== null);
            
            // Skip if we don't have enough values
            if (values.length < properties.length) {
                skippedCount++;
                if (skippedCount < 5) {
                    console.warn(`Line ${lineIndex} has only ${values.length} values, expected ${properties.length}. Line: ${line.substring(0, 80)}`);
                }
                continue;
            }
            
            // Extract position
            if (xIdx < values.length && yIdx < values.length && zIdx < values.length) {
                const x = values[xIdx];
                const y = values[yIdx];
                const z = values[zIdx];
                
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    positions.push(x, y, z);
                    
                    // Extract color from spherical harmonics
                    if (fdc0Idx >= 0 && fdc1Idx >= 0 && fdc2Idx >= 0 && 
                        fdc0Idx < values.length && fdc1Idx < values.length && fdc2Idx < values.length) {
                        const sh0 = values[fdc0Idx];
                        const sh1 = values[fdc1Idx];
                        const sh2 = values[fdc2Idx];
                        
                        // Convert degree-0 spherical harmonics to RGB
                        const coeff = Math.sqrt(1.0 / (4.0 * Math.PI));
                        const r = Math.max(0, Math.min(1, sh0 * coeff + 0.5));
                        const g = Math.max(0, Math.min(1, sh1 * coeff + 0.5));
                        const b = Math.max(0, Math.min(1, sh2 * coeff + 0.5));
                        colors.push(r, g, b);
                    } else {
                        // Default white if no color
                        colors.push(1, 1, 1);
                    }
                    
                    parsedCount++;
                } else {
                    skippedCount++;
                    if (skippedCount < 5) {
                        console.warn(`NaN values at line ${lineIndex}: x=${x}, y=${y}, z=${z}`);
                    }
                }
            } else {
                skippedCount++;
                if (skippedCount < 5) {
                    console.warn(`Index out of bounds at line ${lineIndex}. xIdx=${xIdx}, yIdx=${yIdx}, zIdx=${zIdx}, values.length=${values.length}`);
                }
            }
            
            // Progress update for large files
            if (parsedCount > 0 && parsedCount % 100000 === 0) {
                console.log(`Parsed ${parsedCount}/${vertexCount} vertices... (skipped ${skippedCount})`);
            }
        }
        
        console.log(`Skipped ${skippedCount} lines`);
        
        console.log('Parsed', parsedCount, 'vertices out of', vertexCount);
        
        if (positions.length === 0) {
            throw new Error('No valid positions found in PLY file');
        }
        
        // Ensure colors match positions (should already match, but just in case)
        const expectedColors = positions.length;
        while (colors.length < expectedColors) {
            colors.push(1, 1, 1);
        }
        
        console.log('Final: positions:', positions.length, 'colors:', colors.length);
        
        return { positions, colors };
    }
    
    parseBinaryPLY(arrayBuffer) {
        // Read header to find data start and property info
        const textDecoder = new TextDecoder('utf-8', { fatal: false });
        let headerEnd = 0;
        let vertexCount = 0;
        let properties = [];
        let xIdx = -1, yIdx = -1, zIdx = -1;
        let fdc0Idx = -1, fdc1Idx = -1, fdc2Idx = -1;
        let isLittleEndian = true;
        
        // Find header end - look for "end_header\n"
        let lineStart = 0;
        const view = new DataView(arrayBuffer);
        const headerLines = [];
        
        for (let i = 0; i < Math.min(arrayBuffer.byteLength, 10000); i++) {
            const byte = view.getUint8(i);
            if (byte === 0x0A) { // newline
                const lineBytes = arrayBuffer.slice(lineStart, i);
                const line = textDecoder.decode(lineBytes).trim();
                headerLines.push(line);
                
                if (line.startsWith('element vertex')) {
                    const parts = line.split(/\s+/);
                    vertexCount = parseInt(parts[2]);
                    console.log('Found vertex count:', vertexCount);
                } else if (line.startsWith('property')) {
                    const parts = line.split(/\s+/);
                    const propName = parts[parts.length - 1];
                    const propType = parts[1];
                    const propIdx = properties.length;
                    properties.push({ type: propType, name: propName });
                    
                    console.log(`Property ${propIdx}: ${propType} ${propName}`);
                    
                    if (propName === 'x') xIdx = propIdx;
                    else if (propName === 'y') yIdx = propIdx;
                    else if (propName === 'z') zIdx = propIdx;
                    else if (propName === 'f_dc_0') fdc0Idx = propIdx;
                    else if (propName === 'f_dc_1') fdc1Idx = propIdx;
                    else if (propName === 'f_dc_2') fdc2Idx = propIdx;
                } else if (line.startsWith('format')) {
                    const parts = line.split(/\s+/);
                    const formatType = parts[1];
                    isLittleEndian = formatType === 'binary_little_endian';
                    console.log('Binary format:', formatType, 'little endian:', isLittleEndian);
                    
                    // If format is binary_big_endian, we need to handle it
                    if (formatType === 'binary_big_endian') {
                        isLittleEndian = false;
                        console.log('Detected big-endian format');
                    }
                } else if (line === 'end_header') {
                    headerEnd = i + 1; // After the newline
                    console.log('Header ends at byte offset:', headerEnd);
                    console.log('Full header:', headerLines.join('\n'));
                    break;
                }
                
                lineStart = i + 1;
            }
        }
        
        if (headerEnd === 0) {
            throw new Error('Could not find end_header in PLY file');
        }
        
        if (xIdx < 0 || yIdx < 0 || zIdx < 0) {
            throw new Error('Missing position properties (x, y, z) in PLY file');
        }
        
        console.log('Property indices - x:', xIdx, 'y:', yIdx, 'z:', zIdx);
        console.log('Color indices - f_dc_0:', fdc0Idx, 'f_dc_1:', fdc1Idx, 'f_dc_2:', fdc2Idx);
        
        // Calculate property sizes - Sharp uses 'f4' for all properties (float32 = 4 bytes)
        // Note: PLY format uses different type names than numpy
        const propertySizes = properties.map((prop, idx) => {
            const type = prop.type.toLowerCase();
            // Handle 'f4' format from Sharp (numpy dtype format)
            if (type === 'f4' || type === 'float32' || type === 'float') return 4;
            // Standard PLY format types
            switch(type) {
                case 'char': case 'uchar': case 'int8': case 'uint8': return 1;
                case 'short': case 'ushort': case 'int16': case 'uint16': return 2;
                case 'int': case 'uint': case 'int32': case 'uint32': return 4;
                case 'double': case 'float64': return 8;
                default: 
                    console.warn(`Unknown property type '${type}' for property ${idx} (${prop.name}), defaulting to 4 bytes`);
                    return 4; // default to float
            }
        });
        
        const vertexSize = propertySizes.reduce((a, b) => a + b, 0);
        console.log('Vertex size:', vertexSize, 'bytes');
        console.log('Property sizes:', propertySizes);
        console.log('Properties:', properties.map(p => `${p.name}(${p.type})`).join(', '));
        
        // Verify: Sharp should have 14 properties = 56 bytes per vertex
        // x, y, z, f_dc_0, f_dc_1, f_dc_2, opacity, scale_0, scale_1, scale_2, rot_0, rot_1, rot_2, rot_3
        const expectedSharpProperties = 14;
        if (properties.length !== expectedSharpProperties) {
            console.warn(`Expected ${expectedSharpProperties} properties for Sharp PLY, but found ${properties.length}`);
        }
        
        const positions = [];
        const colors = [];
        
        // Parse binary vertex data using a single DataView for the entire data section
        const dataStart = headerEnd;
        const totalSize = vertexCount * vertexSize;
        const availableSize = arrayBuffer.byteLength - dataStart;
        
        console.log('Data section starts at:', dataStart);
        console.log('Expected data size:', totalSize, 'bytes');
        console.log('Available bytes after header:', availableSize);
        console.log('Expected vertices:', vertexCount);
        
        // Debug: Check first few bytes of data section
        const firstBytes = new Uint8Array(arrayBuffer.slice(dataStart, Math.min(dataStart + 100, arrayBuffer.byteLength)));
        console.log('First 100 bytes of data:', Array.from(firstBytes.slice(0, 20)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        
        // Try reading first vertex as a test with BOTH endianness
        if (vertexSize <= availableSize) {
            const testView = new DataView(arrayBuffer, dataStart, Math.min(vertexSize, 100));
            console.log('Test reading first vertex (raw bytes):');
            const rawBytes = new Uint8Array(arrayBuffer.slice(dataStart, dataStart + Math.min(vertexSize, 32)));
            console.log('  First 32 bytes:', Array.from(rawBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            
            let testOffset = 0;
            console.log('Testing with current endianness (little=' + isLittleEndian + '):');
            let foundGoodEndianness = false;
            for (let j = 0; j < Math.min(6, properties.length); j++) {
                const size = propertySizes[j];
                if (testOffset + size <= testView.byteLength) {
                    let value, altValue;
                    if (size === 4) {
                        value = isLittleEndian ? testView.getFloat32(testOffset, true) : testView.getFloat32(testOffset, false);
                        altValue = isLittleEndian ? testView.getFloat32(testOffset, false) : testView.getFloat32(testOffset, true);
                    } else if (size === 1) {
                        value = testView.getUint8(testOffset);
                        altValue = value;
                    } else if (size === 2) {
                        value = isLittleEndian ? testView.getUint16(testOffset, true) : testView.getUint16(testOffset, false);
                        altValue = isLittleEndian ? testView.getUint16(testOffset, false) : testView.getUint16(testOffset, true);
                    }
                    const reasonable = Math.abs(value) < 100 && isFinite(value);
                    const altReasonable = Math.abs(altValue) < 100 && isFinite(altValue);
                    
                    // Check if this is a position property (x, y, z)
                    const isPosition = ['x', 'y', 'z'].includes(properties[j].name);
                    
                    if (isPosition) {
                        if (altReasonable && !reasonable) {
                            console.warn(`  Property ${j} (${properties[j].name}): WRONG ENDIANNESS! Current: ${value}, Correct: ${altValue}`);
                            if (!foundGoodEndianness) {
                                console.warn('  → Switching to opposite endianness for all reads');
                                isLittleEndian = !isLittleEndian;
                                foundGoodEndianness = true;
                            }
                        } else if (reasonable) {
                            console.log(`  Property ${j} (${properties[j].name}): ${value} ✓`);
                        }
                    } else {
                        console.log(`  Property ${j} (${properties[j].name}): ${value} ${reasonable ? '✓' : '✗'} | alt: ${altValue} ${altReasonable ? '✓' : '✗'}`);
                    }
                    testOffset += size;
                }
            }
        }
        
        if (totalSize > availableSize) {
            console.warn(`Warning: Expected ${totalSize} bytes but only ${availableSize} available. Adjusting vertex count.`);
            vertexCount = Math.floor(availableSize / vertexSize);
            console.log('Adjusted vertex count to:', vertexCount);
        }
        
        // Create a single DataView for the entire data section
        const dataView = new DataView(arrayBuffer, dataStart, Math.min(totalSize, availableSize));
        
        // Pre-check endianness by testing first few vertices - check ALL properties, not just positions
        let endiannessSwitched = false;
        if (vertexCount > 0 && vertexSize <= dataView.byteLength) {
            console.log('Pre-checking endianness with first 10 vertices (checking all properties)...');
            let goodWithCurrent = 0;
            let goodWithOpposite = 0;
            
            for (let testI = 0; testI < Math.min(10, vertexCount); testI++) {
                const testOffset = testI * vertexSize;
                let currentGood = true;
                let oppositeGood = true;
                
                // Test a few key properties with both endianness
                for (let testProp = 0; testProp < Math.min(6, properties.length); testProp++) {
                    const propOffset = testProp * 4; // All are 4 bytes (f4)
                    const readOffset = testOffset + propOffset;
                    
                    if (readOffset + 4 <= dataView.byteLength) {
                        // Current endianness
                        const v1 = isLittleEndian ? dataView.getFloat32(readOffset, true) : dataView.getFloat32(readOffset, false);
                        // Opposite endianness
                        const v2 = !isLittleEndian ? dataView.getFloat32(readOffset, true) : dataView.getFloat32(readOffset, false);
                        
                        // Check if reasonable (allow larger values for some properties)
                        const maxReasonable = properties[testProp].name.startsWith('rot_') ? 10 : 1000;
                        const r1 = isFinite(v1) && Math.abs(v1) < maxReasonable;
                        const r2 = isFinite(v2) && Math.abs(v2) < maxReasonable;
                        
                        if (!r1) currentGood = false;
                        if (!r2) oppositeGood = false;
                    }
                }
                
                if (currentGood) goodWithCurrent++;
                if (oppositeGood) goodWithOpposite++;
            }
            
            console.log(`Endianness test: Current (${isLittleEndian ? 'little' : 'big'}): ${goodWithCurrent}/10 good, Opposite: ${goodWithOpposite}/10 good`);
            
            if (goodWithOpposite > goodWithCurrent && goodWithOpposite >= 5) {
                console.warn(`⚠️ Switching to opposite endianness! (${!isLittleEndian ? 'little' : 'big'})`);
                isLittleEndian = !isLittleEndian;
                endiannessSwitched = true;
            } else if (goodWithCurrent < 5 && goodWithOpposite < 5) {
                console.warn('⚠️ Both endianness options give poor results. File format might be different than expected.');
            }
        }
        
        for (let i = 0; i < vertexCount; i++) {
            const vertexOffset = i * vertexSize;
            
            // Check bounds
            if (vertexOffset + vertexSize > dataView.byteLength) {
                console.warn(`Reached end of buffer at vertex ${i}/${vertexCount}`);
                break;
            }
            
            // Read all properties for this vertex
            const values = [];
            let propOffset = 0;
            let hasInvalidValue = false;
            
            for (let j = 0; j < properties.length; j++) {
                const size = propertySizes[j];
                const readOffset = vertexOffset + propOffset;
                
                // Check bounds
                if (readOffset + size > dataView.byteLength) {
                    hasInvalidValue = true;
                    break;
                }
                
                let value;
                try {
                    if (size === 4) {
                        // All Sharp properties are float32 (f4)
                        // Use the (possibly corrected) endianness
                        value = isLittleEndian ? dataView.getFloat32(readOffset, true) : dataView.getFloat32(readOffset, false);
                        
                        // Validate value based on property type
                        const propName = properties[j].name;
                        let maxReasonable = 1e10; // Default very large
                        
                        // Set reasonable limits based on property type - be more strict
                        if (propName === 'x' || propName === 'y' || propName === 'z') {
                            maxReasonable = 50; // Positions should be reasonable (tightened from 1000)
                        } else if (propName.startsWith('f_dc_')) {
                            maxReasonable = 10; // Spherical harmonics coefficients (tightened from 100)
                        } else if (propName === 'opacity') {
                            maxReasonable = 10; // Opacity (will be sigmoid'd) (tightened from 100)
                        } else if (propName.startsWith('scale_')) {
                            maxReasonable = 10; // Scales (tightened from 100)
                        } else if (propName.startsWith('rot_')) {
                            maxReasonable = 2; // Quaternion components should be normalized (tightened from 10)
                        }
                        
                        // Check if value is reasonable
                        if (!isFinite(value) || Math.abs(value) > maxReasonable) {
                            hasInvalidValue = true;
                            // Only log first few to avoid spam
                            if (i < 3 && j < 6) {
                                console.warn(`Skipping vertex ${i} - invalid ${propName}: ${value} (max: ${maxReasonable})`);
                            }
                            break; // Skip this vertex entirely
                        }
                    } else if (size === 1) {
                        value = dataView.getUint8(readOffset);
                    } else if (size === 2) {
                        value = isLittleEndian ? dataView.getUint16(readOffset, true) : dataView.getUint16(readOffset, false);
                    } else if (size === 8) {
                        value = isLittleEndian ? dataView.getFloat64(readOffset, true) : dataView.getFloat64(readOffset, false);
                    }
                } catch (e) {
                    hasInvalidValue = true;
                    if (i < 5) {
                        console.error(`Error reading property ${j} (${properties[j].name}) at vertex ${i}:`, e);
                    }
                    break;
                }
                
                values.push(value);
                propOffset += size;
            }
            
            // Skip this vertex if it has any invalid values
            if (hasInvalidValue || values.length !== properties.length) {
                continue;
            }
            
            // Extract position
            if (xIdx < values.length && yIdx < values.length && zIdx < values.length) {
                let x = values[xIdx];
                let y = values[yIdx];
                let z = values[zIdx];
                
                // Validate position values - they should be reasonable
                // If values are way too large, try opposite endianness (only for first few vertices)
                const maxReasonable = 1000; // Allow up to 1000 units
                if ((Math.abs(x) > maxReasonable || Math.abs(y) > maxReasonable || Math.abs(z) > maxReasonable) && i < 10) {
                    // Values are suspiciously large - try reading with opposite endianness
                    const posOffset = vertexOffset + (xIdx * 4);
                    if (posOffset + 12 <= dataView.byteLength) {
                        const testX = !isLittleEndian ? dataView.getFloat32(posOffset, true) : dataView.getFloat32(posOffset, false);
                        const testY = !isLittleEndian ? dataView.getFloat32(posOffset + 4, true) : dataView.getFloat32(posOffset + 4, false);
                        const testZ = !isLittleEndian ? dataView.getFloat32(posOffset + 8, true) : dataView.getFloat32(posOffset + 8, false);
                        
                        // Check if opposite endianness gives more reasonable values
                        const originalMax = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
                        const testMax = Math.max(Math.abs(testX), Math.abs(testY), Math.abs(testZ));
                        
                        if (testMax < originalMax && testMax < maxReasonable && isFinite(testX) && isFinite(testY) && isFinite(testZ)) {
                            // Opposite endianness is better
                            if (!endiannessSwitched) {
                                console.warn(`⚠️ Endianness is WRONG! Switching from ${isLittleEndian ? 'little' : 'big'} to ${!isLittleEndian ? 'little' : 'big'}`);
                                console.warn(`Example - Original: (${x}, ${y}, ${z}), Corrected: (${testX}, ${testY}, ${testZ})`);
                                endiannessSwitched = true;
                                isLittleEndian = !isLittleEndian;
                            }
                            x = testX;
                            y = testY;
                            z = testZ;
                        }
                    }
                }
                
                // Validate values are reasonable - filter out extremely large values
                // After endianness correction, filter out any remaining bad values
                const isValid = (v) => !isNaN(v) && isFinite(v) && Math.abs(v) < 1000;
                
                if (isValid(x) && isValid(y) && isValid(z)) {
                    positions.push(x, y, z);
                    
                    // Debug first few positions
                    if (positions.length <= 9) {
                        console.log(`Position ${Math.floor(positions.length / 3)}: (${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)})`);
                    }
                    
                    // Extract color from spherical harmonics
                    if (fdc0Idx >= 0 && fdc1Idx >= 0 && fdc2Idx >= 0 && 
                        fdc0Idx < values.length && fdc1Idx < values.length && fdc2Idx < values.length) {
                        const sh0 = values[fdc0Idx];
                        const sh1 = values[fdc1Idx];
                        const sh2 = values[fdc2Idx];
                        
                        // Convert degree-0 spherical harmonics to RGB
                        const coeff = Math.sqrt(1.0 / (4.0 * Math.PI));
                        const r = Math.max(0, Math.min(1, sh0 * coeff + 0.5));
                        const g = Math.max(0, Math.min(1, sh1 * coeff + 0.5));
                        const b = Math.max(0, Math.min(1, sh2 * coeff + 0.5));
                        colors.push(r, g, b);
                    } else {
                        colors.push(1, 1, 1);
                    }
                }
            }
            
            if ((i + 1) % 100000 === 0) {
                console.log(`Parsed ${i + 1}/${vertexCount} vertices...`);
            }
        }
        
        const validVertexCount = positions.length / 3;
        console.log(`Parsed ${validVertexCount} valid vertices from binary PLY (out of ${vertexCount} total)`);
        
        if (validVertexCount === 0) {
            throw new Error('No valid positions found in PLY file. This might indicate endianness or format issues.');
        }
        
        // Log statistics about the parsed data
        if (validVertexCount > 0) {
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            let minZ = Infinity, maxZ = -Infinity;
            for (let i = 0; i < positions.length; i += 3) {
                minX = Math.min(minX, positions[i]);
                maxX = Math.max(maxX, positions[i]);
                minY = Math.min(minY, positions[i+1]);
                maxY = Math.max(maxY, positions[i+1]);
                minZ = Math.min(minZ, positions[i+2]);
                maxZ = Math.max(maxZ, positions[i+2]);
            }
            console.log(`Position ranges - X: [${minX.toFixed(2)}, ${maxX.toFixed(2)}], Y: [${minY.toFixed(2)}, ${maxY.toFixed(2)}], Z: [${minZ.toFixed(2)}, ${maxZ.toFixed(2)}]`);
        }
        
        return { positions, colors };
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // OrbitControls damping (if using OrbitControls)
        if (this.controls && this.controls.update) {
            this.controls.update();
        }
        
        if (this.scene && this.camera && this.renderer) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    getCameraInfo() {
        if (!this.camera) return 'N/A';
        const pos = this.camera.position;
        const isValid = (v) => !isNaN(v) && isFinite(v) && Math.abs(v) < 1e10;
        
        if (!isValid(pos.x) || !isValid(pos.y) || !isValid(pos.z)) {
            return 'Initializing...';
        }
        return `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`;
    }
}

