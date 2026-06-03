"use client";

import { useState, useEffect, useRef } from "react";

interface TerminalTitleProps {
  children: string;
  as?: "h1" | "h2" | "h3" | "h4" | "span" | "div";
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function TerminalTitle({ children, as: Tag = "h1", className, style, delay = 0 }: TerminalTitleProps) {
  const reduced = useReducedMotion();
  const text = children;
  const [revealed, setRevealed] = useState(0);
  const done = revealed >= text.length;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (reduced) {
      setRevealed(text.length);
      return;
    }

    const duration = Math.max(300, Math.min(1200, text.length * 40));
    const stepMs = duration / text.length;
    let idx = 0;

    const startTimer = setTimeout(() => {
      timerRef.current = setInterval(() => {
        idx++;
        setRevealed(idx);
        if (idx >= text.length && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }, stepMs);
    }, delay);

    return () => {
      clearTimeout(startTimer);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [text, reduced, delay]);

  return (
    <Tag className={className} style={{ ...style, visibility: "visible" }} aria-label={text}>
      <span style={{ visibility: "hidden", display: "block", height: 0, overflow: "hidden" }} aria-hidden="true">
        {text}
      </span>
      {text.slice(0, revealed)}
      <span
        style={{
          display: "inline-block",
          verticalAlign: "text-bottom",
          marginLeft: "0.15em",
          fontSize: "0.85em",
          lineHeight: 1,
          color: "var(--color-accent-purple)",
          animation: done
            ? reduced
              ? "none"
              : "cursor-spin 8s ease-in-out infinite"
            : reduced
              ? "none"
              : "blink 0.8s step-end infinite",
        }}
        aria-hidden="true"
      >
        ▋
      </span>
    </Tag>
  );
}
