/**
 * Utility to detect common browser extensions that might interfere with network requests
 */

export interface ExtensionInfo {
  name: string;
  detected: boolean;
  interference: 'high' | 'medium' | 'low';
  description: string;
  solution: string;
}

export function detectBrowserExtensions(): ExtensionInfo[] {
  const extensions: ExtensionInfo[] = [];

  // Check for common ad blockers and privacy extensions
  const checks = [
    {
      name: 'uBlock Origin',
      check: () => typeof (window as any).uBO !== 'undefined' || 
                   document.querySelector('meta[name="ublock-user-stylesheet"]') !== null,
      interference: 'high' as const,
      description: 'Popular ad blocker that may block API requests',
      solution: 'Whitelist this domain or disable temporarily'
    },
    {
      name: 'AdBlock Plus',
      check: () => typeof (window as any).AdblockPlus !== 'undefined' ||
                   typeof (window as any).ext_abp !== 'undefined',
      interference: 'high' as const,
      description: 'Ad blocker that may interfere with network requests',
      solution: 'Add exception for this site'
    },
    {
      name: 'Privacy Badger',
      check: () => typeof (window as any).PRIVACY_BADGER !== 'undefined',
      interference: 'medium' as const,
      description: 'Privacy extension that blocks tracking requests',
      solution: 'Whitelist this domain'
    },
    {
      name: 'Ghostery',
      check: () => typeof (window as any).ghostery !== 'undefined' ||
                   typeof (window as any).Ghostery !== 'undefined',
      interference: 'medium' as const,
      description: 'Privacy extension that blocks trackers',
      solution: 'Add site to trusted list'
    },
    {
      name: 'NoScript',
      check: () => typeof (window as any).noscriptStorage !== 'undefined',
      interference: 'high' as const,
      description: 'Script blocker that may prevent API calls',
      solution: 'Allow scripts for this domain'
    },
    {
      name: 'Disconnect',
      check: () => typeof (window as any).disconnect !== 'undefined',
      interference: 'medium' as const,
      description: 'Privacy tool that blocks tracking requests',
      solution: 'Whitelist this site'
    }
  ];

  checks.forEach(({ name, check, interference, description, solution }) => {
    try {
      const detected = check();
      extensions.push({
        name,
        detected,
        interference,
        description,
        solution
      });
    } catch (error) {
      // Extension check failed, assume not present
      extensions.push({
        name,
        detected: false,
        interference,
        description,
        solution
      });
    }
  });

  return extensions;
}

export function getExtensionWarnings(): string[] {
  const extensions = detectBrowserExtensions();
  const warnings: string[] = [];

  const detected = extensions.filter(ext => ext.detected);
  
  if (detected.length > 0) {
    warnings.push('🔌 Browser extensions detected that may interfere with network requests:');
    
    detected.forEach(ext => {
      const riskLevel = ext.interference === 'high' ? '🔴' : 
                       ext.interference === 'medium' ? '🟡' : '🟢';
      warnings.push(`${riskLevel} ${ext.name}: ${ext.description}`);
      warnings.push(`   💡 Solution: ${ext.solution}`);
    });
    
    warnings.push('');
    warnings.push('🎯 Quick test: Try incognito/private browsing mode');
  }

  return warnings;
}

export function logExtensionInfo(): void {
  const extensions = detectBrowserExtensions();
  const detected = extensions.filter(ext => ext.detected);
  
  if (detected.length > 0) {
    console.group('🔌 Browser Extensions Detected');
    detected.forEach(ext => {
      console.log(`${ext.name}: ${ext.description}`);
      console.log(`  Risk: ${ext.interference}, Solution: ${ext.solution}`);
    });
    console.groupEnd();
  } else {
    console.log('✅ No known problematic browser extensions detected');
  }
}

export function checkForExtensionError(error: any): boolean {
  if (!error) return false;
  
  const errorString = JSON.stringify(error);
  const stack = error.stack || '';
  const message = error.message || '';
  
  return errorString.includes('chrome-extension://') ||
         stack.includes('chrome-extension://') ||
         message.includes('chrome-extension://') ||
         errorString.includes('moz-extension://') ||
         stack.includes('moz-extension://');
}
