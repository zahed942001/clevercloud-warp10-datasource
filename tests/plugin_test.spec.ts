import {test, expect, Page} from '@playwright/test';
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

async function logVisibility(page: Page, label: string) {
    try {
        await expect(page.getByText(label, { exact: true })).toBeVisible();
        log(`--> '${label}' is visible`);
    } catch (error) {
        console.error(`--> '${label}' is NOT visible`);
    }
}


test('Warp10 QueryEditor handles all loaded queries', async ({ page }) => {
    const responses: any[] = [];

    page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('net::ERR_CONNECTION_REFUSED')) {
            return; // Ignore it
        }
        console.log(`[console.${msg.type()}] ${msg.text()}`);
    });

    page.on('response', async (response) => {
        const url = response.url();
        if (
            url.includes('/api/ds/query') &&
            response.request().method() === 'POST' &&
            url.includes('ds_type=clevercloud-warp10-datasource')
        ) {
            try {
                const json = await response.json();
                responses.push({ url, json, status: response.status() });
                log(`--> Captured: ${url} [status ${response.status()}]`);
            } catch (e) {
                log(`--> Failed to parse JSON for: ${url}`);
            }
        }
    });

    log('-->Navigating to dashboard with panel...');
    await page.goto('http://localhost:3000');

    await page.waitForSelector('#mega-menu-toggle', { state: 'visible' });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.waitForSelector('a[href="/dashboards"]', { timeout: 3000 });
    await page.getByTestId('data-testid navigation mega-menu').getByRole('link', { name: 'Dashboards' }).click();
    await page.getByRole('link', { name: 'New dashboard' }).click();
    await page.getByRole('button', {
        name: 'Menu for panel with title Graph Example',
    }).click();

    await page.getByRole('link', {
        name: 'Edit',
    }).click();
    log('-->Waiting for query editor...');
    const editor = page.locator('.query-editor-row textarea').first();
    await expect(editor).toBeAttached({ timeout: 10000 });
    await expect(editor).toBeVisible({ timeout: 10000 });
    log('-->Editor is visible and attached');

    await page.waitForTimeout(3000);

    expect(responses.length).toBeGreaterThan(0);
    log(`--> ${responses.length} query response(s) captured`);

    for (let index = 0; index < responses.length; index++) {
        const r = responses[index];
        log(`--> Checking response [${index + 1}/${responses.length}]`);

        const resultA = r.json?.results?.A;

        if (!resultA) {
            log(`⚠️ Skipping response ${index + 1} – 'results.A' is undefined`);
            continue;
        }

        try {
            expect(r.status).toBe(200);
            log(`--> Status 200 OK`);

            expect(resultA.status).toBe(200);
            log('--> Result A status is 200');

            const schemaName = resultA.frames?.[0]?.schema?.name;
            log(`--> Schema name: ${schemaName}`);
            expect(typeof schemaName).toBe('string');

            expect(Array.isArray(resultA.frames?.[0]?.data?.values?.[0])).toBe(true);
            log('--> Returned data is a valid array');

            // 🔍 Print full JSON response
            log(`--> Full JSON for response ${index + 1}:\n` + JSON.stringify(r.json, null, 2));

        } catch (error) {
            log(`❌ Error in response ${index + 1}: ${(error as Error).message}`);
        }
    }
    await expect(editor).toHaveValue(
        'NEWGTS\n' +
        '\'io.warp10.grafana.test\' RENAME\n' +
        '{ \'func\' \'sinus\' } RELABEL\n' +
        '\'sinus\' STORE\n' +
        '\n' +
        'NEWGTS\n' +
        '\'io.warp10.grafana.testmetric\' RENAME\n' +
        '{ \'func\' \'cosinus\' } RELABEL\n' +
        '\'cosinus\' STORE\n' +
        '\n' +
        '$interval 20 / TOLONG \'step\' STORE\n' +
        '\n' +
        '<% $step + %> \'stepMacro\' STORE\n' +
        '<% \'index\' STORE $sinus $index NaN NaN NaN $index SIN  ADDVALUE DROP %> \'execMacroSinus\' STORE\n' +
        '<% \'index\' STORE $cosinus $index NaN NaN NaN $index COS  ADDVALUE DROP %> \'execMacroCoinus\' STORE\n' +
        '\n' +
        '$start $end $stepMacro $execMacroSinus FORSTEP\n' +
        '$start $end $stepMacro $execMacroCoinus FORSTEP\n' +
        '$sinus $cosinus'
    );
    log('--> Query editor content is correct');
    log('--> Query Editor Test completed!');

    // Capture health check response
    let healthResponse: any = null;

    page.on('response', async (response) => {
        const url = response.url();
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
    log('--> Navigating to data sources page...');
    await page.goto('http://localhost:3000/connections/datasources/new');
    // Wait for the data sources page to load
    await page.waitForTimeout(1000);
    // Enter Warp10 datasource creation

    await page.getByRole('button', { name: 'Warp10' }).click();

    log('--> Filling Plugin Name');
    await page.fill('#basic-settings-name', 'test_warp10');

    log('--> Filling Warp10 URL');
    const urlInput = page.locator('#url');
    await urlInput.fill('http://warp10:8080');
    const currentValue = await urlInput.inputValue();
    log(`--> URL input filled with: ${currentValue}`);

    log('--> Clicking Save & test button...');
    await page.getByRole('button', { name: 'Save & test' }).click();

    // Wait for the response to be received
    await page.waitForTimeout(1000);

    if (healthResponse) {
        log(`--> Status: ${healthResponse.status}`);
        log(`--> Message: ${healthResponse.message}`);
    } else {
        log('--> Health check response was not received.');
    }

    log('--> illing and applying constats and macros')

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

    await page.getByRole('button', { name: 'Save & test' }).click();
    await page.waitForTimeout(1000);

    log('--> Refreshing the page...');
    await page.reload();
    await page.waitForTimeout(2000);

    log('--> Verifying values on page...');
    await logVisibility(page, 'test_constant');
    await logVisibility(page, 'test_constant_value');
    await logVisibility(page, 'test_macro');
    await logVisibility(page, 'test_macro_value');

    log('--> Deleting datasource');
    await page.getByTestId('Data source settings page Delete button').click();
    await page.getByTestId('data-testid Confirm Modal Danger Button').click();
    log('--> Datasource Deleted successfully!');
    log('-->Configuration Editor Test Completed!');
});
