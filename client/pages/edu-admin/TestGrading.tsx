import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Textarea } from '../../components/ui/textarea';
import { EnhancedBracketParser } from '../../lib/enhancedBracketParser';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, Clock, User, FileText, Award } from 'lucide-react';

interface TestSubmission {
  id: string;
  score: number;
  time_spent: number;
  status: string;
  created_at: string;
  submission_data: Array<{
    question_number: number;
    student_answer: string;
    correct_answer: string;
    is_correct: boolean;
  }>;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
  tests: {
    title: string;
    description: string;
  };
}

export default function TestGrading() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  
  const [submission, setSubmission] = useState<TestSubmission | null>(null);
  const [feedback, setFeedback] = useState('');
  const [manualOverrides, setManualOverrides] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
      const { data, error: fetchError } = await supabase
        .from('test_submissions')
        .select(`
          *,
          profiles (
            first_name,
            last_name,
            email
          ),
          tests (
            title,
            description
          )
        `)
        .eq('id', submissionId)
        .single();

      if (fetchError) throw fetchError;

      setSubmission(data);
      setFeedback(data.feedback || '');
    } catch (err) {
      console.error('Load submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load submission');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleQuestionCorrectness = (questionNumber: number) => {
    setManualOverrides(prev => ({
      ...prev,
      [questionNumber]: !prev[questionNumber]
    }));
  };

  const calculateAdjustedScore = () => {
    if (!submission) return 0;
    
    let correctCount = 0;
    const totalQuestions = submission.submission_data.length;

    submission.submission_data.forEach(item => {
      const isOverridden = manualOverrides.hasOwnProperty(item.question_number);
      const isCorrect = isOverridden ? manualOverrides[item.question_number] : item.is_correct;
      
      if (isCorrect) correctCount++;
    });

    return totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  };

  const saveFeedbackAndGrade = async () => {
    if (!submission) return;

    setIsSaving(true);
    setError('');

    try {
      const adjustedScore = calculateAdjustedScore();
      
      const { error: updateError } = await supabase
        .from('test_submissions')
        .update({
          score: adjustedScore,
          feedback: feedback,
          manual_overrides: JSON.stringify(manualOverrides),
          graded_at: new Date().toISOString(),
          status: 'graded'
        })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      // Reload to show updated data
      await loadSubmission();
      
      setError('');
      alert('Grading saved successfully!');
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save grading');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4">Loading submission...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/edu-admin/submissions')} className="mt-4">
          Back to Submissions
        </Button>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="container mx-auto p-6 text-center">
        <p>Submission not found.</p>
        <Button onClick={() => navigate('/edu-admin/submissions')} className="mt-4">
          Back to Submissions
        </Button>
      </div>
    );
  }

  const adjustedScore = calculateAdjustedScore();
  const hasManualOverrides = Object.keys(manualOverrides).length > 0;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Grade Test Submission</h1>
        <div className="flex items-center space-x-4 text-gray-600">
          <span className="flex items-center space-x-1">
            <User className="h-4 w-4" />
            <span>{submission.profiles.first_name} {submission.profiles.last_name}</span>
          </span>
          <span className="flex items-center space-x-1">
            <FileText className="h-4 w-4" />
            <span>{submission.tests.title}</span>
          </span>
          <span className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>{formatTime(submission.time_spent)}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Questions and Answers */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Answers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {submission.submission_data.map((item, index) => {
                  const isOverridden = manualOverrides.hasOwnProperty(item.question_number);
                  const finalCorrectness = isOverridden ? manualOverrides[item.question_number] : item.is_correct;
                  
                  return (
                    <div 
                      key={index}
                      className={`p-4 rounded-lg border-l-4 ${
                        finalCorrectness 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-red-500 bg-red-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">Question {item.question_number}</span>
                          {finalCorrectness ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          {isOverridden && (
                            <Badge variant="secondary" className="text-xs">
                              Manual Override
                            </Badge>
                          )}
                        </div>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleQuestionCorrectness(item.question_number)}
                          className="text-xs"
                        >
                          Mark as {finalCorrectness ? 'Wrong' : 'Correct'}
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Student Answer:</p>
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
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grading Panel */}
        <div className="space-y-6">
          {/* Score Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="h-5 w-5" />
                <span>Score</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <div>
                  <div className="text-3xl font-bold text-blue-600">
                    {adjustedScore}%
                  </div>
                  <p className="text-sm text-gray-600">
                    {submission.submission_data.filter((_, i) => {
                      const item = submission.submission_data[i];
                      const isOverridden = manualOverrides.hasOwnProperty(item.question_number);
                      return isOverridden ? manualOverrides[item.question_number] : item.is_correct;
                    }).length} / {submission.submission_data.length} correct
                  </p>
                </div>
                
                {hasManualOverrides && (
                  <div className="p-3 bg-yellow-50 rounded border">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Score adjusted with manual overrides
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Original score: {submission.score}%
                    </p>
                  </div>
                )}
                
                <div className="text-xs text-gray-500">
                  <p>Time taken: {formatTime(submission.time_spent)}</p>
                  <p>Submitted: {new Date(submission.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feedback */}
          <Card>
            <CardHeader>
              <CardTitle>Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  placeholder="Provide feedback for the student..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={6}
                />
                
                <Button
                  onClick={saveFeedbackAndGrade}
                  disabled={isSaving}
                  className="w-full"
                >
                  {isSaving ? 'Saving...' : 'Save Grade & Feedback'}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => navigate('/edu-admin/submissions')}
                  className="w-full"
                >
                  Back to Submissions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
