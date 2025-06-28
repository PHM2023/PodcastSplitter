import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const uploadedFiles = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  path: text("path").notNull(),
  size: integer("size").notNull(),
  duration: integer("duration"), // in seconds
  bitrate: integer("bitrate"),
  mimeType: text("mime_type").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const chunks = pgTable("chunks", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull(),
  filename: text("filename").notNull(),
  path: text("path").notNull(),
  size: integer("size").notNull(),
  duration: integer("duration").notNull(), // in seconds
  startTime: integer("start_time").notNull(), // in seconds
  endTime: integer("end_time").notNull(), // in seconds
  chunkIndex: integer("chunk_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUploadedFileSchema = createInsertSchema(uploadedFiles).omit({
  id: true,
  uploadedAt: true,
});

export const insertChunkSchema = createInsertSchema(chunks).omit({
  id: true,
  createdAt: true,
});

export const chunkingConfigSchema = z.object({
  fileId: z.number(),
  chunkDuration: z.number().min(1).max(60), // in minutes
  namingFormat: z.enum(["sequential", "timestamp", "custom"]),
  customPrefix: z.string().optional(),
});

export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertChunk = z.infer<typeof insertChunkSchema>;
export type Chunk = typeof chunks.$inferSelect;
export type ChunkingConfig = z.infer<typeof chunkingConfigSchema>;

// WebSocket message types
export const wsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    data: z.object({
      fileId: z.number(),
      progress: z.number(),
      currentChunk: z.number(),
      totalChunks: z.number(),
      estimatedTime: z.number(),
      processingSpeed: z.number(),
    }),
  }),
  z.object({
    type: z.literal("complete"),
    data: z.object({
      fileId: z.number(),
      chunks: z.array(z.any()),
    }),
  }),
  z.object({
    type: z.literal("error"),
    data: z.object({
      fileId: z.number(),
      message: z.string(),
    }),
  }),
]);

export type WSMessage = z.infer<typeof wsMessageSchema>;
