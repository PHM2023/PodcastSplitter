import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CloudUpload, FileAudio, X, Info, Play } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { UploadedFile, ChunkingConfig } from '@shared/schema';

interface FileUploadProps {
  onFileUploaded: (file: UploadedFile) => void;
  onChunkingStarted: (config: ChunkingConfig) => void;
}

export function FileUpload({ onFileUploaded, onChunkingStarted }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [chunkDuration, setChunkDuration] = useState(10);
  const [namingFormat, setNamingFormat] = useState<'sequential' | 'timestamp' | 'custom'>('sequential');
  const [customPrefix, setCustomPrefix] = useState('');
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    if (!file.type.includes('audio/mpeg') && !file.name.toLowerCase().endsWith('.mp3')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an MP3 file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (500MB)
    if (file.size > 500 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 500MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Show initial upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 70) return prev; // Stop at 70% to show processing phase
          return prev + Math.random() * 8;
        });
      }, 200);

      // After reaching 70%, switch to processing message
      setTimeout(() => {
        clearInterval(progressInterval);
        setUploadProgress(92); // Set to 92% to show we're processing
      }, 2000);

      const result = await api.uploadFile(file);
      setUploadProgress(100);
      
      setTimeout(() => {
        setUploading(false);
        setUploadedFile(result.file);
        onFileUploaded(result.file);
        toast({
          title: 'Upload successful',
          description: `${file.name} has been uploaded successfully.`,
        });
      }, 500);
    } catch (error) {
      setUploading(false);
      setUploadProgress(0);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'An error occurred during upload.',
        variant: 'destructive',
      });
    }
  }, [onFileUploaded, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/mpeg': ['.mp3'],
    },
    maxFiles: 1,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const estimatedChunks = uploadedFile ? Math.ceil((uploadedFile.duration || 0) / (chunkDuration * 60)) : 0;

  const handleStartChunking = async () => {
    if (!uploadedFile) return;

    const config: ChunkingConfig = {
      fileId: uploadedFile.id,
      chunkDuration,
      namingFormat,
      customPrefix: namingFormat === 'custom' ? customPrefix : undefined,
    };

    try {
      await api.startChunking(config);
      onChunkingStarted(config);
      toast({
        title: 'Chunking started',
        description: 'Your file is being processed. You can monitor the progress in the status panel.',
      });
    } catch (error) {
      toast({
        title: 'Failed to start chunking',
        description: error instanceof Error ? error.message : 'An error occurred.',
        variant: 'destructive',
      });
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setUploadProgress(0);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center mb-4">
          <CloudUpload className="text-primary text-lg mr-2" />
          <h2 className="text-lg font-medium">Upload MP3 File</h2>
        </div>

        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary'
          }`}
        >
          <input {...getInputProps()} />
          <div className="mb-4">
            <CloudUpload className="mx-auto h-12 w-12 text-muted-foreground" />
          </div>
          <div className="mb-2">
            <span className="text-base">Drop MP3 files here or </span>
            <span className="text-primary hover:underline">click to browse</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Maximum file size: 500MB • MP3 format only
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {uploadProgress >= 92 ? 'Processing audio metadata...' : 'Uploading...'}
              </span>
              <span className="text-sm text-muted-foreground">{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} />
            {uploadProgress >= 92 && (
              <div className="text-xs text-muted-foreground mt-1">
                Analyzing audio file - this may take a few moments for large files
              </div>
            )}
          </div>
        )}

        {/* File Info */}
        {uploadedFile && (
          <div className="bg-muted rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <FileAudio className="text-primary text-lg mr-3 mt-1" />
                <div>
                  <h3 className="font-medium">{uploadedFile.originalName}</h3>
                  <div className="text-sm text-muted-foreground mt-1">
                    <span>{formatFileSize(uploadedFile.size)}</span> • 
                    <span>{formatDuration(uploadedFile.duration || 0)}</span> • 
                    <span>{uploadedFile.bitrate} kbps</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={removeFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Chunking Configuration */}
        {uploadedFile && (
          <div className="border-t pt-6">
            <div className="flex items-center mb-4">
              <Upload className="text-primary text-lg mr-2" />
              <h3 className="text-base font-medium">Chunking Configuration</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Chunk Duration (minutes)
                </Label>
                <div className="flex items-center">
                  <Input
                    type="number"
                    value={chunkDuration}
                    onChange={(e) => setChunkDuration(parseInt(e.target.value) || 1)}
                    min={1}
                    max={60}
                    className="flex-1"
                  />
                  <div className="ml-3 text-sm text-muted-foreground flex items-center">
                    <Info className="h-4 w-4 text-primary mr-1" />
                    <span>~{estimatedChunks} chunks</span>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Chunk Naming
                </Label>
                <Select value={namingFormat} onValueChange={(value: any) => setNamingFormat(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">Sequential (001 - filename.mp3)</SelectItem>
                    <SelectItem value="timestamp">Timestamp (001 - filename (00-10min).mp3)</SelectItem>
                    <SelectItem value="custom">Custom (001 - filename - prefix.mp3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {namingFormat === 'custom' && (
              <div className="mb-4">
                <Label className="text-sm font-medium mb-2 block">
                  Custom Prefix
                </Label>
                <Input
                  value={customPrefix}
                  onChange={(e) => setCustomPrefix(e.target.value)}
                  placeholder="Enter custom prefix"
                />
              </div>
            )}

            <Button onClick={handleStartChunking} className="w-full sm:w-auto">
              <Play className="mr-2 h-4 w-4" />
              Start Chunking
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
