import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Calendar, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type View = "chat" | "schedule";

const AVAILABLE_SLOTS: Record<number, { start: string; end: string }[]> = {
  0: [{ start: "15:00", end: "19:00" }],
  1: [{ start: "19:30", end: "21:00" }],
  2: [{ start: "15:00", end: "19:00" }],
  3: [{ start: "15:00", end: "19:00" }],
  4: [{ start: "19:30", end: "21:00" }],
  5: [{ start: "19:30", end: "21:00" }],
  6: [{ start: "19:30", end: "21:00" }],
};

function getDaySlots(dayOfWeek: number) {
  return AVAILABLE_SLOTS[dayOfWeek] || [];
}

function generateTimeSlots(start: string, end: string): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let current = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (current < endMin) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    slots.push(`${displayH}:${m.toString().padStart(2, "0")} ${period}`);
    current += 30;
  }
  return slots;
}

function getNext14Days(): Date[] {
  const days: Date[] = [];
  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

const SYSTEM_PROMPT = `You are the EbookGamez customer support assistant. You help customers with:
- Finding books in our catalog (545+ ebooks across many genres)
- Purchase questions and order support
- Reading Pass subscription information (5-tier monthly plans with unlimited online reading)
- Technical support for ebook downloads and reading
- Game-related questions (40+ free browser games)
- General inquiries about EbookGamez

Key info:
- Email: ebookgames@yahoo.com
- Business address: P.O. Box 1181, Las Vegas, NV 89125
- First-time customers get 10% off with code WELCOME10
- All ebooks are digital products delivered electronically
- Payments processed by Stripe
- Refund requests within 14 days at ebookgames@yahoo.com
- Reading Pass plans: Lite ($4.99/mo, unlimited reads, 1 download), Reader ($8.99/mo, unlimited reads, 2 downloads), Value ($12.99/mo, unlimited reads, 3 downloads), Premium ($18.99/mo, unlimited reads, 5 downloads), VIP ($25.99/mo, unlimited reads, 8 downloads)
- All plans include unlimited online reading. Subscribers can download books they've read through their Reading Pass to keep forever, even after cancelling.
- Downloads are chosen from books you've already read online. The number of downloads depends on your plan tier. Downloaded books are DRM-free and permanently yours.

If a customer wants to speak with a live agent, let them know they can use the "Schedule a Call" button in this chat to book an appointment during available hours. Available times are:
- Tuesday, Wednesday, Sunday: 3:00 PM - 7:00 PM PST
- Monday, Thursday, Friday, Saturday: 7:30 PM - 9:00 PM PST

Be friendly, helpful, and concise. Keep responses under 150 words unless the customer needs detailed help.`;

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! Welcome to EbookGamez. How can I help you today? You can ask me about our books, games, orders, or anything else. If you'd like to speak with a live agent, click \"Schedule a Call\" below." }
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [scheduleName, setScheduleName] = useState("");
  const [schedulePhone, setSchedulePhone] = useState("");
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initConversation = async () => {
    if (conversationId) return conversationId;
    try {
      const resp = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Customer Support" }),
      });
      const data = await resp.json();
      setConversationId(data.id);
      return data.id;
    } catch {
      return null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);

    try {
      const convId = await initConversation();
      if (!convId) throw new Error("No conversation");

      const resp = await fetch(`/api/customer-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, conversationId: convId }),
      });

      if (!resp.ok) throw new Error("Chat failed");

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                assistantMsg += data.content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: assistantMsg };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting right now. Please email us at ebookgames@yahoo.com for assistance." }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const availableDays = getNext14Days();
  const selectedDaySlots = selectedDate ? getDaySlots(selectedDate.getDay()) : [];
  const timeSlots = selectedDaySlots.flatMap(s => generateTimeSlots(s.start, s.end));

  const handleScheduleConfirm = (time: string) => {
    if (!selectedDate || !scheduleEmail || !scheduleName || !schedulePhone) return;
    const dateStr = selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    setScheduleConfirmed(true);
    setMessages(prev => [
      ...prev,
      { role: "assistant", content: `Your call has been scheduled for ${dateStr} at ${time} PST. We'll call you at ${schedulePhone}. See you then, ${scheduleName}!` }
    ]);
    fetch("/api/customer-chat/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: scheduleName,
        email: scheduleEmail,
        phone: schedulePhone,
        date: selectedDate.toISOString().split("T")[0],
        time,
        timezone: "PST",
      }),
    }).catch(() => {});
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-4 z-[100] w-[360px] max-w-[calc(100vw-2rem)] h-[500px] bg-stone-900 border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="bg-stone-800 border-b border-white/10 px-4 py-3 flex items-center justify-between shrink-0">
              {view === "schedule" ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setView("chat"); setSelectedDate(null); setScheduleConfirmed(false); }}>
                    <ArrowLeft className="w-4 h-4 text-muted-foreground hover:text-white" />
                  </button>
                  <span className="font-display text-sm text-primary">Schedule a Call</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="font-display text-sm text-primary">EbookGamez Support</span>
                </div>
              )}
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {view === "chat" ? (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm font-serif ${
                        msg.role === "user"
                          ? "bg-primary/20 text-white"
                          : "bg-white/5 text-muted-foreground"
                      }`}>
                        {msg.content || <Loader2 className="w-4 h-4 animate-spin" />}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-white/10 px-3 py-2 shrink-0 space-y-2">
                  <button
                    onClick={() => setView("schedule")}
                    className="w-full text-xs text-center py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors font-serif"
                    data-testid="button-schedule-call"
                  >
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Schedule a Call with an Agent
                  </button>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your message..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      className="bg-black/30 border-white/10 text-sm font-serif"
                      disabled={isStreaming}
                      data-testid="input-chat-message"
                    />
                    <Button
                      size="icon"
                      onClick={handleSend}
                      disabled={isStreaming || !input.trim()}
                      className="bg-primary/20 hover:bg-primary/30 shrink-0"
                      data-testid="button-send-chat"
                    >
                      <Send className="w-4 h-4 text-primary" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {scheduleConfirmed ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Calendar className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-emerald-400 font-display text-lg mb-2">Appointment Confirmed!</p>
                    <p className="text-sm text-muted-foreground font-serif">
                      We'll call you at {schedulePhone} at your scheduled time.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 border-white/10 text-muted-foreground"
                      onClick={() => { setView("chat"); setScheduleConfirmed(false); setSelectedDate(null); }}
                    >
                      Back to Chat
                    </Button>
                  </div>
                ) : !selectedDate ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-serif mb-2">Your contact info:</p>
                    <Input
                      placeholder="Your name"
                      value={scheduleName}
                      onChange={(e) => setScheduleName(e.target.value)}
                      className="bg-black/30 border-white/10 text-sm font-serif"
                      data-testid="input-schedule-name"
                    />
                    <Input
                      type="tel"
                      placeholder="Your phone number"
                      value={schedulePhone}
                      onChange={(e) => setSchedulePhone(e.target.value)}
                      className="bg-black/30 border-white/10 text-sm font-serif"
                      data-testid="input-schedule-phone"
                    />
                    <Input
                      type="email"
                      placeholder="Your email"
                      value={scheduleEmail}
                      onChange={(e) => setScheduleEmail(e.target.value)}
                      className="bg-black/30 border-white/10 text-sm font-serif"
                      data-testid="input-schedule-email"
                    />
                    <p className="text-xs text-muted-foreground font-serif mt-4 mb-2">Select a date:</p>
                    <div className="space-y-1">
                      {availableDays.map((day) => {
                        const slots = getDaySlots(day.getDay());
                        const hasSlots = slots.length > 0;
                        const label = day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                        return (
                          <button
                            key={day.toISOString()}
                            disabled={!hasSlots || !scheduleName || !scheduleEmail || !schedulePhone}
                            onClick={() => hasSlots && setSelectedDate(day)}
                            className={`w-full text-left px-3 py-2 rounded text-sm font-serif transition-colors ${
                              hasSlots && scheduleName && scheduleEmail && schedulePhone
                                ? "bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                                : "bg-white/[0.02] text-white/30 cursor-not-allowed"
                            }`}
                          >
                            {label}
                            <span className="float-right text-xs">
                              {hasSlots ? (
                                <span className="text-emerald-400">Available</span>
                              ) : (
                                <span className="text-white/20">Scheduled</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-serif mb-2">
                      {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} — Pick a time (PST):
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {timeSlots.map((time) => (
                        <button
                          key={time}
                          onClick={() => handleScheduleConfirm(time)}
                          className="px-3 py-2 rounded bg-white/5 hover:bg-primary/20 text-sm font-serif text-white transition-colors border border-white/10 hover:border-primary/30"
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="text-xs text-muted-foreground hover:text-white mt-2"
                    >
                      ← Pick a different date
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[100] w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
        data-testid="button-chat-widget"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-black" />
        ) : (
          <MessageCircle className="w-6 h-6 text-black" />
        )}
      </button>
    </>
  );
}
