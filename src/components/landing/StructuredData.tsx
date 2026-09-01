import React from 'react';
import { Helmet } from 'react-helmet-async';

interface OrganizationDataProps {
  type: 'organization';
}

interface ArticleDataProps {
  type: 'article';
  title: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  authorName: string;
  url: string;
}

interface WebsiteDataProps {
  type: 'website';
}

interface WebPageDataProps {
  type: 'webpage';
  title: string;
  description: string;
  url: string;
}

interface BreadcrumbDataProps {
  type: 'breadcrumb';
  items: Array<{ name: string; url: string }>;
}

interface FAQDataProps {
  type: 'faq';
  questions: Array<{ question: string; answer: string }>;
}

interface SiteNavigationDataProps {
  type: 'sitenavigation';
}

type StructuredDataProps =
  | OrganizationDataProps
  | ArticleDataProps
  | WebsiteDataProps
  | WebPageDataProps
  | BreadcrumbDataProps
  | FAQDataProps
  | SiteNavigationDataProps;

export const StructuredData: React.FC<StructuredDataProps> = (props) => {
  const getStructuredData = () => {
    const baseUrl = 'https://wagerproof.bet';

    if (props.type === 'organization') {
      return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'WagerProof',
        description: 'Data-driven sports betting analytics and predictions platform',
        url: baseUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/wagerproofGreenLight.png`,
          width: 1024,
          height: 1024,
        },
        foundingDate: '2024',
        founders: [
          {
            '@type': 'Person',
            name: 'WagerProof Team',
          },
        ],
        sameAs: [
          'https://twitter.com/wagerproofai',
          'https://www.instagram.com/wagerproof.official/',
          'https://www.tiktok.com/@wagerproof',
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'support@wagerproof.bet',
          contactType: 'Customer Service',
          availableLanguage: 'English',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          reviewCount: '127',
        },
      };
    }

    if (props.type === 'website') {
      return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'WagerProof',
        description: 'Professional sports betting analytics powered by real data',
        url: baseUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${baseUrl}/blog?search={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      };
    }

    if (props.type === 'webpage') {
      return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: props.title,
        description: props.description,
        url: props.url,
        publisher: {
          '@type': 'Organization',
          name: 'WagerProof',
          logo: {
            '@type': 'ImageObject',
            url: `${baseUrl}/wagerproofGreenLight.png`,
          },
        },
        inLanguage: 'en-US',
      };
    }

    if (props.type === 'breadcrumb') {
      return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: props.items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      };
    }

    if (props.type === 'faq') {
      return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: props.questions.map((q) => ({
          '@type': 'Question',
          name: q.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: q.answer,
          },
        })),
      };
    }

    if (props.type === 'sitenavigation') {
      return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: [
          {
            '@type': 'SiteNavigationElement',
            position: 1,
            name: 'NBA Predictions',
            description: 'Data-driven NBA game predictions with spread, moneyline, and totals analysis.',
            url: `${baseUrl}/nba`,
          },
          {
            '@type': 'SiteNavigationElement',
            position: 2,
            name: 'NFL Predictions',
            description: 'Machine learning NFL predictions with EPA-based models and weather data.',
            url: `${baseUrl}/nfl`,
          },
          {
            '@type': 'SiteNavigationElement',
            position: 3,
            name: 'AI Agents',
            description: 'Create personalized AI betting agents with customizable strategies.',
            url: `${baseUrl}/ai-agents`,
          },
          {
            '@type': 'SiteNavigationElement',
            position: 4,
            name: 'Blog',
            description: 'Sports betting insights, strategy guides, and analytics breakdowns.',
            url: `${baseUrl}/blog`,
          },
          {
            '@type': 'SiteNavigationElement',
            position: 5,
            name: 'Support',
            description: 'Get help with WagerProof predictions, AI Agents, and account management.',
            url: `${baseUrl}/support`,
          },
          {
            '@type': 'SiteNavigationElement',
            position: 6,
            name: 'Free Picks',
            description: 'Free daily sports betting picks powered by WagerProof models.',
            url: `${baseUrl}/free-picks`,
          },
        ],
      };
    }

    if (props.type === 'article') {
      // Use array format for images (Google prefers this)
      const imageArray = Array.isArray(props.image) 
        ? props.image 
        : (props.image ? [props.image] : [`${baseUrl}/wagerproofGreenLight.png`]);
      
      return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: props.title,
        description: props.description,
        image: imageArray,
        datePublished: props.datePublished,
        dateModified: props.dateModified || props.datePublished,
        author: {
          '@type': 'Person',
          name: props.authorName || 'WagerProof Team',
        },
        publisher: {
          '@type': 'Organization',
          name: 'WagerProof',
          logo: {
            '@type': 'ImageObject',
            url: `${baseUrl}/wagerproofGreenLight.png`,
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': props.url,
        },
      };
    }

    return null;
  };

  const structuredData = getStructuredData();

  if (!structuredData) return null;

  return (
    <Helmet>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 0) }} />
    </Helmet>
  );
};
