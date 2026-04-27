'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { getContacts, createContact, deleteContact, getContactStats } from '@/lib/api'
import { Search, Plus, Trash2, Phone, Mail, Tag } from 'lucide-react'

export default function ContactosPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', company: '' })

  const fetchData = useCallback(async () => {
    try {
      const params: Record<string, string> = { limit: '100' }
      if (search) params.search = search
      const [contactsRes, statsRes] = await Promise.all([getContacts(params), getContactStats()])
      setContacts(contactsRes.data)
      setStats(statsRes.data)
    } catch (err) {
      console.error('Failed to fetch contacts:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreate = async () => {
    if (!newContact.phone) return
    try {
      await createContact(newContact)
      setDialogOpen(false)
      setNewContact({ name: '', phone: '', email: '', company: '' })
      fetchData()
    } catch (err) {
      console.error('Failed to create contact:', err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar contacto?')) return
    await deleteContact(id)
    fetchData()
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Contactos</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger>
              <Button><Plus className="h-4 w-4 mr-2" /> Nuevo Contacto</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Contacto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nombre</Label>
                  <Input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
                </div>
                <div>
                  <Label>Teléfono *</Label>
                  <Input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} placeholder="54911..." />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
                </div>
                <div>
                  <Label>Empresa</Label>
                  <Input value={newContact.company} onChange={(e) => setNewContact({ ...newContact, company: e.target.value })} />
                </div>
                <Button onClick={handleCreate} className="w-full">Crear</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="text-2xl font-bold">{stats.total || 0}</div><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold text-green-600">{stats.withWhatsApp || 0}</div><p className="text-xs text-muted-foreground">Con WhatsApp</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold text-blue-600">{stats.withEmail || 0}</div><p className="text-xs text-muted-foreground">Con Email</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold">{stats.avgScore || 0}</div><p className="text-xs text-muted-foreground">Score Promedio</p></CardContent></Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contactos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>WA</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {loading ? 'Cargando...' : 'Sin contactos. Usá el botón "Nuevo Contacto" o importá desde CLI.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name || '—'}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>
                      </TableCell>
                      <TableCell>
                        {c.email ? <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span> : '—'}
                      </TableCell>
                      <TableCell>{c.whatsapp ? '✅' : '❌'}</TableCell>
                      <TableCell>{c.score}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(c.tags || []).slice(0, 3).map((tag: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
