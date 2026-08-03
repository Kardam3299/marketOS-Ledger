export class ElectronRepository {
  async getTransactions(filters = {}) {
    return window.api.getTransactions(filters);
  }

  async addTransaction(tx) {
    return window.api.addTransaction(tx);
  }

  async updateTransaction(id, tx) {
    return window.api.updateTransaction(id, tx);
  }

  async deleteTransaction(id) {
    return window.api.deleteTransaction(id);
  }

  async getDashboardStats() {
    return window.api.getDashboardStats();
  }

  async getReportData(filters) {
    return window.api.getReportData(filters);
  }

  async getSettings() {
    return window.api.getSettings();
  }

  async updateSettings(settings) {
    return window.api.updateSettings(settings);
  }

  async updateSyncSettings(settings) {
    return window.api.updateSyncSettings(settings);
  }

  async getSyncStatus() {
    return window.api.getSyncStatus();
  }

  async triggerSync() {
    return window.api.triggerSync();
  }

  async clearPendingQueue() {
    if (window.api && window.api.clearPendingQueue) {
      return window.api.clearPendingQueue();
    }
    return { success: true };
  }

  async testSyncConnection(credentials) {
    return window.api.testSyncConnection(credentials);
  }

  notifyOnline() {
    if (window.api.notifyOnline) window.api.notifyOnline();
  }

  onSyncStatusChange(cb) {
    if (window.api.onSyncStatusChange) return window.api.onSyncStatusChange(cb);
    return () => {};
  }

  async backupDatabase() {
    return window.api.backupDatabase();
  }

  async restoreDatabase() {
    return window.api.restoreDatabase();
  }

  async resetDatabase() {
    return window.api.resetDatabase();
  }
}
