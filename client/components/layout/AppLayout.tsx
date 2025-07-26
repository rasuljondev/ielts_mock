import React from "react";
import { Navigation } from "@/components/ui/navigation";
import { TestingHelper } from "@/components/ui/testing-helper";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main>{children}</main>

      {/* Testing Helper - Remove in production */}
      {process.env.NODE_ENV === 'development' && <TestingHelper />}
    </div>
  );
};
