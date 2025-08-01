import React from "react";
import { Navigation } from "@/components/ui/navigation";
import { TestingHelper } from "@/components/ui/testing-helper";

interface AppLayoutProps {
  children: React.ReactNode;
  hideNavigation?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, hideNavigation = false }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {!hideNavigation && <Navigation />}
      <main>{children}</main>

      {/* Testing Helper - Remove in production */}
      {process.env.NODE_ENV === 'development' && <TestingHelper />}
    </div>
  );
};
