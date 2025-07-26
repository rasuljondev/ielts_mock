import { createClient } from "@supabase/supabase-js";

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if we have valid configuration
const hasValidConfig =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== "your_supabase_project_url_here" &&
  supabaseAnonKey !== "your_supabase_anon_key_here" &&
  supabaseUrl.startsWith("https://") &&
  supabaseAnonKey.length > 20;

// Use real configuration or create a mock client
let finalUrl: string;
let finalKey: string;
let isRealSupabase = false;

if (hasValidConfig) {
  finalUrl = supabaseUrl;
  finalKey = supabaseAnonKey;
  isRealSupabase = true;
  console.log("✅ Using real Supabase configuration");
  console.log("🔗 Supabase URL:", finalUrl);
  console.log(
    "🔑 Supabase Key (first 20 chars):",
    finalKey.substring(0, 20) + "...",
  );
} else {
  // Use a placeholder URL that won't cause network errors
  finalUrl = "https://localhost:54321";
  finalKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
  console.warn(
    "⚠️ DEMO MODE: Supabase configuration missing or invalid. Using local mode.",
  );
  console.log("📝 To enable cloud features, create a .env file with:");
  console.log("VITE_SUPABASE_URL=https://yourproject.supabase.co");
  console.log("VITE_SUPABASE_ANON_KEY=your_actual_anon_key");
  console.log(
    "💡 In demo mode, authentication and data features will be simulated locally.",
  );
}

// Create Supabase client with custom options to handle demo mode
export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    // In demo mode, disable auto refresh to prevent network errors
    autoRefreshToken: isRealSupabase,
    persistSession: isRealSupabase,
    detectSessionInUrl: isRealSupabase,
  },
  global: {
    // Add custom headers and handle network errors gracefully
    headers: {
      "X-Client-Info": "ielts-platform",
    },
  },
});

// Helper function to check if we're in demo mode
export const isDemoMode = () => {
  return !isRealSupabase;
};

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return isRealSupabase;
};

// Expose supabase globally for debugging (only in development)
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as any).supabase = supabase;
  console.log("🔧 Supabase client available globally as window.supabase");
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          username: string;
          phone: string;
          role: "super_admin" | "edu_admin" | "student";
          edu_center_id?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          first_name: string;
          last_name: string;
          username: string;
          phone: string;
          role: "super_admin" | "edu_admin" | "student";
          edu_center_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          username?: string;
          phone?: string;
          role?: "super_admin" | "edu_admin" | "student";
          edu_center_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      edu_centers: {
        Row: {
          id: string;
          name: string;
          location: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          location?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};
