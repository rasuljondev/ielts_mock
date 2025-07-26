import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileText,
  CheckCircle,
  Clock,
  Plus,
  BarChart3,
  UserCheck,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface DashboardStats {
  totalStudents: number;
  testsCreated: number;
  pendingRequests: number;
  submissions: number;
}

interface Test {
  id: string;
  title: string;
  type: string;
  created_at: string;
  status: string;
  participants?: number;
}

interface TestRequest {
  id: string;
  student_name: string;
  test_title: string;
  created_at: string;
}

interface Submission {
  id: string;
  student_name: string;
  test_title: string;
  submitted_at: string;
  status: string;
}

const EduAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    testsCreated: 0,
    pendingRequests: 0,
    submissions: 0,
  });
  const [recentTests, setRecentTests] = useState<Test[]>([]);
  const [pendingActions, setPendingActions] = useState<{
    requests: TestRequest[];
    submissions: Submission[];
  }>({ requests: [], submissions: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchRecentTests(),
        fetchPendingActions(),
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      let totalStudents = 0;
      let testsCreated = 0;
      let pendingRequests = 0;
      let submissions = 0;

      // Get total students in this edu center
      try {
        const { count: studentsCount, error: studentsError } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("edu_center_id", user?.edu_center_id)
          .eq("role", "student");

        if (studentsError) {
          console.warn(
            "Could not fetch students count:",
            studentsError.message,
          );
        } else {
          totalStudents = studentsCount || 0;
        }
      } catch (err: any) {
        console.warn("Students count error:", err?.message || err);
      }

      // Get tests created by this edu admin
      try {
        const { count: testsCount, error: testsError } = await supabase
          .from("tests")
          .select("*", { count: "exact", head: true })
          .eq("created_by", user?.id);

        if (testsError) {
          console.warn("Could not fetch tests count:", testsError.message);
        } else {
          testsCreated = testsCount || 0;
        }
      } catch (err: any) {
        console.warn("Tests count error:", err?.message || err);
      }

      // Get pending test requests
      try {
        const { count: requestsCount, error: requestsError } = await supabase
          .from("test_requests")
          .select("*", { count: "exact", head: true })
          .eq("edu_center_id", user?.edu_center_id)
          .eq("status", "pending");

        if (requestsError) {
          console.warn(
            "Could not fetch requests count:",
            requestsError.message,
          );
        } else {
          pendingRequests = requestsCount || 0;
        }
      } catch (err: any) {
        console.warn("Requests count error:", err?.message || err);
      }

      // Get test submissions needing grading
      try {
        const { count: submissionsCount, error: submissionsError } =
          await supabase
            .from("test_submissions")
            .select("*", { count: "exact", head: true })
            .eq("edu_center_id", user?.edu_center_id)
            .eq("status", "submitted");

        if (submissionsError) {
          console.warn(
            "Could not fetch submissions count:",
            submissionsError.message,
          );
        } else {
          submissions = submissionsCount || 0;
        }
      } catch (err: any) {
        console.warn("Submissions count error:", err?.message || err);
      }

      setStats({
        totalStudents,
        testsCreated,
        pendingRequests,
        submissions,
      });
    } catch (error: any) {
      console.error("Error fetching stats:", error?.message || String(error));
      // Set default stats as fallback
      setStats({
        totalStudents: 0,
        testsCreated: 0,
        pendingRequests: 0,
        submissions: 0,
      });
    }
  };

  const fetchRecentTests = async () => {
    try {
      const { data, error } = await supabase
        .from("tests")
        .select("*")
        .eq("created_by", user?.id)
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) {
        console.warn("Could not fetch recent tests:", error.message);
        setRecentTests([]);
        return;
      }

      setRecentTests(data || []);
    } catch (error: any) {
      console.error(
        "Error fetching recent tests:",
        error?.message || String(error),
      );
      setRecentTests([]);
    }
  };

  const fetchPendingActions = async () => {
    try {
      // Initialize empty arrays for fallback
      let requests: any[] = [];
      let submissions: any[] = [];

      // Try to fetch pending test requests with related data
      try {
        const { data: requestsData, error: requestsError } = await supabase
          .from("test_requests")
          .select(
            `
            id,
            created_at,
            status,
            student_id,
            test_id,
            profiles!test_requests_student_id_fkey (
              first_name,
              last_name
            ),
            tests (
              title
            )
          `,
          )
          .eq("edu_center_id", user?.edu_center_id)
          .eq("status", "pending")
          .limit(5);

        if (requestsError) {
          console.warn("Test requests table issue:", requestsError.message);
        } else {
          requests = requestsData || [];
        }
      } catch (requestsErr: any) {
        console.warn(
          "Could not fetch test requests:",
          requestsErr?.message || requestsErr,
        );
      }

      // Try to fetch submissions needing grading with related data
      try {
        const { data: submissionsData, error: submissionsError } =
          await supabase
            .from("test_submissions")
            .select(
              `
              id,
              submitted_at,
              status,
              student_id,
              test_id,
              profiles!test_submissions_student_id_fkey (
                first_name,
                last_name
              ),
              tests (
                title
              )
            `,
            )
            .eq("edu_center_id", user?.edu_center_id)
            .eq("status", "submitted")
            .limit(5);

        if (submissionsError) {
          console.warn(
            "Test submissions table issue:",
            submissionsError.message,
          );
        } else {
          submissions = submissionsData || [];
        }
      } catch (submissionsErr: any) {
        console.warn(
          "Could not fetch test submissions:",
          submissionsErr?.message || submissionsErr,
        );
      }

      // Map the data with actual student and test names
      setPendingActions({
        requests: requests.map((req: any) => ({
          id: req.id || Date.now().toString(),
          student_name: req.profiles
            ? `${req.profiles.first_name || ""} ${req.profiles.last_name || ""}`.trim() ||
              "Student"
            : "Student",
          test_title: req.tests?.title || "Test Request",
          created_at: req.created_at || new Date().toISOString(),
        })),
        submissions: submissions.map((sub: any) => ({
          id: sub.id || Date.now().toString(),
          student_name: sub.profiles
            ? `${sub.profiles.first_name || ""} ${sub.profiles.last_name || ""}`.trim() ||
              "Student"
            : "Student",
          test_title: sub.tests?.title || "Test Submission",
          submitted_at: sub.submitted_at || new Date().toISOString(),
          status: sub.status || "submitted",
        })),
      });
    } catch (error: any) {
      console.error(
        "Error fetching pending actions:",
        error?.message || String(error),
      );
      // Set empty arrays as fallback
      setPendingActions({
        requests: [],
        submissions: [],
      });
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const deleteTest = async (testId: string, testTitle: string) => {
    // Find the test to check its status
    const test = recentTests.find((t) => t.id === testId);
    const isPublished = test?.status === "published";

    const confirmMessage = isPublished
      ? `Are you sure you want to delete the PUBLISHED test "${testTitle}"? This will remove it for all students and cannot be undone.`
      : `Are you sure you want to delete "${testTitle}"? This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      console.log("Starting comprehensive test deletion for:", testId);

      // Check ALL possible related tables
      const tablesToCheck = [
        {
          name: "test_submissions",
          query: supabase
            .from("test_submissions")
            .select("id")
            .eq("test_id", testId),
        },
        {
          name: "test_requests",
          query: supabase
            .from("test_requests")
            .select("id")
            .eq("test_id", testId),
        },
        {
          name: "reading_sections",
          query: supabase
            .from("reading_sections")
            .select("id")
            .eq("test_id", testId),
        },
        {
          name: "listening_sections",
          query: supabase
            .from("listening_sections")
            .select("id")
            .eq("test_id", testId),
        },
        {
          name: "writing_tasks",
          query: supabase
            .from("writing_tasks")
            .select("id")
            .eq("test_id", testId),
        },
      ];

      let allRelatedRecords: { [key: string]: any[] } = {};
      let totalCount = 0;

      // Check each table for related records
      for (const table of tablesToCheck) {
        try {
          const { data, error } = await table.query;
          if (!error && data && data.length > 0) {
            allRelatedRecords[table.name] = data;
            totalCount += data.length;
            console.log(`Found ${data.length} records in ${table.name}`);
          }
        } catch (err) {
          console.warn(`Could not check ${table.name}:`, err);
        }
      }

      // Show user what will be deleted
      if (totalCount > 0) {
        const relatedSummary = Object.entries(allRelatedRecords)
          .map(
            ([table, records]) =>
              `${records.length} ${table.replace("_", " ")}`,
          )
          .join(", ");

        const confirmDelete = window.confirm(
          `This test has ${totalCount} related records: ${relatedSummary}. All related data will be permanently deleted. Continue?`,
        );

        if (!confirmDelete) {
          return;
        }
      }

      // Delete related records in proper order (most dependent first)
      const deletionOrder = [
        // Delete questions first (depend on sections)
        async () => {
          if (allRelatedRecords.reading_sections?.length > 0) {
            const sectionIds = allRelatedRecords.reading_sections.map(
              (s: any) => s.id,
            );
            const { error } = await supabase
              .from("reading_questions")
              .delete()
              .in("reading_section_id", sectionIds);
            if (error)
              console.warn(
                "Could not delete reading questions:",
                error.message,
              );
          }
        },
        async () => {
          if (allRelatedRecords.listening_sections?.length > 0) {
            const sectionIds = allRelatedRecords.listening_sections.map(
              (s: any) => s.id,
            );
            const { error } = await supabase
              .from("listening_questions")
              .delete()
              .in("section_id", sectionIds);
            if (error)
              console.warn(
                "Could not delete listening questions:",
                error.message,
              );
          }
        },
        // Then delete sections and tasks
        async () => {
          if (allRelatedRecords.test_submissions?.length > 0) {
            const { error } = await supabase
              .from("test_submissions")
              .delete()
              .eq("test_id", testId);
            if (error)
              throw new Error(
                `Failed to delete test submissions: ${error.message}`,
              );
          }
        },
        async () => {
          if (allRelatedRecords.test_requests?.length > 0) {
            const { error } = await supabase
              .from("test_requests")
              .delete()
              .eq("test_id", testId);
            if (error)
              throw new Error(
                `Failed to delete test requests: ${error.message}`,
              );
          }
        },
        async () => {
          if (allRelatedRecords.reading_sections?.length > 0) {
            const { error } = await supabase
              .from("reading_sections")
              .delete()
              .eq("test_id", testId);
            if (error)
              throw new Error(
                `Failed to delete reading sections: ${error.message}`,
              );
          }
        },
        async () => {
          if (allRelatedRecords.listening_sections?.length > 0) {
            const { error } = await supabase
              .from("listening_sections")
              .delete()
              .eq("test_id", testId);
            if (error)
              throw new Error(
                `Failed to delete listening sections: ${error.message}`,
              );
          }
        },
        async () => {
          if (allRelatedRecords.writing_tasks?.length > 0) {
            const { error } = await supabase
              .from("writing_tasks")
              .delete()
              .eq("test_id", testId);
            if (error)
              throw new Error(
                `Failed to delete writing tasks: ${error.message}`,
              );
          }
        },
      ];

      // Execute deletions
      for (const deleteFn of deletionOrder) {
        await deleteFn();
      }

      // Finally delete the test
      console.log("Deleting test itself...");
      const { error } = await supabase
        .from("tests")
        .delete()
        .eq("id", testId)
        .eq("created_by", user?.id);

      if (error) {
        console.error("Final test deletion error:", error);
        throw new Error(
          `Failed to delete test: ${error.message}. Please run setup_cascade_delete.sql or contact support.`,
        );
      }

      // Refresh the recent tests
      await fetchRecentTests();

      console.log("Test deleted successfully");
      toast.success("Test and all related data deleted successfully!");
    } catch (error: any) {
      console.error("Error deleting test:", error?.message || String(error));

      let errorMessage = "Failed to delete test. Please try again.";
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code === "23503") {
        errorMessage =
          "Cannot delete test because it has related student submissions. Please delete submissions first or contact support.";
      }

      toast.error(errorMessage);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Education Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.first_name}! Manage your students and tests.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Students
                </p>
                <p className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    stats.totalStudents
                  )}
                </p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Tests Created
                </p>
                <p className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    stats.testsCreated
                  )}
                </p>
              </div>
              <FileText className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Pending Requests
                </p>
                <p className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    stats.pendingRequests
                  )}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Submissions
                </p>
                <p className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    stats.submissions
                  )}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Tests */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Tests
              </CardTitle>
              <div className="flex space-x-2">
                <Button size="sm" asChild>
                  <Link to="/edu-admin/tests/create/advanced">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Test
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : recentTests.length > 0 ? (
              <div className="space-y-4">
                {recentTests.map((test) => (
                  <div
                    key={test.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <h4 className="font-semibold">{test.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        Created {getTimeAgo(test.created_at)} • {test.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          test.status === "published" ? "default" : "secondary"
                        }
                      >
                        {test.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(
                            `/edu-admin/tests/create/advanced/${test.id}`,
                          )
                        }
                      >
                        {test.status === "draft" ? "Continue" : "View"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteTest(test.id, test.title)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tests created yet</p>
                <p className="text-sm">Create your first test to get started</p>
              </div>
            )}

            <Button className="w-full mt-4" variant="outline" asChild>
              <Link to="/edu-admin/tests">Manage All Tests</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Pending Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Pending Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {stats.pendingRequests > 0 && (
                  <div className="flex items-center justify-between p-4 border rounded-lg border-orange-200 bg-orange-50">
                    <div>
                      <h4 className="font-semibold">Test Access Requests</h4>
                      <p className="text-sm text-muted-foreground">
                        {stats.pendingRequests} students requesting access
                      </p>
                      {pendingActions.requests.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Latest: {pendingActions.requests[0].student_name} for{" "}
                          {pendingActions.requests[0].test_title}
                        </p>
                      )}
                    </div>
                    <Button size="sm" asChild>
                      <Link to="/edu-admin/requests">Review</Link>
                    </Button>
                  </div>
                )}

                {stats.submissions > 0 && (
                  <div className="flex items-center justify-between p-4 border rounded-lg border-blue-200 bg-blue-50">
                    <div>
                      <h4 className="font-semibold">Submissions to Grade</h4>
                      <p className="text-sm text-muted-foreground">
                        {stats.submissions} tests need scoring
                      </p>
                      {pendingActions.submissions.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Latest: {pendingActions.submissions[0].student_name}{" "}
                          for {pendingActions.submissions[0].test_title}
                        </p>
                      )}
                    </div>
                    <Button size="sm" asChild>
                      <Link to="/edu-admin/submissions">Grade</Link>
                    </Button>
                  </div>
                )}

                {stats.pendingRequests === 0 && stats.submissions === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>All caught up!</p>
                    <p className="text-sm">No pending actions at the moment</p>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-semibold">Student Performance</h4>
                    <p className="text-sm text-muted-foreground">
                      Analytics and reports available
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    View Reports
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button className="h-24 text-left" variant="outline" asChild>
              <Link
                to="/edu-admin/tests/create/advanced"
                className="flex flex-col items-start"
              >
                <Plus className="h-6 w-6 mb-2" />
                <span className="font-semibold">Create Test</span>
                <span className="text-sm text-muted-foreground">
                  New IELTS practice test
                </span>
              </Link>
            </Button>

            <Button className="h-24 text-left" variant="outline" asChild>
              <Link
                to="/edu-admin/requests"
                className="flex flex-col items-start"
              >
                <UserCheck className="h-6 w-6 mb-2" />
                <span className="font-semibold">Review Requests</span>
                <span className="text-sm text-muted-foreground">
                  Student access requests
                </span>
              </Link>
            </Button>

            <Button className="h-24 text-left" variant="outline" asChild>
              <Link
                to="/edu-admin/submissions"
                className="flex flex-col items-start"
              >
                <CheckCircle className="h-6 w-6 mb-2" />
                <span className="font-semibold">Grade Submissions</span>
                <span className="text-sm text-muted-foreground">
                  Review student work
                </span>
              </Link>
            </Button>

            <Button className="h-24 text-left" variant="outline" asChild>
              <Link
                to="/edu-admin/profile"
                className="flex flex-col items-start"
              >
                <BarChart3 className="h-6 w-6 mb-2" />
                <span className="font-semibold">Analytics</span>
                <span className="text-sm text-muted-foreground">
                  Performance insights
                </span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EduAdminDashboard;
