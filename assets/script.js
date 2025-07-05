// Supabase Configuration
// NOTE: These credentials are safe to be public - the anon key is designed for client-side use
// and access is controlled by Row Level Security policies in the database
const SUPABASE_URL = 'https://ktmgctbcyerflzipmgpi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bWdjdGJjeWVyZmx6aXBtZ3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MTMwOTQsImV4cCI6MjA2NzI4OTA5NH0.MzJqbSBvCqIJfTakgB2B9LcGfoyrlg92FwXm1Wjv9J4';

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
let setlists = {};
let lastDeleted = null;
let undoTimeout = null;
let realtimeChannel = null;

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
        
        await loadSetlists();
        setupRealTimeSync();
        showListsView();
        bindEvents();
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// Event listeners
function bindEvents() {
    newListForm.addEventListener('submit', createSetlist);
    backBtn.addEventListener('click', showListsView);
    listTitle.addEventListener('blur', saveSetlistTitle);
    listTitle.addEventListener('keydown', handleTitleKeydown);
    todoForm.addEventListener('submit', addSong);
}

// Setup real-time synchronization
function setupRealTimeSync() {
    if (!supabase) {
        console.error('Supabase not initialized for real-time');
        return;
    }
    
    try {
        // Create a channel for real-time updates
        realtimeChannel = supabase
            .channel('setlists_changes')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'setlists' 
                }, 
                handleRealTimeChange
            )
            .subscribe((status) => {
                console.log('Real-time subscription status:', status);
            });
            
        console.log('Real-time sync enabled');
    } catch (error) {
        console.error('Error setting up real-time sync:', error);
    }
}

// Handle real-time database changes
function handleRealTimeChange(payload) {
    console.log('Real-time change received:', payload);
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
        case 'INSERT':
            // New setlist added
            setlists[newRecord.id] = {
                name: newRecord.name,
                songs: newRecord.songs,
                created: newRecord.created
            };
            updateUI();
            break;
            
        case 'UPDATE':
            // Setlist modified
            if (setlists[newRecord.id]) {
                setlists[newRecord.id] = {
                    name: newRecord.name,
                    songs: newRecord.songs,
                    created: newRecord.created
                };
                updateUI();
            }
            break;
            
        case 'DELETE':
            // Setlist deleted
            if (oldRecord && setlists[oldRecord.id]) {
                delete setlists[oldRecord.id];
                
                // If we're currently viewing the deleted setlist, go back to setlists view
                if (currentListId === oldRecord.id) {
                    showListsView();
                } else {
                    updateUI();
                }
            }
            break;
    }
}

// Update UI based on current view
function updateUI() {
    // Add a small delay to batch multiple rapid changes
    clearTimeout(updateUI.timeout);
    updateUI.timeout = setTimeout(() => {
        if (currentListId) {
            // We're in setlist view - update the current setlist
            if (setlists[currentListId]) {
                renderSongs();
                // Update setlist title if it changed
                const setlist = setlists[currentListId];
                if (listTitle.textContent !== setlist.name) {
                    listTitle.textContent = setlist.name;
                }
            } else {
                // Current setlist was deleted, go back to setlists view
                showListsView();
            }
        } else {
            // We're in setlists overview - update the setlists grid
            renderSetlists();
        }
    }, 100);
}

// Load setlists from Supabase
async function loadSetlists() {
    if (!supabase) {
        console.error('Supabase not initialized');
        setlists = {};
        return;
    }
    
    try {
        console.log('Loading setlists from Supabase...');
        const { data, error } = await supabase
            .from('setlists')
            .select('*');
        
        if (error) {
            console.error('Error loading setlists:', error);
            setlists = {};
        } else {
            console.log('Setlists loaded successfully:', data);
            // Convert array to object format
            setlists = {};
            data.forEach(setlist => {
                setlists[setlist.id] = {
                    name: setlist.name,
                    songs: setlist.songs,
                    created: setlist.created
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
        console.error('Error loading setlists:', error);
        setlists = {};
    }
}

// Migrate old localStorage data to server
async function migrateLocalStorageData(savedLists, oldItems) {
    try {
        let hasData = false;
        
        if (savedLists) {
            const localLists = JSON.parse(savedLists);
            Object.keys(localLists).forEach(id => {
                setlists[id] = {
                    name: localLists[id].name,
                    songs: localLists[id].items || [],
                    created: localLists[id].created
                };
            });
            hasData = true;
        } else if (oldItems) {
            const items = JSON.parse(oldItems);
            if (items.length > 0) {
                const listId = Date.now().toString();
                setlists[listId] = {
                    name: 'Main Setlist',
                    songs: items,
                    created: Date.now()
                };
                hasData = true;
            }
        }
        
        if (hasData) {
            await saveSetlists();
            // Clear localStorage after successful migration
            localStorage.removeItem('allLists');
            localStorage.removeItem('shoppingItems');
            console.log('Successfully migrated data to server');
        }
    } catch (error) {
        console.error('Error migrating localStorage data:', error);
    }
}

// Save setlists to Supabase
async function saveSetlists() {
    if (!supabase) {
        console.error('Supabase not initialized');
        return;
    }
    
    try {
        // Get current setlists from database
        const { data: existingSetlists, error: fetchError } = await supabase
            .from('setlists')
            .select('id');
        
        if (fetchError) {
            console.error('Error fetching existing setlists:', fetchError);
            return;
        }
        
        const existingIds = existingSetlists.map(setlist => setlist.id);
        const currentIds = Object.keys(setlists);
        
        // Delete setlists that no longer exist
        const toDelete = existingIds.filter(id => !currentIds.includes(id));
        if (toDelete.length > 0) {
            const { error: deleteError } = await supabase
                .from('setlists')
                .delete()
                .in('id', toDelete);
            
            if (deleteError) {
                console.error('Error deleting setlists:', deleteError);
            }
        }
        
        // Upsert current setlists
        const setlistsArray = Object.keys(setlists).map(id => ({
            id: id,
            name: setlists[id].name,
            songs: setlists[id].songs,
            created: setlists[id].created
        }));
        
        if (setlistsArray.length > 0) {
            const { error: upsertError } = await supabase
                .from('setlists')
                .upsert(setlistsArray);
            
            if (upsertError) {
                console.error('Error saving setlists:', upsertError);
            } else {
                console.log('Setlists saved successfully');
            }
        }
    } catch (error) {
        console.error('Error saving setlists:', error);
    }
}

// Create new setlist
async function createSetlist(e) {
    e.preventDefault();
    const setlistName = newListInput.value.trim();
    if (!setlistName) return;

    const setlistId = Date.now().toString();
    setlists[setlistId] = {
        name: setlistName,
        songs: [],
        created: Date.now()
    };

    await saveSetlists();
    renderSetlists();
    newListInput.value = '';
    newListInput.focus();
}

// Render all setlists
function renderSetlists() {
    const setlistIds = Object.keys(setlists);
    
    if (setlistIds.length === 0) {
        noListsState.style.display = 'block';
        listsGrid.innerHTML = '';
        return;
    }

    noListsState.style.display = 'none';
    listsGrid.innerHTML = '';

    // Sort setlists by creation time (oldest first)
    setlistIds.sort((a, b) => setlists[a].created - setlists[b].created);

    setlistIds.forEach(setlistId => {
        const setlist = setlists[setlistId];
        const setlistCard = document.createElement('div');
        setlistCard.className = 'list-card';
        
        const setlistContent = document.createElement('div');
        setlistContent.className = 'list-card-content';
        
        const h3 = document.createElement('h3');
        h3.textContent = setlist.name;
        
        const p = document.createElement('p');
        p.textContent = `${setlist.songs.length} songs`;
        
        setlistContent.appendChild(h3);
        setlistContent.appendChild(p);
        setlistContent.addEventListener('click', () => showSetlistView(setlistId));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'list-delete-btn';
        deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-label="Delete"><path d="M3 6h18" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M8 6v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#fff" stroke-width="2" stroke-linecap="round"/><rect x="5" y="6" width="14" height="14" rx="2" fill="none" stroke="#fff" stroke-width="2"/><path d="M10 11v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M14 11v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${setlist.name}"?`)) {
                delete setlists[setlistId];
                await saveSetlists();
                renderSetlists();
            }
        });
        
        setlistCard.appendChild(setlistContent);
        setlistCard.appendChild(deleteBtn);
        listsGrid.appendChild(setlistCard);
    });
}

// Show setlists overview
function showListsView() {
    listsView.classList.remove('hidden');
    listView.classList.add('hidden');
    currentListId = null;
    renderSetlists();
}

// Show individual setlist
function showSetlistView(setlistId) {
    currentListId = setlistId;
    const setlist = setlists[setlistId];
    
    listTitle.textContent = setlist.name;
    listsView.classList.add('hidden');
    listView.classList.remove('hidden');
    
    renderSongs();
    todoInput.focus();
}

// Save setlist title
async function saveSetlistTitle() {
    if (!currentListId) return;
    const newTitle = listTitle.textContent.trim();
    if (newTitle) {
        setlists[currentListId].name = newTitle;
        await saveSetlists();
    }
}

// Handle title keydown
function handleTitleKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        listTitle.blur();
    }
}

// Add song to current setlist
async function addSong(e) {
    e.preventDefault();
    if (!currentListId) return;
    
    const song = todoInput.value.trim();
    if (!song) return;

    // Add new song to the end
    setlists[currentListId].songs.push(song);
    await saveSetlists();
    renderSongs();
    todoInput.value = '';
    todoInput.focus();
}

// Render songs in current setlist
function renderSongs() {
    if (!currentListId) return;
    
    const setlist = setlists[currentListId];
    todoList.innerHTML = '';
    
    if (setlist.songs.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    
    // Display songs in their current order
    setlist.songs.forEach((song, index) => {
        const li = document.createElement('li');
        li.dataset.index = index;
        
        // Left side - Up button
        const leftButtons = document.createElement('div');
        leftButtons.className = 'move-buttons';
        
        const upBtn = document.createElement('button');
        upBtn.className = 'move-btn';
        upBtn.innerHTML = '↑';
        upBtn.title = 'Move up';
        upBtn.disabled = index === 0;
        upBtn.addEventListener('click', () => moveSong(index, index - 1));
        leftButtons.appendChild(upBtn);
        
        li.appendChild(leftButtons);
        
        // Center - Song name
        const span = document.createElement('span');
        span.textContent = song;
        li.appendChild(span);
        
        // Right side - Down button  
        const rightButtons = document.createElement('div');
        rightButtons.className = 'move-buttons';
        
        const downBtn = document.createElement('button');
        downBtn.className = 'move-btn';
        downBtn.innerHTML = '↓';
        downBtn.title = 'Move down';
        downBtn.disabled = index === setlist.songs.length - 1;
        downBtn.addEventListener('click', () => moveSong(index, index + 1));
        rightButtons.appendChild(downBtn);
        
        li.appendChild(rightButtons);
        
        // Right-click context menu
        li.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, song, index);
        });
        
        // Swipe to delete event listeners (keep for mobile)
        addSwipeToDeleteListeners(li, song, index);
        
        todoList.appendChild(li);
    });
}

// Move song up or down
async function moveSong(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= setlists[currentListId].songs.length) return;
    
    const songs = setlists[currentListId].songs;
    const song = songs[fromIndex];
    
    // Remove from old position
    songs.splice(fromIndex, 1);
    
    // Insert at new position
    songs.splice(toIndex, 0, song);
    
    await saveSetlists();
    renderSongs();
}

// Show context menu
function showContextMenu(event, song, index) {
    // Remove existing context menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create context menu
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    
    // Delete option
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item delete';
    deleteItem.textContent = 'Delete';
    deleteItem.addEventListener('click', () => {
        deleteSong(song, index);
        contextMenu.remove();
    });
    
    contextMenu.appendChild(deleteItem);
    
    // Position menu
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
    
    // Add to document
    document.body.appendChild(contextMenu);
    
    // Remove menu when clicking elsewhere
    const removeMenu = (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.remove();
            document.removeEventListener('click', removeMenu);
        }
    };
    
    // Add click listener after a brief delay to prevent immediate removal
    setTimeout(() => {
        document.addEventListener('click', removeMenu);
    }, 10);
}

// Add swipe to delete functionality
function addSwipeToDeleteListeners(element, song, index) {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isDragging = false;
    let isVerticalScroll = false;
    
    // Touch events for mobile
    element.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isDragging = true;
        isVerticalScroll = false;
        element.classList.add('swiping');
    });
    
    element.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        
        // Determine if this is a vertical scroll
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
            isVerticalScroll = true;
            element.classList.remove('swiping');
            element.style.transform = '';
            return;
        }
        
        // Prevent vertical scrolling during horizontal swipe
        if (Math.abs(deltaX) > 10 && !isVerticalScroll) {
            e.preventDefault();
        }
        
        // Only allow left swipe (negative deltaX)
        if (deltaX < 0 && !isVerticalScroll) {
            element.style.transform = `translateX(${deltaX}px)`;
            
            // Change background color when swiping far enough
            if (Math.abs(deltaX) > 100) {
                element.classList.add('swipe-left');
            } else {
                element.classList.remove('swipe-left');
            }
        }
    });
    
    element.addEventListener('touchend', (e) => {
        if (!isDragging || isVerticalScroll) return;
        
        const deltaX = currentX - startX;
        
        // Delete if swiped left more than 100px
        if (Math.abs(deltaX) > 100 && deltaX < 0) {
            deleteSong(song, index);
        } else {
            // Reset position
            element.style.transform = '';
            element.classList.remove('swipe-left');
        }
        
        element.classList.remove('swiping');
        isDragging = false;
    });
}

// Delete song function
async function deleteSong(song, index) {
    setlists[currentListId].songs.splice(index, 1);
    await saveSetlists();
    renderSongs();
    showUndo(song, index);
}

// Show undo notification
function showUndo(song, index) {
    try {
        clearTimeout(undoTimeout);
        lastDeleted = { item: song, index };
        
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
        // Restore song at its original position
        setlists[currentListId].songs.splice(index, 0, item);
        await saveSetlists();
        renderSongs();
        
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

// Cleanup real-time connection when page unloads
window.addEventListener('beforeunload', () => {
    if (realtimeChannel) {
        realtimeChannel.unsubscribe();
        console.log('Real-time connection closed');
    }
});

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForSupabase);
} else {
    waitForSupabase();
}
