'use client'

import { Paperclip, Send } from 'lucide-react'
import { useState } from 'react'

interface ChatComposerProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export default function ChatComposer({ onSend, disabled }: ChatComposerProps) {
  const [message, setMessage] = useState('')

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message)
      setMessage('')
    }
  }

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      <div className="max-w-4xl mx-auto flex items-end gap-3">
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors mb-2">
          <Paperclip className="w-5 h-5 text-gray-600" />
        </button>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Mesajınızı yazın..."
          disabled={disabled}
          className="flex-1 min-h-[60px] max-h-[120px] px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
          rows={2}
        />
        <button
          onClick={handleSend}
          disabled={disabled}
          className="p-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

