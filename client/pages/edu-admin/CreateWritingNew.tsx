import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PenTool,
  Save,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Clock,
  Image,
  Star,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import WritingPromptEditor from "@/components/test-creation/WritingPromptEditor";
import { fetchTestById } from "@/lib/supabaseUtils";
import { MediaUploader, MediaFile } from "@/components/ui/media-uploader";

// Writing tasks use prompts, not questions

const CreateWritingNew: React.FC = () => {
  const { testId, taskNumber } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Content states
  const [taskTitle, setTaskTitle] = useState(
    `Writing Task ${taskNumber || "1"}`,
  );
  const [taskInstructions, setTaskInstructions] = useState(
    taskNumber === "1"
      ? "You should spend about 20 minutes on this task."
      : "You should spend about 40 minutes on this task.",
  );
  const [wordLimit, setWordLimit] = useState(taskNumber === "1" ? 150 : 250);
  const [taskType, setTaskType] = useState(
    taskNumber === "1" ? "academic_task1" : "academic_task2",
  );
  const [content, setContent] = useState("");
  const [taskImageUrl, setTaskImageUrl] = useState("");
  const [taskMediaFiles, setTaskMediaFiles] = useState<MediaFile[]>([]);

  // IELTS Writing specific fields
  const [writingPrompt, setWritingPrompt] = useState("");
  const [criteriaWeights, setCriteriaWeights] = useState({
    taskAchievement: 25,
    coherenceCohesion: 25,
    lexicalResource: 25,
    grammarAccuracy: 25,
  });

  // UI states
  const [currentTest, setCurrentTest] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", content: "" });

  useEffect(() => {
    console.log("🔗 URL Parameters:", { testId, taskNumber });
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

  const handleMediaUpload = (files: MediaFile[]) => {
    console.log("Media uploaded for writing task:", files);
    setTaskMediaFiles(files);

    // Set the first uploaded image as the task image for compatibility
    const firstImage = files.find((f) => f.type === "image");
    if (firstImage) {
      setTaskImageUrl(firstImage.url);
    }

    setMessage({
      type: "success",
      content: `${files.length} media file(s) uploaded successfully!`,
    });
  };

  const handleMediaRemove = (fileId: string) => {
    setTaskMediaFiles((prev) => prev.filter((f) => f.id !== fileId));

    // Clear task image URL if the removed file was the task image
    const removedFile = taskMediaFiles.find((f) => f.id === fileId);
    if (removedFile && removedFile.url === taskImageUrl) {
      setTaskImageUrl("");
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const saveWritingTask = async () => {
    if (!content.trim()) {
      setMessage({
        type: "error",
        content: "Please add some content to the writing task before saving.",
      });
      return;
    }

    setIsSaving(true);
    setMessage({ type: "", content: "" });

    try {
      // Create writing task
      const { data: taskData, error: taskError } = await supabase
        .from("writing_tasks")
        .insert({
          test_id: testId,
          task_number: parseInt(taskNumber || "1"),
          task_title: taskTitle,
          task_prompt: content,
          task_instructions: taskInstructions,
          word_limit: wordLimit,
          task_image_url: taskImageUrl || null,
          task_order: parseInt(taskNumber || "1"),
          task_type: taskType, // <-- ensure this is always set
        })
        .select()
        .single();

      if (taskError) {
        console.error("Task creation error:", taskError);
        throw taskError;
      }

      setMessage({
        type: "success",
        content:
          "Writing task saved successfully! You can now add other sections or publish the test.",
      });

      // Navigate back to test creation page
      setTimeout(() => {
        navigate(`/edu-admin/tests/create/advanced/${testId}`);
      }, 1500);
    } catch (error: any) {
      console.error("Error saving writing task:", error);
      setMessage({
        type: "error",
        content: `Failed to save writing task: ${error?.message || "Unknown error"}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentTest) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
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
              <PenTool className="h-8 w-8" />
              Create Writing Task
            </h1>
            <p className="text-muted-foreground">
              Test: {currentTest?.title} • Task {taskNumber || "1"}
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
        {/* Task Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Task Configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="title">Task Title</Label>
              <Input
                id="title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g., Writing Task 1"
              />
            </div>
            <div>
              <Label htmlFor="wordLimit">Minimum Words</Label>
              <Input
                id="wordLimit"
                type="number"
                min="50"
                max="1000"
                value={wordLimit}
                onChange={(e) => setWordLimit(parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="instructions">Instructions</Label>
              <Input
                id="instructions"
                value={taskInstructions}
                onChange={(e) => setTaskInstructions(e.target.value)}
                placeholder="Instructions for students"
              />
            </div>
          </CardContent>
        </Card>

        {/* Task Media Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Task Media (Images & Audio)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Upload images (charts, diagrams) or audio files that students will
              reference during the writing task
            </p>
          </CardHeader>
          <CardContent>
            <MediaUploader
              mediaType="both"
              multiple={true}
              maxSizeMB={50}
              onUpload={handleMediaUpload}
              onRemove={handleMediaRemove}
              initialFiles={taskMediaFiles}
              acceptedTypes={[
                ".jpg",
                ".jpeg",
                ".png",
                ".gif",
                ".webp",
                ".mp3",
                ".wav",
                ".m4a",
              ]}
            />
          </CardContent>
        </Card>

        {/* Writing Prompt Editor */}
        <WritingPromptEditor
          initialContent={content}
          onContentChange={handleContentChange}
          onSave={saveWritingTask}
          placeholder={`Enter the writing task prompt here... ${
            taskNumber === "1"
              ? "(e.g., 'The chart below shows...' or 'You recently stayed at a hotel...')"
              : "(e.g., 'Some people believe that technology has made our lives better. To what extent do you agree or disagree?')"
          }`}
        />

        {/* Save Button at Bottom */}
        <div className="flex justify-center pt-6">
          <Button
            onClick={saveWritingTask}
            disabled={isSaving}
            className="w-full max-w-md"
            size="lg"
          >
            <Save className="h-5 w-5 mr-2" />
            {isSaving ? "Saving..." : "Save Writing Task"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateWritingNew;
