class RepositoryError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'RepositoryError';
    this.details = details;
  }
}

export class TransactionRepository {
  async list(filters = {}) {
    const result = await window.api.getTransactions(filters);
    if (!result.success) {
      throw new RepositoryError(result.error || 'Failed to load transactions', result);
    }
    return result.data || [];
  }

  async add(transaction) {
    const result = await window.api.addTransaction(transaction);
    if (!result.success) {
      throw new RepositoryError(result.error || 'Failed to add transaction', result);
    }
    return result;
  }

  async update(id, transaction) {
    const result = await window.api.updateTransaction(id, transaction);
    if (!result.success) {
      throw new RepositoryError(result.error || 'Failed to update transaction', result);
    }
    return result;
  }

  async remove(id) {
    const result = await window.api.deleteTransaction(id);
    if (!result.success) {
      throw new RepositoryError(result.error || 'Failed to delete transaction', result);
    }
    return result;
  }
}

export class SettingsRepository {
  async get() {
    const result = await window.api.getSettings();
    if (!result.success) {
      throw new RepositoryError(result.error || 'Failed to load settings', result);
    }
    return result.data || {};
  }

  async update(settings) {
    const result = await window.api.updateSettings(settings);
    if (!result.success) {
      throw new RepositoryError(result.error || 'Failed to save settings', result);
    }
    return result;
  }
}

export const createRepositories = () => {
  return {
    transactions: new TransactionRepository(),
    settings: new SettingsRepository(),
  };
};
