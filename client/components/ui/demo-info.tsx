import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { isDemoMode } from "@/lib/supabase";

export const DemoModeInfo: React.FC = () => {
  if (!isDemoMode()) {
    return null;
  }

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800">
        <strong>Demo Mode:</strong> You're running in demo mode. Use{" "}
        <code className="bg-blue-100 px-1 rounded text-sm">
          demo@example.com
        </code>{" "}
        /<code className="bg-blue-100 px-1 rounded text-sm">demo123</code> to
        login. Database features are simulated locally.
      </AlertDescription>
    </Alert>
  );
};
