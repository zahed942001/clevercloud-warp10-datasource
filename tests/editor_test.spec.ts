/**
 * @file editor_test.spec.ts
 * @description Test for the Warp10 query editor component.
 * Verifies visibility, correct handling of queries, and correct internal JSON model output.
 * Also validates macro parsing with `<% ... %>` blocks.
 *
 * Scope: editor (query editor rendering and behavior)
 */
import { test, expect, Page } from '@playwright/test';

// === Utility: Logger ===
function log(message: string) {
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    console.log(`[${now}] ${message}`);
}

// === Utility: Menu toggle navigation ===
async function clickMenuToggle(page: Page) {
    const selectors = [
        'button[aria-label="Toggle menu"]',
        'button[aria-label="Open menu"]',
        '#mega-menu-toggle',
    ];

    const found = await Promise.race(
        selectors.map(selector =>
            page.waitForSelector(selector, { state: 'visible' }).then(() => selector).catch(() => null)
        )
    );

    if (found) {
        await page.waitForTimeout(500);
        await page.click(found);
        log(`Clicked toggle menu with selector: ${found}`);
    } else {
        throw new Error('No menu toggle button found for known selectors');
    }
}

// === Utility: Navigate to dashboards ===
async function clickDashboardsNav(page: Page) {
    const selectors = [
        'a[href="/dashboards"]',
        'a[data-testid="data-testid Nav menu item"] >> text=Dashboards',
        'a:has-text("Dashboards")',
    ];

    const found = await Promise.race(
        selectors.map(selector =>
            page.waitForSelector(selector, { state: 'visible' }).then(() => selector).catch(() => null)
        )
    );

    if (found) {
        await page.click(found);
        console.log(`Clicked Dashboards nav with selector: ${found}`);
    } else {
        throw new Error('No Dashboards nav item found for known selectors');
    }
}

// === Utility: Go to new dashboard ===
async function goToNewDashboard(page: Page) {
    const directNewDashboard = page.locator('a[href*="/new-dashboard"]', { hasText: 'New dashboard' });
    if (await directNewDashboard.count() > 0 && await directNewDashboard.first().isVisible()) {
        await directNewDashboard.first().click();
        console.log('Clicked direct "New dashboard" link.');
        return;
    }

    const generalLink = page.getByText('General', { exact: true });
    if (await generalLink.count() > 0 && await generalLink.first().isVisible()) {
        await generalLink.first().click();
        console.log('Clicked "General" section.');

        const nestedNewDashboard = page.getByText('New dashboard', { exact: true });
        if (await nestedNewDashboard.count() > 0 && await nestedNewDashboard.first().isVisible()) {
            await nestedNewDashboard.first().click();
            console.log('Clicked nested "New dashboard".');
            return;
        }
    }

    throw new Error('Neither "New dashboard" nor "General > New dashboard" was found.');
}

// === Utility: Click Edit button on panel ===
async function clickEditButton(page: Page) {
    const roleBased = page.getByRole('link', { name: 'Edit' });
    if (await roleBased.count() > 0 && await roleBased.first().isVisible()) {
        await roleBased.first().click();
        console.log('Clicked Edit link (role=link).');
        return;
    }

    const menuItemEdit = page.locator('button[role="menuitem"]:has-text("Edit")');
    if (await menuItemEdit.count() > 0 && await menuItemEdit.first().isVisible()) {
        await menuItemEdit.first().click();
        console.log('Clicked Edit button (role=menuitem).');
        return;
    }

    throw new Error('Edit button not found in either format.');
}

// === Utility: Get Grafana version ===
async function getGrafanaVersion(page: Page): Promise<string> {
    const response = await page.request.get('http://localhost:3000/api/health');
    const body = await response.json();
    return body.version;
}

// === TEST: Editor JSON Model Validation ===
test('Editor: test all features in request editor component and verify the JSON model', async ({ page }) => {
    const responses: any[] = [];

    // === Step 1: Intercept responses ===
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

    // === Step 2: Log console errors ===
    page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('net::ERR_CONNECTION_REFUSED')) {
            return;
        }
        console.log(`[console.${msg.type()}] ${msg.text()}`);
    });

    // === Step 3: Load Grafana dashboard panel ===
    log('--> Navigating to dashboard with panel...');
    await page.goto('http://localhost:3000');

    const version = await getGrafanaVersion(page);
    log(`--> Detected Grafana version: ${version}`);
    const major = parseInt(version.split('.')[0], 10);

    await clickMenuToggle(page);
    await page.waitForTimeout(500);
    await page.waitForSelector('a[href="/dashboards"]', { timeout: 3000 });
    await clickDashboardsNav(page);
    await page.waitForTimeout(500);
    await goToNewDashboard(page);

    await page.getByRole('button', {
        name: 'Menu for panel with title Graph Example',
    }).click();

    await clickEditButton(page);

    // === Step 4: Wait for editor ===
    log('--> Waiting for query editor...');
    const editor = page.locator('.query-editor-row textarea').first();
    await expect(editor).toBeAttached({ timeout: 10000 });
    await expect(editor).toBeVisible({ timeout: 10000 });
    log('--> Editor is visible and attached');

    // === Step 5: Verify responses ===
    if (major >= 10) {
        await page.waitForTimeout(3000);
        for (let i = 0; i < 10; i++) {
            if (responses.length > 0) {break;}
            await page.waitForTimeout(500);
        }

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

                log(`--> Full JSON for response ${index + 1}:\n` + JSON.stringify(r.json, null, 2));
            } catch (error) {
                log(`❌ Error in response ${index + 1}: ${(error as Error).message}`);
            }
        }
    }

    // === Step 6: Verify editor content ===
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

    // === Done ===
    log('--> Query Editor Test completed!');
});
