const API_BASE = '/api';
const COMPARE_STORAGE_KEY = 'online-autokatalog:compare';

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
    } else {
      query.set(key, value);
    }
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

async function apiFetch(endpoint, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = new Headers(options.headers || {});
  if (!isFormData && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    ...options,
    headers,
  });
  if (!response.ok) {
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      payload = { message: 'Unbekannter Fehler.' };
    }
    const error = new Error(payload.message || 'Fehlerhafte Antwort.');
    error.details = payload.details;
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export async function getCars(params = {}) {
  const query = buildQuery(params);
  const data = await apiFetch(`/cars${query}`);
  return data.cars;
}

export async function getCarById(id) {
  const data = await apiFetch(`/cars/${id}`);
  return data.car;
}

export async function getBrands() {
  const data = await apiFetch('/brands');
  return data.brands;
}

export async function getCategories() {
  const data = await apiFetch('/categories');
  return data.categories;
}

export async function submitPending(formData) {
  return apiFetch('/pending', {
    method: 'POST',
    body: formData,
  });
}

export async function login(credentials) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function logout() {
  return apiFetch('/auth/logout', { method: 'POST' });
}

export async function getSessionUser() {
  return apiFetch('/auth/me');
}

export async function createUser(payload) {
  return apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateUser(id, payload) {
  return apiFetch(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteUser(id) {
  return apiFetch(`/users/${id}`, { method: 'DELETE' });
}

export async function createBrand(name) {
  return apiFetch('/brands', {
    method: 'POST',
    body: JSON.stringify({ name }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteBrand(name) {
  return apiFetch(`/brands/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export async function createCategory(payload) {
  return apiFetch('/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateCategory(name, payload) {
  return apiFetch(`/categories/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteCategory(name) {
  return apiFetch(`/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export async function getPending() {
  const data = await apiFetch('/pending');
  return data.pending;
}

export async function approvePending(id) {
  return apiFetch(`/pending/${id}/approve`, { method: 'POST' });
}

export async function rejectPending(id) {
  return apiFetch(`/pending/${id}/reject`, { method: 'POST' });
}

export async function createCar(formData) {
  return apiFetch('/cars', {
    method: 'POST',
    body: formData,
  });
}

export async function updateCar(id, formData) {
  return apiFetch(`/cars/${id}`, {
    method: 'PUT',
    body: formData,
  });
}

export async function deleteCar(id) {
  return apiFetch(`/cars/${id}`, { method: 'DELETE' });
}

export function formatCarName(car) {
  return `${car.brand} ${car.model} ${car.year}`.trim();
}

export function buildSpecMap(car) {
  const map = new Map();
  map.set('Leistung', car.powerPS ? `${car.powerPS} PS` : null);
  map.set('0–100 km/h', car.acceleration_0_100 ? `${car.acceleration_0_100} s` : null);
  map.set('Höchstgeschwindigkeit', car.topSpeed ? `${car.topSpeed} km/h` : null);
  map.set('Verbrauch', car.consumption || null);
  Object.entries(car.customCategories || {}).forEach(([key, value]) => {
    map.set(key, value);
  });
  return map;
}

class CompareStore {
  constructor() {
    this.items = new Map();
    this.listeners = new Set();
    this.load();
  }

  load() {
    try {
      const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item && item.id) {
            this.items.set(item.id, item);
          }
        });
      }
    } catch (error) {
      console.warn('Konnte Vergleichsliste nicht laden.', error);
    }
  }

  persist() {
    try {
      const data = JSON.stringify(Array.from(this.items.values()));
      window.localStorage.setItem(COMPARE_STORAGE_KEY, data);
    } catch (error) {
      console.warn('Konnte Vergleichsliste nicht speichern.', error);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.items);
    return () => this.listeners.delete(listener);
  }

  emit() {
    this.persist();
    this.listeners.forEach((listener) => listener(this.items));
  }

  upsert(car) {
    if (!car || !car.id) {
      return;
    }
    this.items.set(car.id, car);
    this.emit();
  }

  remove(id) {
    this.items.delete(id);
    this.emit();
  }

  toggle(car) {
    if (!car || !car.id) {
      return;
    }
    if (this.items.has(car.id)) {
      this.items.delete(car.id);
    } else {
      this.items.set(car.id, car);
    }
    this.emit();
  }

  clear() {
    if (this.items.size === 0) {
      return;
    }
    this.items.clear();
    this.emit();
  }

  has(id) {
    return this.items.has(id);
  }

  toArray() {
    return Array.from(this.items.values());
  }

  syncFromCars(cars = []) {
    let changed = false;
    this.items.forEach((value, key) => {
      const updated = cars.find((car) => car.id === key);
      if (updated) {
        this.items.set(key, updated);
        changed = true;
      }
    });
    if (changed) {
      this.emit();
    }
  }
}

export const compareStore = new CompareStore();

export function renderCompareTable(cars) {
  if (!cars || cars.length === 0) {
    return '<p class="form__message">Keine Fahrzeuge ausgewählt.</p>';
  }
  const specKeys = new Map();
  cars.forEach((car) => {
    buildSpecMap(car).forEach((value, key) => {
      if (value) {
        specKeys.set(key, true);
      }
    });
  });
  const visibleKeys = Array.from(specKeys.keys());
  const rows = visibleKeys
    .map((key) => {
      const cells = cars
        .map((car) => {
          const specs = buildSpecMap(car);
          const value = specs.get(key) || '—';
          return `<td>${value}</td>`;
        })
        .join('');
      return `<tr><th scope="row">${key}</th>${cells}</tr>`;
    })
    .join('');
  const head = cars.map((car) => `<th scope="col">${formatCarName(car)}</th>`).join('');
  return `
    <table class="compare-table">
      <thead>
        <tr>
          <th scope="col"></th>
          ${head}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

export async function initCarDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    document.querySelector('.detail').innerHTML = '<p class="form__message is-error">Kein Fahrzeug angegeben.</p>';
    return;
  }
  try {
    const car = await getCarById(id);
    const title = document.getElementById('detail-title');
    const meta = document.getElementById('detail-meta');
    const specs = document.getElementById('detail-specs');
    const bodytypes = document.getElementById('detail-bodytypes');
    const imageEl = document.getElementById('detail-image');
    const captionEl = document.getElementById('detail-caption');
    const prevBtn = document.querySelector('.detail__nav--prev');
    const nextBtn = document.querySelector('.detail__nav--next');
    const compareToggle = document.getElementById('detail-compare-toggle');

    let activeIndex = 0;

    const updateImage = () => {
      if (!car.images || car.images.length === 0) {
        imageEl.src = '/img/hero-bg.jpg';
        captionEl.textContent = 'Kein Bild verfügbar';
        prevBtn.classList.add('hidden');
        nextBtn.classList.add('hidden');
        return;
      }
      imageEl.src = car.images[activeIndex];
      captionEl.textContent = `${activeIndex + 1} / ${car.images.length}`;
      prevBtn.classList.toggle('hidden', car.images.length <= 1);
      nextBtn.classList.toggle('hidden', car.images.length <= 1);
    };

    const goPrev = () => {
      activeIndex = (activeIndex - 1 + car.images.length) % car.images.length;
      updateImage();
    };

    const goNext = () => {
      activeIndex = (activeIndex + 1) % car.images.length;
      updateImage();
    };

    prevBtn.addEventListener('click', goPrev);
    nextBtn.addEventListener('click', goNext);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        goPrev();
      }
      if (event.key === 'ArrowRight') {
        goNext();
      }
    });

    title.textContent = formatCarName(car);
    meta.textContent = `${car.brand} • ${car.year}`;
    specs.innerHTML = '';
    buildSpecMap(car).forEach((value, key) => {
      if (!value) {
        return;
      }
      const dt = document.createElement('dt');
      dt.textContent = key;
      const dd = document.createElement('dd');
      dd.textContent = value;
      specs.append(dt, dd);
    });
    bodytypes.innerHTML = '';
    (car.bodyTypes || []).forEach((name) => {
      const chip = document.createElement('span');
      chip.className = 'tag';
      chip.textContent = name;
      bodytypes.appendChild(chip);
    });

    if (compareStore.has(car.id)) {
      compareStore.upsert(car);
    }
    compareToggle.checked = compareStore.has(car.id);
    compareToggle.addEventListener('change', () => compareStore.toggle(car));
    const unsubscribe = compareStore.subscribe((items) => {
      compareToggle.checked = items.has(car.id);
    });
    window.addEventListener('beforeunload', unsubscribe, { once: true });

    updateImage();
  } catch (error) {
    document.querySelector('.detail').innerHTML = `<p class="form__message is-error">${error.message}</p>`;
  }
}
