import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PenTool,
  Save,
  X,
  Star,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface WritingSubmission {
  id: string;
  test_id: string;
  student_id: string;
  answers: Record<string, string>;
  submitted_at: string;
  status: string;
  student?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  test_type?: string; // allow test_type to be passed
}

interface WritingTask {
  id: string;
  task_title: string;
  task_prompt: string;
  task_instructions: string;
  word_limit: number;
  duration_minutes: number;
  task_type: string;
  task_order: number;
}

interface IELTSGradingCriteria {
  taskAchievement: number; // 0-9
  coherenceCohesion: number; // 0-9
  lexicalResource: number; // 0-9
  grammarAccuracy: number; // 0-9
}

interface WritingGradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: WritingSubmission | null;
  onGradingComplete: () => void;
}

export const WritingGradingModal: React.FC<WritingGradingModalProps> = ({
  isOpen,
  onClose,
  submission,
  onGradingComplete,
}) => {
  const [tasks, setTasks] = useState<WritingTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Grading state for each task
  const [taskGrades, setTaskGrades] = useState<
    Record<string, IELTSGradingCriteria>
  >({});
  const [taskComments, setTaskComments] = useState<Record<string, string>>({});
  const [overallBandScore, setOverallBandScore] = useState<number>(0);
  const [finalComments, setFinalComments] = useState("");
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});

  // Load tasks and existing grades when modal opens
  useEffect(() => {
    if (isOpen && submission) {
      console.log("[WritingGradingModal] submission.answers:", submission.answers);
      loadTasks();
      loadExistingGrades();
      calculateWordCounts();
    }
  }, [isOpen, submission]);

  useEffect(() => {
    if (isOpen && tasks.length > 0) {
      console.log("[WritingGradingModal] tasks:", tasks);
    }
  }, [isOpen, tasks]);

  const loadTasks = async () => {
    if (!submission) return;

    setLoading(true);
    try {
      const { data: tasksData, error } = await supabase
        .from("writing_tasks") // <-- use the correct table
        .select("*")
        .eq("test_id", submission.test_id);

      if (error) throw error;
      setTasks(tasksData || []);
    } catch (error: any) {
      toast.error(`Failed to load tasks: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingGrades = async () => {
    if (!submission) return;

    try {
      const { data: existingSubmission, error } = await supabase
        .from("test_submissions")
        .select("writing_grading_data, writing_score, final_comments")
        .eq("id", submission.id)
        .single();

      if (error) throw error;

      if (existingSubmission?.writing_grading_data) {
        try {
          const gradingData = JSON.parse(
            existingSubmission.writing_grading_data,
          );
          setTaskGrades(gradingData.taskGrades || {});
          setTaskComments(gradingData.taskComments || {});
          setOverallBandScore(gradingData.overallBandScore || 0);
        } catch (e) {
          console.warn("Failed to parse existing grading data");
        }
      }

      if (existingSubmission?.final_comments) {
        setFinalComments(existingSubmission.final_comments);
      }

      if (existingSubmission?.writing_score) {
        setOverallBandScore(parseFloat(existingSubmission.writing_score));
      }
    } catch (error: any) {
      console.warn("No existing grades found");
    }
  };

  const calculateWordCounts = () => {
    if (!submission?.answers) return;

    const counts: Record<string, number> = {};
    Object.entries(submission.answers).forEach(([taskId, content]) => {
      if (typeof content === "string") {
        const words = content
          .trim()
          .split(/\s+/)
          .filter((word) => word.length > 0);
        counts[taskId] = words.length;
      }
    });
    setWordCounts(counts);
  };

  const updateTaskGrade = (
    taskId: string,
    criteria: keyof IELTSGradingCriteria,
    value: number,
  ) => {
    setTaskGrades((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [criteria]: value,
      },
    }));
  };

  const calculateTaskBandScore = (taskId: string): number => {
    const grades = taskGrades[taskId];
    if (!grades) return 0;

    const {
      taskAchievement,
      coherenceCohesion,
      lexicalResource,
      grammarAccuracy,
    } = grades;
    return (
      (taskAchievement +
        coherenceCohesion +
        lexicalResource +
        grammarAccuracy) /
      4
    );
  };

  const calculateOverallBandScore = (): number => {
    const taskIds = Object.keys(taskGrades);
    if (taskIds.length === 0) return 0;

    const taskScores = taskIds.map((taskId) => calculateTaskBandScore(taskId));
    const average =
      taskScores.reduce((sum, score) => sum + score, 0) / taskScores.length;

    // Round to nearest 0.5
    return Math.round(average * 2) / 2;
  };

  const handleSaveGrades = async () => {
    if (!submission) return;

    setSaving(true);
    try {
      const calculatedBandScore = calculateOverallBandScore();

      const gradingData = {
        taskGrades,
        taskComments,
        overallBandScore: calculatedBandScore,
        gradedAt: new Date().toISOString(),
        gradedBy: "admin",
      };

      // Fetch the test type if not already available
      let testType = submission.test_type;
      if (!testType && submission.test_id) {
        const { data: test } = await supabase
          .from("tests")
          .select("type")
          .eq("id", submission.test_id)
          .single();
        testType = test?.type;
      }

      const updateData: any = {
        writing_score: calculatedBandScore,
        status: "graded",
        graded_at: new Date().toISOString(),
        writing_grading_data: JSON.stringify(gradingData),
        final_comments: finalComments,
      };

      // If this is a writing-only test, also set total_score
      if (
        testType === "writing" ||
        (tasks.length > 0 && tasks.every((t) => t.task_type === "writing"))
      ) {
        updateData.total_score = calculatedBandScore;
      }

      const { error } = await supabase
        .from("test_submissions")
        .update(updateData)
        .eq("id", submission.id);

      if (error) throw error;

      toast.success("Writing grades saved successfully!");
      onGradingComplete();
      onClose();
    } catch (error: any) {
      toast.error(`Failed to save grades: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getBandScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6.5) return "text-blue-600";
    if (score >= 5) return "text-yellow-600";
    return "text-red-600";
  };

  const getBandScoreLabel = (score: number) => {
    if (score >= 8.5) return "Expert User";
    if (score >= 7.5) return "Very Good User";
    if (score >= 6.5) return "Competent User";
    if (score >= 5.5) return "Modest User";
    if (score >= 4.5) return "Limited User";
    return "Extremely Limited User";
  };

  if (!isOpen || !submission) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <PenTool className="h-6 w-6" />
                Writing Assessment
              </h2>
              <p className="text-gray-600">
                {submission.student?.first_name} {submission.student?.last_name}{" "}
                • {new Date(submission.submitted_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {calculateOverallBandScore().toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Overall Band Score</div>
              </div>
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <ScrollArea className="h-[calc(90vh-120px)] p-6">
          {/* Grading Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Student Responses */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Student Responses</h3>
              {tasks.map((task, index) => {
                const response = submission.answers[task.id] || "";
                const wordCount = wordCounts[task.id] || 0;
                const meetsWordLimit = wordCount >= task.word_limit;
                return (
                  <Card key={task.id} className="mb-4">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {task.task_title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      {/* Show student's writing response for this task in detail */}
                      <div>
                        <Label className="text-sm font-semibold">Student Response</Label>
                        <div className="bg-blue-50 p-4 rounded whitespace-pre-wrap min-h-[40px]">
                          {submission.answers[task.id] || <span className="text-gray-400 italic">No response provided</span>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {/* Grading Interface */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">IELTS Writing Assessment</h3>
              {tasks.map((task) => {
                const taskBandScore = calculateTaskBandScore(task.id);
                const grades = taskGrades[task.id] || {
                  taskAchievement: 0,
                  coherenceCohesion: 0,
                  lexicalResource: 0,
                  grammarAccuracy: 0,
                };
                return (
                  <Card key={task.id} className="mb-4">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{task.task_title}</span>
                        <div className="text-right">
                          <div className={`text-xl font-bold ${getBandScoreColor(taskBandScore)}`}>
                            {taskBandScore.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-600">
                            {getBandScoreLabel(taskBandScore)}
                          </div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Task Achievement/Response */}
                      <div>
                        <Label className="text-sm font-semibold">Task Achievement/Response (0-9)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={9}
                          step={0.5}
                          value={grades.taskAchievement ?? 0}
                          onChange={e => updateTaskGrade(task.id, "taskAchievement", parseFloat(e.target.value))}
                          className="w-24"
                        />
                      </div>
                      {/* Coherence and Cohesion */}
                      <div>
                        <Label className="text-sm font-semibold">Coherence and Cohesion (0-9)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={9}
                          step={0.5}
                          value={grades.coherenceCohesion ?? 0}
                          onChange={e => updateTaskGrade(task.id, "coherenceCohesion", parseFloat(e.target.value))}
                          className="w-24"
                        />
                      </div>
                      {/* Lexical Resource */}
                      <div>
                        <Label className="text-sm font-semibold">Lexical Resource (0-9)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={9}
                          step={0.5}
                          value={grades.lexicalResource ?? 0}
                          onChange={e => updateTaskGrade(task.id, "lexicalResource", parseFloat(e.target.value))}
                          className="w-24"
                        />
                      </div>
                      {/* Grammatical Range and Accuracy */}
                      <div>
                        <Label className="text-sm font-semibold">Grammatical Range and Accuracy (0-9)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={9}
                          step={0.5}
                          value={grades.grammarAccuracy ?? 0}
                          onChange={e => updateTaskGrade(task.id, "grammarAccuracy", parseFloat(e.target.value))}
                          className="w-24"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
          {/* Overview & Comments Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            {/* Overall Assessment */}
            <Card>
              <CardHeader>
                <CardTitle>Overall Assessment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getBandScoreColor(calculateOverallBandScore())}`}>
                    {calculateOverallBandScore().toFixed(1)}
                  </div>
                  <div className="text-lg text-gray-600">
                    {getBandScoreLabel(calculateOverallBandScore())}
                  </div>
                </div>
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const taskScore = calculateTaskBandScore(task.id);
                    return (
                      <div key={task.id} className="flex justify-between items-center">
                        <span className="font-medium">{task.task_title}</span>
                        <span className={`font-bold ${getBandScoreColor(taskScore)}`}>{taskScore.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold">Final Comments & Feedback</Label>
                  <Textarea
                    placeholder="Provide overall feedback for the student..."
                    value={finalComments}
                    onChange={(e) => setFinalComments(e.target.value)}
                    className="h-32 mt-2"
                  />
                </div>
              </CardContent>
            </Card>
            {/* Test Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Test Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {tasks.slice(0, 2).map((task, idx) => {
                    const wordCount = wordCounts[task.id] || 0;
                    return (
                      <div key={task.id} className={`text-center p-3 rounded ${idx === 0 ? 'bg-blue-50' : 'bg-green-50'}`}>
                        <div className={`text-2xl font-bold ${idx === 0 ? 'text-blue-600' : 'text-green-600'}`}>{wordCount}</div>
                        <div className="text-sm text-gray-600">{task.task_title} Words</div>
                      </div>
                    );
                  })}
                </div>
                {/* Removed per-task word count list below */}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        <div className="p-6 border-t bg-gray-50 sticky bottom-0 z-10">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Overall Band Score: {calculateOverallBandScore().toFixed(1)} • {getBandScoreLabel(calculateOverallBandScore())}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSaveGrades} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Grade"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WritingGradingModal;
