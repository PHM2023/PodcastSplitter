import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileUpload } from '@/components/file-upload';
import { ProcessingStatus } from '@/components/processing-status';
import { useWebSocket } from '@/hooks/use-websocket';
import { Podcast } from 'lucide-react';
import type { UploadedFile, ChunkingConfig } from '@shared/schema';

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const queryClient = useQueryClient();
  const { lastMessage } = useWebSocket();

  const handleFileUploaded = (file: UploadedFile) => {
    // Clear previous uploads on home screen - all history managed in Library
    setUploadedFiles([]);
    // Invalidate files cache for library page
    queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    queryClient.invalidateQueries({ queryKey: ['/api/chunks'] });
  };

  const handleChunkingStarted = (config: ChunkingConfig) => {
    // Chunking started, will be handled by WebSocket updates
  };

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage?.type === 'complete') {
      // Invalidate cache for library page when processing completes
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chunks'] });
    }
  }, [lastMessage, queryClient]);

  // Calculate stats - only show current session data, not all history
  const totalFiles = uploadedFiles.length;
  const totalSize = 0; // Home page doesn't show cumulative size - only current session
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Podcast className="text-primary text-2xl mr-3" />
              <h1 className="text-xl font-semibold">MP3 Podcast Chunker</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">Professional Audio Processing</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File Upload Section */}
          <div className="lg:col-span-2">
            <FileUpload
              onFileUploaded={handleFileUploaded}
              onChunkingStarted={handleChunkingStarted}
            />
          </div>

          {/* Processing Status */}
          <div className="lg:col-span-1">
            <ProcessingStatus
              wsMessage={lastMessage}
              totalFiles={totalFiles}
              totalSize={formatFileSize(totalSize)}
            />
          </div>
        </div>

        {/* Upload Complete Message */}
        {lastMessage?.type === 'complete' && (
          <div className="mt-8">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                    Processing Complete!
                  </h3>
                  <div className="mt-1 text-sm text-green-700 dark:text-green-300">
                    Your podcast has been successfully chunked. Visit the <strong>Library</strong> to manage all your files and chunks.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
