'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { getBotConfig, updateBotConfig, updateKnowledgeBase } from '@/lib/api'
import { Save, Bot, Clock, AlertTriangle, BookOpen } from 'lucide-react'

export default function ConfigPage() {
  const [config, setConfig] = useState<any>(null)
  const [kb, setKb] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await getBotConfig()
      setConfig(res.data)
    } catch (err) {
      console.error('Failed to fetch config:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaveConfig = async () => {
    if (!config) return
    setSaving(true)
    try {
      await updateBotConfig(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save config:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveKB = async () => {
    setSaving(true)
    try {
      await updateKnowledgeBase(kb)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save KB:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Configuración</h1>
          {saved && <Badge className="bg-green-600">✅ Guardado</Badge>}
        </div>

        {/* Bot Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> Identidad del Bot</CardTitle>
            <CardDescription>Configurá cómo se presenta el bot a los contactos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={config?.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Personalidad</Label>
              <Textarea
                value={config?.personality || ''}
                onChange={(e) => setConfig({ ...config, personality: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Tono</Label>
              <Input
                value={config?.tone || ''}
                onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                placeholder="profesional-cercano"
              />
            </div>
            <Button onClick={handleSaveConfig} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> Guardar Identidad
            </Button>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Horario de Atención</CardTitle>
            <CardDescription>El bot responde solo dentro de este horario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Inicio</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={config?.schedule?.start || 8}
                  onChange={(e) => setConfig({ ...config, schedule: { ...config?.schedule, start: parseInt(e.target.value) } })}
                />
              </div>
              <div>
                <Label>Fin</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={config?.schedule?.end || 20}
                  onChange={(e) => setConfig({ ...config, schedule: { ...config?.schedule, end: parseInt(e.target.value) } })}
                />
              </div>
            </div>
            <Button onClick={handleSaveConfig} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> Guardar Horario
            </Button>
          </CardContent>
        </Card>

        {/* Escalation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Escalamiento</CardTitle>
            <CardDescription>Configurándo cuándo escalar a un humano</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Keywords de escalamiento (separadas por coma)</Label>
              <Input
                value={config?.escalation?.keywords?.join(', ') || ''}
                onChange={(e) => setConfig({
                  ...config,
                  escalation: {
                    ...config?.escalation,
                    keywords: e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean),
                  },
                })}
              />
            </div>
            <div>
              <Label>Máximo intercambios antes de escalar</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config?.escalation?.maxExchanges || 3}
                onChange={(e) => setConfig({
                  ...config,
                  escalation: { ...config?.escalation, maxExchanges: parseInt(e.target.value) },
                })}
              />
            </div>
            <Button onClick={handleSaveConfig} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> Guardar Escalamiento
            </Button>
          </CardContent>
        </Card>

        {/* Knowledge Base */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Knowledge Base</CardTitle>
            <CardDescription>Información del negocio que el bot usa para responder</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={kb}
              onChange={(e) => setKb(e.target.value)}
              rows={6}
              placeholder="Ej: Somos una empresa de servicios de marketing digital. Ofrecemos: gestión de redes sociales, publicidad en Google Ads, diseño web. Horario: lun-vie 9-18. Teléfono: +54 11 1234-5678. Email: info@empresa.com"
            />
            <Button onClick={handleSaveKB} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> Guardar Knowledge Base
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
