import type { PoolClient } from "pg";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { refreshFameRating } from "./fame-rating.service.js";

describe("refreshFameRating", () => {
  it("returns the updated fame rating", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ fame_rating: 35 }],
    });

    const connection = {
      query,
    } as unknown as PoolClient;

    const result = await refreshFameRating(
      "user-123",
      connection,
    );

    expect(result).toBe(35);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "UPDATE profiles",
      ),
      ["user-123"],
    );
  });

  it("returns zero when the profile is missing", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [],
    });

    const connection = {
      query,
    } as unknown as PoolClient;

    const result = await refreshFameRating(
      "missing-user",
      connection,
    );

    expect(result).toBe(0);
  });

  it("caps the database calculation at 100", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ fame_rating: 100 }],
    });

    const connection = {
      query,
    } as unknown as PoolClient;

    const result = await refreshFameRating(
      "popular-user",
      connection,
    );

    expect(result).toBe(100);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("LEAST"),
      ["popular-user"],
    );
  });
});
