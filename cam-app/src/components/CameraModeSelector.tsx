import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Settings, Monitor, Loader2 } from 'lucide-react'

interface CameraMode {
  id: string
  name: string
  width: number
  height: number
  framerate: number
  description: string
}

interface CameraModeData {
  available_modes: CameraMode[]
  current_mode: {
    width: number
    height: number
    framerate: number
    name: string
  }
}

interface CameraModeSelectorProps {
  serverUrl: string
  onModeChange?: (mode: CameraMode) => void
  disabled?: boolean
}

export function CameraModeSelector({ serverUrl, onModeChange, disabled = false }: CameraModeSelectorProps) {
  const [modes, setModes] = useState<CameraMode[]>([])
  const [currentMode, setCurrentMode] = useState<CameraMode | null>(null)
  const [selectedModeId, setSelectedModeId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isChanging, setIsChanging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch available camera modes
  const fetchModes = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${serverUrl}/api/camera/modes`)
      if (response.ok) {
        const data: CameraModeData = await response.json()
        setModes(data.available_modes)
        
        // Find the current mode from available modes
        const current = data.available_modes.find(mode => 
          mode.width === data.current_mode.width &&
          mode.height === data.current_mode.height &&
          mode.framerate === data.current_mode.framerate
        )
        
        if (current) {
          setCurrentMode(current)
          setSelectedModeId(current.id)
        }
      } else {
        setError('Failed to fetch camera modes')
      }
    } catch (err) {
      setError('Cannot connect to camera server')
    } finally {
      setIsLoading(false)
    }
  }

  // Change camera mode
  const changeMode = async (modeId: string) => {
    if (!modeId || modeId === currentMode?.id) return

    setIsChanging(true)
    setError(null)

    try {
      const response = await fetch(`${serverUrl}/api/camera/mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode_id: modeId }),
      })

      if (response.ok) {
        const data = await response.json()
        const newMode = modes.find(mode => mode.id === modeId)
        
        if (newMode) {
          setCurrentMode(newMode)
          setSelectedModeId(modeId)
          
          // Notify parent component
          if (onModeChange) {
            onModeChange(newMode)
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || 'Failed to change camera mode')
      }
    } catch (err) {
      setError('Error changing camera mode')
    } finally {
      setIsChanging(false)
    }
  }

  // Load modes on component mount
  useEffect(() => {
    fetchModes()
  }, [serverUrl])

  const getResolutionBadge = (mode: CameraMode) => {
    if (mode.width >= 3840) {
      return <Badge variant="default" className="bg-purple-600">4K+</Badge>
    } else if (mode.width >= 1920) {
      return <Badge variant="default" className="bg-blue-600">HD</Badge>
    } else {
      return <Badge variant="secondary">SD</Badge>
    }
  }

  const getFramerateBadge = (framerate: number) => {
    if (framerate >= 60) {
      return <Badge variant="default" className="bg-green-600">High FPS</Badge>
    } else if (framerate >= 30) {
      return <Badge variant="secondary">Standard</Badge>
    } else {
      return <Badge variant="outline">Low FPS</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Camera Mode
            </CardTitle>
            <CardDescription>
              Select camera resolution and frame rate
            </CardDescription>
          </div>
          {currentMode && (
            <div className="flex gap-2">
              {getResolutionBadge(currentMode)}
              {getFramerateBadge(currentMode.framerate)}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading camera modes...</span>
          </div>
        ) : (
          <>
            {/* Mode Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Resolution & Frame Rate</label>
              <Select 
                value={selectedModeId} 
                onValueChange={changeMode}
                disabled={disabled || isChanging}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select camera mode" />
                </SelectTrigger>
                <SelectContent>
                  {modes.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id}>
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <div className="font-medium">{mode.name}</div>
                          <div className="text-xs text-gray-500">
                            {mode.width}×{mode.height} @ {mode.framerate}fps
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current Mode Info */}
            {currentMode && (
              <div className="p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-start gap-3">
                  <Monitor className="w-5 h-5 mt-0.5 text-blue-600" />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{currentMode.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{currentMode.description}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>Resolution: {currentMode.width}×{currentMode.height}</span>
                      <span>Frame Rate: {currentMode.framerate} fps</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mode Change Status */}
            {isChanging && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Changing camera mode...
              </div>
            )}

            {/* Refresh Button */}
            <Button
              onClick={fetchModes}
              disabled={isLoading || isChanging || disabled}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                'Refresh Modes'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
