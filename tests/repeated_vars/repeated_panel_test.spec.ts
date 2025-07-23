/**
 * @file repeated_panel_test.spec.ts
 * @description
 * Playwright test for verifying repeated variable panels in the Warp10 query editor workflow.
 * - Ensures that repeated dashboard templating variables (server_example) are correctly injected,
 * - Verifies that the corresponding series for each variable value (server1, server2) are present in the UI,
 * - Asserts that the correct series are also returned in the backend API response,
 *
 * Scope: Dashboard repeated variable panels, backend series/response validation.
 */
import { test } from '@playwright/test';
import {
  log,
  getGrafanaVersion,
  isVersionGreaterOrEqual,
  goToNewDashboard,
  checkServerSeries,
} from '../utils';

// Editor JSON Model Validation
test('Repeated Variable Panel: all expected series for repeated variable values are rendered in UI and backend', async ({ page }) => {
  const version = await getGrafanaVersion(page);
  log(`--> Detected Grafana version: ${version}`);
  if (!isVersionGreaterOrEqual(version, '11.0.0')) {
    test.skip();
    return;
  }

  const responses: any[] = [];

  // Intercept responses
  page.on('response', async (response) => {
    const url = response.url();

    if (url.includes('/api/ds/query') && response.request().method() === 'POST') {
      try {
        const json = await response.json();
        responses.push({ url, json, status: response.status() });
        log(`--> Captured: ${url} [status ${response.status()}]`);
      } catch (e) {
        log(`--> Failed to parse JSON for: ${url}`);
      }
    }
  });

  // Log console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().includes('net::ERR_CONNECTION_REFUSED')) {
      return;
    }
    console.log(`[console.${msg.type()}] ${msg.text()}`);
  });
  log(`--> Navigating to dashboard`);
  await page.goto('http://localhost:3000/dashboards');
  await page.waitForTimeout(2000);
  await goToNewDashboard(page);
  await page.evaluate(() => { document.body.style.zoom = '0.5'; });
  await page.waitForTimeout(1000);

  await checkServerSeries(page, responses, [
    "io.warp10.grafana.testmetric{func=cosinus,server_example=server1}",
    "io.warp10.grafana.test{func=sinus,server_example=server1}"
  ]);
  await checkServerSeries(page, responses, [
    "io.warp10.grafana.testmetric{func=cosinus,server_example=server2}",
    "io.warp10.grafana.test{func=sinus,server_example=server2}"
  ]);

  log('--> Repeated Variables Test Completed Successfully');
});
