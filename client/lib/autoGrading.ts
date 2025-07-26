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
  const userNormalized = normalizeAnswer(userAnswer);
  const correctNormalized = normalizeAnswer(correctAnswer);

  // Handle array of correct answers (multiple acceptable answers)
  if (Array.isArray(correctAnswer)) {
    return correctAnswer.some((correct) => answersMatch(userAnswer, correct));
  }

  // Handle comma-separated answers
  if (typeof correctAnswer === "string" && correctAnswer.includes(",")) {
    const acceptableAnswers = correctAnswer
      .split(",")
      .map((ans) => ans.trim().toLowerCase());
    return acceptableAnswers.includes(userNormalized);
  }

  // Exact match (most strict)
  if (userNormalized === correctNormalized) return true;

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
    return userWords.includes(correctNormalized);
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
      const userAnswer = userAnswers[question.id];
      const isCorrect = answersMatch(userAnswer, question.correct_answer);

      return {
        questionId: question.id,
        questionText: question.question_text,
        questionType: question.question_type,
        userAnswer,
        correctAnswer: question.correct_answer,
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

    const listeningResults = listeningQuestions.map((question: any) => {
      const userAnswer = userAnswers[question.id];
      const isCorrect = answersMatch(userAnswer, question.correct_answer);

      return {
        questionId: question.id,
        questionText: question.question_text,
        questionType: question.question_type,
        userAnswer,
        correctAnswer: question.correct_answer,
        isCorrect,
        points: isCorrect ? question.points || 1 : 0,
        section: "listening" as const,
        explanation: question.explanation,
      };
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
