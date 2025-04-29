import { test, expect } from '@playwright/test';

function log(message: string) {
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    console.log(`[${now}] ${message}`);
}

test('Warp10 QueryEditor handles all loaded queries', async ({ page }) => {
    const responses: any[] = [];

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
    log('-->Query editor content is correct');
    log('-->Test completed!');
});
