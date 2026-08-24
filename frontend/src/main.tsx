import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Analytics } from "@vercel/analytics/react"
import { installReadableStreamAsyncIterator } from './utils/readableStreamAsyncIterator'

// safari lacks ReadableStream async iteration, which pdf.js relies on for text extraction
installReadableStreamAsyncIterator()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
     <Analytics />
  </StrictMode>,
)
