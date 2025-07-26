import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Headphones,
  PenTool,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Edit,
  Send,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface TestSection {
  id: string;
  type: "reading" | "listening" | "writing";
  completed: boolean;
  subsections: SubSection[];
}

interface SubSection {
  id: string;
  name: string;
  completed: boolean;
  questionCount: number;
}

interface TestStructure {
  reading: {
    passages: SubSection[];
    totalQuestions: number;
    completed: boolean;
  };
  listening: {
    sections: SubSection[];
    totalQuestions: number;
    completed: boolean;
  };
  writing: {
    tasks: SubSection[];
    completed: boolean;
  };
}

const CreateIELTSTest: React.FC = () => {
  const { testId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentTest, setCurrentTest] = useState<any>(null);
  const [testStructure, setTestStructure] = useState<TestStructure>({
    reading: {
      passages: [
        { id: "r1", name: "Passage 1", completed: false, questionCount: 0 },
        { id: "r2", name: "Passage 2", completed: false, questionCount: 0 },
        { id: "r3", name: "Passage 3", completed: false, questionCount: 0 },
      ],
      totalQuestions: 0,
      completed: false,
    },
    listening: {
      sections: [
        {
          id: "l1",
          name: "Section 1",
          completed: false,
          questionCount: 10,
        },
        {
          id: "l2",
          name: "Section 2",
          completed: false,
          questionCount: 10,
        },
        {
          id: "l3",
          name: "Section 3",
          completed: false,
          questionCount: 10,
        },
        {
          id: "l4",
          name: "Section 4",
          completed: false,
          questionCount: 10,
        },
      ],
      totalQuestions: 0,
      completed: false,
    },
    writing: {
      tasks: [
        {
          id: "w1",
          name: "Task 1 - Academic Writing",
          completed: false,
          questionCount: 1,
        },
        {
          id: "w2",
          name: "Task 2 - Essay Writing",
          completed: false,
          questionCount: 1,
        },
      ],
      completed: false,
    },
  });

  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState({ type: "", content: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (testId) {
      fetchTestData();
    } else {
      // If no testId, we're in create mode
      setLoading(false);
    }
  }, [testId]);

  const fetchTestData = async () => {
    try {
      const { data: test, error: testError } = await supabase
        .from("tests")
        .select("*")
        .eq("id", testId)
        .single();

      if (testError) throw testError;

      setCurrentTest(test);

      // Check existing sections and update structure
      await checkExistingSections(testId);
    } catch (error: any) {
      console.error("Error fetching test:", error?.message || error);
      setMessage({
        type: "error",
        content: "Could not load test information",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkExistingSections = async (testId: string) => {
    try {
      // Check reading sections (with fallback for missing table/column)
      let readingSections: any[] = [];
      try {
        const { data, error } = await supabase
          .from("reading_sections")
          .select("id, passage_number")
          .eq("test_id", testId);

        if (!error) {
          readingSections = data || [];
        }
      } catch (err) {
        console.warn("Reading sections table not ready:", err);
      }

      // Check listening sections (with fallback)
      let listeningSections: any[] = [];
      try {
        const { data, error } = await supabase
          .from("listening_sections")
          .select("id, section_number")
          .eq("test_id", testId);

        if (!error) {
          listeningSections = data || [];
        }
      } catch (err) {
        console.warn("Listening sections table not ready:", err);
      }

      // Check writing tasks (with fallback)
      let writingTasks: any[] = [];
      try {
        const { data, error } = await supabase
          .from("writing_tasks")
          .select("id, task_number")
          .eq("test_id", testId);

        if (!error) {
          writingTasks = data || [];
        }
      } catch (err) {
        console.warn("Writing tasks table not ready:", err);
      }

      // Update structure based on existing data
      setTestStructure((prev) => ({
        ...prev,
        reading: {
          ...prev.reading,
          passages: prev.reading.passages.map((passage, index) => ({
            ...passage,
            completed:
              readingSections?.some((rs) => rs.passage_number === index + 1) ||
              false,
          })),
          completed: readingSections?.length === 3,
        },
        listening: {
          ...prev.listening,
          sections: prev.listening.sections.map((section, index) => ({
            ...section,
            completed:
              listeningSections?.some(
                (ls) => ls.section_number === index + 1,
              ) || false,
          })),
          completed: listeningSections?.length === 4,
        },
        writing: {
          ...prev.writing,
          tasks: prev.writing.tasks.map((task, index) => ({
            ...task,
            completed:
              writingTasks?.some((wt) => wt.task_number === index + 1) || false,
          })),
          completed: writingTasks?.length === 2,
        },
      }));
    } catch (error) {
      console.error("Error checking existing sections:", error);
    }
  };

  const getCompletionPercentage = () => {
    const { type } = currentTest || {};
    const readingProgress =
      testStructure.reading.passages.filter((p) => p.completed).length / 3;
    const listeningProgress =
      testStructure.listening.sections.filter((s) => s.completed).length / 4;
    const writingProgress =
      testStructure.writing.tasks.filter((t) => t.completed).length / 2;

    switch (type) {
      case "reading":
        return Math.round(readingProgress * 100);
      case "listening":
        return Math.round(listeningProgress * 100);
      case "writing":
        return Math.round(writingProgress * 100);
      case "full":
      default:
        return Math.round(
          ((readingProgress + listeningProgress + writingProgress) / 3) * 100
        );
    }
  };

  const canPublish = () => {
    if (!currentTest) return false;

    const testType = currentTest.type;

    // For different test types, check only required sections
    switch (testType) {
      case "reading":
        // At least one reading passage completed
        return testStructure.reading.passages.some((p) => p.completed);

      case "listening":
        // At least one listening section completed
        return testStructure.listening.sections.some((s) => s.completed);

      case "writing":
        // At least one writing task completed
        return testStructure.writing.tasks.some((t) => t.completed);

      case "full":
      default:
        // All sections must be completed for full test
        return (
          testStructure.reading.completed &&
          testStructure.listening.completed &&
          testStructure.writing.completed
        );
    }
  };

  const publishTest = async () => {
    if (!currentTest || !canPublish()) return;

    setIsPublishing(true);
    setMessage({ type: "", content: "" });

    try {
      const { error } = await supabase
        .from("tests")
        .update({
          status: "published",
        })
        .eq("id", currentTest.id);

      if (error) throw error;

      setMessage({
        type: "success",
        content:
          "Test published successfully! Students can now apply to take this test.",
      });

      setTimeout(() => {
        navigate("/edu-admin/dashboard");
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

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!currentTest) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Test not found</h1>
          <p className="text-muted-foreground">
            The test you're looking for doesn't exist.
          </p>
          <Button
            onClick={() => navigate("/edu-admin/dashboard")}
            className="mt-4"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/edu-admin/dashboard")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">
              {currentTest.title}
            </h1>
            <p className="text-muted-foreground">
              IELTS Test Creation • Status: {currentTest.status}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium">Progress</div>
              <div className="text-2xl font-bold">
                {getCompletionPercentage()}%
              </div>
            </div>
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

        <Progress value={getCompletionPercentage()} className="w-full" />
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

      {/* Reading Section */}
      {(currentTest.type === "reading" || currentTest.type === "full") && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span>Academic Reading Section</span>
                  {testStructure.reading.completed ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {
                        testStructure.reading.passages.filter(
                          (p) => p.completed,
                        ).length
                      }
                      /3 Complete
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground font-normal">
                  {currentTest.type === "reading"
                    ? "60 minutes • Up to 3 academic passages • 40 questions total"
                    : "60 minutes • 3 academic passages • 40 questions total"}
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {testStructure.reading.passages.map((passage, index) => (
              <div
                key={passage.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold">{passage.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      13-14 questions • Academic text from journals, books,
                      magazines
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {passage.completed ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not Started</Badge>
                  )}
                  <Button
                    onClick={() =>
                      navigate(
                        `/edu-admin/tests/create/reading-wizard/${testId}/${index + 1}`,
                      )
                    }
                  >
                    {passage.completed ? "Edit" : "Create"} Passage
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Listening Section */}
      {(currentTest.type === "listening" || currentTest.type === "full") && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Headphones className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span>Listening Section</span>
                  {testStructure.listening.completed ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {
                        testStructure.listening.sections.filter(
                          (s) => s.completed,
                        ).length
                      }
                      /4 Complete
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground font-normal">
                  {currentTest.type === "listening"
                    ? "60 minutes • Up to 4 sections • 40 questions total"
                    : "60 minutes • 4 sections • 40 questions total"}
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {testStructure.listening.sections.map((section, index) => (
              <div
                key={section.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold">{section.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      10 questions • Audio recording
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {section.completed ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not Started</Badge>
                  )}
                  <Button
                    onClick={() =>
                      navigate(
                        `/edu-admin/tests/create/listening/${testId}/${index + 1}`,
                      )
                    }
                  >
                    {section.completed ? "Edit" : "Create"} Section
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Writing Section */}
      {(currentTest.type === "writing" || currentTest.type === "full") && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <PenTool className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span>Writing Section</span>
                  {testStructure.writing.completed ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {
                        testStructure.writing.tasks.filter((t) => t.completed)
                          .length
                      }
                      /2 Complete
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground font-normal">
                  {currentTest.type === "writing"
                    ? "60 minutes • Up to 2 tasks • Task 1: 20min, Task 2: 40min"
                    : "60 minutes • 2 tasks • Task 1: 20min, Task 2: 40min"}
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {testStructure.writing.tasks.map((task, index) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold">{task.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {index === 0
                        ? "150+ words • 20 minutes • Describe visual information"
                        : "250+ words • 40 minutes • Academic essay"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {task.completed ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not Started</Badge>
                  )}
                  <Button
                    onClick={() =>
                      navigate(
                        `/edu-admin/tests/create/writing/${testId}/${index + 1}`,
                      )
                    }
                  >
                    {task.completed ? "Edit" : "Create"} Task
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Publishing Requirements */}
      <Card>
        <CardHeader>
          <CardTitle>Publishing Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {/* Reading requirements */}
            {(currentTest.type === "reading" ||
              currentTest.type === "full") && (
              <div className="flex items-center gap-2">
                {(
                  currentTest.type === "reading"
                    ? testStructure.reading.passages.some((p) => p.completed)
                    : testStructure.reading.completed
                ) ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                )}
                <span>
                  {currentTest.type === "reading"
                    ? "Complete at least 1 Reading passage (minimum 13 questions)"
                    : "Complete all 3 Reading passages (40 questions total)"}
                </span>
              </div>
            )}

            {/* Listening requirements */}
            {(currentTest.type === "listening" ||
              currentTest.type === "full") && (
              <div className="flex items-center gap-2">
                {(
                  currentTest.type === "listening"
                    ? testStructure.listening.sections.some((s) => s.completed)
                    : testStructure.listening.completed
                ) ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                )}
                <span>
                  {currentTest.type === "listening"
                    ? "Complete at least 1 Listening section (minimum 10 questions)"
                    : "Complete all 4 Listening sections (40 questions total)"}
                </span>
              </div>
            )}

            {/* Writing requirements */}
            {(currentTest.type === "writing" ||
              currentTest.type === "full") && (
              <div className="flex items-center gap-2">
                {(
                  currentTest.type === "writing"
                    ? testStructure.writing.tasks.some((t) => t.completed)
                    : testStructure.writing.completed
                ) ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                )}
                <span>
                  {currentTest.type === "writing"
                    ? "Complete at least 1 Writing task (Task 1 or Task 2)"
                    : "Complete both Writing tasks (Task 1 & Task 2)"}
                </span>
              </div>
            )}
          </div>

          {canPublish() && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-semibold">Ready to publish!</span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                All sections are complete. Your test is ready for students.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateIELTSTest;
