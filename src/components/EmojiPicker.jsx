import { useState } from 'react'
import { EMOJIS } from '../constants'

export function EmojiPicker({ onPick }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs text-mc-tinta transition-colors"
      >
        🙂 Emojis
      </button>
      {abierto && (
        <div className="mt-1.5 grid grid-cols-8 gap-1 p-2 border border-gray-200 rounded-lg bg-white">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onPick(e)}
              className="text-lg hover:bg-gray-100 rounded p-0.5 leading-none"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
