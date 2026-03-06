import { useParams, Navigate, Link } from 'react-router-dom';
import SupportLayout from '@/components/support/SupportLayout';
import SupportBreadcrumb from '@/components/support/SupportBreadcrumb';
import ArticleRenderer from '@/components/support/ArticleRenderer';
import ArticleFeedback from '@/components/support/ArticleFeedback';
import { useSupportArticle, useSupportCollections } from '@/hooks/useSupportData';
import { findArticleCollection } from '@/lib/support';

export default function SupportArticle() {
  const { collectionSlug = '', articleSlug = '' } = useParams<{
    collectionSlug: string;
    articleSlug: string;
  }>();

  const { article, loading, error } = useSupportArticle(collectionSlug, articleSlug);
  const { collections } = useSupportCollections();
  const collection = collections.find(c => c.slug === collectionSlug);

  if (loading) {
    return (
      <SupportLayout canonicalPath={`/support/${collectionSlug}/${articleSlug}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-8 w-96 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="space-y-3 mt-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: `${80 - i * 10}%` }} />
            ))}
          </div>
        </div>
      </SupportLayout>
    );
  }

  if (error || !article) {
    return <Navigate to={`/support/${collectionSlug}`} replace />;
  }

  const breadcrumbItems = [
    { label: collection?.title || collectionSlug, href: `/support/${collectionSlug}` },
    { label: article.title },
  ];

  return (
    <SupportLayout
      title={article.title}
      description={article.description}
      canonicalPath={`/support/${collectionSlug}/${articleSlug}`}
    >
      <SupportBreadcrumb items={breadcrumbItems} />

      <article className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 sm:p-8">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {article.title}
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Last updated: {new Date(article.lastUpdated).toLocaleDateString('en', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </header>

        <ArticleRenderer content={article.content} />

        {article.relatedArticles && article.relatedArticles.length > 0 && (
          <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Related Articles
            </h3>
            <ul className="space-y-2">
              {article.relatedArticles.map(slug => {
                const relatedCol = findArticleCollection(collections, slug);
                const colSlug = relatedCol?.slug || collectionSlug;
                return (
                  <li key={slug}>
                    <Link
                      to={`/support/${colSlug}/${slug}`}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline text-sm"
                    >
                      {slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <ArticleFeedback articleSlug={articleSlug} />
      </article>
    </SupportLayout>
  );
}
