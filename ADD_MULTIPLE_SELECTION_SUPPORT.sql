-- Add Multiple Selection (MS) support to reading_questions table
-- This script updates the database schema to support the new multiple_selection question type

-- Step 1: Update the question_type constraint to allow 'multiple_selection'
ALTER TABLE reading_questions DROP CONSTRAINT IF EXISTS reading_questions_question_type_check;

ALTER TABLE reading_questions ADD CONSTRAINT reading_questions_question_type_check 
CHECK (question_type = ANY (ARRAY[
    'multiple_choice'::text, 
    'short_answer'::text, 
    'matching'::text, 
    'map_diagram'::text, 
    'map_labeling'::text,
    'multiple_selection'::text
]));

-- Step 2: Verify the constraint was applied correctly
SELECT conname, consrc
FROM pg_constraint
WHERE conrelid = 'reading_questions'::regclass
AND conname = 'reading_questions_question_type_check';

-- Step 3: Add a comment to document the new question type
COMMENT ON COLUMN reading_questions.question_type IS 'Question types: multiple_choice, short_answer, matching, map_diagram, map_labeling, multiple_selection. Multiple selection allows students to select multiple correct answers, with each correct answer worth 1 point.';

-- Step 4: Verify the table structure supports the new question type
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'reading_questions' 
AND column_name IN ('question_type', 'options', 'correct_answer', 'points_possible')
ORDER BY ordinal_position;

-- Step 5: Show example of how multiple_selection questions are stored
-- Options: JSON array of strings (e.g., ["Dog", "Cat", "Fish", "Bird"])
-- Correct Answer: JSON array of indices (e.g., [0, 1] for first two options)
-- Points: Each correct answer selected = 1 point

-- Example multiple_selection question structure:
-- question_type: 'multiple_selection'
-- options: '["Dog", "Cat", "Fish", "Bird"]'
-- correct_answer: '[0, 1]'  (Dog and Cat are correct)
-- points_possible: 2 (two correct answers)

PRINT 'Multiple Selection support has been added to reading_questions table.';
PRINT 'Question type "multiple_selection" is now allowed.';
PRINT 'Options should be stored as JSON array of strings.';
PRINT 'Correct answers should be stored as JSON array of indices.';
PRINT 'Each correct answer selected by student = 1 point.'; 