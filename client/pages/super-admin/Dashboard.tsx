import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  FileText,
  UserCog,
  BarChart3,
  Plus,
  TrendingUp,
  Globe,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const SuperAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    eduCenters: 0,
    totalUsers: 0,
    totalTests: 0,
    eduAdmins: 0,
    students: 0,
    loading: true,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentActivity();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch education centers count
      const { count: centerCount } = await supabase
        .from("edu_centers")
        .select("*", { count: "exact", head: true });

      // Fetch users by role
      const { data: profiles } = await supabase.from("profiles").select("role");

      const totalUsers = profiles?.length || 0;
      const eduAdmins =
        profiles?.filter((p) => p.role === "edu_admin").length || 0;
      const students =
        profiles?.filter((p) => p.role === "student").length || 0;

      // Fetch tests count
      const { count: testCount, error: testError } = await supabase
        .from("tests")
        .select("*", { count: "exact", head: true });

      if (testError) {
        console.error("Error fetching test count:", testError);
      } else {
        console.log("Total tests count:", testCount); // Debug log
      }

      setStats({
        eduCenters: centerCount || 0,
        totalUsers,
        totalTests: testCount || 0,
        eduAdmins,
        students,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  const fetchRecentActivity = async () => {
    setActivityLoading(true);
    try {
      // Fetch latest users
      const { data: users } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, role, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      // Fetch latest education centers
      const { data: centers } = await supabase
        .from("edu_centers")
        .select("id, name, location, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      // Fetch latest tests (if table exists)
      let tests: any[] = [];
      try {
        const { data: testData } = await supabase
          .from("tests")
          .select("id, title, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        tests = testData || [];
      } catch {}
      // Combine and sort
      const activities: any[] = [];
      if (users) {
        users.forEach((u: any) =>
          activities.push({
            type: "user",
            id: u.id,
            created_at: u.created_at,
            description: `${u.first_name} ${u.last_name} registered as ${u.role.replace("_", " ")}`,
          }),
        );
      }
      if (centers) {
        centers.forEach((c: any) =>
          activities.push({
            type: "center",
            id: c.id,
            created_at: c.created_at,
            description: `Education center created: ${c.name} (${c.location})`,
          }),
        );
      }
      if (tests) {
        tests.forEach((t: any) =>
          activities.push({
            type: "test",
            id: t.id,
            created_at: t.created_at,
            description: `Test created: ${t.title}`,
          }),
        );
      }
      // Sort by created_at desc
      activities.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setRecentActivity(activities.slice(0, 10));
    } catch (error) {
      setRecentActivity([]);
    } finally {
      setActivityLoading(false);
    }
  };

  if (stats.loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Super Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.first_name}! Platform overview and management.
        </p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Education Centers
                </p>
                <p className="text-2xl font-bold">{stats.eduCenters}</p>
              </div>
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Users
                </p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Tests
                </p>
                <p className="text-2xl font-bold">{stats.totalTests}</p>
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
                  Edu Admins
                </p>
                <p className="text-2xl font-bold">{stats.eduAdmins}</p>
              </div>
              <UserCog className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading recent activity...
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Recent Activity
                </h3>
                <p className="text-muted-foreground">
                  Activity will appear here as users interact with the platform
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-muted-foreground/10">
                {recentActivity.map((activity) => (
                  <li
                    key={activity.type + activity.id + activity.created_at}
                    className="py-3 flex items-center gap-3"
                  >
                    <span>
                      {activity.type === "user" && (
                        <Users className="inline h-5 w-5 text-blue-500" />
                      )}
                      {activity.type === "center" && (
                        <Building2 className="inline h-5 w-5 text-primary" />
                      )}
                      {activity.type === "test" && (
                        <FileText className="inline h-5 w-5 text-purple-500" />
                      )}
                    </span>
                    <span className="flex-1">{activity.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(activity.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Platform Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Platform Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium">System Status</span>
                </div>
                <Badge className="bg-green-100 text-green-800">
                  Operational
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium">Database</span>
                </div>
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium">Authentication</span>
                </div>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Management Actions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Platform Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <Link to="/super-admin/edu-centers" className="block">
                  <div className="flex items-center space-x-4">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Education Centers</h3>
                      <p className="text-sm text-muted-foreground">
                        {stats.eduCenters} centers
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Manage education centers and locations
                  </p>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <Link to="/super-admin/admins" className="block">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <UserCog className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Edu Admins</h3>
                      <p className="text-sm text-muted-foreground">
                        {stats.eduAdmins} admins
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Create and manage administrators
                  </p>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <Link to="/super-admin/users" className="block">
                  <div className="flex items-center space-x-4">
                    <div className="bg-green-100 p-3 rounded-lg">
                      <Users className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">All Users</h3>
                      <p className="text-sm text-muted-foreground">
                        {stats.totalUsers} users
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    View and manage all platform users
                  </p>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <Link to="/super-admin/tests" className="block">
                  <div className="flex items-center space-x-4">
                    <div className="bg-purple-100 p-3 rounded-lg">
                      <FileText className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Platform Tests</h3>
                      <p className="text-sm text-muted-foreground">
                        {stats.totalTests} tests
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Overview of all platform tests
                  </p>
                </Link>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminDashboard;
