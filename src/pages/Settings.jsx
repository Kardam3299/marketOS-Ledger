import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import Input from '../components/Input';
import Select from '../components/Select';
import Button from '../components/Button';
import { useSettings } from '../hooks/useData';
import { useSync } from '../hooks/useSync';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { CURRENCIES } from '../utils/constants';
import { validateBusinessName, validateOwnerName } from '../utils/validators';
import { api } from '../lib/repositories';

export default function Settings() {
  const { profile } = useAuth();
  const { settings, loading, updateSettings } = useSettings();
  const { syncStatus, triggerSync, testConnection, updateSyncSettings, loading: syncLoading } = useSync();
  const { success, error } = useToast();

  const [isUpdating, setIsUpdating] = useState(false);
  const [isSavingSync, setIsSavingSync] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Business Onboarding Invites State
  const [businessInvites, setBusinessInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    business_name: '',
    owner_name: '',
    currency: 'USD',
  });

  const [syncFormData, setSyncFormData] = useState({
    cloud_sync_enabled: false,
    supabase_url: '',
    supabase_anon_key: '',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        business_name: settings.business_name || '',
        owner_name: settings.owner_name || '',
        currency: settings.currency || 'USD',
      });
      setSyncFormData({
        cloud_sync_enabled: settings.cloud_sync_enabled !== false,
        supabase_url: settings.supabase_url || import.meta.env.VITE_SUPABASE_URL || '',
        supabase_anon_key: settings.supabase_anon_key || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
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

  const handleSaveSyncSettings = async (e) => {
    e.preventDefault();
    setIsSavingSync(true);
    setTestResult(null);

    const res = await updateSyncSettings(syncFormData);
    setIsSavingSync(false);

    if (res && res.success) {
      success('Cloud Sync settings saved');
    } else {
      error(res?.error || 'Failed to save Cloud Sync settings');
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const res = await testConnection({
      url: syncFormData.supabase_url,
      key: syncFormData.supabase_anon_key,
    });

    setIsTesting(false);
    setTestResult(res);

    if (res.success) {
      success(res.message || 'Connection successful!');
    } else {
      error(res.error || 'Connection test failed');
    }
  };

  const handleClearPendingQueue = async () => {
    try {
      const res = await api.clearPendingQueue();
      if (res && res.success) {
        success('Pending queue cleared successfully!');
        if (fetchStatus) fetchStatus();
      } else {
        error(res?.error || 'Failed to clear pending queue');
      }
    } catch (err) {
      error('Error clearing pending queue: ' + (err.message || err));
    }
  };

  const handleBackupDatabase = async () => {
    try {
      const result = await api.backupDatabase();
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
      const result = await api.restoreDatabase();
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
      const result = await api.resetDatabase();
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

  const fetchBusinessInvites = async () => {
    if (!supabase) return;
    try {
      const { data, error: fetchErr } = await supabase
        .from('business_invitations')
        .select('*')
        .order('created_at', { ascending: false });
      if (!fetchErr && data) {
        setBusinessInvites(data);
      }
    } catch (err) {
      console.error('Failed to fetch business invites:', err);
    }
  };

  useEffect(() => {
    if (profile?.is_super_admin) {
      fetchBusinessInvites();
    }
  }, [profile]);

  const handleGenerateBusinessInvite = async (e) => {
    e.preventDefault();
    if (!supabase || !profile?.is_super_admin) return;
    setIsGeneratingInvite(true);
    try {
      const emailVal = inviteEmail ? inviteEmail.trim() : null;
      // Try dedicated RPC first
      const { error: rpcErr } = await supabase.rpc('create_business_invitation', {
        p_email: emailVal
      });

      if (rpcErr) {
        // Fallback to direct table insert
        const { error: invErr } = await supabase
          .from('business_invitations')
          .insert([{ email: emailVal, status: 'pending' }]);

        if (invErr) throw invErr;
      }

      success('Business registration link generated successfully!');
      setInviteEmail('');
      fetchBusinessInvites();
    } catch (err) {
      error(err.message || 'Failed to generate business invitation link');
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleCancelBusinessInvite = async (id) => {
    if (!supabase || !profile?.is_super_admin) return;
    try {
      const { error: delErr } = await supabase
        .from('business_invitations')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
      success('Invitation link cancelled.');
      fetchBusinessInvites();
    } catch (err) {
      error('Failed to cancel invitation');
    }
  };

  const copyBusinessInviteLink = (token) => {
    const baseUrl = import.meta.env.VITE_APP_URL
      ? import.meta.env.VITE_APP_URL.replace(/\/$/, '')
      : (window.location.protocol !== 'file:' && window.location.origin !== 'null' ? window.location.origin : '');
    const invitePath = `/#/register-business?invite=${token}`;
    const url = baseUrl ? `${baseUrl}${invitePath}` : invitePath;

    navigator.clipboard.writeText(url);
    success('Business registration link copied to clipboard!');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your business information and cloud synchronization</p>
      </div>

      {/* Business Onboarding Links (Super Admin Only) */}
      {profile?.is_super_admin && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-gray-900">New Business Registration Links</h3>
                <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
                  Super Admin
                </span>
              </div>
              <p className="text-gray-600 text-sm mt-1">
                Generate secure, single-use invite links for new business owners to register their isolated ledgers.
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerateBusinessInvite} className="flex flex-col sm:flex-row gap-4 items-end mb-6 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
            <div className="flex-1 w-full">
              <Input
                label="Recipient Email Address (Optional)"
                type="email"
                placeholder="new-owner@business.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              isLoading={isGeneratingInvite}
              className="w-full sm:w-auto"
            >
              Generate Business Invite Link
            </Button>
          </form>

          {businessInvites.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Recipient Email</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {businessInvites.map((inv) => {
                    const isExpired = new Date(inv.expires_at) < new Date();
                    const displayStatus = inv.status === 'used' ? 'used' : (isExpired ? 'expired' : inv.status);

                    return (
                      <tr key={inv.id}>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {inv.email || <span className="text-gray-400 italic">Any email</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                              displayStatus === 'pending'
                                ? 'bg-green-100 text-green-800'
                                : displayStatus === 'used'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {displayStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {displayStatus === 'pending' && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => copyBusinessInviteLink(inv.token)}
                              className="text-xs py-1 px-2.5"
                            >
                              Copy Link
                            </Button>
                          )}
                          {displayStatus === 'pending' && (
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() => handleCancelBusinessInvite(inv.id)}
                              className="text-xs py-1 px-2.5"
                            >
                              Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              No business onboarding links generated yet.
            </p>
          )}
        </Card>
      )}

      {/* Business Settings */}
      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-6">Business Information</h3>
        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          <div className="md:col-span-2 pt-4">
            <Button
              type="submit"
              isLoading={isUpdating}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Save Business Settings
            </Button>
          </div>
        </form>
      </Card>

      {/* Cloud Sync Settings */}
      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Cloud Sync Settings</h3>
        <p className="text-gray-600 mb-6">
          Synchronize your offline ledger data with Supabase Cloud automatically when online.
        </p>

        <form onSubmit={handleSaveSyncSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 flex items-center gap-3">
            <input
              type="checkbox"
              id="cloud_sync_enabled"
              name="cloud_sync_enabled"
              checked={syncFormData.cloud_sync_enabled}
              onChange={(e) =>
                setSyncFormData((prev) => ({
                  ...prev,
                  cloud_sync_enabled: e.target.checked,
                }))
              }
              className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
            />
            <label
              htmlFor="cloud_sync_enabled"
              className="font-medium text-gray-900 cursor-pointer select-none"
            >
              Enable Cloud Sync
            </label>
          </div>

          <Input
            label="Supabase URL"
            name="supabase_url"
            value={syncFormData.supabase_url}
            onChange={(e) =>
              setSyncFormData((prev) => ({ ...prev, supabase_url: e.target.value }))
            }
            placeholder="https://xyzcompany.supabase.co"
          />

          <Input
            label="Supabase Anon Key"
            name="supabase_anon_key"
            type="password"
            value={syncFormData.supabase_anon_key}
            onChange={(e) =>
              setSyncFormData((prev) => ({ ...prev, supabase_anon_key: e.target.value }))
            }
            placeholder="eyJhbGciOi..."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
            <div>
              <span className="text-gray-500 font-medium">Status:</span>{' '}
              <span className="font-semibold text-gray-800 capitalize">
                {syncStatus.status || 'Offline'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 font-medium">Last Sync Time:</span>{' '}
              <span className="font-semibold text-gray-800">
                {syncStatus.lastSyncTime
                  ? new Date(syncStatus.lastSyncTime).toLocaleString()
                  : 'Never'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 font-medium">Pending Queue:</span>{' '}
              <span className="font-semibold text-gray-800">
                {syncStatus.pendingCount || 0} item(s)
              </span>
            </div>
          </div>

          {testResult && (
            <div
              className={`md:col-span-2 p-4 rounded text-sm ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {testResult.message || testResult.error}
            </div>
          )}

          <div className="md:col-span-2 flex flex-col sm:flex-row flex-wrap gap-4 pt-2">
            <Button type="submit" isLoading={isSavingSync} className="w-full sm:w-auto">
              Save Sync Settings
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              isLoading={isTesting}
              className="w-full sm:w-auto"
            >
              Test Connection
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={triggerSync}
              isLoading={syncLoading}
              disabled={!syncFormData.cloud_sync_enabled}
              className="w-full sm:w-auto"
            >
              Sync Now
            </Button>

            {syncStatus.pendingCount > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearPendingQueue}
                className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50"
              >
                Clear Pending Queue
              </Button>
            )}
          </div>
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
            <Button variant="outline" onClick={handleBackupDatabase} className="w-full sm:w-auto mt-2">
              Create Backup
            </Button>
          </div>

          <div className="border-l-4 border-amber-500 bg-amber-50 p-4 rounded">
            <h4 className="font-semibold text-amber-900 mb-2">Restore Database</h4>
            <p className="text-amber-800 text-sm mb-4">
              Restore your database from a previously created backup file.
            </p>
            <Button variant="outline" onClick={handleRestoreDatabase} className="w-full sm:w-auto mt-2">
              Restore From Backup
            </Button>
          </div>

          <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
            <h4 className="font-semibold text-red-900 mb-2">Reset Database</h4>
            <p className="text-red-800 text-sm mb-4">
              ⚠️ Delete all transactions and start fresh. This action cannot be undone!
            </p>
            <Button variant="danger" onClick={handleResetDatabase} className="w-full sm:w-auto mt-2">
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
            Built with React, Electron, and electron-store with Supabase Cloud Sync
          </p>
        </div>
      </Card>
    </div>
  );
}
