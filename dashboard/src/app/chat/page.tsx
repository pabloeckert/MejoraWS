'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getRecentMessages, getMessages, sendMessage } from '@/lib/api'
import { Send, MessageSquare } from 'lucide-react'

export default function ChatPage() {
  const [recentChats, setRecentChats] = useState<any[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchRecent = useCallback(async () => {
    try {
      const res = await getRecentMessages(30)
      // Group by contact to get unique conversations
      const unique = new Map<string, any>()
      for (const msg of res.data) {
        const phone = msg.contact_phone
        if (!unique.has(phone)) {
          unique.set(phone, { phone, name: msg.contact_name, lastMsg: msg.content, lastTime: msg.created_at, direction: msg.direction })
        }
      }
      setRecentChats(Array.from(unique.values()))
    } catch (err) {
      console.error('Failed to fetch recent:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMessages = useCallback(async (phone: string) => {
    try {
      const res = await getMessages(phone, 50)
      setMessages(res.data.reverse())
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    }
  }, [])

  useEffect(() => { fetchRecent() }, [fetchRecent])

  useEffect(() => {
    if (selectedPhone) fetchMessages(selectedPhone)
  }, [selectedPhone, fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRecent()
      if (selectedPhone) fetchMessages(selectedPhone)
    }, 10000)
    return () => clearInterval(interval)
  }, [selectedPhone, fetchRecent, fetchMessages])

  const handleSend = async () => {
    if (!newMsg.trim() || !selectedPhone) return
    try {
      await sendMessage(selectedPhone, newMsg)
      setNewMsg('')
      fetchMessages(selectedPhone)
    } catch (err) {
      console.error('Failed to send:', err)
    }
  }

  return (
    <DashboardLayout>
      <div className="flex gap-4 h-[calc(100vh-8rem)]">
        {/* Chat List */}
        <Card className="w-80 flex-shrink-0 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversaciones</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
            ) : recentChats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin conversaciones</p>
            ) : (
              <div className="space-y-1">
                {recentChats.map((chat) => (
                  <button
                    key={chat.phone}
                    onClick={() => setSelectedPhone(chat.phone)}
                    className={`w-full text-left rounded-lg p-3 text-sm transition-colors ${
                      selectedPhone === chat.phone
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <div className="font-medium">{chat.name || chat.phone}</div>
                    <div className="text-xs truncate opacity-70">{chat.lastMsg}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat View */}
        <Card className="flex-1 flex flex-col">
          {selectedPhone ? (
            <>
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-medium">
                  {recentChats.find(c => c.phone === selectedPhone)?.name || selectedPhone}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin mensajes</p>
                ) : (
                  messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                          msg.direction === 'outbound'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </CardContent>
              <div className="border-t p-3 flex gap-2">
                <Input
                  placeholder="Escribir mensaje..."
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend} disabled={!newMsg.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Seleccioná una conversación</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
