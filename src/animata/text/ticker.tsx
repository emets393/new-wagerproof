import React from "react";

interface TickerProps {
  value: string;
}

export default function Ticker({ value }: TickerProps) {
  return <span>{value}</span>;
}