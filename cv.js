import { siteConfig } from './site-config.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function configured(config) {
  try {
    const url = new URL(config.apiBaseUrl);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && UUID.test(config.agencyUuid);
  } catch { return false; }
}

export function validateApplicant(data, file) {
  const errors = {};
  for (const key of ['first_name', 'last_name', 'email', 'contact_number']) {
    if (!String(data.get(key) || '').trim()) errors[key] = 'Please fill in this field.';
  }
  if (data.get('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.get('email').trim())) errors.email = 'Please enter a valid email address.';
  for (const key of ['first_name', 'last_name', 'middle_name', 'contact_number', 'email']) {
    if (String(data.get(key) || '').length > 100) errors[key] = 'Use no more than 100 characters.';
  }
  if (String(data.get('cover_letter') || '').length > 300) errors.cover_letter = 'Use no more than 300 characters.';
  if (data.get('accepted_terms_and_condition') !== '1') errors.accepted_terms_and_condition = 'Please give your consent before submitting.';
  if (!file || !file.size) errors.resume = 'Please select your CV.';
  else if (!/\.(pdf|doc|docx)$/i.test(file.name)) errors.resume = 'Choose a PDF, DOC, or DOCX file.';
  else if (file.size > MAX_FILE_SIZE) errors.resume = 'Your CV must be 5 MB or smaller.';
  return errors;
}

export function initCv(doc, config, fetcher = globalThis.fetch, FormDataClass = globalThis.FormData) {
  const form = doc.getElementById('cv-form');
  if (!form) return;
  const fields = doc.getElementById('cv-fields');
  const submit = doc.getElementById('cv-submit');
  const status = doc.getElementById('cv-status');
  const select = doc.getElementById('cv-job_id');
  const resume = doc.getElementById('cv-resume');
  const grid = doc.getElementById('jobs-grid');
  const jobsStatus = doc.getElementById('jobs-status');
  const filters = doc.getElementById('job-country-filters');
  const pagination = doc.getElementById('jobs-pagination');
  let jobs = [], country = '', page = 1, submitting = false;
  const base = String(config.apiBaseUrl || '').replace(/\/+$/, '');
  const endpoint = `${base}/application/${config.agencyUuid}`;

  const element = (tag, className, text) => {
    const el = doc.createElement(tag);
    el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const showStatus = (message, error = false) => {
    status.hidden = false;
    status.textContent = message;
    status.className = `mt-4 text-sm ${error ? 'text-red-700' : 'text-green-700'}`;
  };
  function showErrors(errors) {
    form.querySelectorAll('[data-error]').forEach(el => {
      const key = el.dataset.error;
      const error = errors[key];
      el.textContent = Array.isArray(error) ? error.join(' ') : (error || '');
      el.hidden = !error;
      const input = form.elements.namedItem(key);
      if (input) input.setAttribute('aria-invalid', error ? 'true' : 'false');
    });
    if (Object.keys(errors).length) {
      form.querySelector('[aria-invalid="true"]')?.focus();
    }
  }
  function chooseJob(uuid = '') {
    select.value = uuid;
    doc.getElementById('submit-cv').scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    select.focus({ preventScroll: true });
  }
  doc.querySelectorAll('[data-general-cv]').forEach(link => {
    link.addEventListener('click', () => chooseJob());
  });
  resume.addEventListener('change', () => {
    doc.getElementById('cv-filename').textContent = resume.files[0]?.name || 'No file selected';
  });

  if (!configured(config)) {
    fields.disabled = true;
    const warning = doc.getElementById('cv-config-status');
    warning.hidden = false;
    warning.textContent = 'CV submission is temporarily unavailable. Please contact our office for assistance.';
    jobsStatus.textContent = 'Job openings are temporarily unavailable. Please contact our office.';
    return { ready: Promise.resolve() };
  }

  function renderJobs() {
    const visible = jobs.filter(job => !country || job.country === country);
    const pages = Math.max(1, Math.ceil(visible.length / 6));
    page = Math.min(page, pages);
    grid.replaceChildren();
    for (const job of visible.slice((page - 1) * 6, page * 6)) {
      const card = element('div', 'job-card card-hover bg-white rounded-2xl p-6 border border-slate-200 shadow-sm');
      const image = element('img', 'w-12 h-12 rounded-xl object-cover mb-4');
      image.src = 'images/Logo3.png';
      image.alt = '';
      card.append(image, element('h3', 'font-display text-xl font-bold text-primary-950 mb-2', job.title),
        element('p', 'text-slate-600 text-sm mb-4', job.description_excerpt || 'Contact our recruitment team for details about this opening.'),
        element('p', 'text-xs text-slate-600 mb-4', job.country));
      const button = element('button', 'job-apply-btn w-full py-3 text-white rounded-lg font-medium transition-all', 'Apply Now');
      button.type = 'button';
      button.dataset.jobId = job.uuid;
      button.addEventListener('click', () => chooseJob(job.uuid));
      card.append(button);
      grid.append(card);
    }
    jobsStatus.textContent = visible.length ? `${visible.length} available opening${visible.length === 1 ? '' : 's'}` : 'No openings are available at the moment. You can still submit a general CV below.';
    filters.replaceChildren();
    for (const value of ['', ...new Set(jobs.map(job => job.country).filter(Boolean))]) {
      const button = element('button', `px-6 py-2 rounded-full text-sm font-medium ${value === country ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`, value || 'All Countries');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(value === country));
      button.addEventListener('click', () => { country = value; page = 1; renderJobs(); });
      filters.append(button);
    }
    pagination.replaceChildren();
    if (pages > 1) {
      for (const [label, offset] of [['Previous', -1], ['Next', 1]]) {
        const button = element('button', '', label);
        button.type = 'button';
        button.disabled = offset < 0 ? page === 1 : page === pages;
        button.addEventListener('click', () => { page += offset; renderJobs(); });
        pagination.append(button);
        if (offset < 0) pagination.append(element('span', 'text-sm text-slate-600', `Page ${page} of ${pages}`));
      }
    }
  }

  async function loadJobs() {
    jobsStatus.textContent = 'Loading available openings...';
    try {
      const loaded = [];
      let lastPage = 1;
      for (let current = 1; current <= lastPage; current++) {
        const response = await fetcher(`${base}/job-post/${config.agencyUuid}?page=${current}`, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Jobs unavailable');
        const result = await response.json();
        if (!Array.isArray(result.data)) throw new Error('Invalid jobs response');
        lastPage = Number(result.meta?.last_page || 1);
        if (!Number.isSafeInteger(lastPage) || lastPage < current || lastPage > 1000) throw new Error('Invalid pagination');
        loaded.push(...result.data.filter(job => UUID.test(job.uuid) && job.is_published));
      }
      jobs = [...new Map(loaded.map(job => [job.uuid, job])).values()];
      const previous = select.value;
      select.replaceChildren(element('option', '', 'General CV submission'));
      select.options[0].value = '';
      for (const job of jobs) {
        const option = element('option', '', `${job.title} — ${job.country}`);
        option.value = job.uuid;
        select.append(option);
      }
      select.value = jobs.some(job => job.uuid === previous) ? previous : '';
      renderJobs();
    } catch {
      jobsStatus.textContent = 'We could not load openings. You can still submit a general CV below.';
      const retry = element('button', 'underline text-primary-600 ml-2', 'Retry');
      retry.type = 'button';
      retry.addEventListener('click', loadJobs);
      jobsStatus.append(retry);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    const data = new FormDataClass(form);
    for (const key of ['first_name', 'last_name', 'middle_name', 'email', 'contact_number', 'cover_letter']) data.set(key, String(data.get(key) || '').trim());
    const errors = validateApplicant(data, resume.files[0]);
    showErrors(errors);
    status.hidden = true;
    if (Object.keys(errors).length) return;
    submitting = true;
    fields.disabled = true;
    submit.textContent = 'Submitting...';
    form.setAttribute('aria-busy', 'true');
    showStatus('Uploading your CV...');
    try {
      const response = await fetcher(endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: data });
      const result = await response.json().catch(() => ({}));
      if (response.status === 422) {
        showErrors(result.errors || {});
        showStatus(result.message || 'Please check the highlighted fields and try again.', true);
      } else if (response.status === 429) {
        showStatus('Too many submissions. Please wait a minute before trying again.', true);
      } else if (response.status === 413) {
        showErrors({ resume: 'The server could not accept this upload. Choose a smaller CV and try again.' });
        showStatus('Your upload was too large for the server.', true);
      } else if (!response.ok || response.status !== 201) {
        throw new Error('Submission failed');
      } else {
        form.reset();
        doc.getElementById('cv-filename').textContent = 'No file selected';
        showStatus(result.message || 'Your CV has been submitted. Our recruitment team will contact you if there is a suitable opportunity.');
        status.focus();
      }
    } catch {
      showStatus('We could not confirm your submission. Your details are still here. Please try again or contact our office.', true);
    } finally {
      submitting = false;
      fields.disabled = false;
      submit.textContent = 'Submit CV';
      form.setAttribute('aria-busy', 'false');
      if (form.querySelector('[aria-invalid="true"]')) form.querySelector('[aria-invalid="true"]').focus();
    }
  });
  return { ready: loadJobs() };
}

if (typeof document !== 'undefined') initCv(document, siteConfig);
