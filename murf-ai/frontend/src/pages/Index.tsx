import { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import VoiceInterface from "@/components/VoiceInterface";
import TaskList, { TaskListRef } from "@/components/TaskList";
import GoalTracker from "@/components/GoalTracker";
import HabitTracker, { HabitTrackerRef } from "@/components/HabitTracker";
import heroImage from "@/assets/hero-voice.jpg";
import { Card } from "@/components/ui/card";
import { apiService } from "@/lib/api";

const Index = () => {
  const taskListRef = useRef<TaskListRef>(null);
  const habitTrackerRef = useRef<HabitTrackerRef>(null);
  const [stats, setStats] = useState({
    completedTasks: 0,
    pendingTasks: 0,
    activeGoals: 0
  });

  const handleTaskAdded = () => {
    taskListRef.current?.refreshTasks();
    loadStats(); // Also refresh stats
  };

  const handleHabitAdded = () => {
    habitTrackerRef.current?.refreshHabits();
  };

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [tasksResponse, goalsResponse] = await Promise.all([
        apiService.getTasks(),
        apiService.getGoals()
      ]);
      
      const isToday = (dateString: string) => {
        const today = new Date().toDateString();
        const taskDate = new Date(dateString).toDateString();
        return today === taskDate;
      };
      
      const todayTasks = tasksResponse.tasks.filter(task => isToday(task.created_at));
      const completedTasks = todayTasks.filter(task => task.status === 'completed').length;
      const pendingTasks = todayTasks.filter(task => task.status === 'pending').length;
      const activeGoals = goalsResponse.goals.filter(goal => goal.progress < 100).length;
      
      setStats({ completedTasks, pendingTasks, activeGoals });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  return (
    <Layout>
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Work & Win
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Your AI-powered productivity companion with voice intelligence, collaborative features, and personalized accountability
        </p>
      </div>

      {/* Voice Interface */}
      <Card className="p-8 mb-8">
        <VoiceInterface onTaskAdded={handleTaskAdded} onHabitAdded={handleHabitAdded} />
      </Card>

      {/* Quick Overview Grid */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card className="p-6">
          <TaskList ref={taskListRef} />
        </Card>
        <Card className="p-6">
          <GoalTracker />
        </Card>
      </div>

      {/* Habit Tracker */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card className="p-6">
          <HabitTracker ref={habitTrackerRef} />
        </Card>
        <div className="hidden lg:block">
          {/* Empty space for balance */}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-6 text-center">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
            {stats.completedTasks}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Tasks Completed</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
            {stats.pendingTasks}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Tasks Pending</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            {stats.activeGoals}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Active Goals</div>
        </Card>
      </div>
    </Layout>
  );
};

export default Index;