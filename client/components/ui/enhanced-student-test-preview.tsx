import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { parseContentForStudent, ParsedAnswer, validateAnswers } from "@/lib/contentParser";

interface EnhancedStudentTestPreviewProps {
  content: any;
  audioUrl?: string;
  sectionNumber?: string;
  onExit?: () => void;
  onSubmit?: (answers: Record<string, string>) => void;
  showSubmitButton?: boolean;
  isPreview?: boolean;
}

export const EnhancedStudentTestPreview: React.FC<EnhancedStudentTestPreviewProps> = ({
  content,
  audioUrl,
  sectionNumber = "1",
  onExit,
  onSubmit,
  showSubmitButton = false,
  isPreview = true
}) => {
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes
  const [isPlaying, setIsPlaying] = useState(false);
  const [parsedContent, setParsedContent] = useState<any>(null);
  const [extractedAnswers, setExtractedAnswers] = useState<ParsedAnswer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Parse content when it changes
  useEffect(() => {
    if (content) {
      const result = parseContentForStudent(content);
      setParsedContent(result.content);
      setExtractedAnswers(result.answers);
      
      console.log("📋 Parsed content for student:", {
        totalQuestions: result.totalQuestions,
        extractedAnswers: result.answers
      });
    }
  }, [content]);

  // Create editor for student mode
  const studentEditor = useEditor({
    extensions: [
      StarterKit,
      Heading.configure({ levels: [1, 2, 3] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    editable: false,
    content: parsedContent || "",
  });

  // Update editor content when parsed content changes
  useEffect(() => {
    if (studentEditor && parsedContent) {
      studentEditor.commands.setContent(parsedContent);
    }
  }, [studentEditor, parsedContent]);

  // Timer logic
  useEffect(() => {
    if (!isPreview && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            if (onSubmit) {
              handleSubmit();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, isPreview, onSubmit]);

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

  const handleAnswerChange = (questionNumber: number, value: string) => {
    setStudentAnswers(prev => ({
      ...prev,
      [questionNumber.toString()]: value
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(studentAnswers);
      }
    } catch (error) {
      console.error("Failed to submit test:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Custom component to render content with interactive inputs
  const renderStudentContent = (content: any) => {
    if (!content || !content.content) {
      return (
        <div className="text-center py-8 text-gray-500">
          No content available for this test section.
        </div>
      );
    }

    return (
      <div className="space-y-6 text-lg leading-relaxed">
        {content.content.map((node: any, index: number) =>
          renderContentNode(node, index)
        )}
      </div>
    );
  };

  const renderContentNode = (node: any, index: number): React.ReactNode => {
    switch (node.type) {
      case 'paragraph':
        return (
          <p key={index} className="mb-4 text-gray-800 leading-relaxed text-lg">
            {node.content?.map((child: any, childIndex: number) =>
              renderContentNode(child, childIndex)
            )}
          </p>
        );

      case 'text':
        // Check if this text contains question inputs
        if (node.text && node.text.includes('[    ')) {
          return renderTextWithInputs(node.text, index);
        }
        return <span key={index}>{node.text}</span>;

      case 'heading':
        const HeadingTag = `h${node.attrs?.level || 1}` as keyof JSX.IntrinsicElements;
        return (
          <HeadingTag key={index} className="font-bold mb-3 text-gray-900">
            {node.content?.map((child: any, childIndex: number) => 
              renderContentNode(child, childIndex)
            )}
          </HeadingTag>
        );

      case 'short_answer':
        return renderShortAnswerField(node, index);

      case 'mcq':
        return renderMCQQuestion(node, index);

      case 'sentence_completion':
        return renderSentenceCompletion(node, index);

      case 'matching':
        return renderMatchingQuestion(node, index);

      case 'map_diagram':
        return renderMapDiagram(node, index);

      case 'table':
        return renderTable(node, index);

      default:
        return null;
    }
  };

  const renderTextWithInputs = (text: string, index: number) => {
    // Pattern to find numbered input placeholders like [    1    ]
    const inputPattern = /\[\s*(\d+)\s*\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = inputPattern.exec(text)) !== null) {
      // Add text before the input
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${index}-${lastIndex}`}>
            {text.substring(lastIndex, match.index)}
          </span>
        );
      }

      // Add the input field
      const questionNumber = parseInt(match[1]);
      parts.push(
        <input
          key={`input-${index}-${questionNumber}`}
          type="text"
          value={studentAnswers[questionNumber.toString()] || ""}
          onChange={(e) => handleAnswerChange(questionNumber, e.target.value)}
          className="inline-block min-w-[100px] max-w-[250px] px-3 py-2 mx-1 border border-gray-400 rounded bg-white text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          placeholder={questionNumber.toString()}
          style={{
            fontSize: 'inherit',
            fontFamily: 'inherit',
            verticalAlign: 'baseline'
          }}
        />
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${index}-${lastIndex}`}>
          {text.substring(lastIndex)}
        </span>
      );
    }

    return <span key={index}>{parts}</span>;
  };

  const renderShortAnswerField = (node: any, index: number) => {
    const questionNumber = node.attrs?.number || index + 1;
    
    return (
      <span key={index} className="inline-block mx-1">
        <input
          type="text"
          value={studentAnswers[questionNumber.toString()] || ""}
          onChange={(e) => handleAnswerChange(questionNumber, e.target.value)}
          className="inline-block min-w-[100px] max-w-[250px] px-3 py-2 mx-1 border border-gray-400 rounded bg-white text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          placeholder={questionNumber.toString()}
          style={{
            fontSize: 'inherit',
            fontFamily: 'inherit',
            verticalAlign: 'baseline'
          }}
        />
      </span>
    );
  };

  const renderMCQQuestion = (node: any, index: number) => {
    const questionNumber = node.attrs?.number || index + 1;
    const questionText = node.attrs?.text || "";
    const options = node.attrs?.options || [];

    return (
      <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg mb-4">
          {questionNumber}. {questionText}
        </h3>
        <div className="space-y-3">
          {options.map((option: string, optIndex: number) => (
            <label key={optIndex} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
              <input
                type="radio"
                name={`mcq-${questionNumber}`}
                value={option}
                checked={studentAnswers[questionNumber.toString()] === option}
                onChange={(e) => handleAnswerChange(questionNumber, e.target.value)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-800">{option}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  const renderSentenceCompletion = (node: any, index: number) => {
    const questionNumber = node.attrs?.number || index + 1;
    const prompt = node.attrs?.prompt || "";
    const answerCount = (node.attrs?.answers || [""]).length;

    return (
      <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg mb-4">
          {questionNumber}. Sentence Completion
        </h3>
        <p className="mb-4 text-gray-700">{prompt}</p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: answerCount }).map((_, answerIndex) => (
            <input
              key={answerIndex}
              type="text"
              value={studentAnswers[`${questionNumber}_${answerIndex}`] || ""}
              onChange={(e) => handleAnswerChange(
                parseInt(`${questionNumber}${answerIndex + 1}`), 
                e.target.value
              )}
              className="border border-gray-300 rounded px-3 py-2 min-w-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Answer ${answerIndex + 1}`}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderMatchingQuestion = (node: any, index: number) => {
    const questionNumber = node.attrs?.number || index + 1;
    const leftItems = node.attrs?.left || [];
    const rightItems = node.attrs?.right || [];

    return (
      <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg mb-4">
          {questionNumber}. Matching
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Items to match:</h4>
            {leftItems.map((item: string, itemIndex: number) => (
              <div key={itemIndex} className="mb-2 p-2 bg-gray-50 rounded">
                {itemIndex + 1}. {item}
              </div>
            ))}
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Your answers:</h4>
            {leftItems.map((_: any, itemIndex: number) => (
              <select
                key={itemIndex}
                value={studentAnswers[`${questionNumber}_${itemIndex}`] || ""}
                onChange={(e) => handleAnswerChange(
                  parseInt(`${questionNumber}${itemIndex + 1}`),
                  e.target.value
                )}
                className="w-full mb-2 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select answer</option>
                {rightItems.map((option: string, optIndex: number) => (
                  <option key={optIndex} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMapDiagram = (node: any, index: number) => {
    const questionNumber = node.attrs?.number || index + 1;
    const questionCount = node.attrs?.questionCount || 1;
    const imageUrl = node.attrs?.imageUrl;

    return (
      <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg mb-4">
          {questionCount > 1 
            ? `${questionNumber}-${questionNumber + questionCount - 1}. Map/Diagram Labeling`
            : `${questionNumber}. Map/Diagram Labeling`
          }
        </h3>
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Map/Diagram"
            className="max-w-full mb-4 rounded border"
          />
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: questionCount }).map((_, answerIndex) => (
            <div key={answerIndex} className="flex flex-col">
              <label className="text-sm font-medium text-gray-600 mb-1">
                {questionNumber + answerIndex}
              </label>
              <input
                type="text"
                value={studentAnswers[(questionNumber + answerIndex).toString()] || ""}
                onChange={(e) => handleAnswerChange(questionNumber + answerIndex, e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Answer ${answerIndex + 1}`}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTable = (node: any, index: number) => {
    return (
      <div key={index} className="overflow-x-auto mb-6">
        <table className="w-full border-collapse border border-gray-300">
          <tbody>
            {node.content?.map((row: any, rowIndex: number) => (
              <tr key={rowIndex}>
                {row.content?.map((cell: any, cellIndex: number) => {
                  const CellTag = cell.type === 'tableHeader' ? 'th' : 'td';
                  return (
                    <CellTag key={cellIndex} className="border border-gray-300 px-3 py-2">
                      {cell.content?.map((cellChild: any, cellChildIndex: number) => 
                        renderContentNode(cellChild, cellChildIndex)
                      )}
                    </CellTag>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">
              IELTS Listening Test
            </h1>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              Section {sectionNumber}
            </div>
            {isPreview && (
              <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                Preview Mode
              </div>
            )}
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
            {!isPreview && (
              <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold">
                ⏰ {formatTime(timeLeft)}
              </div>
            )}
            {showSubmitButton && (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSubmitting ? "Submitting..." : "Submit Test"}
              </Button>
            )}
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Instructions */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="font-semibold text-blue-800 mb-2">Instructions</h2>
            <p className="text-blue-700 text-sm">
              Listen to the audio for this section. Answer all questions as you listen.
              Write your answers in the numbered spaces provided.
              {extractedAnswers.length > 0 && (
                <span className="block mt-2 font-medium">
                  Questions: {extractedAnswers.length > 0 ? 
                    `${Math.min(...extractedAnswers.map(a => a.questionNumber))} - ${Math.max(...extractedAnswers.map(a => a.questionNumber))}` 
                    : 'None'}
                </span>
              )}
            </p>
          </div>

          {/* Test Content */}
          <div className="bg-white border border-gray-200 rounded-lg p-8">
            {parsedContent ? (
              renderStudentContent(parsedContent)
            ) : (
              <div className="text-center py-8 text-gray-500">
                Loading test content...
              </div>
            )}
          </div>

          {/* Footer */}
          {isPreview && onExit && (
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-green-800">
                    Test Preview Complete
                  </h3>
                  <p className="text-green-700 text-sm">
                    This is how students will experience your test.
                    {extractedAnswers.length > 0 && (
                      <span className="block mt-1">
                        Found {extractedAnswers.length} answerable questions.
                      </span>
                    )}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedStudentTestPreview;
