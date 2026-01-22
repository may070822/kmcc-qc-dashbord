"use client"

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Loader2, Bot } from "lucide-react"
import { MessageBubble } from "./message-bubble"
import { useAIChat } from "@/hooks/use-ai-chat"
import { AIChatMessage } from "@/lib/types"

interface ChatInterfaceProps {
  agentId?: string
  group?: {
    center?: string
    service?: string
    channel?: string
  }
}

export interface ChatInterfaceRef {
  triggerAutoAnalysis: () => void
}

export const ChatInterface = forwardRef<ChatInterfaceRef, ChatInterfaceProps>(
  function ChatInterface({ agentId, group }, ref) {
    const [input, setInput] = useState("")
    const scrollRef = useRef<HTMLDivElement>(null)
    const { messages, loading, error, sendMessage, triggerAutoAnalysis } = useAIChat({
      agentId,
      group,
    })

    useImperativeHandle(ref, () => ({
      triggerAutoAnalysis,
    }))

  useEffect(() => {
    // 메시지가 추가될 때마다 스크롤을 맨 아래로
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const message = input.trim()
    setInput("")
    await sendMessage(message)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <Card className="flex flex-col h-[calc(100vh-280px)] min-h-[600px] min-w-0">
      <CardContent className="flex-1 flex flex-col p-0 min-w-0 overflow-hidden">
        {/* 메시지 영역 */}
        <ScrollArea className="flex-1 p-4 overflow-x-hidden" ref={scrollRef}>
          <div className="space-y-4 min-w-0 w-full">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">AI 어시스턴트에 오신 것을 환영합니다</p>
                <p className="text-sm">
                  {agentId || group
                    ? "상담사나 그룹을 선택하면 자동으로 분석이 시작됩니다."
                    : "왼쪽에서 상담사나 그룹을 선택해주세요."}
                </p>
                {agentId || group ? (
                  <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                    <p>분석이 완료되면 추가 질문을 입력할 수 있습니다.</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-1 text-xs">
                    <p>예시 질문:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>"이 상담사는 어떤 부분이 부족한가요?"</li>
                      <li>"어떤 코칭을 해야 할까요?"</li>
                      <li>"이 그룹의 주요 문제점은 무엇인가요?"</li>
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
            {loading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 입력 영역 */}
        <form onSubmit={handleSubmit} className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                agentId || group
                  ? "질문을 입력하세요... (Enter로 전송)"
                  : "상담사나 그룹을 먼저 선택해주세요"
              }
              disabled={loading || (!agentId && !group)}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !input.trim() || (!agentId && !group)}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
  }
)
