// Example listening test content demonstrating the parsing system

export const sampleListeningContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [
        { type: "text", text: "Questions 1–10" }
      ]
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [
        { type: "text", text: "Complete the notes." }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Write ONE WORD AND/OR A NUMBER for each answer." 
        }
      ]
    },
    {
      type: "heading",
      attrs: { level: 3 },
      content: [
        { type: "text", text: "Phone call about second-hand furniture" }
      ]
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Items:" }
      ]
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Dining table: - [round] shape"
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Material: [oak]"
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Seats: [six] people"
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Wardrobe: height [two metres], has [mirror] on door" 
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Bookshelf: [wooden] material, [five] shelves, costs [£75]" 
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Contact details:" }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Phone: [07891234567]" 
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Best time to call: [evening]" 
        }
      ]
    }
  ]
};

export const expectedStudentView = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [
        { type: "text", text: "Questions 1–10" }
      ]
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [
        { type: "text", text: "Complete the notes." }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Write ONE WORD AND/OR A NUMBER for each answer." 
        }
      ]
    },
    {
      type: "heading",
      attrs: { level: 3 },
      content: [
        { type: "text", text: "Phone call about second-hand furniture" }
      ]
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Items:" }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Dining table: - [    1    ] shape, made of [    2    ], seats [    3    ] people" 
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Wardrobe: height [    4    ], has [    5    ] on door" 
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Bookshelf: [    6    ] material, [    7    ] shelves, costs [    8    ]" 
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Contact details:" }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Phone: [    9    ]" 
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Best time to call: [    10    ]" 
        }
      ]
    }
  ]
};

export const extractedAnswers = [
  { questionNumber: 1, answerValue: "round" },
  { questionNumber: 2, answerValue: "oak" },
  { questionNumber: 3, answerValue: "six" },
  { questionNumber: 4, answerValue: "two metres" },
  { questionNumber: 5, answerValue: "mirror" },
  { questionNumber: 6, answerValue: "wooden" },
  { questionNumber: 7, answerValue: "five" },
  { questionNumber: 8, answerValue: "£75" },
  { questionNumber: 9, answerValue: "07891234567" },
  { questionNumber: 10, answerValue: "evening" }
];

export const sampleMixedContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [
        { type: "text", text: "IELTS Listening Test - Section 1" }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Complete the form below. Write NO MORE THAN THREE WORDS AND/OR A NUMBER for each answer." 
        }
      ]
    },
    {
      type: "heading",
      attrs: { level: 3 },
      content: [
        { type: "text", text: "Customer Booking Form" }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Name: Sarah [Thompson]" 
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Address: [42 King Street], London" 
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Postcode: [SW1 4RG]" 
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Telephone: [020 7946 0958]" 
        }
      ]
    },
    // Add a short answer component
    {
      type: "short_answer",
      attrs: {
        answers: ["Business studies"],
        admin: true,
        number: 5
      }
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: " (course name)" 
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Duration: [6 months]" 
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { 
          type: "text", 
          text: "Start date: [15th September]" 
        }
      ]
    },
    // Add an MCQ
    {
      type: "mcq",
      attrs: {
        text: "What type of accommodation does Sarah prefer?",
        options: ["Shared flat", "Private studio", "Host family", "University hall"],
        correctIndex: 1,
        admin: true,
        number: 8
      }
    }
  ]
};

// Function to demonstrate the parsing
export function demonstrateParsing() {
  console.log("=== LISTENING TEST PARSING DEMONSTRATION ===");
  console.log("\n1. ADMIN CONTENT (what teacher creates):");
  console.log("Text: 'Dining table: - [round] shape, made of [oak]'");
  
  console.log("\n2. STUDENT VIEW (after parsing):");
  console.log("Text: 'Dining table: - [    1    ] shape, made of [    2    ]'");
  
  console.log("\n3. EXTRACTED ANSWERS:");
  console.log("Question 1: 'round'");
  console.log("Question 2: 'oak'");
  
  console.log("\n4. STUDENT INTERACTION:");
  console.log("- Student sees numbered input fields [    1    ], [    2    ], etc.");
  console.log("- Student types answers in the input fields");
  console.log("- System compares student answers with extracted correct answers");
  
  console.log("\n5. GRADING:");
  console.log("- Student answer 'round' compared with correct answer 'round' ✓");
  console.log("- Student answer 'oak' compared with correct answer 'oak' ✓");
}
