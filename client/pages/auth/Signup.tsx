import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import type { SignupData, EduCenter } from "@/types/auth";
import { Loader2 } from "lucide-react";

const Signup: React.FC = () => {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [eduCenters, setEduCenters] = useState<EduCenter[]>([]);
  const { signup } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignupData>();

  useEffect(() => {
    fetchEduCenters();
  }, []);

  const fetchEduCenters = async () => {
    try {
      console.log("🔍 Fetching education centers...");

      const { data, error } = await supabase
        .from("edu_centers")
        .select("*")
        .order("name");

      if (error) {
        console.error("❌ Error fetching education centers:", error.message);
        setEduCenters([]);
        return;
      }

      console.log("✅ Education centers loaded:", data?.length || 0);
      setEduCenters(data || []);
    } catch (error) {
      console.error("❌ Network error fetching education centers:", error);
      setEduCenters([]);
    }
  };

  const onSubmit = async (data: SignupData) => {
    setIsLoading(true);
    setError("");
    setSuccess("");

    const result = await signup(data);

    if (result.success) {
      setSuccess(
        "Account created successfully! Please check your email for verification.",
      );
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } else {
      setError(result.error || "Signup failed");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-primary text-primary-foreground w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl mx-auto mb-4">
            I
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Join IELTS Platform
          </h1>
          <p className="text-muted-foreground">
            Create your student account to start practicing
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Student Registration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    placeholder="Usmon"
                    {...register("first_name", {
                      required: "First name is required",
                    })}
                  />
                  {errors.first_name && (
                    <p className="text-sm text-destructive">
                      {errors.first_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    placeholder="Jafarov"
                    {...register("last_name", {
                      required: "Last name is required",
                    })}
                  />
                  {errors.last_name && (
                    <p className="text-sm text-destructive">
                      {errors.last_name.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="ali"
                  {...register("username", {
                    required: "Username is required",
                    minLength: {
                      value: 3,
                      message: "Username must be at least 3 characters",
                    },
                  })}
                />
                {errors.username && (
                  <p className="text-sm text-destructive">
                    {errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+998 99 220 0880"
                  {...register("phone", {
                    required: "Phone number is required",
                  })}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">
                    {errors.phone.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="fotima@gmail.com"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^\S+@\S+$/i,
                      message: "Invalid email address",
                    },
                  })}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password"
                  {...register("password", {
                    required: "Password is required",
                    minLength: {
                      value: 6,
                      message: "Password must be at least 6 characters",
                    },
                  })}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edu_center">Education Center</Label>
                <Select
                  onValueChange={(value) => setValue("edu_center_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your education center" />
                  </SelectTrigger>
                  <SelectContent>
                    {eduCenters.length > 0 ? (
                      eduCenters.map((center) => (
                        <SelectItem key={center.id} value={center.id}>
                          <div className="flex items-center gap-3 py-2">
                            {center.logo_url && (
                              <img
                                src={center.logo_url}
                                alt={`${center.name} logo`}
                                className="w-8 h-8 rounded object-cover"
                              />
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium">{center.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {center.location}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem disabled value="no-centers">
                        No education centers available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {eduCenters.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No education centers found. Please contact support.
                  </p>
                )}
                {errors.edu_center_id && (
                  <p className="text-sm text-destructive">
                    Education center is required
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <div className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in here
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Signup;
