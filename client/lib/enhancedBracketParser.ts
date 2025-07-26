export interface ParsedContent {
  content: string;
  questions: Question[];
  inputPositions: Array<{ start: number; end: number; questionId: number }>;
}

export interface Question {
  id: number;
  type: 'blank' | 'mcq' | 'matching' | 'map';
  content: string;
  answer: string | number | any;
  options?: string[];
  metadata?: any;
}

export interface StudentContent {
  content: string;
  questions: StudentQuestion[];
}

export interface StudentQuestion {
  id: number;
  type: 'blank' | 'mcq' | 'matching' | 'map';
  content: string;
  options?: string[];
  metadata?: any;
}

/**
 * Enhanced bracket parser supporting multiple question types:
 * - Simple: [Paris]
 * - MCQ: [1:MCQ] What is the capital? {A:London|B:Paris*|C:Berlin|D:Rome}
 * - Matching: [2:MATCH] {Left:Speaker 1,Speaker 2|Right:Statement A,Statement B}
 * - Map: [3:MAP] {image:url|areas:Library@45,30*;Cafe@60,70*}
 */
export class EnhancedBracketParser {
  private static SIMPLE_BRACKET_REGEX = /\[([^\[\]{}:]+)\]/g;
  private static ADVANCED_BRACKET_REGEX = /\[(\d+):(MCQ|MATCH|MAP)\]\s*([^{]*?)\s*\{([^}]+)\}/g;

  /**
   * Parse content and extract all question types
   */
  static parseContent(content: string): ParsedContent {
    const questions: Question[] = [];
    const inputPositions: Array<{ start: number; end: number; questionId: number }> = [];
    let processedContent = content;
    let questionCounter = 1;

    // First, process advanced question types
    processedContent = processedContent.replace(this.ADVANCED_BRACKET_REGEX, (match, id, type, questionText, options) => {
      const questionId = parseInt(id) || questionCounter++;
      const question = this.parseAdvancedQuestion(questionId, type, questionText, options);
      questions.push(question);
      
      return `[__QUESTION_${questionId}__]`;
    });

    // Then process simple brackets
    processedContent = processedContent.replace(this.SIMPLE_BRACKET_REGEX, (match, answer) => {
      const questionId = questionCounter++;
      const question: Question = {
        id: questionId,
        type: 'blank',
        content: '',
        answer: answer.trim()
      };
      questions.push(question);
      
      return `[__QUESTION_${questionId}__]`;
    });

    return {
      content: processedContent,
      questions,
      inputPositions
    };
  }

  /**
   * Parse advanced question syntax
   */
  private static parseAdvancedQuestion(id: number, type: string, questionText: string, optionsStr: string): Question {
    const baseQuestion = {
      id,
      type: type.toLowerCase() as Question['type'],
      content: questionText.trim()
    };

    switch (type) {
      case 'MCQ':
        return this.parseMCQ(baseQuestion, optionsStr);
      case 'MATCH':
        return this.parseMatching(baseQuestion, optionsStr);
      case 'MAP':
        return this.parseMap(baseQuestion, optionsStr);
      default:
        return { ...baseQuestion, answer: '' };
    }
  }

  /**
   * Parse MCQ options: {A:London|B:Paris*|C:Berlin|D:Rome}
   */
  private static parseMCQ(baseQuestion: Partial<Question>, optionsStr: string): Question {
    const options: string[] = [];
    let correctAnswer = 0;

    const optionParts = optionsStr.split('|');
    optionParts.forEach((part, index) => {
      const trimmed = part.trim();
      if (trimmed.endsWith('*')) {
        correctAnswer = index;
        options.push(trimmed.slice(0, -1));
      } else {
        options.push(trimmed);
      }
    });

    return {
      ...baseQuestion,
      type: 'mcq',
      options,
      answer: correctAnswer,
      metadata: { correctIndex: correctAnswer }
    } as Question;
  }

  /**
   * Parse matching options: {Left:Speaker 1,Speaker 2|Right:Statement A,Statement B}
   */
  private static parseMatching(baseQuestion: Partial<Question>, optionsStr: string): Question {
    const parts = optionsStr.split('|');
    let leftItems: string[] = [];
    let rightItems: string[] = [];

    parts.forEach(part => {
      const [key, value] = part.split(':');
      if (key?.trim().toLowerCase() === 'left') {
        leftItems = value?.split(',').map(item => item.trim()) || [];
      } else if (key?.trim().toLowerCase() === 'right') {
        rightItems = value?.split(',').map(item => item.trim()) || [];
      }
    });

    return {
      ...baseQuestion,
      type: 'matching',
      answer: { left: leftItems, right: rightItems },
      metadata: { leftItems, rightItems }
    } as Question;
  }

  /**
   * Parse map options: {image:url|areas:Library@45,30*;Cafe@60,70*}
   */
  private static parseMap(baseQuestion: Partial<Question>, optionsStr: string): Question {
    const parts = optionsStr.split('|');
    let imageUrl = '';
    let areas: any[] = [];

    parts.forEach(part => {
      const [key, value] = part.split(':');
      if (key?.trim().toLowerCase() === 'image') {
        imageUrl = value?.trim() || '';
      } else if (key?.trim().toLowerCase() === 'areas') {
        areas = this.parseMapAreas(value || '');
      }
    });

    return {
      ...baseQuestion,
      type: 'map',
      answer: areas,
      metadata: { imageUrl, areas }
    } as Question;
  }

  /**
   * Parse map areas: Library@45,30*;Cafe@60,70*
   */
  private static parseMapAreas(areasStr: string): any[] {
    return areasStr.split(';').map((area, index) => {
      const parts = area.trim().split('@');
      if (parts.length !== 2) return null;

      const [label, coords] = parts;
      const [x, y] = coords.split(',').map(coord => parseFloat(coord.replace('*', '')));

      return {
        id: index + 1,
        label: label.trim(),
        x: x || 0,
        y: y || 0,
        answer: label.trim()
      };
    }).filter(Boolean);
  }

  /**
   * Generate student view with appropriate input fields
   */
  static generateStudentContent(content: string): StudentContent {
    const parsed = this.parseContent(content);
    const studentQuestions: StudentQuestion[] = [];
    
    let studentContent = parsed.content;
    
    parsed.questions.forEach(question => {
      const placeholder = `[__QUESTION_${question.id}__]`;
      let replacement = '';

      switch (question.type) {
        case 'blank':
          replacement = `[  ${question.id}  ]`;
          break;
        case 'mcq':
          replacement = `[MCQ-${question.id}]`;
          break;
        case 'matching':
          replacement = `[MATCH-${question.id}]`;
          break;
        case 'map':
          replacement = `[MAP-${question.id}]`;
          break;
      }

      studentContent = studentContent.replace(placeholder, replacement);
      
      studentQuestions.push({
        id: question.id,
        type: question.type,
        content: question.content,
        options: question.options,
        metadata: question.metadata
      });
    });

    return {
      content: studentContent,
      questions: studentQuestions
    };
  }

  /**
   * Render student content as HTML with interactive elements
   */
  static renderStudentContentAsHTML(
    content: string, 
    studentAnswers: Record<number, any> = {},
    readonly = false
  ): string {
    const parsed = this.parseContent(content);
    let htmlContent = parsed.content;

    parsed.questions.forEach(question => {
      const placeholder = `[__QUESTION_${question.id}__]`;
      let replacement = '';

      switch (question.type) {
        case 'blank':
          const value = studentAnswers[question.id] || '';
          if (readonly) {
            replacement = `<span class="inline-block min-w-[60px] px-2 py-1 bg-gray-100 border rounded text-center font-mono">${value || '___'}</span>`;
          } else {
            replacement = `<input 
              type="text" 
              id="input-${question.id}" 
              data-question-id="${question.id}"
              data-question-type="blank"
              value="${value}" 
              class="inline-block w-20 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none"
              placeholder="${question.id}"
            />`;
          }
          break;

        case 'mcq':
          replacement = `<div class="mcq-question-${question.id} my-4 p-4 border rounded bg-blue-50" data-question-container="${question.id}">
            <p class="font-medium mb-3">Question ${question.id}: ${question.content}</p>
            <div class="space-y-3">
              ${question.options?.map((option, index) => {
                const isSelected = studentAnswers[question.id] === index;
                return `<label class="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-blue-100 transition-colors">
                  <input
                    type="radio"
                    name="mcq-${question.id}"
                    value="${index}"
                    data-question-id="${question.id}"
                    data-question-type="mcq"
                    ${isSelected ? 'checked' : ''}
                    ${readonly ? 'disabled' : ''}
                    class="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span class="flex-1 text-sm">${String.fromCharCode(65 + index)}) ${option}</span>
                </label>`;
              }).join('') || ''}
            </div>
          </div>`;
          break;

        case 'matching':
          const leftItems = question.metadata?.leftItems || [];
          const rightItems = question.metadata?.rightItems || [];
          const studentMatches = studentAnswers[question.id] || {};

          replacement = `<div class="matching-question-${question.id} my-4 p-4 border rounded bg-green-50" data-question-container="${question.id}">
            <p class="font-medium mb-3">Question ${question.id}: ${question.content}</p>
            <p class="text-sm text-gray-600 mb-4">Drag answers from the right to match with items on the left</p>
            <div class="grid grid-cols-2 gap-6">
              <!-- Left side: Prompts with drop zones -->
              <div class="space-y-3">
                <h4 class="font-medium text-sm text-gray-700 mb-2">Items to match:</h4>
                ${leftItems.map((item: string, index: number) => {
                  const matchedAnswer = studentMatches[index] || '';
                  return `<div class="flex items-center space-x-3 p-2 bg-white border rounded">
                    <span class="flex-1 text-sm font-medium">${item}</span>
                    <div
                      class="drop-zone w-24 h-8 border-2 border-dashed border-gray-300 rounded bg-gray-50 flex items-center justify-center text-xs text-gray-500 transition-colors"
                      data-question-id="${question.id}"
                      data-drop-index="${index}"
                      data-question-type="matching"
                      ondrop="handleDrop(event)"
                      ondragover="handleDragOver(event)"
                      ondragleave="handleDragLeave(event)"
                    >
                      ${matchedAnswer ? `<span class="text-blue-600 font-medium">${matchedAnswer}</span>` : 'Drop here'}
                    </div>
                  </div>`;
                }).join('')}
              </div>

              <!-- Right side: Draggable answers -->
              <div class="space-y-3">
                <h4 class="font-medium text-sm text-gray-700 mb-2">Drag these answers:</h4>
                ${rightItems.map((item: string, index: number) => {
                  const isUsed = Object.values(studentMatches).includes(item);
                  return `<div
                    class="draggable-answer p-2 bg-blue-100 border border-blue-300 rounded cursor-move text-sm font-medium text-center transition-opacity ${
                      isUsed && !readonly ? 'opacity-50' : 'opacity-100'
                    }"
                    draggable="true"
                    data-answer="${item}"
                    data-answer-index="${index}"
                    ondragstart="handleDragStart(event)"
                    ${readonly ? 'draggable="false"' : ''}
                  >
                    ${item}
                  </div>`;
                }).join('')}
              </div>
            </div>

            <!-- Drag and drop scripts -->
            <script>
              if (typeof window.handleDragStart === 'undefined') {
                window.handleDragStart = function(e) {
                  e.dataTransfer.setData('text/plain', e.target.dataset.answer);
                  e.dataTransfer.setData('application/json', JSON.stringify({
                    answer: e.target.dataset.answer,
                    answerIndex: e.target.dataset.answerIndex
                  }));
                };

                window.handleDragOver = function(e) {
                  e.preventDefault();
                  e.target.classList.add('border-blue-500', 'bg-blue-100');
                  e.target.classList.remove('border-gray-300', 'bg-gray-50');
                };

                window.handleDragLeave = function(e) {
                  e.target.classList.remove('border-blue-500', 'bg-blue-100');
                  e.target.classList.add('border-gray-300', 'bg-gray-50');
                };

                window.handleDrop = function(e) {
                  e.preventDefault();
                  const answer = e.dataTransfer.getData('text/plain');
                  const questionId = e.target.dataset.questionId;
                  const dropIndex = e.target.dataset.dropIndex;

                  // Reset visual state
                  e.target.classList.remove('border-blue-500', 'bg-blue-100');
                  e.target.classList.add('border-gray-300', 'bg-gray-50');

                  // Update the drop zone content
                  e.target.innerHTML = \`<span class="text-blue-600 font-medium">\${answer}</span>\`;

                  // Trigger custom event for answer update
                  const event = new CustomEvent('matchingAnswerUpdate', {
                    detail: {
                      questionId: parseInt(questionId),
                      dropIndex: parseInt(dropIndex),
                      answer: answer
                    }
                  });
                  document.dispatchEvent(event);

                  // Update draggable opacity
                  const draggables = document.querySelectorAll('.draggable-answer');
                  draggables.forEach(drag => {
                    if (drag.dataset.answer === answer) {
                      drag.classList.add('opacity-50');
                    }
                  });
                };
              }
            </script>
          </div>`;
          break;

        case 'map':
          replacement = `<div class="map-question-${question.id} my-4 p-4 border rounded bg-yellow-50">
            <p class="font-medium mb-2">Question ${question.id}: ${question.content}</p>
            ${question.metadata?.imageUrl ? 
              `<div class="relative inline-block">
                <img src="${question.metadata.imageUrl}" alt="Map" class="max-w-full border rounded" />
                ${question.metadata?.areas?.map((area: any) => 
                  `<div 
                    class="absolute w-6 h-6 bg-red-500 text-white text-xs flex items-center justify-center rounded-full cursor-pointer"
                    style="left: ${area.x}%; top: ${area.y}%; transform: translate(-50%, -50%)"
                    data-question-id="${question.id}"
                    data-area-id="${area.id}"
                    data-question-type="map"
                  >${area.id}</div>`
                ).join('') || ''}
              </div>` : 
              '<p class="text-gray-500">No image provided</p>'
            }
          </div>`;
          break;
      }

      htmlContent = htmlContent.replace(placeholder, replacement);
    });

    return htmlContent;
  }

  /**
   * Extract answers from student responses
   */
  static extractAnswersFromStudentData(
    content: string,
    studentData: Record<number, any>
  ): Array<{ questionId: number; type: string; answer: any; correct: boolean }> {
    const parsed = this.parseContent(content);
    
    return parsed.questions.map(question => {
      const studentAnswer = studentData[question.id];
      let isCorrect = false;

      switch (question.type) {
        case 'blank':
          const correctAnswer = question.answer as string;
          isCorrect = studentAnswer?.toLowerCase()?.trim() === correctAnswer.toLowerCase().trim();
          break;
        case 'mcq':
          isCorrect = studentAnswer === question.answer;
          break;
        case 'matching':
          // Complex matching logic would go here
          isCorrect = false; // Placeholder
          break;
        case 'map':
          // Map validation logic would go here
          isCorrect = false; // Placeholder
          break;
      }

      return {
        questionId: question.id,
        type: question.type,
        answer: studentAnswer,
        correct: isCorrect
      };
    });
  }
}
