import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ScrapeForm from "$lib/components/scrape/ScrapeForm.svelte";

vi.mock("$lib/api/trpc", () => ({
  trpc: {
    enqueueJob: {
      mutate: vi.fn(),
    },
  },
}));

describe("ScrapeForm", () => {
  beforeEach(async () => {
    const { trpc } = await import("$lib/api/trpc");
    vi.mocked(trpc.enqueueJob.mutate).mockClear();
  });

  it("renders URL input and library name field", () => {
    render(ScrapeForm);
    expect(screen.getByPlaceholderText(/url/i)).toBeTruthy();
    expect(screen.getByLabelText(/library/i)).toBeTruthy();
  });

  it("has add URL button", () => {
    render(ScrapeForm);
    expect(screen.getByRole("button", { name: /add url/i })).toBeTruthy();
  });

  describe("Add URL button", () => {
    it("is enabled when under max URLs", () => {
      render(ScrapeForm);
      const addButton = screen.getByRole("button", { name: /add url/i });
      expect((addButton as HTMLButtonElement).disabled).toBe(false);
    });

    it("adds a new URL input when clicked", async () => {
      render(ScrapeForm);
      const addButton = screen.getByRole("button", { name: /add url/i });
      const inputsBefore = screen.getAllByPlaceholderText(/url/i);
      expect(inputsBefore).toHaveLength(1);

      await fireEvent.click(addButton);

      const inputsAfter = screen.getAllByPlaceholderText(/url/i);
      expect(inputsAfter).toHaveLength(2);
    });
  });

  describe("Max URLs limit", () => {
    it("disables add button when at max URLs (10)", async () => {
      render(ScrapeForm);
      const addButton = screen.getByRole("button", { name: /add url/i });

      for (let i = 0; i < 9; i++) {
        await fireEvent.click(addButton);
      }

      expect((addButton as HTMLButtonElement).disabled).toBe(true);
    });

    it("does not add more than 10 URLs", async () => {
      render(ScrapeForm);
      const addButton = screen.getByRole("button", { name: /add url/i });

      for (let i = 0; i < 12; i++) {
        await fireEvent.click(addButton);
      }

      const inputs = screen.getAllByPlaceholderText(/url/i);
      expect(inputs).toHaveLength(10);
    });
  });

  describe("Remove URL", () => {
    it("removes URL from list when remove button clicked", async () => {
      render(ScrapeForm);
      const addButton = screen.getByRole("button", { name: /add url/i });
      await fireEvent.click(addButton);

      const inputsBefore = screen.getAllByPlaceholderText(/url/i);
      expect(inputsBefore).toHaveLength(2);

      const removeButtons = screen.getAllByRole("button", { name: /remove url/i });
      await fireEvent.click(removeButtons[0]);

      const inputsAfter = screen.getAllByPlaceholderText(/url/i);
      expect(inputsAfter).toHaveLength(1);
    });

    it("does not show remove button when only one URL", () => {
      render(ScrapeForm);
      expect(screen.queryByRole("button", { name: /remove url/i })).toBeNull();
    });
  });

  describe("URL validation", () => {
    it("shows error for empty URL on submit", async () => {
      render(ScrapeForm);
      const libraryInput = screen.getByLabelText(/library/i);
      await fireEvent.input(libraryInput, { target: { value: "react" } });

      const submitButton = screen.getByRole("button", { name: /queue scrape/i });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/url is required/i)).toBeTruthy();
      });
    });

    it("shows error for invalid URL format", async () => {
      render(ScrapeForm);
      const urlInput = screen.getByPlaceholderText(/url/i) as HTMLInputElement;
      urlInput.value = "not-a-url";
      await fireEvent.input(urlInput);
      await tick();

      const libraryInput = screen.getByLabelText(/library/i) as HTMLInputElement;
      libraryInput.value = "react";
      await fireEvent.input(libraryInput);
      await tick();

      const submitButton = screen.getByRole("button", { name: /queue scrape/i });
      await fireEvent.click(submitButton);
      await tick();

      await waitFor(
        () => {
          expect(screen.getByText(/invalid url format/i)).toBeTruthy();
        },
        { timeout: 3000 },
      );
    });

    it("shows error for non-http(s) protocol", async () => {
      render(ScrapeForm);
      const urlInput = screen.getByPlaceholderText(/url/i);
      const libraryInput = screen.getByLabelText(/library/i);

      await fireEvent.input(urlInput, { target: { value: "ftp://example.com" } });
      await fireEvent.input(libraryInput, { target: { value: "react" } });

      const submitButton = screen.getByRole("button", { name: /queue scrape/i });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/url must be http or https/i)).toBeTruthy();
      });
    });

    it("clears error when user types in URL input", async () => {
      render(ScrapeForm);
      const urlInput = screen.getByPlaceholderText(/url/i) as HTMLInputElement;
      const libraryInput = screen.getByLabelText(/library/i);

      await fireEvent.input(libraryInput, { target: { value: "react" } });
      const submitButton = screen.getByRole("button", { name: /queue scrape/i });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/url is required/i)).toBeTruthy();
      });

      await fireEvent.input(urlInput, { target: { value: "https://example.com" } });

      await waitFor(() => {
        expect(screen.queryByText(/url is required/i)).toBeNull();
      });
    });
  });

  describe("Form submission", () => {
    it("calls trpc mutate with correct data for single URL", async () => {
      const { trpc } = await import("$lib/api/trpc");
      vi.mocked(trpc.enqueueJob.mutate).mockResolvedValue({ jobId: "test-job" });
      render(ScrapeForm);

      const urlInput = screen.getByPlaceholderText(/url/i);
      const libraryInput = screen.getByLabelText(/library/i);

      await fireEvent.input(urlInput, { target: { value: "https://react.dev" } });
      await fireEvent.input(libraryInput, { target: { value: "react" } });

      const submitButton = screen.getByRole("button", { name: /queue scrape/i });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(trpc.enqueueJob.mutate).toHaveBeenCalledWith(
          expect.objectContaining({
            library: "react",
            options: expect.objectContaining({
              url: "https://react.dev",
              library: "react",
            }),
          }),
        );
      });
    });

    it("calls trpc mutate for each URL when multiple URLs provided", async () => {
      const { trpc } = await import("$lib/api/trpc");
      vi.mocked(trpc.enqueueJob.mutate).mockResolvedValue({ jobId: "test-job" });
      render(ScrapeForm);

      const urlInputs = screen.getAllByPlaceholderText(/url/i);
      const libraryInput = screen.getByLabelText(/library/i);

      await fireEvent.input(urlInputs[0], { target: { value: "https://react.dev" } });

      const addButton = screen.getByRole("button", { name: /add url/i });
      await fireEvent.click(addButton);

      const urlInputsAfter = screen.getAllByPlaceholderText(/url/i);
      await fireEvent.input(urlInputsAfter[1], {
        target: { value: "https://vuejs.org" },
      });
      await fireEvent.input(libraryInput, { target: { value: "framework" } });

      const submitButton = screen.getByRole("button", { name: /queue scrape/i });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(trpc.enqueueJob.mutate).toHaveBeenCalledTimes(2);
      });
    });

    it("does not submit when library name is empty", async () => {
      const { trpc } = await import("$lib/api/trpc");
      render(ScrapeForm);

      const urlInput = screen.getByPlaceholderText(/url/i);
      await fireEvent.input(urlInput, { target: { value: "https://react.dev" } });

      const submitButton = screen.getByRole("button", { name: /queue scrape/i });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(trpc.enqueueJob.mutate).not.toHaveBeenCalled();
      });
    });

    it("includes version when provided", async () => {
      const { trpc } = await import("$lib/api/trpc");
      vi.mocked(trpc.enqueueJob.mutate).mockResolvedValue({ jobId: "test-job" });
      render(ScrapeForm);

      const urlInput = screen.getByPlaceholderText(/url/i);
      const libraryInput = screen.getByLabelText(/library/i);
      const versionInput = screen.getByLabelText(/version/i);

      await fireEvent.input(urlInput, { target: { value: "https://react.dev" } });
      await fireEvent.input(libraryInput, { target: { value: "react" } });
      await fireEvent.input(versionInput, { target: { value: "18.0.0" } });

      const submitButton = screen.getByRole("button", { name: /queue scrape/i });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(trpc.enqueueJob.mutate).toHaveBeenCalledWith(
          expect.objectContaining({
            library: "react",
            version: "18.0.0",
            options: expect.objectContaining({
              url: "https://react.dev",
              library: "react",
              version: "18.0.0",
            }),
          }),
        );
      });
    });
  });
});
