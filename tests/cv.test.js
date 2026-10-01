import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { initCv, validateApplicant, configured } from '../cv.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const config = { apiBaseUrl: 'https://admin.example/api/v1', agencyUuid: '11111111-1111-4111-8111-111111111111' };
const job = (number, country = 'Saudi Arabia') => ({ uuid: `22222222-2222-4222-8222-${String(number).padStart(12, '0')}`, title: `Opening ${number}`, country, is_published: 1, description_excerpt: 'Skilled work' });
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(fetcher) {
  const dom = new JSDOM(html, { url: 'https://joseline.example' });
  const { document } = dom.window;
  const cv = initCv(document, config, fetcher, dom.window.FormData);
  return { dom, document, cv, form: document.getElementById('cv-form') };
}
function fill({ dom, form }) {
  for (const [key, value] of Object.entries({ first_name: ' Juan ', last_name: 'Dela Cruz', email: 'juan@example.com', contact_number: '+639171234567' })) form.elements.namedItem(key).value = value;
  form.elements.namedItem('accepted_terms_and_condition').checked = true;
  const file = new dom.window.File(['%PDF-1.4'], 'resume.pdf', { type: 'application/pdf' });
  Object.defineProperty(form.elements.namedItem('resume'), 'files', { configurable: true, value: [file] });
}
function submit(ctx) { ctx.form.dispatchEvent(new ctx.dom.window.Event('submit', { bubbles: true, cancelable: true })); }

test('form sits between jobs and deployment; independent CV module; no duplicate IDs introduced', () => {
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.getElementById('jobs').nextElementSibling.id, 'submit-cv');
  assert.equal(doc.getElementById('submit-cv').nextElementSibling.id, 'deployment');
  assert.ok(doc.querySelector('script[type="module"][src="cv.js"]'));
  assert.ok(!readFileSync(new URL('../cv.js', import.meta.url), 'utf8').includes('firebase'));
  for (const input of doc.querySelectorAll('#cv-form [id]')) assert.equal(doc.querySelectorAll(`#${input.id}`).length, 1);
  assert.equal(doc.querySelector('#cv-accepted_terms_and_condition').checked, false);
  assert.ok(doc.querySelector('#inquiry-form'));
});

test('missing configuration disables CV submission without making requests', async () => {
  const doc = new JSDOM(html).window.document;
  const cv = initCv(doc, { apiBaseUrl: '', agencyUuid: '' }, () => assert.fail('must not fetch'));
  await cv.ready;
  assert.equal(doc.getElementById('cv-fields').disabled, true);
  assert.equal(doc.getElementById('cv-config-status').hidden, false);
  assert.equal(configured(config), true);
  assert.equal(configured({ ...config, apiBaseUrl: 'javascript:alert(1)' }), false);
});

test('loads all API pages, renders country filters and six-card pagination, selects actual job UUID', async () => {
  const requests = [];
  const ctx = setup(async url => {
    requests.push(url);
    return response(200, { data: url.endsWith('page=1') ? Array.from({ length: 6 }, (_, i) => job(i + 1)) : [job(7, 'Greece')], meta: { last_page: 2 } });
  });
  await ctx.cv.ready;
  assert.equal(requests.length, 2);
  assert.equal(ctx.document.querySelectorAll('.job-card').length, 6);
  assert.equal(ctx.form.elements.namedItem('job_id').options.length, 8);
  ctx.document.querySelector('.job-apply-btn').click();
  assert.equal(ctx.form.elements.namedItem('job_id').value, job(1).uuid);
  ctx.document.querySelector('[data-general-cv]').click();
  assert.equal(ctx.form.elements.namedItem('job_id').value, '');
  [...ctx.document.querySelectorAll('#jobs-pagination button')].find(el => el.textContent === 'Next').click();
  assert.equal(ctx.document.querySelectorAll('.job-card').length, 1);
  [...ctx.document.querySelectorAll('#job-country-filters button')].find(el => el.textContent === 'Greece').click();
  assert.equal(ctx.document.querySelector('.job-card h3').textContent, 'Opening 7');
});

test('job titles and excerpts are rendered as text, not HTML', async () => {
  const ctx = setup(async () => response(200, { data: [{ ...job(1), title: '<img onerror="alert(1)">', description_excerpt: '<script>bad</script>' }], meta: { last_page: 1 } }));
  await ctx.cv.ready;
  assert.equal(ctx.document.querySelector('.job-card h3').textContent, '<img onerror="alert(1)">');
  assert.equal(ctx.document.querySelectorAll('.job-card script').length, 0);
});

test('job loading failure offers retry and leaves general submission enabled', async () => {
  let fail = true;
  const ctx = setup(async () => { if (fail) throw new Error('offline'); return response(200, { data: [], meta: { last_page: 1 } }); });
  await ctx.cv.ready;
  assert.equal(ctx.document.getElementById('cv-fields').disabled, false);
  assert.match(ctx.document.getElementById('jobs-status').textContent, /general CV/);
  fail = false;
  ctx.document.querySelector('#jobs-status button').click();
  await tick();
  assert.match(ctx.document.getElementById('jobs-status').textContent, /No openings/);
});

test('client validation rejects absent consent, wrong formats and files over 5 MB', () => {
  const data = new Map([['first_name', 'Juan'], ['last_name', 'Cruz'], ['email', 'juan@example.com'], ['contact_number', '123']]);
  assert.ok(validateApplicant(data, { name: 'cv.pdf', size: 100 }).accepted_terms_and_condition);
  data.set('accepted_terms_and_condition', '1');
  assert.ok(validateApplicant(data, { name: 'cv.exe', size: 100 }).resume);
  assert.ok(validateApplicant(data, { name: 'cv.pdf', size: 5 * 1024 * 1024 + 1 }).resume);
  assert.deepEqual(validateApplicant(data, { name: 'cv.docx', size: 5 * 1024 * 1024 }), {});
});

test('invalid form highlights fields and does not submit', async () => {
  let requests = 0;
  const ctx = setup(async () => { requests++; return response(200, { data: [] }); });
  await ctx.cv.ready;
  submit(ctx);
  assert.equal(requests, 1);
  assert.equal(ctx.form.elements.namedItem('first_name').getAttribute('aria-invalid'), 'true');
  assert.equal(ctx.document.getElementById('cv-error-resume').hidden, false);
});

test('submission uses multipart names, prevents repeat clicks, resets only after confirmed success', async () => {
  let finish, sent;
  let posts = 0;
  const ctx = setup(async (url, options) => {
    if (!options.method) return response(200, { data: [] });
    posts++; sent = options;
    return new Promise(resolve => { finish = resolve; });
  });
  await ctx.cv.ready;
  fill(ctx);
  submit(ctx); submit(ctx);
  assert.equal(posts, 1);
  assert.equal(ctx.document.getElementById('cv-fields').disabled, true);
  assert.equal(sent.body.get('first_name'), 'Juan');
  assert.equal(sent.body.get('accepted_terms_and_condition'), '1');
  assert.equal(sent.headers['Content-Type'], undefined);
  finish(response(201, { message: 'CV received', application_id: 1 }));
  await tick();
  assert.equal(ctx.form.elements.namedItem('first_name').value, '');
  assert.equal(ctx.document.getElementById('cv-status').textContent, 'CV received');
  assert.equal(ctx.document.getElementById('cv-status').hidden, false);
  assert.equal(ctx.document.getElementById('cv-fields').disabled, false);
});

for (const code of [422, 429, 413, 500]) {
  test(`HTTP ${code} retains inputs and re-enables submission`, async () => {
    const ctx = setup(async (url, options) => options.method ? response(code, { errors: { job_id: ['Opening unavailable'] } }) : response(200, { data: [] }));
    await ctx.cv.ready; fill(ctx); submit(ctx); await tick();
    assert.equal(ctx.form.elements.namedItem('first_name').value, ' Juan ');
    assert.equal(ctx.document.getElementById('cv-fields').disabled, false);
    assert.equal(ctx.document.getElementById('cv-status').hidden, false);
    if (code === 422) assert.equal(ctx.document.getElementById('cv-error-job_id').textContent, 'Opening unavailable');
  });
}

test('network failure retains selected file and applicant details', async () => {
  const ctx = setup(async (url, options) => { if (options.method) throw new Error('offline'); return response(200, { data: [] }); });
  await ctx.cv.ready; fill(ctx);
  ctx.form.elements.namedItem('resume').dispatchEvent(new ctx.dom.window.Event('change'));
  submit(ctx); await tick();
  assert.equal(ctx.document.getElementById('cv-filename').textContent, 'resume.pdf');
  assert.equal(ctx.form.elements.namedItem('first_name').value, ' Juan ');
  assert.match(ctx.document.getElementById('cv-status').textContent, /could not confirm/);
});
