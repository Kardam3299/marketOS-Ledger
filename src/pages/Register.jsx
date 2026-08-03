import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { IoWallet } from 'react-icons/io5';
import { supabase } from '../lib/supabaseClient';

export default function Register() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const navigate = useNavigate();

  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    if (!inviteToken) {
      navigate('/login', { replace: true });
      return;
    }

    const checkToken = async () => {
      setIsValidating(true);
      try {
        const { data, error } = await supabase.rpc('verify_invitation', { invite_token: inviteToken });
        if (error || !data || data.length === 0) {
          setIsTokenValid(false);
        } else {
          setIsTokenValid(true);
        }
      } catch (err) {
        setIsTokenValid(false);
      } finally {
        setIsValidating(false);
      }
    };
    
    checkToken();
  }, [inviteToken, navigate]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signUpWithInvite } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (inviteToken) {
        const { error } = await signUpWithInvite(email, password, name, inviteToken);
        if (error) throw error;
        addToast('success', 'Account created successfully! You have joined the team.');
        navigate('/');
      }
    } catch (err) {
      addToast('error', err.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <p className="text-gray-500">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <h2 className="text-3xl font-extrabold text-red-600">Invalid Invitation</h2>
          <p className="mt-2 text-gray-600">This invitation link is invalid, expired, or has already been used.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600">
          <IoWallet className="h-12 w-12" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Join your Team
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input
              label="Full Name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            
            <Input
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              label="Password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
