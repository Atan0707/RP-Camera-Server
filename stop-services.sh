#!/bin/bash

# Cam-Web Services Stop Script
# This script stops all PM2 services

echo "🛑 Stopping Cam-Web Services..."

# Navigate to project directory
cd /home/pi/Cam-Web

# Stop all PM2 processes
echo "⏹️  Stopping PM2 processes..."
pm2 stop ecosystem.config.js 2>/dev/null || echo "No processes to stop"

# Display final status
echo "📊 Final PM2 Status:"
pm2 status

echo ""
echo "✅ Services stopped successfully!"
