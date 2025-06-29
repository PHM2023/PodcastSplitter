import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { upload } from "./middleware/upload";
import { SimpleFFmpegService } from "./services/ffmpeg-simple";
import { insertUploadedFileSchema, chunkingConfigSchema, type WSMessage } from "@shared/schema";
import path from "path";
import fs from "fs";
import archiver from "archiver";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time progress updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to WebSocket');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });

  // Serve static files (chunks)
  app.use('/chunks', express.static(path.join(process.cwd(), 'public', 'chunks')));

  // File upload endpoint
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      console.log(`Starting metadata extraction for file: ${req.file.originalname} (${req.file.size} bytes)`);
      const metadata = await SimpleFFmpegService.getMetadata(req.file.path);
      console.log(`Metadata extraction completed. Duration: ${metadata.duration}s, Bitrate: ${metadata.bitrate}`);
      
      const fileData = insertUploadedFileSchema.parse({
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        duration: metadata.duration,
        bitrate: metadata.bitrate,
        mimeType: req.file.mimetype,
      });

      const uploadedFile = await storage.createUploadedFile(fileData);
      console.log(`File uploaded and stored successfully: ${uploadedFile.id}`);
      
      res.json({
        success: true,
        file: uploadedFile,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ 
        message: 'Upload failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get uploaded files
  app.get('/api/files', async (req, res) => {
    try {
      const files = await storage.getAllUploadedFiles();
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch files' });
    }
  });

  // Start chunking
  app.post('/api/chunk/:fileId', async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const config = chunkingConfigSchema.parse({
        ...req.body,
        fileId,
      });

      const file = await storage.getUploadedFile(fileId);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }

      res.json({ message: 'Chunking started', fileId });

      // Start chunking in background
      setImmediate(async () => {
        try {
          // Find an active WebSocket connection (simple approach for demo)
          let activeWs: WebSocket | undefined;
          wss.clients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
              activeWs = ws;
            }
          });

          const chunks = await SimpleFFmpegService.chunkAudio(file.path, config, activeWs, fileId, file.originalName);
          
          // Save chunks to storage
          for (const chunkInfo of chunks) {
            await storage.createChunk({
              fileId,
              filename: chunkInfo.filename,
              path: chunkInfo.path,
              size: chunkInfo.size,
              duration: chunkInfo.duration,
              startTime: chunkInfo.startTime,
              endTime: chunkInfo.endTime,
              chunkIndex: chunkInfo.chunkIndex,
            });
          }

          // Send completion message
          if (activeWs && activeWs.readyState === WebSocket.OPEN) {
            const message: WSMessage = {
              type: 'complete',
              data: {
                fileId,
                chunks: chunks,
              },
            };
            activeWs.send(JSON.stringify(message));
          }

          console.log(`Chunking completed for file ${fileId}`);
        } catch (error) {
          console.error('Chunking error:', error);
          
          // Send error message
          wss.clients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
              const message: WSMessage = {
                type: 'error',
                data: {
                  fileId,
                  message: error instanceof Error ? error.message : 'Unknown error',
                },
              };
              ws.send(JSON.stringify(message));
            }
          });
        }
      });
    } catch (error) {
      console.error('Chunking request error:', error);
      res.status(500).json({ 
        message: 'Failed to start chunking',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get chunks for a file
  app.get('/api/chunks/:fileId', async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const chunks = await storage.getChunksByFileId(fileId);
      res.json(chunks);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch chunks' });
    }
  });

  // Get all chunks
  app.get('/api/chunks', async (req, res) => {
    try {
      const chunks = await storage.getAllChunks();
      res.json(chunks);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch chunks' });
    }
  });

  // Delete a file and all its chunks
  app.delete('/api/files/:fileId', async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const file = await storage.getUploadedFile(fileId);
      
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }

      // Delete file chunks from filesystem
      const fileChunksDir = path.join(process.cwd(), 'public', 'chunks', `file-${fileId}`);
      if (fs.existsSync(fileChunksDir)) {
        fs.rmSync(fileChunksDir, { recursive: true });
      }

      // Delete original file
      const originalFilePath = path.join(process.cwd(), 'public', 'uploads', file.filename);
      if (fs.existsSync(originalFilePath)) {
        fs.unlinkSync(originalFilePath);
      }

      // Delete from storage
      await storage.deleteChunksByFileId(fileId);
      await storage.deleteUploadedFile(fileId);

      res.json({ message: 'File and chunks deleted successfully' });
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({ message: 'Failed to delete file' });
    }
  });

  // Delete a single chunk
  app.delete('/api/chunks/:chunkId', async (req, res) => {
    try {
      const chunkId = parseInt(req.params.chunkId);
      const chunk = await storage.getChunk(chunkId);
      
      if (!chunk) {
        return res.status(404).json({ message: 'Chunk not found' });
      }

      // Delete chunk file from filesystem
      const chunkFilePath = path.join(process.cwd(), 'public', chunk.path);
      if (fs.existsSync(chunkFilePath)) {
        fs.unlinkSync(chunkFilePath);
      }

      // Delete from storage
      await storage.deleteChunk(chunkId);

      res.json({ message: 'Chunk deleted successfully' });
    } catch (error) {
      console.error('Delete chunk error:', error);
      res.status(500).json({ message: 'Failed to delete chunk' });
    }
  });

  // Get all files
  app.get('/api/files', async (req, res) => {
    try {
      const files = await storage.getAllUploadedFiles();
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch files' });
    }
  });

  // Download single chunk
  app.get('/api/download/chunk/:chunkId', async (req, res) => {
    try {
      const chunkId = parseInt(req.params.chunkId);
      const chunk = await storage.getChunk(chunkId);
      
      if (!chunk) {
        return res.status(404).json({ message: 'Chunk not found' });
      }

      const filePath = path.join(process.cwd(), 'public', chunk.path);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found on disk' });
      }

      res.download(filePath, chunk.filename);
    } catch (error) {
      res.status(500).json({ message: 'Download failed' });
    }
  });

  // Download all chunks as ZIP
  app.get('/api/download/file/:fileId/zip', async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const chunks = await storage.getChunksByFileId(fileId);
      const file = await storage.getUploadedFile(fileId);
      
      if (!file || chunks.length === 0) {
        return res.status(404).json({ message: 'File or chunks not found' });
      }

      const archive = archiver('zip', { zlib: { level: 9 } });
      const zipFilename = `${path.parse(file.originalName).name}_chunks.zip`;
      
      res.attachment(zipFilename);
      archive.pipe(res);

      for (const chunk of chunks) {
        const filePath = path.join(process.cwd(), 'public', chunk.path);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: chunk.filename });
        }
      }

      await archive.finalize();
    } catch (error) {
      res.status(500).json({ message: 'ZIP creation failed' });
    }
  });

  // Delete chunk
  app.delete('/api/chunks/:chunkId', async (req, res) => {
    try {
      const chunkId = parseInt(req.params.chunkId);
      const chunk = await storage.getChunk(chunkId);
      
      if (!chunk) {
        return res.status(404).json({ message: 'Chunk not found' });
      }

      // Delete file from disk
      const filePath = path.join(process.cwd(), 'public', chunk.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from storage
      await storage.deleteChunk(chunkId);
      
      res.json({ message: 'Chunk deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete chunk' });
    }
  });

  // Delete file and all chunks
  app.delete('/api/files/:fileId', async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const file = await storage.getUploadedFile(fileId);
      
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }

      // Delete original file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      // Delete chunks directory
      const chunksDir = path.join(process.cwd(), 'public', 'chunks', `file-${fileId}`);
      if (fs.existsSync(chunksDir)) {
        fs.rmSync(chunksDir, { recursive: true });
      }

      // Delete from storage
      await storage.deleteUploadedFile(fileId);
      
      res.json({ message: 'File and chunks deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete file' });
    }
  });

  // Database statistics and management
  app.get('/api/database/stats', async (req, res) => {
    try {
      const stats = (storage as any).getStats?.() || {
        totalFiles: (await storage.getAllUploadedFiles()).length,
        totalChunks: (await storage.getAllChunks()).length,
        lastUpdated: new Date().toISOString(),
        databaseSize: 'N/A'
      };
      res.json(stats);
    } catch (error) {
      console.error('Error getting database stats:', error);
      res.status(500).json({ error: 'Failed to get database statistics' });
    }
  });

  // Cleanup orphaned entries
  app.post('/api/database/cleanup', async (req, res) => {
    try {
      const result = await (storage as any).cleanupOrphanedEntries?.() || { removedFiles: 0, removedChunks: 0 };
      res.json({
        message: 'Cleanup completed',
        ...result
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
      res.status(500).json({ error: 'Failed to cleanup database' });
    }
  });

  return httpServer;
}