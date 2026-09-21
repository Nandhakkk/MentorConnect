import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function DashboardLayout({ title = 'Dashboard' }) {
  return (
    <div className="layout-container">
      <Sidebar />
      <div className="layout-main">
        <Header pageTitle={title} />
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
