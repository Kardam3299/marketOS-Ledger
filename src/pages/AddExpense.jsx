import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Input from '../components/Input';
import Select from '../components/Select';
import TextArea from '../components/TextArea';
import Button from '../components/Button';
import { useToast } from '../context/ToastContext';
import { validateTransactionForm } from '../utils/validators';
import { EXPENSE_CATEGORIES, PAYMENT_MODES } from '../utils/constants';
import dayjs from 'dayjs';
import { api } from '../lib/repositories';

export default function AddExpense() {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    category: '',
    amount: '',
    payment_mode: '',
    description: '',
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validation = validateTransactionForm(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.addTransaction({
        ...formData,
        type: 'expense',
        amount: parseFloat(formData.amount),
      });

      if (result.success) {
        success('Expense recorded successfully');
        setFormData({
          date: dayjs().format('YYYY-MM-DD'),
          category: '',
          amount: '',
          payment_mode: '',
          description: '',
        });
        setErrors({});
        navigate('/');
      } else {
        error(result.error || 'Failed to add expense');
      }
    } catch (err) {
      error('An error occurred while adding expense');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Add Expense</h1>
        <p className="text-gray-600 mt-2">Record a new expense transaction</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Date"
            name="date"
            type="date"
            value={formData.date}
            onChange={handleChange}
            error={errors.date}
            required
          />

          <Select
            label="Category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            error={errors.category}
            options={EXPENSE_CATEGORIES}
            required
          />

          <Input
            label="Amount"
            name="amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.amount}
            onChange={handleChange}
            error={errors.amount}
            required
          />

          <Select
            label="Payment Mode"
            name="payment_mode"
            value={formData.payment_mode}
            onChange={handleChange}
            error={errors.payment_mode}
            options={PAYMENT_MODES}
            required
          />

          <div className="md:col-span-2">
            <TextArea
              label="Description"
              name="description"
              placeholder="Add any notes or details..."
              value={formData.description}
              onChange={handleChange}
              rows={4}
            />
          </div>

          <div className="md:col-span-2 flex flex-col sm:flex-row gap-4 pt-4">
            <Button
              type="submit"
              isLoading={isLoading}
              size="lg"
              className="w-full sm:w-auto"
            >
              Save Expense
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => navigate('/')}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
