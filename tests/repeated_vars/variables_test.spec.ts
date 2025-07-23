/**
 * @file variables_test.spec.ts
 * @description
 * Playwright test for verifying variable injection and propagation in the Warp10 query editor workflow.
 * - Ensures that dashboard templating variables set in the UI are correctly injected,
 * - Verifies that these variables appear in the final backend response (`tableResults`) as expected values,
 * - Logs and asserts on the actual values returned in each column,
 *
 * Scope: Dashboard variable injection, backend response validation.
 */
import { test, expect } from '@playwright/test';
import { log, getGrafanaVersion, isVersionGreaterOrEqual, goToNewDashboard, clickEditButton } from '../utils';

// Editor JSON Model Validation
test('Variables: UI to backend injection works as expected', async ({ page }) => {
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

  // Load Grafana dashboard panel
  log('--> Navigating to dashboard with panel...');
  await page.goto('http://localhost:3000/dashboards');
  await page.waitForTimeout(1000);
  await goToNewDashboard(page);

  await page.locator('h2[title="Table Example 2"]').hover();

  const menuButtons = page.locator('button[aria-label="Menu for panel with title Table Example 2"]');
  await expect(menuButtons).toBeVisible();
  await menuButtons.click();

  await clickEditButton(page);

  // Wait for editor
  log('--> Waiting for query editor...');
  const editor = page.locator('.query-editor-row textarea').first();
  await expect(editor).toBeAttached({ timeout: 10000 });
  await expect(editor).toBeVisible({ timeout: 10000 });
  log('--> Editor is visible and attached');

  // Verify responses

  await page.waitForTimeout(3000);
  for (let i = 0; i < 10; i++) {
    if (responses.length > 0) {
      break;
    }
    await page.waitForTimeout(500);
  }

  const lastTableResponse = [...responses].reverse().find(r =>
    JSON.stringify(r.json).includes('"name":"tableResults"')
  );
  expect(lastTableResponse).toBeTruthy();

  const tableFrame = lastTableResponse.json.results.A.frames[0];

  console.log('Values:', tableFrame.data.values);

  console.log('Checking columnA (should contain "b b"):', tableFrame.data.values[0]);
  expect(tableFrame.data.values[0]).toContain("b b");

  console.log('Checking columnB (should contain "a"):', tableFrame.data.values[1]);
  expect(tableFrame.data.values[1]).toContain("a");

  console.log('Checking custom (should contain "typedValue"):', tableFrame.data.values[2]);
  expect(tableFrame.data.values[2]).toContain("typedValue");

  console.log('Checking textbox (should contain "my_constant_value"):', tableFrame.data.values[3]);
  expect(tableFrame.data.values[3]).toContain("my_constant_value");

  console.log('Checking constant (should contain "my_constant_value"):', tableFrame.data.values[4]);
  expect(tableFrame.data.values[4]).toContain("my_constant_value");

});
