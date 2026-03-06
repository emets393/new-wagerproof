import { Link } from 'react-router-dom';
import { FileText, ChevronRight } from 'lucide-react';

interface ArticleListProps {
  articles: { slug: string; title: string }[];
  collectionSlug: string;
}

export default function ArticleList({ articles, collectionSlug }: ArticleListProps) {
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
      {articles.map((article) => (
        <li key={article.slug}>
          <Link
            to={`/support/${collectionSlug}/${article.slug}`}
            className="flex items-center justify-between py-3.5 group hover:bg-emerald-50/50 dark:hover:bg-gray-800/50 rounded-lg transition-colors -mx-1 px-3"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span className="text-gray-700 dark:text-gray-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {article.title}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
