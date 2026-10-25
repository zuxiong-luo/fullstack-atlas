import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { installViewportGestures } from './lib/viewport';

const removeViewportGestures = installViewportGestures(document);
if (import.meta.hot) import.meta.hot.dispose(removeViewportGestures);

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
