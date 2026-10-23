import { describe, expect, it } from "vitest";
import { canonicalUrl, looksLikeMediaUrl, youtubeVideoId } from "./import-recipe.functions";

describe("youtubeVideoId", () => {
  it("reads every shape a reader can paste", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=CBENb12EqZ0")).toBe("CBENb12EqZ0");
    expect(youtubeVideoId("https://youtu.be/CBENb12EqZ0?si=abc")).toBe("CBENb12EqZ0");
    expect(youtubeVideoId("https://www.youtube.com/shorts/97PgtRikVLY")).toBe("97PgtRikVLY");
    expect(youtubeVideoId("https://m.youtube.com/watch?v=97PgtRikVLY&t=30s")).toBe("97PgtRikVLY");
  });

  it("returns nothing for a link that names no video", () => {
    expect(youtubeVideoId("https://www.youtube.com/@devinahermawan")).toBe("");
    expect(youtubeVideoId("not a url")).toBe("");
  });
});

describe("looksLikeMediaUrl", () => {
  it("accepts a CDN file and rejects a platform page", () => {
    expect(looksLikeMediaUrl("https://v16-webapp-prime.tiktok.com/video/tos/alisg/abc/?a=1")).toBe(
      true,
    );
    expect(looksLikeMediaUrl("https://www.youtube.com/embed/97PgtRikVLY")).toBe(false);
    expect(looksLikeMediaUrl("https://www.tiktok.com/@a/video/123")).toBe(false);
  });
});

describe("canonicalUrl", () => {
  it("strips query and fragment and keeps the video id", () => {
    expect(
      canonicalUrl(
        "https://www.tiktok.com/@heresyourbite/video/7682522917971758350?q=resep&t=1790187818214#x",
      ).url,
    ).toBe("https://www.tiktok.com/@heresyourbite/video/7682522917971758350");
    expect(canonicalUrl("https://youtu.be/CBENb12EqZ0?si=abc").url).toBe(
      "https://www.youtube.com/watch?v=CBENb12EqZ0",
    );
    expect(canonicalUrl("https://www.instagram.com/reels/DIJaSVKSaaT/?igsh=1").url).toBe(
      "https://www.instagram.com/reel/DIJaSVKSaaT/",
    );
  });
});
