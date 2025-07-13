// Supabase Configuration
// NOTE: These credentials are safe to be public - the anon key is designed for client-side use
// and access is controlled by Row Level Security policies in the database
const SUPABASE_URL = 'https://ktmgctbcyerflzipmgpi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bWdjdGJjeWVyZmx6aXBtZ3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MTMwOTQsImV4cCI6MjA2NzI4OTA5NH0.MzJqbSBvCqIJfTakgB2B9LcGfoyrlg92FwXm1Wjv9J4';

// Initialize Supabase (will be loaded from CDN)
let supabase;

// DOM Elements
const navTabs = document.querySelectorAll('.nav-tab');

// Global UI Elements
const globalError = document.getElementById('global-error');
const errorMessage = document.getElementById('error-message');
const globalSuccess = document.getElementById('global-success');
const successMessage = document.getElementById('success-message');
const loadingOverlay = document.getElementById('loading-overlay');

// Form Elements
const newSetlistInput = document.getElementById('new-setlist-input');
const newSongInput = document.getElementById('new-song-input');
const songMinutes = document.getElementById('song-minutes');
const songSeconds = document.getElementById('song-seconds');
const songSearch = document.getElementById('song-search');

// View-specific Elements
const setlistsView = document.getElementById('setlists-view');
const setlistsLoading = document.getElementById('setlists-loading');
const setlistsGrid = document.getElementById('setlists-grid');
const songsView = document.getElementById('songs-view');
const songsLoading = document.getElementById('songs-loading');
const songsList = document.getElementById('songs-list');
const builderView = document.getElementById('setlist-builder-view');
const setlistView = document.getElementById('setlist-view');
const previewList = document.getElementById('preview-list');
const availableSongs = document.getElementById('available-songs');
const builderTitle = document.getElementById('builder-title');
const setlistTitle = document.getElementById('setlist-title');
const setlistDuration = document.getElementById('setlist-duration');
const setlistSongs = document.getElementById('setlist-songs');
const emptySetlistState = document.getElementById('empty-setlist-state');
const noSetlistsState = document.getElementById('no-setlists-state');
const noSongsState = document.getElementById('no-songs-state');
const totalDurationEl = document.getElementById('total-duration');
const undoDiv = document.getElementById('undo-div');

// State
let currentView = 'setlists';
let currentSetlistId = null;
let builderSetlistId = null;
let builderSongs = [];
let setlists = {};
let songs = {};
let lastDeleted = null;
let undoTimeout = null;
let realtimeChannel = null;
let draggedElement = null;
let draggedFromIndex = null;
let placeholder = null;

// Search debounce
let searchTimeout = null;

// Performance optimization variables
let updateTimeout = null;
let pendingUpdates = new Set();



// Initialize app
async function init() {
    try {
        showLoading(true);
        
        // Initialize Supabase
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase initialized successfully');
        
        await loadData();
        setupRealTimeSync();
        bindEvents();
        showView('setlists');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showError('Failed to load application. Please refresh the page.');
    } finally {
        showLoading(false);
    }
}

// UI Feedback Functions
function showError(message, duration = 5000) {
    const errorEl = document.getElementById('global-error');
    const messageEl = document.getElementById('error-message');
    if (!errorEl || !messageEl) return;
    
    messageEl.textContent = message;
    errorEl.style.display = 'flex';
    
    // Auto-hide after duration
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, duration);
}

function showSuccess(message) {
    successMessage.textContent = message;
    globalSuccess.style.display = 'block';
    // Auto-hide after 3 seconds
    setTimeout(() => {
        globalSuccess.style.display = 'none';
    }, 3000);
}

function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

function showViewLoading(viewType, show) {
    if (viewType === 'setlists' && setlistsLoading && setlistsGrid) {
        setlistsLoading.classList.toggle('hidden', !show);
        setlistsGrid.classList.toggle('hidden', show);
    } else if (viewType === 'songs' && songsLoading && songsList) {
        songsLoading.classList.toggle('hidden', !show);
        songsList.classList.toggle('hidden', show);
    }
}

function showConfirmation(message, onConfirm) {
    if (confirm(message)) {
        onConfirm();
    }
}

// Drag and Drop Handlers
function handleDragStart(e) {
    const item = e.target.closest('.builder-preview-item');
    if (!item) return;
    
    dragSource = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.index);
}

function handleDragEnd(e) {
    if (!dragSource) return;
    
    dragSource.classList.remove('dragging');
    document.querySelectorAll('.builder-preview-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    dragSource = null;
}

function handleDragOver(e) {
    e.preventDefault();
    const item = e.target.closest('.builder-preview-item');
    if (!item || item === dragSource) return;
    
    e.dataTransfer.dropEffect = 'move';
    item.classList.add('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    const dropTarget = e.target.closest('.builder-preview-item');
    if (!dropTarget || !dragSource || dropTarget === dragSource) return;
    
    const fromIndex = parseInt(dragSource.dataset.index);
    const toIndex = parseInt(dropTarget.dataset.index);
    
    // Reorder builderSongs array
    const [movedSong] = builderSongs.splice(fromIndex, 1);
    builderSongs.splice(toIndex, 0, movedSong);
    
    // Update UI
    renderPreviewList();
    updateBuilderDuration();
}

// Event listeners
function bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            showView(view);
        });
    });

    // Setlists
    document.getElementById('new-setlist-form')?.addEventListener('submit', createSetlist);
    document.getElementById('back-btn')?.addEventListener('click', () => showView('setlists'));
    document.getElementById('setlist-title')?.addEventListener('blur', saveSetlistTitle);
    document.getElementById('setlist-title')?.addEventListener('keydown', handleTitleKeydown);

    // Songs
    document.getElementById('new-song-form')?.addEventListener('submit', addSong);
    
    // Builder
    const builderBackBtn = document.getElementById('builder-back-btn');
    const saveSetlistBtn = document.getElementById('save-setlist-btn');
    const previewList = document.getElementById('preview-list');
    
    if (builderBackBtn) {
        builderBackBtn.addEventListener('click', () => {
            showView('setlists');
        });
    }
    
    if (saveSetlistBtn) {
        saveSetlistBtn.addEventListener('click', saveBuilderSetlist);
    }
    
    if (songSearch) {
        songSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filterAvailableSongs(e.target.value);
            }, 300); // 300ms debounce
        });
    }
    
    if (previewList) {
        // Make the preview list items draggable when rendered
        renderPreviewList();
    }
}

function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + 1 = Setlists view
    if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        showView('setlists');
    }
    // Ctrl/Cmd + 2 = Songs view
    if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        showView('songs');
    }
    // Escape = Close current view/modal
    if (e.key === 'Escape') {
        if (currentView === 'setlist' || currentView === 'builder') {
            showView('setlists');
        }
    }
}

// Navigation
function showView(viewName) {
    // Update navigation
    navTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });

    // Show selected view
    currentView = viewName;
    switch (viewName) {
        case 'setlists':
            setlistsView.classList.remove('hidden');
            renderSetlists();
            break;
        case 'songs':
            songsView.classList.remove('hidden');
            renderSongs();
            break;
        case 'setlist':
            setlistView.classList.remove('hidden');
            renderSetlistView();
            break;
        case 'builder':
            builderView.classList.remove('hidden');
            renderBuilderView();
            break;
    }
}

// Load all data from Supabase
async function loadData() {
    if (!supabase) {
        showError('Database connection failed. Please check your internet connection and refresh the page.');
        return;
    }
    
    try {
        showViewLoading('setlists', true);
        // Load setlists
        const { data: setlistsData, error: setlistsError } = await supabase
            .from('setlists')
            .select('*');
        
        if (setlistsError) {
            console.error('Error loading setlists:', setlistsError);
            showError('Failed to load setlists. Please check your internet connection and refresh the page.');
            return;
        }

        setlists = {};
        setlistsData.forEach(setlist => {
            setlists[setlist.id] = {
                name: setlist.name,
                song_ids: setlist.song_ids || [],
                total_duration_minutes: setlist.total_duration_minutes || 0,
                created: setlist.created
            };
        });

        showViewLoading('setlists', false);
        showViewLoading('songs', true);
        
        // Load songs
        const { data: songsData, error: songsError } = await supabase
            .from('songs')
            .select('*');
        
        if (songsError) {
            console.error('Error loading songs:', songsError);
            showError('Failed to load songs. Please check your internet connection and refresh the page.');
            return;
        }

        songs = {};
        songsData.forEach(song => {
            songs[song.id] = {
                title: song.title,
                duration_minutes: song.duration_minutes || 0,
                duration_seconds: song.duration_seconds || 0,
                category: song.category || 'general',
                notes: song.notes || '',
                created: song.created
            };
        });

        showViewLoading('songs', false);
        console.log('Data loaded successfully');
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load data. Please check your internet connection and refresh the page.');
    }
}

// Setup real-time synchronization
function setupRealTimeSync() {
    if (!supabase) {
        console.error('Supabase not initialized for real-time');
        return;
    }
    
    try {
        // Create channels for both tables
        realtimeChannel = supabase
            .channel('data_changes')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'setlists' }, 
                handleSetlistChange
            )
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'songs' }, 
                handleSongChange
            )
            .subscribe((status) => {
                console.log('Real-time subscription status:', status);
            });
            
        console.log('Real-time sync enabled');
    } catch (error) {
        console.error('Error setting up real-time sync:', error);
    }
}

// Handle real-time setlist changes
function handleSetlistChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
        case 'INSERT':
            setlists[newRecord.id] = {
                name: newRecord.name,
                song_ids: newRecord.song_ids || [],
                total_duration_minutes: newRecord.total_duration_minutes || 0,
                created: newRecord.created
            };
            break;
            
        case 'UPDATE':
            if (setlists[newRecord.id]) {
                setlists[newRecord.id] = {
                    name: newRecord.name,
                    song_ids: newRecord.song_ids || [],
                    total_duration_minutes: newRecord.total_duration_minutes || 0,
                    created: newRecord.created
                };
            }
            break;
            
        case 'DELETE':
            if (oldRecord && setlists[oldRecord.id]) {
                delete setlists[oldRecord.id];
                if (currentSetlistId === oldRecord.id) {
                    showView('setlists');
                }
            }
            break;
    }
    
    updateCurrentView();
}

// Handle real-time song changes
function handleSongChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
        case 'INSERT':
            songs[newRecord.id] = {
                title: newRecord.title,
                duration_minutes: newRecord.duration_minutes || 0,
                duration_seconds: newRecord.duration_seconds || 0,
                category: newRecord.category || 'general',
                notes: newRecord.notes || '',
                created: newRecord.created
            };
            break;
            
        case 'UPDATE':
            if (songs[newRecord.id]) {
                songs[newRecord.id] = {
                    title: newRecord.title,
                    duration_minutes: newRecord.duration_minutes || 0,
                    duration_seconds: newRecord.duration_seconds || 0,
                    category: newRecord.category || 'general',
                    notes: newRecord.notes || '',
                    created: newRecord.created
                };
            }
            break;
            
        case 'DELETE':
            if (oldRecord && songs[oldRecord.id]) {
                delete songs[oldRecord.id];
            }
            break;
    }
    
    updateCurrentView();
}

// Update current view
function updateCurrentView() {
    setTimeout(() => {
        switch (currentView) {
            case 'setlists':
                renderSetlists();
                break;
            case 'songs':
                renderSongs();
                break;
            case 'setlist':
                renderSetlistView();
                break;
            case 'builder':
                renderBuilderView();
                break;
        }
    }, 100);
}

// Create new setlist
async function createSetlist(e) {
    e.preventDefault();
    const setlistName = newSetlistInput.value.trim();
    if (!setlistName) return;

    const setlistId = Date.now().toString();
    const newSetlist = {
        id: setlistId,
        name: setlistName,
        song_ids: [],
        total_duration_minutes: 0,
        created: Date.now()
    };

    try {
        const { error } = await supabase
            .from('setlists')
            .insert([newSetlist]);

        if (error) {
            console.error('Error creating setlist:', error);
            showError('Failed to create setlist.');
        } else {
            setlists[setlistId] = {
                name: setlistName,
                song_ids: [],
                total_duration_minutes: 0,
                created: Date.now()
            };
            renderSetlists();
            newSetlistInput.value = '';
            newSetlistInput.focus();
            showSuccess('Setlist created successfully!');
        }
    } catch (error) {
        console.error('Error creating setlist:', error);
        showError('Failed to create setlist.');
    }
}

// Render setlists
function renderSetlists() {
    const setlistIds = Object.keys(setlists);
    
    if (setlistIds.length === 0) {
        noSetlistsState.style.display = 'block';
        setlistsGrid.innerHTML = '';
        return;
    }

    noSetlistsState.style.display = 'none';
    setlistsGrid.innerHTML = '';

    // Sort setlists by creation time (oldest first)
    setlistIds.sort((a, b) => setlists[a].created - setlists[b].created);

    setlistIds.forEach(setlistId => {
        const setlist = setlists[setlistId];
        const setlistCard = document.createElement('div');
        setlistCard.className = 'setlist-card';
        
        const setlistContent = document.createElement('div');
        setlistContent.className = 'setlist-card-content';
        
        const h3 = document.createElement('h3');
        h3.textContent = setlist.name;
        
        const p = document.createElement('p');
        const songCount = setlist.song_ids.length;
        const duration = formatDuration(setlist.total_duration_minutes);
        p.textContent = `${songCount} songs • ${duration}`;
        
        setlistContent.appendChild(h3);
        setlistContent.appendChild(p);
        setlistContent.addEventListener('click', () => showSetlistView(setlistId));
        
        // Actions container
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'setlist-actions';
        
        // Build button
        const buildBtn = document.createElement('button');
        buildBtn.className = 'setlist-build-btn';
        buildBtn.textContent = 'Build';
        buildBtn.title = 'Add songs to this setlist';
        buildBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showBuilderView(setlistId);
        });
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'setlist-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${setlist.name}"?`)) {
                await deleteSetlist(setlistId);
            }
        });
        
        actionsContainer.appendChild(buildBtn);
        actionsContainer.appendChild(deleteBtn);
        
        setlistCard.appendChild(setlistContent);
        setlistCard.appendChild(actionsContainer);
        setlistsGrid.appendChild(setlistCard);
    });
}

// Add new song
async function addSong(e) {
    e.preventDefault();
    const title = newSongInput.value.trim();
    const minutes = parseInt(songMinutes.value) || 0;
    const seconds = parseInt(songSeconds.value) || 0;
    
    if (!title) return;

    const songId = Date.now().toString();
    const newSong = {
        id: songId,
        title: title,
        duration_minutes: minutes,
        duration_seconds: seconds,
        category: 'general',
        notes: '',
        created: Date.now()
    };

    try {
        const { error } = await supabase
            .from('songs')
            .insert([newSong]);

        if (error) {
            console.error('Error adding song:', error);
            showError('Failed to add song.');
        } else {
            songs[songId] = {
                title: title,
                duration_minutes: minutes,
                duration_seconds: seconds,
                category: 'general',
                notes: '',
                created: Date.now()
            };
            renderSongs();
            newSongInput.value = '';
            songMinutes.value = '';
            songSeconds.value = '';
            newSongInput.focus();
            showSuccess('Song added successfully!');
        }
    } catch (error) {
        console.error('Error adding song:', error);
        showError('Failed to add song.');
    }
}

// Render songs
function renderSongs() {
    const songIds = Object.keys(songs);
    
    if (songIds.length === 0) {
        noSongsState.style.display = 'block';
        songsList.innerHTML = '';
        return;
    }

    noSongsState.style.display = 'none';
    songsList.innerHTML = '';

    // Sort songs alphabetically
    songIds.sort((a, b) => songs[a].title.localeCompare(songs[b].title));

    songIds.forEach(songId => {
        const song = songs[songId];
        const songItem = document.createElement('div');
        songItem.className = 'song-item';
        
        const songInfo = document.createElement('div');
        songInfo.className = 'song-info';
        
        const songTitle = document.createElement('div');
        songTitle.className = 'song-title';
        songTitle.textContent = song.title;
        
        const songDuration = document.createElement('div');
        songDuration.className = 'song-duration';
        songDuration.textContent = formatSongDuration(song.duration_minutes, song.duration_seconds);
        
        songInfo.appendChild(songTitle);
        songInfo.appendChild(songDuration);
        
        const songActions = document.createElement('div');
        songActions.className = 'song-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'song-action-btn delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            showConfirmation(`Are you sure you want to delete "${song.title}"?`, () => {
                deleteSong(songId);
            });
        });
        
        songActions.appendChild(deleteBtn);
        
        songItem.appendChild(songInfo);
        songItem.appendChild(songActions);
        songsList.appendChild(songItem);
    });
}

// Show setlist view
function showSetlistView(setlistId) {
    currentSetlistId = setlistId;
    showView('setlist');
}

// Show builder view
function showBuilderView(setlistId) {
    builderSetlistId = setlistId;
    builderSongs = [...(setlists[setlistId]?.song_ids || [])];
    showView('builder');
}

// Render setlist view
function renderSetlistView() {
    if (!currentSetlistId || !setlists[currentSetlistId]) {
        showView('setlists');
        return;
    }

    const setlist = setlists[currentSetlistId];
    setlistTitle.textContent = setlist.name;
    
    // Calculate and display total duration (exact calculation)
    const totalDuration = calculateSetlistDurationExact(setlist.song_ids);
    setlistDuration.textContent = formatDurationExact(totalDuration);
    
    if (setlist.song_ids.length === 0) {
        emptySetlistState.style.display = 'block';
        setlistSongs.innerHTML = '';
        return;
    }

    emptySetlistState.style.display = 'none';
    
    // Clear and rebuild the list
    setlistSongs.innerHTML = '';
    
    setlist.song_ids.forEach((songId, index) => {
        const song = songs[songId];
        if (!song) return; // Song might have been deleted
        
        const li = createSetlistItem(song, index);
        setlistSongs.appendChild(li);
    });
}

function createSetlistItem(song, index) {
    const li = document.createElement('li');
    li.className = 'setlist-song-item';
    li.draggable = true;
    li.dataset.index = index;
    
    // Left drag handle
    const leftDragHandle = document.createElement('div');
    leftDragHandle.className = 'drag-handle left-handle';
    leftDragHandle.innerHTML = '⋮⋮';
    leftDragHandle.title = 'Drag to reorder';
    
    const songInfo = document.createElement('div');
    songInfo.className = 'song-info';
    songInfo.innerHTML = `${song.title}`;
    
    // Right drag handle
    const rightDragHandle = document.createElement('div');
    rightDragHandle.className = 'drag-handle right-handle';
    rightDragHandle.innerHTML = '⋮⋮';
    rightDragHandle.title = 'Drag to reorder';
    
    li.appendChild(leftDragHandle);
    li.appendChild(songInfo);
    li.appendChild(rightDragHandle);
    
    // Add event listeners directly to each item
    li.addEventListener('dragstart', handleSetlistDragStart);
    li.addEventListener('dragend', handleSetlistDragEnd);
    li.addEventListener('dragover', handleSetlistDragOver);
    li.addEventListener('drop', handleSetlistDrop);
    
    // Add touch support for mobile
    li.addEventListener('touchstart', handleTouchStart, { passive: false });
    li.addEventListener('touchmove', handleTouchMove, { passive: false });
    li.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    return li;
}

// Setlist drag and drop handlers
function handleSetlistDragStart(e) {
    const item = e.target.closest('.setlist-song-item');
    const dragHandle = e.target.closest('.drag-handle');
    
    // Only allow dragging if the drag handle was clicked
    if (!item || !dragHandle) {
        e.preventDefault();
        return;
    }
    
    draggedElement = item;
    draggedFromIndex = parseInt(item.dataset.index);
    item.classList.add('dragging');
    
    // Create placeholder
    placeholder = document.createElement('li');
    placeholder.className = 'setlist-song-item placeholder';
    placeholder.style.height = item.offsetHeight + 'px';
    placeholder.style.background = 'transparent';
    placeholder.style.border = '2px dashed #ccc';
    placeholder.style.opacity = '0.5';
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
}

function handleSetlistDragEnd(e) {
    const item = e.target.closest('.setlist-song-item');
    if (!item) return;
    
    item.classList.remove('dragging');
    
    // Remove placeholder if it exists
    if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
    }
    
    draggedElement = null;
    draggedFromIndex = null;
    placeholder = null;
}

function handleSetlistDragOver(e) {
    e.preventDefault();
    if (!draggedElement) return;
    
    const item = e.target.closest('.setlist-song-item');
    if (!item || item === draggedElement || item === placeholder) return;
    
    e.dataTransfer.dropEffect = 'move';
    
    // Get drop position
    const rect = item.getBoundingClientRect();
    const mouseY = e.clientY;
    const itemCenterY = rect.top + rect.height / 2;
    const isAbove = mouseY < itemCenterY;
    
    // Insert placeholder in the correct position
    const container = setlistSongs;
    if (isAbove) {
        container.insertBefore(placeholder, item);
    } else {
        container.insertBefore(placeholder, item.nextSibling);
    }
}



async function handleSetlistDrop(e) {
    e.preventDefault();
    if (!draggedElement || !placeholder) return;
    
    // Get the new position from placeholder
    const container = setlistSongs;
    const items = Array.from(container.children);
    const placeholderIndex = items.indexOf(placeholder);
    
    // Calculate the new index (accounting for placeholder)
    let newIndex = placeholderIndex;
    if (placeholderIndex > draggedFromIndex) {
        newIndex = placeholderIndex - 1;
    }
    
    // Don't do anything if dropping in the same position
    if (newIndex === draggedFromIndex) {
        return;
    }
    
    // Update the song order in data
    const songIds = [...setlists[currentSetlistId].song_ids];
    const [movedSong] = songIds.splice(draggedFromIndex, 1);
    songIds.splice(newIndex, 0, movedSong);
    
    // Update local state
    setlists[currentSetlistId].song_ids = songIds;
    
    // Update database with debouncing
    debouncedUpdateSetlist(currentSetlistId);
    
    // Re-render the list with new order
    renderSetlistView();
}

// Touch event handlers for mobile support
let touchStartY = 0;
let touchStartX = 0;
let touchCurrentY = 0;
let touchItem = null;
let touchStartIndex = 0;
let isDragging = false;
let dragStarted = false;
let touchStartTime = 0;
let longPressTimer = null;

function handleTouchStart(e) {
    const item = e.target.closest('.setlist-song-item');
    const dragHandle = e.target.closest('.drag-handle');
    
    // Only allow dragging if the drag handle was touched
    if (!item || !dragHandle) return;
    
    touchItem = item;
    touchStartIndex = parseInt(item.dataset.index);
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    touchCurrentY = touchStartY;
    touchStartTime = Date.now();
    isDragging = false;
    dragStarted = false;
    
    // Clear any existing timer
    if (longPressTimer) {
        clearTimeout(longPressTimer);
    }
    
    // Start long press timer for drag initiation
    longPressTimer = setTimeout(() => {
        if (touchItem && !dragStarted) {
            touchItem.classList.add('drag-ready');
            setTimeout(() => {
                if (touchItem && !dragStarted) {
                    startDrag();
                }
            }, 100);
        }
    }, 150); // 150ms delay to show ready state
    
    // Don't prevent default yet - let browser handle normal touch
}

function startDrag() {
    if (!touchItem || dragStarted) return;
    
    dragStarted = true;
    isDragging = true;
    
    // Add dragging class and prevent touch highlighting
    touchItem.classList.remove('drag-ready');
    touchItem.classList.add('dragging');
    
    // Create placeholder for touch
    placeholder = document.createElement('li');
    placeholder.className = 'setlist-song-item placeholder';
    placeholder.style.height = touchItem.offsetHeight + 'px';
    placeholder.style.background = 'transparent';
    placeholder.style.border = '2px dashed #ccc';
    placeholder.style.opacity = '0.5';
    
    // Prevent scrolling while dragging
    document.body.style.overflow = 'hidden';
    
    // Add haptic feedback if available
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
}

function handleTouchMove(e) {
    if (!touchItem) return;
    
    touchCurrentY = e.touches[0].clientY;
    const touchCurrentX = e.touches[0].clientX;
    const deltaY = touchCurrentY - touchStartY;
    const deltaX = touchCurrentX - touchStartX;
    
    // Check if this is a scroll gesture (more horizontal than vertical movement)
    const isScrollGesture = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10;
    
    // If it's a scroll gesture, cancel drag
    if (isScrollGesture && !dragStarted) {
        cancelDrag();
        return;
    }
    
    // If we've moved significantly and haven't started dragging, start it
    if (!dragStarted && Math.abs(deltaY) > 10) {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
        }
        startDrag();
    }
    
    // Only handle drag movement if we're actually dragging
    if (!isDragging) return;
    
    // Move the item visually
    touchItem.style.transform = `translateY(${deltaY}px)`;
    touchItem.style.zIndex = '1000';
    
    // Get all setlist items
    const allItems = Array.from(document.querySelectorAll('.setlist-song-item'));
    const touchItemRect = touchItem.getBoundingClientRect();
    const touchCenterY = touchItemRect.top + touchItemRect.height / 2;
    
    // Find the item we should drop on
    let closestItem = null;
    let closestDistance = Infinity;
    
    allItems.forEach(item => {
        if (item === touchItem || item === placeholder) return;
        
        const rect = item.getBoundingClientRect();
        const itemCenterY = rect.top + rect.height / 2;
        const distance = Math.abs(touchCenterY - itemCenterY);
        
        if (distance < closestDistance) {
            closestDistance = distance;
            closestItem = item;
        }
    });
    
    // Move placeholder if we have a valid target
    if (closestItem && closestDistance < 50) {
        const rect = closestItem.getBoundingClientRect();
        const itemCenterY = rect.top + rect.height / 2;
        const isAbove = touchCenterY < itemCenterY;
        
        const container = setlistSongs;
        if (isAbove) {
            container.insertBefore(placeholder, closestItem);
        } else {
            container.insertBefore(placeholder, closestItem.nextSibling);
        }
    }
    
    e.preventDefault();
}

function cancelDrag() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    
    if (touchItem) {
        touchItem.classList.remove('dragging', 'drag-ready');
        touchItem.style.transform = '';
        touchItem.style.zIndex = '';
    }
    
    if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
    }
    
    document.body.style.overflow = '';
    
    touchItem = null;
    isDragging = false;
    dragStarted = false;
    placeholder = null;
}

async function handleTouchEnd(e) {
    if (!touchItem) return;
    
    // Clear any pending long press timer
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    
    // If we were dragging, handle the drop
    if (isDragging && placeholder && placeholder.parentNode) {
        // Get the new position from placeholder
        const container = setlistSongs;
        const items = Array.from(container.children);
        const placeholderIndex = items.indexOf(placeholder);
        
        // Calculate the new index (accounting for placeholder)
        let newIndex = placeholderIndex;
        if (placeholderIndex > touchStartIndex) {
            newIndex = placeholderIndex - 1;
        }
        
        // Update if position changed
        if (newIndex !== touchStartIndex) {
            // Update the song order in data
            const songIds = [...setlists[currentSetlistId].song_ids];
            const [movedSong] = songIds.splice(touchStartIndex, 1);
            songIds.splice(newIndex, 0, movedSong);
            
            // Update local state
            setlists[currentSetlistId].song_ids = songIds;
            
            // Update database with debouncing
            debouncedUpdateSetlist(currentSetlistId);
            
            // Re-render the list with new order
            renderSetlistView();
        }
    }
    
    // Clean up drag state
    if (touchItem) {
        touchItem.classList.remove('dragging', 'drag-ready');
        touchItem.style.transform = '';
        touchItem.style.zIndex = '';
    }
    
    if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
    }
    
    // Re-enable scrolling
    document.body.style.overflow = '';
    
    // Reset all touch variables
    touchItem = null;
    touchStartY = 0;
    touchStartX = 0;
    touchCurrentY = 0;
    touchStartIndex = 0;
    touchStartTime = 0;
    isDragging = false;
    dragStarted = false;
    placeholder = null;
    
    // Don't prevent default to allow normal touch behavior
}

// Render builder view
function renderBuilderView() {
    if (!builderSetlistId || !setlists[builderSetlistId]) {
        showView('setlists');
        return;
    }

    const setlist = setlists[builderSetlistId];
    builderTitle.textContent = `Build: ${setlist.name}`;
    
    // Update total duration
    updateBuilderDuration();
    
    // Render available songs
    renderAvailableSongs();
    
    // Render preview list
    renderPreviewList();
}

// Render available songs
function renderAvailableSongs() {
    availableSongs.innerHTML = '';
    const searchTerm = songSearch?.value?.toLowerCase() || '';
    
    // If no songs in library, show empty state
    if (Object.keys(songs).length === 0) {
        availableSongs.innerHTML = '<div class="empty-state">No songs in library</div>';
        return;
    }

    // Filter songs only if there's a search term
    const filteredSongs = Object.keys(songs).filter(songId => {
        const song = songs[songId];
        return searchTerm === '' || song.title.toLowerCase().includes(searchTerm);
    });
    
    if (filteredSongs.length === 0) {
        availableSongs.innerHTML = '<div class="empty-state">No songs found</div>';
        return;
    }

    // Sort songs alphabetically
    filteredSongs.sort((a, b) => songs[a].title.localeCompare(songs[b].title));

    filteredSongs.forEach(songId => {
        const song = songs[songId];
        const songItem = document.createElement('div');
        songItem.className = 'builder-song-item';
        
        // Check if song is already in setlist
        const isInSetlist = builderSongs.includes(songId);
        if (isInSetlist) {
            songItem.classList.add('in-setlist');
        }
        
        const songInfo = document.createElement('div');
        songInfo.className = 'builder-song-info';
        
        const songTitle = document.createElement('div');
        songTitle.className = 'builder-song-title';
        songTitle.textContent = song.title;
        
        const songDuration = document.createElement('div');
        songDuration.className = 'builder-song-duration';
        songDuration.textContent = formatSongDuration(song.duration_minutes, song.duration_seconds);
        
        songInfo.appendChild(songTitle);
        songInfo.appendChild(songDuration);
        
        // Add button
        const addBtn = document.createElement('button');
        addBtn.className = 'builder-add-btn';
        addBtn.textContent = isInSetlist ? 'Added' : 'Add';
        addBtn.disabled = isInSetlist;
        addBtn.addEventListener('click', () => addSongToBuilder(songId));
        
        songItem.appendChild(songInfo);
        songItem.appendChild(addBtn);
        availableSongs.appendChild(songItem);
    });
}

// Render preview list
function renderPreviewList() {
    if (!previewList) return; // Guard against null previewList
    
    previewList.innerHTML = '';
    
    if (builderSongs.length === 0) {
        previewList.innerHTML = '<div class="empty-state">No songs added to setlist</div>';
        return;
    }

    builderSongs.forEach((songId, index) => {
        const song = songs[songId];
        if (!song) return;
        
        const li = document.createElement('li');
        li.className = 'builder-preview-item';
        li.draggable = true;
        li.dataset.index = index;
        
        // Add drag and drop event listeners directly to the item
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragend', handleDragEnd);
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', handleDrop);
        
        const songInfo = document.createElement('div');
        songInfo.className = 'builder-preview-info';
        
        const songTitle = document.createElement('span');
        songTitle.className = 'builder-preview-title';
        songTitle.textContent = song.title;
        
        const songDuration = document.createElement('span');
        songDuration.className = 'builder-preview-duration';
        songDuration.textContent = formatSongDuration(song.duration_minutes, song.duration_seconds);
        
        songInfo.appendChild(songTitle);
        songInfo.appendChild(songDuration);
        
        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'builder-remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove from setlist';
        removeBtn.addEventListener('click', () => removeSongFromBuilder(index));
        
        li.appendChild(songInfo);
        li.appendChild(removeBtn);
        previewList.appendChild(li);
    });
}

// Add song to builder
function addSongToBuilder(songId) {
    if (!builderSongs.includes(songId)) {
        builderSongs.push(songId);
        updateBuilderDuration();
        renderAvailableSongs();
        renderPreviewList();
    }
}

// Remove song from builder
function removeSongFromBuilder(index) {
    builderSongs.splice(index, 1);
    updateBuilderDuration();
    renderAvailableSongs();
    renderPreviewList();
}

// Update builder duration
function updateBuilderDuration() {
    const totalDuration = calculateSetlistDuration(builderSongs);
    totalDurationEl.textContent = `Total: ${formatDuration(totalDuration)}`;
}

// Filter available songs
function filterAvailableSongs(searchTerm) {
    renderAvailableSongs();
}

// Save builder setlist
async function saveBuilderSetlist() {
    if (!builderSetlistId) return;
    
    // Update the setlist
    setlists[builderSetlistId].song_ids = [...builderSongs];
    
    // Save to database
    await updateSetlist(builderSetlistId);
    
    // Go back to setlists view
    showView('setlists');
    
    // Reset builder state
    builderSetlistId = null;
    builderSongs = [];
}

// Helper functions
function formatDuration(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}h`;
    }
    return `${minutes}:00`;
}

function formatSongDuration(minutes, seconds) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function calculateSetlistDuration(songIds) {
    return songIds.reduce((total, songId) => {
        const song = songs[songId];
        if (song) {
            return total + song.duration_minutes + (song.duration_seconds >= 30 ? 1 : 0);
        }
        return total;
    }, 0);
}

function calculateSetlistDurationExact(songIds) {
    return songIds.reduce((total, songId) => {
        const song = songs[songId];
        if (song) {
            return total + song.duration_minutes + (song.duration_seconds / 60);
        }
        return total;
    }, 0);
}

function formatDurationExact(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.floor(totalMinutes % 60);
    const seconds = Math.round((totalMinutes % 1) * 60);
    
    if (hours > 0) {
        return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${remainingMinutes}:${seconds.toString().padStart(2, '0')}`;
}

// Remove song from setlist function removed - no delete functionality needed

// Database operations
// Debounced update function for better performance
function debouncedUpdateSetlist(setlistId) {
    // Clear any pending timeout
    if (updateTimeout) {
        clearTimeout(updateTimeout);
    }
    
    // Add to pending updates
    pendingUpdates.add(setlistId);
    
    // Set new timeout
    updateTimeout = setTimeout(async () => {
        // Process all pending updates
        const updates = Array.from(pendingUpdates);
        pendingUpdates.clear();
        
        for (const id of updates) {
            await updateSetlist(id);
        }
        
        updateTimeout = null;
    }, 300); // 300ms debounce
}

async function updateSetlist(setlistId) {
    const setlist = setlists[setlistId];
    const totalDuration = calculateSetlistDuration(setlist.song_ids);
    
    try {
        const { error } = await supabase
            .from('setlists')
            .update({
                name: setlist.name,
                song_ids: setlist.song_ids,
                total_duration_minutes: totalDuration
            })
            .eq('id', setlistId);

        if (error) {
            console.error('Error updating setlist:', error);
            showError('Failed to save setlist.');
        } else {
            setlists[setlistId].total_duration_minutes = totalDuration;
        }
    } catch (error) {
        console.error('Error updating setlist:', error);
        showError('Failed to save setlist.');
    }
}

async function deleteSetlist(setlistId) {
    try {
        const { error } = await supabase
            .from('setlists')
            .delete()
            .eq('id', setlistId);

        if (error) {
            console.error('Error deleting setlist:', error);
            showError('Failed to delete setlist.');
        } else {
            delete setlists[setlistId];
            renderSetlists();
        }
    } catch (error) {
        console.error('Error deleting setlist:', error);
        showError('Failed to delete setlist.');
    }
}

async function deleteSong(songId) {
    try {
        const { error } = await supabase
            .from('songs')
            .delete()
            .eq('id', songId);

        if (error) {
            console.error('Error deleting song:', error);
            showError('Failed to delete song.');
        } else {
            delete songs[songId];
            renderSongs();
        }
    } catch (error) {
        console.error('Error deleting song:', error);
        showError('Failed to delete song.');
    }
}

// Save setlist title
async function saveSetlistTitle() {
    if (!currentSetlistId) return;
    const newTitle = setlistTitle.textContent.trim();
    if (newTitle) {
        setlists[currentSetlistId].name = newTitle;
        await updateSetlist(currentSetlistId);
    }
}

// Handle title keydown
function handleTitleKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        setlistTitle.blur();
    }
}

// Undo functionality
function showUndo(undoCallback) {
    if (!undoDiv) return;
    
    // Clear any existing undo timeout
    if (undoTimeout) {
        clearTimeout(undoTimeout);
    }
    
    // Create and show the undo button
    undoDiv.innerHTML = '<button id="undo-btn" class="undo-btn">Undo</button>';
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.onclick = undoCallback;
    }
    
    undoDiv.style.display = 'flex';
    
    // Auto-hide after 5 seconds
    undoTimeout = setTimeout(() => {
        if (undoDiv) {
            undoDiv.style.display = 'none';
        }
    }, 5000);
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
