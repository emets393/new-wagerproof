import { useBlogPosts } from '@/hooks/useBlogPosts';
import { SEO } from '@/components/landing/SEO';
import { StructuredData } from '@/components/landing/StructuredData';
import { Link } from 'react-router-dom';
import LandingNavBar from '@/components/landing/LandingNavBar';
import Footer from '@/components/landing/Footer';

export const Blog = () => {
  const { posts, loading, error } = useBlogPosts();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SEO
        title="Blog"
        description="Latest sports betting insights, analytics, and strategies from WagerProof"
        canonical="https://wagerproof.bet/blog"
        ogType="website"
      />
      <StructuredData type="organization" />
      
      {/* Navigation */}
      <LandingNavBar />
      
      {/* Main Content - with padding for fixed navbar */}
      <div className="pt-20">
        <div className="container mx-auto px-4 py-12 max-w-6xl">
          {/* Header */}
          <header className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              WagerProof Blog
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Expert insights on sports betting analytics, strategies, and data-driven predictions
            </p>
          </header>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
              <p className="text-destructive">Failed to load blog posts. Please try again later.</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && posts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-xl text-muted-foreground">No blog posts available yet. Check back soon!</p>
            </div>
          )}

          {/* Blog Grid */}
          {!loading && !error && posts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <article 
                  key={post.id} 
                  className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex flex-col"
                >
                  {/* Image */}
                  {post.feature_image && (
                    <Link to={`/blog/${post.slug}`} className="block aspect-video w-full overflow-hidden">
                      <img
                        src={post.feature_image}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </Link>
                  )}
                  
                  {/* Content */}
                  <div className="p-5 flex-1 flex flex-col">
                    {/* Tag */}
                    {post.primary_tag && (
                      <span className="inline-block w-fit px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full mb-3">
                        {post.primary_tag.name}
                      </span>
                    )}
                    
                    {/* Title */}
                    <Link to={`/blog/${post.slug}`}>
                      <h2 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2">
                        {post.title}
                      </h2>
                    </Link>
                    
                    {/* Excerpt */}
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-3 flex-1">
                      {post.excerpt}
                    </p>
                    
                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-1">
                        {post.authors && post.authors.length > 0 && (
                          <span className="font-medium">By {post.authors[0].name}</span>
                        )}
                      </div>
                      
                      <time dateTime={post.published_at}>
                        {new Date(post.published_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </time>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};
