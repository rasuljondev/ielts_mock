import React, { useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Textarea } from './textarea';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Badge } from './badge';
import { Plus, X, Upload } from 'lucide-react';

interface QuestionInsertionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (bracketSyntax: string) => void;
}

type QuestionType = 'blank' | 'mcq' | 'matching' | 'map';

export function QuestionInsertionModal({ isOpen, onClose, onInsert }: QuestionInsertionModalProps) {
  const [questionType, setQuestionType] = useState<QuestionType>('blank');
  const [questionNumber, setQuestionNumber] = useState(1);
  
  // Blank question state
  const [blankAnswers, setBlankAnswers] = useState('');
  
  // MCQ state
  const [mcqQuestion, setMcqQuestion] = useState('');
  const [mcqOptions, setMcqOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(0);
  
  // Matching state
  const [leftItems, setLeftItems] = useState(['']);
  const [rightItems, setRightItems] = useState(['']);
  
  // Map state
  const [mapImageUrl, setMapImageUrl] = useState('');
  const [mapAreas, setMapAreas] = useState<Array<{ label: string; answer: string; x: number; y: number }>>([]);

  const handleReset = () => {
    setQuestionNumber(1);
    setBlankAnswers('');
    setMcqQuestion('');
    setMcqOptions(['', '', '', '']);
    setCorrectOption(0);
    setLeftItems(['']);
    setRightItems(['']);
    setMapImageUrl('');
    setMapAreas([]);
  };

  const handleInsert = () => {
    let bracketSyntax = '';

    switch (questionType) {
      case 'blank':
        if (blankAnswers.includes(',')) {
          // Multiple answers
          const answers = blankAnswers.split(',').map(a => a.trim());
          answers.forEach((answer, index) => {
            const qNum = questionNumber + index;
            bracketSyntax += index > 0 ? ' ' : '';
            bracketSyntax += `[${answer}]`;
          });
        } else {
          // Single answer
          bracketSyntax = `[${blankAnswers.trim()}]`;
        }
        break;

      case 'mcq':
        const optionsWithCorrect = mcqOptions.map((opt, idx) => 
          idx === correctOption ? `${opt}*` : opt
        ).join('|');
        bracketSyntax = `[${questionNumber}:MCQ] ${mcqQuestion} {${optionsWithCorrect}}`;
        break;

      case 'matching':
        const leftStr = leftItems.filter(item => item.trim()).join(',');
        const rightStr = rightItems.filter(item => item.trim()).join(',');
        bracketSyntax = `[${questionNumber}:MATCH] {Left:${leftStr}|Right:${rightStr}}`;
        break;

      case 'map':
        const areasStr = mapAreas.map(area => 
          `${area.label}=${area.answer}@${area.x},${area.y}`
        ).join(';');
        bracketSyntax = `[${questionNumber}:MAP] {image:${mapImageUrl}|areas:${areasStr}}`;
        break;
    }

    onInsert(bracketSyntax);
    handleReset();
    onClose();
  };

  const addMcqOption = () => {
    setMcqOptions([...mcqOptions, '']);
  };

  const updateMcqOption = (index: number, value: string) => {
    const newOptions = [...mcqOptions];
    newOptions[index] = value;
    setMcqOptions(newOptions);
  };

  const removeMcqOption = (index: number) => {
    if (mcqOptions.length > 2) {
      const newOptions = mcqOptions.filter((_, i) => i !== index);
      setMcqOptions(newOptions);
      if (correctOption >= newOptions.length) {
        setCorrectOption(newOptions.length - 1);
      }
    }
  };

  const addLeftItem = () => setLeftItems([...leftItems, '']);
  const addRightItem = () => setRightItems([...rightItems, '']);
  
  const updateLeftItem = (index: number, value: string) => {
    const newItems = [...leftItems];
    newItems[index] = value;
    setLeftItems(newItems);
  };

  const updateRightItem = (index: number, value: string) => {
    const newItems = [...rightItems];
    newItems[index] = value;
    setRightItems(newItems);
  };

  const removeLeftItem = (index: number) => {
    if (leftItems.length > 1) {
      setLeftItems(leftItems.filter((_, i) => i !== index));
    }
  };

  const removeRightItem = (index: number) => {
    if (rightItems.length > 1) {
      setRightItems(rightItems.filter((_, i) => i !== index));
    }
  };

  const addMapArea = () => {
    setMapAreas([...mapAreas, { label: `Q${mapAreas.length + 1}`, answer: '', x: 50, y: 50 }]);
  };

  const updateMapArea = (index: number, field: keyof typeof mapAreas[0], value: string | number) => {
    const newAreas = [...mapAreas];
    newAreas[index] = { ...newAreas[index], [field]: value };
    setMapAreas(newAreas);
  };

  const removeMapArea = (index: number) => {
    setMapAreas(mapAreas.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Insert Question</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Question Type Selection */}
          <div className="space-y-2">
            <Label>Question Type</Label>
            <Select value={questionType} onValueChange={(value: QuestionType) => setQuestionType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Fill in the Blank</SelectItem>
                <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                <SelectItem value="matching">Matching</SelectItem>
                <SelectItem value="map">Map/Diagram</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Question Number */}
          <div className="space-y-2">
            <Label>Question Number</Label>
            <Input
              type="number"
              value={questionNumber}
              onChange={(e) => setQuestionNumber(parseInt(e.target.value) || 1)}
              min={1}
            />
          </div>

          {/* Blank Questions */}
          {questionType === 'blank' && (
            <div className="space-y-2">
              <Label>Answer(s)</Label>
              <Textarea
                placeholder="Enter answer (for single) or answers separated by commas (for multiple)"
                value={blankAnswers}
                onChange={(e) => setBlankAnswers(e.target.value)}
                rows={3}
              />
              <p className="text-sm text-gray-500">
                Example: "Paris" or "Paris, France, capital"
              </p>
            </div>
          )}

          {/* MCQ Questions */}
          {questionType === 'mcq' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Question Text</Label>
                <Input
                  placeholder="What is the capital of France?"
                  value={mcqQuestion}
                  onChange={(e) => setMcqQuestion(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Options</Label>
                  <Button size="sm" onClick={addMcqOption}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                </div>
                
                {mcqOptions.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={correctOption === index}
                      onChange={() => setCorrectOption(index)}
                    />
                    <Input
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      value={option}
                      onChange={(e) => updateMcqOption(index, e.target.value)}
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
                
                <p className="text-sm text-gray-500">
                  Select the radio button next to the correct answer
                </p>
              </div>
            </div>
          )}

          {/* Matching Questions */}
          {questionType === 'matching' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Left Side (Prompts)</Label>
                  <Button size="sm" onClick={addLeftItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {leftItems.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      placeholder={`Prompt ${index + 1}`}
                      value={item}
                      onChange={(e) => updateLeftItem(index, e.target.value)}
                      className="flex-1"
                    />
                    {leftItems.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeLeftItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Right Side (Answers)</Label>
                  <Button size="sm" onClick={addRightItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {rightItems.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      placeholder={`Answer ${index + 1}`}
                      value={item}
                      onChange={(e) => updateRightItem(index, e.target.value)}
                      className="flex-1"
                    />
                    {rightItems.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeRightItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map Questions */}
          {questionType === 'map' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input
                  placeholder="https://example.com/map.jpg"
                  value={mapImageUrl}
                  onChange={(e) => setMapImageUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Clickable Areas</Label>
                  <Button size="sm" onClick={addMapArea}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Area
                  </Button>
                </div>

                {mapAreas.map((area, index) => (
                  <div key={index} className="grid grid-cols-5 gap-2 items-center">
                    <Input
                      placeholder="Label"
                      value={area.label}
                      onChange={(e) => updateMapArea(index, 'label', e.target.value)}
                    />
                    <Input
                      placeholder="Answer"
                      value={area.answer}
                      onChange={(e) => updateMapArea(index, 'answer', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="X%"
                      value={area.x}
                      onChange={(e) => updateMapArea(index, 'x', parseInt(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      placeholder="Y%"
                      value={area.y}
                      onChange={(e) => updateMapArea(index, 'y', parseInt(e.target.value) || 0)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeMapArea(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="border-t pt-4">
            <Label>Bracket Syntax Preview</Label>
            <div className="bg-gray-50 p-3 rounded text-sm font-mono break-all">
              {questionType === 'blank' && blankAnswers && (
                blankAnswers.includes(',')
                  ? blankAnswers.split(',').map((ans, i) => `[${ans.trim()}]`).join(' ')
                  : `[${blankAnswers}]`
              )}
              {questionType === 'mcq' && mcqQuestion && (
                `[${questionNumber}:MCQ] ${mcqQuestion} {${mcqOptions.map((opt, i) =>
                  i === correctOption ? `${opt}*` : opt
                ).join('|')}}`
              )}
              {questionType === 'matching' && leftItems[0] && rightItems[0] && (
                `[${questionNumber}:MATCH] {Left:${leftItems.filter(i => i.trim()).join(',')}|Right:${rightItems.filter(i => i.trim()).join(',')}}`
              )}
              {questionType === 'map' && mapImageUrl && (
                `[${questionNumber}:MAP] {image:${mapImageUrl}|areas:${mapAreas.map(a =>
                  `${a.label}=${a.answer}@${a.x},${a.y}`
                ).join(';')}}`
              )}
            </div>

            {/* Student View Explanation */}
            <div className="mt-3 p-3 bg-blue-50 rounded text-sm">
              <h5 className="font-medium mb-2">How students will see this:</h5>
              {questionType === 'blank' && (
                <p>✏️ <strong>Fill-in-the-blank</strong>: Text input field where students type their answer</p>
              )}
              {questionType === 'mcq' && (
                <p>📋 <strong>Multiple Choice</strong>: Radio buttons with A) B) C) D) options for students to select</p>
              )}
              {questionType === 'matching' && (
                <p>🔄 <strong>Drag & Drop Matching</strong>: Students drag answers from the right into empty boxes next to prompts on the left</p>
              )}
              {questionType === 'map' && (
                <p>🗺️ <strong>Interactive Map</strong>: Clickable image with numbered markers for location-based questions</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert}>
            Insert Question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
