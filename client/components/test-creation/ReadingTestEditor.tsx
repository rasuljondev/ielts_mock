import React, { useState, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { uploadFile } from "@/lib/uploadUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MediaUploader, MediaFile } from "@/components/ui/media-uploader";
import {
  Type,
  List,
  MousePointer,
  Bold,
  Italic,
  Plus,
  X,
  Trash2,
} from "lucide-react";
import { ShortAnswerNode } from './ShortAnswerNode';
import { MatchingNode } from './MatchingNode';
import { MCQNode } from './MCQNode';
import { MSNode } from './MSNode';

interface Question {
  id: string;
  type:
    | "short_answer"
    | "multiple_choice"
    | "matching"
    | "multiple_selection";
  content: any;
  summary: string;
}

interface ReadingTestEditorProps {
  onQuestionsChange?: (questions: Question[]) => void;
  onEditorQuestionsChange?: (editorQuestions: any[]) => void;
  placeholder?: string;
  initialContent?: any; // changed from string to any (TipTap JSON)
  startingQuestionNumber?: number; // Add this prop for reading tests
}

interface EditorQuestionMapping {
  questionId: string;
  editorPosition: number;
}

export function ReadingTestEditor(
  props: ReadingTestEditorProps & { content?: any; onContentChange?: (json: any) => void; questions?: Question[] }
) {
  const {
    onQuestionsChange,
    onEditorQuestionsChange,
    placeholder,
    initialContent,
    content,
    onContentChange,
    questions: controlledQuestions,
    startingQuestionNumber = 1, // Default to 1 if not provided
  } = props;
  const [questions, setQuestions] = useState<Question[]>(controlledQuestions || []);
  const [questionCounter, setQuestionCounter] = useState(1);
  const [editorMappings, setEditorMappings] = useState<EditorQuestionMapping[]>(
    [],
  );
  const [showModal, setShowModal] = useState(false);
  const [currentQuestionType, setCurrentQuestionType] = useState<string | null>(
    null,
  );
  // Remove local editorKey, use parent key for reset

  // Question form states
  const [shortAnswers, setShortAnswers] = useState("");
  const [mcqQuestion, setMcqQuestion] = useState("");
  const [mcqOptions, setMcqOptions] = useState(["", "", "", ""]);
  const [correctOption, setCorrectOption] = useState(0);
  const [matchingPairs, setMatchingPairs] = useState([{ left: "", right: "" }]);
  // Add TFNG state
  const [tfngQuestion, setTfngQuestion] = useState("");
  const [tfngCorrectOption, setTfngCorrectOption] = useState(0);
  // Add MS state
  const [msQuestion, setMsQuestion] = useState("");
  const [msOptions, setMsOptions] = useState(["", "", "", ""]);
  const [msCorrectAnswers, setMsCorrectAnswers] = useState<string[]>([]); // Changed from number[] to string[]
  // Add error state for MCQ/TFNG
  const [optionError, setOptionError] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || "Start typing your question content...",
      }),
      ShortAnswerNode,
      MatchingNode,
      MCQNode,
      MSNode,
    ],
    content: content ?? initialContent ?? "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[250px] sm:min-h-[350px] p-4 border-0 focus:ring-0",
      },
    },
    onUpdate: ({ editor }) => {
      if (onContentChange) {
        onContentChange(editor.getJSON());
      }
    },
  });

  // When content prop changes (e.g., after clear all), update the editor
  useEffect(() => {
    if (editor && content !== undefined) {
      // Handle both string and object content
      if (typeof content === 'string') {
        // If it's a string, try to parse it as JSON first
        try {
          const parsedContent = JSON.parse(content);
          if (JSON.stringify(parsedContent) !== JSON.stringify(editor.getJSON())) {
            editor.commands.setContent(parsedContent);
          }
        } catch {
          // If it's not valid JSON, treat it as plain text
          if (content !== editor.getHTML()) {
            editor.commands.setContent(content);
          }
        }
      } else if (typeof content === 'object' && content !== null) {
        // If it's an object, set it directly
        if (JSON.stringify(content) !== JSON.stringify(editor.getJSON())) {
          editor.commands.setContent(content);
        }
      }
    }
  }, [content, editor]);

  const extractQuestionsFromContent = (content: any): any[] => {
    const questions: any[] = [];

    const traverse = (node: any) => {
      if (node.type === "short_answer") {
        questions.push({
          id: node.attrs?.id || `short_answer_${Date.now()}`,
          type: "short_answer",
          content: node,
          summary: node.attrs?.summary || "Short answer question",
        });
      } else if (node.type === "matching") {
        questions.push({
          id: node.attrs?.id || `matching_${Date.now()}`,
          type: "matching",
          content: node,
          summary: node.attrs?.summary || "Matching question",
        });
      } else if (node.type === "mcq") {
        questions.push({
          id: node.attrs?.id || `mcq_${Date.now()}`,
          type: "multiple_choice",
          content: node,
          summary: node.attrs?.summary || "Multiple choice question",
        });
      } else if (node.type === "ms") {
        questions.push({
          id: node.attrs?.id || `ms_${Date.now()}`,
          type: "multiple_selection",
          content: node,
          summary: node.attrs?.summary || "Multiple selection question",
        });
      } else if (node.content) {
        node.content.forEach(traverse);
      }
    };

    if (content?.content) {
      content.content.forEach(traverse);
    }

    return questions;
  };



  // Keep local questions in sync with parent
  useEffect(() => {
    if (controlledQuestions && controlledQuestions !== questions) {
      setQuestions(controlledQuestions);
    }
  }, [controlledQuestions]);

  // Auto-save whenever data changes (REMOVE: now controlled by parent)

  // Clear storage function (REMOVE: now controlled by parent)
  // When content is cleared, also clear questions and summary
  useEffect(() => {
    if (content === "" && questions.length > 0) {
      setQuestions([]);
      setQuestionCounter(1);
      if (onQuestionsChange) onQuestionsChange([]);
    }
  }, [content]);

  const openQuestionModal = (type: string) => {
    // Only allow supported question types
    if (["short_answer", "multiple_choice", "matching", "tfng", "multiple_selection"].includes(type)) {
      setCurrentQuestionType(type);
      setShowModal(true);
      resetForms();
    }
  };

  const resetForms = () => {
    setShortAnswers("");
    setMcqQuestion("");
    setMcqOptions(["", "", "", ""]);
    setCorrectOption(0);
    setMatchingPairs([{ left: "", right: "" }]);
    // Reset TFNG state
    setTfngQuestion("");
    setTfngCorrectOption(0);
    // Reset MS state
    setMsQuestion("");
    setMsOptions(["", "", "", ""]);
    setMsCorrectAnswers([]);
    setOptionError(""); // Clear error on reset
  };



  // Calculate the next question number based on existing questions
  const getNextQuestionNumber = () => {
    if (questions.length === 0) return startingQuestionNumber;
    
    let maxNumber = startingQuestionNumber - 1; // Start from the base number
    questions.forEach(question => {
      // Add null checks to prevent errors
      const questionContent = question?.content || {};
      
      if (question.type === "matching") {
        // For matching, count each pair as a separate question
        const pairCount = questionContent.left?.length || 0;
        const startNumber = questionContent.question_number || 0;
        maxNumber = Math.max(maxNumber, startNumber + pairCount - 1);
      } else if (question.type === "short_answer") {
        // For short answer, count each answer as a separate question
        const answerCount = questionContent.answers?.length || 0;
        const startNumber = questionContent.question_number || 0;
        maxNumber = Math.max(maxNumber, startNumber + answerCount - 1);
      } else if (question.type === "multiple_selection") {
        // For multiple selection, count each correct answer as a separate question
        const correctAnswerCount = questionContent.correctAnswers?.length || 0;
        const startNumber = questionContent.question_number || 0;
        maxNumber = Math.max(maxNumber, startNumber + correctAnswerCount - 1);
      } else {
        // For other types, just use the question number
        maxNumber = Math.max(maxNumber, questionContent.question_number || 0);
      }
    });
    
    return maxNumber + 1;
  };

  const addMatchingPair = () => {
    setMatchingPairs([...matchingPairs, { left: "", right: "" }]);
  };

  const removeMatchingPair = (index: number) => {
    if (matchingPairs.length > 1) {
      setMatchingPairs(matchingPairs.filter((_, i) => i !== index));
    }
  };

  const updateMatchingPair = (
    index: number,
    field: "left" | "right",
    value: string,
  ) => {
    const newPairs = [...matchingPairs];
    newPairs[index][field] = value;
    setMatchingPairs(newPairs);
  };

  const addMcqOption = () => {
    if (mcqOptions.length < 6) {
      setMcqOptions([...mcqOptions, ""]);
    }
  };

  const removeMcqOption = (index: number) => {
    if (mcqOptions.length > 2) {
      const newOptions = mcqOptions.filter((_, i) => i !== index);
      setMcqOptions(newOptions);
      if (correctOption >= newOptions.length) {
        setCorrectOption(0);
      }
    }
  };

  const addMsOption = () => {
    if (msOptions.length < 6) {
      setMsOptions([...msOptions, ""]);
    }
  };

  const removeMsOption = (index: number) => {
    if (msOptions.length > 2) {
      const newOptions = msOptions.filter((_, i) => i !== index);
      setMsOptions(newOptions);
      // Remove the option value from correct answers if it was selected
      const removedOption = msOptions[index];
      setMsCorrectAnswers(msCorrectAnswers.filter(answer => answer !== removedOption));
    }
  };


  const insertShortAnswer = (answer: string, questionNumber?: number) => {
    if (!editor) return;
    // Support multiple answers separated by comma
    const answersArray = answer
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    editor
      .chain()
      .focus()
      .insertContent({
        type: "short_answer",
        attrs: {
          answers: answersArray,
          admin: true,
          number: questionNumber,
        },
      })
      .run();
  };

  const insertQuestion = () => {
    let questionContent: any = {};
    let summary = "";
    setOptionError(""); // Clear error on each attempt

    console.log("🔍 Inserting question type:", currentQuestionType);
    console.log("🔍 Current editor state:", {
      hasEditor: !!editor,
      editorContent: editor?.getJSON(),
      currentQuestionType
    });

    switch (currentQuestionType) {
      case "short_answer": {
        const answersText = shortAnswers.trim();
        if (!answersText) return;
        const answers = answersText
          .split("\n")
          .map((a) => a.trim())
          .filter((a) => a);
        
        console.log("🔍 Short Answer Debug:", {
          answersText,
          answers,
          answersCount: answers.length
        });
        
        let currentQuestionNumber = getNextQuestionNumber();
        
        answers.forEach((answer, index) => {
          const question_number = currentQuestionNumber + index;
          const id = `q_${Date.now()}_${index}`;
          
          console.log("🔍 Inserting Short Answer Node:", {
            questionNumber: question_number,
            answer,
            nodeAttrs: {
              id,
              question_number,
              placeholder: `Answer ${question_number}`,
              answers: [answer],
            }
          });
          
          // Insert custom node WITH correct answer(s)
          console.log("🔍 About to insert short_answer node:", {
            id,
            question_number,
            placeholder: `Answer ${question_number}`,
            answers: [answer]
          });
          
          editor.chain().focus().insertContent({
            type: 'short_answer',
            attrs: {
              id,
              question_number,
              placeholder: `Answer ${question_number}`,
              answers: [answer], // <--- THIS IS THE FIX!
            },
          }).run();
          
          console.log("🔍 Short answer node inserted. New editor content:", editor?.getJSON());
        });
        // Add all new questions to the questions array
        const newQuestions = answers.map((answer, index) => ({
          id: `q_${Date.now()}_${index}`,
          type: "short_answer" as const,
          content: {
            answer,
            answers: [answer], // <--- THIS IS THE FIX!
            question_number: currentQuestionNumber + index,
          },
          summary: `Short Answer: [${currentQuestionNumber + index}] ${answer}`,
        })) as Question[];
        
        console.log("🔍 Short Answer Questions Array:", newQuestions);
        
        const updatedQuestions = [...questions, ...newQuestions];
        setQuestions(updatedQuestions);
        if (onQuestionsChange) onQuestionsChange(updatedQuestions);
        if (onEditorQuestionsChange) onEditorQuestionsChange(updatedQuestions);
        setQuestionCounter((prev) => prev + answers.length);
        setShowModal(false);
        setCurrentQuestionType(null);
        resetForms();
        return;
      }
      case "multiple_choice": {
        if (!mcqQuestion.trim() || mcqOptions.filter((opt) => opt.trim()).length < 2) return;
        const validOptions = mcqOptions.filter((opt) => opt.trim());
        if (correctOption < 0 || correctOption >= validOptions.length) {
          setOptionError("Please select the correct answer.");
          return;
        }
        const id = `mcq_${Date.now()}`;
        const nextQuestionNumber = getNextQuestionNumber();
        
        console.log("🔍 MCQ Debug:", {
          question: mcqQuestion,
          options: validOptions,
          correctOption,
          correctAnswer: validOptions[correctOption],
          questionNumber: nextQuestionNumber
        });
        
        // Insert custom node
        console.log("🔍 About to insert MCQ node:", {
          id,
          question_number: nextQuestionNumber,
          question_text: mcqQuestion,
          options: validOptions,
          correctOption
        });
        
        editor.chain().focus().insertContent({
          type: 'mcq',
          attrs: {
            id,
            question_number: nextQuestionNumber,
            question_text: mcqQuestion,
            options: validOptions,
            correct_index: correctOption,
          },
        }).run();
        // Add to questions array
        const newQuestion = {
          id,
          type: "multiple_choice" as const,
          content: {
            question: mcqQuestion,
            options: validOptions,
            correctAnswer: correctOption,
            question_number: nextQuestionNumber,
          },
          summary: `MCQ ${nextQuestionNumber}: ${mcqQuestion.slice(0, 30)}${mcqQuestion.length > 30 ? "..." : ""}`,
        } as Question;
        
        console.log("🔍 MCQ Question Array:", newQuestion);
        
        const updatedQuestions = [...questions, newQuestion];
        setQuestions(updatedQuestions);
        if (onQuestionsChange) onQuestionsChange(updatedQuestions);
        if (onEditorQuestionsChange) onEditorQuestionsChange(updatedQuestions);
        setQuestionCounter((prev) => prev + 1);
        setShowModal(false);
        setCurrentQuestionType(null);
        resetForms();
        return;
      }
      case "matching": {
        const validPairs = matchingPairs.filter((pair) => pair.left.trim() && pair.right.trim());
        if (validPairs.length === 0) return;
        
        // Create one question containing all pairs
        const id = `matching_${Date.now()}`;
        const left = validPairs.map(p => p.left);
        const right = validPairs.map(p => p.right);
        const nextQuestionNumber = getNextQuestionNumber();
        
        console.log("🔍 Matching Debug:", {
          pairs: validPairs,
          left,
          right,
          questionNumber: nextQuestionNumber
        });
        
        // Insert single custom node with all pairs
        console.log("🔍 About to insert matching node:", {
          id,
          question_number: nextQuestionNumber,
          left,
          right
        });
        
        editor.chain().focus().insertContent({
          type: 'matching',
          attrs: {
            id,
            question_number: nextQuestionNumber,
            left,
            right,
          },
        }).run();
        
        console.log("🔍 Matching node inserted. New editor content:", editor?.getJSON());
        
        // Add single question to questions array
        const newQuestion = {
          id,
          type: "matching" as const,
          content: {
            left,
            right,
            question_number: nextQuestionNumber,
          },
          summary: `Matching ${nextQuestionNumber}-${nextQuestionNumber + validPairs.length - 1}: ${validPairs.map(pair => `${pair.left} - ${pair.right}`).join(', ')}`,
        } as Question;
        
        console.log("🔍 Matching Question Array:", newQuestion);
        
        const updatedQuestions = [...questions, newQuestion];
        setQuestions(updatedQuestions);
        if (onQuestionsChange) onQuestionsChange(updatedQuestions);
        if (onEditorQuestionsChange) onEditorQuestionsChange(updatedQuestions);
        setQuestionCounter((prev) => prev + validPairs.length);
        setShowModal(false);
        setCurrentQuestionType(null);
        resetForms();
        return;
      }
      case "tfng": {
        if (!tfngQuestion.trim()) return;
        const id = `mcq_${Date.now()}`; // Use mcq prefix since it's treated as MCQ
        const nextQuestionNumber = getNextQuestionNumber();
        const tfngOptions = ["TRUE", "FALSE", "NOT GIVEN"];
        
        if (tfngCorrectOption < 0 || tfngCorrectOption > 2) {
          setOptionError("Please select a correct answer");
          return;
        }
        
        console.log("🔍 TFNG Debug:", {
          question: tfngQuestion,
          options: tfngOptions,
          correctOption: tfngCorrectOption,
          correctAnswer: tfngOptions[tfngCorrectOption],
          questionNumber: nextQuestionNumber
        });
        
        // Insert custom node as MCQ
        editor.chain().focus().insertContent({
          type: 'mcq',
          attrs: {
            id,
            question_number: nextQuestionNumber,
            question_text: tfngQuestion,
            options: tfngOptions,
            correct_index: tfngCorrectOption,
          },
        }).run();
        
        // Add to questions array as MCQ type
        const newQuestion = {
          id,
          type: "multiple_choice" as const, // Treat as MCQ
          content: {
            question: tfngQuestion,
            options: tfngOptions,
            correctAnswer: tfngCorrectOption,
            question_number: nextQuestionNumber,
          },
          summary: `TFNG ${nextQuestionNumber}: ${tfngQuestion.slice(0, 30)}${tfngQuestion.length > 30 ? "..." : ""}`,
        } as Question;
        
        console.log("🔍 TFNG Question Array:", newQuestion);
        
        const updatedQuestions = [...questions, newQuestion];
        setQuestions(updatedQuestions);
        if (onQuestionsChange) onQuestionsChange(updatedQuestions);
        if (onEditorQuestionsChange) onEditorQuestionsChange(updatedQuestions);
        setQuestionCounter((prev) => prev + 1);
        setShowModal(false);
        setCurrentQuestionType(null);
        resetForms();
        return;
      }
      case "multiple_selection": {
        if (msOptions.filter((opt) => opt.trim()).length < 2) return;
        const validOptions = msOptions.filter((opt) => opt.trim());
        if (msCorrectAnswers.length === 0) {
          setOptionError("Please select at least one correct answer.");
          return;
        }
        const id = `ms_${Date.now()}`;
        const nextQuestionNumber = getNextQuestionNumber();

        console.log("🔍 MS Debug:", {
          options: validOptions,
          correctAnswers: msCorrectAnswers,
          questionNumber: nextQuestionNumber
        });

        // Insert custom node
        console.log("🔍 About to insert MS node:", {
          id,
          question_number: nextQuestionNumber,
          options: validOptions,
          correctAnswers: msCorrectAnswers
        });

        editor.chain().focus().insertContent({
          type: 'ms',
          attrs: {
            id,
            question_number: nextQuestionNumber,
            options: validOptions,
            correct_answers: msCorrectAnswers,
          },
        }).run();
        // Add to questions array
        const newQuestion = {
          id,
          type: "multiple_selection" as const,
          content: {
            options: validOptions,
            correctAnswers: msCorrectAnswers,
            question_number: nextQuestionNumber,
          },
          summary: `MS ${nextQuestionNumber}: ${validOptions.length} options`,
        } as Question;

        console.log("🔍 MS Question Array:", newQuestion);

        const updatedQuestions = [...questions, newQuestion];
        setQuestions(updatedQuestions);
        if (onQuestionsChange) onQuestionsChange(updatedQuestions);
        if (onEditorQuestionsChange) onEditorQuestionsChange(updatedQuestions);
        setQuestionCounter((prev) => prev + 1);
        setShowModal(false);
        setCurrentQuestionType(null);
        resetForms();
        return;
      }
    }

    setShowModal(false);
    setCurrentQuestionType(null);
    resetForms();
    
    console.log("🔍 Final Questions State:", questions);
  };

  const deleteQuestion = (questionId: string) => {
    if (!editor) return;

    // Find and remove the question from editor by traversing the JSON content
    const editorContent = editor.getJSON();
    
    const removeNodeById = (content: any[]): any[] => {
      return content.filter(node => {
        if (node.attrs && node.attrs.id === questionId) {
          return false; // Remove this node
        }
        if (node.content && Array.isArray(node.content)) {
          node.content = removeNodeById(node.content);
        }
        return true;
      });
    };

    if (editorContent.content) {
      editorContent.content = removeNodeById(editorContent.content);
      editor.commands.setContent(editorContent);
    }

    // Remove from questions array
    const updatedQuestions = questions.filter((q) => q.id !== questionId);
    setQuestions(updatedQuestions);
    if (onQuestionsChange) onQuestionsChange(updatedQuestions);
    if (onEditorQuestionsChange) onEditorQuestionsChange(updatedQuestions);

    // Update parent content state after deletion
    if (onContentChange) {
      onContentChange(editor.getJSON());
    }

    // Recalculate question counter based on starting question number
    let totalQuestions = startingQuestionNumber - 1;
    updatedQuestions.forEach((q) => {
      if (q.type === "matching") {
        // For matching, count each pair as a separate question
        const pairCount = q.content.left?.length || 0;
        const startNumber = q.content.question_number || 0;
        totalQuestions = Math.max(totalQuestions, startNumber + pairCount - 1);
      } else if (q.type === "short_answer") {
        // For short answer, count each answer as a separate question
        const answerCount = q.content.answers?.length || 0;
        const startNumber = q.content.question_number || 0;
        totalQuestions = Math.max(totalQuestions, startNumber + answerCount - 1);
      } else if (q.type === "multiple_selection") {
        // For multiple selection, count each correct answer as a separate question
        const correctAnswerCount = q.content.correctAnswers?.length || 0;
        const startNumber = q.content.question_number || 0;
        totalQuestions = Math.max(totalQuestions, startNumber + correctAnswerCount - 1);
      } else {
        // For other types, just use the question number
        totalQuestions = Math.max(totalQuestions, q.content.question_number || 0);
      }
    });
    setQuestionCounter(totalQuestions + 1);
  };



  // --- Add MCQ and Matching Insertion Buttons ---
  // Add to the toolbar:
  // Remove direct handleInsertMCQ/handleInsertMatching logic that creates invalid objects
  // Instead, use openQuestionModal('multiple_choice') and openQuestionModal('matching') in the toolbar buttons
  // The insertQuestion function (already present) will handle creating the correct Question object with content and summary fields
  // Update the MCQ and Matching buttons in the toolbar:
  const handleInsertMCQ = () => {
    openQuestionModal("multiple_choice");
  };
  // --- Matching Insertion Handler ---
  const handleInsertMatching = () => {
    openQuestionModal("matching");
  };
  // Add TFNG Insertion Handler
  const handleInsertTFNG = () => {
    setTfngQuestion("");
    setTfngCorrectOption(0);
    openQuestionModal("tfng");
  };
  // Add MS Insertion Handler
  const handleInsertMS = () => {
    setMsQuestion("");
    setMsOptions(["", "", "", ""]);
    setMsCorrectAnswers([]);
    openQuestionModal("multiple_selection");
  };

  return (
    <div className="w-full max-w-full mx-auto">
      <Card className="w-full">
        <CardContent className="p-0">
          <div className="flex flex-col lg:flex-row min-h-[400px]">
            {/* Main Editor - 3/4 width */}
            <div className="flex-1 lg:w-3/4">
              {/* Toolbar */}
              <div className="border-b p-4">
                <div className="flex flex-wrap gap-2">
                  {/* Question Type Buttons */}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openQuestionModal("short_answer")}
                    className="flex items-center gap-2"
                  >
                    <Type className="h-4 w-4" />
                    Short Answer
                  </Button>

                  {/* Remove duplicate MCQ and Matching buttons in the toolbar */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertMCQ()}
                    className="flex items-center gap-2"
                  >
                    <List className="h-4 w-4" />
                    Multiple Choice
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertMatching()}
                    className="flex items-center gap-2"
                  >
                    <MousePointer className="h-4 w-4" />
                    Matching
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInsertTFNG}
                    className="flex items-center gap-2"
                  >
                    <List className="h-4 w-4" />
                    TFNG
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInsertMS}
                    className="flex items-center gap-2"
                  >
                    <List className="h-4 w-4" />
                    Multiple Selection
                  </Button>

                  {/* Map/Diagram button removed */}

                  <div className="border-l border-gray-300 mx-2" />

                  {/* Format Buttons */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className={editor?.isActive("bold") ? "bg-gray-100" : ""}
                  >
                    <Bold className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    className={editor?.isActive("italic") ? "bg-gray-100" : ""}
                  >
                    <Italic className="h-4 w-4" />
                  </Button>

                  <div className="border-l border-gray-300 mx-2" />

                  {/* Storage Indicator */}
                  {questions.length > 0 && (
                    <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      ✓ Auto-saved ({questions.length} questions)
                    </div>
                  )}
                </div>
              </div>

              {/* Editor */}
              <div className="min-h-[250px] lg:min-h-[350px]">
                <EditorContent
                  editor={editor}
                  className="prose max-w-none focus-within:outline-none"
                />
              </div>
            </div>

            {/* Questions Summary - 1/4 width */}
            <div className="lg:w-1/4 lg:max-w-[320px] border-t lg:border-t-0 lg:border-l">
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-4">
                  Questions Summary
                </h3>
                <div className="space-y-2">
                  {questions.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      No questions added yet
                    </p>
                  ) : (
                    (() => {
                      let currentQuestionNumber = 1;
                      return questions.map((question, index) => {
                        let displayNumber = "";
                        let questionsInThisItem = 1;

                        // Add null checks to prevent errors
                        const questionContent = question?.content || {};
                        const questionNumber = questionContent?.question_number || currentQuestionNumber;

                        if (question.type === "matching") {
                          questionsInThisItem = questionContent.left?.length || 1;
                          displayNumber = questionsInThisItem === 1 
                            ? `Q${questionNumber}` 
                            : `Q${questionNumber}-${questionNumber + questionsInThisItem - 1}`;
                        } else if (question.type === "short_answer") {
                          questionsInThisItem = 1; // Each short answer is now individual
                          displayNumber = `Q${questionNumber}`;
                        } else if (question.type === "multiple_choice") {
                          questionsInThisItem = 1; // Multiple choice is a single question
                          displayNumber = `Q${questionNumber}`;
                        } else if (question.type === "multiple_selection") {
                          questionsInThisItem = 1; // Multiple selection is a single question
                          displayNumber = `Q${questionNumber}`;
                        } else {
                          displayNumber = `Q${questionNumber}`;
                        }

                        const element = (
                          <div
                            key={question.id}
                            className="flex items-start justify-between p-2 border rounded"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {displayNumber}: {question.summary}
                              </div>
                              <div className="text-xs text-gray-600 truncate">
                                {questionContent.question ||
                                  questionContent.text ||
                                  questionContent.prompt ||
                                  (question.type === "matching"
                                    ? `${questionContent.left?.length || 0} pairs: ${questionContent.left?.map((left: string, idx: number) => `${left} - ${questionContent.right?.[idx] || ''}`).join(', ')}`
                                    : question.type === "multiple_choice"
                                      ? questionContent.question_text ||
                                        "Multiple choice question"
                                      : question.type === 'short_answer'
                                        ? `Answer: ${questionContent.answer || 'No answer'}`
                                        : question.type === "multiple_selection"
                                          ? `${questionContent.options?.length || 0} options: ${questionContent.options?.map((opt: string, idx: number) => `${opt}`).join(', ')}`
                                          : "Question")}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteQuestion(question.id)}
                              className="ml-2 h-8 w-8 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );

                        currentQuestionNumber += questionsInThisItem;
                        return element;
                      });
                    })()
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question Modals */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          onPointerDown={(e) => {
            const dialog = e.currentTarget;
            dialog.style.cursor = "move";
          }}
          onPointerUp={(e) => {
            const dialog = e.currentTarget;
            dialog.style.cursor = "default";
          }}
        >
          <DialogHeader className="cursor-move">
            <DialogTitle className="select-none">
              🔧 Insert{" "}
              {currentQuestionType === "short_answer"
                ? "Short Answer"
                : currentQuestionType === "multiple_choice"
                  ? "Multiple Choice"
                  : currentQuestionType === "matching"
                    ? "Matching"
                                      : ""}{" "}
              Question
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Short Answer */}
            {currentQuestionType === "short_answer" && (
              <div className="space-y-4">
                <div>
                  <Label>Answers (one per line)</Label>
                  <Textarea
                    placeholder="round,wooden,25"
                    value={shortAnswers}
                    onChange={(e) => setShortAnswers(e.target.value)}
                    rows={5}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Each line will create a separate answer blank. Students will
                    see numbered input fields (1, 2, 3, etc.)
                  </p>
                </div>
              </div>
            )}

            {/* Multiple Choice */}
            {currentQuestionType === "multiple_choice" && (
              <div className="space-y-4">
                <div>
                  <Label>Question Text</Label>
                  <Input
                    placeholder="What is the capital of France?"
                    value={mcqQuestion}
                    onChange={(e) => setMcqQuestion(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Options</Label>
                  {mcqOptions.map((option, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 mt-2"
                    >
                      <input
                        type="radio"
                        name="correct"
                        checked={correctOption === index}
                        onChange={() => setCorrectOption(index)}
                        className="mt-0.5"
                      />
                      <Input
                        placeholder={`Option ${String.fromCharCode(65 + index)}`}
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...mcqOptions];
                          newOptions[index] = e.target.value;
                          setMcqOptions(newOptions);
                        }}
                        className="flex-1"
                      />
                      {mcqOptions.length > 2 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeMcqOption(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {mcqOptions.length < 6 && (
                    <Button size="sm" onClick={addMcqOption} className="mt-2">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Option
                    </Button>
                  )}
                </div>
                {optionError && (
                  <div className="text-red-500 text-sm mt-2">{optionError}</div>
                )}
              </div>
            )}

            {/* Matching */}
            {currentQuestionType === "matching" && (
              <div className="space-y-4">
                <div>
                  <Label>Matching Pairs</Label>
                  {matchingPairs.map((pair, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2 mt-2">
                      <Input
                        placeholder={`Item ${index + 1}`}
                        value={pair.left}
                        onChange={(e) =>
                          updateMatchingPair(index, "left", e.target.value)
                        }
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder={`Match ${index + 1}`}
                          value={pair.right}
                          onChange={(e) =>
                            updateMatchingPair(index, "right", e.target.value)
                          }
                          className="flex-1"
                        />
                        {matchingPairs.length > 1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeMatchingPair(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button size="sm" onClick={addMatchingPair} className="mt-2">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Pair
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Students will see the left items and drag the right items to
                  match them.
                </p>
              </div>
            )}

            {/* Map/Diagram modal removed */}

            {/* TFNG */}
            {currentQuestionType === "tfng" && (
              <div className="space-y-4">
                <div>
                  <Label>Question Text</Label>
                  <Input
                    placeholder="Enter the statement for TFNG"
                    value={tfngQuestion}
                    onChange={(e) => setTfngQuestion(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Options</Label>
                  {["TRUE", "FALSE", "NOT GIVEN"].map((option, index) => (
                    <div key={option} className="flex items-center space-x-2 mt-2">
                      <input
                        type="radio"
                        name="tfng-correct"
                        checked={tfngCorrectOption === index}
                        onChange={() => setTfngCorrectOption(index)}
                        className="mt-0.5"
                      />
                      <Input value={option} readOnly className="flex-1 bg-gray-100" />
                    </div>
                  ))}
                </div>
                {optionError && (
                  <div className="text-red-500 text-sm mt-2">{optionError}</div>
                )}
              </div>
            )}

            {/* Multiple Selection */}
            {currentQuestionType === "multiple_selection" && (
              <div className="space-y-4">
                <div>
                  <Label>Options (Check the correct answers)</Label>
                  {msOptions.map((option, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 mt-2"
                    >
                      <input
                        type="checkbox"
                        checked={msCorrectAnswers.includes(option)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMsCorrectAnswers([...msCorrectAnswers, option]);
                          } else {
                            setMsCorrectAnswers(msCorrectAnswers.filter(o => o !== option));
                          }
                        }}
                        className="mt-0.5"
                      />
                      <Input
                        placeholder={`Option ${String.fromCharCode(65 + index)}`}
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...msOptions];
                          newOptions[index] = e.target.value;
                          setMsOptions(newOptions);
                        }}
                        className="flex-1"
                      />
                      {msOptions.length > 2 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newOptions = msOptions.filter((_, i) => i !== index);
                            setMsOptions(newOptions);
                            // Remove this index from correct answers and adjust other indices
                            setMsCorrectAnswers(msCorrectAnswers
                              .filter(o => o !== option)
                            );
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {msOptions.length < 6 && (
                    <Button size="sm" onClick={addMsOption} className="mt-2">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Option
                    </Button>
                  )}
                </div>
                {optionError && (
                  <div className="text-red-500 text-sm mt-2">{optionError}</div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={insertQuestion}>Insert Question</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ReadingTestEditor;
