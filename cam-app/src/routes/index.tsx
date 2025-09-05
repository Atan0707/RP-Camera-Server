import { createFileRoute } from '@tanstack/react-router'
import { CameraStream } from '../components/CameraStream'
import { Gallery } from '../components/Gallery'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Raspberry Pi Camera Web
          </h1>
          <p className="text-lg text-gray-600">
            Live video streaming from your Raspberry Pi camera
          </p>
        </div>
        
        <CameraStream />
        
        {/* Media Gallery */}
        <div className="mt-8">
          <Gallery />
        </div>
        
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Make sure your camera server is running on port 5000</p>
          <p className="mt-1">
            Run: <code className="bg-gray-200 px-2 py-1 rounded">python3 raspberrypi/camera_stream.py</code>
          </p>
        </div>
      </div>
    </div>
  )
}
