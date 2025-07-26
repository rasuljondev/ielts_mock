import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  BookOpen,
  MoveUp,
  MoveDown,
} from "lucide-react";

interface Question {
  id: string;
  type: "mcq" | "tfng" | "fill";
  question: string;
  options?: string[];
  correct_answer: string | string[];
  points: number;
  order: number;
}

const CreateReadingSection: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get("sectionId");
  const testTitle = searchParams.get("testTitle");
  const isEdit = searchParams.get("edit") === "true";

  const [sectionData, setSectionData] = useState({
    title: "",
    duration: 60,
    passage: "",
    questions: [] as Question[],
  });

  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    id: "",
    type: "mcq",
    question: "",
    options: ["", "", "", ""],
    correct_answer: "",
    points: 1,
    order: 0,
  });

  const [showQuestionForm, setShowQuestionForm] = useState(false);

  useEffect(() => {
    if (testTitle) {
      setSectionData((prev) => ({
        ...prev,
        title: `${decodeURIComponent(testTitle)} - Reading Section`,
      }));
    }
  }, [testTitle]);

  const addQuestion = () => {
    const newQuestion: Question = {
      ...currentQuestion,
      id: Date.now().toString(),
      order: sectionData.questions.length + 1,
    };

    setSectionData((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));

    // Reset form
    setCurrentQuestion({
      id: "",
      type: "mcq",
      question: "",
      options: ["", "", "", ""],
      correct_answer: "",
      points: 1,
      order: 0,
    });
    setShowQuestionForm(false);
  };

  const removeQuestion = (id: string) => {
    setSectionData((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== id),
    }));
  };

  const moveQuestion = (id: string, direction: "up" | "down") => {
    const questions = [...sectionData.questions];
    const index = questions.findIndex((q) => q.id === id);

    if (
      (direction === "up" && index > 0) ||
      (direction === "down" && index < questions.length - 1)
    ) {
      const newIndex = direction === "up" ? index - 1 : index + 1;
      [questions[index], questions[newIndex]] = [
        questions[newIndex],
        questions[index],
      ];

      // Update order numbers
      questions.forEach((q, i) => {
        q.order = i + 1;
      });

      setSectionData((prev) => ({ ...prev, questions }));
    }
  };

  const handleSave = () => {
    if (!sectionData.title || sectionData.questions.length === 0) {
      alert("Please add a section title and at least one question.");
      return;
    }

    // Here you would typically save to localStorage or state management
    // For now, we'll just navigate back with the data
    console.log("Saving reading section:", sectionData);
    alert("Reading section saved successfully!");
    navigate("/edu-admin/tests/create");
  };

  const renderQuestionForm = () => {
    switch (currentQuestion.type) {
      case "mcq":
        return (
          <div className="space-y-4">
            <div>
              <Label>Question Text</Label>
              <Textarea
                value={currentQuestion.question}
                onChange={(e) =>
                  setCurrentQuestion((prev) => ({
                    ...prev,
                    question: e.target.value,
                  }))
                }
                placeholder="Enter your multiple choice question..."
              />
            </div>
            <div>
              <Label>Answer Options</Label>
              <RadioGroup
                value={currentQuestion.correct_answer}
                onValueChange={(value) =>
                  setCurrentQuestion((prev) => ({
                    ...prev,
                    correct_answer: value,
                  }))
                }
              >
                {currentQuestion.options?.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={index.toString()} />
                    <Input
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...(currentQuestion.options || [])];
                        newOptions[index] = e.target.value;
                        setCurrentQuestion((prev) => ({
                          ...prev,
                          options: newOptions,
                        }));
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className="flex-1"
                    />
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        );

      case "tfng":
        return (
          <div className="space-y-4">
            <div>
              <Label>Statement</Label>
              <Textarea
                value={currentQuestion.question}
                onChange={(e) =>
                  setCurrentQuestion((prev) => ({
                    ...prev,
                    question: e.target.value,
                  }))
                }
                placeholder="Enter a statement for True/False/Not Given..."
              />
            </div>
            <div>
              <Label>Correct Answer</Label>
              <Select
                value={currentQuestion.correct_answer as string}
                onValueChange={(value) =>
                  setCurrentQuestion((prev) => ({
                    ...prev,
                    correct_answer: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select correct answer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                  <SelectItem value="not-given">Not Given</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "fill":
        return (
          <div className="space-y-4">
            <div>
              <Label>Question with Blanks</Label>
              <Textarea
                value={currentQuestion.question}
                onChange={(e) =>
                  setCurrentQuestion((prev) => ({
                    ...prev,
                    question: e.target.value,
                  }))
                }
                placeholder="Enter question with _____ for blanks..."
              />
            </div>
            <div>
              <Label>Correct Answer(s)</Label>
              <Input
                value={currentQuestion.correct_answer as string}
                onChange={(e) =>
                  setCurrentQuestion((prev) => ({
                    ...prev,
                    correct_answer: e.target.value,
                  }))
                }
                placeholder="Enter correct answers separated by commas"
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/edu-admin/tests/create")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Test Creation
        </Button>
        <div className="flex items-center space-x-2">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Reading Section
            </h1>
            <p className="text-muted-foreground">
              Add reading comprehension questions
            </p>
          </div>
        </div>
      </div>

      {/* Section Information */}
      <Card>
        <CardHeader>
          <CardTitle>Section Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Section Title</Label>
            <Input
              id="title"
              value={sectionData.title}
              onChange={(e) =>
                setSectionData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="e.g. Reading Section 1"
            />
          </div>

          <div>
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              value={sectionData.duration}
              onChange={(e) =>
                setSectionData((prev) => ({
                  ...prev,
                  duration: parseInt(e.target.value) || 60,
                }))
              }
              min="1"
              max="120"
            />
          </div>

          <div>
            <Label htmlFor="passage">Reading Passage</Label>
            <Textarea
              id="passage"
              value={sectionData.passage}
              onChange={(e) =>
                setSectionData((prev) => ({ ...prev, passage: e.target.value }))
              }
              placeholder="Paste the reading passage text here..."
              rows={8}
            />
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Questions ({sectionData.questions.length})</CardTitle>
            <Button onClick={() => setShowQuestionForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sectionData.questions.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No questions yet</h3>
              <p className="text-muted-foreground">
                Add your first question to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sectionData.questions.map((question, index) => (
                <div
                  key={question.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="outline" className="uppercase">
                        {question.type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Question {question.order} • {question.points} point(s)
                      </span>
                    </div>
                    <p className="font-medium">
                      {question.question.substring(0, 100)}
                      {question.question.length > 100 ? "..." : ""}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveQuestion(question.id, "up")}
                      disabled={index === 0}
                    >
                      <MoveUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveQuestion(question.id, "down")}
                      disabled={index === sectionData.questions.length - 1}
                    >
                      <MoveDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(question.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Question Form */}
      {showQuestionForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Question Type</Label>
              <Select
                value={currentQuestion.type}
                onValueChange={(value) =>
                  setCurrentQuestion((prev) => ({
                    ...prev,
                    type: value as any,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple Choice</SelectItem>
                  <SelectItem value="tfng">True/False/Not Given</SelectItem>
                  <SelectItem value="fill">Fill in the Blanks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {renderQuestionForm()}

            <div>
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                type="number"
                value={currentQuestion.points}
                onChange={(e) =>
                  setCurrentQuestion((prev) => ({
                    ...prev,
                    points: parseInt(e.target.value) || 1,
                  }))
                }
                min="1"
                max="10"
                className="w-24"
              />
            </div>

            <div className="flex space-x-2">
              <Button onClick={addQuestion}>Add Question</Button>
              <Button
                variant="outline"
                onClick={() => setShowQuestionForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Section */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Save Reading Section</h3>
              <p className="text-sm text-muted-foreground">
                Section will be added to your test
              </p>
            </div>
            <Button size="lg" onClick={handleSave}>
              <Save className="mr-2 h-5 w-5" />
              Save Section
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateReadingSection;
