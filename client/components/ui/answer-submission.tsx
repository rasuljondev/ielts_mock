import React, { useState, useRef } from "react";
import {
  Mic,
  Square,
  Upload,
  Trash2,
  Send,
  Loader2,
  Play,
  Pause,
  Download,
} from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { Progress } from "./progress";
import { Textarea } from "./textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/uploadUtils";

export interface AnswerSubmission {
  id: string;
  questionId: string;
  userId: string;
  type: "text" | "audio" | "image" | "file";
  content: string; // Text content or file URL
  metadata?: {
    duration?: number;
    fileSize?: number;
    recordingQuality?: string;
    uploadedAt?: string;
  };
  submittedAt: string;
  status: "draft" | "submitted" | "graded";
  score?: number;
  feedback?: string;
}

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  maxDuration?: number; // in seconds
  disabled?: boolean;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  maxDuration = 300, // 5 minutes default
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));

        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());

        onRecordingComplete(blob, recordingTime);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error(
        "Failed to start recording. Please check microphone permissions.",
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setRecordingTime(0);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Recording Controls */}
      <div className="flex items-center justify-center space-x-4">
        {!isRecording && !audioBlob && (
          <Button
            onClick={startRecording}
            disabled={disabled}
            className="px-6 py-3"
          >
            <Mic className="h-5 w-5 mr-2" />
            Start Recording
          </Button>
        )}

        {isRecording && (
          <div className="flex items-center space-x-4">
            <Button
              onClick={stopRecording}
              variant="destructive"
              className="px-6 py-3"
            >
              <Square className="h-5 w-5 mr-2" />
              Stop Recording
            </Button>

            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="font-mono text-lg">
                {formatTime(recordingTime)}
              </span>
            </div>

            <Progress
              value={(recordingTime / maxDuration) * 100}
              className="w-32 h-2"
            />
          </div>
        )}
      </div>

      {/* Playback Controls */}
      {audioBlob && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePlayback}
                  disabled={!audioUrl}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>

                <div>
                  <p className="text-sm font-medium">Recording Complete</p>
                  <p className="text-xs text-gray-500">
                    Duration: {formatTime(recordingTime)}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={deleteRecording}
                title="Delete recording"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  acceptedTypes?: string[];
  maxSizeMB?: number;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  acceptedTypes = [".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx"],
  maxSizeMB = 50,
  disabled = false,
}) => {
  const [dragActive, setDragActive] = useState(false);

  const validateFile = (file: File): boolean => {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      toast.error(`File size must be less than ${maxSizeMB}MB`);
      return false;
    }

    return true;
  };

  const handleFile = (file: File) => {
    if (validateFile(file)) {
      onFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
        dragActive ? "border-primary bg-primary/5" : "border-gray-300",
        disabled && "opacity-50 cursor-not-allowed",
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => {
        if (!disabled) {
          document.getElementById("file-upload-answer")?.click();
        }
      }}
    >
      <input
        id="file-upload-answer"
        type="file"
        accept={acceptedTypes.join(",")}
        onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        className="hidden"
        disabled={disabled}
      />

      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
      <p className="text-sm text-gray-600">
        {dragActive ? "Drop file here" : "Click to upload or drag and drop"}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Max size: {maxSizeMB}MB • Accepted: {acceptedTypes.join(", ")}
      </p>
    </div>
  );
};

interface AnswerSubmissionProps {
  questionId: string;
  userId: string;
  answerType: "text" | "audio" | "file";
  onSubmit: (submission: Partial<AnswerSubmission>) => Promise<void>;
  existingAnswer?: AnswerSubmission;
  disabled?: boolean;
  placeholder?: string;
  maxTextLength?: number;
  maxAudioDuration?: number;
  maxFileSizeMB?: number;
}

export const AnswerSubmissionComponent: React.FC<AnswerSubmissionProps> = ({
  questionId,
  userId,
  answerType,
  onSubmit,
  existingAnswer,
  disabled = false,
  placeholder = "Enter your answer here...",
  maxTextLength = 5000,
  maxAudioDuration = 300,
  maxFileSizeMB = 50,
}) => {
  const [textAnswer, setTextAnswer] = useState(existingAnswer?.content || "");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(
    existingAnswer?.content || null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraft, setIsDraft] = useState(existingAnswer?.status === "draft");

  const handleAudioRecordingComplete = async (
    audioBlob: Blob,
    duration: number,
  ) => {
    try {
      setIsSubmitting(true);
      const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, {
        type: "audio/webm",
      });

      const uploadedUrl = await uploadFile(audioFile, "audio");
      setUploadedFileUrl(uploadedUrl);

      toast.success("Audio recorded and uploaded successfully");
    } catch (error) {
      console.error("Audio upload error:", error);
      toast.error("Failed to upload audio recording");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    try {
      setIsSubmitting(true);
      setUploadedFile(file);

      const fileType = file.type.startsWith("image/") ? "image" : "image";
      const uploadedUrl = await uploadFile(file, fileType);
      setUploadedFileUrl(uploadedUrl);

      toast.success("File uploaded successfully");
    } catch (error) {
      console.error("File upload error:", error);
      toast.error("Failed to upload file");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (asDraft = false) => {
    try {
      setIsSubmitting(true);

      let content = "";
      let metadata = {};

      switch (answerType) {
        case "text":
          content = textAnswer.trim();
          if (!content) {
            toast.error("Please enter your answer");
            return;
          }
          metadata = { textLength: content.length };
          break;

        case "audio":
        case "file":
          content = uploadedFileUrl || "";
          if (!content) {
            toast.error("Please upload a file or record audio");
            return;
          }
          metadata = {
            fileSize: uploadedFile?.size,
            uploadedAt: new Date().toISOString(),
          };
          break;
      }

      const submission: Partial<AnswerSubmission> = {
        questionId,
        userId,
        type: answerType,
        content,
        metadata,
        status: asDraft ? "draft" : "submitted",
        submittedAt: new Date().toISOString(),
      };

      await onSubmit(submission);

      setIsDraft(asDraft);
      toast.success(
        asDraft ? "Answer saved as draft" : "Answer submitted successfully",
      );
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSubmissionContent = () => {
    switch (answerType) {
      case "text":
        return (
          <div className="space-y-4">
            <Textarea
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              placeholder={placeholder}
              disabled={disabled || isSubmitting}
              maxLength={maxTextLength}
              rows={8}
              className="resize-none"
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>
                {textAnswer.length}/{maxTextLength} characters
              </span>
              {textAnswer.length > maxTextLength * 0.9 && (
                <span className="text-orange-500">
                  Approaching character limit
                </span>
              )}
            </div>
          </div>
        );

      case "audio":
        return (
          <div className="space-y-4">
            <AudioRecorder
              onRecordingComplete={handleAudioRecordingComplete}
              maxDuration={maxAudioDuration}
              disabled={disabled || isSubmitting}
            />
            {uploadedFileUrl && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700">
                        Audio uploaded successfully
                      </p>
                      <p className="text-xs text-gray-500">Ready to submit</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-700"
                    >
                      Ready
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "file":
        return (
          <div className="space-y-4">
            <FileUpload
              onFileSelect={handleFileSelect}
              maxSizeMB={maxFileSizeMB}
              disabled={disabled || isSubmitting}
            />
            {uploadedFile && uploadedFileUrl && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div>
                        <p className="text-sm font-medium">
                          {uploadedFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700"
                      >
                        Uploaded
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(uploadedFileUrl, "_blank")}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Your Answer</span>
          {existingAnswer && (
            <Badge
              variant={
                existingAnswer.status === "submitted"
                  ? "default"
                  : existingAnswer.status === "graded"
                    ? "secondary"
                    : "outline"
              }
            >
              {existingAnswer.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {getSubmissionContent()}

        {/* Submission Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex space-x-2">
            <Button
              onClick={() => handleSubmit(true)}
              variant="outline"
              disabled={disabled || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Draft
            </Button>

            <Button
              onClick={() => handleSubmit(false)}
              disabled={disabled || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Answer
            </Button>
          </div>

          {existingAnswer?.status === "graded" &&
            existingAnswer.score !== undefined && (
              <div className="text-right">
                <p className="text-sm font-medium">
                  Score: {existingAnswer.score}/100
                </p>
                {existingAnswer.feedback && (
                  <p className="text-xs text-gray-600 max-w-xs">
                    {existingAnswer.feedback}
                  </p>
                )}
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
};

// Fix import
import { Save } from "lucide-react";
