import { describe, expect, it } from "vitest";
import { renderGuideTool, renderParlayCalculator, renderVideo, validateTool, validateVideo, videoSchema, formatIsoDuration } from "../../scripts/lib/guide-embeds.mjs";

// Temporary fixture: the real parlay-calculator guide ships without a video.
const fixtureVideo = {
  youtubeId: "dQw4w9WgXcQ",
  title: "How to calculate parlay odds",
  description: "A three-leg parlay worked by hand.",
  uploadDate: "2026-10-01",
  duration: "PT4M12S",
  thumbnail: "/guides/parlay-calculator/parlay-calculator-video-v1.webp",
};
const guide = (video?: Record<string, unknown>) => ({ slug: "fixture", tool: "parlay-calculator", ...(video ? { video } : {}) });

describe("guide video embeds", () => {
  it("renders a click-to-load facade with no iframe", () => {
    const html = renderVideo(guide(fixtureVideo));
    expect(html).toContain('data-youtube-embed data-youtube-id="dQw4w9WgXcQ"');
    expect(html).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
    expect(html).toContain('src="/guides/parlay-calculator/parlay-calculator-video-v1.webp"');
    expect(html).toContain("4:12");
    expect(html).not.toMatch(/<iframe/i);
    expect(html).not.toMatch(/\son\w+=/i);
  });

  it("emits VideoObject only once a youtubeId exists", () => {
    expect(videoSchema(guide(fixtureVideo), "https://wagerproof.bet")).toEqual({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: fixtureVideo.title,
      description: fixtureVideo.description,
      thumbnailUrl: ["https://wagerproof.bet/guides/parlay-calculator/parlay-calculator-video-v1.webp"],
      uploadDate: "2026-10-01",
      duration: "PT4M12S",
      contentUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
    const pending = guide({ ...fixtureVideo, youtubeId: "" });
    expect(videoSchema(pending, "https://wagerproof.bet")).toBeNull();
    expect(renderVideo(pending)).toBe("");
    expect(renderVideo(guide())).toBe("");
  });

  it("validates the video field", () => {
    expect(() => validateVideo(guide(fixtureVideo), "fixture")).not.toThrow();
    expect(() => validateVideo(guide({ ...fixtureVideo, youtubeId: undefined }), "fixture")).not.toThrow();
    expect(() => validateVideo(guide({ ...fixtureVideo, youtubeId: "short" }), "fixture")).toThrow(/youtubeId/);
    expect(() => validateVideo(guide({ ...fixtureVideo, duration: "4:12" }), "fixture")).toThrow(/ISO 8601/);
    expect(() => validateVideo(guide({ ...fixtureVideo, thumbnail: "https://i.ytimg.com/vi/x/hq.jpg" }), "fixture")).toThrow(/thumbnail/);
    expect(() => validateVideo(guide({ ...fixtureVideo, uploadDate: "Oct 1" }), "fixture")).toThrow(/uploadDate/);
    expect(formatIsoDuration("PT1H2M3S")).toBe("1:02:03");
  });
});

describe("guide tools", () => {
  it("validates the tool name", () => {
    expect(() => validateTool({ tool: "parlay-calculator" }, "fixture")).not.toThrow();
    expect(() => validateTool({}, "fixture")).not.toThrow();
    expect(() => validateTool({ tool: "kelly" }, "fixture")).toThrow(/unsupported tool/);
  });

  it("server-renders the default parlay result for no-JS readers", () => {
    const html = renderParlayCalculator();
    expect(renderGuideTool(guide())).toBe(html);
    expect(html).toContain('<form class="parlay-calc" data-parlay-calculator');
    expect(html).toContain('data-pc-out="payout">$91.12<');
    expect(html).toContain('data-pc-out="profit">$81.12<');
    expect(html).toContain('data-pc-out="american">+811<');
    expect(html).toContain('data-pc-out="decimal">9.1116<');
    expect(html.match(/data-pc-leg>/g)).toHaveLength(3);
    for (const id of ["pc-format", "pc-stake", "pc-odds-1", "pc-opposite-3"]) expect(html).toContain(`<label for="${id}"`);
    expect(html).not.toMatch(/<script|\son\w+=|<iframe/i);
  });
});
