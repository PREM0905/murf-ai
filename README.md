# Work & Win - AI-Powered Productivity Assistant

A comprehensive voice-enabled productivity platform with collaborative features, built using Deepgram ASR, Murf Falcon TTS, and Groq AI for intelligent task management and social accountability.

## Key Features

###  **Advanced Voice Interface**
- **Deepgram ASR**: High-accuracy speech recognition with MediaRecorder API
- **Murf Falcon TTS**: Natural voice responses with real-time audio playback
- **Voice Commands**: Complete task/goal/habit management through speech
- **Auto-Submit**: Immediate processing after voice transcription

###  **Intelligent AI Assistant**
- **Groq LLaMA**: Fast AI inference for natural conversations
- **Personalized Communication**: Adapts to user's casual/formal style
- **Context-Aware**: Remembers recent conversations and current tasks
- **Anti-Hallucination**: Only references actual user data from database

###  **Smart Task Management**
- **Natural Language Processing**: "Add finish the report to my tasks"
- **Today-Only View**: Focus on current day with collapsible overdue section
- **Voice Completion**: "Mark report as done" - completes tasks by name
- **Priority Levels**: Organize tasks by importance

###  **Advanced Goal Tracking**
- **Credit-Based Subgoals**: Break goals into 1-10 point achievements
- **Voice Subgoal Creation**: "Add subgoal research to my project goal"
- **Progress Calculation**: Automatic percentage based on completed subgoals
- **Notebook-Style Interface**: Clean dialog for goal management

###  **Habit Building System**
- **Daily Logging**: Track habit completion with streak counting
- **Voice Logging**: "Mark exercise as done" - log habits by name
- **Visual Week View**: See completion patterns at a glance
- **Real-Time Date Integration**: Proper date handling for accurate tracking

###  **Social Accountability & Friends System**
- **Real Gmail Integration**: Search and add friends by actual email addresses
- **Friend Requests**: Send/accept/reject system with notifications
- **Collaborative Queries**: "Tell me tasks of John" - check friends' progress
- **Voice Messaging**: "Send hi to Alice" or "Remind Bob to call mom"
- **Shared Visibility**: View friends' pending tasks and active goals

###  **Messaging & Communication**
- **Voice-to-Message**: Send messages through voice commands
- **Reminder System**: "Remind [friend] to [task]" functionality
- **Message History**: View sent and received messages with timestamps
- **Real-Time Updates**: Messages appear instantly in recipient's inbox

###  **Authentication & Security**
- **Google OAuth**: Secure login with Gmail account integration
- **Demo Fallback**: Guest access for testing without Google account
- **User Registration**: Automatic database user creation
- **Environment Variables**: Secure API key management

###  **Modern UI/UX**
- **Glassmorphism Design**: Professional aesthetic with gradient backgrounds
- **Responsive Layout**: Works on desktop, tablet, and mobile
- **Dark/Light Mode**: Automatic theme switching
- **Real-Time Updates**: Live refresh of tasks, goals, and habits
- **Chat History**: Session management with folder-style organization

##  Quick Start

### 1. Install Dependencies

**Backend:**
```bash
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```


### 3. Run the Application

**Start Backend (Terminal 1):**
```bash
python web_backend.py
```

**Start Frontend (Terminal 2):**
```bash
cd frontend
npm run dev
```

### 4. Access the App
Open browser: `http://localhost:5173`

##  Voice Commands Guide

### Task Management
- **Add Tasks**: "Add finish the report to my tasks"
- **Complete Tasks**: "Mark report as done" or "Finish homework task"
- **Natural Phrases**: "I need to buy groceries" (auto-detected)

### Goal Management
- **Add Goals**: "Add winning the competition to my monthly goals"
- **Add Subgoals**: "Add subgoal research to my project goal"
- **Complete Goals**: "Mark project goal as complete"

### Habit Tracking
- **Add Habits**: "Add habit to exercise daily"
- **Log Habits**: "Mark exercise as done" or "Exercise is finished"
- **Track Progress**: Automatic streak calculation

### Friend Interaction
- **Query Friends**: "Tell me tasks of John" or "Show me goals of Alice"
- **Send Messages**: "Send hello how are you to Bob"
- **Send Reminders**: "Remind Alice to call mom"
- **Combined Queries**: "Tell me the tasks and goals of John"

### General Conversation
- **Motivation**: "Motivate me!" or "How am I doing?"
- **Status Check**: "What are my pending tasks?"
- **Help**: "What can you help me with?"

##  Tech Stack

### Backend
- **Flask**: Python web framework with async support
- **SQLite**: Persistent database with user separation
- **Deepgram API**: Speech-to-text conversion
- **Murf Falcon API**: Text-to-speech synthesis
- **Groq API**: LLaMA AI model for responses
- **aiohttp**: Async HTTP requests

### Frontend
- **React + TypeScript**: Modern component-based UI
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first styling
- **Shadcn/ui**: Professional UI components
- **MediaRecorder API**: Browser audio capture

### Database Schema
- **Users**: Gmail integration with profile data
- **Tasks**: User-specific with status and priority
- **Goals**: Progress tracking with subgoal system
- **Habits**: Streak counting and completion logs
- **Messages**: Friend-to-friend communication
- **Chat History**: Session-based conversation storage

##  Project Structure

```
work-and-win/
├── web_backend.py           # Flask server with all APIs
├── database.py              # SQLite database management
├── requirements.txt         # Python dependencies
├── .env                    # API keys (create from template)
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── VoiceInterface.tsx
│   │   │   ├── TaskList.tsx
│   │   │   ├── GoalTracker.tsx
│   │   │   ├── HabitTracker.tsx
│   │   │   ├── Friends.tsx
│   │   │   └── Login.tsx
│   │   ├── pages/          # App pages
│   │   └── lib/           # API services
│   └── package.json
└── README.md
```

##  API Endpoints

### Core Features
- `POST /api/chat` - AI conversation with voice command processing
- `POST /api/stt` - Speech-to-text conversion
- `POST /api/tts` - Text-to-speech generation

### Task Management
- `GET/POST /api/tasks` - Task CRUD operations
- `POST /api/tasks/{id}/complete` - Mark task complete

### Goal Management
- `GET/POST /api/goals` - Goal CRUD operations
- `GET/POST /api/goals/{id}/subgoals` - Subgoal management
- `POST /api/goals/{id}/subgoals/{subgoal_id}/toggle` - Toggle subgoal

### Social Features
- `POST /api/friends/search` - Search users by email
- `POST /api/friends/request` - Send friend request
- `GET /api/friends/requests` - Get pending requests
- `GET /api/messages` - Get user messages
- `GET /api/friends/{id}/tasks` - Get friend's tasks
- `GET /api/friends/{id}/goals` - Get friend's goals

##  Key Innovations

### 1. **Voice-First Design**
Unlike traditional productivity apps, Work & Win prioritizes voice interaction, making task management as natural as having a conversation.

### 2. **Social Accountability**
The friends system creates accountability through visibility - you can check on friends' progress and send encouraging messages.

### 3. **Intelligent Context**
The AI remembers your communication style and current tasks, providing personalized responses without hallucinating fake data.

### 4. **Flexible Voice Commands**
Supports natural language patterns rather than rigid commands - "I need to finish the report" works as well as "Add task finish report".

### 5. **Real-Time Collaboration**
Voice commands can query friends' data and send messages, creating a collaborative productivity environment.

## Future Enhancements

- **Mobile App**: React Native version for iOS/Android
- **Calendar Integration**: Sync with Google Calendar
- **Team Workspaces**: Shared goals and projects
- **Analytics Dashboard**: Productivity insights and trends
- **Smart Notifications**: AI-powered reminders
- **Multi-Language Support**: International accessibility
- **Video Calls**: Built-in communication features


## License

MIT License - Feel free to use, modify, and distribute!

##  Acknowledgments

- **Deepgram** for exceptional speech recognition accuracy
- **Murf AI** for natural text-to-speech capabilities  
- **Groq** for lightning-fast AI inference
- **React & TypeScript** community for excellent tooling
- **Tailwind CSS** for beautiful, utility-first styling

---

**Work & Win** - Where productivity meets social accountability through the power of voice! 