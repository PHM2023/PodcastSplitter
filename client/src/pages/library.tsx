import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileAudio, Download, Trash2, Clock, HardDrive, Search, Play, Pause, RefreshCw, ArrowUpDown, Calendar, FileText, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { UploadedFile, Chunk } from "@shared/schema";

interface FileWithChunks extends UploadedFile {
  chunks: Chunk[];
}

type SortOption = "name" | "date" | "size" | "duration" | "chunks";
type SortDirection = "asc" | "desc";

export default function Library() {
  const [searchTerm, setSearchTerm] = useState("");
  const [playingChunk, setPlayingChunk] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: files = [], isLoading: filesLoading, refetch: refetchFiles } = useQuery<UploadedFile[]>({
    queryKey: ['/api/files'],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: chunks = [], isLoading: chunksLoading, refetch: refetchChunks } = useQuery<Chunk[]>({
    queryKey: ['/api/chunks'],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Combine files with their chunks
  const filesWithChunks: FileWithChunks[] = files.map(file => ({
    ...file,
    chunks: chunks.filter(chunk => chunk.fileId === file.id)
  }));

  // Debug logging
  console.log('Library data:', { files: files.length, chunks: chunks.length, filesWithChunks: filesWithChunks.length });

  // Sort and filter files
  const sortedAndFilteredFiles = filesWithChunks
    .filter(file =>
      file.originalName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "name":
          comparison = a.originalName.localeCompare(b.originalName);
          break;
        case "date":
          comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "duration":
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        case "chunks":
          comparison = a.chunks.length - b.chunks.length;
          break;
      }
      
      return sortDirection === "desc" ? -comparison : comparison;
    });

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(option);
      setSortDirection("desc");
    }
  };

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete file');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chunks'] });
      toast({
        title: "File deleted",
        description: "The file and all its chunks have been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the file.",
        variant: "destructive",
      });
    }
  });

  const deleteChunkMutation = useMutation({
    mutationFn: async (chunkId: number) => {
      const response = await fetch(`/api/chunks/${chunkId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete chunk');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chunks'] });
      toast({
        title: "Chunk deleted",
        description: "The audio chunk has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the chunk.",
        variant: "destructive",
      });
    }
  });

  const downloadAllChunks = async (fileId: number, originalName: string) => {
    try {
      const response = await fetch(`/api/download/file/${fileId}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${originalName.replace('.mp3', '')}_chunks.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download started",
        description: "All chunks are being downloaded as a ZIP file.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the chunks.",
        variant: "destructive",
      });
    }
  };

  const downloadChunk = (chunk: Chunk) => {
    const link = document.createElement('a');
    link.href = chunk.path;
    link.download = chunk.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUploadDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (diffInDays === 1) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };



  const totalFiles = filesWithChunks.length;
  const totalChunks = chunks.length;
  const totalSize = filesWithChunks.reduce((sum, file) => sum + file.size, 0);

  if (filesLoading || chunksLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">File Library</h1>
          <p className="text-muted-foreground">Manage your podcast files and audio chunks</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchFiles();
              refetchChunks();
            }}
            disabled={filesLoading || chunksLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${filesLoading || chunksLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="text-right text-sm text-muted-foreground">
            <div>{totalFiles} files • {totalChunks} chunks</div>
            <div>{formatFileSize(totalSize)} total</div>
          </div>
        </div>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search files by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Upload Date
                </span>
              </SelectItem>
              <SelectItem value="name">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Name
                </span>
              </SelectItem>
              <SelectItem value="size">
                <span className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  File Size
                </span>
              </SelectItem>
              <SelectItem value="duration">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Duration
                </span>
              </SelectItem>
              <SelectItem value="chunks">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Chunk Count
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
          >
            <ArrowUpDown className="h-4 w-4" />
            {sortDirection === "asc" ? "↑" : "↓"}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <FileAudio className="h-8 w-8 text-blue-600 mr-4" />
            <div>
              <p className="text-2xl font-bold">{totalFiles}</p>
              <p className="text-sm text-muted-foreground">Audio Files</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <HardDrive className="h-8 w-8 text-green-600 mr-4" />
            <div>
              <p className="text-2xl font-bold">{totalChunks}</p>
              <p className="text-sm text-muted-foreground">Total Chunks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <Download className="h-8 w-8 text-purple-600 mr-4" />
            <div>
              <p className="text-2xl font-bold">{formatFileSize(totalSize)}</p>
              <p className="text-sm text-muted-foreground">Storage Used</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Files List */}
      {sortedAndFilteredFiles.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileAudio className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No files found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Try adjusting your search terms." : "Upload some podcast files to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedAndFilteredFiles.map((file) => (
            <Card key={file.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{file.originalName}</CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDuration(file.duration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-4 w-4" />
                        {formatFileSize(file.size)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatUploadDate(file.uploadedAt)}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {file.chunks.length} chunks
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadAllChunks(file.id, file.originalName)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download All
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete file?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{file.originalName}" and all its chunks. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteFileMutation.mutate(file.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              
              {file.chunks.length > 0 && (
                <CardContent>
                  <Separator className="mb-4" />
                  <h4 className="font-semibold mb-3">Audio Chunks</h4>
                  <div className="grid gap-2">
                    {file.chunks.map((chunk) => (
                      <div key={chunk.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPlayingChunk(playingChunk === chunk.id ? null : chunk.id)}
                          >
                            {playingChunk === chunk.id ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <div>
                            <p className="font-medium text-sm">{chunk.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDuration(chunk.duration)} • {formatFileSize(chunk.size)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadChunk(chunk)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete chunk?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the chunk "{chunk.filename}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteChunkMutation.mutate(chunk.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Audio Player for Chunks */}
      {playingChunk && (
        <div className="fixed bottom-6 left-6 right-6 bg-background border rounded-lg shadow-lg p-4">
          <audio
            controls
            autoPlay
            src={chunks.find(c => c.id === playingChunk)?.path || ""}
            onEnded={() => setPlayingChunk(null)}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}