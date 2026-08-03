import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { IoWallet } from 'react-icons/io5';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { resetPassword } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await resetPassword(email);
      if (error) throw error;
      addToast('success', 'Password reset instructions sent to your email.');
      setEmail('');
    } catch (err) {
      addToast('error', err.message || 'Failed to send reset instructions');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600">
          <IoWallet className="h-12 w-12" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Remember your password?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending instructions...' : 'Send instructions'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
