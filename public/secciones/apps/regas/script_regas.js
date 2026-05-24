// ESTADOS DE LA APLICACIÓN
        let fechaSeleccionada = new Date(); // Fecha de consulta
        let pestañaActiva = "enturno";       // Pestaña inicial por defecto
        let casetaSeleccionadaEdicion = "";  // Para rastrear la caseta en el modal de guardia
        let personalizationCaseta = "";      // Para rastrear la caseta en el modal de color
        let selectedPreset = 0;              // Preset metálico seleccionado actualmente
        let selectedOpacity = 1.0;           // Nivel de transparencia seleccionado actualmente
        let activeCustomColors = ["#3f3f46", "#1d4ed8", "#047857", "#d97706", "#991b1b"]; // Colores activos de personalización
        
        const contenedor = document.getElementById('contenedor-botones');
        const ANCHO_BOTON = 60;
        const GAP = 8;
        const CONTROLES_ANCHO_APROX = 180; // Ancho sumado de botones de flechas + márgenes

        // INICIALIZACIÓN DE FIREBASE STORAGE CON GUARDRAILS
        let storage = null;
        try {
            if (typeof __firebase_config !== 'undefined' && __firebase_config) {
                const firebaseConfig = JSON.parse(__firebase_config);
                const app = initializeApp(firebaseConfig);
                storage = getStorage(app);
            }
        } catch (e) {
            console.error("Error al inicializar el SDK de Firebase:", e);
        }

        // APERTURA DE BASE DE DATOS CACHE_FOTOS (v1)
        function getCacheDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open("cache_fotos", 1);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains("ElementosPP")) {
                        db.createObjectStore("ElementosPP");
                    }
                };
                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            });
        }

        // APERTURA DE BASE DE DATOS PRINCIPAL CIC-OS
        function getDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open("cic-os");
                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            });
        }

        // CONVERSOR DE BLOB A BASE64
        function blobToBase64(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        // ADQUISICIÓN Y CACHÉ INTELIGENTE DE FOTOS DE ELEMENTOS
        async function obtenerFotoGuardia(id) {
            const numericId = String(id).trim();
            if (!numericId) return null;

            try {
                // 1. Intentar consultar base de datos cache_fotos en local
                const db = await getCacheDB();
                console.log(`[Foto] Buscando ID: ${numericId} en DB...`);
                const transaction = db.transaction("ElementosPP", "readonly");
                const store = transaction.objectStore("ElementosPP");
                
                const cachedBase64 = await new Promise((resolve) => {
                    const req = store.get(numericId);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                });

                if (cachedBase64) {
                    return cachedBase64;
                }

                // 2. Si no se encuentra en el caché local, descargar desde Storage usando el SDK
                if (!storage) {
                    throw new Error("SDK de Firebase Storage no inicializado en el entorno.");
                }

                const fotoRef = ref(storage, `Fotos/ElementosPP/${numericId}.webp`);
                const secureUrl = await getDownloadURL(fotoRef);

                // Descargar el archivo binario
                const response = await fetch(secureUrl);
                if (!response.ok) throw new Error("Fallo de descarga remota.");
                
                const blob = await response.blob();
                const base64Data = await blobToBase64(blob);

                // Guardar en la base de datos de caché local para futuros usos
                const writeTx = db.transaction("ElementosPP", "readwrite");
                const writeStore = writeTx.objectStore("ElementosPP");
                writeStore.put(base64Data, numericId);

                return base64Data;
            } catch (error) {
                console.warn(`No se pudo resolver la foto de perfil para el ID: ${numericId}. Error:`, error.message);
                return null;
            }
        }

        // LEER LOS REGISTROS DE REGAS DEL DÍA DESDE INDEXEDDB
        async function obtenerRegasDia(fechaStr) {
            try {
                const db = await getDB();
                if (!db.objectStoreNames.contains("regas")) {
                    return null;
                }
                return new Promise((resolve) => {
                    const transaction = db.transaction("regas", "readonly");
                    const store = transaction.objectStore("regas");
                    const request = store.get(fechaStr); // Key es "dd-mm-yyyy"
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => resolve(null);
                });
            } catch (error) {
                console.error("Error al leer regas en IndexedDB:", error);
                return null;
            }
        }

        // CONFIGURACIÓN DE COLORES OSCUROS CON ACABADO METÁLICO CEPILLADO DEFAULT
        function obtenerColorCaseta(nombre) {
            const nombreSeguro = nombre ? String(nombre) : "Caseta Sin Nombre";

            const colores = [
                // Titanio Oscuro (Zinc metálico)
                { borderL: 'border-l-zinc-500', bg: 'bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900', text: 'text-zinc-100', darkText: 'text-zinc-500' },
                // Acero Azulado (Slate metálico)
                { borderL: 'border-l-slate-400', bg: 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900', text: 'text-slate-100', darkText: 'text-slate-500' },
                // Hierro / Gunmetal (Neutral oscuro)
                { borderL: 'border-l-neutral-500', bg: 'bg-gradient-to-r from-neutral-950 via-neutral-850 to-neutral-950', text: 'text-neutral-100', darkText: 'text-neutral-500' },
                // Bronce Oscuro (Stone a ámbar templado)
                { borderL: 'border-l-amber-600', bg: 'bg-gradient-to-r from-stone-950 via-stone-850 to-stone-950', text: 'text-amber-100/90', darkText: 'text-amber-600' },
                // Cobre Cepillado (Zinc a naranja óxido)
                { borderL: 'border-l-orange-600', bg: 'bg-gradient-to-r from-zinc-950 via-neutral-900 to-zinc-950', text: 'text-orange-100/90', darkText: 'text-orange-600' },
                // Esmeralda Metalizado (Verde profundo metálico)
                { borderL: 'border-l-emerald-600', bg: 'bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950', text: 'text-emerald-100', darkText: 'text-emerald-600' },
                // Zafiro Oscuro (Azul cobalto metálico)
                { borderL: 'border-l-blue-600', bg: 'bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950', text: 'text-blue-100', darkText: 'text-blue-600' },
                // Cobalto Oscuro (Índigo metálico)
                { borderL: 'border-l-indigo-600', bg: 'bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950', text: 'text-indigo-100', darkText: 'text-indigo-600' },
                // Amatista Metálica (Morado oscuro)
                { borderL: 'border-l-purple-600', bg: 'bg-gradient-to-r from-purple-950 via-purple-900 to-purple-950', text: 'text-purple-100', darkText: 'text-purple-600' },
                // Carbón / Grafito (Gris profundo)
                { borderL: 'border-l-zinc-700', bg: 'bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950', text: 'text-zinc-200', darkText: 'text-zinc-400' }
            ];
            
            // Generamos un hash simple a partir del nombre para siempre asignar el mismo color a la misma caseta
            let hash = 0;
            for (let i = 0; i < nombreSeguro.length; i++) {
                hash = nombreSeguro.charCodeAt(i) + ((hash << 5) - hash);
            }
            const index = Math.abs(hash) % colores.length;
            return colores[index];
        }

        // FUNCIONES AUXILIARES PARA CONVERTIR HEX Y CREAR DEGRADADO METÁLICO INTELIGENTE
        function hexToRgb(hex) {
            var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
            hex = hex.replace(shorthandRegex, function(m, r, g, b) {
                return r + r + g + g + b + b;
            });
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }

        function adjustColorBrightness(hex, percent) {
            const rgb = hexToRgb(hex);
            if (!rgb) return { r: 0, g: 0, b: 0 };
            let r = parseInt(rgb.r * (100 + percent) / 100);
            let g = parseInt(rgb.g * (100 + percent) / 100);
            let b = parseInt(rgb.b * (100 + percent) / 100);

            r = Math.min(255, Math.max(0, r));
            g = Math.min(255, Math.max(0, g));
            b = Math.min(255, Math.max(0, b));

            return { r, g, b };
        }

        // GENERADOR DE DEGRADADOS METÁLICOS DINÁMICOS CON TRANSPARENCIA
        function generarGradienteDesdeHex(hex, opacity) {
            const rgb = hexToRgb(hex);
            if (!rgb) return `linear-gradient(to right, rgba(0,0,0,${opacity}), rgba(100,100,100,${opacity}), rgba(0,0,0,${opacity}))`;
            
            const dark = adjustColorBrightness(hex, -45);  
            const light = adjustColorBrightness(hex, 18);   
            
            return `linear-gradient(to right, rgba(${dark.r}, ${dark.g}, ${dark.b}, ${opacity}), rgba(${light.r}, ${light.g}, ${light.b}, ${opacity}), rgba(${dark.r}, ${dark.g}, ${dark.b}, ${opacity}))`;
        }

        // Cargar registros reales de casetas de forma segura usando un cursor (clave = nombre, valor = datos)
        async function cargarCasetas() {
            try {
                const db = await getDB();
                if (!db.objectStoreNames.contains("casetas")) {
                    return [];
                }
                return new Promise((resolve) => {
                    const transaction = db.transaction("casetas", "readonly");
                    const store = transaction.objectStore("casetas");
                    const casetas = [];
                    
                    const request = store.openCursor();
                    request.onsuccess = (e) => {
                        const cursor = e.target.result;
                        if (cursor) {
                            const keyName = cursor.key; 
                            const recordValue = cursor.value || {}; 
                            
                            casetas.push({
                                nombre: keyName,
                                index: recordValue.index !== undefined ? Number(recordValue.index) : Infinity,
                                turnos: recordValue.turnos || {},
                                bgHeader: recordValue.bgHeader || null 
                            });
                            cursor.continue();
                        } else {
                            resolve(casetas);
                        }
                    };
                    request.onerror = () => resolve([]);
                });
            } catch (error) {
                console.error("Error al acceder a IndexedDB:", error);
                return [];
            }
        }

        // Formatear fecha para el selector de cabecera (YYYY-MM-DD)
        function formatearFechaKey(d) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // Formatear fecha para el servicio Download_DB_Regas y el almacén regas (dd-mm-yyyy)
        function formatearFechaRegas(d) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        }

        // Determinar el turno de trabajo basado en la hora real local
        function obtenerTurnoActualPorHora() {
            const ahora = new Date();
            const hora = ahora.getHours();
            if (hora >= 6 && hora < 14) return 'matutino';
            if (hora >= 14 && hora < 22) return 'vespertino';
            return 'nocturno';
        }

        // RENDERIZAR LA FILA DE FECHAS (Anclada en la 3.ª Columna)
        function renderizarFilaDeFechas() {
            const anchoDisponible = window.innerWidth - CONTROLES_ANCHO_APROX;
            let totalBotones = Math.floor((anchoDisponible + GAP) / (ANCHO_BOTON + GAP));
            
            if (totalBotones < 3) totalBotones = 3;

            contenedor.innerHTML = '';
            const hoy = new Date();

            for (let i = 0; i < totalBotones; i++) {
                const desplazamiento = i - 2; 
                
                const fechaCalculada = new Date(fechaSeleccionada);
                fechaCalculada.setDate(fechaSeleccionada.getDate() + desplazamiento);

                const esHoy = fechaCalculada.toDateString() === hoy.toDateString();
                const esSeleccionado = fechaCalculada.toDateString() === fechaSeleccionada.toDateString();

                const boton = document.createElement('button');
                boton.className = 'btn-fecha-60 flex flex-col items-center justify-center rounded-xl select-none';
                
                let diaSemana = fechaCalculada.toLocaleDateString('es-ES', { weekday: 'short' })
                    .replace('.', '').toUpperCase().slice(0, 3);
                const numeroDia = fechaCalculada.getDate();
                let mes = fechaCalculada.toLocaleDateString('es-ES', { month: 'short' })
                    .replace('.', '').toUpperCase().slice(0, 3);

                boton.innerHTML = `
                    <span class="dia-semana text-[9px] font-bold tracking-wider leading-none pb-[2px] transition-colors">${diaSemana}</span>
                    <span class="numero text-lg font-extrabold leading-none tracking-tight transition-colors">${numeroDia}</span>
                    <div class="flex items-center justify-center gap-[3px] pt-[2px]">
                        <span class="mes text-[9px] font-bold tracking-wider leading-none transition-colors">${mes}</span>
                        ${esHoy ? '<span class="punto-hoy w-[5px] h-[5px] rounded-full bg-amber-500 transition-all"></span>' : ''}
                    </div>
                `;

                aplicarEstiloBoton(boton, esSeleccionado, esHoy);
                boton.addEventListener('click', () => cambiarFecha(fechaCalculada));
                contenedor.appendChild(boton);
            }
        }

        function aplicarEstiloBoton(boton, esSeleccionado, esHoy) {
            const txtSemana = boton.querySelector('.dia-semana');
            const txtNumero = boton.querySelector('.numero');
            const txtMes = boton.querySelector('.mes');

            if (esSeleccionado) {
                let clasesHoyBorde = esHoy ? 'border-2 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'border border-transparent';
                boton.className = `btn-fecha-60 bg-white text-black rounded-xl flex flex-col items-center justify-center shadow-[0_4px_16px_rgba(255,255,255,0.18)] scale-105 z-10 ${clasesHoyBorde}`;
                
                txtSemana.className = "dia-semana text-[9px] font-extrabold tracking-wider leading-none text-zinc-500 pb-[2px]";
                txtNumero.className = "numero text-lg font-black leading-none tracking-tight text-black";
                txtMes.className = "mes text-[9px] font-extrabold tracking-wider leading-none text-zinc-500";
            } else {
                if (esHoy) {
                    boton.className = "btn-fecha-60 bg-zinc-900 text-white rounded-xl flex flex-col items-center justify-center border-2 border-amber-500/90 shadow-[0_0_8px_rgba(245,158,11,0.25)] hover:bg-zinc-800";
                    txtSemana.className = "dia-semana text-[9px] font-bold tracking-wider leading-none text-amber-500 pb-[2px]";
                    txtNumero.className = "numero text-lg font-black leading-none tracking-tight text-white";
                } else {
                    boton.className = "btn-fecha-60 bg-zinc-900/60 text-white rounded-xl flex flex-col items-center justify-center border border-zinc-800/40 opacity-70 hover:opacity-100 hover:bg-zinc-900 transition-all";
                    txtSemana.className = "dia-semana text-[9px] font-bold tracking-wider leading-none text-zinc-500 pb-[2px]";
                    txtNumero.className = "numero text-lg font-extrabold leading-none tracking-tight text-zinc-100";
                }
                txtMes.className = "mes text-[9px] font-bold tracking-wider leading-none text-zinc-500";
            }
        }

        // RENDERIZAR SUBCONTENEDORES DE CASETAS CON FOTO DE PERFIL DESDE REGAS Y CACHE
        async function renderizarCasetas() {
            console.log("Ejecutando renderizarCasetas...");
            const contenedorCasetas = document.getElementById('contenedor-casetas');
            
            // Animación de Carga
            contenedorCasetas.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center p-16 text-zinc-400">
                    <i class="fa-solid fa-circle-notch animate-spin text-3xl mb-4 text-zinc-600"></i>
                    <p class="text-sm font-semibold tracking-wide">Extrayendo casetas de cic-os...</p>
                </div>
            `;
            
            let casetas = await cargarCasetas();
            contenedorCasetas.innerHTML = '';
            
            // Estado vacío de Casetas en DB
            if (casetas.length === 0) {
                contenedorCasetas.innerHTML = `
                    <div class="col-span-full bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center max-w-md mx-auto mt-8 shadow-sm">
                        <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fa-solid fa-warehouse text-2xl text-slate-400"></i>
                        </div>
                        <h3 class="text-lg font-bold text-slate-800 mb-1">No se encontraron casetas</h3>
                        <p class="text-sm text-slate-500 mb-6 leading-relaxed">
                            No existen registros en el almacén <strong class="text-slate-700">casetas</strong> de tu base de datos <strong class="text-slate-700">cic-os</strong>. Puedes registrar algunas de demostración para verificar el diseño.
                        </p>
                        <button onclick="crearCasetasDeDemostracion()" class="px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all active:scale-95 shadow-sm inline-flex items-center gap-2">
                            <i class="fa-solid fa-plus text-[10px]"></i> Generar Casetas de Demostración
                        </button>
                    </div>
                `;
                return;
            }

            // ORDENAR CASETAS DE MENOR A MAYOR BASADO EN EL CAMPO 'index'
            casetas.sort((a, b) => {
                const indexA = (a.index !== undefined && a.index !== null) ? Number(a.index) : Infinity;
                const indexB = (b.index !== undefined && b.index !== null) ? Number(b.index) : Infinity;
                return indexA - indexB;
            });
            
            const fechaRegasKey = formatearFechaRegas(fechaSeleccionada);
            const regasDia = await obtenerRegasDia(fechaRegasKey) || {};
            
            let turnKey = pestañaActiva;
            if (pestañaActiva === 'enturno') {
                turnKey = obtenerTurnoActualPorHora();
            }

            // RENDERIZADO EXCLUSIVO PARA LA PESTAÑA "AUSENTISMOS"
            if (pestañaActiva === 'ausentismos') {
                
            const ausentes = [];

            for (const [id, info] of Object.entries(regasDia)) {
                // 1. Verificamos si existe el registro de ausentismo y tiene contenido
                const tieneAusentismo = info.ausentismo && Array.isArray(info.ausentismo) && info.ausentismo.length > 0;

                // 2. Verificamos la lógica anterior de la caseta (si es nula o dice 'ausente')
                const casetaAsignada = info[turnKey]?.Caseta;
                const estaSinCaseta = !casetaAsignada || String(casetaAsignada).trim().length === 0 || String(casetaAsignada).toLowerCase() === 'ausente';

                // 3. Si se cumple CUALQUIERA de las dos, lo agregamos a la lista
                if (tieneAusentismo || estaSinCaseta) {
                    ausentes.push({ id, ...info });
                }
            }
                
                if (ausentes.length === 0) {
                    contenedorCasetas.innerHTML = `
                        <div class="col-span-full bg-white border border-slate-100 rounded-2xl p-12 text-center max-w-md mx-auto mt-4 shadow-sm">
                            <div class="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                <i class="fa-solid fa-user-check text-lg"></i>
                            </div>
                            <h3 class="text-sm font-extrabold text-slate-800 mb-1">Sin Novedades de Ausentismo</h3>
                            <p class="text-xs text-slate-400 leading-relaxed">Todos los guardias de regas se encuentran asignados a casetas activas.</p>
                        </div>
                    `;
                    return;
                }

                ausentes.forEach(guard => {
                    const card = document.createElement('div');
                    card.className = `bg-white border-l-4 border-l-rose-500 rounded-r-xl shadow-sm p-3.5 flex items-center justify-between group overflow-hidden relative`;
                    const imgId = `absent-img-${guard.id}`;
                    
                    card.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden" id="${imgId}">
                                <span class="text-xs font-bold text-slate-400">${guard.nombre ? guard.nombre.charAt(0).toUpperCase() : 'G'}</span>
                            </div>
                            <div>
                                <h4 class="font-extrabold text-xs sm:text-sm text-slate-800 leading-tight">${escapeHtml(guard.nombre)}</h4>
                                <span class="text-[9px] font-bold text-rose-500 uppercase tracking-wider block mt-0.5">ID: ${guard.id}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] font-extrabold tracking-wider uppercase border border-rose-100">
                                Ausente
                            </span>
                        </div>
                    `;
                    contenedorCasetas.appendChild(card);

                    // Cargar imagen de forma asíncrona en background
                    console.log(`[Depuración] Caseta: ${nombreCaseta}, ID asignado encontrado: "${asignadoId}"`);
                    obtenerFotoGuardia(guard.id).then(base64 => {
                        const el = document.getElementById(imgId);
                        if (el && base64) {
                            el.innerHTML = `<img src="${base64}" class="w-full h-full object-cover rounded-full" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'"/>`;
                        }
                    });
                });
                return;
            }

            // RENDERIZADO REGULAR DE CASETA CON GUARDIA DE REGAS
            casetas.forEach(caseta => {
                const nombreCaseta = caseta.nombre || "Caseta sin Nombre";
                const card = document.createElement('div');
                const color = obtenerColorCaseta(nombreCaseta);
                
                let enVivoInfo = "";
                if (pestañaActiva === 'enturno') {
                    enVivoInfo = `
                        <span class="px-1.5 py-0.5 bg-white/10 text-white/90 rounded text-[7.5px] font-extrabold tracking-wider uppercase flex items-center gap-1 border border-white/10 shrink-0">
                            <span class="w-1 h-1 rounded-full bg-green-400 animate-pulse"></span> vivo
                        </span>
                    `;
                } else {
                    enVivoInfo = `
                        <span class="px-1.5 py-0.5 bg-white/10 text-white/90 rounded text-[7.5px] font-bold uppercase tracking-wider border border-white/10 shrink-0">
                            ${turnKey}
                        </span>
                    `;
                }

                // Buscar guardia asignado a esta caseta en regasDia para la fecha y el turno activo
                let asignadoNombre = "";
                let asignadoId = "";
                
                for (const [id, info] of Object.entries(regasDia)) {
                    if (info && info[turnKey] && info[turnKey].Caseta) {
                        if (String(info[turnKey].Caseta).trim().toLowerCase() === nombreCaseta.trim().toLowerCase()) {
                            asignadoNombre = info.nombre || `ID: ${id}`;
                            asignadoId = id;
                            break;
                        }
                    }
                }

                // Configuración de estilo de cabecera
                let headerBackgroundStyle = "";
                let headerClasses = "";
                if (caseta.bgHeader && caseta.bgHeader.preset !== undefined) {
                    const presetIdx = caseta.bgHeader.preset;
                    const opacity = caseta.bgHeader.opacity !== undefined ? caseta.bgHeader.opacity : 1.0;
                    const customColors = caseta.bgHeader.customColors || ["#3f3f46", "#1d4ed8", "#047857", "#d97706", "#991b1b"];
                    const chosenHex = customColors[presetIdx] || "#3f3f46";
                    
                    const gradient = generarGradienteDesdeHex(chosenHex, opacity);
                    headerBackgroundStyle = `style="background: ${gradient}; color: white;"`;
                    headerClasses = "text-white";
                } else {
                    headerClasses = `${color.bg} ${color.text}`;
                }

                const imgId = `guard-img-${nombreCaseta.replace(/\s+/g, '-')}`;

                card.className = `bg-white border-0 border-l-4 ${color.borderL} rounded-r-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative pb-1`;
                card.innerHTML = `
                    <div class="flex flex-col">
                        <!-- ENCABEZADO METÁLICO ULTRA-COMPACTO -->
                        <div class="flex items-center justify-between gap-1.5 ${headerClasses} px-2.5 py-1.5 border-b border-black/15 shadow-inner" ${headerBackgroundStyle}>
                            <div class="flex items-center gap-1.5 min-w-0">
                                <div class="w-5.5 h-5.5 rounded bg-white/10 flex items-center justify-center shrink-0 border border-white/5 shadow-inner">
                                    <i class="fa-solid fa-warehouse text-[9px] text-white/80"></i>
                                </div>
                                <div class="min-w-0">
                                    <h4 class="font-extrabold text-[11px] sm:text-xs tracking-tight truncate leading-none" title="${escapeHtml(nombreCaseta)}">
                                        ${escapeHtml(nombreCaseta)}
                                    </h4>
                                </div>
                            </div>
                            
                            <!-- CONTROLES METÁLICOS -->
                            <div class="flex items-center gap-1 shrink-0">
                                ${enVivoInfo}
                                <button onclick="abrirModalAsignacion('${escapeHtml(nombreCaseta)}', '${escapeHtml(asignadoNombre)}', '${turnKey}')" 
                                        title="Asignar Guardia Manual" 
                                        class="w-5.5 h-5.5 rounded bg-white/15 hover:bg-white/25 active:scale-95 flex items-center justify-center transition-all shrink-0 border border-white/5 shadow-sm"
                                >
                                    <i class="fa-solid fa-user-plus text-[9px] text-white/90"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- PANEL DE ESTATUS DEL GUARDIA CON CONECTOR DE FOTO CIRCULAR -->
                        <div class="px-2.5 py-1.5 bg-slate-50/40 flex items-center justify-between min-h-[44px] relative gap-2">
                            <div class="flex items-center gap-2 min-w-0">
                                <!-- Contenedor de la Foto de Guardia de perfil -->
                                <div id="${imgId}" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200/60 overflow-hidden">
                                    <i class="fa-solid fa-user text-slate-300 text-[10px]"></i>
                                </div>
                                <div class="min-w-0">
                                    <span class="text-[8px] font-bold text-slate-400 tracking-wider uppercase block leading-none">Guardia</span>
                                    ${asignadoNombre ? `
                                        <p class="text-[11px] font-extrabold text-slate-700 truncate mt-0.5">
                                            ${escapeHtml(asignadoNombre)}
                                        </p>
                                    ` : `
                                        <p class="text-[10px] font-semibold text-slate-400 italic mt-0.5">
                                            Sin asignar
                                        </p>
                                    `}
                                </div>
                            </div>

                            <!-- BOTÓN DE PERSONALIZACIÓN DE COLOR (Abajo a la derecha) -->
                            <button onclick="abrirModalPersonalizar('${escapeHtml(nombreCaseta)}')"
                                    title="Personalizar color de encabezado"
                                    class="w-5 h-5 rounded bg-slate-100 hover:bg-zinc-900 hover:text-white flex items-center justify-center text-slate-400 transition-all active:scale-90 shadow-sm border border-slate-200/40 shrink-0"
                            >
                                <i class="fa-solid fa-palette text-[8px]"></i>
                            </button>
                        </div>
                    </div>
                `;
                contenedorCasetas.appendChild(card);

                // Cargar imagen de forma asíncrona en background si existe asignación
                if (asignadoId) {
                    obtenerFotoGuardia(asignadoId).then(base64 => {
                        const el = document.getElementById(imgId);
                        if (el) {
                            if (base64) {
                                el.innerHTML = `<img src="${base64}" class="w-full h-full object-cover rounded-full" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'"/>`;
                            } else {
                                const inicial = asignadoNombre ? asignadoNombre.charAt(0).toUpperCase() : "G";
                                el.innerHTML = `<span class="text-[10px] font-black text-slate-500">${inicial}</span>`;
                            }
                        }
                    });
                }
            });
        }

        // CONTROLADORES DE PERSONALIZACIÓN DE COLOR DE ENCABEZADO
        async function abrirModalPersonalizar(nombreCaseta) {
            personalizationCaseta = nombreCaseta;
            
            document.getElementById('modal-personalizar-subtitle').textContent = `CASETA: ${nombreCaseta.toUpperCase()}`;
            document.getElementById('personalizar-preview-name').textContent = nombreCaseta;

            try {
                const db = await getDB();
                const transaction = db.transaction("casetas", "readonly");
                const store = transaction.objectStore("casetas");
                const getRequest = store.get(nombreCaseta);

                getRequest.onsuccess = () => {
                    const record = getRequest.result || {};
                    const currentBg = record.bgHeader || { preset: 0, opacity: 1.0 };
                    
                    selectedPreset = currentBg.preset !== undefined ? currentBg.preset : 0;
                    selectedOpacity = currentBg.opacity !== undefined ? currentBg.opacity : 1.0;
                    activeCustomColors = currentBg.customColors || ["#3f3f46", "#1d4ed8", "#047857", "#d97706", "#991b1b"];

                    // Asignar los valores a los inputs color nativos correspondientes del modal
                    for (let i = 0; i < 5; i++) {
                        const inputColor = document.getElementById(`color-input-${i}`);
                        if (inputColor) {
                            inputColor.value = activeCustomColors[i];
                        }
                    }

                    // Sincronizar el deslizador de opacidad (0 - 100)
                    const slider = document.getElementById('opacity-slider');
                    if (slider) {
                        slider.value = Math.round(selectedOpacity * 100);
                    }

                    actualizarUIModalPersonalizar();

                    // Abrir Modal
                    const modal = document.getElementById('modal-personalizar');
                    const card = document.getElementById('modal-personalizar-card');
                    
                    modal.classList.remove('hidden');
                    setTimeout(() => {
                        modal.classList.add('opacity-100');
                        card.classList.remove('scale-95');
                        card.classList.add('scale-100');
                    }, 10);
                };
            } catch (err) {
                console.error("Error al leer la personalización:", err);
                mostrarToast("No se pudo leer la configuración local");
            }
        }

        function cerrarModalPersonalizar() {
            const modal = document.getElementById('modal-personalizar');
            const card = document.getElementById('modal-personalizar-card');
            
            modal.classList.remove('opacity-100');
            card.classList.remove('scale-100');
            card.classList.add('scale-95');
            
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }

        function seleccionarPreset(presetIdx) {
            selectedPreset = presetIdx;
            actualizarUIModalPersonalizar();
        }

        // Se ejecuta cuando el usuario selecciona un color en el input type="color" nativo
        function actualizarColorPreset(presetIdx, hexValue) {
            activeCustomColors[presetIdx] = hexValue;
            selectedPreset = presetIdx; // Autoseleccionamos el canal que se está editando
            actualizarUIModalPersonalizar();
        }

        function cambiarOpacidadSlider(value) {
            selectedOpacity = parseFloat(value) / 100;
            actualizarUIModalPersonalizar();
        }

        function actualizarUIModalPersonalizar() {
            // Actualizar indicación visual de presets (los 5 círculos) con el gradiente e inputs configurados
            for (let i = 0; i < 5; i++) {
                const btn = document.getElementById(`preset-${i}`);
                if (btn) {
                    const baseColor = activeCustomColors[i];
                    // El botón muestra una previsualización a máxima opacidad
                    btn.style.background = generarGradienteDesdeHex(baseColor, 1.0);

                    if (i === selectedPreset) {
                        btn.className = "w-11 h-11 rounded-full border-2 border-transparent ring-4 ring-zinc-950 ring-offset-2 transition-all select-preset-btn scale-110 shadow-sm relative flex items-center justify-center";
                    } else {
                        btn.className = "w-11 h-11 rounded-full border-2 border-slate-200 hover:border-zinc-500 transition-all select-preset-btn relative flex items-center justify-center shadow-sm";
                    }
                }
            }

            // Actualizar etiqueta del porcentaje de opacidad
            const label = document.getElementById('opacity-value-label');
            if (label) {
                label.textContent = `${Math.round(selectedOpacity * 100)}%`;
            }

            // Actualizar la caja de vista previa en tiempo real
            const previewHeader = document.getElementById('personalizar-preview-header');
            if (previewHeader) {
                const chosenHex = activeCustomColors[selectedPreset] || "#3f3f46";
                previewHeader.style.background = generarGradienteDesdeHex(chosenHex, selectedOpacity);
            }
        }

        async function guardarCambioPersonalizacion() {
            try {
                const db = await getDB();
                const transaction = db.transaction("casetas", "readwrite");
                const store = transaction.objectStore("casetas");
                const getRequest = store.get(personalizationCaseta);

                getRequest.onsuccess = () => {
                    let record = getRequest.result || {};
                    
                    // Almacenar la nueva configuración de la cabecera
                    record.bgHeader = {
                        preset: selectedPreset,
                        opacity: selectedOpacity,
                        customColors: activeCustomColors
                    };

                    let putRequest;
                    if (store.keyPath) {
                        record[store.keyPath] = personalizationCaseta;
                        putRequest = store.put(record);
                    } else {
                        putRequest = store.put(record, personalizationCaseta);
                    }

                    putRequest.onsuccess = () => {
                        cerrarModalPersonalizar();
                        renderizarCasetas();
                        mostrarToast(`Cabecera de ${personalizationCaseta} personalizada`);
                    };
                };
            } catch (err) {
                console.error("Error al guardar personalización:", err);
                mostrarToast("No se pudo escribir en IndexedDB");
            }
        }

        async function restaurarDefaultColor() {
            try {
                const db = await getDB();
                const transaction = db.transaction("casetas", "readwrite");
                const store = transaction.objectStore("casetas");
                const getRequest = store.get(personalizationCaseta);

                getRequest.onsuccess = () => {
                    let record = getRequest.result || {};
                    
                    // Eliminar propiedad personalizada
                    delete record.bgHeader;

                    let putRequest;
                    if (store.keyPath) {
                        record[store.keyPath] = personalizationCaseta;
                        putRequest = store.put(record);
                    } else {
                        putRequest = store.put(record, personalizationCaseta);
                    }

                    putRequest.onsuccess = () => {
                        cerrarModalPersonalizar();
                        renderizarCasetas();
                        mostrarToast(`Restaurado estilo original de ${personalizationCaseta}`);
                    };
                };
            } catch (err) {
                console.error("Error al restaurar estilo original:", err);
                mostrarToast("No se pudo modificar IndexedDB");
            }
        }

        // FUNCIONES DE CONTROL DEL MODAL DE GUARDIA
        function abrirModalAsignacion(nombreCaseta, guardiaActual, turno) {
            casetaSeleccionadaEdicion = nombreCaseta;
            
            document.getElementById('modal-title-caseta').textContent = nombreCaseta;
            document.getElementById('modal-subtitle-turno').textContent = `TURNO: ${turno.toUpperCase()} (${fechaSeleccionada.toLocaleDateString()})`;
            document.getElementById('input-elemento').value = guardiaActual === "null" || guardiaActual === "undefined" ? "" : guardiaActual;
            
            const modal = document.getElementById('modal-asignacion');
            const card = document.getElementById('modal-card');
            
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.add('opacity-100');
                card.classList.remove('scale-95');
                card.classList.add('scale-100');
            }, 10);
        }

        function cerrarModalAsignacion() {
            const modal = document.getElementById('modal-asignacion');
            const card = document.getElementById('modal-card');
            
            modal.classList.remove('opacity-100');
            card.classList.remove('scale-100');
            card.classList.add('scale-95');
            
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }

        async function guardarCambioAsignacion() {
            const nuevoGuardia = document.getElementById('input-elemento').value.trim();
            const fechaKey = formatearFechaKey(fechaSeleccionada);
            let turnKey = pestañaActiva;
            
            if (pestañaActiva === 'enturno') {
                turnKey = obtenerTurnoActualPorHora();
            }

            try {
                const db = await getDB();
                const transaction = db.transaction("casetas", "readwrite");
                const store = transaction.objectStore("casetas");
                
                const getRequest = store.get(casetaSeleccionadaEdicion);
                
                getRequest.onsuccess = () => {
                    let record = getRequest.result || {};
                    
                    if (!record.turnos) {
                        record.turnos = {};
                    }
                    if (!record.turnos[fechaKey]) {
                        record.turnos[fechaKey] = {};
                    }
                    
                    record.turnos[fechaKey][turnKey] = nuevoGuardia;
                    
                    let putRequest;
                    if (store.keyPath) {
                        record[store.keyPath] = casetaSeleccionadaEdicion;
                        putRequest = store.put(record);
                    } else {
                        putRequest = store.put(record, casetaSeleccionadaEdicion);
                    }
                    
                    putRequest.onsuccess = () => {
                        cerrarModalAsignacion();
                        renderizarCasetas();
                        mostrarToast(`Turno actualizado en ${casetaSeleccionadaEdicion}`);
                    };
                };
            } catch (err) {
                console.error("Error al actualizar la asignación:", err);
                mostrarToast("No se pudo escribir en IndexedDB");
            }
        }

        // CREADOR DE CASETAS DE DEMOSTRACIÓN (Compatible con claves de entrada directas)
        async function crearCasetasDeDemostracion() {
            try {
                const db = await getDB();
                const transaction = db.transaction("casetas", "readwrite");
                const store = transaction.objectStore("casetas");
                
                const demos = [
                    { nombre: "Control de Acceso Norte", index: 1, turnos: {} },
                    { nombre: "Caseta de Embarques Sur", index: 2, turnos: {} },
                    { nombre: "Recepción Corporativa Principal", index: 3, turnos: {} },
                    { nombre: "Patio Logístico de Maniobras", index: 4, turnos: {} },
                    { nombre: "Perímetro Andén A", index: 5, turnos: {} }
                ];
                
                demos.forEach(demo => {
                    if (store.keyPath) {
                        store.put(demo);
                    } else {
                        const { nombre, ...rest } = demo;
                        store.put(rest, nombre);
                    }
                });
                
                transaction.oncomplete = () => {
                    renderizarCasetas();
                    mostrarToast("Casetas inicializadas y ordenadas por index");
                };
            } catch (err) {
                console.error("Error al poblar la BD:", err);
                mostrarToast("Hubo un problema al crear los registros");
            }
        }

        // NAVEGACIÓN Y EVENTOS DE LA CABECERA
        async function cambiarFecha(nuevaFecha) {
            fechaSeleccionada = new Date(nuevaFecha);
            renderizarFilaDeFechas();

            const fechaRegasStr = formatearFechaRegas(fechaSeleccionada);
            mostrarToast(`Buscando turnos para ${fechaRegasStr}...`);

            try {
                await Download_DB_Regas(fechaRegasStr);
            } catch (err) {
                console.error("Error al ejecutar Download_DB_Regas:", err);
            }

            renderizarCasetas();
        }

        function navegarDias(numDias) {
            const nuevaFecha = new Date(fechaSeleccionada);
            nuevaFecha.setDate(fechaSeleccionada.getDate() + numDias);
            cambiarFecha(nuevaFecha);
        }

        function activarPestaña(tabId) {
            pestañaActiva = tabId;

            document.querySelectorAll('.pill-btn').forEach(btn => {
                const esActivo = btn.id === `pill-${tabId}`;
                const indicatorColor = obtenerColorIndicador(btn.id);
                
                if (esActivo) {
                    btn.className = `pill-btn px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 whitespace-nowrap bg-zinc-900 text-white shadow-md shadow-zinc-900/10 scale-105`;
                    const circle = btn.querySelector('span');
                    if (circle) circle.className = `w-2 h-2 rounded-full ${indicatorColor} animate-pulse`;
                } else {
                    btn.className = `pill-btn px-4 py-2 text-sm font-semibold rounded-full transition-all flex items-center gap-2 whitespace-nowrap bg-slate-100 text-slate-600 hover:bg-slate-200`;
                    const circle = btn.querySelector('span');
                    if (circle) circle.className = `w-2 h-2 rounded-full ${indicatorColor}`;
                }
            });

            renderizarCasetas();
        }

        // Obtener color para indicador de pestaña activa
        function obtenerColorIndicador(pillId) {
            if (pillId.includes('enturno')) return 'bg-green-500';
            if (pillId.includes('matutino')) return 'bg-amber-500';
            if (pillId.includes('vespertino')) return 'bg-orange-500';
            if (pillId.includes('nocturno')) return 'bg-indigo-500';
            return 'bg-rose-500'; 
        }

        // NOTIFICACIONES TOAST MINIMALISTAS
        function mostrarToast(mensaje) {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = "bg-zinc-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 translate-y-4 opacity-0 transition-all duration-300 border border-zinc-800";
            toast.innerHTML = `
                <i class="fa-solid fa-circle-check text-green-500 text-sm"></i>
                <span>${mensaje}</span>
            `;
            container.appendChild(toast);
            
            setTimeout(() => {
                toast.classList.remove('translate-y-4', 'opacity-0');
            }, 10);
            
            setTimeout(() => {
                toast.classList.add('translate-y-4', 'opacity-0');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            }, 3000);
        }

        // ESCAPADO DE CARACTERES PARA EVITAR INYECCIONES HTML
        function escapeHtml(str) {
            if (!str) return '';
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // EXPOSICIÓN DE LAS FUNCIONES AL CONTEXTO WINDOW PARA LAS ACCIONES ONCLICK
        window.navegarDias = navegarDias;
        window.cambiarFecha = cambiarFecha;
        window.activarPestaña = activarPestaña;
        window.abrirModalAsignacion = abrirModalAsignacion;
        window.cerrarModalAsignacion = cerrarModalAsignacion;
        window.guardarCambioAsignacion = guardarCambioAsignacion;
        window.crearCasetasDeDemostracion = crearCasetasDeDemostracion;
        window.abrirModalPersonalizar = abrirModalPersonalizar;
        window.cerrarModalPersonalizar = cerrarModalPersonalizar;
        window.seleccionarPreset = seleccionarPreset;
        window.actualizarColorPreset = actualizarColorPreset;
        window.cambiarOpacidadSlider = cambiarOpacidadSlider;
        window.guardarCambioPersonalizacion = guardarCambioPersonalizacion;
        window.restaurarDefaultColor = restaurarDefaultColor;

        // INICIALIZACIÓN DIRECTA (sin depender del evento DOMContentLoaded)
        export async function inicializarApp() {
            console.log("Inicializando aplicación de Regas...");
            renderizarFilaDeFechas();
            const fechaRegasStr = formatearFechaRegas(fechaSeleccionada);
            try {
                mostrarToast(`Buscando turnos para ${fechaRegasStr}...`);
                await Download_DB_Regas(fechaRegasStr);
            } catch (err) {
                console.error("Error inicial al descargar DB Regas:", err);
            }
            renderizarCasetas();
        }