import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  BookOpen,
  FileText,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  Edit3,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTestById } from "@/lib/supabaseUtils";

interface ReadingQuestion {
  id: string;
  question_number: number;
  question_type: string;
  question_text: string;
  options: string[];
  correct_answer: any;
  paragraph_reference: string;
  points: number;
  explanation: string;
}

const questionTypes = [
  {
    value: "multiple_choice",
    label: "Multiple Choice",
    description: "Students select one correct answer from options",
  },
  {
    value: "true_false_not_given",
    label: "True/False/Not Given",
    description:
      "Students determine if statements are true, false, or not given",
  },
  {
    value: "fill_in_blank",
    label: "Fill in the Blank",
    description: "Students complete sentences with missing words",
  },
  {
    value: "matching_headings",
    label: "Matching Headings",
    description: "Students match headings to paragraphs",
  },
  {
    value: "short_answer",
    label: "Short Answer",
    description: "Students provide brief written answers",
  },
  {
    value: "multiple_selection",
    label: "Multiple Selection",
    description: "Students select multiple correct answers",
  },
];

type Step = "passage-info" | "passage-content" | "questions" | "review";

const CreateReadingWizard: React.FC = () => {
  const { testId, passageNumber } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Current step in the wizard
  const [currentStep, setCurrentStep] = useState<Step>("passage-info");

  // Passage data
  const [passageData, setPassageData] = useState({
    title: `Reading Passage ${passageNumber || "1"}`,
    instructions: "Read the passage and answer the questions that follow.",
    passage_text: "",
  });

  // Questions data
  const [questions, setQuestions] = useState<ReadingQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  // UI states
  const [currentTest, setCurrentTest] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", content: "" });

  useEffect(() => {
    if (testId) {
      fetchTest();
    }
  }, [testId]);

  const fetchTest = async () => {
    try {
      if (!testId) throw new Error("Test ID is required");
      const testData = await fetchTestById(testId);
      setCurrentTest(testData);
    } catch (error: any) {
      setMessage({
        type: "error",
        content: `Could not load test: ${error?.message || "Unknown error"}`,
      });
    }
  };

  const handleNextStep = () => {
    switch (currentStep) {
      case "passage-info":
        if (!passageData.title.trim()) {
          setMessage({
            type: "error",
            content: "Please enter a passage title",
          });
          return;
        }
        setCurrentStep("passage-content");
        break;
      case "passage-content":
        if (!passageData.passage_text.trim()) {
          setMessage({
            type: "error",
            content: "Please enter the passage text",
          });
          return;
        }
        setCurrentStep("questions");
        // Add first question automatically
        if (questions.length === 0) {
          addNewQuestion();
        }
        break;
      case "questions":
        setCurrentStep("review");
        break;
      default:
        break;
    }
    setMessage({ type: "", content: "" });
  };

  const handlePreviousStep = () => {
    switch (currentStep) {
      case "passage-content":
        setCurrentStep("passage-info");
        break;
      case "questions":
        setCurrentStep("passage-content");
        break;
      case "review":
        setCurrentStep("questions");
        break;
      default:
        break;
    }
    setMessage({ type: "", content: "" });
  };

  const addNewQuestion = () => {
    const newQuestion: ReadingQuestion = {
      id: `q_${Date.now()}`,
      question_number: questions.length + 1,
      question_type: "multiple_choice",
      question_text: "",
      options: ["", "", "", ""],
      correct_answer: "",
      paragraph_reference: "",
      points: 1,
      explanation: "",
    };
    setQuestions([...questions, newQuestion]);
    setCurrentQuestionIndex(questions.length);
    setIsAddingQuestion(true);
  };

  const updateCurrentQuestion = (field: string, value: any) => {
    setQuestions((prev) =>
      prev.map((q, index) =>
        index === currentQuestionIndex ? { ...q, [field]: value } : q,
      ),
    );
  };

  const deleteQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    if (currentQuestionIndex >= questions.length - 1) {
      setCurrentQuestionIndex(Math.max(0, questions.length - 2));
    }
  };

  const finishAddingQuestion = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion.question_text.trim()) {
      setMessage({ type: "error", content: "Please enter the question text" });
      return;
    }

    if (
      currentQuestion.question_type === "multiple_choice" &&
      (!currentQuestion.options.some((opt) => opt.trim()) ||
        currentQuestion.correct_answer === "")
    ) {
      setMessage({
        type: "error",
        content: "Please fill in options and select the correct answer",
      });
      return;
    }

    setIsAddingQuestion(false);
    setMessage({ type: "", content: "" });
  };

  const saveReadingSection = async () => {
    if (questions.length === 0) {
      setMessage({
        type: "error",
        content: "Please add at least one question",
      });
      return;
    }

    setIsSaving(true);
    setMessage({ type: "", content: "" });

    try {
      // Create reading section
      const { data: sectionData, error: sectionError } = await supabase
        .from("reading_sections")
        .insert({
          test_id: testId,
          title: passageData.title,
          passage_text: passageData.passage_text,
          passage_number: parseInt(passageNumber || "1"),
          instructions: passageData.instructions,
          section_order: parseInt(passageNumber || "1"),
        })
        .select()
        .single();

      if (sectionError) throw sectionError;

      // Create questions
      const questionsToInsert = questions.map((question, index) => ({
        reading_section_id: sectionData.id,
        question_number: index + 1,
        question_type: question.question_type,
        question_text: question.question_text,
        options: question.options || [],
        correct_answer: question.correct_answer,
        paragraph_reference: question.paragraph_reference,
        points: question.points,
        explanation: question.explanation,
        question_order: index + 1,
      }));

      const { error: questionsError } = await supabase
        .from("reading_questions")
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      setMessage({
        type: "success",
        content: "Reading section saved successfully!",
      });

      setTimeout(() => {
        navigate(`/edu-admin/tests/create/advanced/${testId}`);
      }, 1500);
    } catch (error: any) {
      setMessage({
        type: "error",
        content: `Failed to save: ${error?.message || "Unknown error"}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderAnswerOptions = (question: ReadingQuestion) => {
    switch (question.question_type) {
      case "multiple_choice":
        return (
          <div className="space-y-3">
            <Label>Answer Options</Label>
            <RadioGroup
              value={question.correct_answer?.toString()}
              onValueChange={(value) =>
                updateCurrentQuestion("correct_answer", parseInt(value))
              }
            >
              {question.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={index.toString()} />
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...question.options];
                      newOptions[index] = e.target.value;
                      updateCurrentQuestion("options", newOptions);
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    className="flex-1"
                  />
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case "true_false_not_given":
        return (
          <div className="space-y-2">
            <Label>Correct Answer</Label>
            <Select
              value={question.correct_answer}
              onValueChange={(value) =>
                updateCurrentQuestion("correct_answer", value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select correct answer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">True</SelectItem>
                <SelectItem value="false">False</SelectItem>
                <SelectItem value="not_given">Not Given</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case "multiple_selection":
        return (
          <div className="space-y-3">
            <Label>Options (select multiple correct answers)</Label>
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={question.options[index] || ""}
                  onChange={(e) => {
                    const newOptions = [...question.options];
                    newOptions[index] = e.target.value;
                    updateCurrentQuestion("options", newOptions);
                  }}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1"
                />
                <Checkbox
                  checked={
                    Array.isArray(question.correct_answer) &&
                    question.correct_answer.includes(index)
                  }
                  onCheckedChange={(checked) => {
                    const currentAnswers = Array.isArray(
                      question.correct_answer,
                    )
                      ? question.correct_answer
                      : [];
                    if (checked) {
                      updateCurrentQuestion("correct_answer", [
                        ...currentAnswers,
                        index,
                      ]);
                    } else {
                      updateCurrentQuestion(
                        "correct_answer",
                        currentAnswers.filter((i: number) => i !== index),
                      );
                    }
                  }}
                />
                <Label className="text-sm">Correct</Label>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <Label>Correct Answer</Label>
            <Input
              value={question.correct_answer || ""}
              onChange={(e) =>
                updateCurrentQuestion("correct_answer", e.target.value)
              }
              placeholder="Enter the correct answer"
            />
          </div>
        );
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: "passage-info", label: "Passage Info", icon: FileText },
      { key: "passage-content", label: "Passage Content", icon: BookOpen },
      { key: "questions", label: "Questions", icon: HelpCircle },
      { key: "review", label: "Review", icon: CheckCircle },
    ];

    const currentStepIndex = steps.findIndex(
      (step) => step.key === currentStep,
    );

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => {
          const isActive = step.key === currentStep;
          const isCompleted = index < currentStepIndex;
          const StepIcon = step.icon;

          return (
            <React.Fragment key={step.key}>
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  isActive
                    ? "bg-blue-100 text-blue-700"
                    : isCompleted
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                }`}
              >
                <StepIcon className="h-4 w-4" />
                <span className="font-medium">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight className="h-4 w-4 text-gray-400 mx-2" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  if (!currentTest) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(`/edu-admin/tests/create/advanced/${testId}`)
            }
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-8 w-8" />
              Create Reading Passage {passageNumber}
            </h1>
            <p className="text-muted-foreground">Test: {currentTest.title}</p>
          </div>
        </div>

        {message.content && (
          <Alert
            className={
              message.type === "error" ? "border-red-500" : "border-green-500"
            }
          >
            {message.type === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <AlertDescription>{message.content}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {currentStep === "passage-info" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">Passage Information</h2>
                <p className="text-muted-foreground">
                  Set up basic details for your reading passage
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Passage Title</Label>
                  <Input
                    id="title"
                    value={passageData.title}
                    onChange={(e) =>
                      setPassageData((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="e.g., Reading Passage 1: Climate Change"
                  />
                </div>

                <div>
                  <Label htmlFor="instructions">
                    Instructions for Students
                  </Label>
                  <Textarea
                    id="instructions"
                    value={passageData.instructions}
                    onChange={(e) =>
                      setPassageData((prev) => ({
                        ...prev,
                        instructions: e.target.value,
                      }))
                    }
                    placeholder="Instructions that will appear to students"
                    rows={3}
                  />
                </div>


              </div>

              <div className="flex justify-end">
                <Button onClick={handleNextStep}>
                  Next: Add Passage Content
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === "passage-content" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">Passage Content</h2>
                <p className="text-muted-foreground">
                  Enter the reading passage text
                </p>
              </div>

              <div>
                <Label htmlFor="passage">Passage Text</Label>
                <Textarea
                  id="passage"
                  value={passageData.passage_text}
                  onChange={(e) =>
                    setPassageData((prev) => ({
                      ...prev,
                      passage_text: e.target.value,
                    }))
                  }
                  placeholder="Enter the reading passage here..."
                  rows={15}
                  className="font-serif text-base leading-relaxed"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Tip: Use clear, well-structured academic text appropriate for
                  your students' level
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePreviousStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleNextStep}>
                  Next: Add Questions
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === "questions" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">Add Questions</h2>
                <p className="text-muted-foreground">
                  Create questions one by one for your passage
                </p>
              </div>

              {questions.length > 0 && (
                <div className="mb-6">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Questions Progress
                  </Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {questions.map((_, index) => (
                      <Badge
                        key={index}
                        variant={
                          index === currentQuestionIndex ? "default" : "outline"
                        }
                        className="cursor-pointer"
                        onClick={() => setCurrentQuestionIndex(index)}
                      >
                        Q{index + 1}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {questions.length > 0 && (
                <Card className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        Question {currentQuestionIndex + 1}
                        {!isAddingQuestion && (
                          <Badge variant="outline" className="text-xs">
                            {
                              questionTypes.find(
                                (t) =>
                                  t.value ===
                                  questions[currentQuestionIndex]
                                    ?.question_type,
                              )?.label
                            }
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-2">
                        {!isAddingQuestion && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsAddingQuestion(true)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        )}
                        {questions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteQuestion(currentQuestionIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isAddingQuestion ? (
                      <>
                        <div>
                          <Label>Question Type</Label>
                          <Select
                            value={
                              questions[currentQuestionIndex]?.question_type
                            }
                            onValueChange={(value) =>
                              updateCurrentQuestion("question_type", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {questionTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div>
                                    <div className="font-medium">
                                      {type.label}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {type.description}
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Question Text</Label>
                          <Textarea
                            value={
                              questions[currentQuestionIndex]?.question_text ||
                              ""
                            }
                            onChange={(e) =>
                              updateCurrentQuestion(
                                "question_text",
                                e.target.value,
                              )
                            }
                            placeholder="Enter your question..."
                            rows={3}
                          />
                        </div>

                        {renderAnswerOptions(questions[currentQuestionIndex])}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Points</Label>
                            <Input
                              type="number"
                              min="0.5"
                              max="5"
                              step="0.5"
                              value={
                                questions[currentQuestionIndex]?.points || 1
                              }
                              onChange={(e) =>
                                updateCurrentQuestion(
                                  "points",
                                  parseFloat(e.target.value) || 1,
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label>Paragraph Reference (Optional)</Label>
                            <Input
                              value={
                                questions[currentQuestionIndex]
                                  ?.paragraph_reference || ""
                              }
                              onChange={(e) =>
                                updateCurrentQuestion(
                                  "paragraph_reference",
                                  e.target.value,
                                )
                              }
                              placeholder="e.g., Paragraph 2"
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Explanation (Optional)</Label>
                          <Textarea
                            value={
                              questions[currentQuestionIndex]?.explanation || ""
                            }
                            onChange={(e) =>
                              updateCurrentQuestion(
                                "explanation",
                                e.target.value,
                              )
                            }
                            placeholder="Explain why this is the correct answer..."
                            rows={2}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button onClick={finishAddingQuestion}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Save Question
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setIsAddingQuestion(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <strong>Question:</strong>{" "}
                          {questions[currentQuestionIndex]?.question_text}
                        </div>
                        {questions[currentQuestionIndex]?.question_type ===
                          "multiple_choice" && (
                          <div>
                            <strong>Options:</strong>
                            <ul className="list-disc list-inside ml-4">
                              {questions[currentQuestionIndex]?.options.map(
                                (option, index) => (
                                  <li
                                    key={index}
                                    className={
                                      index ===
                                      questions[currentQuestionIndex]
                                        ?.correct_answer
                                        ? "font-bold text-green-600"
                                        : ""
                                    }
                                  >
                                    {String.fromCharCode(65 + index)}: {option}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                        <div>
                          <strong>Points:</strong>{" "}
                          {questions[currentQuestionIndex]?.points}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-center">
                <Button
                  onClick={addNewQuestion}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Another Question
                </Button>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePreviousStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleNextStep}
                  disabled={questions.length === 0 || isAddingQuestion}
                >
                  Next: Review
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === "review" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">Review & Save</h2>
                <p className="text-muted-foreground">
                  Review your reading passage before saving
                </p>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Passage Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <strong>Title:</strong> {passageData.title}
                    </div>
                    <div>
                      <strong>Instructions:</strong> {passageData.instructions}
                    </div>
                    <div>
                      <strong>Total Questions:</strong> {questions.length}
                    </div>
                    <div>
                      <strong>Total Points:</strong>{" "}
                      {questions.reduce((sum, q) => sum + q.points, 0)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Passage Text</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="font-serif text-sm leading-relaxed max-h-60 overflow-y-auto border rounded p-3 bg-gray-50">
                      {passageData.passage_text}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Questions Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {questions.map((question, index) => (
                        <div
                          key={question.id}
                          className="border-l-4 border-blue-500 pl-4"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">Q{index + 1}</Badge>
                            <Badge variant="secondary">
                              {
                                questionTypes.find(
                                  (t) => t.value === question.question_type,
                                )?.label
                              }
                            </Badge>
                            <Badge>{question.points} pts</Badge>
                          </div>
                          <div className="text-sm">
                            {question.question_text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handlePreviousStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Questions
                </Button>
                <Button
                  onClick={saveReadingSection}
                  disabled={isSaving}
                  size="lg"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Reading Passage"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateReadingWizard;
