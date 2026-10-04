import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface Position {
  x: number;
  y: number;
}

interface Props {
  children: React.ReactNode;
  storageKey: string;
  defaultCorner: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  className?: string;
}

const DraggableControl = ({ children, storageKey, defaultCorner, className }: Props) => {
  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<Position>({ x: 0, y: 0 });
  const originRef = useRef<Position>({ x: 0, y: 0 });
  const movedRef = useRef(false);

  const getSafeBounds = useCallback(() => {
    const padding = 16;
    const keyboardTop = window.visualViewport?.offsetTop ?? 0;
    const visibleHeight = window.visualViewport?.height ?? window.innerHeight;
    // A sticky bottom bar (the mobile WhatsApp bar) publishes its height here,
    // so floating controls stay above it rather than covering it.
    const reserve = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mc-bottom-reserve")) || 0;
    return {
      minX: padding,
      minY: keyboardTop + padding,
      maxX: window.innerWidth - (containerRef.current?.offsetWidth || 64) - padding,
      maxY: keyboardTop + visibleHeight - (containerRef.current?.offsetHeight || 64) - padding - reserve,
    };
  }, []);

  const resetToDefault = useCallback(() => {
    const bounds = getSafeBounds();
    let newPos = { x: bounds.maxX, y: bounds.maxY };
    
    if (defaultCorner === "bottom-left") newPos = { x: bounds.minX, y: bounds.maxY };
    if (defaultCorner === "top-right") newPos = { x: bounds.maxX, y: bounds.minY };
    if (defaultCorner === "top-left") newPos = { x: bounds.minX, y: bounds.minY };
    
    setPosition(newPos);
    localStorage.setItem(storageKey, JSON.stringify(newPos));
  }, [defaultCorner, storageKey, getSafeBounds]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Position;
        const bounds = getSafeBounds();
        setPosition({
          x: Math.max(bounds.minX, Math.min(parsed.x, bounds.maxX)),
          y: Math.max(bounds.minY, Math.min(parsed.y, bounds.maxY)),
        });
      } catch {
        resetToDefault();
      }
    } else {
      resetToDefault();
    }

    const handleReset = () => resetToDefault();
    const handleResize = () => {
      const bounds = getSafeBounds();
      setPosition((held) => held ? ({
        x: Math.max(bounds.minX, Math.min(held.x, bounds.maxX)),
        y: Math.max(bounds.minY, Math.min(held.y, bounds.maxY)),
      }) : held);
    };
    window.addEventListener("medic:reset-controls", handleReset);
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("medic:reset-controls", handleReset);
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [storageKey, resetToDefault]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    movedRef.current = false;
    originRef.current = { x: e.clientX, y: e.clientY };
    const rect = containerRef.current.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    containerRef.current.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    if (Math.hypot(e.clientX - originRef.current.x, e.clientY - originRef.current.y) > 5) {
      movedRef.current = true;
    }
    
    const bounds = getSafeBounds();
    let x = e.clientX - offsetRef.current.x;
    let y = e.clientY - offsetRef.current.y;
    
    // Constraints
    x = Math.max(bounds.minX, Math.min(x, bounds.maxX));
    y = Math.max(bounds.minY, Math.min(y, bounds.maxY));
    
    setPosition({ x, y });
  };

  const onPointerUp = () => {
    setIsDragging(false);
    if (position) {
      const bounds = getSafeBounds();
      const middle = (bounds.minX + bounds.maxX) / 2;
      const snapped = { ...position, x: position.x <= middle ? bounds.minX : bounds.maxX };
      setPosition(snapped);
      localStorage.setItem(storageKey, JSON.stringify(snapped));
    }
  };

  const onClickCapture = (event: React.MouseEvent) => {
    if (!movedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    movedRef.current = false;
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!event.altKey || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const bounds = getSafeBounds();
    setPosition((held) => {
      if (!held) return held;
      const delta = event.shiftKey ? 24 : 8;
      const next = {
        x: Math.max(bounds.minX, Math.min(held.x + (event.key === "ArrowRight" ? delta : event.key === "ArrowLeft" ? -delta : 0), bounds.maxX)),
        y: Math.max(bounds.minY, Math.min(held.y + (event.key === "ArrowDown" ? delta : event.key === "ArrowUp" ? -delta : 0), bounds.maxY)),
      };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  if (!position) return null;

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
      className={cn(
        "fixed z-[60] touch-none select-none transition-shadow",
        isDragging ? "shadow-2xl scale-105 cursor-grabbing" : "cursor-grab",
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        transition: isDragging ? "none" : "all 0.2s cubic-bezier(0.2, 0, 0, 1)",
      }}
    >
      {children}
    </div>
  );
};

export default DraggableControl;
