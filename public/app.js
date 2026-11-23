const USER_ID = 'default';

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

/** @type {{ role: string, content: string }[]} */
const chatHistory = [];

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

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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

function contextPayload() {
  return {
    userId: USER_ID,
    budget: Number(els.budget.value),
    days: Number(els.days.value),
    meals: selectedMeals(),
    allergies: splitList(els.allergies.value),
    likes: splitList(els.likes.value),
    storeId: els.storeId.value || undefined,
    zip: els.zip.value || undefined,
  };
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
        const label = [s.name || s.chain || id, s.address || s.zip, s.distanceMiles != null ? `${Number(s.distanceMiles).toFixed(1)} mi` : null]
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

function renderPlan(payload) {
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

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function appendBubble(role, content) {
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  div.textContent = content;
  els.chatLog.appendChild(div);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
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
    appendBubble(
      'assistant',
      `Plan generated for ${body.days} days (${meals.join(', ')}) at ~${money(data.allocation?.perMealBudget)} per meal.`,
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
  chatHistory.push({ role: 'user', content });
  appendBubble('user', content);

  try {
    const data = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: chatHistory,
        context: contextPayload(),
      }),
    });
    const reply = data.reply || '(empty reply)';
    chatHistory.push({ role: 'assistant', content: reply });
    appendBubble('assistant', reply);
  } catch (err) {
    appendBubble('assistant', `Sorry — ${err.message}`);
  }
});

els.reloadStores.addEventListener('click', () => loadStores());
els.zip.addEventListener('change', () => loadStores());

loadStores();
appendBubble('assistant', 'Tell me what you want to cook this week — or generate a plan first.');
