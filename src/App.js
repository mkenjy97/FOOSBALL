import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Rankings from './pages/Rankings';
import Players from './pages/Players';
import NewMatch from './pages/NewMatch';
import History from './pages/History';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Locations from './pages/Locations';
import RegisterLocation from './pages/RegisterLocation';
import Notifications from './pages/Notifications';
import PlayerDetails from './pages/PlayerDetails';
import ProtectedRoute from './components/ProtectedRoute';
import { Outlet } from 'react-router-dom';

function MainLayout() {
  return (
    <ProtectedRoute>
      <Layout>
        <Outlet />
      </Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <ThemeProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<MainLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/rankings" element={<Rankings />} />
                <Route path="/players" element={<Players />} />
                <Route path="/new-match" element={<NewMatch />} />
                <Route path="/history" element={<History />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/locations" element={<Locations />} />
                <Route path="/locations/register" element={<RegisterLocation />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/player/:id" element={<PlayerDetails />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Router>
        </ThemeProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

export default App;