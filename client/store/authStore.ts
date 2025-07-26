import { create } from "zustand";
import { supabase, isDemoMode, isSupabaseConfigured } from "@/lib/supabase";
import { enhancedSupabase, safeSupabaseOperation } from "@/lib/supabaseClient";
import {
  classifyError,
  logError,
  retryWithBackoff,
  checkNetworkConnectivity,
} from "@/lib/errorUtils";
import {
  isSessionExpiredError,
  isSessionMissingError,
} from "@/lib/authErrorHandler";
import type {
  User,
  AuthState,
  LoginCredentials,
  SignupData,
} from "@/types/auth";

interface AuthStore extends AuthState {
  login: (
    credentials: LoginCredentials,
  ) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (loading) => set({ loading }),

  login: async (credentials) => {
    try {
      set({ loading: true });

      // Check if we're in demo mode
      if (isDemoMode()) {
        console.log("🎭 Demo mode detected - simulating login");

        // Simulate a successful login for demo purposes
        if (
          credentials.email === "demo@example.com" &&
          credentials.password === "demo123"
        ) {
          const demoUser = {
            id: "demo-user-id",
            email: "demo@example.com",
            first_name: "Demo",
            last_name: "User",
            username: "demouser",
            phone: "+1234567890",
            role: "student" as const,
            edu_center_id: "demo-center-id",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          set({ user: demoUser, isAuthenticated: true, loading: false });
          return { success: true };
        } else {
          set({ loading: false });
          return {
            success: false,
            error: "Demo mode: Use demo@example.com / demo123 to login",
          };
        }
      }

      // Check if Supabase is properly configured
      if (!isSupabaseConfigured()) {
        set({ loading: false });
        return {
          success: false,
          error:
            "Supabase configuration missing. Please configure your environment variables.",
        };
      }

      console.log("🔐 Attempting login for:", credentials.email);

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });

      if (authError) {
        console.error("❌ Auth error:", authError);
        set({ loading: false });
        return { success: false, error: authError.message };
      }

      if (authData.user) {
        console.log("✅ User authenticated, fetching profile...");
        console.log("🔍 Looking for user ID:", authData.user.id);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .single();

        console.log("📊 Profile query result:", { profile, profileError });

        if (profileError) {
          console.error("❌ Profile fetch error:", profileError);
          set({ loading: false });
          return {
            success: false,
            error: `Profile fetch failed: ${profileError.message}. User ID: ${authData.user.id}`,
          };
        }

        console.log("✅ Profile loaded:", profile.role);
        set({ user: profile, isAuthenticated: true, loading: false });
        return { success: true };
      }

      set({ loading: false });
      return { success: false, error: "Login failed - no user data received" };
    } catch (error) {
      console.error("❌ Login error:", error);
      set({ loading: false });

      if (error instanceof Error) {
        if (error.message.includes("fetch")) {
          return {
            success: false,
            error:
              "Unable to connect to authentication service. Please check your internet connection and Supabase configuration.",
          };
        }
        return { success: false, error: error.message };
      }

      return {
        success: false,
        error: "An unexpected error occurred during login",
      };
    }
  },

  signup: async (data) => {
    try {
      set({ loading: true });

      // Check if we're in demo mode
      if (isDemoMode()) {
        console.log("🎭 Demo mode detected - simulating signup");
        set({ loading: false });
        return {
          success: false,
          error:
            "Demo mode: Signup is disabled. Use demo@example.com / demo123 to login",
        };
      }

      // Check if Supabase is properly configured
      if (!isSupabaseConfigured()) {
        set({ loading: false });
        return {
          success: false,
          error:
            "Supabase configuration missing. Please configure your environment variables.",
        };
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        set({ loading: false });
        return { success: false, error: authError.message };
      }

      if (authData.user) {
        const { error: profileError } = await supabase.from("profiles").insert({
          id: authData.user.id,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          username: data.username,
          phone: data.phone,
          role: "student",
          edu_center_id: data.edu_center_id,
        });

        if (profileError) {
          set({ loading: false });
          return { success: false, error: "Failed to create user profile" };
        }

        set({ loading: false });
        return { success: true };
      }

      set({ loading: false });
      return { success: false, error: "Signup failed" };
    } catch (error) {
      set({ loading: false });
      return { success: false, error: "An unexpected error occurred" };
    }
  },

  logout: async () => {
    try {
      // In demo mode, just clear the local state
      if (isDemoMode()) {
        console.log("🎭 Demo mode - clearing local auth state");
        set({ user: null, isAuthenticated: false });
        return;
      }

      // Real logout for configured Supabase
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }

      set({ user: null, isAuthenticated: false });
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout fails, clear local state
      set({ user: null, isAuthenticated: false });
    }
  },

  fetchUser: async () => {
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      set({ loading: true });

      // Check if we're in demo mode first
      if (isDemoMode()) {
        console.log("🎭 Demo mode detected - skipping authentication");
        set({ loading: false, user: null, isAuthenticated: false });
        return;
      }

      // Check if Supabase is properly configured
      if (!isSupabaseConfigured()) {
        console.warn("⚠️ Supabase not configured - skipping authentication");
        set({ loading: false, user: null, isAuthenticated: false });
        return;
      }

      // Add timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        console.warn("⚠️ Auth fetch timeout, stopping loading state");
        set({ loading: false, user: null, isAuthenticated: false });
      }, 5000); // 5 second timeout

      console.log("🔐 Starting auth fetch...");

      // Check network connectivity first (with fallback)
      let isOnline = true;
      try {
        isOnline = await checkNetworkConnectivity();
      } catch (error) {
        console.warn(
          "⚠️ Network connectivity check failed, proceeding anyway:",
          error,
        );
        isOnline = true; // Assume online to avoid blocking
      }

      if (!isOnline) {
        console.warn(
          "⚠️ No network connectivity detected, skipping user fetch",
        );
        clearTimeout(timeoutId);
        set({ loading: false });
        return;
      }

      // Use enhanced client for auth operations
      console.log("🔐 Getting user from Supabase...");
      const authData = await enhancedSupabase.getUser();
      console.log("🔐 Auth data received:", authData ? "Found" : "None");

      if (authData && authData.user) {
        console.log("🔐 User found, fetching profile...");
        // Use enhanced client for profile fetch
        const profile = await enhancedSupabase.select("profiles", "*", {
          id: authData.user.id,
        });

        if (profile && profile.length > 0) {
          console.log("✅ Profile found, setting authenticated state");
          clearTimeout(timeoutId);
          set({ user: profile[0], isAuthenticated: true, loading: false });
        } else {
          console.warn("⚠️ User authenticated but no profile found");
          clearTimeout(timeoutId);
          set({ user: null, isAuthenticated: false, loading: false });
        }
      } else {
        // No user found - session has expired or user is not logged in
        console.log(
          "🔐 No authenticated user found, setting unauthenticated state",
        );
        clearTimeout(timeoutId);
        set({ user: null, isAuthenticated: false, loading: false });
      }
    } catch (error) {
      // Clear timeout in case of error
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Handle session missing errors gracefully - this is normal when not logged in
      if (isSessionMissingError(error)) {
        // Don't log this as an error - it's normal behavior when not logged in
        set({ user: null, isAuthenticated: false, loading: false });
        return;
      }

      // Handle actual session expiration (different from missing session)
      if (isSessionExpiredError(error)) {
        console.log("🔐 Session expired - user needs to log in");
        set({ user: null, isAuthenticated: false, loading: false });
        return;
      }

      // Only log actual errors, not missing/expired sessions
      logError("fetchUser", error);
      const classified = classifyError(error);

      // Only clear auth state for auth errors, not network errors
      if (classified.type === "auth") {
        set({ user: null, isAuthenticated: false, loading: false });
      } else {
        set({ loading: false });
      }
    }
  },
}));
