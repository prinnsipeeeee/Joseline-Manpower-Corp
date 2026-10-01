# Joseline Manpower landing page

Static HTML, CSS, and browser ES modules. Serve the repository over HTTP/HTTPS; no frontend build is required. Firebase continues to handle the existing inquiry form and website dashboard. CV submissions and published job listings use the Laravel admin API independently of Firebase.

## Connect CV submissions

Edit `site-config.js`:

```js
export const siteConfig = Object.freeze({
  apiBaseUrl: 'https://your-admin-host.example/api/v1',
  agencyUuid: 'the-joseline-agency-uuid',
});
```

Use the UUID from Joseline's agency record in Laravel, not its numeric database ID. Do not put passwords or API keys in this configuration. Blank or invalid configuration disables CV submission and displays an availability message.

Publish the intended openings under Joseline in Laravel before deployment. The jobs section loads the existing paginated job API, renders six cards per page, and filters by country. No hardcoded job-to-UUID mapping is used. The CV form defaults to a general submission and remains available when job loading fails.

Deploy the backend changes first, then the static site. Verify API CORS, PHP/proxy upload limits (5 MB plus multipart overhead), private storage permissions, and a test upload/recruiter download. Detailed backend release instructions are in `admin-agency/docs/cv-submissions.md`.

## Tests

```sh
npm ci
npm test
```

Tests use Node's test runner and jsdom to check the form, mocked API errors, job selection, country filtering, pagination, and Firebase independence. Development dependencies are used only for tests and are not needed by the deployed website. Do not perform visual QA on live pages.
