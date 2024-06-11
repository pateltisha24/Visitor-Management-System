// import React from 'react';
// import ReactDOM from 'react-dom';
// import App from '../App.jsx';

// ReactDOM.render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>,
//   document.getElementById('root')
// );
// import React from 'react';
// import ReactDOM from 'react-dom';
// import Service from '../pages/Service';

// ReactDOM.render(
//   <React.StrictMode>
//     <Service />
//   </React.StrictMode>,
//   document.getElementById('root')
// );

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '../App.jsx'; // Update the path if necessary
import { AuthProvider } from '../store/auth.jsx'; // Ensure this path is correct

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    
      <AuthProvider>
      
        <App />
        
      </AuthProvider>

  </React.StrictMode>
);


