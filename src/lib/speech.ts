/**
 * Web Speech API: Diktat (SpeechRecognition) und Sprachausgabe (SpeechSynthesis).
 *
 * Die Spracherkennung gibt es nur in Chrome/Edge – dort läuft sie über den Dienst
 * des Browserherstellers, das Audio verlässt also den Rechner. Die Ausgabe spricht
 * der Browser lokal. Beides braucht keine Schlüssel und keinen eigenen Server.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

// ---------- Typen: die DOM-Bibliothek kennt die Web Speech API nicht ----------

interface RecognitionAlternative {
  transcript: string
  confidence: number
}

interface RecognitionResult {
  readonly length: number
  isFinal: boolean
  [index: number]: RecognitionAlternative
}

interface RecognitionResultList {
  readonly length: number
  [index: number]: RecognitionResult
}

interface RecognitionEvent extends Event {
  resultIndex: number
  results: RecognitionResultList
}

interface RecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

type RecognitionCtor = new () => SpeechRecognitionLike

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function recognitionSupported(): boolean {
  return recognitionCtor() !== null
}

export function synthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Fehlermeldungen der Erkennung in verständliches Deutsch übersetzen. */
export function recognitionErrorText(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Das Mikrofon ist blockiert. Erlaube den Zugriff in den Browser-Einstellungen.'
    case 'audio-capture':
      return 'Kein Mikrofon gefunden.'
    case 'network':
      return 'Die Spracherkennung braucht eine Internetverbindung.'
    case 'no-speech':
    case 'aborted':
      return ''
    default:
      return 'Die Spracherkennung hat einen Fehler gemeldet.'
  }
}

/**
 * Ist das Mikrofon freigegeben? Der Browser kennt die Antwort schon, bevor
 * die Erkennung startet – so lässt sich der Hinweis sofort zeigen.
 */
export async function micPermission(): Promise<PermissionState | 'unknown'> {
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName })
    return status?.state ?? 'unknown'
  } catch {
    // Firefox kennt die Abfrage für das Mikrofon nicht
    return 'unknown'
  }
}

// ---------- Sprachausgabe ----------

export interface SpeakOptions {
  voiceURI?: string
  rate?: number
  pitch?: number
  /** Ausgabe still übergehen, wenn sie abgeschaltet ist. */
  enabled?: boolean
}

let voiceCache: SpeechSynthesisVoice[] = []

function allVoices(): SpeechSynthesisVoice[] {
  if (!synthesisSupported()) return []
  const list = window.speechSynthesis.getVoices()
  if (list.length) voiceCache = list
  return voiceCache
}

/** Deutsche Stimmen – alles andere klingt bei deutschen Sätzen falsch. */
export function germanVoices(): SpeechSynthesisVoice[] {
  return allVoices().filter((v) => v.lang.toLowerCase().startsWith('de'))
}

/** Stimmenliste als Hook – sie trudelt in Chrome erst verzögert ein. */
export function useGermanVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(germanVoices)

  useEffect(() => {
    if (!synthesisSupported()) return
    const sync = () => setVoices(germanVoices())
    sync()
    window.speechSynthesis.addEventListener('voiceschanged', sync)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', sync)
  }, [])

  return voices
}

function pickVoice(voiceURI?: string): SpeechSynthesisVoice | null {
  const german = germanVoices()
  if (!german.length) return null
  if (voiceURI) {
    const match = german.find((v) => v.voiceURI === voiceURI)
    if (match) return match
  }
  // Lokale Stimmen setzen ohne Verzögerung ein
  return german.find((v) => v.localService) ?? german[0]
}

export function cancelSpeech(): void {
  if (synthesisSupported()) window.speechSynthesis.cancel()
}

/**
 * Text vorlesen. Das Promise löst auf, wenn die Ausgabe durch ist – so kann das
 * Mikrofon warten, statt die eigene Stimme mitzuschreiben.
 */
export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const { enabled = true, rate = 1, pitch = 1, voiceURI } = options
  if (!enabled || !text.trim() || !synthesisSupported()) return Promise.resolve()

  return new Promise((resolve) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'de-DE'
    utterance.rate = rate
    utterance.pitch = pitch
    const voice = pickVoice(voiceURI)
    if (voice) utterance.voice = voice

    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.clearTimeout(guard)
      resolve()
    }
    utterance.onend = finish
    utterance.onerror = finish

    // Chrome verschluckt gelegentlich das Ende-Ereignis – grob nach Textlänge abbrechen
    const guard = window.setTimeout(finish, 2000 + (text.length / Math.max(rate, 0.5)) * 90)
    window.speechSynthesis.speak(utterance)
  })
}

// ---------- Diktat ----------

export interface DictationHandlers {
  /** Fertig erkannter Satz. */
  onResult: (text: string) => void
  onError?: (message: string) => void
}

export interface Dictation {
  listening: boolean
  /** Was gerade gehört wird, noch nicht bestätigt. */
  interim: string
  start: () => void
  stop: () => void
}

/**
 * Dauerhaftes Zuhören mit Zwischenergebnissen. Chrome beendet die Erkennung nach
 * kurzen Pausen von selbst; solange nicht gestoppt wurde, starten wir neu.
 */
export function useDictation({ onResult, onError }: DictationHandlers): Dictation {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const wanted = useRef(false)
  const restarting = useRef(false)
  const resultRef = useRef(onResult)
  const errorRef = useRef(onError)

  resultRef.current = onResult
  errorRef.current = onError

  const stop = useCallback(() => {
    wanted.current = false
    setInterim('')
    setListening(false)
    recognition.current?.abort()
  }, [])

  const start = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor) {
      errorRef.current?.('Dieser Browser kann keine Sprache erkennen – Chrome oder Edge können es.')
      return
    }
    if (wanted.current) return

    wanted.current = true
    const rec = new Ctor()
    rec.lang = 'de-DE'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onstart = () => setListening(true)

    rec.onresult = (event) => {
      let pending = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) {
          const finalText = text.trim()
          if (finalText) resultRef.current(finalText)
        } else {
          pending += text
        }
      }
      setInterim(pending.trim())
    }

    rec.onerror = (event) => {
      const message = recognitionErrorText(event.error)
      if (message) errorRef.current?.(message)
      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed' ||
        event.error === 'audio-capture'
      ) {
        wanted.current = false
        setListening(false)
      }
    }

    rec.onend = () => {
      setListening(false)
      setInterim('')
      if (!wanted.current || restarting.current) return
      restarting.current = true
      // Kurz warten, sonst wirft Chrome beim Sofort-Neustart
      window.setTimeout(() => {
        restarting.current = false
        if (!wanted.current) return
        try {
          rec.start()
        } catch {
          /* läuft bereits */
        }
      }, 200)
    }

    recognition.current = rec
    try {
      rec.start()
    } catch {
      /* läuft bereits */
    }
  }, [])

  // Beim Verlassen Mikrofon und Ausgabe freigeben
  useEffect(
    () => () => {
      wanted.current = false
      recognition.current?.abort()
      cancelSpeech()
    },
    [],
  )

  return { listening, interim, start, stop }
}
