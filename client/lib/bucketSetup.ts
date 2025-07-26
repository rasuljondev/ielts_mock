import { supabase } from "./supabase";
import { toast } from "sonner";

/**
 * Storage bucket configuration
 */
export const BUCKET_CONFIG = {
  "test-files": {
    public: true,
    allowedMimeTypes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/m4a",
      "audio/aac",
      "audio/ogg",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    fileSizeLimit: 104857600, // 100MB
  },
  "profile-images": {
    public: true,
    allowedMimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ],
    fileSizeLimit: 10485760, // 10MB
  },
  "edu-center-logos": {
    public: true,
    allowedMimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ],
    fileSizeLimit: 5242880, // 5MB
  },
} as const;

/**
 * Check if a bucket exists
 */
export async function checkBucketExists(bucketName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.getBucket(bucketName);
    return !error && !!data;
  } catch (error) {
    console.warn(`Error checking bucket ${bucketName}:`, error);
    return false;
  }
}

/**
 * Create a storage bucket with the specified configuration
 */
export async function createBucket(bucketName: string): Promise<boolean> {
  try {
    const config = BUCKET_CONFIG[bucketName as keyof typeof BUCKET_CONFIG];
    if (!config) {
      console.error(`No configuration found for bucket: ${bucketName}`);
      return false;
    }

    console.log(`Creating bucket: ${bucketName}...`);

    const { error } = await supabase.storage.createBucket(bucketName, config);

    if (error) {
      // If bucket already exists, that's fine
      if (error.message?.includes("already exists")) {
        console.log(`Bucket ${bucketName} already exists`);
        return true;
      }

      console.error(`Error creating bucket ${bucketName}:`, error);
      return false;
    }

    console.log(`Bucket ${bucketName} created successfully`);
    return true;
  } catch (error) {
    console.error(`Failed to create bucket ${bucketName}:`, error);
    return false;
  }
}

/**
 * Setup all required storage buckets
 */
export async function setupStorageBuckets(): Promise<{
  success: boolean;
  created: string[];
  failed: string[];
}> {
  const bucketNames = Object.keys(BUCKET_CONFIG);
  const created: string[] = [];
  const failed: string[] = [];

  console.log("Setting up storage buckets...");

  for (const bucketName of bucketNames) {
    try {
      // Check if bucket exists first
      const exists = await checkBucketExists(bucketName);

      if (exists) {
        console.log(`Bucket ${bucketName} already exists`);
        created.push(bucketName);
        continue;
      }

      // Try to create the bucket
      const success = await createBucket(bucketName);

      if (success) {
        created.push(bucketName);
      } else {
        failed.push(bucketName);
      }
    } catch (error) {
      console.error(`Error setting up bucket ${bucketName}:`, error);
      failed.push(bucketName);
    }
  }

  const success = failed.length === 0;

  if (success) {
    console.log("✅ All storage buckets set up successfully");
    toast.success("Storage buckets configured successfully");
  } else {
    console.warn(`⚠️ Some buckets failed to create: ${failed.join(", ")}`);
    toast.warning(
      `Some storage buckets failed to create: ${failed.join(", ")}`,
    );
  }

  return { success, created, failed };
}

/**
 * Verify that all required buckets exist
 */
export async function verifyStorageBuckets(): Promise<{
  allExist: boolean;
  existing: string[];
  missing: string[];
}> {
  const bucketNames = Object.keys(BUCKET_CONFIG);
  const existing: string[] = [];
  const missing: string[] = [];

  for (const bucketName of bucketNames) {
    const exists = await checkBucketExists(bucketName);
    if (exists) {
      existing.push(bucketName);
    } else {
      missing.push(bucketName);
    }
  }

  const allExist = missing.length === 0;

  console.log("Storage bucket verification:", {
    allExist,
    existing,
    missing,
  });

  return { allExist, existing, missing };
}

/**
 * Attempt to fix bucket issues by creating missing buckets
 */
export async function fixStorageBuckets(): Promise<boolean> {
  try {
    console.log("Attempting to fix storage bucket issues...");

    // First verify what's missing
    const { allExist, missing } = await verifyStorageBuckets();

    if (allExist) {
      console.log("All buckets exist, no fixes needed");
      return true;
    }

    console.log(`Missing buckets: ${missing.join(", ")}`);

    // Try to create missing buckets
    let allFixed = true;
    for (const bucketName of missing) {
      const success = await createBucket(bucketName);
      if (!success) {
        allFixed = false;
      }
    }

    if (allFixed) {
      console.log("✅ All bucket issues fixed");
      toast.success("Storage configuration fixed successfully");
    } else {
      console.warn("⚠️ Some bucket issues could not be fixed automatically");
      toast.warning("Some storage issues require manual intervention");
    }

    return allFixed;
  } catch (error) {
    console.error("Error fixing storage buckets:", error);
    toast.error("Failed to fix storage configuration");
    return false;
  }
}

/**
 * Get storage bucket status for debugging
 */
export async function getStorageStatus(): Promise<{
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
}> {
  const bucketNames = Object.keys(BUCKET_CONFIG);
  const buckets: Record<string, any> = {};
  let existing = 0;

  for (const bucketName of bucketNames) {
    try {
      const { data, error } = await supabase.storage.getBucket(bucketName);

      if (error) {
        buckets[bucketName] = {
          exists: false,
          error: error.message,
        };
      } else {
        buckets[bucketName] = {
          exists: true,
          config: data,
        };
        existing++;
      }
    } catch (error) {
      buckets[bucketName] = {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    buckets,
    summary: {
      total: bucketNames.length,
      existing,
      missing: bucketNames.length - existing,
    },
  };
}
