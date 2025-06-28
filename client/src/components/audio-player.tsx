import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Music, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import type { Chunk } from '@shared/schema';

interface AudioPlayerProps {
  currentChunk: Chunk | null;
  onEnded?: () => void;
}

export function AudioPlayer({ currentChunk, onEnded }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (currentChunk && audioRef.current) {
      audioRef.current.src = currentChunk.path;
      audioRef.current.load();
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [currentChunk]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };
    const handleError = (e: Event) => {
      console.error('Audio playback error:', audio.error?.message || 'Unknown error');
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [onEnded]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (values: number[]) => {
    if (!audioRef.current) return;
    const newTime = values[0];
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skipBackward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
  };

  const handleVolumeChange = (values: number[]) => {
    const newVolume = values[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
    if (newVolume > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    
    if (isMuted) {
      audioRef.current.volume = volume / 100;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const changeSpeed = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  if (!currentChunk) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Music className="text-primary text-lg mr-2" />
              <h3 className="text-base font-medium">Audio Player</h3>
            </div>
            <div className="text-sm text-muted-foreground">
              Select a chunk to play
            </div>
          </div>
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            <Music className="h-8 w-8 mr-2" />
            <span>No audio selected</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <audio ref={audioRef} preload="metadata" />
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Music className="text-primary text-lg mr-2" />
            <h3 className="text-base font-medium">Audio Player</h3>
          </div>
          <div className="text-sm text-muted-foreground">
            Now playing: {currentChunk.filename}
          </div>
        </div>

        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="flex items-center space-x-3">
            <span className="text-sm text-muted-foreground font-mono w-12">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="cursor-pointer"
              />
            </div>
            <span className="text-sm text-muted-foreground font-mono w-12">
              {formatTime(duration)}
            </span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center space-x-4">
            <Button variant="outline" onClick={skipBackward}>
              <SkipBack className="mr-1 h-4 w-4" />
              10s
            </Button>
            
            <Button
              onClick={togglePlayPause}
              size="lg"
              className="w-12 h-12 rounded-full"
              disabled={!currentChunk}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            
            <Button variant="outline" onClick={skipForward}>
              10s
              <SkipForward className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {/* Volume and Additional Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={toggleMute}>
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <div className="w-24">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                />
              </div>
              <span className="text-sm text-muted-foreground w-8">
                {isMuted ? '0%' : `${volume}%`}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={changeSpeed}>
                {playbackSpeed}x
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
