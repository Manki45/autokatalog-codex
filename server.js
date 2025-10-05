const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');

const {
  readJson,
  writeJson,
  updateJson,
  ensureDirectory,
  removeDirRecursive,
  fileExists,
} = require('./utils/fsAsync');
const {
  validateCarPayload,
  validateUserPayload,
  validateBrandPayload,
  validateCategoryPayload,
  validateCredentials,
} = require('./utils/validation');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_IDLE_TIMEOUT = 10 * 60 * 1000;

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');

const CARS_FILE = path.join(DATA_DIR, 'cars.json');
const PENDING_FILE = path.join(DATA_DIR, 'pending.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const BRANDS_FILE = path.join(DATA_DIR, 'brands.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-session-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_IDLE_TIMEOUT,
    },
  })
);

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    return next();
  }
  const now = Date.now();
  if (req.session && req.session.user) {
    if (req.session.lastActivity && now - req.session.lastActivity > SESSION_IDLE_TIMEOUT) {
      return req.session.destroy(() => {
        res.status(401).json({ message: 'Session abgelaufen.' });
      });
    }
    req.session.lastActivity = now;
  }
  next();
});

app.use(express.static(PUBLIC_DIR));

function apiError(res, status, message, details) {
  return res.status(status).json({ message, details });
}

async function loadCategories() {
  const categories = await readJson(CATEGORIES_FILE, []);
  return Array.isArray(categories) ? categories : [];
}

async function loadBrands() {
  const brands = await readJson(BRANDS_FILE, []);
  return Array.isArray(brands) ? brands : [];
}

async function loadCars() {
  const cars = await readJson(CARS_FILE, []);
  return Array.isArray(cars) ? cars : [];
}

async function loadPending() {
  const pending = await readJson(PENDING_FILE, []);
  return Array.isArray(pending) ? pending : [];
}

async function loadUsers() {
  const users = await readJson(USERS_FILE, []);
  return Array.isArray(users) ? users : [];
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return apiError(res, 401, 'Nicht angemeldet.');
  }
  next();
}

function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return apiError(res, 401, 'Nicht angemeldet.');
    }
    const { role } = req.session.user;
    if (requiredRole === 'editor' && ['editor', 'admin'].includes(role)) {
      return next();
    }
    if (requiredRole === 'admin' && role === 'admin') {
      return next();
    }
    return apiError(res, 403, 'Keine Berechtigung.');
  };
}

function normalizeArrayField(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null || value === '') {
    return [];
  }
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseCustomCategories(value) {
  if (!value) {
    return {};
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value
        .split('\n')
        .map((line) => line.split(':').map((item) => item.trim()))
        .filter(([key, val]) => key && val)
        .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});
    }
  }
  return value;
}

function parseJsonArray(value, fallback = []) {
  if (!value) {
    return fallback;
  }
  if (Array.isArray(value)) {
    return value;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

function parseStringArray(value) {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch (error) {
      // fall back to delimiter parsing
    }
    return trimmed
      .split(/\r?\n|,/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function parseImageUrls(value) {
  return parseStringArray(value).filter((item) => {
    if (item.startsWith('http://') || item.startsWith('https://')) {
      return true;
    }
    return item.startsWith('/');
  });
}

function mergeImages(...lists) {
  const seen = new Set();
  const result = [];
  lists
    .filter(Boolean)
    .forEach((list) => {
      list.forEach((item) => {
        const trimmed = String(item).trim();
        if (!trimmed || seen.has(trimmed)) {
          return;
        }
        seen.add(trimmed);
        result.push(trimmed);
      });
    });
  return result;
}

function toPublicPath(filePath) {
  const relative = path.relative(PUBLIC_DIR, filePath);
  return `/${relative.split(path.sep).join('/')}`;
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const id = req.uploadTargetId;
      if (!id) {
        return cb(new Error('Upload-Ziel wurde nicht gesetzt.'));
      }
      const uploadPath = path.join(UPLOAD_DIR, id);
      await ensureDirectory(uploadPath);
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, safeName);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Nur JPG- und PNG-Dateien sind erlaubt.'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
});

app.post('/api/auth/login', async (req, res) => {
  const validation = validateCredentials(req.body || {});
  if (!validation.valid) {
    return apiError(res, 400, 'Ungültige Eingabe.', validation.errors);
  }
  const { username, password } = validation.value;
  const users = await loadUsers();
  const user = users.find((entry) => entry.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    return apiError(res, 401, 'Ungültige Zugangsdaten.');
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return apiError(res, 401, 'Ungültige Zugangsdaten.');
  }
  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
  };
  req.session.lastActivity = Date.now();
  res.json({ user: req.session.user });
});

app.post('/api/auth/logout', (req, res) => {
  if (!req.session) {
    return res.json({ message: 'Bereits abgemeldet.' });
  }
  req.session.destroy(() => {
    res.json({ message: 'Abgemeldet.' });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return apiError(res, 401, 'Nicht angemeldet.');
  }
  res.json({ user: req.session.user });
});

app.get('/api/users', requireRole('admin'), async (req, res) => {
  const users = await loadUsers();
  const sanitized = users.map(({ passwordHash, ...rest }) => rest);
  res.json({ users: sanitized });
});

app.post('/api/users', requireRole('admin'), async (req, res) => {
  const validation = validateUserPayload(req.body || {});
  if (!validation.valid) {
    return apiError(res, 400, 'Ungültige Eingabe.', validation.errors);
  }
  const { username, password, role } = validation.value;
  const users = await loadUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return apiError(res, 409, 'Benutzername existiert bereits.');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = { id: uuid(), username, role, passwordHash };
  await writeJson(USERS_FILE, [...users, newUser]);
  res.status(201).json({ user: { id: newUser.id, username, role } });
});

app.put('/api/users/:id', requireRole('admin'), async (req, res) => {
  const userId = req.params.id;
  const users = await loadUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    return apiError(res, 404, 'Benutzer nicht gefunden.');
  }
  const validation = validateUserPayload(req.body || {}, { requirePassword: false });
  if (!validation.valid) {
    return apiError(res, 400, 'Ungültige Eingabe.', validation.errors);
  }
  const { username, role, password } = validation.value;
  if (users.some((u, idx) => idx !== index && u.username.toLowerCase() === username.toLowerCase())) {
    return apiError(res, 409, 'Benutzername existiert bereits.');
  }
  const updatedUser = { ...users[index], username, role };
  if (password) {
    updatedUser.passwordHash = await bcrypt.hash(password, 10);
  }
  users[index] = updatedUser;
  await writeJson(USERS_FILE, users);
  res.json({ user: { id: updatedUser.id, username, role } });
});

app.delete('/api/users/:id', requireRole('admin'), async (req, res) => {
  const userId = req.params.id;
  const users = await loadUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    return apiError(res, 404, 'Benutzer nicht gefunden.');
  }
  const [removed] = users.splice(index, 1);
  await writeJson(USERS_FILE, users);
  res.json({ message: `Benutzer ${removed.username} gelöscht.` });
});

app.get('/api/brands', async (req, res) => {
  const brands = await loadBrands();
  res.json({ brands });
});

app.post('/api/brands', requireRole('editor'), async (req, res) => {
  const validation = validateBrandPayload(req.body || {});
  if (!validation.valid) {
    return apiError(res, 400, 'Ungültige Eingabe.', validation.errors);
  }
  const { name } = validation.value;
  const brands = await loadBrands();
  if (brands.some((brand) => brand.toLowerCase() === name.toLowerCase())) {
    return apiError(res, 409, 'Marke existiert bereits.');
  }
  brands.push(name);
  brands.sort((a, b) => a.localeCompare(b));
  await writeJson(BRANDS_FILE, brands);
  res.status(201).json({ brand: name });
});

app.delete('/api/brands/:name', requireRole('editor'), async (req, res) => {
  const target = req.params.name;
  const brands = await loadBrands();
  const index = brands.findIndex((brand) => brand.toLowerCase() === target.toLowerCase());
  if (index === -1) {
    return apiError(res, 404, 'Marke nicht gefunden.');
  }
  brands.splice(index, 1);
  await writeJson(BRANDS_FILE, brands);
  res.json({ message: 'Marke gelöscht.' });
});

app.get('/api/categories', async (req, res) => {
  const categories = await loadCategories();
  res.json({ categories });
});

app.post('/api/categories', requireRole('editor'), async (req, res) => {
  const validation = validateCategoryPayload(req.body || {});
  if (!validation.valid) {
    return apiError(res, 400, 'Ungültige Eingabe.', validation.errors);
  }
  const { name, icon } = validation.value;
  const categories = await loadCategories();
  if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
    return apiError(res, 409, 'Kategorie existiert bereits.');
  }
  const newCategory = { name, icon };
  categories.push(newCategory);
  await writeJson(CATEGORIES_FILE, categories);
  res.status(201).json({ category: newCategory });
});

app.put('/api/categories/:name', requireRole('editor'), async (req, res) => {
  const currentName = req.params.name;
  const validation = validateCategoryPayload(req.body || {});
  if (!validation.valid) {
    return apiError(res, 400, 'Ungültige Eingabe.', validation.errors);
  }
  const categories = await loadCategories();
  const index = categories.findIndex((category) => category.name.toLowerCase() === currentName.toLowerCase());
  if (index === -1) {
    return apiError(res, 404, 'Kategorie nicht gefunden.');
  }
  const { name, icon } = validation.value;
  if (
    categories.some(
      (category, idx) => idx !== index && category.name.toLowerCase() === name.toLowerCase()
    )
  ) {
    return apiError(res, 409, 'Kategorie existiert bereits.');
  }
  categories[index] = { name, icon };
  await writeJson(CATEGORIES_FILE, categories);
  res.json({ category: categories[index] });
});

app.delete('/api/categories/:name', requireRole('editor'), async (req, res) => {
  const target = req.params.name;
  const categories = await loadCategories();
  const index = categories.findIndex((category) => category.name.toLowerCase() === target.toLowerCase());
  if (index === -1) {
    return apiError(res, 404, 'Kategorie nicht gefunden.');
  }
  categories.splice(index, 1);
  await writeJson(CATEGORIES_FILE, categories);
  res.json({ message: 'Kategorie gelöscht.' });
});

app.get('/api/cars', async (req, res) => {
  const { brand, yearFrom, yearTo, bodyType, q } = req.query;
  const cars = await loadCars();
  const filtered = cars.filter((car) => {
    if (brand && car.brand.toLowerCase() !== String(brand).toLowerCase()) {
      return false;
    }
    if (bodyType && !car.bodyTypes.includes(bodyType)) {
      return false;
    }
    if (q && !`${car.brand} ${car.model}`.toLowerCase().includes(String(q).toLowerCase())) {
      return false;
    }
    const year = Number(car.year);
    if (yearFrom && Number.isFinite(Number(yearFrom)) && year < Number(yearFrom)) {
      return false;
    }
    if (yearTo && Number.isFinite(Number(yearTo)) && year > Number(yearTo)) {
      return false;
    }
    return true;
  });
  res.json({ cars: filtered });
});

app.get('/api/cars/:id', async (req, res) => {
  const cars = await loadCars();
  const car = cars.find((entry) => entry.id === req.params.id);
  if (!car) {
    return apiError(res, 404, 'Fahrzeug nicht gefunden.');
  }
  res.json({ car });
});

app.post(
  '/api/cars',
  requireRole('editor'),
  (req, res, next) => {
    req.uploadTargetId = uuid();
    next();
  },
  upload.array('images', 12),
  async (req, res) => {
    try {
      const categories = await loadCategories();
      const allowedBodyTypes = categories.map((category) => category.name);
      const newImagePaths = (req.files || []).map((file) => toPublicPath(file.path));
      const urlImages = parseImageUrls(req.body.imageUrls);
      const combinedImages = mergeImages(urlImages, newImagePaths);
      const payload = {
        ...req.body,
        bodyTypes: normalizeArrayField(req.body.bodyTypes),
        customCategories: parseCustomCategories(req.body.customCategories),
        images: combinedImages,
      };
      const validation = validateCarPayload(payload, { allowedBodyTypes });
      if (!validation.valid) {
        return apiError(res, 400, 'Ungültige Eingabe.', validation.errors);
      }
      const now = new Date().toISOString();
      const car = {
        id: req.uploadTargetId,
        ...validation.value,
        createdAt: now,
        updatedAt: now,
        status: 'published',
      };
      await updateJson(
        CARS_FILE,
        (current = []) => {
          const list = Array.isArray(current) ? [...current] : [];
          list.push(car);
          return list;
        },
        []
      );
      res.status(201).json({ car });
    } catch (error) {
      console.error(error);
      apiError(res, 500, 'Speichern fehlgeschlagen.', error.message);
    }
  }
);

app.put(
  '/api/cars/:id',
  requireRole('editor'),
  (req, res, next) => {
    req.uploadTargetId = req.params.id;
    next();
  },
  upload.array('images', 12),
  async (req, res) => {
    const carId = req.params.id;
    const cars = await loadCars();
    const index = cars.findIndex((car) => car.id === carId);
    if (index === -1) {
      return apiError(res, 404, 'Fahrzeug nicht gefunden.');
    }
    const existing = cars[index];
    const keepImages = parseJsonArray(req.body.keepImages, existing.images || []);
    const removedImages = (existing.images || []).filter((image) => !keepImages.includes(image));
    for (const imagePath of removedImages) {
      if (!imagePath.startsWith('/uploads/')) {
        continue;
      }
      const absolute = path.join(PUBLIC_DIR, imagePath);
      try {
        await fsp.unlink(absolute);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn('Konnte Bild nicht löschen:', absolute, error.message);
        }
      }
    }
    const newFiles = (req.files || []).map((file) => toPublicPath(file.path));
    const urlImages = parseImageUrls(req.body.imageUrls);
    const categories = await loadCategories();
    const allowedBodyTypes = categories.map((category) => category.name);
    const bodyTypesValue =
      req.body.bodyTypes !== undefined ? req.body.bodyTypes : existing.bodyTypes;
    const customCategories =
      req.body.customCategories !== undefined
        ? parseCustomCategories(req.body.customCategories)
        : existing.customCategories;
    const mergedImages = mergeImages(keepImages, newFiles, urlImages);
    const payload = {
      ...existing,
      ...req.body,
      bodyTypes: normalizeArrayField(bodyTypesValue),
      customCategories,
      images: mergedImages,
    };
    const validation = validateCarPayload(payload, { allowedBodyTypes, partial: true });
    if (!validation.valid) {
      return apiError(res, 400, 'Ungültige Eingabe.', validation.errors);
    }
    const updatedCar = {
      ...existing,
      ...validation.value,
      id: existing.id,
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'published',
      images: mergedImages,
    };
    cars[index] = updatedCar;
    await writeJson(CARS_FILE, cars);
    res.json({ car: updatedCar });
  }
);

app.delete('/api/cars/:id', requireRole('editor'), async (req, res) => {
  const carId = req.params.id;
  const cars = await loadCars();
  const index = cars.findIndex((car) => car.id === carId);
  if (index === -1) {
    return apiError(res, 404, 'Fahrzeug nicht gefunden.');
  }
  cars.splice(index, 1);
  await writeJson(CARS_FILE, cars);
  await removeDirRecursive(path.join(UPLOAD_DIR, carId));
  res.json({ message: 'Fahrzeug gelöscht.' });
});

app.get('/api/pending', requireRole('editor'), async (req, res) => {
  const pending = await loadPending();
  res.json({ pending });
});

app.get('/api/pending/:id', requireRole('editor'), async (req, res) => {
  const pending = await loadPending();
  const entry = pending.find((item) => item.id === req.params.id);
  if (!entry) {
    return apiError(res, 404, 'Einreichung nicht gefunden.');
  }
  res.json({ pending: entry });
});

app.post(
  '/api/pending',
  (req, res, next) => {
    req.uploadTargetId = uuid();
    next();
  },
  upload.array('images', 12),
  async (req, res) => {
    const categories = await loadCategories();
    const allowedBodyTypes = categories.map((category) => category.name);
    const newImages = (req.files || []).map((file) => toPublicPath(file.path));
    const urlImages = parseImageUrls(req.body.imageUrls);
    const combinedImages = mergeImages(urlImages, newImages);
    const payload = {
      ...req.body,
      bodyTypes: normalizeArrayField(req.body.bodyTypes),
      customCategories: parseCustomCategories(req.body.customCategories),
      images: combinedImages,
    };
    const validation = validateCarPayload(payload, { allowedBodyTypes, status: 'pending' });
    if (!validation.valid) {
      return apiError(res, 400, 'Ungültige Eingabe.', validation.errors);
    }
    const now = new Date().toISOString();
    const pendingEntry = {
      id: req.uploadTargetId,
      ...validation.value,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
    };
    await updateJson(
      PENDING_FILE,
      (current = []) => {
        const list = Array.isArray(current) ? [...current] : [];
        list.push(pendingEntry);
        return list;
      },
      []
    );
    res.status(201).json({ pending: pendingEntry, message: 'Einreichung gespeichert. Wird geprüft.' });
  }
);

app.post('/api/pending/:id/approve', requireRole('editor'), async (req, res) => {
  const pendingId = req.params.id;
  const pending = await loadPending();
  const index = pending.findIndex((item) => item.id === pendingId);
  if (index === -1) {
    return apiError(res, 404, 'Einreichung nicht gefunden.');
  }
  const entry = pending[index];
  pending.splice(index, 1);
  await writeJson(PENDING_FILE, pending);
  const now = new Date().toISOString();
  const published = {
    ...entry,
    status: 'published',
    updatedAt: now,
    createdAt: entry.createdAt || now,
  };
  await updateJson(
    CARS_FILE,
    (current = []) => {
      const list = Array.isArray(current) ? [...current] : [];
      list.push(published);
      return list;
    },
    []
  );
  res.json({ car: published });
});

app.post('/api/pending/:id/reject', requireRole('editor'), async (req, res) => {
  const pendingId = req.params.id;
  const pending = await loadPending();
  const index = pending.findIndex((item) => item.id === pendingId);
  if (index === -1) {
    return apiError(res, 404, 'Einreichung nicht gefunden.');
  }
  pending.splice(index, 1);
  await writeJson(PENDING_FILE, pending);
  await removeDirRecursive(path.join(UPLOAD_DIR, pendingId));
  res.json({ message: 'Einreichung abgelehnt und gelöscht.' });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return apiError(res, 400, 'Upload fehlgeschlagen.', err.message);
  }
  if (err) {
    console.error(err);
    return apiError(res, 500, 'Unerwarteter Fehler.', err.message);
  }
  next();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

async function start() {
  await ensureDirectory(DATA_DIR);
  await ensureDirectory(UPLOAD_DIR);
  app.listen(PORT, () => {
    console.log(`Server läuft unter http://localhost:${PORT}`);
  });
}

start();
