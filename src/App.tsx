import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { Toaster } from '@/components/ui/sonner'
import { Home } from '@/pages/Home'
import { Markets } from '@/pages/Markets'
import { NotFound } from '@/pages/NotFound'
import { Portfolio } from '@/pages/Portfolio'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="markets" element={<Markets />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
