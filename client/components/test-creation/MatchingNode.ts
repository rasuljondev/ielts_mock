import { Node, mergeAttributes } from '@tiptap/core';

export const MatchingNode = Node.create({
  name: 'matching',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      question_number: { default: null },
      left: { default: [] },
      right: { default: [] },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-matching]',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-matching': 'true', style: 'border:1px solid #ccc; padding:8px; margin:8px 0; background:#f9f9f9;' }),
      0,
    ];
  },
  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('div');
      container.setAttribute('data-matching', 'true');
      container.style.border = '1px solid #ccc';
      container.style.padding = '8px';
      container.style.margin = '8px 0';
      container.style.background = '#f9f9f9';
      const left = node.attrs.left || [];
      const right = node.attrs.right || [];
      const leftDiv = document.createElement('div');
      leftDiv.innerHTML = '<b>Items</b><br>' + left.map((item, i) => `${String.fromCharCode(65 + i)}. ${item}`).join('<br>');
      const rightDiv = document.createElement('div');
      rightDiv.innerHTML = '<b>Options</b><br>' + right.map((item, i) => `${i + 1}. ${item}`).join('<br>');
      container.appendChild(leftDiv);
      container.appendChild(rightDiv);
      return {
        dom: container,
      };
    };
  },
}); 