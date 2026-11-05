import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MainSite from './mainPages/MainSite.tsx'
import { BrowserRouter, Routes, Route } from 'react-router'
import CheckersSite from './games/checkers/CheckersSite.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<MainSite />} />
        <Route path='/checkers' element={<CheckersSite />} />

      </Routes>
    </BrowserRouter>
  </StrictMode>
)
