import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles/tokens.css';
import './styles/global.css';
import './components/ui/ui.css';
import App from './App';
import { AuthHashHandler } from './components/Account/AuthHashHandler';
import { AuthProvider } from './store/AuthProvider';

const container = document.getElementById('root');
if (container === null) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <AuthHashHandler />
      <App />
    </AuthProvider>
  </StrictMode>,
);
