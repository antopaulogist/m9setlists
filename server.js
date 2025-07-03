const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Initialize SQLite database
const db = new Database('lists.db');

// Create tables if they don't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        items TEXT NOT NULL,
        created INTEGER NOT NULL
    )
`);

// API Routes

// Get all lists
app.get('/api/lists', (req, res) => {
    try {
        const lists = db.prepare('SELECT * FROM lists').all();
        const formattedLists = {};
        
        lists.forEach(list => {
            formattedLists[list.id] = {
                name: list.name,
                items: JSON.parse(list.items),
                created: list.created
            };
        });
        
        res.json(formattedLists);
    } catch (error) {
        console.error('Error fetching lists:', error);
        res.status(500).json({ error: 'Failed to fetch lists' });
    }
});

// Save all lists
app.post('/api/lists', (req, res) => {
    try {
        const lists = req.body;
        
        // Clear existing lists
        db.prepare('DELETE FROM lists').run();
        
        // Insert new lists
        const insertStmt = db.prepare('INSERT INTO lists (id, name, items, created) VALUES (?, ?, ?, ?)');
        
        Object.keys(lists).forEach(listId => {
            const list = lists[listId];
            insertStmt.run(listId, list.name, JSON.stringify(list.items), list.created);
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving lists:', error);
        res.status(500).json({ error: 'Failed to save lists' });
    }
});

// Save single list
app.put('/api/lists/:id', (req, res) => {
    try {
        const listId = req.params.id;
        const list = req.body;
        
        const stmt = db.prepare('INSERT OR REPLACE INTO lists (id, name, items, created) VALUES (?, ?, ?, ?)');
        stmt.run(listId, list.name, JSON.stringify(list.items), list.created);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving list:', error);
        res.status(500).json({ error: 'Failed to save list' });
    }
});

// Delete list
app.delete('/api/lists/:id', (req, res) => {
    try {
        const listId = req.params.id;
        const stmt = db.prepare('DELETE FROM lists WHERE id = ?');
        stmt.run(listId);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting list:', error);
        res.status(500).json({ error: 'Failed to delete list' });
    }
});

// Serve the app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('You can now share this URL with your wife!');
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close();
    console.log('Database connection closed.');
    process.exit(0);
}); 