import {
  login,
  logout,
  getSessionUser,
  getCars,
  getPending,
  getBrands,
  getCategories,
  createBrand,
  deleteBrand,
  createCategory,
  updateCategory,
  deleteCategory,
  createCar,
  updateCar,
  deleteCar,
  createUser,
  updateUser,
  deleteUser,
  approvePending,
  rejectPending,
} from './catalog.js';

const loginPanel = document.getElementById('login-panel');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const adminUser = document.getElementById('admin-user');
const logoutBtn = document.getElementById('logout-btn');
const navButtons = document.querySelectorAll('.admin-nav__item');
const sections = {
  cars: document.getElementById('section-cars'),
  pending: document.getElementById('section-pending'),
  users: document.getElementById('section-users'),
  meta: document.getElementById('section-meta'),
};

const carList = document.getElementById('car-list');
const carDialog = document.getElementById('car-dialog');
const carForm = document.getElementById('car-form');
const carFormTitle = document.getElementById('car-form-title');
const carFormMessage = document.getElementById('car-form-message');
const carBrandSelect = document.getElementById('car-brand');
const carBodytypes = document.getElementById('car-bodytypes');
const carCustomList = document.getElementById('car-custom-list');
const carAddCustomBtn = document.getElementById('car-add-custom');
const carImagesInput = document.getElementById('car-images');
const carExistingImages = document.getElementById('car-existing-images');
const carUrlList = document.getElementById('car-url-list');
const carAddUrlBtn = document.getElementById('car-add-url');
const carCreateBtn = document.getElementById('car-create');

const pendingList = document.getElementById('pending-list');

const userList = document.getElementById('user-list');
const userDialog = document.getElementById('user-dialog');
const userForm = document.getElementById('user-form');
const userFormTitle = document.getElementById('user-form-title');
const userFormMessage = document.getElementById('user-form-message');
const userCreateBtn = document.getElementById('user-create');

const brandInput = document.getElementById('brand-input');
const brandAddBtn = document.getElementById('brand-add');
const brandManagement = document.getElementById('brand-management');

const categoryListAdmin = document.getElementById('category-list-admin');
const categoryAddBtn = document.getElementById('category-add');
const categoryDialog = document.getElementById('category-dialog');
const categoryForm = document.getElementById('category-form');
const categoryFormTitle = document.getElementById('category-form-title');
const categoryFormMessage = document.getElementById('category-form-message');

const state = {
  user: null,
  cars: [],
  pending: [],
  brands: [],
  categories: [],
  users: [],
  editingCarId: null,
  keepImages: [],
  editingUserId: null,
  editingCategoryName: null,
};

function setLoginMessage(message, type = '') {
  loginMessage.textContent = message;
  loginMessage.classList.remove('is-error');
  if (type === 'error') {
    loginMessage.classList.add('is-error');
  }
}

function setCarFormMessage(message, type = '') {
  carFormMessage.textContent = message;
  carFormMessage.classList.remove('is-error', 'is-success');
  if (type) {
    carFormMessage.classList.add(type);
  }
}

function setUserFormMessage(message, type = '') {
  userFormMessage.textContent = message;
  userFormMessage.classList.remove('is-error', 'is-success');
  if (type) {
    userFormMessage.classList.add(type);
  }
}

function setCategoryFormMessage(message, type = '') {
  categoryFormMessage.textContent = message;
  categoryFormMessage.classList.remove('is-error', 'is-success');
  if (type) {
    categoryFormMessage.classList.add(type);
  }
}

function switchSection(section) {
  Object.values(sections).forEach((element) => element.classList.add('hidden'));
  if (sections[section]) {
    sections[section].classList.remove('hidden');
  }
  navButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.section === section);
  });
}

function ensureDialogCloseButtons(dialog) {
  dialog.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });
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

function normalizeUrlInput(container, input) {
  const urls = extractUrlValues(input.value);
  if (urls.length <= 1) {
    input.value = urls[0] || '';
    return;
  }
  input.value = urls.shift();
  urls.forEach((url) => createUrlRow(container, url));
}

function createUrlRow(container, value = '') {
  const row = document.createElement('div');
  row.className = 'dynamic-row';
  const input = document.createElement('input');
  input.type = 'url';
  input.placeholder = 'https://beispiel.de/bild.jpg';
  const urls = extractUrlValues(value);
  input.value = urls.shift() || '';
  input.addEventListener('blur', () => normalizeUrlInput(container, input));
  input.addEventListener('paste', () => {
    setTimeout(() => normalizeUrlInput(container, input), 0);
  });
  urls.forEach((url) => createUrlRow(container, url));
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn--ghost';
  removeBtn.textContent = 'Entfernen';
  removeBtn.addEventListener('click', () => row.remove());
  row.append(input, removeBtn);
  container.append(row);
}

function collectUrls(container) {
  const urls = new Set();
  container.querySelectorAll('input[type="url"]').forEach((input) => {
    extractUrlValues(input.value).forEach((url) => urls.add(url));
  });
  return Array.from(urls);
}

function createDynamicRow(key = '', value = '') {
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
  return row;
}

function collectCustomCategories(container) {
  const data = {};
  container.querySelectorAll('.dynamic-row').forEach((row) => {
    const [keyInput, valueInput] = row.querySelectorAll('input');
    const key = keyInput.value.trim();
    const value = valueInput.value.trim();
    if (key && value) {
      data[key] = value;
    }
  });
  return data;
}

function createBodyTypeChips(container, selected = []) {
  container.innerHTML = '';
  state.categories.forEach((category) => {
    const id = `admin-body-${category.name.toLowerCase().replace(/\s+/g, '-')}`;
    const label = document.createElement('label');
    label.className = 'chip chip--selectable';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = category.name;
    input.name = 'bodyTypes';
    input.id = id;
    if (selected.includes(category.name)) {
      input.checked = true;
    }
    const span = document.createElement('span');
    span.textContent = category.name;
    label.append(input, span);
    container.append(label);
  });
}

function renderCars() {
  carList.innerHTML = '';
  if (state.cars.length === 0) {
    carList.innerHTML = '<p class="form__message">Noch keine Fahrzeuge.</p>';
    return;
  }
  state.cars.forEach((car) => {
    const item = document.createElement('div');
    item.className = 'admin-card';
    const header = document.createElement('header');
    const title = document.createElement('div');
    title.innerHTML = `<h3>${car.brand} ${car.model}</h3><p class="form__message">Baujahr ${car.year}</p>`;
    const actions = document.createElement('div');
    actions.className = 'admin-item__actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn--ghost';
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => openCarDialog(car.id));
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn--ghost';
    deleteBtn.textContent = 'Löschen';
    deleteBtn.addEventListener('click', () => handleDeleteCar(car.id));
    actions.append(editBtn, deleteBtn);
    header.append(title, actions);
    const body = document.createElement('div');
    body.className = 'car-admin-body';
    body.innerHTML = `
      <p><strong>Karosserien:</strong> ${(car.bodyTypes || []).join(', ') || '—'}</p>
      <p><strong>Bilder:</strong> ${car.images?.length || 0}</p>
    `;
    item.append(header, body);
    carList.append(item);
  });
}

function renderPending() {
  pendingList.innerHTML = '';
  if (state.pending.length === 0) {
    pendingList.innerHTML = '<p class="form__message">Keine offenen Einreichungen.</p>';
    return;
  }
  state.pending.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'admin-card';
    const header = document.createElement('header');
    header.innerHTML = `<h3>${entry.brand} ${entry.model}</h3><p class="form__message">Baujahr ${entry.year}</p>`;
    const actions = document.createElement('div');
    actions.className = 'admin-item__actions';
    const approveBtn = document.createElement('button');
    approveBtn.className = 'btn btn--primary';
    approveBtn.textContent = 'Freigeben';
    approveBtn.addEventListener('click', () => handleApprovePending(entry.id));
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'btn btn--ghost';
    rejectBtn.textContent = 'Ablehnen';
    rejectBtn.addEventListener('click', () => handleRejectPending(entry.id));
    actions.append(approveBtn, rejectBtn);
    header.append(actions);
    const body = document.createElement('div');
    body.className = 'car-admin-body car-admin-body--pending';
    const preview = document.createElement('div');
    preview.className = 'pending-preview';
    if (entry.images?.length) {
      const img = document.createElement('img');
      img.src = entry.images[0];
      img.alt = entry.model;
      preview.append(img);
    } else {
      preview.textContent = 'Keine Vorschau';
    }
    const details = document.createElement('div');
    details.innerHTML = `
      <p><strong>Karosserien:</strong> ${(entry.bodyTypes || []).join(', ') || '—'}</p>
      <p><strong>Bilder:</strong> ${entry.images?.length || 0}</p>
    `;
    body.append(preview, details);
    item.append(header, body);
    pendingList.append(item);
  });
}

function renderUsers() {
  userList.innerHTML = '';
  if (!state.cars || state.user?.role !== 'admin') {
    sections.users?.classList.add('hidden');
    return;
  }
  if (state.users?.length === 0) {
    userList.innerHTML = '<p class="form__message">Keine Benutzer vorhanden.</p>';
    return;
  }
  state.users.forEach((user) => {
    const item = document.createElement('div');
    item.className = 'admin-card';
    item.innerHTML = `<header><h3>${user.username}</h3><span class="form__message">Rolle: ${user.role}</span></header>`;
    const actions = document.createElement('div');
    actions.className = 'admin-item__actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn--ghost';
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => openUserDialog(user));
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn--ghost';
    deleteBtn.textContent = 'Löschen';
    deleteBtn.addEventListener('click', () => handleDeleteUser(user.id));
    actions.append(editBtn, deleteBtn);
    item.append(actions);
    userList.append(item);
  });
}

function renderBrands() {
  brandManagement.innerHTML = '';
  state.brands.forEach((brand) => {
    const li = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = brand;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => handleDeleteBrand(brand));
    li.append(text, removeBtn);
    brandManagement.append(li);
  });
}

function renderCategories() {
  categoryListAdmin.innerHTML = '';
  state.categories.forEach((category) => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    const name = document.createElement('span');
    name.textContent = `${category.name} (${category.icon})`;
    const actions = document.createElement('div');
    actions.className = 'admin-item__actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn--ghost';
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => openCategoryDialog(category));
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn--ghost';
    deleteBtn.textContent = 'Löschen';
    deleteBtn.addEventListener('click', () => handleDeleteCategory(category.name));
    actions.append(editBtn, deleteBtn);
    item.append(name, actions);
    categoryListAdmin.append(item);
  });
}

function populateCarBrandOptions() {
  carBrandSelect.innerHTML = '';
  state.brands.forEach((brand) => {
    const option = document.createElement('option');
    option.value = brand;
    option.textContent = brand;
    carBrandSelect.append(option);
  });
}

function populateUserList(users) {
  state.users = users;
  renderUsers();
}

function openCarDialog(carId = null) {
  state.editingCarId = carId;
  state.keepImages = [];
  carForm.reset();
  carExistingImages.innerHTML = '';
  carCustomList.innerHTML = '';
  carUrlList.innerHTML = '';
  carFormMessage.textContent = '';
  populateCarBrandOptions();
  createBodyTypeChips(carBodytypes);
  carCustomList.append(createDynamicRow());
  createUrlRow(carUrlList);

  if (carId) {
    carFormTitle.textContent = 'Fahrzeug bearbeiten';
    const car = state.cars.find((item) => item.id === carId);
    if (!car) return;
    carBrandSelect.value = car.brand;
    carForm.model.value = car.model;
    carForm.year.value = car.year;
    carForm.powerPS.value = car.powerPS || '';
    carForm.acceleration_0_100.value = car.acceleration_0_100 || '';
    carForm.topSpeed.value = car.topSpeed || '';
    carForm.consumption.value = car.consumption || '';
    createBodyTypeChips(carBodytypes, car.bodyTypes || []);
    carCustomList.innerHTML = '';
    const entries = Object.entries(car.customCategories || {});
    if (entries.length) {
      entries.forEach(([key, value]) => carCustomList.append(createDynamicRow(key, value)));
    } else {
      carCustomList.append(createDynamicRow());
    }
    state.keepImages = [...(car.images || [])];
    renderExistingImages();
  } else {
    carFormTitle.textContent = 'Fahrzeug hinzufügen';
  }

  carDialog.showModal();
}

function renderExistingImages() {
  carExistingImages.innerHTML = '';
  state.keepImages.forEach((image) => {
    const figure = document.createElement('figure');
    const img = document.createElement('img');
    img.src = image;
    img.alt = image;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'image-preview__remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      state.keepImages = state.keepImages.filter((item) => item !== image);
      renderExistingImages();
    });
    figure.append(img, removeBtn);
    carExistingImages.append(figure);
  });
}

async function handleDeleteCar(carId) {
  if (!window.confirm('Fahrzeug wirklich löschen?')) return;
  try {
    await deleteCar(carId);
    await loadCars();
  } catch (error) {
    alert(error.message || 'Löschen fehlgeschlagen.');
  }
}

async function handleApprovePending(id) {
  try {
    await approvePending(id);
    await Promise.all([loadPendingEntries(), loadCars()]);
  } catch (error) {
    alert(error.message || 'Freigabe fehlgeschlagen.');
  }
}

async function handleRejectPending(id) {
  if (!window.confirm('Einreichung wirklich ablehnen?')) return;
  try {
    await rejectPending(id);
    await loadPendingEntries();
  } catch (error) {
    alert(error.message || 'Ablehnung fehlgeschlagen.');
  }
}

async function handleDeleteBrand(name) {
  if (!window.confirm(`Marke ${name} löschen?`)) return;
  try {
    await deleteBrand(name);
    await loadBrandsAndCategories();
  } catch (error) {
    alert(error.message || 'Marke konnte nicht gelöscht werden.');
  }
}

async function handleDeleteCategory(name) {
  if (!window.confirm(`Kategorie ${name} löschen?`)) return;
  try {
    await deleteCategory(name);
    await loadBrandsAndCategories();
  } catch (error) {
    alert(error.message || 'Kategorie konnte nicht gelöscht werden.');
  }
}

function openUserDialog(user = null) {
  state.editingUserId = user ? user.id : null;
  userForm.reset();
  userFormMessage.textContent = '';
  if (user) {
    userFormTitle.textContent = 'Benutzer bearbeiten';
    userForm.username.value = user.username;
    userForm.role.value = user.role;
  } else {
    userFormTitle.textContent = 'Benutzer hinzufügen';
  }
  userDialog.showModal();
}

function openCategoryDialog(category = null) {
  state.editingCategoryName = category ? category.name : null;
  categoryForm.reset();
  categoryFormMessage.textContent = '';
  if (category) {
    categoryFormTitle.textContent = 'Kategorie bearbeiten';
    categoryForm.name.value = category.name;
    categoryForm.icon.value = category.icon;
  } else {
    categoryFormTitle.textContent = 'Kategorie hinzufügen';
  }
  categoryDialog.showModal();
}

async function loadCars() {
  state.cars = await getCars();
  renderCars();
}

async function loadPendingEntries() {
  try {
    state.pending = await getPending();
  } catch (error) {
    state.pending = [];
  }
  renderPending();
}

async function loadBrandsAndCategories() {
  const [brands, categories] = await Promise.all([getBrands(), getCategories()]);
  state.brands = brands;
  state.categories = categories;
  renderBrands();
  renderCategories();
}

async function loadUsers() {
  if (state.user?.role !== 'admin') {
    state.users = [];
    return;
  }
  try {
    const response = await fetch('/api/users', { credentials: 'include' });
    if (!response.ok) throw new Error('Fehler beim Laden der Benutzer.');
    const data = await response.json();
    populateUserList(data.users || []);
  } catch (error) {
    userList.innerHTML = `<p class="form__message is-error">${error.message}</p>`;
  }
}

async function handleCarFormSubmit(event) {
  event.preventDefault();
  setCarFormMessage('');
  const formData = new FormData();
  const brand = carBrandSelect.value;
  if (!brand) {
    setCarFormMessage('Bitte eine Marke wählen.', 'is-error');
    return;
  }
  formData.append('brand', brand);
  formData.append('model', carForm.model.value.trim());
  formData.append('year', carForm.year.value);
  if (carForm.powerPS.value) formData.append('powerPS', carForm.powerPS.value);
  if (carForm.acceleration_0_100.value) formData.append('acceleration_0_100', carForm.acceleration_0_100.value);
  if (carForm.topSpeed.value) formData.append('topSpeed', carForm.topSpeed.value);
  if (carForm.consumption.value) formData.append('consumption', carForm.consumption.value.trim());

  const bodyTypes = Array.from(carBodytypes.querySelectorAll('input[name="bodyTypes"]:checked')).map(
    (input) => input.value
  );
  if (bodyTypes.length === 0) {
    setCarFormMessage('Mindestens eine Karosserie wählen.', 'is-error');
    return;
  }
  bodyTypes.forEach((type) => formData.append('bodyTypes', type));

  const customCategories = collectCustomCategories(carCustomList);
  if (Object.keys(customCategories).length) {
    formData.append('customCategories', JSON.stringify(customCategories));
  }

  Array.from(carImagesInput.files || []).forEach((file) => {
    formData.append('images', file);
  });

  const urlValues = collectUrls(carUrlList);
  if (urlValues.length) {
    formData.append('imageUrls', JSON.stringify(urlValues));
  }

  try {
    if (state.editingCarId) {
      formData.append('keepImages', JSON.stringify(state.keepImages));
      await updateCar(state.editingCarId, formData);
      setCarFormMessage('Gespeichert.', 'is-success');
    } else {
      await createCar(formData);
      setCarFormMessage('Fahrzeug erstellt.', 'is-success');
    }
    await loadCars();
    await loadPendingEntries();
    carDialog.close();
  } catch (error) {
    setCarFormMessage(error.message || 'Speichern fehlgeschlagen.', 'is-error');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  setLoginMessage('');
  const credentials = {
    username: loginForm.username.value.trim(),
    password: loginForm.password.value,
  };
  try {
    const { user } = await login(credentials);
    state.user = user;
    await enterAdmin();
  } catch (error) {
    setLoginMessage(error.message || 'Login fehlgeschlagen.', 'error');
  }
}

async function handleLogout() {
  await logout();
  state.user = null;
  loginPanel.classList.remove('hidden');
  adminPanel.classList.add('hidden');
}

async function enterAdmin() {
  loginPanel.classList.add('hidden');
  adminPanel.classList.remove('hidden');
  adminUser.textContent = `Angemeldet als ${state.user.username} (${state.user.role})`;
  if (state.user.role !== 'admin') {
    const usersNav = document.querySelector('[data-section="users"]');
    usersNav?.classList.add('hidden');
    sections.users?.classList.add('hidden');
  } else {
    const usersNav = document.querySelector('[data-section="users"]');
    usersNav?.classList.remove('hidden');
  }
  await Promise.all([loadBrandsAndCategories(), loadCars(), loadPendingEntries(), loadUsers()]);
  switchSection('cars');
}

async function bootstrap() {
  ensureDialogCloseButtons(carDialog);
  ensureDialogCloseButtons(userDialog);
  ensureDialogCloseButtons(categoryDialog);

  try {
    const { user } = await getSessionUser();
    state.user = user;
    await enterAdmin();
  } catch (error) {
    loginPanel.classList.remove('hidden');
  }
}

loginForm.addEventListener('submit', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
navButtons.forEach((button) => {
  button.addEventListener('click', () => switchSection(button.dataset.section));
});
carCreateBtn.addEventListener('click', () => openCarDialog(null));
carAddCustomBtn.addEventListener('click', () => carCustomList.append(createDynamicRow()));
carAddUrlBtn.addEventListener('click', () => createUrlRow(carUrlList));
carForm.addEventListener('submit', handleCarFormSubmit);
userCreateBtn?.addEventListener('click', () => openUserDialog());
userForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setUserFormMessage('');
  const payload = {
    username: userForm.username.value.trim(),
    password: userForm.password.value,
    role: userForm.role.value,
  };
  try {
    if (state.editingUserId) {
      if (!payload.password) {
        delete payload.password;
      }
      await updateUser(state.editingUserId, payload);
      setUserFormMessage('Benutzer aktualisiert.', 'is-success');
    } else {
      await createUser(payload);
      setUserFormMessage('Benutzer erstellt.', 'is-success');
    }
    await loadUsers();
    userDialog.close();
  } catch (error) {
    setUserFormMessage(error.message || 'Speichern fehlgeschlagen.', 'is-error');
  }
});
brandAddBtn.addEventListener('click', async () => {
  const value = brandInput.value.trim();
  if (!value) return;
  try {
    await createBrand(value);
    brandInput.value = '';
    await loadBrandsAndCategories();
  } catch (error) {
    alert(error.message || 'Marke konnte nicht angelegt werden.');
  }
});
categoryAddBtn.addEventListener('click', () => openCategoryDialog());
categoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setCategoryFormMessage('');
  const payload = {
    name: categoryForm.name.value.trim(),
    icon: categoryForm.icon.value.trim(),
  };
  try {
    if (state.editingCategoryName) {
      await updateCategory(state.editingCategoryName, payload);
      setCategoryFormMessage('Kategorie aktualisiert.', 'is-success');
    } else {
      await createCategory(payload);
      setCategoryFormMessage('Kategorie erstellt.', 'is-success');
    }
    await loadBrandsAndCategories();
    categoryDialog.close();
  } catch (error) {
    setCategoryFormMessage(error.message || 'Speichern fehlgeschlagen.', 'is-error');
  }
});

async function handleDeleteUser(userId) {
  if (!window.confirm('Benutzer wirklich löschen?')) return;
  try {
    await deleteUser(userId);
    await loadUsers();
  } catch (error) {
    alert(error.message || 'Benutzer konnte nicht gelöscht werden.');
  }
}

bootstrap();
