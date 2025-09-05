import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { ImageIcon, Video, Download, RefreshCw, Calendar, HardDrive } from 'lucide-react'

interface MediaFile {
  filename: string
  url: string
  size: number
  created: number
}

interface GalleryData {
  pictures: MediaFile[]
  recordings: MediaFile[]
}

const CAMERA_SERVER_URL = 'https://cam1.hrzhkm.xyz'
// const CAMERA_SERVER_URL = 'http://192.168.1.16:5000'

export function Gallery() {
  const [galleryData, setGalleryData] = useState<GalleryData>({ pictures: [], recordings: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'pictures' | 'recordings'>('pictures')

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  // Fetch gallery data
  const fetchGalleryData = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const [picturesResponse, recordingsResponse] = await Promise.all([
        fetch(`${CAMERA_SERVER_URL}/api/camera/pictures`),
        fetch(`${CAMERA_SERVER_URL}/api/camera/recordings`)
      ])

      if (picturesResponse.ok && recordingsResponse.ok) {
        const [picturesData, recordingsData] = await Promise.all([
          picturesResponse.json(),
          recordingsResponse.json()
        ])
        
        setGalleryData({
          pictures: picturesData.pictures || [],
          recordings: recordingsData.recordings || []
        })
      } else {
        setError('Failed to fetch gallery data')
      }
    } catch (err) {
      setError('Error connecting to camera server')
    } finally {
      setIsLoading(false)
    }
  }

  // Download file
  const downloadFile = (file: MediaFile) => {
    const link = document.createElement('a')
    link.href = `${CAMERA_SERVER_URL}${file.url}`
    link.download = file.filename
    link.click()
  }

  // Load gallery data on component mount
  useEffect(() => {
    fetchGalleryData()
  }, [])

  const totalFiles = galleryData.pictures.length + galleryData.recordings.length
  const totalSize = [...galleryData.pictures, ...galleryData.recordings]
    .reduce((sum, file) => sum + file.size, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Media Gallery
            </CardTitle>
            <CardDescription>
              Browse all captured images and recorded videos
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {totalFiles} files ({formatFileSize(totalSize)})
            </Badge>
            <Button
              onClick={fetchGalleryData}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'pictures' ? 'default' : 'outline'}
            onClick={() => setActiveTab('pictures')}
            className="flex items-center gap-2"
          >
            <ImageIcon className="w-4 h-4" />
            Pictures ({galleryData.pictures.length})
          </Button>
          <Button
            variant={activeTab === 'recordings' ? 'default' : 'outline'}
            onClick={() => setActiveTab('recordings')}
            className="flex items-center gap-2"
          >
            <Video className="w-4 h-4" />
            Recordings ({galleryData.recordings.length})
          </Button>
        </div>

        {/* Pictures Tab */}
        {activeTab === 'pictures' && (
          <div className="space-y-4">
            {galleryData.pictures.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No pictures available</p>
                <p className="text-sm">Take some pictures to see them here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {galleryData.pictures.map((picture) => (
                  <Card key={picture.filename} className="overflow-hidden">
                    <div className="aspect-video bg-gray-100">
                      <img
                        src={`${CAMERA_SERVER_URL}${picture.url}`}
                        alt={picture.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <CardContent className="p-3">
                      <h4 className="font-medium text-sm truncate mb-1">
                        {picture.filename}
                      </h4>
                      <div className="space-y-1 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(picture.created)}
                        </div>
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {formatFileSize(picture.size)}
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(picture)}
                          className="flex-1 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recordings Tab */}
        {activeTab === 'recordings' && (
          <div className="space-y-4">
            {galleryData.recordings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recordings available</p>
                <p className="text-sm">Record some videos to see them here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {galleryData.recordings.map((recording) => (
                  <Card key={recording.filename} className="overflow-hidden">
                    <div className="aspect-video bg-gray-100">
                      <video
                        src={`${CAMERA_SERVER_URL}${recording.url}`}
                        className="w-full h-full object-cover"
                        controls
                        preload="metadata"
                      />
                    </div>
                    <CardContent className="p-3">
                      <h4 className="font-medium text-sm truncate mb-1">
                        {recording.filename}
                      </h4>
                      <div className="space-y-1 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(recording.created)}
                        </div>
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {formatFileSize(recording.size)}
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(recording)}
                          className="flex-1 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
            <p>Loading gallery...</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
