import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { Play, Square, RotateCcw, Camera, Wifi, WifiOff } from 'lucide-react'
import { CameraModeSelector } from './CameraModeSelector'

interface CameraMode {
  width: number
  height: number
  framerate: number
  name: string
}

interface CameraStatus {
  status: 'active' | 'inactive'
  streaming: boolean
  last_access: number | null
  current_mode: CameraMode | null
}

const CAMERA_SERVER_URL = 'https://cam1.hrzhkm.xyz'
// const CAMERA_SERVER_URL = 'http://192.168.1.16:5000'

export function CameraStream() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isServerConnected, setIsServerConnected] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // Check server connection and camera status
  const checkStatus = async () => {
    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/camera/status`)
      if (response.ok) {
        const status = await response.json()
        setCameraStatus(status)
        setIsServerConnected(true)
        setError(null)
      } else {
        setIsServerConnected(false)
        setError('Camera server not responding')
      }
    } catch (err) {
      setIsServerConnected(false)
      setError('Cannot connect to camera server. Make sure it\'s running on port 5000.')
    }
  }

  // Start camera streaming
  const startStreaming = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/camera/start`)
      if (response.ok) {
        setIsStreaming(true)
        // Wait a moment for camera to initialize before starting stream
        setTimeout(() => {
          if (imgRef.current) {
            imgRef.current.src = `${CAMERA_SERVER_URL}/api/stream?t=${Date.now()}`
          }
          // Check status after a short delay to ensure camera is ready
          setTimeout(checkStatus, 2000)
        }, 1000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || 'Failed to start camera streaming')
      }
    } catch (err) {
      setError('Error starting camera stream. Make sure the camera server is running.')
    } finally {
      setIsLoading(false)
    }
  }

  // Stop camera streaming
  const stopStreaming = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/camera/stop`)
      if (response.ok) {
        setIsStreaming(false)
        // Clear the image source
        if (imgRef.current) {
          imgRef.current.src = ''
        }
      } else {
        setError('Failed to stop camera streaming')
      }
    } catch (err) {
      setError('Error stopping camera stream')
    } finally {
      setIsLoading(false)
    }
  }

  // Restart camera
  const restartCamera = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/camera/restart`)
      if (response.ok) {
        await checkStatus()
        if (isStreaming) {
          // Restart streaming if it was active
          setTimeout(() => {
            if (imgRef.current) {
              imgRef.current.src = `${CAMERA_SERVER_URL}/api/stream?t=${Date.now()}`
            }
          }, 1000)
        }
      } else {
        setError('Failed to restart camera')
      }
    } catch (err) {
      setError('Error restarting camera')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle image load error
  const handleImageError = () => {
    console.log('Camera stream failed to load, retrying...')
    // Don't immediately show error, try to reload the stream once
    if (imgRef.current && isStreaming) {
      setTimeout(() => {
        if (imgRef.current && isStreaming) {
          imgRef.current.src = `${CAMERA_SERVER_URL}/api/stream?t=${Date.now()}`
        }
      }, 2000)
    } else {
      setError('Failed to load camera stream. Try restarting the camera.')
      setIsStreaming(false)
    }
  }

  // Handle image load success
  const handleImageLoad = () => {
    setError(null)
  }

  // Handle camera mode change
  const handleModeChange = async () => {
    // Refresh camera status to get updated mode info
    await checkStatus()
    
    // If streaming, restart the stream with new settings
    if (isStreaming) {
      if (imgRef.current) {
        // Add timestamp to force reload with new mode
        imgRef.current.src = `${CAMERA_SERVER_URL}/api/stream?t=${Date.now()}`
      }
    }
  }

  // Check status on component mount and periodically
  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const getStatusBadge = () => {
    if (!isServerConnected) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <WifiOff className="w-3 h-3" />
        Disconnected
      </Badge>
    }
    
    if (cameraStatus?.status === 'active') {
      return <Badge variant="default" className="flex items-center gap-1 bg-green-600">
        <Camera className="w-3 h-3" />
        Active
      </Badge>
    }
    
    return <Badge variant="secondary" className="flex items-center gap-1">
      <Camera className="w-3 h-3" />
      Inactive
    </Badge>
  }

  const getStreamingBadge = () => {
    if (isStreaming) {
      return <Badge variant="default" className="flex items-center gap-1 bg-blue-600">
        <Wifi className="w-3 h-3" />
        Streaming
      </Badge>
    }
    
    return <Badge variant="outline" className="flex items-center gap-1">
      <Square className="w-3 h-3" />
      Stopped
    </Badge>
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Raspberry Pi Camera Stream
              </CardTitle>
              <CardDescription>
                Live video feed from your Raspberry Pi camera
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {getStatusBadge()}
              {getStreamingBadge()}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Video Stream Display */}
          <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
            {isStreaming ? (
              <img
                ref={imgRef}
                alt="Camera Stream"
                className="w-full h-full object-cover"
                onError={handleImageError}
                onLoad={handleImageLoad}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Camera className="w-16 h-16 mx-auto mb-2 opacity-50" />
                  <p>Camera stream not active</p>
                  <p className="text-sm">Click "Start Stream" to begin</p>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2 flex-wrap">
            {!isStreaming ? (
              <Button 
                onClick={startStreaming} 
                disabled={isLoading || !isServerConnected}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {isLoading ? 'Starting...' : 'Start Stream'}
              </Button>
            ) : (
              <Button 
                onClick={stopStreaming} 
                disabled={isLoading}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                {isLoading ? 'Stopping...' : 'Stop Stream'}
              </Button>
            )}
            
            <Button 
              onClick={restartCamera}
              disabled={isLoading || !isServerConnected}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {isLoading ? 'Restarting...' : 'Restart Camera'}
            </Button>

            <Button 
              onClick={checkStatus}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Wifi className="w-4 h-4" />
              Refresh Status
            </Button>
          </div>

          {/* Status Information */}
          {cameraStatus && isServerConnected && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-sm font-medium">Camera Status</p>
                <p className="text-lg font-bold text-green-600">
                  {cameraStatus.status === 'active' ? 'Active' : 'Inactive'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Streaming</p>
                <p className="text-lg font-bold text-blue-600">
                  {cameraStatus.streaming ? 'Yes' : 'No'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Current Mode</p>
                <p className="text-sm font-bold text-purple-600">
                  {cameraStatus.current_mode ? cameraStatus.current_mode.name : 'Unknown'}
                </p>
                {cameraStatus.current_mode && (
                  <p className="text-xs text-gray-500">
                    {cameraStatus.current_mode.width}×{cameraStatus.current_mode.height} @ {cameraStatus.current_mode.framerate}fps
                  </p>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Last Access</p>
                <p className="text-sm text-gray-600">
                  {cameraStatus.last_access 
                    ? new Date(cameraStatus.last_access * 1000).toLocaleTimeString()
                    : 'Never'
                  }
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Camera Mode Selector */}
      <CameraModeSelector 
        serverUrl={CAMERA_SERVER_URL}
        onModeChange={handleModeChange}
        disabled={!isServerConnected || isLoading}
      />
    </div>
  )
}
