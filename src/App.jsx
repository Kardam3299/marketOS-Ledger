import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import AddIncome from './pages/AddIncome';
import AddExpense from './pages/AddExpense';
import TransactionHistory from './pages/TransactionHistory';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ToastProvider from './context/ToastContext';

export default function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/income" element={<AddIncome />} />
            <Route path="/expense" element={<AddExpense />} />
            <Route path="/transactions" element={<TransactionHistory />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Router>
    </ToastProvider>
  );
}
