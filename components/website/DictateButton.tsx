'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'

/**
 * Tarayıcı yerel Web Speech API ile sesle-yazma (client-side, ücretsiz, anahtarsız).
 * Toggle: pasifken mikrofon + etiket; dinlerken kırmızı "açık" durumu + ses çalıyormuş gibi
 * animasyonlu equalizer çubukları. Boyut kardeş butonlarla aynı (text-sm).
 * Desteklenmeyen tarayıcıda (Firefox) hiçbir şey render etmez (graceful).
 */

interface SpeechResultAlt { transcript: string }
interface SpeechResult { 0: SpeechResultAlt; isFinal: boolean }
interface SpeechResultList { length: number; [i: number]: SpeechResult }
interface SpeechEvent { resultIndex: number; results: SpeechResultList }
interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SpeechEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike
    webkitSpeechRecognition?: new () => RecognitionLike
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

/** Ses çalıyormuş hissi veren animasyonlu equalizer (4 çubuk, kademeli). */
function Equalizer() {
  return (
    <span className="inline-flex items-end gap-[2px] h-4" aria-hidden>
      <style>{`@keyframes wsx-eq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}`}</style>
      {[0, 0.15, 0.3, 0.45].map((d, i) => (
        <span
          key={i}
          className="w-[2.5px] h-4 rounded-full bg-current origin-bottom"
          style={{ animation: `wsx-eq .9s ease-in-out ${d}s infinite` }}
        />
      ))}
    </span>
  )
}

interface DictateButtonProps {
  onAppend: (text: string) => void
  lang?: string
  labelStart: string
  labelStop: string
}

export default function DictateButton({ onAppend, lang = 'tr-TR', labelStart, labelStop }: DictateButtonProps) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<RecognitionLike | null>(null)

  useEffect(() => { setSupported(getRecognitionCtor() != null) }, [])
  useEffect(() => () => { try { recRef.current?.stop() } catch { /* noop */ } }, [])

  const toggle = () => {
    if (listening) { try { recRef.current?.stop() } catch { /* noop */ } return }
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: SpeechEvent) => {
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
      }
      if (finalText.trim()) onAppend(finalText.trim())
    }
    rec.onend = () => { setListening(false); recRef.current = null }
    rec.onerror = () => { setListening(false) }
    recRef.current = rec
    setListening(true)
    try { rec.start() } catch { setListening(false) }
  }

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? labelStop : labelStart}
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
        listening
          ? 'border-red-300 bg-red-50 text-red-600 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
          : 'border-gray-200 text-gray-700 hover:bg-gray-50/60'
      }`}
    >
      {listening ? <Equalizer /> : <Mic className="w-4 h-4" />}
      <span>{listening ? labelStop : labelStart}</span>
    </button>
  )
}
