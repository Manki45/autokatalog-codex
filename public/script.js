import {
  getCars,
  getBrands,
  getCategories,
  formatCarName,
  compareStore,
  renderCompareTable,
} from './catalog.js';

const categoryList = document.getElementById('category-list');
const randomGrid = document.getElementById('random-cars');
const catalogGrid = document.getElementById('catalog-grid');
const catalogCount = document.getElementById('catalog-count');
const filterForm = document.getElementById('filter-form');
const brandSelect = document.getElementById('filter-brand');
const bodySelect = document.getElementById('filter-body');
const resetFiltersBtn = document.getElementById('reset-filters');
const showAllBtn = document.getElementById('show-all-btn');
const compareTray = document.getElementById('compare-tray');
const compareCount = document.getElementById('compare-count');
const compareOpenBtn = document.getElementById('compare-open');
const compareResetBtn = document.getElementById('compare-reset');
const overlay = document.getElementById('image-overlay');
const overlayImage = document.getElementById('overlay-image');
const overlayCaption = document.getElementById('overlay-caption');
const overlayPrev = overlay?.querySelector('.overlay__nav--prev');
const overlayNext = overlay?.querySelector('.overlay__nav--next');
const overlayClose = overlay?.querySelector('.overlay__close');
const overlayBackdrop = overlay?.querySelector('[data-overlay-dismiss]');
const overlayDetailLink = document.getElementById('overlay-detail-link');
const compareModal = document.getElementById('compare-modal');
const compareBackdrop = compareModal?.querySelector('[data-modal-dismiss]');
const compareClose = compareModal?.querySelector('.modal__close');
const compareTableWrapper = document.getElementById('compare-table-wrapper');

let categories = [];
let cars = [];
let filteredCars = [];
let overlayActiveImages = [];
let overlayActiveIndex = 0;
let overlayActiveCar = null;

function toggleBodyScroll(disabled) {
  document.body.classList.toggle('no-scroll', disabled);
}

function createOption(label, value = '') {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function populateFilters(brands = [], categoryItems = []) {
  brandSelect.innerHTML = '';
  brandSelect.append(createOption('Alle Marken'));
  brands.forEach((brand) => brandSelect.append(createOption(brand, brand)));

  bodySelect.innerHTML = '';
  bodySelect.append(createOption('Alle Karosserien'));
  categoryItems.forEach((category) => bodySelect.append(createOption(category.name, category.name)));
}

function renderCategories() {
  categoryList.innerHTML = '';
  categories.forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-chip';
    button.dataset.bodyType = category.name;
    const icon = document.createElement('img');
    icon.src = category.icon;
    icon.alt = `${category.name} Icon`;
    const label = document.createElement('span');
    label.textContent = category.name;
    button.append(icon, label);
    const hasCars = cars.some((car) => car.bodyTypes?.includes(category.name));
    if (!hasCars) {
      button.classList.add('is-empty');
    } else {
      button.addEventListener('click', () => {
        bodySelect.value = category.name;
        applyFilters();
        window.scrollTo({ top: filterForm.offsetTop - 40, behavior: 'smooth' });
      });
    }
    categoryList.append(button);
  });
}

function selectRandom(array, count) {
  const copy = [...array];
  const selected = [];
  while (copy.length > 0 && selected.length < count) {
    const index = Math.floor(Math.random() * copy.length);
    selected.push(copy.splice(index, 1)[0]);
  }
  return selected;
}

function renderRandomCars() {
  randomGrid.innerHTML = '';
  const picks = selectRandom(filteredCars.length ? filteredCars : cars, 3);
  if (picks.length === 0) {
    randomGrid.innerHTML = '<p class="form__message">Noch keine Fahrzeuge vorhanden.</p>';
    return;
  }
  picks.forEach((car) => {
    const card = createCarTile(car, { compact: true });
    randomGrid.append(card);
  });
  while (randomGrid.children.length < 3) {
    const placeholder = document.createElement('article');
    placeholder.className = 'card placeholder';
    placeholder.innerHTML = '<div class="placeholder__body">Platz für weitere Fahrzeuge</div>';
    randomGrid.append(placeholder);
  }
}

function renderCatalog(list) {
  catalogGrid.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.textContent = catalogGrid.dataset.emptyText;
    catalogGrid.append(empty);
    return;
  }
  list.forEach((car) => {
    const card = createCarTile(car);
    catalogGrid.append(card);
  });
}

function applyFilters() {
  const formData = new FormData(filterForm);
  const brand = formData.get('brand');
  const bodyType = formData.get('bodyType');
  const q = formData.get('q');
  const yearFrom = formData.get('yearFrom');
  const yearTo = formData.get('yearTo');
  filteredCars = cars.filter((car) => {
    if (brand && car.brand !== brand) return false;
    if (bodyType && !car.bodyTypes?.includes(bodyType)) return false;
    if (q) {
      const term = q.toString().toLowerCase();
      if (!`${car.brand} ${car.model}`.toLowerCase().includes(term)) {
        return false;
      }
    }
    if (yearFrom && Number(car.year) < Number(yearFrom)) return false;
    if (yearTo && Number(car.year) > Number(yearTo)) return false;
    return true;
  });
  renderCatalog(filteredCars);
  renderRandomCars();
  updateCatalogCount();
  compareStore.syncFromCars(filteredCars);
}

function resetFilters() {
  filterForm.reset();
  filteredCars = [...cars];
  renderCatalog(filteredCars);
  renderRandomCars();
  updateCatalogCount();
}

function updateCatalogCount() {
  catalogCount.textContent = `${filteredCars.length} Fahrzeuge angezeigt`;
}

function attachCarouselControls(carousel, images) {
  if (!images || images.length <= 1) {
    return;
  }
  const buttons = carousel.querySelectorAll('.carousel__button');
  let index = 0;
  const img = carousel.querySelector('img');

  const updateImage = () => {
    img.style.opacity = '0';
    requestAnimationFrame(() => {
      img.src = images[index];
      img.onload = () => {
        img.style.opacity = '1';
      };
    });
  };

  buttons[0].addEventListener('click', (event) => {
    event.stopPropagation();
    index = (index - 1 + images.length) % images.length;
    updateImage();
  });

  buttons[1].addEventListener('click', (event) => {
    event.stopPropagation();
    index = (index + 1) % images.length;
    updateImage();
  });

  let startX = 0;
  let isSwiping = false;

  carousel.addEventListener('touchstart', (event) => {
    if (!event.touches[0]) return;
    startX = event.touches[0].clientX;
    isSwiping = true;
  });

  carousel.addEventListener('touchmove', (event) => {
    if (!isSwiping || !event.touches[0]) return;
    const diff = event.touches[0].clientX - startX;
    if (Math.abs(diff) > 40) {
      isSwiping = false;
      if (diff > 0) {
        index = (index - 1 + images.length) % images.length;
      } else {
        index = (index + 1) % images.length;
      }
      updateImage();
    }
  });

  carousel.addEventListener('touchend', () => {
    isSwiping = false;
  });
}

function createCarTile(car, { compact = false } = {}) {
  const card = document.createElement('article');
  card.className = 'card car-tile';

  const carousel = document.createElement('div');
  carousel.className = 'carousel';
  const carouselImg = document.createElement('img');
  carouselImg.src = car.images?.[0] || '/img/hero-bg.jpg';
  carouselImg.alt = formatCarName(car);
  carousel.appendChild(carouselImg);

  if (car.images?.length > 1) {
    const controls = document.createElement('div');
    controls.className = 'carousel__controls';
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'carousel__button';
    prev.innerHTML = '‹';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'carousel__button';
    next.innerHTML = '›';
    controls.append(prev, next);
    carousel.append(controls);
    attachCarouselControls(carousel, car.images);
  }

  carousel.addEventListener('click', () => openOverlay(car, 0));

  const titleWrap = document.createElement('div');
  titleWrap.className = 'car-title';
  const link = document.createElement('a');
  link.href = `/car.html?id=${encodeURIComponent(car.id)}`;
  link.textContent = formatCarName(car);
  link.addEventListener('click', (event) => {
    event.preventDefault();
    openOverlay(car, 0);
  });
  titleWrap.append(link);

  const meta = document.createElement('div');
  meta.className = 'car-meta';
  meta.innerHTML = `Baujahr ${car.year}${car.powerPS ? ` • ${car.powerPS} PS` : ''}`;

  const tags = document.createElement('div');
  tags.className = 'chip-list';
  (car.bodyTypes || []).forEach((type) => {
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.textContent = type;
    tags.append(chip);
  });

  const specsList = document.createElement('dl');
  specsList.className = 'spec-list';
  const specs = [
    ['0–100 km/h', car.acceleration_0_100 ? `${car.acceleration_0_100} s` : null],
    ['Höchstgeschwindigkeit', car.topSpeed ? `${car.topSpeed} km/h` : null],
    ['Verbrauch', car.consumption || null],
  ];

  specs.forEach(([label, value]) => {
    if (!value) return;
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    specsList.append(dt, dd);
  });

  Object.entries(car.customCategories || {}).forEach(([label, value]) => {
    if (!value) return;
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    specsList.append(dt, dd);
  });

  const compareWrapper = document.createElement('div');
  compareWrapper.className = 'compare-wrapper';
  const compareLabel = document.createElement('label');
  const compareInput = document.createElement('input');
  compareInput.type = 'checkbox';
  compareInput.dataset.compareId = car.id;
  compareInput.checked = compareStore.has(car.id);
  compareInput.addEventListener('change', () => compareStore.toggle(car));
  compareLabel.append(compareInput, document.createTextNode(' Vergleichen'));
  compareWrapper.append(compareLabel);

  card.append(carousel, titleWrap, meta, tags, specsList, compareWrapper);

  if (compact) {
    card.classList.add('card--compact');
  }

  return card;
}

function openOverlay(car, startIndex = 0) {
  if (!overlay) return;
  overlayActiveCar = car;
  overlayActiveImages = car.images && car.images.length ? car.images : ['/img/hero-bg.jpg'];
  overlayActiveIndex = startIndex;
  overlay.classList.add('is-open');
  toggleBodyScroll(true);
  updateOverlayImage();
  overlay.setAttribute('aria-hidden', 'false');
  overlayClose?.focus({ preventScroll: true });
  if (overlayDetailLink) {
    overlayDetailLink.href = `/car.html?id=${encodeURIComponent(car.id)}`;
  }
}

function closeOverlay() {
  overlay?.classList.remove('is-open');
  overlay?.setAttribute('aria-hidden', 'true');
  toggleBodyScroll(false);
  overlayActiveImages = [];
  overlayActiveCar = null;
}

function updateOverlayImage() {
  overlayImage.src = overlayActiveImages[overlayActiveIndex];
  overlayCaption.textContent = `${formatCarName(overlayActiveCar)} – ${overlayActiveIndex + 1} / ${overlayActiveImages.length}`;
  overlayPrev?.classList.toggle('hidden', overlayActiveImages.length <= 1);
  overlayNext?.classList.toggle('hidden', overlayActiveImages.length <= 1);
}

function openCompareModal() {
  compareModal?.classList.add('is-open');
  compareModal?.setAttribute('aria-hidden', 'false');
  toggleBodyScroll(true);
  const carsToCompare = compareStore.toArray();
  compareTableWrapper.innerHTML = renderCompareTable(carsToCompare);
}

function closeCompareModal() {
  compareModal?.classList.remove('is-open');
  compareModal?.setAttribute('aria-hidden', 'true');
  toggleBodyScroll(false);
}

function handleScroll() {
  if (window.scrollY > 48) {
    document.body.classList.add('hero--minified');
  } else {
    document.body.classList.remove('hero--minified');
  }
}

function initOverlayEvents() {
  overlayClose?.addEventListener('click', closeOverlay);
  overlayBackdrop?.addEventListener('click', closeOverlay);
  overlayPrev?.addEventListener('click', () => {
    overlayActiveIndex = (overlayActiveIndex - 1 + overlayActiveImages.length) % overlayActiveImages.length;
    updateOverlayImage();
  });
  overlayNext?.addEventListener('click', () => {
    overlayActiveIndex = (overlayActiveIndex + 1) % overlayActiveImages.length;
    updateOverlayImage();
  });
  document.addEventListener('keydown', (event) => {
    if (!overlay?.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      closeOverlay();
    }
    if (event.key === 'ArrowLeft') {
      overlayPrev?.click();
    }
    if (event.key === 'ArrowRight') {
      overlayNext?.click();
    }
  });
}

function initCompareTray() {
  compareOpenBtn?.addEventListener('click', () => {
    if (compareStore.toArray().length > 0) {
      openCompareModal();
    }
  });
  compareResetBtn?.addEventListener('click', () => {
    compareStore.clear();
  });
  compareBackdrop?.addEventListener('click', closeCompareModal);
  compareClose?.addEventListener('click', closeCompareModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && compareModal?.classList.contains('is-open')) {
      closeCompareModal();
    }
  });
  compareStore.subscribe((items) => {
    const size = items.size;
    compareCount.textContent = `${size} Fahrzeuge ausgewählt`;
    compareTray.classList.toggle('is-visible', size > 0);
    document.querySelectorAll('input[data-compare-id]').forEach((input) => {
      input.checked = items.has(input.dataset.compareId);
    });
  });
}

async function init() {
  window.addEventListener('scroll', handleScroll, { passive: true });
  initOverlayEvents();
  initCompareTray();
  filterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    applyFilters();
  });
  resetFiltersBtn?.addEventListener('click', resetFilters);
  showAllBtn?.addEventListener('click', resetFilters);

  try {
    const [categoriesResponse, brandsResponse, carsResponse] = await Promise.all([
      getCategories(),
      getBrands(),
      getCars(),
    ]);
    categories = categoriesResponse;
    const brands = brandsResponse;
    cars = carsResponse;
    filteredCars = [...cars];

    populateFilters(brands, categories);
    renderCategories();
    renderCatalog(filteredCars);
    renderRandomCars();
    updateCatalogCount();
    compareStore.syncFromCars(cars);
  } catch (error) {
    catalogGrid.innerHTML = `<div class="card"><p class="form__message is-error">${error.message}</p></div>`;
  }
}

init();
