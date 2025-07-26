import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Headphones,
  PenTool,
  Plus,
  Save,
  Eye,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface TestForm {
  title: string;
  description: string;
  type: "reading" | "listening" | "writing" | "full";
  total_duration_minutes: number;
  passing_score: number;
  instructions: string;
}

interface SectionStatus {
  reading: boolean;
  listening: boolean;
  writing: boolean;
}

const CreateTestAdvanced: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentTest, setCurrentTest] = useState<any>(null);
  const [sectionStatus, setSectionStatus] = useState<SectionStatus>({
    reading: false,
    listening: false,
    writing: false,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState({ type: "", content: "" });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<TestForm>({
    defaultValues: {
      type: "full",
      total_duration_minutes: 180,
      passing_score: 5.5,
    },
  });

  const watchType = watch("type");

  useEffect(() => {
    checkSectionRequirements();
  }, [watchType, sectionStatus]);

  const checkSectionRequirements = () => {
    const type = watchType;
    if (type === "reading") return sectionStatus.reading;
    if (type === "listening") return sectionStatus.listening;
    if (type === "writing") return sectionStatus.writing;
    if (type === "full") {
      return (
        sectionStatus.reading &&
        sectionStatus.listening &&
        sectionStatus.writing
      );
    }
    return false;
  };

  const createTest = async (data: TestForm) => {
    setIsCreating(true);
    setMessage({ type: "", content: "" });

    try {
      // First get user's edu_center_id from profile
      if (!user?.id) {
        throw new Error("User ID is required");
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("edu_center_id")
        .eq("id", user.id);

      if (profileError) {
        throw new Error("Failed to get user profile: " + profileError.message);
      }

      if (!profileData || profileData.length === 0) {
        throw new Error("User profile not found");
      }

      const profile = profileData[0];

      const { data: testData, error } = await supabase
        .from("tests")
        .insert({
          title: data.title,
          type: data.type,
          duration: data.total_duration_minutes,
          created_by: user?.id,
          edu_center_id: profile.edu_center_id,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      // Create test requirements
      await supabase.from("test_requirements").insert({
        test_id: testData.id,
        requires_reading: data.type === "full" || data.type === "reading",
        requires_listening: data.type === "full" || data.type === "listening",
        requires_writing: data.type === "full" || data.type === "writing",
        minimum_sections: data.type === "full" ? 3 : 1,
      });

      setCurrentTest(testData);
      setMessage({
        type: "success",
        content:
          "Test created successfully! Now add sections to complete your test.",
      });
    } catch (error: any) {
      console.error("Error creating test:", error?.message || error);
      setMessage({
        type: "error",
        content: `Failed to create test: ${error?.message || "Unknown error"}`,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const publishTest = async () => {
    if (!currentTest) return;

    setIsPublishing(true);
    setMessage({ type: "", content: "" });

    try {
      const { error } = await supabase
        .from("tests")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
        })
        .eq("id", currentTest.id);

      if (error) throw error;

      setMessage({
        type: "success",
        content:
          "Test published successfully! Students can now apply to take this test.",
      });

      // Navigate to test management after successful publish
      setTimeout(() => {
        navigate("/edu-admin/tests");
      }, 2000);
    } catch (error: any) {
      console.error("Error publishing test:", error?.message || error);
      setMessage({
        type: "error",
        content: `Failed to publish test: ${error?.message || "Unknown error"}`,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const getDurationForType = (type: string) => {
    switch (type) {
      case "reading":
        return 60;
      case "listening":
        return 60; // changed from 40 to 60
      case "writing":
        return 60;
      case "full":
        return 180;
      default:
        return 60;
    }
  };

  const handleTypeChange = (type: string) => {
    setValue("type", type as any);
    setValue("total_duration_minutes", getDurationForType(type));
  };

  const canPublish = () => {
    if (!currentTest) return false;
    return checkSectionRequirements();
  };

  if (!currentTest) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Create New Test
          </h1>
          <p className="text-muted-foreground">
            Set up the basic information for your IELTS practice test
          </p>
        </div>

        {message.content && (
          <Alert
            variant={message.type === "error" ? "destructive" : "default"}
            className="mb-6"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message.content}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Test Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(createTest)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Test Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., IELTS Full Practice Test #1"
                    {...register("title", {
                      required: "Test title is required",
                    })}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Test Type</Label>
                  <Select
                    onValueChange={handleTypeChange}
                    defaultValue="full"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reading">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Reading Only
                        </div>
                      </SelectItem>
                      <SelectItem value="listening">
                        <div className="flex items-center gap-2">
                          <Headphones className="h-4 w-4" />
                          Listening Only
                        </div>
                      </SelectItem>
                      <SelectItem value="writing">
                        <div className="flex items-center gap-2">
                          <PenTool className="h-4 w-4" />
                          Writing Only
                        </div>
                      </SelectItem>
                      <SelectItem value="full">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Full IELTS Test (All Sections)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="10"
                    max="300"
                    {...register("total_duration_minutes", {
                      required: "Duration is required",
                      min: { value: 10, message: "Minimum 10 minutes" },
                      max: { value: 300, message: "Maximum 300 minutes" },
                    })}
                  />
                  {errors.total_duration_minutes && (
                    <p className="text-sm text-destructive">
                      {errors.total_duration_minutes.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passing_score">Passing Score (Band)</Label>
                  <Input
                    id="passing_score"
                    type="number"
                    step="0.5"
                    min="1"
                    max="9"
                    {...register("passing_score", {
                      required: "Passing score is required",
                      min: { value: 1, message: "Minimum band 1.0" },
                      max: { value: 9, message: "Maximum band 9.0" },
                    })}
                  />
                  {errors.passing_score && (
                    <p className="text-sm text-destructive">
                      {errors.passing_score.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the test content and focus areas"
                  rows={3}
                  {...register("description")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">General Instructions</Label>
                <Textarea
                  id="instructions"
                  placeholder="General instructions for test takers"
                  rows={4}
                  {...register("instructions")}
                />
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create Test"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {currentTest.title}
            </h1>
            <p className="text-muted-foreground">
              Add sections to complete your test • Status: {currentTest.status}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge
              variant={
                currentTest.status === "published" ? "default" : "secondary"
              }
            >
              {currentTest.status}
            </Badge>
            <Button
              onClick={publishTest}
              disabled={!canPublish() || isPublishing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isPublishing ? (
                "Publishing..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Publish Test
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {message.content && (
        <Alert
          variant={message.type === "error" ? "destructive" : "default"}
          className="mb-6"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{message.content}</AlertDescription>
        </Alert>
      )}

      {/* Test Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Duration
                </p>
                <p className="text-2xl font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {currentTest.total_duration_minutes}m
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Passing Score
                </p>
                <p className="text-2xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  {currentTest.passing_score}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Test Type
                </p>
                <p className="text-lg font-semibold">
                  {currentTest.type.replace("_", " ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section Creation */}
      <Card>
        <CardHeader>
          <CardTitle>Test Sections</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add the required sections for your test. All sections must be
            completed before publishing.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Reading Section */}
          {(currentTest.type === "full" || currentTest.type === "reading") && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Reading Section</h3>
                  <p className="text-sm text-muted-foreground">
                    Add passages and comprehension questions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {sectionStatus.reading ? (
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Required
                  </Badge>
                )}
                <Button
                  onClick={() =>
                    navigate(
                      `/edu-admin/tests/create/reading-wizard/${currentTest.id}/1`,
                    )
                  }
                >
                  {sectionStatus.reading ? "Edit" : "Add"} Reading
                </Button>
              </div>
            </div>
          )}

          {/* Listening Section */}
          {(currentTest.type === "full" ||
            currentTest.type === "listening") && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Headphones className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Listening Section</h3>
                    <p className="text-sm text-muted-foreground">
                      Add audio files and listening questions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {sectionStatus.listening ? (
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Required
                    </Badge>
                  )}
                  <Button
                    onClick={() =>
                      navigate(
                        `/edu-admin/tests/create/listening/${currentTest.id}`,
                      )
                    }
                  >
                    {sectionStatus.listening ? "Edit" : "Add"} Listening
                  </Button>
                </div>
              </div>
            )}

          {/* Writing Section */}
          {(currentTest.type === "full" || currentTest.type === "writing") && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <PenTool className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Writing Section</h3>
                  <p className="text-sm text-muted-foreground">
                    Add writing tasks and prompts
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {sectionStatus.writing ? (
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Required
                  </Badge>
                )}
                <Button
                  onClick={() =>
                    navigate(
                      `/edu-admin/tests/create/writing/${currentTest.id}`,
                    )
                  }
                >
                  {sectionStatus.writing ? "Edit" : "Add"} Writing
                </Button>
              </div>
            </div>
          )}

          {/* Publish Requirements */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">Publishing Requirements</h4>
            <div className="space-y-2 text-sm">
              {currentTest.type === "full" && (
                <>
                  <div className="flex items-center gap-2">
                    {sectionStatus.reading ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    )}
                    Reading section with at least 1 passage and questions
                  </div>
                  <div className="flex items-center gap-2">
                    {sectionStatus.listening ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    )}
                    Listening section with audio file and questions
                  </div>
                  <div className="flex items-center gap-2">
                    {sectionStatus.writing ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    )}
                    Writing section with Task 1 and Task 2
                  </div>
                </>
              )}
              {currentTest.type !== "full" && (
                <div className="flex items-center gap-2">
                  {checkSectionRequirements() ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                  )}
                  Complete the {currentTest.type} section
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateTestAdvanced;
