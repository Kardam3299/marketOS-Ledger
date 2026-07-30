export const validateAmount = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    return { valid: false, error: 'Amount must be a positive number' };
  }
  return { valid: true };
};

export const validateDate = (date) => {
  if (!date) {
    return { valid: false, error: 'Date is required' };
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return { valid: false, error: 'Invalid date' };
  }
  return { valid: true };
};

export const validateCategory = (category) => {
  if (!category || category.trim() === '') {
    return { valid: false, error: 'Category is required' };
  }
  return { valid: true };
};

export const validatePaymentMode = (mode) => {
  if (!mode || mode.trim() === '') {
    return { valid: false, error: 'Payment mode is required' };
  }
  return { valid: true };
};

export const validateTransactionForm = (formData) => {
  const errors = {};

  const dateValidation = validateDate(formData.date);
  if (!dateValidation.valid) errors.date = dateValidation.error;

  const amountValidation = validateAmount(formData.amount);
  if (!amountValidation.valid) errors.amount = amountValidation.error;

  const categoryValidation = validateCategory(formData.category);
  if (!categoryValidation.valid) errors.category = categoryValidation.error;

  const paymentValidation = validatePaymentMode(formData.payment_mode);
  if (!paymentValidation.valid) errors.payment_mode = paymentValidation.error;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateBusinessName = (name) => {
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Business name is required' };
  }
  return { valid: true };
};

export const validateOwnerName = (name) => {
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Owner name is required' };
  }
  return { valid: true };
};
