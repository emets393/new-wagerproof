export type GuideLayout = "standard" | "feature" | "release";

export interface GuideAuthor {
  id: "chris-habib";
  name: string;
  role: string;
  bio: string;
  url: string;
  image: string;
  expertise: string[];
  worksFor: {
    name: "Red Honey";
    url: "https://redhoney.com";
  };
}

export interface GuideHero {
  src: string;
  socialSrc: string;
  width: number;
  height: number;
  socialWidth: number;
  socialHeight: number;
  alt: string;
  caption: string;
  source: string;
}

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface GuideHowToStep {
  name: string;
  text: string;
}

export interface GuideHowTo {
  name: string;
  description: string;
  steps: GuideHowToStep[];
}

export interface RankedApp {
  rank: number;
  name: string;
  categoryLabel: string;
  icon: string;
  officialUrl: string;
  price: string;
  priceAsOf: string;
  priceSourceUrl: string;
  platforms: string;
  review: RankedAppReview;
}

export interface RankedAppReview {
  paragraphs: string[];
  highlights?: string[];
  chooseItFor: string;
  thinkTwiceBecause: string;
}

export interface GuideScreenshot {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

export interface GuideRelease {
  version: string;
  platforms: string[];
  releaseDate: string;
  changes: string[];
  screenshots: GuideScreenshot[];
}

export interface GuideMetadata {
  layout: GuideLayout;
  slug: string;
  canonicalPath: string;
  intent: string;
  title: string;
  shortTitle: string;
  seoTitle: string;
  description: string;
  dek: string;
  category: string;
  publishedAt: string;
  updatedAt: string;
  reviewedAt: string;
  nextReviewAt?: string;
  lastTestedAt?: string;
  readingTimeMinutes: number;
  author: "chris-habib";
  hero: GuideHero;
  disclosure: string;
  verdict: string;
  relatedSlugs: [string, string, string, string];
  redirectAliases: string[];
  featured?: boolean;
  apps?: RankedApp[];
  faqs?: GuideFaq[];
  howTo?: GuideHowTo;
  release?: GuideRelease;
}

export interface GuideRegistryEntry {
  slug: string;
  canonicalPath: string;
  intent: string;
}

export interface GuideRegistry {
  version: 1;
  expectedCount: number;
  entries: GuideRegistryEntry[];
}

export const CHRIS_HABIB: GuideAuthor = {
  id: "chris-habib",
  name: "Chris Habib",
  role: "Founder and product lead at WagerProof",
  bio: "Chris builds WagerProof and writes practical guides about sports research, product methodology, and responsible use of betting data.",
  url: "https://wagerproof.bet/guides/",
  image: "/guides/authors/chris-habib-v1.webp",
  expertise: [
    "Sports analytics product design",
    "Sports research workflows",
    "Probability and odds interpretation",
  ],
  worksFor: {
    name: "Red Honey",
    url: "https://redhoney.com",
  },
};
