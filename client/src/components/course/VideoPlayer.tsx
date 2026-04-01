import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  FastForward,
  X,
} from "lucide-react";

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface VideoPlayerProps {
  src: string;
  title?: string;
  className?: string;
  onDownload?: () => void; // fires the download modal on parent
}

export const VideoPlayer = ({ src, title, className = "" }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedPopupRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showSpeedPopup, setShowSpeedPopup] = useState(false);

  const scheduleHide = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (playing && !showSpeedPopup) setShowControls(false);
    }, 3000);
  }, [playing, showSpeedPopup]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (playing && !showSpeedPopup) scheduleHide();
    else {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      setShowControls(true);
    }
    return () => { if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current); };
  }, [playing, scheduleHide, showSpeedPopup]);

  // Close speed popup on click outside
  useEffect(() => {
    if (!showSpeedPopup) return;
    const handler = (e: MouseEvent) => {
      if (speedPopupRef.current && !speedPopupRef.current.contains(e.target as Node)) {
        setShowSpeedPopup(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSpeedPopup]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.pause();
    else v.play();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const v = videoRef.current;
    if (!v) return;
    if (e.key === " " || e.key === "k") { e.preventDefault(); togglePlay(); }
    if (e.key === "ArrowRight") v.currentTime = Math.min(v.duration, v.currentTime + 10);
    if (e.key === "ArrowLeft") v.currentTime = Math.max(0, v.currentTime - 10);
    if (e.key === "m") setMuted((m) => !m);
    if (e.key === "f") toggleFullscreen();
    if (e.key === ">") changeSpeed(1);
    if (e.key === "<") changeSpeed(-1);
  };

  const changeSpeed = (dir: 1 | -1) => {
    const next = Math.max(0.5, Math.min(4, speed + (dir * 0.25)));
    applySpeed(next);
  };

  const applySpeed = (s: number) => {
    // Snap to nearest 0.25
    const snapped = Math.round(s * 4) / 4;
    const clamped = Math.max(0.5, Math.min(4, snapped));
    setSpeed(clamped);
    if (videoRef.current) videoRef.current.playbackRate = clamped;
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleProgress = () => {
    const v = videoRef.current;
    if (!v || !v.buffered.length) return;
    setBuffered(v.buffered.end(v.buffered.length - 1));
  };

  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  // YouTube-style scrubbing: live dragging with visual feedback
  const dragRef = useRef(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPct, setDragPct] = useState(0);
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  const displayPct = isDragging ? dragPct : progressPct;

  const calcPct = useCallback((clientX: number) => {
    const bar = progressBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    let pct = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, pct));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragRef.current = true;
    setIsDragging(true);
    const pct = calcPct(e.clientX);
    setDragPct(pct * 100);
    // Seek immediately for live scrubbing
    if (videoRef.current && duration) {
      videoRef.current.currentTime = pct * duration;
    }

    const onPointerMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const p = calcPct(ev.clientX);
      setDragPct(p * 100);
      if (videoRef.current && duration) {
        videoRef.current.currentTime = p * duration;
      }
    };
    const onPointerUp = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      dragRef.current = false;
      const p = calcPct(ev.clientX);
      if (videoRef.current && duration) {
        videoRef.current.currentTime = p * duration;
      }
      setIsDragging(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleBarHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    setHoverPct(calcPct(e.clientX) * 100);
  };

  const hoverTime = hoverPct !== null && duration
    ? formatTime((hoverPct / 100) * duration)
    : null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { if (playing && !showSpeedPopup) setShowControls(false); }}
      className={`relative bg-black rounded-xl overflow-hidden outline-none select-none ${className}`}
      style={{ aspectRatio: "16/9" }}
    >
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        playsInline
        className="w-full h-full object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
        onProgress={handleProgress}
        onVolumeChange={() => {
          if (videoRef.current) {
            setMuted(videoRef.current.muted);
            setVolume(videoRef.current.volume);
          }
        }}
        onRateChange={() => {
          if (videoRef.current) setSpeed(videoRef.current.playbackRate);
        }}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* Big play/pause overlay */}
      <AnimatePresence>
        {!playing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-8 h-8 text-white fill-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-10"
          >
            {title && (
              <p className="text-xs text-white/70 mb-2 truncate font-medium">{title}</p>
            )}

            {/* Progress bar — YouTube-style */}
            <div
              ref={progressBarRef}
              className={`relative rounded-full bg-white/20 cursor-pointer mb-3 group/bar touch-none transition-all duration-150 ${
                isDragging ? "h-3" : "h-1.5 hover:h-3"
              }`}
              onPointerDown={handlePointerDown}
              onMouseMove={handleBarHover}
              onMouseLeave={() => setHoverPct(null)}
            >
              {/* Buffered */}
              <div className="absolute h-full rounded-full bg-white/25 pointer-events-none" style={{ width: `${bufferedPct}%` }} />
              {/* Hover preview (gray bar) */}
              {hoverPct !== null && !isDragging && (
                <div className="absolute h-full rounded-full bg-white/20 pointer-events-none" style={{ width: `${hoverPct}%` }} />
              )}
              {/* Played / drag progress */}
              <div className="absolute h-full rounded-full bg-indigo-500 pointer-events-none" style={{ width: `${displayPct}%` }} />
              {/* Thumb */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-md pointer-events-none transition-all duration-100 ${
                  isDragging
                    ? "w-4 h-4 opacity-100 scale-110"
                    : "w-3 h-3 opacity-0 group-hover/bar:opacity-100"
                }`}
                style={{ left: `calc(${displayPct}% - ${isDragging ? 8 : 6}px)` }}
              />
              {/* Hover time tooltip */}
              {hoverTime && !isDragging && hoverPct !== null && (
                <div
                  className="absolute -top-8 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-semibold tabular-nums pointer-events-none whitespace-nowrap"
                  style={{ left: `${hoverPct}%` }}
                >
                  {hoverTime}
                </div>
              )}
            </div>

            {/* Button row */}
            <div className="flex items-center gap-1.5">
              {/* Skip back */}
              <button
                onClick={() => videoRef.current && (videoRef.current.currentTime -= 10)}
                className="text-white/80 hover:text-white transition-colors p-1"
                title="Back 10s"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Play/Pause */}
              <button onClick={togglePlay} className="text-white hover:text-indigo-300 p-1">
                {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
              </button>

              {/* Skip forward */}
              <button
                onClick={() => videoRef.current && (videoRef.current.currentTime += 10)}
                className="text-white/80 hover:text-white transition-colors p-1"
                title="Forward 10s"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Time */}
              <span className="text-xs text-white/70 tabular-nums ml-1 shrink-0">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div className="flex-1" />

              {/* Volume */}
              <button
                onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }}
                className="text-white/80 hover:text-white p-1"
              >
                {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range" min={0} max={1} step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = videoRef.current;
                  if (!v) return;
                  const val = parseFloat(e.target.value);
                  v.volume = val;
                  v.muted = val === 0;
                }}
                className="w-14 accent-indigo-500 cursor-pointer"
              />

              {/* Speed button (opens popup) */}
              <div className="relative md:ml-2" ref={speedPopupRef}>
                <button
                  onClick={() => setShowSpeedPopup((v) => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-white/90 hover:text-white"
                  title="Playback speed"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold tabular-nums">{speed}x</span>
                </button>

                {/* Speed popup */}
                <AnimatePresence>
                  {showSpeedPopup && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full right-0 mb-2 w-52 bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl p-3 z-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Speed</span>
                        <button
                          onClick={() => setShowSpeedPopup(false)}
                          className="p-0.5 text-white/40 hover:text-white/80 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Preset chips */}
                      <div className="grid grid-cols-5 gap-1 mb-3">
                        {SPEED_PRESETS.map((s) => (
                          <button
                            key={s}
                            onClick={() => { applySpeed(s); }}
                            className={`py-1.5 rounded-md text-[11px] font-semibold tabular-nums transition-all ${
                              speed === s
                                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                                : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>

                      {/* Slider with snap */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 tabular-nums">0.5</span>
                        <input
                          type="range"
                          min={0.5}
                          max={4}
                          step={0.25}
                          value={speed}
                          onChange={(e) => applySpeed(parseFloat(e.target.value))}
                          className="flex-1 accent-indigo-500 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/40 tabular-nums">4x</span>
                      </div>

                      {/* Current speed display */}
                      <div className="text-center mt-2">
                        <span className="text-sm font-bold text-white tabular-nums">{speed}x</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Fullscreen */}
              <button onClick={toggleFullscreen} className="text-white/80 hover:text-white p-1">
                {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
