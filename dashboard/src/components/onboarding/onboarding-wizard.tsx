// dashboard/src/components/onboarding/onboarding-wizard.tsx
// First-run onboarding wizard — 5 steps to get started

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Users,
  Bot,
  Send,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Rocket,
  Upload,
  Settings,
  TestTube,
} from 'lucide-react'

interface WizardStep {
  id: string
  title: string
  description: string
  icon: any
}

const steps: WizardStep[] = [
  { id: 'welcome', title: 'Bienvenido', description: 'Conoce MejoraWS', icon: Rocket },
  { id: 'contacts', title: 'Importar contactos', description: 'Carga tu base de contactos', icon: Users },
  { id: 'personality', title: 'Personalidad del bot', description: 'Define cómo responderá tu IA', icon: Bot },
  { id: 'test', title: 'Prueba el bot', description: 'Envía un mensaje de prueba', icon: TestTube },
  { id: 'ready', title: '¡Listo!', description: 'Tu bot está funcionando', icon: CheckCircle2 },
]

interface OnboardingWizardProps {
  onComplete: () => void
  onSkip: () => void
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [botName, setBotName] = useState('MejoraBot')
  const [botTone, setBotTone] = useState('profesional y amigable')
  const [botLanguage, setBotLanguage] = useState('es')
  const [companyName, setCompanyName] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  // Check if onboarding was already completed
  useEffect(() => {
    const done = localStorage.getItem('onboarding_completed')
    if (done === 'true') onComplete()
  }, [onComplete])

  const step = steps[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  const next = () => {
    if (isLast) {
      localStorage.setItem('onboarding_completed', 'true')
      onComplete()
    } else {
      setCurrentStep((s) => s + 1)
    }
  }

  const prev = () => setCurrentStep((s) => Math.max(0, s - 1))

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    try {
      const token = localStorage.getItem('token')
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const formData = new FormData()
      formData.append('file', importFile)
      const res = await fetch(`${API_BASE}/api/v1/contacts/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      setImportResult(`${data.data?.imported || 0} contactos importados correctamente`)
    } catch (err) {
      setImportResult('Error al importar. Verificá el formato del archivo.')
    } finally {
      setImporting(false)
    }
  }

  const handleSavePersonality = async () => {
    try {
      const token = localStorage.getItem('token')
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      await fetch(`${API_BASE}/api/v1/status/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          botName,
          tone: botTone,
          language: botLanguage,
        }),
      })
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader className="text-center">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-4">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === currentStep ? 'bg-primary' : i < currentStep ? 'bg-primary/50' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <step.icon className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{step.title}</CardTitle>
          <CardDescription>{step.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Step: Welcome */}
          {currentStep === 0 && (
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground">
                <strong>MejoraWS</strong> es tu CRM WhatsApp autónomo con IA. El bot responde automáticamente
                como un humano, gestiona tu pipeline de ventas y te reporta todo.
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <MessageSquare className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="font-medium">Auto-reply IA</p>
                  <p className="text-xs text-muted-foreground">Responde como humano</p>
                </div>
                <div className="rounded-lg border p-3">
                  <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="font-medium">CRM completo</p>
                  <p className="text-xs text-muted-foreground">Contactos + Pipeline</p>
                </div>
                <div className="rounded-lg border p-3">
                  <Send className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="font-medium">Campañas</p>
                  <p className="text-xs text-muted-foreground">Envío masivo anti-ban</p>
                </div>
                <div className="rounded-lg border p-3">
                  <Settings className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="font-medium">100% autónomo</p>
                  <p className="text-xs text-muted-foreground">$0 de costo</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Este wizard te guía en 4 pasos. Tomá ~2 minutos.</p>
            </div>
          )}

          {/* Step: Import Contacts */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Importá tu base de contactos. Acepta CSV, Excel (.xlsx), VCF o JSON.
              </p>
              <div className="space-y-2">
                <Label htmlFor="import-file">Seleccionar archivo</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".csv,.xlsx,.xls,.vcf,.json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
              </div>
              {importFile && (
                <div className="flex items-center gap-2 text-sm">
                  <Upload className="h-4 w-4" />
                  <span>{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
              <Button onClick={handleImport} disabled={!importFile || importing} className="w-full" variant="outline">
                {importing ? 'Importando...' : 'Importar contactos'}
              </Button>
              {importResult && (
                <p className={`text-sm ${importResult.includes('Error') ? 'text-destructive' : 'text-green-600'}`}>
                  {importResult}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                💡 Podés saltear este paso e importar después desde Contactos.
              </p>
            </div>
          )}

          {/* Step: Bot Personality */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Definí cómo se presenta y comunica tu bot con los contactos.
              </p>
              <div className="space-y-2">
                <Label htmlFor="bot-name">Nombre del bot</Label>
                <Input
                  id="bot-name"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="Ej: MejoraBot, Asistente de ventas"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Tu empresa/negocio</Label>
                <Input
                  id="company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ej: Mejora Digital"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Tono de comunicación</Label>
                <Textarea
                  id="tone"
                  value={botTone}
                  onChange={(e) => setBotTone(e.target.value)}
                  placeholder="Ej: profesional y amigable, usa emojis moderadamente"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Idioma</Label>
                <div className="flex gap-2">
                  <Button
                    variant={botLanguage === 'es' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBotLanguage('es')}
                  >
                    🇪🇸 Español
                  </Button>
                  <Button
                    variant={botLanguage === 'en' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBotLanguage('en')}
                  >
                    🇺🇸 English
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step: Test */}
          {currentStep === 3 && (
            <div className="space-y-4 text-center">
              <TestTube className="h-12 w-12 mx-auto text-primary" />
              <p className="text-muted-foreground">
                Para probar el bot, enviá un mensaje a tu número de WhatsApp conectado desde otro teléfono.
              </p>
              <div className="rounded-lg border p-4 text-sm text-left space-y-2">
                <p><strong>1.</strong> Asegurate de que WhatsApp esté conectado (badge verde en el dashboard)</p>
                <p><strong>2.</strong> Desde otro celular, enviá un mensaje como: <em>"Hola, ¿qué servicios ofrecen?"</em></p>
                <p><strong>3.</strong> El bot debería responder automáticamente en ~5-15 segundos</p>
              </div>
              <Badge variant="outline" className="text-xs">
                💡 El bot detecta intención (CONSULTA, COMPRA, QUEJA, etc.) y responde acorde
              </Badge>
            </div>
          )}

          {/* Step: Ready */}
          {currentStep === 4 && (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
              <h3 className="text-xl font-bold">¡Todo listo!</h3>
              <p className="text-muted-foreground">
                Tu bot de WhatsApp está funcionando. Desde el dashboard podés ver conversaciones,
                gestionar contactos, crear campañas y revisar analytics.
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted p-2">
                  <p className="font-medium">Pipeline</p>
                  <p className="text-xs text-muted-foreground">Seguí tus deals</p>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <p className="font-medium">Campañas</p>
                  <p className="text-xs text-muted-foreground">Mensajería masiva</p>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <p className="font-medium">Analytics</p>
                  <p className="text-xs text-muted-foreground">KPIs y gráficas</p>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <p className="font-medium">Config</p>
                  <p className="text-xs text-muted-foreground">Ajustá el bot</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <div>
              {isFirst ? (
                <Button variant="ghost" size="sm" onClick={onSkip}>
                  Saltar wizard
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={prev}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
                </Button>
              )}
            </div>
            <Button
              onClick={() => {
                if (currentStep === 2) handleSavePersonality()
                next()
              }}
            >
              {isLast ? 'Comenzar' : 'Siguiente'}
              {!isLast && <ArrowRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
