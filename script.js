let db;

function initializeDB() {
    return new Promise((resolve, reject) => {
        const dbRequest = indexedDB.open("fileStorage", 1);

        dbRequest.onupgradeneeded = (e) => {
            db = e.target.result;
            const objectStore = db.createObjectStore("files", { keyPath: "id", autoIncrement: true });
            objectStore.createIndex("fileName", "fileName", { unique: false });
            objectStore.createIndex("medicineName", "medicineName", { unique: false });
        };

        dbRequest.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        dbRequest.onerror = (e) => {
            console.error("Error opening IndexedDB", e);
            reject(e);
        };
    });
}

async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');

    if (fileInput.files.length === 0) {
        fileInfo.textContent = 'No file selected.';
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onloadend = async function () {
        const csvData = parseCSV(reader.result);
        console.log(csvData);
        const transaction = db.transaction("files", "readwrite");
        const objectStore = transaction.objectStore("files");

        csvData.forEach((entry) => {
            const request = objectStore.add(entry);

            request.onerror = (e) => {
                console.error("Error storing entry in IndexedDB", e);
            };
        });

        transaction.oncomplete = () => {
            fileInfo.textContent = `File uploaded: ${file.name}`;
            window.location.href = "schedule.html";
        };

        transaction.onerror = (e) => {
            console.error("Transaction error: ", e);
        };
    };

    reader.readAsText(file);
}

function parseCSV(csvContent) {
    const lines = csvContent.split('\n');
    const data = [];

    lines.forEach((line) => {
        const values = line.split(',');
        if (values.length === 5) {
            const [medicineName, totalTablets, remainingTablets, usedTablets, intervalInSeconds] = values.map((val) => val.trim());

            if (
                medicineName &&
                !isNaN(totalTablets) &&
                !isNaN(remainingTablets) &&
                !isNaN(usedTablets) &&
                !isNaN(intervalInSeconds)
            ) {
                data.push({
                    medicineName,
                    totalTablets: parseInt(totalTablets, 10),
                    remainingTablets: parseInt(remainingTablets, 10),
                    usedTablets: parseInt(usedTablets, 10),
                    intervalInSeconds: parseInt(intervalInSeconds, 10),
                });
            }
        }
    });

    return data;
}

async function loadDataIntoTable() {
    const scheduleBody = document.getElementById('scheduleBody');

    const transaction = db.transaction("files", "readonly");
    const objectStore = transaction.objectStore("files");

    const request = objectStore.getAll();

    request.onsuccess = (e) => {
        const data = e.target.result;

        if (data.length > 0) {
            scheduleBody.innerHTML = '';
            data.forEach((entry) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${entry.medicineName}</td>
                    <td>${entry.totalTablets}</td>
                    <td>${entry.remainingTablets}</td>
                    <td>${entry.usedTablets}</td>
                    <td>${entry.intervalInSeconds}</td>
                    <td><input type="checkbox" class="dose-checkbox" data-medicine="${entry.medicineName}" data-interval="${entry.intervalInSeconds}"></td>
                    <td><button class="reminder-button" onclick="setReminder('${entry.medicineName}', ${entry.intervalInSeconds})">Set Reminder</button></td>
                `;
                scheduleBody.appendChild(row);
            });
        } else {
            scheduleBody.innerHTML = `<tr><td colspan="7">No data available</td></tr>`;
        }
    };

    request.onerror = (e) => {
        console.error("Error fetching data from IndexedDB", e);
    };
}

window.onload = async () => {
    try {
        await initializeDB();
        if (document.getElementById('scheduleBody')) {
            loadDataIntoTable();
        }
    } catch (error) {
        console.error("Error initializing app: ", error);
    }
};

// Function to set reminder when button is clicked
function setReminder(medicineName, intervalInSeconds) {
    const currentTime = new Date();
    const reminderTime = new Date(currentTime.getTime() + intervalInSeconds * 1000); // Interval in milliseconds

    // Calculate time until reminder
    const timeout = reminderTime.getTime() - currentTime.getTime();

    // Set a timeout to trigger the reminder after the specified interval
    setTimeout(() => {
        // Display the reminder notification
        displayReminder(medicineName);
    }, timeout);
}

// Function to display the reminder notification
function displayReminder(medicineName) {
    // Check if Notifications are allowed
    if (Notification.permission === "granted") {
        new Notification(`Time to take your medicine: ${medicineName}`);
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(`Time to take your medicine: ${medicineName}`);
            }
        });
    }
}
