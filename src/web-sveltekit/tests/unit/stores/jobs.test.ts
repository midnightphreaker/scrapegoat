import { beforeEach, describe, expect, it } from "vitest";
import { jobsStore } from "$lib/stores/jobs.svelte";

describe("jobsStore", () => {
  beforeEach(() => {
    jobsStore.jobs = [];
    jobsStore.loading = false;
    jobsStore.error = null;
  });

  it("starts with empty jobs", () => {
    expect(jobsStore.jobs).toEqual([]);
  });

  it("has loading state", () => {
    expect(jobsStore.loading).toBe(false);
  });
});
