import type { PoolClient } from "pg";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { refreshProfileCompletion } from "./profile-completion.service.js";

describe("refreshProfileCompletion", () => {
  it("marks a complete profile as complete", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ is_complete: true }],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    const connection = {
      query,
    } as unknown as PoolClient;

    const result = await refreshProfileCompletion(
      "user-123",
      connection,
    );

    expect(result).toBe(true);
    expect(query).toHaveBeenCalledTimes(2);

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        "UPDATE users",
      ),
      [true, "user-123"],
    );
  });

  it("marks an incomplete profile as incomplete", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ is_complete: false }],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    const connection = {
      query,
    } as unknown as PoolClient;

    const result = await refreshProfileCompletion(
      "user-456",
      connection,
    );

    expect(result).toBe(false);

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        "UPDATE users",
      ),
      [false, "user-456"],
    );
  });

  it("defaults to incomplete when no row is returned", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    const connection = {
      query,
    } as unknown as PoolClient;

    const result = await refreshProfileCompletion(
      "user-789",
      connection,
    );

    expect(result).toBe(false);
  });
});
