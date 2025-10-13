import { useState, useEffect } from 'react';
import { ghostAPI } from '@/lib/ghost';

export interface BlogPost {
  id: string;
  uuid: string;
  title: string;
  slug: string;
  html: string;
  excerpt: string;
  feature_image: string | null;
  published_at: string;
  reading_time: number;
  tags: Array<{ name: string; slug: string }>;
  primary_tag: { name: string; slug: string } | null;
  authors: Array<{ name: string; slug: string }>;
  meta_description: string | null;
  og_image: string | null;
  og_title: string | null;
  url: string;
}

export const useBlogPosts = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedPosts = await ghostAPI.posts.browse({
          limit: 'all',
          include: ['tags', 'authors'],
          order: 'published_at DESC'
        });
        setPosts(fetchedPosts as BlogPost[]);
      } catch (err) {
        console.error('Error fetching blog posts:', err);
        setError('Failed to load blog posts. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  return { posts, loading, error };
};

export const useBlogPost = (slug: string) => {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) return;
      
      setLoading(true);
      setError(null);
      try {
        const fetchedPost = await ghostAPI.posts.read(
          { slug },
          { include: ['tags', 'authors'] }
        );
        setPost(fetchedPost as BlogPost);
      } catch (err) {
        console.error('Error fetching blog post:', err);
        setError('Failed to load article. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  return { post, loading, error };
};

