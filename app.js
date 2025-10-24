/* =============================================================
   MÓDULO: app.js (Núcleo do Sistema)
   Funções:
     - Inicialização do Firebase
     - Autenticação
     - Listeners Globais (Firestore)
     - Declaração de Variáveis Globais (DOM e Dados)
     - Funções de Utilidade (showAlert, etc.)
     - Navegação (Abas, Sub-abas)
     - Lógica do Dashboard
     - Lógica de Exclusão (Genérica)
     - Inicialização (setupApp, DOMContentLoaded)
   Autor: Jurandy Santana (Refatorado por Gemini)
   ============================================================= */

// --- IMPORTS DO FIREBASE ---
// Importações necessárias para o app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query, Timestamp, serverTimestamp, setLogLevel, setDoc, getDocs, where, limit, getDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js"; 

// --- CONFIGURAÇÃO E VARIÁVEIS GLOBAIS ---

const userFallbackConfig = { 
    apiKey: "AIzaSyD7VCxaHo8veaHnM8RwY60EX_DEh3hOVHk", 
    authDomain: "controle-almoxarifado-semcas.firebaseapp.com", 
    projectId: "controle-almoxarifado-semcas", 
    storageBucket: "controle-almoxarifado-semcas.firebasestorage.app", // <-- CORRIGIDO AQUI
    messagingSenderId: "916615427315", 
    appId: "1:916615427315:web:6823897ed065c50d413386" 
};

// Configuração do Firebase
const firebaseConfigString = typeof __firebase_config !== 'undefined' ? __firebase_config : JSON.stringify(userFallbackConfig);
const firebaseConfig = JSON.parse(firebaseConfigString);

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const appId = rawAppId.replace(/[\/.]/g, '-');

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- DECLARAÇÃO DE VARIÁVEIS GLOBAIS ---
// Estas variáveis serão usadas por todos os arquivos JS (agua.js, gas.js, etc.)

// Serviços Firebase
let app, auth, db, storage, userId;
let isAuthReady = false;
let domReady = false; // Flag: Indica se o DOM está pronto

// Coleções Firestore
let unidadesCollection, aguaCollection, gasCollection, materiaisCollection;
let estoqueAguaCollection, estoqueGasCollection;

// Arrays de Dados (Cache local)
let fb_unidades = [], fb_agua_movimentacoes = [], fb_gas_movimentacoes = [], fb_materiais = [];
let fb_estoque_agua = [], fb_estoque_gas = [];
let estoqueInicialDefinido = { agua: false, gas: false }; 

// Estado da UI
let visaoAtiva = 'dashboard'; 
let dashboardAguaChartInstance, dashboardGasChartInstance;
let dashboardRefreshInterval = null;
let deleteInfo = { id: null, type: null, collectionRef: null, details: null, isInicial: false }; 
let initialMaterialFilter = null; 
let currentDashboardMaterialFilter = null;
let materialAtualParaLiberacao = null; // Usado por materiais.js
let listaExclusoes = { agua: [], gas: [] }; // Usado por agua.js e gas.js
let modoPrevisao = { agua: null, gas: null }; // Usado por agua.js e gas.js
let graficoPrevisao = { agua: null, gas: null }; // Usado por agua.js e gas.js
let tipoSelecionadoPrevisao = { agua: null, gas: null }; // Usado por agua.js e gas.js


// --- Referências de Elementos (DOM) ---
// Declaradas aqui, atribuídas em setupApp()
let navButtons, contentPanes, connectionStatusEl, lastUpdateTimeEl;
let dashboardNavControls;
let summaryAguaPendente, summaryAguaEntregue, summaryAguaRecebido;
let summaryGasPendente, summaryGasEntregue, summaryGasRecebido;
let dashboardMateriaisProntosContainer, loadingMateriaisProntos, btnClearDashboardFilter, dashboardMateriaisTitle; 
let dashboardMateriaisListContainer, loadingMateriaisDashboard;
let dashboardEstoqueAguaEl, dashboardEstoqueGasEl, dashboardMateriaisSeparacaoCountEl;
let dashboardMateriaisRetiradaCountEl;
let formAgua, selectUnidadeAgua, selectTipoAgua, inputDataAgua, inputResponsavelAgua, btnSubmitAgua, alertAgua, tableStatusAgua, alertAguaLista;
let inputQtdEntregueAgua, inputQtdRetornoAgua, formGroupQtdEntregueAgua, formGroupQtdRetornoAgua; 
let formGas, selectUnidadeGas, selectTipoGas, inputDataGas, inputResponsavelGas, btnSubmitGas, alertGas, tableStatusGas, alertGasLista;
let inputQtdEntregueGas, inputQtdRetornoGas, formGroupQtdEntregueGas, formGroupQtdRetornoGas; 
let formMateriais, selectUnidadeMateriais, selectTipoMateriais, inputDataSeparacao, textareaItensMateriais, inputResponsavelMateriais, btnSubmitMateriais, alertMateriais, tableStatusMateriais, alertMateriaisLista, inputArquivoMateriais;
let modalDefinirResponsavelSeparacao, inputNomeResponsavelSeparacao, btnConfirmarResponsavelSeparacao, btnCancelarResponsavelSeparacao;
let tableGestaoUnidades, alertGestao, textareaBulkUnidades, btnBulkAddUnidades;
let filtroUnidadeNome, filtroUnidadeTipo; 
let relatorioTipo, relatorioDataInicio, relatorioDataFim, btnGerarPdf, alertRelatorio;
let confirmDeleteModal, btnCancelDelete, btnConfirmDelete, deleteDetailsEl, deleteWarningUnidadeEl, deleteWarningInicialEl; 
let estoqueAguaInicialEl, estoqueAguaEntradasEl, estoqueAguaSaidasEl, estoqueAguaAtualEl, loadingEstoqueAguaEl, resumoEstoqueAguaEl;
let formEntradaAgua, inputDataEntradaAgua, btnSubmitEntradaAgua; 
let formInicialAguaContainer, formInicialAgua, inputInicialQtdAgua, inputInicialResponsavelAgua, btnSubmitInicialAgua, alertInicialAgua, btnAbrirInicialAgua; 
let tableHistoricoAgua, alertHistoricoAgua; 
let estoqueGasInicialEl, estoqueGasEntradasEl, estoqueGasSaidasEl, estoqueGasAtualEl, loadingEstoqueGasEl, resumoEstoqueGasEl;
let formEntradaGas, inputDataEntradaGas, btnSubmitEntradaGas; 
let formInicialGasContainer, formInicialGas, inputInicialQtdGas, inputInicialResponsavelGas, btnSubmitInicialGas, alertInicialGas, btnAbrirInicialGas; 
let tableHistoricoGas, alertHistoricoGas; 


// --- FUNÇÕES DE UTILIDADE ---
function showAlert(elementId, message, type = 'info', duration = 5000) {
    const el = document.getElementById(elementId);
    if (!el) { console.warn(`Elemento de alerta não encontrado: ${elementId}, Mensagem: ${message}`); return; }
    el.className = `alert alert-${type}`; 
    el.textContent = message;
    el.style.display = 'block';
    if (el.timeoutId) clearTimeout(el.timeoutId);
    el.timeoutId = setTimeout(() => {
        el.style.display = 'none';
        el.timeoutId = null;
    }, duration);
}

function getTodayDateString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function dateToTimestamp(dateString) {
     if (!dateString) return null;
    try {
        const date = new Date(dateString + 'T00:00:00'); 
        if (isNaN(date.getTime())) return null; 
        return Timestamp.fromDate(date);
    } catch (e) { console.error("Erro ao converter data:", dateString, e); return null; }
}

function formatTimestamp(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') return 'N/A';
    try {
        const date = timestamp.toDate();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        if (yyyy < 2000) return 'Data Inválida';
        return `${dd}/${mm}/${yyyy}`;
    } catch (e) { console.error("Erro ao formatar timestamp:", timestamp, e); return 'Erro Data'; }
}

function normalizeString(str) {
    if (!str) return '';
    return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function capitalizeString(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

function filterTable(inputEl, tableBodyId) {
    const searchTerm = normalizeString(inputEl.value);
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return;
    const rows = tableBody.querySelectorAll('tr');
    
    if (rows.length === 1 && (rows[0].querySelector('.loading-spinner-small') || rows[0].textContent.includes('Nenhum'))) {
        return;
    }
    
    rows.forEach(row => {
        if (row.querySelectorAll('td').length > 1 && !row.classList.contains('editing-row') && !row.classList.contains('obs-row')) { 
            const rowText = normalizeString(row.textContent);
            const isMatch = rowText.includes(searchTerm);
            row.style.display = isMatch ? '' : 'none';
            
            const obsRow = row.nextElementSibling;
            if(obsRow && obsRow.classList.contains('obs-row')) {
                obsRow.style.display = isMatch ? '' : 'none';
            }
        } else if (!row.classList.contains('obs-row')) { 
        }
    });
}


// --- INICIALIZAÇÃO E AUTENTICAÇÃO FIREBASE ---
async function initFirebase() {
     try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        // --- ADICIONADO LOG DE DEBUG ---
        setLogLevel('debug'); 
        auth = getAuth(app);
        storage = getStorage(app);
        
        connectionStatusEl = document.getElementById('connectionStatus'); 
        if (connectionStatusEl) {
             connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-yellow-400 rounded-full animate-pulse"></span> <span>Autenticando...</span>`;
        } else {
             console.warn("connectionStatusEl não encontrado ao iniciar initFirebase");
        }


        onAuthStateChanged(auth, async (user) => { 
             if (!connectionStatusEl) connectionStatusEl = document.getElementById('connectionStatus'); 

            if (user) {
                isAuthReady = true;
                userId = user.uid;
                // --- CORREÇÃO DE ESCOPO (propagação de estado) ---
                window.isAuthReady = true;
                window.userId = user.uid;
                // --- FIM DA CORREÇÃO ---
                console.log("Autenticado com UID:", userId, "Anônimo:", user.isAnonymous);
                if (connectionStatusEl) connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-green-500 rounded-full"></span> <span class="text-green-700">Conectado</span>`;
                
                const basePath = `artifacts/${appId}/public/data`;
                unidadesCollection = collection(db, `${basePath}/unidades`);
                aguaCollection = collection(db, `${basePath}/controleAgua`);
                gasCollection = collection(db, `${basePath}/controleGas`);
                materiaisCollection = collection(db, `${basePath}/controleMateriais`);
                estoqueAguaCollection = collection(db, `${basePath}/estoqueAgua`);
                estoqueGasCollection = collection(db, `${basePath}/estoqueGas`);
                
                console.log("Caminho base das coleções:", basePath);
                
                // ### CORREÇÃO: setupApp() foi movido para DOMContentLoaded ###
                // O setupApp() agora executa ANTES do initFirebase(),
                // então domReady já será true quando a autenticação voltar.
                // Não chamamos mais setupApp() daqui.
                
                initFirestoreListeners(); // Inicia listeners
                
            } else {
                isAuthReady = false;
                userId = null; 
                // --- CORREÇÃO DE ESCOPO (propagação de estado) ---
                window.isAuthReady = false;
                window.userId = null;
                // --- FIM DA CORREÇÃO ---
                console.log("Usuário deslogado.");
                if (connectionStatusEl) connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-red-500 rounded-full"></span> <span class="text-red-700">Desconectado</span>`;
                clearAlmoxarifadoData();
                 domReady = false; // Reseta domReady ao deslogar
            }
        });

        if (initialAuthToken) {
            console.log("Tentando login com Custom Token...");
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            console.log("Nenhum Custom Token encontrado. Tentando login anônimo...");
            await signInAnonymously(auth);
        }

    } catch (error) {
        console.error("Erro CRÍTICO ao inicializar Firebase:", error);
         if (connectionStatusEl) connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-red-500 rounded-full"></span> <span class="text-red-700">Erro Firebase</span>`;
        showAlert('alert-agua', `Erro crítico na conexão com Firebase: ${error.message}. Recarregue a página.`, 'error', 60000);
    }
}

// --- LÓGICA DO FIRESTORE (LISTENERS) ---
function initFirestoreListeners() {
    if (!isAuthReady || !unidadesCollection) { 
        console.warn("Firestore listeners não iniciados: Auth não pronto ou coleção inválida."); 
        return; 
    }

    // Listener de Unidades
    onSnapshot(query(unidadesCollection), (snapshot) => { 
        fb_unidades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        window.fb_unidades = fb_unidades; // <-- CORREÇÃO: Propaga atualização
        console.log("Unidades recebidas:", fb_unidades.length);
        if (domReady) {
            console.log("DOM pronto, atualizando selects e tabelas de unidades...");
            // As funções populate... e render... são chamadas nos arquivos específicos (agua.js, gas.js, unidades.js)
            // Mas os selects que estão em múltiplas abas precisam ser populados aqui
            populateUnidadeSelects(selectUnidadeAgua, 'atendeAgua');
            populateUnidadeSelects(selectUnidadeGas, 'atendeGas');
            populateUnidadeSelects(selectUnidadeMateriais, 'atendeMateriais');
            populateUnidadeSelects(document.getElementById('select-previsao-unidade-agua-v2'), 'atendeAgua', false); 
            populateUnidadeSelects(document.getElementById('select-previsao-unidade-gas-v2'), 'atendeGas', false); 
            populateTipoSelects('agua');
            populateTipoSelects('gas');
            populateUnidadeSelects(document.getElementById('select-exclusao-agua'), 'atendeAgua', false, true, null); 
            populateUnidadeSelects(document.getElementById('select-exclusao-gas'), 'atendeGas', false, true, null); 
            
            // Chama as funções de renderização dos outros módulos
            if (typeof renderGestaoUnidades === 'function') renderGestaoUnidades(); 
            if (typeof renderAguaStatus === 'function') renderAguaStatus(); 
            if (typeof renderGasStatus === 'function') renderGasStatus(); 
        }
    }, (error) => { console.error("Erro no listener de unidades:", error); if(domReady) showAlert('alert-gestao', `Erro ao carregar unidades: ${error.message}`, 'error'); });

    // Listener de Água
    onSnapshot(query(aguaCollection), (snapshot) => {
        fb_agua_movimentacoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.fb_agua_movimentacoes = fb_agua_movimentacoes; // <-- CORREÇÃO: Propaga atualização
        console.log("Mov. Água recebidas:", fb_agua_movimentacoes.length);
        if (domReady) {
            console.log("DOM pronto, atualizando UI de água...");
            if (typeof renderAguaStatus === 'function') renderAguaStatus(); 
            renderDashboardAguaChart(); 
            renderDashboardAguaSummary();
            if (typeof renderEstoqueAgua === 'function') renderEstoqueAgua();
        }
    }, (error) => { console.error("Erro no listener de água:", error); if(domReady) showAlert('alert-agua-lista', `Erro ao carregar dados de água: ${error.message}`, 'error'); });

    // Listener de Gás
    onSnapshot(query(gasCollection), (snapshot) => {
        fb_gas_movimentacoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.fb_gas_movimentacoes = fb_gas_movimentacoes; // <-- CORREÇÃO: Propaga atualização
        console.log("Mov. Gás recebidas:", fb_gas_movimentacoes.length);
         if (domReady) {
            console.log("DOM pronto, atualizando UI de gás...");
            if (typeof renderGasStatus === 'function') renderGasStatus(); 
            renderDashboardGasChart(); 
            renderDashboardGasSummary();
            if (typeof renderEstoqueGas === 'function') renderEstoqueGas();
         }
    }, (error) => { console.error("Erro no listener de gás:", error); if(domReady) showAlert('alert-gas-lista', `Erro ao carregar dados de gás: ${error.message}`, 'error'); });

    // Listener de Materiais
    onSnapshot(query(materiaisCollection), (snapshot) => {
        fb_materiais = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.fb_materiais = fb_materiais; // <-- CORREÇÃO: Propaga atualização
        console.log("Materiais recebidos:", fb_materiais.length);
         if (domReady) {
            console.log("DOM pronto, atualizando UI de materiais...");
            if (typeof renderMateriaisStatus === 'function') renderMateriaisStatus(); 
            renderDashboardMateriaisList();
            renderDashboardMateriaisProntos(currentDashboardMaterialFilter); 
            renderDashboardMateriaisCounts();
         }
    }, (error) => { console.error("Erro no listener de materiais:", error); if(domReady) showAlert('alert-materiais-lista', `Erro ao carregar materiais: ${error.message}`, 'error'); });

    // Listener de Estoque de Água
    onSnapshot(query(estoqueAguaCollection), (snapshot) => {
        fb_estoque_agua = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.fb_estoque_agua = fb_estoque_agua; // <-- CORREÇÃO: Propaga atualização
        estoqueInicialDefinido.agua = fb_estoque_agua.some(e => e.tipo === 'inicial');
        window.estoqueInicialDefinido.agua = estoqueInicialDefinido.agua; // <-- CORREÇÃO: Propaga atualização
        console.log("Estoque Água recebido:", fb_estoque_agua.length, "Inicial definido:", estoqueInicialDefinido.agua);
         if (domReady) {
            console.log("DOM pronto, atualizando UI de estoque de água...");
            if (typeof renderEstoqueAgua === 'function') renderEstoqueAgua();
            if (typeof renderHistoricoAgua === 'function') renderHistoricoAgua();
         }
    }, (error) => { console.error("Erro no listener de estoque água:", error); });

    // Listener de Estoque de Gás
    onSnapshot(query(estoqueGasCollection), (snapshot) => {
        fb_estoque_gas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.fb_estoque_gas = fb_estoque_gas; // <-- CORREÇÃO: Propaga atualização
        estoqueInicialDefinido.gas = fb_estoque_gas.some(e => e.tipo === 'inicial');
        window.estoqueInicialDefinido.gas = estoqueInicialDefinido.gas; // <-- CORREÇÃO: Propaga atualização
        console.log("Estoque Gás recebido:", fb_estoque_gas.length, "Inicial definido:", estoqueInicialDefinido.gas);
         if (domReady) {
            console.log("DOM pronto, atualizando UI de estoque de gás...");
            if (typeof renderEstoqueGas === 'function') renderEstoqueGas();
            if (typeof renderHistoricoGas === 'function') renderHistoricoGas();
         }
    }, (error) => { console.error("Erro no listener de estoque gás:", error); });
}

// Limpa dados ao deslogar
function clearAlmoxarifadoData() {
    fb_unidades = []; fb_agua_movimentacoes = []; fb_gas_movimentacoes = []; fb_materiais = [];
    fb_estoque_agua = []; fb_estoque_gas = []; 
    estoqueInicialDefinido = { agua: false, gas: false };
    currentDashboardMaterialFilter = null; 

    if(domReady) { 
        [selectUnidadeAgua, selectUnidadeGas, selectUnidadeMateriais, 
         document.getElementById('select-previsao-unidade-agua-v2'), 
         document.getElementById('select-previsao-unidade-gas-v2'),
         document.getElementById('select-exclusao-agua'),
         document.getElementById('select-exclusao-gas'),
         document.getElementById('select-previsao-tipo-agua'),
         document.getElementById('select-previsao-tipo-gas')
        ].forEach(sel => { if(sel) sel.innerHTML = '<option value="">Desconectado</option>'; });
        
        [tableStatusAgua, tableStatusGas, tableStatusMateriais, tableGestaoUnidades, tableHistoricoAgua, tableHistoricoGas].forEach(tbody => { if(tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-red-500">Desconectado do Firebase</td></tr>'; });
        
        const dashMateriaisList = document.getElementById('dashboard-materiais-list');
        const dashMateriaisProntos = document.getElementById('dashboard-materiais-prontos');
        if (dashMateriaisList) dashMateriaisList.innerHTML = '<p class="text-center py-4 text-red-500">Desconectado</p>';
        if (dashMateriaisProntos) {
             dashMateriaisProntos.innerHTML = '<div class="text-center p-10 col-span-full" id="loading-materiais-prontos"><div class="loading-spinner-small mx-auto mb-2"></div><p class="text-sm text-slate-500">Carregando...</p></div>'; 
        }
        
        [dashboardAguaChartInstance, dashboardGasChartInstance, graficoPrevisao.agua, graficoPrevisao.gas].forEach(chartInstance => { 
            if (chartInstance) { 
                chartInstance.destroy(); 
                chartInstance = null;
            } 
        });
        [estoqueAguaInicialEl, estoqueAguaEntradasEl, estoqueAguaSaidasEl, estoqueAguaAtualEl, estoqueGasInicialEl, estoqueGasEntradasEl, estoqueGasSaidasEl, estoqueGasAtualEl].forEach(el => { if(el) el.textContent = '0'; });
        
        [resumoEstoqueAguaEl, resumoEstoqueGasEl].forEach(el => { if(el) el.classList.add('hidden'); });
        [loadingEstoqueAguaEl, loadingEstoqueGasEl].forEach(el => { if(el) el.style.display = 'block'; });
        [btnAbrirInicialAgua, btnAbrirInicialGas].forEach(btn => { if(btn) btn.classList.remove('hidden'); }); 
        [formInicialAguaContainer, formInicialGasContainer].forEach(form => { if(form) form.classList.add('hidden'); }); 
        
        if (dashboardEstoqueAguaEl) dashboardEstoqueAguaEl.textContent = '0';
        if (dashboardEstoqueGasEl) dashboardEstoqueGasEl.textContent = '0';
        if (dashboardMateriaisSeparacaoCountEl) dashboardMateriaisSeparacaoCountEl.textContent = '0';
        if (dashboardMateriaisRetiradaCountEl) dashboardMateriaisRetiradaCountEl.textContent = '0';

        if (filtroUnidadeNome) filtroUnidadeNome.value = '';
        if (filtroUnidadeTipo) filtroUnidadeTipo.value = '';
        document.getElementById('filtro-status-agua')?.setAttribute('value', ''); 
        document.getElementById('filtro-historico-agua')?.setAttribute('value', '');
        document.getElementById('filtro-status-gas')?.setAttribute('value', '');
        document.getElementById('filtro-historico-gas')?.setAttribute('value', '');

        if (btnClearDashboardFilter) btnClearDashboardFilter.classList.add('hidden'); 
        if (dashboardMateriaisTitle) dashboardMateriaisTitle.textContent = 'Materiais do Almoxarifado'; 
    }

    console.log("Dados do Almoxarifado limpos devido à desconexão.");
}

// Atualiza a hora da última sincronização
function updateLastUpdateTime() {
     if (!domReady || !lastUpdateTimeEl) return; 
    const now = new Date();
    const formattedDate = now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    lastUpdateTimeEl.textContent = `Atualizado: ${formattedDate}`;
}

// Popula selects de unidade (usado por múltiplos módulos)
function populateUnidadeSelects(selectEl, serviceField, includeAll = false, includeSelecione = true, filterType = null) {
    if (!domReady || !selectEl) return; 

    let unidadesFiltradas = fb_unidades.filter(u => {
        const atendeServico = serviceField ? (u[serviceField] ?? true) : true;
        const tipoUnidadeNormalizado = (u.tipo || '').toUpperCase() === 'SEMCAS' ? 'SEDE' : (u.tipo || '').toUpperCase();
        const tipoCorreto = !filterType || tipoUnidadeNormalizado === (filterType || '').toUpperCase();
        return atendeServico && tipoCorreto;
    });
    
    const grupos = unidadesFiltradas.reduce((acc, unidade) => { 
        let tipo = (unidade.tipo || 'Sem Tipo').toUpperCase(); 
        if (tipo === 'SEMCAS') tipo = 'SEDE';
        if (!acc[tipo]) acc[tipo] = []; 
        acc[tipo].push(unidade); 
        return acc; 
    }, {});
    const tiposOrdenados = Object.keys(grupos).sort();
    
    let html = '';
    if (includeSelecione) {
        html += '<option value="">-- Selecione --</option>';
    }
    if (includeAll) {
         html += '<option value="todas">Todas as Unidades</option>';
    }

    if (unidadesFiltradas.length === 0 && !includeAll) { 
        selectEl.innerHTML = `<option value="">Nenhuma unidade ${filterType ? `do tipo ${filterType} ` : ''}habilitada</option>`; 
        return; 
    }

    tiposOrdenados.forEach(tipo => {
        html += `<optgroup label="${tipo}">`;
        grupos[tipo].sort((a,b) => a.nome.localeCompare(b.nome)).forEach(unidade => { 
            const optionValue = (selectEl.id.includes('-v2') || selectEl.id.includes('exclusao')) ? unidade.id : `${unidade.id}|${unidade.nome}|${unidade.tipo}`;
            html += `<option value="${optionValue}">${unidade.nome}</option>`; 
        });
        html += `</optgroup>`;
    });
    selectEl.innerHTML = html;
}

// Popula selects de tipo de unidade (usado em previsões)
function populateTipoSelects(itemType) {
    if (!domReady) return; 
    const selectEl = document.getElementById(`select-previsao-tipo-${itemType}`);
    if (!selectEl) return;

    const uniqueTypes = [...new Set(fb_unidades.map(u => {
        let tipo = (u.tipo || 'Sem Tipo').toUpperCase();
        return tipo === 'SEMCAS' ? 'SEDE' : tipo;
    }))].sort();

    let html = '<option value="">-- Selecione o Tipo --</option>';
    uniqueTypes.forEach(tipo => {
        html += `<option value="${tipo}">${tipo}</option>`;
    });
    selectEl.innerHTML = html;
}


// --- LÓGICA DO DASHBOARD ---

// Prepara dados para os gráficos de linha (Água/Gás) dos últimos 30 dias
function getChartDataLast30Days(movimentacoes) {
    const labels = []; const entregasData = []; const retornosData = []; 
    const dataMap = new Map(); 
    
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) { 
        const d = new Date(today); 
        d.setDate(d.getDate() - i); 
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; 
        const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); 
        labels.push(dateLabel); 
        dataMap.set(dateKey, { entregas: 0, retornos: 0 }); 
    }

    const movs30Dias = filterLast30Days(movimentacoes);
    
    movs30Dias.forEach(m => { 
        const mDate = m.data.toDate(); 
        mDate.setHours(0,0,0,0); 
        const dateKey = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}-${String(mDate.getDate()).padStart(2, '0')}`; 
        if (dataMap.has(dateKey)) { 
            const dayData = dataMap.get(dateKey); 
            if (m.tipo === 'entrega') dayData.entregas += m.quantidade; 
            else if (m.tipo === 'retorno') dayData.retornos += m.quantidade; 
        } 
    });

    dataMap.forEach(value => { 
        entregasData.push(value.entregas); 
        retornosData.push(value.retornos); 
    });

    return { 
        labels, 
        datasets: [ 
            { label: 'Entregues (Cheios)', data: entregasData, backgroundColor: 'rgba(59, 130, 246, 0.7)', borderColor: 'rgba(59, 130, 246, 1)', borderWidth: 1, tension: 0.1 }, 
            { label: 'Recebidos (Vazios)', data: retornosData, backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: 'rgba(16, 185, 129, 1)', borderWidth: 1, tension: 0.1 } 
        ] 
    };
}

// Troca a visão dentro do Dashboard (Geral, Água, Gás, Materiais)
function switchDashboardView(viewName) {
     if (!domReady) { console.warn("switchDashboardView chamada antes do DOM pronto."); return; } 
    document.querySelectorAll('#dashboard-nav-controls .dashboard-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    document.querySelectorAll('.dashboard-tv-view > div[id^="dashboard-view-"]').forEach(pane => {
         pane.classList.toggle('hidden', pane.id !== `dashboard-view-${viewName}`);
    });
    
    if(viewName === 'agua') renderDashboardAguaChart();
    if(viewName === 'gas') renderDashboardGasChart();
    if(viewName === 'geral') {
        renderDashboardVisaoGeralSummary(); 
        filterDashboardMateriais(null); 
    }
    if(viewName === 'materiais') renderDashboardMateriaisList();
}

// Renderiza os cards principais do dashboard (estoque)
function renderDashboardVisaoGeralSummary() {
    if (!domReady) { return; } 
    if (dashboardEstoqueAguaEl) {
        dashboardEstoqueAguaEl.textContent = estoqueAguaAtualEl?.textContent || '0';
    }
    if (dashboardEstoqueGasEl) {
        dashboardEstoqueGasEl.textContent = estoqueGasAtualEl?.textContent || '0';
    }
}

// Renderiza contagem de materiais nos cards
function renderDashboardMateriaisCounts() {
    if (!domReady) { return; } 
    if (!dashboardMateriaisSeparacaoCountEl || !dashboardMateriaisRetiradaCountEl) return;
    const separacaoCount = fb_materiais.filter(m => m.status === 'separacao').length;
    const retiradaCount = fb_materiais.filter(m => m.status === 'retirada').length;
    
    dashboardMateriaisSeparacaoCountEl.textContent = separacaoCount;
    dashboardMateriaisRetiradaCountEl.textContent = retiradaCount;
}

// Filtra movimentações dos últimos 30 dias (helper)
function filterLast30Days(movimentacoes) {
    const today = new Date(); 
    today.setHours(23, 59, 59, 999); 
    const thirtyDaysAgo = new Date(today); 
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); 
    thirtyDaysAgo.setHours(0, 0, 0, 0); 
    
    const thirtyDaysAgoTimestamp = thirtyDaysAgo.getTime();
    const todayTimestamp = today.getTime();
    
    return movimentacoes.filter(m => {
        if (!m.data || typeof m.data.toDate !== 'function') return false; 
        const mTimestamp = m.data.toMillis();
        return mTimestamp >= thirtyDaysAgoTimestamp && mTimestamp <= todayTimestamp;
    });
}

// Renderiza gráfico de Água
function renderDashboardAguaChart() {
    if (!domReady) { return; } 
    const ctx = document.getElementById('dashboardAguaChart')?.getContext('2d'); if (!ctx) return; 
    const data = getChartDataLast30Days(fb_agua_movimentacoes); 
    if (dashboardAguaChartInstance) { 
        dashboardAguaChartInstance.data = data; 
        dashboardAguaChartInstance.update(); 
    } else { 
        dashboardAguaChartInstance = new Chart(ctx, { type: 'line', data: data, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'top' } } } }); 
    }
}

// Renderiza gráfico de Gás
function renderDashboardGasChart() {
    if (!domReady) { return; } 
    const ctx = document.getElementById('dashboardGasChart')?.getContext('2d'); if (!ctx) return; 
    const data = getChartDataLast30Days(fb_gas_movimentacoes); 
    if (dashboardGasChartInstance) { 
        dashboardGasChartInstance.data = data; 
        dashboardGasChartInstance.update(); 
    } else { 
        dashboardGasChartInstance = new Chart(ctx, { type: 'line', data: data, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'top' } } } }); 
    }
}

// Renderiza cards de resumo (Água)
function renderDashboardAguaSummary() {
    if (!domReady) { return; } 
    if (!summaryAguaPendente) return; 
    const totalEntregueGeral = fb_agua_movimentacoes.filter(m => m.tipo === 'entrega').reduce((sum, m) => sum + m.quantidade, 0);
    const totalRecebidoGeral = fb_agua_movimentacoes.filter(m => m.tipo === 'retorno').reduce((sum, m) => sum + m.quantidade, 0);
    summaryAguaPendente.textContent = totalEntregueGeral - totalRecebidoGeral; 
    
    const movs30Dias = filterLast30Days(fb_agua_movimentacoes);
    const totalEntregue30d = movs30Dias.filter(m => m.tipo === 'entrega').reduce((sum, m) => sum + m.quantidade, 0);
    const totalRecebido30d = movs30Dias.filter(m => m.tipo === 'retorno').reduce((sum, m) => sum + m.quantidade, 0);
    summaryAguaEntregue.textContent = totalEntregue30d;
    summaryAguaRecebido.textContent = totalRecebido30d;
    
    renderDashboardVisaoGeralSummary(); 
}

// Renderiza cards de resumo (Gás)
function renderDashboardGasSummary() {
     if (!domReady) { return; } 
     if (!summaryGasPendente) return; 
    const totalEntregueGeral = fb_gas_movimentacoes.filter(m => m.tipo === 'entrega').reduce((sum, m) => sum + m.quantidade, 0);
    const totalRecebidoGeral = fb_gas_movimentacoes.filter(m => m.tipo === 'retorno').reduce((sum, m) => sum + m.quantidade, 0);
    summaryGasPendente.textContent = totalEntregueGeral - totalRecebidoGeral; 
    
    const movs30Dias = filterLast30Days(fb_gas_movimentacoes);
    const totalEntregue30d = movs30Dias.filter(m => m.tipo === 'entrega').reduce((sum, m) => sum + m.quantidade, 0);
    const totalRecebido30d = movs30Dias.filter(m => m.tipo === 'retorno').reduce((sum, m) => sum + m.quantidade, 0);
    summaryGasEntregue.textContent = totalEntregue30d;
    summaryGasRecebido.textContent = totalRecebido30d;
    
    renderDashboardVisaoGeralSummary(); 
}

// Renderiza lista de materiais (visão "Materiais" do Dashboard)
function renderDashboardMateriaisList() {
     if (!domReady) { console.warn("renderDashboardMateriaisList chamada antes do DOM pronto."); return; } 
     if (!dashboardMateriaisListContainer || !loadingMateriaisDashboard) return; 
     loadingMateriaisDashboard.style.display = 'none'; 
     
    const pendentes = fb_materiais
        .filter(m => m.status === 'separacao' || m.status === 'retirada')
        .sort((a,b) => { 
            const statusOrder = { 'separacao': 1, 'retirada': 2 }; 
            const statusCompare = (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
            if (statusCompare !== 0) return statusCompare;
            return (a.dataSeparacao?.toMillis() || 0) - (b.dataSeparacao?.toMillis() || 0); 
        }); 
    
    if (pendentes.length === 0) { 
        dashboardMateriaisListContainer.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">Nenhum material pendente.</p>'; 
        return; 
    }
    dashboardMateriaisListContainer.innerHTML = pendentes.map(m => {
        const isSeparacao = m.status === 'separacao';
        const badgeClass = isSeparacao ? 'badge-yellow' : 'badge-green';
        const badgeText = isSeparacao ? 'Em Separação' : 'Disponível';
        const bgColor = isSeparacao ? 'bg-slate-50' : 'bg-green-50';
        const borderColor = isSeparacao ? 'border-slate-200' : 'border-green-300';

        return ` 
            <div class="p-3 ${bgColor} rounded-lg border ${borderColor}"> 
                <div class="flex justify-between items-center gap-2"> 
                    <span class="font-medium text-slate-700 text-sm truncate" title="${m.unidadeNome || ''}">${m.unidadeNome || 'Unidade Desc.'}</span> 
                    <span class="badge ${badgeClass} flex-shrink-0">${badgeText} (${formatTimestamp(m.dataSeparacao)})</span> 
                </div> 
                <p class="text-xs text-slate-600 capitalize mt-1">${m.tipoMaterial || 'N/D'}</p> 
                ${m.itens ? `<p class="text-xs text-gray-500 mt-1 truncate" title="${m.itens}">Obs: ${m.itens}</p>` : ''} 
            </div> `
    }).join('');
}

// Renderiza a "TV" de materiais (visão "Geral" do Dashboard)
// *** AJUSTE: Tornada mais robusta para esconder spinners ***
function renderDashboardMateriaisProntos(filterStatus = null) {
    if (!domReady) {
        console.warn("renderDashboardMateriaisProntos chamada antes do DOM pronto.");
        return;
    }

    const container = dashboardMateriaisProntosContainer; // <div id="dashboard-materiais-prontos">
    const titleEl = dashboardMateriaisTitle;
    const clearButton = btnClearDashboardFilter;
    const initialLoaderDiv = loadingMateriaisProntos; // <div id="loading-materiais-prontos"> (estático no HTML)

    if (!container) {
        console.error("Container do dashboard de materiais não encontrado!");
        return; // Sai se o container principal não existe
    }
    // Garante que o loader estático inicial esteja escondido
    if (initialLoaderDiv) {
        initialLoaderDiv.style.display = 'none';
    } else {
         console.warn("Div do loader inicial (#loading-materiais-prontos) não encontrada.");
    }

    // Mostra um spinner temporário DENTRO do container principal enquanto processa
    container.innerHTML = '<div class="text-center p-10 col-span-full"><div class="loading-spinner-small mx-auto mb-2"></div><p class="text-sm text-slate-500">Atualizando...</p></div>';

    // Lógica de filtragem (sem alterações)
    let pendentes = fb_materiais.filter(m => m.status === 'separacao' || m.status === 'retirada');
    if (filterStatus) {
        pendentes = pendentes.filter(m => m.status === filterStatus);
        if (clearButton) clearButton.classList.remove('hidden');
        if (titleEl) titleEl.textContent = `Materiais ${filterStatus === 'separacao' ? 'em Separação' : 'Disponíveis p/ Retirada'}`;
    } else {
        if (clearButton) clearButton.classList.add('hidden');
        if (titleEl) titleEl.textContent = 'Materiais do Almoxarifado';
    }

    let contentHtml = ''; // HTML final a ser inserido

    if (pendentes.length === 0) {
        // Mensagem clara se não houver itens após filtrar
        contentHtml = `<p class="text-sm text-slate-500 text-center py-10 col-span-full">Nenhum material ${filterStatus ? `com status "${filterStatus}"` : 'pendente'} encontrado.</p>`;
    } else {
        // Lógica de agrupamento e ordenação (sem alterações)
        const gruposTipoUnidade = pendentes.reduce((acc, m) => {
            let tipoUnidade = (m.tipoUnidade || 'OUTROS').toUpperCase();
            if (tipoUnidade === 'SEMCAS') tipoUnidade = 'SEDE';
            if (!acc[tipoUnidade]) acc[tipoUnidade] = [];
            acc[tipoUnidade].push(m);
            return acc;
        }, {});
        const ordemColunas = ['CT', 'SEDE', 'CRAS', 'CREAS', 'ABRIGO'];
        Object.keys(gruposTipoUnidade).forEach(tipo => { if (!ordemColunas.includes(tipo)) ordemColunas.push(tipo); });

        let colunasHtml = '';
        let colunasRenderizadas = 0;

        ordemColunas.forEach(tipoUnidade => {
            if (gruposTipoUnidade[tipoUnidade] && gruposTipoUnidade[tipoUnidade].length > 0) {
                colunasRenderizadas++;
                colunasHtml += `<div class="materiais-prontos-col"><h4>${tipoUnidade}</h4><ul class="space-y-3">`;
                const materiaisOrdenados = gruposTipoUnidade[tipoUnidade].sort((a,b) => {
                    const statusOrder = { 'separacao': 1, 'retirada': 2 };
                    const statusCompare = (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
                    if (statusCompare !== 0) return statusCompare;
                    return (a.dataSeparacao?.toMillis() || 0) - (b.dataSeparacao?.toMillis() || 0);
                });
                materiaisOrdenados.forEach(m => {
                    const tiposMateriais = m.tipoMaterial || 'N/D';
                    let statusIndicator = '';
                    if (m.status === 'separacao') {
                        statusIndicator = `<span class="status-indicator separando">⏳ Separando...</span>`;
                    } else if (m.status === 'retirada') {
                        statusIndicator = `<span class="status-indicator pronto">✅ Pronto</span>`;
                    }
                    colunasHtml += `
                        <li class="${m.status === 'retirada' ? 'item-retirada' : ''}">
                            <strong>${m.unidadeNome}</strong><br>
                            <span class="capitalize">(${tiposMateriais})</span>
                            <div>${statusIndicator}</div>
                        </li>`;
                });
                colunasHtml += `</ul></div>`;
            }
        });

        // Garante que haja conteúdo, mesmo que o agrupamento falhe
        if (colunasRenderizadas > 0) {
            contentHtml = colunasHtml;
        } else {
             contentHtml = `<p class="text-sm text-slate-500 text-center py-10 col-span-full">Erro ao agrupar materiais pendentes.</p>`;
             console.error("Erro: Array 'pendentes' tinha itens, mas nenhuma coluna foi renderizada no dashboard.");
        }
    }

    // Usa setTimeout para permitir que o spinner "Atualizando..." apareça antes da atualização pesada do DOM
    setTimeout(() => {
        // Re-verifica se o container ainda existe antes de atualizar
        const currentContainer = document.getElementById('dashboard-materiais-prontos');
        if (currentContainer) {
            // Substitui o spinner temporário pelo conteúdo final (lista ou mensagem "Nenhum material")
            currentContainer.innerHTML = contentHtml;
            // Recria ícones Lucide se necessário
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        } else {
            console.error("Container do dashboard (#dashboard-materiais-prontos) desapareceu antes da renderização final!");
        }
    }, 0); // Executa assim que possível
}


// --- LÓGICA DE CONTROLE DE ESTOQUE (Formulário Entrada/Saída) ---
// Usado por agua.js e gas.js
function switchEstoqueForm(formName) {
     if (!domReady) return; 
    const [action, itemType] = formName.split('-'); 
    const otherAction = (action === 'saida') ? 'entrada' : 'saida';

    const btnAtivo = document.querySelector(`.form-tab-btn[data-form="${action}-${itemType}"]`);
    const btnInativo = document.querySelector(`.form-tab-btn[data-form="${otherAction}-${itemType}"]`);
    const formAtivo = document.getElementById(action === 'saida' ? `form-${itemType}` : `form-${action}-${itemType}`);
    const formInativo = document.getElementById(action === 'saida' ? `form-${otherAction}-${itemType}` : `form-${itemType}`);
    
    btnAtivo?.classList.add('active');
    btnInativo?.classList.remove('active');
    
    formAtivo?.classList.remove('hidden');
    formInativo?.classList.add('hidden');
}


// --- CONTROLE DE ABAS E INICIALIZAÇÃO ---

// Troca de sub-abas (ex: Lançamento / Previsão)
function switchSubTabView(tabPrefix, subViewName) {
     if (!domReady) return; 
    document.querySelectorAll(`#sub-nav-${tabPrefix} .sub-nav-btn`).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subview === subViewName);
    });
    document.querySelectorAll(`#content-${tabPrefix} > div[id^="subview-"]`).forEach(pane => {
         pane.classList.toggle('hidden', pane.id !== `subview-${subViewName}`);
    });
     lucide.createIcons(); 
}

// Troca de Abas Principais (Dashboard, Água, Gás, etc.)
function switchTab(tabName) {
    if (!domReady) { 
        console.warn(`switchTab(${tabName}) chamada antes do DOM pronto.`); 
        return; 
    }
    console.log(`Executando switchTab(${tabName})...`);

    navButtons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    contentPanes.forEach(pane => pane.classList.add('hidden'));
    const activePane = document.getElementById(`content-${tabName}`);
    if(activePane) activePane.classList.remove('hidden');
    
    visaoAtiva = tabName; 

    if (tabName === 'dashboard') { 
        switchDashboardView('geral'); 
        startDashboardRefresh(); 
    } else { 
        stopDashboardRefresh(); 
        filterDashboardMateriais(null); 
    }
    
    // As chamadas de renderização agora são feitas pelos listeners
    // ou pela própria função de inicialização do módulo (ex: em agua.js)
    if (tabName === 'gestao') { 
        if (typeof renderGestaoUnidades === 'function') renderGestaoUnidades(); 
    }
    if (tabName === 'agua') { 
        switchSubTabView('agua', 'movimentacao-agua'); 
        switchEstoqueForm('saida-agua'); 
        if (typeof toggleAguaFormInputs === 'function') toggleAguaFormInputs(); 
        if (typeof renderEstoqueAgua === 'function') renderEstoqueAgua(); 
        if (typeof renderHistoricoAgua === 'function') renderHistoricoAgua(); 
    }
    if (tabName === 'gas') { 
        switchSubTabView('gas', 'movimentacao-gas'); 
        switchEstoqueForm('saida-gas'); 
        if (typeof toggleGasFormInputs === 'function') toggleGasFormInputs(); 
        if (typeof renderEstoqueGas === 'function') renderEstoqueGas(); 
        if (typeof renderHistoricoGas === 'function') renderHistoricoGas(); 
    }
    
    if (tabName === 'materiais' && initialMaterialFilter) {
        setTimeout(() => {
            const filtroInput = document.getElementById('filtro-status-materiais');
            if (filtroInput) {
                filtroInput.value = initialMaterialFilter;
                filtroInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            initialMaterialFilter = null;
        }, 100);
    }

    setTimeout(() => { if(typeof lucide !== 'undefined') lucide.createIcons(); }, 50); 
}

// Configura a UI (Busca DOM e adiciona Listeners)
function setupApp() {
    console.log("Executando setupApp...");
    
    // --- *** INÍCIO DA CORREÇÃO *** ---
    // Busca elementos do DOM
    navButtons = document.querySelectorAll('.nav-btn');
    contentPanes = document.querySelectorAll('main > div[id^="content-"]');
    connectionStatusEl = document.getElementById('connectionStatus');
    lastUpdateTimeEl = document.getElementById('last-update-time');

    // Dashboard
    dashboardNavControls = document.getElementById('dashboard-nav-controls');
    summaryAguaPendente = document.getElementById('summary-agua-pendente');
    summaryAguaEntregue = document.getElementById('summary-agua-entregue');
    summaryAguaRecebido = document.getElementById('summary-agua-recebido');
    summaryGasPendente = document.getElementById('summary-gas-pendente');
    summaryGasEntregue = document.getElementById('summary-gas-entregue');
    summaryGasRecebido = document.getElementById('summary-gas-recebido');
    dashboardMateriaisProntosContainer = document.getElementById('dashboard-materiais-prontos');
    loadingMateriaisProntos = document.getElementById('loading-materiais-prontos');
    btnClearDashboardFilter = document.getElementById('btn-clear-dashboard-filter');
    dashboardMateriaisTitle = document.getElementById('dashboard-materiais-title');
    dashboardMateriaisListContainer = document.getElementById('dashboard-materiais-list');
    loadingMateriaisDashboard = document.getElementById('loading-materiais-dashboard');
    dashboardEstoqueAguaEl = document.getElementById('dashboard-estoque-agua');
    dashboardEstoqueGasEl = document.getElementById('dashboard-estoque-gas');
    dashboardMateriaisSeparacaoCountEl = document.getElementById('dashboard-materiais-separacao-count');
    dashboardMateriaisRetiradaCountEl = document.getElementById('dashboard-materiais-retirada-count');

    // Água
    formAgua = document.getElementById('form-agua');
    selectUnidadeAgua = document.getElementById('select-unidade-agua');
    selectTipoAgua = document.getElementById('select-tipo-agua');
    inputDataAgua = document.getElementById('input-data-agua');
    inputResponsavelAgua = document.getElementById('input-responsavel-agua');
    btnSubmitAgua = document.getElementById('btn-submit-agua');
    alertAgua = document.getElementById('alert-agua');
    tableStatusAgua = document.getElementById('table-status-agua');
    alertAguaLista = document.getElementById('alert-agua-lista');
    inputQtdEntregueAgua = document.getElementById('input-qtd-entregue-agua');
    inputQtdRetornoAgua = document.getElementById('input-qtd-retorno-agua');
    formGroupQtdEntregueAgua = document.getElementById('form-group-qtd-entregue-agua');
    formGroupQtdRetornoAgua = document.getElementById('form-group-qtd-retorno-agua');

    // Gás
    formGas = document.getElementById('form-gas');
    selectUnidadeGas = document.getElementById('select-unidade-gas');
    selectTipoGas = document.getElementById('select-tipo-gas');
    inputDataGas = document.getElementById('input-data-gas');
    inputResponsavelGas = document.getElementById('input-responsavel-gas');
    btnSubmitGas = document.getElementById('btn-submit-gas');
    alertGas = document.getElementById('alert-gas');
    tableStatusGas = document.getElementById('table-status-gas');
    alertGasLista = document.getElementById('alert-gas-lista');
    inputQtdEntregueGas = document.getElementById('input-qtd-entregue-gas');
    inputQtdRetornoGas = document.getElementById('input-qtd-retorno-gas');
    formGroupQtdEntregueGas = document.getElementById('form-group-qtd-entregue-gas');
    formGroupQtdRetornoGas = document.getElementById('form-group-qtd-retorno-gas');

    // Materiais
    formMateriais = document.getElementById('form-materiais');
    selectUnidadeMateriais = document.getElementById('select-unidade-materiais');
    selectTipoMateriais = document.getElementById('select-tipo-materiais');
    inputDataSeparacao = document.getElementById('input-data-separacao');
    textareaItensMateriais = document.getElementById('textarea-itens-materiais');
    inputResponsavelMateriais = document.getElementById('input-responsavel-materiais');
    btnSubmitMateriais = document.getElementById('btn-submit-materiais');
    alertMateriais = document.getElementById('alert-materiais');
    tableStatusMateriais = document.getElementById('table-status-materiais');
    alertMateriaisLista = document.getElementById('alert-materiais-lista');
    inputArquivoMateriais = document.getElementById('input-arquivo-materiais');
    modalDefinirResponsavelSeparacao = document.getElementById('modal-definir-responsavel-separacao');
    inputNomeResponsavelSeparacao = document.getElementById('input-nome-responsavel-separacao');
    btnConfirmarResponsavelSeparacao = document.getElementById('btn-confirmar-responsavel-separacao');
    btnCancelarResponsavelSeparacao = document.getElementById('btn-cancelar-responsavel-separacao');

    // Gestão de Unidades
    tableGestaoUnidades = document.getElementById('table-gestao-unidades');
    alertGestao = document.getElementById('alert-gestao');
    textareaBulkUnidades = document.getElementById('textarea-bulk-unidades');
    btnBulkAddUnidades = document.getElementById('btn-bulk-add-unidades');
    filtroUnidadeNome = document.getElementById('filtro-unidade-nome');
    filtroUnidadeTipo = document.getElementById('filtro-unidade-tipo');

    // Relatório
    relatorioTipo = document.getElementById('relatorio-tipo');
    relatorioDataInicio = document.getElementById('relatorio-data-inicio');
    relatorioDataFim = document.getElementById('relatorio-data-fim');
    btnGerarPdf = document.getElementById('btn-gerar-pdf');
    alertRelatorio = document.getElementById('alert-relatorio');

    // Modal de Exclusão
    confirmDeleteModal = document.getElementById('confirm-delete-modal');
    btnCancelDelete = document.getElementById('btn-cancel-delete');
    btnConfirmDelete = document.getElementById('btn-confirm-delete');
    deleteDetailsEl = document.getElementById('delete-details');
    deleteWarningUnidadeEl = document.getElementById('delete-warning-unidade');
    deleteWarningInicialEl = document.getElementById('delete-warning-inicial');

    // Estoque Água
    estoqueAguaInicialEl = document.getElementById('estoque-agua-inicial');
    estoqueAguaEntradasEl = document.getElementById('estoque-agua-entradas');
    estoqueAguaSaidasEl = document.getElementById('estoque-agua-saidas');
    estoqueAguaAtualEl = document.getElementById('estoque-agua-atual');
    loadingEstoqueAguaEl = document.getElementById('loading-estoque-agua');
    resumoEstoqueAguaEl = document.getElementById('resumo-estoque-agua');
    formEntradaAgua = document.getElementById('form-entrada-agua');
    inputDataEntradaAgua = document.getElementById('input-data-entrada-agua');
    btnSubmitEntradaAgua = document.getElementById('btn-submit-entrada-agua');
    formInicialAguaContainer = document.getElementById('form-inicial-agua-container');
    formInicialAgua = document.getElementById('form-inicial-agua');
    inputInicialQtdAgua = document.getElementById('input-inicial-qtd-agua');
    inputInicialResponsavelAgua = document.getElementById('input-inicial-responsavel-agua');
    btnSubmitInicialAgua = document.getElementById('btn-submit-inicial-agua');
    alertInicialAgua = document.getElementById('alert-inicial-agua');
    btnAbrirInicialAgua = document.getElementById('btn-abrir-inicial-agua');
    tableHistoricoAgua = document.getElementById('table-historico-agua');
    alertHistoricoAgua = document.getElementById('alert-historico-agua');

    // Estoque Gás
    estoqueGasInicialEl = document.getElementById('estoque-gas-inicial');
    estoqueGasEntradasEl = document.getElementById('estoque-gas-entradas');
    estoqueGasSaidasEl = document.getElementById('estoque-gas-saidas');
    estoqueGasAtualEl = document.getElementById('estoque-gas-atual');
    loadingEstoqueGasEl = document.getElementById('loading-estoque-gas');
    resumoEstoqueGasEl = document.getElementById('resumo-estoque-gas');
    formEntradaGas = document.getElementById('form-entrada-gas');
    inputDataEntradaGas = document.getElementById('input-data-entrada-gas');
    btnSubmitEntradaGas = document.getElementById('btn-submit-entrada-gas');
    formInicialGasContainer = document.getElementById('form-inicial-gas-container');
    formInicialGas = document.getElementById('form-inicial-gas');
    inputInicialQtdGas = document.getElementById('input-inicial-qtd-gas');
    inputInicialResponsavelGas = document.getElementById('input-inicial-responsavel-gas');
    btnSubmitInicialGas = document.getElementById('btn-submit-inicial-gas');
    alertInicialGas = document.getElementById('alert-inicial-gas');
    btnAbrirInicialGas = document.getElementById('btn-abrir-inicial-gas');
    tableHistoricoGas = document.getElementById('table-historico-gas');
    alertHistoricoGas = document.getElementById('alert-historico-gas');
    // --- *** FIM DA CORREÇÃO *** ---


    // Verificação crítica (agora deve funcionar)
    if (!dashboardMateriaisProntosContainer || !loadingMateriaisProntos) {
        console.error("ERRO CRÍTICO: Container ou loader do dashboard de materiais NÃO encontrados DENTRO de setupApp!");
        showAlert('alert-agua', 'Erro crítico ao carregar interface. Recarregue a página (Erro Setup).', 'error', 60000);
        domReady = false; 
        return; 
    }
    
    // Define datas padrão (permanece o mesmo)
    const todayStr = getTodayDateString();
    if(inputDataAgua) inputDataAgua.value = todayStr;
    if(inputDataGas) inputDataGas.value = todayStr;
    if(inputDataSeparacao) inputDataSeparacao.value = todayStr;
    if(inputDataEntradaAgua) inputDataEntradaAgua.value = todayStr;
    if(inputDataEntradaGas) inputDataEntradaGas.value = todayStr;
    if(relatorioDataInicio) relatorioDataInicio.value = todayStr;
    if(relatorioDataFim) relatorioDataFim.value = todayStr;


    // --- Adiciona Event Listeners Globais ---
    // (Listeners permanecem os mesmos)
    navButtons.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
    
    // Listeners do Dashboard
    if(dashboardNavControls) {
        dashboardNavControls.addEventListener('click', (e) => {
            const btn = e.target.closest('.dashboard-nav-btn');
            if(btn) switchDashboardView(btn.dataset.view);
        });
    }
    document.getElementById('dashboard-card-separacao')?.addEventListener('click', () => filterDashboardMateriais('separacao'));
    document.getElementById('dashboard-card-retirada')?.addEventListener('click', () => filterDashboardMateriais('retirada'));
    
    // Listeners das Abas de Estoque
    document.querySelectorAll('.form-tab-btn[data-form="saida-agua"]')?.forEach(b => b.addEventListener('click', () => switchEstoqueForm('saida-agua')));
    document.querySelectorAll('.form-tab-btn[data-form="entrada-agua"]')?.forEach(b => b.addEventListener('click', () => switchEstoqueForm('entrada-agua')));
    document.querySelectorAll('.form-tab-btn[data-form="saida-gas"]')?.forEach(b => b.addEventListener('click', () => switchEstoqueForm('saida-gas')));
    document.querySelectorAll('.form-tab-btn[data-form="entrada-gas"]')?.forEach(b => b.addEventListener('click', () => switchEstoqueForm('entrada-gas')));

    // Listeners das Sub-Abas
    document.querySelectorAll('#sub-nav-agua .sub-nav-btn').forEach(btn => btn.addEventListener('click', () => switchSubTabView('agua', btn.dataset.subview)));
    document.querySelectorAll('#sub-nav-gas .sub-nav-btn').forEach(btn => btn.addEventListener('click', () => switchSubTabView('gas', btn.dataset.subview)));

    // Listeners do Modal de Exclusão
    if (btnCancelDelete) btnCancelDelete.addEventListener('click', () => confirmDeleteModal.style.display = 'none');
    if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', handleConfirmDelete);
    
    // Listener de delegação para botões de remoção
    document.querySelector('main')?.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('button.btn-remove[data-id]');
        if (removeBtn) {
            openConfirmDeleteModal(
                removeBtn.dataset.id, 
                removeBtn.dataset.type, 
                removeBtn.dataset.details
            );
        }
    });

    if (btnClearDashboardFilter) btnClearDashboardFilter.addEventListener('click', () => filterDashboardMateriais(null));


    // --- *** INÍCIO DA CORREÇÃO DE ESCOPO *** ---
    // Anexa as variáveis locais do módulo à 'window' para que
    // os outros scripts (agua.js, gas.js, etc.) possam acessá-las.
    // Isso é necessário porque estamos usando 'type="module"',
    // que cria escopos separados para cada arquivo.
    
    // Globais de Estado
    // window.domReady = domReady; // <-- CORREÇÃO: Removida (setada como 'true' acima)
    window.isAuthReady = isAuthReady; // (Será atualizada por onAuthStateChanged)
    window.userId = userId; // (Será atualizada por onAuthStateChanged)
    window.appId = appId;
    window.db = db;
    window.auth = auth;
    window.storage = storage;
    
    // Coleções
    window.unidadesCollection = unidadesCollection;
    window.aguaCollection = aguaCollection;
    window.gasCollection = gasCollection;
    window.materiaisCollection = materiaisCollection;
    window.estoqueAguaCollection = estoqueAguaCollection;
    window.estoqueGasCollection = estoqueGasCollection;
    
    // Arrays de Dados
    window.fb_unidades = fb_unidades;
    window.fb_agua_movimentacoes = fb_agua_movimentacoes;
    window.fb_gas_movimentacoes = fb_gas_movimentacoes;
    window.fb_materiais = fb_materiais;
    window.fb_estoque_agua = fb_estoque_agua;
    window.fb_estoque_gas = fb_estoque_gas;
    window.estoqueInicialDefinido = estoqueInicialDefinido;
    
    // Estado da UI (Objetos)
    window.listaExclusoes = listaExclusoes;
    window.modoPrevisao = modoPrevisao;
    window.graficoPrevisao = graficoPrevisao;
    window.tipoSelecionadoPrevisao = tipoSelecionadoPrevisao;
    
    // Funções de Utilidade Globais
    window.showAlert = showAlert;
    window.getTodayDateString = getTodayDateString;
    window.dateToTimestamp = dateToTimestamp;
    window.formatTimestamp = formatTimestamp;
    window.normalizeString = normalizeString;
    window.capitalizeString = capitalizeString;
    window.filterTable = filterTable;
    window.populateUnidadeSelects = populateUnidadeSelects;
    window.renderDashboardVisaoGeralSummary = renderDashboardVisaoGeralSummary; // Usado por agua/gas.js
    
    // Elementos do DOM (Dashboard)
    window.dashboardNavControls = dashboardNavControls;
    window.summaryAguaPendente = summaryAguaPendente;
    window.summaryAguaEntregue = summaryAguaEntregue;
    window.summaryAguaRecebido = summaryAguaRecebido;
    window.summaryGasPendente = summaryGasPendente;
    window.summaryGasEntregue = summaryGasEntregue;
    window.summaryGasRecebido = summaryGasRecebido;
    window.dashboardMateriaisProntosContainer = dashboardMateriaisProntosContainer;
    window.loadingMateriaisProntos = loadingMateriaisProntos;
    window.btnClearDashboardFilter = btnClearDashboardFilter;
    window.dashboardMateriaisTitle = dashboardMateriaisTitle;
    window.dashboardMateriaisListContainer = dashboardMateriaisListContainer;
    window.loadingMateriaisDashboard = loadingMateriaisDashboard;
    window.dashboardEstoqueAguaEl = dashboardEstoqueAguaEl;
    window.dashboardEstoqueGasEl = dashboardEstoqueGasEl;
    window.dashboardMateriaisSeparacaoCountEl = dashboardMateriaisSeparacaoCountEl;
    window.dashboardMateriaisRetiradaCountEl = dashboardMateriaisRetiradaCountEl;

    // Elementos do DOM (Água)
    window.formAgua = formAgua;
    window.selectUnidadeAgua = selectUnidadeAgua;
    window.selectTipoAgua = selectTipoAgua;
    window.inputDataAgua = inputDataAgua;
    window.inputResponsavelAgua = inputResponsavelAgua;
    window.btnSubmitAgua = btnSubmitAgua;
    window.alertAgua = alertAgua;
    window.tableStatusAgua = tableStatusAgua;
    window.alertAguaLista = alertAguaLista;
    window.inputQtdEntregueAgua = inputQtdEntregueAgua;
    window.inputQtdRetornoAgua = inputQtdRetornoAgua;
    window.formGroupQtdEntregueAgua = formGroupQtdEntregueAgua;
    window.formGroupQtdRetornoAgua = formGroupQtdRetornoAgua;
    window.estoqueAguaInicialEl = estoqueAguaInicialEl;
    window.estoqueAguaEntradasEl = estoqueAguaEntradasEl;
    window.estoqueAguaSaidasEl = estoqueAguaSaidasEl;
    window.estoqueAguaAtualEl = estoqueAguaAtualEl;
    window.loadingEstoqueAguaEl = loadingEstoqueAguaEl;
    window.resumoEstoqueAguaEl = resumoEstoqueAguaEl;
    window.formEntradaAgua = formEntradaAgua;
    window.inputDataEntradaAgua = inputDataEntradaAgua;
    window.btnSubmitEntradaAgua = btnSubmitEntradaAgua;
    window.formInicialAguaContainer = formInicialAguaContainer;
    window.formInicialAgua = formInicialAgua;
    window.inputInicialQtdAgua = inputInicialQtdAgua;
    window.inputInicialResponsavelAgua = inputInicialResponsavelAgua;
    window.btnSubmitInicialAgua = btnSubmitInicialAgua;
    window.alertInicialAgua = alertInicialAgua;
    window.btnAbrirInicialAgua = btnAbrirInicialAgua;
    window.tableHistoricoAgua = tableHistoricoAgua;
    window.alertHistoricoAgua = alertHistoricoAgua;

    // Elementos do DOM (Gás)
    window.formGas = formGas;
    window.selectUnidadeGas = selectUnidadeGas;
    window.selectTipoGas = selectTipoGas;
    window.inputDataGas = inputDataGas;
    window.inputResponsavelGas = inputResponsavelGas;
    window.btnSubmitGas = btnSubmitGas;
    window.alertGas = alertGas;
    window.tableStatusGas = tableStatusGas;
    window.alertGasLista = alertGasLista;
    window.inputQtdEntregueGas = inputQtdEntregueGas;
    window.inputQtdRetornoGas = inputQtdRetornoGas;
    window.formGroupQtdEntregueGas = formGroupQtdEntregueGas;
    window.formGroupQtdRetornoGas = formGroupQtdRetornoGas;
    window.estoqueGasInicialEl = estoqueGasInicialEl;
    window.estoqueGasEntradasEl = estoqueGasEntradasEl;
    window.estoqueGasSaidasEl = estoqueGasSaidasEl;
    window.estoqueGasAtualEl = estoqueGasAtualEl;
    window.loadingEstoqueGasEl = loadingEstoqueGasEl;
    window.resumoEstoqueGasEl = resumoEstoqueGasEl;
    window.formEntradaGas = formEntradaGas;
    window.inputDataEntradaGas = inputDataEntradaGas;
    window.btnSubmitEntradaGas = btnSubmitEntradaGas;
    window.formInicialGasContainer = formInicialGasContainer;
    window.formInicialGas = formInicialGas;
    window.inputInicialQtdGas = inputInicialQtdGas;
    window.inputInicialResponsavelGas = inputInicialResponsavelGas;
    window.btnSubmitInicialGas = btnSubmitInicialGas;
    window.alertInicialGas = alertInicialGas;
    window.btnAbrirInicialGas = btnAbrirInicialGas;
    window.tableHistoricoGas = tableHistoricoGas;
    window.alertHistoricoGas = alertHistoricoGas;

    // Elementos do DOM (Materiais)
    window.formMateriais = formMateriais;
    window.selectUnidadeMateriais = selectUnidadeMateriais;
    window.selectTipoMateriais = selectTipoMateriais;
    window.inputDataSeparacao = inputDataSeparacao;
    window.textareaItensMateriais = textareaItensMateriais;
    window.inputResponsavelMateriais = inputResponsavelMateriais;
    window.btnSubmitMateriais = btnSubmitMateriais;
    window.alertMateriais = alertMateriais;
    window.tableStatusMateriais = tableStatusMateriais;
    window.alertMateriaisLista = alertMateriaisLista;
    window.inputArquivoMateriais = inputArquivoMateriais;
    window.modalDefinirResponsavelSeparacao = modalDefinirResponsavelSeparacao;
    window.inputNomeResponsavelSeparacao = inputNomeResponsavelSeparacao;
    window.btnConfirmarResponsavelSeparacao = btnConfirmarResponsavelSeparacao;
    window.btnCancelarResponsavelSeparacao = btnCancelarResponsavelSeparacao;
    window.materialAtualParaLiberacao = materialAtualParaLiberacao;

    // Elementos do DOM (Gestão)
    window.tableGestaoUnidades = tableGestaoUnidades;
    window.alertGestao = alertGestao;
    window.textareaBulkUnidades = textareaBulkUnidades;
    window.btnBulkAddUnidades = btnBulkAddUnidades;
    window.filtroUnidadeNome = filtroUnidadeNome;
    window.filtroUnidadeTipo = filtroUnidadeTipo;

    // Elementos do DOM (Relatório)
    window.relatorioTipo = relatorioTipo;
    window.relatorioDataInicio = relatorioDataInicio;
    window.relatorioDataFim = relatorioDataFim;
    window.btnGerarPdf = btnGerarPdf;
    window.alertRelatorio = alertRelatorio;
    
    // Funções e vars importadas do Firebase (para os módulos que não importam)
    window.serverTimestamp = serverTimestamp;
    window.Timestamp = Timestamp;
    window.addDoc = addDoc;
    window.doc = doc;
    window.updateDoc = updateDoc;
    window.getDoc = getDoc;
    window.deleteDoc = deleteDoc;
    window.ref = ref;
    window.uploadBytesResumable = uploadBytesResumable;
    window.getDownloadURL = getDownloadURL;
    window.deleteObject = deleteObject;
    
    // --- *** FIM DA CORREÇÃO DE ESCOPO *** ---

    if(typeof lucide !== 'undefined') lucide.createIcons();

    // --- INICIALIZA OS MÓDULOS ---
    if (typeof initAgua === 'function') initAgua();
    if (typeof initGas === 'function') initGas();
    if (typeof initMateriais === 'function') initMateriais();
    if (typeof initUnidades === 'function') initUnidades();
    if (typeof initRelatorio === 'function') initRelatorio();

    // --- MARCA domReady como TRUE ---
    console.log("setupApp concluído! Marcando domReady = true");
    domReady = true; 

    // Chama funções de renderização inicial (permanece o mesmo)
    updateLastUpdateTime(); 
    renderDashboardMateriaisProntos(currentDashboardMaterialFilter); // Agora usa a versão ajustada
    renderDashboardAguaSummary();
    renderDashboardGasSummary();
    renderDashboardVisaoGeralSummary();
    renderDashboardMateriaisCounts();

    // Chama switchTab por último (permanece o mesmo)
    console.log("Chamando switchTab('dashboard') após setupApp...");
    switchTab('dashboard'); 
}


// --- LÓGICA DE EXCLUSÃO (GENÉRICA) ---
// (Esta seção não precisa de alterações, mas deve estar presente)

function openConfirmDeleteModal(id, type, details = '') {
    if (!confirmDeleteModal) return;
    deleteInfo = { id, type, details, collectionRef: null, isInicial: false };
    
    deleteWarningUnidadeEl.style.display = 'none';
    deleteWarningInicialEl.style.display = 'none';

    switch (type) {
        case 'agua':
            deleteInfo.collectionRef = aguaCollection;
            deleteDetailsEl.textContent = `Movimentação de Água (ID: ...${id.slice(-6)})`;
            break;
        case 'gas':
            deleteInfo.collectionRef = gasCollection;
            deleteDetailsEl.textContent = `Movimentação de Gás (ID: ...${id.slice(-6)})`;
            break;
        case 'materiais':
            deleteInfo.collectionRef = materiaisCollection;
            deleteDetailsEl.textContent = `Registro de Material (ID: ...${id.slice(-6)})`;
            break;
        case 'unidade':
            deleteInfo.collectionRef = unidadesCollection;
            deleteDetailsEl.textContent = `Unidade: ${details}`;
            deleteWarningUnidadeEl.style.display = 'block';
            break;
        case 'entrada-agua':
            deleteInfo.collectionRef = estoqueAguaCollection;
            deleteDetailsEl.textContent = `Entrada de Estoque de Água (ID: ...${id.slice(-6)})`;
            deleteInfo.isInicial = fb_estoque_agua.find(e => e.id === id)?.tipo === 'inicial';
             if(deleteInfo.isInicial) deleteWarningInicialEl.style.display = 'block';
            break;
        case 'entrada-gas':
            deleteInfo.collectionRef = estoqueGasCollection;
            deleteDetailsEl.textContent = `Entrada de Estoque de Gás (ID: ...${id.slice(-6)})`;
            deleteInfo.isInicial = fb_estoque_gas.find(e => e.id === id)?.tipo === 'inicial';
            if(deleteInfo.isInicial) deleteWarningInicialEl.style.display = 'block';
            break;
        default:
            console.error("Tipo de exclusão desconhecido:", type);
            return;
    }
    confirmDeleteModal.style.display = 'flex';
}

async function handleConfirmDelete() {
    const { id, type, collectionRef } = deleteInfo;
    if (!id || !type || !collectionRef || !isAuthReady) {
        showAlert('alert-gestao', 'Erro ao identificar item para exclusão.', 'error');
        return;
    }

    btnConfirmDelete.disabled = true;
    btnConfirmDelete.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';

    try {
        const docRef = doc(collectionRef, id);
        
        if (type === 'materiais') {
            const materialDoc = await getDoc(docRef);
            const materialData = materialDoc.data();
            if (materialData && materialData.storagePath) {
                console.log(`Removendo arquivo anexado: ${materialData.storagePath}`);
                const fileRef = ref(storage, materialData.storagePath);
                await deleteObject(fileRef);
            }
        }
        
        if (type === 'unidade') {
            await deleteRelatedData(id);
        }

        await deleteDoc(docRef);
        
        let alertId = 'alert-gestao'; 
        if (type.includes('agua')) alertId = 'alert-agua-lista';
        if (type.includes('gas')) alertId = 'alert-gas-lista';
        if (type === 'materiais') alertId = 'alert-materiais-lista';
        
        showAlert(alertId, 'Item removido com sucesso!', 'success');
        
    } catch (error) {
        console.error("Erro ao remover item:", error);
        showAlert('alert-gestao', `Erro ao remover: ${error.message}`, 'error');
    } finally {
        confirmDeleteModal.style.display = 'none';
        btnConfirmDelete.disabled = false;
        btnConfirmDelete.textContent = 'Confirmar Exclusão';
        deleteInfo = { id: null, type: null, collectionRef: null, details: null, isInicial: false };
    }
}

async function deleteRelatedData(unidadeId) {
    console.warn(`Iniciando exclusão de dados relacionados para Unidade ID: ${unidadeId}`);
    const collectionsToClean = [aguaCollection, gasCollection, materiaisCollection];
    
    for (const collRef of collectionsToClean) {
        try {
            const q = query(collRef, where("unidadeId", "==", unidadeId));
            const snapshot = await getDocs(q);
            if (snapshot.empty) continue;

            const batch = writeBatch(db);
            snapshot.docs.forEach(async (docSnapshot) => {
                 if (collRef === materiaisCollection) {
                    const materialData = docSnapshot.data();
                    if (materialData && materialData.storagePath) {
                        try {
                            const fileRef = ref(storage, materialData.storagePath);
                            await deleteObject(fileRef);
                        } catch (fileError) {
                            console.error(`Falha ao remover arquivo ${materialData.storagePath}: ${fileError.message}`);
                        }
                    }
                }
                batch.delete(docSnapshot.ref);
            });
            await batch.commit();
            console.log(`Removidos ${snapshot.size} documentos da coleção ${collRef.id} para a unidade ${unidadeId}`);
        } catch (error) {
            console.error(`Erro ao limpar coleção ${collRef.id} para unidade ${unidadeId}:`, error);
        }
    }
}

// --- CONTROLE DE REFRESH DO DASHBOARD ---
// (Esta seção não precisa de alterações)

function startDashboardRefresh() {
    if (dashboardRefreshInterval) clearInterval(dashboardRefreshInterval); 
    dashboardRefreshInterval = setInterval(() => {
        if (visaoAtiva === 'dashboard') {
            console.log("Atualização automática do Dashboard...");
            updateLastUpdateTime(); 
            
            // Força a re-renderização dos componentes do dashboard
            // que dependem dos dados do Firestore (que já estão atualizados pelos listeners)
            renderDashboardAguaSummary();
            renderDashboardGasSummary();
            renderDashboardMateriaisList();
            renderDashboardMateriaisProntos(currentDashboardMaterialFilter);
            renderDashboardVisaoGeralSummary();
            renderDashboardMateriaisCounts();
        }
    }, 120000); // 2 minutos
}

function stopDashboardRefresh() {
    if (dashboardRefreshInterval) {
        clearInterval(dashboardRefreshInterval);
        dashboardRefreshInterval = null;
    }
}

function filterDashboardMateriais(status) {
    currentDashboardMaterialFilter = status; 
    renderDashboardMateriaisProntos(status); 
    if(status) { 
        switchTab('dashboard'); 
        switchDashboardView('geral');
    }
}


// --- INICIALIZAÇÃO GERAL ---
// --- MUDANÇA DE DOMContentLoaded PARA window.onload ---
window.addEventListener('load', () => { 
    console.log("PÁGINA COMPLETAMENTE CARREGADA (window.load). Iniciando setupApp...");
    
    // --- CORREÇÃO DE INICIALIZAÇÃO ---
    // 1. Roda o setupApp() PRIMEIRO para encontrar todos os elementos
    //    do DOM e marcar domReady = true.
    setupApp(); 
    
    // 2. Inicia o Firebase DEPOIS que o DOM está pronto.
    console.log("setupApp concluído. Iniciando Firebase..."); 
    initFirebase(); 
});



