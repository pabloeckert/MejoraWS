'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getCampaigns,
  createCampaign,
  executeCampaign,
  pauseCampaign,
  deleteCampaign,
  getCampaignStats,
} from '@/lib/api'
import {
  Plus,
  Play,
  Pause,
  Trash2,
  BarChart3,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  running: 'bg-yellow-100 text-yellow-800',
  paused: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
}

const STATUS_ICONS: Record<string, any> = {
  draft: AlertCircle,
  scheduled: Clock,
  running: Send,
  paused: Pause,
  completed: CheckCircle,
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [statsDialog, setStatsDialog] = useState<string | null>(null)
  const [campaignStats, setCampaignStats] = useState<any>(null)
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    objective: '',
    audience: 'all',
    template: '',
    variations: '',
    scheduled_at: '',
  })

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await getCampaigns()
      setCampaigns(res.data)
    } catch (err) {
      console.error('Failed to fetch campaigns:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const handleCreate = async () => {
    if (!newCampaign.name || !newCampaign.template) return
    try {
      const data: any = {
        name: newCampaign.name,
        audience: newCampaign.audience,
        template: newCampaign.template,
      }
      if (newCampaign.objective) data.objective = newCampaign.objective
      if (newCampaign.variations) {
        data.variations = newCampaign.variations.split('\n---\n').map(v => v.trim()).filter(Boolean)
      }
      if (newCampaign.scheduled_at) data.scheduled_at = new Date(newCampaign.scheduled_at).toISOString()

      await createCampaign(data)
      setDialogOpen(false)
      setNewCampaign({ name: '', objective: '', audience: 'all', template: '', variations: '', scheduled_at: '' })
      fetchCampaigns()
    } catch (err) {
      console.error('Failed to create campaign:', err)
    }
  }

  const handleExecute = async (id: string) => {
    if (!confirm('¿Ejecutar esta campaña? Se enviarán mensajes a todos los contactos de la audiencia.')) return
    try {
      await executeCampaign(id)
      fetchCampaigns()
    } catch (err) {
      console.error('Failed to execute campaign:', err)
    }
  }

  const handlePause = async (id: string) => {
    await pauseCampaign(id)
    fetchCampaigns()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta campaña?')) return
    await deleteCampaign(id)
    fetchCampaigns()
  }

  const handleShowStats = async (id: string) => {
    try {
      const res = await getCampaignStats(id)
      setCampaignStats(res.data)
      setStatsDialog(id)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Campañas</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger>
              <Button><Plus className="h-4 w-4 mr-2" /> Nueva Campaña</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Crear Campaña</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nombre *</Label>
                  <Input
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    placeholder="Ej: Promoción Verano 2026"
                  />
                </div>
                <div>
                  <Label>Objetivo</Label>
                  <Input
                    value={newCampaign.objective}
                    onChange={(e) => setNewCampaign({ ...newCampaign, objective: e.target.value })}
                    placeholder="Ej: Generar leads para curso de marketing"
                  />
                </div>
                <div>
                  <Label>Audiencia</Label>
                  <Input
                    value={newCampaign.audience}
                    onChange={(e) => setNewCampaign({ ...newCampaign, audience: e.target.value })}
                    placeholder="all | tag:ventas | score:50+ | phone:549...,549..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Formatos: <code>all</code>, <code>tag:nombre</code>, <code>score:N+</code>, <code>phone:n1,n2</code>
                  </p>
                </div>
                <div>
                  <Label>Template *</Label>
                  <Textarea
                    value={newCampaign.template}
                    onChange={(e) => setNewCampaign({ ...newCampaign, template: e.target.value })}
                    placeholder="Hola {{nombre}}! Te escribo porque..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variables: {'{{nombre}}'}, {'{{empresa}}'}
                  </p>
                </div>
                <div>
                  <Label>Variaciones (opcional, una por separado con ---)</Label>
                  <Textarea
                    value={newCampaign.variations}
                    onChange={(e) => setNewCampaign({ ...newCampaign, variations: e.target.value })}
                    placeholder={"Hola! Te consulto por...\n---\nBuenos días! Quería saber si..."}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Programar (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={newCampaign.scheduled_at}
                    onChange={(e) => setNewCampaign({ ...newCampaign, scheduled_at: e.target.value })}
                  />
                </div>
                <Button onClick={handleCreate} className="w-full">Crear Campaña</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Campaigns Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Enviados</TableHead>
                  <TableHead>Respuestas</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead className="w-30">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                  </TableRow>
                ) : campaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Sin campañas. Creá una con el botón de arriba.
                    </TableCell>
                  </TableRow>
                ) : (
                  campaigns.map((c) => {
                    const StatusIcon = STATUS_ICONS[c.status] || AlertCircle
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{c.name}</span>
                            {c.objective && <p className="text-xs text-muted-foreground">{c.objective}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[c.status] || ''}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.sent_count}</TableCell>
                        <TableCell>{c.reply_count}</TableCell>
                        <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(c.status === 'draft' || c.status === 'scheduled') && (
                              <Button size="sm" variant="outline" className="h-7" onClick={() => handleExecute(c.id)}>
                                <Play className="h-3 w-3" />
                              </Button>
                            )}
                            {c.status === 'running' && (
                              <Button size="sm" variant="outline" className="h-7" onClick={() => handlePause(c.id)}>
                                <Pause className="h-3 w-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7" onClick={() => handleShowStats(c.id)}>
                              <BarChart3 className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-7" onClick={() => handleDelete(c.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Stats Dialog */}
        <Dialog open={!!statsDialog} onOpenChange={() => setStatsDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Estadísticas de Campaña</DialogTitle>
            </DialogHeader>
            {campaignStats && (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{campaignStats.sent}</div>
                    <p className="text-xs text-muted-foreground">Enviados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{campaignStats.delivered}</div>
                    <p className="text-xs text-muted-foreground">Entregados ({campaignStats.deliveryRate}%)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{campaignStats.read}</div>
                    <p className="text-xs text-muted-foreground">Leídos ({campaignStats.readRate}%)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{campaignStats.replied}</div>
                    <p className="text-xs text-muted-foreground">Respuestas ({campaignStats.replyRate}%)</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
