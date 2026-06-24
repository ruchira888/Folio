import { useState } from 'react'

export default function SummarizePage() {
  const [fileId, setFileId] = useState<string | null>(null)
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="w-full max-w-5xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6">
        Summarize PDF
      </h1>

      <p>Upload UI goes here</p>

      <p>File ID: {fileId}</p>

      <p>{summary}</p>
    </div>
  )
}