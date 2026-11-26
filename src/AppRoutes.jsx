import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import DashboardShell from './components/shell/DashboardShell.jsx';
import OverviewRoute from './routes/OverviewRoute.jsx';
import MatrixRoute from './routes/MatrixRoute.jsx';
import ProgressRoute from './routes/ProgressRoute.jsx';
import ChecklistRoute from './routes/ChecklistRoute.jsx';

/**
 * Authenticated app: shell (navbar + side nav) → App (data provider) → one screen per route.
 * Mounted by AuthRoot only after Trimble ID auth succeeds; LoginScreen stays outside the shell.
 */
export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardShell />}>
          <Route element={<App />}>
            <Route index element={<OverviewRoute />} />
            <Route path="matrix" element={<MatrixRoute />} />
            <Route path="progress" element={<ProgressRoute />} />
            <Route path="checklist" element={<ChecklistRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
