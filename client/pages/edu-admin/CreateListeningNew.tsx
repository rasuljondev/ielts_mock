import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Headphones,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Upload,
  Save,
  Trash2,
  Play,
  Pause,
  Type,
  List,
  MousePointer,
  Map,
  Plus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

import { MediaUploader, MediaFile } from "@/components/ui/media-uploader";
import { UnifiedTestEditor } from "@/components/test-creation/UnifiedTestEditor";
import { toast } from "sonner";

interface Question {
  id: string;
  type: string;
  text: string;
  options?: string[];
  correctAnswer: any;
  points: number;
  position: number;
}

const CreateListeningNew: React.FC = () => {
  const { testId, sectionNumber } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);

  // State management
  const [currentTest, setCurrentTest] = useState<any>(null);
  const [sectionTitle, setSectionTitle] = useState(
    `Section ${sectionNumber || "1"}`,
  );
  const [sectionInstructions, setSectionInstructions] = useState(
    "Listen to the audio and answer the questions.",
  );
  const [content, setContent] = useState("");
  const [editorQuestions, setEditorQuestions] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [audioUrl, setAudioUrl] = useState<string>("");

  // UI states
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTest, setIsLoadingTest] = useState(true);
  const [message, setMessage] = useState({ type: "", content: "" });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [editorRef, setEditorRef] = useState<any>(null);
  const [startingQuestionNumber, setStartingQuestionNumber] = useState(1);

  // Add a stable storage key for the whole page
  const pageDraftKey = `listening-page-draft-${testId || 'default'}-${sectionNumber || 'default'}`;

  // Add a function to save the entire page state
  const savePageDraft = (extra?: Partial<any>) => {
    const draft = {
      sectionTitle,
      sectionInstructions,
      content: typeof content === "string" ? content : JSON.stringify(content),
      questions,
      mediaFiles,
      audioUrl,
      editorQuestions,
      ...extra,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(pageDraftKey, JSON.stringify(draft));
  };

  // Add a function to load the draft
  const loadPageDraft = () => {
    try {
      const saved = localStorage.getItem(pageDraftKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  // Add a function to clear the draft
  const clearPageDraft = () => {
    localStorage.removeItem(pageDraftKey);
  };

  const calculateStartingQuestionNumber = () => {
    const currentSectionNum = parseInt(sectionNumber || "1");
    // Each section has 10 questions: Section 1 (1-10), Section 2 (11-20), etc.
    const startingNumber = (currentSectionNum - 1) * 10 + 1;
    console.log(`📊 Listening Section ${currentSectionNum}: Starting with question ${startingNumber}`);
    setStartingQuestionNumber(startingNumber);
  };

  // Update questions from editor
  const handleEditorQuestionsChange = (editorQuestions: any[]) => {
    console.log("🔍 Processing Editor Questions:", editorQuestions);
    setEditorQuestions(editorQuestions);
    // Convert editor questions to parent Question type for summary and persistence
    const convertedQuestions = editorQuestions.map((q, index) => {
      let options = null;
      let correctAnswer = null;
      if (q.type === "multiple_choice") {
        options = q.content.options;
        correctAnswer = q.content.correctAnswer;
        
        console.log("🔍 Processing MCQ Question in handleEditorQuestionsChange:", {
          questionId: q.id,
          content: q.content,
          correctAnswer: correctAnswer,
          correctAnswerType: typeof correctAnswer,
          options: options,
          optionsType: typeof options
        });
      } else if (q.type === "matching") {
        console.log("🔍 Processing Matching Question in handleEditorQuestionsChange:", {
          questionId: q.id,
          content: q.content,
          left: q.content.left,
          right: q.content.right,
          leftType: typeof q.content.left,
          rightType: typeof q.content.right,
          leftIsArray: Array.isArray(q.content.left),
          rightIsArray: Array.isArray(q.content.right)
        });
        
        // Ensure options is a JSON string of { left, right }
        if (q.content.options && typeof q.content.options !== "string") {
          options = JSON.stringify(q.content.options);
        } else {
          options = q.content.options;
        }
        
        // For matching questions, create pairs from left and right arrays
        if (q.content.left && q.content.right && Array.isArray(q.content.left) && Array.isArray(q.content.right)) {
          const pairs = q.content.left.map((leftItem: string, index: number) => ({
            left: leftItem,
            right: q.content.right[index] || ""
          }));
          correctAnswer = JSON.stringify(pairs);
          
          console.log("🔍 Matching Question Extraction:", {
            questionNumber: index + 1,
            left: q.content.left,
            right: q.content.right,
            pairs,
            correctAnswer
          });
        } else {
          // Fallback: try to get from correct_answer if it exists
          if (q.content.correct_answer && typeof q.content.correct_answer !== "string") {
            correctAnswer = JSON.stringify(q.content.correct_answer);
          } else {
            correctAnswer = q.content.correct_answer;
          }
          
          console.log("🔍 Matching Question Fallback:", {
            questionNumber: index + 1,
            correctAnswer,
            content: q.content
          });
        }
      } else if (q.type === "short_answer") {
        options = null;
        // Try to get correct answer from multiple sources
        let correctAnswerValue = null;
        
        // Check if answers is an array and has values
        if (Array.isArray(q.content.answers) && q.content.answers.length > 0) {
          correctAnswerValue = q.content.answers.join(", ");
        } else if (q.content.correctAnswer) {
          correctAnswerValue = q.content.correctAnswer;
        } else if (q.content.attrs?.correctAnswer) {
          correctAnswerValue = q.content.attrs.correctAnswer;
        } else if (q.attrs?.correctAnswer) {
          correctAnswerValue = q.attrs.correctAnswer;
        } else if (q.attrs?.answers && Array.isArray(q.attrs.answers) && q.attrs.answers.length > 0) {
          correctAnswerValue = q.attrs.answers.join(", ");
        }
        
        correctAnswer = correctAnswerValue;
        
        console.log("🔍 Short Answer Extraction:", {
          questionNumber: index + 1,
          contentAnswers: q.content.answers,
          contentCorrectAnswer: q.content.correctAnswer,
          contentAttrsCorrectAnswer: q.content.attrs?.correctAnswer,
          nodeAttrsCorrectAnswer: q.attrs?.correctAnswer,
          nodeAttrsAnswers: q.attrs?.answers,
          finalCorrectAnswer: correctAnswer
        });
      } else if (q.type === "map_diagram" || q.type === "map_labeling") {
        // For map/diagram questions, save boxes as correct answer
        if (q.content.boxes && Array.isArray(q.content.boxes)) {
          correctAnswer = JSON.stringify(q.content.boxes);
        } else {
          correctAnswer = null;
        }
        // Force type to 'map_labeling' for DB
        return {
          id: q.id,
          type: "map_labeling",
          text: q.content.question || q.content.text || q.content.prompt || `Question ${index + 1}`,
          options,
          correctAnswer,
          points: 1,
          position: index + 1,
        };
      }
      return {
        id: q.id,
        type: q.type,
        text: q.content.question || q.content.text || q.content.prompt || `Question ${index + 1}`,
        options,
        correctAnswer,
        points: 1,
        position: index + 1,
      };
    });
    setQuestions(convertedQuestions);
  };

  // Utility function to update existing questions with correct answers


  // Quick connectivity test
  // Removed demo connectivity test function
  const quickConnectivityTest = async (): Promise<
    boolean | "extension_interference"
  > => {
    return true; // Simplified - always return true
    try {
      console.log("🔍 Quick connectivity test...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(
        import.meta.env.VITE_SUPABASE_URL + "/rest/v1/",
        {
          method: "HEAD",
          signal: controller.signal,
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        },
      );

      clearTimeout(timeoutId);
      console.log("✅ Connectivity test passed:", response.status);
      return true;
    } catch (error: any) {
      console.log("❌ Connectivity test failed:", error.message);
      console.log("❌ Error stack:", error.stack);

      // Check for browser extension interference
      if (error.stack?.includes("chrome-extension://")) {
        console.log("🔌 Browser extension interference detected!");
        setMessage({
          type: "error",
          content:
            "🔌 Browser Extension Blocking Network Requests!\n\n" +
            "A browser extension is preventing access to Supabase.\n\n" +
            "�� Quick fixes:\n" +
            "• Try incognito/private browsing mode\n" +
            "• Disable ad blockers temporarily\n" +
            "• Whitelist this site in your extensions\n\n" +
            "💡 Common culprits: uBlock Origin, AdBlock Plus, Privacy Badger",
        });
        return false;
      }

      if (error.name === "AbortError") {
        console.log("⏰ Connection timeout - server too slow or unreachable");
      }
      return false;
    }
  };



  // When loading draft or test data, parse content as JSON if it's a string
  useEffect(() => {
    const draft = loadPageDraft();
    if (draft) {
      setSectionTitle(draft.sectionTitle || `Section ${sectionNumber || "1"}`);
      setSectionInstructions(draft.sectionInstructions || "Listen to the audio and answer the questions.");
      let loadedContent = draft.content || "";
      if (typeof loadedContent === "string") {
        try {
          loadedContent = JSON.parse(loadedContent);
        } catch {}
      }
      setContent(loadedContent);
      setQuestions(draft.questions || []);
      setMediaFiles(draft.mediaFiles || []);
      setAudioUrl(draft.audioUrl || "");
      setEditorQuestions(draft.editorQuestions || []);
      setEditorResetKey((k) => k + 1); // force remount editor with restored content
    }
  }, []);

  // When saving, store content as a JSON string
  useEffect(() => {
    savePageDraft();
  }, [sectionTitle, sectionInstructions, content, questions, mediaFiles, audioUrl, editorQuestions]);

  // Update UnifiedTestEditor usage to accept a reset prop
  const [editorResetKey, setEditorResetKey] = useState(0);

  // Load test data on mount
  useEffect(() => {
    const loadTestData = async () => {
      if (!testId) {
        setMessage({
          type: "error",
          content:
            "No test ID provided. Please navigate to this page from a test creation flow, or go to the admin dashboard to create a new test first.",
        });
        setIsLoadingTest(false);
        return;
      }

      console.log("Loading test with ID:", testId, "Type:", typeof testId);
      setIsLoadingTest(true);


      if (false) { // Removed demo mode logic
        // Extension interference detected - enable demo mode
        console.warn(
          "🔌 Extension interference detected, enabling demo mode...",
        );
        setMessage({
          type: "warning",
          content:
            "🔌 Browser Extension Detected - Running in Demo Mode\n\n" +
            "A browser extension is blocking database requests, but you can still test the editor!\n\n" +
            "📝 Demo mode allows you to:\n" +
            "• Test all question types\n" +
            "• Use the rich text editor\n" +
            "• Preview functionality\n\n" +
            "💡 To save data permanently:\n" +
            "• Try incognito mode\n" +
            "• Disable ad blockers temporarily\n" +
            "• Whitelist this site in browser extensions",
        });

        // Set up demo test data
        setCurrentTest({
          id: testId,
          title: "Demo Test (Extension Interference)",
          description: "Demo mode - browser extension blocking database access",
          created_at: new Date().toISOString(),
        });

        setIsLoadingTest(false);
        return; // Continue in demo mode
      } else if (false) { // Removed demo mode logic
        // Check if we can operate in demo mode
        const isDemoUrl = import.meta.env.VITE_SUPABASE_URL?.includes(
          "demo.supabase.co",
        );
        if (isDemoUrl) {
          console.warn("⚠️ Running in demo mode due to connectivity issues");
          setMessage({
            type: "warning",
            content:
              "⚠️ Demo Mode: Limited functionality due to connectivity issues.\n\nSome features may not work properly.",
          });
          // Continue execution in demo mode
        } else {
          throw new Error(
            '🌐 Connection failed: Cannot reach Supabase server\n\nPlease check:\n• Internet connection\n• Supabase project status\n�� Firewall settings\n\nTry clicking "Test DB" button for detailed diagnostics.',
          );
        }
      }

      // Validate testId format (should be a UUID)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(testId)) {
        throw new Error(
          `Invalid test ID format. Expected UUID, got: ${testId}`,
        );
      }

      try {
        // First test database connection
        console.log("Testing database connection...");
        console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
        console.log(
          "Using demo mode:",
          import.meta.env.VITE_SUPABASE_URL?.includes("demo.supabase.co"),
        );

        const { data: connectionTest, error: connectionError } = await supabase
          .from("tests")
          .select("id")
          .limit(1);

        if (connectionError) {
          console.error("Database connection failed:", connectionError);
          console.error("Error message:", connectionError.message);
          console.error("Error code:", connectionError.code);
          console.error("Error details:", connectionError.details);
          console.error("Error hint:", connectionError.hint);

          // Try to serialize the error properly
          try {
            console.error(
              "Full error object (serialized):",
              JSON.stringify(connectionError, null, 2),
            );
          } catch (e) {
            console.error("Could not serialize error object");
          }

          // Check for browser extension interference
          const isExtensionError =
            connectionError.details?.includes("chrome-extension://") ||
            connectionError.message?.includes("chrome-extension://") ||
            (connectionError.message?.includes("Failed to fetch") &&
              connectionError.details?.includes("chrome-extension://"));

          if (isExtensionError) {
            console.warn(
              "🔌 Extension interference detected, enabling demo mode...",
            );

            // Enable demo mode instead of throwing error
            setMessage({
              type: "warning",
              content:
                "🔌 Browser Extension Detected - Running in Demo Mode\n\n" +
                "A browser extension is blocking database requests, but you can still test the editor!\n\n" +
                "📝 Demo mode allows you to:\n" +
                "• Test all question types\n" +
                "• Use the rich text editor\n" +
                "• Preview functionality\n\n" +
                "💡 To save data permanently:\n" +
                "• Try incognito mode\n" +
                "• Disable ad blockers temporarily\n" +
                "• Whitelist this site in browser extensions",
            });

            // Set up demo test data
            setCurrentTest({
              id: testId,
              title: "Demo Test (Extension Interference)",
              description:
                "Demo mode - browser extension blocking database access",
              created_at: new Date().toISOString(),
            });

            setIsLoadingTest(false);
            return; // Continue in demo mode instead of throwing
          }

          // Extract meaningful error information
          let errorMessage = "Database connection failed";
          let errorDetails = [];

          if (connectionError.message) {
            errorDetails.push(`Message: ${connectionError.message}`);
          }
          if (connectionError.code) {
            errorDetails.push(`Code: ${connectionError.code}`);
          }
          if (connectionError.details) {
            errorDetails.push(`Details: ${connectionError.details}`);
          }
          if (connectionError.hint) {
            errorDetails.push(`Hint: ${connectionError.hint}`);
          }

          const fullErrorMessage =
            errorDetails.length > 0
              ? `${errorMessage}\n\n${errorDetails.join("\n")}`
              : errorMessage;

          // More specific error handling
          if (connectionError.message?.includes("Failed to fetch")) {
            throw new Error(
              "🌐 Network Error: Cannot reach Supabase server\n\nPossible causes:\n• Browser extension blocking requests\n• No internet connection\n• Supabase project paused/deleted\n• Firewall blocking connection\n• Invalid Supabase URL\n\n💡 Try incognito mode to test if extensions are the issue.",
            );
          } else if (
            connectionError.message?.includes("JWT") ||
            connectionError.code === "401"
          ) {
            throw new Error(
              "🔐 Authentication Error: Invalid credentials\n\nCheck your .env file:\n• VITE_SUPABASE_URL\n• VITE_SUPABASE_ANON_KEY",
            );
          } else if (connectionError.code === "PGRST301") {
            throw new Error(
              '🚫 Access Denied: RLS policies blocking access\n\nCheck your Supabase RLS policies for the "tests" table.',
            );
          } else {
            throw new Error(fullErrorMessage);
          }
        }

        console.log(
          "Database connection successful, found",
          connectionTest?.length || 0,
          "tests in total",
        );
        // First, let's check if the test exists without using .single()
        const { data, error } = await supabase
          .from("tests")
          .select("*")
          .eq("id", testId);

        console.log("Supabase response:", {
          data,
          error,
          rowCount: data?.length,
        });

        if (error) {
          console.error("Supabase error details:", error);
          throw error;
        }

        if (!data || data.length === 0) {
          throw new Error(`Test not found. No test exists with ID: ${testId}`);
        }

        if (data.length > 1) {
          console.warn("Multiple tests found with same ID:", data);
          throw new Error(
            `Database inconsistency: Multiple tests found with ID: ${testId}`,
          );
        }

        const testData = data[0];

        setCurrentTest(testData);
        console.log("Test loaded successfully:", testData.title);
        
        // Calculate starting question number for this section
        calculateStartingQuestionNumber();
      } catch (error: any) {
        console.error("❌ Error loading test:", error);
        console.error("📊 Error type:", typeof error);
        console.error("🔑 Error keys:", Object.keys(error || {}));

        // Log specific error properties
        if (error) {
          console.error("📝 Error message:", error.message);
          console.error("🔢 Error code:", error.code);
          console.error("📋 Error details:", error.details);
          console.error("💡 Error hint:", error.hint);
          console.error("🏷️ Error name:", error.name);
        }

        let errorMessage = "Failed to load test data";
        let errorDetails = [];

        // Check for browser extension interference first
        if (false) { // Removed demo function
          errorMessage = "�� Browser Extension Interference Detected!";
          const warnings = []; // Removed demo function
          errorDetails = [
            "A browser extension is blocking network requests.",
            "",
            ...warnings,
            "",
            "🚀 Quick solutions:",
            "• Open incognito/private browsing mode",
            "• Disable all browser extensions temporarily",
            "• Whitelist this site in your ad blocker",
          ];
        }
        // Handle network errors specifically
        else if (
          error?.name === "TypeError" &&
          error?.message?.includes("Failed to fetch")
        ) {
          errorMessage = "🌐 Network Error: Cannot reach Supabase";
          errorDetails = [
            "Possible causes:",
            "• Browser extension interference (most common)",
            "• No internet connection",
            "• Supabase project paused/deleted",
            "• Firewall blocking connection",
            "• Invalid Supabase URL",
            "",
            `Current URL: ${import.meta.env.VITE_SUPABASE_URL}`,
            "",
            "Solutions:",
            "• Try incognito mode (rules out extensions)",
            "• Check internet connection",
            "• Verify Supabase project is active",
            "• Check .env configuration",
            "• Try the 'Test DB' button for more details",
          ];
        }
        // Handle specific error messages
        else if (error?.message) {
          if (error.message.includes("multiple (or no) rows returned")) {
            errorMessage = `❌ Test not found: "${testId}"`;
            errorDetails = [
              "The test ID does not exist in the database.",
              "Check if the test was created successfully.",
            ];
          } else if (error.message.includes("JSON object requested")) {
            errorMessage = `⚠️ Database query error`;
            errorDetails = [error.message];
          } else if (
            error.message.includes("Network connection failed") ||
            error.message.includes("🌐")
          ) {
            errorMessage = error.message;
          } else {
            errorMessage = error.message;
            if (error.code) errorDetails.push(`Code: ${error.code}`);
            if (error.details) errorDetails.push(`Details: ${error.details}`);
            if (error.hint) errorDetails.push(`Hint: ${error.hint}`);
          }
        } else if (typeof error === "string") {
          errorMessage = error;
        } else if (error?.error) {
          if (typeof error.error === "string") {
            errorMessage = error.error;
          } else {
            try {
              errorMessage = JSON.stringify(error.error, null, 2);
            } catch {
              errorMessage = "Complex error object (check console)";
            }
          }
        }

        // Check for specific Supabase error codes
        if (error?.code === "PGRST116") {
          errorMessage = "❌ Test not found";
          errorDetails = [
            `Test ID "${testId}" does not exist in the database.`,
          ];
        } else if (error?.code?.startsWith("PGRST")) {
          errorMessage = `⚠️ Database error (${error.code})`;
          errorDetails = [error.message || "Unknown database issue"];
        }

        // Combine error message with details
        const finalErrorMessage =
          errorDetails.length > 0
            ? `${errorMessage}\n\n${errorDetails.join("\n")}`
            : errorMessage;

        console.error("✅ Processed error message:", finalErrorMessage);

        setMessage({
          type: "error",
          content: finalErrorMessage,
        });
      } finally {
        setIsLoadingTest(false);
      }
    };

    loadTestData();
  }, [testId]);

  // Audio player handlers
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Media upload handler
  const handleMediaUpload = (files: MediaFile[]) => {
    setMediaFiles((prev) => [...prev, ...files]);

    // Set first audio file as main audio
    const firstAudio = files.find((f) => f.type === "audio");
    if (firstAudio && !audioUrl) {
      setAudioUrl(firstAudio.url);
    }

    setMessage({
      type: "success",
      content: `${files.length} file(s) uploaded successfully!`,
    });
  };

  // Media removal handler
  const handleMediaRemove = (fileId: string) => {
    const removedFile = mediaFiles.find((f) => f.id === fileId);
    setMediaFiles((prev) => prev.filter((f) => f.id !== fileId));

    // Clear audio URL if removed file was the active audio
    if (removedFile && removedFile.url === audioUrl) {
      setAudioUrl("");
    }
  };

  // Question insertion handler
  const handleQuestionInsertion = (questionData: any) => {
    console.log("Inserting question:", questionData);

    // Determine the next question number
    const nextQuestionNumber = questions.length + 1;

    let newQuestion: any = {
      id: `q_${Date.now()}`,
      question_type: questionData.type,
      question_number: nextQuestionNumber,
      question_text: questionData.question || questionData.text || questionData.content || `Question ${nextQuestionNumber}`,
      points: 1,
      question_order: nextQuestionNumber,
    };

    if (questionData.type === "multiple_choice") {
      newQuestion.options = JSON.stringify(questionData.options || []);
      newQuestion.correct_answer = questionData.correctAnswer;
    } else if (questionData.type === "matching") {
      newQuestion.options = null;
      newQuestion.correct_answer = JSON.stringify({ pairs: questionData.pairs || [] });
    } else if (questionData.type === "short_answer" || questionData.type === "multiple_blank") {
      newQuestion.options = null;
      newQuestion.correct_answer = questionData.correctAnswer || questionData.answer;
    }

    setQuestions((prev) => [...prev, newQuestion]);

    // Add to content as well for display
    let contentAddition = "";
    switch (questionData.type) {
      case "short_answer":
      case "multiple_blank":
        contentAddition = questionData.content;
        break;
      case "multiple_choice":
        contentAddition = `\n\n**Question ${nextQuestionNumber}:** ${questionData.question}\n`;
        if (questionData.options) {
          questionData.options.forEach((option: string, index: number) => {
            contentAddition += `${String.fromCharCode(65 + index)}) ${option}\n`;
          });
        }
        break;
      case "matching":
        contentAddition = `\n\n**Question ${nextQuestionNumber}:** [Matching]\n`;
        break;
      case "map_diagram":
        contentAddition = `\n\n**Map Question ${nextQuestionNumber}:** Refer to the diagram\n`;
        break;
    }

    setContent((prev) => prev + contentAddition);

    setMessage({
      type: "success",
      content: "Question inserted successfully!",
    });
  };

  // Test Supabase connection




  // Save section
  const saveSection = async () => {
    if (!sectionTitle.trim()) {
      setMessage({
        type: "error",
        content: "Please enter a section title",
      });
      return;
    }

    if (editorQuestions.length === 0) {
      setMessage({
        type: "error",
        content: "Please add at least one question",
      });
      return;
    }

    // Validate that all short answer questions have correct answers
    const missingAnswers = editorQuestions.filter(q => {
      if (q.type !== "short_answer") return false;
      
      const hasCorrectAnswer = 
        (Array.isArray(q.content.answers) && q.content.answers.length > 0) ||
        q.content.correctAnswer ||
        q.content.attrs?.correctAnswer ||
        q.attrs?.correctAnswer;
      
      return !hasCorrectAnswer;
    });

    if (missingAnswers.length > 0) {
      setMessage({
        type: "error",
        content: `Missing correct answers for ${missingAnswers.length} short answer question(s). Please ensure all short answer questions have correct answers set.`,
      });
      return;
    }

    setIsSaving(true);
    setMessage({ type: "", content: "" });

    try {
      // Get user data
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData?.user) {
        throw new Error("Authentication required");
      }

      // Save section to database
      const sectionData = {
        test_id: testId,
        title: sectionTitle,
        instructions: sectionInstructions,
        content: typeof content === "string" ? content : JSON.stringify(content),
        audio_url: audioUrl || null,
        section_number: parseInt(sectionNumber || "1"),
        section_type: "listening",
      };

      const { data: section, error: sectionError } = await supabase
        .from("listening_sections")
        .upsert(sectionData, {
          onConflict: "test_id,section_number",
        })
        .select()
        .single();

      if (sectionError) throw sectionError;

      // Save questions
      if (questions.length > 0) {
        // First delete existing questions for this section
        const { error: deleteError } = await supabase
          .from("listening_questions")
          .delete()
          .eq("section_id", section.id);

        if (deleteError) throw deleteError;

        // Then insert new questions
        const questionsData = questions.map((q, index) => {
          const dbQuestionType =
            q.type === "short_answer"
              ? "short_answer"
              : q.type === "multiple_choice"
                ? "multiple_choice"
                : q.type === "matching"
                  ? "matching"
                  : q.type === "map_labeling" || q.type === "map_diagram"
                    ? "map_labeling"
                    : "short_answer"; // default

          const questionData = {
            section_id: section.id,
            question_text: q.text,
            question_type: dbQuestionType,
            question_number: index + 1,
            question_order: index + 1,
            options: q.options ? JSON.stringify(q.options) : null,
            correct_answer: q.correctAnswer,
            points: q.points || 1,
          };
          
          // Add specific logging for MCQ questions
          if (q.type === "multiple_choice") {
            console.log("🔍 Saving MCQ Question to Database:", {
              questionNumber: index + 1,
              questionText: q.text,
              correctAnswer: q.correctAnswer,
              correctAnswerType: typeof q.correctAnswer,
              options: q.options,
              finalQuestionData: questionData
            });
          }
          
          return questionData;
        });
        console.log('Questions to be saved:', questionsData);

        let { error: questionsError } = await supabase
          .from("listening_questions")
          .insert(questionsData);

        // If section_id column doesn't exist, try with listening_section_id
        if (
          questionsError &&
          questionsError.message?.includes("section_id") &&
          questionsError.message?.includes("does not exist")
        ) {
          console.warn(
            "section_id column not found, trying with listening_section_id...",
          );

          const fallbackQuestionsData = questionsData.map((q) => {
            const { section_id, ...rest } = q;
            return {
              ...rest,
              listening_section_id: section_id,
            };
          });

          const { error: fallbackError } = await supabase
            .from("listening_questions")
            .insert(fallbackQuestionsData);

          questionsError = fallbackError;
        }

        if (questionsError) {
          console.error("Questions insert error:", questionsError);
          console.error("Questions data being inserted:", questionsData);

          // Provide helpful error message
          if (
            questionsError.message?.includes("section_id") ||
            questionsError.message?.includes("listening_section_id")
          ) {
            throw new Error(
              `Database schema issue: ${questionsError.message}\n\nPlease run the fix_listening_questions_schema.sql script in your Supabase SQL editor to fix this issue.`,
            );
          }

          throw questionsError;
        }
        
        // Verify what was actually saved to the database
        console.log("🔍 Verifying saved MCQ questions in database...");
        const { data: savedQuestions, error: fetchError } = await supabase
          .from("listening_questions")
          .select("*")
          .eq("section_id", section.id)
          .eq("question_type", "multiple_choice");
          
        if (fetchError) {
          console.error("❌ Error fetching saved questions:", fetchError);
        } else {
          console.log("🔍 MCQ Questions saved to database:", savedQuestions);
          savedQuestions?.forEach((question, index) => {
            console.log(`🔍 Saved MCQ Question ${index + 1}:`, {
              id: question.id,
              questionText: question.question_text,
              correctAnswer: question.correct_answer,
              correctAnswerType: typeof question.correct_answer,
              options: question.options,
              optionsType: typeof question.options
            });
          });
        }
      }

      // Clear localStorage after successful save
      // localStorage.removeItem(storageKey); // REMOVED

      setMessage({
        type: "success",
        content: "Section saved successfully!",
      });

      // Navigate back to test overview
      setTimeout(() => {
        navigate(`/edu-admin/tests/create/advanced/${testId}`);
      }, 1500);
    } catch (error: any) {
      console.error("Save error:", error);

      let errorMessage = "Failed to save section";

      // Handle different error types
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error?.error) {
        errorMessage = error.error;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (error?.hint) {
        errorMessage = error.hint;
      }

      // Handle specific Supabase error codes
      if (error?.code) {
        if (error.code === "23505") {
          errorMessage = "Section already exists for this test";
        } else if (error.code === "23503") {
          errorMessage = "Invalid test ID or missing dependencies";
        } else if (error.code === "42501") {
          errorMessage = "Permission denied. Please check your access rights";
        } else if (error.code.startsWith("23")) {
          errorMessage = `Database constraint error: ${error.message || errorMessage}`;
        } else if (error.code.startsWith("42")) {
          errorMessage = `Database syntax error: ${error.message || errorMessage}`;
        } else {
          errorMessage = `Database error (${error.code}): ${error.message || errorMessage}`;
        }
      }

      console.error("Processed error message:", errorMessage);

      setMessage({
        type: "error",
        content: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Test MCQ question processing


  // Show loading state
  if (isLoadingTest) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading test data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(`/edu-admin/tests/create/advanced/${testId}`)
            }
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Headphones className="h-8 w-8" />
              Create Listening Section
            </h1>
            <p className="text-muted-foreground">
              Test: {currentTest?.title || testId || "Loading..."} • Section{" "}
              {sectionNumber || "1"}
            </p>
          </div>
        </div>


      </div>

      {/* Messages */}
      {message.content && (
        <Alert
          className={
            message.type === "error" ? "border-red-500" : "border-green-500"
          }
        >
          {message.type === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {message.content}
            {!testId && message.type === "error" && (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate("/edu-admin/dashboard")}
                >
                  Go to Dashboard
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/edu-admin/tests/create/advanced")}
                >
                  Create New Test
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Section Information */}
      <Card>
        <CardHeader>
          <CardTitle>Section Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Section Title</Label>
            <Input
              id="title"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="Enter section title"
            />
          </div>
          <div>
            <Label htmlFor="instructions">Instructions (optional)</Label>
            <Textarea
              id="instructions"
              value={sectionInstructions}
              onChange={(e) => setSectionInstructions(e.target.value)}
              placeholder="Enter instructions for students"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Media Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Media Files (Audio & Images)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MediaUploader
            mediaType="both"
            multiple={true}
            maxSizeMB={100}
            onUpload={handleMediaUpload}
            onRemove={handleMediaRemove}
            initialFiles={mediaFiles}
            acceptedTypes={[
              ".mp3",
              ".wav",
              ".m4a",
              ".aac",
              ".ogg",
              ".jpg",
              ".jpeg",
              ".png",
              ".gif",
              ".webp",
            ]}
          />

          {/* Audio Player */}
          {audioUrl && (
            <div className="mt-4 p-3 border rounded-lg bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Audio:</span>
                <Button size="sm" onClick={togglePlayPause}>
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isPlaying ? "Pause" : "Play"}
                </Button>
              </div>
              <audio
                ref={audioRef}
                src={audioUrl}
                onLoadedMetadata={() =>
                  setDuration(audioRef.current?.duration || 0)
                }
                onTimeUpdate={() =>
                  setCurrentTime(audioRef.current?.currentTime || 0)
                }
                onEnded={() => setIsPlaying(false)}
              />
              {duration > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Test Editor */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Question Editor</h2>
        <UnifiedTestEditor
          key={editorResetKey}
          content={content}
          onContentChange={setContent}
          questions={editorQuestions}
          onQuestionsChange={handleEditorQuestionsChange}
          placeholder="Enter your listening section content here. Use the toolbar to add questions."
          initialContent={content}
          startingQuestionNumber={startingQuestionNumber}
        />
      </div>

      {/* Save Section */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            clearPageDraft();
            setSectionTitle(`Section ${sectionNumber || "1"}`);
            setSectionInstructions("Listen to the audio and answer the questions.");
            setContent("");
            setQuestions([]);
            setMediaFiles([]);
            setAudioUrl("");
            setEditorQuestions([]);
            setEditorResetKey((k) => k + 1); // force remount editor
            setMessage({ type: "success", content: "Storage cleared! Starting fresh." });
          }}
          className="text-orange-600 hover:text-orange-700"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Clear All
        </Button>

        <div className="flex space-x-4">
          <Button
            variant="outline"
            onClick={() =>
              navigate(`/edu-admin/tests/create/advanced/${testId}`)
            }
          >
            Cancel
          </Button>
          <Button
            onClick={saveSection}
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Section"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateListeningNew;
