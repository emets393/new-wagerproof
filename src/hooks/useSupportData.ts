import { useState, useEffect } from 'react';
import type { SupportCollection, SupportArticle } from '@/types/support';
import { loadCollectionsAsync, loadArticle } from '@/lib/support';

export function useSupportCollections() {
  const [collections, setCollections] = useState<SupportCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadCollectionsAsync()
      .then(cols => {
        if (!cancelled) setCollections(cols);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { collections, loading, error };
}

export function useSupportArticle(collectionSlug: string, articleSlug: string) {
  const [article, setArticle] = useState<SupportArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadArticle(collectionSlug, articleSlug)
      .then(art => {
        if (!cancelled) {
          if (!art) setError('Article not found');
          else setArticle(art);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [collectionSlug, articleSlug]);

  return { article, loading, error };
}
