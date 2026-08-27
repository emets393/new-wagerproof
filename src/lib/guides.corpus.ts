import type { GuideLayout, GuideMetadata, GuideRegistry } from "./guides";
import registry from "../../content/guides/registry.json";
import accurateTracking from "../../content/guides/accurate-betting-performance-tracking-checklist/guide.json";
import bestApps from "../../content/guides/best-sports-betting-research-apps/guide.json";
import closingLineValue from "../../content/guides/closing-line-value-sports-betting/guide.json";
import lineMovement from "../../content/guides/how-to-read-line-movement/guide.json";
import analysisMethod from "../../content/guides/how-wagerproof-analysis-works/guide.json";
import impliedProbability from "../../content/guides/implied-probability-vs-true-probability/guide.json";
import playerProps from "../../content/guides/player-prop-research-guide/guide.json";
import predictionMarkets from "../../content/guides/prediction-markets-vs-sportsbook-odds/guide.json";
import responsibleResearch from "../../content/guides/responsible-sports-betting-research/guide.json";
import release359 from "../../content/guides/wagerproof-3-5-9/guide.json";

type ImportedRegistry = Omit<GuideRegistry, "version"> & { version: number };
type ImportedGuide = Omit<GuideMetadata, "layout" | "author" | "relatedSlugs"> & {
  layout: string;
  author: string;
  relatedSlugs: string[];
};

const importedRegistry: ImportedRegistry = registry;
const importedGuides: ImportedGuide[] = [
  accurateTracking,
  bestApps,
  closingLineValue,
  lineMovement,
  analysisMethod,
  impliedProbability,
  playerProps,
  predictionMarkets,
  responsibleResearch,
  release359,
];

function isGuideLayout(value: string): value is GuideLayout {
  return value === "standard" || value === "feature" || value === "release";
}

if (importedRegistry.version !== 1) {
  throw new Error(`Unsupported guide registry version ${importedRegistry.version}`);
}

export const GUIDE_REGISTRY: GuideRegistry = {
  ...importedRegistry,
  version: 1,
};

export const GUIDE_CORPUS: GuideMetadata[] = importedGuides.map((guide) => {
  if (!isGuideLayout(guide.layout)) {
    throw new Error(`Unsupported guide layout ${guide.layout}`);
  }
  if (guide.author !== "chris-habib") {
    throw new Error(`Unsupported guide author ${guide.author}`);
  }
  if (guide.relatedSlugs.length !== 4) {
    throw new Error(`${guide.slug} must define exactly four related guides`);
  }
  const relatedSlugs: [string, string, string, string] = [
    guide.relatedSlugs[0],
    guide.relatedSlugs[1],
    guide.relatedSlugs[2],
    guide.relatedSlugs[3],
  ];
  return { ...guide, layout: guide.layout, author: guide.author, relatedSlugs };
});
