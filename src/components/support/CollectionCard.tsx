import { Link } from 'react-router-dom';
import { ChevronRight, Compass, BarChart3, Bot, CreditCard, UserCircle, Wrench } from 'lucide-react';
import type { SupportCollection } from '@/types/support';

const iconMap: Record<string, React.ElementType> = {
  compass: Compass,
  'bar-chart-3': BarChart3,
  bot: Bot,
  'credit-card': CreditCard,
  'user-circle': UserCircle,
  wrench: Wrench,
};

interface CollectionCardProps {
  collection: SupportCollection;
}

export default function CollectionCard({ collection }: CollectionCardProps) {
  const Icon = iconMap[collection.icon] || Compass;

  const totalArticles = collection.articles.length +
    (collection.subCollections?.reduce((acc, sub) => acc + sub.articles.length, 0) || 0);

  return (
    <Link
      to={`/support/${collection.slug}`}
      className="group block p-6 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl hover:border-emerald-300 dark:hover:border-emerald-600/50 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {collection.title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{collection.description}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {totalArticles} articles
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-300 dark:text-gray-600 group-hover:text-emerald-500 transition-colors flex-shrink-0 mt-1" />
      </div>
    </Link>
  );
}
