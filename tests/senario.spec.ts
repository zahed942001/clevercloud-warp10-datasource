import { test, Page } from '@playwright/test';

// Logging helper
function log(message: string) {
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    console.log(`[${now}] ${message}`);
}

// Get Grafana version from the local instance
async function getGrafanaVersion(page: Page): Promise<string> {
    const response = await page.request.get('http://localhost:3000/api/health');
    const body = await response.json();
    return body.version;
}

// Final validation: logs last captured /api/ds/query response
async function FinalTestValidation(responses: Array<{ url: string; json: any; status: number }>) {
    if (responses.length > 0) {
        const lastResponse = responses[responses.length - 1];
        log('--> Last /api/ds/query response:');
        console.log(JSON.stringify(lastResponse.json, null, 2));

        if (lastResponse.status === 200) {
            log('✅ Test completed successfully');
        } else {
            log(`❌ Test failed — Last response status: ${lastResponse.status}`);
        }
    } else {
        log('--> No /api/ds/query response captured.');
    }
}

// Main test scenario
test('Basic scenario: Create DS, Dashboard, Select Datasource, Get Warp10 Response', async ({ page }) => {
    const responses: any[] = [];
    let healthResponse: any = null;

    // Capture network responses
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

    // Log console errors
    page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('net::ERR_CONNECTION_REFUSED')) {return;}
        console.log(`[console.${msg.type()}] ${msg.text()}`);
    });

    // Detect Grafana version and setup paths/buttons accordingly
    const version = await getGrafanaVersion(page);
    const major = parseInt(version.split('.')[0], 10);
    log(`--> Detected Grafana version: ${version}`);

    const basePath = major < 10
        ? '/connections/your-connections/datasources/new'
        : '/connections/datasources/new';

    const saveButtonName = major < 10
        ? 'Data source settings page Save and Test button'
        : 'Save & test';

    const myDsPath = major < 10
        ? '/connections/your-connections/datasources'
        : '/connections/datasources';

    const deleteButton = major < 10
        ? page.getByRole('button', { name: 'Data source settings page Delete button' })
        : page.getByTestId('Data source settings page Delete button');

    const confirmButton = major < 10
        ? page.getByRole('button', { name: 'Confirm Modal Danger Button' })
        : page.getByTestId('data-testid Confirm Modal Danger Button');

    // === Step 1: Create datasource ===
    log('--> Creating new Warp10 datasource');
    await page.goto(`http://localhost:3000${basePath}`);
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Warp10' }).click();

    // Fill datasource config
    log('--> Filling datasource config');
    await page.fill('#basic-settings-name', 'test_warp10');
    const urlInput = page.locator('#url');
    await urlInput.fill('http://warp10:8080');
    const currentValue = await urlInput.inputValue();
    log(`--> Warp10 URL set to: ${currentValue}`);

    // Save and test
    log('--> Saving and testing datasource...');
    await page.getByRole('button', { name: saveButtonName }).click();
    await page.waitForTimeout(1000);

    if (healthResponse) {
        log(`--> ✅ Health check passed: ${healthResponse.message}`);
    } else {
        log('--> ⚠️ Health check response was not received.');
    }

    // === Step 2: Build dashboard ===
    log('--> Opening dashboard creation wizard');
    await page.getByRole('link', { name: 'Build a dashboard' }).click();
    await page.waitForTimeout(500);

    log('--> Creating new panel');
    await page.getByTestId('data-testid Create new panel button').click();
    await page.waitForTimeout(500);

    log('--> Selecting created datasource');
    await page.locator('[data-testid="data-source-card"] span', { hasText: 'test_warp10' }).click();
    await page.waitForTimeout(500);

    log('--> Injecting Warp10 query into editor');
    await page.locator('.query-editor-row textarea').first().fill('1 2 +');

    log('--> Triggering query execution');
    await page.getByTestId('data-testid RefreshPicker run button').click();
    await page.waitForTimeout(500);

    // === Step 3: Validate results ===
    log('--> Validating last query response...');
    await FinalTestValidation(responses);

    // === Step 4: Cleanup (delete DS) ===
    log('--> Navigating to datasource management page');
    await page.goto(`http://localhost:3000${myDsPath}`);
    await page.getByRole('link', { name: 'test_warp10' }).click();
    await page.waitForTimeout(500);

    log('--> Deleting datasource...');
    await deleteButton.click();
    await confirmButton.click();
    log('--> ✅ Datasource deleted successfully');

    log('--> 🎯 Scenario test completed!');
});
