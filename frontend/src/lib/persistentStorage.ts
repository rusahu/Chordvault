function storageManager() {
  return typeof navigator === 'undefined' ? undefined : navigator.storage;
}

export async function checkPersistentStorage(): Promise<boolean | null> {
  const storage = storageManager();
  if (!storage?.persist) return null;
  try {
    return await storage.persisted();
  } catch {
    return false;
  }
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  const storage = storageManager();
  if (!storage?.persist) return null;
  try {
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
