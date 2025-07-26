import React, { useState } from "react";
import AudioManager, { AudioFile } from "@/components/ui/audio-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AudioManagerExample: React.FC = () => {
  const [adminFiles, setAdminFiles] = useState<AudioFile[]>([]);
  const [studentSubmissions, setStudentSubmissions] = useState<AudioFile[]>([]);

  const handleAdminUpload = (newFiles: AudioFile[]) => {
    setAdminFiles((prev) => [...prev, ...newFiles]);
  };

  const handleStudentSubmission = (newFiles: AudioFile[]) => {
    setStudentSubmissions((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveAdminFile = (fileId: string) => {
    setAdminFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const handleRemoveStudentFile = (fileId: string) => {
    setStudentSubmissions((prev) => prev.filter((file) => file.id !== fileId));
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AudioManager Component Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="admin" className="space-y-4">
            <TabsList>
              <TabsTrigger value="admin">Admin Upload</TabsTrigger>
              <TabsTrigger value="student">Student Submission</TabsTrigger>
              <TabsTrigger value="compact">Compact View</TabsTrigger>
            </TabsList>

            <TabsContent value="admin" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Admin Audio Upload
                  </h3>
                  <AudioManager
                    files={adminFiles}
                    onUpload={handleAdminUpload}
                    onRemove={handleRemoveAdminFile}
                    allowUpload={true}
                    allowRecording={false}
                    allowMultiple={true}
                    title="Test Audio Files"
                    maxFileSizeMB={100}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Features</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• Upload multiple audio files</li>
                    <li>• Drag & drop support</li>
                    <li>• File size validation (100MB max)</li>
                    <li>• Audio format validation</li>
                    <li>• Built-in audio player</li>
                    <li>• Download functionality</li>
                    <li>• Upload progress tracking</li>
                    <li>• File management (remove)</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="student" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Student Audio Submission
                  </h3>
                  <AudioManager
                    files={studentSubmissions}
                    onUpload={handleStudentSubmission}
                    onRemove={handleRemoveStudentFile}
                    allowUpload={true}
                    allowRecording={true}
                    allowMultiple={false}
                    title="Audio Answer Submission"
                    maxFileSizeMB={50}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Features</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• Upload audio files</li>
                    <li>• Record audio directly</li>
                    <li>• Single file mode</li>
                    <li>• Real-time recording timer</li>
                    <li>• Automatic upload after recording</li>
                    <li>• Answer submission workflow</li>
                    <li>• File size limits for submissions</li>
                    <li>• Microphone access handling</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="compact" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Compact View</h3>
                  <AudioManager
                    files={adminFiles.slice(0, 2)}
                    onUpload={handleAdminUpload}
                    onRemove={handleRemoveAdminFile}
                    allowUpload={true}
                    allowRecording={true}
                    allowMultiple={true}
                    compact={true}
                    className="border border-gray-200 rounded-lg p-3"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Use Cases</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• Embedded in forms</li>
                    <li>• Sidebar components</li>
                    <li>• Modal dialogs</li>
                    <li>• Quick audio tools</li>
                    <li>• Space-constrained layouts</li>
                    <li>• Inline audio management</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Usage Examples</h4>
            <div className="space-y-2 text-sm text-blue-800">
              <p>
                <strong>Admin Test Creation:</strong> Use with{" "}
                <code>allowUpload=true</code> and{" "}
                <code>allowMultiple=true</code> for uploading listening test
                audio files
              </p>
              <p>
                <strong>Student Submissions:</strong> Use with{" "}
                <code>allowRecording=true</code> and{" "}
                <code>allowMultiple=false</code> for audio answer submissions
              </p>
              <p>
                <strong>Compact Mode:</strong> Use <code>compact=true</code> for
                embedding in forms or tight spaces
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AudioManagerExample;
