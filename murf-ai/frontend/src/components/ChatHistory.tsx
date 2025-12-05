import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, MessageSquare, User, Bot, Plus, Folder, Trash2 } from "lucide-react";
import { apiService } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: number;
  user_message: string;
  ai_response: string;
  timestamp: string;
}

interface ChatSession {
  messages: ChatMessage[];
  created_at: string;
  title: string;
}

const ChatHistory = () => {
  const [sessions, setSessions] = useState<Record<string, ChatSession>>({});
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await apiService.getChatHistory();
      setSessions(response.sessions);
      
      // Select first session by default
      const sessionIds = Object.keys(response.sessions);
      if (sessionIds.length > 0 && !selectedSession) {
        setSelectedSession(sessionIds[0]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load chat history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      await apiService.newChatSession();
      toast({
        title: "New Chat Started",
        description: "You can now start a fresh conversation",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create new chat",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiService.deleteSession(sessionId);
      setSessions(prev => {
        const newSessions = { ...prev };
        delete newSessions[sessionId];
        return newSessions;
      });
      if (selectedSession === sessionId) {
        setSelectedSession(null);
      }
      toast({
        title: "Chat Deleted",
        description: "Chat session has been deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete chat session",
        variant: "destructive",
      });
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Chat History</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleNewChat}
            variant="default"
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
          <Button
            onClick={loadHistory}
            variant="outline"
            size="sm"
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Session Folders */}
        <div className="lg:col-span-1">
          <h3 className="text-lg font-semibold mb-4">Chat Sessions</h3>
          <div className="space-y-2">
            {Object.entries(sessions).map(([sessionId, session]) => (
              <Card 
                key={sessionId}
                className={`p-4 cursor-pointer transition-colors border-l-4 ${
                  selectedSession === sessionId 
                    ? 'bg-primary/5 border-primary border-l-primary' 
                    : 'hover:bg-accent border-l-transparent'
                }`}
                onClick={() => setSelectedSession(sessionId)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Folder className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground mb-1 truncate">
                      Session {sessionId.split('_')[1] ? new Date(parseInt(sessionId.split('_')[1]) * 1000).toLocaleDateString() : sessionId}
                    </p>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {session.title}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(session.created_at)}
                      </span>
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                        {session.messages?.length || 0} messages
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDeleteSession(sessionId, e)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Session Content */}
        <div className="lg:col-span-3">
          {selectedSession && sessions[selectedSession] ? (
            <div className="space-y-6">
              {/* Session Header */}
              <div className="border-b pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <Folder className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-bold text-foreground">
                    Session {selectedSession.split('_')[1] ? new Date(parseInt(selectedSession.split('_')[1]) * 1000).toLocaleDateString() : selectedSession}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{sessions[selectedSession].title}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Created: {formatTime(sessions[selectedSession].created_at)}</span>
                  <span>Messages: {sessions[selectedSession].messages?.length || 0}</span>
                </div>
              </div>
              
              {/* Messages */}
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {sessions[selectedSession].messages.map((chat) => (
                  <div key={chat.id} className="space-y-3">
                    {/* User Message */}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div className="flex-1 bg-primary/5 rounded-lg p-3">
                        <p className="text-sm font-medium text-primary mb-1">You</p>
                        <p className="text-foreground">{chat.user_message}</p>
                        <p className="text-xs text-muted-foreground mt-2">{formatTime(chat.timestamp)}</p>
                      </div>
                    </div>

                    {/* AI Response */}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-secondary-foreground" />
                      </div>
                      <div className="flex-1 bg-secondary/5 rounded-lg p-3">
                        <p className="text-sm font-medium text-secondary-foreground mb-1">Assistant</p>
                        <p className="text-foreground">{chat.ai_response}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Folder className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Select a Chat Session</h3>
              <p className="text-muted-foreground mb-4">Choose a session folder from the left to view your conversation history.</p>
              <p className="text-sm text-muted-foreground">
                Start a new conversation to create your first chat session!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHistory;