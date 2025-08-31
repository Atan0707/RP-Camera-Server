module.exports = {
  apps: [
    {
      name: 'cam-web-app',
      script: '.output/server/index.mjs',
      cwd: '/home/pi/Cam-Web/cam-app',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOST: '0.0.0.0'
      },
      log_file: '/home/pi/Cam-Web/logs/cam-web-app.log',
      out_file: '/home/pi/Cam-Web/logs/cam-web-app-out.log',
      error_file: '/home/pi/Cam-Web/logs/cam-web-app-error.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'camera-stream',
      script: 'camera_stream.py',
      cwd: '/home/pi/Cam-Web/raspberrypi',
      interpreter: '/home/pi/Cam-Web/raspberrypi/myenv/bin/python',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        PYTHONPATH: '/home/pi/Cam-Web/raspberrypi',
        FLASK_ENV: 'production',
        FLASK_RUN_HOST: '0.0.0.0',
        FLASK_RUN_PORT: '5000'
      },
      env_development: {
        PYTHONPATH: '/home/pi/Cam-Web/raspberrypi',
        FLASK_ENV: 'development',
        FLASK_DEBUG: '1',
        FLASK_RUN_HOST: '0.0.0.0',
        FLASK_RUN_PORT: '5000'
      },
      log_file: '/home/pi/Cam-Web/logs/camera-stream.log',
      out_file: '/home/pi/Cam-Web/logs/camera-stream-out.log',
      error_file: '/home/pi/Cam-Web/logs/camera-stream-error.log',
      merge_logs: true,
      time: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
