import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  RotateCcw,
  Download,
  Maximize2,
  Loader2,
} from "lucide-react";
import { Button } from "./button";
import { Slider } from "./slider";
import { Card, CardContent } from "./card";
import { Badge } from "./badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface MediaItem {
  id: string;
  url: string;
  type: "image" | "audio";
  title?: string;
  description?: string;
  duration?: number;
  size?: number;
  mimeType?: string;
}

interface AudioControlsProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onMute: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onRestart: () => void;
  onSkip: (seconds: number) => void;
}

const AudioControls: React.FC<AudioControlsProps> = ({
  isPlaying,
  isMuted,
  currentTime,
  duration,
  volume,
  onPlayPause,
  onMute,
  onSeek,
  onVolumeChange,
  onRestart,
  onSkip,
}) => {
  const formatTime = (time: number): string => {
    if (!isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          max={duration || 0}
          step={1}
          onValueChange={([value]) => onSeek(value)}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || 0)}</span>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSkip(-10)}
          title="Skip back 10 seconds"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button variant="outline" size="sm" onClick={onRestart} title="Restart">
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button onClick={onPlayPause} className="px-6">
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onSkip(10)}
          title="Skip forward 10 seconds"
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onMute}
          title="Mute/Unmute"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Volume Control */}
      <div className="flex items-center space-x-2">
        <VolumeX className="h-4 w-4 text-gray-400" />
        <Slider
          value={[volume * 100]}
          max={100}
          step={1}
          onValueChange={([value]) => onVolumeChange(value / 100)}
          className="flex-1"
        />
        <Volume2 className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
};

interface AudioPlayerProps {
  media: MediaItem;
  autoPlay?: boolean;
  showControls?: boolean;
  className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  media,
  autoPlay = false,
  showControls = true,
  className,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setError("Failed to load audio file");
      setIsLoading(false);
    };

    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [media.url]);

  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Audio play error:", err);
      toast.error("Failed to play audio");
    }
  };

  const handleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  const handleSeek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (newVolume: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = newVolume;
    setVolume(newVolume);
  };

  const handleRestart = () => {
    handleSeek(0);
  };

  const handleSkip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    handleSeek(newTime);
  };

  if (error) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center justify-center text-red-500">
          <p>Error loading audio: {error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4", className)}>
      <CardContent className="p-0">
        <audio ref={audioRef} src={media.url} preload="metadata" />

        {media.title && (
          <div className="mb-4">
            <h3 className="font-medium">{media.title}</h3>
            {media.description && (
              <p className="text-sm text-gray-600">{media.description}</p>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading audio...</span>
          </div>
        ) : showControls ? (
          <AudioControls
            audioRef={audioRef}
            isPlaying={isPlaying}
            isMuted={isMuted}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            onPlayPause={handlePlayPause}
            onMute={handleMute}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onRestart={handleRestart}
            onSkip={handleSkip}
          />
        ) : (
          <div className="flex items-center justify-center">
            <Button onClick={handlePlayPause}>
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
              <span className="ml-2">{isPlaying ? "Pause" : "Play"} Audio</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ImageViewerProps {
  media: MediaItem;
  className?: string;
  showFullscreen?: boolean;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  media,
  className,
  showFullscreen = true,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleImageLoad = () => setIsLoading(false);
  const handleImageError = () => {
    setError("Failed to load image");
    setIsLoading(false);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(media.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = media.title || "image";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Image downloaded successfully");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download image");
    }
  };

  if (error) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center justify-center text-red-500">
          <p>Error loading image: {error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-0">
        {media.title && (
          <div className="p-4 border-b">
            <h3 className="font-medium">{media.title}</h3>
            {media.description && (
              <p className="text-sm text-gray-600">{media.description}</p>
            )}
          </div>
        )}

        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading image...</span>
            </div>
          )}

          <img
            src={media.url}
            alt={media.title || "Image"}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className="w-full h-auto object-cover"
          />

          {!isLoading && (
            <div className="absolute top-2 right-2 flex space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                title="Download image"
              >
                <Download className="h-4 w-4" />
              </Button>

              {showFullscreen && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      title="View fullscreen"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                    <DialogHeader>
                      <DialogTitle>{media.title || "Image"}</DialogTitle>
                    </DialogHeader>
                    <img
                      src={media.url}
                      alt={media.title || "Image"}
                      className="w-full h-auto"
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface MediaDisplayProps {
  media: MediaItem | MediaItem[];
  className?: string;
  layout?: "grid" | "list";
  showControls?: boolean;
  showFullscreen?: boolean;
  autoPlay?: boolean;
}

export const MediaDisplay: React.FC<MediaDisplayProps> = ({
  media,
  className,
  layout = "list",
  showControls = true,
  showFullscreen = true,
  autoPlay = false,
}) => {
  const mediaItems = Array.isArray(media) ? media : [media];

  if (mediaItems.length === 0) {
    return (
      <Card className={cn("p-8", className)}>
        <div className="text-center text-gray-500">
          <p>No media available</p>
        </div>
      </Card>
    );
  }

  const gridClasses =
    layout === "grid"
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      : "space-y-4";

  return (
    <div className={cn(gridClasses, className)}>
      {mediaItems.map((item) => (
        <div key={item.id} className="relative">
          <Badge
            variant="secondary"
            className="absolute top-2 left-2 z-10 capitalize"
          >
            {item.type}
          </Badge>

          {item.type === "image" ? (
            <ImageViewer media={item} showFullscreen={showFullscreen} />
          ) : (
            <AudioPlayer
              media={item}
              autoPlay={autoPlay}
              showControls={showControls}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export { AudioPlayer, ImageViewer };
