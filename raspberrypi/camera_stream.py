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
from datetime import datetime
from flask import Flask, Response, jsonify, request, make_response, send_from_directory
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
        self.latest_frame = None  # Store the latest frame for capture
        # Available camera modes based on imx519 specifications
        self.available_modes = [
            {
                'id': 'hd_720p',
                'name': '720p HD',
                'width': 1280,
                'height': 720,
                'framerate': 80,
                'description': '1280x720 @ 80fps - Cropped from center (zoomed)'
            },
            {
                'id': 'fhd_1080p',
                'name': '1080p Full HD',
                'width': 1920,
                'height': 1080,
                'framerate': 60,
                'description': '1920x1080 @ 60fps - Cropped from center (slightly zoomed)'
            },
            {
                'id': 'qhd_2k',
                'name': '2K QHD',
                'width': 2328,
                'height': 1748,
                'framerate': 30,
                'description': '2328x1748 @ 30fps - Full sensor width (no crop)'
            },
            {
                'id': 'uhd_4k',
                'name': '4K Ultra HD',
                'width': 3840,
                'height': 2160,
                'framerate': 18,
                'description': '3840x2160 @ 18fps - Cropped from center'
            },
            {
                'id': 'native_max',
                'name': 'Native Maximum',
                'width': 4656,
                'height': 3496,
                'framerate': 9,
                'description': '4656x3496 @ 9fps - Full native sensor (widest view)'
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
                '--nopreview'  # No preview window
            ]
            
            self.camera_process = subprocess.Popen(
                cmd, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE,  # Capture stderr to see errors
                bufsize=0
            )
            
            # Wait a moment to ensure process started successfully
            time.sleep(0.5)
            if self.camera_process.poll() is not None:
                # Process failed, capture stderr for debugging
                stderr_output = self.camera_process.stderr.read().decode('utf-8') if self.camera_process.stderr else "No error output"
                logger.error(f"Camera process failed to start or exited immediately. Error: {stderr_output}")
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
                    
                    # Store the latest frame for potential capture
                    self.latest_frame = frame
                    
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

    def capture_picture(self, output_dir):
        """Capture a picture from the current stream"""
        try:
            # Check if camera is streaming and we have a recent frame
            if not self.streaming:
                return {'success': False, 'error': 'Camera is not streaming. Start streaming first to capture pictures.'}
            
            if self.latest_frame is None:
                return {'success': False, 'error': 'No frame available for capture. Wait a moment for streaming to begin.'}
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"capture_{timestamp}.jpg"
            output_path = os.path.join(output_dir, filename)
            
            # Ensure output directory exists
            os.makedirs(output_dir, exist_ok=True)
            
            # Save the latest frame as a picture
            with open(output_path, 'wb') as f:
                f.write(self.latest_frame)
            
            # Verify file was created and get size
            if os.path.exists(output_path):
                file_size = os.path.getsize(output_path)
                logger.info(f"Picture captured from stream: {filename} ({file_size} bytes)")
                return {
                    'success': True,
                    'filename': filename,
                    'path': output_path,
                    'size': file_size,
                    'timestamp': timestamp
                }
            else:
                logger.error("Picture file was not created")
                return {'success': False, 'error': 'Picture file was not created'}
                
        except Exception as e:
            logger.error(f"Error capturing picture from stream: {e}")
            return {'success': False, 'error': str(e)}

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

@app.route('/api/camera/capture', methods=['POST'])
def capture_picture():
    """Capture a picture from the camera"""
    try:
        if not camera_stream.camera_available:
            return jsonify({'error': 'Camera not available'}), 500
        
        # Define the output directory (relative to the web app's public directory)
        # This should point to the cam-app/public/picture directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        output_dir = os.path.join(project_root, 'cam-app', 'public', 'picture')
        
        # Capture the picture
        result = camera_stream.capture_picture(output_dir)
        
        if result['success']:
            return jsonify({
                'message': 'Picture captured successfully',
                'filename': result['filename'],
                'size': result['size'],
                'timestamp': result['timestamp'],
                'url': f'/picture/{result["filename"]}'  # URL path for accessing the image
            })
        else:
            return jsonify({'error': result['error']}), 500
            
    except Exception as e:
        logger.error(f"Error in capture endpoint: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/camera/pictures')
def list_pictures():
    """List all captured pictures"""
    try:
        # Define the picture directory path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        picture_dir = os.path.join(project_root, 'cam-app', 'public', 'picture')
        
        pictures = []
        if os.path.exists(picture_dir):
            for filename in os.listdir(picture_dir):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    file_path = os.path.join(picture_dir, filename)
                    file_stats = os.stat(file_path)
                    pictures.append({
                        'filename': filename,
                        'url': f'/picture/{filename}',
                        'size': file_stats.st_size,
                        'created': file_stats.st_mtime
                    })
        
        # Sort by creation time (newest first)
        pictures.sort(key=lambda x: x['created'], reverse=True)
        
        return jsonify({'pictures': pictures})
    except Exception as e:
        logger.error(f"Error listing pictures: {e}")
        return jsonify({'error': 'Failed to list pictures'}), 500

@app.route('/picture/<filename>')
def serve_picture(filename):
    """Serve captured pictures"""
    try:
        # Define the picture directory path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        picture_dir = os.path.join(project_root, 'cam-app', 'public', 'picture')
        
        # Serve the file
        return send_from_directory(picture_dir, filename)
    except Exception as e:
        logger.error(f"Error serving picture {filename}: {e}")
        return jsonify({'error': 'Picture not found'}), 404

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
