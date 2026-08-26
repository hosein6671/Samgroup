import { beforeEach, describe, expect, it, vi } from "vitest";

import { submitReviewDecision } from "./decision-actions";

const { decideReviewSubject, revalidatePath } = vi.hoisted(() => ({
  decideReviewSubject: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("./review-api", () => ({ decideReviewSubject }));

const ID = "11111111-1111-4111-8111-111111111111";
const HASH = "a".repeat(64);

function form(decision: string, note = ""): FormData {
  const data = new FormData();
  data.set("subjectType", "specification");
  data.set("id", ID);
  data.set("decision", decision);
  data.set("expectedReviewStatus", "source_recorded");
  data.set("expectedEvidenceSetHash", HASH);
  data.set("note", note);
  return data;
}

beforeEach(() => vi.resetAllMocks());

describe("submitReviewDecision", () => {
  it("passes the rendered status and hash to the server-only API boundary", async () => {
    decideReviewSubject.mockResolvedValue({ state: "ok", value: {} });
    const result = await submitReviewDecision({ status: "idle" }, form("approve"));
    expect(decideReviewSubject).toHaveBeenCalledWith("specification", ID, {
      decision: "approve",
      expectedReviewStatus: "source_recorded",
      expectedEvidenceSetHash: HASH,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/catalog/review/specifications/${ID}`);
    expect(result.status).toBe("saved");
  });

  it.each(["reject", "return_to_needs_review"])(
    "requires a note before posting %s",
    async (decision) => {
      const result = await submitReviewDecision({ status: "idle" }, form(decision));
      expect(result).toEqual({
        status: "invalid",
        message: "A reviewer note is required for this decision.",
      });
      expect(decideReviewSubject).not.toHaveBeenCalled();
    },
  );

  it("returns every approval blocker from a 409 and writes nothing else", async () => {
    decideReviewSubject.mockResolvedValue({
      state: "conflict",
      blockers: ["Source asset absent.", "Required method absent."],
    });
    const result = await submitReviewDecision({ status: "idle" }, form("approve"));
    expect(result).toMatchObject({
      status: "conflict",
      issues: ["Source asset absent.", "Required method absent."],
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects malformed comparison values before a request", async () => {
    const data = form("approve");
    data.set("expectedEvidenceSetHash", "stale");
    await expect(submitReviewDecision({ status: "idle" }, data)).resolves.toMatchObject({
      status: "invalid",
    });
    expect(decideReviewSubject).not.toHaveBeenCalled();
  });
});
