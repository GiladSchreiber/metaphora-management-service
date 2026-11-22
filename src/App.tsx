import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CashflowPage } from './pages/CashflowPage'
import { ContactsPage } from './pages/ContactsPage'
import { TasksPage } from './pages/TasksPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/tasks" replace />} />
          <Route path="cashflow" element={<CashflowPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
