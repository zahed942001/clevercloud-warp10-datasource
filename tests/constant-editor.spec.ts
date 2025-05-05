import {Page, test, expect} from '@playwright/test';
import {Locator} from "playwright";

function log(message: string) {
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    console.log(`[${now}] ${message}`);
}
async function fillPairAndClickAdd({nameInput, valueInput, name, value, addButton, label, page}: { nameInput: Locator, valueInput: Locator, name: string, value: string, addButton?: Locator, label: string, page: Page }) {
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

test('Warp10 Datasource health check', async ({ page }) => {
    // Capture health check response
    let healthResponse: any = null;

    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/datasources') && url.includes('/health')) {
            try {
                const json = await response.json();
                healthResponse = json;
                log(`✅ Health check response received: ${JSON.stringify(json, null, 2)}`);
            } catch (e) {
                log(`❌ Failed to parse health check response: ${e}`);
            }
        }
    });
    log('-->Navigating to data sources page...');
    await page.goto('http://localhost:3000/connections/datasources');

    // Wait for the data sources page to load
    await page.getByRole('link', { name: 'Warp10-Clever-Cloud' }).click();
    await page.waitForTimeout(1000);

    log('-->Clicking Test button...');
    let attempts = 0;
    while (attempts++ < 3) {
        try {
            await page.getByRole('button', { name: 'Test' }).click();
            break;
        } catch {
            log(`❌  Button not clicked`);
            await page.waitForTimeout(1000);
        }
    }

    // Wait for the response to be received
    await page.waitForTimeout(1000);

    if (healthResponse) {
        log(`Status: ${healthResponse.status}`);
        log(`Message: ${healthResponse.message}`);
    } else {
        log('Health check response was not received.');
    }

    log('--> searching for editable inputs');
    const enabledInputs = page.locator('input:enabled');
    const enabledtextareas = page.locator('textarea:enabled');

    await fillPairAndClickAdd({nameInput: enabledInputs.nth(2), valueInput: enabledtextareas.nth(0), name: 'test_constant', value: 'test_constant_value', addButton: page.locator('button:has-text("Add")').first(), label: 'Constant', page});
    await fillPairAndClickAdd({nameInput: enabledInputs.nth(3), valueInput: enabledtextareas.nth(1), name: 'test_macro', value: 'test_macro_value', addButton: page.locator('button:has-text("Add")').nth(1), label: 'Macro', page});
    await page.getByRole('button', { name: 'Test' }).click();
    await page.waitForTimeout(1000);

    log('--> Refreshing the page...');
    await page.goto('http://localhost:3000/connections/datasources');
    await page.getByRole('link', { name: 'Warp10-Clever-Cloud' }).click();
    await page.waitForTimeout(2000);

    log('--> Verifying values on page...');
    const html = await page.content();
    console.log(html); // see if 'test_constant' is present

    await expect(page.getByText('test_constant', { exact: true })).toBeVisible();
    await expect(page.getByText('test_constant_value', { exact: true })).toBeVisible();

    log('-->Test completed!');
});
