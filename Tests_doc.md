# Warp10 Plugin End-to-End Testing with Playwright

This project implements robust **automated frontend UI and integration tests** for the **Warp10 Grafana plugin** using [Playwright](https://playwright.dev/). With increasing plugin complexity and version fragmentation, these tests help **prevent regressions**, **verify datasource behavior**, and **validate user interaction flows**.

We no longer use Cypress — Playwright is the **officially supported framework** with the Grafana Plugin SDK. These tests are designed to **run both locally** and in **CI environments** (GitHub Actions).

---

## 🧭 Testing Goals

- ✅ Ensure **no regression** is introduced during feature changes
- ✅ Provide confidence while supporting **multiple Grafana versions**
- ✅ Allow local reproducibility without relying on preproduction environments
- ✅ Maintain frontend and integration coverage using **Playwright**
- ✅ Backend logic is handled separately with **Go unit tests**

---

## 📁 File Overview

### 🎯 Scope: One test = One file = One concern

#### `scenario.spec.ts` (Integration)
- **Scope:** General plugin usage scenario
- **Covers:**
    - Create Warp10 **Datasource**
    - Create and open a **Dashboard**
    - Add panel and select datasource
    - Inject queries and receive response from Warp10
- **Goal:** Mimics a real user journey, testing end-to-end flow

#### `datasource_test.spec.ts` (Datasource Component)
- **Scope:** Datasource configuration panel
- **Covers:**
    - All input fields (URL, token, macros, constants)
    - Valid/invalid inputs and form feedback
    - Datasource test & save
    - Health check against `/api/v0/version`
- **Goal:** Prevent misconfiguration and validate form logic

#### `editor_test.spec.ts` (Editor Component)
- **Scope:** WarpScript request editor
- **Covers:**
    - Editor rendering, input support
    - Detection of WarpScript macros (`<% ... %>`)
    - JSON model structure and validation
- **Goal:** Ensure the query editor behaves consistently and supports macro insertion

#### `Warp10_test.spec.ts` (Regression/Test Bed)
- **Scope:** Broad testbed for debugging, version differences, and edge-case testing
- **Covers:**
    - Responses formatting: `table`, `scalar`, `array`, `GTS list`
    - Request parsing and formatting validations
    - Null values, booleans, ints/floats, nested structures
    - GTS time handling (µs in request ➝ ms in response)
- **Goal:** Validate how the plugin handles "problematic queries"

---

## 🧪 Advanced Feature Testing

- **Macro/Constants injection**  
  ↪ Detect and verify availability inside the editor UI

- **Annotations & Variables**  
  ↪ Test dashboard-level interactions that inject runtime variables

- **Data formatting/parsing**
    - Ensure headers are correct
    - JSON responses are interpreted into Grafana's internal structure
    - Respect typing for numbers, booleans, nulls

---

## 🚀 How to Run Locally (With UI Only)

### 1. Start Local Stack

```bash
  docker compose -f docker-compose-plugin.yaml up
```

This launches:
- Warp10 server (`warp10:8080`)
- Grafana server (`grafana:3000`)
- Warp10 preconfigured with a token

### 2. Launch Playwright in UI Mode

```bash
  npx playwright test --ui
```

> 💡 Prefer running each browser individually (Chrome or Firefox).  
> ❌ Do NOT use headless mode locally – browser isolation issues will arise.

---

## ⚙️ GitHub CI (playwright.yml)

Configured to:
- Start Docker stack (Grafana + Warp10)
- Run `npx playwright install` for browsers
- Run tests in **headless mode**
- Ensure compatibility with secrets/mocks

---

## 🧩 Token (warp10.conf)

```conf
warp.token.mytoken = {
  'owner' 'test'
  'producer' 'test'
  'application' 'testapp'
  'ttl' 0
  'labels' { }
}
```

Use this during datasource setup in UI or mocks.

---

## 🧠 Remarks

- One test = one file = one directory (for maintainability)
- UI tests = **Playwright**
- Backend tests = **Go (unit test coverage)**

---

## 📎 References

- [Playwright Docs](https://playwright.dev/docs/intro)
- [Grafana Plugin SDK](https://grafana.com/developers/plugin-tools/)
- [Warp10](https://www.senx.io/warp10/)
- [Grafana Testing Best Practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)
