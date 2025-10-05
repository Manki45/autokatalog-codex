const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const locks = new Map();

function toAbsolute(filePath) {
  return path.resolve(filePath);
}

async function runExclusive(filePath, task) {
  const abs = toAbsolute(filePath);
  const previous = locks.get(abs) || Promise.resolve();
  const next = previous.then(() => task());
  locks.set(abs, next.catch(() => {}));
  try {
    return await next;
  } finally {
    if (locks.get(abs) === next) {
      locks.delete(abs);
    }
  }
}

async function ensureDirectory(dirPath) {
  const abs = toAbsolute(dirPath);
  await fsp.mkdir(abs, { recursive: true });
  return abs;
}

async function readJson(filePath, defaultValue) {
  const abs = toAbsolute(filePath);
  return runExclusive(abs, async () => {
    try {
      const raw = await fsp.readFile(abs, 'utf8');
      if (!raw && defaultValue !== undefined) {
        return defaultValue;
      }
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      if (error.code === 'ENOENT') {
        if (defaultValue !== undefined) {
          await ensureDirectory(path.dirname(abs));
          await fsp.writeFile(abs, JSON.stringify(defaultValue, null, 2));
          return defaultValue;
        }
        throw error;
      }
      throw error;
    }
  });
}

async function writeJson(filePath, value) {
  const abs = toAbsolute(filePath);
  return runExclusive(abs, async () => {
    await ensureDirectory(path.dirname(abs));
    await fsp.writeFile(abs, JSON.stringify(value, null, 2));
    return value;
  });
}

async function updateJson(filePath, updater, defaultValue) {
  const abs = toAbsolute(filePath);
  return runExclusive(abs, async () => {
    let current = defaultValue;
    try {
      const raw = await fsp.readFile(abs, 'utf8');
      current = raw ? JSON.parse(raw) : defaultValue;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    const nextValue = await updater(current);
    await ensureDirectory(path.dirname(abs));
    await fsp.writeFile(abs, JSON.stringify(nextValue, null, 2));
    return nextValue;
  });
}

async function removeDirRecursive(targetPath) {
  const abs = toAbsolute(targetPath);
  try {
    await fsp.rm(abs, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function fileExists(targetPath) {
  try {
    await fsp.access(toAbsolute(targetPath), fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  readJson,
  writeJson,
  updateJson,
  ensureDirectory,
  removeDirRecursive,
  fileExists,
};
