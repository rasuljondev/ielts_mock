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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  UserCog,
  Plus,
  Search,
  Edit,
  Trash2,
  Building2,
  Mail,
  Phone,
  Calendar,
  Users,
  Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { User, EduCenter } from "@/types/auth";

interface AdminWithCenter extends User {
  edu_center?: EduCenter;
  student_count?: number;
  test_count?: number;
}

interface NewAdminData {
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  phone: string;
  password: string;
  edu_center_id: string;
}

const Admins: React.FC = () => {
  const [admins, setAdmins] = useState<AdminWithCenter[]>([]);
  const [eduCenters, setEduCenters] = useState<EduCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newAdmin, setNewAdmin] = useState<NewAdminData>({
    email: "",
    first_name: "",
    last_name: "",
    username: "",
    phone: "",
    password: "",
    edu_center_id: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch admins
      const { data: adminsData, error: adminsError } = await supabase
        .from("profiles")
        .select(
          `
          *,
          edu_center:edu_centers(*)
        `,
        )
        .eq("role", "edu_admin")
        .order("created_at", { ascending: false });

      if (adminsError) throw adminsError;

      // Fetch education centers
      const { data: centersData, error: centersError } = await supabase
        .from("edu_centers")
        .select("*")
        .order("name");

      if (centersError) throw centersError;

      setAdmins(adminsData || []);
      setEduCenters(centersData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      setAdmins([]);
      setEduCenters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (
      !newAdmin.email ||
      !newAdmin.first_name ||
      !newAdmin.last_name ||
      !newAdmin.username ||
      !newAdmin.password ||
      !newAdmin.edu_center_id
    ) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newAdmin.email,
        password: newAdmin.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile
        const { error: profileError } = await supabase.from("profiles").insert({
          id: authData.user.id,
          email: newAdmin.email,
          first_name: newAdmin.first_name,
          last_name: newAdmin.last_name,
          username: newAdmin.username,
          phone: newAdmin.phone,
          role: "edu_admin",
          edu_center_id: newAdmin.edu_center_id,
        });

        if (profileError) throw profileError;

        // Refresh the admins list
        await fetchData();

        // Reset form
        setNewAdmin({
          email: "",
          first_name: "",
          last_name: "",
          username: "",
          phone: "",
          password: "",
          edu_center_id: "",
        });
        setIsCreateDialogOpen(false);

        alert("Admin created successfully!");
      }
    } catch (error) {
      console.error("Error creating admin:", error);
      alert(
        `Failed to create admin: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const handleDeleteAdmin = async (adminId: string, adminName: string) => {
    if (!confirm(`Are you sure you want to delete admin "${adminName}"?`))
      return;

    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", adminId);

      if (error) throw error;

      setAdmins(admins.filter((admin) => admin.id !== adminId));
      alert("Admin deleted successfully!");
    } catch (error) {
      console.error("Error deleting admin:", error);
      alert(
        `Failed to delete admin: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const filteredAdmins = admins.filter(
    (admin) =>
      admin.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.username.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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
            Education Admins
          </h1>
          <p className="text-muted-foreground">
            Create and manage education center administrators
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Education Admin</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={newAdmin.first_name}
                    onChange={(e) =>
                      setNewAdmin({ ...newAdmin, first_name: e.target.value })
                    }
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={newAdmin.last_name}
                    onChange={(e) =>
                      setNewAdmin({ ...newAdmin, last_name: e.target.value })
                    }
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={newAdmin.username}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, username: e.target.value })
                  }
                  placeholder="johndoe"
                />
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, email: e.target.value })
                  }
                  placeholder="john@educenter.com"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={newAdmin.phone}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, phone: e.target.value })
                  }
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <Label htmlFor="password">Initial Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newAdmin.password}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, password: e.target.value })
                  }
                  placeholder="Temporary password (user can change later)"
                />
              </div>

              <div>
                <Label htmlFor="edu_center">Education Center *</Label>
                <Select
                  value={newAdmin.edu_center_id}
                  onValueChange={(value) =>
                    setNewAdmin({ ...newAdmin, edu_center_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select education center" />
                  </SelectTrigger>
                  <SelectContent>
                    {eduCenters.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name} - {center.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateAdmin}>Create Admin</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Admins
                </p>
                <p className="text-2xl font-bold">{admins.length}</p>
              </div>
              <UserCog className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Education Centers
                </p>
                <p className="text-2xl font-bold">{eduCenters.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Active Today
                </p>
                <p className="text-2xl font-bold">
                  {Math.floor(admins.length * 0.7)}
                </p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search admins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Admins Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Education Admins ({filteredAdmins.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAdmins.length === 0 ? (
            <div className="text-center py-12">
              <UserCog className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No admins found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? "No admins match your search criteria"
                  : "Create your first education admin to get started"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Admin
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Education Center</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(admin.first_name, admin.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {admin.first_name} {admin.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            @{admin.username}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {admin.edu_center ? (
                        <div className="flex items-center space-x-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {admin.edu_center.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {admin.edu_center.location}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No center assigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{admin.email}</span>
                        </div>
                        {admin.phone && (
                          <div className="flex items-center space-x-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{admin.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(admin.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800">
                        Active
                      </Badge>
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
                          onClick={() =>
                            handleDeleteAdmin(
                              admin.id,
                              `${admin.first_name} ${admin.last_name}`,
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
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
    </div>
  );
};

export default Admins;
