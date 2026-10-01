import { mock } from "bun:test";
import assert from "node:assert/strict";

let signedIn = false;
let reviewer = false;
mock.module("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: signedIn ? "reviewer-fixture" : null }),
}));
mock.module("../auth", () => ({
  getAdminIdentity: async () =>
    reviewer ? { clerkUserId: "reviewer-fixture" } : null,
}));
mock.module("next/navigation", () => ({
  redirect: (location: string) => {
    throw new Error(`redirect:${location}`);
  },
}));
mock.module("../insights", () => ({
  getAdminInsights: async () => {
    throw new Error("authorized-report-query");
  },
}));
const { default: page } = await import("../../../app/admin/insights/page");
await assert.rejects(page({ searchParams: Promise.resolve({}) }), {
  message: "redirect:/sign-in?redirect_url=/admin/insights",
});
signedIn = true;
await assert.rejects(page({ searchParams: Promise.resolve({}) }), {
  message: "redirect:/welcome",
});
reviewer = true;
await assert.rejects(page({ searchParams: Promise.resolve({}) }), {
  message: "authorized-report-query",
});
console.log("insights access passed");
