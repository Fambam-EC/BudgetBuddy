import DateTimePicker from '@react-native-community/datetimepicker';
import React from 'react';

export default function DatePicker(props) {
  return (
    <DateTimePicker
      value={props.value || new Date()}
      mode="date" // can be 'date', 'time', or 'datetime'
      display="default"
      onChange={(event, selectedDate) => {
        if (props.onChange && selectedDate) {
          props.onChange(selectedDate);
        }
      }}
    />
  );
}