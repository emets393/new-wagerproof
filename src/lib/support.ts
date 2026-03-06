import type { SupportArticle, SupportCollection, SearchIndexEntry } from '@/types/support';

export function loadCollections(): SupportCollection[] {
  // Sync import since we only have English
  return collections;
}

export async function loadCollectionsAsync(): Promise<SupportCollection[]> {
  const mod = await import('../data/support/en/index.ts');
  return mod.collections;
}

export async function loadSearchIndex(): Promise<SearchIndexEntry[]> {
  const mod = await import('../data/support/en/index.ts');
  return mod.searchIndex;
}

export async function loadArticle(collectionSlug: string, articleSlug: string): Promise<SupportArticle | null> {
  try {
    const mod = await import(`../data/support/en/${collectionSlug}/${articleSlug}.json`);
    return mod.default || mod;
  } catch {
    return null;
  }
}

export function findArticleCollection(collections: SupportCollection[], articleSlug: string): SupportCollection | null {
  for (const col of collections) {
    if (col.articles.includes(articleSlug)) return col;
    if (col.subCollections) {
      for (const sub of col.subCollections) {
        if (sub.articles.includes(articleSlug)) return col;
      }
    }
  }
  return null;
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Re-export collections for sync access
import { collections } from '../data/support/en/index';
