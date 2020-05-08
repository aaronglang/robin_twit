let ExtId = document.currentScript.getAttribute('extid');
let request = window.indexedDB.open('localforage');

let db, found = false;
request.onerror = function(event) {
    console.error('Unable to retrieve from db');
};
request.onsuccess = function(event) {
    db = event.target.result;
    let finder = setInterval(() => {
        gt_tw(db, ExtId);
        if(found) clearInterval(finder);
    }, 500);
};

function gt_tw(db, extId) {
    let tx = db.transaction(['keyvaluepairs'], 'readonly').objectStore('keyvaluepairs').get('reduxPersist:auth');
    tx.onsuccess = (event) => {
        let result = event.target.result;
        let parsed = JSON.parse(JSON.parse(result));
        let token = parsed[1][17];
        if(token) {
            auth = `Bearer ${token}`;
            found = true;
            chrome.runtime.sendMessage(extId, {cmd: 'auth', auth: {auth_token: auth} });
        }
    }
}