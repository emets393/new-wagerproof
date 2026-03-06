import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface SupportBreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function SupportBreadcrumb({ items }: SupportBreadcrumbProps) {
  const allItems: BreadcrumbItem[] = [
    { label: 'Support Center', href: '/support' },
    ...items,
  ];

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        {allItems.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            {item.href && i < allItems.length - 1 ? (
              <Link
                to={item.href}
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-700 dark:text-gray-200 font-medium">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
