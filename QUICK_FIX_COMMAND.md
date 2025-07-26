# Quick Fix for "No content available" Issue

## Problem
Test ID `872a9295-3e0e-489c-bfca-3cb5431c794d` shows "No content available" because it has no listening sections in the database.

## Solution 1: Use the Browser Console (Fastest)

1. Open the listening test page where you see "No content available"
2. Press F12 to open Developer Tools
3. Go to the "Console" tab
4. Copy and paste this command:

```javascript
(async () => {
  const testId = "872a9295-3e0e-489c-bfca-3cb5431c794d";
  const { supabase } = await import('./client/lib/supabase.js');
  
  const { data: newSection } = await supabase.from("listening_sections").insert({
    test_id: testId,
    title: "IELTS Listening Test - Section 1",
    content: '<h2>IELTS Listening Test - Section 1</h2><p><strong>Questions 1–4</strong><br/>Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.</p><div style="margin: 20px 0; padding: 20px; background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px;"><h3>Phone call about second-hand furniture</h3><p><strong>Items for sale:</strong></p><p>• Dining table: [1] shape, made of oak wood</p><p>• Chairs: [2] available (matching set)</p><p>• Total price: $[3] for the complete set</p><p>• Contact time: Available after [4] PM</p></div><div style="margin: 20px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff;"><p style="font-weight: 600; margin-bottom: 12px;">5. What is the main reason for selling the furniture?</p><div style="margin-left: 20px;"><div style="margin-bottom: 8px;"><label style="display: flex; align-items: center; cursor: pointer;"><input type="radio" name="mcq_5" style="margin-right: 8px;" /><span>A) Moving to a new house</span></label></div><div style="margin-bottom: 8px;"><label style="display: flex; align-items: center; cursor: pointer;"><input type="radio" name="mcq_5" style="margin-right: 8px;" /><span>B) Need money urgently</span></label></div><div style="margin-bottom: 8px;"><label style="display: flex; align-items: center; cursor: pointer;"><input type="radio" name="mcq_5" style="margin-right: 8px;" /><span>C) Furniture is too old</span></label></div></div></div>',
    instructions: "Listen to the audio recording and answer all questions. For short answers, write ONE WORD AND/OR A NUMBER. For multiple choice, select the correct option.",
    section_number: 1,
    duration_minutes: 30,
    section_type: "listening"
  }).select().single();
  
  await supabase.from("listening_questions").insert([
    { section_id: newSection.id, question_text: "Dining table shape", question_type: "short_answer", question_number: 1, correct_answer: "round", points: 1, question_order: 1 },
    { section_id: newSection.id, question_text: "Number of chairs available", question_type: "short_answer", question_number: 2, correct_answer: "6", points: 1, question_order: 2 },
    { section_id: newSection.id, question_text: "Total price for the set", question_type: "short_answer", question_number: 3, correct_answer: "250", points: 1, question_order: 3 },
    { section_id: newSection.id, question_text: "Available contact time", question_type: "short_answer", question_number: 4, correct_answer: "5", points: 1, question_order: 4 },
    { section_id: newSection.id, question_text: "What is the main reason for selling the furniture?", question_type: "multiple_choice", question_number: 5, options: '["Moving to a new house", "Need money urgently", "Furniture is too old"]', correct_answer: "Need money urgently", points: 1, question_order: 5 }
  ]);
  
  alert("✅ Test data created! Refresh the page to see the content.");
})();
```

4. Press Enter to run the command
5. You should see "✅ Test data created! Refresh the page to see the content."
6. Refresh the page

## Solution 2: Use the Built-in Button (Easier)

1. Go to the listening test page where you see "No content available"
2. Click the "Create Demo Data" button that now appears
3. Confirm when prompted
4. The page will automatically refresh with the new content

## What This Does

This creates:
- 1 listening section with sample content
- 5 questions (4 short answer + 1 multiple choice)
- Proper database relationships
- Sample content that demonstrates all question types

## Expected Result

After running the fix, you should see:
- A listening test with questions 1-5
- Fill-in-the-blank inputs for questions 1-4
- Multiple choice options for question 5
- Content about furniture for sale

The test will now work properly and you can submit answers.
