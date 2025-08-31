#!/bin/bash

# Raspberry Pi Camera Server Startup Script

echo "Starting Raspberry Pi Camera Server..."

# Navigate to the raspberrypi directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "myenv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv myenv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source myenv/bin/activate

# Install requirements
echo "Installing requirements..."
pip install -r requirement.txt

# Start the camera server
echo "Starting camera server on port 5000..."
python3 camera_stream.py
