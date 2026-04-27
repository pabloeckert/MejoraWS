'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getStatus, getRecentMessages } from '@/lib/api'
import {
  MessageSquare,
  Users,
  GitBranch,
  DollarSign,
  Wifi,
  WifiOff,
  Bot,
  Clock,
} from 'lucide-react'

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  variant?: 'default' | 'success' | 'warning' | 'destructive'
}) {
  const colors = {
    default: 'text-muted-foreground',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    destructive: 'text-destructive',
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${colors[variant]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [status, setStatus] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, msgsRes] = await Promise.all([
        getStatus(),
        getRecentMessages(10),
      ])
      setStatus(statusRes.data)
      setMessages(msgsRes.data)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000) // Refresh every 15s
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    )
  }

  const sys = status?.system || {}
  const contacts = status?.contacts || {}
  const deals = status?.deals || {}
  const send = status?.send || {}

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2">
            {sys.whatsapp ? (
              <Badge variant="default" className="bg-green-600">
                <Wifi className="h-3 w-3 mr-1" /> WhatsApp Conectado
              </Badge>
            ) : (
              <Badge variant="destructive">
                <WifiOff className="h-3 w-3 mr-1" /> Desconectado
              </Badge>
            )}
            {sys.botActive && (
              <Badge variant="outline">
                <Bot className="h-3 w-3 mr-1" /> Bot Activo
              </Badge>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Mensajes Hoy"
            value={send.sentToday || 0}
            subtitle={`Límite: ${send.dailyLimit || 0} | Warm-up: ${send.warmupProgress || 0}%`}
            icon={MessageSquare}
          />
          <KpiCard
            title="Contactos"
            value={contacts.total || 0}
            subtitle={`${contacts.withWhatsApp || 0} con WhatsApp | ${contacts.withEmail || 0} con email`}
            icon={Users}
          />
          <KpiCard
            title="Deals Activos"
            value={deals.open || 0}
            subtitle={`${deals.closedWon || 0} ganados | ${deals.closedLost || 0} perdidos`}
            icon={GitBranch}
            variant={deals.open > 0 ? 'success' : 'default'}
          />
          <KpiCard
            title="Revenue Cerrado"
            value={`$${(deals.totalValue || 0).toLocaleString()}`}
            subtitle={`Conversión: ${deals.conversionRate || 0}%`}
            icon={DollarSign}
            variant={deals.totalValue > 0 ? 'success' : 'default'}
          />
        </div>

        {/* LLM Status + Warm-up */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">🧠 Estado LLM</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Activo:</span>
                  <Badge variant="outline">{sys.llm?.active || 'ninguno'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Groq:</span>
                  <span>{sys.llm?.groq ? '✅' : '❌'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Ollama:</span>
                  <span>{sys.llm?.ollama ? '✅' : '❌'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">🛡️ Anti-Ban Warm-up</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Warm-up:</span>
                  <span className="text-sm font-medium">{sys.warmup || 'N/A'}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${send.warmupProgress || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>{send.warmupProgress || 0}%</span>
                  <span>100%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">📨 Últimos Mensajes</CardTitle>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin mensajes recientes</p>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className={msg.direction === 'inbound' ? 'text-blue-500' : 'text-green-500'}>
                      {msg.direction === 'inbound' ? '📩' : '📤'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{msg.contact_name || msg.contact_phone}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground truncate">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
