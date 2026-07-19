import { ThemeProvider } from './contexts/ThemeContext';
import App from './App';

export default function AppWrapper() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}
