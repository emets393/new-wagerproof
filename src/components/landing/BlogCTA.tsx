import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * BlogCTA - Call to Action component for blog posts
 * 
 * This component's markup must match the static HTML in scripts/build-blog.mjs
 * to ensure proper hydration and avoid layout shifts.
 */
export const BlogCTA = () => {
  return (
    <section className="mt-12 py-12 px-8 bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 dark:from-green-950 dark:via-emerald-950 dark:to-green-900 rounded-2xl text-center">
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-green-800 dark:text-green-200 mb-4">
          Ready to bet smarter?
        </h2>
        <p className="text-green-700 dark:text-green-300 text-lg leading-relaxed mb-6">
          WagerProof uses real data and advanced analytics to help you make informed betting decisions. 
          Get access to professional-grade predictions for NFL, College Football, and more.
        </p>
        <Link 
          to="/wagerbot-chat"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold text-lg rounded-full transition-all duration-200 shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-0.5"
        >
          Get Started Free
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </section>
  );
};

export default BlogCTA;

