import { useParams, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import SupportLayout from '@/components/support/SupportLayout';
import SupportBreadcrumb from '@/components/support/SupportBreadcrumb';
import ArticleList from '@/components/support/ArticleList';
import { useSupportCollections } from '@/hooks/useSupportData';
import { loadArticle } from '@/lib/support';

export default function SupportCollection() {
  const { collectionSlug = '' } = useParams<{ collectionSlug: string }>();
  const { collections, loading: collectionsLoading } = useSupportCollections();
  const [articleTitles, setArticleTitles] = useState<Record<string, string>>({});

  const collection = collections.find(c => c.slug === collectionSlug);

  useEffect(() => {
    if (!collection) return;

    const allSlugs = [
      ...collection.articles,
      ...(collection.subCollections?.flatMap(sub => sub.articles) || []),
    ];

    const loadTitles = async () => {
      const titles: Record<string, string> = {};
      await Promise.all(
        allSlugs.map(async (slug) => {
          const article = await loadArticle(collectionSlug, slug);
          if (article) titles[slug] = article.title;
        })
      );
      setArticleTitles(titles);
    };
    loadTitles();
  }, [collection, collectionSlug]);

  if (collectionsLoading) {
    return (
      <SupportLayout canonicalPath={`/support/${collectionSlug}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          ))}
        </div>
      </SupportLayout>
    );
  }

  if (!collection) {
    return <Navigate to="/support" replace />;
  }

  const topArticles = collection.articles.map(slug => ({
    slug,
    title: articleTitles[slug] || slug.replace(/-/g, ' '),
  }));

  return (
    <SupportLayout
      title={collection.title}
      description={collection.description}
      canonicalPath={`/support/${collectionSlug}`}
    >
      <SupportBreadcrumb items={[{ label: collection.title }]} />

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {collection.title}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">{collection.description}</p>
      </div>

      {topArticles.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 mb-6">
          <ArticleList articles={topArticles} collectionSlug={collectionSlug} />
        </div>
      )}

      {collection.subCollections?.map(sub => {
        const subArticles = sub.articles.map(slug => ({
          slug,
          title: articleTitles[slug] || slug.replace(/-/g, ' '),
        }));

        return (
          <div key={sub.slug} className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {sub.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{sub.description}</p>
            <ArticleList articles={subArticles} collectionSlug={collectionSlug} />
          </div>
        );
      })}
    </SupportLayout>
  );
}
