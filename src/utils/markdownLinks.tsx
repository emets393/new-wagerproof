import React from 'react';

/**
 * Parses markdown-style links [text](url) and converts them to clickable React elements
 * @param text - The text containing markdown links
 * @returns Array of React elements (text nodes and anchor tags)
 */
export function renderTextWithLinks(text: string): React.ReactNode[] {
  if (!text) return [text];

  // Regex to match markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  // Find all markdown links in the text
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    const [fullMatch, linkText, url] = match;
    const matchIndex = match.index;

    // Add any text before this link
    if (matchIndex > lastIndex) {
      elements.push(text.substring(lastIndex, matchIndex));
    }

    // Add the link as a clickable anchor
    elements.push(
      <a
        key={matchIndex}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        {linkText}
      </a>
    );

    lastIndex = matchIndex + fullMatch.length;
  }

  // Add any remaining text after the last link
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  // If no links were found, return the original text
  return elements.length > 0 ? elements : [text];
}

