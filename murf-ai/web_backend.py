from flask import Flask, request, jsonify
from flask_cors import CORS
import asyncio
import aiohttp
import os
import base64
from datetime import datetime
from dotenv import load_dotenv
import tempfile
from database import Database

load_dotenv()

app = Flask(__name__)
CORS(app)

class WebBackend:
    def __init__(self):
        self.deepgram_key = os.getenv('DEEPGRAM_API_KEY')
        self.murf_key = os.getenv('MURF_API_KEY')
        self.groq_key = os.getenv('GROQ_API_KEY')
        self.db = Database()
        
        # Check if API keys are loaded
        if not self.deepgram_key:
            print("WARNING: DEEPGRAM_API_KEY not found in environment")
        if not self.groq_key:
            print("WARNING: GROQ_API_KEY not found in environment")
        
        # Keep some in-memory storage for compatibility
        self.habit_logs = {}  # habitId -> [dates]
        self.goal_notes = {}  # goalId -> notes
        self.current_session_id = None
        self.current_user_id = "demo123"  # Default user
    
    def analyze_user_personality(self, user_id):
        """Analyze chat history to understand user's communication style"""
        recent_messages = self.db.get_recent_chat_history(user_id, 20)
        
        if not recent_messages:
            return "friendly and encouraging"
        
        # Check for casual vs formal language
        casual_words = ['hey', 'hi', 'thanks', 'cool', 'awesome', 'great']
        formal_words = ['please', 'thank you', 'could you', 'would you']
        
        casual_count = sum(1 for msg, _, _ in recent_messages for word in casual_words if word in msg.lower())
        formal_count = sum(1 for msg, _, _ in recent_messages for word in formal_words if word in msg.lower())
        
        if casual_count > formal_count:
            return "casual and friendly"
        elif formal_count > casual_count:
            return "professional and respectful"
        else:
            return "balanced and supportive"
    

    
    async def get_ai_response(self, text, user_id="demo123"):
        try:
            # Check for task creation commands with natural language
            text_lower = text.lower()
            print(f"Processing text: {text_lower}")
            
            # Get user's communication style and recent context
            personality_style = self.analyze_user_personality(user_id)
            recent_history = self.db.get_recent_chat_history(user_id, 5)
            
            # Check if user is asking for general help or greeting
            greeting_words = ['hello', 'hi', 'hey', 'how are you', 'what\'s up', 'good morning', 'good afternoon']
            is_greeting = any(word in text_lower for word in greeting_words)
            
            # Check for subgoal creation FIRST - simpler pattern matching
            if any(phrase in text_lower for phrase in ['add subgoal', 'add sub goal', 'create subgoal', 'create sub goal']):
                print(f"SUBGOAL DETECTED: {text_lower}")
                
                # Pattern: "add subgoal X to Y"
                if ' to ' in text_lower:
                    parts = text_lower.rsplit(' to ', 1)
                    if len(parts) == 2:
                        left_part = parts[0].strip()
                        goal_reference = parts[1].strip()
                        
                        # Extract subgoal content
                        subgoal_content = left_part
                        for prefix in ['add subgoal ', 'add sub goal ']:
                            if subgoal_content.startswith(prefix):
                                subgoal_content = subgoal_content[len(prefix):].strip()
                                break
                        
                        # Clean goal reference
                        goal_reference = goal_reference.replace(' goal', '').replace('my ', '').replace('the ', '').strip()
                        
                        # Find matching goal
                        target_goal = None
                        user_goals = self.db.get_goals(user_id)
                        if goal_reference and user_goals:
                            for goal in user_goals:
                                if goal_reference.lower() in goal['title'].lower():
                                    target_goal = goal
                                    break
                            if not target_goal:
                                target_goal = user_goals[0]
                        elif user_goals:
                            target_goal = user_goals[0]
                        
                        if target_goal and subgoal_content:
                            subgoal_id = self.db.add_subgoal(target_goal['id'], subgoal_content)
                            return f"Great! Added '{subgoal_content}' to your '{target_goal['title']}' goal!"
                        else:
                            return "Try saying 'Add subgoal [name] to [goal]'."
                else:
                    # Handle "add subgoal X" without "to goal" - use most recent goal
                    subgoal_content = text_lower.replace('add subgoal ', '').replace('add sub goal ', '').strip()
                    user_goals = self.db.get_goals(user_id)
                    if user_goals and subgoal_content:
                        target_goal = user_goals[0]
                        subgoal_id = self.db.add_subgoal(target_goal['id'], subgoal_content)
                        return f"Great! Added '{subgoal_content}' to your '{target_goal['title']}' goal!"
                    else:
                        return "Try saying 'Add subgoal [name] to [goal]'."
            
            # Check for goal creation BEFORE task detection
            elif any(keyword in text_lower for keyword in ['to my goals', 'to my monthly goals', 'monthly goal', 'add goal', 'set goal', 'new goal', 'goal to', 'my goal is']):
                goal_keywords = ['add goal', 'set goal', 'new goal', 'to my goals', 'to my monthly goals', 'monthly goal', 'goal to', 'my goal is']
                goal_title = text_lower
                for keyword in goal_keywords:
                    goal_title = goal_title.replace(keyword, '').strip()
                # Clean up common words
                goal_title = goal_title.replace('add ', '').replace('set ', '').strip()
                
                if goal_title:
                    goal_id = self.db.add_goal(user_id, goal_title)
                    return f"Awesome! I've set '{goal_title}' as your goal. Let's work towards it together!"
            
            # Strict task detection patterns - only explicit task creation (excluding goal patterns)
            task_patterns = [
                ('add task', ''),
                ('create task', ''),
                ('new task', ''),
                ('to my tasks', ''),
                ('to my task list', ''),
                ('to the task list', ''),
                ('as a task', ''),
                ('on my todo', ''),
                ('on my to-do', ''),
                ('in my tasks', ''),
                ('add this task', ''),
                ('put this on my list', ''),
                ('add to list', ''),
                ('to my today\'s task', ''),
                ('to today\'s task', ''),
                ('to my task', ''),
                ('to task', '')
            ]
            
            # Check if any task pattern matches
            task_detected = False
            task_title = text_lower
            
            # Patterns that indicate task addition with content before them
            end_patterns = ['to my tasks', 'to my task list', 'to the task list', 'as a task', 'on my todo', 'on my to-do', 'in my tasks', 'to list', 'to my today\'s task', 'to today\'s task', 'to my task', 'to task']
            
            # First check end patterns (higher priority) but exclude goal patterns
            goal_indicators = ['monthly goals', 'my goals', 'goal']
            for pattern in end_patterns:
                if pattern in text_lower and not any(goal_word in text_lower for goal_word in goal_indicators):
                    task_detected = True
                    # Extract everything before the pattern
                    task_title = text_lower.split(pattern)[0].strip()
                    # Clean up common prefixes
                    prefixes_to_remove = ['add ', 'put ', 'create ', 'make ', 'set ']
                    for prefix in prefixes_to_remove:
                        if task_title.startswith(prefix):
                            task_title = task_title[len(prefix):].strip()
                            break
                    print(f"Task detected with end pattern '{pattern}': '{task_title}'")
                    break
            
            # Then check other patterns
            if not task_detected:
                for pattern, replacement in task_patterns:
                    if pattern in text_lower and pattern not in end_patterns:
                        task_detected = True
                        task_title = task_title.replace(pattern, replacement).strip()
                        print(f"Task detected with pattern '{pattern}': '{task_title}'")
                        break
            
            # Also detect sentences that sound like tasks (verbs at start)
            task_verbs = ['finish', 'complete', 'write', 'read', 'study', 'call', 'email', 'buy', 'get', 'pick up', 'drop off', 'submit', 'send', 'review', 'check', 'update', 'fix', 'clean', 'organize', 'prepare', 'schedule', 'book', 'pay', 'visit', 'meet', 'attend', 'practice', 'exercise', 'work on', 'start', 'begin', 'learn', 'research', 'download', 'install', 'backup', 'delete', 'upload', 'share', 'post', 'publish', 'edit', 'design', 'create', 'build', 'make', 'cook', 'wash', 'fold', 'vacuum', 'mop', 'dust', 'water', 'feed', 'walk']
            
            # Only detect "add [verb]ing" patterns - more specific
            if not task_detected and text_lower.startswith('add '):
                remaining_text = text_lower[4:].strip()
                for verb in task_verbs:
                    if remaining_text.startswith(verb + 'ing ') or remaining_text.startswith(verb + ' '):
                        task_detected = True
                        task_title = remaining_text
                        print(f"Task detected with 'add + verb' pattern: '{task_title}'")
                        break
            
            if task_detected and task_title.strip():
                # Clean up the task title
                task_title = task_title.strip()
                if task_title:
                    # Add task to database
                    task_id = self.db.add_task(user_id, task_title)
                    return f"Great! I've added '{task_title}' to your tasks. You've got this!"
            

            
            # Check for completion commands with item names - multiple phrase variations (but not subgoal creation)
            elif not any(phrase in text_lower for phrase in ['add subgoal', 'add sub goal', 'create subgoal']) and (any(phrase in text_lower for phrase in ['mark ', 'complete ', 'finish ', 'done with ', 'finished ', 'completed ', 'check off ', 'cross off ', ' as done', ' as complete']) or any(pattern in text_lower for pattern in [' is done', ' is complete', ' is finished', ' finished', ' completed'])):
                # Extract item name from various command patterns
                item_name = ""
                
                # Special handling for "X as done/complete"
                if ' as done' in text_lower:
                    item_name = text_lower.split(' as done')[0].replace('mark ', '').strip()
                elif ' as complete' in text_lower:
                    item_name = text_lower.split(' as complete')[0].replace('mark ', '').strip()
                else:
                    # Pattern: "mark X done/complete/finished"
                    for prefix in ['mark ', 'complete ', 'finish ', 'check off ', 'cross off ']:
                        if prefix in text_lower:
                            start = text_lower.find(prefix) + len(prefix)
                            for end_word in [' done', ' complete', ' finished', ' task', ' habit', ' goal']:
                                if end_word in text_lower[start:]:
                                    end = text_lower.find(end_word, start)
                                    item_name = text_lower[start:end].strip()
                                    break
                            if not item_name:  # No end word found, take rest of string
                                item_name = text_lower[start:].strip()
                            break
                
                # Pattern: "done with X", "finished X", "I have finished X"
                for prefix in ['done with ', 'finished with ', 'completed ', 'i have finished ', 'i finished ', 'i completed ', 'i have completed ']:
                    if prefix in text_lower and not item_name:
                        start = text_lower.find(prefix) + len(prefix)
                        item_name = text_lower[start:].strip()
                        break
                
                # Pattern: "X is done/complete/finished"
                for suffix in [' is done', ' is complete', ' is finished']:
                    if suffix in text_lower and not item_name:
                        end = text_lower.find(suffix)
                        item_name = text_lower[:end].strip()
                        # Remove "I have" or "I" from the beginning
                        item_name = item_name.replace('i have ', '').replace('i ', '').strip()
                        break
                
                # Clean up item name
                item_name = item_name.replace(' task', '').replace(' habit', '').replace(' goal', '').replace(' subgoal', '').replace('my ', '').replace('the ', '').strip()
                
                if item_name:
                    # Try to find matching task
                    user_tasks = self.db.get_tasks(user_id)
                    for task in user_tasks:
                        if task['status'] == 'pending' and item_name.lower() in task['title'].lower():
                            self.db.complete_task(task['id'])
                            return f"Great job! Marked '{task['title']}' as complete!"
                    
                    # Try to find matching habit
                    user_habits = self.db.get_habits(user_id)
                    for habit in user_habits:
                        if item_name.lower() in habit['name'].lower():
                            from datetime import datetime
                            today = datetime.now().strftime('%Y-%m-%d')
                            if habit['id'] not in backend.habit_logs:
                                backend.habit_logs[habit['id']] = []
                            if today not in backend.habit_logs[habit['id']]:
                                backend.habit_logs[habit['id']].append(today)
                                day_name = datetime.now().strftime('%A')
                                return f"Perfect! Marked '{habit['name']}' as done for {day_name}!"
                            else:
                                day_name = datetime.now().strftime('%A')
                                return f"You've already completed '{habit['name']}' today ({day_name})!"
                    
                    # Try to find matching goal
                    user_goals = self.db.get_goals(user_id)
                    for goal in user_goals:
                        if goal['progress'] < 100 and item_name.lower() in goal['title'].lower():
                            self.db.complete_goal(goal['id'])
                            return f"Awesome! Marked '{goal['title']}' as accomplished!"
                    
                    # Try to find matching subgoal
                    for goal in user_goals:
                        subgoals = self.db.get_subgoals(goal['id'])
                        for subgoal in subgoals:
                            if not subgoal['completed'] and item_name.lower() in subgoal['title'].lower():
                                self.db.toggle_subgoal(goal['id'], subgoal['id'])
                                return f"Excellent! Marked '{subgoal['title']}' as complete!"
                    
                    return f"Couldn't find '{item_name}' in your tasks, habits, goals, or subgoals."
                else:
                    return "Please specify what you want to mark as done."
            
            # Check for friend queries FIRST
            elif any(phrase in text_lower for phrase in ['tell me', 'show me', 'what are']) and any(word in text_lower for word in ['tasks', 'goals']) and 'of' in text_lower:
                # Extract friend name from patterns like "tell me tasks of John" or "show me goals of Alice"
                friend_name = ""
                if 'tasks of ' in text_lower:
                    friend_name = text_lower.split('tasks of ')[1].strip()
                elif 'goals of ' in text_lower:
                    friend_name = text_lower.split('goals of ')[1].strip()
                elif ' of ' in text_lower:
                    friend_name = text_lower.split(' of ')[1].strip()
                
                # Clean friend name
                friend_name = friend_name.replace('my friend ', '').replace('friend ', '').replace('.', '').strip()
                
                if friend_name:
                    # Find friend by name (supports first name matching)
                    target_friend = self.db.get_friend_by_name(user_id, friend_name)
                    
                    if target_friend:
                        # Check if asking for both tasks and goals
                        if ('task' in text_lower and 'goal' in text_lower) or ('goals and tasks' in text_lower) or ('tasks and goals' in text_lower):
                            # Get both tasks and goals
                            friend_tasks = self.db.get_tasks(target_friend['id'])
                            pending_tasks = [task for task in friend_tasks if task['status'] == 'pending']
                            friend_goals = self.db.get_goals(target_friend['id'])
                            incomplete_goals = [goal for goal in friend_goals if goal['progress'] < 100]
                            
                            response_parts = []
                            if pending_tasks:
                                task_list = ', '.join([task['title'] for task in pending_tasks[:3]])
                                response_parts.append(f"{len(pending_tasks)} pending tasks: {task_list}{'...' if len(pending_tasks) > 3 else ''}")
                            else:
                                response_parts.append("no pending tasks")
                            
                            if incomplete_goals:
                                goal_list = ', '.join([f"{goal['title']} ({goal['progress']}%)" for goal in incomplete_goals[:3]])
                                response_parts.append(f"{len(incomplete_goals)} active goals: {goal_list}{'...' if len(incomplete_goals) > 3 else ''}")
                            else:
                                response_parts.append("no active goals")
                            
                            return f"{target_friend['name']} has {' and '.join(response_parts)}."
                        
                        elif 'task' in text_lower:
                            # Get friend's pending tasks
                            friend_tasks = self.db.get_tasks(target_friend['id'])
                            pending_tasks = [task for task in friend_tasks if task['status'] == 'pending']
                            if pending_tasks:
                                task_list = ', '.join([task['title'] for task in pending_tasks[:5]])
                                return f"{target_friend['name']} has {len(pending_tasks)} pending tasks: {task_list}{'...' if len(pending_tasks) > 5 else ''}"
                            else:
                                return f"{target_friend['name']} has no pending tasks right now."
                        elif 'goal' in text_lower:
                            # Get friend's incomplete goals
                            friend_goals = self.db.get_goals(target_friend['id'])
                            incomplete_goals = [goal for goal in friend_goals if goal['progress'] < 100]
                            if incomplete_goals:
                                goal_list = ', '.join([f"{goal['title']} ({goal['progress']}%)" for goal in incomplete_goals[:3]])
                                return f"{target_friend['name']} has {len(incomplete_goals)} active goals: {goal_list}{'...' if len(incomplete_goals) > 3 else ''}"
                            else:
                                return f"{target_friend['name']} has no active goals right now."
                    else:
                        return f"I couldn't find a friend named '{friend_name}' in your friends list."
                else:
                    return "Please specify which friend you want to know about."
            
            # Check for message sending commands
            elif any(phrase in text_lower for phrase in ['send', 'message', 'remind']) and 'to' in text_lower:
                import re
                
                # Pattern: "send [message] to [friend]"
                if 'send' in text_lower and ' to ' in text_lower:
                    parts = text_lower.split(' to ', 1)
                    if len(parts) == 2:
                        message_part = parts[0].replace('send ', '').replace('message ', '').strip()
                        friend_part = parts[1].strip()
                        
                        # Clean friend name
                        friend_name = friend_part.replace('my friend ', '').replace('friend ', '').replace('.', '').strip()
                        
                        if message_part and friend_name:
                            target_friend = self.db.get_friend_by_name(user_id, friend_name)
                            if target_friend:
                                message_id = self.db.send_message(user_id, target_friend['id'], message_part)
                                return f"Message sent to {target_friend['name']}: '{message_part}'"
                            else:
                                return f"I couldn't find a friend named '{friend_name}' in your friends list."
                
                # Pattern: "remind [friend] to [task]"
                elif 'remind' in text_lower and ' to ' in text_lower:
                    parts = text_lower.split(' to ', 1)
                    if len(parts) == 2:
                        friend_part = parts[0].replace('remind ', '').strip()
                        task_part = parts[1].strip()
                        
                        # Clean friend name
                        friend_name = friend_part.replace('my friend ', '').replace('friend ', '').replace('.', '').strip()
                        
                        if friend_name and task_part:
                            target_friend = self.db.get_friend_by_name(user_id, friend_name)
                            if target_friend:
                                reminder_message = f"Reminder: {task_part}"
                                message_id = self.db.send_message(user_id, target_friend['id'], reminder_message)
                                return f"Reminder sent to {target_friend['name']}: '{task_part}'"
                            else:
                                return f"I couldn't find a friend named '{friend_name}' in your friends list."
            
            # Check for habit creation with more patterns
            elif any(keyword in text_lower for keyword in ['add habit', 'new habit', 'track habit', 'start habit', 'build habit', 'habit of', 'to my habits', 'add playing', 'add exercising', 'add reading']):
                print(f"Habit detected in: {text_lower}")
                
                habit_keywords = ['add habit', 'new habit', 'track habit', 'start habit', 'build habit', 'habit of', 'to my habits', 'add ', 'track ']
                habit_name = text_lower
                
                for keyword in habit_keywords:
                    habit_name = habit_name.replace(keyword, '').strip()
                
                # Clean up common words
                habit_name = habit_name.replace('my ', '').replace('the ', '').strip()
                
                if habit_name:
                    habit_id = self.db.add_habit(user_id, habit_name)
                    print(f"Added habit: {habit_name}")
                    return f"Perfect! I've added '{habit_name}' to your habits. Consistency is key!"
            
            # Regular AI response
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.groq_key}",
                "Content-Type": "application/json"
            }
            # Create personalized system prompt with context
            system_prompt = f"You are a close friend and accountability partner. Your communication style should be {personality_style}. "
            
            if personality_style == "casual and friendly":
                system_prompt += "Use casual language, contractions, and be enthusiastic. Say things like 'awesome!', 'you got this!', 'nice work!'"
            elif personality_style == "professional and respectful":
                system_prompt += "Be polite and professional but warm. Use complete sentences and avoid too much slang."
            else:
                system_prompt += "Be supportive and encouraging with a balanced tone."
            
            from datetime import datetime
            current_time = datetime.now()
            current_date = current_time.strftime("%A, %B %d, %Y")
            current_time_str = current_time.strftime("%I:%M %p")
            
            system_prompt += f" Always be personal, remember their goals, and act like you genuinely care about their progress. Keep responses under 100 words. Current date and time: {current_date} at {current_time_str}. You can reference the current date/time when relevant. IMPORTANT: Only reference actual tasks and goals provided in the context. Never mention or assume tasks/goals that aren't explicitly listed. If no specific tasks/goals are provided, give general encouragement without making up specific items."
            
            # Add context about pending/incomplete items only
            user_tasks = self.db.get_tasks(user_id)
            user_goals = self.db.get_goals(user_id)
            pending_tasks = [task for task in user_tasks if task['status'] == 'pending']
            incomplete_goals = [goal for goal in user_goals if goal['progress'] < 100]
            
            context_info = []
            if pending_tasks:
                task_titles = [task['title'] for task in pending_tasks[:3]]
                context_info.append(f"User has {len(pending_tasks)} pending tasks: {', '.join(task_titles)}")
            if incomplete_goals:
                goal_titles = [goal['title'] for goal in incomplete_goals[:3]]
                context_info.append(f"User has {len(incomplete_goals)} incomplete goals: {', '.join(goal_titles)}")
            
            if context_info:
                system_prompt += f" Current user data: {' '.join(context_info)}. Only reference these actual items, never make up or assume other tasks/goals."
            
            # Build conversation messages with limited recent history
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add only last 2 exchanges for context (to prevent hallucination)
            for user_msg, ai_msg, _ in recent_history[-2:]:
                messages.append({"role": "user", "content": user_msg})
                messages.append({"role": "assistant", "content": ai_msg})
            
            # Add current message
            messages.append({"role": "user", "content": text})
            
            payload = {
                "model": "llama-3.1-8b-instant",
                "messages": messages,
                "max_tokens": 150,
                "temperature": 0.7
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=payload) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        return result['choices'][0]['message']['content'].strip()
                    return "I'm here to help you stay accountable! How can I assist you today?"
        except Exception as e:
            return "I'm having trouble connecting right now, but I'm still here to support you!"
    
    async def text_to_speech(self, text):
        try:
            url = "https://api.murf.ai/v1/speech/generate"
            headers = {
                "api-key": self.murf_key,
                "Content-Type": "application/json"
            }
            payload = {
                "voiceId": "en-US-ken",
                "text": text,
                "format": "WAV",
                "encodeAsBase64": True,
                "rate": 10,
                "sampleRate": 24000
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=payload) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        if 'encodedAudio' in result:
                            return result['encodedAudio']
            return None
        except Exception as e:
            return None
    
    async def speech_to_text(self, audio_file_path):
        audio_data = None
        try:
            # Read audio file
            with open(audio_file_path, 'rb') as audio_file:
                audio_data = audio_file.read()
                print(f"Audio file size: {len(audio_data)} bytes")
            
            url = "https://api.deepgram.com/v1/listen"
            headers = {
                "Authorization": f"Token {self.deepgram_key}"
            }
            params = {
                "model": "nova-2",
                "language": "en-US",
                "punctuate": "true",
                "smart_format": "true"
            }
                
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, params=params, data=audio_data) as resp:
                    print(f"Deepgram response status: {resp.status}")
                    
                    if resp.status == 200:
                        result = await resp.json()
                        
                        channels = result.get('results', {}).get('channels', [])
                        if channels and len(channels) > 0:
                            alternatives = channels[0].get('alternatives', [])
                            if alternatives and len(alternatives) > 0:
                                transcript = alternatives[0].get('transcript', '').strip()
                                if transcript:
                                    print(f"Successful transcription: {transcript}")
                                    return transcript
                    else:
                        error_text = await resp.text()
                        print(f"Deepgram error ({resp.status}): {error_text}")
                    return None
        except Exception as e:
            print(f"Speech to text error: {e}")
            return None

backend = WebBackend()

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        text = data.get('text', '')
        user_id = data.get('user_id', 'demo123')  # Get user_id from request
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        response = loop.run_until_complete(backend.get_ai_response(text, user_id))
        loop.close()
        
        # Create session ID if none exists
        if not backend.current_session_id:
            backend.current_session_id = f"session_{int(datetime.now().timestamp())}"
        
        # Store chat message in database
        backend.db.add_chat_message(user_id, backend.current_session_id, text, response)
        
        return jsonify({"response": response})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    try:
        data = request.json
        text = data.get('text', '')
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        audio_data = loop.run_until_complete(backend.text_to_speech(text))
        loop.close()
        
        if audio_data:
            return jsonify({"audio": audio_data})
        return jsonify({"error": "TTS failed"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stt', methods=['POST'])
def speech_to_text():
    temp_file_path = None
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400
        
        audio_file = request.files['audio']
        print(f"Received audio file: {audio_file.filename}, size: {audio_file.content_length}")
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
            temp_file_path = temp_file.name
            audio_file.save(temp_file_path)
            print(f"Saved to temp file: {temp_file_path}")
        
        # Check file size
        file_size = os.path.getsize(temp_file_path)
        print(f"Temp file size: {file_size} bytes")
        
        if file_size < 1000:  # Less than 1KB probably means no audio
            try:
                os.unlink(temp_file_path)
            except:
                pass
            return jsonify({"error": "Audio file too small - please record longer"}), 400
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        transcript = loop.run_until_complete(backend.speech_to_text(temp_file_path))
        loop.close()
        
        if transcript and transcript.strip():
            print(f"Transcript: {transcript}")
            return jsonify({"transcript": transcript})
        return jsonify({"error": "No speech detected - please speak more clearly"}), 400
        
    except Exception as e:
        print(f"STT endpoint error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        # Clean up temp file in finally block
        if temp_file_path:
            try:
                os.unlink(temp_file_path)
            except Exception as cleanup_error:
                print(f"Could not delete temp file: {cleanup_error}")

@app.route('/api/tasks', methods=['GET', 'POST'])
def tasks():
    user_id = request.args.get('user_id', 'demo123')
    
    if request.method == 'POST':
        data = request.json
        task_id = backend.db.add_task(
            user_id, 
            data.get('title'), 
            data.get('status', 'pending'), 
            data.get('priority', 'medium')
        )
        return jsonify({"task_id": task_id})
    else:
        user_tasks = backend.db.get_tasks(user_id)
        return jsonify({"tasks": user_tasks})

@app.route('/api/tasks/<int:task_id>/complete', methods=['POST'])
def complete_task(task_id):
    success = backend.db.complete_task(task_id)
    if success:
        return jsonify({"message": "Task completed successfully"})
    return jsonify({"error": "Task not found"}), 404

@app.route('/api/goals', methods=['GET', 'POST'])
def goals():
    user_id = request.args.get('user_id', 'demo123')
    
    if request.method == 'POST':
        data = request.json
        goal_id = backend.db.add_goal(user_id, data.get('title'))
        return jsonify({"goal_id": goal_id})
    else:
        user_goals = backend.db.get_goals(user_id)
        return jsonify({"goals": user_goals})

@app.route('/api/goals/<int:goal_id>/progress', methods=['POST'])
def update_goal_progress(goal_id):
    try:
        data = request.json
        progress = data.get('progress', 0)
        
        conn = backend.db.db_path
        import sqlite3
        conn = sqlite3.connect(backend.db.db_path)
        cursor = conn.cursor()
        cursor.execute('UPDATE goals SET progress = ? WHERE id = ?', (progress, goal_id))
        affected_rows = cursor.rowcount
        conn.commit()
        conn.close()
        
        if affected_rows > 0:
            return jsonify({"message": "Goal progress updated successfully"})
        return jsonify({"error": "Goal not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/goals/<int:goal_id>/subgoals', methods=['GET', 'POST'])
def handle_subgoals(goal_id):
    if request.method == 'POST':
        data = request.json
        title = data.get('title', '')
        credits = data.get('credits', 1)
        
        subgoal_id = backend.db.add_subgoal(goal_id, title, credits)
        return jsonify({"subgoal_id": subgoal_id})
    else:
        subgoals = backend.db.get_subgoals(goal_id)
        return jsonify({"subGoals": subgoals})

@app.route('/api/goals/<int:goal_id>/subgoals/<int:subgoal_id>/toggle', methods=['POST'])
def toggle_subgoal(goal_id, subgoal_id):
    try:
        success = backend.db.toggle_subgoal(goal_id, subgoal_id)
        if success:
            return jsonify({"message": "Sub-goal updated successfully"})
        else:
            return jsonify({"error": "Sub-goal not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/goals/<int:goal_id>/notes', methods=['GET', 'POST'])
def handle_goal_notes(goal_id):
    if request.method == 'POST':
        data = request.json
        notes = data.get('notes', '')
        backend.goal_notes[goal_id] = notes
        return jsonify({"message": "Notes saved successfully"})
    else:
        notes = backend.goal_notes.get(goal_id, '')
        return jsonify({"notes": notes})

@app.route('/api/habits', methods=['GET', 'POST'])
def habits():
    user_id = request.args.get('user_id', 'demo123')
    
    if request.method == 'POST':
        data = request.json
        user_id = data.get('user_id', user_id)  # Get user_id from request body too
        habit_id = backend.db.add_habit(
            user_id, 
            data.get('name'), 
            data.get('frequency', 'daily')
        )
        return jsonify({"habit_id": habit_id})
    else:
        # Get habits from database
        from datetime import date
        today = date.today().isoformat()
        
        user_habits = backend.db.get_habits(user_id)
        habits_with_status = []
        
        for habit in user_habits:
            habit_copy = habit.copy()
            habit_logs = backend.habit_logs.get(habit['id'], [])
            habit_copy['completed_today'] = today in habit_logs
            habit_copy['recent_logs'] = habit_logs[-7:] if len(habit_logs) > 7 else habit_logs
            habit_copy['last_completed'] = None  # Add for compatibility
            habits_with_status.append(habit_copy)
        
        return jsonify({"habits": habits_with_status})

@app.route('/api/habits/<int:habit_id>', methods=['DELETE'])
def delete_habit(habit_id):
    try:
        success = backend.db.delete_habit(habit_id)
        if success:
            return jsonify({"message": "Habit deleted successfully"})
        return jsonify({"error": "Habit not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/habits/<int:habit_id>/log', methods=['POST'])
def log_habit(habit_id):
    try:
        from datetime import datetime
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Initialize habit logs if not exists
        if habit_id not in backend.habit_logs:
            backend.habit_logs[habit_id] = []
        
        # Check if already logged today
        if today in backend.habit_logs[habit_id]:
            return jsonify({"error": "Already logged today"}), 400
        
        # Add today's log
        backend.habit_logs[habit_id].append(today)
        
        return jsonify({"message": "Habit logged successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/history', methods=['GET'])
def get_chat_history():
    user_id = request.args.get('user_id', 'demo123')
    sessions = backend.db.get_chat_sessions(user_id)
    return jsonify({"sessions": sessions})

@app.route('/api/history/new', methods=['POST'])
def new_chat_session():
    backend.current_session_id = None
    return jsonify({"message": "New chat session created"})

@app.route('/api/history/<session_id>', methods=['GET', 'DELETE'])
def handle_session_history(session_id):
    user_id = request.args.get('user_id', 'demo123')
    
    if request.method == 'DELETE':
        success = backend.db.delete_chat_session(user_id, session_id)
        if success:
            return jsonify({"message": "Chat session deleted successfully"})
        return jsonify({"error": "Session not found"}), 404
    
    messages = backend.db.get_session_messages(user_id, session_id)
    if messages:
        session_data = {
            "messages": messages,
            "created_at": messages[0]['timestamp'] if messages else None,
            "title": messages[0]['user_message'][:50] + "..." if messages else "Empty Session"
        }
        return jsonify({"session": session_data})
    return jsonify({"error": "Session not found"}), 404

@app.route('/api/users/register', methods=['POST'])
def register_user():
    try:
        data = request.json
        user_id = data.get('user_id')
        email = data.get('email')
        name = data.get('name')
        picture = data.get('picture')
        
        backend.db.add_user(user_id, email, name, picture)
        return jsonify({"message": "User registered successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/friends/search', methods=['POST'])
def search_friends():
    try:
        data = request.json
        email = data.get('email', '').lower()
        current_user_id = data.get('user_id', 'demo123')
        
        # Search real users by email, excluding current user
        found_users = backend.db.search_users_by_email(email)
        found_users = [user for user in found_users if user['id'] != current_user_id]
        
        return jsonify({"users": found_users})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/friends/request', methods=['POST'])
def send_friend_request():
    try:
        data = request.json
        from_user_id = data.get('user_id', 'demo123')
        to_user_id = data.get('friend_id')
        
        request_id = backend.db.send_friend_request(from_user_id, to_user_id)
        return jsonify({"message": "Friend request sent!", "request_id": request_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/friends/requests', methods=['GET'])
def get_friend_requests():
    try:
        user_id = request.args.get('user_id', 'demo123')
        requests = backend.db.get_pending_friend_requests(user_id)
        return jsonify({"requests": requests})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/friends/requests/<int:request_id>/respond', methods=['POST'])
def respond_friend_request(request_id):
    try:
        data = request.json
        status = data.get('status')  # 'accepted' or 'rejected'
        
        success = backend.db.respond_to_friend_request(request_id, status)
        if success:
            return jsonify({"message": f"Friend request {status}"})
        return jsonify({"error": "Request not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/friends/<friend_id>/tasks', methods=['GET'])
def get_friend_tasks(friend_id):
    try:
        tasks = backend.db.get_tasks(friend_id)
        pending_tasks = [task for task in tasks if task['status'] == 'pending']
        return jsonify({"tasks": pending_tasks})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/friends/<friend_id>/goals', methods=['GET'])
def get_friend_goals(friend_id):
    try:
        goals = backend.db.get_goals(friend_id)
        incomplete_goals = [goal for goal in goals if goal['progress'] < 100]
        return jsonify({"goals": incomplete_goals})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/friends', methods=['GET'])
def get_friends():
    try:
        user_id = request.args.get('user_id', 'demo123')
        friends = backend.db.get_friends(user_id)
        return jsonify({"friends": friends})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tasks/shared', methods=['GET', 'POST'])
def shared_tasks():
    if request.method == 'POST':
        data = request.json
        shared_task = {
            "id": len(backend.shared_tasks) + 1,
            "title": data.get('title'),
            "description": data.get('description', ''),
            "priority": data.get('priority', 'medium'),
            "status": "pending",
            "created_by": "demo123",
            "shared_with": data.get('shared_with', []),
            "created_at": datetime.now().isoformat()
        }
        backend.shared_tasks[shared_task['id']] = shared_task
        return jsonify({"task": shared_task})
    else:
        # Demo shared tasks
        demo_shared_tasks = [
            {
                "id": 1,
                "title": "Plan weekend hiking trip",
                "description": "Research trails and book accommodation",
                "priority": "medium",
                "status": "pending",
                "created_by": "friend1",
                "created_by_name": "Alice Johnson",
                "shared_with": ["demo123"],
                "created_at": datetime.now().isoformat()
            }
        ]
        return jsonify({"tasks": demo_shared_tasks})

@app.route('/api/goals/shared', methods=['GET', 'POST'])
def shared_goals():
    if request.method == 'POST':
        data = request.json
        shared_goal = {
            "id": len(backend.shared_goals) + 1,
            "title": data.get('title'),
            "description": data.get('description', ''),
            "progress": 0,
            "created_by": "demo123",
            "shared_with": data.get('shared_with', []),
            "created_at": datetime.now().isoformat()
        }
        backend.shared_goals[shared_goal['id']] = shared_goal
        return jsonify({"goal": shared_goal})
    else:
        # Demo shared goals
        demo_shared_goals = [
            {
                "id": 1,
                "title": "Learn Spanish together",
                "description": "Practice 30 minutes daily",
                "progress": 25,
                "created_by": "friend2",
                "created_by_name": "Bob Smith",
                "shared_with": ["demo123"],
                "created_at": datetime.now().isoformat()
            }
        ]
        return jsonify({"goals": demo_shared_goals})

@app.route('/api/messages', methods=['GET'])
def get_messages():
    try:
        user_id = request.args.get('user_id', 'demo123')
        messages = backend.db.get_messages(user_id)
        return jsonify({"messages": messages})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/proactive-check', methods=['GET'])
def proactive_check():
    """Get proactive message from AI about pending tasks"""
    try:
        # Only return proactive messages if user has actual tasks
        if not backend.tasks:
            return jsonify({"message": None})
        
        pending_tasks = [task for task in backend.tasks if task['status'] == 'pending']
        
        # Don't be proactive if no pending tasks
        if not pending_tasks:
            return jsonify({"message": None})
        
        # Only be proactive occasionally (not every time)
        import random
        if random.random() > 0.3:  # 30% chance of proactive message
            return jsonify({"message": None})
        
        # Generate simple, general check-in message
        messages = [
            "How are your tasks going today?",
            "Need any help with your to-do list?",
            "How's your productivity today?"
        ]
        
        selected_message = random.choice(messages)
        return jsonify({"message": selected_message})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Web Backend for Frontend Integration...")
    print("API available at: http://localhost:5000")
    print("Frontend can now connect to backend!")
    app.run(debug=True, port=5000, host='0.0.0.0')