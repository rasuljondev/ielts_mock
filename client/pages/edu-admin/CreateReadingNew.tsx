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
import UnifiedTestEditor from "@/components/test-creation/UnifiedTestEditor";
import { fetchTestById } from "@/lib/supabaseUtils";

interface Question {
  id: string;
  type:
    | "short_answer"
    | "multiple_choice"
    | "matching"
    | "map_diagram"
    | "table";
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
      setContent(draft.content || "");
      setQuestions(draft.questions || []);
      
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
    if (passageTitle || passageInstructions || passageText || content || questions.length > 0) {
      savePageDraft();
    }
  }, [passageTitle, passageInstructions, passageText, content, questions]);

  const fetchTest = async () => {
    try {
      if (!testId) {
        throw new Error("Test ID is required");
      }

      console.log("Fetching test with ID:", testId);
      const testData = await fetchTestById(testId);
      setCurrentTest(testData);
      console.log("Test loaded successfully:", testData);
    } catch (error: any) {
      console.error("Error fetching test:", error?.message || error);
      setMessage({
        type: "error",
        content: `Could not load test: ${error?.message || "Unknown error"}`,
      });
    }
  };

  const handleContentChange = (newContent: any) => {
    setContent(newContent);
  };

  const handleQuestionsChange = (newQuestions: Question[]) => {
    setQuestions(newQuestions);
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
      const hasCorrectAnswer = 
        q.content?.correctAnswer ||
        q.content?.correct_answer ||
        (Array.isArray(q.content?.answers) && q.content.answers.length > 0);
      
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
      const sectionDataToSave = {
        test_id: testId,
        title: passageTitle,
        passage_text: passageText, // Use the dedicated passage text
        passage_number: parseInt(passageNumber || "1"),
        instructions: passageInstructions,
        section_order: parseInt(passageNumber || "1"),
        content: typeof content === "string" ? content : JSON.stringify(content), // Save the content with embedded questions
      };

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

      // Create questions
      const questionsToInsert = questions.map((question, index) => {
        // Extract correct answer based on question type
        let correctAnswer = null;
        
        if (question.type === "multiple_choice") {
          correctAnswer = question.content?.correctAnswer || question.content?.correct_answer;
        } else if (question.type === "matching") {
          // For matching questions, create pairs from left and right arrays
          if (question.content?.left && question.content?.right && Array.isArray(question.content.left) && Array.isArray(question.content.right)) {
            const pairs = question.content.left.map((leftItem: string, pairIndex: number) => ({
              left: leftItem,
              right: question.content.right[pairIndex] || ""
            }));
            correctAnswer = JSON.stringify(pairs);
          } else {
            correctAnswer = question.content?.correctAnswer ? JSON.stringify(question.content.correctAnswer) : null;
          }
        } else if (question.type === "short_answer") {
          // For short answer questions, try to get correct answer from multiple sources
          if (Array.isArray(question.content?.answers) && question.content.answers.length > 0) {
            correctAnswer = question.content.answers.join(", ");
          } else if (question.content?.correctAnswer) {
            correctAnswer = question.content.correctAnswer;
          } else if (question.content?.correct_answer) {
            correctAnswer = question.content.correct_answer;
          }
        } else {
          // For other question types, try to get correct answer
          correctAnswer = question.content?.correctAnswer || question.content?.correct_answer;
        }

        // Ensure we have a valid correct answer
        if (!correctAnswer) {
          console.warn(`Warning: No correct answer found for question ${index + 1} (${question.type})`);
          correctAnswer = ""; // Provide empty string instead of null
        }

        return {
          reading_section_id: section.id,
          question_number: index + 1,
          question_type: question.type,
          question_text: question.content?.text || question.summary,
          options: question.content?.options ? JSON.stringify(question.content.options) : null,
          correct_answer: correctAnswer,
          points: 1, // Default points
          explanation: "",
          question_order: index + 1,
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
            <UnifiedTestEditor
              initialContent={content}
              onContentChange={handleContentChange}
              onQuestionsChange={handleQuestionsChange}
              placeholder="Add questions here. You can insert multiple choice, short answer, matching, and other question types."
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
