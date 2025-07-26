import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  AlertCircle,
  Database,
} from "lucide-react";
import {
  setupStorageBuckets,
  verifyStorageBuckets,
  getStorageStatus,
  fixStorageBuckets,
  BUCKET_CONFIG,
} from "@/lib/bucketSetup";
import { toast } from "sonner";

interface StorageStatus {
  buckets: Record<
    string,
    {
      exists: boolean;
      config?: any;
      error?: string;
    }
  >;
  summary: {
    total: number;
    existing: number;
    missing: number;
  };
}

export const StorageSetup: React.FC = () => {
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [setupInProgress, setSetupInProgress] = useState(false);

  const loadStorageStatus = async () => {
    setLoading(true);
    try {
      const status = await getStorageStatus();
      setStorageStatus(status);
    } catch (error) {
      console.error("Error loading storage status:", error);
      toast.error("Failed to load storage status");
    } finally {
      setLoading(false);
    }
  };

  const handleSetupBuckets = async () => {
    setSetupInProgress(true);
    try {
      const result = await setupStorageBuckets();

      if (result.success) {
        toast.success("All storage buckets set up successfully!");
      } else {
        toast.warning(`Setup completed with ${result.failed.length} failures`);
      }

      // Reload status
      await loadStorageStatus();
    } catch (error) {
      console.error("Error setting up buckets:", error);
      toast.error("Failed to set up storage buckets");
    } finally {
      setSetupInProgress(false);
    }
  };

  const handleFixBuckets = async () => {
    setSetupInProgress(true);
    try {
      const success = await fixStorageBuckets();

      if (success) {
        toast.success("Storage issues fixed successfully!");
      } else {
        toast.warning("Some issues could not be fixed automatically");
      }

      // Reload status
      await loadStorageStatus();
    } catch (error) {
      console.error("Error fixing buckets:", error);
      toast.error("Failed to fix storage issues");
    } finally {
      setSetupInProgress(false);
    }
  };

  const getBucketStatusColor = (exists: boolean) => {
    return exists ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
  };

  const getBucketStatusIcon = (exists: boolean) => {
    return exists ? (
      <CheckCircle className="h-4 w-4" />
    ) : (
      <XCircle className="h-4 w-4" />
    );
  };

  useEffect(() => {
    loadStorageStatus();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Storage Configuration
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage Supabase storage buckets for the IELTS platform
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              onClick={loadStorageStatus}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh Status
            </Button>
            <Button
              onClick={handleSetupBuckets}
              disabled={setupInProgress}
              size="sm"
            >
              <Settings className="h-4 w-4 mr-2" />
              {setupInProgress ? "Setting up..." : "Setup Buckets"}
            </Button>
            <Button
              onClick={handleFixBuckets}
              disabled={setupInProgress}
              variant="secondary"
              size="sm"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              {setupInProgress ? "Fixing..." : "Fix Issues"}
            </Button>
          </div>

          {storageStatus && (
            <div className="space-y-4">
              {/* Summary */}
              <Alert
                className={
                  storageStatus.summary.missing === 0
                    ? "border-green-500 bg-green-50"
                    : "border-orange-500 bg-orange-50"
                }
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {storageStatus.summary.missing === 0 ? (
                    <span className="text-green-700">
                      ✅ All {storageStatus.summary.total} storage buckets are
                      configured correctly
                    </span>
                  ) : (
                    <span className="text-orange-700">
                      ⚠️ {storageStatus.summary.missing} of{" "}
                      {storageStatus.summary.total} buckets are missing
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              {/* Bucket Details */}
              <div className="grid gap-3">
                <h4 className="font-medium">Bucket Status</h4>
                {Object.entries(storageStatus.buckets).map(
                  ([bucketName, status]) => (
                    <div
                      key={bucketName}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-1 rounded ${getBucketStatusColor(status.exists)}`}
                        >
                          {getBucketStatusIcon(status.exists)}
                        </div>
                        <div>
                          <h5 className="font-medium">{bucketName}</h5>
                          <p className="text-sm text-muted-foreground">
                            {BUCKET_CONFIG[
                              bucketName as keyof typeof BUCKET_CONFIG
                            ]?.fileSizeLimit
                              ? `Max size: ${Math.round(BUCKET_CONFIG[bucketName as keyof typeof BUCKET_CONFIG].fileSizeLimit! / 1024 / 1024)}MB`
                              : "Configuration available"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getBucketStatusColor(status.exists)}>
                          {status.exists ? "Ready" : "Missing"}
                        </Badge>
                        {status.error && (
                          <p className="text-xs text-red-600 mt-1 max-w-xs">
                            {status.error}
                          </p>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>

              {/* Configuration Details */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  View Bucket Configuration Details
                </summary>
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(BUCKET_CONFIG, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading storage status...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <h4 className="font-medium">Quick Setup</h4>
            <p className="text-muted-foreground">
              Click "Setup Buckets" to automatically create all required storage
              buckets.
            </p>
          </div>

          <div>
            <h4 className="font-medium">Manual Setup</h4>
            <p className="text-muted-foreground">
              If automatic setup fails, you can create buckets manually in your
              Supabase dashboard:
            </p>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-muted-foreground">
              <li>Go to Storage in your Supabase dashboard</li>
              <li>Create a bucket named "test-files" with public access</li>
              <li>Set file size limit to 100MB</li>
              <li>
                Add MIME types: audio/*, image/*, video/*, application/pdf
              </li>
              <li>
                Repeat for "profile-images" and "edu-center-logos" buckets
              </li>
            </ol>
          </div>

          <div>
            <h4 className="font-medium">Troubleshooting</h4>
            <p className="text-muted-foreground">
              If you're still getting "Bucket not found" errors:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>
                Verify your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are
                correct
              </li>
              <li>Check that your Supabase project has Storage enabled</li>
              <li>Ensure your API key has sufficient permissions</li>
              <li>Try running the SQL script: setup_storage_buckets.sql</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
