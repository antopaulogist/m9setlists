// Supabase Configuration
// Note: These credentials are safe to be public - the anon key is designed for client-side use
// and access is controlled by Row Level Security policies in the database
const SUPABASE_URL = 'https://vqilyulfxwvgfrrywkoj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxaWx5dWxmeHd2Z2Zycnl3a29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTIxNTcsImV4cCI6MjA2NzEyODE1N30.1h8uHtc_d18MJIC3DNcKHdx52cwDACHnh8fRCslRinM';

// Initialize Supabase (will be loaded from CDN)
let supabase;

// DOM Elements
const listsView = document.getElementById('lists-view');
const listView = document.getElementById('list-view');
const newListForm = document.getElementById('new-list-form');
const newListInput = document.getElementById('new-list-input');
const listsGrid = document.getElementById('lists-grid');
const noListsState = document.getElementById('no-lists-state');
const backBtn = document.getElementById('back-btn');
const listTitle = document.getElementById('list-title');

const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const todoForm = document.getElementById('todo-form');
const emptyState = document.getElementById('empty-state');

// State
let currentListId = null;
let lists = {};
let lastDeleted = null;
let undoTimeout = null;

// Initialize app
async function init() {
    // Wait for Supabase to load
    if (!window.supabase) {
        console.error('Supabase library not loaded');
        return;
    }
    
    try {
        // Initialize Supabase
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase initialized successfully');
        
        await loadLists();
        showListsView();
        bindEvents();
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// Event listeners
function bindEvents() {
    newListForm.addEventListener('submit', createList);
    backBtn.addEventListener('click', showListsView);
    listTitle.addEventListener('blur', saveListTitle);
    listTitle.addEventListener('keydown', handleTitleKeydown);
    todoForm.addEventListener('submit', addItem);
}

// Load lists from Supabase
async function loadLists() {
    if (!supabase) {
        console.error('Supabase not initialized');
        lists = {};
        return;
    }
    
    try {
        console.log('Loading lists from Supabase...');
        const { data, error } = await supabase
            .from('lists')
            .select('*');
        
        if (error) {
            console.error('Error loading lists:', error);
            lists = {};
        } else {
            console.log('Lists loaded successfully:', data);
            // Convert array to object format
            lists = {};
            data.forEach(list => {
                lists[list.id] = {
                    name: list.name,
                    items: list.items,
                    created: list.created
                };
            });
        }
        
        // Check for old localStorage data and migrate it
        const savedLists = localStorage.getItem('allLists');
        const oldItems = localStorage.getItem('shoppingItems');
        
        if (savedLists || oldItems) {
            await migrateLocalStorageData(savedLists, oldItems);
        }
    } catch (error) {
        console.error('Error loading lists:', error);
        lists = {};
    }
}

// Migrate old localStorage data to server
async function migrateLocalStorageData(savedLists, oldItems) {
    try {
        let hasData = false;
        
        if (savedLists) {
            const localLists = JSON.parse(savedLists);
            Object.assign(lists, localLists);
            hasData = true;
        } else if (oldItems) {
            const items = JSON.parse(oldItems);
            if (items.length > 0) {
                const listId = Date.now().toString();
                lists[listId] = {
                    name: 'Shopping List',
                    items: items,
                    created: Date.now()
                };
                hasData = true;
            }
        }
        
        if (hasData) {
            await saveLists();
            // Clear localStorage after successful migration
            localStorage.removeItem('allLists');
            localStorage.removeItem('shoppingItems');
            console.log('Successfully migrated data to server');
        }
    } catch (error) {
        console.error('Error migrating localStorage data:', error);
    }
}

// Save lists to Supabase
async function saveLists() {
    if (!supabase) {
        console.error('Supabase not initialized');
        return;
    }
    
    try {
        // Get current lists from database
        const { data: existingLists, error: fetchError } = await supabase
            .from('lists')
            .select('id');
        
        if (fetchError) {
            console.error('Error fetching existing lists:', fetchError);
            return;
        }
        
        const existingIds = existingLists.map(list => list.id);
        const currentIds = Object.keys(lists);
        
        // Delete lists that no longer exist
        const toDelete = existingIds.filter(id => !currentIds.includes(id));
        if (toDelete.length > 0) {
            const { error: deleteError } = await supabase
                .from('lists')
                .delete()
                .in('id', toDelete);
            
            if (deleteError) {
                console.error('Error deleting lists:', deleteError);
            }
        }
        
        // Upsert current lists
        const listsArray = Object.keys(lists).map(id => ({
            id: id,
            name: lists[id].name,
            items: lists[id].items,
            created: lists[id].created
        }));
        
        if (listsArray.length > 0) {
            const { error: upsertError } = await supabase
                .from('lists')
                .upsert(listsArray);
            
            if (upsertError) {
                console.error('Error saving lists:', upsertError);
            } else {
                console.log('Lists saved successfully');
            }
        }
    } catch (error) {
        console.error('Error saving lists:', error);
    }
}

// Create new list
async function createList(e) {
    e.preventDefault();
    const listName = newListInput.value.trim();
    if (!listName) return;

    const listId = Date.now().toString();
    lists[listId] = {
        name: listName,
        items: [],
        created: Date.now()
    };

    await saveLists();
    renderLists();
    newListInput.value = '';
    newListInput.focus();
}

// Render all lists
function renderLists() {
    const listIds = Object.keys(lists);
    
    if (listIds.length === 0) {
        noListsState.style.display = 'block';
        listsGrid.innerHTML = '';
        return;
    }

    noListsState.style.display = 'none';
    listsGrid.innerHTML = '';

    // Sort lists by creation time (newest first)
    listIds.sort((a, b) => lists[b].created - lists[a].created);

    listIds.forEach(listId => {
        const list = lists[listId];
        const listCard = document.createElement('div');
        listCard.className = 'list-card';
        
        const listContent = document.createElement('div');
        listContent.className = 'list-card-content';
        
        const h3 = document.createElement('h3');
        h3.textContent = list.name;
        
        const p = document.createElement('p');
        p.textContent = `${list.items.length} items`;
        
        listContent.appendChild(h3);
        listContent.appendChild(p);
        listContent.addEventListener('click', () => showListView(listId));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'list-delete-btn';
        deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-label="Delete"><path d="M3 6h18" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M8 6v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#fff" stroke-width="2" stroke-linecap="round"/><rect x="5" y="6" width="14" height="14" rx="2" fill="none" stroke="#fff" stroke-width="2"/><path d="M10 11v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M14 11v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${list.name}"?`)) {
                delete lists[listId];
                await saveLists();
                renderLists();
            }
        });
        
        listCard.appendChild(listContent);
        listCard.appendChild(deleteBtn);
        listsGrid.appendChild(listCard);
    });
}

// Show lists overview
function showListsView() {
    listsView.classList.remove('hidden');
    listView.classList.add('hidden');
    currentListId = null;
    renderLists();
}

// Show individual list
function showListView(listId) {
    currentListId = listId;
    const list = lists[listId];
    
    listTitle.textContent = list.name;
    listsView.classList.add('hidden');
    listView.classList.remove('hidden');
    
    renderListItems();
    todoInput.focus();
}

// Save list title
async function saveListTitle() {
    if (!currentListId) return;
    const newTitle = listTitle.textContent.trim();
    if (newTitle) {
        lists[currentListId].name = newTitle;
        await saveLists();
    }
}

// Handle title keydown
function handleTitleKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        listTitle.blur();
    }
}



// Add item to current list
async function addItem(e) {
    e.preventDefault();
    if (!currentListId) return;
    
    const item = todoInput.value.trim();
    if (!item) return;

    // Add new item to the end (it will appear at top due to reverse display)
    lists[currentListId].items.push(item);
    await saveLists();
    renderListItems();
    todoInput.value = '';
    todoInput.focus();
}

// Render items in current list
function renderListItems() {
    if (!currentListId) return;
    
    const list = lists[currentListId];
    todoList.innerHTML = '';
    
    if (list.items.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    
    // Display items in reverse order (newest first)
    const reversedItems = [...list.items].reverse();
    
    reversedItems.forEach((item, reverseIndex) => {
        // Calculate the original index for deletion
        const originalIndex = list.items.length - 1 - reverseIndex;
        
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = item;
        li.appendChild(span);
        
        const delBtn = createDeleteButton(item, originalIndex, li);
        li.appendChild(delBtn);
        
        todoList.appendChild(li);
    });
}

// Create delete button
function createDeleteButton(item, index, li) {
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-label="Delete"><path d="M3 6h18" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M8 6v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#fff" stroke-width="2" stroke-linecap="round"/><rect x="5" y="6" width="14" height="14" rx="2" fill="none" stroke="#fff" stroke-width="2"/><path d="M10 11v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M14 11v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
    delBtn.className = 'delete-btn';
    delBtn.type = 'button';
    delBtn.onclick = async function() {
        lists[currentListId].items.splice(index, 1);
        await saveLists();
        renderListItems();
        showUndo(item, index);
    };
    return delBtn;
}

// Show undo notification
function showUndo(item, index) {
    try {
        clearTimeout(undoTimeout);
        lastDeleted = { item, index };
        
        let undoDiv = document.getElementById('undo-div');
        if (!undoDiv) {
            undoDiv = document.createElement('div');
            undoDiv.id = 'undo-div';
            undoDiv.className = 'undo-notification';
            document.body.appendChild(undoDiv);
        }
        
        undoDiv.innerHTML = '<button id="undo-btn" class="undo-btn">Undo</button>';
        document.getElementById('undo-btn').onclick = undoDelete;
        undoDiv.style.display = 'flex';
        
        undoTimeout = setTimeout(() => {
            undoDiv.style.display = 'none';
            lastDeleted = null;
        }, 5000);
    } catch (error) {
        console.error('Error showing undo notification:', error);
    }
}

// Undo delete
async function undoDelete() {
    if (!lastDeleted || !currentListId) return;
    
    try {
        const { item, index } = lastDeleted;
        // Restore item at its original position
        lists[currentListId].items.splice(index, 0, item);
        await saveLists();
        renderListItems();
        
        document.getElementById('undo-div').style.display = 'none';
        lastDeleted = null;
    } catch (error) {
        console.error('Error during undo:', error);
    }
}

// Initialize app when DOM and Supabase are ready
function waitForSupabase() {
    if (window.supabase) {
        init();
    } else {
        console.log('Waiting for Supabase to load...');
        setTimeout(waitForSupabase, 100);
    }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForSupabase);
} else {
    waitForSupabase();
}
