import { supabase, isDemoMode } from "./supabase";
import { toast } from "sonner";

/**
 * Safely extract error message from any error object
 */
function getErrorMessage(error: any): string {
  if (!error) return "Unknown error";

  if (typeof error === "string") {
    return error;
  }

  // Supabase errors often have specific formats
  if (error.message) {
    return error.message;
  }

  if (error.error) {
    if (typeof error.error === "string") {
      return error.error;
    }
    if (error.error.message) {
      return error.error.message;
    }
    try {
      return JSON.stringify(error.error);
    } catch {}
  }

  // Check for Supabase-specific error fields
  if (error.statusCode && error.statusText) {
    return `${error.statusCode}: ${error.statusText}`;
  }

  if (error.code) {
    return `Error code: ${error.code}`;
  }

  if (error.details) {
    return error.details;
  }

  if (error.hint) {
    return error.hint;
  }

  if (error.toString && typeof error.toString === "function") {
    try {
      const str = error.toString();
      if (str !== "[object Object]") {
        return str;
      }
    } catch {}
  }

  // Last resort: try to stringify with all keys
  try {
    const keys = Object.keys(error);
    if (keys.length > 0) {
      return `Error object with keys: ${keys.join(", ")}. Values: ${JSON.stringify(error)}`;
    }
    return JSON.stringify(error);
  } catch {
    return "Unknown error (could not stringify)";
  }
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload audio file to Supabase storage - simplified approach like profile images
 */
export async function uploadAudioFile(file: File): Promise<UploadResult> {
  console.log(
    "uploadAudioFile: Starting upload for",
    file.name,
    "Size:",
    file.size,
    "Type:",
    file.type,
  );

  // Check if we're in demo mode first
  if (isDemoMode()) {
    console.log("uploadAudioFile: Demo mode detected, using local URL");
    return {
      success: true,
      url: URL.createObjectURL(file),
    };
  }

  try {
    // Check file size (100MB limit for test-files bucket)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum allowed size of 100MB`,
      };
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const fileName = `audio/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    console.log("uploadAudioFile: Generated filename", fileName);

    // Direct upload to test-files bucket (for admin test content)
    const { error: uploadError } = await supabase.storage
      .from("test-files")
      .upload(fileName, file, { upsert: false });

    if (uploadError) {
      console.error("uploadAudioFile: Upload error:", uploadError);
      return {
        success: false,
        error: getErrorMessage(uploadError),
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("test-files")
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return {
        success: false,
        error: "Failed to get public URL",
      };
    }

    console.log("uploadAudioFile: Success, URL:", urlData.publicUrl);
    return {
      success: true,
      url: urlData.publicUrl,
    };
  } catch (error: any) {
    console.error("uploadAudioFile: Caught exception:", error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Upload image file to Supabase storage - simplified approach
 */
export async function uploadImageFile(file: File): Promise<UploadResult> {
  try {
    // Check file size (100MB limit for test-files bucket)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum allowed size of 100MB`,
      };
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const fileName = `images/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    console.log("uploadImageFile: Using bucket 'test-files'");

    // Direct upload to test-files bucket (for admin test content)
    const { error: uploadError } = await supabase.storage
      .from("test-files")
      .upload(fileName, file, { upsert: false });

    if (uploadError) {
      console.error("uploadImageFile: Upload error:", uploadError);
      return {
        success: false,
        error: getErrorMessage(uploadError),
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("test-files")
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return {
        success: false,
        error: "Failed to get public URL",
      };
    }

    return {
      success: true,
      url: urlData.publicUrl,
    };
  } catch (error: any) {
    console.error("Image upload error:", error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Upload any file to Supabase storage - NO local fallback
 */
export async function uploadFile(
  file: File,
  type: "audio" | "image",
): Promise<string> {
  if (isDemoMode()) {
    console.warn("Running in demo mode - files will be stored locally");
    toast.info(
      `${type.charAt(0).toUpperCase() + type.slice(1)} stored locally (demo mode - configure Supabase for cloud storage)`,
    );
    return URL.createObjectURL(file);
  }

  const uploadFn = type === "audio" ? uploadAudioFile : uploadImageFile;

  console.log(`Attempting to upload ${type} to Supabase...`);
  const result = await uploadFn(file);

  if (result.success && result.url) {
    toast.success(
      `${type.charAt(0).toUpperCase() + type.slice(1)} uploaded to cloud storage successfully!`,
    );
    return result.url;
  } else {
    // Upload failed - show error and throw exception
    const errorMessage = result.error || "Unknown upload error";
    console.error(`${type} upload failed:`, errorMessage);
    toast.error(
      `${type.charAt(0).toUpperCase() + type.slice(1)} upload failed: ${errorMessage}`,
    );
    throw new Error(`Upload failed: ${errorMessage}`);
  }
}
