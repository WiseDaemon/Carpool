import React, { useState, useRef, useEffect } from 'react';

const SwipeToComplete = ({ onComplete, disabled, label = "Slide to Complete" }) => {
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const containerRef = useRef(null);
  const thumbRef = useRef(null);

  const handleStart = (e) => {
    if (disabled || isCompleted) return;
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    setStartX(clientX - currentX);
    setIsDragging(true);
  };

  const handleMove = (e) => {
    if (!isDragging || disabled || isCompleted) return;
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const containerWidth = containerRef.current.offsetWidth;
    const thumbWidth = thumbRef.current.offsetWidth;
    const maxDrag = containerWidth - thumbWidth - 10; // 5px padding on each side

    let newX = clientX - startX;
    if (newX < 0) newX = 0;
    if (newX > maxDrag) {
      newX = maxDrag;
      setIsCompleted(true);
      setIsDragging(false);
      if (onComplete) onComplete();
    }
    setCurrentX(newX);
  };

  const handleEnd = () => {
    if (!isCompleted) {
      setIsDragging(false);
      setCurrentX(0); // snap back
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
    } else {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, isCompleted, handleMove, handleEnd]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-14 rounded-full flex items-center overflow-hidden transition-all duration-300 select-none ${
        disabled 
          ? 'bg-surface-container border border-white/5 opacity-50 cursor-not-allowed' 
          : isCompleted
            ? 'bg-primary/20 border border-primary/30'
            : 'bg-surface-bright border border-white/10'
      }`}
    >
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <span className={`font-bold text-sm tracking-wider uppercase transition-opacity duration-300 ${isCompleted ? 'text-primary' : (disabled ? 'text-on-surface-variant' : 'text-on-surface')} ${currentX > 50 && !isCompleted ? 'opacity-0' : 'opacity-100'}`}>
          {isCompleted ? 'Completed' : label}
        </span>
      </div>
      
      <div 
        ref={thumbRef}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        style={{ transform: `translateX(${currentX}px)`, transition: isDragging ? 'none' : 'transform 0.3s ease-out' }}
        className={`absolute left-1.5 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-colors ${
          disabled 
            ? 'bg-white/10 text-white/30' 
            : isCompleted
              ? 'bg-primary text-surface-deep'
              : 'bg-primary text-surface-deep cursor-grab active:cursor-grabbing hover:brightness-110'
        }`}
      >
        <span className="material-symbols-outlined text-[20px]">
          {isCompleted ? 'check' : 'chevron_right'}
        </span>
      </div>
    </div>
  );
};

export default SwipeToComplete;
