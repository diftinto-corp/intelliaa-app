import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, Download } from "lucide-react";

interface AudioPlayerProps {
  url: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ url }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const togglePlay = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch((error) => console.error("Error playing audio:", error));
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (newValue: number[]) => {
    const newTime = newValue[0];
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (newValue: number[]) => {
    const newVolume = newValue[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "audio.mp3"; // You can set a default name or use the actual file name if available
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let waveOffset = 0;
    const waves = [
      {
        amplitude: 20,
        frequency: 0.02,
        speed: 0.05,
        color: "rgba(59, 130, 246, 0.5)",
      },
      {
        amplitude: 15,
        frequency: 0.03,
        speed: 0.03,
        color: "rgba(16, 185, 129, 0.5)",
      },
      {
        amplitude: 10,
        frequency: 0.05,
        speed: 0.02,
        color: "rgba(236, 72, 153, 0.5)",
      },
    ];

    const animateWaves = () => {
      animationRef.current = requestAnimationFrame(animateWaves);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      waves.forEach((wave) => {
        ctx.fillStyle = wave.color;
        ctx.beginPath();

        ctx.moveTo(0, canvas.height / 2);

        for (let i = 0; i < canvas.width; i++) {
          const y =
            wave.amplitude *
              Math.sin(i * wave.frequency + waveOffset * wave.speed) +
            canvas.height / 2;
          ctx.lineTo(i, y);
        }

        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fill();
      });

      waveOffset += 1;
    };

    if (isPlaying) {
      animateWaves();
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <div className='space-y-4 w-full max-w-md p-6 bg-[#1c1917] rounded-lg shadow-lg'>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      <div className='relative'>
        <canvas
          ref={canvasRef}
          width='400'
          height='100'
          className='w-full rounded-lg'
        />
        <div className='absolute inset-0 bg-gradient-to-b from-transparent to-[#1c1917]/50' />
      </div>
      <div className='flex items-center space-x-4'>
        <Button
          onClick={togglePlay}
          variant='outline'
          size='icon'
          className='w-12 h-12 rounded-full shadow-md hover:shadow-lg transition-shadow border-primary'>
          {isPlaying ? (
            <Pause className='h-6 w-6 text-primary' />
          ) : (
            <Play className='h-6 w-6 text-primary' />
          )}
        </Button>
        <div className='flex-1'>
          <Slider
            value={[currentTime]}
            max={duration}
            step={0.1}
            onValueChange={handleSeek}
            className='w-full'
          />
          <div className='flex justify-between text-sm text-gray-400 mt-1'>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-2'>
          <Volume2 className='h-4 w-4 text-gray-400' />
          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className='w-24'
          />
        </div>
        <Button
          onClick={handleDownload}
          variant='outline'
          size='icon'
          className='w-8 h-8 rounded-full border-primary'>
          <Download className='h-4 w-4 text-primary' />
          <span className='sr-only'>Descargar audio</span>
        </Button>
      </div>
    </div>
  );
};

export default AudioPlayer;
