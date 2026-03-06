import SupportLayout from '@/components/support/SupportLayout';
import SupportSearch from '@/components/support/SupportSearch';
import CollectionCard from '@/components/support/CollectionCard';
import { useSupportCollections } from '@/hooks/useSupportData';

export default function SupportCenter() {
  const { collections, loading } = useSupportCollections();

  return (
    <SupportLayout
      title="Support Center"
      description="Get help with WagerProof. Find answers to common questions about predictions, AI Agents, subscriptions, and more."
      canonicalPath="/support"
    >
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          Support Center
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-8">
          How can we help you today?
        </p>
        <SupportSearch />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {collections
            .sort((a, b) => a.order - b.order)
            .map(col => (
              <CollectionCard key={col.slug} collection={col} />
            ))}
        </div>
      )}
    </SupportLayout>
  );
}
