
import React from 'react';

const DatePicker = ({ selectedDate, setSelectedDate }) => {
  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  return (
    <div className='date-picker-container'>
      <input
        type='date'
        className='date-picker'
        value={selectedDate}
        onChange={handleDateChange}
      />
    </div>
  );
};

export default DatePicker;
