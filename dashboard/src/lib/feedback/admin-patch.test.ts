import { describe, expect, it } from "vitest";
import { cleanAttribution, feedbackUpdate, parseAdminFeedbackPatch } from "./admin-patch";

const id = "656565656565656565656565";
const now = new Date("2026-11-28T10:00:00Z");

describe("parseAdminFeedbackPatch", () => {
  it("keeps accepting a plain status change", () => {
    expect(parseAdminFeedbackPatch({ id, status: "done" })).toEqual({ ok: true, value: { id, status: "done" } });
  });

  it("rejects bad ids, statuses and shapes", () => {
    expect(parseAdminFeedbackPatch(null)).toMatchObject({ ok: false });
    expect(parseAdminFeedbackPatch([{ id }])).toMatchObject({ ok: false });
    expect(parseAdminFeedbackPatch({ id: "nope", status: "done" })).toEqual({ ok: false, error: "Invalid id" });
    expect(parseAdminFeedbackPatch({ id, status: "archived" })).toEqual({ ok: false, error: "Invalid status" });
    expect(parseAdminFeedbackPatch({ id })).toEqual({ ok: false, error: "Nothing to update" });
  });

  it("accepts featured only as a boolean", () => {
    expect(parseAdminFeedbackPatch({ id, featured: true })).toEqual({ ok: true, value: { id, featured: true } });
    expect(parseAdminFeedbackPatch({ id, featured: false })).toEqual({ ok: true, value: { id, featured: false } });
    expect(parseAdminFeedbackPatch({ id, featured: "true" })).toMatchObject({ ok: false });
    expect(parseAdminFeedbackPatch({ id, featured: 1 })).toMatchObject({ ok: false });
  });

  it("cleans the attribution, treats null as clearing it and enforces the length", () => {
    expect(parseAdminFeedbackPatch({ id, quoteAttribution: "  runs a 300-member\n gaming server " })).toEqual({
      ok: true,
      value: { id, quoteAttribution: "runs a 300-member gaming server" },
    });
    expect(parseAdminFeedbackPatch({ id, quoteAttribution: null })).toEqual({ ok: true, value: { id, quoteAttribution: "" } });
    expect(parseAdminFeedbackPatch({ id, quoteAttribution: "x".repeat(80) })).toMatchObject({ ok: true });
    expect(parseAdminFeedbackPatch({ id, quoteAttribution: "x".repeat(81) })).toMatchObject({ ok: false });
    expect(parseAdminFeedbackPatch({ id, quoteAttribution: 5 })).toMatchObject({ ok: false });
  });

  it("strips control characters from the attribution", () => {
    expect(cleanAttribution("DJ\u0000 of a\u0007 study server")).toBe("DJ of a study server");
  });
});

describe("feedbackUpdate", () => {
  it("sets the status only", () => {
    expect(feedbackUpdate({ id, status: "read" }, now)).toEqual({ filter: { _id: id }, update: { $set: { status: "read" } } });
  });

  it("requires quoteOk in the filter when featuring and stamps featuredAt", () => {
    expect(feedbackUpdate({ id, featured: true, quoteAttribution: "DJ in a study server" }, now)).toEqual({
      filter: { _id: id, quoteOk: true },
      update: { $set: { featured: true, featuredAt: now, quoteAttribution: "DJ in a study server" } },
    });
  });

  it("unfeatures without any consent condition", () => {
    expect(feedbackUpdate({ id, featured: false }, now)).toEqual({
      filter: { _id: id },
      update: { $unset: { featured: "", featuredAt: "" } },
    });
  });

  it("clears an empty attribution", () => {
    expect(feedbackUpdate({ id, quoteAttribution: "" }, now)).toEqual({
      filter: { _id: id },
      update: { $unset: { quoteAttribution: "" } },
    });
  });
});
