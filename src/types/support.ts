export interface ContentBlock {
  type: 'paragraph' | 'heading' | 'image' | 'list' | 'callout' | 'steps' | 'divider' | 'video' | 'code';
  text?: string;
  level?: 2 | 3 | 4;
  src?: string;
  alt?: string;
  ordered?: boolean;
  items?: string[];
  variant?: 'info' | 'warning' | 'tip';
  steps?: { title: string; description: string }[];
  language?: string;
  code?: string;
  url?: string;
}

export interface SupportArticle {
  slug: string;
  title: string;
  description: string;
  lastUpdated: string;
  keywords: string[];
  content: ContentBlock[];
  relatedArticles?: string[];
}

export interface SupportSubCollection {
  slug: string;
  title: string;
  description: string;
  articles: string[];
}

export interface SupportCollection {
  slug: string;
  title: string;
  description: string;
  icon: string;
  order: number;
  articles: string[];
  subCollections?: SupportSubCollection[];
}

export interface SearchIndexEntry {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  collection: string;
  collectionSlug: string;
}
