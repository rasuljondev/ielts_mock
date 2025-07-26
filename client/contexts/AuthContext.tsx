import React, { createContext, useContext, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import type { User, UserRole } from "@/types/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { user, loading, isAuthenticated, fetchUser } = useAuthStore();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await fetchUser();
      } catch (error) {
        console.error("AuthContext: Failed to fetch user:", error);
        // Don't let auth errors break the entire app
        // Set to unauthenticated state if there's an error
      }
    };

    initializeAuth();
  }, [fetchUser]);

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    hasRole,
    hasAnyRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
