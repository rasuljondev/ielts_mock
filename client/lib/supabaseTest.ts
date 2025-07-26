import { supabase, isDemoMode } from './supabase';

export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log('🔍 Testing Supabase connection...');
    console.log('📊 Demo mode:', isDemoMode());
    console.log('🔗 URL:', import.meta.env.VITE_SUPABASE_URL);
    
    // Test 1: Basic connectivity
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('tests')
      .select('id')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      console.error('❌ Supabase test failed:', error);

      // Check for browser extension interference first
      const isExtensionError = error.details?.includes('chrome-extension://') ||
                              error.message?.includes('chrome-extension://') ||
                              (error.message?.includes('Failed to fetch') &&
                               error.details?.includes('chrome-extension://'));

      if (isExtensionError) {
        return {
          success: false,
          message: `🔌 Browser Extension Interference: A browser extension is blocking network requests to Supabase.`,
          details: {
            error: error.message,
            solution: "Try incognito mode or disable browser extensions",
            extensionInfo: "Check console for chrome-extension:// URLs",
            isDemoMode: isDemoMode()
          }
        };
      }

      // Specific error analysis
      if (error.message?.includes('Failed to fetch')) {
        return {
          success: false,
          message: `Network Error: Cannot reach Supabase server. Possible browser extension interference.`,
          details: {
            error: error.message,
            url: import.meta.env.VITE_SUPABASE_URL,
            responseTime: `${responseTime}ms`,
            suggestion: "Try incognito mode to rule out extension interference",
            isDemoMode: isDemoMode()
          }
        };
      }
      
      if (error.message?.includes('JWT')) {
        return {
          success: false,
          message: `Authentication Error: Invalid Supabase credentials. Check your VITE_SUPABASE_ANON_KEY.`,
          details: {
            error: error.message,
            keyPreview: import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...',
            isDemoMode: isDemoMode()
          }
        };
      }
      
      if (error.code === 'PGRST301') {
        return {
          success: false,
          message: `Database Access Error: Row Level Security (RLS) is blocking access. Check your RLS policies.`,
          details: {
            error: error.message,
            code: error.code,
            isDemoMode: isDemoMode()
          }
        };
      }
      
      return {
        success: false,
        message: `Database Error: ${error.message}`,
        details: {
          error,
          isDemoMode: isDemoMode()
        }
      };
    }
    
    console.log('✅ Supabase connection successful');
    return {
      success: true,
      message: `Connection successful! Found ${data?.length || 0} test records. Response time: ${responseTime}ms`,
      details: {
        recordCount: data?.length || 0,
        responseTime: `${responseTime}ms`,
        isDemoMode: isDemoMode(),
        url: import.meta.env.VITE_SUPABASE_URL
      }
    };
    
  } catch (error: any) {
    console.error('🚨 Unexpected error testing Supabase:', error);
    
    if (error.name === 'TypeError' && error.message?.includes('Failed to fetch')) {
      return {
        success: false,
        message: `Network Error: Cannot reach ${import.meta.env.VITE_SUPABASE_URL}. Check your internet connection.`,
        details: {
          error: error.message,
          type: error.name,
          isDemoMode: isDemoMode()
        }
      };
    }
    
    return {
      success: false,
      message: `Unexpected Error: ${error.message || 'Unknown error occurred'}`,
      details: {
        error,
        isDemoMode: isDemoMode()
      }
    };
  }
}

export async function testSupabaseAuth(): Promise<{
  success: boolean;
  message: string;
  user?: any;
}> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      return {
        success: false,
        message: `Auth Error: ${error.message}`
      };
    }
    
    return {
      success: true,
      message: user ? `Authenticated as: ${user.email}` : 'No user authenticated',
      user
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Auth Test Failed: ${error.message}`
    };
  }
}
