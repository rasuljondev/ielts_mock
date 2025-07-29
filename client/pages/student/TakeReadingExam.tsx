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
        if (existingSubmission.status === "submitted" || existingSubmission.status === "completed") {
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
      const passageData: ReadingPassage[] = readingSections.map((section) => {


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

      // Submit test with enhanced client
      await enhancedSupabase.update(
        "test_submissions",
        {
          status: "submitted",
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
    const currentPassageData = passages.find((p) => p.number === currentPassage);
    const questions = currentPassageData?.questions || [];

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

    // If content is an object (TipTap format), extract text and embed questions
    if (typeof content === "object" && content !== null) {
      try {
        const result = parseContentForStudent(content);
        if (result && result.content) {
          // Extract text content and embed questions
          const textContent = extractTextFromTipTap(result.content);
          return renderPassageWithEmbeddedQuestions(textContent);
        }
      } catch (error) {
        console.error("Error parsing TipTap content:", error);
      }
    }

    return <p>No content available</p>;
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
          const question = currentPassageData?.questions?.find(
            (q) => q.question_number === questionNum,
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
      <div key={key} className="my-4">
        <div className="mb-2 font-medium">
          {questionNumber}. {questionText}
        </div>
        <div className="space-y-1">
          {options.map((option: string, optIndex: number) => (
            <label key={optIndex} className="flex items-center cursor-pointer">
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
      <div key={key} className="my-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            {leftItems.map((item: string, itemIndex: number) => (
              <div key={itemIndex} className="mb-2 p-2 bg-gray-50 rounded">
                {question.question_number}. {item}
              </div>
            ))}
          </div>
          <div>
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
            let questionId: string = questionNumber?.toString() || '';
            let isShortAnswer = false;
            
            if (questionNumber && currentPassageData?.questions) {
              const q = currentPassageData.questions.find(
                q => q.question_number === questionNumber && q.type === "short_answer"
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
                value={answers[questionId] || ""}
                onChange={(e) => updateAnswer(questionId, e.target.value)}
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

  // Function to generate content with embedded questions from database questions
  const generateContentWithEmbeddedQuestions = (questions: Question[]): string => {
    if (!questions || questions.length === 0) return "";
    
    let content = "";
    
    // Group questions by type and create content
    const mcqQuestions = questions.filter(q => q.type === "multiple_choice");
    const shortAnswerQuestions = questions.filter(q => q.type === "short_answer");
    const matchingQuestions = questions.filter(q => q.type === "matching");
    
    // Add MCQ questions
    if (mcqQuestions.length > 0) {
      content += "Choose TRUE if the statement agrees with the information given in the text, choose FALSE if the statement contradicts the information, or choose NOT GIVEN if there is no information on this.\n\n";
      
      mcqQuestions.forEach((question, index) => {
        content += `${question.question_number}. ${question.question_text}\n`;
        if (question.options && Array.isArray(question.options)) {
          question.options.forEach((option: string, optIndex: number) => {
            content += `${String.fromCharCode(65 + optIndex)}) ${option}\n`;
          });
        }
        content += "\n";
      });
    }
    
    // Add short answer questions
    if (shortAnswerQuestions.length > 0) {
      content += "Complete the notes. Write ONE WORD ONLY from the text for each answer.\n\n";
      content += "Marie Curie's research on radioactivity\n\n";
      content += "When uranium was discovered to be radioactive, Marie Curie found that the element called [2] had the same property.\n\n";
    }
    
    // Add matching questions
    if (matchingQuestions.length > 0) {
      matchingQuestions.forEach((question, index) => {
        if (question.options) {
          try {
            const options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
            if (options.left && options.right) {
              options.left.forEach((item: string, itemIndex: number) => {
                content += `${question.question_number}. ${item}\n`;
              });
            }
          } catch (e) {
            console.error("Error parsing matching options:", e);
          }
        }
        content += "\n";
      });
    }
    
    return content;
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
  const totalQuestions = allQuestions.length;
  
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
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-blue-900">
                    Questions for Passage {currentPassage}
                  </h2>
                  <p className="text-sm text-blue-700">
                    {passageQuestions.length} questions • {answeredQuestions} answered
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-blue-700 border-blue-300"
                >
                  {Math.round((answeredQuestions / totalQuestions) * 100)}% Complete
                </Badge>
              </div>
            </div>

            {/* Questions Content */}
            <ScrollArea className="flex-1 p-6">
              <div className="prose prose-lg max-w-none leading-relaxed">
                {passageQuestions.length > 0 ? (
                  renderContentWithEmbeddedQuestions(generateContentWithEmbeddedQuestions(passageQuestions))
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
