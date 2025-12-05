import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, UserPlus, Search, MessageCircle, Target, CheckSquare, Bell, Check, X } from "lucide-react";
import { apiService } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Friend {
  id: string;
  name: string;
  email: string;
  picture: string;
  status?: string;
}

const Friends = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [friendTasks, setFriendTasks] = useState<any[]>([]);
  const [friendGoals, setFriendGoals] = useState<any[]>([]);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isGoalsOpen, setIsGoalsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFriends();
    loadFriendRequests();
  }, []);

  const loadFriends = async () => {
    try {
      const response = await apiService.getFriends();
      setFriends(response.friends);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load friends",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const response = await apiService.getFriendRequests();
      setFriendRequests(response.requests);
    } catch (error) {
      console.log('Failed to load friend requests');
    }
  };

  const searchFriends = async () => {
    if (!searchEmail.trim()) return;
    
    try {
      const response = await apiService.searchFriends(searchEmail);
      setSearchResults(response.users);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to search users",
        variant: "destructive",
      });
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    try {
      await apiService.sendFriendRequest(friendId);
      toast({
        title: "Friend Request Sent",
        description: "Your friend request has been sent!",
      });
      setSearchResults([]);
      setSearchEmail("");
      setIsSearchOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive",
      });
    }
  };

  const respondToRequest = async (requestId: number, status: string) => {
    try {
      await apiService.respondToFriendRequest(requestId, status);
      toast({
        title: status === 'accepted' ? "Friend Request Accepted" : "Friend Request Rejected",
        description: status === 'accepted' ? "You are now friends!" : "Friend request rejected",
      });
      loadFriendRequests();
      if (status === 'accepted') {
        loadFriends();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to respond to friend request",
        variant: "destructive",
      });
    }
  };

  const viewFriendTasks = async (friend: Friend) => {
    try {
      setSelectedFriend(friend);
      const response = await apiService.getFriendTasks(friend.id);
      setFriendTasks(response.tasks);
      setIsTasksOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load friend's tasks",
        variant: "destructive",
      });
    }
  };

  const viewFriendGoals = async (friend: Friend) => {
    try {
      setSelectedFriend(friend);
      const response = await apiService.getFriendGoals(friend.id);
      setFriendGoals(response.goals);
      setIsGoalsOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load friend's goals",
        variant: "destructive",
      });
    }
  };

  const viewMessages = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/messages?user_id=${localStorage.getItem('user_id')}`);
      const data = await response.json();
      setMessages(data.messages || []);
      setIsMessagesOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Friends</h2>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isRequestsOpen} onOpenChange={setIsRequestsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 relative">
                <Bell className="w-4 h-4" />
                Requests
                {friendRequests.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {friendRequests.length}
                  </span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Friend Requests</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {friendRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No pending friend requests</p>
                ) : (
                  friendRequests.map((request) => (
                    <Card key={request.request_id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={request.picture} alt={request.name} className="w-10 h-10 rounded-full" />
                          <div>
                            <p className="font-medium">{request.name}</p>
                            <p className="text-sm text-muted-foreground">{request.email}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => respondToRequest(request.request_id, 'accepted')}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => respondToRequest(request.request_id, 'rejected')}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Add Friend
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Friend</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter friend's email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchFriends()}
                />
                <Button onClick={searchFriends}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Search Results:</p>
                  {searchResults.map((user) => (
                    <Card key={user.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full" />
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => sendFriendRequest(user.id)}>
                          Add Friend
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {friends.map((friend) => (
          <Card key={friend.id} className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img src={friend.picture} alt={friend.name} className="w-12 h-12 rounded-full" />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${
                    friend.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                </div>
                <div>
                  <h3 className="font-semibold">{friend.name}</h3>
                  <p className="text-sm text-muted-foreground">{friend.email}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => viewMessages()}>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Messages
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => viewFriendTasks(friend)}>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Tasks
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => viewFriendGoals(friend)}>
                  <Target className="w-4 h-4 mr-2" />
                  Goals
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {friends.length === 0 && !loading && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No friends yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add friends to collaborate on tasks and goals!
          </p>
        </div>
      )}

      {/* Friend Tasks Dialog */}
      <Dialog open={isTasksOpen} onOpenChange={setIsTasksOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedFriend?.name}'s Pending Tasks</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {friendTasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No pending tasks</p>
            ) : (
              friendTasks.map((task) => (
                <Card key={task.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">Priority: {task.priority}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(task.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Friend Goals Dialog */}
      <Dialog open={isGoalsOpen} onOpenChange={setIsGoalsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedFriend?.name}'s Active Goals</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {friendGoals.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No active goals</p>
            ) : (
              friendGoals.map((goal) => (
                <Card key={goal.id} className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{goal.title}</p>
                      <span className="text-sm text-muted-foreground">{goal.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all" 
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Messages Dialog */}
      <Dialog open={isMessagesOpen} onOpenChange={setIsMessagesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Your Messages</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No messages yet</p>
            ) : (
              messages.map((message) => (
                <Card key={message.id} className={`p-3 ${message.type === 'sent' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">
                        {message.type === 'sent' ? `To: ${message.contact_name}` : `From: ${message.contact_name}`}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{message.message}</p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Friends;