import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Charts from '../components/charts.jsx';
import '../index.css';

export const Service = () => {
  const [openSidebarToggle, setOpenSidebarToggle] = useState(false);
  const [data, setData] = useState([]);
  const [ageGenderData, setAgeGenderData] = useState([]);
  const [emotionData, setEmotionData] = useState([]);
  const [emotionOverTimeData, setEmotionOverTimeData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  const toggleSidebar = () => {
    setOpenSidebarToggle(!openSidebarToggle);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`https://client-kzytrjlsv-nishas-projects-db23472b.vercel.app/api/data?date=${selectedDate}`);
        setData(response.data);

        const ageGenderCounts = response.data.reduce((acc, curr) => {
          const ageGroup = curr.Age;
          const gender = curr.Gender;
          if (!acc[ageGroup]) {
            acc[ageGroup] = { Age: ageGroup, male: 0, female: 0 };
          }
          acc[ageGroup][gender.toLowerCase()] += 1;
          return acc;
        }, {});
        const formattedAgeGenderData = Object.values(ageGenderCounts);
        setAgeGenderData(formattedAgeGenderData);

        const emotionCounts = response.data.reduce((acc, curr) => {
          const emotion = curr.Emotion;
          if (!acc[emotion]) {
            acc[emotion] = { name: emotion, count: 0 };
          }
          acc[emotion].count += 1;
          return acc;
        }, {});
        const formattedEmotionData = Object.values(emotionCounts);
        setEmotionData(formattedEmotionData);

        const emotionOverTimeCounts = response.data.reduce((acc, curr) => {
          const time = curr.Time.slice(0, 2); // Group by hour
          const emotion = curr.Emotion.toLowerCase();
          if (!acc[time]) {
            acc[time] = { time, happy: 0, sad: 0, neutral: 0, fear: 0, disgust: 0, anxiety: 0, surprise: 0 };
          }
          acc[time][emotion] += 1;
          return acc;
        }, {});
        const formattedEmotionOverTimeData = Object.values(emotionOverTimeCounts).sort((a, b) => a.time - b.time);
        setEmotionOverTimeData(formattedEmotionOverTimeData);

      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (selectedDate) {
      fetchData();
    }

  }, [selectedDate]);

  return (
    <div className='grid-container'>
      <Header toggleSidebar={toggleSidebar} />
      <Sidebar openSidebarToggle={openSidebarToggle} toggleSidebar={toggleSidebar} />
      <Charts
        data={data}
        ageGenderData={ageGenderData}
        emotionData={emotionData}
        emotionOverTimeData={emotionOverTimeData}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
      />
    </div>
  );
};

export default Service;
