import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import Input from '../components/Input';
import Select from '../components/Select';
import Button from '../components/Button';
import { useSettings } from '../hooks/useData';
import { useToast } from '../context/ToastContext';
import { CURRENCIES } from '../utils/constants';
import { validateBusinessName, validateOwnerName } from '../utils/validators';

export default function Settings() {
  const { settings, loading, updateSettings } = useSettings();
  const { success, error } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    business_name: '',
    owner_name: '',
    currency: 'USD',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        business_name: settings.business_name || '',
        owner_name: settings.owner_name || '',
        currency: settings.currency || 'USD',
      });
    }
  }, [settings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();

    const businessValidation = validateBusinessName(formData.business_name);
    const ownerValidation = validateOwnerName(formData.owner_name);

    const newErrors = {};
    if (!businessValidation.valid) newErrors.business_name = businessValidation.error;
    if (!ownerValidation.valid) newErrors.owner_name = ownerValidation.error;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      error('Please fix the errors');
      return;
    }

    setIsUpdating(true);
    const result = await updateSettings(formData);
    setIsUpdating(false);

    if (result) {
      success('Settings saved successfully');
    }
  };

  const handleBackupDatabase = async () => {
    try {
      const result = await window.api.backupDatabase();
      if (result.success) {
        success(`Database backed up to: ${result.path}`);
      } else {
        error(result.error || 'Failed to backup database');
      }
    } catch (err) {
      error('An error occurred while backing up database');
      console.error(err);
    }
  };

  const handleRestoreDatabase = async () => {
    if (
      !window.confirm(
        'This will replace your current database. Make sure you have a backup. Continue?'
      )
    ) {
      return;
    }

    try {
      const result = await window.api.restoreDatabase();
      if (result.success) {
        success('Database restored successfully');
        window.location.reload();
      } else {
        error(result.error || 'Failed to restore database');
      }
    } catch (err) {
      error('An error occurred while restoring database');
      console.error(err);
    }
  };

  const handleResetDatabase = async () => {
    if (
      !window.confirm(
        'This will delete ALL transactions and cannot be undone. Are you absolutely sure?'
      )
    ) {
      return;
    }

    try {
      const result = await window.api.resetDatabase();
      if (result.success) {
        success('Database reset successfully');
        window.location.reload();
      } else {
        error(result.error || 'Failed to reset database');
      }
    } catch (err) {
      error('An error occurred while resetting database');
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your business information and preferences</p>
      </div>

      {/* Business Settings */}
      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-6">Business Information</h3>
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <Input
            label="Business Name"
            name="business_name"
            value={formData.business_name}
            onChange={handleChange}
            error={errors.business_name}
            required
          />

          <Input
            label="Owner Name"
            name="owner_name"
            value={formData.owner_name}
            onChange={handleChange}
            error={errors.owner_name}
            required
          />

          <Select
            label="Currency"
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            options={CURRENCIES}
          />

          <Button
            type="submit"
            isLoading={isUpdating}
            disabled={loading}
          >
            Save Settings
          </Button>
        </form>
      </Card>

      {/* Database Management */}
      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-6">Database Management</h3>
        <p className="text-gray-600 mb-6">
          Backup, restore, or reset your database. Be careful with these operations.
        </p>

        <div className="space-y-4">
          <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
            <h4 className="font-semibold text-blue-900 mb-2">Backup Database</h4>
            <p className="text-blue-800 text-sm mb-4">
              Create a backup copy of your entire database. This file can be used to restore your data if needed.
            </p>
            <Button variant="outline" onClick={handleBackupDatabase}>
              Create Backup
            </Button>
          </div>

          <div className="border-l-4 border-amber-500 bg-amber-50 p-4 rounded">
            <h4 className="font-semibold text-amber-900 mb-2">Restore Database</h4>
            <p className="text-amber-800 text-sm mb-4">
              Restore your database from a previously created backup file.
            </p>
            <Button variant="outline" onClick={handleRestoreDatabase}>
              Restore From Backup
            </Button>
          </div>

          <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
            <h4 className="font-semibold text-red-900 mb-2">Reset Database</h4>
            <p className="text-red-800 text-sm mb-4">
              ⚠️ Delete all transactions and start fresh. This action cannot be undone!
            </p>
            <Button variant="danger" onClick={handleResetDatabase}>
              Reset All Data
            </Button>
          </div>
        </div>
      </Card>

      {/* About */}
      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-4">About</h3>
        <div className="space-y-2 text-gray-600">
          <p>
            <strong>MarketOS Ledger</strong> v1.0.0
          </p>
          <p>A professional offline desktop ledger for small businesses</p>
          <p className="text-sm mt-4">
            Built with React, Electron, and SQLite for maximum offline capability
          </p>
        </div>
      </Card>
    </div>
  );
}
