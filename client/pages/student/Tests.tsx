import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Clock,
  PlayCircle,
  Filter,
  Search,
  FileText,
  Volume2,
  PenTool,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Test {
  id: string;
  title: string;
  type: "reading" | "listening" | "writing" | "full";
  duration: number;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  questions: number;
  status: "available" | "in_progress" | "completed";
  created_at: string;
}

const Tests: React.FC = () => {
  const { user } = useAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [testRequests, setTestRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchTests();
    fetchTestRequests();
  }, [user]);

  const fetchTests = async () => {
    try {
      if (!user) return;
      setLoading(true);

      // First get user's profile to get edu_center_id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("edu_center_id, role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error(
          "Error fetching user profile:",
          profileError.message || profileError,
        );
        setTests([]);
        setLoading(false);
        return;
      }

      console.log("Student profile:", profile); // Debug log

      // Fetch available published tests from the same education center
      console.log("Fetching tests for edu_center_id:", profile.edu_center_id); // Debug log

      const { data, error } = await supabase
        .from("tests")
        .select("*")
        .eq("status", "published")
        .eq("edu_center_id", profile.edu_center_id);

      if (error) {
        console.error("Error fetching tests:", error.message || error);
        setTests([]);
        return;
      }

      console.log("Found tests:", data); // Debug log

      // Check which tests the student has already completed
      const { data: completedSubmissions } = await supabase
        .from("test_submissions")
        .select("test_id")
        .eq("student_id", user.id)
        .eq("status", "submitted");

      const completedTestIds = new Set(
        completedSubmissions?.map((sub) => sub.test_id) || [],
      );

      // Transform the data
      const transformedTests: Test[] = (data || []).map((test: any) => ({
        id: test.id,
        title: test.title,
        type: test.type,
        duration: test.duration || 60,
        description: test.description || "",
        difficulty: "intermediate", // Default difficulty
        questions: 40, // Default questions count
        status: completedTestIds.has(test.id) ? "completed" : "available",
        created_at: test.created_at,
      }));

      setTests(transformedTests);
    } catch (error) {
      console.error("Error fetching tests:", error);
      setTests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTestRequests = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("test_requests")
      .select("test_id, status")
      .eq("student_id", user.id);
    if (!error && data) setTestRequests(data);
  };

  const handleRequestAccess = async (testId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("test_requests")
      .insert({ student_id: user.id, test_id: testId, status: "pending" });
    if (error) {
      console.error("Error requesting access:", error.message || error);
    } else {
      console.log("Access requested for test:", testId);
      fetchTestRequests(); // Refresh requests to show pending status
    }
  };

  const getTestIcon = (type: string) => {
    switch (type) {
      case "reading":
        return <BookOpen className="h-5 w-5" />;
      case "listening":
        return <Volume2 className="h-5 w-5" />;
      case "writing":
        return <PenTool className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "in_progress":
        return "bg-yellow-500";
      default:
        return "bg-blue-500";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-100 text-green-800";
      case "intermediate":
        return "bg-yellow-100 text-yellow-800";
      case "advanced":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredTests = tests.filter((test) => {
    const matchesSearch = test.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || test.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" || test.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Available Tests</h1>
          <p className="text-muted-foreground">
            Practice with IELTS tests assigned to you
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-gray-300 rounded w-full"></div>
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">Available Tests</h1>
        <p className="text-muted-foreground">
          Practice with IELTS tests assigned to you by your instructor
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4 mb-8"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search tests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="reading">Reading</SelectItem>
            <SelectItem value="listening">Listening</SelectItem>
            <SelectItem value="writing">Writing</SelectItem>
            <SelectItem value="full">Full Test</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Tests Grid */}
      {filteredTests.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center py-12"
        >
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No tests available</h3>
          <p className="text-muted-foreground">
            {searchQuery || typeFilter !== "all" || statusFilter !== "all"
              ? "No tests match your current filters"
              : "Your instructor hasn't assigned any tests yet"}
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredTests.map((test, index) => {
            const request = testRequests.find((r) => r.test_id === test.id);
            return (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getTestIcon(test.type)}
                        <CardTitle className="text-lg">{test.title}</CardTitle>
                      </div>
                      <Badge
                        className={`${getStatusColor(test.status)} text-white`}
                      >
                        {test.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {test.description || "IELTS practice test"}
                      </p>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{test.duration} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          <span>{test.questions} questions</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Badge
                          variant="secondary"
                          className={getDifficultyColor(test.difficulty)}
                        >
                          {test.difficulty}
                        </Badge>
                        <span className="text-sm text-muted-foreground capitalize">
                          {test.type}
                        </span>
                      </div>

                      {/* Button logic */}
                      {test.status === "completed" ? (
                        <Button className="w-full" disabled>
                          Completed
                        </Button>
                      ) : request && request.status === "approved" ? (
                        <Button className="w-full" asChild>
                          <Link to={`/student/test/${test.id}`}>Start</Link>
                        </Button>
                      ) : request && request.status === "pending" ? (
                        <Button className="w-full" disabled>
                          Waiting
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => handleRequestAccess(test.id)}
                        >
                          Request Access
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

export default Tests;
