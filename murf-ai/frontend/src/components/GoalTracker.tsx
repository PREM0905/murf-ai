import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, RefreshCw, Plus, Minus, Check, X, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiService, Goal } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface SubGoal {
  id: number;
  title: string;
  completed: boolean;
  credits: number;
}

const GoalTracker = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [newSubGoalCredits, setNewSubGoalCredits] = useState(1);
  const [subGoals, setSubGoals] = useState<SubGoal[]>([]);
  const [newSubGoal, setNewSubGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [completingGoals, setCompletingGoals] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const response = await apiService.getGoals();
      // Only show incomplete goals
      setGoals(response.goals.filter(goal => goal.progress < 100));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load goals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (goalId: number, progress: number) => {
    try {
      await apiService.updateGoalProgress(goalId, progress);
      setGoals(goals.map(goal => 
        goal.id === goalId ? { ...goal, progress } : goal
      ));
      toast({
        title: "Progress Updated",
        description: `Goal progress updated to ${progress}%`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update progress",
        variant: "destructive",
      });
    }
  };

  const markGoalComplete = async (goalId: number) => {
    setCompletingGoals(prev => new Set(prev).add(goalId));
    await updateProgress(goalId, 100);
    
    // Remove goal after animation
    setTimeout(() => {
      setGoals(goals => goals.filter(goal => goal.id !== goalId));
      setCompletingGoals(prev => {
        const newSet = new Set(prev);
        newSet.delete(goalId);
        return newSet;
      });
    }, 500);
  };

  const openProgressDialog = async (goal: Goal) => {
    setSelectedGoal(goal);
    
    try {
      const [subGoalsResponse, notesResponse] = await Promise.all([
        apiService.getSubGoals(goal.id),
        apiService.getGoalNotes(goal.id)
      ]);
      setSubGoals(subGoalsResponse.subGoals || []);
      setNotes(notesResponse.notes || "");
    } catch (error) {
      setSubGoals([]);
      setNotes("");
    }
  };

  const addSubGoal = async () => {
    if (!newSubGoal.trim() || !selectedGoal) return;
    
    try {
      const response = await apiService.addSubGoal(selectedGoal.id, newSubGoal, 1);
      setSubGoals([...subGoals, response.subGoal]);
      setNewSubGoal("");
      toast({
        title: "Sub-goal Added",
        description: "Sub-goal added with 1 credit",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add sub-goal",
        variant: "destructive",
      });
    }
  };

  const toggleSubGoal = async (subGoalId: number) => {
    if (!selectedGoal) return;
    
    try {
      await apiService.toggleSubGoal(selectedGoal.id, subGoalId);
      setSubGoals(subGoals.map(sg => 
        sg.id === subGoalId ? { ...sg, completed: !sg.completed } : sg
      ));
      
      // Auto-calculate progress based on completed sub-goals with credits
      const updatedSubGoals = subGoals.map(sg => 
        sg.id === subGoalId ? { ...sg, completed: !sg.completed } : sg
      );
      const totalCredits = updatedSubGoals.reduce((sum, sg) => sum + sg.credits, 0);
      const completedCredits = updatedSubGoals.filter(sg => sg.completed).reduce((sum, sg) => sum + sg.credits, 0);
      const newAutoProgress = totalCredits > 0 ? Math.round((completedCredits / totalCredits) * 100) : 0;
      
      await updateProgress(selectedGoal.id, newAutoProgress);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update sub-goal",
        variant: "destructive",
      });
    }
  };

  const saveNotes = async () => {
    if (!selectedGoal) return;
    
    try {
      await apiService.updateGoalNotes(selectedGoal.id, notes);
      toast({
        title: "Notes Saved",
        description: "Your notes have been saved",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive",
      });
    }
  };

  const updateSubGoalCredits = (subGoalId: number, newCredits: number) => {
    setSubGoals(subGoals.map(sg => 
      sg.id === subGoalId ? { ...sg, credits: newCredits } : sg
    ));
    
    // Recalculate progress with new credits
    const updatedSubGoals = subGoals.map(sg => 
      sg.id === subGoalId ? { ...sg, credits: newCredits } : sg
    );
    const totalCredits = updatedSubGoals.reduce((sum, sg) => sum + sg.credits, 0);
    const completedCredits = updatedSubGoals.filter(sg => sg.completed).reduce((sum, sg) => sum + sg.credits, 0);
    const newAutoProgress = totalCredits > 0 ? Math.round((completedCredits / totalCredits) * 100) : 0;
    
    if (selectedGoal) {
      updateProgress(selectedGoal.id, newAutoProgress);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-8 h-8 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Monthly Goals</h2>
        </div>
        <Button
          onClick={loadGoals}
          variant="outline"
          size="sm"
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {goals.map((goal) => (
          <Card 
            key={goal.id} 
            className={`p-6 hover:shadow-lg transition-all duration-500 ${
              completingGoals.has(goal.id) 
                ? 'transform translate-y-full opacity-0 scale-95' 
                : 'transform translate-y-0 opacity-100 scale-100'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">{goal.title}</h3>
                  <p className="text-sm text-muted-foreground">{goal.description || 'Personal Goal'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {goal.progress < 100 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markGoalComplete(goal.id)}
                      className="p-2"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openProgressDialog(goal)}
                        className="p-1 h-auto"
                      >
                        <TrendingUp className="w-5 h-5 text-primary hover:text-primary/80" />
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden border-0 shadow-none bg-transparent p-0">
                    {/* Header */}
                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-t-lg border-b">
                      {/* Binding Dots */}
                      <div className="flex justify-center gap-6 mb-4">
                        {[...Array(10)].map((_, i) => (
                          <div key={i} className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600" />
                        ))}
                      </div>
                      
                      {/* Goal Title */}
                      <h2 className="text-foreground text-xl font-semibold text-center mb-3">{goal.title}</h2>
                      <div className="flex items-center gap-3">
                        <Progress value={goal.progress} className="h-1 flex-1" />
                        <span className="text-muted-foreground text-xs font-medium">{goal.progress}%</span>
                      </div>
                    </div>
                    
                    {/* Content Pages */}
                    <div className="flex bg-gray-50 dark:bg-gray-900">
                      {/* Left Page - Sub-Goals */}
                      <div className="flex-1 bg-card relative rounded-bl-lg border-r">
                        {/* Subtle Lines */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_23px,rgba(0,0,0,0.05)_24px)] dark:bg-[linear-gradient(to_bottom,transparent_23px,rgba(255,255,255,0.05)_24px)] bg-[length:100%_24px] pointer-events-none" />
                        
                        <div className="p-6 relative z-10">
                          <h3 className="text-foreground font-semibold mb-4 text-lg">
                            Sub-Goals
                          </h3>
                      

                      
                          {/* Add Sub-Goal */}
                          <div className="bg-muted/50 rounded-lg p-3 mb-4 border">
                            <div className="flex items-center gap-2">
                              <Input
                                placeholder="Add milestone..."
                                value={newSubGoal}
                                onChange={(e) => setNewSubGoal(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addSubGoal()}
                                className="border-0 bg-transparent flex-1"
                              />
                              <Button onClick={addSubGoal} size="sm">
                                Add
                              </Button>
                            </div>
                          </div>
                        
                          {/* Sub-Goals List */}
                          <div className="space-y-2 max-h-80 overflow-y-auto">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-foreground font-medium">Progress</span>
                              <span className="text-muted-foreground text-sm">
                                {subGoals.filter(sg => sg.completed).reduce((sum, sg) => sum + sg.credits, 0)}/{subGoals.reduce((sum, sg) => sum + sg.credits, 0)} pts
                              </span>
                            </div>
                            
                            {subGoals.map((subGoal) => (
                              <div key={subGoal.id} className="flex items-center gap-3 py-2 px-3 rounded-lg border bg-background/50">
                                <Checkbox
                                  checked={subGoal.completed}
                                  onCheckedChange={() => toggleSubGoal(subGoal.id)}
                                />
                                <span className={`flex-1 text-sm ${
                                  subGoal.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                                }`}>
                                  {subGoal.title}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => updateSubGoalCredits(subGoal.id, Math.max(1, subGoal.credits - 1))} 
                                    className="h-5 w-5 p-0"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground min-w-[24px] text-center">
                                    {subGoal.credits}
                                  </span>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => updateSubGoalCredits(subGoal.id, Math.min(10, subGoal.credits + 1))} 
                                    className="h-5 w-5 p-0"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            
                            {subGoals.length === 0 && (
                              <div className="text-center py-8 text-muted-foreground">
                                <p className="text-sm">No milestones yet</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Right Page - Notes */}
                      <div className="flex-1 bg-card relative rounded-br-lg">
                        {/* Subtle Lines */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_23px,rgba(0,0,0,0.05)_24px)] dark:bg-[linear-gradient(to_bottom,transparent_23px,rgba(255,255,255,0.05)_24px)] bg-[length:100%_24px] pointer-events-none" />
                        
                        <div className="p-6 relative z-10">
                          <h3 className="text-foreground font-semibold mb-4 text-lg">
                            Notes & Ideas
                          </h3>
                          
                          <Textarea
                            placeholder="Write your thoughts and strategies here..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={15}
                            className="border-0 bg-transparent resize-none leading-6"
                            style={{ lineHeight: '24px' }}
                          />
                          
                          <Button onClick={saveNotes} className="w-full mt-4">
                            Save Notes
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className={`font-medium ${goal.progress === 100 ? 'text-green-600' : 'text-foreground'}`}>
                    {goal.progress === 100 ? '✓ Complete' : `${goal.progress}%`}
                  </span>
                </div>
                <Progress value={goal.progress} className="h-2" />
              </div>

              <p className="text-xs text-muted-foreground">
                {goal.target_date ? `Deadline: ${new Date(goal.target_date).toLocaleDateString()}` : 'No deadline set'}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default GoalTracker;
