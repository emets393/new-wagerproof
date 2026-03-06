import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface ArticleFeedbackProps {
  articleSlug: string;
}

export default function ArticleFeedback({ articleSlug }: ArticleFeedbackProps) {
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null);

  const storageKey = `support-feedback-${articleSlug}`;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'yes' || stored === 'no') setFeedback(stored);
  }, [storageKey]);

  const handleFeedback = (value: 'yes' | 'no') => {
    setFeedback(value);
    localStorage.setItem(storageKey, value);
  };

  if (feedback) {
    return (
      <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Thanks for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Was this article helpful?</p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => handleFeedback('yes')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:border-green-300 hover:text-green-600 dark:hover:border-green-700 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
        >
          <ThumbsUp className="h-4 w-4" />
          Yes
        </button>
        <button
          onClick={() => handleFeedback('no')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:border-red-300 hover:text-red-600 dark:hover:border-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        >
          <ThumbsDown className="h-4 w-4" />
          No
        </button>
      </div>
    </div>
  );
}
