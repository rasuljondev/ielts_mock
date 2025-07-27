import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { logError, classifyError } from "@/lib/errorUtils";
import { isSessionMissingError } from "@/lib/authErrorHandler";
import { toast } from "sonner";
import { AppLayout } from "./components/layout/AppLayout";
import { TestLayout } from "./components/layout/TestLayout";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import {
  PageTransition,
  FadeTransition,
  SlideTransition,
} from "./components/ui/page-transition";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

// Pages
import Index from "./pages/Index";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import NotFound from "./pages/NotFound";

// Dashboard Pages
import StudentDashboard from "./pages/student/Dashboard";
import TestHistory from "./pages/student/TestHistory";
import EduAdminDashboard from "./pages/edu-admin/Dashboard";
import SuperAdminDashboard from "./pages/super-admin/Dashboard";

// Super Admin Pages
import EduCenters from "./pages/super-admin/EduCenters";
import UsersPage from "./pages/super-admin/Users";
import Admins from "./pages/super-admin/Admins";

// Edu Admin Pages

import CreateTestNew from "./pages/edu-admin/CreateTestNew";
import CreateTestAdvanced from "./pages/edu-admin/CreateTestAdvanced";
import CreateIELTSTest from "./pages/edu-admin/CreateIELTSTest";
import CreateReadingNew from "./pages/edu-admin/CreateReadingNew";

import CreateListeningNew from "./pages/edu-admin/CreateListeningNew";

import CreateWritingNew from "./pages/edu-admin/CreateWritingNew";
import TestRequests from "./pages/edu-admin/TestRequests";
import TestSubmissions from "./pages/edu-admin/TestSubmissions";

// Student Pages
import StudentTests from "./pages/student/Tests";
import TakeTestNew from "./pages/student/TakeTestNew";
import TakeReadingExam from "./pages/student/TakeReadingExam";
import TestStart from "./pages/student/TestStart";

import ListeningTestTaking from "./pages/student/ListeningTestTaking";
import TakeWritingTest from "./pages/student/TakeWritingTest";
import TestResults from "./pages/student/TestResults";
import AvailableTests from "./pages/student/AvailableTests";
import TestGrading from "./pages/edu-admin/TestGrading";

// Profile Page
import ProfilePage from "./pages/profile/ProfilePage";

// Test Page
import TestEditorPage from "./pages/TestEditorPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const classified = classifyError(error);
        // Only retry network errors, max 2 times
        return classified.retryable && failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error: any) => {
        const classified = classifyError(error);
        // Only retry network errors, max 1 time for mutations
        return classified.retryable && failureCount < 1;
      },
    },
  },
});

// Global error handlers
const setupGlobalErrorHandlers = () => {
  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    // Don't show errors for normal session missing - this is expected when not logged in
    if (isSessionMissingError(event.reason)) {
      event.preventDefault();
      return;
    }

    // Check if this is a browser extension related error
    const errorMessage = event.reason?.message || String(event.reason);
    if (
      errorMessage.includes("chrome-extension://") ||
      errorMessage.includes("extension") ||
      (errorMessage.includes("Failed to fetch") &&
        errorMessage.includes("requests.js"))
    ) {
      console.warn(
        "🔌 Browser extension interference detected, ignoring:",
        event.reason,
      );
      event.preventDefault();
      return;
    }

    console.error("🚨 Unhandled promise rejection:", event.reason);
    logError("unhandledrejection", event.reason);

    const classified = classifyError(event.reason);

    // Show user-friendly error messages (but not for extension errors)
    if (
      classified.type === "network" &&
      !errorMessage.includes("chrome-extension://")
    ) {
      toast.error(
        "Network connection issue detected. Please check your internet connection.",
      );
    } else if (classified.type === "auth") {
      toast.error(
        "Authentication error. Please refresh the page and log in again.",
      );
    }

    // Prevent the default browser error handling
    event.preventDefault();
  });

  // Handle global errors
  window.addEventListener("error", (event) => {
    console.error("🚨 Global error:", event.error);
    logError("globalError", event.error);
  });
};

// Setup error handlers when module loads
setupGlobalErrorHandlers();

// Placeholder components for other routes
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="p-6 max-w-7xl mx-auto">
    <div className="text-center py-20">
      <h1 className="text-3xl font-bold text-foreground mb-4">{title}</h1>
      <p className="text-muted-foreground">This page is under development.</p>
    </div>
  </div>
);

// Auth redirect component
const AuthRedirect = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on user role
  switch (user?.role) {
    case "super_admin":
      return <Navigate to="/super-admin/dashboard" replace />;
    case "edu_admin":
      return <Navigate to="/edu-admin/dashboard" replace />;
    case "student":
      return <Navigate to="/student/dashboard" replace />;
    default:
      return <Navigate to="/" replace />;
  }
};

function AppRoutes() {
  const location = useLocation();
  
  // Check if current route is a test-taking route
  const isTestTakingRoute = location.pathname.includes('/student/test/') && 
    (location.pathname.includes('/listening') || 
     location.pathname.includes('/reading') || 
     location.pathname.includes('/writing') ||
     location.pathname.includes('/TakeTestNew'));

  const Layout = isTestTakingRoute ? TestLayout : AppLayout;

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public Routes */}
          <Route
            path="/"
            element={
              <FadeTransition>
                <Index />
              </FadeTransition>
            }
          />
          <Route
            path="/login"
            element={
              <SlideTransition>
                <Login />
              </SlideTransition>
            }
          />
          <Route
            path="/signup"
            element={
              <SlideTransition>
                <Signup />
              </SlideTransition>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <SlideTransition>
                <ForgotPassword />
              </SlideTransition>
            }
          />
          <Route
            path="/reset-password"
            element={
              <SlideTransition>
                <ResetPassword />
              </SlideTransition>
            }
          />

          {/* Auth redirect route */}
          <Route path="/dashboard" element={<AuthRedirect />} />

          {/* Profile route (for all authenticated users) */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Test Editor Demo */}
          <Route path="/test-editor" element={<TestEditorPage />} />

          {/* Student Routes */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <PageTransition>
                  <StudentDashboard />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/test-history"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <PageTransition>
                  <TestHistory />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/tests"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentTests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/tests/history"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <TestHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/test/:testId"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <TestStart />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/test/:testId/listening"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <PageTransition>
                  <ListeningTestTaking />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/test-results/:submissionId"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <TestResults />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/available-tests"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <AvailableTests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/test/:testId/reading"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <TakeReadingExam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/test/:testId/writing"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <TakeWritingTest />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/profile"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <PlaceholderPage title="Student Profile" />
              </ProtectedRoute>
            }
          />

          {/* Edu Admin Routes */}
          <Route
            path="/edu-admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <PageTransition>
                  <EduAdminDashboard />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/tests"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <PlaceholderPage title="Manage Tests" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/tests/create"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <CreateTestNew />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/tests/create/advanced"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <CreateTestAdvanced />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/tests/create/advanced/:testId"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <CreateIELTSTest />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/tests/create/reading/:testId"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <CreateReadingNew />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/tests/create/reading/:testId/:passageNumber"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <CreateReadingNew />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/tests/create/listening/:testId"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <CreateListeningNew />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/tests/create/listening/:testId/:sectionNumber"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <CreateListeningNew />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/tests/create/writing/:testId"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <CreateWritingNew />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/tests/create/writing/:testId/:taskNumber"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <CreateWritingNew />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/requests"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <TestRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/submissions"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <TestSubmissions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/grade/:submissionId"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <TestGrading />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edu-admin/profile"
            element={
              <ProtectedRoute allowedRoles={["edu_admin"]}>
                <PlaceholderPage title="Edu Admin Profile" />
              </ProtectedRoute>
            }
          />

          {/* Super Admin Routes */}
          <Route
            path="/super-admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={["super_admin"]}>
                <PageTransition>
                  <SuperAdminDashboard />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/edu-centers"
            element={
              <ProtectedRoute allowedRoles={["super_admin"]}>
                <EduCenters />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/admins"
            element={
              <ProtectedRoute allowedRoles={["super_admin"]}>
                <Admins />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/users"
            element={
              <ProtectedRoute allowedRoles={["super_admin"]}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/tests"
            element={
              <ProtectedRoute allowedRoles={["super_admin"]}>
                <PlaceholderPage title="All Platform Tests" />
              </ProtectedRoute>
            }
          />

          {/* Exam Route (for all authenticated users) */}
          <Route
            path="/exam/:id"
            element={
              <ProtectedRoute>
                <PlaceholderPage title="IELTS Exam Interface" />
              </ProtectedRoute>
            }
          />

          {/* Catch all route */}
          <Route
            path="*"
            element={
              <FadeTransition>
                <NotFound />
              </FadeTransition>
            }
          />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

createRoot(document.getElementById("root")!).render(<App />);
