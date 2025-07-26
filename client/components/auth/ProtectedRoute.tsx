import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireAuth = true,
}) => {
  const { user, loading, isAuthenticated, hasAnyRole } = useAuth();
  const [showTimeout, setShowTimeout] = React.useState(false);

  // Add timeout for loading state
  React.useEffect(() => {
    if (loading) {
      const isListeningTest = window.location.pathname.includes('/listening');
      const timeoutDuration = isListeningTest ? 3000 : 8000; // 3 seconds for listening tests

      const timer = setTimeout(() => {
        setShowTimeout(true);
      }, timeoutDuration);

      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (loading && !showTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="text-gray-600">Loading test content...</p>
        </div>
      </div>
    );
  }

  // If loading timed out, show error with option to continue
  if (loading && showTimeout) {
    const isListeningTest = window.location.pathname.includes('/listening');

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-xl font-semibold mb-4">Loading Taking Too Long</h2>
          <p className="text-gray-600 mb-6">
            There might be an authentication issue. You can try refreshing the page or continue without authentication for demo purposes.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
            {(isListeningTest || !requireAuth) && (
              <button
                onClick={() => {
                  // Force bypass the loading state
                  const { useAuthStore } = require('@/store/authStore');
                  useAuthStore.getState().setLoading(false);
                  setShowTimeout(false);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Continue to Test
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !hasAnyRole(allowedRoles)) {
    // Redirect based on user role
    switch (user.role) {
      case "super_admin":
        return <Navigate to="/super-admin/dashboard" replace />;
      case "edu_admin":
        return <Navigate to="/edu-admin/dashboard" replace />;
      case "student":
        return <Navigate to="/student/dashboard" replace />;
      default:
        return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
