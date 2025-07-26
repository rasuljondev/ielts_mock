import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Eye,
  CheckCircle,
  Clock,
  FileText,
  User,
  Calendar,
  Award,
  Star,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logError, classifyError } from "@/lib/errorUtils";
import { useAuth } from "@/contexts/AuthContext";
import SubmissionReviewModal from "@/components/admin/SubmissionReviewModal";
import { AnswerReview } from "@/components/ui/answer-review";
import { AnswerSubmission } from "@/components/ui/answer-submission";
import WritingGradingModal from "@/components/admin/WritingGradingModal";

/*
 * DEMO FEATURES - REMOVE WHEN NOT NEEDED
 * 
 * This file contains demo functionality for testing purposes:
 * - handleDeleteSubmission(): Allows admins to delete test submissions
 * - "Demo Delete" button in the actions table
 * - Trash2 icon import
 * 
 * To remove demo features:
 * 1. Delete the handleDeleteSubmission function
 * 2. Remove the "Demo Delete" button from the table actions
 * 3. Remove Trash2 from the lucide-react imports
 * 4. Remove this comment block
 */

interface TestSubmission {
  id: string;
  test_id: string;
  student_id: string;
  status: string;
  submitted_at: string;
  answers?: any;
  test: {
    title: string;
    type: string;
  };
  student: {
    first_name: string;
    last_name: string;
    email: string;
  };
  // Score fields are optional in case they don't exist in the database yet
  total_score?: number | null;
  reading_score?: number | null;
  listening_score?: number | null;
  writing_score?: number | null;
}

const TestSubmissions: React.FC = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] =
    useState<TestSubmission | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [enhancedReviewOpen, setEnhancedReviewOpen] = useState(false);
  const [showWritingGrading, setShowWritingGrading] = useState(false);
  const [writingGradingSubmission, setWritingGradingSubmission] = useState<TestSubmission | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  // Debug: Monitor selectedSubmission state
  useEffect(() => {
    console.log("🔍 selectedSubmission state changed:", selectedSubmission);
  }, [selectedSubmission]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);

      // Get user's edu_center_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("edu_center_id")
        .eq("id", user?.id)
        .single();

      if (!profile?.edu_center_id) {
        setSubmissions([]);
        return;
      }

      // Get test submissions using manual joins to avoid relationship errors
      console.log(
        "Fetching submissions for edu_center_id:",
        profile.edu_center_id,
      );

      // Step 1: Get all tests for this edu center
      const { data: centerTests, error: testsError } = await supabase
        .from("tests")
        .select("id, title, type, edu_center_id")
        .eq("edu_center_id", profile.edu_center_id);

      if (testsError) {
        console.error("Error fetching tests:", testsError);
        throw testsError;
      }

      if (!centerTests || centerTests.length === 0) {
        console.log("No tests found for this education center");
        setSubmissions([]);
        setLoading(false);
        return;
      }

      const testIds = centerTests.map((t) => t.id);
      console.log("Found test IDs:", testIds);

      // Step 2: Get submissions for these tests
      const { data: submissions, error } = await supabase
        .from("test_submissions")
        .select(
          `
          id,
          test_id,
          student_id,
          status,
          submitted_at,
          answers,
          total_score,
          reading_score,
          listening_score,
          writing_score
        `,
        )
        .in("test_id", testIds)
        // Remove status filter to show all submissions
        // .in("status", ["submitted", "completed", "graded"])
        .order("submitted_at", { ascending: false });

      if (error) {
        console.error("Error fetching submissions:", error);
        throw error;
      }

      console.log("🔍 Raw submissions from database:", submissions);

      // Step 3: Enrich submissions with test and student data
      const data = await Promise.all(
        (submissions || []).map(async (submission) => {
          const test = centerTests.find((t) => t.id === submission.test_id);

          // Get student data
          const { data: student } = await supabase
            .from("profiles")
            .select("first_name, last_name, email")
            .eq("id", submission.student_id)
            .single();

          return {
            ...submission,
            test: test || {
              title: "Unknown Test",
              type: "unknown",
              edu_center_id: profile.edu_center_id,
            },
            student: student || {
              first_name: "Unknown",
              last_name: "Student",
              email: "unknown@email.com",
            },
          };
        }),
      );

      console.log("🔍 Enriched submissions data:", data);
      setSubmissions(data);

      if (error) {
        console.error("Error fetching submissions:", error);
        logError("fetchSubmissions", error);

        const classified = classifyError(error);
        if (classified.type === "network") {
          toast.error(
            "Network error. Please check your connection and try again.",
          );
        } else {
          toast.error(`Failed to load test submissions: ${classified.message}`);
        }
        return;
      }

      console.log("Fetched submissions:", data?.length || 0, "submissions");
      console.log("Sample submission:", data?.[0]);

      if ((data?.length || 0) === 0) {
        console.log("No submissions found. Possible reasons:");
        console.log("1. No tests have been submitted yet");
        console.log("2. RLS policies might be blocking access");
        console.log("3. edu_center_id mismatch");
        console.log("User's edu_center_id:", profile?.edu_center_id);
      }
    } catch (error: any) {
      console.error("Error fetching submissions:", error);
      logError("fetchSubmissions", error);

      const classified = classifyError(error);
      if (classified.type === "network") {
        toast.error("Network error. Please check your connection.");
      } else if (classified.type === "auth") {
        toast.error("Authentication error. Please refresh the page.");
      } else {
        toast.error(`Failed to load test submissions: ${classified.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = (submission: TestSubmission) => {
    console.log("🔍 Opening review modal with submission:", {
      id: submission.id,
      testId: submission.test_id,
      studentId: submission.student_id,
      status: submission.status,
      hasAnswers: !!submission.answers
    });
    setSelectedSubmission(submission);
    setEnhancedReviewOpen(false); // Close enhanced modal if open
    setReviewModalOpen(true);
  };

  const openEnhancedReview = (submission: TestSubmission) => {
    setSelectedSubmission(submission);
    setReviewModalOpen(false); // Close review modal if open
    setEnhancedReviewOpen(true);
  };

  const handleEnhancedGrading = async (
    submissionId: string,
    totalScore: number,
    feedback: string,
    criteriaScores?: any[],
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from("test_submissions")
        .update({
          total_score: totalScore,
          feedback: feedback,
          status: "graded",
          graded_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) throw error;

      // Refresh submissions
      await fetchSubmissions();
      setEnhancedReviewOpen(false);
      setSelectedSubmission(null);

      toast.success("Submission graded successfully!");
    } catch (error: any) {
      console.error("Error grading submission:", error);
      toast.error(`Failed to grade submission: ${error.message}`);
    }
  };

  const handleStatusChange = async (
    submissionId: string,
    status: string,
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from("test_submissions")
        .update({ status })
        .eq("id", submissionId);

      if (error) throw error;

      await fetchSubmissions();
      toast.success("Status updated successfully!");
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(`Failed to update status: ${error.message}`);
    }
  };

  const handleSubmissionGraded = () => {
    fetchSubmissions(); // Refresh the list
    setReviewModalOpen(false);
    setSelectedSubmission(null);
  };

  // DEMO FEATURE: Delete submission for demo purposes
  const handleDeleteSubmission = async (submissionId: string) => {
    if (!confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('test_submissions')
        .delete()
        .eq('id', submissionId);

      if (error) throw error;

      toast.success('Submission deleted successfully');
      fetchSubmissions(); // Refresh the list
    } catch (err) {
      console.error('Error deleting submission:', err);
      toast.error('Failed to delete submission');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "submitted":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "graded":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Test Submissions</h1>
          <p className="text-muted-foreground">
            Review and grade student test submissions
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading submissions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">Test Submissions</h1>
        <p className="text-muted-foreground">
          Review and grade student test submissions
        </p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Submissions
                </p>
                <p className="text-2xl font-bold">{submissions.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Pending Review
                </p>
                <p className="text-2xl font-bold">
                  {submissions.filter((s) => s.status === "submitted").length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Graded
                </p>
                <p className="text-2xl font-bold">
                  {submissions.filter((s) => s.status === "graded").length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Submissions Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Recent Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No submissions yet</h3>
                <p className="text-muted-foreground">
                  Student test submissions will appear here
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {submission.student.first_name}{" "}
                              {submission.student.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {submission.student.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{submission.test.title}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {submission.test.type}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(submission.submitted_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={getStatusColor(submission.status)}
                        >
                          {submission.status.charAt(0).toUpperCase() +
                            submission.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(submission as any).total_score ? (
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-yellow-500" />
                            <span className="font-medium">
                              {(submission as any).total_score.toFixed(1)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            Not graded
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReviewModal(submission)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {submission.status === "submitted"
                              ? "Grade"
                              : "Review"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEnhancedReview(submission)}
                          >
                            <Star className="h-4 w-4 mr-2" />
                            Enhanced
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteSubmission(submission.id)}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            Demo Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Review Modal with Grading */}
      <SubmissionReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        submission={selectedSubmission}
        onGraded={handleSubmissionGraded}
        gradedBy={user?.id || ""}
        onOpenWritingGrading={(submission) => {
          setWritingGradingSubmission(submission);
          setShowWritingGrading(true);
        }}
      />

      {/* Enhanced Review Modal */}
      <Dialog open={enhancedReviewOpen} onOpenChange={setEnhancedReviewOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Enhanced Submission Review</DialogTitle>
            <DialogDescription>
              Comprehensive review interface for detailed grading
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <AnswerReview
              submission={{
                id: selectedSubmission.id,
                questionId: selectedSubmission.test_id,
                userId: selectedSubmission.student_id,
                type: "text", // This would need to be determined based on the submission type
                content: JSON.stringify(selectedSubmission.answers || {}),
                metadata: {}, // Only allowed fields, or leave empty
                submittedAt: selectedSubmission.submitted_at,
                status: selectedSubmission.status as any,
                score: (selectedSubmission as any).total_score,
              }}
              gradingCriteria={[
                {
                  id: "content",
                  name: "Content & Ideas",
                  maxPoints: 25,
                  description: "Quality and relevance of ideas and content",
                },
                {
                  id: "organization",
                  name: "Organization",
                  maxPoints: 25,
                  description: "Logical structure and coherence",
                },
                {
                  id: "language",
                  name: "Language Use",
                  maxPoints: 25,
                  description: "Grammar, vocabulary, and sentence structure",
                },
                {
                  id: "mechanics",
                  name: "Mechanics",
                  maxPoints: 25,
                  description: "Spelling, punctuation, and formatting",
                },
              ]}
              onGrade={handleEnhancedGrading}
              onStatusChange={handleStatusChange}
            />
          )}
        </DialogContent>
      </Dialog>

      <WritingGradingModal
        isOpen={showWritingGrading}
        onClose={() => setShowWritingGrading(false)}
        submission={writingGradingSubmission ? {
          id: writingGradingSubmission.id,
          test_id: writingGradingSubmission.test_id,
          student_id: writingGradingSubmission.student_id,
          answers: writingGradingSubmission.answers || {},
          submitted_at: writingGradingSubmission.submitted_at,
          status: writingGradingSubmission.status,
          student: writingGradingSubmission.student,
          test_type: writingGradingSubmission.test?.type, // pass test_type
        } : null}
        onGradingComplete={() => {
          setShowWritingGrading(false);
          fetchSubmissions();
        }}
      />
    </div>
  );
};

export default TestSubmissions;
