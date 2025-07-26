export interface ParsedContent {
  content: string;
  answers: string[];
  inputPositions: Array<{ start: number; end: number; answerId: number }>;
}

export interface StudentContent {
  content: string;
  totalInputs: number;
}

export interface AdminPreview {
  content: string;
  answers: string[];
  previewContent: string;
}

/**
 * Enhanced content parser for bracket placeholder system
 * Converts admin content: "The capital is [Paris]" 
 * To student content: "The capital is [  1  ]"
 */
export class BracketParser {
  private static BRACKET_REGEX = /\[([^\[\]]+)\]/g;

  /**
   * Parse admin content and extract answers
   */
  static parseAdminContent(content: string): ParsedContent {
    const answers: string[] = [];
    const inputPositions: Array<{ start: number; end: number; answerId: number }> = [];
    let match;
    let offset = 0;

    // Reset regex state
    this.BRACKET_REGEX.lastIndex = 0;

    while ((match = this.BRACKET_REGEX.exec(content)) !== null) {
      const answer = match[1].trim();
      const answerId = answers.length + 1;
      
      answers.push(answer);
      inputPositions.push({
        start: match.index - offset,
        end: match.index + match[0].length - offset,
        answerId
      });

      // Adjust offset for replacement
      offset += match[0].length - `[  ${answerId}  ]`.length;
    }

    return {
      content,
      answers,
      inputPositions
    };
  }

  /**
   * Convert admin content to student view with numbered inputs
   */
  static generateStudentContent(content: string): StudentContent {
    let inputCounter = 1;
    const studentContent = content.replace(this.BRACKET_REGEX, () => {
      return `[  ${inputCounter++}  ]`;
    });

    return {
      content: studentContent,
      totalInputs: inputCounter - 1
    };
  }

  /**
   * Generate admin preview showing both original and student view
   */
  static generateAdminPreview(content: string): AdminPreview {
    const parsed = this.parseAdminContent(content);
    const student = this.generateStudentContent(content);

    return {
      content: content,
      answers: parsed.answers,
      previewContent: student.content
    };
  }

  /**
   * Extract answers from student input data
   */
  static extractAnswersFromInputs(
    studentAnswers: Record<number, string>,
    totalInputs: number
  ): string[] {
    const answers: string[] = [];
    
    for (let i = 1; i <= totalInputs; i++) {
      answers.push(studentAnswers[i] || '');
    }

    return answers;
  }

  /**
   * Validate student answers against correct answers
   */
  static validateAnswers(
    studentAnswers: string[],
    correctAnswers: string[],
    caseSensitive = false
  ): Array<{ correct: boolean; studentAnswer: string; correctAnswer: string }> {
    return studentAnswers.map((studentAnswer, index) => {
      const correctAnswer = correctAnswers[index] || '';
      const student = caseSensitive ? studentAnswer.trim() : studentAnswer.trim().toLowerCase();
      const correct = caseSensitive ? correctAnswer.trim() : correctAnswer.trim().toLowerCase();

      return {
        correct: student === correct,
        studentAnswer: studentAnswer.trim(),
        correctAnswer: correctAnswer.trim()
      };
    });
  }

  /**
   * Calculate score from validation results
   */
  static calculateScore(validationResults: Array<{ correct: boolean }>): {
    correct: number;
    total: number;
    percentage: number;
  } {
    const correct = validationResults.filter(result => result.correct).length;
    const total = validationResults.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { correct, total, percentage };
  }

  /**
   * Convert content with inputs to HTML for rendering
   */
  static renderStudentContentAsHTML(
    content: string,
    studentAnswers: Record<number, string> = {},
    readonly = false
  ): string {
    let inputCounter = 1;
    
    return content.replace(/\[\s*(\d+)\s*\]/g, (match, number) => {
      const inputNumber = parseInt(number);
      const value = studentAnswers[inputNumber] || '';
      const inputId = `input-${inputNumber}`;
      
      if (readonly) {
        return `<span class="inline-block min-w-[60px] px-2 py-1 bg-gray-100 border rounded text-center font-mono">${value || '___'}</span>`;
      }
      
      return `<input 
        type="text" 
        id="${inputId}" 
        data-input-number="${inputNumber}"
        value="${value}" 
        class="inline-block w-20 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none"
        placeholder="${inputNumber}"
      />`;
    });
  }
}
