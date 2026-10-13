import { describe, expect, it } from "vitest";

import { HQ, HUBS } from "./home-data";
import { isLand } from "./world-land";

/** The export map's land mask puts the coasts that matter to this map where they are. */
describe("isLand", () => {
  it("knows land", () => {
    for (const [name, lon, lat] of [
      ["Tehran", 51.4, 35.7],
      ["Sahara", 10, 23],
      ["Italy", 12.5, 42],
      ["Spain", -4, 40],
      ["Arabian Peninsula", 45, 23],
      ["Madagascar", 47, -19],
      ["Greenland", -40, 72],
      ["Japan", 138, 36],
    ] as const)
      expect(isLand(lon, lat), name).toBe(true);
  });

  it("knows sea", () => {
    for (const [name, lon, lat] of [
      ["Mid-Atlantic", -30, 20],
      ["Mediterranean", 18, 34],
      ["Arabian Sea", 64, 15],
      ["Bay of Bengal", 88, 15],
      ["Central Pacific", -150, 0],
      ["Caspian Sea", 51, 41.5],
    ] as const)
      expect(isLand(lon, lat), name).toBe(false);
  });

  it("puts the head office and every destination on or beside land", () => {
    const nearLand = (lon: number, lat: number): boolean =>
      [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => isLand(lon + dx, lat + dy)));
    expect(nearLand(HQ.lon, HQ.lat)).toBe(true);
    for (const hub of HUBS) expect(nearLand(hub.lon, hub.lat), hub.n).toBe(true);
  });

  it("treats everything outside the map's frame as sea", () => {
    expect(isLand(0, 85)).toBe(false);
    expect(isLand(0, -70)).toBe(false);
    expect(isLand(200, 0)).toBe(false);
  });
});
