import type { ContentBlock } from '@/types/support';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, Lightbulb } from 'lucide-react';

interface ArticleRendererProps {
  content: ContentBlock[];
}

const calloutConfig = {
  info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-300', iconColor: 'text-blue-500' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-800 dark:text-amber-300', iconColor: 'text-amber-500' },
  tip: { icon: Lightbulb, bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-800 dark:text-green-300', iconColor: 'text-green-500' },
};

export default function ArticleRenderer({ content }: ArticleRendererProps) {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      {content.map((block, i) => {
        switch (block.type) {
          case 'paragraph':
            return (
              <p key={i} className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                {block.text}
              </p>
            );

          case 'heading': {
            const level = block.level || 2;
            const sizes: Record<number, string> = {
              2: 'text-xl font-bold mt-8 mb-3',
              3: 'text-lg font-semibold mt-6 mb-2',
              4: 'text-base font-semibold mt-4 mb-2',
            };
            const className = cn(sizes[level], 'text-gray-900 dark:text-gray-100');
            if (level === 3) return <h3 key={i} className={className}>{block.text}</h3>;
            if (level === 4) return <h4 key={i} className={className}>{block.text}</h4>;
            return <h2 key={i} className={className}>{block.text}</h2>;
          }

          case 'list':
            return block.ordered ? (
              <ol key={i} className="list-decimal list-inside space-y-2 mb-4 text-gray-700 dark:text-gray-300">
                {block.items?.map((item, j) => <li key={j}>{item}</li>)}
              </ol>
            ) : (
              <ul key={i} className="list-disc list-inside space-y-2 mb-4 text-gray-700 dark:text-gray-300">
                {block.items?.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            );

          case 'callout': {
            const variant = block.variant || 'info';
            const config = calloutConfig[variant];
            const CalloutIcon = config.icon;
            return (
              <div key={i} className={cn('flex gap-3 p-4 rounded-lg border mb-4', config.bg, config.border)}>
                <CalloutIcon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.iconColor)} />
                <p className={cn('text-sm', config.text)}>{block.text}</p>
              </div>
            );
          }

          case 'steps':
            return (
              <div key={i} className="space-y-4 mb-6">
                {block.steps?.map((step, j) => (
                  <div key={j} className="flex gap-4">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      {j + 1}
                    </div>
                    <div className="pt-0.5">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{step.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            );

          case 'image':
            return (
              <figure key={i} className="mb-6">
                <img
                  src={block.src}
                  alt={block.alt || ''}
                  loading="lazy"
                  className="rounded-lg shadow-sm w-full"
                />
                {block.alt && (
                  <figcaption className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                    {block.alt}
                  </figcaption>
                )}
              </figure>
            );

          case 'divider':
            return <hr key={i} className="my-8 border-gray-200 dark:border-gray-700" />;

          case 'video':
            return (
              <div key={i} className="mb-6 aspect-video rounded-lg overflow-hidden">
                <iframe
                  src={block.url}
                  className="w-full h-full"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            );

          case 'code':
            return (
              <pre key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4 overflow-x-auto">
                <code className="text-sm text-gray-800 dark:text-gray-200">{block.code}</code>
              </pre>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
