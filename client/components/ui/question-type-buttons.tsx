import React, { useState } from 'react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Input } from './input';
import { Textarea } from './textarea';
import { Label } from './label';
import { MediaUploader, MediaFile } from './media-uploader';
import { 
  Type, 
  List, 
  MousePointer, 
  Map, 
  Plus, 
  X,
  Upload,
  HelpCircle 
} from 'lucide-react';

interface QuestionTypeButtonsProps {
  onInsertQuestion: (questionData: any) => void;
}

export function QuestionTypeButtons({ onInsertQuestion }: QuestionTypeButtonsProps) {
  const [showModal, setShowModal] = useState(false);
  const [questionType, setQuestionType] = useState<'blank' | 'mcq' | 'matching' | 'map' | null>(null);
  
  // Form states
  const [blankAnswers, setBlankAnswers] = useState('');
  const [mcqQuestion, setMcqQuestion] = useState('');
  const [mcqOptions, setMcqOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(0);
  const [leftItems, setLeftItems] = useState(['']);
  const [rightItems, setRightItems] = useState(['']);
  const [mapImageFiles, setMapImageFiles] = useState<MediaFile[]>([]);
  const [mapAreas, setMapAreas] = useState<Array<{ id: number; x: number; y: number; label: string; answer: string }>>([]);

  const openModal = (type: 'blank' | 'mcq' | 'matching' | 'map') => {
    setQuestionType(type);
    setShowModal(true);
    resetForm();
  };

  const closeModal = () => {
    setShowModal(false);
    setQuestionType(null);
    resetForm();
  };

  const resetForm = () => {
    setBlankAnswers('');
    setMcqQuestion('');
    setMcqOptions(['', '', '', '']);
    setCorrectOption(0);
    setLeftItems(['']);
    setRightItems(['']);
    setMapImageFiles([]);
    setMapAreas([]);
  };

  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (mapImageFiles.length === 0) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    const newArea = {
      id: Date.now(),
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      label: `Q${mapAreas.length + 1}`,
      answer: ''
    };
    
    setMapAreas([...mapAreas, newArea]);
  };

  const updateMapArea = (id: number, field: string, value: string) => {
    setMapAreas(areas => areas.map(area => 
      area.id === id ? { ...area, [field]: value } : area
    ));
  };

  const removeMapArea = (id: number) => {
    setMapAreas(areas => areas.filter(area => area.id !== id));
  };

  const insertQuestion = () => {
    let questionData: any = {};

    switch (questionType) {
      case 'blank':
        if (blankAnswers.includes(',')) {
          // Multiple blanks
          const answers = blankAnswers.split(',').map(a => a.trim());
          questionData = {
            type: 'multiple_blank',
            answers: answers,
            content: answers.map((ans, i) => `[${ans}]`).join(' ')
          };
        } else {
          // Single blank
          questionData = {
            type: 'short_answer',
            answer: blankAnswers.trim(),
            content: `[${blankAnswers.trim()}]`
          };
        }
        break;

      case 'mcq':
        questionData = {
          type: 'multiple_choice',
          question: mcqQuestion,
          options: mcqOptions.filter(opt => opt.trim()),
          correctAnswer: correctOption,
          content: {
            question: mcqQuestion,
            options: mcqOptions.filter(opt => opt.trim()),
            correctIndex: correctOption
          }
        };
        break;

      case 'matching':
        questionData = {
          type: 'matching',
          leftItems: leftItems.filter(item => item.trim()),
          rightItems: rightItems.filter(item => item.trim()),
          content: {
            left: leftItems.filter(item => item.trim()),
            right: rightItems.filter(item => item.trim())
          }
        };
        break;

      case 'map':
        if (mapImageFiles.length > 0 && mapAreas.length > 0) {
          questionData = {
            type: 'map_diagram',
            imageUrl: mapImageFiles[0].url,
            areas: mapAreas,
            content: {
              imageUrl: mapImageFiles[0].url,
              boxes: mapAreas.map(area => ({
                id: area.id,
                x: area.x,
                y: area.y,
                label: area.label,
                answer: area.answer,
                question: ''
              }))
            }
          };
        }
        break;
    }

    if (Object.keys(questionData).length > 0) {
      onInsertQuestion(questionData);
      closeModal();
    }
  };

  return (
    <>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Insert Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              onClick={() => openModal('blank')}
              className="h-auto p-4 flex flex-col items-center space-y-2"
            >
              <Type className="h-6 w-6" />
              <span className="text-sm">Fill Blanks</span>
              <span className="text-xs text-gray-500">Text input</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => openModal('mcq')}
              className="h-auto p-4 flex flex-col items-center space-y-2"
            >
              <List className="h-6 w-6" />
              <span className="text-sm">Multiple Choice</span>
              <span className="text-xs text-gray-500">A, B, C, D options</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => openModal('matching')}
              className="h-auto p-4 flex flex-col items-center space-y-2"
            >
              <MousePointer className="h-6 w-6" />
              <span className="text-sm">Matching</span>
              <span className="text-xs text-gray-500">Drag & drop</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => openModal('map')}
              className="h-auto p-4 flex flex-col items-center space-y-2"
            >
              <Map className="h-6 w-6" />
              <span className="text-sm">Map/Diagram</span>
              <span className="text-xs text-gray-500">Interactive image</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Insert {questionType === 'blank' ? 'Fill-in-the-Blank' :
                      questionType === 'mcq' ? 'Multiple Choice' :
                      questionType === 'matching' ? 'Matching' :
                      'Map/Diagram'} Question
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Fill Blanks */}
            {questionType === 'blank' && (
              <div className="space-y-4">
                <div>
                  <Label>Answer(s)</Label>
                  <Textarea
                    placeholder="Enter answer (single) or answers separated by commas (multiple)"
                    value={blankAnswers}
                    onChange={(e) => setBlankAnswers(e.target.value)}
                    rows={3}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Example: "Paris" or "Paris, France, capital"
                  </p>
                </div>
              </div>
            )}

            {/* MCQ */}
            {questionType === 'mcq' && (
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
                    <div key={index} className="flex items-center space-x-2 mt-2">
                      <input
                        type="radio"
                        name="correct"
                        checked={correctOption === index}
                        onChange={() => setCorrectOption(index)}
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matching */}
            {questionType === 'matching' && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label>Left Side (Prompts)</Label>
                  {leftItems.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2 mt-2">
                      <Input
                        placeholder={`Prompt ${index + 1}`}
                        value={item}
                        onChange={(e) => {
                          const newItems = [...leftItems];
                          newItems[index] = e.target.value;
                          setLeftItems(newItems);
                        }}
                        className="flex-1"
                      />
                      {leftItems.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLeftItems(leftItems.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    size="sm"
                    onClick={() => setLeftItems([...leftItems, ''])}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Prompt
                  </Button>
                </div>

                <div>
                  <Label>Right Side (Answers)</Label>
                  {rightItems.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2 mt-2">
                      <Input
                        placeholder={`Answer ${index + 1}`}
                        value={item}
                        onChange={(e) => {
                          const newItems = [...rightItems];
                          newItems[index] = e.target.value;
                          setRightItems(newItems);
                        }}
                        className="flex-1"
                      />
                      {rightItems.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRightItems(rightItems.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    size="sm"
                    onClick={() => setRightItems([...rightItems, ''])}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Answer
                  </Button>
                </div>
              </div>
            )}

            {/* Map */}
            {questionType === 'map' && (
              <div className="space-y-4">
                <div>
                  <Label>Upload Image</Label>
                  <MediaUploader
                    mediaType="image"
                    acceptedTypes={['.jpg', '.jpeg', '.png', '.gif']}
                    maxSizeMB={5}
                    multiple={false}
                    onUpload={(files) => setMapImageFiles(files)}
                  />
                </div>

                {mapImageFiles.length > 0 && (
                  <div>
                    <Label>Click on the image to add answer boxes</Label>
                    <div className="relative border rounded-lg overflow-hidden">
                      <img
                        src={mapImageFiles[0].url}
                        alt="Map"
                        className="max-w-full cursor-crosshair"
                        onClick={handleImageClick}
                      />
                      {mapAreas.map((area) => (
                        <div
                          key={area.id}
                          className="absolute w-8 h-8 bg-red-500 text-white text-xs flex items-center justify-center rounded-full cursor-pointer border-2 border-white"
                          style={{
                            left: `${area.x}%`,
                            top: `${area.y}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                          title={`${area.label}: ${area.answer}`}
                        >
                          {area.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mapAreas.length > 0 && (
                  <div>
                    <Label>Configure Answer Areas</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {mapAreas.map((area) => (
                        <div key={area.id} className="grid grid-cols-4 gap-2 items-center p-2 border rounded">
                          <Input
                            placeholder="Label"
                            value={area.label}
                            onChange={(e) => updateMapArea(area.id, 'label', e.target.value)}
                          />
                          <Input
                            placeholder="Answer"
                            value={area.answer}
                            onChange={(e) => updateMapArea(area.id, 'answer', e.target.value)}
                          />
                          <span className="text-sm text-gray-500">
                            {area.x.toFixed(1)}%, {area.y.toFixed(1)}%
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeMapArea(area.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <Button variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button onClick={insertQuestion}>
                Insert Question
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
