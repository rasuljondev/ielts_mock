import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BookOpen,
  Save,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import UnifiedTestEditor from "@/components/test-creation/UnifiedTestEditor";
import { fetchTestById } from "@/lib/supabaseUtils";
import { MediaUploader, MediaFile } from "@/components/ui/media-uploader";

interface Question {
  id: string;
  type: string;
  text: string;
  options?: string[];
  correctAnswer: any;
  points: number;
  position: number;
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
  const [content, setContent] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [passageMediaFiles, setPassageMediaFiles] = useState<MediaFile[]>([]);

  // UI states
  const [currentTest, setCurrentTest] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", content: "" });

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

  const handleContentChange = (
    newContent: string,
    newQuestions: Question[],
  ) => {
    setContent(newContent);
    setQuestions(newQuestions);
  };

  const handleMediaUpload = (files: MediaFile[]) => {
    console.log("Media uploaded for reading passage:", files);
    setPassageMediaFiles((prev) => [...prev, ...files]);

    setMessage({
      type: "success",
      content: `${files.length} media file(s) uploaded successfully!`,
    });
  };

  const handleMediaRemove = (fileId: string) => {
    setPassageMediaFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const saveReadingSection = async () => {
    if (!content.trim()) {
      setMessage({
        type: "error",
        content: "Please add some content to the passage before saving.",
      });
      return;
    }

    // Check for question placeholders in content
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    const questionPlaceholders = tempDiv.querySelectorAll(
      ".question-placeholder",
    );

    if (questions.length === 0 && questionPlaceholders.length === 0) {
      setMessage({
        type: "error",
        content: "Please add at least one question before saving.",
      });
      return;
    }

    setIsSaving(true);
    setMessage({ type: "", content: "" });

    try {
      // Create reading section
      const { data: sectionData, error: sectionError } = await supabase
        .from("reading_sections")
        .insert({
          test_id: testId,
          title: passageTitle,
          passage_text: content,
          passage_number: parseInt(passageNumber || "1"),
          instructions: passageInstructions,
          section_order: parseInt(passageNumber || "1"),
        })
        .select()
        .single();

      if (sectionError) {
        console.error("Section creation error:", sectionError);
        throw sectionError;
      }

      // Create questions
      const questionsToInsert = questions.map((question, index) => ({
        reading_section_id: sectionData.id,
        question_number: index + 1,
        question_type: question.type,
        question_text: question.text,
        options: question.options ? JSON.stringify(question.options) : null,
        correct_answer: question.correctAnswer
          ? JSON.stringify(question.correctAnswer)
          : question.correctAnswer,
        points: question.points,
        explanation: "",
        question_order: index + 1,
      }));

      if (questionsToInsert.length > 0) {
        const { error: questionsError } = await supabase
          .from("reading_questions")
          .insert(questionsToInsert);

        if (questionsError) {
          console.error("Questions creation error:", questionsError);
          throw questionsError;
        }
      }

      setMessage({
        type: "success",
        content:
          "Reading section saved successfully! You can now add other sections or publish the test.",
      });

      // Navigate back to test creation page
      setTimeout(() => {
        navigate(`/edu-admin/tests/create/advanced/${testId}`);
      }, 1500);
    } catch (error: any) {
      console.error("Error saving reading section:", error);
      setMessage({
        type: "error",
        content: `Failed to save reading section: ${error?.message || "Unknown error"}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading state only briefly, then show editor regardless
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  useEffect(() => {
    // After 2 seconds, show the editor even if test hasn't loaded
    const timer = setTimeout(() => {
      setHasTriedLoading(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!currentTest && !hasTriedLoading && !message.content) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading test...</h1>
          <p className="text-muted-foreground">
            If this takes too long, the editor will load anyway.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
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
              <BookOpen className="h-8 w-8" />
              Create Reading Passage
            </h1>
            <p className="text-muted-foreground">
              Test: {currentTest?.title || "Loading..."} • Passage{" "}
              {passageNumber || "1"}
            </p>
          </div>
        </div>

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
            <AlertDescription>{message.content}</AlertDescription>
          </Alert>
        )}
      </div>

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

        {/* Passage Media Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Passage Media</CardTitle>
            <p className="text-sm text-muted-foreground">
              Upload images, charts, diagrams, or other visual materials related
              to this reading passage
            </p>
          </CardHeader>
          <CardContent>
            <MediaUploader
              mediaType="image"
              multiple={true}
              maxSizeMB={50}
              onUpload={handleMediaUpload}
              onRemove={handleMediaRemove}
              initialFiles={passageMediaFiles}
              acceptedTypes={[".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]}
            />
          </CardContent>
        </Card>

        {/* Unified Content Editor */}
        <UnifiedTestEditor
          testType="reading"
          initialContent={content}
          onContentChange={handleContentChange}
          onSave={saveReadingSection}
        />

        {/* Save Button at Bottom */}
        <div className="flex justify-center pt-6">
          <Button
            onClick={saveReadingSection}
            disabled={isSaving}
            className="w-full max-w-md"
            size="lg"
          >
            <Save className="h-5 w-5 mr-2" />
            {isSaving ? "Saving..." : "Save Reading Passage"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateReadingNew;
