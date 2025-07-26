import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { BracketParser } from '../../lib/bracketParser';
import { supabase } from '../../lib/supabase';

interface TestSubmission {
  id: string;
  test_id: string;
  score: number;
  time_spent: number;
  status: string;
  submission_data: Array<{
    section_id: string;
    question_number: number;
    student_answer: string;
    correct_answer: string;
    is_correct: boolean;
  }>;
  created_at: string;
  tests: {
    title: string;
    description: string;
  };
}

export default function TestResults() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  
  const [submission, setSubmission] = useState<TestSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (submissionId) {
      loadSubmission();
    }
  }, [submissionId]);

  const loadSubmission = async () => {
    setIsLoading(true);
    setError('');

    try {
      const { data, error: submissionError } = await supabase
        .from('test_submissions')
        .select(`
          *,
          tests (
            title,
            description
          )
        `)
        .eq('id', submissionId)
        .single();

      if (submissionError) throw submissionError;

      setSubmission(data);
    } catch (err) {
      console.error('Load submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load test results');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Improvement';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4">Loading results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/student/dashboard')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="container mx-auto p-6 text-center">
        <p>Test results not found.</p>
        <Button onClick={() => navigate('/student/dashboard')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const correctAnswers = submission.submission_data.filter(item => item.is_correct).length;
  const totalQuestions = submission.submission_data.length;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Test Results</h1>
        <h2 className="text-xl text-gray-600">{submission.tests.title}</h2>
        <p className="text-gray-500">{submission.tests.description}</p>
      </div>

      {/* Score Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Overall Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className={`text-4xl font-bold text-white p-6 rounded-lg ${getScoreColor(submission.score)}`}>
                {submission.score}%
              </div>
              <p className="mt-2 font-medium">{getScoreLabel(submission.score)}</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">
                {correctAnswers}/{totalQuestions}
              </div>
              <p className="text-gray-500">Correct Answers</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">
                {formatTime(submission.time_spent)}
              </div>
              <p className="text-gray-500">Time Spent</p>
            </div>
            
            <div className="text-center">
              <Badge variant={submission.status === 'completed' ? 'default' : 'secondary'}>
                {submission.status.toUpperCase()}
              </Badge>
              <p className="text-gray-500 mt-1">Status</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Answer Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {submission.submission_data.map((item, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg border-l-4 ${
                  item.is_correct 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-red-500 bg-red-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium">Question {item.question_number}</span>
                      <Badge variant={item.is_correct ? 'default' : 'destructive'}>
                        {item.is_correct ? 'Correct' : 'Incorrect'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Your Answer:</p>
                        <p className="font-mono bg-white p-2 rounded border">
                          {item.student_answer || '(No answer)'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Correct Answer:</p>
                        <p className="font-mono bg-white p-2 rounded border">
                          {item.correct_answer}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="text-center space-x-4">
        <Button variant="outline" onClick={() => navigate('/student/dashboard')}>
          Back to Dashboard
        </Button>
        <Button onClick={() => navigate('/student/test-history')}>
          View Test History
        </Button>
      </div>
    </div>
  );
}
