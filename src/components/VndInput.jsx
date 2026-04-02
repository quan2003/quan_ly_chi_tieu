import React from 'react';

/**
 * Input tự động thêm dấu chấm phân tách hàng nghìn (VND)
 * value: số nguyên thực (string hoặc number)
 * onChange: callback nhận lại số nguyên thực (string không có dấu chấm)
 */
export default function VndInput({ value, onChange, placeholder = 'Ví dụ: 3.000.000', className = '', required = false }) {
  const display = value ? Number(value).toLocaleString('vi-VN') : '';

  const handleChange = (e) => {
    // Lấy giá trị thô, bỏ tất cả ký tự không phải số
    const raw = e.target.value.replace(/\D/g, '');
    onChange(raw);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      required={required}
      placeholder={placeholder}
      className={className}
      value={display}
      onChange={handleChange}
    />
  );
}
