import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { Play, Square, RotateCcw, Camera, Wifi, WifiOff, ImageIcon, Download, Video, VideoOff, Circle } from 'lucide-react'
import { CameraModeSelector } from './CameraModeSelector'

interface CameraMode {
  width: number
  height: number
  framerate: number
  name: string
}

interface RecordingStatus {
  recording: boolean
  filename: string | null
  duration: number
  start_time: number | null
}

interface CameraStatus {
  status: 'active' | 'inactive'
  streaming: boolean
  last_access: number | null
  current_mode: CameraMode | null
  recording: RecordingStatus
}

const CAMERA_SERVER_URL = 'https://cam1.hrzhkm.xyz'
// const CAMERA_SERVER_URL = 'http://192.168.1.16:5000'

export function CameraStream() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isServerConnected, setIsServerConnected] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [lastCapturedImage, setLastCapturedImage] = useState<{filename: string, url: string, timestamp: string} | null>(null)
  const [captureSuccess, setCaptureSuccess] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [lastRecording, setLastRecording] = useState<{filename: string, url: string, duration: number} | null>(null)
  const [recordingSuccess, setRecordingSuccess] = useState<string | null>(null)
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
        
        // Update recording state from server status
        if (status.recording) {
          setIsRecording(status.recording.recording)
          setRecordingDuration(status.recording.duration || 0)
        }
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

  // Capture a picture
  const capturePicture = async () => {
    setIsCapturing(true)
    setError(null)
    setCaptureSuccess(null)
    
    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/camera/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const result = await response.json()
        setLastCapturedImage({
          filename: result.filename,
          url: result.url,
          timestamp: result.timestamp
        })
        setCaptureSuccess(`Picture captured: ${result.filename}`)
        
        // Clear success message after 5 seconds
        setTimeout(() => setCaptureSuccess(null), 5000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || 'Failed to capture picture')
      }
    } catch (err) {
      setError('Error capturing picture. Make sure the camera server is running.')
    } finally {
      setIsCapturing(false)
    }
  }

  // Start recording
  const startRecording = async () => {
    setError(null)
    setRecordingSuccess(null)
    
    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/camera/recording/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      })
      
      if (response.ok) {
        const result = await response.json()
        setIsRecording(true)
        setRecordingDuration(0)
        setRecordingSuccess(`Recording started: ${result.filename}`)
        
        // Clear success message after 3 seconds
        setTimeout(() => setRecordingSuccess(null), 3000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || 'Failed to start recording')
      }
    } catch (err) {
      setError('Error starting recording. Make sure the camera server is running.')
    }
  }

  // Stop recording
  const stopRecording = async () => {
    setError(null)
    setRecordingSuccess(null)
    
    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/camera/recording/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      })
      
      if (response.ok) {
        const result = await response.json()
        setIsRecording(false)
        setRecordingDuration(0)
        setLastRecording({
          filename: result.filename,
          url: result.url,
          duration: result.duration
        })
        setRecordingSuccess(`Recording saved: ${result.filename} (${result.duration.toFixed(1)}s)`)
        
        // Clear success message after 5 seconds
        setTimeout(() => setRecordingSuccess(null), 5000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || 'Failed to stop recording')
      }
    } catch (err) {
      setError('Error stopping recording. Make sure the camera server is running.')
    }
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

  // Update recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRecording])

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

  const getRecordingBadge = () => {
    if (isRecording) {
      return <Badge variant="default" className="flex items-center gap-1 bg-red-600 animate-pulse">
        <Circle className="w-2 h-2 fill-current" />
        Recording
      </Badge>
    }
    
    return <Badge variant="outline" className="flex items-center gap-1">
      <VideoOff className="w-3 h-3" />
      Not Recording
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
              {getRecordingBadge()}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {captureSuccess && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <AlertDescription>{captureSuccess}</AlertDescription>
            </Alert>
          )}
          
          {recordingSuccess && (
            <Alert className="border-blue-200 bg-blue-50 text-blue-800">
              <AlertDescription>{recordingSuccess}</AlertDescription>
            </Alert>
          )}
          
          {!isStreaming && isServerConnected && cameraStatus?.status === 'active' && (
            <Alert className="border-blue-200 bg-blue-50 text-blue-800">
              <AlertDescription>
                <strong>💡 Tip:</strong> Start streaming first to enable picture capture. Pictures are taken from the live stream.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Video Stream Display */}
          <div className="relative bg-gray-100 rounded-lg overflow-hidden">
            {isStreaming ? (
              <img
                ref={imgRef}
                alt="Camera Stream"
                className="w-full h-auto object-contain max-h-[70vh]"
                onError={handleImageError}
                onLoad={handleImageLoad}
              />
            ) : (
              <div className="flex items-center justify-center min-h-[300px] text-gray-500">
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

            <Button 
              onClick={capturePicture}
              disabled={isCapturing || !isServerConnected || !cameraStatus?.status || !isStreaming}
              variant="secondary"
              className="flex items-center gap-2"
              title={!isStreaming ? "Start streaming first to take pictures" : "Take a picture from the current stream"}
            >
              <ImageIcon className="w-4 h-4" />
              {isCapturing ? 'Capturing...' : 'Take Picture'}
            </Button>

            {!isRecording ? (
              <Button 
                onClick={startRecording}
                disabled={!isServerConnected || !cameraStatus?.status}
                variant="outline"
                className="flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
              >
                <Video className="w-4 h-4" />
                Start Recording
              </Button>
            ) : (
              <Button 
                onClick={stopRecording}
                variant="outline"
                className="flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
              >
                <Square className="w-4 h-4" />
                Stop Recording ({Math.floor(recordingDuration)}s)
              </Button>
            )}
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

          {/* Last Captured Image */}
          {lastCapturedImage && (
            <div className="pt-4 border-t">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Last Captured Image
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-shrink-0">
                    <img
                      src={`${CAMERA_SERVER_URL}${lastCapturedImage.url}`}
                      alt="Last captured"
                      className="w-40 h-30 object-cover rounded border"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Filename:</span> {lastCapturedImage.filename}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Captured:</span> {new Date(lastCapturedImage.timestamp.replace(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')).toLocaleString()}
                    </p>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = `${CAMERA_SERVER_URL}${lastCapturedImage.url}`;
                        link.download = lastCapturedImage.filename;
                        link.click();
                      }}
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Last Recorded Video */}
          {lastRecording && (
            <div className="pt-4 border-t">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Video className="w-5 h-5" />
                Last Recorded Video
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-shrink-0">
                    <video
                      src={`${CAMERA_SERVER_URL}${lastRecording.url}`}
                      controls
                      className="w-60 h-40 object-cover rounded border"
                      preload="metadata"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Filename:</span> {lastRecording.filename}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Duration:</span> {lastRecording.duration.toFixed(1)} seconds
                    </p>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = `${CAMERA_SERVER_URL}${lastRecording.url}`;
                        link.download = lastRecording.filename;
                        link.click();
                      }}
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </Button>
                  </div>
                </div>
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
