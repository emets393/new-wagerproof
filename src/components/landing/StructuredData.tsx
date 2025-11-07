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

type StructuredDataProps = 
  | OrganizationDataProps 
  | ArticleDataProps 
  | WebsiteDataProps 
  | WebPageDataProps 
  | BreadcrumbDataProps 
  | FAQDataProps;

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
          'https://twitter.com/wagerproof',
          'https://instagram.com/wagerproof',
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
