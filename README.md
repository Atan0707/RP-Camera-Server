# Raspberry Pi Camera Web Stream

A modern web application for streaming video from your Raspberry Pi camera with a beautiful shadcn/ui interface.

## Features

- 🎥 Live video streaming from Raspberry Pi camera
- 🎨 Modern UI built with shadcn/ui components
- 🔄 Real-time camera status monitoring
- ▶️ Start/Stop streaming controls
- 🔄 Camera restart functionality
- 📱 Responsive design
- 🚀 Built with React, TanStack Start, and Flask

## Prerequisites

- Raspberry Pi with camera module enabled
- Python 3.7+
- Node.js 18+
- Yarn package manager

## Setup Instructions

### 1. Camera Server (Python Backend)

Navigate to the project directory and set up the Python environment:

```bash
cd raspberrypi
python3 -m venv myenv
source myenv/bin/activate
pip install -r requirement.txt
```

Or use the provided startup script:

```bash
chmod +x start_camera_server.sh
./start_camera_server.sh
```

### 2. Web Frontend (React App)

In a new terminal, navigate to the cam-app directory:

```bash
cd cam-app
yarn install
yarn dev
```

The web app will be available at `http://localhost:3000`

## Usage

1. **Start the Camera Server**: Run the Python camera server first
   ```bash
   cd raspberrypi
   ./start_camera_server.sh
   ```

2. **Start the Web App**: In another terminal, start the React app
   ```bash
   cd cam-app
   yarn dev
   ```

3. **Access the Web Interface**: Open your browser and go to `http://localhost:3000`

4. **Start Streaming**: Click the "Start Stream" button to begin video streaming

## API Endpoints

The camera server provides these REST API endpoints:

- `GET /api/stream` - Video stream endpoint
- `GET /api/camera/status` - Get camera status
- `GET /api/camera/start` - Start camera streaming
- `GET /api/camera/stop` - Stop camera streaming  
- `GET /api/camera/restart` - Restart camera
- `GET /health` - Health check

## Configuration

### Camera Settings

The camera is configured with these default settings in `camera_stream.py`:

- Resolution: 640x480
- Frame Rate: 30 FPS
- JPEG Quality: 85%

You can modify these settings by editing the `init_camera()` method.

### Server Settings

- Camera Server Port: 5000
- Web App Port: 3000
- CORS is enabled for frontend connections

## Troubleshooting

### Camera Not Found
- Ensure the camera module is enabled: `sudo raspi-config` → Interface Options → Camera
- Check camera connection and try different camera indices in the code
- Verify camera works with: `libcamera-hello`

### Connection Issues
- Make sure the camera server is running on port 5000
- Check firewall settings if accessing from another device
- Verify the server URL in the frontend component

### Performance Issues
- Reduce frame rate or resolution in `camera_stream.py`
- Check network bandwidth for remote access
- Monitor CPU usage during streaming

## File Structure

```
Cam-Web/
├── raspberrypi/
│   ├── camera_stream.py       # Flask camera server
│   ├── requirement.txt        # Python dependencies
│   ├── start_camera_server.sh # Startup script
│   └── myenv/                 # Virtual environment
└── cam-app/
    ├── src/
    │   ├── components/
    │   │   ├── CameraStream.tsx # Main camera component
    │   │   └── ui/              # shadcn/ui components
    │   └── routes/
    │       └── index.tsx        # Main page
    ├── package.json
    └── components.json          # shadcn/ui config
```

## Development

### Adding New Features

1. Backend changes go in `raspberrypi/camera_stream.py`
2. Frontend components go in `cam-app/src/components/`
3. UI components from shadcn: `npx shadcn@latest add <component>`

### Building for Production

```bash
cd cam-app
yarn build
```

## License

MIT License - feel free to use this project for your own applications!
