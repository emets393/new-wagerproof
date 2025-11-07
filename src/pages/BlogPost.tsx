import { useParams, Link } from 'react-router-dom';
import { useBlogPost } from '@/hooks/useBlogPosts';
import { SEO } from '@/components/landing/SEO';
import { StructuredData } from '@/components/landing/StructuredData';
import { useEffect } from 'react';

export const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { post, loading, error } = useBlogPost(slug || '');

  // Scroll to top when post loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Post Not Found</h1>
            <p className="text-destructive mb-4">
              {error || 'The blog post you are looking for does not exist.'}
            </p>
            <Link 
              to="/blog" 
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              ← Back to Blog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const canonicalUrl = `https://wagerproof.bet/blog/${post.slug}`;
  const authorName = post.authors && post.authors.length > 0 ? post.authors[0].name : 'WagerProof Team';
  const description = post.meta_description || post.excerpt || '';
  const ogImage = post.og_image || post.feature_image || undefined;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={post.og_title || post.title}
        description={description}
        canonical={canonicalUrl}
        ogImage={ogImage}
        ogType="article"
        article={{
          publishedTime: post.published_at,
          modifiedTime: post.updated_at || post.published_at,
          author: authorName,
          tags: post.tags?.map(tag => tag.name),
        }}
      />
      <StructuredData
        type="article"
        title={post.title}
        description={description}
        image={ogImage}
        datePublished={post.published_at}
        dateModified={post.updated_at || post.published_at}
        authorName={authorName}
        url={canonicalUrl}
      />

      <article className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Back to Blog */}
        <Link 
          to="/blog" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 19l-7-7 7-7" 
            />
          </svg>
          Back to Blog
        </Link>

        {/* Featured Image */}
        {post.feature_image && (
          <div className="aspect-video w-full overflow-hidden rounded-lg mb-8">
            <img
              src={post.feature_image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Header */}
        <header className="mb-8">
          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag) => (
                <span
                  key={tag.slug}
                  className="inline-block px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{post.title}</h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {post.authors && post.authors.length > 0 && (
              <>
                <span className="font-medium">By {post.authors[0].name}</span>
                <span>•</span>
              </>
            )}
            <time dateTime={post.published_at}>
              {new Date(post.published_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            {post.reading_time > 0 && (
              <>
                <span>•</span>
                <span>{post.reading_time} min read</span>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <article 
          id="post-content"
          className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-border">
          <div className="flex items-center justify-between">
            <Link 
              to="/blog" 
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M15 19l-7-7 7-7" 
                />
              </svg>
              Back to Blog
            </Link>

            {/* Share buttons could go here */}
          </div>
        </footer>
      </article>
    </div>
  );
};

