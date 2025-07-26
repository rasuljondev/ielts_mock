import React, { useState } from 'react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { supabase } from '../../lib/supabase';
import { Wrench, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface DebugResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export function DebugHelper() {
  const [results, setResults] = useState<DebugResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const testResults: DebugResult[] = [];

    // Test 1: Authentication
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        testResults.push({
          test: 'Authentication',
          status: 'error',
          message: 'Not authenticated',
          details: authError
        });
      } else {
        testResults.push({
          test: 'Authentication',
          status: 'success',
          message: `Authenticated as ${authData.user.email}`,
          details: { userId: authData.user.id }
        });
      }
    } catch (err) {
      testResults.push({
        test: 'Authentication',
        status: 'error',
        message: 'Auth check failed',
        details: err
      });
    }

    // Test 2: Database Connection
    try {
      const { data, error } = await supabase.from('tests').select('id').limit(1);
      if (error) {
        testResults.push({
          test: 'Database Connection',
          status: 'error',
          message: 'Database connection failed',
          details: error
        });
      } else {
        testResults.push({
          test: 'Database Connection',
          status: 'success',
          message: 'Database accessible',
          details: { recordCount: data?.length || 0 }
        });
      }
    } catch (err) {
      testResults.push({
        test: 'Database Connection',
        status: 'error',
        message: 'Database connection error',
        details: err
      });
    }

    // Test 3: User Profile
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profileError) {
          testResults.push({
            test: 'User Profile',
            status: 'warning',
            message: 'Profile not found or inaccessible',
            details: profileError
          });
        } else {
          testResults.push({
            test: 'User Profile',
            status: 'success',
            message: `Profile found for ${profile.role}`,
            details: { role: profile.role, eduCenter: profile.edu_center_id }
          });
        }
      }
    } catch (err) {
      testResults.push({
        test: 'User Profile',
        status: 'error',
        message: 'Profile check failed',
        details: err
      });
    }

    // Test 4: Tests Table Access
    try {
      const { error } = await supabase
        .from('tests')
        .insert({
          title: 'TEST_DIAGNOSTIC_DELETE_ME',
          type: 'listening',
          status: 'draft',
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) {
        testResults.push({
          test: 'Tests Table Write',
          status: 'error',
          message: 'Cannot write to tests table',
          details: error
        });
      } else {
        // Clean up test record
        await supabase
          .from('tests')
          .delete()
          .eq('title', 'TEST_DIAGNOSTIC_DELETE_ME');

        testResults.push({
          test: 'Tests Table Write',
          status: 'success',
          message: 'Can write to tests table',
          details: 'Test record created and cleaned up'
        });
      }
    } catch (err) {
      testResults.push({
        test: 'Tests Table Write',
        status: 'error',
        message: 'Tests table write failed',
        details: err
      });
    }

    // Test 5: Listening Sections Table Access
    try {
      const { data, error } = await supabase
        .from('listening_sections')
        .select('id')
        .limit(1);

      if (error) {
        testResults.push({
          test: 'Listening Sections Table',
          status: 'error',
          message: 'Cannot access listening_sections table',
          details: error
        });
      } else {
        testResults.push({
          test: 'Listening Sections Table',
          status: 'success',
          message: 'Listening sections table accessible'
        });
      }
    } catch (err) {
      testResults.push({
        test: 'Listening Sections Table',
        status: 'error',
        message: 'Listening sections table check failed',
        details: err
      });
    }

    setResults(testResults);
    setIsRunning(false);
  };

  const getStatusIcon = (status: DebugResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: DebugResult['status']) => {
    switch (status) {
      case 'success': return 'border-green-500 bg-green-50';
      case 'error': return 'border-red-500 bg-red-50';
      case 'warning': return 'border-yellow-500 bg-yellow-50';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Test Save Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button onClick={runDiagnostics} disabled={isRunning} className="w-full">
            {isRunning ? 'Running Diagnostics...' : 'Run Diagnostics'}
          </Button>

          {results.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Diagnostic Results:</h3>
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border-l-4 ${getStatusColor(result.status)}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{result.test}</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <Badge 
                        variant={result.status === 'success' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {result.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{result.message}</p>
                  {result.details && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer">
                        View Details
                      </summary>
                      <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {results.some(r => r.status === 'error') && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <h4 className="font-medium text-red-800 mb-2">Issues Found:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {results
                  .filter(r => r.status === 'error')
                  .map((result, index) => (
                    <li key={index}>• {result.test}: {result.message}</li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
