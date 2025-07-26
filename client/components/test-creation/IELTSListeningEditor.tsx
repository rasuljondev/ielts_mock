import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Headphones } from "lucide-react";
import { EditorContent, useEditor, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper } from "@tiptap/react";
import Heading from "@tiptap/extension-heading";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { MediaUploader, MediaFile } from "@/components/ui/media-uploader";
import { uploadFile } from "@/lib/uploadUtils";
import { EnhancedStudentTestPreview } from "@/components/ui/enhanced-student-test-preview";
import { sampleListeningContent, sampleMixedContent, demonstrateParsing } from "@/lib/listeningTestExamples";
import { parseContentForStudent, extractAnswersFromContent } from "@/lib/contentParser";

// --- MCQ Node ---
const MCQComponent = (props) => {
  const { node, updateAttributes, editor, getPos } = props;
  const {
    text = "",
    options = ["", "", "", ""],
    correctIndex = 0,
    admin = true,
    number = 1,
  } = node.attrs;
  // Edit handler: open MCQ dialog with current values
  const handleEdit = () => {
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent("tiptap-mcq-edit", {
          detail: { pos: getPos(), attrs: node.attrs },
        }),
      );
    }
  };
  // Delete handler: remove node
  const handleDelete = () => {
    editor
      .chain()
      .focus()
      .deleteRange({ from: getPos(), to: getPos() + node.nodeSize })
      .run();
  };
  return (
    <NodeViewWrapper
      as="div"
      contentEditable={false}
      className="bg-white border border-gray-300 shadow-md rounded-xl p-5 my-6 relative flex flex-col gap-2"
    >
      {admin && (
        <div className="absolute top-2 right-3 flex gap-2 z-10">
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline"
            onClick={handleEdit}
          >
            Edit
          </button>
          <button
            type="button"
            className="text-xs text-red-600 hover:underline"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      )}
      <div className="font-semibold text-lg mb-2">
        Q{number}. {text}
      </div>
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              admin && correctIndex === idx
                ? "bg-green-50"
                : "bg-gray-50 hover:bg-gray-100"
            }`}
          >
            {admin ? (
              <input type="radio" disabled checked={correctIndex === idx} />
            ) : (
              <input
                type="radio"
                name={`mcq-${number}`}
                onChange={() => {}}
                className="w-4 h-4 text-blue-600"
              />
            )}
            <span className="text-base">{opt}</span>
            {admin && correctIndex === idx && (
              <span className="text-green-600 text-xs ml-2">(Correct)</span>
            )}
          </div>
        ))}
      </div>
    </NodeViewWrapper>
  );
};

const MCQNode = Node.create({
  name: "mcq",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      text: { default: "" },
      options: { default: ["", "", "", ""] },
      correctIndex: { default: 0 },
      admin: { default: true },
      number: { default: 1 },
    };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-type='mcq']",
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "mcq" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MCQComponent);
  },
});

// --- Short Answer Node ---
const ShortAnswerComponent = (props) => {
  const { node, updateAttributes, editor, getPos } = props;
  const { answers = [""], admin = true, number = 1 } = node.attrs;

  // Ensure answers is always an array with at least one element
  const safeAnswers =
    Array.isArray(answers) && answers.length > 0 ? answers : [""];
  // Delete handler: remove node
  const handleDelete = () => {
    editor
      .chain()
      .focus()
      .deleteRange({ from: getPos(), to: getPos() + node.nodeSize })
      .run();
  };
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className="inline-block align-middle relative"
    >
      {admin && (
        <button
          type="button"
          className="absolute -top-2 right-0 text-xs text-red-600 hover:underline z-10"
          onClick={handleDelete}
        >
          ×
        </button>
      )}
      {admin ? (
        <span className="inline-flex items-center gap-1">
          <span className="border-b border-blue-400 px-2 mx-1 text-blue-700 bg-blue-50 rounded min-w-[40px] text-center font-bold text-lg shadow-sm">[{safeAnswers.join(", ")}]</span>
          <span className="text-xs text-gray-500">Q{number}: {safeAnswers.join(", ")}</span>
        </span>
      ) : (
        <input
          type="text"
          placeholder={`Answer ${number}`}
          className="inline-flex items-center border-b-2 border-gray-800 px-2 py-1 min-w-[60px] bg-transparent text-center font-bold text-lg focus:outline-none focus:bg-blue-50"
        />
      )}
    </NodeViewWrapper>
  );
};

const ShortAnswerNode = Node.create({
  name: "short_answer",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      answers: { default: [""] },
      admin: { default: true },
      number: { default: 1 },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-type='short-answer']",
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "short-answer" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ShortAnswerComponent);
  },
});

// --- Map/Diagram Node ---
const MapDiagramComponent = (props) => {
  const { node, updateAttributes, editor, getPos } = props;
  const {
    imageUrl = "",
    boxes = [],
    admin = true,
    number = 1,
    questionCount = 1,
  } = node.attrs;
  const [localBoxes, setLocalBoxes] = useState(boxes);
  const imageRef = useRef(null);

  // Add box on image click
  const handleImageClick = (e) => {
    if (!admin) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newBox = {
      id: Date.now(),
      x,
      y,
      answer: "",
    };
    const updated = [...localBoxes, newBox];
    setLocalBoxes(updated);
    updateAttributes({ boxes: updated });
  };

  // Update answer for a box
  const handleBoxAnswerChange = (id, value) => {
    const updated = localBoxes.map((b) =>
      b.id === id ? { ...b, answer: value } : b,
    );
    setLocalBoxes(updated);
    updateAttributes({ boxes: updated });
  };
  // Remove a box
  const handleRemoveBox = (id) => {
    const updated = localBoxes.filter((b) => b.id !== id);
    setLocalBoxes(updated);
    updateAttributes({ boxes: updated });
  };
  // Delete handler: remove node
  const handleDelete = () => {
    editor
      .chain()
      .focus()
      .deleteRange({ from: getPos(), to: getPos() + node.nodeSize })
      .run();
  };
  return (
    <NodeViewWrapper
      as="div"
      contentEditable={false}
      className="bg-white border border-gray-300 shadow-md rounded-xl p-5 my-6 relative flex flex-col gap-2"
    >
      {admin && (
        <button
          type="button"
          className="absolute top-2 right-3 text-xs text-red-600 hover:underline z-10"
          onClick={handleDelete}
        >
          Delete
        </button>
      )}
      <div className="font-semibold text-lg mb-2">
        {questionCount > 1
          ? `Q${number}-Q${number + questionCount - 1}`
          : `Q${number}`}
        . Map/Diagram Labeling
      </div>
      {imageUrl ? (
        <div className="relative inline-block">
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Map/Diagram"
            className="max-w-full rounded-lg border"
            onClick={handleImageClick}
            style={{ cursor: admin ? "crosshair" : "default" }}
          />
          {localBoxes.map((box, idx) => (
            <div
              key={box.id}
              className="absolute bg-blue-100 border-2 border-blue-400 rounded w-16 h-8 flex items-center justify-center text-xs font-bold"
              style={{
                left: `${box.x}%`,
                top: `${box.y}%`,
                transform: "translate(-50%, -50%)",
                minWidth: "60px",
                textAlign: "center",
              }}
            >
              {/* Show nothing in the box itself */}
              {admin && (
                <button
                  type="button"
                  className="absolute -top-2 -right-2 text-xs text-red-600 hover:underline z-10 bg-white rounded-full px-1"
                  onClick={() => handleRemoveBox(box.id)}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {/* Admin: Only answer input below the image for each box */}
          {admin && localBoxes.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="font-semibold text-sm text-gray-700">
                Box Answers:
              </h4>
              {localBoxes.map((box, idx) => (
                <div key={box.id} className="border rounded p-3 bg-gray-50 flex items-center gap-2">
                  <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    value={box.answer || ""}
                    onChange={(e) => handleBoxAnswerChange(box.id, e.target.value)}
                    className="border rounded px-2 py-1 text-xs flex-1"
                    placeholder="Correct answer"
                  />
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-600 ml-2"
                    onClick={() => handleRemoveBox(box.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-gray-500">No image uploaded.</div>
      )}
    </NodeViewWrapper>
  );
};

const MapDiagramNode = Node.create({
  name: "map_diagram",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      imageUrl: { default: "" },
      boxes: { default: [] },
      admin: { default: true },
      number: { default: 1 },
      questionCount: { default: 1 },
    };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-type='map-diagram']",
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "map-diagram" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MapDiagramComponent);
  },
});

// --- Sentence Completion Node ---
const SentenceCompletionComponent = (props) => {
  const { node, updateAttributes, editor, getPos } = props;
  const { prompt = "", answers = [""], admin = true, number = 1 } = node.attrs;
  const [localPrompt, setLocalPrompt] = useState(prompt || "");
  const [localAnswers, setLocalAnswers] = useState(
    Array.isArray(answers) && answers.length > 0 ? answers : [""],
  );
  // Update prompt
  const handlePromptChange = (e) => {
    setLocalPrompt(e.target.value);
    updateAttributes({ prompt: e.target.value, answers: localAnswers });
  };
  // Update answer
  const handleAnswerChange = (idx, value) => {
    const updated = [...localAnswers];
    updated[idx] = value;
    setLocalAnswers(updated);
    updateAttributes({ prompt: localPrompt, answers: updated });
  };
  // Add answer
  const handleAddAnswer = () => {
    const updated = [...localAnswers, ""];
    setLocalAnswers(updated);
    updateAttributes({ prompt: localPrompt, answers: updated });
  };
  // Remove answer
  const handleRemoveAnswer = (idx) => {
    const updated = localAnswers.filter((_, i) => i !== idx);
    setLocalAnswers(updated);
    updateAttributes({ prompt: localPrompt, answers: updated });
  };
  // Delete handler: remove node
  const handleDelete = () => {
    editor
      .chain()
      .focus()
      .deleteRange({ from: getPos(), to: getPos() + node.nodeSize })
      .run();
  };
  return (
    <NodeViewWrapper
      as="div"
      contentEditable={false}
      className="bg-white border border-gray-300 shadow-md rounded-xl p-5 my-6 flex flex-col gap-2 relative"
    >
      {admin && (
        <button
          type="button"
          className="absolute top-2 right-3 text-xs text-red-600 hover:underline z-10"
          onClick={handleDelete}
        >
          Delete
        </button>
      )}
      <div className="font-semibold text-lg mb-2">
        Q{number}. Sentence Completion
      </div>
      {admin ? (
        <>
          <input
            type="text"
            value={localPrompt}
            onChange={handlePromptChange}
            className="w-full border rounded px-2 py-1 mb-2"
            placeholder="Prompt (e.g., The capital of France is ...)"
          />
          {localAnswers.map((ans, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-1">
              <input
                type="text"
                value={ans || ""}
                onChange={(e) => handleAnswerChange(idx, e.target.value)}
                className="border-b border-blue-400 px-2 text-blue-700 bg-blue-50 rounded min-w-[60px] text-center font-semibold shadow-sm"
                placeholder={`Answer ${idx + 1}`}
              />
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={() => handleRemoveAnswer(idx)}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline mt-1"
            onClick={handleAddAnswer}
          >
            + Add Answer
          </button>
        </>
      ) : (
        <div>
          <div className="mb-2">{prompt}</div>
          {answers.map((_, idx) => (
            <input
              key={idx}
              type="text"
              className="border-b border-gray-400 px-2 mx-1 min-w-[60px] text-center font-semibold shadow-sm"
              placeholder={`[ ${idx + 1} ]`}
            />
          ))}
        </div>
      )}
    </NodeViewWrapper>
  );
};
const SentenceCompletionNode = Node.create({
  name: "sentence_completion",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      prompt: { default: "" },
      answers: { default: [""] },
      admin: { default: true },
      number: { default: 1 },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-type='sentence-completion']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "sentence-completion" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SentenceCompletionComponent);
  },
});

// --- Matching Node ---
const MatchingComponent = (props) => {
  const { node, updateAttributes, editor, getPos } = props;
  const { left = [""], right = [""], admin = true, number = 1 } = node.attrs;
  const [localLeft, setLocalLeft] = useState(
    Array.isArray(left) && left.length > 0 ? left : [""],
  );
  const [localRight, setLocalRight] = useState(
    Array.isArray(right) && right.length > 0 ? right : [""],
  );
  // For student drag-and-drop
  const [studentMatches, setStudentMatches] = useState(
    Array(left.length).fill(null),
  );
  const [availableAnswers, setAvailableAnswers] = useState(() =>
    admin ? [] : shuffleArray(right),
  );

  // Shuffle utility
  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Update left/right
  const handleLeftChange = (idx, value) => {
    const updated = [...localLeft];
    updated[idx] = value;
    setLocalLeft(updated);
    updateAttributes({ left: updated, right: localRight });
  };
  const handleRightChange = (idx, value) => {
    const updated = [...localRight];
    updated[idx] = value;
    setLocalRight(updated);
    updateAttributes({ left: localLeft, right: updated });
  };
  // Add/remove
  const handleAddPair = () => {
    const updatedLeft = [...localLeft, ""];
    const updatedRight = [...localRight, ""];
    setLocalLeft(updatedLeft);
    setLocalRight(updatedRight);
    updateAttributes({ left: updatedLeft, right: updatedRight });
  };
  const handleRemovePair = (idx) => {
    const updatedLeft = localLeft.filter((_, i) => i !== idx);
    const updatedRight = localRight.filter((_, i) => i !== idx);
    setLocalLeft(updatedLeft);
    setLocalRight(updatedRight);
    updateAttributes({ left: updatedLeft, right: updatedRight });
  };

  // Drag-and-drop handlers (student mode)
  const handleDragStart = (e, answer) => {
    e.dataTransfer.setData("text/plain", answer);
  };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    const answer = e.dataTransfer.getData("text/plain");
    // Remove from availableAnswers, set in studentMatches
    setAvailableAnswers((prev) => prev.filter((a) => a !== answer));
    setStudentMatches((prev) => {
      const updated = [...prev];
      updated[idx] = answer;
      return updated;
    });
  };
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  // Allow removing an answer from a slot
  const handleRemoveMatch = (idx) => {
    setAvailableAnswers((prev) => [...prev, studentMatches[idx]]);
    setStudentMatches((prev) => {
      const updated = [...prev];
      updated[idx] = null;
      return updated;
    });
  };

  // Delete handler: remove node
  const handleDelete = () => {
    editor
      .chain()
      .focus()
      .deleteRange({ from: getPos(), to: getPos() + node.nodeSize })
      .run();
  };
  return (
    <NodeViewWrapper
      as="div"
      contentEditable={false}
      className="bg-white border border-gray-300 shadow-md rounded-xl p-5 my-6 flex flex-col gap-2 relative"
    >
      {admin && (
        <button
          type="button"
          className="absolute top-2 right-3 text-xs text-red-600 hover:underline z-10"
          onClick={handleDelete}
        >
          Delete
        </button>
      )}
      <div className="font-semibold text-lg mb-2">Q{number}. Matching</div>
      {admin ? (
        <>
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div className="font-semibold">Prompt</div>
            <div className="font-semibold">Answer</div>
            {localLeft.map((l, idx) => (
              <React.Fragment key={idx}>
                <input
                  type="text"
                  value={l || ""}
                  onChange={(e) => handleLeftChange(idx, e.target.value)}
                  className="border-b border-blue-400 px-2 text-blue-700 bg-blue-50 rounded min-w-[60px] text-center font-semibold shadow-sm"
                  placeholder={`Prompt ${idx + 1}`}
                />
                <input
                  type="text"
                  value={localRight[idx] || ""}
                  onChange={(e) => handleRightChange(idx, e.target.value)}
                  className="border-b border-green-400 px-2 text-green-700 bg-green-50 rounded min-w-[60px] text-center font-semibold shadow-sm"
                  placeholder={`Answer ${idx + 1}`}
                />
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline col-span-2"
                  onClick={() => handleRemovePair(idx)}
                >
                  ×
                </button>
              </React.Fragment>
            ))}
          </div>
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline mt-1"
            onClick={handleAddPair}
          >
            + Add Pair
          </button>
        </>
      ) : (
        <div className="space-y-4">
          {/* Instructions */}
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
            Drag and drop the correct answers into the empty boxes.
          </div>

          {/* Matching items */}
          <div className="space-y-3">
            {left.map((prompt, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="flex-1 font-medium text-gray-800">{prompt}</div>
                <div
                  className="w-32 h-10 border-2 border-dashed border-gray-300 rounded flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors"
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragOver={handleDragOver}
                >
                  {studentMatches[idx] ? (
                    <div className="flex items-center gap-1 text-sm font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
                      {studentMatches[idx]}
                      <button
                        onClick={() => handleRemoveMatch(idx)}
                        className="text-red-500 hover:text-red-700 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">Drop here</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Answer options */}
          <div className="border-t pt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Answer Options:
            </div>
            <div className="flex flex-wrap gap-2">
              {availableAnswers.map((answer, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, answer)}
                  className="bg-green-100 text-green-800 px-3 py-2 rounded cursor-move hover:bg-green-200 transition-colors border border-green-300 text-sm font-medium"
                >
                  {answer}
                </div>
              ))}
            </div>
            {availableAnswers.length === 0 && (
              <div className="text-gray-400 text-sm italic">
                All answers have been used
              </div>
            )}
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
};

const MatchingNode = Node.create({
  name: "matching",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      left: { default: [""] },
      right: { default: [""] },
      admin: { default: true },
      number: { default: 1 },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-type='matching']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "matching" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MatchingComponent);
  },
});

// --- Auto-number all questions in the editor ---
const autoNumberQuestions = (editor: any) => {
  if (!editor) return;

  let questionNumber = 1;
  const { state } = editor;
  const { tr } = state;
  let hasChanges = false;

  state.doc.descendants((node, pos) => {
    if (
      [
        "mcq",
        "short_answer",
        "map_diagram",
        "sentence_completion",
        "matching",
      ].includes(node.type.name)
    ) {
      const currentNumber = node.attrs.number;
      const questionCount = node.attrs.questionCount || 1;

      if (currentNumber !== questionNumber) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          number: questionNumber,
        });
        hasChanges = true;
      }

      questionNumber += questionCount;
    }
  });

  if (hasChanges) {
    editor.view.dispatch(tr);
  }
};

// Helper function to extract questions from TipTap content
const extractQuestionsFromContent = (content: any): any[] => {
  const questions: any[] = [];

  const traverse = (node: any) => {
    if (
      node.type &&
      [
        "mcq",
        "short_answer",
        "map_diagram",
        "sentence_completion",
        "matching",
      ].includes(node.type)
    ) {
      // Convert TipTap node to database-compatible question format
      const dbTypeMap: { [key: string]: string } = {
        "mcq": "mcq",
        "short_answer": "text",
        "sentence_completion": "form",
        "matching": "matching",
        "map_diagram": "form"
      };

      const dbType = dbTypeMap[node.type] || "text";

      let question: any = {
        id: `${dbType}_${node.attrs?.number || questions.length + 1}`,
        type: dbType, // Use database-compatible type
        text: node.attrs?.text || node.attrs?.prompt || "",
        points: 1,
        position: node.attrs?.number || questions.length + 1,
      };

      if (node.type === "mcq") {
        question.options = node.attrs?.options || [];
        question.correctAnswer = node.attrs?.correctIndex || 0;
      } else if (node.type === "short_answer") {
        question.correctAnswer = node.attrs?.answers || [""];
      } else if (node.type === "sentence_completion") {
        question.correctAnswer = node.attrs?.answers || [""];
        question.text = node.attrs?.prompt || "";
      } else if (node.type === "matching") {
        question.correctAnswer = {
          left: node.attrs?.left || [],
          right: node.attrs?.right || [],
        };
      } else if (node.type === "map_diagram") {
        question.correctAnswer = node.attrs?.boxes || [];
        question.imageUrl = node.attrs?.imageUrl || "";
        question.questionCount = node.attrs?.questionCount || 1;

        // If this map represents multiple questions, create multiple question entries
        if (node.attrs?.questionCount > 1) {
          for (let i = 1; i < node.attrs.questionCount; i++) {
            questions.push({
              ...question,
              id: `${node.type}_${node.attrs?.number + i}`,
              position: node.attrs?.number + i,
            });
          }
        }
      }

      questions.push(question);
    }

    if (node.content) {
      node.content.forEach(traverse);
    }
  };

  if (content && content.content) {
    content.content.forEach(traverse);
  }

  return questions;
};




// --- Main Editor ---
interface IELTSListeningEditorProps {
  admin?: boolean;
  onSave?: (content: any, audioUrl?: string) => void;
  // Legacy props for compatibility
  testType?: string;
  sectionNumber?: string;
  initialContent?: any;
  onContentChange?: (content: any) => void;
  onAudioChange?: (audioUrl: string) => void; // <-- add this
}

const IELTSListeningEditor: React.FC<IELTSListeningEditorProps> = ({
  admin = true,
  onSave,
  testType,
  sectionNumber,
  initialContent,
  onContentChange,
  onAudioChange, // <-- add this
}) => {
  const [showMCQDialog, setShowMCQDialog] = useState(false);
  const [mcqEditPos, setMcqEditPos] = useState(null);
  const [mcqEditAttrs, setMcqEditAttrs] = useState(null);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [mapImageUrl, setMapImageUrl] = useState("");
  const [mapQuestionCount, setMapQuestionCount] = useState(1);
  const [showSentenceDialog, setShowSentenceDialog] = useState(false);
  const [showMatchingDialog, setShowMatchingDialog] = useState(false);
  const [showTableGridPicker, setShowTableGridPicker] = useState(false);
  const [showStudentPreview, setShowStudentPreview] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [mapUploading, setMapUploading] = useState(false);
  const [forceReload, setForceReload] = useState(0); // for discarding draft
  const isSavingRef = useRef(false);

  // Content persistence helper function
  const getStorageKey = () => `ielts-editor-${testType || 'default'}-${sectionNumber || 'default'}`;

  // --- Editor instance ---
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          "Type your listening test content here. Use the toolbar to insert questions.",
      }),
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      MCQNode,
      ShortAnswerNode,
      MapDiagramNode,
      SentenceCompletionNode,
      MatchingNode,
    ],
    editorProps: {
      attributes: {
        class: "min-h-[300px] border rounded p-2 bg-white",
      },
    },
    editable: admin,
    content: (() => {
      if (typeof window !== 'undefined') {
        const storageKey = getStorageKey();
        const savedContent = localStorage.getItem(storageKey);
        if (savedContent) {
          try {
            return JSON.parse(savedContent);
          } catch {}
        }
      }
      return initialContent || "";
    })(),
    onUpdate: ({ editor }) => {
      if (onContentChange) {
        const content = editor.getJSON();
        const questions = extractQuestionsFromContent(content);
        onContentChange && onContentChange(content);
      }
      // Save to localStorage on every update
      if (typeof window !== 'undefined') {
        const storageKey = getStorageKey();
        const content = editor.getJSON();
        localStorage.setItem(storageKey, JSON.stringify(content));
      }
    },
  }, [forceReload]);

  // Discard local draft and reload with initialContent
  const discardLocalDraft = () => {
    if (typeof window !== 'undefined') {
      const storageKey = getStorageKey();
      localStorage.removeItem(storageKey);
      setForceReload((v) => v + 1);
    }
  };

  React.useEffect(() => {
    if (!admin) return;
    const handler = (e) => {
      setMcqEditPos(e.detail.pos);
      setMcqEditAttrs(e.detail.attrs);
      setShowMCQDialog(true);
    };
    window.addEventListener("tiptap-mcq-edit", handler);
    return () => window.removeEventListener("tiptap-mcq-edit", handler);
  }, [admin]);

  // Insert MCQ block (or update if editing)
  const insertMCQ = (text, options, correctIndex) => {
    // Get next question number
    const doc = editor.state.doc;
    const usedNumbers = new Set();
    doc.descendants((node) => {
      if (
        [
          "mcq",
          "short_answer",
          "map_diagram",
          "sentence_completion",
          "matching",
        ].includes(node.type.name)
      ) {
        usedNumbers.add(node.attrs.number);
      }
    });
    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) {
      nextNumber++;
    }

    if (mcqEditPos !== null && mcqEditAttrs) {
      // Update existing node
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.setNodeMarkup(mcqEditPos, undefined, {
            ...mcqEditAttrs,
            text,
            options,
            correctIndex,
          });
          return true;
        })
        .run();
      setMcqEditPos(null);
      setMcqEditAttrs(null);
    } else {
      // Insert new node
      editor
        .chain()
        .focus()
        .insertContent({
          type: "mcq",
          attrs: {
            text,
            options,
            correctIndex,
            admin,
            number: nextNumber,
          },
        })
        .run();

      // Auto-number all questions after insertion
      setTimeout(() => autoNumberQuestions(editor), 100);
    }
  };

  // Insert Short Answer inline with auto-numbering (fill gaps)
  const insertShortAnswer = (correctAnswer = "") => {
    // Find all used numbers
    const doc = editor.state.doc;
    const usedNumbers = new Set();
    doc.descendants((node) => {
      if (
        [
          "mcq",
          "short_answer",
          "map_diagram",
          "sentence_completion",
          "matching",
        ].includes(node.type.name)
      ) {
        usedNumbers.add(node.attrs.number);
      }
    });
    // Find the lowest available number
    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) {
      nextNumber++;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: "short_answer",
        attrs: { answers: [correctAnswer], admin, number: nextNumber },
      })
      .run();

    // Auto-number all questions after insertion
    setTimeout(() => autoNumberQuestions(editor), 100);
  };

  // Insert Map/Diagram block
  const insertMapDiagram = (imageUrl, questionCount = 1) => {
    // Get next question number
    const doc = editor.state.doc;
    const usedNumbers = new Set();
    doc.descendants((node) => {
      if (
        [
          "mcq",
          "short_answer",
          "map_diagram",
          "sentence_completion",
          "matching",
        ].includes(node.type.name)
      ) {
        usedNumbers.add(node.attrs.number);
      }
    });
    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) {
      nextNumber++;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: "map_diagram",
        attrs: {
          imageUrl,
          boxes: [],
          admin,
          number: nextNumber,
          questionCount,
        },
      })
      .run();

    // Auto-number all questions after insertion
    setTimeout(() => autoNumberQuestions(editor), 100);
  };

  // Add global styles for table visibility at the top-level of the component
  if (
    typeof window !== "undefined" &&
    !document.getElementById("tiptap-table-styles")
  ) {
    const style = document.createElement("style");
    style.id = "tiptap-table-styles";
    style.innerHTML = `
      .ProseMirror {
        min-height: 300px;
        background: #fff;
        padding: 12px;
        border-radius: 8px;
      }
      .ProseMirror table {
        border-collapse: collapse;
        width: 100%;
        background: #fff;
        margin: 8px 0;
        box-shadow: 0 1px 4px 0 #e5e7eb;
      }
      .ProseMirror td, .ProseMirror th {
        border: 2px solid #3b82f6;
        padding: 8px 10px;
        min-width: 48px;
        background: #fff;
        font-size: 1rem;
        position: relative;
      }
      .ProseMirror th {
        font-weight: bold;
      }
      .ProseMirror .tableWrapper {
        overflow-x: auto;
      }
      .ProseMirror .selectedCell {
        outline: 3px solid #2563eb;
        outline-offset: -2px;
        background: #e0e7ff;
      }
      .ProseMirror .column-resize-handle {
        position: absolute;
        right: -4px;
        top: 0;
        bottom: 0;
        width: 8px;
        background: #3b82f6;
        cursor: col-resize;
        z-index: 10;
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }

  // Media upload handlers
  const handleMediaUpload = (files: MediaFile[]) => {
    console.log("Media uploaded for listening section:", files);

    // Set the first uploaded audio as the main audio
    const firstAudio = files.find((f) => f.type === "audio");
    if (firstAudio) {
      setAudioUrl(firstAudio.url);
      setAudioFile(null); // Reset since we have URL
      if (onAudioChange) onAudioChange(firstAudio.url); // <-- call parent
    }

    toast.success(`${files.length} media file(s) uploaded successfully!`);
  };

  const handleMediaRemove = (fileId: string) => {
    // Clear audio if it was removed
    setAudioUrl("");
    setAudioFile(null);
  };

  // Find the save section button or handler and update it:
  // Example for a save button or function:
  const handleSaveSection = async () => {
    console.log('[SaveSection] Handler called');
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    if (!editor) {
      isSavingRef.current = false;
      return;
    }
    editor.commands.focus();
    setTimeout(() => {
      const content = editor.getJSON();
      const questions = extractQuestionsFromContent(content);
      console.log('[SaveSection] Extracted questions:', questions.map(q => q.type));
      // Always allow saving, even if there are no questions
      if (typeof onSave === 'function') {
        onSave(content, audioUrl);
        toast.success('Section saved successfully!');
      }
      isSavingRef.current = false;
    }, 150);
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Listening Section Editor
            {typeof window !== 'undefined' && localStorage.getItem(getStorageKey()) && (
              <Button
                size="sm"
                variant="destructive"
                className="ml-4"
                onClick={discardLocalDraft}
              >
                Discard Local Draft
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6" style={{ position: "relative" }}>
          {/* Media Upload */}
          <div className="mb-4">
            <label className="block font-semibold mb-1">Section Media</label>
            <p className="text-sm text-gray-600 mb-3">
              Upload audio files for listening and any reference images
            </p>
            <MediaUploader
              mediaType="both"
              multiple={true}
              maxSizeMB={100}
              onUpload={handleMediaUpload}
              onRemove={handleMediaRemove}
              acceptedTypes={[
                ".mp3",
                ".wav",
                ".m4a",
                ".aac",
                ".ogg",
                ".jpg",
                ".jpeg",
                ".png",
                ".gif",
              ]}
            />

            {audioUrl && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-green-800 text-sm font-medium mb-2">
                  ✓ Main audio file ready
                </div>
                <audio controls src={audioUrl} className="w-full" />
              </div>
            )}
          </div>
          {/* Formatting Toolbar */}
          <div className="flex flex-wrap gap-2 mb-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                editor && editor.chain().focus().toggleBold().run()
              }
            >
              <b>B</b>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                editor && editor.chain().focus().toggleItalic().run()
              }
            >
              <i>I</i>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                editor &&
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
            >
              H1
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                editor &&
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              H2
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                editor &&
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
            >
              H3
            </Button>
            <Button size="sm" onClick={() => setShowMCQDialog(true)}>
              + MCQ (Single)
            </Button>
            <Button size="sm" onClick={() => editor && insertShortAnswer()}>
              + Short Answer
            </Button>
            <Button size="sm" onClick={() => setShowMapDialog(true)}>
              + Map/Diagram
            </Button>
            <Button size="sm" onClick={() => setShowSentenceDialog(true)}>
              + Sentence Completion
            </Button>
            <Button size="sm" onClick={() => setShowMatchingDialog(true)}>
              + Matching
            </Button>
            <Button size="sm" onClick={() => setShowTableGridPicker(true)}>
              + Table
            </Button>
            <div className="ml-4 border-l pl-4 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (editor) {
                    editor.commands.setContent(sampleListeningContent);
                    demonstrateParsing();
                    toast.success("Loaded sample listening test content! Check console for parsing demo.");
                  }
                }}
                className="text-xs"
              >
                📝 Load Sample
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (editor) {
                    const content = editor.getJSON();
                    const result = parseContentForStudent(content);
                    console.log("=== PARSING RESULTS ===");
                    console.log("Original content:", content);
                    console.log("Parsed student content:", result.content);
                    console.log("Extracted answers:", result.answers);
                    toast.success(`Found ${result.answers.length} questions! Check console for details.`);
                  }
                }}
                className="text-xs"
              >
                🔍 Test Parsing
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={() => setShowStudentPreview(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium"
              >
                🎓 Test as Student
              </Button>
            </div>
          </div>

          {/* TipTap Editor */}
          {!editor && <div className="text-red-600">Editor not ready</div>}
          <EditorContent editor={editor} />
          <FloatingTableToolbar editor={editor} />
          {/* Save Section */}
          <div className="flex justify-end mt-6">
            <Button onClick={handleSaveSection} type="button">
              <Save className="h-4 w-4 mr-2" /> Save Section
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* MCQ Dialog */}
      {showMCQDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 min-w-[400px] max-w-lg shadow-lg">
            <h2 className="text-lg font-bold mb-4">
              {mcqEditPos !== null
                ? "Edit MCQ (Single Answer) Question"
                : "Add MCQ (Single Answer) Question"}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const text = (
                  form.elements.namedItem("text") as HTMLInputElement
                ).value;
                const options = [
                  (form.elements.namedItem("optionA") as HTMLInputElement)
                    .value,
                  (form.elements.namedItem("optionB") as HTMLInputElement)
                    .value,
                  (form.elements.namedItem("optionC") as HTMLInputElement)
                    .value,
                  (form.elements.namedItem("optionD") as HTMLInputElement)
                    .value,
                ];
                const correct = form.elements.namedItem(
                  "correct",
                ) as RadioNodeList;
                const correctIndex = parseInt((correct.value || "0") as string);
                insertMCQ(text, options, correctIndex);
                setShowMCQDialog(false);
              }}
            >
              <div className="mb-4">
                <label className="block font-semibold mb-1">
                  Question Text
                </label>
                <input
                  name="text"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  required
                  defaultValue={mcqEditAttrs?.text || ""}
                />
              </div>
              <div className="mb-4">
                <label className="block font-semibold mb-1">Options</label>
                {["A", "B", "C", "D"].map((letter, idx) => (
                  <div key={letter} className="flex items-center gap-2 mb-1">
                    <input
                      name={`option${letter}`}
                      type="text"
                      className="border rounded px-2 py-1 flex-1"
                      required
                      defaultValue={mcqEditAttrs?.options?.[idx] || ""}
                    />
                    <input
                      type="radio"
                      name="correct"
                      value={idx}
                      defaultChecked={
                        mcqEditAttrs
                          ? mcqEditAttrs.correctIndex === idx
                          : idx === 0
                      }
                      required
                    />
                    <span className="text-xs">Correct</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setShowMCQDialog(false);
                    setMcqEditPos(null);
                    setMcqEditAttrs(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {mcqEditPos !== null ? "Update" : "Insert"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Map Dialog */}
      {showMapDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 min-w-[400px] max-w-lg shadow-lg">
            <h2 className="text-lg font-bold mb-4">Add Map/Diagram</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!mapImageUrl || mapUploading) return;
                insertMapDiagram(mapImageUrl, mapQuestionCount);
                setShowMapDialog(false);
                setMapImageUrl("");
                setMapQuestionCount(1);
                setMapUploading(false);
              }}
            >
              <div className="mb-4">
                <label className="block font-semibold mb-1">Upload Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setMapUploading(true);
                    try {
                      const url = await uploadFile(file, "image");
                      setMapImageUrl(url);
                    } catch (err) {
                      alert("Image upload failed");
                    } finally {
                      setMapUploading(false);
                    }
                  }}
                  disabled={mapUploading}
                  className="w-full border rounded px-3 py-2"
                />
                {mapUploading && (
                  <div className="text-sm text-blue-600 mt-2 flex items-center gap-2">
                    <span className="animate-spin inline-block mr-2">⏳</span> Uploading image, please wait...
                  </div>
                )}
                {mapImageUrl && !mapUploading && (
                  <img
                    src={mapImageUrl}
                    alt="Preview"
                    className="mt-2 max-h-40 rounded border"
                  />
                )}
              </div>
              <div className="mb-4">
                <label className="block font-semibold mb-1">
                  Number of Questions
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={mapQuestionCount}
                  onChange={(e) =>
                    setMapQuestionCount(parseInt(e.target.value) || 1)
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="How many questions does this map represent?"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be shown as{" "}
                  {mapQuestionCount > 1
                    ? `Q[number]-Q[number+${mapQuestionCount - 1}]`
                    : "Q[number]"}
                </p>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setShowMapDialog(false);
                    setMapImageUrl("");
                    setMapQuestionCount(1);
                    setMapUploading(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!mapImageUrl || mapUploading}>
                  {mapUploading ? (
                    <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> Uploading...</span>
                  ) : (
                    "Insert"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Dialogs for Sentence Completion, Matching */}
      {showSentenceDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 min-w-[400px] max-w-lg shadow-lg">
            <h2 className="text-lg font-bold mb-4">Add Sentence Completion</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const prompt = (
                  form.elements.namedItem("prompt") as HTMLInputElement
                ).value;
                const answers = [
                  (form.elements.namedItem("answer1") as HTMLInputElement)
                    .value,
                  (form.elements.namedItem("answer2") as HTMLInputElement)
                    ?.value || "",
                ].filter(Boolean);

                // Get next question number
                const doc = editor.state.doc;
                const usedNumbers = new Set();
                doc.descendants((node) => {
                  if (
                    [
                      "mcq",
                      "short_answer",
                      "map_diagram",
                      "sentence_completion",
                      "matching",
                    ].includes(node.type.name)
                  ) {
                    usedNumbers.add(node.attrs.number);
                  }
                });
                let nextNumber = 1;
                while (usedNumbers.has(nextNumber)) {
                  nextNumber++;
                }

                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "sentence_completion",
                    attrs: {
                      prompt,
                      answers,
                      admin,
                      number: nextNumber,
                    },
                  })
                  .run();

                // Auto-number all questions after insertion
                setTimeout(() => autoNumberQuestions(editor), 100);
                setShowSentenceDialog(false);
              }}
            >
              <div className="mb-4">
                <label className="block font-semibold mb-1">Prompt</label>
                <input
                  name="prompt"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block font-semibold mb-1">Answer 1</label>
                <input
                  name="answer1"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block font-semibold mb-1">
                  Answer 2 (optional)
                </label>
                <input
                  name="answer2"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowSentenceDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Insert</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showMatchingDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 min-w-[400px] max-w-lg shadow-lg">
            <h2 className="text-lg font-bold mb-4">Add Matching</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const left = [
                  (form.elements.namedItem("left1") as HTMLInputElement).value,
                  (form.elements.namedItem("left2") as HTMLInputElement)
                    ?.value || "",
                ].filter(Boolean);
                const right = [
                  (form.elements.namedItem("right1") as HTMLInputElement).value,
                  (form.elements.namedItem("right2") as HTMLInputElement)
                    ?.value || "",
                ].filter(Boolean);

                // Get next question number
                const doc = editor.state.doc;
                const usedNumbers = new Set();
                doc.descendants((node) => {
                  if (
                    [
                      "mcq",
                      "short_answer",
                      "map_diagram",
                      "sentence_completion",
                      "matching",
                    ].includes(node.type.name)
                  ) {
                    usedNumbers.add(node.attrs.number);
                  }
                });
                let nextNumber = 1;
                while (usedNumbers.has(nextNumber)) {
                  nextNumber++;
                }

                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "matching",
                    attrs: {
                      left,
                      right,
                      admin,
                      number: nextNumber,
                    },
                  })
                  .run();

                // Auto-number all questions after insertion
                setTimeout(() => autoNumberQuestions(editor), 100);
                setShowMatchingDialog(false);
              }}
            >
              <div className="mb-4">
                <label className="block font-semibold mb-1">Prompt 1</label>
                <input
                  name="left1"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block font-semibold mb-1">Answer 1</label>
                <input
                  name="right1"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block font-semibold mb-1">
                  Prompt 2 (optional)
                </label>
                <input
                  name="left2"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="mb-4">
                <label className="block font-semibold mb-1">
                  Answer 2 (optional)
                </label>
                <input
                  name="right2"
                  type="text"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowMatchingDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Insert</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Table Grid Picker Dialog */}
      {showTableGridPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 min-w-[400px] max-w-lg shadow-lg">
            <h2 className="text-lg font-bold mb-4">Insert Table</h2>
            <TableGridPicker
              onPick={(rows, cols) => {
                setShowTableGridPicker(false);
                editor
                  .chain()
                  .focus()
                  .insertTable({ rows, cols, withHeaderRow: true })
                  .run();
              }}
            />
            <div className="flex gap-2 justify-end mt-6">
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowTableGridPicker(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Student Test Preview Modal */}
      {showStudentPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white bg-opacity-20 rounded-full p-2">
                    <span className="text-2xl">🎓</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Student Test Preview</h2>
                    <p className="text-blue-100 text-sm">
                      Experience your test exactly as students will see it
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1 text-sm font-medium">
                    Admin Preview Mode
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowStudentPreview(false)}
                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg"
                  >
                    ✕ Exit Preview
                  </Button>
                </div>
              </div>
            </div>

            {/* Student Test Content */}
            <div className="flex-1 overflow-hidden">
              <EnhancedStudentTestPreview
                content={editor?.getJSON()}
                audioUrl={audioUrl}
                sectionNumber={sectionNumber}
                onExit={() => setShowStudentPreview(false)}
                isPreview={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Student-mode components for preview
const PreviewMCQComponent = (props) => {
  const { node, editor } = props;
  const { text = "", options = ["", "", "", ""], questionId } = node.attrs;
  const answers = editor.options.answers || {};
  const setAnswers = editor.options.setAnswers;
  const value = answers[questionId] ?? null;

  return (
    <NodeViewWrapper
      as="div"
      contentEditable={false}
      className="inline-block my-2"
    >
      <div className="font-semibold mb-2">{text}</div>
      <div className="space-y-1">
        {options.map((opt, idx) => (
          <label
            key={idx}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
          >
            <input
              type="radio"
              name={`mcq_${questionId}`}
              checked={value === idx}
              onChange={() =>
                setAnswers &&
                setAnswers((prev) => ({ ...prev, [questionId]: idx }))
              }
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">{opt}</span>
          </label>
        ))}
      </div>
    </NodeViewWrapper>
  );
};

const PreviewMatchingComponent = (props) => {
  const { node, editor } = props;
  const { left = [""], right = [""], questionId } = node.attrs;
  const answers = editor.options.answers || {};
  const setAnswers = editor.options.setAnswers;

  const [availableAnswers, setAvailableAnswers] = useState(() => {
    const usedAnswers = left
      .map((_, idx) => answers[`${questionId}_${idx}`])
      .filter(Boolean);
    return right
      .filter((answer) => !usedAnswers.includes(answer))
      .sort(() => Math.random() - 0.5);
  });

  const handleDragStart = (e, answer) => {
    e.dataTransfer.setData("text/plain", answer);
  };

  const handleDrop = (e, idx) => {
    e.preventDefault();
    const answer = e.dataTransfer.getData("text/plain");
    if (setAnswers) {
      setAnswers((prev) => {
        const newAnswers = { ...prev };
        const oldAnswer = newAnswers[`${questionId}_${idx}`];
        newAnswers[`${questionId}_${idx}`] = answer;
        setAvailableAnswers((prevAvailable) => {
          let updated = prevAvailable.filter((a) => a !== answer);
          if (oldAnswer) updated.push(oldAnswer);
          return updated.sort(() => Math.random() - 0.5);
        });
        return newAnswers;
      });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleRemoveMatch = (idx) => {
    const currentAnswer = answers[`${questionId}_${idx}`];
    if (currentAnswer && setAnswers) {
      setAnswers((prev) => {
        const newAnswers = { ...prev };
        delete newAnswers[`${questionId}_${idx}`];
        setAvailableAnswers((prevAvailable) =>
          [...prevAvailable, currentAnswer].sort(() => Math.random() - 0.5),
        );
        return newAnswers;
      });
    }
  };

  return (
    <NodeViewWrapper as="div" contentEditable={false} className="my-4">
      <div className="font-semibold mb-2">Matching</div>
      <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded mb-3">
        Drag and drop the correct answers into the empty boxes.
      </div>
      <div className="space-y-3">
        {left.map((prompt, idx) => (
          <div key={idx} className="flex items-center gap-4">
            <div className="flex-1 font-medium text-gray-800">{prompt}</div>
            <div
              className="w-32 h-10 border-2 border-dashed border-gray-300 rounded flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors"
              onDrop={(e) => handleDrop(e, idx)}
              onDragOver={handleDragOver}
            >
              {answers[`${questionId}_${idx}`] ? (
                <div className="flex items-center gap-1 text-sm font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
                  {answers[`${questionId}_${idx}`]}
                  <button
                    onClick={() => handleRemoveMatch(idx)}
                    className="text-red-500 hover:text-red-700 ml-1"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <span className="text-gray-400 text-xs">Drop here</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t pt-4 mt-4">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Answer Options:
        </div>
        <div className="flex flex-wrap gap-2">
          {availableAnswers.map((answer, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={(e) => handleDragStart(e, answer)}
              className="bg-green-100 text-green-800 px-3 py-2 rounded cursor-move hover:bg-green-200 transition-colors border border-green-300 text-sm font-medium"
            >
              {answer}
            </div>
          ))}
        </div>
        {availableAnswers.length === 0 && (
          <div className="text-gray-400 text-sm italic">
            All answers have been used
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

// Create student-mode node definitions for preview
const PreviewMCQNode = Node.create({
  name: "mcq",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      text: { default: "" },
      options: { default: ["", "", "", ""] },
      correctIndex: { default: 0 },
      admin: { default: false },
      questionId: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-type='mcq']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "mcq" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PreviewMCQComponent);
  },
});

const PreviewMapDiagramComponent = (props) => {
  const { node, editor } = props;
  const { imageUrl = "", boxes = [], questionId } = node.attrs;
  const answers = editor.options.answers || {};
  const setAnswers = editor.options.setAnswers;

  // Extract available answers from boxes
  const availableAnswers = boxes.map((box) => box.answer).filter(Boolean);

  const [localAvailableAnswers, setLocalAvailableAnswers] = useState(() => {
    const usedAnswers = boxes
      .map((box) => answers[`${questionId}_${box.id}`])
      .filter(Boolean);
    return availableAnswers
      .filter((answer) => !usedAnswers.includes(answer))
      .sort(() => Math.random() - 0.5);
  });

  // Drag and drop handlers
  const handleDragStart = (e, answer) => {
    e.dataTransfer.setData("text/plain", answer);
  };

  const handleDrop = (e, boxId) => {
    e.preventDefault();
    const answer = e.dataTransfer.getData("text/plain");

    if (setAnswers) {
      setAnswers((prev) => {
        const newAnswers = { ...prev };
        const oldAnswer = newAnswers[`${questionId}_${boxId}`];
        newAnswers[`${questionId}_${boxId}`] = answer;

        // Update available answers
        setLocalAvailableAnswers((prevAvailable) => {
          let updated = prevAvailable.filter((a) => a !== answer);
          if (oldAnswer) {
            updated.push(oldAnswer);
          }
          return updated.sort(() => Math.random() - 0.5);
        });

        return newAnswers;
      });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleRemoveAnswer = (boxId) => {
    const currentAnswer = answers[`${questionId}_${boxId}`];
    if (currentAnswer && setAnswers) {
      setAnswers((prev) => {
        const newAnswers = { ...prev };
        delete newAnswers[`${questionId}_${boxId}`];

        setLocalAvailableAnswers((prevAvailable) =>
          [...prevAvailable, currentAnswer].sort(() => Math.random() - 0.5),
        );

        return newAnswers;
      });
    }
  };

  return (
    <NodeViewWrapper as="div" contentEditable={false} className="my-4">
      {/* No label/question text */}
      {imageUrl ? (
        <div className="space-y-4">
          <div className="relative inline-block">
            <img
              src={imageUrl}
              alt="Map/Diagram"
              className="max-w-full rounded border"
            />
            {/* Render empty drop zones for each box */}
            {boxes.map((box, idx) => (
              <div
                key={box.id}
                className="absolute w-16 h-8 border-2 border-dashed border-gray-400 bg-white/90 rounded flex items-center justify-center text-xs cursor-pointer hover:bg-gray-100"
                style={{
                  left: `${box.x}%`,
                  top: `${box.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onDrop={(e) => handleDrop(e, box.id)}
                onDragOver={handleDragOver}
              >
                {answers[`${questionId}_${box.id}`] ? (
                  <div className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-1 py-0.5 rounded">
                    {answers[`${questionId}_${box.id}`]}
                    <button
                      onClick={() => handleRemoveAnswer(box.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <span className="text-gray-400 text-xs">Drop</span>
                )}
              </div>
            ))}
          </div>

          {/* Answer options for drag and drop */}
          {availableAnswers.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                Available Answers:
              </div>
              <div className="flex flex-wrap gap-2">
                {localAvailableAnswers.map((answer, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, answer)}
                    className="bg-green-100 text-green-800 px-2 py-1 rounded cursor-move hover:bg-green-200 transition-colors border border-green-300 text-xs font-medium"
                  >
                    {answer}
                  </div>
                ))}
              </div>
              {localAvailableAnswers.length === 0 && (
                <div className="text-gray-400 text-xs italic">
                  All answers have been used
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-gray-500 text-sm">No image provided.</div>
      )}
    </NodeViewWrapper>
  );
};

const PreviewMapDiagramNode = Node.create({
  name: "map_diagram",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      imageUrl: { default: "" },
      boxes: { default: [] },
      questionId: { default: "" },
      availableAnswers: { default: [] },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-type='map-diagram']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "map-diagram" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PreviewMapDiagramComponent);
  },
});

const PreviewMatchingNode = Node.create({
  name: "matching",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      left: { default: [""] },
      right: { default: [""] },
      questionId: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-type='matching']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "matching" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PreviewMatchingComponent);
  },
});

// Student Test Preview Component - renders content exactly as written with inline interactive elements
const StudentTestPreview: React.FC<{
  content: any;
  audioUrl: string;
  sectionNumber: string;
  onExit: () => void;
}> = ({ content, audioUrl, sectionNumber, onExit }) => {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes in seconds
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Create a TipTap editor for student mode that renders content as-is but makes questions interactive
  const studentEditor = useEditor({
    extensions: [
      StarterKit,
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      PreviewMCQNode,
      ShortAnswerNode,
      PreviewMapDiagramNode,
      SentenceCompletionNode,
      PreviewMatchingNode,
    ],
    editable: false,
    content: content || "",
  });

  // Keep editor.options.answers and setAnswers in sync
  React.useEffect(() => {
    if (studentEditor) {
      (studentEditor as any).options.answers = answers;
      (studentEditor as any).options.setAnswers = setAnswers;
    }
  }, [studentEditor, answers, setAnswers]);

  // Timer
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Update student editor with non-admin mode when content changes
  React.useEffect(() => {
    if (studentEditor && content) {
      // Set content first, then update all question nodes to be in student mode (admin: false)
      studentEditor
        .chain()
        .setContent(content)
        .command(({ tr }) => {
          tr.doc.descendants((node, pos) => {
            if (
              [
                "mcq",
                "short_answer",
                "map_diagram",
                "sentence_completion",
                "matching",
              ].includes(node.type.name)
            ) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                admin: false,
              });
            }
          });
          return true;
        })
        .run();
    }
  }, [studentEditor, content]);

  const renderStudentQuestion = (node: any, index: number) => {
    const questionId = `q_${index}`;

    switch (node.type) {
      case "mcq":
        return (
          <div
            key={questionId}
            className="bg-white border border-gray-200 rounded-lg p-4 mb-4"
          >
            <h3 className="font-semibold text-lg mb-3">
              Q{node.attrs.number}. {node.attrs.text}
            </h3>
            <div className="space-y-2">
              {node.attrs.options.map((option: string, idx: number) => (
                <label
                  key={idx}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="radio"
                    name={questionId}
                    value={idx}
                    checked={answers[questionId] === idx}
                    onChange={(e) =>
                      setAnswers({
                        ...answers,
                        [questionId]: parseInt(e.target.value),
                      })
                    }
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-gray-800">{option}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case "short_answer":
        return (
          <div
            key={questionId}
            className="bg-white border border-gray-200 rounded-lg p-4 mb-4"
          >
            <h3 className="font-semibold text-lg mb-3">
              Q{node.attrs.number}. Short Answer
            </h3>
            <input
              type="text"
              value={answers[questionId] || ""}
              onChange={(e) =>
                setAnswers({ ...answers, [questionId]: e.target.value })
              }
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your answer"
            />
          </div>
        );

      case "sentence_completion":
        return (
          <div
            key={questionId}
            className="bg-white border border-gray-200 rounded-lg p-4 mb-4"
          >
            <h3 className="font-semibold text-lg mb-3">
              Q{node.attrs.number}. Sentence Completion
            </h3>
            <p className="mb-3 text-gray-700">{node.attrs.prompt}</p>
            {node.attrs.answers.map((_: any, idx: number) => (
              <input
                key={idx}
                type="text"
                value={answers[`${questionId}_${idx}`] || ""}
                onChange={(e) =>
                  setAnswers({
                    ...answers,
                    [`${questionId}_${idx}`]: e.target.value,
                  })
                }
                className="border border-gray-300 rounded px-2 py-1 mx-1 min-w-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Answer ${idx + 1}`}
              />
            ))}
          </div>
        );

      case "matching":
        return (
          <div
            key={questionId}
            className="bg-white border border-gray-200 rounded-lg p-4 mb-4"
          >
            <h3 className="font-semibold text-lg mb-3">
              Q{node.attrs.number}. Matching
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">Items</h4>
                {node.attrs.left.map((item: string, idx: number) => (
                  <div key={idx} className="p-2 bg-gray-50 rounded">
                    {idx + 1}. {item}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">Answers</h4>
                {node.attrs.left.map((_: any, idx: number) => (
                  <select
                    key={idx}
                    value={answers[`${questionId}_${idx}`] || ""}
                    onChange={(e) =>
                      setAnswers({
                        ...answers,
                        [`${questionId}_${idx}`]: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select answer</option>
                    {node.attrs.right.map((option: string, optIdx: number) => (
                      <option key={optIdx} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          </div>
        );

      case "map_diagram":
        return (
          <div
            key={questionId}
            className="bg-white border border-gray-200 rounded-lg p-4 mb-4"
          >
            <h3 className="font-semibold text-lg mb-3">
              {node.attrs.questionCount > 1
                ? `Q${node.attrs.number}-Q${node.attrs.number + node.attrs.questionCount - 1}. Map/Diagram Labeling`
                : `Q${node.attrs.number}. Map/Diagram Labeling`}
            </h3>
            {node.attrs.imageUrl && (
              <img
                src={node.attrs.imageUrl}
                alt="Map/Diagram"
                className="max-w-full mb-3 rounded"
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: node.attrs.questionCount || 1 }).map(
                (_, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={answers[`${questionId}_${idx}`] || ""}
                    onChange={(e) =>
                      setAnswers({
                        ...answers,
                        [`${questionId}_${idx}`]: e.target.value,
                      })
                    }
                    className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Answer ${idx + 1}`}
                  />
                ),
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const extractQuestions = (content: any) => {
    const questions: any[] = [];

    const traverse = (node: any) => {
      if (
        node.type &&
        [
          "mcq",
          "short_answer",
          "map_diagram",
          "sentence_completion",
          "matching",
        ].includes(node.type)
      ) {
        questions.push(node);
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };

    if (content && content.content) {
      content.content.forEach(traverse);
    }

    return questions;
  };

  const questions = extractQuestions(content);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Student Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">
              IELTS Listening Test
            </h1>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              Section {sectionNumber}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {audioUrl && (
              <Button
                onClick={toggleAudio}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                {isPlaying ? "⏸️" : "▶️"} Audio
              </Button>
            )}
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold">
              ⏰ {formatTime(timeLeft)}
            </div>
          </div>
        </div>
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        )}
      </div>

      {/* Student Test Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="font-semibold text-blue-800 mb-2">Instructions</h2>
            <p className="text-blue-700 text-sm">
              You will hear the audio for this section once only. Answer all
              questions as you listen. Write your answers in the spaces
              provided.
            </p>
          </div>

          {studentEditor ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <EditorContent editor={studentEditor} />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500">
                No questions have been added to this section yet.
              </p>
            </div>
          )}

          <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-green-800">
                  Test Preview Complete
                </h3>
                <p className="text-green-700 text-sm">
                  This is how students will experience your test.
                </p>
              </div>
              <Button
                onClick={onExit}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Return to Editor
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// Add TableGridPicker component
const TableGridPicker = ({ onPick }) => {
  const [hovered, setHovered] = useState({ rows: 0, cols: 0 });
  const maxRows = 6,
    maxCols = 6;
  return (
    <div className="mb-4">
      <div className="mb-2 font-semibold">Pick table size:</div>
      <div
        style={{
          display: "inline-block",
          border: "1px solid #ccc",
          background: "#f9f9f9",
          padding: 4,
        }}
      >
        {Array.from({ length: maxRows }).map((_, r) => (
          <div key={r} style={{ display: "flex" }}>
            {Array.from({ length: maxCols }).map((_, c) => (
              <div
                key={c}
                style={{
                  width: 24,
                  height: 24,
                  margin: 1,
                  background:
                    r <= hovered.rows && c <= hovered.cols
                      ? "#3b82f6"
                      : "#e5e7eb",
                  borderRadius: 2,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHovered({ rows: r, cols: c })}
                onClick={() => onPick(r + 1, c + 1)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-500">
        {hovered.rows + 1} x {hovered.cols + 1}
      </div>
    </div>
  );
};

// Floating Table Toolbar
function FloatingTableToolbar({ editor }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef(null);

  useEffect(() => {
    if (!editor) return;
    const updateToolbar = () => {
      const view = editor.view;
      const { state } = view;
      const { selection } = state;
      // Check if selection is in a table cell
      const isInTable = editor.isActive("table");
      if (!isInTable) {
        setShow(false);
        return;
      }
      // Find the selected cell's DOM node
      const dom = view.domAtPos(selection.from).node;
      if (
        dom &&
        dom.nodeType === 1 &&
        (dom.tagName === "TD" || dom.tagName === "TH")
      ) {
        const rect = dom.getBoundingClientRect();
        setCoords({
          top: rect.top + window.scrollY - 40, // 40px above cell
          left: rect.left + window.scrollX + rect.width / 2,
        });
        setShow(true);
      } else {
        setShow(false);
      }
    };
    updateToolbar();
    document.addEventListener("selectionchange", updateToolbar);
    window.addEventListener("resize", updateToolbar);
    return () => {
      document.removeEventListener("selectionchange", updateToolbar);
      window.removeEventListener("resize", updateToolbar);
    };
  }, [editor]);

  if (!show) return null;
  return (
    <div
      ref={toolbarRef}
      style={{
        position: "absolute",
        top: coords.top,
        left: coords.left,
        transform: "translate(-50%, -100%)",
        zIndex: 1000,
        background: "#fff",
        border: "1px solid #d1d5db",
        borderRadius: 6,
        boxShadow: "0 2px 8px #0001",
        padding: "4px 8px",
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      <Button
        size="sm"
        variant="outline"
        onClick={() => editor.chain().focus().deleteRow().run()}
      >
        Delete Row
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => editor.chain().focus().deleteColumn().run()}
      >
        Delete Col
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
      >
        Toggle Header
      </Button>
    </div>
  );
}

export default IELTSListeningEditor;
export { extractQuestionsFromContent, StudentTestPreview };
export { MapDiagramNode };
