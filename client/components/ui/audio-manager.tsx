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
  Upload,
  Trash2,
  Loader2,
  Mic,
  Square,
  Save,
} from "lucide-react";
import { Button } from "./button";
import { Slider } from "./slider";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { Progress } from "./progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/uploadUtils";

export interface AudioFile {
  id: string;
  url: string;
  name: string;
  duration?: number;
  size?: number;
  uploaded: boolean;
  uploadProgress?: number;
}

interface AudioManagerProps {
  files: AudioFile[];
  onUpload?: (files: AudioFile[]) => void;
  onRemove?: (fileId: string) => void;
  allowUpload?: boolean;
  allowRecording?: boolean;
  allowMultiple?: boolean;
  maxFileSizeMB?: number;
  className?: string;
  title?: string;
  compact?: boolean;
}

export const AudioManager: React.FC<AudioManagerProps> = ({
  files,
  onUpload,
  onRemove,
  allowUpload = true,
  allowRecording = false,
  allowMultiple = true,
  maxFileSizeMB = 100,
  className,
  title = "Audio Manager",
  compact = false,
}) => {
  const [uploading, setUploading] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle file upload
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    if (!allowMultiple && selectedFiles.length > 1) {
      toast.error("Only one file is allowed");
      return;
    }

    for (const file of selectedFiles) {
      if (!file.type.startsWith("audio/")) {
        toast.error(`${file.name} is not an audio file`);
        continue;
      }

      if (file.size > maxFileSizeMB * 1024 * 1024) {
        toast.error(`${file.name} exceeds ${maxFileSizeMB}MB limit`);
        continue;
      }

      const fileId = Date.now().toString() + Math.random().toString(36);
      const tempAudioFile: AudioFile = {
        id: fileId,
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        uploaded: false,
        uploadProgress: 0,
      };

      // Add to uploading list
      setUploading((prev) => [...prev, fileId]);

      try {
        // Upload the file
        const uploadedUrl = await uploadFile(file, "audio");

        const finalAudioFile: AudioFile = {
          ...tempAudioFile,
          url: uploadedUrl,
          uploaded: true,
          uploadProgress: 100,
        };

        // Get duration using audio element
        const audio = new Audio(uploadedUrl);
        audio.addEventListener("loadedmetadata", () => {
          finalAudioFile.duration = audio.duration;
          onUpload?.([finalAudioFile]);
        });

        setUploading((prev) => prev.filter((id) => id !== fileId));
        toast.success(`${file.name} uploaded successfully`);
      } catch (error: any) {
        console.error("Upload error:", error);
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
        setUploading((prev) => prev.filter((id) => id !== fileId));
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], `recording-${Date.now()}.webm`, {
          type: "audio/webm",
        });

        // Handle like uploaded file
        const fileId = Date.now().toString();
        setUploading((prev) => [...prev, fileId]);

        try {
          const uploadedUrl = await uploadFile(file, "audio");

          const audioFile: AudioFile = {
            id: fileId,
            url: uploadedUrl,
            name: file.name,
            size: file.size,
            duration: recordingTime,
            uploaded: true,
          };

          onUpload?.([audioFile]);
          setUploading((prev) => prev.filter((id) => id !== fileId));
          toast.success("Recording saved successfully");
        } catch (error: any) {
          toast.error(`Failed to save recording: ${error.message}`);
          setUploading((prev) => prev.filter((id) => id !== fileId));
        }

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error("Failed to access microphone");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Download file
  const downloadFile = (file: AudioFile) => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2">
          {allowUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple={allowMultiple}
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </Button>
            </>
          )}

          {allowRecording && (
            <Button
              size="sm"
              variant={recording ? "destructive" : "outline"}
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? (
                <>
                  <Square className="h-4 w-4 mr-1" />
                  Stop ({formatTime(recordingTime)})
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-1" />
                  Record
                </>
              )}
            </Button>
          )}
        </div>

        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded"
              >
                <span className="text-sm truncate flex-1">{file.name}</span>
                {file.duration && (
                  <Badge variant="secondary" className="text-xs">
                    {formatTime(Math.floor(file.duration))}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadFile(file)}
                >
                  <Download className="h-3 w-3" />
                </Button>
                {onRemove && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemove(file.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Controls */}
        <div className="flex items-center gap-2">
          {allowUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple={allowMultiple}
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading.length > 0}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Audio
              </Button>
            </>
          )}

          {allowRecording && (
            <Button
              variant={recording ? "destructive" : "outline"}
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Stop Recording ({formatTime(recordingTime)})
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>
          )}
        </div>

        {/* Uploading Progress */}
        {uploading.length > 0 && (
          <div className="space-y-2">
            {uploading.map((fileId) => (
              <div key={fileId} className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Uploading...</span>
              </div>
            ))}
          </div>
        )}

        {/* Audio Files List */}
        {files.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Audio Files ({files.length})</h4>
            {files.map((file) => (
              <AudioFileItem
                key={file.id}
                file={file}
                isPlaying={currentlyPlaying === file.id}
                onPlayChange={(playing) =>
                  setCurrentlyPlaying(playing ? file.id : null)
                }
                onDownload={() => downloadFile(file)}
                onRemove={onRemove ? () => onRemove(file.id) : undefined}
              />
            ))}
          </div>
        )}

        {files.length === 0 && uploading.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Volume2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No audio files yet</p>
            <p className="text-xs">Upload or record audio to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Individual audio file component with playback controls
interface AudioFileItemProps {
  file: AudioFile;
  isPlaying: boolean;
  onPlayChange: (playing: boolean) => void;
  onDownload: () => void;
  onRemove?: () => void;
}

const AudioFileItem: React.FC<AudioFileItemProps> = ({
  file,
  isPlaying,
  onPlayChange,
  onDownload,
  onRemove,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => onPlayChange(false);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      onPlayChange(false);
    } else {
      audioRef.current.play();
      onPlayChange(true);
    }
  };

  const formatTime = (time: number): string => {
    if (!isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="p-4">
      <div className="space-y-3">
        {/* File Info */}
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-medium text-sm">{file.name}</h5>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {file.size && (
                <span>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
              )}
              {file.duration && <span>{formatTime(file.duration)}</span>}
              {file.uploaded && (
                <Badge variant="outline" className="text-xs">
                  Uploaded
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onDownload}>
              <Download className="h-4 w-4" />
            </Button>
            {onRemove && (
              <Button size="sm" variant="ghost" onClick={onRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Slider
            value={[currentTime]}
            max={duration || 0}
            step={1}
            onValueChange={([value]) => {
              if (audioRef.current) {
                audioRef.current.currentTime = value;
                setCurrentTime(value);
              }
            }}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={togglePlay}>
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.muted = !muted;
                  setMuted(!muted);
                }
              }}
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Slider
              value={[muted ? 0 : volume]}
              max={1}
              step={0.1}
              onValueChange={([value]) => {
                setVolume(value);
                if (audioRef.current) {
                  audioRef.current.volume = value;
                }
              }}
              className="w-16"
            />
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={file.url}
        preload="metadata"
        volume={volume}
        muted={muted}
      />
    </Card>
  );
};

export default AudioManager;
