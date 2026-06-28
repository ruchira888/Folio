import { useState } from 'react'
import { X } from 'lucide-react'
import { validateToolFiles } from '../utils/validateToolFiles'
import ToolModal from './ToolModal'
import ModalOverlay from './ModalOverlay'
import PdfDarkModeViewer from './PdfDarkModeViewer'

interface DarkModePdfModalProps {
  isOpen: boolean
  onClose: () => void
}

type ModalState = 'upload' | 'viewer'

export default function DarkModePdfModal({ isOpen, onClose }: DarkModePdfModalProps) {
  const [state, setState] = useState<ModalState>('upload')
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleClose = () => {
    setState('upload')
    setError(null)
    setSelectedFile(null)
    onClose()
  }

  const handleFilesSelected = async (files: File[]) => {
    const validationError = validateToolFiles('dark-mode', files)
    if (validationError) {
      setError(validationError)
      return
    }

    const file = files[0]
    if (!file) return

    setError(null)
    setSelectedFile(file)
    setState('viewer')
  }

  // Full-screen viewer modal — replaces the light-themed ToolModal layout
  if (state === 'viewer' && selectedFile) {
    return (
      <ModalOverlay isOpen onClose={handleClose}>
        <div className="relative flex h-[90vh] w-[90vw] max-w-[900px] flex-col overflow-hidden rounded-3xl bg-[#1a1a1a] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)]">
          {/* Dark header */}
          <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F59E0B]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4 text-white"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </span>
              <span className="font-serif text-base font-semibold text-white">
                Dark Mode Preview
              </span>
              <span className="ml-2 truncate max-w-[200px] text-xs text-slate-400">
                {selectedFile.name}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 text-slate-400 transition-all hover:scale-105 hover:border-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Viewer body */}
          <div className="flex-1 overflow-hidden px-4 pb-4 pt-3">
            <PdfDarkModeViewer
              file={selectedFile}
              onBack={() => setState('upload')}
            />
          </div>

          {/* Footer */}
          <div className="border-t border-slate-700 px-6 py-3 text-center">
            <p className="text-xs font-medium text-slate-500">
              100% client-side processing · Your file never leaves your device
            </p>
          </div>
        </div>
      </ModalOverlay>
    )
  }

  return (
    <ToolModal
      isOpen={isOpen}
      onClose={handleClose}
      toolType="dark-mode"
      isUploading={false}
      isProcessing={false}
      error={error}
      onFilesSelected={(files) => {
        void handleFilesSelected(files)
      }}
    />
  )
}
