import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/AuthProvider'
import { LanguageProvider } from '@/contexts/LanguageProvider'
import { Auth } from '@/pages/Auth'
import { Privacy } from '@/pages/Privacy'
import { Dashboard } from '@/pages/Dashboard'
import { Home } from '@/pages/Home'
import { Markets } from '@/pages/Markets'
import { NotFound } from '@/pages/NotFound'
import { Portfolio } from '@/pages/Portfolio'

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="auth" element={<Auth />} />
              {/* Outside ProtectedRoute on purpose: a store listing links
                  straight here, and a reviewer will not have an account. */}
              <Route path="privacy" element={<Privacy />} />

              <Route element={<ProtectedRoute />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="markets" element={<Markets />} />
                <Route path="portfolio" element={<Portfolio />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  )
}
