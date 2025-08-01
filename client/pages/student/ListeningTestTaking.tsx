import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { parseContentForStudent } from "@/lib/contentParser";
import { markSectionCompleted, isAllSectionsCompleted } from "@/lib/testProgressUtils";
import { Clock, Headphones, Send, ArrowLeft, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

interface StudentAnswer {
  questionNumber: number;
  answer: string;
}

const ListeningTestTaking: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Debug: Log user state
  console.log("🔍 User authentication state:", {
    user: user?.id,
    testId,
    isAuthenticated: !!user
  });

  // States
  const [loading, setLoading] = useState(true);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [sections, setSections] = useState<any[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(3600); // Will be updated based on test type
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [testData, setTestData] = useState<any>(null);

  // Current section (computed from sections array and currentSectionIndex)
  const currentSection = sections[currentSectionIndex] || null;

  // --- Unified localStorage key for all state ---
  const localStorageKey = testId && user?.id ? `listening-test-${testId}-${user.id}` : null;

  // Debug: Log localStorage key
  console.log("🔍 localStorageKey:", localStorageKey);

  // --- Restore from localStorage on mount ---
  useEffect(() => {
    if (!localStorageKey) return;
    const saved = localStorage.getItem(localStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.answers) setStudentAnswers(parsed.answers);
        if (parsed.timeLeft) setTimeLeft(parsed.timeLeft);
        if (parsed.currentSectionIndex !== undefined) setCurrentSectionIndex(parsed.currentSectionIndex);
      } catch {}
    }
  }, [localStorageKey]);

  // --- Save to localStorage on every change ---
  useEffect(() => {
    if (!localStorageKey) return;
    localStorage.setItem(
      localStorageKey,
      JSON.stringify({
        answers: studentAnswers,
        timeLeft,
        currentSectionIndex,
        testId,
        timestamp: Date.now(),
      })
    );
  }, [studentAnswers, timeLeft, currentSectionIndex, localStorageKey, testId]);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Function to create demo test data
  const createDemoTestData = async (testId: string) => {
    try {
      console.log("Creating demo test data for:", testId);

      // Create the listening section
      const { data: newSection, error: createError } = await supabase
        .from("listening_sections")
        .insert({
          test_id: testId,
          title: "IELTS Listening Test - Section 1",
          content: `
            <h2>IELTS Listening Test - Section 1</h2>
            <p><strong>Questions 1–4</strong><br/>
            Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.</p>

            <div style="margin: 20px 0; padding: 20px; background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h3>Phone call about second-hand furniture</h3>

              <p><strong>Items for sale:</strong></p>
              <p>• Dining table: [1] shape, made of oak wood</p>
              <p>• Chairs: [2] available (matching set)</p>
              <p>• Total price: $[3] for the complete set</p>
              <p>• Contact time: Available after [4] PM</p>
            </div>

            <div style="margin: 20px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff;">
              <p style="font-weight: 600; margin-bottom: 12px;">5. What is the main reason for selling the furniture?</p>
              <div style="margin-left: 20px;">
                <div style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="radio" name="mcq_5" style="margin-right: 8px;" />
                    <span>A) Moving to a new house</span>
                  </label>
                </div>
                <div style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="radio" name="mcq_5" style="margin-right: 8px;" />
                    <span>B) Need money urgently</span>
                  </label>
                </div>
                <div style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="radio" name="mcq_5" style="margin-right: 8px;" />
                    <span>C) Furniture is too old</span>
                  </label>
                </div>
              </div>
            </div>
          `,
          instructions:
            "Listen to the audio recording and answer all questions. For short answers, write ONE WORD AND/OR A NUMBER. For multiple choice, select the correct option.",
          section_number: 1,
          duration_minutes: 30,
          section_type: "listening",
        })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create section:", createError);
        alert("Failed to create demo data. Please contact your instructor.");
        return;
      }

      // Create the listening questions
      const questions = [
        {
          section_id: newSection.id,
          question_text: "Dining table shape",
          question_type: "short_answer",
          question_number: 1,
          correct_answer: "round",
          points: 1,
          question_order: 1,
        },
        {
          section_id: newSection.id,
          question_text: "Number of chairs available",
          question_type: "short_answer",
          question_number: 2,
          correct_answer: "6",
          points: 1,
          question_order: 2,
        },
        {
          section_id: newSection.id,
          question_text: "Total price for the set",
          question_type: "short_answer",
          question_number: 3,
          correct_answer: "250",
          points: 1,
          question_order: 3,
        },
        {
          section_id: newSection.id,
          question_text: "Available contact time",
          question_type: "short_answer",
          question_number: 4,
          correct_answer: "5",
          points: 1,
          question_order: 4,
        },
        {
          section_id: newSection.id,
          question_text: "What is the main reason for selling the furniture?",
          question_type: "multiple_choice",
          question_number: 5,
          options: JSON.stringify([
            "Moving to a new house",
            "Need money urgently",
            "Furniture is too old",
          ]),
          correct_answer: "Need money urgently",
          points: 1,
          question_order: 5,
        },
      ];

      const { data: newQuestions, error: questionsError } = await supabase
        .from("listening_questions")
        .insert(questions)
        .select();

      if (questionsError) {
        console.error("Failed to create questions:", questionsError);
        alert(
          "Failed to create demo questions. Please contact your instructor.",
        );
        return;
      }

      console.log("Demo data created successfully");
      alert("Demo test data created successfully! The page will refresh now.");

      // Refresh the page to load the new data
      window.location.reload();
    } catch (error) {
      console.error("Error creating demo data:", error);
      alert("Error creating demo data. Please contact your instructor.");
    }
  };

  // Load test data
  const loadTestData = async () => {
    if (!testId) return;
    
    try {
      const { data: test, error } = await supabase
        .from("tests")
        .select("*")
        .eq("id", testId)
        .single();
        
      if (error) {
        console.error("Error loading test data:", error);
        return;
      }
      
      setTestData(test);
    } catch (error) {
      console.error("Error loading test data:", error);
    }
  };

  // Load listening section and handle time persistence
  const fetchSection = async (retryCount = 0) => {
    if (!testId) return;

    console.log(
      `🔍 Fetching sections for test ID: ${testId} (attempt ${retryCount + 1})`,
    );

    // Check for saved time
    const savedTime = localStorage.getItem(`listening-exam-time-${testId}`);
    console.log("🔍 Saved time from localStorage:", savedTime);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const { data, error } = await supabase
        .from("listening_sections")
        .select(
          `
          id,
          content,
          audio_url,
          section_number,
          listening_questions (
            id,
            question_text,
            question_type,
            question_number,
            question_order,
            options,
            correct_answer,
            points
          )
        `,
        )
        .eq("test_id", testId)
        .order("section_number")
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);
      console.log("🔍 Supabase response:", {
        data,
        error,
        dataLength: data?.length,
      });

      if (error) {
        console.error("❌ Error fetching sections:", error);

        let errorMessage = "Failed to load listening sections";

        // Handle different error types
        if (error?.message) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        } else if (error?.details) {
          errorMessage = error.details;
        }

        // Handle specific Supabase error codes
        if (error?.code) {
          if (error.code === "PGRST116") {
            errorMessage =
              "No listening sections found for this test. Please contact your instructor.";
          } else if (error.code.startsWith("PGRST")) {
            errorMessage = `Database error (${error.code}): ${error.message || errorMessage}`;
          }
        }

        console.error("❌ Processed error message:", errorMessage);
        alert(`Error loading test: ${errorMessage}`);
        setSections([]);
      } else if (!data || data.length === 0) {
        console.error("❌ No listening sections found for test:", testId);

        // Offer to create demo data for testing
        const createDemo = confirm(
          "No listening sections found for this test.\n\n" +
            "Would you like to create demo test data?\n\n" +
            "This will create a sample listening test with questions.",
        );

        if (createDemo) {
          await createDemoTestData(testId);
        } else {
          alert(
            "No listening sections found for this test. Please contact your instructor.",
          );
          setSections([]);
        }
      } else {
        console.log("✅ Sections loaded successfully:", data);
        console.log(
          "✅ Total questions found:",
          data.reduce((total, section) => total + (section.listening_questions?.length || 0), 0),
        );
        setSections(data);

        // Handle existing submission and time restoration
        console.log("🔍 Calling handleExistingSubmission with:", {
          sectionData: data[0],
          savedTime,
          user: user?.id,
          testData: testData?.type
        });
        
        await handleExistingSubmission(data[0], savedTime);
        
        console.log("✅ handleExistingSubmission completed");
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("❌ Unexpected error in fetchSection:", error);
      alert(`Unexpected error: ${error.message || error}`);
      setSections([]);
    }
  };

  // Fetch sections and test data on mount
  useEffect(() => {
    if (testId) {
      const initializeTest = async () => {
        await loadTestData();
        await fetchSection();
      };
      initializeTest();
    }
  }, [testId]);

  // Debug: Monitor user state changes
  useEffect(() => {
    console.log("🔍 User state changed:", {
      userId: user?.id,
      isAuthenticated: !!user,
      testId
    });
  }, [user, testId]);

  // Debug: Monitor submissionId state
  useEffect(() => {
    console.log("🔍 submissionId state changed:", submissionId);
  }, [submissionId]);

  // Start audio when sections are loaded
  useEffect(() => {
    if (sections.length > 0 && sections[0].audio_url && audioRef.current) {
      // Ensure audio starts playing when sections are loaded
      const audio = audioRef.current;
      if (audio.paused && !audio.ended) {
        audio.play().catch(error => {
          console.log('Audio autoplay prevented:', error);
          // This is normal - browsers often block autoplay
        });
      }
    }
  }, [sections]);

  // Prevent audio from restarting when switching sections
  useEffect(() => {
    // This effect ensures audio continues playing when switching sections
    // We don't need to do anything here as the audio element is outside the section-specific content
  }, [currentSectionIndex]);

  // Navigation functions
  const switchSection = (sectionIndex: number) => {
    if (sectionIndex >= 0 && sectionIndex < sections.length) {
      setCurrentSectionIndex(sectionIndex);
      // Don't restart audio - let it continue playing
    }
  };

  const nextSection = () => {
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      // Don't restart audio - let it continue playing
    }
  };

  const previousSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      // Don't restart audio - let it continue playing
    }
  };

  // Get current section questions
  const getCurrentSectionQuestions = () => {
    return currentSection?.listening_questions || [];
  };

  // After fetching the section and questions (wherever section is set):
  if (currentSection && currentSection.listening_questions) {
    console.log('DEBUG: Loaded questions:', currentSection.listening_questions.map(q => ({id: q.id, type: q.question_type, text: q.question_text})));
    currentSection.listening_questions.forEach(q => {
      if (q.question_type === 'map_labeling' || q.question_type === 'map_diagram') {
        let mapData = q.correct_answer;
        if (typeof mapData === 'string') {
          try { mapData = JSON.parse(mapData); } catch {}
        }
        console.log('DEBUG: Map question found:', {id: q.id, type: q.question_type, mapData});
      }
    });
  }

  // Timer with persistence
  useEffect(() => {
    if (timeLeft > 0 && !isSubmitting) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;

          // Auto-submit when time runs out
          if (newTime <= 0) {
            handleSubmit();
            return 0;
          }

          // Save time to localStorage for persistence
          localStorage.setItem(`listening-exam-time-${testId}`, newTime.toString());

          return newTime;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, isSubmitting, testId]);

  // Auto-save answers periodically
  useEffect(() => {
    if (submissionId && Object.keys(studentAnswers).length > 0) {
      const interval = setInterval(() => {
        autoSaveAnswers();
      }, 30000); // Auto-save every 30 seconds

      return () => clearInterval(interval);
    }
  }, [submissionId, studentAnswers]);

  // Fallback time restoration on component mount
  useEffect(() => {
    if (testId && !loading) {
      const savedTime = localStorage.getItem(`listening-exam-time-${testId}`);
      if (savedTime) {
        const timeValue = parseInt(savedTime);
        if (timeValue > 0 && timeValue !== timeLeft) {
          console.log("Fallback time restoration:", timeValue);
          setTimeLeft(timeValue);
        }
      }
    }
  }, [testId, loading, timeLeft]);

  // Handle page visibility changes (tab switching, minimizing)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("Page hidden - time continues in background");
      } else {
        console.log("Page visible - checking for time updates");
        // When page becomes visible, check if we need to sync time
        const savedTime = localStorage.getItem(`listening-exam-time-${testId}`);
        if (savedTime) {
          const timeValue = parseInt(savedTime);
          if (timeValue > 0 && Math.abs(timeValue - timeLeft) > 5) { // 5 second tolerance
            console.log("Syncing time from localStorage:", timeValue);
            setTimeLeft(timeValue);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [testId, timeLeft]);

  useEffect(() => {
    if (currentSection && currentSection.listening_questions) {
      console.log("Student UI: listening_questions", currentSection.listening_questions);
      console.log("Student UI: getOrderedAnswerBlanks", getOrderedAnswerBlanks());
    }
  }, [currentSection]);

  // Debug: Log when studentAnswers changes
  useEffect(() => {
    console.log("studentAnswers state changed:", studentAnswers);
    console.log("studentAnswers keys:", Object.keys(studentAnswers));
  }, [studentAnswers]);

  // Cleanup effect to prevent memory leaks and DOM manipulation errors
  useEffect(() => {
    return () => {
      // Cleanup function - runs when component unmounts
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    console.log(`Answer changed for question ${questionId}:`, value);
    
    setStudentAnswers((prev) => {
      const newAnswers = {
        ...prev,
        [questionId]: value,
      };
      console.log("Updated student answers:", newAnswers);
      return newAnswers;
    });

    // Debounced save on every answer change
    if (submissionId) {
      // Clear existing timeout
      if ((window as any).saveTimeout) {
        clearTimeout((window as any).saveTimeout);
      }
      
      // Set new timeout for 2 seconds
      (window as any).saveTimeout = setTimeout(() => {
        console.log("Debounced save triggered for answer change");
        autoSaveAnswers();
      }, 2000);
    }
  };

  // Handle existing submission and time restoration
  const handleExistingSubmission = async (sectionData: any, savedTime: string | null) => {
    try {
      // Check if user is authenticated
      if (!user?.id) {
        console.error("❌ User not authenticated - cannot create submission");
        toast.error("Please log in to take this test");
        navigate("/auth/login");
        return;
      }

      // Load test data if not already loaded
      let currentTestData = testData;
      if (!currentTestData && testId) {
        console.log("🔍 Loading test data for submission check...");
        const { data: test, error } = await supabase
          .from("tests")
          .select("*")
          .eq("id", testId)
          .single();
        
        if (error) {
          console.error("Error loading test data:", error);
          return;
        }
        currentTestData = test;
      }

      console.log("🔍 Checking for existing submission:", {
        testId,
        studentId: user?.id,
        savedTime,
        testType: currentTestData?.type
      });

      // Check for existing submission in test_submissions table
      const { data: existingSubmission, error: fetchError } = await supabase
        .from("test_submissions")
        .select("*")
        .eq("test_id", testId)
        .eq("student_id", user?.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 means no rows returned, which is expected for new submissions
        console.error("❌ Error fetching existing submission:", fetchError);
        throw fetchError;
      }

      if (existingSubmission) {
        console.log("✅ Found existing submission:", {
          id: existingSubmission.id,
          status: existingSubmission.status,
          hasAnswers: !!existingSubmission.answers
        });

        // Check if this is a full test and if the listening section is already completed
        if (currentTestData?.type?.toLowerCase() === "full") {
          // For full tests, check if listening section is completed
          const completedSections = existingSubmission.completed_sections || [];
          if (completedSections.includes('listening')) {
            toast.info("You have already completed the listening section");
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
        setStudentAnswers(existingSubmission.answers || {});

        // Restore time - use saved time if available, otherwise use submission time
        const currentTestType = currentTestData?.type?.toLowerCase();
        const isCurrentCombinedTest = currentTestType === "full";
        const defaultTime = isCurrentCombinedTest ? 60 * 60 : 3600; // 60 minutes for combined tests
        
        const timeToUse = savedTime
          ? parseInt(savedTime)
          : existingSubmission.time_remaining_seconds || defaultTime;

        setTimeLeft(timeToUse);
        console.log("✅ Restored existing submission with ID:", existingSubmission.id);
      } else {
        console.log("🔍 No existing submission found, creating new one...");
        
        // Create new submission
        const { data: newSubmission, error: submissionError } = await supabase
          .from("test_submissions")
          .insert({
            test_id: testId,
            student_id: user?.id,
            status: "in_progress",
            time_remaining_seconds: 3600, // 60 minutes default
            answers: {},
          })
          .select()
          .single();

        if (submissionError) {
          console.error("❌ Submission creation error:", submissionError);
          throw submissionError;
        }

        console.log("✅ Created new submission:", {
          id: newSubmission.id,
          testId: newSubmission.test_id,
          studentId: newSubmission.student_id
        });

        setSubmissionId(newSubmission.id);
        
        // Set timer based on test type (60 minutes for combined tests)
        const newTestType = currentTestData?.type?.toLowerCase();
        const isNewCombinedTest = newTestType === "full";
        const defaultTime = isNewCombinedTest ? 60 * 60 : 3600; // 60 minutes for combined tests
        
        setTimeLeft(defaultTime);
      }
    } catch (error: any) {
      console.error("❌ Error handling existing submission:", error);
      
      // Show user-friendly error message
      let errorMessage = "Failed to initialize test session";
      if (error?.message) {
        errorMessage += `: ${error.message}`;
      }
      
      toast.error(errorMessage);
      
      // Don't throw here, but log the error for debugging
      console.error("Full error details:", error);
    }
  };

  // Auto-save answers to database
  const autoSaveAnswers = async () => {
    if (!submissionId) return;

    try {
      const { error } = await supabase
        .from("test_submissions")
        .update({
          answers: studentAnswers,
          time_remaining_seconds: timeLeft,
        })
        .eq("id", submissionId);

      if (error) {
        console.error("Auto-save error:", error);
        throw error;
      }
      console.log("Auto-save successful");
    } catch (error: any) {
      console.error("Auto-save failed:", error);
      // Don't show error toast for auto-save failures
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Check if user is authenticated
      if (!user?.id) {
        console.error("❌ User not authenticated - cannot submit test");
        toast.error("Please log in to submit this test");
        navigate("/auth/login");
        return;
      }

      console.log("🔍 Attempting to submit test:", {
        submissionId,
        testId,
        studentId: user?.id,
        answersCount: Object.keys(studentAnswers).length,
        timeLeft
      });

      if (!submissionId) {
        console.error("❌ No submissionId found when trying to submit");
        toast.error("No active submission found. Please refresh the page and try again.");
        return;
      }

      // Get existing submission to merge answers
      const { data: currentSubmission } = await supabase
        .from("test_submissions")
        .select("answers")
        .eq("id", submissionId)
        .single();

      // Update existing submission
      const { error } = await supabase
        .from("test_submissions")
        .update({
          answers: {
            ...(currentSubmission?.answers || {}), // Keep existing answers from other sections
            ...studentAnswers // Add listening answers
          },
          status: "submitted",
          submitted_at: new Date().toISOString(),
          time_remaining_seconds: timeLeft,
        })
        .eq("id", submissionId);

      // Mark listening section as completed
      if (user?.id && testId) {
        await markSectionCompleted(testId, user.id, 'listening');
        
        // Check if all sections are completed and trigger auto-grading
        const { triggerAutoGrading } = await import('@/lib/testProgressUtils');
        const isAllCompleted = await isAllSectionsCompleted(testId, user.id);
        if (isAllCompleted) {
          await triggerAutoGrading(submissionId);
        }
      }

      if (error) {
        console.error("❌ Submission error:", error);
        const errorMessage = error.message || error.details || "Unknown error occurred";
        toast.error("Failed to submit answers: " + errorMessage);
        return;
      }

      console.log("✅ Submission saved successfully");
      
      // Clear saved time and answers from localStorage
      if (localStorageKey) localStorage.removeItem(localStorageKey);
      
      toast.success("Test submitted successfully!");

      // Check if this is part of a combined test
      const testType = testData?.type?.toLowerCase();
      const isCombinedTest = testType === "full";
      
              if (isCombinedTest) {
          // For combined tests, redirect back to test start page
          toast.info("Listening section completed! Continue with remaining sections.");
          navigate(`/student/test/${testId}`);
        } else {
          // For single section tests, redirect to history
          navigate("/student/tests/history");
        }
    } catch (error: any) {
      console.error("❌ Error submitting:", error);
      const errorMessage = error.message || error.details || "Unknown error occurred";
      toast.error("Failed to submit test: " + errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderInlineQuestion = (question: any, index: number) => {
    const questionNumber = question.question_number || index + 1;

    switch (question.question_type) {
      case "multiple_choice":
        // MCQ questions are now handled by custom TipTap nodes in renderNode
        // This case is kept for backward compatibility with old data
        return (
          <div key={question.id} className="mb-4 p-4 border border-gray-300 rounded-lg">
            <p className="font-semibold mb-3">
              Question {question.question_number}: Multiple Choice (Legacy Format)
            </p>
            <p className="text-sm text-gray-600">
              This question uses an older format. Please contact your instructor to update it.
            </p>
          </div>
        );

      case "short_answer":
      case "multiple_blank":
        // Short answer questions are now handled by custom TipTap nodes in renderNode
        // This case is kept for backward compatibility with old data
        return (
          <div key={question.id} className="mb-4 p-4 border border-gray-300 rounded-lg">
            <p className="font-semibold mb-3">
              Question {question.question_number}: Short Answer (Legacy Format)
            </p>
            <p className="text-sm text-gray-600">
              This question uses an older format. Please contact your instructor to update it.
            </p>
          </div>
        );

      case "matching":
        // Matching questions are now handled by custom TipTap nodes in renderNode
        // This case is kept for backward compatibility with old data
        return (
          <div key={question.id} className="mb-4 p-4 border border-gray-300 rounded-lg">
            <p className="font-semibold mb-3">
              Question {question.question_number}: Matching (Legacy Format)
            </p>
            <p className="text-sm text-gray-600">
              This question uses an older format. Please contact your instructor to update it.
            </p>
          </div>
        );

      default:
        // Default: Simple text with input field
        return (
          <div
            key={question.id}
            className="inline-flex items-center gap-2 mb-2"
          >
            <span>{question.question_text}</span>
            <input
              type="text"
              value={studentAnswers[question.id] || ""}
              onChange={(e) =>
                setStudentAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
              className="border border-gray-400 px-2 py-1 w-32 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        );
    }
  };

  const renderContent = (content: any) => {
    console.log("🔍 renderContent called with:", {
      contentType: typeof content,
      contentLength: content?.length || 0,
      hasQuestions: currentSection?.listening_questions?.length || 0,
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
          <div className="space-y-3">
            <Button
              onClick={async () => {
                if (
                  confirm(
                    "Would you like to create demo test data for this test?",
                  )
                ) {
                  await createDemoTestData(testId!);
                }
              }}
              className="mr-4"
            >
              Create Demo Data
            </Button>
            <Button
              onClick={() => navigate("/student/tests")}
              variant="outline"
            >
              Back to Tests
            </Button>
          </div>
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

  const renderContentWithEmbeddedQuestions = (content: string) => {
    let skipLines = 0; // Define at the correct scope for both HTML and plain text parsing
    // Parse HTML content properly to handle both text and HTML
    const parseHtmlContent = (htmlString: string) => {
      // Remove HTML tags and get clean lines
      const cleanContent = htmlString
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?(h[1-6]|p|div|strong|b|em|i|span)[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .split("\n")
        .filter((line) => line.trim());

      const elements: React.ReactNode[] = [];

      cleanContent.forEach((line, lineIndex) => {
        if (skipLines > 0) {
          skipLines--;
          return;
        }
        if (!line.trim()) {
          elements.push(<br key={lineIndex} />);
          return;
        }

        // Check for question patterns in the line
        if (line.includes("**Question") && line.includes("**")) {
          // MCQ or Matching question
          const questionMatch = line.match(/\*\*Question (\d+):\*\* (.+)/);
          if (questionMatch) {
            const questionNum = parseInt(questionMatch[1]);
            const questionText = questionMatch[2];
            const question = currentSection?.listening_questions?.find(
              (q) => q.question_number === questionNum,
            );

            if (question && question.question_type === "multiple_choice") {
              elements.push(renderInlineMCQ(question, questionText, lineIndex));
              // Skip the next N lines (MCQ options)
              const optionsCount = question.options ? (typeof question.options === 'string' ? JSON.parse(question.options).length : question.options.length) : 0;
              skipLines = optionsCount;
              return;
            } else if (question && question.question_type === "matching") {
              elements.push(renderInlineMatching(question, questionText, lineIndex));
              // Skip the next N lines (left+right items)
              let leftCount = 0;
              let rightCount = 0;
              
              if (question.options) {
                try {
                  const options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
                  leftCount = options?.left?.length || 0;
                  rightCount = options?.right?.length || 0;
                } catch (e) {
                  console.error("Error parsing question options:", e);
                }
              }
              
              skipLines = leftCount + rightCount;
              return;
            } else {
              elements.push(
                <p key={lineIndex} className="font-bold">
                  {line.replace(/\*\*/g, "")}
                </p>,
              );
            }
            return;
          }
        }
        // Handle different HTML formatting
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
          // Always check for [ ... ] and use renderLineWithBlanks
          if (line.includes("[") && line.includes("]")) {
            elements.push(renderLineWithBlanks(line, lineIndex));
            return;
          }
          // Handle question summary patterns by replacing with actual interactive questions
          let cleanLine = line;

          // Check for question summary patterns and replace with interactive questions
          const shortAnswerMatch = line.match(
            /Short Answer:\s*(\d+)\s*blank\(s\)/,
          );
          const mcqMatch = line.match(/MCQ\s*(\d+):\s*(.+)/);
          const matchingMatch = line.match(
            /Matching\s*(\d+)-(\d+):\s*(\d+)\s*pairs/,
          );

          if (shortAnswerMatch) {
            // Find corresponding question in database
            const questionNum =
              parseInt(shortAnswerMatch[1]) || lineIndex + 1;
            const dbQuestion = currentSection?.listening_questions?.find(
              (q) => q.question_number === questionNum,
            );
            if (dbQuestion) {
              elements.push(renderInlineQuestion(dbQuestion, lineIndex));
              return;
            }
          } else if (mcqMatch) {
            // Find corresponding MCQ question
            const questionNum = parseInt(mcqMatch[1]);
            const questionText = mcqMatch[2];
            const dbQuestion = currentSection?.listening_questions?.find(
              (q) => q.question_number === questionNum,
            );
            if (dbQuestion) {
              elements.push(renderInlineQuestion(dbQuestion, lineIndex));
              return;
            } else {
              // Fallback: clean the line format
              cleanLine = `${questionNum}. ${questionText}`;
            }
          } else if (matchingMatch) {
            // Find corresponding matching question
            const questionNum = parseInt(matchingMatch[1]);
            const dbQuestion = currentSection?.listening_questions?.find(
              (q) => q.question_number === questionNum,
            );
            if (dbQuestion) {
              elements.push(renderInlineQuestion(dbQuestion, lineIndex));
              return;
            }
          } else {
            // Regular line - clean any remaining prefixes
            cleanLine = cleanLine.replace(/MCQ\s*(\d+):\s*/g, "$1. ");
            cleanLine = cleanLine.replace(
              /Short Answer:\s*\d+\s*blank\(s\)/g,
              "",
            );
            cleanLine = cleanLine.replace(
              /Matching\s*\d+-\d+:\s*\d+\s*pairs/g,
              "",
            );
          }

          // Only render non-empty lines
          if (cleanLine.trim()) {
            elements.push(<p key={lineIndex}>{cleanLine}</p>);
          }
        }
      });

      return elements;
    };

    // Check if content is HTML-like
    if (content.includes("<") && content.includes(">")) {
      return (
        <div className="space-y-4 text-lg leading-relaxed">
          {parseHtmlContent(content)}
        </div>
      );
    }

    // For non-HTML content, parse line by line as before
    const lines = content.split("\n");
    skipLines = 0; // Define at the correct scope for both HTML and plain text parsing

    return (
      <div className="space-y-4 text-lg leading-relaxed">
        {lines.map((line: string, lineIndex: number) => {
          if (skipLines > 0) {
            skipLines--;
            return null; // Skip rendering lines that were skipped
          }
          if (!line.trim()) return <br key={lineIndex} />;

          // Check if line contains question patterns
          if (line.includes("[") && line.includes("]")) {
            // Fill-in-blank question
            return renderLineWithBlanks(line, lineIndex);
          } else if (line.includes("**Question") && line.includes("**")) {
            // MCQ or Matching question
            const questionMatch = line.match(/\*\*Question (\d+):\*\* (.+)/);
            if (questionMatch) {
              const questionNum = parseInt(questionMatch[1]);
              const questionText = questionMatch[2];
              const question = currentSection?.listening_questions?.find(
                (q) => q.question_number === questionNum,
              );

              if (question && question.question_type === "multiple_choice") {
                return renderInlineMCQ(question, questionText, lineIndex);
              } else if (question && question.question_type === "matching") {
                return renderInlineMatching(question, questionText, lineIndex);
              }
            }
            return (
              <p key={lineIndex} className="font-bold">
                {line.replace(/\*\*/g, "")}
              </p>
            );
          } else if (line.match(/^[A-Z]\)/)) {
            // MCQ option line - skip since it's handled by MCQ renderer
            return null;
          } else {
            // Regular text line - check for inline brackets
            if (line.includes("[") && line.includes("]")) {
              return renderLineWithBlanks(line, lineIndex);
            }
            // Handle HTML entities and ensure proper spacing
            const cleanedLine = line.replace(/&nbsp;/g, " ").trim();
            if (cleanedLine) {
              return (
                <p key={lineIndex} className="leading-relaxed text-lg mb-2">
                  {cleanedLine}
                </p>
              );
            }
          }
        })}
      </div>
    );
  };

  // Helper to build a flat ordered list of all answer blanks (short answer, MCQ, and each matching pair)
  const getOrderedAnswerBlanks = () => {
    if (!currentSection?.listening_questions) return [];
    const blanks = [];
    let currentNumber = 1;
    for (const q of currentSection.listening_questions.sort((a, b) => a.question_order - b.question_order)) {
      if (q.question_type === 'short_answer') {
        blanks.push({ id: q.id, question_number: currentNumber });
        currentNumber++;
      } else if (q.question_type === 'multiple_choice') {
        blanks.push({ id: q.id, question_number: currentNumber });
        currentNumber++;
      } else if (q.question_type === 'matching') {
        let matchingData = null;
        try {
          matchingData = typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer;
        } catch {
          matchingData = { left: [] };
        }
        
        // Ensure matchingData is not null and has the expected structure
        if (!matchingData || typeof matchingData !== 'object') {
          matchingData = { left: [] };
        }
        
        const leftItems = Array.isArray(matchingData.left) ? matchingData.left : [];
        for (let i = 0; i < leftItems.length; i++) {
          blanks.push({ id: `${q.id}_${i}`, question_number: currentNumber });
          currentNumber++;
        }
      }
    }
    return blanks;
  };

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
            let questionId: string | number = questionNumber;
            let isShortAnswer = false;
            if (questionNumber && currentSection?.listening_questions) {
              const q = currentSection.listening_questions.find(
                q => q.question_number === questionNumber && q.question_type === "short_answer"
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
                value={studentAnswers[questionId] || ""}
                onChange={(e) => handleAnswerChange(String(questionId), e.target.value)}
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

  const renderInlineMCQ = (
    question: any,
    questionText: string,
    key: number,
  ) => {
    const options =
      question.options &&
      (typeof question.options === "string"
        ? JSON.parse(question.options)
        : question.options);
    const questionNumber = question.question_number || key + 1;

    return (
      <div key={key} className="my-4">
        <div className="mb-2 font-medium">
          {questionNumber}. {questionText}
        </div>
        <div className="space-y-1">
          {options &&
            options.map((option: string, optIndex: number) => (
              <label
                key={optIndex}
                className="flex items-center cursor-pointer"
              >
                <input
                  type="radio"
                  name={`question_${question.id}`}
                  value={option}
                  checked={studentAnswers[question.id] === option}
                  onChange={(e) =>
                    setStudentAnswers((prev) => ({
                      ...prev,
                      [question.id]: e.target.value,
                    }))
                  }
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

  const renderInlineMatching = (
    question: any,
    questionText: string,
    key: number,
  ) => {
    let matchingData;
    console.log('DEBUG: Matching question object:', question);
    try {
      // Always try to parse options first
      matchingData =
        typeof question.options === "string"
          ? JSON.parse(question.options)
          : question.options;
      // If options is empty or invalid, try correct_answer
      if (!matchingData || (!matchingData.left && !matchingData.right)) {
        matchingData =
          typeof question.correct_answer === "string"
            ? JSON.parse(question.correct_answer)
            : question.correct_answer;
      }
    } catch {
      matchingData = { left: [], right: [] };
    }
    const leftItems = matchingData.left || [];
    const rightItems = matchingData.right || [];
    const questionNumber = question.question_number || key + 1;
    // Inline drag-and-drop UI
    return (
      <div key={key} className="flex flex-wrap items-center gap-4 my-4">
        {leftItems.map((leftItem: string, leftIndex: number) => {
          const answerKey = `${question.id}_${leftIndex}`;
          const selectedAnswer = studentAnswers[answerKey];
          return (
            <div key={leftIndex} className="flex items-center gap-2">
              <span className="font-medium">{leftItem}:</span>
              <div
                className="inline-block w-24 h-10 border-2 border-dashed border-gray-300 rounded bg-gray-50 text-center leading-10 text-base font-medium hover:border-blue-400 cursor-pointer"
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedText = e.dataTransfer.getData("text/plain");
                  setStudentAnswers((prev) => ({
                    ...prev,
                    [answerKey]: draggedText,
                  }));
                }}
                onDragOver={(e) => e.preventDefault()}
                onClick={() =>
                  selectedAnswer &&
                  setStudentAnswers((prev) => ({
                    ...prev,
                    [answerKey]: "",
                  }))
                }
              >
                {selectedAnswer || questionNumber + leftIndex}
              </div>
            </div>
          );
        })}
        {/* Draggable answer choices */}
        <div className="flex flex-wrap gap-2 ml-6">
          {rightItems.map((rightItem: string, rightIndex: number) => {
            const isUsed = Object.values(studentAnswers).includes(rightItem);
            return (
              <div
                key={rightIndex}
                draggable={!isUsed}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", rightItem);
                }}
                className={`px-3 py-2 rounded border cursor-move transition-all shadow-sm ${
                  isUsed
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50"
                    : "bg-white border-gray-300 hover:shadow-md hover:border-blue-300"
                }`}
              >
                {rightItem}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderNode = (node: any, index: number): React.ReactNode => {
    console.log("🔍 Rendering node:", node.type, node);

    // Safety check for custom nodes that require attrs
    if (["short_answer", "mcq", "matching", "map_labeling"].includes(node.type)) {
      if (!node.attrs) {
        console.warn("⚠️ Node missing attrs:", node);
        return (
          <div key={index} className="text-red-500">
            Invalid {node.type} node: missing attributes
          </div>
        );
      }
    }

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
        const level = node.attrs.level || 1;
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

      case "table":
        return (
          <table key={index} className="border border-gray-300 my-4 w-full">
            <tbody>{node.content?.map((row: any, rowIndex: number) => renderNode(row, rowIndex))}</tbody>
          </table>
        );

      case "tableRow":
        return (
          <tr key={index} className="border-b border-gray-300">
            {node.content?.map((cell: any, cellIndex: number) => renderNode(cell, cellIndex))}
          </tr>
        );

      case "tableCell":
        return (
          <td key={index} className="border border-gray-300 p-2">
            {node.content?.map((child: any, childIndex: number) =>
              renderNode(child, childIndex)
            )}
          </td>
        );

      case "tableHeader":
        return (
          <th key={index} className="border border-gray-300 p-2">
            {node.content?.map((child: any, childIndex: number) =>
              renderNode(child, childIndex)
            )}
          </th>
        );

      // Custom TipTap nodes for questions
      case "short_answer":
        const shortAnswerQuestion = currentSection?.listening_questions?.find(
          (q: any) => q.id === node.attrs.id
        );
        return (
            <input
            key={index}
              type="text"
            value={studentAnswers[node.attrs.id] || ""}
            onChange={(e) => handleAnswerChange(node.attrs.id, e.target.value)}
            placeholder={node.attrs.placeholder || `Answer ${node.attrs.question_number}`}
            className="inline-block w-15 border border-gray-300 rounded px-2 py-1 mx-1 text-sm"
            style={{ width: '15ch' }}
          />
        );

      case "mcq":
        const mcqQuestion = currentSection?.listening_questions?.find(
          (q: any) => q.id === node.attrs.id
        );
        const options = node.attrs.options || [];
        
        return (
          <div key={index} className="mb-4">
            <p className="font-medium mb-2">
              {node.attrs.question_number}. {node.attrs.question_text}
            </p>
            <div className="space-y-1">
              {options.map((option: string, optionIndex: number) => (
                <label key={optionIndex} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name={`mcq_${node.attrs.id}`}
                    value={option}
                    checked={studentAnswers[node.attrs.id] === option}
                    onChange={(e) => handleAnswerChange(node.attrs.id, e.target.value)}
                    className="mr-2"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case "matching":
        // For custom TipTap nodes, the data is in node.attrs, not in database questions
        const leftItems = node.attrs.left || [];
        const rightItems = node.attrs.right || [];
        
        return (
          <div key={index} className="mb-4">
            <div className="mb-3 text-sm text-gray-600">
              Drag the answer boxes to match with each item.
            </div>
            
            {/* Interactive drag-and-drop UI */}
            <div className="flex flex-wrap items-center gap-4">
              {leftItems.map((leftItem: string, leftIndex: number) => {
                const answerKey = `${node.attrs.id}_${leftIndex}`;
                const selectedAnswer = studentAnswers[answerKey];
                const questionNumber = node.attrs.question_number + leftIndex;
                return (
                  <div key={leftIndex} className="flex items-center gap-2">
                    <span className="font-medium">{leftItem}:</span>
                    <div
                      className="inline-block w-24 h-10 border-2 border-dashed border-gray-300 rounded bg-gray-50 text-center leading-10 text-base font-medium hover:border-blue-400 cursor-pointer"
                      onDrop={(e) => {
                        e.preventDefault();
                        const draggedText = e.dataTransfer.getData("text/plain");
                setStudentAnswers((prev) => ({
                  ...prev,
                          [answerKey]: draggedText,
                        }));
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() =>
                        selectedAnswer &&
                        setStudentAnswers((prev) => ({
                          ...prev,
                          [answerKey]: "",
                        }))
                      }
                    >
                      {selectedAnswer || questionNumber}
                    </div>
          </div>
        );
              })}
              
              {/* Draggable answer choices */}
              <div className="flex flex-wrap gap-2 ml-6">
                <div className="text-sm font-medium text-gray-600 mb-2">Answer choices:</div>
                {rightItems.map((rightItem: string, rightIndex: number) => {
                  const isUsed = Object.values(studentAnswers).includes(rightItem);
                  return (
                    <div
                      key={rightIndex}
                      draggable={!isUsed}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", rightItem);
                      }}
                      className={`px-3 py-2 rounded border cursor-move transition-all shadow-sm ${
                        isUsed
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50"
                          : "bg-white border-gray-300 hover:shadow-md hover:border-blue-300"
                      }`}
                    >
                      {rightItem}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case "map_labeling":
        const boxes = node.attrs.boxes || [];
        const imageUrl = node.attrs.imageUrl || '';
        
        // Extract available answers from boxes (assuming boxes have answer property)
        const availableAnswers = boxes.map((box: any) => box.answer || box.label).filter(Boolean);
        
        // Drag and drop handlers
        const handleDragStart = (e: React.DragEvent, answer: string) => {
          e.dataTransfer.setData('text/plain', answer);
        };
        
        const handleDrop = (e: React.DragEvent, boxId: string) => {
          e.preventDefault();
          const answer = e.dataTransfer.getData('text/plain');
          setStudentAnswers((prev) => ({
            ...prev,
            [`${node.attrs.id}_${boxId}`]: answer,
          }));
        };
        
        const handleDragOver = (e: React.DragEvent) => {
          e.preventDefault();
        };
        
        const handleRemoveAnswer = (boxId: string) => {
          setStudentAnswers((prev) => {
            const newAnswers = { ...prev };
            delete newAnswers[`${node.attrs.id}_${boxId}`];
            return newAnswers;
          });
        };
        
        // Get used answers to filter available ones
        const usedAnswers = boxes.map((box: any) => studentAnswers[`${node.attrs.id}_${box.id}`]).filter(Boolean);
        const availableAnswersForDrag = availableAnswers.filter((answer) => !usedAnswers.includes(answer));
        
        return (
          <div key={index} className="mb-4">
            <div className="mb-3 text-sm text-gray-600">
              Drag the labels to the marked positions on the image.
            </div>
            
            {imageUrl && (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img
                    src={imageUrl}
                    alt="Map/Diagram"
                    className="max-w-full h-auto border rounded"
                  />
                  {/* Render answer drop zones for each box */}
                  {boxes.map((box: any, boxIndex: number) => (
                    <div
                      key={boxIndex}
                      className="absolute w-16 h-8 border-2 border-dashed border-gray-400 bg-white/90 rounded flex items-center justify-center text-xs cursor-pointer hover:bg-gray-100"
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      onDrop={(e) => handleDrop(e, box.id)}
                      onDragOver={handleDragOver}
                      onClick={() => handleRemoveAnswer(box.id)}
                    >
                      {studentAnswers[`${node.attrs.id}_${box.id}`] ? (
                        <div className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-1 py-0.5 rounded">
                          {studentAnswers[`${node.attrs.id}_${box.id}`]}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAnswer(box.id);
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">{node.attrs.question_number + boxIndex}</span>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Answer options for drag and drop */}
                {availableAnswersForDrag.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <div className="text-sm font-medium text-gray-600 mb-2">Available labels:</div>
                    {availableAnswersForDrag.map((answer, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={(e) => handleDragStart(e, answer)}
                        className="bg-green-100 text-green-800 px-2 py-1 rounded cursor-move hover:bg-green-200 transition-colors border border-green-300 text-xs font-medium"
                      >
                        {answer}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      default:
        console.log("⚠️ Unknown node type:", node.type, node);
        return (
          <div key={index} className="text-red-500">
            Unknown content type: {node.type}
          </div>
        );
    }
  };

  const renderTextWithInputs = (text: string, index: number) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Find all question numbers in the text
    const questionMatches = Array.from(text.matchAll(/\[(\d+)\]/g));

    questionMatches.forEach((match, matchIndex) => {
      const questionNumber = parseInt(match[1]);
      
      // Find the question by question_number to get its ID
      const question = currentSection?.listening_questions?.find(q => q.question_number === questionNumber);
      const questionId = question?.id || questionNumber.toString();

      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${index}-${matchIndex}`}>
            {text.substring(lastIndex, match.index)}
          </span>,
        );
      }

      // Add the input field
      parts.push(
        <input
          key={`input-${index}-${questionNumber}`}
          type="text"
          value={studentAnswers[questionId] || ""}
          onChange={(e) => handleAnswerChange(questionId, e.target.value)}
          className="inline-block min-w-[100px] max-w-[200px] px-3 py-2 mx-1 border border-gray-400 rounded bg-white text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={questionNumber.toString()}
        />,
      );

      lastIndex = match.index + match[0].length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${index}-${lastIndex}`}>
          {text.substring(lastIndex)}
        </span>,
      );
    }

    return <span key={index}>{parts}</span>;
  };

  // Helper function to extract item label from content
  const extractItemLabel = (question: any, fallbackIndex: number): string => {
    // Try to get from content first
    if (currentSection?.content && typeof currentSection.content === "string") {
      const questionNum = question.question_number || fallbackIndex + 1;

      // Look for patterns like "• Dining table: [1]" or "Dining table: [1]"
      const patterns = [
        new RegExp(`•\\s*([^:]+):\\s*\\[${questionNum}\\]`, "i"),
        new RegExp(`([^:]+):\\s*\\[${questionNum}\\]`, "i"),
        new RegExp(`•\\s*([^\\[]+)\\[${questionNum}\\]`, "i"),
      ];

      for (const pattern of patterns) {
        const match = currentSection.content.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
    }

    // Try HTML parsing if available
    if (typeof document !== "undefined" && currentSection?.content) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = currentSection.content;
      const textContent = tempDiv.textContent || tempDiv.innerText || "";

      const questionNum = question.question_number || fallbackIndex + 1;
      const patterns = [
        new RegExp(`•\\s*([^:]+):\\s*\\[${questionNum}\\]`, "i"),
        new RegExp(`([^:]+):\\s*\\[${questionNum}\\]`, "i"),
      ];

      for (const pattern of patterns) {
        const match = textContent.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
    }

    // Fallback to extracting from question_text by removing "Question X:" prefix
    if (question.question_text) {
      const text = question.question_text
        .replace(/^Question\s+\d+:\s*/i, "")
        .trim();
      if (text && text !== question.question_text) {
        return text;
      }
    }

    return `Item ${fallbackIndex + 1}`;
  };

  // Function to render questions directly when content is empty
  const renderQuestionsInContext = () => {
    if (
      !currentSection?.listening_questions ||
      currentSection.listening_questions.length === 0
    ) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">No questions available for this test.</p>
        </div>
      );
    }

    const questions = currentSection.listening_questions.sort(
      (a, b) => a.question_order - b.question_order,
    );

    // Try to reconstruct the original context based on question data
    // This creates a natural flow like real IELTS exams
    return (
      <div className="space-y-6">
        {/* Main content with inline input fields */}
        <div className="text-lg leading-relaxed">
          <h3 className="font-semibold text-xl mb-4">
            Questions 1–{questions.length}
          </h3>
          <p className="mb-4">
            Complete the notes. Write ONE WORD AND/OR A NUMBER for each answer.
          </p>

          <div className="mb-6">
            <h4 className="font-medium mb-3">
              Phone call about second-hand furniture
            </h4>

            <div className="space-y-2">
              <p className="mb-3">
                <strong>Items:</strong>
              </p>
              {questions.map((question, index) => {
                if (question.question_type === "short_answer") {
                  const itemLabel = extractItemLabel(question, index);
                  return (
                    <div key={question.id} className="mb-2 text-lg">
                      <span className="inline">{itemLabel}: - </span>
                      <input
                        type="text"
                        value={
                          studentAnswers[question.id] || ""
                        }
                        onChange={(e) => {
                          setStudentAnswers((prev) => ({
                            ...prev,
                            [question.id]: e.target.value,
                          }));
                        }}
                        className="inline-block w-20 h-8 border border-gray-300 rounded bg-white text-center font-medium shadow-sm focus:outline-none focus:border-blue-500 focus:shadow-md mx-1"
                        placeholder={question.question_number?.toString()}
                      />
                    </div>
                  );
                } else {
                  return renderInlineQuestion(question, index);
                }
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuestionsDirectly = () => {
    if (
      !currentSection?.listening_questions ||
      currentSection.listening_questions.length === 0
    ) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">No questions available for this test.</p>
        </div>
      );
    }

    const questions = currentSection.listening_questions.sort(
      (a, b) => a.question_order - b.question_order,
    );

    // Group questions by type to provide better context
    const questionGroups: { [key: string]: any[] } = {};
    questions.forEach((q) => {
      const type = q.question_type || "other";
      if (!questionGroups[type]) questionGroups[type] = [];
      questionGroups[type].push(q);
    });

    return (
      <div className="space-y-8">
        {/* Main Instructions */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Instructions</h3>
          <p className="text-blue-700 text-sm">
            Listen to the audio and answer all questions. For short answers,
            write ONE WORD AND/OR A NUMBER. For multiple choice, select the
            correct option.
          </p>
        </div>

        {/* Render question groups with context */}
        {Object.entries(questionGroups).map(([type, groupQuestions]) => {
          if (type === "short_answer") {
            // Provide context for short answer questions
            const firstQ = groupQuestions[0]?.question_number || 1;
            const lastQ =
              groupQuestions[groupQuestions.length - 1]?.question_number ||
              firstQ;
            const range =
              firstQ === lastQ
                ? `Question ${firstQ}`
                : `Questions ${firstQ}–${lastQ}`;

            return (
              <div key={type} className="space-y-4">
                <div className="mb-4">
                  <h4 className="font-semibold text-lg mb-2">{range}</h4>
                  <p className="text-gray-700 mb-4">
                    Complete the notes below. Write ONE WORD AND/OR A NUMBER for
                    each answer.
                  </p>

                  {/* Create a context box for short answers */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
                    <h5 className="font-medium mb-3">Listening Exercise</h5>
                    <div className="space-y-2">
                      {groupQuestions.map((question) => (
                        <div
                          key={question.id}
                          className="flex items-center gap-2"
                        >
                          <span>{question.question_text || "Item"}:</span>
                          <div className="flex items-center gap-1">
                            <span>[</span>
                            <input
                              type="text"
                              value={
                                studentAnswers[question.id] || ""
                              }
                              onChange={(e) => {
                                setStudentAnswers((prev) => ({
                                  ...prev,
                                  [question.id]: e.target.value,
                                }));
                              }}
                              className="border border-gray-400 px-2 py-1 w-20 text-center bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={question.question_number?.toString()}
                            />
                            <span>]</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          } else {
            // Render other question types normally
            return (
              <div key={type} className="space-y-4">
                {groupQuestions.map((question, index) =>
                  renderInlineQuestion(question, index),
                )}
              </div>
            );
          }
        })}
      </div>
    );
  };

  // Add a renderMapDiagram function for student drag-and-drop map/diagram UI
  const renderMapDiagram = (question: any, key: number) => {
    const { imageUrl = '', boxes = [], id } = question;
    // Extract available answers from boxes
    const availableAnswers = boxes.map((box: any) => box.answer).filter(Boolean);
    // Track student answers in state
    const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
    const [localAvailableAnswers, setLocalAvailableAnswers] = useState(() => {
      const usedAnswers = boxes.map((box: any) => localAnswers[`${id}_${box.id}`]).filter(Boolean);
      return availableAnswers.filter((answer) => !usedAnswers.includes(answer)).sort(() => Math.random() - 0.5);
    });
    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, answer: string) => {
      e.dataTransfer.setData('text/plain', answer);
    };
    const handleDrop = (e: React.DragEvent, boxId: string) => {
      e.preventDefault();
      const answer = e.dataTransfer.getData('text/plain');
      setLocalAnswers((prev) => {
        const newAnswers = { ...prev };
        const oldAnswer = newAnswers[`${id}_${boxId}`];
        newAnswers[`${id}_${boxId}`] = answer;
        setLocalAvailableAnswers((prevAvailable) => {
          let updated = prevAvailable.filter((a) => a !== answer);
          if (oldAnswer) {
            updated.push(oldAnswer);
          }
          return updated.sort(() => Math.random() - 0.5);
        });
        return newAnswers;
      });
    };
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
    };
    const handleRemoveAnswer = (boxId: string) => {
      const currentAnswer = localAnswers[`${id}_${boxId}`];
      if (currentAnswer) {
        setLocalAnswers((prev) => {
          const newAnswers = { ...prev };
          delete newAnswers[`${id}_${boxId}`];
          setLocalAvailableAnswers((prevAvailable) =>
            [...prevAvailable, currentAnswer].sort(() => Math.random() - 0.5),
          );
          return newAnswers;
        });
      }
    };
    return (
      <div key={key} className="my-4">
        {imageUrl ? (
          <div className="space-y-4">
            <div className="relative inline-block">
              <img
                src={imageUrl}
                alt="Map/Diagram"
                className="max-w-full rounded border"
              />
              {/* Render answer drop zones for each box */}
              {boxes.map((box: any, idx: number) => (
                <div
                  key={box.id}
                  className="absolute w-16 h-8 border-2 border-dashed border-gray-400 bg-white/90 rounded flex items-center justify-center text-xs cursor-pointer hover:bg-gray-100"
                  style={{
                    left: `${box.x}%`,
                    top: `${box.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  onDrop={(e) => handleDrop(e, box.id)}
                  onDragOver={handleDragOver}
                >
                  {localAnswers[`${id}_${box.id}`] ? (
                    <div className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-1 py-0.5 rounded">
                      {localAnswers[`${id}_${box.id}`]}
                      <button
                        onClick={() => handleRemoveAnswer(box.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">{box.label}</span>
                  )}
                </div>
              ))}
            </div>
            {/* Answer options for drag and drop */}
            {availableAnswers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {localAvailableAnswers.map((answer, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, answer)}
                    className="bg-green-100 text-green-800 px-2 py-1 rounded cursor-move hover:bg-green-200 transition-colors border border-green-300 text-xs font-medium"
                  >
                    {answer}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 text-sm">No image provided.</div>
        )}
      </div>
    );
  };

  // Add comprehensive safety check
  if (!currentSection || !currentSection.listening_questions) {
    console.warn("⚠️ Section or listening_questions is null/undefined");
    return (
      <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">
              Loading test data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Safety check for content
  const content = currentSection.content;
  if (!content) {
    console.warn("⚠️ Section content is null/undefined");
    return (
      <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">
              No content available for this test.
            </p>
          </div>
        </div>
      </div>
    );
  }

  console.log("Section data:", {
    hasSection: !!currentSection,
    hasContent: !!currentSection.content,
    contentLength: currentSection.content?.length || 0,
    questionsCount: currentSection.listening_questions?.length || 0,
    content: currentSection.content,
  });

  const parsedContent =
    currentSection.content && currentSection.content.trim() !== ""
      ? (() => {
          if (typeof currentSection.content === "string") {
            try {
              return JSON.parse(currentSection.content);
            } catch {
              // If parsing fails, treat as plain text
              return currentSection.content;
            }
          }
          return currentSection.content;
        })()
      : currentSection.listening_questions && currentSection.listening_questions.length > 0
        ? null // Let renderContent handle this case
        : "No content available";

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Hidden Audio Element - Plays for entire test */}
      {/* IMPORTANT: Audio continues playing across all sections without interruption */}
      {/* This mimics real IELTS exam behavior where audio plays once for the entire test */}
      {sections.length > 0 && sections[0].audio_url && (
        <audio
          ref={audioRef}
          src={sections[0].audio_url}
          autoPlay
          style={{ display: 'none' }}
          onPlay={() => setIsPlaying(true)}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => console.error('Audio error:', e)}
        />
      )}

      {/* Exam Header - Fixed */}
      <div className="bg-white border-b-2 border-gray-300 shadow-sm flex-shrink-0 z-10">
        <div className="px-3 sm:px-4 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            {/* Left: Test Info */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex items-center space-x-2">
                <Headphones className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-gray-900">
                    IELTS Listening Test
                  </h1>
                  <p className="text-xs text-gray-600">Section {currentSection?.section_number}</p>
                </div>
              </div>

              {/* Audio Status Indicator */}
              {sections.length > 0 && sections[0].audio_url && (
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-xs text-gray-600">
                    {isPlaying ? 'Audio Playing' : 'Audio Paused'}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Timer and Controls */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Timer */}
              <div className="text-center bg-gray-50 rounded-lg px-2 sm:px-3 py-1 border">
                <div className="text-xs font-medium text-gray-700">
                  Time Remaining
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
                  <span
                    className={`font-mono text-sm sm:text-base font-bold ${
                      timeLeft < 600 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 sm:px-4 text-xs h-8"
              >
                <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                {isSubmitting ? "Submitting..." : "Submit Test"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Full Screen */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full bg-white">
          <div className="h-full flex flex-col">


            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-auto p-3 sm:p-6">
              <div className="w-full">
                {renderContent(parsedContent)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section Navigation - Only show if multiple sections exist */}
      {sections.length > 1 && (
        <div className="bg-white border-t-2 border-gray-300 px-1 flex-shrink-0 h-[40px] flex items-center justify-center">
          <div className="flex items-center justify-center space-x-1 w-full">
            {/* Previous Section Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={previousSection}
              disabled={currentSectionIndex === 0}
              className="h-8 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Section Buttons */}
            {sections.map((section, index) => {
              const isActive = index === currentSectionIndex;
              const hasAnswers = section.listening_questions?.some((q: any) => studentAnswers[q.id]);
              const allAnswered = section.listening_questions?.every((q: any) => studentAnswers[q.id]);
              
              return (
                <Button
                  key={section.id}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={`min-w-[80px] h-8 text-xs relative px-2 py-1 ${
                    hasAnswers ? "bg-green-50 border-green-300" : ""
                  } ${allAnswered ? "bg-green-100 border-green-400" : ""}`}
                  onClick={() => switchSection(index)}
                >
                  Section {section.section_number}
                  {allAnswered && section.listening_questions?.length > 0 && (
                    <CheckCircle className="absolute -top-1 -right-1 w-3 h-3 text-green-600 bg-white rounded-full" />
                  )}
                </Button>
              );
            })}

            {/* Next Section Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={nextSection}
              disabled={currentSectionIndex === sections.length - 1}
              className="h-8 px-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListeningTestTaking;
