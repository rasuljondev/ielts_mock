import { supabase } from "./supabase";
import { retryWithBackoff, classifyError, logError } from "./errorUtils";

// Enhanced Supabase client wrapper with automatic retry logic
export class EnhancedSupabaseClient {
  private client = supabase;

  // Auth operations with retry
  async getUser() {
    return retryWithBackoff(
      async () => {
        const { data, error } = await this.client.auth.getUser();
        if (error) {
          // Don't retry for auth session missing - it's a normal state
          if (error.message?.includes("Auth session missing")) {
            return { user: null, session: null };
          }
          throw error;
        }
        return data;
      },
      3,
      1000,
    );
  }

  async signInWithPassword(credentials: { email: string; password: string }) {
    return retryWithBackoff(
      async () => {
        const { data, error } =
          await this.client.auth.signInWithPassword(credentials);
        if (error) throw error;
        return data;
      },
      2,
      1000,
    );
  }

  async signOut() {
    return retryWithBackoff(
      async () => {
        const { error } = await this.client.auth.signOut();
        if (error) throw error;
      },
      2,
      1000,
    );
  }

  // Database operations with retry
  async select(table: string, query: string, filters?: any) {
    return retryWithBackoff(
      async () => {
        let queryBuilder = this.client.from(table).select(query);

        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            queryBuilder = queryBuilder.eq(key, value);
          });
        }

        const { data, error } = await queryBuilder;
        if (error) throw error;
        return data;
      },
      3,
      1000,
    );
  }

  async insert(table: string, data: any) {
    return retryWithBackoff(
      async () => {
        const { data: result, error } = await this.client
          .from(table)
          .insert(data)
          .select()
          .single();
        if (error) throw error;
        return result;
      },
      3,
      1000,
    );
  }

  async update(table: string, data: any, filters: any) {
    return retryWithBackoff(
      async () => {
        let queryBuilder = this.client.from(table).update(data);

        Object.entries(filters).forEach(([key, value]) => {
          queryBuilder = queryBuilder.eq(key, value);
        });

        const { data: result, error } = await queryBuilder;
        if (error) throw error;
        return result;
      },
      3,
      1000,
    );
  }

  // Direct access to original client for complex operations
  get raw() {
    return this.client;
  }
}

// Create and export enhanced client instance
export const enhancedSupabase = new EnhancedSupabaseClient();

// Safe operation wrapper with better error handling
export const safeSupabaseOperation = async <T>(
  operation: () => Promise<T>,
  fallback?: T,
  context?: string,
): Promise<T | undefined> => {
  try {
    return await operation();
  } catch (error) {
    const classified = classifyError(error);

    if (context) {
      logError(context, error);
    }

    // For auth errors, show specific message
    if (classified.type === "auth") {
      console.warn("🔐 Auth error in", context, "- user may need to re-login");
    }

    // For network errors, show connectivity message
    if (classified.type === "network") {
      console.warn("🌐 Network error in", context, "- retrying may help");
    }

    return fallback;
  }
};
