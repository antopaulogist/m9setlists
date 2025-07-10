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
let selectedSongs = new Set();
let dragSource = null;

// Search debounce
let searchTimeout = null;

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
    if (viewType === 'setlists') {
        setlistsLoading.classList.toggle('hidden', !show);
        setlistsGrid.classList.toggle('hidden', show);
    } else if (viewType === 'songs') {
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

    // Multi-select
    const multiSelectBar = document.getElementById('multi-select-bar');
    const addSelectedBtn = document.getElementById('add-selected-btn');
    if (multiSelectBar && addSelectedBtn) {
        addSelectedBtn.addEventListener('click', addSelectedSongs);
    }
    
    // Builder
    const builderBackBtn = document.getElementById('builder-back-btn');
    const saveSetlistBtn = document.getElementById('save-setlist-btn');
    const songSearch = document.getElementById('song-search');
    const previewList = document.getElementById('preview-list');
    
    if (builderBackBtn) {
        builderBackBtn.addEventListener('click', () => {
            selectedSongs.clear();
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
            setlistBuilderView.classList.remove('hidden');
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
    
    // Calculate and display total duration
    const totalDuration = calculateSetlistDuration(setlist.song_ids);
    setlistDuration.textContent = formatDuration(totalDuration);
    
    setlistSongs.innerHTML = '';
    
    if (setlist.song_ids.length === 0) {
        emptySetlistState.style.display = 'block';
        return;
    }

    emptySetlistState.style.display = 'none';
    
    setlist.song_ids.forEach((songId, index) => {
        const song = songs[songId];
        if (!song) return; // Song might have been deleted
        
        const li = document.createElement('li');
        li.className = 'setlist-song-item';
        li.draggable = true;
        li.dataset.index = index;
        
        const songInfo = document.createElement('div');
        songInfo.className = 'song-info';
        songInfo.innerHTML = `${song.title} <span class="song-duration-display">${formatSongDuration(song.duration_minutes, song.duration_seconds)}</span>`;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove from setlist';
        removeBtn.addEventListener('click', () => removeSongFromSetlist(index));
        
        li.appendChild(songInfo);
        li.appendChild(removeBtn);
        setlistSongs.appendChild(li);
    });

    // Add drag and drop handlers
    setlistSongs.addEventListener('dragstart', handleSetlistDragStart);
    setlistSongs.addEventListener('dragend', handleSetlistDragEnd);
    setlistSongs.addEventListener('dragover', handleSetlistDragOver);
    setlistSongs.addEventListener('drop', handleSetlistDrop);
}

// Setlist drag and drop handlers
function handleSetlistDragStart(e) {
    const item = e.target.closest('.setlist-song-item');
    if (!item) return;
    
    dragSource = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.index);
}

function handleSetlistDragEnd(e) {
    const item = e.target.closest('.setlist-song-item');
    if (!item) return;
    
    item.classList.remove('dragging');
    document.querySelectorAll('.setlist-song-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    dragSource = null;
}

function handleSetlistDragOver(e) {
    e.preventDefault();
    const item = e.target.closest('.setlist-song-item');
    if (!item || item === dragSource) return;
    
    e.dataTransfer.dropEffect = 'move';
    item.classList.add('drag-over');
}

async function handleSetlistDrop(e) {
    e.preventDefault();
    const dropTarget = e.target.closest('.setlist-song-item');
    if (!dropTarget || !dragSource || dropTarget === dragSource) return;
    
    const fromIndex = parseInt(dragSource.dataset.index);
    const toIndex = parseInt(dropTarget.dataset.index);
    
    // Move song in the array
    const setlist = setlists[currentSetlistId];
    const songIds = [...setlist.song_ids];
    const [movedSong] = songIds.splice(fromIndex, 1);
    songIds.splice(toIndex, 0, movedSong);
    
    // Update local state
    setlists[currentSetlistId].song_ids = songIds;
    
    // Update database
    await updateSetlist(currentSetlistId);
    renderSetlistView();
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
    const searchTerm = songSearch.value.toLowerCase();
    
    const filteredSongs = Object.keys(songs).filter(songId => {
        const song = songs[songId];
        return song.title.toLowerCase().includes(searchTerm);
    });
    
    if (filteredSongs.length === 0) {
        availableSongs.innerHTML = '<div class="empty-state">No songs found</div>';
        return;
    }

    filteredSongs.forEach(songId => {
        const song = songs[songId];
        const songItem = document.createElement('div');
        songItem.className = 'builder-song-item';
        
        // Add checkbox for multi-select
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'builder-song-checkbox';
        checkbox.checked = selectedSongs.has(songId);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedSongs.add(songId);
            } else {
                selectedSongs.delete(songId);
            }
            updateSelectedCount();
        });
        
        // Check if song is already in setlist
        const isInSetlist = builderSongs.includes(songId);
        if (isInSetlist) {
            songItem.classList.add('in-setlist');
            checkbox.disabled = true;
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
        
        songItem.appendChild(checkbox);
        songItem.appendChild(songInfo);
        songItem.appendChild(addBtn);
        availableSongs.appendChild(songItem);
    });
}

// Render preview list
function renderPreviewList() {
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

// Remove song from setlist
async function removeSongFromSetlist(index) {
    if (!currentSetlistId) return;
    
    const setlist = setlists[currentSetlistId];
    const removedSongId = setlist.song_ids[index];
    
    setlist.song_ids.splice(index, 1);
    await updateSetlist(currentSetlistId);
    renderSetlistView();
    
    // Show undo notification
    showUndo(() => {
        setlist.song_ids.splice(index, 0, removedSongId);
        updateSetlist(currentSetlistId);
        renderSetlistView();
    });
}

// Database operations
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
    if (!confirm('Are you sure you want to delete this song?')) return;
    
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
    try {
        clearTimeout(undoTimeout);
        
        let undoDiv = document.getElementById('undo-div');
        if (!undoDiv) {
            undoDiv = document.createElement('div');
            undoDiv.id = 'undo-div';
            undoDiv.className = 'undo-notification';
            document.body.appendChild(undoDiv);
        }
        
        undoDiv.innerHTML = '<button id="undo-btn" class="undo-btn">Undo</button>';
        document.getElementById('undo-btn').onclick = undoCallback;
        undoDiv.style.display = 'flex';
        
        undoTimeout = setTimeout(() => {
            undoDiv.style.display = 'none';
        }, 5000);
    } catch (error) {
        console.error('Error showing undo notification:', error);
    }
}

// Multi-select functionality
function addSelectedSongs() {
    selectedSongs.forEach(songId => {
        if (!builderSongs.includes(songId)) {
            builderSongs.push(songId);
        }
    });
    selectedSongs.clear();
    updateBuilderDuration();
    renderAvailableSongs();
    renderPreviewList();
}

function updateSelectedCount() {
    const count = selectedSongs.size;
    selectedCountSpan.textContent = `${count} song${count !== 1 ? 's' : ''} selected`;
    multiSelectBar.classList.toggle('visible', count > 0);
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
