import React, { useState, useEffect } from 'react';

interface MCQQuestionProps {
  questionId: number;
  content: string;
  options: string[];
  initialAnswer?: number;
  readonly?: boolean;
  onAnswerChange?: (questionId: number, selectedIndex: number) => void;
}

export function MCQQuestion({
  questionId,
  content,
  options,
  initialAnswer,
  readonly = false,
  onAnswerChange
}: MCQQuestionProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(
    initialAnswer !== undefined ? initialAnswer : null
  );

  useEffect(() => {
    if (selectedOption !== null && onAnswerChange) {
      onAnswerChange(questionId, selectedOption);
    }
  }, [selectedOption, questionId, onAnswerChange]);

  const handleOptionChange = (optionIndex: number) => {
    if (readonly) return;
    setSelectedOption(optionIndex);
  };

  return (
    <div className="mcq-question my-4 p-4 border rounded bg-blue-50">
      <p className="font-medium mb-4">Question {questionId}: {content}</p>
      
      <div className="space-y-3">
        {options.map((option, index) => {
          const isSelected = selectedOption === index;
          const optionLetter = String.fromCharCode(65 + index); // A, B, C, D...
          
          return (
            <label 
              key={index}
              className={`flex items-center space-x-3 p-3 rounded border cursor-pointer transition-all ${
                readonly 
                  ? 'bg-gray-100 cursor-not-allowed' 
                  : isSelected
                  ? 'bg-blue-200 border-blue-400 shadow-sm'
                  : 'bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-300'
              }`}
              onClick={() => handleOptionChange(index)}
            >
              <input 
                type="radio" 
                name={`mcq-${questionId}`}
                value={index}
                checked={isSelected}
                onChange={() => handleOptionChange(index)}
                disabled={readonly}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 focus:ring-2"
              />
              <span className="flex-1 text-sm">
                <span className="font-medium text-blue-700 mr-2">{optionLetter})</span>
                {option}
              </span>
              {isSelected && !readonly && (
                <span className="text-blue-600 text-sm">✓</span>
              )}
            </label>
          );
        })}
      </div>
      
      {selectedOption !== null && readonly && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <p className="text-sm">
            <span className="font-medium">Student's answer:</span> 
            <span className="ml-1 text-blue-600">
              {String.fromCharCode(65 + selectedOption)}) {options[selectedOption]}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
