import { test } from '@playwright/test';

function log(message: string) {
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    console.log(`[${now}] ${message}`);
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
    await page.waitForTimeout(500);

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

    log('-->Test completed!');
});
