import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  BookOpen,
  Volume2,
  PenTool,
  Save,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface TestSection {
  id: string;
  type: "reading" | "listening" | "writing";
  title: string;
  questions: any[];
  duration?: number;
  audio_file?: File;
}

interface TestData {
  title: string;
  description: string;
  default_duration: number;
  sections: TestSection[];
}

const CreateTestNew: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [testData, setTestData] = useState<TestData>({
    title: "",
    description: "",
    default_duration: 60,
    sections: [],
  });
  const [isPublishing, setIsPublishing] = useState(false);

  const handleAddSection = (type: "reading" | "listening" | "writing") => {
    const sectionId = Date.now().toString();
    navigate(
      `/edu-admin/tests/create/${type}?sectionId=${sectionId}&testTitle=${encodeURIComponent(testData.title)}`,
    );
  };

  const handleEditSection = (sectionId: string, type: string) => {
    navigate(
      `/edu-admin/tests/create/${type}?sectionId=${sectionId}&edit=true`,
    );
  };

  const handleDeleteSection = (sectionId: string) => {
    if (confirm("Are you sure you want to delete this section?")) {
      setTestData((prev) => ({
        ...prev,
        sections: prev.sections.filter((s) => s.id !== sectionId),
      }));
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "reading":
        return <BookOpen className="h-5 w-5" />;
      case "listening":
        return <Volume2 className="h-5 w-5" />;
      case "writing":
        return <PenTool className="h-5 w-5" />;
      default:
        return <BookOpen className="h-5 w-5" />;
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case "reading":
        return "bg-blue-100 text-blue-800";
      case "listening":
        return "bg-green-100 text-green-800";
      case "writing":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const canPublish = testData.title && testData.sections.length > 0;

  const handlePublish = async () => {
    if (!canPublish) return;

    setIsPublishing(true);

    if (
      !confirm(
        "Are you sure you want to publish this test? Students will be able to see and request access to it.",
      )
    ) {
      setIsPublishing(false);
      return;
    }

    try {
      const testToSubmit = {
        title: testData.title,
        description: testData.description,
        default_duration: testData.default_duration,
        sections: testData.sections,
        status: "published",
        created_by: user?.id,
        edu_center_id: user?.edu_center_id,
      };

      const { data, error } = await supabase
        .from("tests")
        .insert([testToSubmit])
        .select()
        .single();

      if (error) {
        console.error("❌ Error publishing test:", error.message);
        alert(`Failed to publish test: ${error.message}`);
        return;
      }

      console.log("✅ Test published successfully:", data);
      alert("Test published successfully! Students can now request access.");
      navigate("/edu-admin/tests");
    } catch (error) {
      console.error("❌ Error publishing test:", error);
      alert(
        `Failed to publish test: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => navigate("/edu-admin/tests")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tests
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Create New Test
          </h1>
          <p className="text-muted-foreground">
            Build your IELTS test by adding sections individually
          </p>
        </div>
      </div>

      {/* Test Information */}
      <Card>
        <CardHeader>
          <CardTitle>Test Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Test Title *</Label>
            <Input
              id="title"
              value={testData.title}
              onChange={(e) =>
                setTestData({ ...testData, title: e.target.value })
              }
              placeholder="e.g. IELTS Full Practice Test #1"
            />
          </div>

          <div>
            <Label htmlFor="description">Test Description</Label>
            <Textarea
              id="description"
              value={testData.description}
              onChange={(e) =>
                setTestData({ ...testData, description: e.target.value })
              }
              placeholder="Brief description of the test content and objectives"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="duration">
              Default Duration per Section (minutes)
            </Label>
            <Input
              id="duration"
              type="number"
              value={testData.default_duration}
              onChange={(e) =>
                setTestData({
                  ...testData,
                  default_duration: parseInt(e.target.value) || 60,
                })
              }
              min="1"
              max="180"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Individual sections can override this duration
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add Sections */}
      <Card>
        <CardHeader>
          <CardTitle>Test Sections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center space-y-2"
              onClick={() => handleAddSection("reading")}
              disabled={!testData.title}
            >
              <BookOpen className="h-6 w-6 text-blue-600" />
              <span>Add Reading Section</span>
            </Button>

            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center space-y-2"
              onClick={() => handleAddSection("listening")}
              disabled={!testData.title}
            >
              <Volume2 className="h-6 w-6 text-green-600" />
              <span>Add Listening Section</span>
            </Button>

            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center space-y-2"
              onClick={() => handleAddSection("writing")}
              disabled={!testData.title}
            >
              <PenTool className="h-6 w-6 text-purple-600" />
              <span>Add Writing Section</span>
            </Button>
          </div>

          {!testData.title && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Please enter a test title before adding sections
            </p>
          )}

          {/* Existing Sections */}
          {testData.sections.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold">
                Added Sections ({testData.sections.length})
              </h4>
              {testData.sections.map((section) => (
                <div
                  key={section.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-lg ${getColorForType(section.type)}`}
                    >
                      {getIconForType(section.type)}
                    </div>
                    <div>
                      <h5 className="font-medium">{section.title}</h5>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="capitalize">
                          {section.type}
                        </Badge>
                        <span>{section.questions.length} questions</span>
                        {section.duration && (
                          <span>{section.duration} min</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleEditSection(section.id, section.type)
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleEditSection(section.id, section.type)
                      }
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSection(section.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Publish Button */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Ready to Publish?</h3>
              <p className="text-sm text-muted-foreground">
                {canPublish
                  ? "Your test is ready to be published. Students will be able to see and request access."
                  : "Complete the test title and add at least one section to publish."}
              </p>
            </div>
            <Button
              size="lg"
              onClick={handlePublish}
              disabled={!canPublish || isPublishing}
              className="min-w-[140px]"
            >
              {isPublishing ? (
                "Publishing..."
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Publish Test
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateTestNew;
