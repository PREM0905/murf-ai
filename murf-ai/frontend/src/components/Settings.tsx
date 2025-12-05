import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const [checkInInterval, setCheckInInterval] = useState<string>("5");
  const { toast } = useToast();

  useEffect(() => {
    // Load saved interval from localStorage
    const savedInterval = localStorage.getItem('checkInInterval');
    if (savedInterval) {
      setCheckInInterval(savedInterval);
    }
  }, []);

  const handleIntervalChange = (value: string) => {
    setCheckInInterval(value);
    localStorage.setItem('checkInInterval', value);
    
    // Dispatch custom event to notify VoiceInterface
    window.dispatchEvent(new CustomEvent('checkInIntervalChanged', { 
      detail: { interval: parseInt(value) } 
    }));
    
    toast({
      title: "Settings Updated",
      description: `Check-in interval set to ${value} minutes`,
    });
  };

  const intervalOptions = [
    { value: "1", label: "1 minute" },
    { value: "2", label: "2 minutes" },
    { value: "5", label: "5 minutes" },
    { value: "10", label: "10 minutes" },
    { value: "15", label: "15 minutes" },
    { value: "30", label: "30 minutes" },
    { value: "60", label: "1 hour" },
    { value: "120", label: "2 hours" },
    { value: "180", label: "3 hours" },
    { value: "240", label: "4 hours" },
    { value: "360", label: "6 hours" },
    { value: "480", label: "8 hours" },
    { value: "720", label: "12 hours" },
    { value: "1440", label: "24 hours" },
    { value: "0", label: "Disabled" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-8 h-8 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">AI Check-in Frequency</h3>
          </div>
          
          <p className="text-sm text-muted-foreground">
            How often should your AI friend check in about your pending tasks?
          </p>
          
          <div className="flex items-center gap-4">
            <Select value={checkInInterval} onValueChange={handleIntervalChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                {intervalOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-xs text-muted-foreground">
            {checkInInterval === "0" 
              ? "Proactive check-ins are disabled. Your AI friend will only respond when you message first."
              : `Your AI friend will check in every ${intervalOptions.find(opt => opt.value === checkInInterval)?.label.toLowerCase()} if you have pending tasks.`
            }
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;