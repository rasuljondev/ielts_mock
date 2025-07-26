import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  Send,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  FileText,
  Flag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { enhancedSupabase, safeSupabaseOperation } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  parseError,
  logError,
  classifyError,
  retryWithBackoff,
  checkNetworkConnectivity,
} from "@/lib/errorUtils";
import { formatAndSanitizeText } from "@/lib/textFormatting";

interface TestData {
  id: string;
  title: string;
  type: string;
  duration: number;
  status: string;
  hasAccess: boolean;
  questions: Question[];
}

interface Question {
  id: string;
  type: string;
  question_text: string;
  options?: any;
  section_type: "reading";
  section_number: number;
  question_number: number;
  passage_text?: string;
  passage_title?: string;
}

interface ReadingPassage {
  number: number;
  title: string;
  text: string;
  questions: Question[];
}

const TakeReadingExam: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Test state
  const [test, setTest] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassage, setCurrentPassage] = useState(1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // Reading passages
  const [passages, setPassages] = useState<ReadingPassage[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);

  // --- Unified localStorage key for all state ---
  const localStorageKey = testId && user?.id ? `reading-test-${testId}-${user.id}` : null;

  // --- Restore from localStorage on mount ---
  useEffect(() => {
    if (!localStorageKey) return;
    const saved = localStorage.getItem(localStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.timeRemaining) setTimeRemaining(parsed.timeRemaining);
      } catch {}
    }
  }, [localStorageKey]);

  // --- Save to localStorage on every change ---
  useEffect(() => {
    if (!localStorageKey) return;
    localStorage.setItem(
      localStorageKey,
      JSON.stringify({
        answers,
        timeRemaining,
        testId,
        timestamp: Date.now(),
      })
    );
  }, [answers, timeRemaining, localStorageKey, testId]);

  // Auto-save interval
  useEffect(() => {
    if (submissionId && Object.keys(answers).length > 0) {
      const interval = setInterval(() => {
        autoSaveAnswers();
      }, 30000); // Auto-save every 30 seconds

      return () => clearInterval(interval);
    }
  }, [submissionId, answers]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining > 0 && !isSubmitting) {
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1;

          // Auto-submit when time runs out
          if (newTime <= 0) {
            handleSubmitTest();
            return 0;
          }

          // Save time to localStorage for persistence
          localStorage.setItem(`exam-time-${testId}`, newTime.toString());

          return newTime;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [timeRemaining, isSubmitting, testId]);

  // Load test data on mount
  useEffect(() => {
    if (testId) {
      loadTestData();
    }
  }, [testId]);

  const loadTestData = async () => {
    try {
      setLoading(true);

      // Check network connectivity
      const isOnline = await checkNetworkConnectivity();
      if (!isOnline) {
        throw new Error(
          "No internet connection. Please check your connection and try again.",
        );
      }

      // Check for saved time
      const savedTime = localStorage.getItem(`exam-time-${testId}`);

      // Load test information with retry
      const testData = await retryWithBackoff(
        async () => {
          const { data, error } = await supabase
            .from("tests")
            .select("*")
            .eq("id", testId)
            .single();

          if (error) throw error;
          return data;
        },
        3,
        1000,
      );

      // Load existing submission
      const { data: existingSubmission } = await supabase
        .from("test_submissions")
        .select("*")
        .eq("test_id", testId)
        .eq("student_id", user?.id)
        .single();

      if (existingSubmission) {
        if (existingSubmission.status === "completed") {
          toast.info("You have already completed this test");
          navigate("/student/tests/history");
          return;
        }

        setSubmissionId(existingSubmission.id);
        setAnswers(existingSubmission.answers || {});

        // Restore time - use saved time if available, otherwise use submission time
        const timeToUse = savedTime
          ? parseInt(savedTime)
          : existingSubmission.time_remaining_seconds || testData.duration * 60;

        setTimeRemaining(timeToUse);
      } else {
        // Create new submission
        const { data: newSubmission, error: submissionError } = await supabase
          .from("test_submissions")
          .insert({
            test_id: testId,
            student_id: user?.id,
            status: "in_progress",
            started_at: new Date().toISOString(),
            time_remaining_seconds: testData.duration * 60,
            answers: {},
          })
          .select()
          .single();

        if (submissionError) throw submissionError;

        setSubmissionId(newSubmission.id);
        setTimeRemaining(testData.duration * 60);
      }

      // Load reading sections and questions
      const { data: readingSections, error: sectionsError } = await supabase
        .from("reading_sections")
        .select(
          `
          *,
          reading_questions(*)
        `,
        )
        .eq("test_id", testId)
        .order("passage_number");

      if (sectionsError) throw sectionsError;

      // Transform data into passages
      const passageData: ReadingPassage[] = readingSections.map((section) => ({
        number: section.passage_number,
        title: section.title,
        text: section.passage_text,
        questions: (section.reading_questions || []).map((q: any) => ({
          id: q.id,
          type: q.question_type,
          question_text: q.question_text,
          options: q.options,
          section_type: "reading" as const,
          section_number: section.passage_number,
          question_number: q.question_number,
          passage_text: section.passage_text,
          passage_title: section.title,
        })),
      }));

      // Flatten all questions
      const questions = passageData.flatMap((p) => p.questions);

      setPassages(passageData);
      setAllQuestions(questions);
      setTest({
        ...testData,
        hasAccess: true,
        questions,
      });
    } catch (error: any) {
      logError("loadTestData", error);
      toast.error(`Failed to load test: ${parseError(error)}`);
      navigate("/student/tests");
    } finally {
      setLoading(false);
    }
  };

  const autoSaveAnswers = async () => {
    if (!submissionId) return;

    setAutoSaving(true);

    try {
      await enhancedSupabase.update(
        "test_submissions",
        {
          answers,
          time_remaining_seconds: timeRemaining,
          updated_at: new Date().toISOString(),
        },
        { id: submissionId },
      );
    } catch (error: any) {
      const classified = classifyError(error);

      // Only log severe errors, not network timeouts
      if (classified.type !== "network") {
        logError("autoSaveAnswers", error);

        // Show warning for critical errors
        if (classified.type === "auth" || classified.type === "permission") {
          toast.error(
            "Auto-save failed. Your session may have expired. Please save manually.",
          );
        }
      }
    } finally {
      setAutoSaving(false);
    }
  };

  const handleSubmitTest = async () => {
    if (!submissionId) {
      toast.error("No active submission found");
      return;
    }

    try {
      setIsSubmitting(true);

      // Check network connectivity
      const isOnline = await checkNetworkConnectivity();
      if (!isOnline) {
        throw new Error(
          "No internet connection. Please check your connection and try again.",
        );
      }

      // Final save with retry
      await retryWithBackoff(
        async () => {
          await autoSaveAnswers();
        },
        3,
        1000,
      );

      // Submit test with enhanced client
      await enhancedSupabase.update(
        "test_submissions",
        {
          status: "completed",
          submitted_at: new Date().toISOString(),
          answers,
        },
        { id: submissionId },
      );

      // Clear saved time
      localStorage.removeItem(`exam-time-${testId}`);
      localStorageKey && localStorage.removeItem(localStorageKey);

      toast.success("Test submitted successfully!");
      navigate("/student/tests/history");
    } catch (error: any) {
      logError("handleSubmitTest", error);
      const classified = classifyError(error);

      if (classified.retryable) {
        toast.error(
          `${classified.message} Your answers have been saved. Please try again.`,
        );
      } else {
        toast.error(
          `Failed to submit test: ${classified.message}. Please contact support.`,
        );
      }

      setIsSubmitting(false);
    }
  };

  const updateAnswer = (questionId: string, answer: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getCurrentPassageQuestions = () => {
    return passages.find((p) => p.number === currentPassage)?.questions || [];
  };

  const getCurrentQuestion = () => {
    const passageQuestions = getCurrentPassageQuestions();
    return passageQuestions[currentQuestionIndex] || null;
  };

  const navigateToQuestion = (questionIndex: number) => {
    const passageQuestions = getCurrentPassageQuestions();
    if (questionIndex >= 0 && questionIndex < passageQuestions.length) {
      setCurrentQuestionIndex(questionIndex);
    }
  };

  const switchPassage = (passageNumber: number) => {
    const passage = passages.find((p) => p.number === passageNumber);
    if (passage && passage.questions.length > 0) {
      setCurrentPassage(passageNumber);
      setCurrentQuestionIndex(0);
    }
  };

  const renderQuestionInput = (question: Question) => {
    const answer = answers[question.id];

    switch (question.type) {
      case "multiple_choice":
        return (
          <RadioGroup
            value={answer?.toString() || ""}
            onValueChange={(value) =>
              updateAnswer(question.id, parseInt(value))
            }
            className="space-y-3"
          >
            {question.options?.map((option: string, index: number) => (
              <div key={index} className="flex items-center space-x-3">
                <RadioGroupItem
                  value={index.toString()}
                  id={`${question.id}-${index}`}
                />
                <Label
                  htmlFor={`${question.id}-${index}`}
                  className="text-base leading-relaxed cursor-pointer flex-1"
                >
                  <span className="font-medium mr-2">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "true_false_not_given":
      case "yes_no_not_given":
        const options =
          question.type === "true_false_not_given"
            ? ["TRUE", "FALSE", "NOT GIVEN"]
            : ["YES", "NO", "NOT GIVEN"];

        return (
          <RadioGroup
            value={answer || ""}
            onValueChange={(value) => updateAnswer(question.id, value)}
            className="space-y-3"
          >
            {options.map((option) => (
              <div key={option} className="flex items-center space-x-3">
                <RadioGroupItem
                  value={option}
                  id={`${question.id}-${option}`}
                />
                <Label
                  htmlFor={`${question.id}-${option}`}
                  className="text-base font-medium cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "short_answer":
      case "sentence_completion":
        return (
          <Input
            value={answer || ""}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder="Type your answer here..."
            className="h-7 w-40 text-sm px-2 py-1 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500"
          />
        );

      default:
        return (
          <Textarea
            value={answer || ""}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder="Type your answer here..."
            className="min-h-[100px] text-base"
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <h2 className="text-xl font-semibold mb-2">Loading Exam...</h2>
          <p className="text-gray-600">
            Please wait while we prepare your test
          </p>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold mb-2">Test Not Found</h3>
            <p className="text-gray-600 mb-4">
              The requested test could not be loaded.
            </p>
            <Button
              onClick={() => navigate("/student/tests")}
              className="w-full"
            >
              Back to Tests
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPassageData = passages.find((p) => p.number === currentPassage);
  const passageQuestions = getCurrentPassageQuestions();
  const currentQuestion = getCurrentQuestion();
  const totalQuestions = allQuestions.length;
  const answeredQuestions = Object.keys(answers).length;

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Exam Header - Fixed */}
      <div className="bg-white border-b-2 border-gray-300 shadow-sm flex-shrink-0 z-10">
        <div className="px-3 sm:px-4 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            {/* Left: Test Info */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-gray-900">
                    {test.title}
                  </h1>
                  <p className="text-xs text-gray-600">Reading Test</p>
                </div>
              </div>
              {autoSaving && (
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <Save className="h-3 w-3 animate-pulse" />
                  <span>Auto-saving...</span>
                </div>
              )}
            </div>

            {/* Right: Timer and Controls */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Progress */}
              <div className="text-center">
                <div className="text-xs font-medium text-gray-700">
                  Questions Answered
                </div>
                <div className="text-base font-bold">
                  {answeredQuestions} / {totalQuestions}
                </div>
              </div>

              {/* Timer */}
              <div className="text-center bg-gray-50 rounded-lg px-2 py-1 border">
                <div className="text-xs font-medium text-gray-700">
                  Time Remaining
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span
                    className={`font-mono text-base font-bold ${
                      timeRemaining < 600 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 h-8"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Submit
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit Your Test</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to submit your test? You have
                      answered{" "}
                      <strong>
                        {answeredQuestions} out of {totalQuestions}
                      </strong>{" "}
                      questions. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Continue Testing</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleSubmitTest}
                      disabled={isSubmitting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Final Answers"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Split Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Reading Passage */}
        <div className="w-1/2 bg-white border-r-2 border-gray-300 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Passage Header */}
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-blue-900">
                    {currentPassageData?.title || `Passage ${currentPassage}`}
                  </h2>
                  <p className="text-sm text-blue-700">
                    {passageQuestions.length} questions
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-blue-700 border-blue-300"
                >
                  Passage {currentPassage}
                </Badge>
              </div>
            </div>

            {/* Passage Content */}
            <ScrollArea className="flex-1 p-6">
              <div className="prose prose-lg max-w-none leading-relaxed">
                {currentPassageData?.text ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: formatAndSanitizeText(currentPassageData.text),
                    }}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No passage content available</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Right Panel - Questions */}
        <div className="w-1/2 bg-gray-50 overflow-hidden">
          {/* All passage questions in a single scrollable view */}
          <ScrollArea className="h-full p-4 space-y-4">
            {passageQuestions.map((q, idx) => (
              <Card key={q.id} className={`border-2 ${answers[q.id] ? 'border-green-400' : ''} my-1 py-0`}>
                <CardContent className="p-2 flex flex-col gap-1 justify-center items-start min-h-0">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-900 text-lg">
                      {idx + 1}. {q.question_text}
                    </div>
                    <Badge
                      variant={answers[q.id] ? 'default' : 'outline'}
                      className={answers[q.id] ? 'bg-green-600' : ''}
                    >
                      {answers[q.id] ? 'Answered' : 'Not Answered'}
                    </Badge>
                  </div>
                  {renderQuestionInput(q)}
                </CardContent>
              </Card>
            ))}
            {passageQuestions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No questions available for this passage.</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Compact Bottom Navigation - Passage Selector */}
      <div className="bg-white border-t-2 border-gray-300 px-1 flex-shrink-0 h-[40px] flex items-center justify-center">
        <div className="flex items-center justify-center space-x-1 w-full">
          {passages.map((passage) => {
            const isActive = passage.number === currentPassage;
            const hasAnswers = passage.questions.some((q) => answers[q.id]);
            const allAnswered = passage.questions.every((q) => answers[q.id]);
            return (
              <Button
                key={passage.number}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={`min-w-[80px] h-8 text-xs relative px-2 py-1 ${
                  hasAnswers ? "bg-green-50 border-green-300" : ""
                } ${allAnswered ? "bg-green-100 border-green-400" : ""}`}
                onClick={() => switchPassage(passage.number)}
                disabled={passage.questions.length === 0}
              >
                Passage {passage.number}
                {allAnswered && passage.questions.length > 0 && (
                  <CheckCircle className="absolute -top-1 -right-1 w-3 h-3 text-green-600 bg-white rounded-full" />
                )}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TakeReadingExam;
