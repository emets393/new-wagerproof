import { useState, useEffect } from 'react';
import GhostContentAPI from '@tryghost/content-api';

export interface BlogPost {
  id: string;
  uuid: string;
  title: string;
  slug: string;
  html: string;
  excerpt: string;
  feature_image: string | null;
  published_at: string;
  updated_at?: string;
  reading_time: number;
  tags: Array<{ name: string; slug: string }>;
  primary_tag: { name: string; slug: string } | null;
  authors: Array<{ name: string; slug: string }>;
  meta_description: string | null;
  og_image: string | null;
  og_title: string | null;
  url: string;
}

// Initialize Ghost API (only if credentials are available)
let api: GhostContentAPI | null = null;

const GHOST_URL = import.meta.env.VITE_GHOST_URL || '';
const GHOST_CONTENT_KEY = import.meta.env.VITE_GHOST_CONTENT_KEY || '';

if (GHOST_URL && GHOST_CONTENT_KEY) {
  try {
    api = new GhostContentAPI({
      url: GHOST_URL,
      key: GHOST_CONTENT_KEY,
      version: 'v5.0'
    });
  } catch (error) {
    console.error('Failed to initialize Ghost API:', error);
  }
}

export const useBlogPosts = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPosts() {
      if (!api) {
        console.warn('Ghost API not configured');
        setLoading(false);
        return;
      }

      try {
        const result = await api.posts.browse({
          limit: 'all',
          include: ['authors', 'tags'],
          order: 'published_at DESC'
        });
        
        setPosts(result as BlogPost[]);
        setError(null);
      } catch (err) {
        console.error('Error fetching blog posts:', err);
        setError(err instanceof Error ? err.message : 'Failed to load blog posts');
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, []);

  return { posts, loading, error };
};

export const useBlogPost = (slug: string) => {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPost() {
      if (!api) {
        console.warn('Ghost API not configured');
        setLoading(false);
        return;
      }

      if (!slug) {
        setLoading(false);
        return;
      }

      try {
        const result = await api.posts.read(
          { slug },
          { include: ['authors', 'tags'] }
        );
        
        setPost(result as BlogPost);
        setError(null);
      } catch (err) {
        console.error('Error fetching blog post:', err);
        setError(err instanceof Error ? err.message : 'Failed to load blog post');
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [slug]);

  return { post, loading, error };
};

