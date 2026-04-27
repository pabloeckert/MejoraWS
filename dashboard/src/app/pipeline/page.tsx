'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getPipeline, moveDealStage, closeDeal, getFollowUps } from '@/lib/api'
import { ArrowRight, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react'

const STAGE_COLORS: Record<string, string> = {
  'nuevo': 'bg-blue-100 text-blue-800 border-blue-200',
  'contactado': 'bg-purple-100 text-purple-800 border-purple-200',
  'interesado': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'propuesta': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'negociacion': 'bg-orange-100 text-orange-800 border-orange-200',
  'cerrado-ganado': 'bg-green-100 text-green-800 border-green-200',
  'cerrado-perdido': 'bg-red-100 text-red-800 border-red-200',
}

const NEXT_STAGES: Record<string, string[]> = {
  'nuevo': ['contactado'],
  'contactado': ['interesado'],
  'interesado': ['propuesta'],
  'propuesta': ['negociacion'],
  'negociacion': ['cerrado-ganado', 'cerrado-perdido'],
}

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<any>(null)
  const [followups, setFollowups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [pipeRes, fuRes] = await Promise.all([getPipeline(), getFollowUps()])
      setPipeline(pipeRes.data)
      setFollowups(fuRes.data)
    } catch (err) {
      console.error('Failed to fetch pipeline:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleMove = async (dealId: string, stage: string) => {
    await moveDealStage(dealId, stage)
    fetchData()
  }

  const handleClose = async (dealId: string, won: boolean) => {
    await closeDeal(dealId, won)
    fetchData()
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Pipeline</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{pipeline?.totalDeals || 0} deals</span>
            <span className="font-medium">${(pipeline?.totalValue || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(pipeline?.stages || [])
            .filter((s: any) => !s.stage.startsWith('cerrado'))
            .map((stage: any) => (
              <div key={stage.stage} className="flex-shrink-0 w-72">
                <div className={`rounded-lg border p-3 ${STAGE_COLORS[stage.stage] || 'bg-card'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm capitalize">{stage.stage.replace('-', ' ')}</h3>
                    <Badge variant="secondary">{stage.count}</Badge>
                  </div>
                  <div className="space-y-2">
                    {stage.deals.map((deal: any) => (
                      <Card key={deal.id} className="bg-background">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{deal.contact_name || deal.contact_phone}</span>
                            {deal.value && (
                              <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {deal.value.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {deal.notes && (
                            <p className="text-xs text-muted-foreground truncate">{deal.notes}</p>
                          )}
                          <div className="flex gap-1 flex-wrap">
                            {NEXT_STAGES[deal.stage]?.map((next) => (
                              <Button
                                key={next}
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs px-2"
                                onClick={() => handleMove(deal.id, next)}
                              >
                                <ArrowRight className="h-3 w-3 mr-1" />
                                {next.replace('-', ' ')}
                              </Button>
                            ))}
                            {deal.stage === 'negociacion' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-xs px-2 text-green-600 border-green-200"
                                  onClick={() => handleClose(deal.id, true)}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" /> Ganar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-xs px-2 text-red-600 border-red-200"
                                  onClick={() => handleClose(deal.id, false)}
                                >
                                  <XCircle className="h-3 w-3 mr-1" /> Perder
                                </Button>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {stage.deals.length === 0 && (
                      <p className="text-xs text-center text-muted-foreground py-4">Sin deals</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Closed deals summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-green-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Ganados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pipeline?.stages?.find((s: any) => s.stage === 'cerrado-ganado')?.count || 0}</div>
              <p className="text-sm text-muted-foreground">
                ${((pipeline?.stages?.find((s: any) => s.stage === 'cerrado-ganado')?.value) || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-red-600 flex items-center gap-2">
                <XCircle className="h-4 w-4" /> Perdidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pipeline?.stages?.find((s: any) => s.stage === 'cerrado-perdido')?.count || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Follow-ups */}
        {followups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" /> Follow-ups Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {followups.map((fu: any) => (
                  <div key={fu.id} className="flex items-center justify-between text-sm">
                    <span>{fu.contact_name || fu.contact_phone}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{fu.stage}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {fu.next_follow_up ? new Date(fu.next_follow_up).toLocaleString() : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
