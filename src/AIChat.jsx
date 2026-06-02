import React, { useState, useRef, useEffect } from 'react';

const AIChat = ({ userRole, stats, onConfirmBooking, onConfirmListing, showToast }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'model', parts: [{ text: `Hi! I'm Commute Copilot ✨ — powered by NVIDIA NIM. I can help you ${userRole === 'Pool Host' ? 'list a new commute or find passengers' : 'find a ride or book one'}, answer carpool policy questions, or look up your personal stats. How can I assist?` }] }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', parts: [{ text: input }] };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          context: { userRole, stats: stats || {} },
          history: messages.filter(m => !m.isActionCard).slice(1) // Remove the initial greeting to satisfy Gemini API requirements
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        if (data.type === 'action') {
          // Model wants to use a tool
          setMessages(prev => [...prev, 
            { role: 'model', parts: [{ text: data.text }] },
            { 
              role: 'model', 
              isActionCard: true, 
              action: data.action, 
              params: data.params 
            }
          ]);
        } else {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.text }] }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.error || 'Sorry, I encountered an error. Please try again.' }] }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'Network error communicating with the AI.' }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = (action, params) => {
    if (action === 'draft_booking' && onConfirmBooking) {
      onConfirmBooking(params);
      setIsOpen(false);
    } else if (action === 'draft_listing' && onConfirmListing) {
      onConfirmListing(params);
      setIsOpen(false);
    } else {
      if (showToast) showToast('This action is not supported in your current role.', 'warning');
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        className="fixed bottom-24 left-8 w-14 h-14 rounded-full flex items-center justify-center text-2xl z-50 shadow-[0_8px_32px_rgba(0,0,0,0.3)] bg-gradient-to-br from-primary to-accent-blue border border-white/10 hover:scale-105 active:scale-95 transition-all duration-300"
        onClick={() => setIsOpen(!isOpen)}
        title="AI Assistant"
      >
        ✨
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-40 left-8 w-[380px] h-[500px] rounded-xl flex flex-col z-50 overflow-hidden glass-panel shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-slide-in">
          {/* Header */}
          <div className="px-5 py-4 bg-white/5 border-b border-white/10 flex justify-between items-center shrink-0">
            <div className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
              <span className="text-primary font-bold">✨</span> Commute Copilot
              <span className="text-[9px] bg-primary/20 text-primary border border-primary/30 rounded px-1.5 py-0.5 font-semibold tracking-widest ml-1">NVIDIA</span>
            </div>
            <button className="text-on-surface-variant hover:text-white transition-colors" onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`max-w-[85%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}>
                {msg.isActionCard ? (
                  <div className="bg-surface-container/85 border border-primary/45 p-4 rounded-xl mt-2 flex flex-col gap-3">
                    <div className="text-xs font-black text-primary uppercase tracking-wider">
                      {msg.action === 'draft_booking' ? '🚕 Ride Request Draft' : '🚗 Commute Listing Draft'}
                    </div>
                    <div className="text-xs text-on-surface leading-relaxed">
                      <strong>From:</strong> {msg.params.origin}<br/>
                      <strong>To:</strong> {msg.params.destination}<br/>
                      <strong>Time:</strong> {msg.params.time}
                      {msg.action === 'draft_listing' && (
                        <><br/><strong>Seats:</strong> {msg.params.seats}<br/><strong>Cost:</strong> ₹{msg.params.price}</>
                      )}
                    </div>
                    <button 
                      className="btn-primary w-full py-2 rounded-lg font-bold text-xs"
                      onClick={() => handleConfirmAction(msg.action, msg.params)}
                    >
                      Confirm & Send
                    </button>
                  </div>
                ) : (
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed border ${
                    msg.role === 'user' 
                      ? 'bg-primary/20 text-white border-primary/30 rounded-br-none' 
                      : 'bg-white/5 text-on-surface border-white/5 rounded-bl-none'
                  }`}>
                    {msg.parts[0].text}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="self-start bg-white/5 border border-white/5 px-4 py-3 rounded-2xl rounded-bl-none text-xs text-on-surface-variant/80 italic animate-pulse">
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <div className="p-4 border-t border-white/10 bg-surface-container/50 flex gap-2 shrink-0">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything or request a ride..."
              className="flex-1 px-4 py-2.5 rounded-full border border-white/10 bg-surface-base/80 text-white text-xs outline-none focus:border-primary transition-colors placeholder:text-white/20"
            />
            <button 
              className="btn-primary rounded-full w-9 h-9 flex items-center justify-center shrink-0 disabled:opacity-40 disabled:pointer-events-none transition-all duration-300"
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
export default AIChat;
