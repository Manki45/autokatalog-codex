import { getBrands, getCategories, submitPending } from './catalog.js';

const form = document.getElementById('submit-form');
const brandSelect = document.getElementById('brand');
const newBrandInput = document.getElementById('new-brand');
const toggleBrandBtn = document.getElementById('toggle-new-brand');
const bodyTypeContainer = document.getElementById('bodytype-options');
const addCustomBtn = document.getElementById('add-custom-category');
const customList = document.getElementById('custom-category-list');
const addImageUrlBtn = document.getElementById('add-image-url');
const imageUrlList = document.getElementById('image-url-list');
const imageInput = document.getElementById('images');
const imagePreview = document.getElementById('image-preview');
const messageEl = document.getElementById('submit-message');

let categories = [];
let brands = [];
let newBrandVisible = false;

function setMessage(text, type = '') {
  messageEl.textContent = text;
  messageEl.classList.remove('is-error', 'is-success');
  if (type) {
    messageEl.classList.add(type);
  }
}

function createBrandOptions() {
  brandSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Bitte wählen';
  placeholder.disabled = true;
  placeholder.selected = true;
  brandSelect.append(placeholder);
  brands.forEach((brand) => {
    const option = document.createElement('option');
    option.value = brand;
    option.textContent = brand;
    brandSelect.append(option);
  });
}

function toggleNewBrand() {
  newBrandVisible = !newBrandVisible;
  newBrandInput.classList.toggle('hidden', !newBrandVisible);
  brandSelect.toggleAttribute('required', !newBrandVisible);
  if (newBrandVisible) {
    newBrandInput.focus();
  } else {
    newBrandInput.value = '';
  }
}

function createBodyTypeChips() {
  bodyTypeContainer.innerHTML = '';
  categories.forEach((category) => {
    const id = `bodytype-${category.name.toLowerCase()}`.replace(/\s+/g, '-');
    const label = document.createElement('label');
    label.className = 'chip chip--selectable';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = category.name;
    input.name = 'bodyTypes';
    input.id = id;
    const span = document.createElement('span');
    span.textContent = category.name;
    label.append(input, span);
    bodyTypeContainer.append(label);
  });
}

function createCustomRow(key = '', value = '') {
  const row = document.createElement('div');
  row.className = 'dynamic-row';
  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.placeholder = 'Eigenschaft';
  keyInput.value = key;
  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.placeholder = 'Wert';
  valueInput.value = value;
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn--ghost';
  removeBtn.textContent = 'Entfernen';
  removeBtn.addEventListener('click', () => row.remove());
  row.append(keyInput, valueInput, removeBtn);
  customList.append(row);
}

function extractUrlValues(value) {
  if (!value) {
    return [];
  }
  return String(value)
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeUrlInput(input) {
  const urls = extractUrlValues(input.value);
  if (urls.length <= 1) {
    input.value = urls[0] || '';
    return;
  }
  input.value = urls[0];
  urls.slice(1).forEach((url) => createImageUrlRow(url));
}

function createImageUrlRow(value = '') {
  const row = document.createElement('div');
  row.className = 'dynamic-row';
  const input = document.createElement('input');
  input.type = 'url';
  input.placeholder = 'https://beispiel.de/bild.jpg';
  const urls = extractUrlValues(value);
  input.value = urls.shift() || '';
  input.addEventListener('blur', () => normalizeUrlInput(input));
  input.addEventListener('paste', () => {
    setTimeout(() => normalizeUrlInput(input), 0);
  });
  urls.forEach((url) => createImageUrlRow(url));
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn--ghost';
  removeBtn.textContent = 'Entfernen';
  removeBtn.addEventListener('click', () => row.remove());
  row.append(input, removeBtn);
  imageUrlList.append(row);
}

function collectImageUrls() {
  const urls = new Set();
  imageUrlList.querySelectorAll('input[type="url"]').forEach((input) => {
    extractUrlValues(input.value).forEach((url) => urls.add(url));
  });
  return Array.from(urls);
}

function collectCustomCategories() {
  const data = {};
  customList.querySelectorAll('.dynamic-row').forEach((row) => {
    const [keyInput, valueInput] = row.querySelectorAll('input');
    const key = keyInput.value.trim();
    const value = valueInput.value.trim();
    if (key && value) {
      data[key] = value;
    }
  });
  return data;
}

function updateImagePreview() {
  imagePreview.innerHTML = '';
  const files = Array.from(imageInput.files || []);
  files.forEach((file) => {
    const figure = document.createElement('figure');
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    const caption = document.createElement('figcaption');
    caption.textContent = file.name;
    figure.append(img, caption);
    imagePreview.append(figure);
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  setMessage('');

  const formData = new FormData();
  const brand = newBrandVisible ? newBrandInput.value.trim() : brandSelect.value;
  if (!brand) {
    setMessage('Bitte eine Marke auswählen oder hinzufügen.', 'is-error');
    return;
  }
  formData.append('brand', brand);
  formData.append('model', form.model.value.trim());
  formData.append('year', form.year.value);
  if (form.powerPS.value) formData.append('powerPS', form.powerPS.value);
  if (form.acceleration_0_100.value) formData.append('acceleration_0_100', form.acceleration_0_100.value);
  if (form.topSpeed.value) formData.append('topSpeed', form.topSpeed.value);
  if (form.consumption.value) formData.append('consumption', form.consumption.value.trim());

  const bodyTypes = Array.from(form.querySelectorAll('input[name="bodyTypes"]:checked')).map(
    (input) => input.value
  );
  if (bodyTypes.length === 0) {
    setMessage('Bitte mindestens eine Karosserie wählen.', 'is-error');
    return;
  }
  bodyTypes.forEach((type) => formData.append('bodyTypes', type));

  const customCategories = collectCustomCategories();
  if (Object.keys(customCategories).length > 0) {
    formData.append('customCategories', JSON.stringify(customCategories));
  }

  Array.from(imageInput.files || []).forEach((file) => {
    formData.append('images', file);
  });

  const imageUrls = collectImageUrls();
  if (imageUrls.length) {
    formData.append('imageUrls', JSON.stringify(imageUrls));
  }

  try {
    await submitPending(formData);
    if (newBrandVisible && !brands.includes(brand)) {
      brands.push(brand);
      brands.sort((a, b) => a.localeCompare(b));
      createBrandOptions();
    }
    setMessage('Vielen Dank! Ihre Einreichung wird geprüft.', 'is-success');
    form.reset();
    imagePreview.innerHTML = '';
    customList.innerHTML = '';
    createCustomRow();
    imageUrlList.innerHTML = '';
    createImageUrlRow();
    bodyTypeContainer.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.checked = false;
    });
    if (newBrandVisible) {
      toggleNewBrand();
    }
  } catch (error) {
    setMessage(error.message || 'Einreichung fehlgeschlagen.', 'is-error');
  }
}

async function init() {
  try {
    [categories, brands] = await Promise.all([getCategories(), getBrands()]);
    createBrandOptions();
    createBodyTypeChips();
    if (!customList.children.length) {
      createCustomRow();
    }
    if (!imageUrlList.children.length) {
      createImageUrlRow();
    }
  } catch (error) {
    setMessage(error.message || 'Daten konnten nicht geladen werden.', 'is-error');
  }
}

form.addEventListener('submit', handleSubmit);
imageInput.addEventListener('change', updateImagePreview);
addCustomBtn.addEventListener('click', () => createCustomRow());
addImageUrlBtn.addEventListener('click', () => createImageUrlRow());
toggleBrandBtn.addEventListener('click', toggleNewBrand);

init();
