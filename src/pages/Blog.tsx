import { useBlogPosts } from '@/hooks/useBlogPosts';
import { SEO } from '@/components/landing/SEO';
import { StructuredData } from '@/components/landing/StructuredData';
import { Link } from 'react-router-dom';

export const Blog = () => {
  const { posts, loading, error } = useBlogPosts();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Blog"
        description="Latest sports betting insights, analytics, and strategies from WagerProof"
        canonical="https://wagerproof.bet/blog"
        ogType="website"
      />
      <StructuredData type="organization" />
      
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">WagerProof Blog</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Expert insights on sports betting analytics, strategies, and data-driven predictions
          </p>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
            <p className="text-destructive">Failed to load blog posts. Please try again later.</p>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-xl text-muted-foreground">No blog posts available yet. Check back soon!</p>
          </div>
        )}

        {!loading && !error && posts.length > 0 && (
          <div className="grid gap-8">
            {posts.map((post) => (
              <article 
                key={post.id} 
                className="group border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-card"
              >
                {post.feature_image && (
                  <Link to={`/blog/${post.slug}`}>
                    <div className="aspect-video w-full overflow-hidden">
                      <img
                        src={post.feature_image}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  </Link>
                )}
                
                <div className="p-6">
                  {post.primary_tag && (
                    <span className="inline-block px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full mb-3">
                      {post.primary_tag.name}
                    </span>
                  )}
                  
                  <Link to={`/blog/${post.slug}`}>
                    <h2 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                  </Link>
                  
                  <p className="text-muted-foreground mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      {post.authors && post.authors.length > 0 && (
                        <span>By {post.authors[0].name}</span>
                      )}
                      <span>•</span>
                      <time dateTime={post.published_at}>
                        {new Date(post.published_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                    </div>
                    
                    {post.reading_time > 0 && (
                      <span>{post.reading_time} min read</span>
                    )}
                  </div>
                  
                  <Link 
                    to={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-2 text-primary font-medium mt-4 group-hover:gap-3 transition-all"
                  >
                    Read more
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
                        d="M9 5l7 7-7 7" 
                      />
                    </svg>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

