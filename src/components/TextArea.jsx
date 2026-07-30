import React from 'react';

export default function TextArea({
  label,
  error,
  required = false,
  rows = 4,
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
      <textarea
        rows={rows}
        className={`
          px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
          transition-all duration-200 resize-none
          ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
