import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  User,
  Mail,
  Phone,
  Building2,
  Upload,
  Save,
  Key,
  Camera,
  CheckCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthStore } from "@/store/authStore";

interface ProfileForm {
  first_name: string;
  last_name: string;
  username: string;
  phone: string;
}

interface EduCenterForm {
  name: string;
  logo_url?: string;
}

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { setUser } = useAuthStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUpdatingEduCenter, setIsUpdatingEduCenter] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState(
    user?.profile_image_url || "",
  );
  const [eduCenter, setEduCenter] = useState<any>(null);
  const [message, setMessage] = useState({ type: "", content: "" });
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileForm>({
    defaultValues: {
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      username: user?.username || "",
      phone: user?.phone || "",
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPasswordForm,
    watch,
  } = useForm<PasswordForm>();

  const {
    register: registerEduCenter,
    handleSubmit: handleSubmitEduCenter,
    formState: { errors: eduCenterErrors },
    setValue: setEduCenterValue,
  } = useForm<EduCenterForm>();

  const watchNewPassword = watch("new_password");

  // Fetch edu center data for edu admins
  React.useEffect(() => {
    if (user?.role === "edu_admin" && user?.edu_center_id) {
      fetchEduCenter();
    }
  }, [user]);

  const fetchEduCenter = async () => {
    try {
      const { data, error } = await supabase
        .from("edu_centers")
        .select("*")
        .eq("id", user?.edu_center_id)
        .single();

      if (error) {
        console.warn("Could not fetch edu center:", error.message);
        return;
      }

      setEduCenter(data);
      setEduCenterValue("name", data.name || "");
    } catch (error: any) {
      console.error(
        "Error fetching edu center:",
        error?.message || String(error),
      );
      // Set a fallback edu center object to prevent UI errors
      setEduCenter({
        id: user?.edu_center_id,
        name: "",
        location: "",
        contact_email: "",
        contact_phone: "",
        logo_url: "",
      });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return (
          <Badge className="bg-purple-100 text-purple-800">Super Admin</Badge>
        );
      case "edu_admin":
        return <Badge className="bg-blue-100 text-blue-800">Edu Admin</Badge>;
      case "student":
        return <Badge variant="outline">Student</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const handleProfileUpdate = async (data: ProfileForm) => {
    setIsUpdating(true);
    setMessage({ type: "", content: "" });

    try {
      const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          username: data.username,
          phone: data.phone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id)
        .select()
        .single();

      if (error) throw error;

      setUser(updatedProfile);
      setMessage({
        type: "success",
        content: "Profile updated successfully!",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({
        type: "error",
        content: `Failed to update profile: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith("image/")) {
      setMessage({
        type: "error",
        content: "Please select a valid image file",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({
        type: "error",
        content: "Image size must be less than 5MB",
      });
      return;
    }

    setIsUploadingImage(true);
    setMessage({ type: "", content: "" });

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}/profile.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-images").getPublicUrl(fileName);

      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({
          profile_image_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setUser(updatedProfile);
      setProfileImageUrl(publicUrl);
      setMessage({
        type: "success",
        content: "Profile image updated successfully!",
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      let errorMessage = "Unknown error";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (
        typeof error === "object" &&
        error !== null &&
        "message" in error
      ) {
        errorMessage = String(error.message);
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      setMessage({
        type: "error",
        content: `Failed to upload image: ${errorMessage}`,
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePasswordChange = async (data: PasswordForm) => {
    if (data.new_password !== data.confirm_password) {
      setMessage({
        type: "error",
        content: "New passwords do not match",
      });
      return;
    }

    setIsChangingPassword(true);
    setMessage({ type: "", content: "" });

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.new_password,
      });

      if (error) throw error;

      resetPasswordForm();
      setIsPasswordDialogOpen(false);
      setMessage({
        type: "success",
        content: "Password changed successfully!",
      });
    } catch (error) {
      console.error("Error changing password:", error);
      setMessage({
        type: "error",
        content: `Failed to change password: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleEduCenterUpdate = async (data: EduCenterForm) => {
    setIsUpdatingEduCenter(true);
    setMessage({ type: "", content: "" });

    try {
      const { data: updatedCenter, error } = await supabase
        .from("edu_centers")
        .update({
          name: data.name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.edu_center_id)
        .select()
        .single();

      if (error) {
        // Handle specific database errors
        if (error.message.includes("row-level security policy")) {
          setMessage({
            type: "error",
            content:
              "Permission denied. Please ensure you have update permissions for your education center.",
          });
          return;
        }
        throw error;
      }

      setEduCenter(updatedCenter);
      setMessage({
        type: "success",
        content: "Education center updated successfully!",
      });
    } catch (error: any) {
      console.error(
        "Error updating edu center:",
        error?.message || String(error),
      );
      setMessage({
        type: "error",
        content: `Failed to update edu center: ${error?.message || "Unknown error"}`,
      });
    } finally {
      setIsUpdatingEduCenter(false);
    }
  };

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith("image/")) {
      setMessage({
        type: "error",
        content: "Please select a valid image file",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({
        type: "error",
        content: "Image size must be less than 5MB",
      });
      return;
    }

    setIsUploadingLogo(true);
    setMessage({ type: "", content: "" });

    try {
      const fileExt = file.name.split(".").pop();
      let fileName = `${user?.edu_center_id}/logo.${fileExt}`;

      // Try to upload directly to the bucket
      const { error: uploadError } = await supabase.storage
        .from("edu-center-logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        // If bucket doesn't exist, provide specific instructions
        if (uploadError.message.includes("Bucket not found")) {
          setMessage({
            type: "error",
            content:
              "Storage bucket 'edu-center-logos' not found. Please create it manually: Go to Supabase → Storage → Create Bucket → Name: 'edu-center-logos' → Public: Yes",
          });
          return;
        }

        // If RLS policy error, try using profile-images bucket as fallback
        if (uploadError.message.includes("row-level security policy")) {
          console.warn(
            "Storage RLS policy issue, trying profile-images bucket as fallback",
          );

          const fallbackFileName = `${user?.id}/edu-center-logo.${fileExt}`;
          const { error: fallbackError } = await supabase.storage
            .from("profile-images")
            .upload(fallbackFileName, file, { upsert: true });

          if (fallbackError) {
            setMessage({
              type: "error",
              content:
                "Storage permission denied. Please run this SQL: UPDATE storage.buckets SET public = true WHERE id = 'edu-center-logos'; and check storage policies.",
            });
            return;
          }

          // Update the fileName for the fallback
          fileName = fallbackFileName;
          console.log(
            "Successfully uploaded to profile-images bucket as fallback",
          );
        } else {
          throw uploadError;
        }
      }

      // Determine which bucket was used for the upload
      const bucketName = fileName.includes(`${user?.id}/edu-center-logo`)
        ? "profile-images"
        : "edu-center-logos";

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucketName).getPublicUrl(fileName);

      const { data: updatedCenter, error: updateError } = await supabase
        .from("edu_centers")
        .update({
          logo_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.edu_center_id)
        .select()
        .single();

      if (updateError) {
        // Handle specific database errors
        if (
          updateError.message.includes("logo_url") &&
          updateError.message.includes("schema cache")
        ) {
          setMessage({
            type: "error",
            content:
              "Database schema needs to be updated. Please run: ALTER TABLE edu_centers ADD COLUMN logo_url TEXT;",
          });
          return;
        }

        if (updateError.message.includes("row-level security policy")) {
          setMessage({
            type: "error",
            content:
              "Permission denied. Please ensure you have update permissions for your education center.",
          });
          return;
        }

        throw updateError;
      }

      setEduCenter(updatedCenter);
      setMessage({
        type: "success",
        content: "Education center logo updated successfully!",
      });
    } catch (error: any) {
      console.error("Error uploading logo:", error?.message || String(error));
      let errorMessage = "Unknown error";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (
        typeof error === "object" &&
        error !== null &&
        "message" in error
      ) {
        errorMessage = String(error.message);
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      setMessage({
        type: "error",
        content: `Failed to upload logo: ${errorMessage}`,
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Profile not found</h1>
          <p className="text-muted-foreground">
            Please log in to view your profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your personal information and account settings
        </p>
      </div>

      {/* Message Alert */}
      {message.content && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{message.content}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Image & Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Avatar className="w-32 h-32 mx-auto">
              <AvatarImage src={profileImageUrl} alt="Profile" />
              <AvatarFallback className="text-2xl">
                {getInitials(user.first_name, user.last_name)}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-2">
              <h3 className="font-semibold text-lg">
                {user.first_name} {user.last_name}
              </h3>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
              {getRoleBadge(user.role)}
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-image" className="cursor-pointer">
                <div className="flex items-center justify-center gap-2 p-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                  <Camera className="h-4 w-4" />
                  <span className="text-sm">
                    {isUploadingImage ? "Uploading..." : "Change Picture"}
                  </span>
                </div>
              </Label>
              <Input
                id="profile-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={isUploadingImage}
              />
              <p className="text-xs text-muted-foreground">
                Max 5MB. JPG, PNG, GIF supported.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmitProfile(handleProfileUpdate)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    {...registerProfile("first_name", {
                      required: "First name is required",
                    })}
                  />
                  {profileErrors.first_name && (
                    <p className="text-sm text-destructive">
                      {profileErrors.first_name.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    {...registerProfile("last_name", {
                      required: "Last name is required",
                    })}
                  />
                  {profileErrors.last_name && (
                    <p className="text-sm text-destructive">
                      {profileErrors.last_name.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  {...registerProfile("username", {
                    required: "Username is required",
                    minLength: {
                      value: 3,
                      message: "Username must be at least 3 characters",
                    },
                  })}
                />
                {profileErrors.username && (
                  <p className="text-sm text-destructive">
                    {profileErrors.username.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  {...registerProfile("phone", {
                    required: "Phone number is required",
                  })}
                />
                {profileErrors.phone && (
                  <p className="text-sm text-destructive">
                    {profileErrors.phone.message}
                  </p>
                )}
              </div>

              <div>
                <Label>Email Address</Label>
                <Input value={user.email} disabled />
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>

              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  "Updating..."
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update Profile
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Education Center Management (for Edu Admins only) */}
      {user?.role === "edu_admin" && eduCenter && (
        <Card>
          <CardHeader>
            <CardTitle>Education Center Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Logo Upload */}
              <div className="text-center space-y-4">
                <div className="w-32 h-32 mx-auto border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden">
                  {eduCenter.logo_url ? (
                    <img
                      src={eduCenter.logo_url}
                      alt="Education Center Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <Building2 className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">No Logo</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="center-logo" className="cursor-pointer">
                    <div className="flex items-center justify-center gap-2 p-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">
                        {isUploadingLogo ? "Uploading..." : "Upload Logo"}
                      </span>
                    </div>
                  </Label>
                  <Input
                    id="center-logo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max 5MB. JPG, PNG, GIF supported.
                  </p>
                </div>
              </div>

              {/* Center Information */}
              <div className="lg:col-span-2">
                <form
                  onSubmit={handleSubmitEduCenter(handleEduCenterUpdate)}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="center_name">Education Center Name</Label>
                    <Input
                      id="center_name"
                      {...registerEduCenter("name", {
                        required: "Center name is required",
                      })}
                    />
                    {eduCenterErrors.name && (
                      <p className="text-sm text-destructive">
                        {eduCenterErrors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Location</Label>
                    <Input value={eduCenter.location || ""} disabled />
                    <p className="text-xs text-muted-foreground mt-1">
                      Location cannot be changed. Contact super admin if needed.
                    </p>
                  </div>

                  <div>
                    <Label>Contact Information</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <Input
                        value={eduCenter.contact_email || ""}
                        disabled
                        placeholder="Contact email"
                      />
                      <Input
                        value={eduCenter.contact_phone || ""}
                        disabled
                        placeholder="Contact phone"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Contact information is managed by super admin.
                    </p>
                  </div>

                  <Button type="submit" disabled={isUpdatingEduCenter}>
                    {isUpdatingEduCenter ? (
                      "Updating..."
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Update Center Info
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Security */}
      <Card>
        <CardHeader>
          <CardTitle>Account Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Password</h4>
              <p className="text-sm text-muted-foreground">
                Change your password to keep your account secure
              </p>
            </div>
            <Dialog
              open={isPasswordDialogOpen}
              onOpenChange={setIsPasswordDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Key className="mr-2 h-4 w-4" />
                  Change Password
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={handleSubmitPassword(handlePasswordChange)}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="current_password">Current Password</Label>
                    <Input
                      id="current_password"
                      type="password"
                      {...registerPassword("current_password", {
                        required: "Current password is required",
                      })}
                    />
                    {passwordErrors.current_password && (
                      <p className="text-sm text-destructive">
                        {passwordErrors.current_password.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="new_password">New Password</Label>
                    <Input
                      id="new_password"
                      type="password"
                      {...registerPassword("new_password", {
                        required: "New password is required",
                        minLength: {
                          value: 6,
                          message: "Password must be at least 6 characters",
                        },
                      })}
                    />
                    {passwordErrors.new_password && (
                      <p className="text-sm text-destructive">
                        {passwordErrors.new_password.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="confirm_password">
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      {...registerPassword("confirm_password", {
                        required: "Please confirm your new password",
                        validate: (value) =>
                          value === watchNewPassword ||
                          "Passwords do not match",
                      })}
                    />
                    {passwordErrors.confirm_password && (
                      <p className="text-sm text-destructive">
                        {passwordErrors.confirm_password.message}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsPasswordDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isChangingPassword}>
                      {isChangingPassword ? "Changing..." : "Change Password"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-medium">Account Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Role:</span>
                <span className="font-medium">
                  {user.role.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{user.email}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{user.phone}</span>
              </div>
              {user.edu_center_id && (
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Education Center:
                  </span>
                  <span className="font-medium">Assigned</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
