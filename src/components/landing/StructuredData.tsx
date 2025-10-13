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

type StructuredDataProps = OrganizationDataProps | ArticleDataProps | WebsiteDataProps;

export const StructuredData: React.FC<StructuredDataProps> = (props) => {
  const getStructuredData = () => {
    const baseUrl = 'https://www.wagerproof.bet';

    if (props.type === 'organization') {
      return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'WagerProof',
        description: 'Data-driven sports betting analytics and predictions platform',
        url: baseUrl,
        logo: `${baseUrl}/wagerproof-landing.png`,
        sameAs: [
          'https://twitter.com/wagerproof',
          'https://instagram.com/wagerproof',
          'https://www.tiktok.com/@wagerproof',
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'support@wagerproof.bet',
          contactType: 'Customer Service',
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

    if (props.type === 'article') {
      return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: props.title,
        description: props.description,
        image: props.image || `${baseUrl}/wagerproof-landing.png`,
        datePublished: props.datePublished,
        dateModified: props.dateModified || props.datePublished,
        author: {
          '@type': 'Person',
          name: props.authorName,
        },
        publisher: {
          '@type': 'Organization',
          name: 'WagerProof',
          logo: {
            '@type': 'ImageObject',
            url: `${baseUrl}/wagerproof-landing.png`,
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
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};
