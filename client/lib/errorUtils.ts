// Enhanced error handling utilities with better network and auth error detection

export interface AppError {
  type: "network" | "auth" | "permission" | "validation" | "unknown";
  message: string;
  originalError?: any;
  retryable: boolean;
  code?: string;
}

export const parseError = (error: any): string => {
  console.error("🔍 Parsing error:", error);

  if (!error) return "Unknown error occurred";

  // Handle string errors
  if (typeof error === "string") {
    return error;
  }

  // Handle Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle Supabase errors
  if (error.message) {
    return error.message;
  }

  // Handle fetch errors
  if (error.name === "TypeError" && error.message?.includes("fetch")) {
    return "Network connection failed. Please check your internet connection.";
  }

  // Handle auth errors
  if (error.code === "invalid_grant" || error.error === "invalid_grant") {
    return "Invalid email or password";
  }

  // Fallback to JSON string
  try {
    return JSON.stringify(error);
  } catch {
    return "An unexpected error occurred";
  }
};

export const classifyError = (error: any): AppError => {
  let type: AppError["type"] = "unknown";
  let retryable = false;
  let message = parseError(error);

  // Network errors
  if (
    error instanceof TypeError &&
    (error.message?.includes("fetch") ||
      error.message?.includes("Failed to fetch"))
  ) {
    type = "network";
    retryable = true;
    message =
      "Network connection failed. Please check your internet connection and try again.";
  }

  // Chrome extension interference
  if (error.stack?.includes("chrome-extension://")) {
    type = "network";
    retryable = true;
    message =
      "Browser extension interference detected. Please disable extensions and try again.";
  }

  // Auth errors
  if (
    error.message?.includes("auth") ||
    error.message?.includes("token") ||
    error.message?.includes("session") ||
    error.code === "invalid_grant"
  ) {
    type = "auth";
    retryable = false;
    message = "Authentication failed. Please log in again.";
  }

  // Permission errors
  if (
    error.message?.includes("permission") ||
    error.message?.includes("access") ||
    error.code === "42501" ||
    error.code === "PGRST301"
  ) {
    type = "permission";
    retryable = false;
    message = "Access denied. Please contact your administrator.";
  }

  // Validation errors
  if (
    error.message?.includes("validation") ||
    error.message?.includes("constraint") ||
    error.message?.includes("required")
  ) {
    type = "validation";
    retryable = false;
  }

  return {
    type,
    message,
    originalError: error,
    retryable,
    code: error.code || error.error_code,
  };
};

export const logError = (context: string, error: any) => {
  const classified = classifyError(error);

  console.group(`🚨 Error in ${context}`);
  console.error("Type:", classified.type);
  console.error("Message:", classified.message);
  console.error("Retryable:", classified.retryable);
  console.error("Code:", classified.code);
  console.error("Original:", classified.originalError);

  // Additional debugging for network errors
  if (classified.type === "network") {
    console.error("Network status:", navigator.onLine ? "Online" : "Offline");
    console.error("User agent:", navigator.userAgent);
  }

  console.groupEnd();
};

// Retry utility with exponential backoff
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> => {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const classified = classifyError(error);

      // Don't retry non-retryable errors
      if (!classified.retryable) {
        throw error;
      }

      // Don't retry on final attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(
        `⏳ Retry attempt ${attempt + 1}/${maxRetries} in ${delay}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

// Network connectivity check
export const checkNetworkConnectivity = async (): Promise<boolean> => {
  try {
    // First check navigator.onLine
    if (!navigator.onLine) {
      return false;
    }

    // Try to fetch from our own domain (no external dependencies)
    // This is a lightweight check that doesn't require external services
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      await fetch(window.location.origin + '/favicon.ico', {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-cache",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return true;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // If favicon fails, just assume we're online if navigator says so
      // This prevents false negatives from browser extensions or security restrictions
      console.warn("Favicon fetch failed, assuming online based on navigator.onLine:", fetchError);
      return navigator.onLine;
    }
  } catch (error) {
    console.warn("Network connectivity check failed, assuming online:", error);
    // Default to online to avoid blocking the app
    return true;
  }
};

// Safe async operation wrapper
export const safeAsync = async <T>(
  operation: () => Promise<T>,
  fallback?: T,
  context?: string,
): Promise<T | undefined> => {
  try {
    return await operation();
  } catch (error) {
    if (context) {
      logError(context, error);
    }
    return fallback;
  }
};
