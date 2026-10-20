import { describe, expect, it } from "vitest";
import { parseYouTubeInput } from "./youtubeSource";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeInput", () => {
  it.each([
    ID,
    `  ${ID}  `,
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s&list=PL123`,
    `youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}&si=abc`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?t=10`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
  ])("finds the video id in %s", (input) => {
    expect(parseYouTubeInput(input)).toBe(ID);
  });

  it.each([
    "",
    "not a video",
    "dQw4w9WgXc",
    "https://www.youtube.com/",
    "https://www.youtube.com/watch?list=PL123",
    "https://www.youtube.com/@somechannel",
    `https://vimeo.com/${ID}`,
    `https://example.com/watch?v=${ID}`,
  ])("rejects %j", (input) => {
    expect(parseYouTubeInput(input)).toBeUndefined();
  });
});
