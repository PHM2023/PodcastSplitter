import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Settings, CheckCircle } from 'lucide-react';
import type { WSMessage } from '@shared/schema';

interface ProcessingStatusProps {
  wsMessage: WSMessage | null;
  totalFiles: number;
  totalSize: string;
}

export function ProcessingStatus({ wsMessage, totalFiles, totalSize }: ProcessingStatusProps) {
  const isProcessing = wsMessage?.type === 'progress';
  const isComplete = wsMessage?.type === 'complete';
  
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center mb-4">
          <Settings className="text-primary text-lg mr-2" />
          <h2 className="text-lg font-medium">Processing Status</h2>
        </div>

        {/* Processing Progress */}
        {(isProcessing || isComplete) && (
          <div className="mb-6">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-3">
                {isComplete ? (
                  <CheckCircle className="text-primary text-xl" />
                ) : (
                  <Settings className="text-primary text-xl animate-spin" />
                )}
              </div>
              <div className="text-sm font-medium">
                {isComplete 
                  ? 'Processing Complete!' 
                  : isProcessing 
                    ? `Processing chunk ${wsMessage.data.currentChunk} of ${wsMessage.data.totalChunks}`
                    : 'Ready to process'
                }
              </div>
            </div>
            
            {isProcessing && (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Overall Progress</span>
                    <span className="text-sm font-medium">{wsMessage.data.progress}%</span>
                  </div>
                  <Progress value={wsMessage.data.progress} />
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Current chunk:</span>
                    <span>chunk_{wsMessage.data.currentChunk.toString().padStart(3, '0')}.mp3</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated time:</span>
                    <span>{Math.floor(wsMessage.data.estimatedTime / 60)}m {wsMessage.data.estimatedTime % 60}s remaining</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Processing speed:</span>
                    <span>{wsMessage.data.processingSpeed.toFixed(1)}x realtime</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-lg font-semibold">{totalFiles}</div>
            <div className="text-xs text-muted-foreground">Total Files</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{totalSize}</div>
            <div className="text-xs text-muted-foreground">Total Size</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
