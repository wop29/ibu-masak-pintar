import { describe, expect, it } from "vitest";
import { youtubeVideoId } from "./import-recipe.functions";

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
