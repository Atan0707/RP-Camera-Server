#!/bin/bash

# Cam-Web Services Startup Script
# This script starts both the Vite web app and camera streaming service using PM2

echo "🚀 Starting Cam-Web Services..."

# Navigate to project directory
cd /home/pi/Cam-Web

# Add yarn global bin to PATH
export PATH="$PATH:$(yarn global bin)"

# Check if PM2 is available
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 not found. Installing PM2..."
    yarn global add pm2
fi

# Stop any existing PM2 processes
echo "🛑 Stopping any existing processes..."
pm2 stop ecosystem.config.js 2>/dev/null || true
pm2 delete ecosystem.config.js 2>/dev/null || true

# Start services using ecosystem config
echo "🔄 Starting services with PM2..."
pm2 start ecosystem.config.js --env production

# Display status
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "✅ Services started successfully!"
echo ""
echo "🌐 Web App: http://localhost:3000"
echo "📷 Camera API: http://localhost:5000"
echo ""
echo "📝 Useful commands:"
echo "  pm2 status              - View service status"
echo "  pm2 logs                - View all logs"
echo "  pm2 logs cam-web-app    - View web app logs"
echo "  pm2 logs camera-stream  - View camera logs"
echo "  pm2 restart all         - Restart all services"
echo "  pm2 stop all            - Stop all services"
echo "  pm2 delete all          - Delete all services"
echo ""
