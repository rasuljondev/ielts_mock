import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Heading from "@tiptap/extension-heading";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Undo,
  Redo,
  Save,
  PenTool,
} from "lucide-react";

interface WritingPromptEditorProps {
  initialContent?: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  placeholder?: string;
}

export const WritingPromptEditor: React.FC<WritingPromptEditorProps> = ({
  initialContent = "",
  onContentChange,
  onSave,
  placeholder = "Enter the writing task prompt here...",
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      const htmlContent = editor.getHTML();
      onContentChange(htmlContent);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-4",
      },
    },
  });

  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleHeading1 = () =>
    editor.chain().focus().toggleHeading({ level: 1 }).run();
  const toggleHeading2 = () =>
    editor.chain().focus().toggleHeading({ level: 2 }).run();
  const toggleBulletList = () =>
    editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () =>
    editor.chain().focus().toggleOrderedList().run();
  const undo = () => editor.chain().focus().undo().run();
  const redo = () => editor.chain().focus().redo().run();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="h-5 w-5" />
          Writing Task Prompt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-gray-50">
          <Button
            type="button"
            variant={editor.isActive("bold") ? "default" : "outline"}
            size="sm"
            onClick={toggleBold}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive("italic") ? "default" : "outline"}
            size="sm"
            onClick={toggleItalic}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <Button
            type="button"
            variant={
              editor.isActive("heading", { level: 1 }) ? "default" : "outline"
            }
            size="sm"
            onClick={toggleHeading1}
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={
              editor.isActive("heading", { level: 2 }) ? "default" : "outline"
            }
            size="sm"
            onClick={toggleHeading2}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <Button
            type="button"
            variant={editor.isActive("bulletList") ? "default" : "outline"}
            size="sm"
            onClick={toggleBulletList}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive("orderedList") ? "default" : "outline"}
            size="sm"
            onClick={toggleOrderedList}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!editor.can().undo()}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={!editor.can().redo()}
          >
            <Redo className="h-4 w-4" />
          </Button>
          <div className="ml-auto">
            <Button
              type="button"
              onClick={onSave}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Task
            </Button>
          </div>
        </div>

        {/* Editor */}
        <div className="border rounded-lg min-h-[300px] bg-white">
          <EditorContent editor={editor} />
        </div>

        <div className="text-sm text-muted-foreground">
          <p>
            <strong>Tips for writing task prompts:</strong>
          </p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Be clear and specific about what students need to write</li>
            <li>Include any necessary background information or context</li>
            <li>For Task 1: Include visual description requirements</li>
            <li>For Task 2: Include clear opinion/argument requirements</li>
            <li>
              Use proper formatting with headings and bullet points as needed
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default WritingPromptEditor;
