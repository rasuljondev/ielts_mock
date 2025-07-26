import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Clock,
  Trophy,
  Bell,
  FileText,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { parseError, logError } from "@/lib/errorUtils";

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    testsTaken: 0,
    averageScore: 0,
    studyHours: 0,
    pendingTests: 0,
    loading: true,
  });
  const [userProfile, setUserProfile] = useState<{
    first_name?: string;
    last_name?: string;
  } | null>(null);
  const [availableTests, setAvailableTests] = useState<any[]>([]);
  const [testRequests, setTestRequests] = useState<any[]>([]);
  const [completedTests, setCompletedTests] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchStudentStats();
    }
  }, [user]);

  const fetchStudentStats = async () => {
    try {
      if (!user) return;

      // First get user's profile to get edu_center_id and name
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("edu_center_id, first_name, last_name")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error(
          "Error fetching user profile:",
          profileError.message || profileError,
        );
        setStats((prev) => ({ ...prev, loading: false }));
        return;
      }

      // Save profile data for welcome message
      setUserProfile(profile);

      // Fetch graded submissions first (without relationship embedding)
      const { data: submissions, error: submissionsError } = await supabase
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
          test_id
        `,
        )
        .eq("student_id", user.id)
        .eq("status", "graded")
        .order("graded_at", { ascending: false });

      if (submissionsError) {
        console.error(
          "Error fetching submissions:",
          submissionsError.message || submissionsError,
        );
        // Try fallback query without score columns if they don't exist
        const { data: fallbackSubmissions } = await supabase
          .from("test_submissions")
          .select(
            `
            id,
            status,
            graded_at,
            test_id
          `,
          )
          .eq("student_id", user.id)
          .eq("status", "graded")
          .order("graded_at", { ascending: false });

        const testsTaken = fallbackSubmissions?.length || 0;
        setStats((prev) => ({ ...prev, testsTaken, loading: false }));

        // Get test details separately for fallback
        if (fallbackSubmissions && fallbackSubmissions.length > 0) {
          const testIds = fallbackSubmissions
            .map((s) => s.test_id)
            .filter(Boolean);
          if (testIds.length > 0) {
            const { data: testDetails } = await supabase
              .from("tests")
              .select("id, title, type")
              .in("id", testIds);

            const enrichedActivity = fallbackSubmissions.map((submission) => ({
              ...submission,
              tests: testDetails?.find(
                (test) => test.id === submission.test_id,
              ),
            }));

            setRecentActivity(enrichedActivity.slice(0, 5));
          }
        }
        return;
      }

      const testsTaken = submissions?.length || 0;

      // Calculate average score from total_score column
      let averageScore = 0;
      if (submissions && submissions.length > 0) {
        const validScores = submissions
          .map((s) => s.total_score)
          .filter(
            (score) => score !== null && score !== undefined && !isNaN(score),
          );

        if (validScores.length > 0) {
          averageScore =
            validScores.reduce((sum, score) => sum + score, 0) /
            validScores.length;
        }
      }

      // Get test details separately for main query
      let enrichedSubmissions = submissions || [];
      if (submissions && submissions.length > 0) {
        const testIds = submissions.map((s) => s.test_id).filter(Boolean);
        if (testIds.length > 0) {
          const { data: testDetails } = await supabase
            .from("tests")
            .select("id, title, type")
            .in("id", testIds);

          enrichedSubmissions = submissions.map((submission) => ({
            ...submission,
            tests: testDetails?.find((test) => test.id === submission.test_id),
          }));
        }
      }

      // Set recent activity with enriched data
      setRecentActivity(enrichedSubmissions.slice(0, 5));

      // For now, show available published tests as "pending tests"
      console.log("Fetching tests for edu_center_id:", profile.edu_center_id); // Debug log

      const { data: availableTestsData, error: testsError } = await supabase
        .from("tests")
        .select("id, title, status, type, duration, created_at")
        .eq("status", "published")
        .eq("edu_center_id", profile.edu_center_id);

      if (testsError) {
        console.error(
          "Error fetching available tests:",
          testsError.message || testsError,
        );
      } else {
        console.log("Available tests:", availableTestsData); // Debug log
      }

      // Sort available tests by created_at descending
      const sortedAvailableTests = (availableTestsData || []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      setAvailableTests(sortedAvailableTests);

      // Fetch test requests
      const { data: requestsData } = await supabase
        .from("test_requests")
        .select(
          `
          *,
          test:tests (
            id,
            title,
            type,
            duration
          )
        `,
        )
        .eq("student_id", user.id)
        .order("requested_at", { ascending: false });

      // Fetch completed test submissions
      const { data: completedSubmissions } = await supabase
        .from("test_submissions")
        .select("id")
        .eq("student_id", user.id)
        .eq("is_completed", true);

      const pendingTests = availableTestsData?.length || 0;
      const completedCount = completedSubmissions?.length || 0;

      setAvailableTests(availableTestsData || []);
      setTestRequests(requestsData || []);
      setCompletedTests(completedCount);

      setStats({
        testsTaken: testsTaken,
        averageScore: Number(averageScore.toFixed(1)),
        studyHours: 0,
        pendingTests,
        loading: false,
      });
    } catch (error: any) {
      console.error("Error fetching student stats:", error);

      // Better error message handling
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

      console.log("Dashboard error details:", errorMessage);
      toast.error(`Failed to load dashboard data: ${errorMessage}`);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleRequestAccess = async (testId: string) => {
    try {
      const { error } = await supabase.from("test_requests").insert({
        test_id: testId,
        student_id: user?.id,
        status: "pending",
      });

      if (error) {
        if (error.code === "23505") {
          // Unique constraint violation
          toast.error("You have already requested access to this test");
        } else {
          throw error;
        }
      } else {
        toast.success("Test access request sent! Wait for admin approval.");
        // Refresh the data
        fetchStudentStats();
      }
    } catch (error: any) {
      logError("handleRequestAccess", error);
      const errorMessage = parseError(error);
      toast.error(`Failed to request test access: ${errorMessage}`);
    }
  };

  if (stats.loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Student Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Track your progress here.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-300 rounded w-1/2"></div>
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Student Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back,{" "}
          {userProfile?.first_name
            ? `${userProfile.first_name} ${userProfile.last_name || ""}`.trim()
            : user?.email}
          ! Track your progress here.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Tests Taken
                </p>
                <p className="text-2xl font-bold">{stats.testsTaken}</p>
              </div>
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Average Score
                </p>
                <p className="text-2xl font-bold">
                  {stats.averageScore > 0 ? stats.averageScore : "N/A"}
                </p>
              </div>
              <Trophy className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Study Hours
                </p>
                <p className="text-2xl font-bold">{stats.studyHours}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Pending Tests
                </p>
                <p className="text-2xl font-bold">{stats.pendingTests}</p>
              </div>
              <Bell className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button asChild className="h-auto p-4 flex flex-col items-center space-y-2">
                <Link to="/student/available-tests">
                  <BookOpen className="h-6 w-6" />
                  <span>Browse Available Tests</span>
                  <span className="text-xs opacity-80">Practice listening skills</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
                <Link to="/student/test-history">
                  <BarChart3 className="h-6 w-6" />
                  <span>View Test History</span>
                  <span className="text-xs opacity-80">Check your progress</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
                <Link to="/profile">
                  <FileText className="h-6 w-6" />
                  <span>Profile Settings</span>
                  <span className="text-xs opacity-80">Update your info</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Assigned Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Show test requests status */}
              {testRequests.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Test Requests
                  </h4>
                  {testRequests.slice(0, 2).map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <h5 className="font-medium">{request.test.title}</h5>
                        <p className="text-sm text-muted-foreground">
                          Status: {request.status}
                        </p>
                      </div>
                      {request.status === "approved" ? (
                        <Button size="sm" asChild>
                          <Link to={`/student/test/${request.test.id}`}>
                            Start
                          </Link>
                        </Button>
                      ) : request.status === "pending" ? (
                        <Badge variant="secondary">Waiting</Badge>
                      ) : (
                        <Badge variant="destructive">Rejected</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Show available tests */}
              {stats.pendingTests === 0 && testRequests.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No tests available yet
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Your instructor will publish tests for you to take
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Available Tests
                  </h4>
                  {availableTests.slice(0, 2).map((test) => {
                    const hasRequest = testRequests.find(
                      (r) => r.test.id === test.id,
                    );
                    return (
                      <div
                        key={test.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <h4 className="font-medium">{test.title}</h4>
                          <p className="text-sm text-muted-foreground capitalize">
                            {test.type} • {test.duration || 60} min
                          </p>
                        </div>
                        {hasRequest ? (
                          <Badge variant="outline">Requested</Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleRequestAccess(test.id)}
                          >
                            Request Access
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button className="w-full mt-4" variant="outline" asChild>
              <Link to="/student/tests">View All Tests</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No graded tests yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Complete tests to see your results here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">
                        {activity.tests?.title || "Test"}
                      </h4>
                      <p className="text-sm text-muted-foreground capitalize">
                        {activity.tests?.type || "Unknown"} • Graded on{" "}
                        {activity.graded_at
                          ? new Date(activity.graded_at).toLocaleDateString()
                          : "Unknown date"}
                      </p>
                    </div>
                    <div className="text-right">
                      {activity.total_score !== null &&
                      activity.total_score !== undefined ? (
                        <>
                          <div className="text-lg font-bold text-primary">
                            {activity.total_score.toFixed(1)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Band Score
                          </div>
                        </>
                      ) : (
                        <Badge variant="secondary">Graded</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button className="w-full mt-4" variant="outline" asChild>
              <Link to="/student/test-history">View History</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Study Plan */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Study Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 border rounded-lg">
              <BookOpen className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <h3 className="font-semibold mb-2">Reading Practice</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Improve your reading comprehension skills
              </p>
              <Button variant="outline" size="sm">
                Start Practice
              </Button>
            </div>
            <div className="text-center p-6 border rounded-lg">
              <FileText className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <h3 className="font-semibold mb-2">Listening Practice</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enhance your listening comprehension
              </p>
              <Button variant="outline" size="sm">
                Start Practice
              </Button>
            </div>
            <div className="text-center p-6 border rounded-lg">
              <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <h3 className="font-semibold mb-2">Writing Practice</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Develop your writing skills and fluency
              </p>
              <Button variant="outline" size="sm">
                Start Practice
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentDashboard;
