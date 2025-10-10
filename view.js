const firebaseConfig = {
    apiKey: "AIzaSyBzq4vs7hJEqUhqQxj1AJJHhQk8sh4ZEh4",
    authDomain: "piblo-b3172.firebaseapp.com",
    projectId: "piblo-b3172",
    storageBucket: "piblo-b3172.firebasestorage.app",
    messagingSenderId: "975704080999",
    appId: "1:975704080999:web:db73db15db6a5afad70ac2",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const publicViewArea = document.getElementById('public-view-area');

// Get distance unit display text
function getDistanceUnitDisplay(unit) {
    return unit === 'miles' ? 'mi' : 'km';
}

// Format date as DD/MM/YYYY
function formatDateDDMMYYYY(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Toggle details function
function toggleDetails(btn, entryId) {
    const detailsRow = btn.closest('tr').nextElementSibling;
    
    if (detailsRow.style.display === 'table-row') {
        detailsRow.style.display = 'none';
        btn.textContent = 'Expand';
    } else {
        detailsRow.style.display = 'table-row';
        btn.textContent = 'Collapse';
    }
}

window.onload = async () => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('id');

    if (!shareId) {
        publicViewArea.innerHTML = `
            <h1>Error</h1>
            <p>No sharing ID provided.</p>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 20px;">
                This link appears to be incomplete. Please check the URL and try again.
            </p>`;
        return;
    }

    try {
        publicViewArea.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-secondary);">Loading vehicle history...</p>';
        
        console.log("Searching for shareId:", shareId);
        const carQuery = await db.collection('cars').where('shareId', '==', shareId).limit(1).get();
        
        if (carQuery.empty) {
            console.log("No car found with shareId:", shareId);
            publicViewArea.innerHTML = `
                <h1>Not Found</h1>
                <p>This link is invalid or the share has been disabled.</p>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 20px;">
                    The vehicle owner may have disabled sharing for this vehicle.
                </p>`;
            return;
        }
        
        const carDoc = carQuery.docs[0];
        const car = { id: carDoc.id, ...carDoc.data() };
        console.log("Car found:", car.nickname);
        
        // Get distance unit
        const distanceUnit = getDistanceUnitDisplay(car.distanceUnit || 'km');
        
        let html = `
            <div id="history-display-area">
                <div id="history-car-header" class="car-header">
                    <img src="${car.photoURL || 'https://via.placeholder.com/120x120?text=No+Image'}" 
                         class="car-header-img" 
                         onerror="this.src='https://via.placeholder.com/120x120?text=No+Image'"
                         alt="${car.nickname}">
                    <div class="car-header-details">
                        <h3>${car.nickname}</h3>
                        <p>${car.year} ${car.make} ${car.model}${car.variant ? ' ' + car.variant : ''}</p>
                    </div>
                </div>
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Odometer</th>
                            <th>Task / Title</th>
                            <th>Description</th>
                            <th>Oil</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        console.log("Loading service history...");
        const historySnapshot = await db.collection('cars').doc(car.id).collection('service_history').orderBy('date', 'desc').get();
        console.log("Service entries found:", historySnapshot.size);

        if (historySnapshot.empty) {
            html += '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No service history available for this vehicle.</td></tr>';
        } else {
            historySnapshot.docs.forEach(doc => {
                const entry = { id: doc.id, ...doc.data() };
                const dateFormatted = formatDateDDMMYYYY(entry.date.toDate());
                
                const hasDetails = (entry.description && entry.description.trim() !== '') || 
                                 (entry.parts && entry.parts.some(p => p.description)) || 
                                 (entry.photos && entry.photos.length > 0);
                
                const truncatedDesc = entry.description && entry.description.trim() ? 
                    (entry.description.length > 80 ? entry.description.substring(0, 80) + '...' : entry.description) : '';
                
                html += `
                    <tr class="entry-row">
                        <td>${dateFormatted}</td>
                        <td>${entry.odometer.toLocaleString()} ${distanceUnit}</td>
                        <td>${entry.task}</td>
                        <td title="${entry.description || ''}">${truncatedDesc}</td>
                        <td>${entry.oilChanged ? '✔️' : ''}</td>
                        <td>${hasDetails ? `<button class="action-link" onclick="toggleDetails(this, '${entry.id}')">Expand</button>` : ''}</td>
                    </tr>
                    <tr class="details-row" data-entry-id="${entry.id}">
                        <td colspan="6" class="details-cell">
                            <div class="details-content">`;
                
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
                
                html += `</div></td></tr>`;
            });
        }
        
        html += `</tbody></table></div>`;
        publicViewArea.innerHTML = html;
        
        console.log("Public view loaded successfully");

    } catch (err) {
        console.error("Error loading public history:", err);
        console.error("Error code:", err.code);
        console.error("Error message:", err.message);
        
        let errorMessage = 'Could not load vehicle history.';
        let errorDetails = err.message;
        
        if (err.code === 'permission-denied') {
            errorMessage = 'Access Denied';
            errorDetails = 'The Firestore security rules are blocking access. Please ensure the rules allow public read access for documents with a shareId.';
        }
        
        publicViewArea.innerHTML = `
            <h1>Error</h1>
            <p>${errorMessage}</p>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 20px;">
                Error details: ${errorDetails}
            </p>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 12px;">
                If you're the owner, please check your Firebase Firestore security rules.
            </p>`;
    }
};