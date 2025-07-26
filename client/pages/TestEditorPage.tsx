import React from 'react';
import { UnifiedTestEditor } from '@/components/test-creation/UnifiedTestEditor';

const TestEditorPage: React.FC = () => {
  const handleQuestionsChange = (questions: any[]) => {
    console.log('Questions updated:', questions);
  };

  return (
    <div className="p-6 max-w-full mx-auto">
      <h1 className="text-3xl font-bold mb-6">Enhanced Test Editor Demo</h1>
      <UnifiedTestEditor 
        onQuestionsChange={handleQuestionsChange}
        placeholder="Try the enhanced editor with all 5 question types!"
      />
    </div>
  );
};

export default TestEditorPage;
