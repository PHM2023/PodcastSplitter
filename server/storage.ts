import { uploadedFiles, chunks, type UploadedFile, type InsertUploadedFile, type Chunk, type InsertChunk } from "@shared/schema";

export interface IStorage {
  // Uploaded files
  createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile>;
  getUploadedFile(id: number): Promise<UploadedFile | undefined>;
  getAllUploadedFiles(): Promise<UploadedFile[]>;
  deleteUploadedFile(id: number): Promise<void>;
  
  // Chunks
  createChunk(chunk: InsertChunk): Promise<Chunk>;
  getChunksByFileId(fileId: number): Promise<Chunk[]>;
  getChunk(id: number): Promise<Chunk | undefined>;
  deleteChunk(id: number): Promise<void>;
  deleteChunksByFileId(fileId: number): Promise<void>;
  getAllChunks(): Promise<Chunk[]>;
}

export class MemStorage implements IStorage {
  private uploadedFiles: Map<number, UploadedFile>;
  private chunks: Map<number, Chunk>;
  private currentFileId: number;
  private currentChunkId: number;

  constructor() {
    this.uploadedFiles = new Map();
    this.chunks = new Map();
    this.currentFileId = 1;
    this.currentChunkId = 1;
  }

  private getNextFileId(): number {
    // Ensure we don't reuse existing IDs
    while (this.uploadedFiles.has(this.currentFileId)) {
      this.currentFileId++;
    }
    return this.currentFileId++;
  }

  private getNextChunkId(): number {
    // Ensure we don't reuse existing IDs
    while (this.chunks.has(this.currentChunkId)) {
      this.currentChunkId++;
    }
    return this.currentChunkId++;
  }

  async createUploadedFile(insertFile: InsertUploadedFile): Promise<UploadedFile> {
    const id = this.getNextFileId();
    const file: UploadedFile = { 
      ...insertFile, 
      id,
      duration: insertFile.duration ?? null,
      bitrate: insertFile.bitrate ?? null,
      uploadedAt: new Date()
    };
    this.uploadedFiles.set(id, file);
    return file;
  }

  async getUploadedFile(id: number): Promise<UploadedFile | undefined> {
    return this.uploadedFiles.get(id);
  }

  async getAllUploadedFiles(): Promise<UploadedFile[]> {
    return Array.from(this.uploadedFiles.values());
  }

  async deleteUploadedFile(id: number): Promise<void> {
    this.uploadedFiles.delete(id);
    // Also delete associated chunks
    await this.deleteChunksByFileId(id);
  }

  async createChunk(insertChunk: InsertChunk): Promise<Chunk> {
    const id = this.getNextChunkId();
    const chunk: Chunk = { 
      ...insertChunk, 
      id,
      createdAt: new Date()
    };
    this.chunks.set(id, chunk);
    return chunk;
  }

  async getChunksByFileId(fileId: number): Promise<Chunk[]> {
    return Array.from(this.chunks.values()).filter(chunk => chunk.fileId === fileId);
  }

  async getChunk(id: number): Promise<Chunk | undefined> {
    return this.chunks.get(id);
  }

  async deleteChunk(id: number): Promise<void> {
    this.chunks.delete(id);
  }

  async deleteChunksByFileId(fileId: number): Promise<void> {
    const chunksToDelete: number[] = [];
    this.chunks.forEach((chunk, id) => {
      if (chunk.fileId === fileId) {
        chunksToDelete.push(id);
      }
    });
    chunksToDelete.forEach(id => this.chunks.delete(id));
  }

  async getAllChunks(): Promise<Chunk[]> {
    return Array.from(this.chunks.values());
  }
}

export const storage = new MemStorage();
