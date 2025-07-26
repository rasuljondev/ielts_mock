import { Node, mergeAttributes } from '@tiptap/core';

export const MapLabelNode = Node.create({
  name: 'map_labeling',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      question_number: { default: null },
      imageUrl: { default: '' },
      boxes: { default: [] },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-map-labeling]',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-map-labeling': 'true',
        class: 'map-labeling-container',
        style: 'position: relative; display: inline-block; margin: 10px 0;'
      }),
      [
        'img',
        {
          src: HTMLAttributes.imageUrl,
          alt: 'Map/Diagram',
          style: 'max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px;'
        }
      ],
      ...(HTMLAttributes.boxes || []).map((box: any) => [
        'div',
        {
          class: 'map-box',
          style: `position: absolute; left: ${box.x}%; top: ${box.y}%; transform: translate(-50%, -50%); min-width: 60px; height: 30px; border: 2px dashed #007bff; background: rgba(0, 123, 255, 0.1); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: #007bff;`,
          'data-box-id': box.id
        },
        box.label || 'Drop here'
      ])
    ];
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.setAttribute('data-map-labeling', 'true');
      container.className = 'map-labeling-container';
      container.style.position = 'relative';
      container.style.display = 'inline-block';
      container.style.margin = '10px 0';

      const img = document.createElement('img');
      img.src = node.attrs.imageUrl;
      img.alt = 'Map/Diagram';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.border = '1px solid #ccc';
      img.style.borderRadius = '4px';
      container.appendChild(img);

      // Add boxes for admin preview
      (node.attrs.boxes || []).forEach((box: any) => {
        const boxElement = document.createElement('div');
        boxElement.className = 'map-box';
        boxElement.setAttribute('data-box-id', box.id);
        boxElement.style.position = 'absolute';
        boxElement.style.left = `${box.x}%`;
        boxElement.style.top = `${box.y}%`;
        boxElement.style.transform = 'translate(-50%, -50%)';
        boxElement.style.minWidth = '60px';
        boxElement.style.height = '30px';
        boxElement.style.border = '2px dashed #007bff';
        boxElement.style.background = 'rgba(0, 123, 255, 0.1)';
        boxElement.style.display = 'flex';
        boxElement.style.alignItems = 'center';
        boxElement.style.justifyContent = 'center';
        boxElement.style.fontSize = '12px';
        boxElement.style.fontWeight = 'bold';
        boxElement.style.color = '#007bff';
        boxElement.textContent = box.label || 'Drop here';
        container.appendChild(boxElement);
      });

      return {
        dom: container,
      };
    };
  },
}); 