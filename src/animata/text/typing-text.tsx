import React, { useState, useEffect } from "react";

interface TypingTextProps {
  text: string;
  waitTime?: number;
  alwaysVisibleCount?: number;
}

export default function TypingText({
  text,
  waitTime = 2000,
  alwaysVisibleCount = 0
}: TypingTextProps) {
  const [displayText, setDisplayText] = useState(text.substring(0, alwaysVisibleCount));
  const [currentIndex, setCurrentIndex] = useState(alwaysVisibleCount);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!hasStarted) {
      // Wait for the specified time before starting the typing animation
      const startTimer = setTimeout(() => {
        setHasStarted(true);
      }, waitTime);
      return () => clearTimeout(startTimer);
    }
  }, [hasStarted, waitTime]);

  useEffect(() => {
    if (hasStarted && currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(text.substring(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, 100); // Type one character every 100ms
      return () => clearTimeout(timer);
    }
  }, [currentIndex, text, hasStarted]);

  return <span>{displayText}</span>;
}