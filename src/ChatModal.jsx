import React, { useState, useEffect, useRef } from 'react';

const ChatModal = ({ isOpen, onClose, requestId, currentUser, chatPartnerName, activeChat, setActiveChat }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Map activeChat properties if passed as an object (as in Passenger/PoolHost dashboards)
  const actualIsOpen = isOpen ?? activeChat?.isOpen;
  const actualRequestId = requestId ?? activeChat?.requestId;
  const actualChatPartnerName = chatPartnerName ?? activeChat?.driverName ?? activeChat?.passengerName ?? 'Partner';
  const actualOnClose = onClose ?? (() => setActiveChat?.({ ...activeChat, isOpen: false }));

  const fetchMessages = async () => {
    if (!actualRequestId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/messages/${actualRequestId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error("Failed to fetch messages:", e);
    }
  };

  useEffect(() => {
    if (actualIsOpen && actualRequestId) {
      fetchMessages();
      const intervalId = setInterval(fetchMessages, 3000);
      return () => clearInterval(intervalId);
    }
  }, [actualIsOpen, actualRequestId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !actualRequestId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/messages/${actualRequestId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sender_id: currentUser.id,
          content: newMessage.trim()
        })
      });

      if (res.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!actualIsOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 flex items-center justify-center p-4" onClick={actualOnClose}>
      <div className="glass-panel w-full max-w-md h-[500px] p-6 rounded-xl border border-white/10 relative flex flex-col gap-4 animate-slide-in" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-4 right-4 text-on-surface-variant hover:text-white text-2xl transition-colors" onClick={actualOnClose}>&times;</button>
        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3 mb-1">
          Chat with {actualChatPartnerName}
        </h3>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-surface-base/40 rounded-lg border border-white/5">
          {messages.length === 0 ? (
            <div className="text-on-surface-variant italic text-center text-xs my-auto">
              No messages yet. Say hi!
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMine = msg.sender_id === currentUser.id;
              return (
                <div 
                  key={index} 
                  className={`max-w-[75%] p-3 rounded-xl border text-sm word-wrap break-word flex flex-col gap-1 ${
                    isMine 
                      ? 'self-end bg-primary/20 text-white border-primary/30 rounded-br-none' 
                      : 'self-start bg-white/5 text-on-surface border-white/5 rounded-bl-none'
                  }`}
                >
                  <div>{msg.content}</div>
                  <div className="text-[9px] opacity-65 text-right mt-0.5">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input 
            type="text" 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 rounded-full border border-white/10 bg-surface-base/80 text-white text-xs outline-none focus:border-primary transition-colors placeholder:text-white/20"
          />
          <button 
            type="submit" 
            disabled={loading || !newMessage.trim()}
            className="btn-primary rounded-full w-9 h-9 flex items-center justify-center shrink-0 disabled:opacity-40 disabled:pointer-events-none transition-all duration-300"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
export default ChatModal;
