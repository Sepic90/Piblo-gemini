const firebaseConfig = {
    apiKey: "AIzaSyBzq4vs7hJEqUhqQxj1AJJHhQk8sh4ZEh4",
    authDomain: "piblo-b3172.firebaseapp.com",
    projectId: "piblo-b3172",
    storageBucket: "piblo-b3172.appspot.com",
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

window.onload = async () => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('id');

    if (!shareId) {
        publicViewArea.innerHTML = '<h1>Error</h1><p>No sharing ID provided.</p>';
        return;
    }

    try {
        publicViewArea.innerHTML = '<p style="text-align: center; padding: 40px;">Loading vehicle history...</p>';
        
        const carQuery = await db.collection('cars').where('shareId', '==', shareId).limit(1).get();
        
        if (carQuery.empty) {
            publicViewArea.innerHTML = '<h1>Not Found</h1><p>This link is invalid or the share has been disabled.</p>';
            return;
        }
        
        const carDoc = carQuery.docs[0];
        const car = { id: carDoc.id, ...carDoc.data() };
        
        // Get distance unit
        const distanceUnit = getDistanceUnitDisplay(car.distanceUnit || 'km');
        
        let html = `
            <div id="history-display-area">
                <div id="history-car-header" class="car-header">
                    <img src="${car.photoURL || 'https://via.placeholder.com/120x120?text=No+Image'}" class="car-header-img" onerror="this.src='https://via.placeholder.com/120x120?text=No+Image'">
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
                            <th class="centered">Oil Changed</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        const historySnapshot = await db.collection('cars').doc(car.id).collection('service_history').orderBy('date', 'desc').get();

        if (historySnapshot.empty) {
            html += '<tr><td colspan="4" style="text-align: center; padding: 20px;">No service history available.</td></tr>';
        } else {
            historySnapshot.forEach(doc => {
                const entry = doc.data();
                const date = entry.date.toDate().toLocaleDateString(undefined, { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
                html += `<tr>
                    <td>${date}</td>
                    <td>${entry.odometer.toLocaleString()} ${distanceUnit}</td>
                    <td>${entry.task}</td>
                    <td class="centered">${entry.oilChanged ? '✔️' : '—'}</td>
                </tr>`;
            });
        }
        
        html += `</tbody></table></div>`;
        publicViewArea.innerHTML = html;

    } catch (err) {
        console.error("Error loading public history:", err);
        publicViewArea.innerHTML = `<h1>Error</h1><p>Could not load vehicle history.</p><p style="color: #999; font-size: 0.9rem;">Error details: ${err.message}</p>`;
    }
};