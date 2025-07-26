import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import Split from "react-split/dist/react-split";

interface WritingTask {
  id: string;
  task_title: string;
  task_prompt: string;
  task_instructions: string;
  word_limit: number;
  task_image_url?: string;
  task_type: string;
  task_order: number;
}

// Confirmation page component
const WritingTestConfirmation: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center p-8 bg-white rounded-lg shadow max-w-lg mx-auto">
      <svg className="mx-auto mb-4 text-green-500" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2l4-4m5 2a9 9 0 11-18 0a9 9 0 0118 0z" /></svg>
      <h2 className="text-2xl font-bold mb-2">Writing Test Submitted!</h2>
      <p className="text-gray-700 mb-4">Your writing test has been submitted successfully. You will be notified when it is graded.</p>
      <Button onClick={() => window.location.href = "/student/tests"} className="bg-blue-600 hover:bg-blue-700 text-white">Back to Tests</Button>
    </div>
  </div>
);

const TakeWritingTest: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [currentTaskOrder, setCurrentTaskOrder] = useState(1);
  const [tasks, setTasks] = useState<WritingTask[]>([]);
  const [testData, setTestData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(60 * 60); // 60 minutes
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const localStorageKey = testId ? `writing-test-${testId}` : null;
  const [submitted, setSubmitted] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;
    setLoading(true);
    (async () => {
      try {
        const { data: test, error: testError } = await supabase
          .from("tests")
          .select("*")
          .eq("id", testId)
          .single();
        if (testError) throw testError;
        setTestData(test);
        const { data: tasksData, error: tasksError } = await supabase
          .from("writing_tasks")
          .select("*")
          .eq("test_id", testId)
          .order("task_order");
        if (tasksError) throw tasksError;
        if (!tasksData || tasksData.length === 0) {
          throw new Error("No writing tasks found for this test");
        }
        setTasks(tasksData);
      } catch (error: any) {
        toast.error(`Failed to load test: ${error.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [testId]);

  // On mount, restore from localStorage (answers and time)
  useEffect(() => {
    if (!localStorageKey) return;
    const saved = localStorage.getItem(localStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.wordCounts) setWordCounts(parsed.wordCounts);
        if (parsed.timeRemaining) setTimeRemaining(parsed.timeRemaining);
        if (parsed.submitted) {
          setSubmitted(true);
        }
      } catch {}
    }
  }, [localStorageKey]);

  // If already submitted, redirect to confirmation page
  useEffect(() => {
    if (submitted) {
      navigate("/student/test/confirmation", { replace: true, state: { writing: true } });
    }
  }, [submitted, navigate]);

  // Auto-save answers and time to localStorage on every change
  useEffect(() => {
    if (!localStorageKey) return;
    localStorage.setItem(
      localStorageKey,
      JSON.stringify({
        answers,
        wordCounts,
        timeRemaining,
        testId,
        timestamp: Date.now(),
        submitted: false,
      })
    );
    setLastSaved(Date.now());
  }, [answers, wordCounts, timeRemaining, localStorageKey, testId]);

  // Timer: keep running even if user leaves and returns
  useEffect(() => {
    if (!localStorageKey) return;
    let interval: NodeJS.Timeout | null = null;
    interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleSubmit(true);
          return 0;
        }
        // Save time to localStorage every tick
        localStorage.setItem(
          localStorageKey,
          JSON.stringify({
            answers,
            wordCounts,
            timeRemaining: prev - 1,
            testId,
            timestamp: Date.now(),
            submitted: false,
          })
        );
        return prev - 1;
      });
    }, 1000);
    return () => interval && clearInterval(interval);
  }, [answers, wordCounts, localStorageKey, testId]);

  const handleWritingChange = (taskId: string, content: string) => {
    setAnswers((prev) => ({ ...prev, [taskId]: content }));
    const words = content.trim().split(/\s+/).filter((word) => word.length > 0);
    setWordCounts((prev) => ({ ...prev, [taskId]: words.length }));
  };

  // Submit logic: mark as submitted, clear localStorage, and upsert to DB
  const handleSubmit = async (autoSubmit = false) => {
    setUiError(null);
    console.log("Submit button pressed", { autoSubmit, submitting });
    if (submitting) {
      setUiError("Submission is already in progress. Please wait.");
      console.warn("Submission blocked: already submitting");
      return; // Prevent double submission
    }
    setSubmitting(true);
    try {
      console.log("Submitting writing test", {
        testId,
        userId: user?.id,
        answers,
        wordCounts,
        timeRemaining,
        autoSubmit
      });
      const submission = {
        test_id: testId!,
        student_id: user?.id!,
        answers: answers,
        submitted_at: new Date().toISOString(),
        status: "submitted",
      };
      console.log("Upserting submission to Supabase", submission);
      const { error } = await supabase
        .from("test_submissions")
        .upsert(submission, { onConflict: "test_id,student_id" });
      if (error) {
        setUiError("Failed to save your submission. Please try again or contact support.");
        console.error("Supabase upsert error", error);
        throw error;
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (localStorageKey) {
        localStorage.setItem(
          localStorageKey,
          JSON.stringify({
            answers,
            wordCounts,
            timeRemaining,
            testId,
            timestamp: Date.now(),
            submitted: true,
          })
        );
        setTimeout(() => localStorage.removeItem(localStorageKey), 1000);
      }
      setSubmitted(true);
      console.log("Submission successful, redirecting to confirmation page");
      // navigate to confirmation page is handled by useEffect
    } catch (error: any) {
      setUiError("An unexpected error occurred while submitting your test. Please try again or contact support.");
      console.error("Failed to submit writing test", error);
      toast.error(`Failed to submit test: ${error.message || error}`);
    } finally {
      setSubmitting(false);
      setShowSubmitDialog(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading writing test...</p>
        </div>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Writing Tasks Found
          </h3>
          <p className="text-gray-600 mb-6">
            This test does not have any writing tasks assigned. Please contact your instructor.
          </p>
          <Button onClick={() => navigate("/student/tests")}>Back to Tests</Button>
        </div>
      </div>
    );
  }

  const currentTask = tasks.find((t) => t.task_order === currentTaskOrder) || tasks[0];

  // Render confirmation page if on confirmation route
  if (location.pathname === "/student/test/confirmation") {
    return <WritingTestConfirmation />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Sticky Timer */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">IELTS Writing Test</h1>
          <div className="flex items-center gap-4">
            <Badge variant="outline">Time Left: {formatTime(timeRemaining)}</Badge>
            {lastSaved && (
              <span className="text-xs text-gray-500">
                Saved {Math.round((Date.now() - lastSaved) / 1000)}s ago
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto p-6 w-full flex flex-col">
        {uiError && (
          <div className="mb-4 p-4 bg-red-100 border border-red-300 text-red-700 rounded">
            <strong>Error:</strong> {uiError}
          </div>
        )}
        {/* Split Screen for Current Task */}
        <Split
          className="flex-1 flex gap-4"
          minSize={200}
          sizes={[50, 50]}
          gutterSize={8}
          direction="horizontal"
          style={{ height: "100%" }}
        >
          {/* Left: Instructions/Prompt/Image */}
          <div className="bg-white rounded-lg shadow p-6 flex flex-col h-full overflow-auto">
            <h2 className="text-lg font-bold mb-2">
              Task {currentTask.task_order}: {currentTask.task_title}
            </h2>
            <div className="mb-2">
              <span className="font-semibold">Instructions: </span>
              {currentTask.task_instructions?.trim()
                ? currentTask.task_instructions
                : (currentTask.task_order === 1
                  ? "Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words."
                  : "Present a well-organised response to the prompt. Write at least 250 words.")}
            </div>
            <div className="mb-2">
              <span className="font-semibold">Prompt: </span>
              <div
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: currentTask.task_prompt }}
              />
            </div>
            {currentTask.task_image_url && currentTask.task_order === 1 && (
              <div className="mb-2">
                <img
                  src={currentTask.task_image_url}
                  alt="Task visual"
                  className="w-full rounded border"
                />
              </div>
            )}
          </div>

          {/* Right: Input Area */}
          <div className="bg-gray-50 rounded-lg shadow p-6 flex flex-col h-full">
            <label className="block font-semibold mb-2" htmlFor={`textarea-${currentTask.id}`}>
              Your Answer for Task {currentTask.task_order}
            </label>
            <textarea
              id={`textarea-${currentTask.id}`}
              className="w-full min-h-[300px] h-full border rounded p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              placeholder={`Write your response to Task ${currentTask.task_order} here...\n\nRemember to write at least ${currentTask.word_limit} words.`}
              value={answers[currentTask.id] || ""}
              onChange={(e) => handleWritingChange(currentTask.id, e.target.value)}
              disabled={submitting}
              maxLength={5000}
              style={{ flex: 1 }}
            />
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>Min. words: {currentTask.word_limit}</span>
              <span className={
                (wordCounts[currentTask.id] || 0) >= (currentTask.word_limit || 0)
                  ? "text-green-600 font-semibold"
                  : "text-orange-600 font-semibold"
              }>
                Current: {wordCounts[currentTask.id] || 0}
              </span>
            </div>
          </div>
        </Split>

        {/* Bottom Navigation */}
        <div className="mt-8 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex gap-4 w-full md:w-auto justify-center">
            <Button
              type="button"
              variant={currentTaskOrder === 1 ? "default" : "outline"}
              className="w-full md:w-auto"
              onClick={() => setCurrentTaskOrder(1)}
            >
              Task 1
            </Button>
            <Button
              type="button"
              variant={currentTaskOrder === 2 ? "default" : "outline"}
              className="w-full md:w-auto"
              onClick={() => setCurrentTaskOrder(2)}
            >
              Task 2
            </Button>
          </div>
          {currentTaskOrder === 2 && (
            <Button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white flex items-center justify-center"
              size="lg"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                  Submitting...
                </span>
              ) : (
                "Submit Writing Test"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TakeWritingTest;
