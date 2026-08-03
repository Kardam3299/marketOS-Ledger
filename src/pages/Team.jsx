import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';

export default function Team() {
  const { profile } = useAuth();
  const { addToast } = useToast();
  
  const [team, setTeam] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchTeam();
  }, [profile]);

  const fetchTeam = async () => {
    if (!profile) return;
    try {
      const [membersRes, invitesRes] = await Promise.all([
        supabase.from('business_members').select('*, profiles(*)').eq('business_id', profile.business_id),
        supabase.from('invitations').select('*').eq('business_id', profile.business_id)
      ]);
      
      if (membersRes.error) throw membersRes.error;
      if (invitesRes.error) throw invitesRes.error;
      
      setTeam(membersRes.data || []);
      setInvitations(invitesRes.data || []);
    } catch (err) {
      addToast('error', 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      const { data, error } = await supabase.from('invitations').insert([{
        business_id: profile.business_id,
        email,
        role
      }]).select().single();
      
      if (error) throw error;
      
      setInvitations([...invitations, data]);
      setEmail('');
      addToast('success', 'Invitation created successfully.');
    } catch (err) {
      addToast('error', err.message || 'Failed to create invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (id) => {
    try {
      const { error } = await supabase.from('invitations').delete().eq('id', id);
      if (error) throw error;
      setInvitations(invitations.filter(inv => inv.id !== id));
      addToast('success', 'Invitation cancelled.');
    } catch (err) {
      addToast('error', 'Failed to cancel invitation');
    }
  };

  const getBaseWebUrl = () => {
    if (import.meta.env.VITE_APP_URL) {
      return import.meta.env.VITE_APP_URL.replace(/\/$/, '');
    }
    if (window.location.protocol !== 'file:' && window.location.origin !== 'null') {
      return window.location.origin;
    }
    return '';
  };

  const copyInviteLink = (token) => {
    const baseUrl = getBaseWebUrl();
    const invitePath = `/#/register?invite=${token}`;
    const url = baseUrl ? `${baseUrl}${invitePath}` : invitePath;

    navigator.clipboard.writeText(url);
    if (window.location.protocol === 'file:' && !import.meta.env.VITE_APP_URL) {
      addToast('info', `Copied invite path: ${invitePath} (Share with your Web App domain)`);
    } else {
      addToast('success', 'Invite link copied to clipboard!');
    }
  };

  if (loading) return <div className="p-4">Loading team...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800">Team Management</h1>
      
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Invite New Member</h2>
        <form onSubmit={handleInvite} className="flex gap-4 items-end">
          <div className="flex-1">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="w-48">
            <Select
              label="Role"
              value={role}
              onChange={e => setRole(e.target.value)}
              options={[
                { value: 'staff', label: 'Staff' },
                { value: 'manager', label: 'Manager' },
                { value: 'owner', label: 'Owner' }
              ]}
            />
          </div>
          <Button type="submit" disabled={inviting}>
            {inviting ? 'Inviting...' : 'Send Invite'}
          </Button>
        </form>
      </Card>

      {invitations.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">Pending Invitations</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {invitations.map(inv => (
              <div key={inv.id} className="p-6 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{inv.email}</p>
                  <p className="text-sm text-gray-500 capitalize">Role: {inv.role}</p>
                  <p className="text-xs text-gray-400 mt-1">Status: {inv.status}</p>
                </div>
                <div className="flex gap-3">
                  {inv.status === 'pending' && (
                    <Button variant="outline" onClick={() => copyInviteLink(inv.token)}>
                      Copy Link
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => handleCancelInvite(inv.id)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Active Team Members</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {team.map(member => (
            <div key={member.id} className="p-6 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{member.profiles?.full_name || 'No Name'}</p>
                <p className="text-sm text-gray-500">{member.profiles?.email}</p>
              </div>
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                  ${member.role === 'owner' ? 'bg-purple-100 text-purple-800' : 
                    member.role === 'manager' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                  {member.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
