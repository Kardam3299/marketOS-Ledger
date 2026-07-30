const LOCAL_STORAGE = 'local';
const REMOTE_STORAGE = 'remote';

class RepositoryError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'RepositoryError';
    this.details = details;
  }
}

export class BaseRepository {
  constructor(storageType = LOCAL_STORAGE) {
    this.storageType = storageType;
  }

  getStorageType() {
    return this.storageType;
  }
}

export class TransactionRepository extends BaseRepository {
  constructor(storageType = LOCAL_STORAGE) {
    super(storageType);
  }

  async list(filters = {}) {
    if (this.storageType === REMOTE_STORAGE) {
      throw new RepositoryError('Remote Supabase repository is not configured yet.', filters);
    }

    const result = await window.api.getTransactions(filters);
    if (!result.success) {
      throw new RepositoryError(result.error || 'Failed to load transactions', result);
    }
    return result.data || [];
  }

  async add(transaction) {
    if (this.storageType === REMOTE_STORAGE) {
      throw new RepositoryError('Remote Supabase repository is not configured yet.', transaction);
    }

    const result = await window.api.addTransaction(transaction);
    if (!result.success) {
      throw new RepositoryError(result.error || 'Failed to add transaction', result);
    }
    return result;
  }

  async update(id, transaction) {
    if (this.storageType === REMOTE_STORAGE) {
      throw new RepositoryError('Remote Supabase repository is not configured yet.', { id, transaction });
    }

    const result = await window.api.updateTransaction(id, transaction);
    if (!result.success) {
      throw new RepositoryError(result.error || 'Failed to update transaction', result);
    }
    return result;
  }

  async remove(id) {
    if (this.storageType === REMOTE_STORAGE) {
      throw new RepositoryError('Remote Supabase repository is not configured yet.', { id });
    }

    const result = await window.api.deleteTransaction(id);
    if (!result.success) {
      throw new RepositoryError(result.error || 'Failed to delete transaction', result);
    }
    return result;
  }
}

export class SettingsRepository extends BaseRepository {
  constructor(storageType = LOCAL_STORAGE) {
    super(storageType);
  }

  async get() {
    if (this.storageType === REMOTE_STORAGE) {
      throw new RepositoryError('Remote Supabase repository is not configured yet.', null);
    }

    const result = await window.api.getSettings();
    if (!result.success) {
      throw new RepositoryError(result.error || 'Failed to load settings', result);
    }
    return result.data || {};
  }

  async update(settings) {
    if (this.storageType === REMOTE_STORAGE) {
      throw new RepositoryError('Remote Supabase repository is not configured yet.', settings);
    }

    const result = await window.api.updateSettings(settings);
    if (!result.success) {
      throw new RepositoryError(result.error || 'Failed to save settings', result);
    }
    return result;
  }
}

export const resolveStorageMode = () => {
  const configuredUrl = import.meta.env?.VITE_SUPABASE_URL;
  const configuredKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  return configuredUrl && configuredKey ? REMOTE_STORAGE : LOCAL_STORAGE;
};

export const createRepositories = () => {
  const storageType = resolveStorageMode();
  return {
    transactions: new TransactionRepository(storageType),
    settings: new SettingsRepository(storageType),
  };
};
