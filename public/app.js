const USER_ID = localStorage.getItem('grolisto_user_id') || 'joe';
const TOKEN = localStorage.getItem('grolisto_token') || '';
if (!localStorage.getItem('grolisto_user_id')) localStorage.setItem('grolisto_user_id', 'joe');

const els = {
  form: document.getElementById('plan-form'),
  budget: document.getElementById('budget'),
  days: document.getElementById('days'),
  zip: document.getElementById('zip'),
  allergies: document.getElementById('allergies'),
  likes: document.getElementById('likes'),
  notes: document.getElementById('notes'),
  storeId: document.getElementById('storeId'),
  reloadStores: document.getElementById('reload-stores'),
  generateBtn: document.getElementById('generate-btn'),
  planStatus: document.getElementById('plan-status'),
  planResult: document.getElementById('plan-result'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  chatLog: document.getElementById('chat-log'),
};

/** Server-owned chat session id */
let sessionId = localStorage.getItem('grolisto_chat_session') || null;
let lastPlan = null;

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function selectedMeals() {
  return [...document.querySelectorAll('input[name="meal"]:checked')].map((el) => el.value);
}

function setStatus(msg, isError = false) {
  els.planStatus.textContent = msg || '';
  els.planStatus.classList.toggle('error', Boolean(isError));
}

function money(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `$${Number(n).toFixed(2)}`;
}

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { ...authHeaders(), ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Invalid response' };
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function workingMemory(extra = {}) {
  return {
    budget: Number(els.budget.value),
    days: Number(els.days.value),
    meals: selectedMeals(),
    allergies: splitList(els.allergies.value),
    likes: splitList(els.likes.value),
    storeId: els.storeId.value || undefined,
    zip: els.zip.value || undefined,
    notes: els.notes.value.trim(),
    activePlan: lastPlan,
    ...extra,
  };
}

async function ensureSession() {
  if (sessionId) {
    try {
      await api(`/api/chat/sessions/${sessionId}`);
      return sessionId;
    } catch {
      sessionId = null;
      localStorage.removeItem('grolisto_chat_session');
    }
  }
  const data = await api('/api/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ userId: USER_ID, workingMemory: workingMemory() }),
  });
  sessionId = data.session.id;
  localStorage.setItem('grolisto_chat_session', sessionId);
  return sessionId;
}

async function syncSessionContext() {
  const id = await ensureSession();
  await api(`/api/chat/sessions/${id}/context`, {
    method: 'PATCH',
    body: JSON.stringify({ userId: USER_ID, workingMemory: workingMemory() }),
  });
}

function appendBubble(role, content, meta) {
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  div.textContent = content;
  if (meta?.intent) {
    const tag = document.createElement('span');
    tag.className = 'intent-tag';
    tag.textContent = meta.intent;
    div.appendChild(document.createElement('br'));
    div.appendChild(tag);
  }
  els.chatLog.appendChild(div);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

async function loadStores() {
  const zip = els.zip.value.trim();
  els.storeId.innerHTML = '<option value="">Loading…</option>';
  try {
    const qs = zip ? `?zip=${encodeURIComponent(zip)}` : '';
    const data = await api(`/api/stores${qs}`);
    const stores = data.stores || [];
    if (!stores.length) {
      els.storeId.innerHTML = '<option value="">No stores found</option>';
      return;
    }
    els.storeId.innerHTML = stores
      .map((s) => {
        const id = s.id || s.storeId;
        const label = [
          s.name || s.chain || id,
          s.address || s.zip,
          s.distanceMiles != null ? `${Number(s.distanceMiles).toFixed(1)} mi` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return `<option value="${String(id)}">${label}</option>`;
      })
      .join('');
  } catch (err) {
    els.storeId.innerHTML = '<option value="">Failed to load stores</option>';
    setStatus(err.message, true);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderPlan(payload) {
  lastPlan = payload;
  const plan = payload.plan || payload;
  const allocation = payload.allocation || {};
  const days = plan.days || [];
  const totals = plan.totals || {};

  const dayHtml = days
    .map((d) => {
      const meals = (d.meals || [])
        .map(
          (m) => `<li>
            <span class="meal">${escapeHtml(m.meal || '')}</span>
            <span>${escapeHtml(m.title || m.recipeId || 'Meal')}</span>
            <span class="cost">${money(m.estCost)}</span>
          </li>`,
        )
        .join('');
      return `<div class="day-block"><h4>Day ${escapeHtml(String(d.day ?? ''))}</h4><ul>${meals}</ul></div>`;
    })
    .join('');

  const grocery = (plan.groceryList || [])
    .slice(0, 24)
    .map(
      (g) =>
        `<li><span class="meal">item</span><span>${escapeHtml(g.ingredient || g.name || '')}</span><span class="cost">${money(g.estPrice ?? g.price)}</span></li>`,
    )
    .join('');

  els.planResult.hidden = false;
  els.planResult.innerHTML = `
    <h3>Your week</h3>
    <p class="section-lede">
      ${allocation.slotCount ?? '—'} slots · ~${money(allocation.perMealBudget)} per meal · budget ${money(allocation.budget ?? totals.budget)}
    </p>
    ${dayHtml || '<p class="status">No days returned.</p>'}
    ${
      grocery
        ? `<div class="day-block"><h4>Grocery sketch</h4><ul>${grocery}</ul></div>`
        : ''
    }
    <div class="totals">
      <span>Spend <strong>${money(totals.estimatedSpend)}</strong></span>
      <span>Slack <strong>${money(totals.slack)}</strong></span>
      <span>κ <strong>${totals.kappa != null ? Number(totals.kappa).toFixed(2) : '—'}</strong></span>
    </div>
    ${plan.notes ? `<p class="section-lede">${escapeHtml(plan.notes)}</p>` : ''}
  `;
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const meals = selectedMeals();
  if (!meals.length) {
    setStatus('Select at least one meal.', true);
    return;
  }
  if (!els.storeId.value) {
    setStatus('Pick a neighboring store.', true);
    return;
  }

  els.generateBtn.disabled = true;
  setStatus('Allocating meals…');
  try {
    const body = {
      budget: Number(els.budget.value),
      days: Number(els.days.value),
      meals,
      allergies: splitList(els.allergies.value),
      likes: splitList(els.likes.value),
      storeId: els.storeId.value,
      zip: els.zip.value.trim() || undefined,
      notes: els.notes.value.trim(),
      userId: USER_ID,
    };
    const data = await api('/api/plan', { method: 'POST', body: JSON.stringify(body) });
    renderPlan(data);
    setStatus('Plan ready.');
    await syncSessionContext();
    appendBubble(
      'assistant',
      `Plan locked into this chat session — ask for swaps and I’ll keep budget, store, and allergies in working memory.`,
    );
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    els.generateBtn.disabled = false;
  }
});

els.chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = els.chatInput.value.trim();
  if (!content) return;

  els.chatInput.value = '';
  appendBubble('user', content);
  els.chatForm.querySelector('button').disabled = true;

  try {
    const id = await ensureSession();
    const data = await api(`/api/chat/sessions/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        userId: USER_ID,
        content,
        workingMemory: workingMemory(),
      }),
    });
    appendBubble('assistant', data.reply || '(empty reply)', {
      intent: data.intent,
    });
  } catch (err) {
    appendBubble('assistant', `Sorry — ${err.message}`);
  } finally {
    els.chatForm.querySelector('button').disabled = false;
  }
});

els.reloadStores.addEventListener('click', () => loadStores());
els.zip.addEventListener('change', () => loadStores());

async function loadKustieWeek() {
  const box = document.getElementById('kustie-card');
  if (!box) return;
  try {
    const data = await api('/api/weeks/current');
    const week = data.week;
    if (!week) {
      box.innerHTML = '<p class="status">No week card seeded yet.</p>';
      return;
    }
    const meals = (week.meals || [])
      .map(
        (m) => `<li>
          <span class="meal">${escapeHtml(m.day)} · ${escapeHtml(m.slot)}</span>
          <span>${escapeHtml(m.title)}</span>
        </li>`,
      )
      .join('');
    box.innerHTML = `
      <p><strong>${escapeHtml(week.label || week.id)}</strong> — ${escapeHtml(week.notes || '')}</p>
      <ul class="day-meals">${meals}</ul>
      <p class="mute">Open the full card for photos, quantities, and recipes.</p>
    `;
  } catch (err) {
    box.innerHTML = `<p class="status error">${escapeHtml(err.message)}</p>`;
  }
}

async function hydratePrefs() {
  try {
    const prefs = await api(`/api/prefs/${encodeURIComponent(USER_ID)}`);
    if (prefs.likes?.length && !els.likes.value.trim()) {
      els.likes.value = prefs.likes.join(', ');
    }
    if (prefs.allergies?.length && !els.allergies.value.trim()) {
      els.allergies.value = prefs.allergies.join(', ');
    }
  } catch {
    /* prefs optional before seed */
  }
}

loadStores();
loadKustieWeek();
hydratePrefs();
ensureSession()
  .then(() =>
    appendBubble(
      'assistant',
      'Session ready as user joe. I know your staples + the active Kustie week card — ask what to cook Nov 23–26 or generate a priced plan.',
    ),
  )
  .catch((err) => appendBubble('assistant', `Could not start chat session: ${err.message}`));
