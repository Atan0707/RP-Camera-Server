#!/usr/bin/env python3
"""
Raspberry Pi Camera Streaming Server
Provides HTTP endpoints to stream video from the Pi camera
"""

import cv2
import threading
import time
from flask import Flask, Response, jsonify
from flask_cors import CORS
import io
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend connections

class CameraStream:
    def __init__(self):
        self.camera = None
        self.frame = None
        self.last_access = time.time()
        self.lock = threading.Lock()
        self.streaming = False
        self.init_camera()

    def init_camera(self):
        """Initialize the camera"""
        try:
            # Try different camera indices (0 for USB, others for Pi camera)
            for camera_index in [0, 1, 2]:
                self.camera = cv2.VideoCapture(camera_index)
                if self.camera.isOpened():
                    # Set camera properties for better performance
                    self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    self.camera.set(cv2.CAP_PROP_FPS, 30)
                    logger.info(f"Camera initialized successfully on index {camera_index}")
                    return True
                self.camera.release()
            
            logger.error("Failed to initialize camera")
            return False
        except Exception as e:
            logger.error(f"Error initializing camera: {e}")
            return False

    def get_frame(self):
        """Capture a frame from the camera"""
        if not self.camera or not self.camera.isOpened():
            return None
            
        ret, frame = self.camera.read()
        if ret:
            self.last_access = time.time()
            return frame
        return None

    def generate_frames(self):
        """Generate frames for streaming"""
        while True:
            frame = self.get_frame()
            if frame is None:
                # If camera fails, try to reinitialize
                logger.warning("Camera frame capture failed, attempting to reinitialize...")
                self.init_camera()
                time.sleep(1)
                continue
                
            # Encode frame as JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_bytes = buffer.tobytes()
            
            # Yield frame in multipart format
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            # Small delay to control frame rate
            time.sleep(0.033)  # ~30 FPS

    def start_streaming(self):
        """Start the camera streaming"""
        if not self.streaming:
            self.streaming = True
            logger.info("Camera streaming started")

    def stop_streaming(self):
        """Stop the camera streaming"""
        if self.streaming:
            self.streaming = False
            logger.info("Camera streaming stopped")

    def cleanup(self):
        """Release camera resources"""
        if self.camera:
            self.camera.release()
            logger.info("Camera resources released")

# Global camera instance
camera_stream = CameraStream()

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
    if camera_stream.camera and camera_stream.camera.isOpened():
        return jsonify({
            'status': 'active',
            'streaming': camera_stream.streaming,
            'last_access': camera_stream.last_access
        })
    else:
        return jsonify({
            'status': 'inactive',
            'streaming': False,
            'last_access': None
        })

@app.route('/api/camera/start')
def start_camera():
    """Start camera streaming"""
    camera_stream.start_streaming()
    return jsonify({'message': 'Camera streaming started'})

@app.route('/api/camera/stop')
def stop_camera():
    """Stop camera streaming"""
    camera_stream.stop_streaming()
    return jsonify({'message': 'Camera streaming stopped'})

@app.route('/api/camera/restart')
def restart_camera():
    """Restart camera"""
    camera_stream.cleanup()
    if camera_stream.init_camera():
        return jsonify({'message': 'Camera restarted successfully'})
    else:
        return jsonify({'error': 'Failed to restart camera'}), 500

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
