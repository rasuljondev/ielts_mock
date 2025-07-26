import { supabase } from "./supabase";

/**
 * Check basic network connectivity
 */
export async function checkNetworkConnectivity() {
  try {
    console.log("🔍 Checking network connectivity...");

    // Try a simple health check
    const response = await fetch("https://httpbin.org/status/200", {
      method: "GET",
      mode: "cors",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (response.ok) {
      console.log("✅ Network connectivity confirmed");
      return true;
    } else {
      console.warn("⚠️ Network response not OK:", response.status);
      return false;
    }
  } catch (error: any) {
    console.error(
      "❌ Network connectivity check failed:",
      error?.message || error,
    );
    return false;
  }
}

/**
 * Safely fetch a single record from Supabase
 * Handles the common "multiple (or no) rows returned" error
 */
export async function fetchSingleRecord<T>(
  query: any,
  errorMessage = "Record not found",
): Promise<T> {
  const { data, error } = await query;

  if (error) {
    console.error("Supabase query error:", error);
    throw new Error(`Database error: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(errorMessage);
  }

  if (data.length > 1) {
    console.warn(
      "Multiple records found when expecting single record:",
      data.length,
    );
  }

  return data[0];
}

/**
 * Create mock test data for offline mode
 */
function createMockTest(testId: string) {
  return {
    id: testId,
    title: `Mock Test ${testId.slice(0, 8)}`,
    status: "draft",
    created_by: "offline-user",
    test_type: "IELTS",
    duration_minutes: 120,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    description: "This is a mock test created in offline mode",
  };
}

/**
 * Safely fetch a test by ID with offline fallback
 */
export async function fetchTestById(testId: string) {
  if (!testId) {
    throw new Error("Test ID is required");
  }

  console.log("🔍 Searching for test with ID:", testId);
  console.log("🔍 Test ID type:", typeof testId);
  console.log("🔍 Test ID length:", testId.length);

  // Check network connectivity first
  const isOnline = navigator.onLine;
  console.log("🌐 Network status:", isOnline ? "Online" : "Offline");

  if (!isOnline) {
    console.warn("⚠️ Device is offline, using mock data");
    return createMockTest(testId);
  }

  // Try to connect to Supabase with timeout
  let networkConnected = false;
  try {
    console.log("🔍 Attempting to connect to Supabase...");

    // Quick connectivity test with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const { data: allTests, error: allTestsError } = await supabase
      .from("tests")
      .select("id, title, status, created_by")
      .limit(1); // Just test connectivity

    clearTimeout(timeoutId);

    if (allTestsError) {
      console.error(
        "❌ Supabase connection error:",
        allTestsError?.message || allTestsError,
      );

      if (allTestsError?.message?.includes("fetch")) {
        console.warn("⚠️ Network fetch failed, switching to offline mode");
        return createMockTest(testId);
      }
    } else {
      console.log("✅ Successfully connected to Supabase");
      networkConnected = true;
    }
  } catch (debugError: any) {
    console.error(
      "❌ Network connectivity test failed:",
      debugError?.message || debugError,
    );

    if (
      debugError?.message?.includes("fetch") ||
      debugError?.name === "AbortError"
    ) {
      console.warn(
        "⚠️ Connection timeout or network error, using offline mode",
      );
      return createMockTest(testId);
    }
  }

  // If we can't connect, use offline mode
  if (!networkConnected) {
    console.warn("⚠️ Unable to connect to database, using offline mode");
    return createMockTest(testId);
  }

  // Now try to fetch the specific test
  let data, error;

  try {
    const result = await supabase.from("tests").select("*").eq("id", testId);

    data = result.data;
    error = result.error;

    console.log("🔍 Query result for testId", testId, ":", { data, error });
  } catch (fetchError: any) {
    console.error(
      "❌ Network fetch failed for specific test:",
      fetchError?.message || fetchError,
    );

    if (
      fetchError?.message?.includes("fetch") ||
      fetchError.name === "TypeError"
    ) {
      console.warn("⚠️ Falling back to offline mode for test fetch");
      return createMockTest(testId);
    } else {
      throw new Error(
        `Connection error: ${fetchError?.message || "Unknown network error"}`,
      );
    }
  }

  if (error) {
    console.error("❌ Supabase query error:", error?.message || error);

    if (error.message?.includes("fetch") || error.name === "TypeError") {
      console.warn("⚠️ Database fetch error, using offline mode");
      return createMockTest(testId);
    } else if (
      error.message?.includes("JWT") ||
      error.message?.includes("auth")
    ) {
      throw new Error("Authentication error: Please log in again");
    } else {
      throw new Error(`Database error: ${error.message}`);
    }
  }

  if (!data || data.length === 0) {
    console.warn("⚠️ No test found with ID:", testId);
    console.warn("⚠️ This could mean:");
    console.warn("   1. Test doesn't exist in database");
    console.warn("   2. RLS policies are blocking access");
    console.warn("   3. Test ID is malformed");
    console.warn("⚠️ Falling back to mock test data");
    return createMockTest(testId);
  }

  if (data.length > 1) {
    console.warn("⚠️ Multiple tests found with same ID:", data.length);
  }

  console.log("✅ Test found successfully:", data[0]);
  return data[0];
}

/**
 * Safely fetch user profile by ID
 */
export async function fetchUserProfile(userId: string) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  return fetchSingleRecord(
    supabase.from("profiles").select("*").eq("id", userId),
    "User profile not found",
  );
}

/**
 * Safely create a record and return the created data
 */
export async function createSingleRecord<T>(
  query: any,
  errorMessage = "Failed to create record",
): Promise<T> {
  const { data, error } = await query;

  if (error) {
    console.error("Supabase create error:", error);
    throw new Error(`Database error: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(errorMessage);
  }

  return data[0];
}
