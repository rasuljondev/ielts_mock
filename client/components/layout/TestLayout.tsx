import React from "react";
import { TestingHelper } from "@/components/ui/testing-helper";

interface TestLayoutProps {
  children: React.ReactNode;
}

export const TestLayout: React.FC<TestLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* No Navigation for test-taking pages */}
      <main>{children}</main>

      {/* Testing Helper - Remove in production */}
      {process.env.NODE_ENV === 'development' && <TestingHelper />}
    </div>
  );
}; 