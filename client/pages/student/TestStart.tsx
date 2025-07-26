import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Clock,
  BookOpen,
  Volume2,
  PenTool,
  Play,
  Users,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface TestSection {
  type: "reading" | "listening" | "writing";
  title: string;
  icon: any;
  duration: number;
  questionCount: number;
  description: string;
  status: "available" | "completed" | "in_progress" | "locked";
  estimatedTime: string;
}

interface TestInfo {
  id: string;
  title: string;
  description: string;
  type: string;
  totalDuration: number;
  sections: TestSection[];
}

const TestStart: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [testInfo, setTestInfo] = useState<TestInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (testId) {
      loadTestInfo();
    }
  }, [testId]);

  const loadTestInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check network connectivity
      if (!navigator.onLine) {
        console.warn("⚠️ Device is offline, using fallback data");
        loadFallbackTestInfo();
        return;
      }

      // Load test basic info
      const { data: test, error: testError } = await supabase
        .from("tests")
        .select("*")
        .eq("id", testId)
        .single();

      if (testError) {
        console.error("Test info error:", testError);
        // Try fallback
        loadFallbackTestInfo();
        return;
      }

      // Load all sections
      const [readingSections, listeningSections, writingSections] =
        await Promise.all([
          loadReadingSections(),
          loadListeningSections(),
          loadWritingSections(),
        ]);

      // Build test info with detected sections
      const sections: TestSection[] = [];

      if (readingSections.length > 0) {
        sections.push({
          type: "reading",
          title: "Reading",
          icon: BookOpen,
          duration: 60,
          questionCount: readingSections.reduce(
            (total, section) => total + (section.questionCount || 0),
            0,
          ),
          description: `${readingSections.length} passage${readingSections.length > 1 ? "s" : ""} with comprehension questions`,
          status: "available",
          estimatedTime: "60 minutes",
        });
      }

      if (listeningSections.length > 0) {
        sections.push({
          type: "listening",
          title: "Listening",
          icon: Volume2,
          duration: 30,
          questionCount: listeningSections.reduce(
            (total, section) => total + (section.questionCount || 0),
            0,
          ),
          description: `${listeningSections.length} section${listeningSections.length > 1 ? "s" : ""} with audio recordings`,
          status: "available",
          estimatedTime: "30 minutes",
        });
      }

      if (writingSections.length > 0) {
        sections.push({
          type: "writing",
          title: "Writing",
          icon: PenTool,
          duration: 60,
          questionCount: writingSections.length,
          description: `${writingSections.length} writing task${writingSections.length > 1 ? "s" : ""}`,
          status: "available",
          estimatedTime: "60 minutes",
        });
      }

      setTestInfo({
        id: testId,
        title: test?.title || "IELTS Practice Test",
        description: test?.description || "Complete IELTS practice examination",
        type: test?.type || "IELTS",
        totalDuration: sections.reduce(
          (total, section) => total + section.duration,
          0,
        ),
        sections,
      });
    } catch (error: any) {
      console.error("Error loading test info:", error);
      setError("Failed to load test information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackTestInfo = () => {
    // Create fallback test info for offline mode
    setTestInfo({
      id: testId!,
      title: "IELTS Practice Test (Offline)",
      description: "Practice test running in offline mode",
      type: "IELTS",
      totalDuration: 30,
      sections: [
        {
          type: "listening",
          title: "Listening",
          icon: Volume2,
          duration: 30,
          questionCount: 10,
          description: "Audio-based comprehension questions",
          status: "available",
          estimatedTime: "30 minutes",
        },
      ],
    });
  };

  const loadReadingSections = async () => {
    try {
      const { data, error } = await supabase
        .from("reading_sections")
        .select(
          `
          id, title, passage_number,
          reading_questions(id)
        `,
        )
        .eq("test_id", testId);

      if (error) throw error;

      return (data || []).map((section) => ({
        ...section,
        questionCount: section.reading_questions?.length || 0,
      }));
    } catch (error) {
      console.warn("Could not load reading sections:", error);
      return [];
    }
  };

  const loadListeningSections = async () => {
    try {
      const { data, error } = await supabase
        .from("listening_sections")
        .select(
          `
          id, title, section_number,
          listening_questions(id)
        `,
        )
        .eq("test_id", testId);

      if (error) throw error;

      return (data || []).map((section) => ({
        ...section,
        questionCount: section.listening_questions?.length || 0,
      }));
    } catch (error) {
      console.warn("Could not load listening sections:", error);
      // Check localStorage for offline data
      const offlineData = localStorage.getItem(`offline-section-${testId}-1`);
      if (offlineData) {
        try {
          const parsed = JSON.parse(offlineData);
          return [
            {
              id: "offline-1",
              title: "Listening Section (Offline)",
              section_number: 1,
              questionCount: parsed.questions?.length || 1,
            },
          ];
        } catch (e) {
          return [];
        }
      }
      return [];
    }
  };

  const loadWritingSections = async () => {
    try {
      const { data, error } = await supabase
        .from("writing_tasks")
        .select("id, task_title, task_number")
        .eq("test_id", testId);

      if (error) throw error;
      return (data || []).map((task) => ({
        ...task,
        title: task.task_title,
        questionCount: 1,
      }));
    } catch (error) {
      console.warn("Could not load writing tasks:", error);
      return [];
    }
  };

  const startSection = (sectionType: string) => {
    console.log(`🚀 Starting ${sectionType} section for test ${testId}`);

    // Navigate to appropriate section interface
    switch (sectionType) {
      case "reading":
        navigate(`/student/test/${testId}/reading`);
        break;
      case "listening":
        navigate(`/student/test/${testId}/listening`);
        break;
      case "writing":
        navigate(`/student/test/${testId}/writing`);
        break;
      default:
        // Fallback to old interface
        navigate(`/student/test/${testId}`);
    }
  };

  const startFullTest = () => {
    console.log(`🚀 Starting full test ${testId}`);
    // Start with first available section
    if (testInfo?.sections.length) {
      startSection(testInfo.sections[0].type);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">
            Loading Test Information...
          </h3>
          <p className="text-gray-600 mt-2">
            Please wait while we prepare your test
          </p>
        </div>
      </div>
    );
  }

  if (error || !testInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Unable to Load Test
          </h3>
          <p className="text-gray-600 mb-6">
            {error || "Test not found or not accessible"}
          </p>
          <Button onClick={() => navigate("/student/tests")} variant="outline">
            Back to Tests
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {testInfo.title}
          </h1>
          <p className="text-lg text-gray-600 mb-4">{testInfo.description}</p>

          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{testInfo.totalDuration} minutes total</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>
                {testInfo.sections.length} section
                {testInfo.sections.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Sections Grid */}
        <div className="grid gap-6 mb-8">
          {testInfo.sections.map((section, index) => (
            <motion.div
              key={section.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-all duration-200 border-2 hover:border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-blue-100">
                        <section.icon className="h-6 w-6 text-blue-600" />
                      </div>

                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-1">
                          {section.title} Section
                        </h3>
                        <p className="text-gray-600 mb-2">
                          {section.description}
                        </p>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {section.estimatedTime}
                          </span>
                          <span>{section.questionCount} questions</span>
                          <Badge
                            variant={
                              section.status === "available"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {section.status === "available"
                              ? "Ready"
                              : section.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => startSection(section.type)}
                      disabled={section.status !== "available"}
                      size="lg"
                      className="flex items-center gap-2 px-6"
                    >
                      <Play className="h-4 w-4" />
                      Start {section.title}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center space-y-4"
        >
          {testInfo.sections.length > 1 && (
            <Button
              onClick={startFullTest}
              size="lg"
              className="px-8 py-3 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <ArrowRight className="h-5 w-5 mr-2" />
              Take Full Test ({testInfo.totalDuration} minutes)
            </Button>
          )}

          <div>
            <Button
              onClick={() => navigate("/student/tests")}
              variant="outline"
              className="px-6"
            >
              Back to Tests
            </Button>
          </div>
        </motion.div>

        {/* Test Instructions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> This is a simulated IELTS exam
              environment. Audio cannot be paused during listening sections, and
              time limits are strictly enforced. Your answers are automatically
              saved as you work.
            </AlertDescription>
          </Alert>
        </motion.div>
      </div>
    </div>
  );
};

export default TestStart;
