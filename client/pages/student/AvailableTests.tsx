import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { supabase } from '../../lib/supabase';
import { Clock, BookOpen, Play, CheckCircle } from 'lucide-react';

interface Test {
  id: string;
  title: string;
  description: string;
  type: string;
  duration_minutes: number;
  created_at: string;
  status: string;
}

export default function AvailableTests() {
  const [tests, setTests] = useState<Test[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadAvailableTests();
  }, []);

  const loadAvailableTests = async () => {
    setIsLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('tests')
        .select('*')
        .eq('type', 'listening')
        .eq('status', 'draft')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setTests(data || []);
    } catch (err) {
      console.error('Load tests error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tests');
    } finally {
      setIsLoading(false);
    }
  };

  const startTest = (testId: string) => {
    navigate(`/student/listening-test/${testId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4">Loading available tests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Available Listening Tests</h1>
        <p className="text-gray-600">
          Choose a test to practice your IELTS listening skills
        </p>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {tests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Tests Available</h3>
            <p className="text-gray-600 mb-4">
              There are currently no listening tests available for practice.
            </p>
            <p className="text-sm text-gray-500">
              Contact your instructor or check back later for new tests.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {tests.map((test) => (
            <Card key={test.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{test.title}</CardTitle>
                    <p className="text-gray-600">{test.description}</p>
                  </div>
                  <Badge variant="outline" className="ml-4">
                    {test.type.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{test.duration_minutes || 60} minutes</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <BookOpen className="h-4 w-4" />
                      <span>Created {formatDate(test.created_at)}</span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => startTest(test.id)}
                    className="flex items-center space-x-2"
                  >
                    <Play className="h-4 w-4" />
                    <span>Start Test</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <div className="mt-8 text-center">
        <Button variant="outline" onClick={() => navigate('/student/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
