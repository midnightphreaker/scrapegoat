type Theme = "light" | "dark" | "system";

class ThemeStore {
  theme = $state<Theme>("system");
  dark = $derived(this.theme === "dark");
  wide = $state(false);

  constructor() {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as Theme | null;
      if (stored) this.theme = stored;

      const storedWide = localStorage.getItem("wide");
      if (storedWide) this.wide = storedWide === "true";

      this.applyTheme();
    }
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    localStorage.setItem("theme", theme);
    this.applyTheme();
  }

  toggleDark() {
    this.setTheme(this.dark ? "light" : "dark");
  }

  toggleWide() {
    this.wide = !this.wide;
    localStorage.setItem("wide", String(this.wide));
    this.applyWide();
  }

  private applyTheme() {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", this.dark);
    }
  }

  private applyWide() {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("wide", this.wide);
    }
  }
}

export const themeStore = new ThemeStore();
export type { Theme };
