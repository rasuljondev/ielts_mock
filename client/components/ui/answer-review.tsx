import React, { useState, useRef } from "react";
import {
  Star,
  Download,
  Play,
  Pause,
  Volume2,
  FileText,
  FileImage,
  Clock,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { Textarea } from "./textarea";
import { Slider } from "./slider";
import { Label } from "./label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Separator } from "./separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AnswerSubmission } from "./answer-submission";

interface GradingCriteria {
  id: string;
  name: string;
  maxPoints: number;
  description?: string;
}

interface GradingResult {
  criteriaId: string;
  score: number;
  feedback?: string;
}

interface AnswerReviewProps {
  submission: AnswerSubmission;
  gradingCriteria?: GradingCriteria[];
  onGrade: (
    submissionId: string,
    totalScore: number,
    feedback: string,
    criteriaScores?: GradingResult[],
  ) => Promise<void>;
  onStatusChange?: (submissionId: string, status: string) => Promise<void>;
  className?: string;
  readOnly?: boolean;
}

interface AudioPlayerControlsProps {
  audioUrl: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

const AudioPlayerControls: React.FC<AudioPlayerControlsProps> = ({
  audioUrl,
  onTimeUpdate,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      const current = audio.currentTime;
      setCurrentTime(current);
      onTimeUpdate?.(current, duration);
    };

    const handleEnded = () => setIsPlaying(false);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [audioUrl, duration, onTimeUpdate]);

  const togglePlay = async () => {
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
    } catch (error) {
      console.error("Audio play error:", error);
      toast.error("Failed to play audio");
    }
  };

  const handleSeek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
  };

  const handleVolumeChange = (newVolume: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = newVolume;
    setVolume(newVolume);
  };

  const formatTime = (time: number): string => {
    if (!isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const downloadAudio = () => {
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = "audio-submission.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading audio...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Progress Bar */}
      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          max={duration || 0}
          step={1}
          onValueChange={([value]) => handleSeek(value)}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={togglePlay}>
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <div className="flex items-center space-x-2 ml-4">
            <Volume2 className="h-4 w-4 text-gray-400" />
            <Slider
              value={[volume * 100]}
              max={100}
              step={1}
              onValueChange={([value]) => handleVolumeChange(value / 100)}
              className="w-20"
            />
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={downloadAudio}>
          <Download className="h-4 w-4 mr-1" />
          Download
        </Button>
      </div>
    </div>
  );
};

const CriteriaGrading: React.FC<{
  criteria: GradingCriteria[];
  results: GradingResult[];
  onChange: (results: GradingResult[]) => void;
  readOnly?: boolean;
}> = ({ criteria, results, onChange, readOnly = false }) => {
  const updateCriteriaScore = (criteriaId: string, score: number) => {
    const newResults = results.filter((r) => r.criteriaId !== criteriaId);
    newResults.push({ criteriaId, score });
    onChange(newResults);
  };

  const updateCriteriaFeedback = (criteriaId: string, feedback: string) => {
    const newResults = results.map((r) =>
      r.criteriaId === criteriaId ? { ...r, feedback } : r,
    );
    onChange(newResults);
  };

  const getCriteriaResult = (criteriaId: string) =>
    results.find((r) => r.criteriaId === criteriaId);

  return (
    <div className="space-y-4">
      {criteria.map((criterion) => {
        const result = getCriteriaResult(criterion.id);
        return (
          <Card key={criterion.id}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{criterion.name}</h4>
                    {criterion.description && (
                      <p className="text-sm text-gray-600">
                        {criterion.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">
                    {result?.score || 0}/{criterion.maxPoints}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`score-${criterion.id}`}>
                    Score: {result?.score || 0}/{criterion.maxPoints}
                  </Label>
                  <Slider
                    id={`score-${criterion.id}`}
                    value={[result?.score || 0]}
                    max={criterion.maxPoints}
                    step={0.5}
                    onValueChange={([value]) =>
                      updateCriteriaScore(criterion.id, value)
                    }
                    disabled={readOnly}
                    className="w-full"
                  />
                </div>

                <Textarea
                  placeholder="Feedback for this criterion..."
                  value={result?.feedback || ""}
                  onChange={(e) =>
                    updateCriteriaFeedback(criterion.id, e.target.value)
                  }
                  disabled={readOnly}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export const AnswerReview: React.FC<AnswerReviewProps> = ({
  submission,
  gradingCriteria = [],
  onGrade,
  onStatusChange,
  className,
  readOnly = false,
}) => {
  const [overallScore, setOverallScore] = useState(submission.score || 0);
  const [feedback, setFeedback] = useState(submission.feedback || "");
  const [criteriaResults, setCriteriaResults] = useState<GradingResult[]>([]);
  const [isGrading, setIsGrading] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "submitted":
        return "bg-blue-100 text-blue-700";
      case "graded":
        return "bg-green-100 text-green-700";
      case "draft":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "submitted":
        return <AlertCircle className="h-4 w-4" />;
      case "graded":
        return <CheckCircle className="h-4 w-4" />;
      case "draft":
        return <Clock className="h-4 w-4" />;
      default:
        return <XCircle className="h-4 w-4" />;
    }
  };

  const calculateTotalScore = () => {
    if (gradingCriteria.length === 0) return overallScore;

    const totalPossible = gradingCriteria.reduce(
      (sum, criteria) => sum + criteria.maxPoints,
      0,
    );
    const totalEarned = criteriaResults.reduce(
      (sum, result) => sum + result.score,
      0,
    );

    return totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
  };

  const handleSubmitGrade = async () => {
    try {
      setIsGrading(true);
      const finalScore = calculateTotalScore();

      await onGrade(submission.id, finalScore, feedback, criteriaResults);
      toast.success("Grade submitted successfully");
    } catch (error) {
      console.error("Grading error:", error);
      toast.error("Failed to submit grade");
    } finally {
      setIsGrading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      await onStatusChange?.(submission.id, newStatus);
      toast.success("Status updated successfully");
    } catch (error) {
      console.error("Status update error:", error);
      toast.error("Failed to update status");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const renderSubmissionContent = () => {
    switch (submission.type) {
      case "text":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Text Answer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="whitespace-pre-wrap">{submission.content}</p>
              </div>
              {submission.metadata?.textLength && (
                <p className="text-sm text-gray-500 mt-2">
                  Length: {submission.metadata.textLength} characters
                </p>
              )}
            </CardContent>
          </Card>
        );

      case "audio":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Volume2 className="h-5 w-5 mr-2" />
                Audio Answer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AudioPlayerControls audioUrl={submission.content} />
              {submission.metadata?.fileSize && (
                <p className="text-sm text-gray-500 mt-2">
                  Size: {formatFileSize(submission.metadata.fileSize)}
                </p>
              )}
            </CardContent>
          </Card>
        );

      case "image":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileImage className="h-5 w-5 mr-2" />
                  Image Answer
                </div>
                <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      View Full Size
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                    <DialogHeader>
                      <DialogTitle>Image Submission</DialogTitle>
                    </DialogHeader>
                    <img
                      src={submission.content}
                      alt="Student submission"
                      className="w-full h-auto"
                    />
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={submission.content}
                alt="Student submission"
                className="w-full max-h-96 object-contain rounded-lg border"
              />
              {submission.metadata?.fileSize && (
                <p className="text-sm text-gray-500 mt-2">
                  Size: {formatFileSize(submission.metadata.fileSize)}
                </p>
              )}
            </CardContent>
          </Card>
        );

      default:
        return (
          <Card>
            <CardContent className="p-4">
              <p className="text-gray-500">Unknown submission type</p>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Submission Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Submission Review
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge className={getStatusColor(submission.status)}>
                {getStatusIcon(submission.status)}
                <span className="ml-1 capitalize">{submission.status}</span>
              </Badge>
              {!readOnly && (
                <Select
                  value={submission.status}
                  onValueChange={handleStatusUpdate}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="graded">Graded</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2 text-gray-500" />
              <span>
                Submitted: {new Date(submission.submittedAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center">
              <User className="h-4 w-4 mr-2 text-gray-500" />
              <span>Student ID: {submission.userId}</span>
            </div>
            <div className="flex items-center">
              <FileText className="h-4 w-4 mr-2 text-gray-500" />
              <span>Question ID: {submission.questionId}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submission Content */}
      {renderSubmissionContent()}

      {/* Grading Section */}
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Star className="h-5 w-5 mr-2" />
              Grading
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Criteria-based Grading */}
            {gradingCriteria.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium">Grading Criteria</h4>
                <CriteriaGrading
                  criteria={gradingCriteria}
                  results={criteriaResults}
                  onChange={setCriteriaResults}
                  readOnly={readOnly}
                />
              </div>
            )}

            {/* Overall Score */}
            {gradingCriteria.length === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="overall-score">
                    Overall Score: {Math.round(overallScore)}/100
                  </Label>
                  <Slider
                    id="overall-score"
                    value={[overallScore]}
                    max={100}
                    step={1}
                    onValueChange={([value]) => setOverallScore(value)}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Calculated Total Score */}
            {gradingCriteria.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Score:</span>
                  <span className="text-2xl font-bold text-primary">
                    {Math.round(calculateTotalScore())}/100
                  </span>
                </div>
              </div>
            )}

            <Separator />

            {/* Feedback */}
            <div className="space-y-2">
              <Label htmlFor="feedback">
                <MessageSquare className="h-4 w-4 inline mr-2" />
                Feedback
              </Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Provide detailed feedback for the student..."
                rows={4}
                disabled={readOnly}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSubmitGrade}
                disabled={isGrading || readOnly}
                className="px-8"
              >
                {isGrading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Submit Grade
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Existing Grade */}
      {submission.status === "graded" && submission.score !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              Grade Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <span className="font-medium">Final Score:</span>
                <span className="text-3xl font-bold text-green-600">
                  {Math.round(submission.score)}/100
                </span>
              </div>

              {submission.feedback && (
                <div className="space-y-2">
                  <h4 className="font-medium">Feedback:</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="whitespace-pre-wrap">{submission.feedback}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
