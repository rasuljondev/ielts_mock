import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BookOpen,
  Save,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import ReadingTestEditor from "@/components/test-creation/ReadingTestEditor";
import { fetchTestById } from "@/lib/supabaseUtils";

interface Question {
  id: string;
  type:
    | "short_answer"
    | "multiple_choice"
    | "matching";
  content: any;
  summary: string;
  attrs?: any; // Add attrs property for compatibility
}

const CreateReadingNew: React.FC = () => {
  const { testId, passageNumber } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Content states
  const [passageTitle, setPassageTitle] = useState(
    `Reading Passage ${passageNumber || "1"}`,
  );
  const [passageInstructions, setPassageInstructions] = useState(
    "Read the passage and answer the questions.",
  );
  const [passageText, setPassageText] = useState(""); // New dedicated passage text
  const [content, setContent] = useState(""); // This will be used for questions only
  const [questions, setQuestions] = useState<Question[]>([]);

  // UI states
  const [currentTest, setCurrentTest] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", content: "" });
  const [startingQuestionNumber, setStartingQuestionNumber] = useState(1);
  const [editorQuestions, setEditorQuestions] = useState<any[]>([]);
  const [editorResetKey, setEditorResetKey] = useState(0);

  // Add a stable storage key for the whole page
  const pageDraftKey = `reading-page-draft-${testId || 'default'}-${passageNumber || 'default'}`;

  // Add a function to save the entire page state
  const savePageDraft = (extra?: Partial<any>) => {
    const draft = {
      passageTitle,
      passageInstructions,
      passageText,
      content: typeof content === "string" ? content : JSON.stringify(content),
      questions,
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

  useEffect(() => {
    console.log("🔗 URL Parameters:", { testId, passageNumber });
    console.log("🔗 testId type:", typeof testId);
    console.log("🔗 testId value:", testId);
    console.log("🔗 Current URL:", window.location.href);

    if (testId) {
      fetchTest();
    } else {
      console.error("❌ No testId found in URL parameters");
      setMessage({
        type: "error",
        content:
          "No test ID provided in URL. Please navigate from test creation page.",
      });
    }
  }, [testId]);

  // Load draft on mount
  useEffect(() => {
    const draft = loadPageDraft();
    if (draft) {
      console.log("📝 Loading saved draft:", draft);
      setPassageTitle(draft.passageTitle || passageTitle);
      setPassageInstructions(draft.passageInstructions || passageInstructions);
      setPassageText(draft.passageText || "");
      
      // Parse content properly - handle both string and object formats
      let parsedContent = "";
      if (draft.content) {
        if (typeof draft.content === "string") {
          try {
            parsedContent = JSON.parse(draft.content);
          } catch {
            // If it's not valid JSON, treat it as plain text
            parsedContent = draft.content;
          }
        } else {
          parsedContent = draft.content;
        }
      }
      setContent(parsedContent);
      
      setQuestions(draft.questions || []);
      setEditorQuestions(draft.editorQuestions || []);
      
      // Show a message that draft was loaded
      setMessage({
        type: "success",
        content: "Draft loaded successfully. Your previous work has been restored.",
      });
      
      // Clear the message after 3 seconds
      setTimeout(() => {
        setMessage({ type: "", content: "" });
      }, 3000);
    }
  }, []);

  // Auto-save draft when content changes
  useEffect(() => {
    if (passageTitle || passageInstructions || passageText || content || questions.length > 0 || editorQuestions.length > 0) {
      savePageDraft();
    }
  }, [passageTitle, passageInstructions, passageText, content, questions, editorQuestions]);

  const fetchTest = async () => {
    try {
      if (!testId) {
        throw new Error("Test ID is required");
      }

      console.log("Fetching test with ID:", testId);
      const testData = await fetchTestById(testId);
      setCurrentTest(testData);
      console.log("Test loaded successfully:", testData);
      
      // Calculate starting question number for this passage
      await calculateStartingQuestionNumber();
    } catch (error: any) {
      console.error("Error fetching test:", error?.message || error);
      setMessage({
        type: "error",
        content: `Could not load test: ${error?.message || "Unknown error"}`,
      });
    }
  };

  const calculateStartingQuestionNumber = async () => {
    try {
      const currentPassageNum = parseInt(passageNumber || "1");
      
      if (currentPassageNum === 1) {
        // First passage starts with question 1
        setStartingQuestionNumber(1);
        return;
      }

      // Fetch all questions from previous passages
      let totalPreviousQuestions = 0;
      
      for (let i = 1; i < currentPassageNum; i++) {
        // Get the reading section for this passage
        const { data: section } = await supabase
          .from("reading_sections")
          .select("id")
          .eq("test_id", testId)
          .eq("passage_number", i)
          .single();

        if (section) {
          // Get all questions for this section to count them properly
          const { data: questions } = await supabase
            .from("reading_questions")
            .select("question_type, correct_answer")
            .eq("reading_section_id", section.id);

          if (questions) {
            questions.forEach((question: any) => {
              if (question.question_type === "matching") {
                // For matching questions, count each pair as a separate question
                try {
                  const pairs = typeof question.correct_answer === "string" 
                    ? JSON.parse(question.correct_answer) 
                    : question.correct_answer;
                  if (pairs && pairs.left && Array.isArray(pairs.left)) {
                    totalPreviousQuestions += pairs.left.length;
                  } else {
                    totalPreviousQuestions += 1; // Fallback
                  }
                } catch {
                  totalPreviousQuestions += 1; // Fallback
                }
              } else {
                // For other question types, count as 1
                totalPreviousQuestions += 1;
              }
            });
          }
        }
      }

      console.log(`📊 Passage ${currentPassageNum}: Previous passages have ${totalPreviousQuestions} questions`);
      setStartingQuestionNumber(totalPreviousQuestions + 1);
    } catch (error) {
      console.error("Error calculating starting question number:", error);
      // Fallback to 1 if there's an error
      setStartingQuestionNumber(1);
    }
  };

  const handleContentChange = (newContent: any) => {
    console.log("🔍 CreateReadingNew handleContentChange - Content received from editor:", {
      contentType: typeof newContent,
      contentLength: typeof newContent === "string" ? newContent.length : JSON.stringify(newContent).length,
      hasShortAnswerNodes: typeof newContent === "string" ? newContent.includes('"type":"short_answer"') : JSON.stringify(newContent).includes('"type":"short_answer"'),
      hasMatchingNodes: typeof newContent === "string" ? newContent.includes('"type":"matching"') : JSON.stringify(newContent).includes('"type":"matching"'),
      hasMCQNodes: typeof newContent === "string" ? newContent.includes('"type":"mcq"') : JSON.stringify(newContent).includes('"type":"mcq"'),
      nodeTypes: typeof newContent === "object" && newContent?.content ? newContent.content.map((n: any) => n.type) : [],
      fullContent: typeof newContent === "object" ? newContent : null
    });
    
    // Only update content if it's different to avoid loops
    if (JSON.stringify(newContent) !== JSON.stringify(content)) {
      console.log("🔍 Updating content in parent component");
      setContent(newContent);
    } else {
      console.log("🔍 Content unchanged, skipping update");
    }
  };

  const handleQuestionsChange = (newQuestions: Question[]) => {
    setQuestions(newQuestions);
  };

  const handleEditorQuestionsChange = (editorQuestions: any[]) => {
    console.log("🔍 Processing Editor Questions:", editorQuestions);
    setEditorQuestions(editorQuestions);
    // Convert editor questions to parent Question type for summary and persistence
    const convertedQuestions = editorQuestions.map((q, index) => {
      // Add null checks to prevent errors
      const questionContent = q?.content || {};
      
      let options = null;
      let correctAnswer = null;
      if (q.type === "multiple_choice") {
        options = questionContent.options;
        correctAnswer = questionContent.correctAnswer;
      } else if (q.type === "matching") {
        // For matching questions, use data directly from TipTap node (like listening test)
        if (questionContent.left && questionContent.right && Array.isArray(questionContent.left) && Array.isArray(questionContent.right)) {
          // Set options to contain the left and right arrays for matching questions
          options = JSON.stringify({ left: questionContent.left, right: questionContent.right });
          
          console.log("🔍 Matching Question (simplified):", {
            questionNumber: index + 1,
            left: questionContent.left,
            right: questionContent.right,
            options
          });
        }
      } else if (q.type === "short_answer") {
        // For short answer questions, try to get correct answer from multiple sources
        if (Array.isArray(questionContent.answers) && questionContent.answers.length > 0) {
          correctAnswer = questionContent.answers.join(", ");
        } else if (questionContent.correctAnswer) {
          correctAnswer = questionContent.correctAnswer;
        } else if (questionContent.correct_answer) {
          correctAnswer = questionContent.correct_answer;
        }
      } else {
        // For other question types, try to get correct answer
        correctAnswer = questionContent.correctAnswer || questionContent.correct_answer || null;
      }

      return {
        id: q.id,
        type: q.type,
        text: questionContent.question || questionContent.text || questionContent.prompt || `Question ${index + 1}`,
        options,
        correctAnswer,
        points: 1,
        position: index + 1,
        content: questionContent,
        summary: questionContent.question || questionContent.text || questionContent.prompt || `Question ${index + 1}`,
      } as Question;
    });
    setQuestions(convertedQuestions);
  };

  const saveReadingSection = async () => {
    if (!passageText.trim()) {
      setMessage({
        type: "error",
        content: "Please add passage text before saving.",
      });
      return;
    }

    if (questions.length === 0) {
      setMessage({
        type: "error",
        content: "Please add at least one question before saving.",
      });
      return;
    }

    // Validate that all questions have correct answers
    const questionsWithoutAnswers = questions.filter(q => {
      let hasCorrectAnswer = false;
      
      if (q.type === "matching") {
        // For matching questions, check if left and right arrays exist and have content
        hasCorrectAnswer = 
          Array.isArray(q.content?.left) && 
          Array.isArray(q.content?.right) && 
          q.content.left.length > 0 && 
          q.content.right.length > 0 &&
          q.content.left.every((item: string) => item.trim() !== "") &&
          q.content.right.every((item: string) => item.trim() !== "");
      } else if (q.type === "short_answer") {
        // For short answer questions, check multiple sources
        hasCorrectAnswer = 
          typeof q.content?.correctAnswer !== 'undefined' ||
          typeof q.content?.correct_answer !== 'undefined' ||
          (Array.isArray(q.content?.answers) && q.content.answers.length > 0);
      } else {
        // For other question types, check standard correct answer fields
        // Use typeof to check if the value exists (including 0)
        hasCorrectAnswer = 
          typeof q.content?.correctAnswer !== 'undefined' ||
          typeof q.content?.correct_answer !== 'undefined';
      }
      
      // Debug logging for questions without answers
      if (!hasCorrectAnswer) {
        console.warn("❌ Question missing correct answer:", {
          type: q.type,
          content: q.content,
          correctAnswer: q.content?.correctAnswer,
          correct_answer: q.content?.correct_answer,
          answers: q.content?.answers
        });
      }
      
      return !hasCorrectAnswer;
    });

    if (questionsWithoutAnswers.length > 0) {
      setMessage({
        type: "error",
        content: `Missing correct answers for ${questionsWithoutAnswers.length} question(s). Please ensure all questions have correct answers set.`,
      });
      return;
    }

    setIsSaving(true);
    setMessage({ type: "", content: "" });

    try {
      // Create or update reading section with the dedicated passage text
      // Log the content being saved
      console.log("🔍 Content being saved to database:", {
        contentType: typeof content,
        contentLength: typeof content === "string" ? content.length : JSON.stringify(content).length,
        hasShortAnswerNodes: typeof content === "string" ? content.includes('"type":"short_answer"') : JSON.stringify(content).includes('"type":"short_answer"'),
        hasMatchingNodes: typeof content === "string" ? content.includes('"type":"matching"') : JSON.stringify(content).includes('"type":"matching"'),
        hasMCQNodes: typeof content === "string" ? content.includes('"type":"mcq"') : JSON.stringify(content).includes('"type":"mcq"'),
        nodeTypes: typeof content === "object" && content && 'content' in content && Array.isArray((content as any).content) ? (content as any).content.map((n: any) => n.type) : [],
        fullContent: typeof content === "object" ? content : null
      });
      
      const sectionDataToSave = {
        test_id: testId,
        title: passageTitle,
        passage_text: passageText, // Use the dedicated passage text
        passage_number: parseInt(passageNumber || "1"),
        instructions: passageInstructions,
        section_order: parseInt(passageNumber || "1"),
        content: typeof content === "string" ? content : JSON.stringify(content), // Save the content with embedded questions
      };
      
      console.log("🔍 Saving reading section:", {
        passageNumber: passageNumber,
        title: passageTitle,
        contentType: typeof content,
        contentLength: typeof content === "string" ? content.length : JSON.stringify(content).length,
        hasContent: !!content
      });

      const { data: section, error: sectionError } = await supabase
        .from("reading_sections")
        .upsert(sectionDataToSave, {
          onConflict: "test_id,passage_number",
        })
        .select()
        .single();

      if (sectionError) {
        console.error("Section creation error:", sectionError);
        throw sectionError;
      }

      // Delete existing questions for this section before inserting new ones
      if (questions.length > 0) {
        const { error: deleteError } = await supabase
          .from("reading_questions")
          .delete()
          .eq("reading_section_id", section.id);

        if (deleteError) {
          console.error("Error deleting existing questions:", deleteError);
          throw deleteError;
        }
      }

      // Only allow supported question types for DB
      const ALLOWED_TYPES = new Set([
        "multiple_choice",
        "short_answer",
        "matching"
      ]);

      // Log all question types before filtering
      console.log("All question types before save:", questions.map(q => q.type));

      // Filter only allowed types
      const filteredQuestions = questions.filter(q => ALLOWED_TYPES.has(q.type));
      console.log("Filtered question types to be saved:", filteredQuestions.map(q => q.type));

      const questionsToInsert = filteredQuestions.map((question, index) => {
        // Normalize question_type to match allowed DB values
        let dbQuestionType = "short_answer";
        if (question.type === "multiple_choice") {
          dbQuestionType = "multiple_choice";
        } else if (question.type === "short_answer") {
          dbQuestionType = "short_answer";
                } else if (question.type === "matching") {
          dbQuestionType = "matching";
        }

        // Extract correct answer based on question type
        let correctAnswer = null;
        if (question.type === "multiple_choice") {
          // For MCQ, save the index as a number (not string)
          const correctIndex = question.content?.correctAnswer || question.content?.correct_answer;
          correctAnswer = typeof correctIndex === 'number' ? correctIndex : parseInt(correctIndex) || 0;
        } else if (question.type === "matching") {
          // For matching questions, use data directly from TipTap node (like listening test)
          if (question.content?.left && question.content?.right && Array.isArray(question.content.left) && Array.isArray(question.content.right)) {
            // Store the left and right arrays directly (like listening test)
            correctAnswer = JSON.stringify({ left: question.content.left, right: question.content.right });
            console.log("🔍 Matching Question Database Save (simplified):", {
              questionNumber: index + 1,
              left: question.content.left,
              right: question.content.right,
              correctAnswer
            });
          }
        } else if (question.type === "short_answer") {
          // Always save as JSON array
          if (Array.isArray(question.content?.answers) && question.content.answers.length > 0) {
            correctAnswer = JSON.stringify(question.content.answers);
          } else if (question.content?.correctAnswer) {
            if (Array.isArray(question.content.correctAnswer)) {
              correctAnswer = JSON.stringify(question.content.correctAnswer);
            } else {
              correctAnswer = JSON.stringify([question.content.correctAnswer]);
            }
          } else if (question.content?.correct_answer) {
            if (Array.isArray(question.content.correct_answer)) {
              correctAnswer = JSON.stringify(question.content.correct_answer);
            } else {
              correctAnswer = JSON.stringify([question.content.correct_answer]);
            }
          }
        } else {
          correctAnswer = question.content?.correctAnswer || question.content?.correct_answer;
        }

        if (!correctAnswer) {
          console.warn(`Warning: No correct answer found for question ${index + 1} (${question.type})`);
          correctAnswer = "";
        }

        // Handle options field based on question type
        let optionsField = null;
        if (question.type === "matching" && question.content?.left && question.content?.right) {
          optionsField = JSON.stringify({ left: question.content.left, right: question.content.right });
        } else if (question.content?.options) {
          optionsField = JSON.stringify(question.content.options);
        }

        // Add logging for what is being saved
        console.log("📝 Saving question to DB:", {
          question_type: dbQuestionType,
          question_text: question.content?.text || question.summary,
          options: optionsField,
          correct_answer: correctAnswer,
          points: 1,
          question_order: index + 1
        });
        
        // Log the content being saved
        console.log("📝 Content being saved:", {
          contentType: typeof content,
          contentPreview: typeof content === "string" ? content.substring(0, 200) + "..." : JSON.stringify(content).substring(0, 200) + "...",
          hasShortAnswerNodes: typeof content === "string" ? content.includes('"type":"short_answer"') : JSON.stringify(content).includes('"type":"short_answer"'),
          hasMatchingNodes: typeof content === "string" ? content.includes('"type":"matching"') : JSON.stringify(content).includes('"type":"matching"'),
          hasMCQNodes: typeof content === "string" ? content.includes('"type":"mcq"') : JSON.stringify(content).includes('"type":"mcq"')
        });
        
        // Log the full content structure
        console.log("📝 Full content structure:", {
          content: typeof content === "string" ? JSON.parse(content) : content,
          contentString: typeof content === "string" ? content : JSON.stringify(content)
        });
        
        return {
          reading_section_id: section.id,
          question_number: question.content?.question_number || index + 1,
          question_type: dbQuestionType,
          question_text: question.content?.question || question.content?.text || question.summary,
          options: optionsField,
          correct_answer: correctAnswer,
          points: 1, // Default points
          explanation: "",
          question_order: question.content?.question_number || index + 1,
        };
      });

      if (questionsToInsert.length > 0) {
        console.log("Questions to be saved:", questionsToInsert);
        
        const { error: questionsError } = await supabase
          .from("reading_questions")
          .insert(questionsToInsert);

        if (questionsError) {
          console.error("Questions creation error:", questionsError);
          console.error("Questions data being inserted:", questionsToInsert);
          throw questionsError;
        }
      }

      setMessage({
        type: "success",
        content:
          "Reading section saved successfully! You can now add other sections or publish the test.",
      });

      // Clear the draft after successful save
      clearPageDraft();

      // Navigate back to test creation page
      setTimeout(() => {
        navigate(`/edu-admin/tests/create/advanced/${testId}`);
      }, 1500);
    } catch (error: any) {
      setMessage({
        type: "error",
        content: `Failed to save: ${error?.message || "Unknown error"}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentTest) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => navigate(`/edu-admin/tests/create/advanced/${testId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-semibold mb-2">Loading Test...</h3>
              <p className="text-gray-600">
                Please wait while we load the test information.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(`/edu-admin/tests/create/advanced/${testId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create Reading Passage</h1>
            <p className="text-gray-600">
              Test: {currentTest.title} • Passage {passageNumber || "1"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={saveReadingSection}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <Clock className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Save Passage"}
          </Button>
        </div>
      </div>

      {/* Message Display */}
      {message.content && (
        <Alert
          className={`mb-6 ${
            message.type === "error" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
          }`}
        >
          <AlertDescription>{message.content}</AlertDescription>
        </Alert>
      )}



      <div className="space-y-6">
        {/* Passage Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Passage Configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="title">Passage Title</Label>
              <Input
                id="title"
                value={passageTitle}
                onChange={(e) => setPassageTitle(e.target.value)}
                placeholder="e.g., Reading Passage 1"
              />
            </div>
            <div>
              <Label htmlFor="instructions">Instructions</Label>
              <Input
                id="instructions"
                value={passageInstructions}
                onChange={(e) => setPassageInstructions(e.target.value)}
                placeholder="Instructions for students"
              />
            </div>
          </CardContent>
        </Card>

        {/* Reading Passage Text */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Reading Passage Text
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter the main passage text that students will read. This will appear on the left side during the test.
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              value={passageText}
              onChange={(e) => setPassageText(e.target.value)}
              placeholder="Enter the reading passage text here. You can include paragraphs, headings, and formatted text. This is the content that students will read before answering questions."
              className="min-h-[400px] text-base leading-relaxed"
            />
            <div className="mt-2 text-sm text-muted-foreground">
              {passageText.length} characters • {passageText.split(/\s+/).filter(word => word.length > 0).length} words
            </div>
          </CardContent>
        </Card>

        {/* Questions Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Questions
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Add questions that students will answer based on the passage. These will appear on the right side during the test.
            </p>
          </CardHeader>
          <CardContent>
            <ReadingTestEditor
              key={editorResetKey}
              content={content}
              onContentChange={handleContentChange}
              questions={editorQuestions}
              onQuestionsChange={handleQuestionsChange}
              onEditorQuestionsChange={handleEditorQuestionsChange}
              placeholder="Add questions here. You can insert multiple choice, short answer, matching, and other question types."
              startingQuestionNumber={startingQuestionNumber}
            />
          </CardContent>
        </Card>

        {/* Save Button at Bottom */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Are you sure you want to clear your draft? This action cannot be undone.")) {
                clearPageDraft();
                setPassageTitle(`Reading Passage ${passageNumber || "1"}`);
                setPassageInstructions("Read the passage and answer the questions.");
                setPassageText("");
                setContent("");
                setQuestions([]);
                setEditorQuestions([]);
                setEditorResetKey((k) => k + 1); // force remount editor
                setMessage({
                  type: "success",
                  content: "Draft cleared successfully.",
                });
                setTimeout(() => setMessage({ type: "", content: "" }), 2000);
              }
            }}
            size="lg"
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear Draft
          </Button>
          <Button
            onClick={saveReadingSection}
            disabled={isSaving}
            size="lg"
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <Clock className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Save Reading Passage"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateReadingNew;
