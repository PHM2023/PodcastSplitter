import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { WebSocket } from 'ws';
import type { ChunkingConfig, WSMessage } from '@shared/schema';

// Ensure chunks directory exists
const chunksDir = path.join(process.cwd(), 'public', 'chunks');
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

export interface ChunkInfo {
  filename: string;
  path: string;
  size: number;
  duration: number;
  startTime: number;
  endTime: number;
  chunkIndex: number;
}

export class FFmpegService {
  private static getAudioMetadata(filePath: string): Promise<{ duration: number; bitrate: number }> {
    return new Promise((resolve, reject) => {
      // Set a timeout for metadata extraction to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error('Metadata extraction timeout'));
      }, 15000); // Reduced to 15 second timeout

      // Use basic ffprobe for reliable metadata extraction
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        clearTimeout(timeout);
        
        if (err) {
          reject(err);
          return;
        }
        
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        const duration = metadata.format.duration || 0;
        const bitrate = audioStream?.bit_rate ? parseInt(audioStream.bit_rate) : 128000;
        
        resolve({ duration: Math.round(duration), bitrate });
      });
    });
  }

  static async getMetadata(filePath: string) {
    return this.getAudioMetadata(filePath);
  }

  static async chunkAudio(
    inputPath: string,
    config: ChunkingConfig,
    ws?: WebSocket,
    fileId?: number,
    originalFilename?: string
  ): Promise<ChunkInfo[]> {
    const { duration } = await this.getAudioMetadata(inputPath);
    const chunkDurationSeconds = config.chunkDuration * 60;
    const totalChunks = Math.ceil(duration / chunkDurationSeconds);
    
    // Create directory for this file's chunks
    const fileChunksDir = path.join(chunksDir, `file-${config.fileId}`);
    if (!fs.existsSync(fileChunksDir)) {
      fs.mkdirSync(fileChunksDir, { recursive: true });
    }
    
    // Extract base filename without extension
    const baseFilename = originalFilename 
      ? path.parse(originalFilename).name 
      : `file-${config.fileId}`;
    
    const chunks: ChunkInfo[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const startTime = i * chunkDurationSeconds;
      const endTime = Math.min((i + 1) * chunkDurationSeconds, duration);
      const actualDuration = endTime - startTime;
      
      const chunkNumber = (i + 1).toString().padStart(3, '0');
      let filename: string;
      
      switch (config.namingFormat) {
        case 'sequential':
          filename = `${chunkNumber} - ${baseFilename}.mp3`;
          break;
        case 'timestamp':
          const startMin = Math.floor(startTime / 60);
          const endMin = Math.floor(endTime / 60);
          filename = `${chunkNumber} - ${baseFilename} (${startMin.toString().padStart(2, '0')}-${endMin.toString().padStart(2, '0')}min).mp3`;
          break;
        case 'custom':
          const prefix = config.customPrefix || 'chunk';
          filename = `${chunkNumber} - ${baseFilename} - ${prefix}.mp3`;
          break;
        default:
          filename = `${chunkNumber} - ${baseFilename}.mp3`;
      }
      
      const outputPath = path.join(fileChunksDir, filename);
      
      await new Promise<void>((resolve, reject) => {
        // Set timeout to prevent hanging
        let timeoutId: NodeJS.Timeout;
        
        const ffmpegCommand = ffmpeg(inputPath)
          .seekInput(startTime)
          .duration(actualDuration)
          .audioCodec('copy')
          .format('mp3')
          .outputOptions([
            '-avoid_negative_ts', 'make_zero',
            '-fflags', '+genpts',
            '-threads', '1',
            '-bufsize', '64k'
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('Spawned FFmpeg with command: ' + commandLine);
            // Set timeout after start
            timeoutId = setTimeout(() => {
              ffmpegCommand.kill('SIGTERM');
              reject(new Error('FFmpeg timeout - chunk processing took too long'));
            }, 60000);
          })
          .on('progress', (progress) => {
            if (ws && ws.readyState === WebSocket.OPEN && fileId) {
              const overallProgress = ((i + (progress.percent || 0) / 100) / totalChunks) * 100;
              const message: WSMessage = {
                type: 'progress',
                data: {
                  fileId,
                  progress: Math.round(overallProgress),
                  currentChunk: i + 1,
                  totalChunks,
                  estimatedTime: Math.round((100 - overallProgress) * 2),
                  processingSpeed: progress.currentKbps ? progress.currentKbps / 128 : 1,
                }
              };
              ws.send(JSON.stringify(message));
            }
          })
          .on('end', () => {
            if (timeoutId) clearTimeout(timeoutId);
            resolve();
          })
          .on('error', (err) => {
            if (timeoutId) clearTimeout(timeoutId);
            console.error('Chunking error:', err);
            reject(err);
          });

        ffmpegCommand.run();
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
