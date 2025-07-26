import React, { useState, useEffect } from 'react';
import { EnhancedBracketParser } from '../../lib/enhancedBracketParser';
import { MCQQuestion } from './mcq-question';
import { MatchingQuestion } from './matching-question';

interface EnhancedContentRendererProps {
  content: string;
  initialAnswers?: Record<number, any>;
  readonly?: boolean;
  onAnswersChange?: (answers: Record<number, any>) => void;
}

export function EnhancedContentRenderer({
  content,
  initialAnswers = {},
  readonly = false,
  onAnswersChange
}: EnhancedContentRendererProps) {
  const [answers, setAnswers] = useState<Record<number, any>>(initialAnswers);
  
  useEffect(() => {
    if (onAnswersChange) {
      onAnswersChange(answers);
    }
  }, [answers, onAnswersChange]);

  const parsed = EnhancedBracketParser.parseContent(content);
  
  const handleAnswerChange = (questionId: number, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const renderContent = () => {
    let processedContent = parsed.content;
    const elements: JSX.Element[] = [];
    
    // Split content by question placeholders
    const parts = processedContent.split(/(\[__QUESTION_\d+__\])/);
    
    parts.forEach((part, index) => {
      // Check if this part is a question placeholder
      const questionMatch = part.match(/\[__QUESTION_(\d+)__\]/);
      
      if (questionMatch) {
        const questionId = parseInt(questionMatch[1]);
        const question = parsed.questions.find(q => q.id === questionId);
        
        if (question) {
          switch (question.type) {
            case 'blank':
              elements.push(
                <input
                  key={`blank-${questionId}`}
                  type="text"
                  value={answers[questionId] || ''}
                  onChange={(e) => handleAnswerChange(questionId, e.target.value)}
                  placeholder={questionId.toString()}
                  readOnly={readonly}
                  className="inline-block w-20 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none"
                />
              );
              break;
              
            case 'mcq':
              elements.push(
                <MCQQuestion
                  key={`mcq-${questionId}`}
                  questionId={questionId}
                  content={question.content}
                  options={question.options || []}
                  initialAnswer={answers[questionId]}
                  readonly={readonly}
                  onAnswerChange={handleAnswerChange}
                />
              );
              break;
              
            case 'matching':
              elements.push(
                <MatchingQuestion
                  key={`matching-${questionId}`}
                  questionId={questionId}
                  content={question.content}
                  leftItems={question.metadata?.leftItems || []}
                  rightItems={question.metadata?.rightItems || []}
                  initialAnswers={answers[questionId]}
                  readonly={readonly}
                  onAnswerChange={handleAnswerChange}
                />
              );
              break;
              
            case 'map':
              elements.push(
                <div key={`map-${questionId}`} className="map-question my-4 p-4 border rounded bg-yellow-50">
                  <p className="font-medium mb-2">Question {questionId}: {question.content}</p>
                  {question.metadata?.imageUrl ? (
                    <div className="relative inline-block">
                      <img 
                        src={question.metadata.imageUrl} 
                        alt="Map" 
                        className="max-w-full border rounded" 
                      />
                      {question.metadata?.areas?.map((area: any, areaIndex: number) => (
                        <div
                          key={areaIndex}
                          className="absolute w-6 h-6 bg-red-500 text-white text-xs flex items-center justify-center rounded-full cursor-pointer"
                          style={{
                            left: `${area.x}%`,
                            top: `${area.y}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                          title={`Area ${area.id}: ${area.answer}`}
                        >
                          {area.id}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No image provided</p>
                  )}
                </div>
              );
              break;
          }
        }
      } else if (part.trim()) {
        // Regular text content
        elements.push(
          <span 
            key={`text-${index}`} 
            className="whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: part }}
          />
        );
      }
    });
    
    return elements;
  };

  return (
    <div className="enhanced-content-renderer">
      <div className="prose prose-lg max-w-none leading-relaxed">
        {renderContent()}
      </div>
    </div>
  );
}
