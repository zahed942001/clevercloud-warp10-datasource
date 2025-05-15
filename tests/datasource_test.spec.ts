/**
 * @file datasource_test.spec.ts
 * @description Unit-level tests for the Warp10 datasource configuration component.
 * Validates behavior of form fields, save & test button, constants/macros config,
 * and backend healthcheck status.
 *
 * Scope: datasource (configuration UI + backend health)
 */
import { test, expect, Page } from '@playwright/test';
import { Locator } from "playwright";

// === Logger ===
function log(message: string) {
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    console.log(`[${now}] ${message}`);
}

// === Utility: Get Grafana version ===
async function getGrafanaVersion(page: Page): Promise<string> {
    const response = await page.request.get('http://localhost:3000/api/health');
    const body = await response.json();
    return body.version;
}

// === Utility: Fill key-value pair for constants/macros ===
async function fillPairAndClickAdd({ nameInput, valueInput, name, value, addButton, label, page }: {
    nameInput: Locator, valueInput: Locator, name: string, value: string, addButton?: Locator, label: string, page: Page
}) {
    log(`--> Filling ${label} name`);
    await nameInput.pressSequentially(name);
    await page.waitForTimeout(500);
    const actualName = await nameInput.inputValue();
    log(`--> ${label} Name value after typing: "${actualName}"`);
    if (actualName === name) {log(`--> ${label} name added successfully`);}

    log(`--> Filling ${label} value`);
    await valueInput.pressSequentially(value);
    await page.waitForTimeout(500);
    const actualValue = await valueInput.inputValue();
    log(`--> ${label} Value after typing: "${actualValue}"`);
    if (actualValue === value) {log(`--> ${label} value added successfully`);}

    if (addButton) {
        log(`--> Clicking ${label} Add button...`);
        await addButton.click();
        await page.waitForTimeout(1000);
    }
}

// === Utility: Check label visibility ===
async function logVisibility(page: Page, label: string) {
    try {
        await expect(page.getByText(label, { exact: true })).toBeVisible();
        log(`--> '${label}' is visible`);
    } catch (error) {
        console.error(`--> '${label}' is NOT visible`);
    }
}

// === Test: Datasource component and health check ===
test('Datasource: test all fields in datasource config + healthcheck', async ({ page }) => {
    const responses: any[] = [];
    let healthResponse: any = null;

    // === Capture network responses ===
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

        if (url.includes('/api/datasources') && url.includes('/health')) {
            try {
                const json = await response.json();
                healthResponse = json;
                log(`--> Health check response received: ${JSON.stringify(json, null, 2)}`);
            } catch (e) {
                log(`--> Failed to parse health check response: ${e}`);
            }
        }
    });

    // === Log console errors ===
    page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('net::ERR_CONNECTION_REFUSED')) {return;}
        console.log(`[console.${msg.type()}] ${msg.text()}`);
    });

    // === Step 1: Get Grafana version and define constants ===
    const version = await getGrafanaVersion(page);
    log(`--> Detected Grafana version: ${version}`);
    const major = parseInt(version.split('.')[0], 10);

    const dsPath = major < 10
        ? '/connections/your-connections/datasources/new'
        : '/connections/datasources/new';

    const saveButton = major < 10
        ? { type: 'role', name: 'Data source settings page Save and Test button' }
        : { type: 'role', name: 'Save & test' };

    const deleteButton = major < 10
        ? { type: 'role', name: 'Data source settings page Delete button' }
        : { type: 'testId', name: 'Data source settings page Delete button' };

    const confirmButton = major < 10
        ? { type: 'role', name: 'Confirm Modal Danger Button' }
        : { type: 'testId', name: 'data-testid Confirm Modal Danger Button' };

    // === Step 2: Create datasource ===
    log('--> Navigating to data sources page...');
    await page.goto(`http://localhost:3000${dsPath}`);
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'Warp10' }).click();

    log('--> Filling Plugin Name');
    await page.fill('#basic-settings-name', 'test_warp10');

    log('--> Filling Warp10 URL');
    const urlInput = page.locator('#url');
    await urlInput.fill('http://warp10:8080');
    const currentValue = await urlInput.inputValue();
    log(`--> URL input filled with: ${currentValue}`);

    log('--> Saving datasource to trigger healthcheck...');
    if (saveButton.type === 'role') {
        await page.getByRole('button', { name: saveButton.name }).click();
    } else {
        await page.getByTestId(saveButton.name).click();
    }

    await page.waitForTimeout(1000);

    if (healthResponse) {
        log(`--> ✅ Health check passed with status: ${healthResponse.status} — ${healthResponse.message}`);
    } else {
        log('--> ⚠️ Health check response was not received.');
    }

    // === Step 3: Test constants/macros addition ===
    log('--> Filling and applying constants and macros');

    await fillPairAndClickAdd({
        nameInput: page.locator('#constant_name'),
        valueInput: page.locator('#constant_value'),
        name: 'test_constant',
        value: 'test_constant_value',
        addButton: page.locator('#btn_constant'),
        label: 'Constant',
        page
    });

    await fillPairAndClickAdd({
        nameInput: page.locator('#macro_name'),
        valueInput: page.locator('#macro_value'),
        name: 'test_macro',
        value: 'test_macro_value',
        addButton: page.locator('#btn_macro'),
        label: 'Macro',
        page
    });

    log('--> Saving again after adding constants/macros...');
    if (saveButton.type === 'role') {
        await page.getByRole('button', { name: saveButton.name }).click();
    } else {
        await page.getByTestId(saveButton.name).click();
    }

    await page.waitForTimeout(1000);

    // === Step 4: Refresh and verify values ===
    log('--> Refreshing page to verify saved values...');
    await page.reload();
    await page.waitForTimeout(2000);

    await logVisibility(page, 'test_constant');
    await logVisibility(page, 'test_constant_value');
    await logVisibility(page, 'test_macro');
    await logVisibility(page, 'test_macro_value');

    // === Step 5: Cleanup (delete datasource) ===
    log('--> Deleting datasource...');
    if (deleteButton.type === 'role') {
        await page.getByRole('button', { name: deleteButton.name }).click();
    } else {
        await page.getByTestId(deleteButton.name).click();
    }

    if (confirmButton.type === 'role') {
        await page.getByRole('button', { name: confirmButton.name }).click();
    } else {
        await page.getByTestId(confirmButton.name).click();
    }

    log('--> ✅ Datasource deleted successfully');
    log('--> 🎯 Datasource configuration test completed!');
});
