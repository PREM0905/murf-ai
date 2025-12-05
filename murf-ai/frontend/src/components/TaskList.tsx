import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Check, Circle, Trash2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiService, Task } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface TaskListRef {
  refreshTasks: () => void;
}

const TaskList = forwardRef<TaskListRef>((props, ref) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOldTasks, setShowOldTasks] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await apiService.getTasks();
      setTasks(response.tasks);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isToday = (dateString: string) => {
    const today = new Date().toDateString();
    const taskDate = new Date(dateString).toDateString();
    return today === taskDate;
  };

  const todayTasks = tasks.filter(task => isToday(task.created_at));
  const oldIncompleteTasks = tasks.filter(task => 
    !isToday(task.created_at) && task.status === 'pending'
  );

  useImperativeHandle(ref, () => ({
    refreshTasks: loadTasks
  }));

  const toggleTask = async (id: number) => {
    try {
      await apiService.completeTask(id);
      await loadTasks(); // Reload tasks
      toast({
        title: "Success",
        description: "Task completed!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete task",
        variant: "destructive",
      });
    }
  };

  const deleteTask = (id: number) => {
    // For now, just remove from local state
    // You can implement delete API endpoint later
    setTasks(tasks.filter(task => task.id !== id));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-destructive/10 text-destructive";
      case "medium": return "bg-accent text-accent-foreground";
      case "low": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Today's Tasks</h2>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTasks}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Today: {todayTasks.filter(t => t.status === 'completed').length} / {todayTasks.length} completed</span>
            <span>Pending: {todayTasks.filter(t => t.status === 'pending').length}</span>
            <span>Overdue: {oldIncompleteTasks.length}</span>
          </div>
        </div>
      </div>

      {/* Today's Tasks */}
      <div className="space-y-3">
        {todayTasks.map((task) => (
          <Card key={task.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={task.status === 'completed'}
                onCheckedChange={() => toggleTask(task.id)}
                className="w-5 h-5"
              />
              
              <div className="flex-1">
                <p className={`text-foreground ${task.status === 'completed' ? "line-through opacity-50" : ""}`}>
                  {task.title}
                </p>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                {task.priority}
              </span>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteTask(task.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Previous Days' Incomplete Tasks */}
      {oldIncompleteTasks.length > 0 && (
        <Collapsible open={showOldTasks} onOpenChange={setShowOldTasks}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full flex items-center justify-between">
              <span>Previous Days' Incomplete Tasks ({oldIncompleteTasks.length})</span>
              {showOldTasks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3">
            {oldIncompleteTasks.map((task) => (
              <Card key={task.id} className="p-4 hover:shadow-md transition-shadow bg-muted/30">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={task.status === 'completed'}
                    onCheckedChange={() => toggleTask(task.id)}
                    className="w-5 h-5"
                  />
                  
                  <div className="flex-1">
                    <p className={`text-foreground ${task.status === 'completed' ? "line-through opacity-50" : ""}`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created: {new Date(task.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTask(task.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {todayTasks.length === 0 && oldIncompleteTasks.length === 0 && (
        <div className="text-center py-12">
          <Circle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No tasks yet.</p>
        </div>
      )}
    </div>
  );
});

TaskList.displayName = "TaskList";

export default TaskList;
