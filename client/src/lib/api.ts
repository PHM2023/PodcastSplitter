import { apiRequest } from './queryClient';
import type { ChunkingConfig } from '@shared/schema';

export const api = {
  // File upload
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get uploaded files
  getFiles: async () => {
    const response = await apiRequest('GET', '/api/files');
    return response.json();
  },

  // Start chunking
  startChunking: async (config: ChunkingConfig) => {
    const response = await apiRequest('POST', `/api/chunk/${config.fileId}`, config);
    return response.json();
  },

  // Get chunks
  getChunks: async (fileId?: number) => {
    const url = fileId ? `/api/chunks/${fileId}` : '/api/chunks';
    const response = await apiRequest('GET', url);
    return response.json();
  },

  // Download chunk
  downloadChunk: (chunkId: number) => {
    window.open(`/api/download/chunk/${chunkId}`, '_blank');
  },

  // Download all chunks as ZIP
  downloadFileAsZip: (fileId: number) => {
    window.open(`/api/download/file/${fileId}/zip`, '_blank');
  },

  // Delete chunk
  deleteChunk: async (chunkId: number) => {
    const response = await apiRequest('DELETE', `/api/chunks/${chunkId}`);
    return response.json();
  },

  // Delete file
  deleteFile: async (fileId: number) => {
    const response = await apiRequest('DELETE', `/api/files/${fileId}`);
    return response.json();
  },
};
