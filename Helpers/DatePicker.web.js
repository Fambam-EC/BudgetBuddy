import React, { createElement } from 'react';

export default function MyDatePicker({ value, onChange }) {
  // Renders a standard HTML date input for the web
  return createElement('input', {
    type: 'date',
    value: typeof(value) === 'object' && value !== null ? value.toISOString().split('T')[0] : new Date(), // Format date to YYYY-MM-DD
    onInput: (e) => {
        console.log(e)
        onChange(e.target.value ? new Date(e.target.value) : new Date())
    },
  });
}