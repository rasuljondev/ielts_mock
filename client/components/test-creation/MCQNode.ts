import { Node, mergeAttributes } from '@tiptap/core';

export const MCQNode = Node.create({
  name: 'mcq',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      question_number: { default: null },
      question_text: { default: '' },
      options: { default: [] },
      correct_index: { default: 0 },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-mcq]',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-mcq': 'true', style: 'border:1px solid #ccc; padding:8px; margin:8px 0; background:#fffbe6;' }),
      0,
    ];
  },
  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('div');
      container.setAttribute('data-mcq', 'true');
      container.style.border = '1px solid #ccc';
      container.style.padding = '8px';
      container.style.margin = '8px 0';
      container.style.background = '#fffbe6';
      const qText = document.createElement('div');
      qText.innerHTML = `<b>${node.attrs.question_number}. ${node.attrs.question_text}</b>`;
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