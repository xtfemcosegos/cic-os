//#region Configuración compartida de Firebase para CIC-OS
export const firebaseConfig = {
    apiKey: "AIzaSyA05gexuh4zNt4ro_Rh2TJFMYfoicW8nbg",
    authDomain: "cic-os.firebaseapp.com",
    databaseURL: "https://cic-os-default-rtdb.firebaseio.com",
    projectId: "cic-os",
    storageBucket: "cic-os.firebasestorage.app",
    messagingSenderId: "628160285586",
    appId: "1:628160285586:web:cb265d10e256697ab68f4b",
    measurementId: "G-Y76LMVF819"
};

// Importaciones base de Firebase (importamos localmente para usarlas y las exportamos para el resto de la app)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDatabase, ref, get, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";

export {
    initializeApp,
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword,
    getDatabase, ref, get, set, update, remove, onValue,
    getFirestore, doc, getDoc, setDoc, collection, addDoc, query, where,
    getStorage, storageRef, uploadBytes, getDownloadURL,
    getAnalytics
};
//#endregion

//#region Interfaz de Usuario (Toasts)
export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 px-6 py-3 rounded-lg shadow-lg text-white font-bold z-50 ${type === 'error' ? 'bg-red-800' : 'bg-green-700'}`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
//#endregion

//#region Cola de Operaciones para evitar bloqueos en IndexedDB
let dbQueue = Promise.resolve();

/**
 * runDbOp
 * Encola las operaciones de IndexedDB para evitar conflictos de concurrencia
 * y bloqueos de version/conexión.
 */
function runDbOp(opFn) {
    return new Promise((resolve, reject) => {
        dbQueue = dbQueue.then(async () => {
            try {
                const result = await opFn();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    });
}
//#endregion

//#region Funciones de Descarga y Sincronización

export async function Download_DB_marbetes() {
    const DB_NAME = "cic-os-config";
    const STORE_NAME = "timestamps";
    
    try {
        const response = await fetch("https://marbetes.firebaseio.com/ultima-actualizacion.json");
        const remoteTimestamp = await response.json();
        const localTimestamp = await getLocalTimestamp(DB_NAME, STORE_NAME, "marbetes");
        
        if (remoteTimestamp !== localTimestamp) {
            showToast("Sincronizando marbetes...");
            const verRes = await fetch("https://marbetes.firebaseio.com/version_activa.json");
            const version = await verRes.json();
            
            const tables = ["activos", "bajas", "solicitudes"];
            for (const table of tables) {
                const url = table === "activos" 
                    ? `https://marbetes.firebaseio.com/marbetes_v${version}.json`
                    : `https://marbetes.firebaseio.com/${table}.json`;
                const dataRes = await fetch(url);
                const data = await dataRes.json();
                await saveToIndexedDB("cic-os-marbetes", table, data);
            }
            await saveLocalTimestamp(DB_NAME, STORE_NAME, "marbetes", remoteTimestamp);
            showToast("Marbetes actualizados.");
        }
    } catch (error) {
        console.error("Fallo al sincronizar marbetes:", error);
    }
}

export async function Download_DB_Elementos() {
    const DB_NAME = "cic-os-config";
    const STORE_NAME = "timestamps";
    const BASE_URL = "https://regas.firebaseio.com";
    
    try {
        const response = await fetch(`${BASE_URL}/elementos/ultima-actualizacion.json`);
        if (!response.ok) throw new Error("Error al consultar timestamp");
        
        const remoteTimestamp = await response.json();
        const localTimestamp = await getLocalTimestamp(DB_NAME, STORE_NAME, "elementos");

        if (remoteTimestamp === null || localTimestamp === null || remoteTimestamp !== localTimestamp) {
            const timestampToSave = remoteTimestamp ?? Date.now();
            showToast("Sincronizando elementos...");

            const dataRes = await fetch(`${BASE_URL}/elementos.json`);
            if (!dataRes.ok) throw new Error("Error al descargar los datos");
            
            const data = await dataRes.json();
            await saveToIndexedDB("cic-os", "elementos", data);
            await saveLocalTimestamp(DB_NAME, STORE_NAME, "elementos", timestampToSave);
            
            showToast("Elementos actualizados.");
        }
    } catch (error) {
        console.error("Fallo en la sincronización:", error);
        showToast("Error al sincronizar elementos.");
    }
}

export async function Download_DB_Casetas() {
    const DB_NAME = "cic-os-config";
    const STORE_NAME = "timestamps";
    const BASE_URL = "https://regas.firebaseio.com";
    
    try {
        const response = await fetch(`${BASE_URL}/casetas/ultima-actualizacion.json`);
        if (!response.ok) throw new Error("Error al consultar timestamp");
        
        const remoteTimestamp = await response.json();
        const localTimestamp = await getLocalTimestamp(DB_NAME, STORE_NAME, "casetas");

        if (remoteTimestamp === null || localTimestamp === null || remoteTimestamp !== localTimestamp) {
            const timestampToSave = remoteTimestamp ?? Date.now();
            showToast("Sincronizando casetas...");

            const dataRes = await fetch(`${BASE_URL}/casetas.json`);
            if (!dataRes.ok) throw new Error("Error al descargar los datos");
            
            const data = await dataRes.json();
            await saveToIndexedDB("cic-os", "casetas", data);
            await saveLocalTimestamp(DB_NAME, STORE_NAME, "casetas", timestampToSave);
            
            showToast("Casetas actualizadas.");
        }
    } catch (error) {
        console.error("Fallo en la sincronización:", error);
        showToast("Error al sincronizar casetas.");
    }
}

export async function Download_DB_Regas(fechaString) {
    const DB_NAME = "cic-os";
    const STORE_NAME = "regas";
    const BASE_URL = "https://regas.firebaseio.com";
    
    const meses = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    
    const [d, m, y] = fechaString.split('-');
    const nombreMes = meses[parseInt(m, 10)];
    const fechaFormatoFirebase = `${d}${m}${y}`;
    
    try {
        const baseRoute = `${BASE_URL}/${y}/${nombreMes}/${fechaFormatoFirebase}`;
        
        const tsRes = await fetch(`${baseRoute}/ultima-actualizacion.json`);
        const remoteTimestamp = await tsRes.json();
        
        // 1. Obtener timestamp local directamente desde el almacén 'regas/{fecha}'
        const localTimestamp = await runDbOp(() => {
            return new Promise((resolve) => {
                const request = indexedDB.open(DB_NAME);
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    db.onversionchange = () => db.close();
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.close();
                        return resolve(null);
                    }
                    try {
                        const tx = db.transaction(STORE_NAME, "readonly");
                        const getReq = tx.objectStore(STORE_NAME).get(fechaString);
                        getReq.onsuccess = () => {
                            const result = getReq.result;
                            db.close();
                            if (result && result["time stamp"] !== undefined) {
                                resolve(result["time stamp"]);
                            } else {
                                resolve(null);
                            }
                        };
                        getReq.onerror = () => {
                            db.close();
                            resolve(null);
                        };
                    } catch (err) {
                        db.close();
                        resolve(null);
                    }
                };
                request.onerror = () => resolve(null);
            });
        });

        if (remoteTimestamp === null || localTimestamp === null || remoteTimestamp !== localTimestamp) {
            showToast(`Sincronizando regas ${fechaString}...`);
            const timestampToSave = remoteTimestamp ?? Date.now();
            
            const dataRes = await fetch(`${baseRoute}.json`);
            if (!dataRes.ok) throw new Error("Error al descargar los datos de regas");
            
            const data = await dataRes.json();
            
            if (data) {
                // 2. Guardamos el local timestamp DENTRO del objeto de regas para esta fecha
                data["time stamp"] = timestampToSave;
                
                const dataWrapper = { [fechaString]: data };
                await saveToIndexedDB(DB_NAME, STORE_NAME, dataWrapper);
                
                // 3. Guardamos el timestamp en la nube (Firebase) para mantener la consistencia
                await fetch(`${baseRoute}/ultima-actualizacion.json`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(timestampToSave)
                }).catch(err => console.error("Error al guardar timestamp en la nube:", err));
                
                showToast(`Regas ${fechaString} actualizados.`);
                
                console.log("Iniciando enriquecimiento para:", fechaString);
                await EnriquecerRegasConNombres(fechaString).catch(e => console.error("Error en enriquecedor:", e));
            } else {
                showToast("No hay datos para esta fecha.");
            }
        } else {
            showToast(`Regas ${fechaString} ya están al día.`);
            console.log("Regas ya están al día. Verificando/aplicando enriquecimiento de nombres de todos modos...");
            await EnriquecerRegasConNombres(fechaString).catch(e => console.error("Error en enriquecedor de reintento:", e));
        }
    } catch (error) {
        console.error("Fallo en la sincronización:", error);
        showToast("Error al sincronizar regas.");
    }
}

async function EnriquecerRegasConNombres(fechaString) {
    console.log("-> Entró a EnriquecerRegasConNombres para:", fechaString);
    const DB_NAME = "cic-os";
    
    return runDbOp(async () => {
        let db;
        try {
            db = await new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            db.onversionchange = () => db.close();

            // Verificación preventiva de almacenes existentes
            if (!db.objectStoreNames.contains("elementos") || !db.objectStoreNames.contains("regas")) {
                console.warn("-> No se puede enriquecer: Faltan los almacenes 'elementos' o 'regas'.");
                db.close();
                return;
            }

            // 1. Obtener elementos para mapearlos
            const elementosMap = await new Promise((resolve, reject) => {
                try {
                    const tx = db.transaction("elementos", "readonly");
                    const store = tx.objectStore("elementos");
                    const map = {};
                    const request = store.openCursor();
                    
                    request.onsuccess = (e) => {
                        const cursor = e.target.result;
                        if (cursor) {
                            const nombre = cursor.key;
                            const val = cursor.value;
                            if (val && val.ID) {
                                map[val.ID] = nombre;
                            }
                            cursor.continue();
                        } else {
                            resolve(map);
                        }
                    };
                    request.onerror = () => reject(request.error);
                } catch (e) {
                    reject(e);
                }
            });

            // 2. Obtener regas para esta fecha
            const ids = await new Promise((resolve, reject) => {
                try {
                    const tx = db.transaction("regas", "readonly");
                    const store = tx.objectStore("regas");
                    const request = store.get(fechaString);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                } catch (e) {
                    reject(e);
                }
            });

            if (ids) {
                let cambios = 0;
                for (const id in ids) {
                    // Evitamos mapear la propiedad especial del timestamp
                    if (id === "time stamp") continue;
                    
                    if (elementosMap[id]) {
                        ids[id].nombre = elementosMap[id];
                        cambios++;
                    }
                }
                if (cambios > 0) {
                    await new Promise((resolve, reject) => {
                        try {
                            const tx = db.transaction("regas", "readwrite");
                            const store = tx.objectStore("regas");
                            const putRequest = store.put(ids, fechaString);
                            putRequest.onsuccess = () => resolve();
                            putRequest.onerror = () => reject(putRequest.error);
                        } catch (e) {
                            reject(e);
                        }
                    });
                    console.log(`-> ¡Enriquecimiento exitoso! ${cambios} nombres vinculados para ${fechaString}.`);
                } else {
                    console.warn("-> No se encontraron elementos coincidentes (IDs iguales) en el almacén de Elementos.");
                }
            } else {
                console.warn("-> No se pudo enriquecer: el registro de la fecha en regas está vacío.");
            }

        } catch (error) {
            console.error("-> Error durante el proceso de enriquecimiento:", error);
        } finally {
            if (db) {
                db.close();
            }
        }
    });
}
//#endregion

//#region Funciones Auxiliares de IndexedDB
function getLocalTimestamp(dbName, storeName, key) {
    return runDbOp(() => {
        return new Promise((resolve) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = (e) => {
                const db = e.target.result;
                db.onversionchange = () => db.close();
                
                if (!db.objectStoreNames.contains(storeName)) {
                    db.close();
                    return resolve(null);
                }
                
                try {
                    const tx = db.transaction(storeName, "readonly");
                    const getReq = tx.objectStore(storeName).get(key);
                    getReq.onsuccess = () => {
                        resolve(getReq.result);
                        db.close();
                    };
                    getReq.onerror = () => {
                        resolve(null);
                        db.close();
                    };
                } catch (err) {
                    resolve(null);
                    db.close();
                }
            };
            request.onerror = () => resolve(null);
        });
    });
}

function saveToIndexedDB(dbName, storeName, data) {
    return runDbOp(() => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName);

            request.onsuccess = (e) => {
                const db = e.target.result;
                db.onversionchange = () => db.close();

                if (db.objectStoreNames.contains(storeName)) {
                    writeToStore(db, storeName, data, resolve, reject);
                } else {
                    const currentVersion = db.version;
                    db.close();

                    const upgradeRequest = indexedDB.open(dbName, currentVersion + 1);

                    upgradeRequest.onupgradeneeded = (e) => {
                        e.target.result.createObjectStore(storeName);
                    };

                    upgradeRequest.onsuccess = (e) => {
                        const upgradedDb = e.target.result;
                        upgradedDb.onversionchange = () => upgradedDb.close();
                        writeToStore(upgradedDb, storeName, data, resolve, reject);
                    };
                    
                    upgradeRequest.onerror = (e) => reject(e.target.error);
                }
            };

            request.onerror = (e) => reject(e.target.error);
        });
    });
}

function writeToStore(db, storeName, data, resolve, reject) {
    try {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                store.put(data[key], key);
            }
        }
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = (err) => {
            db.close();
            reject(err);
        };
    } catch (err) {
        db.close();
        reject(err);
    }
}

function saveLocalTimestamp(dbName, storeName, key, value) {
    return runDbOp(() => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName);

            request.onsuccess = (e) => {
                const db = e.target.result;
                db.onversionchange = () => db.close();

                if (!db.objectStoreNames.contains(storeName)) {
                    const newVersion = db.version + 1;
                    db.close();
                    
                    const openRequest = indexedDB.open(dbName, newVersion);
                    
                    openRequest.onupgradeneeded = (e) => {
                        e.target.result.createObjectStore(storeName);
                    };
                    
                    openRequest.onsuccess = (e) => {
                        const upgradedDb = e.target.result;
                        upgradedDb.onversionchange = () => upgradedDb.close();
                        
                        const tx = upgradedDb.transaction(storeName, "readwrite");
                        tx.objectStore(storeName).put(value, key);
                        tx.oncomplete = () => {
                            upgradedDb.close();
                            resolve();
                        };
                        tx.onerror = (err) => {
                            upgradedDb.close();
                            reject(err);
                        };
                    };
                    openRequest.onerror = (err) => reject(err);
                } else {
                    const tx = db.transaction(storeName, "readwrite");
                    tx.objectStore(storeName).put(value, key);
                    tx.oncomplete = () => {
                        db.close();
                        resolve();
                    };
                    tx.onerror = (err) => {
                        db.close();
                        reject(err);
                    };
                }
            };

            request.onerror = (err) => reject(err);
        });
    });
}
//#endregion

//#region Inicialización y Métodos Firebase de la Aplicación
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

export async function fetchApps() {
    try {
        const appsRef = ref(db, "apps");
        const snapshot = await get(appsRef);
        const grid = document.getElementById('apps-grid');

        if (snapshot.exists()) {
            const appsData = snapshot.val();
            const appsList = Object.keys(appsData).map(key => ({
                id: key,
                ...appsData[key]
            })).sort((a, b) => (a.index || 0) - (b.index || 0));

            grid.innerHTML = ""; 

            appsList.forEach(app => {
                const bgCol = app.background || '#991B1B'; 
                const finalRoute = `../${app.ruta}`; 

                const appBtn = document.createElement('div');
                appBtn.className = "app-card bg-white p-3 rounded-lg border-[0.5px] border-stone-200/80 flex items-center gap-3.5 cursor-pointer transition-all duration-200 hover:translate-x-1 hover:border-red-800/30 hover:bg-stone-50/50";
                appBtn.onclick = () => window.showIframe(app.id, finalRoute);

                let iconHtml = "";
                if (app.icono && (app.icono.startsWith('fa-') || app.icono.startsWith('fas ') || app.icono.startsWith('fab ') || app.icono.startsWith('fa-solid ') || app.icono.startsWith('fa-regular '))) {
                    iconHtml = `<i class="${app.icono} text-base text-white"></i>`;
                } else {
                    let iconUrl = app.icono || '';
                    if (iconUrl && !iconUrl.startsWith('http') && !iconUrl.startsWith('../')) {
                        iconUrl = iconUrl.replace(/^\/+/, ''); 
                        iconUrl = `../${iconUrl}`;
                    }
                    iconHtml = `<img src="${iconUrl}" class="w-5 h-5 object-contain" onerror="window.handleIconError(this)">`;
                }

                appBtn.innerHTML = `
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center shadow-inner shrink-0" style="background-color: ${bgCol};">
                        ${iconHtml}
                    </div>
                    <div class="flex-1 min-w-0">
                        <span class="text-xs font-black text-stone-700 uppercase tracking-wide leading-tight block truncate">${app.id}</span>
                        <span class="text-[9px] text-stone-400 font-bold uppercase tracking-wider block truncate mt-0.5">${app.ruta ? app.ruta.replace('.html', '') : ''}</span>
                    </div>
                    <i class="fa-solid fa-chevron-right text-[10px] text-stone-300"></i>
                `;
                grid.appendChild(appBtn);
            });
        } else {
            grid.innerHTML = `
                <div class="py-8 text-center text-stone-400 text-xs">
                    <i class="fa-solid fa-folder-open text-xl mb-1 block"></i>
                    No se encontraron aplicaciones cargadas.
                </div>
            `;
        }
    } catch (err) {
        console.error("Fallo al descargar aplicaciones:", err);
        document.getElementById('apps-grid').innerHTML = `
            <div class="py-8 text-center text-red-800 text-xs font-bold">
                <i class="fa-solid fa-circle-exclamation text-xl mb-1 block animate-pulse"></i>
                Error al cargar las aplicaciones.
            </div>
        `;
    }
}
//#endregion

//#region Utilidades RegAs
    /**
 * Accede a un campo específico en Firebase Realtime Database para la estructura de 'regas'.
 * Evita la descarga o escritura redundante apuntando directamente a la ruta profunda.
 * * @param {string} fechaString - Fecha en formato "dd-mm-yyyy" (ej. "23-05-2026")
 * @param {string|number} id - ID del elemento
 * @param {string} turno - El turno o ausentismo (ej. "Matutino", "Falta")
 * @param {string} campo - El campo específico (ej. "entrada", "salida")
 * @param {'read'|'write'} mode - Modo de operación: 'read' para obtener o 'write' para escribir
 * @param {any} [value=null] - El valor a escribir (obligatorio únicamente si mode es 'write')
 * @returns {Promise<any>} Devuelve el valor del campo si el modo es 'read'
 */
export async function Access_DB_Regas_Field(fechaString, id, turno, campo, mode, value = null) {
    const BASE_URL = "https://regas.firebaseio.com";
    
    // Mapeo de números a nombres de meses
    const meses = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    
    // Desestructurar la fecha y dar formato
    const [d, m, y] = fechaString.split('-');
    const nombreMes = meses[parseInt(m, 10)];
    const fechaFormatoFirebase = `${d}${m}${y}`; // Formato ddMMyyyy
    
    // Construcción de la ruta ultra específica
    const endpoint = `${BASE_URL}/${y}/${nombreMes}/${fechaFormatoFirebase}/${id}/${turno}/${campo}.json`;

    try {
        if (mode === 'write') {
            // Realizar un PUT para reemplazar exactamente ese campo
            const response = await fetch(endpoint, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(value)
            });

            if (!response.ok) {
                throw new Error(`Error en la escritura: ${response.statusText}`);
            }
            
            console.log(`[RTDB] Escrito con éxito en ${y}/${nombreMes}/${fechaFormatoFirebase}/${id}/${turno}/${campo}`);
            return true;

        } else if (mode === 'read') {
            // Realizar un GET para leer únicamente el valor de ese campo
            const response = await fetch(endpoint);
            
            if (!response.ok) {
                throw new Error(`Error en la lectura: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`[RTDB] Leído con éxito desde ${y}/${nombreMes}/${fechaFormatoFirebase}/${id}/${turno}/${campo}:`, data);
            return data;
            
        } else {
            throw new Error("Modo no soportado. Usa 'read' o 'write'.");
        }
    } catch (error) {
        console.error("Fallo al acceder a la ruta específica de RTDB:", error);
        throw error;
    }
}
//#endregion