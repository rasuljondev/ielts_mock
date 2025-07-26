import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BookOpen,
  Search,
  Filter,
  Calendar,
  Trophy,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface TestSubmission {
  id: string;
  status: string;
  total_score?: number;
  reading_score?: number;
  listening_score?: number;
  writing_score?: number;
  graded_at?: string;
  submitted_at: string;
  tests?: {
    id: string;
    title: string;
    type: string;
  };
}

const TestHistory: React.FC = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (user) {
      fetchTestHistory();
    }
  }, [user]);

  const fetchTestHistory = async () => {
    try {
      if (!user) return;

      // Fetch test submissions first (without relationship embedding)
      const { data: submissionsData, error } = await supabase
        .from("test_submissions")
        .select(
          `
          id,
          status,
          total_score,
          reading_score,
          listening_score,
          writing_score,
          graded_at,
          submitted_at,
          test_id
        `,
        )
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false });

      let data = submissionsData;

      if (error) {
        console.error("Error fetching test history:", error);

        // Show detailed error message
        let errorMessage = "Unknown error";
        if (error?.message) {
          errorMessage = error.message;
          if (error?.code) errorMessage += ` (Code: ${error.code})`;
          if (error?.details) errorMessage += ` - ${error.details}`;
        } else if (typeof error === "string") {
          errorMessage = error;
        } else {
          errorMessage = JSON.stringify(error, null, 2);
        }

        console.log("Detailed error:", errorMessage);

        // Try fallback query without score columns
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("test_submissions")
          .select(
            `
            id,
            status,
            graded_at,
            submitted_at,
            test_id
          `,
          )
          .eq("student_id", user.id)
          .order("submitted_at", { ascending: false });

        if (fallbackError) {
          console.error("Fallback query also failed:", fallbackError);
          throw new Error(
            `Database query failed: ${fallbackError.message || "Unknown database error"}`,
          );
        }

        data = fallbackData;
      }

      // Get test details separately for all submissions
      if (data && data.length > 0) {
        const testIds = data.map((s) => s.test_id).filter(Boolean);
        if (testIds.length > 0) {
          const { data: testDetails, error: testDetailsError } = await supabase
            .from("tests")
            .select("id, title, type")
            .in("id", testIds);

          if (testDetailsError) {
            console.error("Error fetching test details:", testDetailsError);
            // Still set submissions but without test details
            setSubmissions(
              data.map((submission) => ({ ...submission, tests: null })),
            );
          } else {
            const enrichedSubmissions = data.map((submission) => ({
              ...submission,
              tests: testDetails?.find(
                (test) => test.id === submission.test_id,
              ),
            }));

            setSubmissions(enrichedSubmissions);
          }
        } else {
          setSubmissions(data);
        }
      } else {
        setSubmissions([]);
      }
    } catch (error: any) {
      console.error("Error fetching test history:", error);

      // Better error message handling
      let errorMessage = "Failed to load test history";
      if (error?.message) {
        errorMessage = `Failed to load test history: ${error.message}`;
        if (error?.code) errorMessage += ` (${error.code})`;
      } else if (typeof error === "string") {
        errorMessage = `Failed to load test history: ${error}`;
      } else {
        errorMessage = `Failed to load test history: ${JSON.stringify(error, null, 2)}`;
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesSearch =
      submission.tests?.title
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) || false;
    const matchesFilter =
      filterStatus === "all" || submission.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "graded":
        return <Badge variant="default">Graded</Badge>;
      case "in_progress":
        return <Badge variant="outline">In Progress</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatScore = (score?: number) => {
    if (score === null || score === undefined) return "N/A";
    return score.toFixed(1);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link to="/student/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Test History</h1>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/student/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-3xl font-bold mb-2">Test History</h1>
        <p className="text-muted-foreground">
          View all your completed and graded tests
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("all")}
              >
                All
              </Button>
              <Button
                variant={filterStatus === "graded" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("graded")}
              >
                Graded
              </Button>
              <Button
                variant={filterStatus === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("completed")}
              >
                Completed
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Your Test History ({filteredSubmissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tests found</h3>
              <p className="text-muted-foreground">
                {searchTerm
                  ? "No tests match your search criteria"
                  : "You haven't taken any tests yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Overall Score</TableHead>
                  <TableHead>Reading</TableHead>
                  <TableHead>Listening</TableHead>
                  <TableHead>Writing</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium">
                      {submission.tests?.title || "Unknown Test"}
                    </TableCell>
                    <TableCell className="capitalize">
                      {submission.tests?.type || "Unknown"}
                    </TableCell>
                    <TableCell>{getStatusBadge(submission.status)}</TableCell>
                    <TableCell>
                      {submission.status === "graded" ? (
                        <div className="flex items-center gap-1">
                          <Trophy className="h-4 w-4 text-yellow-500" />
                          <span className="font-semibold">
                            {formatScore(submission.total_score)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {submission.status === "graded"
                        ? formatScore(submission.reading_score)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {submission.status === "graded"
                        ? formatScore(submission.listening_score)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {submission.status === "graded"
                        ? formatScore(submission.writing_score)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>
                          {new Date(
                            submission.submitted_at,
                          ).toLocaleDateString()}
                        </div>
                        {submission.graded_at && (
                          <div className="text-muted-foreground text-xs">
                            Graded:{" "}
                            {new Date(
                              submission.graded_at,
                            ).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TestHistory;
