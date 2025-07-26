// Content Parser for IELTS Listening Tests
// Converts admin content with filled answers to student test format with numbered inputs

export interface ParsedAnswer {
  id: string;
  questionNumber: number;
  originalText: string;
  answerValue: string;
  position: { start: number; end: number };
}

export interface ParsingResult {
  content: any;
  answers: ParsedAnswer[];
  totalQuestions: number;
}

/**
 * Main function to parse content from admin format to student format
 */
export function parseContentForStudent(adminContent: any): ParsingResult {
  if (!adminContent) {
    return { content: null, answers: [], totalQuestions: 0 };
  }

  let questionCounter = 1;
  const extractedAnswers: ParsedAnswer[] = [];

  // Deep clone the content to avoid mutating the original
  const studentContent = JSON.parse(JSON.stringify(adminContent));

  // Process the content recursively
  const processNode = (node: any): any => {
    if (!node) return node;

    // Handle different node types
    if (node.type === 'paragraph' && node.content) {
      return {
        ...node,
        content: node.content.map((childNode: any) => processNode(childNode))
      };
    }

    if (node.type === 'text' && node.text) {
      return processTextNode(node, extractedAnswers, questionCounter);
    }

    // Handle TipTap nodes that have structured question data
    if (node.type === 'short_answer') {
      const processedNode = processShortAnswerNode(node, extractedAnswers, questionCounter);
      questionCounter = processedNode.newQuestionCounter;
      return processedNode.node;
    }

    // Handle other question types
    if (['mcq', 'matching', 'sentence_completion', 'map_diagram'].includes(node.type)) {
      const processedNode = processQuestionNode(node, extractedAnswers, questionCounter);
      questionCounter = processedNode.newQuestionCounter;
      return processedNode.node;
    }

    // Recursively process child content
    if (node.content) {
      return {
        ...node,
        content: node.content.map((childNode: any) => processNode(childNode))
      };
    }

    return node;
  };

  // Process the content
  if (studentContent.content) {
    studentContent.content = studentContent.content.map((node: any) => processNode(node));
  }

  // Update question counter based on extracted answers
  if (extractedAnswers.length > 0) {
    questionCounter = Math.max(...extractedAnswers.map(a => a.questionNumber)) + 1;
  }

  return {
    content: studentContent,
    answers: extractedAnswers,
    totalQuestions: questionCounter - 1
  };
}

/**
 * Process text nodes to find and replace answer patterns like [answer] with numbered inputs
 */
function processTextNode(node: any, extractedAnswers: ParsedAnswer[], questionCounter: number): any {
  let text = node.text;
  let currentQuestionNumber = questionCounter;

  // Pattern to match answers in brackets like [answer] or [  answer  ]
  const answerPattern = /\[\s*([^[\]]+?)\s*\]/g;
  let match;
  let offset = 0;

  while ((match = answerPattern.exec(text)) !== null) {
    const fullMatch = match[0]; // "[answer]"
    const answerValue = match[1].trim(); // "answer"
    const matchStart = match.index;
    const matchEnd = match.index + fullMatch.length;

    // Extract the answer
    const parsedAnswer: ParsedAnswer = {
      id: `text_answer_${currentQuestionNumber}`,
      questionNumber: currentQuestionNumber,
      originalText: fullMatch,
      answerValue: answerValue,
      position: { start: matchStart, end: matchEnd }
    };

    extractedAnswers.push(parsedAnswer);

    // Replace the answer with a numbered placeholder
    const beforeAnswer = text.substring(0, matchStart + offset);
    const afterAnswer = text.substring(matchEnd + offset);
    const replacement = `[    ${currentQuestionNumber}    ]`;
    
    text = beforeAnswer + replacement + afterAnswer;
    
    // Update offset for next iteration
    offset += replacement.length - fullMatch.length;
    
    // Reset regex lastIndex to account for text changes
    answerPattern.lastIndex = matchStart + replacement.length;
    
    currentQuestionNumber++;
  }

  return {
    ...node,
    text
  };
}

/**
 * Process short answer nodes (TipTap custom nodes)
 */
function processShortAnswerNode(node: any, extractedAnswers: ParsedAnswer[], questionCounter: number): { node: any, newQuestionCounter: number } {
  const answers = node.attrs?.answers || [""];
  let currentQuestionNumber = questionCounter;

  // Extract the answer data
  if (answers.length > 0 && answers[0]) {
    const parsedAnswer: ParsedAnswer = {
      id: `text_answer_${currentQuestionNumber}`, // Use 'text' for database compatibility
      questionNumber: currentQuestionNumber,
      originalText: 'text', // Use database-compatible type
      answerValue: answers.join(', '),
      position: { start: 0, end: 0 }
    };

    extractedAnswers.push(parsedAnswer);
  }

  // Return student version - clear the admin flag and set student mode
  const studentNode = {
    ...node,
    attrs: {
      ...node.attrs,
      admin: false,
      number: currentQuestionNumber,
      answers: [""] // Clear answers for student
    }
  };

  return {
    node: studentNode,
    newQuestionCounter: currentQuestionNumber + 1
  };
}

/**
 * Process other question node types
 */
function processQuestionNode(node: any, extractedAnswers: ParsedAnswer[], questionCounter: number): { node: any, newQuestionCounter: number } {
  let currentQuestionNumber = questionCounter;
  let answerValue = "";

  // Extract answer based on question type
  switch (node.type) {
    case 'mcq':
      const options = node.attrs?.options || [];
      const correctIndex = node.attrs?.correctIndex || 0;
      answerValue = options[correctIndex] || "";
      break;
    
    case 'sentence_completion':
      answerValue = (node.attrs?.answers || []).join(', ');
      break;
    
    case 'matching':
      const left = node.attrs?.left || [];
      const right = node.attrs?.right || [];
      answerValue = JSON.stringify({ left, right });
      break;
    
    case 'map_diagram':
      const boxes = node.attrs?.boxes || [];
      answerValue = boxes.map((box: any) => box.answer).join(', ');
      break;
  }

  // Store the answer with database-compatible type mapping
  if (answerValue) {
    // Map node types to database-compatible types
    const dbTypeMap: { [key: string]: string } = {
      'mcq': 'mcq',
      'sentence_completion': 'form',
      'matching': 'matching',
      'map_diagram': 'form'
    };

    const dbType = dbTypeMap[node.type] || 'text';

    const parsedAnswer: ParsedAnswer = {
      id: `${dbType}_${currentQuestionNumber}`,
      questionNumber: currentQuestionNumber,
      originalText: dbType,
      answerValue,
      position: { start: 0, end: 0 }
    };

    extractedAnswers.push(parsedAnswer);
  }

  // Return student version
  const studentNode = {
    ...node,
    attrs: {
      ...node.attrs,
      admin: false,
      number: currentQuestionNumber
    }
  };

  return {
    node: studentNode,
    newQuestionCounter: currentQuestionNumber + 1
  };
}

/**
 * Parse rich text content (like from a rich text editor) to extract fill-in-the-blank questions
 */
export function parseRichTextContent(htmlContent: string): { 
  studentHTML: string, 
  answers: ParsedAnswer[] 
} {
  let content = htmlContent;
  const answers: ParsedAnswer[] = [];
  let questionNumber = 1;

  // Pattern to match answers in brackets
  const answerPattern = /\[\s*([^[\]]+?)\s*\]/g;
  
  content = content.replace(answerPattern, (match, answerValue) => {
    const trimmedAnswer = answerValue.trim();
    
    // Store the answer
    answers.push({
      id: `rich_text_${questionNumber}`,
      questionNumber,
      originalText: match,
      answerValue: trimmedAnswer,
      position: { start: 0, end: 0 }
    });

    // Replace with numbered input placeholder
    const replacement = `<span class="question-input" data-question="${questionNumber}">
      <input type="text" 
             class="inline-input" 
             placeholder="${questionNumber}" 
             data-question-id="${questionNumber}"
             style="display: inline-block; min-width: 60px; padding: 2px 8px; border: none; border-bottom: 2px solid #333; background: transparent; text-align: center; font-weight: bold;" />
    </span>`;
    
    questionNumber++;
    return replacement;
  });

  return {
    studentHTML: content,
    answers
  };
}

/**
 * Create answer mapping for submission
 */
export function createAnswerMapping(answers: ParsedAnswer[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  answers.forEach(answer => {
    mapping[answer.id] = answer.answerValue;
    mapping[answer.questionNumber.toString()] = answer.answerValue;
  });
  
  return mapping;
}

/**
 * Validate student answers against correct answers
 */
export function validateAnswers(
  studentAnswers: Record<string, string>, 
  correctAnswers: ParsedAnswer[]
): { 
  totalQuestions: number, 
  correctCount: number, 
  results: Array<{ questionNumber: number, correct: boolean, studentAnswer: string, correctAnswer: string }> 
} {
  const results = correctAnswers.map(answer => {
    const studentAnswer = studentAnswers[answer.questionNumber.toString()] || "";
    const isCorrect = normalizeAnswer(studentAnswer) === normalizeAnswer(answer.answerValue);
    
    return {
      questionNumber: answer.questionNumber,
      correct: isCorrect,
      studentAnswer,
      correctAnswer: answer.answerValue
    };
  });

  const correctCount = results.filter(r => r.correct).length;

  return {
    totalQuestions: correctAnswers.length,
    correctCount,
    results
  };
}

/**
 * Normalize answers for comparison (lowercase, trim, etc.)
 */
function normalizeAnswer(answer: string): string {
  return answer.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Extract all answers from TipTap JSON content for admin preview
 */
export function extractAnswersFromContent(content: any): ParsedAnswer[] {
  const answers: ParsedAnswer[] = [];
  let questionNumber = 1;

  const traverse = (node: any) => {
    if (!node) return;

    // Handle text nodes with brackets
    if (node.type === 'text' && node.text) {
      const answerPattern = /\[\s*([^[\]]+?)\s*\]/g;
      let match;
      
      while ((match = answerPattern.exec(node.text)) !== null) {
        answers.push({
          id: `text_${questionNumber}`,
          questionNumber,
          originalText: match[0],
          answerValue: match[1].trim(),
          position: { start: match.index, end: match.index + match[0].length }
        });
        questionNumber++;
      }
    }

    // Handle structured question nodes
    if (node.type === 'short_answer' && node.attrs?.answers) {
      const nodeAnswers = node.attrs.answers.filter((a: string) => a.trim());
      if (nodeAnswers.length > 0) {
        answers.push({
          id: `short_answer_${questionNumber}`,
          questionNumber,
          originalText: 'short_answer',
          answerValue: nodeAnswers.join(', '),
          position: { start: 0, end: 0 }
        });
        questionNumber++;
      }
    }

    // Handle other question types
    if (['mcq', 'sentence_completion', 'matching', 'map_diagram'].includes(node.type)) {
      let answerValue = "";
      
      switch (node.type) {
        case 'mcq':
          const options = node.attrs?.options || [];
          const correctIndex = node.attrs?.correctIndex || 0;
          answerValue = options[correctIndex] || "";
          break;
        case 'sentence_completion':
          answerValue = (node.attrs?.answers || []).join(', ');
          break;
        case 'matching':
          answerValue = `${(node.attrs?.left || []).length} pairs`;
          break;
        case 'map_diagram':
          answerValue = `${(node.attrs?.boxes || []).length} boxes`;
          break;
      }

      if (answerValue) {
        answers.push({
          id: `${node.type}_${questionNumber}`,
          questionNumber,
          originalText: node.type,
          answerValue,
          position: { start: 0, end: 0 }
        });
        questionNumber++;
      }
    }

    // Traverse child nodes
    if (node.content) {
      node.content.forEach(traverse);
    }
  };

  if (content?.content) {
    content.content.forEach(traverse);
  }

  return answers;
}
