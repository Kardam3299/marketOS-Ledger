import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { IoBusinessOutline } from 'react-icons/io5';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { supabase } from '../lib/supabaseClient';

export default function RegisterBusiness() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const navigate = useNavigate();

  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  const [businessName, setBusinessName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { registerBusinessWithInvite } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    if (!inviteToken) {
      navigate('/login', { replace: true });
      return;
    }

    const checkToken = async () => {
      setIsValidating(true);
      try {
        if (!supabase) {
          setIsTokenValid(false);
          return;
        }
        const { data, error } = await supabase.rpc('verify_business_invitation', {
          invite_token: inviteToken,
        });

        if (error || !data || data.length === 0) {
          setIsTokenValid(false);
        } else {
          setIsTokenValid(true);
          if (data[0] && data[0].email) {
            setEmail(data[0].email);
          }
        }
      } catch (err) {
        setIsTokenValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    checkToken();
  }, [inviteToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (!inviteToken) {
        throw new Error('Missing invitation token');
      }
      const { error } = await registerBusinessWithInvite(
        email,
        password,
        name,
        businessName,
        inviteToken
      );
      if (error) throw error;
      addToast('success', `Business "${businessName}" created successfully! Welcome.`);
      navigate('/');
    } catch (err) {
      addToast('error', err.message || 'Failed to register business');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
        <AiOutlineLoading3Quarters className="animate-spin h-8 w-8 text-blue-600 mb-4" />
        <p className="text-gray-600 font-medium">Validating business invitation link...</p>
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card className="p-8 text-center shadow-lg border border-red-100">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600 mb-4">
              <IoBusinessOutline className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Invitation Link Invalid or Expired
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              This business registration link has already been used, cancelled, or has expired. Each invitation link can only be used once.
            </p>
            <div className="space-y-3">
              <Link to="/login">
                <Button className="w-full">Go to Sign In</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600 mb-2">
          <IoBusinessOutline className="h-12 w-12" />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Register Your Business
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Complete registration to set up your isolated business ledger
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <Input
              label="Business / Organization Name"
              type="text"
              required
              placeholder="e.g. Apex Traders Ltd."
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />

            <Input
              label="Owner Full Name"
              type="text"
              required
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input
              label="Owner Email Address"
              type="email"
              required
              placeholder="owner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              label="Password"
              type="password"
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="pt-2">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Creating Business...' : 'Create Business & Get Started'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
