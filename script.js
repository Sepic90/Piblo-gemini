// --- For Firebase JS SDK v7.20.0 and later ---
const firebaseConfig = {
    apiKey: "AIzaSyBzq4vs7hJEqUhqQxj1AJJHhQk8sh4ZEh4",
    authDomain: "piblo-b3172.firebaseapp.com",
    projectId: "piblo-b3172",
    storageBucket: "piblo-b3172.appspot.com",
    messagingSenderId: "975704080999",
    appId: "1:975704080999:web:db73db15db6a5afad70ac2",
    measurementId: "G-1K692JRFE7"
};

// --- INITIALIZE FIREBASE ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentEditEntryId = null;

// --- AUTHENTICATION ---
auth.onAuthStateChanged(user => {
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    if (user) {
        loginContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        initializeAppData();
    } else {
        loginContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        const carListContainer = document.getElementById('car-list-container');
        if (carListContainer) carListContainer.innerHTML = '';
    }
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const loginError = document.getElementById('login-error');
    loginError.textContent = '';
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(err => loginError.textContent = 'Invalid email or password.');
});

document.getElementById('sign-out-btn').addEventListener('click', () => auth.signOut());

// --- APP INITIALIZATION & NAVIGATION ---
function initializeAppData() {
    displayCars();
    populateCarSelect(document.getElementById('entry-car'));
    populateHistorySubmenu();
}

// Populate the history submenu with cars
async function populateHistorySubmenu() {
    if (!auth.currentUser) return;
    const submenu = document.getElementById('history-submenu');
    const snapshot = await db.collection('cars').where('userId', '==', auth.currentUser.uid).orderBy('createdAt', 'desc').get();
    
    if (snapshot.empty) {
        submenu.innerHTML = '<li class="submenu-item no-cars">No cars added yet</li>';
    } else {
        submenu.innerHTML = snapshot.docs.map(doc => {
            const car = doc.data();
            return `<li><a href="#" class="submenu-link" data-car-id="${doc.id}">${car.nickname}</a></li>`;
        }).join('');
        
        // Add click handlers for submenu items
        submenu.querySelectorAll('.submenu-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const carId = e.target.getAttribute('data-car-id');
                showHistoryForCar(carId);
                
                // Update active states
                document.querySelectorAll('.nav-link, .nav-link-parent, .submenu-link').forEach(l => l.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('history-parent').classList.add('active');
                
                // Show entry history page
                document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
                document.getElementById('entry-history').classList.remove('hidden');
                
                const car = snapshot.docs.find(d => d.id === carId).data();
                document.getElementById('page-title').textContent = `${car.nickname} - Service History`;
                
                if (window.innerWidth <= 768) document.querySelector('.sidebar').classList.remove('open');
            });
        });
    }
}

// Toggle submenu
document.getElementById('history-parent').addEventListener('click', (e) => {
    e.preventDefault();
    const submenu = document.getElementById('history-submenu');
    const parent = e.target.closest('.has-submenu');
    parent.classList.toggle('submenu-open');
});

// Regular navigation for other pages
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPageId = e.target.getAttribute('data-page');
        const activePage = document.getElementById(targetPageId);

        document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
        if (activePage) activePage.classList.remove('hidden');

        document.getElementById('page-title').textContent = e.target.textContent;
        document.querySelectorAll('.nav-link, .nav-link-parent, .submenu-link').forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');
        
        // Close submenu
        document.querySelector('.has-submenu').classList.remove('submenu-open');
        
        if (window.innerWidth <= 768) document.querySelector('.sidebar').classList.remove('open');

        if (targetPageId === 'new-entry') { 
            resetNewEntryForm(); 
            populateCarSelect(document.getElementById('entry-car')); 
        }
        if (targetPageId === 'manage-cars') { 
            displayCars(); 
        }
    });
});

document.getElementById('menu-toggle').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
document.querySelector('.nav-link[data-page="manage-cars"]').click();

// --- MANAGE CARS ---
const carModal = document.getElementById('car-modal');
const carForm = document.getElementById('car-form');
const carIdInput = document.getElementById('car-id');
const openCarModal = () => carModal.classList.remove('hidden');
const closeCarModal = () => { carModal.classList.add('hidden'); carForm.reset(); carIdInput.value = ''; };

document.getElementById('add-car-btn').addEventListener('click', () => { document.getElementById('modal-title').textContent = "Add New Car"; openCarModal(); });
document.getElementById('close-modal-btn').addEventListener('click', closeCarModal);
carModal.addEventListener('click', e => { if (e.target === carModal) closeCarModal(); });

carForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveCarBtn = document.getElementById('save-car-btn');
    const isUpdating = !!carIdInput.value;
    saveCarBtn.disabled = true;

    const carData = {
        nickname: carForm['car-nickname'].value,
        year: Number(carForm['car-year'].value),
        make: carForm['car-make'].value,
        model: carForm['car-model'].value,
        variant: carForm['car-variant'].value,
        vin: carForm['car-vin'].value,
        license: carForm['car-license'].value,
        color: carForm['car-color'].value,
        userId: auth.currentUser.uid,
    };
    
    try {
        const photoFile = carForm['car-photo'].files[0];
        if (photoFile) {
            carData.photoURL = await uploadFile(photoFile, `car_photos/${auth.currentUser.uid}/${Date.now()}_${photoFile.name}`);
        }

        if (isUpdating) {
            await db.collection('cars').doc(carIdInput.value).update(carData);
        } else {
            carData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('cars').add(carData);
        }
        closeCarModal();
        displayCars();
        populateHistorySubmenu();
    } catch (error) { console.error("Error saving car: ", error); alert("Failed to save car."); }
    finally { saveCarBtn.disabled = false; }
});

async function displayCars() {
    if (!auth.currentUser) return;
    const carListContainer = document.getElementById('car-list-container');
    const snapshot = await db.collection('cars').where('userId', '==', auth.currentUser.uid).orderBy('createdAt', 'desc').get();
    carListContainer.innerHTML = snapshot.docs.map(doc => {
        const car = { id: doc.id, ...doc.data() };
        return `
            <div class="car-card" style="--car-color: ${car.color};">
                <div class="car-card-image" style="background-image: url('${car.photoURL || 'https://via.placeholder.com/300x200?text=No+Image'}');"></div>
                <div class="car-card-content">
                    <h3>${car.nickname}</h3>
                    <p><strong>${car.year} ${car.make} ${car.model}</strong></p>
                    <p>${car.variant || ''}</p>
                </div>
                <div class="car-card-actions">
                    <button class="btn-edit" onclick="editCar('${car.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteCar('${car.id}', '${car.photoURL || ''}')">Delete</button>
                </div>
            </div>`;
    }).join('');
}

async function editCar(id) {
    const doc = await db.collection('cars').doc(id).get();
    if (!doc.exists) return;
    const car = doc.data();
    document.getElementById('modal-title').textContent = `Edit ${car.nickname}`;
    carIdInput.value = id;
    carForm['car-nickname'].value = car.nickname; 
    carForm['car-year'].value = car.year; 
    carForm['car-make'].value = car.make; 
    carForm['car-model'].value = car.model; 
    carForm['car-variant'].value = car.variant || ''; 
    carForm['car-vin'].value = car.vin || ''; 
    carForm['car-license'].value = car.license || ''; 
    carForm['car-color'].value = car.color || '#3498db';
    openCarModal();
}

async function deleteCar(id, photoURL) {
    if (!confirm('Are you sure you want to delete this car? This will also delete all of its service history and cannot be undone.')) return;
    try {
        if (photoURL) { await storage.refFromURL(photoURL).delete(); }
        await db.collection('cars').doc(id).delete();
        displayCars();
        populateHistorySubmenu();
    } catch (error) { console.error("Error deleting car: ", error); alert("Failed to delete car."); }
}

// --- NEW SERVICE ENTRY & EDIT ---
const newEntryForm = document.getElementById('service-entry-form');
const partsContainer = document.getElementById('parts-container');
const photoPreviewContainer = document.getElementById('photo-preview-container');

function addPartRow() {
    const row = document.createElement('div');
    row.className = 'part-row';
    row.innerHTML = `<input type="text" class="part-description" placeholder="Description"><input type="text" class="part-number" placeholder="Part Number"><input type="number" class="part-quantity" placeholder="Qty"><select class="part-uom"><option>EA</option><option>L</option><option>QT</option><option>KIT</option><option>SET</option></select><button type="button" class="btn-delete-part">&times;</button>`;
    partsContainer.appendChild(row);
}

function resetNewEntryForm() {
    newEntryForm.reset();
    document.getElementById('entry-date').valueAsDate = new Date();
    partsContainer.innerHTML = '';
    addPartRow(); // Add one default part row
    photoPreviewContainer.innerHTML = '';
    currentEditEntryId = null;
    document.getElementById('save-entry-btn').textContent = "Save Entry";
    document.querySelector('#new-entry h2').textContent = "New Service Entry";
}

document.getElementById('add-part-btn').addEventListener('click', () => {
    addPartRow();
});

partsContainer.addEventListener('click', e => { 
    if (e.target.classList.contains('btn-delete-part')) {
        // Only allow deletion if more than one row exists
        if (partsContainer.querySelectorAll('.part-row').length > 1) {
            e.target.closest('.part-row').remove();
        }
    }
});

document.getElementById('entry-photos').addEventListener('change', e => {
    photoPreviewContainer.innerHTML = '';
    Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => photoPreviewContainer.innerHTML += `<div><img src="${ev.target.result}" alt="Photo preview"></div>`;
        reader.readAsDataURL(file);
    });
});

newEntryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-entry-btn');
    const statusContainer = document.getElementById('upload-status-container');
    saveBtn.disabled = true; 
    statusContainer.classList.remove('hidden'); 
    statusContainer.innerHTML = 'Starting...';
    
    const carId = document.getElementById('entry-car').value;
    const partsData = Array.from(document.querySelectorAll('#parts-container .part-row')).map(row => ({ 
        description: row.querySelector('.part-description').value, 
        partNumber: row.querySelector('.part-number').value, 
        quantity: row.querySelector('.part-quantity').value, 
        uom: row.querySelector('.part-uom').value 
    })).filter(part => part.description || part.partNumber); // Only include rows with content
    
    const photoFiles = document.getElementById('entry-photos').files;
    
    try {
        statusContainer.innerHTML = 'Uploading photos...';
        const photoURLs = [];
        for (let i = 0; i < photoFiles.length; i++) {
            const file = photoFiles[i];
            const url = await uploadFile(file, `service_photos/${auth.currentUser.uid}/${carId}/${Date.now()}_${file.name}`, (p) => statusContainer.innerHTML = `Uploading photo ${i+1}/${photoFiles.length}: ${p}%`);
            photoURLs.push(url);
        }

        const entryData = { 
            date: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('entry-date').value)), 
            odometer: Number(newEntryForm['entry-odometer'].value), 
            task: newEntryForm['entry-task'].value, 
            description: newEntryForm['entry-description'].value, 
            oilChanged: newEntryForm['entry-oil-changed'].checked, 
            parts: partsData, 
        };
        
        if (currentEditEntryId) {
            statusContainer.innerHTML = 'Updating entry...';
            const entryRef = db.collection('cars').doc(carId).collection('service_history').doc(currentEditEntryId);
            const existingEntry = await entryRef.get();
            const existingPhotos = existingEntry.data().photos || [];
            entryData.photos = [...existingPhotos, ...photoURLs];
            await entryRef.update(entryData);
        } else {
            statusContainer.innerHTML = 'Saving entry...';
            entryData.photos = photoURLs;
            entryData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('cars').doc(carId).collection('service_history').add(entryData);
        }
        
        statusContainer.innerHTML = '<p style="color: green;">Success!</p>';
        setTimeout(() => {
            statusContainer.classList.add('hidden');
            
            // Trigger the submenu link click for this car
            const submenuLink = document.querySelector(`.submenu-link[data-car-id="${carId}"]`);
            if (submenuLink) {
                submenuLink.click();
            }
        }, 1500);

    } catch (error) { 
        console.error("Error saving service entry: ", error); 
        statusContainer.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`; 
    }
    finally { saveBtn.disabled = false; }
});

// --- ENTRY HISTORY ---
async function showHistoryForCar(carId) {
    const historyDisplayArea = document.getElementById('history-display-area');
    const historyTable = historyDisplayArea.querySelector('.history-table');

    if (!carId) { 
        historyDisplayArea.classList.add('hidden'); 
        return; 
    }

    const carDoc = await db.collection('cars').doc(carId).get();
    if (!carDoc.exists) return;
    const car = { id: carDoc.id, ...carDoc.data() };
    
    // Build modern header with larger image and full details including variant (no dash)
    const variantText = car.variant ? ` ${car.variant}` : '';
    document.getElementById('history-car-header').innerHTML = `
        <div class="car-hero-image" style="background-image: url('${car.photoURL || 'https://via.placeholder.com/600x300?text=No+Image'}');"></div>
        <div class="car-info-overlay">
            <div class="car-badge">
                <div class="badge-content">
                    <h2>${car.nickname}</h2>
                    <p class="car-details">${car.year} ${car.make} ${car.model}${variantText}</p>
                </div>
                <button class="share-btn" onclick="openShareModal('${car.id}')" title="Share this vehicle's history">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    Share
                </button>
            </div>
        </div>`;

    const historySnapshot = await db.collection('cars').doc(carId).collection('service_history').orderBy('date', 'desc').get();
    const historyTableBody = historyTable.querySelector('tbody');
    
    if (historySnapshot.empty) {
        historyTableBody.innerHTML = `<tr><td colspan="7">No service history found for this vehicle.</td></tr>`;
    } else {
        historyTableBody.innerHTML = historySnapshot.docs.map(doc => {
            const entry = { id: doc.id, ...doc.data() };
            const date = entry.date.toDate().toISOString().split('T')[0];
            const hasDetails = (entry.description && entry.description.trim() !== '') || 
                             (entry.parts && entry.parts.some(p => p.description)) || 
                             (entry.photos && entry.photos.length > 0);
            
            return `
                <tr class="entry-row">
                    <td>${date}</td>
                    <td>${entry.odometer.toLocaleString()}</td>
                    <td>${entry.task}</td>
                    <td>${entry.oilChanged ? '✔️' : ''}</td>
                    <td>${hasDetails ? `<button class="action-link" onclick="toggleDetails(this, '${car.id}', '${entry.id}')">Expand</button>` : ''}</td>
                    <td><button class="action-link" onclick="editEntry('${car.id}', '${entry.id}')">Edit</button></td>
                    <td><button class="action-link delete" onclick="deleteEntry('${car.id}', '${entry.id}')">Delete</button></td>
                </tr>
                <tr class="details-row"><td colspan="7" class="details-cell"></td></tr>
            `;
        }).join('');
    }
    historyDisplayArea.classList.remove('hidden');
    
    // Store current car ID for sharing
    historyDisplayArea.dataset.currentCarId = carId;
}

async function toggleDetails(btn, carId, entryId) {
    const detailsRow = btn.closest('.entry-row').nextElementSibling;
    
    if (detailsRow.style.display === 'table-row') {
        detailsRow.style.display = 'none';
        btn.textContent = 'Expand';
    } else {
        btn.textContent = 'Loading...';
        const doc = await db.collection('cars').doc(carId).collection('service_history').doc(entryId).get();
        const entry = doc.data();
        let html = '<div class="details-content">';

        if (entry.description && entry.description.trim()) {
            html += `<h5>Description</h5><p class="description-text">${entry.description}</p>`;
        }
        
        if (entry.parts && entry.parts.some(p => p.description)) {
            html += `<h5>Parts & Consumables</h5>
                     <table class="parts-table">
                        <thead>
                            <tr><th>Description</th><th>Part Number</th><th>Quantity</th></tr>
                        </thead>
                        <tbody>`;
            entry.parts.filter(p => p.description).forEach(p => {
                html += `<tr><td>${p.description}</td><td>${p.partNumber || 'N/A'}</td><td>${p.quantity || ''} ${p.uom || ''}</td></tr>`;
            });
            html += `   </tbody></table>`;
        }

        if (entry.photos && entry.photos.length > 0) {
            html += `<h5>Photos</h5><div class="details-gallery">${entry.photos.map(url => `<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="Service photo"></a>`).join('')}</div>`;
        }

        html += '</div>';
        detailsRow.querySelector('.details-cell').innerHTML = html;
        detailsRow.style.display = 'table-row';
        btn.textContent = 'Collapse';
    }
}

async function editEntry(carId, entryId) {
    const doc = await db.collection('cars').doc(carId).collection('service_history').doc(entryId).get();
    if (!doc.exists) { console.error("Entry to edit not found"); return; }
    const entry = doc.data();

    document.querySelector('.nav-link[data-page="new-entry"]').click();
    
    document.querySelector('#new-entry h2').textContent = `Edit Entry: ${entry.task}`;
    document.getElementById('entry-car').value = carId;
    document.getElementById('entry-date').value = entry.date.toDate().toISOString().split('T')[0];
    newEntryForm['entry-odometer'].value = entry.odometer;
    newEntryForm['entry-task'].value = entry.task;
    newEntryForm['entry-description'].value = entry.description;
    newEntryForm['entry-oil-changed'].checked = entry.oilChanged;
    
    partsContainer.innerHTML = '';
    if (entry.parts && entry.parts.length > 0) {
        entry.parts.forEach(p => {
            const row = document.createElement('div');
            row.className = 'part-row';
            row.innerHTML = `
                <input type="text" class="part-description" value="${p.description || ''}" placeholder="Description">
                <input type="text" class="part-number" value="${p.partNumber || ''}" placeholder="Part Number">
                <input type="number" class="part-quantity" value="${p.quantity || ''}" placeholder="Qty">
                <select class="part-uom">
                    <option ${(p.uom || 'EA') === 'EA' ? 'selected' : ''}>EA</option>
                    <option ${p.uom === 'L' ? 'selected' : ''}>L</option>
                    <option ${p.uom === 'QT' ? 'selected' : ''}>QT</option>
                    <option ${p.uom === 'KIT' ? 'selected' : ''}>KIT</option>
                    <option ${p.uom === 'SET' ? 'selected' : ''}>SET</option>
                </select>
                <button type="button" class="btn-delete-part">&times;</button>`;
            partsContainer.appendChild(row);
        });
    } else {
        addPartRow(); // Add one default row if no parts exist
    }
    
    currentEditEntryId = entryId;
    document.getElementById('save-entry-btn').textContent = "Save Changes";
    window.scrollTo(0, 0);
}

async function deleteEntry(carId, entryId) {
    if (!confirm("Are you sure you want to delete this service entry? This cannot be undone.")) return;
    try {
        const entryRef = db.collection('cars').doc(carId).collection('service_history').doc(entryId);
        const entryDoc = await entryRef.get();
        if (entryDoc.exists) {
            const photos = entryDoc.data().photos || [];
            for (const url of photos) {
                await storage.refFromURL(url).delete();
            }
        }
        await entryRef.delete();
        showHistoryForCar(carId);
    } catch (err) { console.error("Error deleting entry:", err); alert('Failed to delete entry.'); }
}

// --- SHARING ---
const shareModal = document.getElementById('share-modal');

async function openShareModal(carId) {
    const carRef = db.collection('cars').doc(carId);
    const carData = (await carRef.get()).data();
    let shareId = carData.shareId;
    if (!shareId) {
        shareId = 'share_' + Math.random().toString(36).substr(2, 16);
        await carRef.update({ shareId });
    }
    const link = `${window.location.origin}${window.location.pathname.replace('index.html', '')}view.html?id=${shareId}`;
    document.getElementById('share-link-input').value = link;
    shareModal.classList.remove('hidden');
}

document.getElementById('close-share-modal-btn').addEventListener('click', () => shareModal.classList.add('hidden'));
document.getElementById('copy-share-link-btn').addEventListener('click', () => {
    document.getElementById('share-link-input').select();
    navigator.clipboard.writeText(document.getElementById('share-link-input').value);
    alert('Link Copied!');
});

// --- UTILITY FUNCTIONS ---
async function populateCarSelect(selectElement) {
    if (!auth.currentUser || !selectElement) return;
    const currentVal = selectElement.value;
    const snapshot = await db.collection('cars').where('userId', '==', auth.currentUser.uid).get();
    selectElement.innerHTML = '<option value="">-- Select a Car --</option>';
    snapshot.forEach(doc => {
        selectElement.innerHTML += `<option value="${doc.id}">${doc.data().nickname}</option>`;
    });
    selectElement.value = currentVal;
}

function uploadFile(file, path, progressCallback) {
    return new Promise((resolve, reject) => {
        const uploadTask = storage.ref(path).put(file);
        uploadTask.on('state_changed',
            snapshot => progressCallback?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
            error => reject(error),
            () => uploadTask.snapshot.ref.getDownloadURL().then(resolve)
        );
    });
}