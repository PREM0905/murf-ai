import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Check, X, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiService, Habit } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface HabitTrackerRef {
  refreshHabits: () => void;
}

const HabitTracker = forwardRef<HabitTrackerRef>((props, ref) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadHabits();
  }, []);

  const loadHabits = async () => {
    try {
      setLoading(true);
      const response = await apiService.getHabits();
      setHabits(response.habits);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load habits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refreshHabits: loadHabits
  }));

  const handleAddHabit = async () => {
    if (!newHabitName.trim()) return;
    
    setIsSubmitting(true);
    try {
      await apiService.createHabit(newHabitName.trim());
      setNewHabitName("");
      setIsDialogOpen(false);
      await loadHabits();
      toast({
        title: "Success",
        description: "Habit added successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add habit",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogHabit = async (habitId: number) => {
    try {
      await apiService.logHabit(habitId);
      await loadHabits();
      toast({
        title: "Success",
        description: "Habit logged!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log habit",
        variant: "destructive",
      });
    }
  };

  const handleDeleteHabit = async (habitId: number) => {
    try {
      await apiService.deleteHabit(habitId);
      setHabits(habits.filter(habit => habit.id !== habitId));
      toast({
        title: "Success",
        description: "Habit removed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete habit",
        variant: "destructive",
      });
    }
  };

  const generateWeekData = (habit: any) => {
    const today = new Date();
    const weekData = [];
    const weekDays = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      const isCompleted = habit.recent_logs && habit.recent_logs.includes(dateStr);
      weekData.push(isCompleted);
      weekDays.push(dayName);
    }
    
    return { weekData, weekDays };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Habit Tracker</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Habit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Habit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Enter habit name (e.g., Exercise, Read, Meditate)"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddHabit()}
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleAddHabit} 
                  disabled={!newHabitName.trim() || isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? "Adding..." : "Add Habit"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {habits.map((habit) => (
          <Card key={habit.id} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-primary mb-1">{habit.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {habit.streak} day streak
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => handleLogHabit(habit.id)}
                  size="sm"
                  disabled={(habit as any).completed_today}
                  variant={(habit as any).completed_today ? "secondary" : "default"}
                  className="flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {(habit as any).completed_today ? "Done Today" : "Log Today"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteHabit(habit.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              {(() => {
                const { weekData, weekDays } = generateWeekData(habit);
                return weekData.map((completed, index) => (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center gap-2"
                  >
                    <span className="text-xs text-muted-foreground">{weekDays[index]}</span>
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                        completed
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {completed ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <X className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                ));
              })()
            }</div>
          </Card>
        ))}
        {habits.length === 0 && (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto text-muted-foreground mb-4">📊</div>
            <p className="text-muted-foreground">No habits yet.</p>
          </div>
        )}
      </div>
    </div>
  );
});

HabitTracker.displayName = "HabitTracker";

export default HabitTracker;
