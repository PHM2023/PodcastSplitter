import fs from 'fs';
import path from 'path';
import type { UploadedFile, Chunk, InsertUploadedFile, InsertChunk } from '@shared/schema';

const DB_FILE = path.join(process.cwd(), 'data', 'podcast-db.json');

interface DatabaseSchema {
  files: UploadedFile[];
  chunks: Chunk[];
  nextFileId: number;
  nextChunkId: number;
  lastUpdated: string;
}

export class FlatFileDatabase {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDataDirectory();
    this.data = this.loadDatabase();
  }

  private ensureDataDirectory() {
    const dataDir = path.dirname(DB_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const rawData = fs.readFileSync(DB_FILE, 'utf8');
        const data = JSON.parse(rawData);
        console.log(`Loaded database with ${data.files?.length || 0} files and ${data.chunks?.length || 0} chunks`);
        return {
          files: data.files || [],
          chunks: data.chunks || [],
          nextFileId: data.nextFileId || 1,
          nextChunkId: data.nextChunkId || 1,
          lastUpdated: data.lastUpdated || new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('Error loading database:', error);
    }

    // Return empty database if file doesn't exist or is corrupted
    console.log('Initializing new database');
    return {
      files: [],
      chunks: [],
      nextFileId: 1,
      nextChunkId: 1,
      lastUpdated: new Date().toISOString()
    };
  }

  private saveDatabase() {
    try {
      this.data.lastUpdated = new Date().toISOString();
      const jsonData = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(DB_FILE, jsonData, 'utf8');
    } catch (error) {
      console.error('Error saving database:', error);
      throw error;
    }
  }

  // File operations
  async createUploadedFile(insertFile: InsertUploadedFile): Promise<UploadedFile> {
    const file: UploadedFile = {
      id: this.data.nextFileId++,
      ...insertFile,
      duration: insertFile.duration ?? null,
      bitrate: insertFile.bitrate ?? null,
      uploadedAt: new Date()
    };
    
    this.data.files.push(file);
    this.saveDatabase();
    return file;
  }

  async getUploadedFile(id: number): Promise<UploadedFile | undefined> {
    return this.data.files.find(file => file.id === id);
  }

  async getAllUploadedFiles(): Promise<UploadedFile[]> {
    return [...this.data.files];
  }

  async deleteUploadedFile(id: number): Promise<void> {
    this.data.files = this.data.files.filter(file => file.id !== id);
    // Also delete associated chunks
    this.data.chunks = this.data.chunks.filter(chunk => chunk.fileId !== id);
    this.saveDatabase();
  }

  // Chunk operations
  async createChunk(insertChunk: InsertChunk): Promise<Chunk> {
    const chunk: Chunk = {
      id: this.data.nextChunkId++,
      ...insertChunk,
      createdAt: new Date()
    };
    
    this.data.chunks.push(chunk);
    this.saveDatabase();
    return chunk;
  }

  async getChunksByFileId(fileId: number): Promise<Chunk[]> {
    return this.data.chunks.filter(chunk => chunk.fileId === fileId);
  }

  async getChunk(id: number): Promise<Chunk | undefined> {
    return this.data.chunks.find(chunk => chunk.id === id);
  }

  async deleteChunk(id: number): Promise<void> {
    this.data.chunks = this.data.chunks.filter(chunk => chunk.id !== id);
    this.saveDatabase();
  }

  async deleteChunksByFileId(fileId: number): Promise<void> {
    this.data.chunks = this.data.chunks.filter(chunk => chunk.fileId !== fileId);
    this.saveDatabase();
  }

  async getAllChunks(): Promise<Chunk[]> {
    return [...this.data.chunks];
  }

  // Utility methods
  getStats() {
    return {
      totalFiles: this.data.files.length,
      totalChunks: this.data.chunks.length,
      lastUpdated: this.data.lastUpdated,
      databaseSize: this.getDatabaseSize()
    };
  }

  private getDatabaseSize(): string {
    try {
      const stats = fs.statSync(DB_FILE);
      const bytes = stats.size;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 Bytes';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    } catch {
      return '0 Bytes';
    }
  }

  // Cleanup method to verify file integrity
  async cleanupOrphanedEntries(): Promise<{ removedFiles: number; removedChunks: number }> {
    let removedFiles = 0;
    let removedChunks = 0;

    // Remove files whose physical files don't exist
    const originalFileCount = this.data.files.length;
    this.data.files = this.data.files.filter(file => {
      if (fs.existsSync(file.path)) {
        return true;
      } else {
        removedFiles++;
        return false;
      }
    });

    // Remove chunks whose physical files don't exist or whose parent file doesn't exist
    const originalChunkCount = this.data.chunks.length;
    const validFileIds = new Set(this.data.files.map(f => f.id));
    
    this.data.chunks = this.data.chunks.filter(chunk => {
      if (!validFileIds.has(chunk.fileId) || !fs.existsSync(chunk.path)) {
        removedChunks++;
        return false;
      }
      return true;
    });

    if (removedFiles > 0 || removedChunks > 0) {
      this.saveDatabase();
      console.log(`Cleanup completed: removed ${removedFiles} orphaned files and ${removedChunks} orphaned chunks`);
    }

    return { removedFiles, removedChunks };
  }
}

// Create and export singleton instance
export const database = new FlatFileDatabase();