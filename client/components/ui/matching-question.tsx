import React, { useState, useEffect } from 'react';

interface MatchingQuestionProps {
  questionId: number;
  content: string;
  leftItems: string[];
  rightItems: string[];
  initialAnswers?: Record<number, string>;
  readonly?: boolean;
  onAnswerChange?: (questionId: number, answers: Record<number, string>) => void;
}

export function MatchingQuestion({
  questionId,
  content,
  leftItems,
  rightItems,
  initialAnswers = {},
  readonly = false,
  onAnswerChange
}: MatchingQuestionProps) {
  const [matches, setMatches] = useState<Record<number, string>>(initialAnswers);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  useEffect(() => {
    if (onAnswerChange) {
      onAnswerChange(questionId, matches);
    }
  }, [matches, questionId, onAnswerChange]);

  const handleDragStart = (e: React.DragEvent, answer: string) => {
    if (readonly) return;
    setDraggedItem(answer);
    e.dataTransfer.setData('text/plain', answer);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (readonly) return;
    
    const answer = e.dataTransfer.getData('text/plain');
    
    if (answer) {
      setMatches(prev => {
        // Remove the answer from any previous position
        const newMatches = { ...prev };
        Object.keys(newMatches).forEach(key => {
          if (newMatches[parseInt(key)] === answer) {
            delete newMatches[parseInt(key)];
          }
        });
        
        // Add the answer to the new position
        newMatches[dropIndex] = answer;
        return newMatches;
      });
    }
  };

  const clearMatch = (index: number) => {
    if (readonly) return;
    setMatches(prev => {
      const newMatches = { ...prev };
      delete newMatches[index];
      return newMatches;
    });
  };

  const isAnswerUsed = (answer: string) => {
    return Object.values(matches).includes(answer);
  };

  return (
    <div className="matching-question my-4 p-4 border rounded bg-green-50">
      <p className="font-medium mb-3">Question {questionId}: {content}</p>
      <p className="text-sm text-gray-600 mb-4">
        Drag answers from the right to match with items on the left
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left side: Prompts with drop zones */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-700 mb-2">Items to match:</h4>
          {leftItems.map((item, index) => {
            const matchedAnswer = matches[index] || '';
            
            return (
              <div key={index} className="flex items-center space-x-3 p-2 bg-white border rounded">
                <span className="flex-1 text-sm font-medium">{item}</span>
                <div 
                  className={`drop-zone min-w-[100px] h-10 border-2 border-dashed rounded flex items-center justify-center text-xs transition-all ${
                    matchedAnswer 
                      ? 'border-blue-500 bg-blue-100' 
                      : 'border-gray-300 bg-gray-50 hover:border-blue-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  {matchedAnswer ? (
                    <div className="flex items-center justify-between w-full px-2">
                      <span className="text-blue-600 font-medium text-sm">{matchedAnswer}</span>
                      {!readonly && (
                        <button
                          onClick={() => clearMatch(index)}
                          className="text-red-500 hover:text-red-700 text-xs ml-1"
                          title="Remove match"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500">Drop here</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Right side: Draggable answers */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-700 mb-2">Drag these answers:</h4>
          {rightItems.map((item, index) => {
            const isUsed = isAnswerUsed(item);
            const isDragging = draggedItem === item;
            
            return (
              <div 
                key={index}
                className={`draggable-answer p-3 border border-blue-300 rounded cursor-move text-sm font-medium text-center transition-all select-none ${
                  readonly 
                    ? 'bg-gray-100 cursor-not-allowed' 
                    : isDragging
                    ? 'bg-blue-200 shadow-lg transform scale-105'
                    : isUsed
                    ? 'bg-blue-50 opacity-60'
                    : 'bg-blue-100 hover:bg-blue-200 hover:shadow-md'
                }`}
                draggable={!readonly}
                onDragStart={(e) => handleDragStart(e, item)}
                onDragEnd={handleDragEnd}
              >
                {item}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Show matches for debugging/admin view */}
      {Object.keys(matches).length > 0 && readonly && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <h5 className="text-sm font-medium mb-2">Student's matches:</h5>
          <div className="space-y-1">
            {Object.entries(matches).map(([index, answer]) => (
              <div key={index} className="text-sm">
                <span className="font-medium">{leftItems[parseInt(index)]}</span> → 
                <span className="ml-1 text-blue-600">{answer}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
