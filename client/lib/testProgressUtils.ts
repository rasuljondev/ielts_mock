import { supabase } from './supabase';

export interface TestProgress {
  testId: string;
  studentId: string;
  completedSections: string[];
  testType: 'single' | 'full';
  isCompleted: boolean;
}

export interface SectionStatus {
  type: 'reading' | 'listening' | 'writing';
  status: 'not_started' | 'in_progress' | 'completed';
  completedAt?: string;
}

/**
 * Mark a section as completed for a test
 */
export const markSectionCompleted = async (
  testId: string,
  studentId: string,
  sectionType: 'reading' | 'listening' | 'writing'
): Promise<boolean> => {
  try {
    // Get current submission
    const { data: existingSubmission, error: fetchError } = await supabase
      .from('test_submissions')
      .select('*')
      .eq('test_id', testId)
      .eq('student_id', studentId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching submission:', fetchError);
      return false;
    }

    if (existingSubmission) {
      // Update existing submission with completed section
      const updatedCompletedSections = [...(existingSubmission.completed_sections || []), sectionType];
      
      const { error: updateError } = await supabase
        .from('test_submissions')
        .update({
          completed_sections: updatedCompletedSections,
          test_type: 'full', // Mark as full test since we're tracking sections
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubmission.id);

      if (updateError) {
        console.error('Error updating submission:', updateError);
        return false;
      }
    } else {
      // Create new submission
      const { error: insertError } = await supabase
        .from('test_submissions')
        .insert({
          test_id: testId,
          student_id: studentId,
          completed_sections: [sectionType],
          test_type: 'full',
          status: 'in_progress'
        });

      if (insertError) {
        console.error('Error creating submission:', insertError);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error marking section completed:', error);
    return false;
  }
};

/**
 * Get test progress for a student
 */
export const getTestProgress = async (
  testId: string,
  studentId: string
): Promise<TestProgress | null> => {
  try {
    // Get submission data
    const { data: submission, error: submissionError } = await supabase
      .from('test_submissions')
      .select('*')
      .eq('test_id', testId)
      .eq('student_id', studentId)
      .single();

    if (submissionError && submissionError.code !== 'PGRST116') {
      console.error('Error fetching submission:', submissionError);
      return null;
    }

    if (!submission) {
      return {
        testId,
        studentId,
        completedSections: [],
        testType: 'single',
        isCompleted: false
      };
    }

    // Check if test is completed using database function
    const { data: isCompletedResult, error: completionError } = await supabase
      .rpc('is_test_completed', {
        test_id_param: testId,
        student_id_param: studentId
      });

    if (completionError) {
      console.error('Error checking completion:', completionError);
      // Fallback: check if all sections are completed
      const completedSections = submission.completed_sections || [];
      const isCompleted = completedSections.length >= 3; // Assuming 3 sections max
      return {
        testId,
        studentId,
        completedSections,
        testType: submission.test_type || 'single',
        isCompleted
      };
    }

    return {
      testId,
      studentId,
      completedSections: submission.completed_sections || [],
      testType: submission.test_type || 'single',
      isCompleted: isCompletedResult || false
    };
  } catch (error) {
    console.error('Error getting test progress:', error);
    return null;
  }
};

/**
 * Get section status for all sections of a test
 */
export const getSectionStatuses = async (
  testId: string,
  studentId: string
): Promise<SectionStatus[]> => {
  try {
    const progress = await getTestProgress(testId, studentId);
    if (!progress) return [];

    // Check which sections exist for this test
    const [readingSections, listeningSections, writingSections] = await Promise.all([
      supabase.from('reading_sections').select('id').eq('test_id', testId),
      supabase.from('listening_sections').select('id').eq('test_id', testId),
      supabase.from('writing_tasks').select('id').eq('test_id', testId)
    ]);

    const sections: SectionStatus[] = [];

    if (readingSections.data && readingSections.data.length > 0) {
      sections.push({
        type: 'reading',
        status: progress.completedSections.includes('reading') ? 'completed' : 'not_started'
      });
    }

    if (listeningSections.data && listeningSections.data.length > 0) {
      sections.push({
        type: 'listening',
        status: progress.completedSections.includes('listening') ? 'completed' : 'not_started'
      });
    }

    if (writingSections.data && writingSections.data.length > 0) {
      sections.push({
        type: 'writing',
        status: progress.completedSections.includes('writing') ? 'completed' : 'not_started'
      });
    }

    return sections;
  } catch (error) {
    console.error('Error getting section statuses:', error);
    return [];
  }
};

/**
 * Check if all sections are completed for a test
 */
export const isAllSectionsCompleted = async (
  testId: string,
  studentId: string
): Promise<boolean> => {
  const progress = await getTestProgress(testId, studentId);
  return progress?.isCompleted || false;
};

/**
 * Check if a specific section is completed
 */
export const isSectionCompleted = async (
  testId: string,
  studentId: string,
  sectionType: 'reading' | 'listening' | 'writing'
): Promise<boolean> => {
  const progress = await getTestProgress(testId, studentId);
  return progress?.completedSections.includes(sectionType) || false;
};

/**
 * Trigger auto-grading for a submission to generate submission_data
 */
export const triggerAutoGrading = async (submissionId: string): Promise<boolean> => {
  try {
    // Import auto-grading functions
    const { autoGradeSubmission, saveAutoGradedResults } = await import('./autoGrading');
    
    // Run auto-grading
    const gradingResult = await autoGradeSubmission(submissionId);
    
    // Save the results (this will create submission_data)
    await saveAutoGradedResults(submissionId, gradingResult, 'system');
    
    return true;
  } catch (error) {
    console.error('Error triggering auto-grading:', error);
    return false;
  }
}; 