# Warp10 Plugin End-to-End Testing with Playwright

#### This project implements robust **automated frontend UI and integration tests** for the **Warp10 Grafana plugin** using **Playwright**. With increasing plugin complexity and version fragmentation, these tests help **prevent regressions**, **verify datasource behavior**, and **validate user interaction flows**.

We no longer use Cypress — Playwright is the **officially supported framework** with the Grafana Plugin SDK. These tests are designed to **run both locally** and in **CI environments** (GitHub Actions).

---

## Testing Goals

- Provide confidence while supporting **multiple Grafana versions**
- Allow local reproducibility without relying on preproduction environments
- Maintain frontend and integration coverage using **Playwright**

---

## How to Run Locally (With UI Only)

### 1. Start Local Stack

```bash
  docker compose -f docker-compose-plugin.yaml up
```

This launches:
- Warp10 server (`warp10:8080`)
- Grafana server (`grafana:3000`)
- Warp10 preconfigured with a mock token

### 2. Launch Playwright in UI Mode

```bash
  npx playwright test --ui
```

> 💡 Prefer running each browser individually (Chrome or Firefox).  

---

## GitHub CI (playwright.yml)

Configured to:
- Start Docker stack (Grafana + Warp10)
- Run `npx playwright install` for browsers

---

## Token (warp10.conf)

```conf
warp.token.mytoken = {
  'owner' 'test'
  'producer' 'test'
  'application' 'testapp'
  'ttl' 0
  'labels' { }
}
```

---

## File Overview

### Scope: One test = One file

#### `scenario.spec.ts` (Integration)
#### `datasource_test.spec.ts` (Datasource Component)
#### `editor_test.spec.ts` (Editor Component)
#### `Warp10_test.spec.ts` (Regression/Test Bed)

---


## Integration Scenario: Warp10 Datasource End-to-End Test

This scenario validates the entire lifecycle of a Warp10 datasource within Grafana.It covers creation, configuration, query validation, error handling, and cleanup for the Warp10 datasource in Grafana.  
Each step includes explicit verification to ensure correct and robust implementation.


### Steps

1. **Create and Initialize Warp10 Datasource**
   - Instantiate a new Warp10 datasource from the Grafana UI.
   - Set the datasource name (`test_warp10`) and the backend URL (`http://warp10:8080`).
   - Save and test the connection. Confirm that the health check message indicates a successful connection.
   - Attempt to misconfigure the URL required fields to ensure that errors are correctly reported.

2. **Create Dashboard and Add Panel**
   - Create a new dashboard and open the panel editor.
   - Ensure that the dashboard is created and the panel editor loads as expected.

3. **Select the Warp10 Datasource**
   - In the panel editor, select the newly created `test_warp10` datasource.
   - Confirm that the selected datasource is active for the panel.

4. **Inject and Execute Query**
   - Enter a valid Warp10 query (`1 2 +`) into the query editor.
   - Run the query and capture the `/api/ds/query` response.
   - Assert that the response status is `200 OK` and that the result matches the expected output.

5. **Datasource Configuration Validation**
   - Deliberately input an invalid URL.
   - Confirm that the "Save & Test" operation fails and an appropriate error message is displayed.

6. **Cleanup**
   - Delete the `test_warp10` datasource from the management page.
   - Confirm that the datasource is no longer listed among available datasources.

---

## Datasource Component: Warp10 Datasource Configuration and Healthcheck

This test validates the configuration interface for the Warp10 datasource in Grafana.
It covers all input validation, positive/negative feedback for configuration, health check integration with the Warp10 backend, and data persistence for the Warp10 datasource setup in Grafana.  
Every step includes explicit checks for correct field handling, user feedback, backend health, and form persistence.

### Steps

1. **Validate All Input Fields**
   - Open the new Warp10 datasource creation form.
   - **Fields Tested:**
      - URL
      - Macros (name and value)
      - Constants (name and value)
   - Ensure all required fields are visible and interactable.

2. **Datasource Test & Save**
   - Use the "Save & Test" feature after filling the form.
   - Confirm that a health check is performed.
   - Verify that a successful health check message is returned for valid configuration.
   - For invalid configuration, confirm a clear and descriptive error is shown.

3. **Health Check Endpoint Validation**
   - Confirm that the datasource component makes a health check call against `/api/v0/version` (through `/health` endpoint).
   - For a healthy Warp10 backend, verify that the health check passes.
   - For a misconfigured backend or unreachable URL, verify that the error is detected and shown in the UI.

4. **Persistence and Reload**
   - Save valid configuration with macros and constants, then reload the page.
   - Confirm that all previously entered values (macros, constants, token, URL) persist and are displayed correctly after reload.

5. **Cleanup**
   - Delete the test datasource.
   - Confirm that the datasource no longer appears in the list of available datasources.

---

## Editor Component Scenario: Warp10 Query Editor Rendering & Validation

This scenario tests the Warp10 query editor component in Grafana. It covers query editor rendering, advanced WarpScript macro support, outbound query model validation, and correctness of the user’s script content.  
Each step includes explicit checks for rendering, input flexibility, macro detection, and correctness of the underlying data model exchanged with the backend.


### Steps

1. **Editor Rendering and Visibility**
   - Navigate to a dashboard and open the panel query editor.
   - Assert that the query editor is both attached to the DOM and visible.

2. **Internal JSON Model Structure and Validation**
   - Trigger a query execution from the editor.
   - Intercept the outgoing `/api/ds/query` POST request and capture its response.
   - Check that the response has status `200 OK`.
   - Assert that the returned JSON model includes the expected structure (`results.A`, schema, data array, etc.).
   - Confirm that the schema name is a string and data values are valid arrays.
   - For each response, log and check the integrity of the model (status codes, array types, field existence).

3. **Editor Content Validation**
   - Inspect the editor’s value after query injection.
   - Ensure that the entire WarpScript appears as expected, matching a predefined script.


---

## Regression/Test Bed Scenario: Warp10 Request and Response Validation

This scenario provides comprehensive coverage of request parsing and response formatting for the Warp10 datasource in Grafana.  
It ensures robust handling of all Warp10 datasource request/response permutations, including value type support, macro parsing, empty/null series, and timestamp integrity.  
It is intended as both a regression suite and a test bed for data layer validation.

### Steps

1. **Format Coverage: Table, Scalar, Array, and GTS List**
   - Submit queries that return results in all supported formats:
      - Scalar GTS (single value)
      - Array and table format (multiple values)
      - List of GTS (with and without datapoints)
   - Assert that the response structure in each case matches expectations. Check frame types, data arrays, and table shape.

2. **Data Type Validation**
   - Submit separate requests for each value type supported by Warp10:
      - Integer (`int`)
      - Float (`float`)
      - String (`string`)
      - Boolean (`boolean`)
   - Confirm that each value type is correctly preserved in the backend response and rendered with correct JS types (number, string, boolean, etc.).

3. **Null and Empty Values**
   - Test with GTS time series that have no datapoints (simulate null/empty).
   - Ensure the API response includes empty arrays for such GTS and that no data values are present.

4. **Timestamp Conversion**
   - Submit GTS data with input timestamps in microseconds.
   - Ensure all response timestamps are converted and returned in milliseconds (Grafana-compatible).

5. **Response Model Structure**
   - For each response, inspect the returned JSON:
      - Confirm presence and correctness of `results.A.frames`
      - Check schema metadata (name, field types)
      - Assert that all value arrays are of consistent length and type
   - Log for each type of test and validate fields according to specification.

6. **Partial and Nested Responses**
   - Create responses containing both GTS with and without data, and nested data structures if supported.
   - Validate correct separation between filled and empty series, and proper handling of nested data (if applicable).

    
---
