import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FolderOpen, Download, Trash2, FileAudio, Play, Pause } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { Chunk } from '@shared/schema';

interface FileManagementProps {
  chunks: Chunk[];
  onChunkDeleted: (chunkId: number) => void;
  currentlyPlaying: number | null;
  onPlayChunk: (chunkId: number) => void;
}

export function FileManagement({ chunks, onChunkDeleted, currentlyPlaying, onPlayChunk }: FileManagementProps) {
  const [sortField, setSortField] = useState<'filename' | 'duration' | 'size'>('chunkIndex');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'chunk'; id: number; name: string } | null>(null);
  const { toast } = useToast();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeRange = (startTime: number, endTime: number) => {
    return `${formatDuration(startTime)} - ${formatDuration(endTime)}`;
  };

  const sortedChunks = [...chunks].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'filename':
        aValue = a.filename;
        bValue = b.filename;
        break;
      case 'duration':
        aValue = a.duration;
        bValue = b.duration;
        break;
      case 'size':
        aValue = a.size;
        bValue = b.size;
        break;
      default:
        aValue = a.chunkIndex;
        bValue = b.chunkIndex;
    }

    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDownloadChunk = (chunkId: number) => {
    api.downloadChunk(chunkId);
  };

  const handleDeleteChunk = async () => {
    if (!deleteTarget) return;

    try {
      await api.deleteChunk(deleteTarget.id);
      onChunkDeleted(deleteTarget.id);
      toast({
        title: 'Chunk deleted',
        description: `${deleteTarget.name} has been deleted successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete chunk.',
        variant: 'destructive',
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleDownloadAll = () => {
    if (chunks.length > 0) {
      api.downloadFileAsZip(chunks[0].fileId);
    }
  };

  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FolderOpen className="text-primary text-lg mr-2" />
              <h2 className="text-lg font-medium">Chunked Files</h2>
              <Badge variant="secondary" className="ml-3">
                {chunks.length} chunks
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleDownloadAll} disabled={chunks.length === 0}>
                <Download className="mr-1 h-4 w-4" />
                Download All (ZIP)
              </Button>
            </div>
          </div>
        </div>

        {chunks.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileAudio className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No chunks available. Upload and process a file to see chunks here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('filename')}>
                    <div className="flex items-center">
                      File Name
                      {sortField === 'filename' && (
                        <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('duration')}>
                    <div className="flex items-center">
                      Duration
                      {sortField === 'duration' && (
                        <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('size')}>
                    <div className="flex items-center">
                      Size
                      {sortField === 'size' && (
                        <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Time Range</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedChunks.map((chunk) => (
                  <TableRow key={chunk.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center">
                        <FileAudio 
                          className={`mr-3 h-4 w-4 ${currentlyPlaying === chunk.id ? 'text-green-500' : 'text-primary'}`} 
                        />
                        <div>
                          <div className="text-sm font-medium">{chunk.filename}</div>
                          <div className="text-xs text-muted-foreground">{chunk.path}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDuration(chunk.duration)}</TableCell>
                    <TableCell className="text-sm">{formatFileSize(chunk.size)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimeRange(chunk.startTime, chunk.endTime)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant={currentlyPlaying === chunk.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => onPlayChunk(chunk.id)}
                        >
                          {currentlyPlaying === chunk.id ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadChunk(chunk.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteTarget({ type: 'chunk', id: chunk.id, name: chunk.filename })}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{chunk.filename}"? This action cannot be undone.
                                The file will be permanently removed from the server.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteChunk} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                <Trash2 className="mr-1 h-4 w-4" />
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {chunks.length > 0 && (
          <div className="px-6 py-3 border-t text-sm text-muted-foreground">
            Showing {chunks.length} chunks • Total size: {formatFileSize(totalSize)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
