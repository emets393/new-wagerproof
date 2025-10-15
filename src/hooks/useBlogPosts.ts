import { useState, useEffect } from 'react';

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
    // Ghost API integration disabled - implement when needed
    setLoading(false);
  }, []);

  return { posts, loading, error };
};

export const useBlogPost = (slug: string) => {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ghost API integration disabled - implement when needed
    setLoading(false);
  }, [slug]);

  return { post, loading, error };
};

