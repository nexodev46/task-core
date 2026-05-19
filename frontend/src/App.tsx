import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeContextProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { SearchProvider } from './context/SearchContext';
import { ProjectProvider } from './context/ProjectContext';
import PrivateRoute from './components/PrivateRoute';
import DashboardLayout from './layouts/DashboardLayout';
import BoardPage from './pages/BoardPage';
import Profile from './pages/Profile';
import TasksPage from './pages/TasksPage';
import CalendarPage from './pages/CalendarPage';
import MessagesPage from './pages/MessagesPage';
import CommentsPage from './pages/CommentsPage';
import TeamPage from './pages/TeamPage';
import ReportsPage from './pages/ReportsPage';
import StatsPage from './pages/StatsPage';
import HelpPage from './pages/HelpPage';
import SettingsPage from './pages/SettingsPage';
import Login from './pages/Login';
import Register from './pages/Register';
import CssBaseline from '@mui/material/CssBaseline';
import AcceptInvite from './pages/AcceptInvite';


function App() {
  return (
    <ThemeContextProvider>
      <LanguageProvider>
        <CssBaseline />
        <AuthProvider>
          <ProjectProvider>
            <SearchProvider>
              <BrowserRouter>
                <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
                <Route index element={<BoardPage />} />
                <Route path="profile" element={<Profile />} />
                <Route path="tareas" element={<TasksPage />} />
                <Route path="calendario" element={<CalendarPage />} />
                <Route path="mensajes" element={<MessagesPage />} />
                <Route path="comentarios" element={<CommentsPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="reportes" element={<ReportsPage />} />
                <Route path="estadisticas" element={<StatsPage />} />
                <Route path="ayuda" element={<HelpPage />} />
                <Route path="configuracion" element={<SettingsPage />} />
                <Route path="/accept-invite/:token" element={<AcceptInvite />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SearchProvider>
      </ProjectProvider>
    </AuthProvider>
      </LanguageProvider>
    </ThemeContextProvider>
  );
}

export default App;