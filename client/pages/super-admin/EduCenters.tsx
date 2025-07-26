import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  Users,
  Eye,
  Edit,
  Trash2,
  MapPin,
  Calendar,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { EduCenter } from "@/types/auth";

interface EduCenterWithStats extends EduCenter {
  admin_count?: number;
  student_count?: number;
}

const EduCenters: React.FC = () => {
  const [centers, setCenters] = useState<EduCenterWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCenter, setNewCenter] = useState({ name: "", location: "" });

  useEffect(() => {
    fetchEduCenters();
  }, []);

  const fetchEduCenters = async () => {
    try {
      const { data, error } = await supabase
        .from("edu_centers")
        .select(
          `
          *,
          profiles!edu_center_id (
            id,
            role
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calculate stats for each center
      const centersWithStats =
        data?.map((center: any) => ({
          ...center,
          admin_count:
            center.profiles?.filter((p: any) => p.role === "edu_admin")
              .length || 0,
          student_count:
            center.profiles?.filter((p: any) => p.role === "student").length ||
            0,
        })) || [];

      setCenters(centersWithStats);
    } catch (error) {
      console.error("Error fetching education centers:", error);
      setCenters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCenter = async () => {
    if (!newCenter.name || !newCenter.location) return;

    try {
      const { data, error } = await supabase
        .from("edu_centers")
        .insert([newCenter])
        .select()
        .single();

      if (error) {
        console.error(
          "Error creating education center:",
          error.message || error,
        );
        alert(
          `Failed to create education center: ${error.message || "Unknown error"}`,
        );
        return;
      }

      setCenters([{ ...data, admin_count: 0, student_count: 0 }, ...centers]);
      setNewCenter({ name: "", location: "" });
      setIsCreateDialogOpen(false);
      console.log("✅ Education center created successfully");
    } catch (error) {
      console.error(
        "Error creating education center:",
        error instanceof Error ? error.message : error,
      );
      alert(
        `Failed to create education center: ${error instanceof Error ? error.message : "Network or permission error"}`,
      );
    }
  };

  const handleDeleteCenter = async (id: string) => {
    if (!confirm("Are you sure you want to delete this education center?"))
      return;

    try {
      const { error } = await supabase
        .from("edu_centers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setCenters(centers.filter((center) => center.id !== id));
    } catch (error) {
      console.error("Error deleting education center:", error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Education Centers
          </h1>
          <p className="text-muted-foreground">
            Manage education centers and their associated admins and students
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Center
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Education Center</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Center Name</Label>
                <Input
                  id="name"
                  value={newCenter.name}
                  onChange={(e) =>
                    setNewCenter({ ...newCenter, name: e.target.value })
                  }
                  placeholder="e.g. Cambridge Learning Hub"
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={newCenter.location}
                  onChange={(e) =>
                    setNewCenter({ ...newCenter, location: e.target.value })
                  }
                  placeholder="e.g. London, UK"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateCenter}>Create Center</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Centers
                </p>
                <p className="text-2xl font-bold">{centers.length}</p>
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
                  Total Admins
                </p>
                <p className="text-2xl font-bold">
                  {centers.reduce(
                    (sum, center) => sum + (center.admin_count || 0),
                    0,
                  )}
                </p>
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
                  Total Students
                </p>
                <p className="text-2xl font-bold">
                  {centers.reduce(
                    (sum, center) => sum + (center.student_count || 0),
                    0,
                  )}
                </p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Centers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Education Centers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Center Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Admins</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centers.map((center) => (
                <TableRow key={center.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="font-medium">{center.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{center.location}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {center.admin_count || 0} admins
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {center.student_count || 0} students
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">
                        {new Date(center.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCenter(center.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EduCenters;
