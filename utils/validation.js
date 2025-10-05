const currentYear = new Date().getFullYear();

function isString(value) {
  return typeof value === 'string';
}

function toCleanString(value) {
  return isString(value) ? value.trim() : '';
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function validateYear(value, errors) {
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year)) {
    errors.push('Baujahr muss eine Zahl sein.');
    return null;
  }
  if (year < 1886 || year > currentYear + 1) {
    errors.push(`Baujahr muss zwischen 1886 und ${currentYear + 1} liegen.`);
    return null;
  }
  return year;
}

function validateBodyTypes(bodyTypes, allowedBodyTypes, errors) {
  if (bodyTypes === undefined || bodyTypes === null) {
    return [];
  }
  const list = Array.isArray(bodyTypes)
    ? bodyTypes
    : toCleanString(bodyTypes).split(',').map((item) => item.trim()).filter(Boolean);
  const unique = [...new Set(list)];
  const invalid = unique.filter((item) => !allowedBodyTypes.includes(item));
  if (invalid.length > 0) {
    errors.push(`Ungültige Karosserie-Typen: ${invalid.join(', ')}.`);
  }
  return unique.filter((item) => allowedBodyTypes.includes(item));
}

function validateCustomCategories(customCategories, errors) {
  if (customCategories === undefined || customCategories === null || customCategories === '') {
    return {};
  }
  let map = customCategories;
  if (isString(customCategories)) {
    try {
      map = JSON.parse(customCategories);
    } catch (error) {
      errors.push('Eigene Kategorien müssen als JSON-Objekt vorliegen.');
      return {};
    }
  }
  if (typeof map !== 'object' || Array.isArray(map)) {
    errors.push('Eigene Kategorien müssen ein Objekt sein.');
    return {};
  }
  const sanitized = {};
  for (const [key, value] of Object.entries(map)) {
    const cleanKey = toCleanString(key).slice(0, 50);
    if (!cleanKey) {
      errors.push('Kategorie-Schlüssel dürfen nicht leer sein.');
      continue;
    }
    if (typeof value === 'object') {
      errors.push(`Kategorie "${cleanKey}" darf keinen verschachtelten Wert enthalten.`);
      continue;
    }
    sanitized[cleanKey] = String(value).slice(0, 120);
  }
  return sanitized;
}

function validateImages(images, errors) {
  if (!images) {
    return [];
  }
  if (!Array.isArray(images)) {
    errors.push('Bilder müssen als Array übergeben werden.');
    return [];
  }
  return images.filter((item) => isString(item) && item.trim().length > 0);
}

function validateCarPayload(payload, options = {}) {
  const { allowedBodyTypes = [], partial = false, status = 'published' } = options;
  const errors = [];
  const result = {};

  const brand = toCleanString(payload.brand);
  if (!brand && !partial) {
    errors.push('Marke ist erforderlich.');
  }
  if (brand) {
    result.brand = brand;
  }

  const model = toCleanString(payload.model);
  if (!model && !partial) {
    errors.push('Modell ist erforderlich.');
  }
  if (model) {
    result.model = model;
  }

  const yearRaw = payload.year;
  if (yearRaw !== undefined || !partial) {
    const validatedYear = validateYear(yearRaw, errors);
    if (validatedYear !== null) {
      result.year = validatedYear;
    }
  }

  const power = asNumber(payload.powerPS);
  if (power !== null) {
    if (power < 0) {
      errors.push('PS darf nicht negativ sein.');
    } else {
      result.powerPS = Math.round(power);
    }
  }

  const topSpeed = asNumber(payload.topSpeed);
  if (topSpeed !== null) {
    if (topSpeed <= 0) {
      errors.push('Höchstgeschwindigkeit muss positiv sein.');
    } else {
      result.topSpeed = Math.round(topSpeed);
    }
  }

  const acceleration = asNumber(payload.acceleration_0_100);
  if (acceleration !== null) {
    if (acceleration <= 0) {
      errors.push('Beschleunigung muss positiv sein.');
    } else {
      result.acceleration_0_100 = Number(acceleration.toFixed(1));
    }
  }

  if (payload.consumption !== undefined && payload.consumption !== null) {
    const consumption = toCleanString(payload.consumption).slice(0, 60);
    if (consumption) {
      result.consumption = consumption;
    }
  }

  result.bodyTypes = validateBodyTypes(payload.bodyTypes, allowedBodyTypes, errors);
  result.customCategories = validateCustomCategories(payload.customCategories, errors);
  result.images = validateImages(payload.images, errors);
  result.status = status;

  if (payload.createdAt) {
    result.createdAt = String(payload.createdAt);
  }
  if (payload.updatedAt) {
    result.updatedAt = String(payload.updatedAt);
  }

  return {
    valid: errors.length === 0,
    errors,
    value: result,
  };
}

function validateUserPayload(payload, options = {}) {
  const { requirePassword = true } = options;
  const errors = [];
  const username = toCleanString(payload.username);
  if (!username) {
    errors.push('Benutzername ist erforderlich.');
  }
  const role = toCleanString(payload.role);
  if (!role || !['admin', 'editor'].includes(role)) {
    errors.push('Rolle muss "admin" oder "editor" sein.');
  }
  const password = toCleanString(payload.password);
  if (requirePassword && password.length < 6) {
    errors.push('Passwort muss mindestens 6 Zeichen haben.');
  }
  return {
    valid: errors.length === 0,
    errors,
    value: {
      username,
      role,
      password,
    },
  };
}

function validateBrandPayload(payload) {
  const errors = [];
  const name = toCleanString(payload.name);
  if (!name) {
    errors.push('Markenname darf nicht leer sein.');
  }
  return { valid: errors.length === 0, errors, value: { name } };
}

function validateCategoryPayload(payload) {
  const errors = [];
  const name = toCleanString(payload.name);
  if (!name) {
    errors.push('Kategoriename darf nicht leer sein.');
  }
  const icon = toCleanString(payload.icon);
  if (!icon) {
    errors.push('Icon-Pfad darf nicht leer sein.');
  }
  return {
    valid: errors.length === 0,
    errors,
    value: { name, icon }
  };
}

function validateCredentials(payload) {
  const errors = [];
  const username = toCleanString(payload.username);
  const password = toCleanString(payload.password);
  if (!username || !password) {
    errors.push('Benutzername und Passwort sind erforderlich.');
  }
  return {
    valid: errors.length === 0,
    errors,
    value: { username, password },
  };
}

module.exports = {
  validateCarPayload,
  validateUserPayload,
  validateBrandPayload,
  validateCategoryPayload,
  validateCredentials,
};
