# IELTS Listening Test Parsing System

## Overview

This system allows admins to create listening tests with inline answers that are automatically converted to numbered input fields for students. The parsing system extracts answers from rich text content and creates an interactive test interface.

## How It Works

### 1. Admin Content Creation

Admins write test content in the rich text editor using brackets to indicate answers:

```
Questions 1–10 Complete the notes.
Write ONE WORD AND/OR A NUMBER for each answer.

Phone call about second-hand furniture

Items:
Dining table: - [round] shape, made of [oak], seats [six] people
Wardrobe: height [two metres], has [mirror] on door
Bookshelf: [wooden] material, [five] shelves, costs [£75]

Contact details:
Phone: [07891234567]
Best time to call: [evening]
```

### 2. Content Parsing

The system automatically:
- Extracts answers from brackets: `[round]`, `[oak]`, `[six]`, etc.
- Numbers them sequentially: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- Converts to student format with numbered placeholders

### 3. Student View

Students see the same content but with numbered input fields:

```
Questions 1–10 Complete the notes.
Write ONE WORD AND/OR A NUMBER for each answer.

Phone call about second-hand furniture

Items:
Dining table: - [    1    ] shape, made of [    2    ], seats [    3    ] people
Wardrobe: height [    4    ], has [    5    ] on door
Bookshelf: [    6    ] material, [    7    ] shelves, costs [    8    ]

Contact details:
Phone: [    9    ]
Best time to call: [    10    ]
```

## Technical Implementation

### Content Parser (`client/lib/contentParser.ts`)

The content parser handles:

1. **Text Parsing**: Finds `[answer]` patterns in text
2. **Question Numbering**: Automatically numbers questions sequentially
3. **Answer Extraction**: Stores correct answers for grading
4. **Student Conversion**: Replaces answers with input placeholders

### Enhanced Student Preview (`client/components/ui/enhanced-student-test-preview.tsx`)

Features:
- Interactive input fields for each question
- Real-time answer capture
- Audio playback controls
- Timer functionality
- Automatic submission

### Key Functions

#### `parseContentForStudent(adminContent)`

Converts admin content to student format:

```typescript
const result = parseContentForStudent(adminContent);
// Returns: { content, answers, totalQuestions }
```

#### `extractAnswersFromContent(content)`

Extracts all answers from admin content:

```typescript
const answers = extractAnswersFromContent(content);
// Returns array of ParsedAnswer objects
```

#### `validateAnswers(studentAnswers, correctAnswers)`

Compares student answers with correct answers:

```typescript
const results = validateAnswers(studentAnswers, correctAnswers);
// Returns: { totalQuestions, correctCount, results }
```

## Question Types Supported

### 1. Inline Text Answers

**Admin writes**: `The capital is [London] and population is [8 million]`
**Student sees**: `The capital is [    1    ] and population is [    2    ]`

### 2. Short Answer Components

**Admin creates**: Short answer field with correct answer "Business studies"
**Student sees**: Interactive input field

### 3. Multiple Choice Questions

**Admin creates**: MCQ with options and correct answer
**Student sees**: Radio button options

### 4. Sentence Completion

**Admin creates**: Sentence with multiple answer fields
**Student sees**: Multiple input fields

### 5. Matching Questions

**Admin creates**: Items to match with correct pairings
**Student sees**: Drag-and-drop or dropdown interface

### 6. Map/Diagram Labeling

**Admin creates**: Image with answer boxes
**Student sees**: Input fields for each label

## Usage Instructions

### For Test Creators (Admins)

1. **Create Content**: Write your test content in the rich text editor
2. **Add Answers**: Use brackets `[answer]` for fill-in-the-blank questions
3. **Use Components**: Add structured questions using the toolbar buttons
4. **Preview**: Click "🎓 Test as Student" to see the student experience
5. **Test Parsing**: Click "🔍 Test Parsing" to verify answer extraction
6. **Load Sample**: Click "📝 Load Sample" to see example content

### For Students

1. **Start Test**: Navigate to the test from the student dashboard
2. **Play Audio**: Use the audio controls to listen to the recording
3. **Answer Questions**: Type answers in the numbered input fields
4. **Submit**: Click "Submit Test" when complete

## Example Implementation

```typescript
// Admin creates content
const adminContent = {
  type: "paragraph",
  content: [
    { 
      type: "text", 
      text: "The meeting is at [2:30 PM] in room [A205]" 
    }
  ]
};

// System parses for student
const result = parseContentForStudent(adminContent);

// Student content shows:
// "The meeting is at [    1    ] in room [    2    ]"

// Extracted answers:
// [
//   { questionNumber: 1, answerValue: "2:30 PM" },
//   { questionNumber: 2, answerValue: "A205" }
// ]
```

## Best Practices

### For Content Creation

1. **Clear Instructions**: Always provide clear instructions about answer format
2. **Consistent Bracketing**: Use `[answer]` format consistently
3. **Logical Order**: Ensure answers appear in logical sequence
4. **Preview Always**: Use the student preview to verify the experience
5. **Test Audio**: Upload and test audio files before publishing

### For Answer Formatting

- Use clear, unambiguous answers
- Consider acceptable variations (e.g., "2:30 PM" vs "2:30pm")
- Keep answers concise
- Avoid complex punctuation in answers

## Troubleshooting

### Common Issues

1. **Answers Not Extracted**: Check bracket format `[answer]`
2. **Wrong Numbering**: Ensure answers are in logical order
3. **Audio Not Playing**: Verify audio file upload and format
4. **Preview Errors**: Check console for parsing errors

### Debug Tools

- **Console Logging**: Check browser console for parsing details
- **Test Parsing Button**: Use to verify answer extraction
- **Sample Content**: Load sample content to see working examples

## File Structure

```
client/
├── lib/
│   ├── contentParser.ts          # Core parsing logic
│   └── listeningTestExamples.ts  # Sample content
├── components/
│   ├── ui/
│   │   └── enhanced-student-test-preview.tsx  # Student interface
│   └── test-creation/
│       └── IELTSListeningEditor.tsx  # Admin editor
└── pages/
    └── student/
        └── IELTSListeningTest.tsx    # Student test taking page
```

## Future Enhancements

- Support for more complex answer patterns
- Automatic answer validation improvements
- Enhanced grading algorithms
- Real-time collaborative editing
- Advanced audio controls with timestamps
- Mobile-optimized interface

## Support

For issues or questions about the listening test system:
1. Check this documentation first
2. Use the debug tools (Test Parsing, Console logs)
3. Refer to the sample content for examples
4. Contact the development team for complex issues
