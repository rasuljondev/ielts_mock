-- SQL Script to Update Short Answer Questions with Correct Answers
-- Run this in your Supabase SQL Editor

-- First, let's see what questions need updating
SELECT 
    id,
    question_text,
    correct_answer,
    section_id,
    question_number
FROM listening_questions 
WHERE question_type = 'short_answer' 
AND (correct_answer = '""' OR correct_answer = '' OR correct_answer IS NULL);

-- Example: Update a specific question with a correct answer
-- Replace 'question_id_here' with the actual question ID
-- Replace 'correct_answer_here' with the actual correct answer
UPDATE listening_questions 
SET correct_answer = 'correct_answer_here'
WHERE id = 'question_id_here';

-- Example: Update multiple questions at once
-- You'll need to run this for each question that needs updating
UPDATE listening_questions 
SET correct_answer = 'hello'
WHERE id = 'be50afbe-3933-427e-9b1d-a117fd71943c';

UPDATE listening_questions 
SET correct_answer = 'world'
WHERE id = '6aa2a6ca-82cc-4f50-9b5a-27b0e82a36ec';

UPDATE listening_questions 
SET correct_answer = 'test'
WHERE id = 'f3c4eca7-dfad-4561-85be-f20efb7ded85';

-- After updating, verify the changes
SELECT 
    id,
    question_text,
    correct_answer,
    section_id,
    question_number
FROM listening_questions 
WHERE question_type = 'short_answer'; 