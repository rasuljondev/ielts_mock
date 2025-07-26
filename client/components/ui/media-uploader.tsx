import React, { useState, useCallback } from "react";
import {
  Upload,
  X,
  Play,
  Pause,
  Volume2,
  FileImage,
  Loader2,
} from "lucide-react";
import { Button } from "./button";
import { Progress } from "./progress";
import { Card, CardContent } from "./card";
import { Badge } from "./badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/uploadUtils";

export interface MediaFile {
  id: string;
  file: File;
  url: string;
  type: "image" | "audio";
  name: string;
  size: number;
  uploadProgress?: number;
  uploaded: boolean;
}

interface MediaUploaderProps {
  /**
   * Array of accepted file types (e.g., ['.mp3', '.wav', '.jpg', '.png'])
   */
  acceptedTypes?: string[];
  /**
   * Maximum file size in MB
   */
  maxSizeMB?: number;
  /**
   * Whether to allow multiple files
   */
  multiple?: boolean;
  /**
   * Media type to accept
   */
  mediaType?: "image" | "audio" | "both";
  /**
   * Callback when files are uploaded successfully
   */
  onUpload?: (files: MediaFile[]) => void;
  /**
   * Callback when files are removed
   */
  onRemove?: (fileId: string) => void;
  /**
   * Initial files to display
   */
  initialFiles?: MediaFile[];
  /**
   * Custom className
   */
  className?: string;
  /**
   * Disabled state
   */
  disabled?: boolean;
}

const AudioPlayer: React.FC<{ file: MediaFile }> = ({ file }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(() => new Audio(file.url));

  React.useEffect(() => {
    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
    };
  }, [audio]);

  const togglePlay = () => {
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={togglePlay}
      className="flex items-center gap-2"
    >
      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      <Volume2 className="h-4 w-4" />
    </Button>
  );
};

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  acceptedTypes,
  maxSizeMB = 100,
  multiple = false,
  mediaType = "both",
  onUpload,
  onRemove,
  initialFiles = [],
  className,
  disabled = false,
}) => {
  const [files, setFiles] = useState<MediaFile[]>(initialFiles);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Generate accepted file types based on mediaType
  const getAcceptedTypes = (): string => {
    if (acceptedTypes) {
      return acceptedTypes.join(",");
    }

    switch (mediaType) {
      case "image":
        return ".jpg,.jpeg,.png,.gif,.webp,.svg";
      case "audio":
        return ".mp3,.wav,.m4a,.aac,.ogg";
      case "both":
        return ".jpg,.jpeg,.png,.gif,.webp,.svg,.mp3,.wav,.m4a,.aac,.ogg";
      default:
        return "*";
    }
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      return {
        valid: false,
        error: `File size must be less than ${maxSizeMB}MB`,
      };
    }

    // Check file type
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    if (mediaType === "image" && !fileType.startsWith("image/")) {
      return { valid: false, error: "Only image files are allowed" };
    }

    if (mediaType === "audio" && !fileType.startsWith("audio/")) {
      return { valid: false, error: "Only audio files are allowed" };
    }

    return { valid: true };
  };

  const handleFiles = async (fileList: FileList) => {
    if (disabled) return;

    const filesToProcess = Array.from(fileList);

    if (!multiple && filesToProcess.length > 1) {
      toast.error("Only one file is allowed");
      return;
    }

    if (!multiple && files.length > 0) {
      toast.error("Please remove the existing file first");
      return;
    }

    for (const file of filesToProcess) {
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(`${file.name}: ${validation.error}`);
        continue;
      }

      const fileId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
      const mediaType = file.type.startsWith("image/") ? "image" : "audio";

      const mediaFile: MediaFile = {
        id: fileId,
        file,
        url: URL.createObjectURL(file),
        type: mediaType,
        name: file.name,
        size: file.size,
        uploadProgress: 0,
        uploaded: false,
      };

      setFiles((prev) => [...prev, mediaFile]);
      setUploading((prev) => [...prev, fileId]);

      // Upload file
      try {
        const uploadedUrl = await uploadFile(file, mediaType);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, url: uploadedUrl, uploaded: true, uploadProgress: 100 }
              : f,
          ),
        );

        setUploading((prev) => prev.filter((id) => id !== fileId));

        // Call onUpload callback
        const updatedFile = { ...mediaFile, url: uploadedUrl, uploaded: true };
        onUpload?.([updatedFile]);

        toast.success(`${file.name} uploaded successfully`);
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(`Failed to upload ${file.name}`);

        // Remove failed file
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        setUploading((prev) => prev.filter((id) => id !== fileId));
      }
    }
  };

  const removeFile = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (file && file.url.startsWith("blob:")) {
      URL.revokeObjectURL(file.url);
    }

    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setUploading((prev) => prev.filter((id) => id !== fileId));
    onRemove?.(fileId);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Upload Area */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-gray-300",
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:border-primary cursor-pointer",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => {
          if (!disabled) {
            document.getElementById("file-upload-input")?.click();
          }
        }}
      >
        <input
          id="file-upload-input"
          type="file"
          accept={getAcceptedTypes()}
          multiple={multiple}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center justify-center text-center">
          <Upload className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">
            {dragActive ? "Drop files here" : "Choose files or drag and drop"}
          </p>
          <p className="text-sm text-gray-600 mb-4">
            {mediaType === "image" && "Images only"}
            {mediaType === "audio" && "Audio files only"}
            {mediaType === "both" && "Images and audio files"}
            {maxSizeMB && ` • Max size: ${maxSizeMB}MB`}
          </p>
          <Button variant="outline" disabled={disabled}>
            Browse Files
          </Button>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-3">
          {files.map((file) => (
            <Card key={file.id} className="p-4">
              <CardContent className="p-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex-shrink-0">
                      {file.type === "image" ? (
                        <div className="relative">
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                          <FileImage className="absolute top-0 right-0 h-4 w-4 text-blue-500 bg-white rounded-full p-0.5" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                          <Volume2 className="h-6 w-6 text-gray-600" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.size)}
                      </p>

                      {uploading.includes(file.id) && (
                        <div className="mt-2">
                          <Progress
                            value={file.uploadProgress || 0}
                            className="h-2"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {file.uploaded && (
                      <Badge
                        variant="secondary"
                        className="text-green-700 bg-green-100"
                      >
                        Uploaded
                      </Badge>
                    )}

                    {uploading.includes(file.id) && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}

                    {file.type === "audio" && file.uploaded && (
                      <AudioPlayer file={file} />
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.id);
                      }}
                      disabled={uploading.includes(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
