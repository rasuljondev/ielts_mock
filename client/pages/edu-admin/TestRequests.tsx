import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  FileText,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { parseError, logError } from "@/lib/errorUtils";

interface TestRequest {
  id: string;
  test_id: string;
  student_id: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  approved_at?: string;
  approved_by?: string;
  rejection_reason?: string;
  test: {
    title: string;
    type: string;
    duration: number;
  };
  student: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

const TestRequests: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<TestRequest | null>(
    null,
  );
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);

      // Get user's edu_center_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("edu_center_id")
        .eq("id", user?.id)
        .single();

      if (!profile?.edu_center_id) {
        setRequests([]);
        return;
      }

      // First check if test_requests table exists by doing a simple query
      console.log("Checking if test_requests table exists...");

      const { data: tableCheck, error: tableError } = await supabase
        .from("test_requests")
        .select("id")
        .limit(1);

      if (tableError) {
        console.error("Table check error:", tableError);
        if (tableError.code === "42P01") {
          toast.error(
            "The test_requests table doesn't exist. Please run the database setup script.",
          );
          setRequests([]);
          return;
        }
      }

      console.log("Table exists, fetching requests...");

      // Fetch test requests for tests from this education center
      const { data, error } = await supabase
        .from("test_requests")
        .select(
          `
          *,
          test:tests!inner (
            title,
            type,
            duration,
            edu_center_id
          ),
          student:profiles!test_requests_student_id_fkey (
            first_name,
            last_name,
            email
          )
        `,
        )
        .eq("test.edu_center_id", profile.edu_center_id)
        .order("requested_at", { ascending: false });

      if (error) {
        console.error("Error fetching requests:", error);
        const errorMessage =
          error?.message || error?.details || error?.hint || String(error);
        toast.error(`Failed to load test requests: ${errorMessage}`);
        return;
      }

      setRequests(data || []);
    } catch (error: any) {
      logError("fetchRequests", error);
      const errorMessage = parseError(error);
      toast.error(`Failed to load test requests: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;

    setProcessing(true);
    try {
      console.log("Attempting to update request:", {
        requestId: selectedRequest.id,
        action: actionType,
        rejectionReason: actionType === "reject" ? rejectionReason : null,
      });
      // Start with minimal required data
      const updateData: any = {
        status: actionType === "approve" ? "approved" : "rejected",
      };

      // Try to add additional columns if they exist
      try {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;

        if (actionType === "reject" && rejectionReason) {
          updateData.rejection_reason = rejectionReason;
        }
      } catch (error) {
        console.warn("Additional columns not available, updating status only");
      }

      console.log("Update data:", updateData);

      const { data, error } = await supabase
        .from("test_requests")
        .update(updateData)
        .eq("id", selectedRequest.id)
        .select();

      console.log("Update result:", { data, error });

      if (error) {
        console.error("Supabase update error:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          full: error,
        });

        // If it's a missing column error, try with minimal data
        if (
          error.message &&
          error.message.includes("could not find") &&
          error.message.includes("column")
        ) {
          console.warn("Missing column detected, trying minimal update...");

          const minimalUpdate = {
            status: actionType === "approve" ? "approved" : "rejected",
          };
          const { error: minimalError } = await supabase
            .from("test_requests")
            .update(minimalUpdate)
            .eq("id", selectedRequest.id);

          if (minimalError) {
            throw minimalError;
          } else {
            toast.success(
              `Test request ${actionType === "approve" ? "approved" : "rejected"} successfully! Note: Please run the database update script to add missing columns.`,
            );

            // Close dialog and refresh
            setSelectedRequest(null);
            setActionType(null);
            setRejectionReason("");
            fetchRequests();
            return;
          }
        }

        throw error;
      }

      toast.success(
        `Test request ${actionType === "approve" ? "approved" : "rejected"} successfully!`,
      );

      // Close dialog and refresh
      setSelectedRequest(null);
      setActionType(null);
      setRejectionReason("");
      fetchRequests();
    } catch (error: any) {
      logError("handleAction", error);
      const errorMessage = parseError(error);
      toast.error(`Failed to ${actionType} request: ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  };

  const openActionDialog = (
    request: TestRequest,
    action: "approve" | "reject",
  ) => {
    setSelectedRequest(request);
    setActionType(action);
    setRejectionReason("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
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

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Test Requests</h1>
          <p className="text-muted-foreground">
            Manage student test access requests
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading requests...</p>
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
        <h1 className="text-3xl font-bold mb-2">Test Requests</h1>
        <p className="text-muted-foreground">
          Manage student test access requests
        </p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Requests
                </p>
                <p className="text-2xl font-bold">{requests.length}</p>
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
                  Pending
                </p>
                <p className="text-2xl font-bold">{pendingCount}</p>
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
                  Approved
                </p>
                <p className="text-2xl font-bold">{approvedCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Rejected
                </p>
                <p className="text-2xl font-bold">{rejectedCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Requests Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No requests yet</h3>
                <p className="text-muted-foreground">
                  Student test access requests will appear here
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {request.student.first_name}{" "}
                              {request.student.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {request.student.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.test.title}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {request.test.type} • {request.test.duration} min
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(request.requested_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={getStatusColor(request.status)}
                        >
                          {request.status.charAt(0).toUpperCase() +
                            request.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {request.status === "pending" ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                openActionDialog(request, "approve")
                              }
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                openActionDialog(request, "reject")
                              }
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {request.status === "approved"
                              ? "Already approved"
                              : "Already rejected"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Action Dialog */}
      <Dialog
        open={!!selectedRequest && !!actionType}
        onOpenChange={() => {
          setSelectedRequest(null);
          setActionType(null);
          setRejectionReason("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve" : "Reject"} Test Request
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? "The student will be notified and can start the test immediately."
                : "Please provide a reason for rejection (optional)."}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">
                  {selectedRequest.student.first_name}{" "}
                  {selectedRequest.student.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedRequest.test.title}
                </p>
              </div>

              {actionType === "reject" && (
                <div>
                  <Label htmlFor="rejection_reason">Rejection Reason</Label>
                  <Textarea
                    id="rejection_reason"
                    placeholder="Explain why this request is being rejected..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              )}

              {actionType === "approve" && (
                <div className="flex items-start gap-2 p-4 bg-blue-50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-800">Note:</p>
                    <p className="text-blue-700">
                      Once approved, the student can immediately start taking
                      the test. Make sure they are ready.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setActionType(null);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              variant={actionType === "approve" ? "default" : "destructive"}
            >
              {processing
                ? "Processing..."
                : actionType === "approve"
                  ? "Approve"
                  : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TestRequests;
