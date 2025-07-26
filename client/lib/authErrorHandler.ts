// Utility to handle auth errors gracefully
export const isSessionExpiredError = (error: any): boolean => {
  return (
    error?.message?.includes("Auth session missing") ||
    error?.message?.includes("JWT") ||
    error?.message?.includes("session") ||
    error?.code === "invalid_grant"
  );
};

// Check if error is just missing session (normal when not logged in)
export const isSessionMissingError = (error: any): boolean => {
  return error?.message?.includes("Auth session missing");
};

export const handleAuthError = (
  error: any,
): { shouldRedirect: boolean; message?: string } => {
  if (isSessionExpiredError(error)) {
    console.log("🔐 Session expired - user will be redirected to login");
    return { shouldRedirect: true };
  }

  return {
    shouldRedirect: false,
    message: "Authentication failed. Please log in again.",
  };
};
