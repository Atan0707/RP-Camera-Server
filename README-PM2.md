# Cam-Web PM2 Deployment Guide

Your Vite app and Python camera script are now successfully configured to run with PM2! 🎉

## Current Status

✅ **PM2 Installed**: Process manager for both services  
✅ **Vite App Built**: Production build ready  
✅ **Services Running**: Both cam-web-app and camera-stream are online  
✅ **Auto-startup**: Services will restart automatically on system reboot  

## Service Information

| Service | Port | Status | Description |
|---------|------|--------|-------------|
| **cam-web-app** | 3000 | 🟢 Online | Vite React app (TanStack Start) |
| **camera-stream** | 5000 | 🟢 Online | Python Flask camera API |

## Quick Commands

### Start/Stop Services
```bash
# Start all services
./start-services.sh

# Stop all services  
./stop-services.sh

# Restart specific service
pm2 restart cam-web-app
pm2 restart camera-stream
```

### Monitor Services
```bash
# View status
pm2 status

# View logs (all services)
pm2 logs

# View logs (specific service)
pm2 logs cam-web-app
pm2 logs camera-stream

# Real-time monitoring
pm2 monit
```

### Management Commands
```bash
# Save current process list
pm2 save

# Reload all services
pm2 reload all

# Delete all services
pm2 delete all

# View detailed info
pm2 describe cam-web-app
```

## Access Your Applications

- **Web App**: http://localhost:3000 or http://YOUR_PI_IP:3000
- **Camera API**: http://localhost:5000 or http://YOUR_PI_IP:5000
- **Health Check**: http://localhost:5000/health

## File Locations

- **Ecosystem Config**: `/home/pi/Cam-Web/ecosystem.config.js`
- **Logs Directory**: `/home/pi/Cam-Web/logs/`
- **PM2 Config**: `/home/pi/.pm2/`

## Auto-Startup

Services are configured to automatically start on system boot via systemd:
- Service file: `/etc/systemd/system/pm2-pi.service`
- Enabled: ✅ (runs on boot)

## Troubleshooting

### If services don't start:
```bash
# Check PM2 status
pm2 status

# Restart services
pm2 restart all

# View error logs
pm2 logs --err
```

### If web app not accessible:
1. Check if port 3000 is open: `netstat -tulpn | grep :3000`
2. Check firewall: `sudo ufw status`
3. Verify build: `ls -la /home/pi/Cam-Web/cam-app/.output/`

### If camera not working:
1. Check camera connection: `rpicam-hello --list-cameras`
2. Check Python environment: `source /home/pi/Cam-Web/raspberrypi/myenv/bin/activate`
3. Test camera API: `curl http://localhost:5000/health`

## Development Mode

To run in development mode instead:
```bash
# Stop production services
pm2 stop all

# Run Vite in dev mode
cd /home/pi/Cam-Web/cam-app
yarn dev

# Run camera script directly (in another terminal)
cd /home/pi/Cam-Web/raspberrypi
source myenv/bin/activate
python camera_stream.py
```

## Rebuilding for Production

When you make changes to your Vite app:
```bash
cd /home/pi/Cam-Web/cam-app
yarn build
pm2 restart cam-web-app
```

---

🎯 **Your services are now production-ready and will automatically restart on system reboot!**
