#!/usr/bin/env python3
"""
Raspberry Pi Camera Streaming Server (ArduCam Compatible)
Provides HTTP endpoints to stream video from ArduCam using rpicam
"""

import subprocess
import threading
import time
import signal
import os
from flask import Flask, Response, jsonify, request, make_response
from flask_cors import CORS
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Enable CORS for frontend connections with permissive configuration
CORS(app, resources={
    r"/api/*": {
        "origins": "*",  # Allow all origins for development
        "methods": ["GET", "POST", "OPTIONS", "HEAD"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False
    }
})

class CameraStream:
    def __init__(self):
        self.camera_process = None
        self.last_access = time.time()
        self.lock = threading.Lock()
        self.streaming = False
        self.camera_available = self.check_camera_available()
        self.current_mode = {
            'width': 1280,
            'height': 720,
            'framerate': 80,
            'name': '720p HD'
        }
        # Available camera modes based on imx519 specifications
        self.available_modes = [
            {
                'id': 'hd_720p',
                'name': '720p HD',
                'width': 1280,
                'height': 720,
                'framerate': 80,
                'description': '1280x720 @ 80fps - High frame rate for smooth motion'
            },
            {
                'id': 'fhd_1080p',
                'name': '1080p Full HD',
                'width': 1920,
                'height': 1080,
                'framerate': 60,
                'description': '1920x1080 @ 60fps - Standard high definition'
            },
            {
                'id': 'qhd_2k',
                'name': '2K QHD',
                'width': 2328,
                'height': 1748,
                'framerate': 30,
                'description': '2328x1748 @ 30fps - High resolution'
            },
            {
                'id': 'uhd_4k',
                'name': '4K Ultra HD',
                'width': 3840,
                'height': 2160,
                'framerate': 18,
                'description': '3840x2160 @ 18fps - Ultra high definition'
            },
            {
                'id': 'native_max',
                'name': 'Native Maximum',
                'width': 4656,
                'height': 3496,
                'framerate': 9,
                'description': '4656x3496 @ 9fps - Maximum native resolution'
            }
        ]

    def check_camera_available(self):
        """Check if camera is available using rpicam"""
        try:
            result = subprocess.run(['rpicam-hello', '--list-cameras'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0 and 'Available cameras' in result.stdout:
                logger.info("ArduCam detected and available")
                return True
            else:
                logger.error("No cameras detected by rpicam")
                return False
        except Exception as e:
            logger.error(f"Error checking camera availability: {e}")
            return False

    def start_camera_stream(self):
        """Start rpicam streaming process"""
        try:
            # Kill any existing camera processes
            self.stop_camera_stream()
            
            # Start rpicam-vid for MJPEG streaming to stdout
            cmd = [
                'rpicam-vid',
                '--timeout', '0',  # Run indefinitely
                '--width', str(self.current_mode['width']),
                '--height', str(self.current_mode['height']),
                '--framerate', str(self.current_mode['framerate']),
                '--output', '-',  # Output to stdout
                '--codec', 'mjpeg',  # MJPEG codec for HTTP streaming
                '--nopreview',  # No preview window
                '--inline'  # Include SPS/PPS in stream
            ]
            
            self.camera_process = subprocess.Popen(
                cmd, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.DEVNULL,  # Suppress stderr to avoid noise
                bufsize=0
            )
            
            # Wait a moment to ensure process started successfully
            time.sleep(0.5)
            if self.camera_process.poll() is not None:
                logger.error("Camera process failed to start or exited immediately")
                return False
            
            logger.info("Camera streaming process started with rpicam-vid")
            return True
            
        except Exception as e:
            logger.error(f"Error starting camera stream: {e}")
            return False

    def stop_camera_stream(self):
        """Stop camera streaming process"""
        try:
            if self.camera_process:
                self.camera_process.terminate()
                try:
                    self.camera_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.camera_process.kill()
                    self.camera_process.wait()
                self.camera_process = None
                logger.info("Camera streaming process stopped")
        except Exception as e:
            logger.error(f"Error stopping camera stream: {e}")

    def generate_frames(self):
        """Generate frames for HTTP streaming using rpicam-vid"""
        if not self.camera_available:
            logger.error("Camera not available")
            return
            
        # Start the camera stream if not already running
        if not self.camera_process or self.camera_process.poll() is not None:
            if not self.start_camera_stream():
                return
        
        try:

            # For MJPEG streaming, we need to read and parse the stream
            buffer = b''
            while self.streaming and self.camera_process and self.camera_process.poll() is None:
                # Read chunk of data from camera process
                chunk = self.camera_process.stdout.read(4096)
                if not chunk:
                    break
                    
                buffer += chunk
                self.last_access = time.time()
                
                # Look for JPEG frame markers
                while True:
                    # Find start of JPEG (FF D8)
                    start = buffer.find(b'\xff\xd8')
                    if start == -1:
                        break
                        
                    # Find end of JPEG (FF D9)
                    end = buffer.find(b'\xff\xd9', start)
                    if end == -1:
                        break
                        
                    # Extract complete JPEG frame
                    frame = buffer[start:end+2]
                    buffer = buffer[end+2:]
                    
                    # Yield frame in multipart format
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
                
        except Exception as e:
            logger.error(f"Error in frame generation: {e}")
        finally:
            self.stop_camera_stream()

    def start_streaming(self):
        """Start the camera streaming"""
        if not self.streaming and self.camera_available:
            # Actually start the camera process when streaming is requested
            if self.start_camera_stream():
                self.streaming = True
                logger.info("Camera streaming started")
                return True
            else:
                logger.error("Failed to start camera process")
                return False
        elif self.streaming:
            # Already streaming
            return True
        else:
            logger.error("Camera not available for streaming")
            return False

    def stop_streaming(self):
        """Stop the camera streaming"""
        if self.streaming:
            self.streaming = False
            self.stop_camera_stream()
            logger.info("Camera streaming stopped")

    def set_camera_mode(self, mode_id):
        """Set camera mode by ID"""
        mode = next((m for m in self.available_modes if m['id'] == mode_id), None)
        if not mode:
            logger.error(f"Invalid camera mode ID: {mode_id}")
            return False
        
        # Store current streaming state
        was_streaming = self.streaming
        
        # Stop streaming if active
        if was_streaming:
            self.stop_streaming()
        
        # Update current mode
        self.current_mode = {
            'width': mode['width'],
            'height': mode['height'],
            'framerate': mode['framerate'],
            'name': mode['name']
        }
        
        logger.info(f"Camera mode set to {mode['name']} ({mode['width']}x{mode['height']} @ {mode['framerate']}fps)")
        
        # Restart streaming if it was active
        if was_streaming:
            return self.start_streaming()
        
        return True

    def get_available_modes(self):
        """Get list of available camera modes"""
        return self.available_modes

    def get_current_mode(self):
        """Get current camera mode"""
        return self.current_mode

    def cleanup(self):
        """Release camera resources"""
        self.stop_streaming()
        logger.info("Camera resources cleaned up")

# Global camera instance
camera_stream = CameraStream()

def add_cors_headers(response):
    """Add CORS headers to response"""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, HEAD'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

@app.after_request
def after_request(response):
    """Add CORS headers to all responses"""
    return add_cors_headers(response)

@app.route('/api/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    """Handle preflight OPTIONS requests"""
    response = make_response()
    return add_cors_headers(response)

@app.route('/api/stream')
def video_stream():
    """Video streaming endpoint"""
    camera_stream.start_streaming()
    return Response(
        camera_stream.generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/api/camera/status')
def camera_status():
    """Get camera status"""
    if camera_stream.camera_available:
        return jsonify({
            'status': 'active',
            'streaming': camera_stream.streaming,
            'last_access': camera_stream.last_access,
            'current_mode': camera_stream.get_current_mode()
        })
    else:
        return jsonify({
            'status': 'inactive',
            'streaming': False,
            'last_access': None,
            'current_mode': None
        })

@app.route('/api/camera/start')
def start_camera():
    """Start camera streaming"""
    if camera_stream.start_streaming():
        return jsonify({'message': 'Camera streaming started'})
    else:
        return jsonify({'error': 'Failed to start camera streaming'}), 500

@app.route('/api/camera/stop')
def stop_camera():
    """Stop camera streaming"""
    camera_stream.stop_streaming()
    return jsonify({'message': 'Camera streaming stopped'})

@app.route('/api/camera/restart')
def restart_camera():
    """Restart camera"""
    camera_stream.cleanup()
    camera_stream.camera_available = camera_stream.check_camera_available()
    if camera_stream.camera_available:
        return jsonify({'message': 'Camera restarted successfully'})
    else:
        return jsonify({'error': 'Failed to restart camera'}), 500

@app.route('/api/camera/modes')
def get_camera_modes():
    """Get available camera modes"""
    return jsonify({
        'available_modes': camera_stream.get_available_modes(),
        'current_mode': camera_stream.get_current_mode()
    })

@app.route('/api/camera/mode', methods=['POST'])
def set_camera_mode():
    """Set camera mode"""
    try:
        data = request.get_json()
        if not data or 'mode_id' not in data:
            return jsonify({'error': 'mode_id is required'}), 400
        
        mode_id = data['mode_id']
        if camera_stream.set_camera_mode(mode_id):
            return jsonify({
                'message': f'Camera mode set successfully',
                'current_mode': camera_stream.get_current_mode()
            })
        else:
            return jsonify({'error': 'Failed to set camera mode'}), 500
    except Exception as e:
        logger.error(f"Error setting camera mode: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'camera-stream'})

if __name__ == '__main__':
    try:
        logger.info("Starting Camera Streaming Server...")
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        camera_stream.cleanup()
