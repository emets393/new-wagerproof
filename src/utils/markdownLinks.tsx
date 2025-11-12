import React from 'react';

/**
 * Parses markdown-style links [text](url) and plain URLs, converting them to clickable React elements
 * @param text - The text containing markdown links and/or plain URLs
 * @returns Array of React elements (text nodes and anchor tags)
 */
export function renderTextWithLinks(text: string): React.ReactNode[] {
  if (!text) return [text];

  // First, replace markdown links with a placeholder, then process plain URLs
  // This avoids double-processing URLs that are already in markdown links
  
  const elements: React.ReactNode[] = [];
  const parts: Array<{ type: 'text' | 'markdown' | 'url'; content: string; url?: string; index: number }> = [];
  
  // Step 1: Find and mark markdown links
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  const markdownLinks: Array<{ start: number; end: number; text: string; url: string }> = [];
  
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    markdownLinks.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[1],
      url: match[2],
    });
  }

  // Step 2: Find plain URLs (not inside markdown links)
  const urlRegex = /(https?:\/\/[^\s\)]+|www\.[^\s\)]+)/gi;
  urlRegex.lastIndex = 0;
  const plainUrls: Array<{ start: number; end: number; url: string }> = [];
  
  while ((match = urlRegex.exec(text)) !== null) {
    const urlStart = match.index;
    const urlEnd = urlStart + match[0].length;
    
    // Check if this URL is inside a markdown link
    const isInsideMarkdown = markdownLinks.some(
      md => urlStart >= md.start && urlEnd <= md.end
    );
    
    if (!isInsideMarkdown) {
      plainUrls.push({
        start: urlStart,
        end: urlEnd,
        url: match[0],
      });
    }
  }

  // Step 3: Combine and sort all link positions
  const allLinks = [
    ...markdownLinks.map(md => ({ ...md, type: 'markdown' as const })),
    ...plainUrls.map(url => ({ ...url, type: 'url' as const, text: url.url })),
  ].sort((a, b) => a.start - b.start);

  // Step 4: Build the elements array
  let lastIndex = 0;
  let keyCounter = 0;

  for (const link of allLinks) {
    // Add text before this link
    if (link.start > lastIndex) {
      elements.push(text.substring(lastIndex, link.start));
    }

    // Add the link
    if (link.type === 'markdown') {
      elements.push(
        <a
          key={`link-${keyCounter++}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {link.text}
        </a>
      );
    } else {
      const href = link.url.startsWith('http') ? link.url : `https://${link.url}`;
      elements.push(
        <a
          key={`link-${keyCounter++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {link.url}
        </a>
      );
    }

    lastIndex = link.end;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements.length > 0 ? elements : [text];
}

