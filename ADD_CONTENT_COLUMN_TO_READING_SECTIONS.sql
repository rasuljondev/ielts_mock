-- Add content column to reading_sections table
-- This column will store the HTML content with embedded questions (like listening_sections)

ALTER TABLE reading_sections 
ADD COLUMN content TEXT;

-- Add comment to document the column purpose
COMMENT ON COLUMN reading_sections.content IS 'HTML content with embedded questions, similar to listening_sections.content';

-- Update existing rows to have empty content (optional)
UPDATE reading_sections 
SET content = '' 
WHERE content IS NULL;

-- Make the column NOT NULL after setting default values (optional)
-- ALTER TABLE reading_sections ALTER COLUMN content SET NOT NULL; 