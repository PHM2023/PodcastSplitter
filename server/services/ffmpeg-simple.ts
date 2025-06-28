import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { WebSocket } from 'ws';
import type { ChunkingConfig, WSMessage } from '@shared/schema';

const chunksDir = path.join(process.cwd(), 'public', 'chunks');

export interface ChunkInfo {
  filename: string;
  path: string;
  size: number;
  duration: number;
  startTime: number;
  endTime: number;
  chunkIndex: number;
}

export class SimpleFFmpegService {
  static async getMetadata(filePath: string): Promise<{ duration: number; bitrate: number }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Metadata extraction timeout'));
      }, 15000);

      const ffprobeProcess = spawn('ffprobe', [
        '-v', 'quiet',
        '-show_format',
        '-show_streams',
        filePath
      ]);
      
      let stdout = '';
      
      ffprobeProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      ffprobeProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code !== 0) {
          reject(new Error(`ffprobe failed with code ${code}`));
          return;
        }
        
        const durationMatch = stdout.match(/duration=([0-9.]+)/);
        const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;
        
        resolve({ duration: Math.round(duration), bitrate: 128000 });
      });
      
      ffprobeProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  static async chunkAudio(
    inputPath: string,
    config: ChunkingConfig,
    ws?: WebSocket,
    fileId?: number,
    originalFilename?: string
  ): Promise<ChunkInfo[]> {
    const { duration } = await this.getMetadata(inputPath);
    const chunkDurationSeconds = config.chunkDuration * 60;
    const totalChunks = Math.ceil(duration / chunkDurationSeconds);
    
    const fileChunksDir = path.join(chunksDir, `file-${config.fileId}`);
    if (!fs.existsSync(fileChunksDir)) {
      fs.mkdirSync(fileChunksDir, { recursive: true });
    }
    
    const baseFilename = originalFilename 
      ? path.parse(originalFilename).name 
      : `file-${config.fileId}`;
    
    const chunks: ChunkInfo[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const startTime = i * chunkDurationSeconds;
      const endTime = Math.min((i + 1) * chunkDurationSeconds, duration);
      const actualDuration = endTime - startTime;
      
      const chunkNumber = (i + 1).toString().padStart(3, '0');
      const filename = `${chunkNumber} - ${baseFilename}.mp3`;
      const outputPath = path.join(fileChunksDir, filename);
      
      // Use spawn FFmpeg command with copy codec
      await new Promise<void>((resolve, reject) => {
        console.log(`Processing chunk ${i + 1}/${totalChunks}`);
        
        const ffmpegProcess = spawn('ffmpeg', [
          '-ss', startTime.toString(),
          '-i', inputPath,
          '-t', actualDuration.toString(),
          '-acodec', 'copy',
          '-y',
          outputPath
        ], {
          stdio: ['ignore', 'ignore', 'ignore'] // Ignore all stdio to prevent buffer overflow
        });
        
        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            // Send progress update
            if (ws && ws.readyState === WebSocket.OPEN && fileId) {
              const progress = ((i + 1) / totalChunks) * 100;
              const message: WSMessage = {
                type: 'progress',
                data: {
                  fileId,
                  progress: Math.round(progress),
                  currentChunk: i + 1,
                  totalChunks,
                  estimatedTime: Math.round((100 - progress) * 5),
                  processingSpeed: 1,
                }
              };
              ws.send(JSON.stringify(message));
            }
            resolve();
          } else {
            reject(new Error(`FFmpeg process exited with code ${code}`));
          }
        });
        
        ffmpegProcess.on('error', (error) => {
          console.error('FFmpeg spawn error:', error);
          reject(error);
        });
      });
      
      // Get file size
      const stats = fs.statSync(outputPath);
      
      chunks.push({
        filename,
        path: `/chunks/file-${config.fileId}/${filename}`,
        size: stats.size,
        duration: Math.round(actualDuration),
        startTime: Math.round(startTime),
        endTime: Math.round(endTime),
        chunkIndex: i + 1,
      });
    }
    
    return chunks;
  }
}