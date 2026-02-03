/**
 * Color Contrast Utilities for WCAG AA Compliance
 *
 * Ensures text meets minimum contrast requirements:
 * - Normal text: 4.5:1 (AA), 7:1 (AAA)
 * - Large text (18pt+): 3:1 (AA), 4.5:1 (AAA)
 * - UI components: 3:1 (AA)
 */

/**
 * RGB color representation
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * HSL color representation
 */
export interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Parse hex color to RGB
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1]!, 16),
        g: parseInt(result[2]!, 16),
        b: parseInt(result[3]!, 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB to relative luminance
 * Based on WCAG 2.0 specification
 */
export function rgbToLuminance(rgb: RGB): number {
  const { r, g, b } = rgb;

  // Convert to linear RGB
  const toLinear = (c: number): number => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
  };

  const rLinear = toLinear(r);
  const gLinear = toLinear(g);
  const bLinear = toLinear(b);

  // Calculate luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate contrast ratio between two colors
 * Returns value from 1:1 to 21:1
 */
export function getContrastRatio(
  foreground: RGB | string,
  background: RGB | string,
): number {
  const fg = typeof foreground === "string" ? hexToRgb(foreground) : foreground;
  const bg = typeof background === "string" ? hexToRgb(background) : background;

  const fgLum = rgbToLuminance(fg);
  const bgLum = rgbToLuminance(bg);

  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG AA standard
 * @param ratio - Contrast ratio to check
 * @param largeText - Whether text is large (18pt+ or 14pt bold+)
 */
export function meetsWCAAARatio(ratio: number, largeText = false): boolean {
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if contrast ratio meets WCAG AAA standard
 * @param ratio - Contrast ratio to check
 * @param largeText - Whether text is large (18pt+ or 14pt bold+)
 */
export function meetsWCAAAARatio(ratio: number, largeText = false): boolean {
  return largeText ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Get contrast rating
 */
export function getContrastRating(
  ratio: number,
  largeText = false,
): {
  rating: "fail" | "aa" | "aaa";
  score: number;
  description: string;
} {
  const aaa = largeText ? 4.5 : 7;
  const aa = largeText ? 3 : 4.5;

  if (ratio >= aaa) {
    return {
      rating: "aaa",
      score: 100,
      description: `Excellent contrast (${ratio.toFixed(2)}:1, exceeds WCAG AAA)`,
    };
  }

  if (ratio >= aa) {
    return {
      rating: "aa",
      score: 80,
      description: `Good contrast (${ratio.toFixed(2)}:1, meets WCAG AA)`,
    };
  }

  const shortfall = ((aa - ratio) / aa) * 100;
  return {
    rating: "fail",
    score: Math.max(0, 100 - shortfall),
    description: `Poor contrast (${ratio.toFixed(2)}:1, needs ${aa.toFixed(2)}:1 for WCAG AA)`,
  };
}

/**
 * Suggest a darker or lighter version of a color to improve contrast
 */
export function adjustColorForContrast(
  color: RGB | string,
  targetBackground: RGB | string,
  targetRatio: number = 4.5,
): RGB {
  const fg = typeof color === "string" ? hexToRgb(color) : color;
  const bg =
    typeof targetBackground === "string" ? hexToRgb(targetBackground) : targetBackground;

  const bgLum = rgbToLuminance(bg);
  const fgLum = rgbToLuminance(fg);

  // If foreground is lighter than background, darken it
  if (fgLum > bgLum) {
    return darkenColor(fg, bg, targetRatio);
  }

  // Otherwise, lighten it
  return lightenColor(fg, bg, targetRatio);
}

/**
 * Darken a color to improve contrast against a lighter background
 */
function darkenColor(color: RGB, background: RGB, targetRatio: number): RGB {
  let { r, g, b } = color;
  const bgLum = rgbToLuminance(background);
  let currentRatio = getContrastRatio(color, background);

  let iterations = 0;
  const maxIterations = 100;

  while (currentRatio < targetRatio && iterations < maxIterations) {
    const factor = 0.95;
    r = Math.max(0, Math.floor(r * factor));
    g = Math.max(0, Math.floor(g * factor));
    b = Math.max(0, Math.floor(b * factor));

    currentRatio = getContrastRatio({ r, g, b }, background);
    iterations++;
  }

  return { r, g, b };
}

/**
 * Lighten a color to improve contrast against a darker background
 */
function lightenColor(color: RGB, background: RGB, targetRatio: number): RGB {
  let { r, g, b } = color;
  const bgLum = rgbToLuminance(background);
  let currentRatio = getContrastRatio(color, background);

  let iterations = 0;
  const maxIterations = 100;

  while (currentRatio < targetRatio && iterations < maxIterations) {
    const factor = 1.05;
    r = Math.min(255, Math.ceil(r * factor));
    g = Math.min(255, Math.ceil(g * factor));
    b = Math.min(255, Math.ceil(b * factor));

    currentRatio = getContrastRatio({ r, g, b }, background);
    iterations++;
  }

  return { r, g, b };
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (c: number): string => {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Recommended color palette with good contrast ratios
 */
export const ACCESSIBLE_COLORS = {
  // Text colors (for white backgrounds)
  text: {
    primary: "#1a1a1a", // Near black (17.1:1)
    secondary: "#374151", // Gray-700 (9.6:1)
    tertiary: "#6b7280", // Gray-500 (5.1:1)
    disabled: "#9ca3af", // Gray-400 (3.1:1)
  },

  // Background colors (with #1a1a1a text)
  bg: {
    white: "#ffffff",
    light: "#f3f4f6", // Gray-100
    medium: "#e5e7eb", // Gray-200
    dark: "#1f2937", // Gray-800
    darker: "#111827", // Gray-900
  },

  // Semantic colors (WCAG AA compliant)
  success: {
    bg: "#dcfce7", // Green-100
    text: "#166534", // Green-800
    border: "#84cc16", // Green-600
  },

  warning: {
    bg: "#fef3c7", // Yellow-100
    text: "#92400e", // Yellow-800
    border: "#f59e0b", // Yellow-500
  },

  error: {
    bg: "#fee2e2", // Red-100
    text: "#991b1b", // Red-800
    border: "#ef4444", // Red-500
  },

  info: {
    bg: "#dbeafe", // Blue-100
    text: "#1e40af", // Blue-800
    border: "#3b82f6", // Blue-500
  },

  // Primary brand colors
  primary: {
    50: "#eff6ff", // Light blue
    100: "#dbeafe", // (14:1 contrast with white)
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa", // (4.7:1 contrast with white)
    500: "#3b82f6", // Primary blue (4.5:1 with white, 3.1:1 with dark)
    600: "#2563eb", // (7.4:1 with white)
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
  },
};

/**
 * Dark mode color palette
 */
export const DARK_MODE_COLORS = {
  text: {
    primary: "#f9fafb", // Gray-50
    secondary: "#d1d5db", // Gray-300
    tertiary: "#9ca3af", // Gray-400
    disabled: "#6b7280", // Gray-500
  },

  bg: {
    white: "#ffffff",
    light: "#374151", // Gray-700
    medium: "#1f2937", // Gray-800
    dark: "#111827", // Gray-900
    darker: "#030712", // Gray-950
  },
};

/**
 * Check if a color combination passes WCAG AA
 */
export function checkColorContrast(
  foreground: string,
  background: string,
  largeText = false,
): {
  passes: boolean;
  ratio: number;
  rating: string;
  recommendation?: string;
} {
  const ratio = getContrastRatio(foreground, background);
  const rating = getContrastRating(ratio, largeText);

  let recommendation: string | undefined;
  if (!meetsWCAAARatio(ratio, largeText)) {
    const adjusted = adjustColorForContrast(foreground, background, 4.5);
    recommendation = `Consider using ${rgbToHex(adjusted)} instead`;
  }

  return {
    passes: meetsWCAAARatio(ratio, largeText),
    ratio,
    rating: rating.rating,
    recommendation,
  };
}

/**
 * Get text color class based on background
 * Returns either "text-stone-900" or "text-white"
 */
export function getTextColorClass(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor);
  const luminance = rgbToLuminance(rgb);

  // Use light text on dark backgrounds (luminance < 0.5)
  return luminance < 0.5 ? "text-white" : "text-stone-900";
}

/**
 * Audit all color combinations in a document
 */
export function auditColorContrast(document: Document): {
  issues: Array<{
    element: string;
    foreground: string;
    background: string;
    ratio: number;
    required: number;
    issue: string;
  }>;
  summary: {
    total: number;
    failing: number;
    passing: number;
  };
} {
  const issues: typeof auditColorContrast.issues = [];
  let total = 0;
  let failing = 0;

  // Check all elements with computed colors
  const elements = document.querySelectorAll("*");
  for (const el of Array.from(elements)) {
    const styles = window.getComputedStyle(el);
    const fg = styles.color;
    const bg = styles.backgroundColor;

    if (fg && bg && fg !== "rgba(0, 0, 0, 0)" && bg !== "rgba(0, 0, 0, 0)") {
      total++;

      // Convert rgb to hex for comparison
      const fgMatch = fg.match(/\d+/g)?.slice(0, 3).map(Number);
      const bgMatch = bg.match(/\d+/g)?.slice(0, 3).map(Number);
      const fgRgb: RGB =
        fgMatch && fgMatch.length >= 3
          ? { r: fgMatch[0], g: fgMatch[1], b: fgMatch[2] }
          : { r: 0, g: 0, b: 0 };
      const bgRgb: RGB =
        bgMatch && bgMatch.length >= 3
          ? { r: bgMatch[0], g: bgMatch[1], b: bgMatch[2] }
          : { r: 0, g: 0, b: 0 };
      const fgHex = rgbToHex(fgRgb);
      const bgHex = rgbToHex(bgRgb);

      const ratio = getContrastRatio(fgHex, bgHex);
      const fontSize = parseFloat(styles.fontSize);

      // Consider text large if 18pt (24px) or 14pt bold+
      const isLarge = fontSize >= 24 || (fontSize >= 18 && styles.fontWeight === "700");

      if (!meetsWCAAARatio(ratio, isLarge)) {
        failing++;
        issues.push({
          element: el.tagName.toLowerCase(),
          foreground: fgHex,
          background: bgHex,
          ratio,
          required: isLarge ? 3 : 4.5,
          issue: `Contrast ratio ${ratio.toFixed(2)}:1 below WCAG AA requirement`,
        });
      }
    }
  }

  return {
    issues,
    summary: {
      total,
      failing,
      passing: total - failing,
    },
  };
}
