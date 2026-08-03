import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import AddIncome from './pages/AddIncome';
import AddExpense from './pages/AddExpense';
import TransactionHistory from './pages/TransactionHistory';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Team from './pages/Team';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Setup from './pages/Setup';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import AuthProvider, { useAuth } from './context/AuthContext';
import ToastProvider from './context/ToastContext';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red' }}>
          <h1>Application Error</h1>
          <pre>{this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppRoutes() {
  const { isInitialized, loading } = useAuth();
  const location = useLocation();

  if (loading || isInitialized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <AiOutlineLoading3Quarters className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!isInitialized && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  if (isInitialized && location.pathname === '/setup') {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/setup" element={<Setup />} />
      
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/income" element={<AddIncome />} />
        <Route path="/expense" element={<AddExpense />} />
        <Route path="/transactions" element={<TransactionHistory />} />
        <Route path="/reports" element={
          <RoleRoute allowedRoles={['owner', 'manager']}>
            <Reports />
          </RoleRoute>
        } />
        <Route path="/team" element={
          <RoleRoute allowedRoles={['owner']}>
            <Team />
          </RoleRoute>
        } />
        <Route path="/settings" element={
          <RoleRoute allowedRoles={['owner']}>
            <Settings />
          </RoleRoute>
        } />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
