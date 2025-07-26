import { supabase } from "./supabase";

export interface NetworkStatus {
  isOnline: boolean;
  supabaseConnected: boolean;
  latency?: number;
  error?: string;
}

export const testNetworkConnectivity = async (): Promise<NetworkStatus> => {
  const startTime = Date.now();

  try {
    // Test basic connectivity
    if (!navigator.onLine) {
      return {
        isOnline: false,
        supabaseConnected: false,
        error: "No internet connection detected",
      };
    }

    // Test Supabase connectivity
    const { data, error } = await supabase.from("tests").select("id").limit(1);

    const latency = Date.now() - startTime;

    if (error) {
      console.error("Supabase connectivity test failed:", error);
      return {
        isOnline: true,
        supabaseConnected: false,
        latency,
        error: `Database connection failed: ${error.message}`,
      };
    }

    return {
      isOnline: true,
      supabaseConnected: true,
      latency,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;

    return {
      isOnline: true,
      supabaseConnected: false,
      latency,
      error: `Network error: ${error.message || "Unknown error"}`,
    };
  }
};

export const logNetworkInfo = () => {
  console.group("🌐 Network Information");
  console.log("Online:", navigator.onLine);
  console.log("Connection:", (navigator as any).connection);
  console.log("User Agent:", navigator.userAgent);
  console.log("URL:", window.location.href);
  console.groupEnd();
};
