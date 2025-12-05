import sqlite3
import json
from datetime import datetime
import os

class Database:
    def __init__(self, db_path="productivity_app.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Chat messages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                user_message TEXT NOT NULL,
                ai_response TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Tasks table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                priority TEXT DEFAULT 'medium',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Goals table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                progress INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Subgoals table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS subgoals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                completed BOOLEAN DEFAULT 0,
                credits INTEGER DEFAULT 1,
                FOREIGN KEY (goal_id) REFERENCES goals (id)
            )
        ''')
        
        # Habits table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS habits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                streak INTEGER DEFAULT 0,
                frequency TEXT DEFAULT 'daily',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Users table for friends system
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                picture TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Friend requests table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS friend_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_user_id TEXT NOT NULL,
                to_user_id TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (from_user_id) REFERENCES users (id),
                FOREIGN KEY (to_user_id) REFERENCES users (id)
            )
        ''')
        
        # Friends table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS friends (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user1_id TEXT NOT NULL,
                user2_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user1_id) REFERENCES users (id),
                FOREIGN KEY (user2_id) REFERENCES users (id)
            )
        ''')
        
        # Messages table for friend messaging
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_user_id TEXT NOT NULL,
                to_user_id TEXT NOT NULL,
                message TEXT NOT NULL,
                read_status BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (from_user_id) REFERENCES users (id),
                FOREIGN KEY (to_user_id) REFERENCES users (id)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def add_chat_message(self, user_id, session_id, user_message, ai_response):
        """Add a chat message to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO chat_messages (user_id, session_id, user_message, ai_response)
            VALUES (?, ?, ?, ?)
        ''', (user_id, session_id, user_message, ai_response))
        conn.commit()
        conn.close()
    
    def get_recent_chat_history(self, user_id, limit=10):
        """Get recent chat history for context"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT user_message, ai_response, timestamp
            FROM chat_messages
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (user_id, limit))
        messages = cursor.fetchall()
        conn.close()
        return list(reversed(messages))  # Return in chronological order
    
    def add_task(self, user_id, title, status='pending', priority='medium'):
        """Add a task to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO tasks (user_id, title, status, priority)
            VALUES (?, ?, ?, ?)
        ''', (user_id, title, status, priority))
        task_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return task_id
    
    def get_tasks(self, user_id):
        """Get all tasks for a user"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, title, status, priority, created_at
            FROM tasks
            WHERE user_id = ?
            ORDER BY created_at DESC
        ''', (user_id,))
        tasks = cursor.fetchall()
        conn.close()
        return [{"id": t[0], "title": t[1], "status": t[2], "priority": t[3], "created_at": t[4]} for t in tasks]
    
    def complete_task(self, task_id):
        """Mark a task as completed"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE tasks SET status = 'completed' WHERE id = ?
        ''', (task_id,))
        affected_rows = cursor.rowcount
        conn.commit()
        conn.close()
        return affected_rows > 0
    
    def add_goal(self, user_id, title, progress=0):
        """Add a goal to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO goals (user_id, title, progress)
            VALUES (?, ?, ?)
        ''', (user_id, title, progress))
        goal_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return goal_id
    
    def get_goals(self, user_id):
        """Get all goals for a user"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, title, progress, created_at
            FROM goals
            WHERE user_id = ?
            ORDER BY created_at DESC
        ''', (user_id,))
        goals = cursor.fetchall()
        conn.close()
        return [{"id": g[0], "title": g[1], "progress": g[2], "created_at": g[3]} for g in goals]
    
    def complete_goal(self, goal_id):
        """Mark a goal as completed (100% progress)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE goals SET progress = 100 WHERE id = ?
        ''', (goal_id,))
        affected_rows = cursor.rowcount
        conn.commit()
        conn.close()
        return affected_rows > 0
    
    def add_subgoal(self, goal_id, title, credits=1):
        """Add a subgoal to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO subgoals (goal_id, title, credits)
            VALUES (?, ?, ?)
        ''', (goal_id, title, credits))
        subgoal_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return subgoal_id
    
    def get_subgoals(self, goal_id):
        """Get all subgoals for a goal"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, title, completed, credits
            FROM subgoals
            WHERE goal_id = ?
        ''', (goal_id,))
        subgoals = cursor.fetchall()
        conn.close()
        return [{"id": s[0], "title": s[1], "completed": bool(s[2]), "credits": s[3]} for s in subgoals]
    
    def toggle_subgoal(self, goal_id, subgoal_id):
        """Toggle subgoal completion status"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE subgoals 
            SET completed = NOT completed 
            WHERE id = ? AND goal_id = ?
        ''', (subgoal_id, goal_id))
        affected_rows = cursor.rowcount
        conn.commit()
        conn.close()
        return affected_rows > 0
    
    def add_habit(self, user_id, name, frequency='daily'):
        """Add a habit to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO habits (user_id, name, frequency)
            VALUES (?, ?, ?)
        ''', (user_id, name, frequency))
        habit_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return habit_id
    
    def get_habits(self, user_id):
        """Get all habits for a user"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, name, streak, frequency, created_at
            FROM habits
            WHERE user_id = ?
            ORDER BY created_at DESC
        ''', (user_id,))
        habits = cursor.fetchall()
        conn.close()
        return [{"id": h[0], "name": h[1], "streak": h[2], "frequency": h[3], "created_at": h[4]} for h in habits]
    
    def delete_habit(self, habit_id):
        """Delete a habit"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM habits WHERE id = ?', (habit_id,))
        affected_rows = cursor.rowcount
        conn.commit()
        conn.close()
        return affected_rows > 0
    
    def add_user(self, user_id, email, name, picture=None):
        """Add or update user information"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO users (id, email, name, picture)
            VALUES (?, ?, ?, ?)
        ''', (user_id, email, name, picture))
        conn.commit()
        conn.close()
    
    def search_users_by_email(self, email_query):
        """Search users by email"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, email, name, picture
            FROM users
            WHERE email LIKE ?
            ORDER BY email
        ''', (f'%{email_query}%',))
        users = cursor.fetchall()
        conn.close()
        return [{"id": u[0], "email": u[1], "name": u[2], "picture": u[3]} for u in users]
    
    def send_friend_request(self, from_user_id, to_user_id):
        """Send a friend request"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO friend_requests (from_user_id, to_user_id)
            VALUES (?, ?)
        ''', (from_user_id, to_user_id))
        request_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return request_id
    
    def get_pending_friend_requests(self, user_id):
        """Get pending friend requests for a user"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT fr.id, u.id, u.name, u.email, u.picture, fr.created_at
            FROM friend_requests fr
            JOIN users u ON fr.from_user_id = u.id
            WHERE fr.to_user_id = ? AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
        ''', (user_id,))
        requests = cursor.fetchall()
        conn.close()
        return [{"request_id": r[0], "id": r[1], "name": r[2], "email": r[3], "picture": r[4], "created_at": r[5]} for r in requests]
    
    def respond_to_friend_request(self, request_id, status):
        """Accept or reject a friend request"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get the request details first
        cursor.execute('SELECT from_user_id, to_user_id FROM friend_requests WHERE id = ?', (request_id,))
        request_data = cursor.fetchone()
        
        if not request_data:
            conn.close()
            return False
        
        from_user_id, to_user_id = request_data
        
        # Update request status
        cursor.execute('UPDATE friend_requests SET status = ? WHERE id = ?', (status, request_id))
        
        # If accepted, create friendship
        if status == 'accepted':
            cursor.execute('''
                INSERT INTO friends (user1_id, user2_id)
                VALUES (?, ?)
            ''', (from_user_id, to_user_id))
        
        conn.commit()
        conn.close()
        return True
    
    def get_friends(self, user_id):
        """Get all friends for a user"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT u.id, u.name, u.email, u.picture
            FROM friends f
            JOIN users u ON (f.user1_id = u.id OR f.user2_id = u.id)
            WHERE (f.user1_id = ? OR f.user2_id = ?) AND u.id != ?
        ''', (user_id, user_id, user_id))
        friends = cursor.fetchall()
        conn.close()
        return [{"id": f[0], "name": f[1], "email": f[2], "picture": f[3], "status": "offline"} for f in friends]
    
    def get_friend_by_name(self, user_id, name_query):
        """Find a friend by name (supports first name matching)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT u.id, u.name, u.email, u.picture
            FROM friends f
            JOIN users u ON (f.user1_id = u.id OR f.user2_id = u.id)
            WHERE (f.user1_id = ? OR f.user2_id = ?) AND u.id != ? AND LOWER(u.name) LIKE LOWER(?)
            LIMIT 1
        ''', (user_id, user_id, user_id, f'%{name_query}%'))
        friend = cursor.fetchone()
        conn.close()
        if friend:
            return {"id": friend[0], "name": friend[1], "email": friend[2], "picture": friend[3]}
        return None
    
    def get_chat_sessions(self, user_id):
        """Get chat sessions for a user"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT DISTINCT session_id, MIN(timestamp) as created_at, 
                   GROUP_CONCAT(user_message, ' ') as sample_text
            FROM chat_messages
            WHERE user_id = ?
            GROUP BY session_id
            ORDER BY created_at DESC
        ''', (user_id,))
        sessions = cursor.fetchall()
        conn.close()
        
        result = {}
        for session in sessions:
            session_id, created_at, sample_text = session
            title = sample_text[:50] + "..." if len(sample_text) > 50 else sample_text
            result[session_id] = {
                "messages": [],
                "created_at": created_at,
                "title": title
            }
        return result
    
    def get_session_messages(self, user_id, session_id):
        """Get messages for a specific session"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, user_message, ai_response, timestamp
            FROM chat_messages
            WHERE user_id = ? AND session_id = ?
            ORDER BY timestamp ASC
        ''', (user_id, session_id))
        messages = cursor.fetchall()
        conn.close()
        
        return [{
            "id": m[0],
            "user_message": m[1],
            "ai_response": m[2],
            "timestamp": m[3]
        } for m in messages]
    
    def delete_chat_session(self, user_id, session_id):
        """Delete all messages for a specific session"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            DELETE FROM chat_messages
            WHERE user_id = ? AND session_id = ?
        ''', (user_id, session_id))
        affected_rows = cursor.rowcount
        conn.commit()
        conn.close()
        return affected_rows > 0
    
    def send_message(self, from_user_id, to_user_id, message):
        """Send a message to a friend"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO messages (from_user_id, to_user_id, message)
            VALUES (?, ?, ?)
        ''', (from_user_id, to_user_id, message))
        message_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return message_id
    
    def get_messages(self, user_id):
        """Get all messages for a user (both sent and received)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT m.id, u.name, m.message, m.created_at, m.read_status, 'received' as type
            FROM messages m
            JOIN users u ON m.from_user_id = u.id
            WHERE m.to_user_id = ?
            UNION ALL
            SELECT m.id, u.name, m.message, m.created_at, 1 as read_status, 'sent' as type
            FROM messages m
            JOIN users u ON m.to_user_id = u.id
            WHERE m.from_user_id = ?
            ORDER BY created_at DESC
        ''', (user_id, user_id))
        messages = cursor.fetchall()
        conn.close()
        return [{"id": m[0], "contact_name": m[1], "message": m[2], "created_at": m[3], "read": bool(m[4]), "type": m[5]} for m in messages]