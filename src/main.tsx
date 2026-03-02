import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'dockview/dist/styles/dockview.css'
import './styles/dockview-custom.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
