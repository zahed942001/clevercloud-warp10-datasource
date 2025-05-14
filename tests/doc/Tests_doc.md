# Warp10 QueryEditor E2E Test

**This is a Playwright-based end-to-end test for verifying full Warp10 plugin behavior across Grafana versions.**

This test is designed to run in GitHub Actions CI and locally. It handles dashboard navigation, query injection, datasource configuration, and cleanup. The test adapts to version-specific differences in Grafana (e.g., routes, buttons, testIDs).

---

## What does it test?

- Opening the Query Editor in a dashboard panel
- Detecting and asserting captured `/api/ds/query` responses
- Validating editor content
- Creating a Warp10 datasource (with constants/macros)
- Testing the datasource connection
- Testing availability of constants/macros
- Deleting the datasource afterward
- Supporting both Grafana versions `<10` and `>=10`

---

## How to run locally

```bash
# Start Grafana and Warp10 in Docker
docker-compose -f tests/config/docker-compose-plugin.yaml up -d

# Run the E2E test
npx playwright test tests/plugin_test.spec.ts

