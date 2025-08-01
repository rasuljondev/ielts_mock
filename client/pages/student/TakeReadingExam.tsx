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
import { markSectionCompleted, isAllSectionsCompleted } from "@/lib/testProgressUtils";
import { parseContentForStudent } from "@/lib/contentParser";
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
  correct_answer?: any; // Added for matching questions
}

interface ReadingPassage {
  number: number;
  title: string;
  text: string;
  passage_text?: string; // Passage text from database
  content?: string; // Content with embedded questions
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
    if (submissionId && Object.keys(answers).length > 0 && !isSubmitting) {
      const interval = setInterval(() => {
        autoSaveAnswers();
      }, 30000); // Auto-save every 30 seconds

      return () => clearInterval(interval);
    }
  }, [submissionId, answers, isSubmitting]);

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

  // Cleanup effect to prevent state updates during navigation
  useEffect(() => {
    return () => {
      // Cleanup function to prevent state updates after unmount
      setIsSubmitting(true);
    };
  }, []);

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



      // Load test data if not already loaded
      let currentTestData = test;
      if (!currentTestData && testId) {
        const { data: testData, error } = await supabase
          .from("tests")
          .select("*")
          .eq("id", testId)
          .single();
        
        if (error) {
          console.error("Error loading test data:", error);
          return;
        }
        currentTestData = testData;
      }

      // Load existing submission
      const { data: existingSubmission } = await supabase
        .from("test_submissions")
        .select("*")
        .eq("test_id", testId)
        .eq("student_id", user?.id)
        .single();

      if (existingSubmission) {
        // Check if this is a full test and if the reading section is already completed
        if (currentTestData?.type?.toLowerCase() === "full") {
          // For full tests, check if reading section is completed
          const completedSections = existingSubmission.completed_sections || [];
          if (completedSections.includes('reading')) {
            toast.info("You have already completed the reading section");
            navigate(`/student/test/${testId}`);
            return;
          }
        } else {
          // For single tests, check if entire test is completed
          if (existingSubmission.status === "submitted" || existingSubmission.status === "completed") {
            toast.info("You have already completed this test");
            navigate("/student/tests/history");
            return;
          }
        }

        setSubmissionId(existingSubmission.id);
        setAnswers(existingSubmission.answers || {});

        // Restore time - use saved time if available, otherwise use submission time
        const testType = currentTestData?.type?.toLowerCase();
        const isCombinedTest = testType === "full";
        const defaultTime = isCombinedTest ? 60 * 60 : currentTestData.duration * 60; // 60 minutes for combined tests
        
        const timeToUse = savedTime
          ? parseInt(savedTime)
          : existingSubmission.time_remaining_seconds || defaultTime;

        setTimeRemaining(timeToUse);
      } else {
        // Create new submission
        const testType = currentTestData?.type?.toLowerCase();
        const isCombinedTest = testType === "full";
        const defaultTime = isCombinedTest ? 60 * 60 : currentTestData.duration * 60; // 60 minutes for combined tests
        
        const { data: newSubmission, error: submissionError } = await supabase
          .from("test_submissions")
          .insert({
            test_id: testId,
            student_id: user?.id,
            status: "in_progress",
            time_remaining_seconds: defaultTime,
            answers: {},
          })
          .select()
          .single();

        if (submissionError) throw submissionError;

        setSubmissionId(newSubmission.id);
        setTimeRemaining(defaultTime);
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
      const passageData: ReadingPassage[] = readingSections.map((section) => {
        // Debug: Log each section being processed
        console.log("🔍 Processing section:", {
          passage_number: section.passage_number,
          title: section.title,
          questions_count: section.reading_questions?.length || 0,
          questions: section.reading_questions?.map((q: any) => ({
            id: q.id,
            type: q.question_type,
            question_number: q.question_number,
            question_text: q.question_text?.substring(0, 30) + "..."
          })) || []
        });

        return {
          number: section.passage_number,
          title: section.title,
          text: section.passage_text,
          passage_text: section.passage_text,
          content: (() => {
            if (typeof section.content === 'string') {
              try {
                return JSON.parse(section.content);
              } catch (error) {
                console.warn(`Failed to parse content for section ${section.id}:`, section.content);
                return section.content; // Return as string if parsing fails
              }
            }
            return section.content;
          })(), // Include the content field with embedded questions
          questions: (section.reading_questions || []).map((q: any) => {

            
            return {
              id: q.id,
              type: q.question_type,
              question_text: q.question_text,
              options: (() => {
                if (typeof q.options === 'string') {
                  try {
                    return JSON.parse(q.options);
                  } catch (error) {
                    console.warn(`Failed to parse options for question ${q.id}:`, q.options);
                    return q.options; // Return as string if parsing fails
                  }
                }
                return q.options;
              })(),
              correct_answer: (() => {
                if (typeof q.correct_answer === 'string') {
                  try {
                    return JSON.parse(q.correct_answer);
                  } catch (error) {
                    console.warn(`Failed to parse correct_answer for question ${q.id}:`, q.correct_answer);
                    return q.correct_answer; // Return as string if parsing fails
                  }
                }
                return q.correct_answer;
              })(),
              section_type: "reading" as const,
              section_number: section.passage_number,
              question_number: q.question_number,
              passage_text: section.passage_text,
              passage_title: section.title,
            };
          }),
        };
      });



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
      console.error("❌ Error in loadTestData:", error);
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

      // Get existing submission to merge answers
      const { data: currentSubmission } = await supabase
        .from("test_submissions")
        .select("answers")
        .eq("id", submissionId)
        .single();

      // Submit test with enhanced client - update existing submission
      await enhancedSupabase.update(
        "test_submissions",
        {
          status: "submitted",
          submitted_at: new Date().toISOString(),
          answers: {
            ...(currentSubmission?.answers || {}), // Keep existing answers from other sections
            ...answers // Add reading answers
          },
        },
        { id: submissionId },
      );

      // Mark reading section as completed
      if (user?.id && testId) {
        await markSectionCompleted(testId, user.id, 'reading');
        
        // Check if all sections are completed and trigger auto-grading
        const { triggerAutoGrading, isAllSectionsCompleted } = await import('@/lib/testProgressUtils');
        const isAllCompleted = await isAllSectionsCompleted(testId, user.id);
        if (isAllCompleted) {
          await triggerAutoGrading(submissionId);
        }
      }

      // Clear saved time
      localStorage.removeItem(`exam-time-${testId}`);
      localStorageKey && localStorage.removeItem(localStorageKey);

      // Set submitting to false before navigation to prevent DOM updates
      setIsSubmitting(false);
      
      // Check if this is part of a combined test
      const testType = test?.type?.toLowerCase();
      const isCombinedTest = testType === "full";
      
      // Use setTimeout to ensure all state updates are complete before navigation
      setTimeout(() => {
        toast.success("Test submitted successfully!");
        
        if (isCombinedTest) {
          // For combined tests, redirect back to test start page
          toast.info("Reading section completed! Continue with remaining sections.");
          navigate(`/student/test/${testId}`);
        } else {
          // For single section tests, redirect to history
          navigate("/student/tests/history");
        }
      }, 100);
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
    const currentPassageData = passages.find((p) => p.number === currentPassage);
    const questions = currentPassageData?.questions || [];

    // Debug: Log what questions are being returned
    console.log("🔍 getCurrentPassageQuestions for passage:", currentPassage, {
      foundPassage: !!currentPassageData,
      questionsCount: questions.length,
      questions: questions.map(q => ({
        id: q.id,
        type: q.type,
        question_number: q.question_number,
        section_number: q.section_number
      }))
    });

    return questions;
  };

  const currentPassageData = passages.find((p) => p.number === currentPassage);

  const getCurrentQuestion = () => {
    const questions = getCurrentPassageQuestions();
    const question = questions[currentQuestionIndex];

    return question;
  };

  const navigateToQuestion = (questionIndex: number) => {
    const passageQuestions = getCurrentPassageQuestions();
    if (questionIndex >= 0 && questionIndex < passageQuestions.length) {
      setCurrentQuestionIndex(questionIndex);
    }
  };

  const switchPassage = (passageNumber: number) => {
    const passage = passages.find((p) => p.number === passageNumber);
    console.log("🔍 Switching to passage:", passageNumber, {
      foundPassage: !!passage,
      questionsCount: passage?.questions?.length || 0,
      questions: passage?.questions?.map(q => ({
        id: q.id,
        type: q.type,
        question_number: q.question_number,
        question_text: q.question_text?.substring(0, 30) + "..."
      })) || []
    });
    
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
            {Array.isArray(question.options) && question.options.map((option: string, index: number) => (
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

      case "matching":

        // Handle matching questions
        let matchingData = null;
        try {
          // Try to parse options first (contains left and right arrays)
          matchingData = typeof question.options === "string" 
            ? JSON.parse(question.options) 
            : question.options;
          
          // If options is empty or invalid, try correct_answer
          if (!matchingData || (!matchingData.left && !matchingData.right)) {
            matchingData = typeof question.correct_answer === "string" 
              ? JSON.parse(question.correct_answer) 
              : question.correct_answer;
          }
        } catch (error) {
          console.error("Error parsing matching data:", error);
          matchingData = { left: [], right: [] };
        }

        const leftItems = Array.isArray(matchingData?.left) ? matchingData.left : [];
        const rightItems = Array.isArray(matchingData?.right) ? matchingData.right : [];

        return (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-3">
              Match each item with the correct answer.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Items:</h4>
                {leftItems.map((item: string, itemIndex: number) => (
                  <div key={itemIndex} className="mb-2 p-2 bg-gray-50 rounded">
                    {itemIndex + 1}. {item}
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Your answers:</h4>
                {leftItems.map((_: any, itemIndex: number) => (
                  <select
                    key={itemIndex}
                    value={answers[`${question.id}_${itemIndex}`] || ""}
                    onChange={(e) => updateAnswer(`${question.id}_${itemIndex}`, e.target.value)}
                    className="w-full mb-2 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select answer</option>
                    {rightItems.map((option: string, optIndex: number) => (
                      <option key={optIndex} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          </div>
        );

      case "multiple_selection":
        // Handle multiple selection questions
        let msData = null;
        try {
          msData = typeof question.options === "string" 
            ? JSON.parse(question.options) 
            : question.options;
        } catch (error) {
          console.error("Error parsing ms data:", error);
          msData = { options: [] };
        }

        const msOptions = Array.isArray(msData?.options) ? msData.options : [];
        const currentAnswers = answers[question.id] || [];
        
        // Get the number of correct answers to limit selections
        let correctAnswerCount = 0;
        try {
          const correctAnswers = typeof question.correct_answer === 'string' 
            ? JSON.parse(question.correct_answer) 
            : question.correct_answer;
          correctAnswerCount = Array.isArray(correctAnswers) ? correctAnswers.length : 0;
        } catch (error) {
          console.error("Error parsing correct answers:", error);
          correctAnswerCount = 0;
        }
        
        // Debug logging (commented out to prevent console spam)
        // console.log("🔍 MS Question Input Debug:", {
        //   questionId: question.id,
        //   questionType: question.type,
        //   options: question.options,
        //   parsedOptions: msOptions,
        //   currentAnswers,
        //   correctAnswerCount,
        //   hasQuestionId: !!question.id
        // });
        
        return (
          <div className="space-y-2">
            {msOptions.map((option: string, optionIndex: number) => (
              <label key={optionIndex} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentAnswers.includes(option)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      // Only allow selection if under the limit
                      if (currentAnswers.length < correctAnswerCount) {
                        const newAnswers = [...currentAnswers, option];
                        updateAnswer(question.id, newAnswers);
                      }
                    } else {
                      // Always allow deselection
                      const newAnswers = currentAnswers.filter(a => a !== option);
                      updateAnswer(question.id, newAnswers);
                    }
                  }}
                  disabled={!currentAnswers.includes(option) && currentAnswers.length >= correctAnswerCount}
                  className="mr-2"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case "short_answer":
      case "sentence_completion":

        // Check if the question text contains [answer X] pattern
        if (question.question_text && question.question_text.includes('[') && question.question_text.includes(']')) {

          return renderLineWithBlanks(question.question_text, 0);
        }
        
        // Regular short answer input
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



  // Function to render content with embedded questions (like listening test)
  const renderContentWithEmbeddedQuestions = (content: any) => {
    // For reading tests, we need to embed questions inline within the text
    if (!content) return null;

    // If content is a string, treat it as passage text and embed questions
    if (typeof content === "string") {
      return renderPassageWithEmbeddedQuestions(content);
    }

    // If content is an object (TipTap format), render it directly
    if (typeof content === "object" && content !== null) {
      return renderTipTapContent(content);
    }

    return <p>No content available</p>;
  };

  // Function to render TipTap content with embedded questions
  const renderTipTapContent = (content: any) => {
    if (!content || !content.content) return null;

    return (
      <div className="space-y-4">
        {content.content.map((node: any, index: number) => renderNode(node, index))}
      </div>
    );
  };

  // Function to render individual TipTap nodes
  const renderNode = (node: any, index: number): React.ReactNode => {
    if (!node) return null;

    switch (node.type) {
      case "doc":
        return (
          <div key={index} className="space-y-4">
            {node.content?.map((child: any, childIndex: number) =>
              renderNode(child, childIndex)
            )}
          </div>
        );

      case "paragraph":
        return (
          <div key={index} className="mb-4 text-lg leading-relaxed">
            {node.content?.map((child: any, childIndex: number) =>
              renderNode(child, childIndex)
            )}
          </div>
        );

      case "text":
        return <span key={index}>{node.text}</span>;

      case "bold":
        return (
          <strong key={index} className="font-bold">
            {node.content?.map((child: any, childIndex: number) =>
              renderNode(child, childIndex)
            )}
          </strong>
        );

      case "italic":
        return (
          <em key={index} className="italic">
            {node.content?.map((child: any, childIndex: number) =>
              renderNode(child, childIndex)
            )}
          </em>
        );

      case "hardBreak":
        return <br key={index} />;

      case "heading":
        const level = node.attrs?.level || 1;
        const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
        return (
          <HeadingTag key={index} className="mb-4 font-bold">
            {node.content?.map((child: any, childIndex: number) =>
              renderNode(child, childIndex)
            )}
          </HeadingTag>
        );

      case "bulletList":
        return (
          <ul key={index} className="list-disc list-inside mb-4 space-y-2">
            {node.content?.map((child: any, childIndex: number) =>
              renderNode(child, childIndex)
            )}
          </ul>
        );

      case "orderedList":
        return (
          <ol key={index} className="list-decimal list-inside mb-4 space-y-2">
            {node.content?.map((child: any, childIndex: number) =>
              renderNode(child, childIndex)
            )}
          </ol>
        );

      case "listItem":
        return (
          <li key={index} className="text-lg">
            {node.content?.map((child: any, childIndex: number) =>
              renderNode(child, childIndex)
            )}
          </li>
        );

      // Custom TipTap nodes for questions
      case "short_answer":
        // Must match question_number, type, AND section_number (current passage)
        const shortAnswerQuestion = passages.flatMap(p => p.questions).find(
          (q: any) => q.question_number === (node.attrs?.question_number || node.attrs?.number) && 
                      q.type === "short_answer" && 
                      q.section_number === currentPassage
        );
        const questionId = shortAnswerQuestion?.id;
        
        return (
          <input
            key={index}
            type="text"
            value={questionId ? (answers[questionId] || "") : ""}
            onChange={questionId ? (e) => updateAnswer(questionId, e.target.value) : undefined}
            placeholder={node.attrs?.placeholder || `Answer ${node.attrs?.question_number}`}
            className="inline-block w-20 h-7 border border-gray-300 rounded bg-white text-center text-sm font-medium shadow-sm focus:outline-none focus:border-blue-500 focus:shadow-md mx-1"
            disabled={!questionId}
          />
        );

      case "mcq":
        // Must match question_number, type, AND section_number (current passage)
        const mcqQuestion = passages.flatMap(p => p.questions).find(
          (q: any) => q.question_number === (node.attrs?.question_number || node.attrs?.number) && 
                      q.type === "multiple_choice" && 
                      q.section_number === currentPassage
        );
        const mcqQuestionId = mcqQuestion?.id;
        const options = node.attrs?.options || [];
        
        return (
          <div key={index} className="mb-4">
            <p className="font-medium mb-2">
              {(node.attrs?.question_number || node.attrs?.number)}. {node.attrs?.question_text}
            </p>
            <div className="space-y-1">
              {options.map((option: string, optionIndex: number) => (
                <label key={optionIndex} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name={`mcq_${mcqQuestionId}`}
                    value={option}
                    checked={mcqQuestionId ? answers[mcqQuestionId] === option : false}
                    onChange={mcqQuestionId ? (e) => updateAnswer(mcqQuestionId, e.target.value) : undefined}
                    className="mr-2"
                    disabled={!mcqQuestionId}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case "matching":
        // Must match question_number, type, AND section_number (current passage)
        const matchingQuestion = passages.flatMap(p => p.questions).find(
          (q: any) => q.question_number === (node.attrs?.question_number || node.attrs?.number) && 
                      q.type === "matching" && 
                      q.section_number === currentPassage
        );
        const matchingQuestionId = matchingQuestion?.id;
        const leftItems = node.attrs?.left || [];
        const rightItems = node.attrs?.right || [];
        
        return (
          <div key={index} className="mb-4">
            <div className="mb-3 text-sm text-gray-600">
              Match each item with the correct answer.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Items:</h4>
                {leftItems.map((item: string, itemIndex: number) => (
                  <div key={itemIndex} className="mb-2 p-2 bg-gray-50 rounded">
                    {(node.attrs?.question_number || node.attrs?.number) + itemIndex}. {item}
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Your answers:</h4>
                {leftItems.map((_: any, itemIndex: number) => (
                  <select
                    key={itemIndex}
                    value={matchingQuestionId ? (answers[`${matchingQuestionId}_${itemIndex}`] || "") : ""}
                    onChange={matchingQuestionId ? (e) => updateAnswer(`${matchingQuestionId}_${itemIndex}`, e.target.value) : undefined}
                    className="w-full mb-2 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!matchingQuestionId}
                  >
                    <option value="">Select answer</option>
                    {rightItems.map((option: string, optIndex: number) => (
                      <option key={optIndex} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          </div>
        );

      case "ms":
        // Must match question_number, type, AND section_number (current passage)
        const msQuestion = passages.flatMap(p => p.questions).find(
          (q: any) => q.question_number === (node.attrs?.question_number || node.attrs?.number) && 
                      q.type === "multiple_selection" && 
                      q.section_number === currentPassage
        );
        const msQuestionId = msQuestion?.id;
        const msOptions = node.attrs?.options || [];
        const currentAnswers = msQuestionId ? (answers[msQuestionId] || []) : [];
        
        // Get the number of correct answers to limit selections
        let correctAnswerCount = 0;
        if (msQuestion) {
          try {
            const correctAnswers = typeof msQuestion.correct_answer === 'string' 
              ? JSON.parse(msQuestion.correct_answer) 
              : msQuestion.correct_answer;
            correctAnswerCount = Array.isArray(correctAnswers) ? correctAnswers.length : 0;
          } catch (error) {
            console.error("Error parsing correct answers:", error);
            correctAnswerCount = 0;
          }
        }
        
        // Debug logging (commented out to prevent console spam)
        // console.log("🔍 MS Question Debug:", {
        //   nodeAttrs: node.attrs,
        //   questionNumber: node.attrs?.number,
        //   question_number: node.attrs?.question_number,
        //   number: node.attrs?.number,
        //   currentPassage,
        //   foundQuestion: msQuestion,
        //   msQuestionId,
        //   msOptions,
        //   currentAnswers,
        //   correctAnswerCount,
        //   allQuestions: passages.flatMap(p => p.questions).map(q => ({
        //     id: q.id,
        //     type: q.type,
        //     question_number: q.question_number,
        //     section_number: q.section_number
        //   }))
        // });
        
        return (
          <div key={index} className="mb-4">
            <div className="space-y-2">
              {msOptions.map((option: string, optionIndex: number) => (
                <label key={optionIndex} className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentAnswers.includes(option)}
                    onChange={(e) => {
                      if (msQuestionId) {
                        if (e.target.checked) {
                          // Only allow selection if under the limit
                          if (currentAnswers.length < correctAnswerCount) {
                            const newAnswers = [...currentAnswers, option];
                            updateAnswer(msQuestionId, newAnswers);
                          }
                        } else {
                          // Always allow deselection
                          const newAnswers = currentAnswers.filter(a => a !== option);
                          updateAnswer(msQuestionId, newAnswers);
                        }
                      }
                    }}
                    disabled={!msQuestionId || (!currentAnswers.includes(option) && currentAnswers.length >= correctAnswerCount)}
                    className="mr-2"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        );

      default:
        // For any other node types, try to render their content
        if (node.content) {
          return (
            <div key={index}>
              {node.content.map((child: any, childIndex: number) =>
                renderNode(child, childIndex)
              )}
            </div>
          );
        }
        return null;
    }
  };

  // Function to render passage text with embedded questions
  const renderPassageWithEmbeddedQuestions = (passageText: string) => {
    if (!passageText) return null;

    // Split the passage into lines
    const lines = passageText.split('\n').filter(line => line.trim());
    const elements: React.ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
      if (!line.trim()) {
        elements.push(<br key={lineIndex} />);
        return;
      }

      // Check for question patterns in the line
      if (line.match(/^\d+\./)) {
        // MCQ or Matching question
        const questionMatch = line.match(/^(\d+)\. (.+)/);
        if (questionMatch) {
          const questionNum = parseInt(questionMatch[1]);
          const questionText = questionMatch[2];
          // Search across all passages for the matching question
          const question = passages.flatMap(p => p.questions).find(
            (q) => q.question_number === questionNum && q.section_number === currentPassage,
          );

          if (question && question.type === "multiple_choice") {
            elements.push(renderInlineMCQ(question, questionText, lineIndex));
            // Skip the next few lines (MCQ options) to avoid duplicates
            const optionsCount = question.options && Array.isArray(question.options) ? question.options.length : 0;
            // Skip the options lines that follow
            for (let i = 0; i < optionsCount; i++) {
              // Skip the next line (the option text)
              lineIndex++;
            }
            return;
          } else if (question && question.type === "matching") {
            // For matching questions, just show the left items without extra text
            if (question.options) {
              try {
                const options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
                if (options.left && options.right) {
                  elements.push(renderInlineMatching(question, questionText, lineIndex));
                  return;
                }
              } catch (e) {
                console.error("Error parsing matching options:", e);
              }
            }
          }
        }
      }

      // Skip option lines (A), B), C), etc.) to avoid duplicates
      if (line.match(/^[A-Z]\)/)) {
        return; // Skip this line as it's already handled by the MCQ rendering
      }

      // Check for [ ... ] placeholders for short answer questions
      if (line.includes("[") && line.includes("]")) {
        elements.push(renderLineWithBlanks(line, lineIndex));
        return;
      }

      // Handle different formatting
      if (line.includes("<strong>") || line.includes("<b>")) {
        // Bold text
        const boldContent = line.replace(/<\/?(?:strong|b)>/g, "");
        elements.push(
          <p key={lineIndex} className="font-bold">
            {boldContent}
          </p>,
        );
      } else if (line.includes("<h")) {
        // Heading
        const headingContent = line.replace(/<\/?h[1-6][^>]*>/g, "");
        elements.push(
          <h3 key={lineIndex} className="text-xl font-semibold mb-2">
            {headingContent}
          </h3>,
        );
      } else {
        // Regular line
        elements.push(<p key={lineIndex}>{line}</p>);
      }
    });

    return <div className="space-y-4">{elements}</div>;
  };

  // Function to render inline MCQ questions
  const renderInlineMCQ = (question: any, questionText: string, key: number) => {
    const options = question.options && Array.isArray(question.options) ? question.options : [];
    const questionNumber = question.question_number || key + 1;

    return (
      <div key={question.id} className="my-4">
        <div className="mb-2 font-medium">
          {questionNumber}. {questionText}
        </div>
        <div className="space-y-1">
          {options.map((option: string, optIndex: number) => (
            <label key={`${question.id}-${optIndex}`} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name={`question_${question.id}`}
                value={option}
                checked={answers[question.id] === option}
                onChange={(e) => updateAnswer(question.id, e.target.value)}
                className="mr-2"
              />
              <span>
                {String.fromCharCode(65 + optIndex)}) {option}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  // Function to render inline matching questions
  const renderInlineMatching = (question: any, questionText: string, key: number) => {
    let leftItems: string[] = [];
    let rightItems: string[] = [];

    // Parse matching data from question options or correct_answer
    if (question.options) {
      try {
        const options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
        if (options.left && options.right) {
          leftItems = options.left;
          rightItems = options.right;
        }
      } catch (e) {
        console.error("Error parsing matching options:", e);
      }
    }

    return (
      <div key={question.id} className="my-4">
        <div className="space-y-4">
          <div className="text-sm text-gray-600 mb-3">
            Match each item with the correct answer.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Items:</h4>
              {leftItems.map((item: string, itemIndex: number) => (
                <div key={`${question.id}-item-${itemIndex}`} className="mb-2 p-2 bg-gray-50 rounded">
                  {question.question_number + itemIndex}. {item}
                </div>
              ))}
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Your answers:</h4>
              {leftItems.map((_: any, itemIndex: number) => (
                <select
                  key={`${question.id}-select-${itemIndex}`}
                  value={answers[`${question.id}_${itemIndex}`] || ""}
                  onChange={(e) => updateAnswer(`${question.id}_${itemIndex}`, e.target.value)}
                  className="w-full mb-2 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select answer</option>
                  {rightItems.map((option: string, optIndex: number) => (
                    <option key={`${question.id}-option-${optIndex}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Function to render line with blanks (for short answer questions)
  const renderLineWithBlanks = (line: string, key: number) => {
    // Remove &nbsp; from the line
    const cleanLine = line.replace(/&nbsp;/g, ' ');
    // Split by [ ... ]
    const parts = cleanLine.split(/(\[.*?\])/);
    
    return (
      <div key={key} className="leading-relaxed mb-2 text-lg">
        {parts.map((part: string, partIndex: number) => {
          if (part.startsWith("[") && part.endsWith("]")) {
            // Extract the number inside the brackets (allow spaces)
            const match = part.match(/\[\s*(\d+)\s*\]/);
            const questionNumber = match ? parseInt(match[1], 10) : undefined;
            let questionId: string | undefined = undefined;
            let isShortAnswer = false;
            
            if (questionNumber && passages) {
              // Only use DB ID, do not fallback
              const q = passages.flatMap(p => p.questions).find(
                q => q.question_number === questionNumber && 
                     q.type === "short_answer" && 
                     q.section_number === currentPassage
              );
              if (q) {
                questionId = q.id;
                isShortAnswer = true;
              }
            }
            
            return (
              <input
                key={partIndex}
                type="text"
                value={questionId ? (answers[questionId] || "") : ""}
                onChange={questionId ? (e) => updateAnswer(questionId!, e.target.value) : undefined}
                className="inline-block w-20 h-7 border border-gray-300 rounded bg-white text-center font-medium shadow-sm focus:outline-none focus:border-blue-500 focus:shadow-md mx-1"
                placeholder={isShortAnswer ? String(questionNumber) : "Not a short answer"}
                disabled={!isShortAnswer}
              />
            );
          }
          return <span key={partIndex}>{part}</span>;
        })}
      </div>
    );
  };

  // Helper function to extract text from TipTap content
  const extractTextFromTipTap = (content: any): string => {
    if (!content || !content.content) return "";
    
    let text = "";
    
    const processNode = (node: any) => {
      if (node.type === 'text') {
        text += node.text || "";
      } else if (node.type === 'paragraph') {
        if (node.content) {
          node.content.forEach(processNode);
        }
        text += "\n\n";
      } else if (node.type === 'heading') {
        if (node.content) {
          node.content.forEach(processNode);
        }
        text += "\n\n";
      } else if (node.content) {
        node.content.forEach(processNode);
      }
    };
    
    content.content.forEach(processNode);
    return text.trim();
  };

  // Function to render parsed TipTap content - simplified for reading
  const renderParsedContent = (parsedContent: any) => {
    // For reading tests, we don't need to render parsed content with embedded questions
    // Just extract the text and display it
    if (!parsedContent || !parsedContent.content) return null;

    const textContent = extractTextFromTipTap(parsedContent);
    
    return (
      <div className="prose prose-lg max-w-none leading-relaxed">
        <div
          dangerouslySetInnerHTML={{
            __html: formatAndSanitizeText(textContent),
          }}
        />
      </div>
    );
  };

  // Function to render content from database (like listening test)
  const renderContent = (content: any) => {
    console.log("🔍 renderContent called with:", {
      contentType: typeof content,
      contentLength: content?.length || 0,
      hasQuestions: currentPassageData?.questions?.length || 0,
      content: content,
    });

    // Safety check - ensure content is not null/undefined
    if (!content) {
      console.warn("⚠️ Content is null or undefined");
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">
            No content available for this test.
          </p>
        </div>
      );
    }

    // Priority 1: If we have HTML content, render it with embedded input fields
    if (
      content &&
      typeof content === "string" &&
      content.includes &&
      content.includes("<") &&
      content.includes(">")
    ) {
      console.log("Rendering HTML content with embedded questions");
      return renderContentWithEmbeddedQuestions(content);
    }

    // Priority 2: If we have plain text content, render it
    if (
      content &&
      typeof content === "string" &&
      content.trim() !== "" &&
      !content.startsWith("{")
    ) {
      console.log("Rendering plain text content");
      return renderContentWithEmbeddedQuestions(content);
    }

    // Priority 3: If no content but we have questions, try to reconstruct from context
    if (
      !content ||
      content === "" ||
      content === "No content available"
    ) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">
            No content available for this test.
          </p>
        </div>
      );
    }

    // Check if content is plain text or JSON
    if (typeof content === "string" && content.includes && !content.startsWith("{")) {
      // Plain text or HTML content - parse and embed questions inline
      console.log("Rendering as plain text/HTML content");
      return renderContentWithEmbeddedQuestions(content);
    }

    // JSON content - use the parser
    try {
      console.log("Attempting to parse JSON content");
      const result = parseContentForStudent(content);
      console.log("Parsed result:", result);
      
      if (!result || !result.content || !result.content.content) {
        console.warn("⚠️ Invalid parsed result structure");
        return (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">
              Unable to parse test content.
          </p>
        </div>
      );
    }
    
      return (
        <div className="space-y-6">
          {result.content.content.map((node: any, index: number) => {
            console.log(`Rendering node ${index}:`, node);
            return <div key={index}>{renderNode(node, index)}</div>;
          })}
        </div>
      );
    } catch (error) {
      console.error("Error parsing content:", error);
      // If parsing fails, treat as plain text
      return renderContentWithEmbeddedQuestions(content);
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

  const passageQuestions = getCurrentPassageQuestions();
  const currentQuestion = getCurrentQuestion();
  
  // Calculate total questions from all passages
  const totalQuestions = (() => {
    let total = 0;
    passages.forEach(passage => {
      passage.questions.forEach(question => {
        if (question.type === "matching") {
          // For matching questions, count each pair as one question
          try {
            const options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
            if (options && options.left && Array.isArray(options.left)) {
              total += options.left.length;
            } else {
              total += 1; // Fallback
            }
          } catch (e) {
            total += 1; // Fallback
          }
        } else if (question.type === "multiple_selection") {
          // For multiple selection, count each correct answer as one question
          try {
            const correctAnswers = typeof question.correct_answer === 'string' ? JSON.parse(question.correct_answer) : question.correct_answer;
            if (Array.isArray(correctAnswers)) {
              total += correctAnswers.length;
            } else {
              total += 1; // Fallback
            }
          } catch (e) {
            total += 1; // Fallback
          }
        } else {
          // For other question types, count as 1
          total += 1;
        }
      });
    });
    return total;
  })();
  
  // Calculate answered questions properly, handling matching questions
  const answeredQuestions = (() => {
    const answeredQuestionIds = new Set<string>();
    
    // Go through all answers and extract unique question IDs
    Object.keys(answers).forEach(answerKey => {
      // For matching questions, the key format is "questionId_itemIndex"
      // We need to extract just the questionId part
      if (answerKey.includes('_')) {
        const parts = answerKey.split('_');
        if (parts.length >= 2) {
          // Check if this is a matching question (has numeric suffix)
          const lastPart = parts[parts.length - 1];
          if (!isNaN(parseInt(lastPart))) {
            // This is a matching question, extract the question ID
            const questionId = parts.slice(0, -1).join('_');
            answeredQuestionIds.add(questionId);
          } else {
            // Regular question
            answeredQuestionIds.add(answerKey);
          }
        } else {
          // Regular question
          answeredQuestionIds.add(answerKey);
        }
      } else {
        // Regular question
        answeredQuestionIds.add(answerKey);
      }
    });
    
    return answeredQuestionIds.size;
  })();

  // Debug: Log the question counts
  console.log("🔍 Question Counts:", {
    totalQuestions,
    answeredQuestions,
    allQuestionsLength: allQuestions.length,
    passagesCount: passages.length,
    passageDetails: passages.map(p => ({
      passage: p.number,
      questionsCount: p.questions.length,
      questions: p.questions.map(q => ({
        id: q.id,
        type: q.type,
        question_number: q.question_number
      }))
    }))
  });

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
                      Are you sure you want to submit your test? This action cannot be undone.
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
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-blue-900">
                  {currentPassageData?.title || `Passage ${currentPassage}`}
                </h2>
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
                {currentPassageData?.passage_text ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: formatAndSanitizeText(currentPassageData.passage_text),
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
          <div className="h-full flex flex-col">
            {/* Questions Header */}
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-blue-900">
                    Questions for Passage {currentPassage}
                  </h2>
                </div>
              </div>
            </div>

            {/* Questions Content */}
            <ScrollArea className="flex-1 p-6">
              <div className="prose prose-lg max-w-none leading-relaxed">
                {currentPassageData?.content ? (
                  renderContent(currentPassageData.content)
                ) : passageQuestions.length > 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Questions available but no content to display them with.</p>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No questions available for this passage.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Compact Bottom Navigation - Passage Selector */}
      <div className="bg-white border-t-2 border-gray-300 px-1 flex-shrink-0 h-[40px] flex items-center justify-center">
        <div className="flex items-center justify-center space-x-1 w-full">
          {passages.map((passage) => {
            const isActive = passage.number === currentPassage;
            
            // Check if passage has any answers (handle matching questions properly)
            const hasAnswers = passage.questions.some((q) => {
              if (q.type === "matching") {
                // For matching questions, check if any answers exist for this question
                return Object.keys(answers).some(answerKey => 
                  answerKey.startsWith(`${q.id}_`)
                );
              } else if (q.type === "multiple_selection") {
                // For multiple selection questions, check if the answer array has any values
                const answer = answers[q.id];
                return Array.isArray(answer) && answer.length > 0;
              } else {
                // For regular questions, check direct answer
                return !!answers[q.id];
              }
            });
            
            const allAnswered = passage.questions.every((q) => {
              if (q.type === "matching") {
                // For matching questions, check if any answers exist for this question
                return Object.keys(answers).some(answerKey => 
                  answerKey.startsWith(`${q.id}_`)
                );
              } else if (q.type === "multiple_selection") {
                // For multiple selection questions, check if the answer array has any values
                const answer = answers[q.id];
                return Array.isArray(answer) && answer.length > 0;
              } else {
                // For regular questions, check direct answer
                return !!answers[q.id];
              }
            });
            
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
