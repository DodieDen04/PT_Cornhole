import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { InstallProvider } from './contexts/InstallContext.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import RegisterScreen from './screens/RegisterScreen.jsx';
import HomeScreen from './screens/HomeScreen.jsx';
import GameSetupScreen from './screens/GameSetupScreen.jsx';
import PracticeSetupScreen from './screens/PracticeSetupScreen.jsx';
import ScoringScreen from './screens/ScoringScreen.jsx';
import PracticeScreen from './screens/PracticeScreen.jsx';
import GameOverScreen from './screens/GameOverScreen.jsx';
import HistoryScreen from './screens/HistoryScreen.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import PlayerStatsScreen from './screens/PlayerStatsScreen.jsx';
import LeaderboardScreen from './screens/LeaderboardScreen.jsx';
import GameDetailScreen from './screens/GameDetailScreen.jsx';
import PracticeDetailScreen from './screens/PracticeDetailScreen.jsx';
import SpectatorScreen from './screens/SpectatorScreen.jsx';
import TournamentListScreen from './screens/TournamentListScreen.jsx';
import TournamentSetupScreen from './screens/TournamentSetupScreen.jsx';
import TournamentDetailScreen from './screens/TournamentDetailScreen.jsx';
import InvitationsScreen from './screens/InvitationsScreen.jsx';
import GroupsListScreen from './screens/GroupsListScreen.jsx';
import GroupCreateScreen from './screens/GroupCreateScreen.jsx';
import GroupDetailScreen from './screens/GroupDetailScreen.jsx';
import JoinGroupScreen from './screens/JoinGroupScreen.jsx';

function RequireAuth({ children }) {
  const { player, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  if (!player) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function AppRoutes() {
  const { ready, firstRun } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  return (
    <>
      {!splashDone && <SplashScreen ready={ready} onComplete={() => setSplashDone(true)} />}
      <OfflineBanner />
      <InstallPrompt />
      <Routes>
        <Route
          path="/login"
          element={
            firstRun ? <Navigate to="/register" replace /> : <LoginScreen />
          }
        />
        <Route path="/register" element={<RegisterScreen />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <HomeScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/setup"
          element={
            <RequireAuth>
              <GameSetupScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/practice/new"
          element={
            <RequireAuth>
              <PracticeSetupScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/game/:id"
          element={
            <RequireAuth>
              <ScoringScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/practice/:id"
          element={
            <RequireAuth>
              <PracticeScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/game/:id/over"
          element={
            <RequireAuth>
              <GameOverScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth>
              <HistoryScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/history/games/:id"
          element={
            <RequireAuth>
              <GameDetailScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/history/practice/:id"
          element={
            <RequireAuth>
              <PracticeDetailScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/stats"
          element={
            <RequireAuth>
              <PlayerStatsScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/stats/:id"
          element={
            <RequireAuth>
              <PlayerStatsScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <RequireAuth>
              <LeaderboardScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsScreen />
            </RequireAuth>
          }
        />
        <Route path="/spectate/:id" element={<SpectatorScreen />} />
        <Route path="/join/:token" element={<JoinGroupScreen />} />
        <Route
          path="/tournaments"
          element={
            <RequireAuth>
              <TournamentListScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/tournaments/new"
          element={
            <RequireAuth>
              <TournamentSetupScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/tournaments/:id"
          element={
            <RequireAuth>
              <TournamentDetailScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/invitations"
          element={
            <RequireAuth>
              <InvitationsScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/groups"
          element={
            <RequireAuth>
              <GroupsListScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/groups/new"
          element={
            <RequireAuth>
              <GroupCreateScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/groups/:id"
          element={
            <RequireAuth>
              <GroupDetailScreen />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <InstallProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </InstallProvider>
    </ThemeProvider>
  );
}
