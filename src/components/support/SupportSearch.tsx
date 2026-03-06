import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useSupportSearch } from '@/hooks/useSupportSearch';

export default function SupportSearch() {
  const { query, search, results } = useSupportSearch();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            search(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query && setIsOpen(true)}
          placeholder="Search for help..."
          className="w-full py-3.5 pl-12 pr-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent shadow-sm transition-shadow focus:shadow-md"
        />
      </div>

      {isOpen && query && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
          {results.length > 0 ? (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {results.map((r) => (
                <li key={`${r.collectionSlug}-${r.slug}`}>
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-emerald-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => {
                      navigate(`/support/${r.collectionSlug}/${r.slug}`);
                      setIsOpen(false);
                      search('');
                    }}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.collection}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No results found</p>
          )}
        </div>
      )}
    </div>
  );
}
