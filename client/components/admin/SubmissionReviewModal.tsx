import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  Clock,
  Award,
  BookOpen,
  Headphones,
  PenTool,
  Save,
  Loader2,
  AlertCircle,
  Star,
  Bug,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  autoGradeSubmission,
  saveAutoGradedResults,
  GradingResult,
  QuestionResult,
  debugGradingSystem,
} from "@/lib/autoGrading";
import { supabase } from "@/lib/supabase";
import WritingGradingModal from "./WritingGradingModal";

interface TestSubmission {
  id: string;
  test_id: string;
  student_id: string;
  status: string;
  submitted_at: string;
  answers?: any;
  test: {
    title: string;
    type: string;
  };
  student: {
    first_name: string;
    last_name: string;
    email: string;
  };
  total_score?: number | null;
  reading_score?: number | null;
  listening_score?: number | null;
  writing_score?: number | null;
}

interface SubmissionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: TestSubmission | null;
  onGraded: () => void;
  gradedBy: string;
  onOpenWritingGrading: (submission: TestSubmission) => void;
}

const SubmissionReviewModal: React.FC<SubmissionReviewModalProps> = ({
  isOpen,
  onClose,
  submission,
  onGraded,
  gradedBy,
  onOpenWritingGrading,
}) => {
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualScores, setManualScores] = useState({
    reading_score: "",
    listening_score: "",
    writing_score: "",
    total_score: "",
  });
  const [feedback, setFeedback] = useState("");
  const [activeTab, setActiveTab] = useState("auto-grade");
  const [questionOverrides, setQuestionOverrides] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (isOpen && submission) {
      loadAutoGrading();
      // Load existing scores if already graded
      setManualScores({
        reading_score: submission.reading_score?.toString() || "",
        listening_score: submission.listening_score?.toString() || "",
        writing_score: submission.writing_score?.toString() || "",
        total_score: submission.total_score?.toString() || "",
      });
    }
  }, [isOpen, submission]);





  const loadAutoGrading = async () => {
    if (!submission) {
      console.error("No submission data provided to modal");
      toast.error("No active submission found. Please refresh the page and try again.");
      return;
    }

    setLoading(true);
    try {
      // First verify the submission exists in the database
      const { data: submissionCheck, error: checkError } = await supabase
        .from("test_submissions")
        .select("id, test_id, student_id, answers, status")
        .eq("id", submission.id)
        .single();

      if (checkError) {
        console.error("Submission not found in database:", checkError);
        throw new Error(`Submission not found in database: ${checkError.message}`);
      }

      if (!submissionCheck) {
        console.error("Submission data is null");
        throw new Error("Submission data is null");
      }

      const result = await autoGradeSubmission(submission.id);
      setGradingResult(result);

      // Pre-fill manual scores with auto-graded values
      setManualScores({
        reading_score: result.readingBandScore.toString(),
        listening_score: result.listeningBandScore.toString(),
        writing_score: result.writingBandScore.toString(),
        total_score: result.overallBandScore.toString(),
      });
    } catch (error: any) {
      console.error("Grading failed:", error);
      
      let errorMessage = "Grading failed";
      if (error?.message) {
        errorMessage += `: ${error.message}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGrades = async () => {
    if (!submission) return;

    setSaving(true);
    try {
      // First check what columns exist
      const { data: existingSubmission, error: fetchError } = await supabase
        .from("test_submissions")
        .select("*")
        .eq("id", submission.id)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch submission: ${fetchError.message}`);
      }

      console.log(
        "Existing submission columns:",
        Object.keys(existingSubmission || {}),
      );

      // Build update object based on existing columns
      const updateData: any = {
        status: "graded",
        graded_at: new Date().toISOString(),
        graded_by: gradedBy,
      };

      // Only add score columns if they exist
      if (existingSubmission && "reading_score" in existingSubmission) {
        updateData.reading_score = parseFloat(manualScores.reading_score) || 0;
      }
      if (existingSubmission && "listening_score" in existingSubmission) {
        updateData.listening_score =
          parseFloat(manualScores.listening_score) || 0;
      }
      if (existingSubmission && "writing_score" in existingSubmission) {
        updateData.writing_score = parseFloat(manualScores.writing_score) || 0;
      }
      if (existingSubmission && "total_score" in existingSubmission) {
        updateData.total_score = parseFloat(manualScores.total_score) || 0;
      }
      if (existingSubmission && "feedback" in existingSubmission) {
        updateData.feedback = feedback.trim() || null;
      }
      if (existingSubmission && "auto_grading_data" in existingSubmission) {
        updateData.auto_grading_data = gradingResult
          ? JSON.stringify(gradingResult)
          : null;
      }

      console.log("Update data:", updateData);

      // Save final grades
      const { error } = await supabase
        .from("test_submissions")
        .update(updateData)
        .eq("id", submission.id);

      if (error) {
        // Check if it's a column not found error
        if (
          error.message?.includes("column") &&
          error.message?.includes("does not exist")
        ) {
          throw new Error(
            "Database setup required: Please run the setup_auto_grading_system.sql file in your Supabase dashboard. The grading columns are missing from the test_submissions table.",
          );
        }
        throw error;
      }

      toast.success("Grades saved successfully!");
      onGraded();
      onClose();
    } catch (error: any) {
      console.error("Error saving grades:", error);

      // Better error message handling
      let errorMessage = "Unknown error";
      if (error?.message) {
        errorMessage = error.message;
        if (error?.code) {
          errorMessage += ` (Code: ${error.code})`;
        }
        if (error?.details) {
          errorMessage += ` - Details: ${error.details}`;
        }
        if (error?.hint) {
          errorMessage += ` - Hint: ${error.hint}`;
        }
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (error?.hint) {
        errorMessage = error.hint;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else {
        errorMessage = JSON.stringify(error, null, 2);
      }

      toast.error(`Failed to save grades: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const renderBandScore = (score: number, label: string) => (
    <div className="text-center">
      <div className="text-2xl font-bold text-blue-600">{score.toFixed(1)}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );

  const toggleQuestionCorrectness = (questionId: string) => {
    setQuestionOverrides((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const getQuestionCorrectness = (result: QuestionResult) => {
    return questionOverrides.hasOwnProperty(result.questionId)
      ? questionOverrides[result.questionId]
      : result.isCorrect;
  };

  const recalculateScoresWithOverrides = () => {
    if (!gradingResult) return;

    // Recalculate scores based on overrides
    const readingResults = gradingResult.detailedResults.filter(
      (r) => r.section === "reading",
    );
    const listeningResults = gradingResult.detailedResults.filter(
      (r) => r.section === "listening",
    );

    const readingCorrect = readingResults.filter((r) =>
      getQuestionCorrectness(r),
    ).length;
    const listeningCorrect = listeningResults.filter((r) =>
      getQuestionCorrectness(r),
    ).length;

    // Calculate new band scores
    const readingBandScore =
      readingResults.length > 0
        ? getBandScore(readingCorrect, readingResults.length, "reading")
        : 0;
    const listeningBandScore =
      listeningResults.length > 0
        ? getBandScore(listeningCorrect, listeningResults.length, "listening")
        : 0;

    const overallBandScore = calculateOverallBandScore(
      readingBandScore,
      listeningBandScore,
      gradingResult.writingBandScore,
    );

    // Update manual scores
    setManualScores({
      reading_score: readingBandScore.toString(),
      listening_score: listeningBandScore.toString(),
      writing_score: gradingResult.writingBandScore.toString(),
      total_score: overallBandScore.toString(),
    });
  };

  // Helper functions from autoGrading.ts
  const getBandScore = (
    correct: number,
    total: number,
    section: "reading" | "listening",
  ): number => {
    // Simplified band score calculation - you may want to import this from autoGrading.ts
    const percentage = (correct / total) * 100;
    if (percentage >= 90) return 9.0;
    if (percentage >= 80) return 8.0;
    if (percentage >= 70) return 7.0;
    if (percentage >= 60) return 6.0;
    if (percentage >= 50) return 5.0;
    if (percentage >= 40) return 4.0;
    if (percentage >= 30) return 3.0;
    if (percentage >= 20) return 2.0;
    return 1.0;
  };

  const calculateOverallBandScore = (
    reading: number,
    listening: number,
    writing: number,
  ): number => {
    const validBands = [reading, listening, writing].filter((band) => band > 0);
    if (validBands.length === 0) return 1.0;
    const average =
      validBands.reduce((sum, band) => sum + band, 0) / validBands.length;
    return Math.round(average * 2) / 2;
  };

  // Recalculate when overrides change
  useEffect(() => {
    recalculateScoresWithOverrides();
  }, [questionOverrides]);

  const renderQuestionResult = (result: QuestionResult, index: number) => {
    const isCorrect = getQuestionCorrectness(result);

    return (
      <motion.div
        key={result.questionId}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`p-4 border rounded-lg ${
          isCorrect
            ? "border-green-200 bg-green-50"
            : "border-red-200 bg-red-50"
        }`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {isCorrect ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <Badge variant="outline" className="text-xs">
              {result.questionType.replace("_", " ")}
            </Badge>
            {questionOverrides.hasOwnProperty(result.questionId) && (
              <Badge variant="secondary" className="text-xs">
                Manual Override
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleQuestionCorrectness(result.questionId)}
              className="text-xs h-6 px-2"
            >
              {isCorrect ? "Mark Wrong" : "Mark Correct"}
            </Button>
            <div className="text-sm font-medium">
              {isCorrect ? result.points : 0}/{result.points} pts
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <span className="font-medium text-sm">Question:</span>
            <p className="text-sm text-gray-700 mt-1">{result.questionText}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-sm">Student Answer:</span>
              <p className="text-sm mt-1 p-2 bg-white rounded border">
                {(() => {
                  // Handle different question types for student answer display
                  if (result.questionType === "matching") {
                    // For matching questions, show the student's selected answer
                    return result.userAnswer || "No answer provided";
                  } else if (result.questionType === "short_answer") {
                    // For short answers, show the student's text input
                    return result.userAnswer || "No answer provided";
                  } else if (result.questionType === "multiple_choice") {
                    // For MCQ, show the selected option
                    return result.userAnswer || "No answer provided";
                  } else {
                    // Default handling
                    return result.userAnswer || "No answer provided";
                  }
                })()}
              </p>
            </div>
            <div>
              <span className="font-medium text-sm">Correct Answer:</span>
              <p className="text-sm mt-1 p-2 bg-white rounded border">
                {(() => {
                  // Handle different question types and answer formats
                  if (result.questionType === "map_labeling") {
                    return result.correctAnswer || "No correct answer set";
                  } else if (result.questionType === "matching") {
                    // For matching questions, show the correct answer directly
                    return result.correctAnswer || "No correct answer set";
                  } else if (result.questionType === "multiple_choice") {
                    return result.correctAnswer || "No correct answer set";
                  } else if (result.questionType === "short_answer") {
                    // For short answers, display the correct answer directly
                    if (result.correctAnswer === null || result.correctAnswer === undefined) {
                      return "No correct answer set";
                    }
                    // If it's an array, take the first element, otherwise display as string
                    if (Array.isArray(result.correctAnswer)) {
                      return result.correctAnswer[0] || "No correct answer set";
                    }
                    return String(result.correctAnswer);
                  } else {
                    // Default handling
                    return Array.isArray(result.correctAnswer)
                      ? result.correctAnswer.join(", ")
                      : result.correctAnswer || "No correct answer set";
                  }
                })()}
              </p>
            </div>
          </div>

          {result.explanation && (
            <div>
              <span className="font-medium text-sm">Explanation:</span>
              <p className="text-sm text-gray-600 mt-1">{result.explanation}</p>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  if (!submission) {
    console.error("❌ SubmissionReviewModal: No submission data provided");
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              No active submission found. Please refresh the page and try again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Review Submission
          </DialogTitle>
          <DialogDescription>
            {submission.student.first_name} {submission.student.last_name} -{" "}
            {submission.test.title}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="auto-grade">Grading</TabsTrigger>
            <TabsTrigger value="detailed-review">Detailed Review</TabsTrigger>
            <TabsTrigger value="manual-override">Final Grades</TabsTrigger>
          </TabsList>

          <div className="mt-4 h-[500px]">
            <TabsContent value="auto-grade" className="h-full">
              <ScrollArea className="h-full">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      <p>Analyzing answers...</p>
                    </div>
                  </div>
                ) : gradingResult ? (
                  <div className="space-y-6">
                    {/* IELTS Band Scores */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-yellow-500" />
                          IELTS Band Scores
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          {renderBandScore(
                            gradingResult.readingBandScore,
                            "Reading",
                          )}
                          {renderBandScore(
                            gradingResult.listeningBandScore,
                            "Listening",
                          )}
                          {renderBandScore(
                            gradingResult.writingBandScore,
                            "Writing",
                          )}
                          <div className="border-l-2 border-blue-200 pl-4">
                            <div className="text-3xl font-bold text-blue-600">
                              {gradingResult.overallBandScore.toFixed(1)}
                            </div>
                            <div className="text-sm text-gray-600">
                              Overall Band
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Score Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {gradingResult.breakdown.reading.total > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <BookOpen className="h-5 w-5 text-blue-600" />
                              Reading
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold mb-2">
                              {gradingResult.breakdown.reading.correct}/
                              {gradingResult.breakdown.reading.total}
                            </div>
                            <div className="text-sm text-gray-600">
                              {gradingResult.breakdown.reading.percentage.toFixed(
                                1,
                              )}
                              % correct
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {gradingResult.breakdown.listening.total > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <Headphones className="h-5 w-5 text-purple-600" />
                              Listening
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold mb-2">
                              {gradingResult.breakdown.listening.correct}/
                              {gradingResult.breakdown.listening.total}
                            </div>
                            <div className="text-sm text-gray-600">
                              {gradingResult.breakdown.listening.percentage.toFixed(
                                1,
                              )}
                              % correct
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <PenTool className="h-5 w-5 text-green-600" />
                            Writing
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold mb-2">
                            {gradingResult.writingBandScore.toFixed(1)}
                          </div>
                          <div className="text-sm text-gray-600 mb-3">
                            Estimated Band Score
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenWritingGrading(submission)}
                            className="w-full"
                          >
                            <PenTool className="h-4 w-4 mr-2" />
                            Manual Grading
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600">
                      Grading results will appear here
                    </p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="detailed-review" className="h-full">
              <ScrollArea className="h-full">
                {gradingResult ? (
                  <div className="space-y-6">
                    {/* Reading Questions */}
                    {gradingResult.detailedResults.filter(
                      (r) => r.section === "reading",
                    ).length > 0 && (
                      <div>
                        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-blue-600" />
                          Reading Questions
                        </h3>
                        <div className="space-y-3">
                          {gradingResult.detailedResults
                            .filter((r) => r.section === "reading")
                            .map((result, index) =>
                              renderQuestionResult(result, index),
                            )}
                        </div>
                      </div>
                    )}

                    {/* Listening Questions */}
                    {gradingResult.detailedResults.filter(
                      (r) => r.section === "listening",
                    ).length > 0 && (
                      <div>
                        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                          <Headphones className="h-5 w-5 text-purple-600" />
                          Listening Questions
                        </h3>
                        <div className="space-y-3">
                          {gradingResult.detailedResults
                            .filter((r) => r.section === "listening")
                            .map((result, index) =>
                              renderQuestionResult(result, index),
                            )}
                        </div>
                      </div>
                    )}

                    {/* Writing Questions */}
                    {gradingResult.detailedResults.filter(
                      (r) => r.section === "writing",
                    ).length > 0 && (
                      <div>
                        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                          <PenTool className="h-5 w-5 text-green-600" />
                          Writing Tasks
                        </h3>
                        <div className="space-y-3">
                          {gradingResult.detailedResults
                            .filter((r) => r.section === "writing")
                            .map((result, index) =>
                              renderQuestionResult(result, index),
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600">
                      Run grading first to see detailed results
                    </p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="manual-override" className="h-full">
              <ScrollArea className="h-full">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-4">
                      Final Grade Override
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Review and adjust the auto-generated scores if needed
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="reading_score">Reading Band Score</Label>
                      <Input
                        id="reading_score"
                        type="number"
                        min="0"
                        max="9"
                        step="0.5"
                        value={manualScores.reading_score}
                        onChange={(e) =>
                          setManualScores((prev) => ({
                            ...prev,
                            reading_score: e.target.value,
                          }))
                        }
                        placeholder="0.0 - 9.0"
                      />
                    </div>

                    <div>
                      <Label htmlFor="listening_score">
                        Listening Band Score
                      </Label>
                      <Input
                        id="listening_score"
                        type="number"
                        min="0"
                        max="9"
                        step="0.5"
                        value={manualScores.listening_score}
                        onChange={(e) =>
                          setManualScores((prev) => ({
                            ...prev,
                            listening_score: e.target.value,
                          }))
                        }
                        placeholder="0.0 - 9.0"
                      />
                    </div>

                    <div>
                      <Label htmlFor="writing_score">Writing Band Score</Label>
                      <Input
                        id="writing_score"
                        type="number"
                        min="0"
                        max="9"
                        step="0.5"
                        value={manualScores.writing_score}
                        onChange={(e) =>
                          setManualScores((prev) => ({
                            ...prev,
                            writing_score: e.target.value,
                          }))
                        }
                        placeholder="0.0 - 9.0"
                      />
                    </div>

                    <div>
                      <Label htmlFor="total_score">Overall Band Score</Label>
                      <Input
                        id="total_score"
                        type="number"
                        min="0"
                        max="9"
                        step="0.5"
                        value={manualScores.total_score}
                        onChange={(e) =>
                          setManualScores((prev) => ({
                            ...prev,
                            total_score: e.target.value,
                          }))
                        }
                        placeholder="0.0 - 9.0"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="feedback">
                      Feedback for Student (Optional)
                    </Label>
                    <Textarea
                      id="feedback"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Provide constructive feedback for the student..."
                      rows={4}
                    />
                  </div>

                  {gradingResult && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <h4 className="font-medium mb-2">
                          Auto-Generated Scores
                        </h4>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            Reading: {gradingResult.readingBandScore.toFixed(1)}
                          </div>
                          <div>
                            Listening:{" "}
                            {gradingResult.listeningBandScore.toFixed(1)}
                          </div>
                          <div>
                            Writing: {gradingResult.writingBandScore.toFixed(1)}
                          </div>
                          <div>
                            Overall: {gradingResult.overallBandScore.toFixed(1)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSaveGrades} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Final Grades
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubmissionReviewModal;
