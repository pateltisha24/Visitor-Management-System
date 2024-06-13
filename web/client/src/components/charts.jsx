import React from 'react';
import { BsFillArchiveFill, BsFillGrid3X3GapFill, BsPeopleFill, BsFillBellFill } from 'react-icons/bs';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import HeatMap from 'react-heatmap-grid';
import DatePicker from './DatePicker';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AA00FF', '#FF4081'];

const Charts = ({ data, ageGenderData, emotionData, emotionOverTimeData, selectedDate, setSelectedDate }) => {
  const individualCount = data.filter(item => item?.Gi === "individual").length;
  const groupCount = data.filter(item => item?.Gi === "group").length;
  const totalEntries = data.length;

  // Aggregate total counts of males and females for each age group
  const ageGroupCounts = ageGenderData ? ageGenderData.reduce((acc, item) => {
    // Ensure Male and Female counts are numbers
    const maleCount = Number(item.male);
    const femaleCount = Number(item.female);

    if (!isNaN(maleCount) && !isNaN(femaleCount)) {
      if (!acc[item.Age]) {
        acc[item.Age] = 0;
      }
      acc[item.Age] += maleCount + femaleCount;
    } else {
      console.warn(`Invalid count for age group ${item.Age}: Male=${item.male}, Female=${item.female}`);
    }
    return acc;
  }, {}) : {};

  console.log("Age Group Counts:", ageGroupCounts);

  // Find the age group with the maximum count
  const modeAgeGroup = ageGenderData ? Object.keys(ageGroupCounts).reduce((acc, age) =>
    ageGroupCounts[age] > ageGroupCounts[acc] ? age : acc, Object.keys(ageGroupCounts)[0]) : null;

  console.log("Mode Age Group:", modeAgeGroup);


  const maleCount = data.filter(item => item?.Gender === "Male").length;
  const femaleCount = data.filter(item => item?.Gender === "Female").length;
  const malePercentage = ((maleCount / totalEntries) * 100).toFixed(1);
  const femalePercentage = ((femaleCount / totalEntries) * 100).toFixed(1);

  // Prepare heatmap data
  const emotions = ['happy', 'sad', 'neutral', 'fear', 'disgust', 'anxiety', 'surprise'];
  const ageGroups = Array.from(new Set(data.map(item => item.Age))); // Get unique age groups

  const heatmapData = ageGroups.map(age => {
    const emotionCounts = data
      .filter(item => item.Age === age)
      .reduce((acc, curr) => {
        const emotion = curr.Emotion.toLowerCase();
        acc[emotion] = (acc[emotion] || 0) + 1;
        return acc;
      }, {});

    // Ensure all emotions are represented in the heatmap data
    emotions.forEach(emotion => {
      if (!emotionCounts[emotion]) {
        emotionCounts[emotion] = 0;
      }
    });

    return { Age: age, ...emotionCounts };
  });

  return (
    <main className='main-container'>
      <DatePicker selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
      <div className='main-cards'>
        <div className='card'>
          <div className='card-inner'>
            <h3>INDIVIDUALS:GROUPS</h3>
            <BsFillArchiveFill className='card_icon' />
          </div>
          <h1>{individualCount}:{groupCount}</h1>
        </div>
        <div className='card'>
          <div className='card-inner'>
            <h3>TOTAL CUSTOMERS</h3>
            <BsPeopleFill className='card_icon' />
          </div>
          <h1>{totalEntries}</h1>
        </div>
        <div className='card'>
          <div className='card-inner'>
            <h3>GENDER RATIO</h3>
            <BsFillGrid3X3GapFill className='card_icon' />
          </div>
          <h2>Male: {malePercentage}% <br />
            Female: {femalePercentage}%</h2>
        </div>
        <div className='card'>
          <div className='card-inner'>
            <h3>AVERAGE AGE GROUP</h3>
            <BsFillBellFill className='card_icon' />
          </div>
          <h2>{modeAgeGroup}</h2>
        </div>
      </div>

      <div className='chart1'>
        <h3>GENDER DISTRIBUTION BAR CHART</h3>
        <p>Shows the count of male and female participants in a bar chart format recorded for {selectedDate}.</p><br /><br />
        <ResponsiveContainer width="100%" height={500}>
          <BarChart
            data={ageGenderData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="Age" tick={{ fontSize: 20 }} />
            <YAxis tick={{ fontSize: 20 }} label={{ value: 'Count', angle: -90, position: 'insideLeft', dy: -10, fontSize: 16 }} />
            <Tooltip />
            <Legend wrapperStyle={{ margin: '0 auto', textAlign: 'center' }} />
            <Bar dataKey="male" fill="#8884d8" />
            <Bar dataKey="female" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>


      <br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
      <div className='charts'>
        <ResponsiveContainer width="100%" height={400}>
          <h3>OVERALL EMOTION</h3>
          <p>Displays the distribution of different emotions (e.g., happy, sad, neutral)</p>
          <PieChart>
            <Pie
              data={emotionData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="count"
            >
              {emotionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <ResponsiveContainer width="100%" height={400}>
          <h3>GROUP/INDIVIDUAL COUNTS</h3>
          <p>The chart displays the distribution of participants between groups and individuals.</p>
          <PieChart>
            <Pie
              data={[
                { name: 'Individuals', value: individualCount },
                { name: 'Groups', value: groupCount },
              ]}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
            >
              {[
                { name: 'Individuals', value: individualCount, color: COLORS[0] },
                { name: 'Groups', value: groupCount, color: COLORS[1] },
              ].map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <br /><br />
      <div className='chart3'>
        <h3>AGE AND EMOTION </h3>
        <p>A heatmap showing the relationship between age and emotion using different colors.</p><br /><br />
        <ResponsiveContainer width="98%" height={300}>
          <div className="heatmap-container">
            <HeatMap
              xLabels={emotions}
              yLabels={ageGroups}
              data={heatmapData.map(item => emotions.map(emotion => item[emotion]))}
              xLabelWidth={60}
              yLabelWidth={120}
              square
              cellStyle={(background, value, min, max) => ({
                background: `rgb(0, 151, 230, ${1 - (max - value) / (max - min)})`,
                fontSize: '20px',
                color: '#d1d1dc',
                lineHeight: '50px',
                textAlign: 'center',
                width: '50px',
                height: '50px',
                border: '1px dashed #9e9ea4',
              })}
              cellRender={value => value}
              
            />
          </div>
        </ResponsiveContainer>
      </div>
      

      <br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br />

      <div className='line-chart'>
        <h3>EMOTIONS OVER TIME</h3>
        <p>Shows the emotions recorded over different hours of the selected day.</p><br /><br />
        <ResponsiveContainer width="100%" height={600}>
          <LineChart data={emotionOverTimeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time"  label={{ value: 'Time (Hours)', position: 'insideBottomRight', offset: -5, style: { fontSize: '20px' } }} tick={{ fontSize: '18px' }} />
            <YAxis label={{ value: 'Emotion Count', angle: -90, position: 'insideLeft', style: { fontSize: '20px' } }} tick={{ fontSize: '18px' }} />
            <Tooltip />
            <Legend />
            {emotions.map(emotion => (
              <Line type="monotone" dataKey={emotion} key={emotion} stroke={COLORS[emotions.indexOf(emotion) % COLORS.length]} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>


    </main>
  );
};

export default Charts;
