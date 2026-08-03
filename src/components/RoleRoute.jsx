import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

export default function RoleRoute({ children, allowedRoles }) {
  const { profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <AiOutlineLoading3Quarters className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!profile || !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
