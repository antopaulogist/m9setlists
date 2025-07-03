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
function init() {
    loadLists();
    showListsView();
    bindEvents();
}

// Event listeners
function bindEvents() {
    newListForm.addEventListener('submit', createList);
    backBtn.addEventListener('click', showListsView);
    listTitle.addEventListener('blur', saveListTitle);
    listTitle.addEventListener('keydown', handleTitleKeydown);
    todoForm.addEventListener('submit', addItem);
}

// Load lists from localStorage
function loadLists() {
    try {
        const savedLists = localStorage.getItem('allLists');
        if (savedLists) {
            lists = JSON.parse(savedLists);
        } else {
            // Check for old format data and migrate
            const oldItems = localStorage.getItem('shoppingItems');
            if (oldItems) {
                const items = JSON.parse(oldItems);
                if (items.length > 0) {
                    // Create a "Shopping List" from old data
                    const listId = Date.now().toString();
                    lists[listId] = {
                        name: 'Shopping List',
                        items: items,
                        created: Date.now()
                    };
                    saveLists();
                    // Remove old data
                    localStorage.removeItem('shoppingItems');
                }
            }
        }
    } catch (error) {
        console.error('Error loading lists:', error);
        lists = {};
    }
}

// Save lists to localStorage
function saveLists() {
    try {
        localStorage.setItem('allLists', JSON.stringify(lists));
    } catch (error) {
        console.error('Error saving lists:', error);
    }
}

// Create new list
function createList(e) {
    e.preventDefault();
    const listName = newListInput.value.trim();
    if (!listName) return;

    const listId = Date.now().toString();
    lists[listId] = {
        name: listName,
        items: [],
        created: Date.now()
    };

    saveLists();
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
        listContent.innerHTML = `
            <h3>${list.name}</h3>
            <p>${list.items.length} items</p>
        `;
        listContent.addEventListener('click', () => showListView(listId));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'list-delete-btn';
        deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-label="Delete"><path d="M3 6h18" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M8 6v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#fff" stroke-width="2" stroke-linecap="round"/><rect x="5" y="6" width="14" height="14" rx="2" fill="none" stroke="#fff" stroke-width="2"/><path d="M10 11v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M14 11v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${list.name}"?`)) {
                delete lists[listId];
                saveLists();
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
function saveListTitle() {
    if (!currentListId) return;
    const newTitle = listTitle.textContent.trim();
    if (newTitle) {
        lists[currentListId].name = newTitle;
        saveLists();
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
function addItem(e) {
    e.preventDefault();
    if (!currentListId) return;
    
    const item = todoInput.value.trim();
    if (!item) return;

    // Add new item to the end (it will appear at top due to reverse display)
    lists[currentListId].items.push(item);
    saveLists();
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
    delBtn.onclick = function() {
        lists[currentListId].items.splice(index, 1);
        saveLists();
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
function undoDelete() {
    if (!lastDeleted || !currentListId) return;
    
    try {
        const { item, index } = lastDeleted;
        // Restore item at its original position
        lists[currentListId].items.splice(index, 0, item);
        saveLists();
        renderListItems();
        
        document.getElementById('undo-div').style.display = 'none';
        lastDeleted = null;
    } catch (error) {
        console.error('Error during undo:', error);
    }
}

// Initialize app
init();
