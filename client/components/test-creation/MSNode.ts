import { Node, mergeAttributes } from '@tiptap/core';

export const MSNode = Node.create({
  name: 'ms',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      question_number: { default: null },
      options: { default: [] },
      correct_answers: { default: [] }, // Array of correct answer indices
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-ms]',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-ms': 'true', style: 'border:1px solid #ccc; padding:8px; margin:8px 0; background:#fffbe6;' }),
      0,
    ];
  },
  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('div');
      container.setAttribute('data-ms', 'true');
      container.style.border = '1px solid #ccc';
      container.style.padding = '8px';
      container.style.margin = '8px 0';
      container.style.background = '#fffbe6';
      
      const qText = document.createElement('div');
      qText.innerHTML = `<b>${node.attrs.question_number}. Select all that apply:</b>`;
      container.appendChild(qText);
      
      const options = node.attrs.options || [];
      options.forEach((opt: string, i: number) => {
        const optDiv = document.createElement('div');
        optDiv.innerHTML = `${String.fromCharCode(65 + i)}) ${opt}`;
        container.appendChild(optDiv);
      });
      
      return {
        dom: container,
      };
    };
  },
}); 