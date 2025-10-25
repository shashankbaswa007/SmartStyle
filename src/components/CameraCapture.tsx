'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Camera, RotateCw, X } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  onClose: () => void;
  className?: string;
}

export function CameraCapture({ onCapture, onClose, className }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Could not access camera. Please ensure camera permissions are granted.');
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  React.useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const captureImage = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        // Set canvas dimensions to match video aspect ratio
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // If using front camera, flip the image horizontally
        if (facingMode === 'user') {
          context.translate(canvas.width, 0);
          context.scale(-1, 1);
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to base64
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(imageDataUrl);
        stopCamera();
        onClose();
      }
    }
  }, [onCapture, onClose, stopCamera, facingMode]);

  return (
    <div className={cn('fixed inset-0 z-50 bg-background/80 backdrop-blur-sm', className)}>
      <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ 
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full bg-background/50 hover:bg-background/80"
              onClick={toggleCamera}
            >
              <RotateCw className="h-6 w-6" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full bg-background/50 hover:bg-background/80"
              onClick={captureImage}
            >
              <Camera className="h-6 w-6" />
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          className="absolute right-4 top-4"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}