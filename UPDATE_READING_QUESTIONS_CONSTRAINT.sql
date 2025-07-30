-- Update the reading_questions table constraint to allow the question types actually used in the application
-- This will replace the existing constraint with one that allows: multiple_choice, short_answer, matching, map_diagram, map_labeling, multiple_selection

-- First, drop the existing constraint
ALTER TABLE reading_questions DROP CONSTRAINT IF EXISTS reading_questions_question_type_check;

-- Add the new constraint with the updated allowed values
ALTER TABLE reading_questions ADD CONSTRAINT reading_questions_question_type_check 
CHECK (question_type = ANY (ARRAY[
    'multiple_choice'::text, 
    'short_answer'::text, 
    'matching'::text, 
    'map_diagram'::text, 
    'map_labeling'::text,
    'multiple_selection'::text
]));

-- Verify the constraint was applied correctly
SELECT conname, consrc
FROM pg_constraint
WHERE conrelid = 'reading_questions'::regclass
AND conname = 'reading_questions_question_type_check'; 