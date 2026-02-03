# Performance Budgets

This document outlines the performance budgets for the Scrapegoat web application and how to measure against them.

## Overview

Performance budgets are limits set for various metrics to ensure the application remains fast and responsive. These budgets help prevent performance regressions and guide optimization efforts.

## Budget Limits

### Bundle Size Budgets

| Metric | Default | Strict | Development |
|--------|---------|--------|-------------|
| JavaScript | 250 KB | 150 KB | 500 KB |
| CSS | 50 KB | 30 KB | 100 KB |
| Total Page Weight | 1 MB | 500 KB | 2 MB |

### Runtime Performance Budgets

| Metric | Default | Strict | Development | Unit |
|--------|---------|--------|-------------|------|
| API Response Time | 1000 | 500 | 2000 | ms |
| Memory Usage | 100 | 50 | 200 | MB |

### Web Vitals Budgets

| Metric | Default | Strict | Development | Rating |
|--------|---------|--------|-------------|--------|
| First Contentful Paint (FCP) | 1800 | 1000 | 3000 | ms |
| Largest Contentful Paint (LCP) | 2500 | 1500 | 4000 | ms |
| Cumulative Layout Shift (CLS) | 0.1 | 0.05 | 0.25 | score |
| First Input Delay (FID) | 100 | 50 | 200 | ms |
| Time to Interactive (TTI) | 3800 | 2000 | 5000 | ms |

## Using Performance Budgets

### In Code

```typescript
import {
  PerformanceBudgetChecker,
  measurePagePerformance,
  measureApiCall,
  DEFAULT_BUDGETS,
} from "./utils/performanceBudgets";

// Check page performance
const measurement = measurePagePerformance();
const checker = new PerformanceBudgetChecker(DEFAULT_BUDGETS);

checker.onBreach((breach) => {
  console.warn(`Budget breached: ${breach.budget}`, breach);
});

const breaches = checker.check(measurement);

// Measure API call performance
const [result, duration] = await measureApiCall(() => fetch("/api/data"));
```

### In Tests

```typescript
import { assertBudget, type PerformanceMeasurement } from "./utils/performanceBudgets";

test("API response time is within budget", async () => {
  const start = performance.now();
  const response = await fetch("/api/search?q=test");
  const duration = performance.now() - start;

  assertBudget({ apiTime: duration }, DEFAULT_BUDGETS);
});
```

### Browser Console

In development, performance budgets are automatically logged to the console when the page loads. Look for the "📊 Performance Budgets" section.

## Measuring Performance

### Manual Testing

1. Open Chrome DevTools (F12)
2. Go to the "Lighthouse" tab
3. Run a performance audit
4. Compare results against budgets

### CI/CD Integration

Add performance budget checks to your CI/CD pipeline:

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          uploadArtifacts: true
          temporaryPublicStorage: true
```

## When Budgets Are Exceeded

### Warning (1.0-1.5x over budget)

- Log warning to console
- Monitor for trends
- Consider optimization in next iteration

### Error (1.5-2x over budget)

- Alert development team
- Create GitHub issue
- Plan optimization work

### Critical (>2x over budget)

- Block deployment
- Immediate attention required
- Rollback if recent change

## Common Performance Issues

### Large Bundle Size

**Symptoms**: JavaScript or CSS over budget

**Solutions**:
- Code splitting: Split large bundles into smaller chunks
- Tree shaking: Remove unused code
- Dynamic imports: Load code on-demand
- Compression: Enable gzip/brotli compression
- Minification: Minify all production code

### Slow API Response

**Symptoms**: API time over budget

**Solutions**:
- Database optimization: Add indexes, optimize queries
- Caching: Implement Redis/database query caching
- Pagination: Limit result sizes
- Async processing: Move heavy work to background jobs
- CDN: Use CDN for static assets

### Poor Web Vitals

**Symptoms**: FCP, LCP, CLS, or FID over budget

**Solutions**:
- FCP/LCP: Optimize critical CSS, lazy load images, reduce server response time
- CLS: Reserve space for dynamic content, avoid inserting content above existing content
- FID: Reduce JavaScript execution time, break up long tasks
- TTI: Reduce JavaScript bundles, defer non-critical JavaScript

## Monitoring

### Development

```typescript
import { logPerformanceBudgets } from "./utils/performanceBudgets";

// Log budgets on page load (development only)
logPerformanceBudgets();
```

### Production

Implement performance monitoring with a service like:
- Vercel Analytics
- Cloudflare Web Analytics
- Google Analytics
- Sentry Performance Monitoring

## Budget Review Process

1. **Quarterly Review**: Assess if budgets need adjustment
2. **Major Feature Addition**: Re-evaluate budgets
3. **Platform Changes**: Adjust for new browser capabilities
4. **User Feedback**: Consider real-world performance issues

## References

- [Web.dev Performance Metrics](https://web.dev/vitals/)
- [Google Lighthouse](https://github.com/GoogleChrome/lighthouse)
- [Performance Budget Calculator](https://performance-budget-calculator.httpwatch.com/)
