import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Split from "react-split/dist/react-split";
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
  ChevronLeft,
  ChevronRight,
  Flag,
  Send,
  BookOpen,
  Volume2,
  PenTool,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { parseError, logError } from "@/lib/errorUtils";
import { formatAndSanitizeText } from "@/lib/textFormatting";
import { testNetworkConnectivity, logNetworkInfo } from "@/lib/networkUtils";

interface TestData {
  id: string;
  title: string;
  type: string;
  duration: number;
  status: string;
  hasAccess: boolean;
  requestStatus?: string;
  questions: any[];
}

interface Question {
  id: string;
  type: string;
  question_text: string;
  options?: any;
  section_type: "reading" | "listening" | "writing";
  section_number: number;
  question_number: number;
  passage_text?: string;
  // Writing task specific properties
  task_title?: string;
  task_instructions?: string;
  word_limit?: number;
  task_image_url?: string;
  task_type?: string;
}

const TakeTestNew: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [test, setTest] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState<string>("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);

  const [testQuestions, setTestQuestions] = useState<{
    reading: Question[];
    listening: Question[];
    writing: Question[];
  }>({
    reading: [],
    listening: [],
    writing: [],
  });

  // Writing task specific state
  const [writingTasks, setWritingTasks] = useState<any[]>([]);
  const [currentWritingTask, setCurrentWritingTask] = useState(1);
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});

  // Load test data from localStorage as fallback
  const loadTestDataFromLocalStorage = (
    testId: string,
    sectionType: "listening" | "reading" | "writing",
  ) => {
    console.log(`🔍 Looking for offline data for ${sectionType} sections...`);

    const sections = [];

    // Check for offline section data
    for (let i = 1; i <= 4; i++) {
      const offlineKey = `offline-section-${testId}-${i}`;
      const sectionDataKey = `section-data-section-${i}`;

      const offlineData = localStorage.getItem(offlineKey);
      const sectionData = localStorage.getItem(sectionDataKey);

      if (offlineData) {
        try {
          const parsedData = JSON.parse(offlineData);
          if (parsedData.section) {
            console.log(
              `📦 Found offline ${sectionType} section ${i}:`,
              parsedData.section.title,
            );
            sections.push({
              ...parsedData.section,
              listening_questions: parsedData.questions || [],
              content: parsedData.section.content,
              audio_url: parsedData.audioUrl,
              isOffline: true,
            });
          }
        } catch (e) {
          console.warn(`⚠️ Could not parse offline data for section ${i}`);
        }
      } else if (sectionData) {
        try {
          const parsedData = JSON.parse(sectionData);
          console.log(`💾 Found local ${sectionType} section data ${i}`);
          sections.push({
            id: `local-${i}`,
            title: `${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)} Section ${i}`,
            section_number: i,
            content: parsedData.content,
            audio_url: parsedData.audioUrl,
            listening_questions: parsedData.questions || [],
            instructions: `Listen to the audio and answer the questions.`,
            isLocal: true,
          });
        } catch (e) {
          console.warn(
            `⚠️ Could not parse local section data for section ${i}`,
          );
        }
      }
    }

    if (sections.length > 0) {
      console.log(
        `✅ Loaded ${sections.length} ${sectionType} sections from offline storage`,
      );
      toast.success(`Using offline data for ${sectionType} sections`);
    }

    return sections;
  };

  useEffect(() => {
    if (testId) {
      checkAccessAndLoadTest();
    }
  }, [testId]);

  // Timer logic
  useEffect(() => {
    if (timeRemaining > 0 && test?.hasAccess) {
      console.log("⏰ Starting timer with", timeRemaining, "seconds remaining");

      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          console.log("Timer tick:", prev, "seconds left");

          if (prev <= 1) {
            console.log("⏰ TIME'S UP! Auto-submitting...");
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        console.log("⏰ Clearing timer");
        clearInterval(timer);
      };
    } else {
      console.log("⏰ Timer not started:", {
        timeRemaining,
        hasAccess: test?.hasAccess,
      });
    }
  }, [test?.hasAccess]);

  // Set initial section to first available section after questions are loaded
  useEffect(() => {
    const availableSections = ["reading", "listening", "writing"].filter(
      (section) => {
        const sectionQs = getSectionQuestions(section);
        return sectionQs.length > 0;
      },
    );

    if (
      availableSections.length > 0 &&
      currentSection === "reading" &&
      getSectionQuestions("reading").length === 0
    ) {
      setCurrentSection(availableSections[0]);
      setCurrentQuestionIndex(0);
    }
  }, [testQuestions]);

  // Auto-save logic
  useEffect(() => {
    if (submissionId && test?.hasAccess) {
      console.log(
        "Setting up auto-save interval for submission:",
        submissionId,
      );

      const autoSaveInterval = setInterval(() => {
        console.log("Auto-save interval triggered");
        autoSaveAnswers();
      }, 30000);

      return () => {
        console.log("Clearing auto-save interval");
        clearInterval(autoSaveInterval);
      };
    } else {
      console.log("Auto-save not set up:", {
        submissionId,
        hasAccess: test?.hasAccess,
      });
    }
  }, [submissionId, test?.hasAccess]);

  // Handle resizer drag
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const containerWidth = window.innerWidth;
    const newLeftWidth = (e.clientX / containerWidth) * 100;

    // Constrain between 20% and 80%
    if (newLeftWidth >= 20 && newLeftWidth <= 80) {
      setLeftPanelWidth(newLeftWidth);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add event listeners for mouse events
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  const checkAccessAndLoadTest = async () => {
    try {
      setLoading(true);

      console.log("🚀 Starting test access check for testId:", testId);
      console.log("👤 Current user:", user?.id);

      // Test network connectivity (minimal logging in production)
      const networkStatus = await testNetworkConnectivity();

      if (process.env.NODE_ENV === "development") {
        logNetworkInfo();
        console.log("🌐 Testing network connectivity...");
        console.log("📊 Network status:", networkStatus);
      }

      if (!networkStatus.isOnline) {
        toast.error(
          "No internet connection. Please check your network and try again.",
        );
        return;
      }

      if (!networkStatus.supabaseConnected) {
        console.error("❌ Supabase connection failed:", networkStatus.error);
        toast.error(`Database connection failed: ${networkStatus.error}`);
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.log(`✅ Network connectivity OK (${networkStatus.latency}ms)`);
        console.log("📋 Fetching test details...");
      }

      let testData = null;
      let testError = null;

      try {
        const result = await supabase
          .from("tests")
          .select("*")
          .eq("id", testId)
          .eq("status", "published")
          .single();

        testData = result.data;
        testError = result.error;

        console.log("📊 Test data result:", {
          testData: !!testData,
          testError: !!testError,
        });
      } catch (fetchError) {
        console.error("🚨 Test fetch error:", fetchError);
        testError = fetchError;
      }

      if (testError) {
        console.error("❌ Test data error:", {
          message: testError.message || "Unknown error",
          code: testError.code || "No code",
          details: testError.details || "No details",
          hint: testError.hint || "No hint",
        });

        const errorMessage = parseError(testError);

        if (testError.code === "PGRST116") {
          toast.error(
            "Test not found or you don't have permission to access it.",
          );
        } else {
          toast.error(`Failed to load test: ${errorMessage}`);
        }
        throw testError;
      }

      if (!testData) {
        console.error("❌ No test data returned");
        toast.error("Test not found. Please check the test ID and try again.");
        throw new Error("Test not found");
      }

      console.log("✅ Test data loaded:", {
        id: testData.id,
        title: testData.title,
        type: testData.type,
        duration: testData.duration,
      });

      // Check if user has requested access and if it's approved
      const { data: requestData } = await supabase
        .from("test_requests")
        .select("*")
        .eq("test_id", testId)
        .eq("student_id", user?.id)
        .single();

      // Check if there's an existing test submission
      const { data: existingSubmission } = await supabase
        .from("test_submissions")
        .select("*")
        .eq("test_id", testId)
        .eq("student_id", user?.id)
        .single();

      let hasAccess = false;
      let requestStatus = "none";

      if (requestData) {
        requestStatus = requestData.status;
        hasAccess = requestData.status === "approved";
      }

      // If there's an existing submission, check if it's completed
      if (existingSubmission) {
        console.log("Found existing submission:", existingSubmission);
        setSubmissionId(existingSubmission.id);

        if (existingSubmission.is_completed) {
          // Test already completed, redirect to history
          toast.info("You have already completed this test");
          navigate("/student/tests/history");
          return;
        }

        // Load existing answers and time
        const savedAnswers = existingSubmission.answers || {};
        const savedTime = existingSubmission.time_remaining_seconds;

        console.log("=== RESTORING SAVED STATE ===");
        console.log("Saved answers:", Object.keys(savedAnswers).length);
        console.log("Saved time (seconds):", savedTime);
        console.log("Test duration (minutes):", testData.duration);
        console.log("============================");

        setAnswers(savedAnswers);

        // Restore time properly - use saved time if exists, otherwise use full duration
        if (savedTime && savedTime > 0) {
          setTimeRemaining(savedTime);
          console.log("✅ Restored saved time:", savedTime, "seconds");
          toast.info(
            `Continuing from where you left off (${Math.floor(savedTime / 60)} minutes remaining)`,
          );
        } else {
          const fullTime = (testData.duration || 180) * 60;
          setTimeRemaining(fullTime);
          console.log(
            "⚠️ No saved time, using full duration:",
            fullTime,
            "seconds",
          );
          toast.info("Starting test from beginning");
        }

        hasAccess = true; // Allow continuing if already started
      } else {
        // Set initial time
        // Set timer based on current section (60 minutes per section for combined tests)
        const testType = testData.type?.toLowerCase();
        
        if (testType === "full") {
          // For combined tests, set 60 minutes per section
          setTimeRemaining(60 * 60); // 60 minutes in seconds
        } else {
          // For single section tests, use the test duration
          setTimeRemaining((testData.duration || 60) * 60);
        }
      }

      setTest({
        ...testData,
        hasAccess,
        requestStatus,
        questions: [],
      });

      // Load questions if we have access
      if (hasAccess) {
        await loadTestQuestions(testId);
      }

      // Create submission if approved and doesn't exist
      if (hasAccess && !existingSubmission) {
        await createTestSubmission();
      } else if (hasAccess && existingSubmission) {
        // Make sure we have the submission ID set for existing submissions
        setSubmissionId(existingSubmission.id);
      }
    } catch (error: any) {
      logError("checkAccessAndLoadTest", error);
      const errorMessage = parseError(error);
      toast.error(`Failed to load test: ${errorMessage}`);
      navigate("/student/tests");
    } finally {
      setLoading(false);
    }
  };

  const loadTestQuestions = async (testId: string) => {
    try {
      console.log("Loading questions for test:", testId);

      // First get the test type to know which sections to load
      console.log("🔍 Fetching test info for testId:", testId);

      let testInfo = null;
      let testInfoError = null;

      try {
        const result = await supabase
          .from("tests")
          .select("type")
          .eq("id", testId)
          .single();

        testInfo = result.data;
        testInfoError = result.error;

        console.log("📊 Test info result:", { testInfo, testInfoError });
      } catch (fetchError) {
        console.error("🚨 Network/fetch error:", fetchError);
        testInfoError = fetchError;

        // Check if it's a network error
        if (
          fetchError instanceof TypeError &&
          fetchError.message.includes("fetch")
        ) {
          console.error("❌ Network connection issue detected");
          toast.error(
            "Network connection error. Please check your internet connection and try again.",
          );
          return;
        }
      }

      if (testInfoError) {
        console.error("❌ Error fetching test info:", {
          message: testInfoError.message || "Unknown error",
          code: testInfoError.code || "No code",
          details: testInfoError.details || "No details",
          hint: testInfoError.hint || "No hint",
          statusCode: testInfoError.statusCode || "No status",
          error: testInfoError,
        });

        const errorMessage = parseError(testInfoError);
        console.error("📝 Parsed error message:", errorMessage);
        toast.error(`Failed to load test information: ${errorMessage}`);

        // Don't throw, try to continue with fallback
        console.warn("⚠️ Continuing with fallback test type");
      }

      const testType = testInfo?.type?.toLowerCase() || "full";
      console.log("Test type:", testType);

      let readingSections = [];
      let listeningSections = [];
      let writingTasks = [];

      // Load reading sections only if test includes reading
      if (
        testType === "reading" ||
        testType === "full" ||
        testType === "reading_only"
      ) {
        console.log("📚 Fetching reading sections...");

        try {
          const result = await supabase
            .from("reading_sections")
            .select(
              `
              id,
              title,
              passage_text,
              passage_number,
              reading_questions (
                id,
                question_number,
                question_type,
                question_text,
                options,
                correct_answer
              )
            `,
            )
            .eq("test_id", testId)
            .order("passage_number");

          const { data, error: readingError } = result;

          if (readingError) {
            console.error("❌ Reading sections error details:", {
              message: readingError.message || "Unknown error",
              code: readingError.code || "No code",
              details: readingError.details || "No details",
              hint: readingError.hint || "No hint",
              statusCode: readingError.statusCode || "No status",
            });

            const errorMessage = parseError(readingError);
            console.error("📝 Reading error message:", errorMessage);
            toast.error(`Reading sections error: ${errorMessage}`);
          } else {
            readingSections = data || [];
            console.log("✅ Reading sections loaded:", readingSections.length);

            if (readingSections.length > 0) {
              console.log("📖 Sample reading section:", {
                id: readingSections[0].id,
                title: readingSections[0].title,
                questionsCount:
                  readingSections[0].reading_questions?.length || 0,
              });
            }
          }
        } catch (fetchError) {
          console.error("🚨 Reading sections fetch error:", fetchError);

          if (
            fetchError instanceof TypeError &&
            fetchError.message.includes("fetch")
          ) {
            toast.error(
              "Network error loading reading sections. Please check your connection.",
            );
          } else {
            const errorMessage = parseError(fetchError);
            toast.error(`Error loading reading sections: ${errorMessage}`);
          }
        }
      }

      // Load writing tasks only if test includes writing
      if (
        testType === "writing" ||
        testType === "full" ||
        testType === "writing_only"
      ) {
        console.log("✍️ Fetching writing tasks...");

        try {
          const result = await supabase
            .from("writing_tasks")
            .select("*")
            .eq("test_id", testId)
            .order("task_order");

          const { data, error: writingError } = result;

          if (writingError) {
            console.error("❌ Writing tasks error details:", {
              message: writingError.message || "Unknown error",
              code: writingError.code || "No code",
              details: writingError.details || "No details",
              hint: writingError.hint || "No hint",
              statusCode: writingError.statusCode || "No status",
            });

            const errorMessage = parseError(writingError);
            console.error("📝 Writing error message:", errorMessage);
            toast.error(`Writing tasks error: ${errorMessage}`);
          } else {
            writingTasks = data || [];
            setWritingTasks(data || []); // Update the state
            console.log("✅ Writing tasks loaded:", writingTasks.length);

            if (writingTasks.length > 0) {
              console.log("✍️ Sample writing task:", {
                id: writingTasks[0].id,
                title: writingTasks[0].task_title,
                order: writingTasks[0].task_order,
              });
            }
          }
        } catch (fetchError) {
          console.error("🚨 Writing tasks fetch error:", fetchError);

          if (
            fetchError instanceof TypeError &&
            fetchError.message.includes("fetch")
          ) {
            toast.error(
              "Network error loading writing tasks. Please check your connection.",
            );
          } else {
            const errorMessage = parseError(fetchError);
            toast.error(`Error loading writing tasks: ${errorMessage}`);
          }
        }
      }

      // Load listening sections
      console.log("🎧 Fetching listening sections...");
      try {
        const result = await supabase
          .from("listening_sections")
          .select(
            `
            id,
            title,
            content,
            audio_url,
            audio_file_url,
            section_number,
            instructions,
            listening_questions (
              id,
              question_number,
              question_type,
              question_text,
              options,
              correct_answer
            )
          `,
          )
          .eq("test_id", testId)
          .order("section_number");

        const { data, error: listeningError } = result;

        if (listeningError) {
          console.error("❌ Listening sections error details:", {
            message: listeningError.message || "Unknown error",
            code: listeningError.code || "No code",
            details: listeningError.details || "No details",
            hint: listeningError.hint || "No hint",
          });

          const errorMessage = parseError(listeningError);
          console.error("📝 Listening error message:", errorMessage);

          // Check if it's a network error
          if (
            errorMessage.includes("fetch") ||
            errorMessage.includes("Network") ||
            !navigator.onLine
          ) {
            console.warn(
              "⚠️ Network error detected, trying offline fallback for listening sections",
            );
            // Try to load from localStorage
            listeningSections = loadTestDataFromLocalStorage(
              testId,
              "listening",
            );
          } else {
            toast.error(`Listening sections error: ${errorMessage}`);
          }
        } else {
          listeningSections = data || [];
          console.log(
            "✅ Listening sections loaded:",
            listeningSections.length,
          );

          if (listeningSections.length > 0) {
            console.log("🎧 Sample listening section:", {
              id: listeningSections[0].id,
              title: listeningSections[0].title,
              questionsCount:
                listeningSections[0].listening_questions?.length || 0,
              hasContent: !!listeningSections[0].content,
              hasAudio: !!(
                listeningSections[0].audio_url ||
                listeningSections[0].audio_file_url
              ),
            });
          }
        }
      } catch (fetchError) {
        console.error("🚨 Listening sections fetch error:", fetchError);

        if (
          fetchError instanceof TypeError &&
          fetchError.message.includes("fetch")
        ) {
          console.warn(
            "⚠️ Network error in catch block, trying offline fallback",
          );
          listeningSections = loadTestDataFromLocalStorage(testId, "listening");

          if (listeningSections.length === 0) {
            toast.error(
              "Network error loading listening sections. No offline data available.",
            );
          }
        } else {
          const errorMessage = parseError(fetchError);
          toast.error(`Error loading listening sections: ${errorMessage}`);
        }
      }

      // Transform and organize questions
      const readingQuestions: Question[] = [];
      const listeningQuestions: Question[] = [];
      const writingQuestions: Question[] = [];

      // Process writing tasks
      if (writingTasks && writingTasks.length > 0) {
        console.log("✍️ Processing writing tasks:", writingTasks.length);
        
        writingTasks.forEach((task: any) => {
          writingQuestions.push({
            id: task.id,
            type: "essay",
            question_text: task.task_prompt,
            section_type: "writing",
            section_number: task.task_order,
            question_number: 1,
            task_title: task.task_title,
            task_instructions: task.task_instructions,
            word_limit: task.word_limit,
            task_image_url: task.task_image_url,
            task_type: task.task_type,
          });
        });
        
        console.log("✅ Writing questions processed:", writingQuestions.length);
      }

      // Process reading questions
      if (readingSections) {
        readingSections.forEach((section: any) => {
          if (section.reading_questions) {
            section.reading_questions.forEach((q: any) => {
              readingQuestions.push({
                id: q.id,
                type: q.question_type,
                question_text: q.question_text,
                options: q.options,
                section_type: "reading",
                section_number: section.passage_number,
                question_number: q.question_number,
                passage_text: section.passage_text,
                passage_title: section.title,
              });
            });
          }
        });
      }

      // Process listening questions
      if (listeningSections && listeningSections.length > 0) {
        console.log(
          "🔍 Processing listening sections:",
          listeningSections.length,
        );

        listeningSections.forEach((section: any, sectionIndex) => {
          console.log(`🎧 Processing section ${sectionIndex + 1}:`, {
            id: section.id,
            title: section.title,
            questionsInDB: section.listening_questions?.length || 0,
            hasContent: !!section.content,
            contentLength: section.content?.length || 0,
            hasAudio: !!(section.audio_url || section.audio_file_url),
          });

          // Check for questions in the section
          const questions = section.listening_questions || [];

          if (questions.length > 0) {
            console.log(
              `✅ Found ${questions.length} questions in database for section ${section.section_number}`,
            );
            questions.forEach((q: any) => {
              listeningQuestions.push({
                id: q.id,
                type: q.question_type,
                question_text: q.question_text,
                options: q.options ? JSON.parse(q.options) : null,
                section_type: "listening",
                section_number: section.section_number || 1,
                question_number: q.question_number,
                audio_url: section.audio_url || section.audio_file_url,
                content: section.content,
                instructions: section.instructions,
              });
            });
          } else {
            console.log(
              `📝 No questions in database for section ${section.section_number}, checking content for placeholders...`,
            );

            if (section.content) {
              console.log(
                `📄 Section content preview:`,
                section.content.substring(0, 200) + "...",
              );

              // Check if content has question placeholders
              const tempDiv = document.createElement("div");
              tempDiv.innerHTML = section.content || "";
              const questionPlaceholders = tempDiv.querySelectorAll(
                ".question-placeholder",
              );

              console.log(
                `🔍 Found ${questionPlaceholders.length} question placeholders in content`,
              );

              if (questionPlaceholders.length > 0) {
                // Create questions from placeholders
                questionPlaceholders.forEach((placeholder, index) => {
                  const questionId =
                    placeholder.getAttribute("data-question-id") ||
                    `placeholder-${section.id}-${index}`;
                  const questionType =
                    placeholder.getAttribute("data-type") || "multiple_choice";
                  const questionPreview =
                    placeholder.querySelector(".question-preview")
                      ?.textContent || `Question ${index + 1}`;

                  console.log(
                    `   → Placeholder ${index + 1}: ${questionType} - ${questionPreview.substring(0, 50)}...`,
                  );

                  listeningQuestions.push({
                    id: questionId,
                    type: questionType,
                    question_text: questionPreview,
                    options: null,
                    section_type: "listening",
                    section_number: section.section_number || 1,
                    question_number: index + 1,
                    audio_url: section.audio_url || section.audio_file_url,
                    content: section.content,
                    instructions: section.instructions,
                    isPlaceholder: true,
                  });
                });
              } else {
                // Create at least one question so the section can be accessed
                console.log(
                  "⚠️ No questions found anywhere, creating default question for section access",
                );
                listeningQuestions.push({
                  id: `default-${section.id}`,
                  type: "multiple_choice",
                  question_text: "Please configure questions for this section",
                  options: null,
                  section_type: "listening",
                  section_number: section.section_number || 1,
                  question_number: 1,
                  audio_url: section.audio_url || section.audio_file_url,
                  content: section.content,
                  instructions: section.instructions,
                  isPlaceholder: true,
                  isDefault: true,
                });
              }
            } else {
              console.log("❌ Section has no content at all");
              // Still create a default question so section is accessible
              listeningQuestions.push({
                id: `empty-${section.id}`,
                type: "multiple_choice",
                question_text: "This section has no content yet",
                options: null,
                section_type: "listening",
                section_number: section.section_number || 1,
                question_number: 1,
                audio_url: section.audio_url || section.audio_file_url,
                content: section.content || "",
                instructions: section.instructions,
                isPlaceholder: true,
                isEmpty: true,
              });
            }
          }
        });

        console.log(
          `🎯 Total listening questions extracted: ${listeningQuestions.length}`,
        );

        // Also check localStorage for additional section data
        listeningSections.forEach((section: any) => {
          const localStorageKey = `section-data-${section.id}`;
          const localData = localStorage.getItem(localStorageKey);

          if (localData) {
            try {
              const parsedData = JSON.parse(localData);
              console.log(
                `💾 Found local storage data for section ${section.id}:`,
                {
                  hasContent: !!parsedData.content,
                  questionsCount: parsedData.questions?.length || 0,
                  hasAudio: !!parsedData.audioUrl,
                },
              );

              // If we have questions in localStorage but not in the extracted list
              if (parsedData.questions && parsedData.questions.length > 0) {
                const existingQuestionIds = listeningQuestions.map((q) => q.id);

                parsedData.questions.forEach((localQ: any, index: number) => {
                  if (!existingQuestionIds.includes(localQ.id)) {
                    console.log(
                      `   → Adding question from localStorage: ${localQ.id}`,
                    );
                    listeningQuestions.push({
                      id: localQ.id,
                      type: localQ.type || "multiple_choice",
                      question_text: localQ.text || `Question ${index + 1}`,
                      options: localQ.options,
                      section_type: "listening",
                      section_number: section.section_number || 1,
                      question_number: index + 1,
                      audio_url:
                        parsedData.audioUrl ||
                        section.audio_url ||
                        section.audio_file_url,
                      content: parsedData.content || section.content,
                      instructions: section.instructions,
                      fromLocalStorage: true,
                    });
                  }
                });
              }
            } catch (e) {
              console.warn(
                `⚠️ Could not parse localStorage data for section ${section.id}`,
              );
            }
          }
        });

        console.log(
          `🎯 Final listening questions count (including localStorage): ${listeningQuestions.length}`,
        );
      }

      console.log("=== QUESTION LOADING RESULTS ===");
      console.log(
        "Reading questions:",
        readingQuestions.length,
        readingQuestions,
      );
      console.log(
        "Listening questions:",
        listeningQuestions.length,
        listeningQuestions,
      );
      console.log(
        "Writing questions:",
        writingQuestions.length,
        writingQuestions,
      );
      console.log("================================");

      setTestQuestions({
        reading: readingQuestions,
        listening: listeningQuestions,
        writing: writingQuestions,
      });

      // Determine which sections are available and set the first one as current
      const availableSections = [];
      if (readingQuestions.length > 0) availableSections.push("reading");
      if (listeningQuestions.length > 0) availableSections.push("listening");
      if (writingQuestions.length > 0) availableSections.push("writing");

      console.log("📋 Available sections:", availableSections);

      // Set the first available section as current (only if not already set)
      if (availableSections.length > 0 && !currentSection) {
        console.log(`🎯 Setting initial section to: ${availableSections[0]}`);
        setCurrentSection(availableSections[0]);
        setCurrentQuestionIndex(0);
      }

      // Debug: Log total questions after setting
      const totalQuestions =
        readingQuestions.length +
        listeningQuestions.length +
        writingQuestions.length;
      console.log("Total questions loaded:", totalQuestions);

      if (totalQuestions === 0) {
        console.error("❌ NO QUESTIONS LOADED - CHECK DATABASE");
        console.error("Test ID:", testId);
        console.error("Test type:", testType);
        console.error("Reading sections found:", readingSections?.length || 0);
        console.error(
          "Listening sections found:",
          listeningSections?.length || 0,
        );
        console.error("Writing tasks found:", writingTasks?.length || 0);

        // Try one more time to load from any available local storage
        console.log(
          "🔄 Making final attempt to load test data from any local storage...",
        );

        // Check for any test-related data in localStorage
        const allKeys = Object.keys(localStorage);
        const testKeys = allKeys.filter((key) => key.includes(testId));

        console.log(
          `📋 Found ${testKeys.length} localStorage keys for this test:`,
          testKeys,
        );

        if (testKeys.length > 0) {
          // Create a basic listening section from any available data
          console.log("🔧 Creating fallback test from available data...");

          const fallbackSection = {
            id: `fallback-${testId}`,
            title: "Listening Test (Offline Mode)",
            section_number: 1,
            content:
              "This test is running in offline mode. Your progress may not be saved to the server.",
            audio_url: null,
            instructions: "Complete the questions below.",
            listening_questions: [],
          };

          // Add a basic question so the test can start
          listeningQuestions.push({
            id: `fallback-q1`,
            type: "multiple_choice",
            question_text:
              "This is a fallback question. Please contact your instructor to access the actual test content.",
            options: {
              choices: ["Option A", "Option B", "Option C", "Option D"],
            },
            section_type: "listening",
            section_number: 1,
            question_number: 1,
            audio_url: null,
            content: fallbackSection.content,
            instructions: fallbackSection.instructions,
            isFallback: true,
          });

          setTestQuestions({
            reading: readingQuestions,
            listening: listeningQuestions,
            writing: writingQuestions,
          });

          toast.warning("Running in offline mode with limited functionality");
        } else {
          toast.error(
            "No questions found for this test. Please contact your instructor.",
          );
        }

        // Show detailed error to help with debugging
        console.group("🔍 Debugging Information");
        console.log("1. Check if test exists in database");
        console.log(
          "2. Check if reading_sections table has data for test_id:",
          testId,
        );
        console.log(
          "3. Check if reading_questions table has data linked to sections",
        );
        console.log(
          "4. Check RLS policies on reading_sections and reading_questions tables",
        );
        console.log("5. Run debug_no_questions.sql in Supabase to diagnose");
        console.groupEnd();
      }
    } catch (error: any) {
      console.error("🚨 Critical error in loadTestQuestions:", {
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorMessage: error?.message || "No message",
        errorCode: error?.code || "No code",
        errorDetails: error?.details || "No details",
        errorStack: error?.stack || "No stack",
        testId,
        rawError: error,
      });

      logError("loadTestQuestions", error);

      const errorMessage = parseError(error);
      console.error("📝 Final parsed error:", errorMessage);

      // Check for specific error types
      if (error instanceof TypeError && error.message.includes("fetch")) {
        toast.error(
          "Network connection error. Please check your internet and refresh the page.",
        );
      } else if (error?.code === "PGRST116") {
        toast.error(
          "Database table not found. Please contact your administrator.",
        );
      } else if (error?.message?.includes("JWT")) {
        toast.error("Authentication expired. Please log in again.");
        navigate("/auth/login");
        return;
      } else {
        toast.error(`Failed to load questions: ${errorMessage}`);
      }

      console.warn("⚠️ Using fallback sample data due to error");

      // Fallback to sample questions if database loading fails
      setTestQuestions({
        reading: [
          {
            id: "sample-r1",
            type: "multiple_choice",
            question_text: "Sample reading question - What is the main topic?",
            options: {
              choices: ["Option A", "Option B", "Option C", "Option D"],
            },
            section_type: "reading",
            section_number: 1,
            question_number: 1,
            passage_text:
              "This is a sample reading passage. **You are seeing this because there was an error loading the actual test data.** Please contact your instructor if this persists.",
          },
        ],
        listening: [],
        writing: [],
      });
    }
  };

  const createTestSubmission = async () => {
    try {
      // Get user's edu_center_id
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("edu_center_id")
        .eq("id", user?.id)
        .single();

      // Start with minimal required data and add fields progressively
      const baseData = {
        test_id: testId,
        student_id: user?.id,
        status: "in_progress",
      };

      console.log("Creating test submission with base data:", baseData);

      // Try with just basic fields first
      let submissionData = { ...baseData };

      // Add optional fields that might exist
      try {
        submissionData = {
          ...baseData,
          answers: {},
          ...(userProfile?.edu_center_id && {
            edu_center_id: userProfile.edu_center_id,
          }),
          ...(timeRemaining > 0 && { time_remaining_seconds: timeRemaining }),
        };
        console.log("Extended submission data:", submissionData);
      } catch (e) {
        console.warn(
          "Using minimal submission data due to potential column issues",
        );
        submissionData = baseData;
      }

      let data = null;
      let error = null;

      // Try with full data first
      try {
        const result = await supabase
          .from("test_submissions")
          .insert(submissionData)
          .select()
          .single();

        data = result.data;
        error = result.error;
      } catch (insertError: any) {
        console.warn("Full insert failed, trying minimal data:", insertError);

        // Fallback: try with just the minimum required fields
        try {
          const result = await supabase
            .from("test_submissions")
            .insert({
              test_id: testId,
              student_id: user?.id,
              status: "in_progress",
            })
            .select()
            .single();

          data = result.data;
          error = result.error;
          console.log("✅ Minimal submission creation succeeded");
        } catch (minimalError: any) {
          error = minimalError;
          console.error(
            "❌ Even minimal submission creation failed:",
            minimalError,
          );
        }
      }

      if (error) {
        console.error("❌ Submission creation error details:");
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Error details:", error.details);
        console.error("Error hint:", error.hint);
        console.error("Full error object:", error);

        // Check for specific error types
        if (error.message && error.message.includes("column")) {
          console.error("🔍 Column-related error detected");
          toast.error(
            "Database schema error. Please run fix_all_submission_issues.sql",
          );
        } else if (error.message && error.message.includes("permission")) {
          console.error("🔒 Permission error detected");
          toast.error(
            "Database permission error. Please run fix_all_submission_issues.sql",
          );
        }

        throw error;
      }

      setSubmissionId(data.id);
      console.log("✅ Created test submission:", data.id);
      toast.success("Test started successfully!");
    } catch (error: any) {
      logError("createTestSubmission", error);
      const errorMessage = parseError(error);
      console.error("❌ Failed to create test submission:", errorMessage);

      // Provide specific user guidance based on error type
      if (error?.message?.includes("column")) {
        toast.error(
          "Database setup incomplete. Please contact your administrator to run the database setup script.",
        );
      } else if (
        error?.message?.includes("permission") ||
        error?.code === "42501"
      ) {
        toast.error(
          "Permission error. Please contact your administrator to fix database permissions.",
        );
      } else if (
        error?.message?.includes("relation") &&
        error?.message?.includes("does not exist")
      ) {
        toast.error(
          "Database table missing. Please contact your administrator to set up the database.",
        );
      } else {
        toast.error(
          `Cannot start test: ${errorMessage}. Please contact your administrator.`,
        );
      }

      // Show recovery options
      console.group("🔧 Recovery Options");
      console.log("1. Ask administrator to run: fix_all_submission_issues.sql");
      console.log("2. Check if test_submissions table exists");
      console.log("3. Verify RLS policies are not blocking access");
      console.log("4. Check user permissions on test_submissions table");
      console.groupEnd();
    }
  };

  const requestAccess = async () => {
    try {
      console.log("Requesting access for:", { testId, studentId: user?.id });

      // Get the test's edu_center_id and user's edu_center_id
      const { data: testData } = await supabase
        .from("tests")
        .select("edu_center_id")
        .eq("id", testId)
        .single();

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("edu_center_id")
        .eq("id", user?.id)
        .single();

      const edu_center_id =
        testData?.edu_center_id || userProfile?.edu_center_id;

      if (!edu_center_id) {
        toast.error(
          "Unable to determine education center. Please contact support.",
        );
        return;
      }

      const { error } = await supabase.from("test_requests").insert({
        test_id: testId,
        student_id: user?.id,
        edu_center_id: edu_center_id,
        status: "pending",
        requested_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Insert error:", error);
        if (error.code === "23505") {
          toast.error("You have already requested access to this test");
        } else {
          const errorMessage =
            error?.message || error?.details || error?.hint || String(error);
          toast.error(`Failed to request access: ${errorMessage}`);
        }
      } else {
        toast.success("Access request sent! Wait for admin approval.");
        setTest((prev) =>
          prev ? { ...prev, requestStatus: "pending" } : null,
        );
      }
    } catch (error: any) {
      logError("requestAccess", error);
      const errorMessage = parseError(error);
      toast.error(`Failed to request access: ${errorMessage}`);
    }
  };

  const autoSaveAnswers = useCallback(async () => {
    if (!submissionId) return;

    setAutoSaving(true);
    try {
      const { error } = await supabase
        .from("test_submissions")
        .update({
          answers,
          time_remaining_seconds: timeRemaining,
          auto_saved_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) throw error;
      console.log("Auto-save successful");
    } catch (error: any) {
      console.error("Auto-save error:", parseError(error));
    } finally {
      setAutoSaving(false);
    }
  }, [submissionId, answers, timeRemaining]);

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  // Writing task specific functions
  const handleWritingChange = (taskId: string, content: string) => {
    setAnswers((prev) => ({
      ...prev,
      [taskId]: content,
    }));

    // Calculate word count
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    setWordCounts((prev) => ({
      ...prev,
      [taskId]: wordCount,
    }));
  };

  const getCurrentWritingTask = () => {
    return writingTasks.find((t) => t.task_order === currentWritingTask) || writingTasks[0];
  };

  // Helper functions for combined test flow
  const getTotalSections = () => {
    let total = 0;
    if (testQuestions.reading.length > 0) total++;
    if (testQuestions.listening.length > 0) total++;
    if (testQuestions.writing.length > 0) total++;
    console.log("🔍 Total sections calculation:", {
      reading: testQuestions.reading.length,
      listening: testQuestions.listening.length,
      writing: testQuestions.writing.length,
      total
    });
    return total;
  };

  const checkCompletedSections = async () => {
    if (!user?.id || !testId) return 0;
    
    try {
      // For combined tests, we need to track section completion differently
      // Since the database doesn't have section_type, we'll use localStorage
      // to track which sections have been completed
      const localStorageKey = `completed-sections-${testId}-${user.id}`;
      const completedSectionsData = localStorage.getItem(localStorageKey);
      
      if (completedSectionsData) {
        const completedSections = JSON.parse(completedSectionsData);
        let completedCount = 0;
        
        if (testQuestions.reading.length > 0 && completedSections.includes("reading")) completedCount++;
        if (testQuestions.listening.length > 0 && completedSections.includes("listening")) completedCount++;
        if (testQuestions.writing.length > 0 && completedSections.includes("writing")) completedCount++;
        
        return completedCount;
      }
      
      return 0;
    } catch (error) {
      console.error("Error checking completed sections:", error);
      return 0;
    }
  };

  const handleSubmitTest = async () => {
    if (isSubmitting) return;

    if (!submissionId) {
      console.error("No submission ID found, attempting to create submission");
      await createTestSubmission();
      if (!submissionId) {
        toast.error(
          "Cannot submit test - no active submission. Please refresh and try again.",
        );
        return;
      }
    }

    setIsSubmitting(true);

    // Test permissions first
    try {
      console.log("🧪 Testing submission permissions...");

      // Try to read the submission first to verify we have access
      const { data: testRead, error: readError } = await supabase
        .from("test_submissions")
        .select("id, student_id, status")
        .eq("id", submissionId)
        .single();

      if (readError) {
        console.error("❌ Cannot read submission:", readError);
        throw new Error(`Cannot access submission: ${readError.message}`);
      }

      console.log("✅ Can read submission:", testRead);

      if (testRead.student_id !== user?.id) {
        throw new Error(
          `Permission error: submission belongs to ${testRead.student_id}, current user is ${user?.id}`,
        );
      }

      console.log("✅ Permission check passed");
    } catch (permError: any) {
      console.error("❌ Permission test failed:", permError);
      toast.error(`Permission check failed: ${permError.message}`);
      setIsSubmitting(false);
      return;
    }

    try {
      console.log("📝 Submitting test with submission ID:", submissionId);
      console.log(
        "📊 Answers to submit:",
        Object.keys(answers).length,
        "answers",
      );
      console.log("👤 Current user:", user?.id);

      const updateData: any = {
        status: "submitted",
        submitted_at: new Date().toISOString(),
      };

      // Only add fields that might exist in the database
      if (Object.keys(answers).length > 0) {
        updateData.answers = answers;
      }

      // Try adding is_completed if the column exists
      try {
        updateData.is_completed = true;
      } catch (e) {
        console.warn("is_completed column might not exist");
      }

      const { error } = await supabase
        .from("test_submissions")
        .update(updateData)
        .eq("id", submissionId);

      if (error) {
        console.error("❌ Submit error details:", {
          message: error.message || "No message",
          code: error.code || "No code",
          details: error.details || "No details",
          hint: error.hint || "No hint",
          statusCode: error.statusCode || "No status",
          fullError: error,
        });
        throw error;
      }

      console.log("✅ Test submitted successfully");
      toast.success("Test submitted successfully!");
      
      // Check if this is a combined test with multiple sections
      const testType = test?.type?.toLowerCase();
      const totalSections = getTotalSections();
      console.log("🔍 Test type:", testType);
      console.log("🔍 Current section:", currentSection);
      console.log("🔍 Test object:", test);
      console.log("🔍 Test questions:", testQuestions);
      console.log("🔍 Total sections:", totalSections);
      
      // Check if this is a combined test (has multiple sections)
      if (totalSections > 1) {
        // Mark current section as completed in localStorage
        const localStorageKey = `completed-sections-${testId}-${user.id}`;
        const existingData = localStorage.getItem(localStorageKey);
        const completedSections = existingData ? JSON.parse(existingData) : [];
        
        if (!completedSections.includes(currentSection)) {
          completedSections.push(currentSection);
          localStorage.setItem(localStorageKey, JSON.stringify(completedSections));
        }
        
        // Check if all sections are completed
        const completedCount = completedSections.length;
        const totalSections = getTotalSections();
        
        console.log(`Completed sections: ${completedCount}/${totalSections}`);
        
        if (completedCount < totalSections) {
          // More sections to complete, redirect back to test start
          toast.info("Section completed! Continue with remaining sections.");
          navigate(`/student/test/${testId}/start`);
        } else {
          // All sections completed, redirect to history
          toast.success("All sections completed! Test submitted successfully.");
          navigate("/student/tests/history");
        }
      } else {
        // Single section test, redirect to history
        navigate("/student/tests/history");
      }
    } catch (error: any) {
      // Enhanced error logging with manual property inspection
      console.error("❌ Submit failed - Full error analysis:");
      console.error("Error type:", typeof error);
      console.error("Error constructor:", error?.constructor?.name);
      console.error("Error message:", error?.message);
      console.error("Error code:", error?.code);
      console.error("Error details:", error?.details);
      console.error("Error hint:", error?.hint);
      console.error("Error statusCode:", error?.statusCode);
      console.error("Error keys:", Object.keys(error || {}));
      console.error("Raw error:", error);

      // Try to get all enumerable properties
      if (error && typeof error === "object") {
        const allProps = Object.getOwnPropertyNames(error);
        console.error("All error properties:", allProps);
        allProps.forEach((prop) => {
          try {
            console.error(`Error.${prop}:`, error[prop]);
          } catch (e) {
            console.error(`Error.${prop}: [could not access]`);
          }
        });
      }

      const errorMessage = parseError(error);
      console.error("📝 Parsed error message:", errorMessage);

      // Handle specific error types
      if (
        error?.code === "42501" ||
        error?.message?.includes("permission denied") ||
        error?.message?.includes("RLS")
      ) {
        console.error("🔒 RLS Permission error detected");
        toast.error(
          "Permission error: Unable to submit test. Please contact your instructor.",
        );

        // Try to debug the permission issue
        console.group("🔍 RLS Debug Info");
        console.log("Submission ID:", submissionId);
        console.log("Student ID:", user?.id);
        console.log("Test ID:", testId);
        console.groupEnd();
      } else if (error?.code === "PGRST301") {
        toast.error("Database error: Please refresh the page and try again.");
      } else {
        toast.error(`Failed to submit test: ${errorMessage}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (!submissionId) return;

    try {
      await supabase
        .from("test_submissions")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          answers: answers,
          is_completed: true,
        })
        .eq("id", submissionId);

      toast.info("Time's up! Test submitted automatically.");
      
      // Check if this is a combined test with multiple sections
      const testType = test?.type?.toLowerCase();
      const totalSections = getTotalSections();
      
      // Check if this is a combined test (has multiple sections)
      if (totalSections > 1) {
        // Mark current section as completed in localStorage
        const localStorageKey = `completed-sections-${testId}-${user.id}`;
        const existingData = localStorage.getItem(localStorageKey);
        const completedSections = existingData ? JSON.parse(existingData) : [];
        
        if (!completedSections.includes(currentSection)) {
          completedSections.push(currentSection);
          localStorage.setItem(localStorageKey, JSON.stringify(completedSections));
        }
        
        // Check if all sections are completed
        const completedCount = completedSections.length;
        const totalSections = getTotalSections();
        
        console.log(`Completed sections: ${completedCount}/${totalSections}`);
        
        if (completedCount < totalSections) {
          // More sections to complete, redirect back to test start
          toast.info("Section completed! Continue with remaining sections.");
          navigate(`/student/test/${testId}/start`);
        } else {
          // All sections completed, redirect to history
          toast.success("All sections completed! Test submitted successfully.");
          navigate("/student/tests/history");
        }
      } else {
        // Single section test, redirect to history
        navigate("/student/tests/history");
      }
    } catch (error: any) {
      logError("handleAutoSubmit", error);
      const errorMessage = parseError(error);
      toast.error(`Auto-submit failed: ${errorMessage}`);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getSectionQuestions = (sectionType: string) => {
    return testQuestions[sectionType as keyof typeof testQuestions] || [];
  };

  const getCurrentQuestion = () => {
    const sectionQuestions = getSectionQuestions(currentSection);
    return sectionQuestions[currentQuestionIndex];
  };

  const renderQuestion = (question: any) => {
    const answer = answers[question.id];

    switch (question.type) {
      case "multiple_choice":
        // Handle different option formats
        let choices = [];
        if (question.options) {
          if (Array.isArray(question.options)) {
            choices = question.options;
          } else if (question.options.choices) {
            choices = question.options.choices;
          } else if (typeof question.options === "string") {
            try {
              const parsed = JSON.parse(question.options);
              choices = Array.isArray(parsed) ? parsed : parsed.choices || [];
            } catch {
              choices = [question.options];
            }
          }
        }

        if (choices.length === 0) {
          choices = ["Option A", "Option B", "Option C", "Option D"];
        }

        return (
          <div className="space-y-4">
            <RadioGroup
              value={answer || ""}
              onValueChange={(value) => handleAnswerChange(question.id, value)}
            >
              {choices.map((choice: string, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={choice}
                    id={`q${question.id}-${index}`}
                  />
                  <Label htmlFor={`q${question.id}-${index}`}>{choice}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case "true_false_not_given":
      case "yes_no_not_given":
        const tfngOptions =
          question.type === "true_false_not_given"
            ? ["True", "False", "Not Given"]
            : ["Yes", "No", "Not Given"];

        return (
          <div className="space-y-4">
            <RadioGroup
              value={answer || ""}
              onValueChange={(value) => handleAnswerChange(question.id, value)}
            >
              {tfngOptions.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={option}
                    id={`q${question.id}-${index}`}
                  />
                  <Label htmlFor={`q${question.id}-${index}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case "matching_headings":
        // Handle heading options
        let headingOptions = [];
        if (question.options) {
          if (Array.isArray(question.options)) {
            headingOptions = question.options;
          } else if (typeof question.options === "string") {
            try {
              const parsed = JSON.parse(question.options);
              headingOptions = Array.isArray(parsed)
                ? parsed
                : Object.values(parsed);
            } catch {
              headingOptions = [question.options];
            }
          } else {
            headingOptions = Object.values(question.options);
          }
        }

        if (headingOptions.length === 0) {
          headingOptions = [
            "A. Main heading option",
            "B. Secondary heading option",
            "C. Alternative heading option",
            "D. Additional heading option",
          ];
        }

        return (
          <div className="space-y-4">
            <RadioGroup
              value={answer || ""}
              onValueChange={(value) => handleAnswerChange(question.id, value)}
            >
              {headingOptions.map((heading: string, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={heading}
                    id={`q${question.id}-${index}`}
                  />
                  <Label htmlFor={`q${question.id}-${index}`}>{heading}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case "short_answer":
      case "sentence_completion":
        return (
          <Input
            placeholder="Enter your answer..."
            value={answer || ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full"
          />
        );

      case "essay":
        // Check if this is a writing task with additional properties
        if (question.task_title && question.section_type === "writing") {
          const currentTask = getCurrentWritingTask();
          if (!currentTask) {
            return <div>No writing task found</div>;
          }

          return (
            <div className="h-full flex flex-col">
              <Split
                className="flex-1 flex gap-4"
                minSize={200}
                sizes={[50, 50]}
                gutterSize={8}
                direction="horizontal"
                style={{ height: "100%" }}
              >
                {/* Left: Instructions/Prompt/Image */}
                <div className="bg-white rounded-lg shadow p-6 flex flex-col h-full overflow-auto min-w-[280px]">
                  <h2 className="text-lg font-bold mb-2">
                    {question.task_title}
                  </h2>
                  <div className="mb-2">
                    <span className="font-semibold">Instructions: </span>
                    {question.task_instructions?.trim()
                      ? question.task_instructions
                      : (question.section_number === 1
                        ? "Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words."
                        : "Present a well-organised response to the prompt. Write at least 250 words.")}
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">Prompt: </span>
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: question.question_text }}
                    />
                  </div>
                  {question.task_image_url && question.section_number === 1 && (
                    <div className="mb-2">
                      <img
                        src={question.task_image_url}
                        alt="Task visual"
                        className="w-full rounded border"
                      />
                    </div>
                  )}
                </div>

                {/* Right: Input Area */}
                <div className="bg-gray-50 rounded-lg shadow p-6 flex flex-col h-full min-w-[280px]">
                  <label className="block font-semibold mb-2" htmlFor={`textarea-${question.id}`}>
                    Your Answer for Task {question.section_number}
                  </label>
                  <textarea
                    id={`textarea-${question.id}`}
                    className="w-full flex-1 min-h-[350px] md:min-h-[400px] h-full border rounded p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                    placeholder={`Write your response to Task ${question.section_number} here...\n\nRemember to write at least ${question.word_limit || 150} words.`}
                    value={answer || ""}
                    onChange={(e) => handleWritingChange(question.id, e.target.value)}
                    disabled={isSubmitting}
                    maxLength={5000}
                    style={{ minHeight: '350px', height: '100%', flex: 1 }}
                  />
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>Min. words: {question.word_limit || 150}</span>
                    <span className={
                      (wordCounts[question.id] || 0) >= (question.word_limit || 150)
                        ? "text-green-600 font-semibold"
                        : "text-orange-600 font-semibold"
                    }>
                      Current: {wordCounts[question.id] || 0}
                    </span>
                  </div>
                </div>
              </Split>
            </div>
          );
        }

        // Fallback for regular essay questions
        return (
          <Textarea
            placeholder="Write your essay here..."
            value={answer || ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="min-h-[300px] w-full"
          />
        );

      default:
        return (
          <Input
            placeholder="Enter your answer..."
            value={answer || ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full"
          />
        );
    }
  };

  // Get sections for bottom navigation
  const getNavigationSections = () => {
    const testType = test?.type?.toLowerCase() || currentSection;

    if (testType === "reading" || testType === "reading_only") {
      // Group reading questions by passage number
      const passages = testQuestions.reading.reduce(
        (acc, q) => {
          const passageNum = q.section_number || 1;
          if (!acc[passageNum]) acc[passageNum] = [];
          acc[passageNum].push(q);
          return acc;
        },
        {} as Record<number, Question[]>,
      );

      return Object.keys(passages).map((num) => ({
        id: `passage-${num}`,
        label: `Passage ${num}`,
        count: passages[parseInt(num)].length,
        type: "reading",
      }));
    }

    if (testType === "listening" || testType === "listening_only") {
      // Group listening questions by section number
      const sections = testQuestions.listening.reduce(
        (acc, q) => {
          const sectionNum = q.section_number || 1;
          if (!acc[sectionNum]) acc[sectionNum] = [];
          acc[sectionNum].push(q);
          return acc;
        },
        {} as Record<number, Question[]>,
      );

      return Object.keys(sections).map((num) => ({
        id: `section-${num}`,
        label: `Section ${num}`,
        count: sections[parseInt(num)].length,
        type: "listening",
      }));
    }

    if (testType === "writing" || testType === "writing_only") {
      // Group writing questions by task number
      const tasks = testQuestions.writing.reduce(
        (acc, q) => {
          const taskNum = q.section_number || 1;
          if (!acc[taskNum]) acc[taskNum] = [];
          acc[taskNum].push(q);
          return acc;
        },
        {} as Record<number, Question[]>,
      );

      return Object.keys(tasks).map((num) => ({
        id: `task-${num}`,
        label: `Task ${num}`,
        count: tasks[parseInt(num)].length,
        type: "writing",
      }));
    }

    return [];
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
            <p>Loading test...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Test Not Found</h2>
          <Button onClick={() => navigate("/student/tests")}>
            Back to Tests
          </Button>
        </div>
      </div>
    );
  }

  // Show access request page if not approved
  if (!test.hasAccess) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>{test.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {test.requestStatus === "pending" ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-yellow-500" />
                <h3 className="text-lg font-semibold">Waiting for Approval</h3>
                <p className="text-muted-foreground">
                  Your request to take this test is pending. Please wait for
                  your instructor to approve it.
                </p>
              </>
            ) : test.requestStatus === "rejected" ? (
              <>
                <div className="h-12 w-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">✕</span>
                </div>
                <h3 className="text-lg font-semibold">Access Denied</h3>
                <p className="text-muted-foreground">
                  Your request to take this test was rejected.
                </p>
              </>
            ) : (
              <>
                <BookOpen className="h-12 w-12 mx-auto text-blue-500" />
                <h3 className="text-lg font-semibold">Test Access Required</h3>
                <p className="text-muted-foreground">
                  You need to request access from your instructor to take this
                  test.
                </p>
                <Button onClick={requestAccess} className="w-full">
                  Request Access
                </Button>
              </>
            )}
            <Button
              variant="outline"
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

  const currentQuestion = getCurrentQuestion();
  const sectionQuestions = getSectionQuestions(currentSection);
  const navigationSections = getNavigationSections();
  const progress =
    sectionQuestions.length > 0
      ? ((currentQuestionIndex + 1) / sectionQuestions.length) * 100
      : 0;

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-white shadow-sm flex-shrink-0">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">{test.title}</h1>
              <Badge variant="outline" className="capitalize">
                {currentSection}
              </Badge>
              {autoSaving && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Save className="h-4 w-4" />
                  Auto-saving...
                </div>
              )}
              {!submissionId && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  No submission
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <span
                  className={`font-mono text-lg ${timeRemaining < 600 ? "text-red-600" : "text-gray-700"}`}
                >
                  {formatTime(timeRemaining)}
                </span>
              </div>

              <Button
                onClick={async () => {
                  setAutoSaving(true);
                  await autoSaveAnswers();
                  if (!autoSaving) {
                    toast.success("Progress saved!");
                  }
                }}
                variant="outline"
                size="sm"
                disabled={autoSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                {autoSaving ? "Saving..." : "Save Now"}
              </Button>

              {process.env.NODE_ENV === "development" && (
                <Button
                  onClick={async () => {
                    console.log("🧪 Testing submission permissions...");
                    try {
                      const { data, error } = await supabase
                        .from("test_submissions")
                        .select("*")
                        .eq("id", submissionId);
                      console.log("Permission test result:", { data, error });
                      toast.success(
                        "Permission test completed - check console",
                      );
                    } catch (err) {
                      console.error("Permission test error:", err);
                      toast.error("Permission test failed - check console");
                    }
                  }}
                  variant="secondary"
                  size="sm"
                >
                  Test Permissions
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Send className="h-4 w-4 mr-2" />
                    Submit Test
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit Test</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to submit your test? This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleSubmitTest}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Submit"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Panel Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Passages/Content */}
        <div
          className="bg-white border-r overflow-y-auto"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <div className="p-6">
            {currentQuestion ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {currentQuestion.section_type === "reading" &&
                      "Reading Passage"}
                    {currentQuestion.section_type === "listening" &&
                      "Audio Section"}
                    {currentQuestion.section_type === "writing" &&
                      "Writing Task"}
                  </h2>
                  <Badge variant="secondary">
                    {currentQuestion.section_type === "reading" &&
                      `Passage ${currentQuestion.section_number}`}
                    {currentQuestion.section_type === "listening" &&
                      `Section ${currentQuestion.section_number}`}
                    {currentQuestion.section_type === "writing" &&
                      `Task ${currentQuestion.section_number}`}
                  </Badge>
                </div>

                {/* Reading Passage */}
                {currentQuestion.section_type === "reading" &&
                  (currentQuestion as any).passage_text && (
                    <div className="prose max-w-none">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: formatAndSanitizeText(
                            (currentQuestion as any).passage_text,
                          ),
                        }}
                      />
                    </div>
                  )}

                {/* Listening Audio */}
                {currentQuestion.section_type === "listening" &&
                  (currentQuestion as any).audio_url && (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg border">
                        <h3 className="font-semibold mb-3">
                          {(currentQuestion as any).section_title ||
                            `Listening Section ${currentQuestion.section_number}`}
                        </h3>
                        <audio controls className="w-full">
                          <source
                            src={(currentQuestion as any).audio_url}
                            type="audio/mpeg"
                          />
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    </div>
                  )}

                {/* Writing Task */}
                {currentQuestion.section_type === "writing" && (
                  <div className="space-y-4">
                    {(currentQuestion as any).task_image_url && (
                      <div className="p-4 bg-green-50 rounded-lg border">
                        <h3 className="font-semibold mb-3">Task Image</h3>
                        <img
                          src={(currentQuestion as any).task_image_url}
                          alt="Writing task"
                          className="max-w-full h-auto rounded"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a question to view content</p>
              </div>
            )}
          </div>
        </div>

        {/* Resizable Divider */}
        <div
          className="w-1 bg-gray-200 hover:bg-gray-300 cursor-col-resize flex items-center justify-center group"
          onMouseDown={handleMouseDown}
        >
          <div className="w-0.5 h-8 bg-gray-400 group-hover:bg-gray-600 rounded-full"></div>
        </div>

        {/* Right Panel - Questions */}
        <div
          className="bg-gray-50 overflow-y-auto"
          style={{ width: `${100 - leftPanelWidth}%` }}
        >
          <div className="p-6">
            {currentQuestion ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Question {currentQuestionIndex + 1} of{" "}
                    {sectionQuestions.length}
                  </h2>
                  <Progress value={progress} className="w-32" />
                </div>

                {/* Debug info - only show in development */}
                {process.env.NODE_ENV === "development" && (
                  <div className="text-xs text-gray-500 p-2 bg-yellow-50 rounded border">
                    <div className="grid grid-cols-2 gap-2">
                      <div>Question Type: {currentQuestion.type}</div>
                      <div>Submission ID: {submissionId || "❌ None"}</div>
                      <div>User ID: {user?.id || "❌ None"}</div>
                      <div>Test ID: {testId}</div>
                      <div>Total Questions: {sectionQuestions.length}</div>
                      <div>Current Section: {currentSection}</div>
                    </div>
                    <div className="mt-2">
                      Options:{" "}
                      {JSON.stringify(currentQuestion.options).substring(
                        0,
                        100,
                      )}
                      ...
                    </div>
                  </div>
                )}

                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="prose max-w-none">
                        <p className="text-lg leading-relaxed">
                          {currentQuestion.question_text}
                        </p>
                        {currentQuestion.section_type === "writing" &&
                          (currentQuestion as any).word_limit && (
                            <p className="text-sm text-muted-foreground">
                              Minimum words:{" "}
                              {(currentQuestion as any).word_limit}
                            </p>
                          )}
                      </div>
                      {renderQuestion(currentQuestion)}
                    </div>
                  </CardContent>
                </Card>

                {/* Scrollable Question Numbers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Questions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-16">
                      <div className="flex space-x-2 pb-2">
                        {sectionQuestions.map((q, index) => (
                          <Button
                            key={q.id}
                            variant={
                              index === currentQuestionIndex
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            className={`min-w-[40px] h-10 p-0 relative flex-shrink-0 ${answers[q.id] ? "bg-green-100 border-green-300" : ""}`}
                            onClick={() => setCurrentQuestionIndex(index)}
                          >
                            {index + 1}
                            {answers[q.id] && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></div>
                            )}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No questions available for this section.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar - Dynamic based on current section */}
      <div className="bg-white border-t py-2 px-4 flex-shrink-0">
        <div className="flex items-center justify-center space-x-4">
          {currentSection === "reading" && (
            // Reading passages navigation
            <>
              {[1, 2, 3].map((passageNum) => {
                const passageQuestions = testQuestions.reading.filter(
                  (q) => q.section_number === passageNum,
                );
                const hasQuestions = passageQuestions.length > 0;

                return (
                  <Button
                    key={`passage-${passageNum}`}
                    variant={hasQuestions ? "outline" : "ghost"}
                    className={`min-w-[140px] h-12 ${!hasQuestions ? "opacity-50" : ""}`}
                    disabled={!hasQuestions}
                    onClick={() => {
                      if (hasQuestions) {
                        const firstQuestionIndex = testQuestions.reading.findIndex(
                          (q) => q.section_number === passageNum,
                        );
                        if (firstQuestionIndex !== -1) {
                          setCurrentQuestionIndex(firstQuestionIndex);
                        }
                      }
                    }}
                  >
                    <div className="text-center">
                      <div className="font-semibold">Passage {passageNum}</div>
                      <div className="text-xs text-muted-foreground">
                        {hasQuestions
                          ? `${passageQuestions.length} questions`
                          : "Not assigned"}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </>
          )}

          {currentSection === "listening" && (
            // Listening sections navigation
            <>
              {[1, 2, 3, 4].map((sectionNum) => {
                const sectionQuestions = testQuestions.listening.filter(
                  (q) => q.section_number === sectionNum,
                );
                const hasQuestions = sectionQuestions.length > 0;

                return (
                  <Button
                    key={`section-${sectionNum}`}
                    variant={hasQuestions ? "outline" : "ghost"}
                    className={`min-w-[140px] h-12 ${!hasQuestions ? "opacity-50" : ""}`}
                    disabled={!hasQuestions}
                    onClick={() => {
                      if (hasQuestions) {
                        const firstQuestionIndex = testQuestions.listening.findIndex(
                          (q) => q.section_number === sectionNum,
                        );
                        if (firstQuestionIndex !== -1) {
                          setCurrentQuestionIndex(firstQuestionIndex);
                        }
                      }
                    }}
                  >
                    <div className="text-center">
                      <div className="font-semibold">Section {sectionNum}</div>
                      <div className="text-xs text-muted-foreground">
                        {hasQuestions
                          ? `${sectionQuestions.length} questions`
                          : "Not assigned"}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </>
          )}

          {currentSection === "writing" && (
            // Writing tasks navigation
            <>
              {writingTasks.map((task) => (
                <Button
                  key={`task-${task.task_order}`}
                  variant={currentWritingTask === task.task_order ? "default" : "outline"}
                  className="min-w-[140px] h-12"
                  onClick={() => {
                    setCurrentWritingTask(task.task_order);
                    // Find the question index for this task
                    const questionIndex = testQuestions.writing.findIndex(
                      (q) => q.section_number === task.task_order,
                    );
                    if (questionIndex !== -1) {
                      setCurrentQuestionIndex(questionIndex);
                    }
                  }}
                >
                  <div className="text-center">
                    <div className="font-semibold">Task {task.task_order}</div>
                    <div className="text-xs text-muted-foreground">
                      {task.task_title || `Writing Task ${task.task_order}`}
                    </div>
                  </div>
                </Button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TakeTestNew;
