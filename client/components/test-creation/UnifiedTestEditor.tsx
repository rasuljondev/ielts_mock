import React, { useState, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
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
  Map,
  Table as TableIcon,
  Bold,
  Italic,
  Plus,
  X,
  Trash2,
  Grid3X3,
} from "lucide-react";
import { MapDiagramNode } from "./IELTSListeningEditor";
import { ShortAnswerNode } from './ShortAnswerNode';
import { MatchingNode } from './MatchingNode';
import { MapLabelNode } from './MapLabelNode';
import { MCQNode } from './MCQNode';

interface Question {
  id: string;
  type:
    | "short_answer"
    | "multiple_choice"
    | "matching"
    | "map_diagram"
    | "table";
  content: any;
  summary: string;
}

interface UnifiedTestEditorProps {
  onQuestionsChange?: (questions: Question[]) => void;
  placeholder?: string;
  initialContent?: any; // changed from string to any (TipTap JSON)
}

interface EditorQuestionMapping {
  questionId: string;
  editorPosition: number;
}

export function UnifiedTestEditor(
  props: UnifiedTestEditorProps & { content?: any; onContentChange?: (json: any) => void; questions?: Question[] }
) {
  const {
    onQuestionsChange,
    placeholder,
    initialContent,
    content,
    onContentChange,
    questions: controlledQuestions,
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
  const [showTablePicker, setShowTablePicker] = useState(false);
  // Remove local editorKey, use parent key for reset

  // Question form states
  const [shortAnswers, setShortAnswers] = useState("");
  const [mcqQuestion, setMcqQuestion] = useState("");
  const [mcqOptions, setMcqOptions] = useState(["", "", "", ""]);
  const [correctOption, setCorrectOption] = useState(0);
  const [matchingPairs, setMatchingPairs] = useState([{ left: "", right: "" }]);
  const [mapImageFiles, setMapImageFiles] = useState<MediaFile[]>([]);
  const [mapAnswers, setMapAnswers] = useState<string[]>([""]);
  const [mapBoxes, setMapBoxes] = useState<{ id: number; x: number; y: number; label: string; answer: string }[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: placeholder || "Start typing your question content...",
      }),
      MapDiagramNode, // <-- Add this line
      ShortAnswerNode,
      MatchingNode,
      MapLabelNode,
      MCQNode,
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
    if (editor && typeof content === 'string' && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

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
    setCurrentQuestionType(type);
    setShowModal(true);
    resetForms();
  };

  const resetForms = () => {
    setShortAnswers("");
    setMcqQuestion("");
    setMcqOptions(["", "", "", ""]);
    setCorrectOption(0);
    setMatchingPairs([{ left: "", right: "" }]);
    setMapImageFiles([]);
    setMapAnswers([""]);
    setMapBoxes([]);
  };

  // Calculate the next question number based on existing questions
  const getNextQuestionNumber = () => {
    if (questions.length === 0) return 1;
    
    let maxNumber = 0;
    questions.forEach(question => {
      if (question.type === "matching") {
        // For matching, count each pair as a separate question
        const pairCount = question.content.left?.length || 0;
        const startNumber = question.content.question_number || 0;
        maxNumber = Math.max(maxNumber, startNumber + pairCount - 1);
      } else if (question.type === "map_diagram") {
        // For map/diagram, count each label as a separate question
        const labelCount = question.content.boxes?.length || 0;
        const startNumber = question.content.question_number || 0;
        maxNumber = Math.max(maxNumber, startNumber + labelCount - 1);
      } else {
        // For other types, just use the question number
        maxNumber = Math.max(maxNumber, question.content.question_number || 0);
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

  const addMapAnswer = () => {
    setMapAnswers([...mapAnswers, ""]);
  };

  const removeMapAnswer = (index: number) => {
    if (mapAnswers.length > 1) {
      setMapAnswers(mapAnswers.filter((_, i) => i !== index));
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

    console.log("🔍 Inserting question type:", currentQuestionType);

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
          editor.chain().focus().insertContent({
            type: 'short_answer',
            attrs: {
              id,
              question_number,
              placeholder: `Answer ${question_number}`,
              answers: [answer], // <--- THIS IS THE FIX!
            },
          }).run();
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
        setQuestionCounter((prev) => prev + answers.length);
        setShowModal(false);
        setCurrentQuestionType(null);
        resetForms();
        return;
      }
      case "multiple_choice": {
        if (!mcqQuestion.trim() || mcqOptions.filter((opt) => opt.trim()).length < 2) return;
        const validOptions = mcqOptions.filter((opt) => opt.trim());
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
        editor.chain().focus().insertContent({
          type: 'matching',
          attrs: {
            id,
            question_number: nextQuestionNumber,
            left,
            right,
          },
        }).run();
        
        // Add single question to questions array
        const newQuestion = {
          id,
          type: "matching" as const,
          content: {
            left,
            right,
            question_number: nextQuestionNumber,
          },
          summary: `Matching ${nextQuestionNumber}: ${validPairs.map(pair => `${pair.left} - ${pair.right}`).join(', ')}`,
        } as Question;
        
        console.log("🔍 Matching Question Array:", newQuestion);
        
        const updatedQuestions = [...questions, newQuestion];
        setQuestions(updatedQuestions);
        if (onQuestionsChange) onQuestionsChange(updatedQuestions);
        setQuestionCounter((prev) => prev + left.length);
        setShowModal(false);
        setCurrentQuestionType(null);
        resetForms();
        return;
      }
      case "map_diagram": {
        if (mapImageFiles.length === 0) return;
        
        // Create one question containing all labels
        const id = `map_${Date.now()}`;
        const nextQuestionNumber = getNextQuestionNumber();
        
        console.log("🔍 Map Diagram Debug:", {
          imageFiles: mapImageFiles,
          boxes: mapBoxes,
          questionNumber: nextQuestionNumber
        });
        
        // Insert single custom node with all boxes and one image
        editor.chain().focus().insertContent({
          type: 'map_labeling',
          attrs: {
            id,
            question_number: nextQuestionNumber,
            imageUrl: mapImageFiles[0].url,
            boxes: mapBoxes,
          },
        }).run();
        
        // Add single question to questions array
        const newQuestion = {
          id,
          type: "map_diagram" as const,
          content: {
            imageUrl: mapImageFiles[0].url,
            boxes: mapBoxes,
            question_number: nextQuestionNumber,
          },
          summary: `Map ${nextQuestionNumber}: ${mapBoxes.map(box => box.answer || 'No answer').join(', ')}`,
        } as Question;
        
        console.log("🔍 Map Diagram Question Array:", newQuestion);
        
        const updatedQuestions = [...questions, newQuestion];
        setQuestions(updatedQuestions);
        if (onQuestionsChange) onQuestionsChange(updatedQuestions);
        setQuestionCounter((prev) => prev + mapBoxes.length);
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

    // Update parent content state after deletion
    if (onContentChange) {
      onContentChange(editor.getJSON());
    }

    // Recalculate question counter
    let totalQuestions = 1;
    updatedQuestions.forEach((q) => {
      if (q.type === "matching") {
        totalQuestions += q.content.left?.length || 1;
      } else if (q.type === "short_answer") {
        totalQuestions += q.content.answers?.length || 1;
      } else {
        totalQuestions += 1;
      }
    });
    setQuestionCounter(totalQuestions);
  };

  const insertTable = (rows: number, cols: number) => {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: false })
      .run();
    setShowTablePicker(false);
  };

  const TablePicker = () => {
    const [hoveredCell, setHoveredCell] = useState({ row: 0, col: 0 });

    return (
      <div className="absolute top-full left-0 mt-2 bg-white border rounded-lg shadow-lg p-3 z-50 min-w-[180px] min-h-[120px] w-auto" style={{ width: 'max-content' }}>
        <div className="text-sm font-medium mb-2">Insert Table</div>
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: 64 }, (_, i) => {
            const row = Math.floor(i / 8);
            const col = i % 8;
            const isHovered = row <= hoveredCell.row && col <= hoveredCell.col;

            return (
              <div
                key={i}
                className={`border cursor-pointer ${
                  isHovered
                    ? "bg-blue-200 border-blue-400"
                    : "bg-gray-50 border-gray-300"
                }`}
                style={{ width: "28px", height: "28px", aspectRatio: "1" }}
                onMouseEnter={() => setHoveredCell({ row, col })}
                onClick={() =>
                  insertTable(hoveredCell.row + 1, hoveredCell.col + 1)
                }
              />
            );
          })}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {hoveredCell.row + 1} × {hoveredCell.col + 1}
        </div>
      </div>
    );
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
                  {/* Question Type Buttons - Reordered with Table first */}

                  {/* Table Button - Moved to first position */}
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTablePicker(!showTablePicker)}
                      className="flex items-center gap-2"
                    >
                      <TableIcon className="h-4 w-4" />
                      Table
                    </Button>
                    {showTablePicker && <TablePicker />}
                  </div>

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
                    onClick={() => openQuestionModal("map_diagram")}
                    className="flex items-center gap-2"
                  >
                    <Map className="h-4 w-4" />
                    Map/Diagram
                  </Button>

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

                        if (question.type === "matching") {
                          questionsInThisItem = question.content.left?.length || 1;
                          displayNumber = questionsInThisItem === 1 
                            ? `Q${question.content.question_number}` 
                            : `Q${question.content.question_number}-${question.content.question_number + questionsInThisItem - 1}`;
                        } else if (question.type === "short_answer") {
                          questionsInThisItem = 1; // Each short answer is now individual
                          displayNumber = `Q${question.content.question_number || currentQuestionNumber}`;
                        } else if (question.type === "map_diagram") {
                          questionsInThisItem = question.content.boxes?.length || 1;
                          displayNumber = questionsInThisItem === 1 
                            ? `Q${question.content.question_number}` 
                            : `Q${question.content.question_number}-${question.content.question_number + questionsInThisItem - 1}`;
                        } else {
                          displayNumber = `Q${question.content.question_number || currentQuestionNumber}`;
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
                                {question.content.question ||
                                  question.content.text ||
                                  question.content.prompt ||
                                  (question.type === "matching"
                                    ? `${question.content.left?.length || 0} pairs: ${question.content.left?.map((left: string, idx: number) => `${left} - ${question.content.right?.[idx] || ''}`).join(', ')}`
                                    : question.type === "multiple_choice"
                                      ? question.content.question_text ||
                                        "Multiple choice question"
                                      : question.type === 'short_answer'
                                        ? `Answer: ${question.content.answer || 'No answer'}`
                                        : question.type === 'map_diagram'
                                          ? `Map label: ${question.content.boxes?.map((box: any) => box.answer || 'No answer').join(', ') || 'No answers'}`
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
                    : currentQuestionType === "map_diagram"
                      ? "Map/Diagram"
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

            {/* Map/Diagram */}
            {currentQuestionType === "map_diagram" && (
              <div className="space-y-4">
                <div>
                  <Label>Upload Image</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const uploadedUrl = await uploadFile(file, "image");
                            setMapImageFiles([
                              {
                                id: Date.now().toString(),
                                url: uploadedUrl,
                                name: file.name,
                                type: "image",
                                size: file.size,
                                file: file,
                                uploaded: true,
                              },
                            ]);
                          } catch (error) {
                            console.error("Upload failed:", error);
                            const localUrl = URL.createObjectURL(file);
                            setMapImageFiles([
                              {
                                id: Date.now().toString(),
                                url: localUrl,
                                name: file.name,
                                type: "image",
                                size: file.size,
                                file: file,
                                uploaded: false,
                              },
                            ]);
                          }
                        }
                      }}
                      className="w-full"
                    />
                  </div>
                </div>
                {mapImageFiles.length > 0 && (
                  <div>
                    <Label>Click on the image to place answer boxes</Label>
                    <div className="relative inline-block">
                      <img
                        src={mapImageFiles[0].url}
                        alt="Preview"
                        className="max-w-full h-auto border rounded mt-2"
                        style={{ cursor: "crosshair" }}
                        onClick={(e) => {
                          let rect: DOMRect | undefined;
                          if (e.target && e.target instanceof HTMLImageElement) {
                            rect = e.target.getBoundingClientRect();
                          } else {
                            return;
                          }
                          const x = ((e.clientX - rect.left) / rect.width) * 100;
                          const y = ((e.clientY - rect.top) / rect.height) * 100;
                          const nextQuestionNumber = questionCounter + mapBoxes.length;
                          const newBox = {
                            id: Date.now(),
                            x,
                            y,
                            label: `${nextQuestionNumber}`,
                            answer: "",
                          };
                          setMapBoxes([...mapBoxes, newBox]);
                        }}
                      />
                      {mapBoxes.map((box, idx) => (
                        <div
                          key={box.id}
                          className="absolute bg-blue-600 text-white rounded px-1 py-1 text-xs font-bold"
                          style={{
                            left: `${box.x}%`,
                            top: `${box.y}%`,
                            transform: "translate(-50%, -50%)",
                            minWidth: "60px",
                            textAlign: "center",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            // Remove box on click
                            setMapBoxes(mapBoxes.filter((b) => b.id !== box.id));
                          }}
                        >
                          {box.label}
                        </div>
                      ))}
                    </div>
                    {mapBoxes.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <h4 className="font-semibold text-sm text-gray-700">Box Labels and Answers:</h4>
                        {mapBoxes.map((box, idx) => (
                          <div key={box.id} className="flex items-center gap-2 mb-2">
                            <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold min-w-[30px] text-center">{box.label}</span>
                            <Input
                              type="text"
                              value={box.answer || ""}
                              onChange={(e) => {
                                const updated = mapBoxes.map((b) =>
                                  b.id === box.id ? { ...b, answer: e.target.value } : b,
                                );
                                setMapBoxes(updated);
                              }}
                              className="border rounded px-2 py-1 text-xs flex-1"
                              placeholder="Enter correct answer"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setMapBoxes(mapBoxes.filter((b) => b.id !== box.id))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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

export default UnifiedTestEditor;
