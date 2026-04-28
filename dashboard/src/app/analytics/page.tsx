'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getAnalyticsOverview,
  getAnalyticsMessages,
  getAnalyticsFunnel,
  getAnalyticsSentiment,
  getAnalyticsTiming,
  getAnalyticsQuality,
  exportAnalytics,
} from '@/lib/api'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
} from 'recharts'
import {
  TrendingUp,
  MessageSquare,
  Users,
  DollarSign,
  Download,
  Clock,
  Heart,
  Zap,
} from 'lucide-react'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

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

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [funnel, setFunnel] = useState<any[]>([])
  const [sentiment, setSentiment] = useState<any[]>([])
  const [timing, setTiming] = useState<any>(null)
  const [quality, setQuality] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [ov, msg, fun, sent, tim, qual] = await Promise.all([
        getAnalyticsOverview(),
        getAnalyticsMessages(),
        getAnalyticsFunnel(),
        getAnalyticsSentiment(),
        getAnalyticsTiming(),
        getAnalyticsQuality(),
      ])
      setOverview(ov.data)
      setMessages(msg.data || [])
      setFunnel(fun.data || [])
      setSentiment(sent.data || [])
      setTiming(tim.data)
      setQuality(qual.data)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleExport = async (type: string) => {
    try {
      const blob = await exportAnalytics(type)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mejoraws-${type}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Analytics</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('messages')}>
              <Download className="h-4 w-4 mr-1" /> Mensajes
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('contacts')}>
              <Download className="h-4 w-4 mr-1" /> Contactos
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('deals')}>
              <Download className="h-4 w-4 mr-1" /> Deals
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Mensajes Hoy"
            value={overview?.messages?.today || 0}
            subtitle={`Semana: ${overview?.messages?.week || 0} | Mes: ${overview?.messages?.month || 0}`}
            icon={MessageSquare}
          />
          <KpiCard
            title="Tasa Respuesta"
            value={`${overview?.responseRate || 0}%`}
            subtitle="Bot respondiendo / mensajes recibidos"
            icon={Zap}
            variant={(overview?.responseRate || 0) > 80 ? 'success' : 'warning'}
          />
          <KpiCard
            title="Deals Creados (mes)"
            value={overview?.deals?.created || 0}
            subtitle={`${overview?.deals?.won || 0} ganados | Conv: ${overview?.deals?.conversionRate || 0}%`}
            icon={TrendingUp}
          />
          <KpiCard
            title="Revenue (mes)"
            value={`$${(overview?.revenue || 0).toLocaleString()}`}
            subtitle={`${overview?.deals?.closed || 0} deals cerrados`}
            icon={DollarSign}
            variant={(overview?.revenue || 0) > 0 ? 'success' : 'default'}
          />
        </div>

        {/* Message Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">📈 Tendencia de Mensajes (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos suficientes</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={messages}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => v.split('-').slice(1).join('/')}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="inbound"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    name="Recibidos"
                  />
                  <Area
                    type="monotone"
                    dataKey="outbound"
                    stackId="1"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.3}
                    name="Enviados"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Conversion Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">🔄 Funnel de Conversión</CardTitle>
            </CardHeader>
            <CardContent>
              {funnel.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos suficientes</p>
              ) : (
                <div className="space-y-3">
                  {funnel.map((stage, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{stage.stage}</span>
                        <span className="text-muted-foreground">
                          {stage.count} ({stage.rate}%)
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-3">
                        <div
                          className="h-3 rounded-full transition-all"
                          style={{
                            width: `${Math.max(5, stage.rate)}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timing Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">⏰ Mejor Horario para Enviar</CardTitle>
            </CardHeader>
            <CardContent>
              {!timing?.hourly?.length ? (
                <p className="text-sm text-muted-foreground">Sin datos suficientes</p>
              ) : (
                <>
                  <div className="flex gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Mejor hora</p>
                      <p className="text-lg font-bold">
                        {timing.bestHour !== null ? `${timing.bestHour}:00` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Mejor día</p>
                      <p className="text-lg font-bold">{timing.bestDay || 'N/A'}</p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={timing.hourly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="hour"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `${v}h`}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Mensajes" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Sentiment Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">😊 Tendencia de Sentimiento</CardTitle>
            </CardHeader>
            <CardContent>
              {sentiment.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos suficientes</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={sentiment}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => v.split('-').slice(1).join('/')}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="positive" stackId="a" fill="#22c55e" name="Positivo" />
                    <Bar dataKey="neutral" stackId="a" fill="#94a3b8" name="Neutro" />
                    <Bar dataKey="negative" stackId="a" fill="#ef4444" name="Negativo" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Conversation Quality */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">🎯 Calidad de Conversación</CardTitle>
            </CardHeader>
            <CardContent>
              {!quality ? (
                <p className="text-sm text-muted-foreground">Sin datos suficientes</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Conversaciones totales</p>
                      <p className="text-2xl font-bold">{quality.totalConversations}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Mensajes promedio/conv</p>
                      <p className="text-2xl font-bold">{quality.avgMessagesPerConv}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Auto-resolución</p>
                      <p className="text-2xl font-bold text-green-600">{quality.autoResolutionRate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tasa escalamiento</p>
                      <p className="text-2xl font-bold text-yellow-600">{quality.escalationRate}%</p>
                    </div>
                  </div>

                  {quality.intents?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Intenciones detectadas</p>
                      <div className="space-y-2">
                        {quality.intents.map((intent: any, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {intent.intent}
                            </Badge>
                            <div className="flex-1 bg-secondary rounded-full h-2">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${Math.min(100, (intent.count / (quality.intents[0]?.count || 1)) * 100)}%`,
                                  backgroundColor: COLORS[i % COLORS.length],
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">
                              {intent.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
