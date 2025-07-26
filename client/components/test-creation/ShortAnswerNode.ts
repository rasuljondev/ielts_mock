import { Node, mergeAttributes } from '@tiptap/core';

export const ShortAnswerNode = Node.create({
  name: 'short_answer',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      question_number: { default: null },
      placeholder: { default: '' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'input[data-short-answer]',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'input',
      mergeAttributes(HTMLAttributes, {
        'data-short-answer': 'true',
        type: 'text',
        placeholder: HTMLAttributes.placeholder || '',
        style: 'display:inline-block; width:15ch; border:1px solid #ccc; border-radius:4px; padding:2px 6px; margin:0 2px;'
      }),
    ];
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = node.attrs.placeholder || '';
      input.setAttribute('data-short-answer', 'true');
      input.style.display = 'inline-block';
      input.style.width = '15ch';
      input.style.border = '1px solid #ccc';
      input.style.borderRadius = '4px';
      input.style.padding = '2px 6px';
      input.style.margin = '0 2px';
      input.disabled = true; // Admin can't edit answer here
      return {
        dom: input,
      };
    };
  },
}); 