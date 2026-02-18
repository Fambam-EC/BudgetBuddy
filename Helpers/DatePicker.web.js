import React, { createElement } from 'react';

export default function MyDatePicker({ value, onChange, ...props }) {
  // Renders a standard HTML date input for the web
  return createElement('input', {
    type: 'date',
    value: value ? value.toISOString().split('T')[0] : '', // Format date to YYYY-MM-DD
    onInput: (e) => {
        console.log(e)
        onChange(e.target.value ? new Date(e.target.value) : undefined)
    },
    ...props
  });
}