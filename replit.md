# MP3 Podcast Chunker

## Overview

The MP3 Podcast Chunker is a full-stack web application that allows users to upload MP3 podcast files and split them into smaller, manageable segments. The application provides a modern, accessible interface for file management, chunking configuration, and audio playback.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side navigation
- **UI Components**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Build Tool**: Vite with custom configuration for development and production

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **File Processing**: FFmpeg via fluent-ffmpeg for audio manipulation
- **File Upload**: Multer middleware for handling multipart/form-data
- **Real-time Communication**: WebSockets for progress updates during chunking
- **API Design**: RESTful endpoints with WebSocket support

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Management**: Drizzle Kit for migrations and schema management
- **File Storage**: Local filesystem with organized directory structure
- **Session Storage**: In-memory storage for development (can be extended to persistent storage)

## Key Components

### File Upload System
- Drag-and-drop interface using react-dropzone
- File validation (MP3 only, 500MB limit)
- Progress tracking during upload
- Metadata extraction using FFmpeg

### Audio Processing Pipeline
- FFmpeg integration for audio metadata extraction
- Configurable chunking by duration (1-60 minutes)
- Real-time progress updates via WebSockets
- Automatic file organization in chunks directory

### File Management Interface
- Table-based view of chunks with sorting capabilities
- Bulk operations (download as ZIP, delete)
- Individual chunk actions (play, download, delete)
- Responsive design for mobile and desktop

### Audio Player
- Custom HTML5 audio player with controls
- Playback speed adjustment
- Volume control with mute functionality
- Seek bar with time display
- Auto-advance to next chunk capability

## Data Flow

1. **File Upload**: User selects MP3 file → Frontend validates → Multer processes upload → FFmpeg extracts metadata → File stored in database
2. **Chunking Process**: User configures chunking → Backend processes with FFmpeg → WebSocket provides progress updates → Chunks stored and cataloged
3. **File Management**: Database queries provide chunk listings → Frontend displays in sortable table → User actions trigger API calls
4. **Audio Playback**: User selects chunk → Audio player loads file → Playback controls manage HTML5 audio element

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database driver
- **drizzle-orm**: Type-safe ORM for database operations
- **fluent-ffmpeg**: FFmpeg wrapper for audio processing
- **multer**: File upload middleware
- **archiver**: ZIP file creation for bulk downloads
- **ws**: WebSocket implementation for real-time communication

### UI Dependencies
- **@radix-ui/***: Accessible component primitives
- **@tanstack/react-query**: Server state management
- **react-dropzone**: File upload interface
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management

### Development Dependencies
- **vite**: Fast build tool and dev server
- **typescript**: Type safety and development experience
- **@replit/vite-plugin-***: Replit-specific development tools

## Deployment Strategy

### Development Environment
- Vite dev server with HMR for frontend
- tsx for TypeScript execution in development
- Concurrent frontend and backend development with proxy setup
- Environment variable management for database connection

### Production Build
- Vite builds optimized frontend bundle to dist/public
- esbuild bundles backend code to dist/index.js
- Static file serving for chunks and uploads
- PostgreSQL database with connection pooling

### File Organization
```
/public
  /uploads     - Original uploaded MP3 files
  /chunks      - Generated chunk files
/client        - React frontend application
/server        - Express backend application
/shared        - Shared TypeScript schemas and types
/migrations    - Database migration files
```

## Changelog

Changelog:
- June 28, 2025. Initial setup
- June 28, 2025. Updated chunk naming to include original filename with chunk number at front (format: "001 - filename.mp3")
- June 28, 2025. Fixed buffer overflow issues in FFmpeg processing using spawn() instead of exec()
- June 28, 2025. Added File Library page with comprehensive file management capabilities:
  * Multiple file storage and organization
  * Advanced sorting (by name, date, size, duration, chunk count)
  * Search and filtering functionality
  * Individual file and chunk management
  * Bulk operations (download all chunks as ZIP)
  * Real-time data synchronization between pages
- June 28, 2025. Added .gitignore with proper wildcards to prevent all audio files (MP3, WAV, etc.) from being committed to repository
- June 28, 2025. Simplified home screen to clear file listings after upload - all file history managed exclusively in Library page
- June 28, 2025. Added smart upload date display in Library with relative formatting (Today, Yesterday, days ago, or full date)
- June 28, 2025. Cleaned up local MP3 files and resolved git repository large file issues - fresh start with proper .gitignore
- June 29, 2025. Implemented flat file JSON database for persistent storage of podcast metadata - survives server restarts

## User Preferences

Preferred communication style: Simple, everyday language.