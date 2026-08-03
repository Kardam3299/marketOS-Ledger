import React from 'react';

export default function Select({
  label,
  error,
  options = [],
  required = false,
  className = '',
  ...props
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="font-medium text-gray-700">
          {label}
          {required && <span className="text-red-600">*</span>}
        </label>
      )}
      <select
        className={`
          px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
          transition-all duration-200 bg-white
          ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'}
          ${className}
        `}
        {...props}
      >
        <option value="">Select an option</option>
        {options.map((option, idx) => {
          const isObj = typeof option === 'object' && option !== null;
          const val = isObj ? option.value : option;
          const labelText = isObj ? (option.label || option.value) : option;
          return (
            <option key={val ?? idx} value={val}>
              {labelText}
            </option>
          );
        })}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
