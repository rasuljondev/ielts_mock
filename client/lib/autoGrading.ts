// Grading system for IELTS tests
import { supabase } from "@/lib/supabase";

export interface GradingResult {
  readingScore: number;
  listeningScore: number;
  writingScore: number;
  totalScore: number;
  readingBandScore: number;
  listeningBandScore: number;
  writingBandScore: number;
  overallBandScore: number;
  breakdown: {
    reading: {
      correct: number;
      total: number;
      percentage: number;
    };
    listening: {
      correct: number;
      total: number;
      percentage: number;
    };
    writing: {
      score: number;
      criteria: {
        taskAchievement: number;
        coherenceCohesion: number;
        lexicalResource: number;
        grammarAccuracy: number;
      };
    };
  };
  detailedResults: QuestionResult[];
}

export interface QuestionResult {
  questionId: string;
  questionText: string;
  questionType: string;
  userAnswer: any;
  correctAnswer: any;
  isCorrect: boolean;
  points: number;
  section: "reading" | "listening" | "writing";
  explanation?: string;
}

// IELTS Band Score conversion tables
const READING_BAND_SCORES = {
  academic: [
    { min: 39, max: 40, band: 9.0 },
    { min: 37, max: 38, band: 8.5 },
    { min: 35, max: 36, band: 8.0 },
    { min: 33, max: 34, band: 7.5 },
    { min: 30, max: 32, band: 7.0 },
    { min: 27, max: 29, band: 6.5 },
    { min: 23, max: 26, band: 6.0 },
    { min: 19, max: 22, band: 5.5 },
    { min: 15, max: 18, band: 5.0 },
    { min: 11, max: 14, band: 4.5 },
    { min: 8, max: 10, band: 4.0 },
    { min: 5, max: 7, band: 3.5 },
    { min: 3, max: 4, band: 3.0 },
    { min: 1, max: 2, band: 2.5 },
    { min: 0, max: 0, band: 1.0 },
  ],
};

const LISTENING_BAND_SCORES = [
  { min: 39, max: 40, band: 9.0 },
  { min: 37, max: 38, band: 8.5 },
  { min: 35, max: 36, band: 8.0 },
  { min: 32, max: 34, band: 7.5 },
  { min: 30, max: 31, band: 7.0 },
  { min: 26, max: 29, band: 6.5 },
  { min: 23, max: 25, band: 6.0 },
  { min: 18, max: 22, band: 5.5 },
  { min: 16, max: 17, band: 5.0 },
  { min: 13, max: 15, band: 4.5 },
  { min: 10, max: 12, band: 4.0 },
  { min: 6, max: 9, band: 3.5 },
  { min: 4, max: 5, band: 3.0 },
  { min: 3, max: 3, band: 2.5 },
  { min: 0, max: 2, band: 1.0 },
];

// Helper function to normalize answers for comparison
const normalizeAnswer = (answer: any): string => {
  if (answer === null || answer === undefined) return "";
  return String(answer).toLowerCase().trim();
};

// Check if two answers match (handles multiple acceptable answers)
const answersMatch = (userAnswer: any, correctAnswer: any): boolean => {
  // Handle null/undefined cases
  if (userAnswer === null || userAnswer === undefined || userAnswer === "") {
    return false;
  }
  
  if (correctAnswer === null || correctAnswer === undefined || correctAnswer === "") {
    return false;
  }

  const userNormalized = normalizeAnswer(userAnswer);
  const correctNormalized = normalizeAnswer(correctAnswer);

  // Handle array of correct answers (multiple acceptable answers)
  if (Array.isArray(correctAnswer)) {
    const result = correctAnswer.some((correct) => answersMatch(userAnswer, correct));
    return result;
  }

  // Handle comma-separated answers
  if (typeof correctAnswer === "string" && correctAnswer.includes(",")) {
    const acceptableAnswers = correctAnswer
      .split(",")
      .map((ans) => ans.trim().toLowerCase());
    const result = acceptableAnswers.includes(userNormalized);
    return result;
  }

  // Exact match (most strict)
  if (userNormalized === correctNormalized) {
    return true;
  }

  // For very short answers (1-2 chars), only allow exact match
  if (correctNormalized.length <= 2) {
    return false;
  }

  // For longer answers, allow some flexibility only if it's a perfect word match
  // This prevents "child" matching "childs" by requiring word boundaries
  const userWords = userNormalized.split(/\s+/);
  const correctWords = correctNormalized.split(/\s+/);

  // Only match if user answer contains all correct words as complete words
  if (correctWords.length === 1) {
    const result = userWords.includes(correctNormalized);
    return result;
  }

  return false;
};

// Convert raw score to IELTS band score
const getBandScore = (
  correct: number,
  total: number,
  section: "reading" | "listening",
): number => {
  const bandTable =
    section === "reading"
      ? READING_BAND_SCORES.academic
      : LISTENING_BAND_SCORES;

  for (const range of bandTable) {
    if (correct >= range.min && correct <= range.max) {
      return range.band;
    }
  }

  return 1.0; // Minimum band score
};

// Calculate overall band score from individual sections
const calculateOverallBandScore = (
  readingBand: number,
  listeningBand: number,
  writingBand: number,
): number => {
  const validBands = [readingBand, listeningBand, writingBand].filter(
    (band) => band > 0,
  );

  if (validBands.length === 0) return 1.0;

  const average =
    validBands.reduce((sum, band) => sum + band, 0) / validBands.length;

  // Round to nearest 0.5
  return Math.round(average * 2) / 2;
};

// Helper function to map dynamic question IDs to database question IDs
const mapDynamicIdToDatabaseId = (dynamicId: string, questions: any[]): string | null => {
  // Extract the question type and timestamp from the dynamic ID
  const parts = dynamicId.split('_');
  if (parts.length < 2) return null;
  
  const questionType = parts[0]; // mcq, q, matching, map, etc.
  const timestamp = parts[1];
  
  console.log(`🔍 Mapping dynamic ID: ${dynamicId} (type: ${questionType}, timestamp: ${timestamp})`);
  
  // Find the question that matches this dynamic ID
  // We'll use the question type and try to match by content similarity
  const matchingQuestion = questions.find(question => {
    // For MCQ questions, check if the question type matches
    if (questionType === 'mcq' && question.question_type === 'multiple_choice') {
      return true;
    }
    // For short answer questions, check if the question type matches
    if (questionType === 'q' && question.question_type === 'short_answer') {
      return true;
    }
    // For matching questions, check if the question type matches
    if (questionType === 'matching' && question.question_type === 'matching') {
      return true;
    }
    // For map questions, check if the question type matches
    if (questionType === 'map' && question.question_type === 'map_labeling') {
      return true;
    }
    return false;
  });
  
  if (matchingQuestion) {
    console.log(`🔍 Found matching question: ${matchingQuestion.id} (${matchingQuestion.question_type})`);
    return matchingQuestion.id;
  }
  
  console.log(`🔍 No matching question found for dynamic ID: ${dynamicId}`);
  return null;
};

// Helper function to find student answer for a question, handling both database IDs and dynamic IDs
const findStudentAnswer = (question: any, userAnswers: any): any => {
  const questionId = question.id;
  
  // First, try to find answer using the database question ID
  if (userAnswers[questionId]) {
    return userAnswers[questionId];
  }
  
  // If not found, try to find answer using dynamic ID patterns
  const answerKeys = Object.keys(userAnswers);
  
  // For MCQ questions, look for mcq_* keys
  if (question.question_type === 'multiple_choice') {
    const mcqKey = answerKeys.find(key => key.startsWith('mcq_'));
    if (mcqKey) {
      return userAnswers[mcqKey];
    }
  }
  
  // For short answer questions, look for q_* keys
  if (question.question_type === 'short_answer') {
    const shortAnswerKey = answerKeys.find(key => key.startsWith('q_'));
    if (shortAnswerKey) {
      return userAnswers[shortAnswerKey];
    }
  }
  
  // For matching questions, we'll handle them separately in the main processing
  if (question.question_type === 'matching') {
    return null;
  }
  
  // For map questions, collect all map_* keys
  if (question.question_type === 'map_labeling') {
    const mapKeys = answerKeys.filter(key => key.startsWith('map_'));
    if (mapKeys.length > 0) {
      const mapAnswers = mapKeys.map(key => ({
        key: key,
        answer: userAnswers[key]
      }));
      return mapAnswers;
    }
  }
  
  return null;
};



// Main grading function
export const autoGradeSubmission = async (
  submissionId: string,
): Promise<GradingResult> => {
  try {
    // Get submission with answers
    const { data: submission, error: submissionError } = await supabase
      .from("test_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (submissionError) throw submissionError;

    const userAnswers = submission.answers || {};
    
    // Get test questions for all sections
    const [readingData, listeningData, writingData] = await Promise.all([
      // Reading questions
      supabase
        .from("reading_sections")
        .select(
          `
          id,
          reading_questions (*)
        `,
        )
        .eq("test_id", submission.test_id),

      // Listening questions
      supabase
        .from("listening_sections")
        .select(
          `
          id,
          listening_questions (*)
        `,
        )
        .eq("test_id", submission.test_id),

      // Writing questions
      supabase
        .from("writing_sections")
        .select(
          `
          id,
          writing_questions (*)
        `,
        )
        .eq("test_id", submission.test_id),
    ]);

    // Process reading questions
    const readingQuestions =
      readingData.data?.flatMap(
        (section: any) => section.reading_questions || [],
      ) || [];

    const readingResults = readingQuestions.map((question: any) => {
      // Use the same helper function for reading questions
      const userAnswer = findStudentAnswer(question, userAnswers);
      let correctAnswer = question.correct_answer;
      
      // Special handling for MCQ questions
      if (question.question_type === "multiple_choice") {
        console.log("🔍 Processing Reading MCQ Question:", {
          questionId: question.id,
          correctAnswer: correctAnswer,
          correctAnswerType: typeof correctAnswer,
          options: question.options,
          userAnswer: userAnswer
        });
        
        // For MCQ questions, the correct_answer is stored as an index
        // but the student answer is stored as the actual option text
        // We need to convert the index to the actual option text for comparison
        try {
          let options = question.options;
          if (typeof options === "string") {
            options = JSON.parse(options);
          }
          
          if (Array.isArray(options) && options.length > 0) {
            const correctIndex = parseInt(correctAnswer);
            if (!isNaN(correctIndex) && correctIndex >= 0 && correctIndex < options.length) {
              correctAnswer = options[correctIndex];
              console.log("🔍 Converted Reading MCQ index to option text:", {
                originalIndex: correctAnswer,
                convertedAnswer: correctAnswer,
                options: options
              });
            } else {
              console.warn("🔍 Invalid Reading MCQ correct answer index:", {
                correctAnswer,
                optionsLength: options.length
              });
            }
          } else {
            console.warn("🔍 Reading MCQ question has no valid options:", {
              questionId: question.id,
              options: question.options
            });
          }
        } catch (error) {
          console.error("🔍 Error processing Reading MCQ options:", error);
        }
      }
      
      const isCorrect = answersMatch(userAnswer, correctAnswer);
      
      console.log("🔍 Reading Question grading result:", {
        questionId: question.id,
        questionType: question.question_type,
        userAnswer,
        correctAnswer,
        isCorrect
      });
      
      return {
        questionId: question.id,
        questionText: question.question_text,
        questionType: question.question_type,
        userAnswer,
        correctAnswer: correctAnswer,
        isCorrect,
        points: isCorrect ? question.points || 1 : 0,
        section: "reading" as const,
        explanation: question.explanation,
      };
    });

    // Process listening questions
    const listeningQuestions =
      listeningData.data?.flatMap(
        (section: any) => section.listening_questions || [],
      ) || [];

    const listeningResults: QuestionResult[] = [];
    let questionCounter = 1; // Track sequential question numbers
    
    listeningQuestions.forEach((question: any) => {
      // Use the new helper function to find student answer
      const userAnswer = findStudentAnswer(question, userAnswers);
      
      // Handle different question types
      if (question.question_type === "map_labeling" || question.question_type === "map_diagram") {
        // Map/diagram questions: userAnswer is now an array from findStudentAnswer
        
        try {
          let mapData;
          try {
            if (typeof question.correct_answer === "string") {
              mapData = JSON.parse(question.correct_answer);
            } else {
              mapData = question.correct_answer;
            }
          } catch (parseError) {
            console.error("Error parsing map correct_answer:", parseError);
            mapData = [];
          }
          
          const boxes = Array.isArray(mapData) ? mapData : (mapData?.boxes || []);
          
          // If userAnswer is an array from findStudentAnswer, use it
          if (Array.isArray(userAnswer)) {
            userAnswer.forEach((answerObj: any, index: number) => {
              const box = boxes[index] || {};
              const correctAnswer = box.answer || box.label || "No answer set";
              const isCorrect = answersMatch(answerObj.answer, correctAnswer);
              
              listeningResults.push({
                questionId: answerObj.key,
                questionText: `Question ${questionCounter}: ${question.question_text} - Label ${index + 1}`,
                questionType: "map_labeling",
                userAnswer: answerObj.answer || "No answer provided",
                correctAnswer: correctAnswer,
                isCorrect,
                points: isCorrect ? question.points || 1 : 0,
                section: "listening" as const,
                explanation: question.explanation,
              });
              questionCounter++;
            });
          } else {
            // Fallback: treat as single question
            const isCorrect = answersMatch(userAnswer, question.correct_answer);
            
            listeningResults.push({
              questionId: question.id,
              questionText: `Question ${questionCounter}: ${question.question_text || 'Unknown'}`,
              questionType: question.question_type || 'unknown',
              userAnswer: userAnswer !== undefined && userAnswer !== null ? userAnswer : "No answer provided",
              correctAnswer: question.correct_answer || "No correct answer set",
              isCorrect,
              points: isCorrect ? question.points || 1 : 0,
              section: "listening" as const,
              explanation: question.explanation,
            });
            questionCounter++;
          }
        } catch (error) {
          console.error("🔍 Error parsing map data:", error);
          // Fallback: treat as single question
          const isCorrect = answersMatch(userAnswer, question.correct_answer);
          
          listeningResults.push({
            questionId: question.id,
            questionText: `Question ${questionCounter}: ${question.question_text || 'Unknown'}`,
            questionType: question.question_type || 'unknown',
            userAnswer: userAnswer !== undefined && userAnswer !== null ? userAnswer : "No answer provided",
            correctAnswer: question.correct_answer || "No correct answer set",
            isCorrect,
            points: isCorrect ? question.points || 1 : 0,
            section: "listening" as const,
            explanation: question.explanation,
          });
          questionCounter++;
        }
      } else if (question.question_type === "matching") {
        // Matching questions: userAnswer is now an array from findStudentAnswer
        try {
          
          let matchingData;
          try {
            if (typeof question.correct_answer === "string") {
              matchingData = JSON.parse(question.correct_answer);
            } else {
              matchingData = question.correct_answer;
            }
          } catch (parseError) {
            console.error("Error parsing matching correct_answer:", parseError);
            matchingData = [];
          }
          
          // Handle the format where pairs are stored directly as an array
          const pairs = Array.isArray(matchingData) ? matchingData : [];
          
          // Process each pair and find the corresponding student answer
          pairs.forEach((pair: any, pairIndex: number) => {
            // Try to find the student answer for this pair
            const answerKeys = Object.keys(userAnswers).filter(key => key.startsWith('matching_'));
            const studentAnswer = answerKeys[pairIndex] ? userAnswers[answerKeys[pairIndex]] : null;
            const correctAnswer = pair.right || "No answer set";
            const isCorrect = answersMatch(studentAnswer, correctAnswer);
            
            listeningResults.push({
              questionId: answerKeys[pairIndex] || `matching_${pairIndex}`,
              questionText: `Question ${questionCounter}: ${pair.left || `Matching ${pairIndex + 1}`}`,
              questionType: "matching",
              userAnswer: studentAnswer || "No answer provided",
              correctAnswer: correctAnswer,
              isCorrect,
              points: isCorrect ? question.points || 1 : 0,
              section: "listening" as const,
              explanation: question.explanation,
            });
            questionCounter++;
          });
        } catch (error) {
          console.error("🔍 Error parsing matching data:", error);
          // Fallback: treat as single question
          const isCorrect = answersMatch(userAnswer, question.correct_answer);
          
          listeningResults.push({
            questionId: question.id,
            questionText: `Question ${questionCounter}: ${question.question_text || 'Unknown'}`,
            questionType: question.question_type || 'unknown',
            userAnswer: userAnswer !== undefined && userAnswer !== null ? userAnswer : "No answer provided",
            correctAnswer: question.correct_answer || "No correct answer set",
            isCorrect,
            points: isCorrect ? question.points || 1 : 0,
            section: "listening" as const,
            explanation: question.explanation,
          });
          questionCounter++;
        }
      } else {
        // Regular questions (short_answer, multiple_choice, etc.)
        // userAnswer is already set by findStudentAnswer function above
        let correctAnswer = question.correct_answer;
        
        // Special handling for MCQ questions
        if (question.question_type === "multiple_choice") {
          
          // For MCQ questions, the correct_answer is stored as an index
          // but the student answer is stored as the actual option text
          // We need to convert the index to the actual option text for comparison
          try {
            let options = question.options;
            if (typeof options === "string") {
              options = JSON.parse(options);
            }
            
            if (Array.isArray(options) && options.length > 0) {
              const correctIndex = parseInt(correctAnswer);
              if (!isNaN(correctIndex) && correctIndex >= 0 && correctIndex < options.length) {
                correctAnswer = options[correctIndex];
              }
            }
          } catch (error) {
            console.error("🔍 Error processing MCQ options:", error);
          }
        }
        
        // Try to parse JSON for short answer questions that might have multiple answers
        if (question.question_type === "short_answer" && typeof correctAnswer === "string") {
          try {
            const parsed = JSON.parse(correctAnswer);
            if (Array.isArray(parsed)) {
              correctAnswer = parsed.join(", ");
            }
          } catch (e) {
            // If parsing fails, use the original string
          }
        }
        
        const isCorrect = answersMatch(userAnswer, correctAnswer);
        
        listeningResults.push({
          questionId: question.id,
          questionText: `Question ${questionCounter}: ${question.question_text || 'Unknown'}`,
          questionType: question.question_type || 'unknown',
          userAnswer: userAnswer !== undefined && userAnswer !== null ? userAnswer : "No answer provided",
          correctAnswer: correctAnswer || "No correct answer set",
          isCorrect,
          points: isCorrect ? question.points || 1 : 0,
          section: "listening" as const,
          explanation: question.explanation,
        });
        questionCounter++;
      }
    });

    // Process writing questions (basic scoring - would need AI for full assessment)
    const writingQuestions =
      writingData.data?.flatMap(
        (section: any) => section.writing_questions || [],
      ) || [];

    const writingResults = writingQuestions.map((question: any) => {
      const userAnswer = userAnswers[question.id];
      const hasAnswer = userAnswer && String(userAnswer).trim().length > 0;

      // Basic writing scoring - assign partial credit for having an answer
      const points = hasAnswer ? Math.max(1, question.points || 1) * 0.6 : 0;

      return {
        questionId: question.id,
        questionText: question.question_text,
        questionType: question.question_type,
        userAnswer,
        correctAnswer: "Writing requires manual assessment",
        isCorrect: hasAnswer,
        points,
        section: "writing" as const,
        explanation: "Writing tasks require manual grading by instructor",
      };
    });

    // Calculate scores
    const readingCorrect = readingResults.filter((r) => r.isCorrect).length;
    const readingTotal = readingResults.length;
    const readingPercentage =
      readingTotal > 0 ? (readingCorrect / readingTotal) * 100 : 0;
    const readingBandScore =
      readingTotal > 0
        ? getBandScore(readingCorrect, readingTotal, "reading")
        : 0;

    const listeningCorrect = listeningResults.filter((r) => r.isCorrect).length;
    const listeningTotal = listeningResults.length;
    const listeningPercentage =
      listeningTotal > 0 ? (listeningCorrect / listeningTotal) * 100 : 0;
    const listeningBandScore =
      listeningTotal > 0
        ? getBandScore(listeningCorrect, listeningTotal, "listening")
        : 0;

    const writingScore = writingResults.reduce((sum, r) => sum + r.points, 0);
    const writingMaxScore = writingResults.reduce(
      (sum, r) =>
        sum +
        (r.questionId
          ? writingQuestions.find((q) => q.id === r.questionId)?.points || 1
          : 1),
      0,
    );
    const writingBandScore =
      writingMaxScore > 0
        ? Math.min(9, Math.max(1, (writingScore / writingMaxScore) * 9))
        : 0;

    const overallBandScore = calculateOverallBandScore(
      readingBandScore,
      listeningBandScore,
      writingBandScore,
    );

    return {
      readingScore: readingPercentage,
      listeningScore: listeningPercentage,
      writingScore:
        writingMaxScore > 0 ? (writingScore / writingMaxScore) * 100 : 0,
      totalScore: overallBandScore * 10, // Convert to 0-100 scale
      readingBandScore,
      listeningBandScore,
      writingBandScore,
      overallBandScore,
      breakdown: {
        reading: {
          correct: readingCorrect,
          total: readingTotal,
          percentage: readingPercentage,
        },
        listening: {
          correct: listeningCorrect,
          total: listeningTotal,
          percentage: listeningPercentage,
        },
        writing: {
          score: writingScore,
          criteria: {
            taskAchievement: writingBandScore,
            coherenceCohesion: writingBandScore,
            lexicalResource: writingBandScore,
            grammarAccuracy: writingBandScore,
          },
        },
      },
      detailedResults: [
        ...readingResults,
        ...listeningResults,
        ...writingResults,
      ],
    };
  } catch (error) {
    console.error("Grading error:", error);
    throw error;
  }
};

// Save auto-graded results to database
export const saveAutoGradedResults = async (
  submissionId: string,
  gradingResult: GradingResult,
  gradedBy: string,
): Promise<void> => {
  try {
    const { error } = await supabase
      .from("test_submissions")
      .update({
        reading_score: gradingResult.readingBandScore,
        listening_score: gradingResult.listeningBandScore,
        writing_score: gradingResult.writingBandScore,
        total_score: gradingResult.overallBandScore,
        status: "graded",
        graded_at: new Date().toISOString(),
        graded_by: gradedBy,
        auto_grading_data: JSON.stringify(gradingResult),
      })
      .eq("id", submissionId);

    if (error) throw error;
  } catch (error) {
    console.error("Error saving auto-graded results:", error);
    throw error;
  }
};

// Debug function to test grading system
export const debugGradingSystem = async (submissionId: string) => {
  try {
    // Get submission with answers
    const { data: submission, error: submissionError } = await supabase
      .from("test_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (submissionError) throw submissionError;

    const userAnswers = submission.answers || {};
    
    // Get test questions for all sections
    const [readingData, listeningData, writingData] = await Promise.all([
      supabase
        .from("reading_sections")
        .select("id, reading_questions (*)")
        .eq("test_id", submission.test_id),
      supabase
        .from("listening_sections")
        .select("id, listening_questions (*)")
        .eq("test_id", submission.test_id),
      supabase
        .from("writing_sections")
        .select("id, writing_questions (*)")
        .eq("test_id", submission.test_id),
    ]);

    // Debug MCQ questions specifically
    const allQuestions = [
      ...(readingData.data?.flatMap((section: any) => section.reading_questions || []) || []),
      ...(listeningData.data?.flatMap((section: any) => section.listening_questions || []) || []),
      ...(writingData.data?.flatMap((section: any) => section.writing_questions || []) || [])
    ];

    const mcqQuestions = allQuestions.filter(q => q.question_type === "multiple_choice");
    console.log("🔍 Found MCQ questions:", mcqQuestions.length);
    
    mcqQuestions.forEach((question, index) => {
      console.log(`🔍 MCQ Question ${index + 1}:`, {
        id: question.id,
        text: question.question_text,
        correctAnswer: question.correct_answer,
        correctAnswerType: typeof question.correct_answer,
        options: question.options,
        userAnswer: userAnswers[question.id],
        userAnswerType: typeof userAnswers[question.id]
      });
      
      // Test the conversion logic
      try {
        let options = question.options;
        if (typeof options === "string") {
          options = JSON.parse(options);
        }
        
        if (Array.isArray(options) && options.length > 0) {
          const correctIndex = parseInt(question.correct_answer);
          if (!isNaN(correctIndex) && correctIndex >= 0 && correctIndex < options.length) {
            const convertedAnswer = options[correctIndex];
            const userAnswer = userAnswers[question.id];
            const isCorrect = answersMatch(userAnswer, convertedAnswer);
            
            console.log(`🔍 MCQ Question ${index + 1} grading:`, {
              originalIndex: question.correct_answer,
              convertedAnswer,
              userAnswer,
              isCorrect,
              options
            });
          }
        }
      } catch (error) {
        console.error(`🔍 Error processing MCQ question ${index + 1}:`, error);
      }
    });

    // Run the actual grading
    const result = await autoGradeSubmission(submissionId);
    console.log("🔍 Grading result:", result);
    
    return result;
  } catch (error) {
    console.error("🔍 Debug grading error:", error);
    throw error;
  }
};
