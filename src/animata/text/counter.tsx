import React, { useState, useEffect } from "react";

interface CounterProps {
  targetValue: number;
  format?: (value: number) => string;
}

export default function Counter({ targetValue, format = (v) => v.toString() }: CounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = targetValue / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= targetValue) {
        setCount(targetValue);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [targetValue]);

  return <span>{format(count)}</span>;
}