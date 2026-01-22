"use client"

import { AIChatMessage } from "@/lib/types"
import { cn } from "@/lib/utils"
import { User, Bot } from "lucide-react"
import ReactMarkdown from "react-markdown"

interface MessageBubbleProps {
  message: AIChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "flex gap-3 w-full min-w-0",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] min-w-0 rounded-lg px-4 py-2.5 break-words overflow-hidden",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words overflow-hidden">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc break-words">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal break-words">{children}</ol>,
                li: ({ children }) => <li className="mb-1 break-words">{children}</li>,
                h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2 break-words">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-2 break-words">{children}</h3>,
                strong: ({ children }) => <strong className="font-semibold break-words">{children}</strong>,
                code: ({ children }) => (
                  <code className="bg-muted-foreground/20 px-1 py-0.5 rounded text-xs font-mono break-all">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-muted-foreground/20 p-2 rounded text-xs font-mono overflow-x-auto break-all">
                    {children}
                  </pre>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
