import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ExperimentList from './pages/ExperimentList';
import ExperimentDetail from './pages/ExperimentDetail';
import ExperimentForm from './pages/ExperimentForm';
import LayerList from './pages/LayerList';
import LayerDetail from './pages/LayerDetail';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="experiments" element={<ExperimentList />} />
            <Route path="experiments/new" element={<ExperimentForm />} />
            <Route path="experiments/:id" element={<ExperimentDetail />} />
            <Route path="layers" element={<LayerList />} />
            <Route path="layers/:id" element={<LayerDetail />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
