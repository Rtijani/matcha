import { describe, expect, it } from "vitest";
import { validatePasswordStrength } from "./password.service.js";

describe("validatePasswordStrength", () => {
  it("rejects a common weak password", () => {
    const result = validatePasswordStrength(
      "password123",
      [],
    );

    expect(result).toBeTypeOf("string");
    expect(result?.length).toBeGreaterThan(0);
  });

  it("accepts a strong uncommon password", () => {
    const result = validatePasswordStrength(
      "vB7!qZ2@Lm9#Rx4$Np8",
      [],
    );

    expect(result).toBeNull();
  });

  it("uses personal information when checking passwords", () => {
    const result = validatePasswordStrength(
      "RebeccaRebecca123",
      [
        "rebecca",
        "rebecca@example.com",
      ],
    );

    expect(result).toBeTypeOf("string");
  });
});
