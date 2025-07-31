-- Enhance test_submissions table for full test progress tracking
-- This migration adds columns to track section completion and test type

-- Add columns to track section completion
ALTER TABLE test_submissions 
ADD COLUMN IF NOT EXISTS completed_sections TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS test_type TEXT DEFAULT 'single' CHECK (test_type IN ('single', 'full'));

-- Add index for better performance when querying by test and student
CREATE INDEX IF NOT EXISTS idx_test_submissions_test_student 
ON test_submissions(test_id, student_id);

-- Add index for completed sections queries
CREATE INDEX IF NOT EXISTS idx_test_submissions_completed_sections 
ON test_submissions USING GIN (completed_sections);

-- Update existing records to have proper test_type based on test data
-- This will be handled by the application logic when loading existing submissions

-- Add a function to check if all sections are completed
CREATE OR REPLACE FUNCTION is_test_completed(test_id_param UUID, student_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    submission_record RECORD;
    test_record RECORD;
    has_reading BOOLEAN := FALSE;
    has_listening BOOLEAN := FALSE;
    has_writing BOOLEAN := FALSE;
    completed_count INTEGER := 0;
    total_sections INTEGER := 0;
BEGIN
    -- Get the submission record
    SELECT * INTO submission_record 
    FROM test_submissions 
    WHERE test_id = test_id_param AND student_id = student_id_param;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get the test record to determine available sections
    SELECT * INTO test_record 
    FROM tests 
    WHERE id = test_id_param;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check which sections exist for this test
    SELECT COUNT(*) > 0 INTO has_reading 
    FROM reading_sections WHERE test_id = test_id_param;
    
    SELECT COUNT(*) > 0 INTO has_listening 
    FROM listening_sections WHERE test_id = test_id_param;
    
    SELECT COUNT(*) > 0 INTO has_writing 
    FROM writing_tasks WHERE test_id = test_id_param;
    
    -- Count total sections
    total_sections := (has_reading::int + has_listening::int + has_writing::int);
    
    -- Count completed sections
    SELECT COUNT(*) INTO completed_count
    FROM unnest(submission_record.completed_sections) AS section
    WHERE section IN ('reading', 'listening', 'writing');
    
    -- Test is completed if all available sections are completed
    RETURN completed_count = total_sections AND total_sections > 0;
END;
$$ LANGUAGE plpgsql; 