import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { IoRocket } from 'react-icons/io5';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

export default function Setup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signUp, isInitialized, loading } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await signUp(email, password, name, businessName);
      if (error) throw error;
      addToast('success', 'System initialized successfully! Welcome.');
      navigate('/');
    } catch (err) {
      addToast('error', err.message || 'Failed to initialize system');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isInitialized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <AiOutlineLoading3Quarters className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (isInitialized === true) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600">
          <IoRocket className="h-12 w-12" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Initialize MarketOS Ledger
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Create the first Owner account to get started
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input
              label="Business Name"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Acme Corp"
            />

            <Input
              label="Owner Full Name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            
            <Input
              label="Owner Email Address"
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
              {isSubmitting ? 'Initializing...' : 'Initialize System'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
