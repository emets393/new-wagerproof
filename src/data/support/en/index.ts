import type { SupportCollection, SearchIndexEntry } from '@/types/support';

// Import all article metadata for search index
import whatIsWagerproof from './getting-started/what-is-wagerproof.json';
import freeVsPro from './getting-started/free-vs-pro.json';
import supportedSports from './getting-started/supported-sports.json';
import navigatingTheApp from './getting-started/navigating-the-app.json';

import howPredictionsWork from './predictions-and-models/how-predictions-work.json';
import readingGameCards from './predictions-and-models/reading-game-cards.json';
import bettingTrendsExplained from './predictions-and-models/betting-trends-explained.json';
import liveScoreboard from './predictions-and-models/live-scoreboard.json';

import whatAreAiAgents from './ai-agents/what-are-ai-agents.json';
import creatingAnAgent from './ai-agents/creating-an-agent.json';
import agentPerformanceTracking from './ai-agents/agent-performance-tracking.json';
import agentLeaderboard from './ai-agents/agent-leaderboard.json';
import usingWagerbot from './ai-agents/using-wagerbot.json';

import howToSubscribe from './plans-and-payments/how-to-subscribe.json';
import howToCancel from './plans-and-payments/how-to-cancel.json';
import refundRequest from './plans-and-payments/refund-request.json';
import restorePurchase from './plans-and-payments/restore-purchase.json';

import creatingAnAccount from './your-account/creating-an-account.json';
import forgotPassword from './your-account/forgot-password.json';
import deleteAccount from './your-account/delete-account.json';
import managingNotifications from './your-account/managing-notifications.json';

import contactSupport from './troubleshooting/contact-support.json';
import appNotLoading from './troubleshooting/app-not-loading.json';
import reportABug from './troubleshooting/report-a-bug.json';
import predictionsNotShowing from './troubleshooting/predictions-not-showing.json';

export const collections: SupportCollection[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of WagerProof and how to get set up',
    icon: 'compass',
    order: 1,
    articles: ['what-is-wagerproof', 'free-vs-pro', 'supported-sports', 'navigating-the-app'],
  },
  {
    slug: 'predictions-and-models',
    title: 'Predictions & Models',
    description: 'Understand how our ML models generate predictions and how to read them',
    icon: 'bar-chart-3',
    order: 2,
    articles: ['how-predictions-work', 'reading-game-cards', 'betting-trends-explained', 'live-scoreboard'],
  },
  {
    slug: 'ai-agents',
    title: 'AI Agents & WagerBot',
    description: 'Create personalized virtual picks experts and use our AI assistant',
    icon: 'bot',
    order: 3,
    articles: ['what-are-ai-agents', 'creating-an-agent', 'agent-performance-tracking', 'agent-leaderboard', 'using-wagerbot'],
  },
  {
    slug: 'plans-and-payments',
    title: 'Plans & Payments',
    description: 'Subscriptions, billing, and refund information',
    icon: 'credit-card',
    order: 4,
    articles: ['how-to-subscribe', 'how-to-cancel', 'refund-request', 'restore-purchase'],
  },
  {
    slug: 'your-account',
    title: 'Your Account',
    description: 'Manage your login, password, and profile settings',
    icon: 'user-circle',
    order: 5,
    articles: ['creating-an-account', 'forgot-password', 'delete-account', 'managing-notifications'],
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Quick solutions to common problems',
    icon: 'wrench',
    order: 6,
    articles: ['contact-support', 'app-not-loading', 'report-a-bug', 'predictions-not-showing'],
  },
];

// Article metadata map for search
const articleMap: Record<string, Record<string, { title: string; description: string; keywords: string[] }>> = {
  'getting-started': {
    'what-is-wagerproof': whatIsWagerproof,
    'free-vs-pro': freeVsPro,
    'supported-sports': supportedSports,
    'navigating-the-app': navigatingTheApp,
  },
  'predictions-and-models': {
    'how-predictions-work': howPredictionsWork,
    'reading-game-cards': readingGameCards,
    'betting-trends-explained': bettingTrendsExplained,
    'live-scoreboard': liveScoreboard,
  },
  'ai-agents': {
    'what-are-ai-agents': whatAreAiAgents,
    'creating-an-agent': creatingAnAgent,
    'agent-performance-tracking': agentPerformanceTracking,
    'agent-leaderboard': agentLeaderboard,
    'using-wagerbot': usingWagerbot,
  },
  'plans-and-payments': {
    'how-to-subscribe': howToSubscribe,
    'how-to-cancel': howToCancel,
    'refund-request': refundRequest,
    'restore-purchase': restorePurchase,
  },
  'your-account': {
    'creating-an-account': creatingAnAccount,
    'forgot-password': forgotPassword,
    'delete-account': deleteAccount,
    'managing-notifications': managingNotifications,
  },
  'troubleshooting': {
    'contact-support': contactSupport,
    'app-not-loading': appNotLoading,
    'report-a-bug': reportABug,
    'predictions-not-showing': predictionsNotShowing,
  },
};

// Build search index with real article metadata
export const searchIndex: SearchIndexEntry[] = collections.flatMap(col => {
  return col.articles.map(slug => {
    const meta = articleMap[col.slug]?.[slug];
    return {
      slug,
      title: meta?.title || slug.replace(/-/g, ' '),
      description: meta?.description || '',
      keywords: meta?.keywords || [],
      collection: col.title,
      collectionSlug: col.slug,
    };
  });
});
