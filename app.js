// --- IMPORTS DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query, Timestamp, serverTimestamp, setLogLevel, setDoc, getDocs, where, limit, getDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
// NOVO: Imports do Storage
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- CONFIGURAÇÃO E VARIÁVEIS GLOBAIS ---

const userFallbackConfig = { 
    apiKey: "AIzaSyD7VCxaHo8veaHnM8RwY60EX_DEh3hOVHk", 
    authDomain: "controle-almoxarifado-semcas.firebaseapp.com", 
    projectId: "controle-almoxarifado-semcas", 
    storageBucket: "controle-almoxarifado-semcas.firebasestorage.app", 
    messagingSenderId: "916615427315", 
    appId: "1:916615427315:web:6823897ed065c50d413386" 
};

const firebaseConfigString = typeof __firebase_config !== 'undefined' ? __firebase_config : JSON.stringify(userFallbackConfig);
const firebaseConfig = JSON.parse(firebaseConfigString);

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const appId = rawAppId.replace(/[\/.]/g, '-');

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app, auth, db, storage, userId; // <<< Adicionado storage
let isAuthReady = false;
let domReady = false; // <<< BANDEIRA: Indica se o DOM está pronto e elementos encontrados

let unidadesCollection, aguaCollection, gasCollection, materiaisCollection;
let estoqueAguaCollection, estoqueGasCollection;

let fb_unidades = [], fb_agua_movimentacoes = [], fb_gas_movimentacoes = [], fb_materiais = [];
let fb_estoque_agua = [], fb_estoque_gas = [];
let estoqueInicialDefinido = { agua: false, gas: false }; 

// Variáveis de estado da UI
let visaoAtiva = 'dashboard'; 
let dashboardAguaChartInstance, dashboardGasChartInstance;
let dashboardRefreshInterval = null;
let deleteInfo = { id: null, type: null, collectionRef: null, details: null, isInicial: false }; 
let initialMaterialFilter = null; 
let currentDashboardMaterialFilter = null; 

// --- Referências de Elementos (DOM) - Globais (declaradas, mas atribuídas depois) ---
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
let unidadeSaldoAlertaAgua; // NOVO: Alerta de Saldo
let formGas, selectUnidadeGas, selectTipoGas, inputDataGas, inputResponsavelGas, btnSubmitGas, alertGas, tableStatusGas, alertGasLista;
let inputQtdEntregueGas, inputQtdRetornoGas, formGroupQtdEntregueGas, formGroupQtdRetornoGas; 
let unidadeSaldoAlertaGas; // NOVO: Alerta de Saldo
let formMateriais, selectUnidadeMateriais, selectTipoMateriais, inputDataSeparacao, textareaItensMateriais, inputResponsavelMateriais, inputArquivoMateriais, btnSubmitMateriais, alertMateriais, tableStatusMateriais, alertMateriaisLista; // <<< Adicionado inputArquivoMateriais
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
let listaExclusoes = { agua: [], gas: [] };
let modoPrevisao = { agua: null, gas: null };
let graficoPrevisao = { agua: null, gas: null };
let tipoSelecionadoPrevisao = { agua: null, gas: null };

// NOVO: Referências do Modal do Separador
let separadorModal, inputSeparadorNome, btnSalvarSeparador, separadorMaterialIdEl, alertSeparador; // <<< NOVO
// NOVO: Referências do Modal de Responsável do Almoxarifado
let almoxarifadoResponsavelModal, inputAlmoxResponsavelNome, btnSalvarMovimentacaoFinal, alertAlmoxResponsavel; 
let almoxTempFields = {}; // Armazena dados temporariamente

// --- FUNÇÕES DE UTILIDADE ---
function showAlert(elementId, message, type = 'info', duration = 5000) {
    // Só tenta mostrar se domReady for true
    // Removido check domReady daqui para permitir alertas de erro críticos antes
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

function formatTimestampComTempo(timestamp) { // <<< NOVA FUNÇÃO
    if (!timestamp || typeof timestamp.toDate !== 'function') return 'N/A';
    try {
        return timestamp.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { console.error("Erro ao formatar timestamp com tempo:", timestamp, e); return 'Erro Data'; }
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
        // Ignora linhas de observação e linhas de separador/edição
        if (row.querySelectorAll('td').length > 1 && !row.classList.contains('editing-row') && !row.classList.contains('obs-row') && !row.classList.contains('separador-row')) { 
            const rowText = normalizeString(row.textContent);
            const isMatch = rowText.includes(searchTerm);
            row.style.display = isMatch ? '' : 'none';
            
            // Lógica para esconder/mostrar linhas associadas (obs e separador)
            let nextRow = row.nextElementSibling;
            while(nextRow && (nextRow.classList.contains('obs-row') || nextRow.classList.contains('separador-row'))) {
                nextRow.style.display = isMatch ? '' : 'none';
                nextRow = nextRow.nextElementSibling;
            }

        } else if (row.classList.contains('editing-row')) { 
            // Se for linha de edição, mantém visível se a busca for por unidade/tipo (não implementado o filtro complexo aqui, mas mantém a linha de edição visível por segurança)
            // Se for linha de observação ou separador, a visibilidade é controlada pela linha principal
        }
    });
}


// --- INICIALIZAÇÃO E AUTENTICAÇÃO FIREBASE ---
async function initFirebase() {
     try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app); // <<< Adicionado inicializador do Storage
        
        // CORREÇÃO: Busca o connectionStatusEl (que já deve existir pois setupApp() rodou)
        if (connectionStatusEl) {
             connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-yellow-400 rounded-full animate-pulse"></span> <span>Autenticando...</span>`;
        } else {
             // Este log não deve mais aparecer se a ordem de inicialização estiver correta
             console.warn("connectionStatusEl não encontrado ao iniciar initFirebase (ISSO É INESPERADO)");
        }

        onAuthStateChanged(auth, async (user) => { 
            if (user) {
                isAuthReady = true;
                userId = user.uid;
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
                
                // CORREÇÃO: Chama os listeners e a renderização inicial AQUI,
                // pois agora temos certeza que o DOM está pronto (domReady=true) E o usuário está autenticado.
                initFirestoreListeners();
                
                // Chama as funções de renderização que dependem de dados (listeners podem já ter dados)
                console.log("Chamando funções de renderização inicial pós-autenticação...");
                updateLastUpdateTime(); 
                renderDashboardMateriaisProntos(currentDashboardMaterialFilter); 
                renderAguaStatus();
                renderGasStatus();
                renderMateriaisStatus();
                renderEstoqueAgua();
                renderHistoricoAgua();
                renderEstoqueGas();
                renderHistoricoGas();
                renderDashboardAguaChart();
                renderDashboardGasChart();
                renderDashboardAguaSummary();
                renderDashboardGasSummary();
                renderDashboardMateriaisList();
                renderDashboardMateriaisCounts();

                // Inicia a UI
                console.log("Chamando switchTab('dashboard') após autenticação...");
                switchTab('dashboard'); 
                
            } else {
                isAuthReady = false;
                userId = null; 
                console.log("Usuário deslogado.");
                if (connectionStatusEl) connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-red-500 rounded-full"></span> <span class="text-red-700">Desconectado</span>`;
                clearAlmoxarifadoData();
                 // domReady permanece true, mas os dados são limpos
            }
        });

        // Inicia o processo de autenticação
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
        // Tenta mostrar alerta mesmo sem domReady, mas pode falhar
        showAlert('alert-agua', `Erro crítico na conexão com Firebase: ${error.message}. Recarregue a página.`, 'error', 60000);
    }
}

// --- LÓGICA DO FIRESTORE (LISTENERS) ---
function initFirestoreListeners() {
    if (!isAuthReady || !unidadesCollection) { 
        console.warn("Firestore listeners não iniciados: Auth não pronto ou coleção inválida."); 
        return; 
    }
    console.log("Iniciando listeners do Firestore..."); 

    onSnapshot(query(unidadesCollection), (snapshot) => { 
        fb_unidades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        console.log("Unidades recebidas:", fb_unidades.length);
        if (domReady) { // <<< Só atualiza a UI se o setupApp já rodou >>>
            console.log("DOM pronto, atualizando selects e tabelas de unidades...");
            // CORREÇÃO: Adicionada checagem para evitar erro de elemento null
            if (selectUnidadeAgua) populateUnidadeSelects(selectUnidadeAgua, 'atendeAgua');
            if (selectUnidadeGas) populateUnidadeSelects(selectUnidadeGas, 'atendeGas');
            if (selectUnidadeMateriais) populateUnidadeSelects(selectUnidadeMateriais, 'atendeMateriais');
            if (document.getElementById('select-previsao-unidade-agua-v2')) populateUnidadeSelects(document.getElementById('select-previsao-unidade-agua-v2'), 'atendeAgua', false); 
            if (document.getElementById('select-previsao-unidade-gas-v2')) populateUnidadeSelects(document.getElementById('select-previsao-unidade-gas-v2'), 'atendeGas', false); 
            
            populateTipoSelects('agua');
            populateTipoSelects('gas');
            
            if (document.getElementById('select-exclusao-agua')) populateUnidadeSelects(document.getElementById('select-exclusao-agua'), 'atendeAgua', false, true, null); 
            if (document.getElementById('select-exclusao-gas')) populateUnidadeSelects(document.getElementById('select-exclusao-gas'), 'atendeGas', false, true, null); 
            
            renderGestaoUnidades(); 
            renderAguaStatus(); 
            renderGasStatus(); 
        } else {
             // Este log não deve mais aparecer
             console.warn("Listener de unidades: DOM não pronto (domReady=false).");
        }
    }, (error) => { console.error("Erro no listener de unidades:", error); if(domReady) showAlert('alert-gestao', `Erro ao carregar unidades: ${error.message}`, 'error'); });

    onSnapshot(query(aguaCollection), (snapshot) => {
        fb_agua_movimentacoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Mov. Água recebidas:", fb_agua_movimentacoes.length);
        if (domReady) {
            console.log("DOM pronto, atualizando UI de água...");
            renderAguaStatus(); 
            renderDashboardAguaChart(); 
            renderDashboardAguaSummary();
            renderEstoqueAgua();
        } else {
             console.warn("Listener de água: DOM não pronto (domReady=false).");
        }
    }, (error) => { console.error("Erro no listener de água:", error); if(domReady) showAlert('alert-agua-lista', `Erro ao carregar dados de água: ${error.message}`, 'error'); });

    onSnapshot(query(gasCollection), (snapshot) => {
        fb_gas_movimentacoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Mov. Gás recebidas:", fb_gas_movimentacoes.length);
         if (domReady) {
            console.log("DOM pronto, atualizando UI de gás...");
            renderGasStatus(); 
            renderDashboardGasChart(); 
            renderDashboardGasSummary();
            renderEstoqueGas();
         } else {
              console.warn("Listener de gás: DOM não pronto (domReady=false).");
         }
    }, (error) => { console.error("Erro no listener de gás:", error); if(domReady) showAlert('alert-gas-lista', `Erro ao carregar dados de gás: ${error.message}`, 'error'); });

    onSnapshot(query(materiaisCollection), (snapshot) => {
        fb_materiais = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Materiais recebidos:", fb_materiais.length);
         if (domReady) {
            console.log("DOM pronto, atualizando UI de materiais...");
            renderMateriaisStatus(); 
            renderDashboardMateriaisList();
            renderDashboardMateriaisProntos(currentDashboardMaterialFilter); 
            renderDashboardMateriaisCounts();
         } else {
             console.warn("Listener de materiais: DOM não pronto (domReady=false).");
         }
    }, (error) => { console.error("Erro no listener de materiais:", error); if(domReady) showAlert('alert-materiais-lista', `Erro ao carregar materiais: ${error.message}`, 'error'); });

    onSnapshot(query(estoqueAguaCollection), (snapshot) => {
        fb_estoque_agua = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        estoqueInicialDefinido.agua = fb_estoque_agua.some(e => e.tipo === 'inicial');
        console.log("Estoque Água recebido:", fb_estoque_agua.length, "Inicial definido:", estoqueInicialDefinido.agua);
         if (domReady) {
            console.log("DOM pronto, atualizando UI de estoque de água...");
            renderEstoqueAgua();
            renderHistoricoAgua();
         } else {
              console.warn("Listener de estoque de água: DOM não pronto (domReady=false).");
         }
    }, (error) => { console.error("Erro no listener de estoque água:", error); });

    onSnapshot(query(estoqueGasCollection), (snapshot) => {
        fb_estoque_gas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        estoqueInicialDefinido.gas = fb_estoque_gas.some(e => e.tipo === 'inicial');
        console.log("Estoque Gás recebido:", fb_estoque_gas.length, "Inicial definido:", estoqueInicialDefinido.gas);
         if (domReady) {
            console.log("DOM pronto, atualizando UI de estoque de gás...");
            renderEstoqueGas();
            renderHistoricoGas();
         } else {
              console.warn("Listener de estoque de gás: DOM não pronto (domReady=false).");
         }
    }, (error) => { console.error("Erro no listener de estoque gás:", error); });
}

function clearAlmoxarifadoData() {
    fb_unidades = []; fb_agua_movimentacoes = []; fb_gas_movimentacoes = []; fb_materiais = [];
    fb_estoque_agua = []; fb_estoque_gas = []; 
    estoqueInicialDefinido = { agua: false, gas: false };
    currentDashboardMaterialFilter = null; 

    if(domReady) { // domReady deve ser true, mesmo deslogado
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
             // MODIFICADO: Apenas limpa as colunas UL, não substitui o container
             const colunasUL = dashMateriaisProntos.querySelectorAll('ul[id^="coluna-"]');
             if (colunasUL.length > 0) {
                 colunasUL.forEach(ul => ul.innerHTML = '');
             } else {
                 // Fallback se as colunas não existirem (o que não deve acontecer com o index.html corrigido)
                 dashMateriaisProntos.innerHTML = '<p class="text-center py-4 text-red-500 col-span-full">Desconectado</p>';
             }
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

function updateLastUpdateTime() {
     if (!domReady || !lastUpdateTimeEl) return; 
    const now = new Date();
    const formattedDate = now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    lastUpdateTimeEl.textContent = `Atualizado: ${formattedDate}`;
}

function populateUnidadeSelects(selectEl, serviceField, includeAll = false, includeSelecione = true, filterType = null) {
    if (!domReady || !selectEl) return; 
    // CORREÇÃO: Adiciona uma verificação extra para garantir que o elemento não é nulo/undefined
    if (!selectEl) {
        console.warn(`populateUnidadeSelects: Elemento de seleção não encontrado para o campo ${serviceField}.`);
        return;
    }

    let unidadesFiltradas = fb_unidades.filter(u => {
        const atendeServico = serviceField ? (u[serviceField] ?? true) : true;
        let tipoUnidadeNormalizado = (u.tipo || '').toUpperCase();
        if (tipoUnidadeNormalizado === 'SEMCAS') tipoUnidadeNormalizado = 'SEDE';
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


// --- LÓGICA DE CONTROLE DE ÁGUA ---
function toggleAguaFormInputs() {
     if (!domReady) return; 
    if (!selectTipoAgua) return; 
    const tipo = selectTipoAgua.value;
    if (tipo === 'troca') {
        formGroupQtdEntregueAgua?.classList.remove('hidden');
        formGroupQtdRetornoAgua?.classList.remove('hidden');
    } else if (tipo === 'entrega') {
        formGroupQtdEntregueAgua?.classList.remove('hidden');
        formGroupQtdRetornoAgua?.classList.add('hidden');
        if (inputQtdRetornoAgua) inputQtdRetornoAgua.value = "0"; 
    } else if (tipo === 'retorno') {
        formGroupQtdEntregueAgua?.classList.add('hidden');
        formGroupQtdRetornoAgua?.classList.remove('hidden');
        if (inputQtdEntregueAgua) inputQtdEntregueAgua.value = "0"; 
    }
}

// NOVO: Função para obter o saldo de uma unidade
function getUnidadeSaldo(unidadeId, itemType) {
    if (!unidadeId) return 0;
    const movimentacoes = itemType === 'agua' ? fb_agua_movimentacoes : fb_gas_movimentacoes;
    const entregues = movimentacoes.filter(m => m.unidadeId === unidadeId && m.tipo === 'entrega').reduce((sum, m) => sum + m.quantidade, 0);
    const recebidos = movimentacoes.filter(m => m.unidadeId === unidadeId && m.tipo === 'retorno').reduce((sum, m) => sum + m.quantidade, 0);
    return entregues - recebidos;
}

// NOVO: Função para verificar e exibir o alerta de saldo
function checkUnidadeSaldoAlert(itemType) {
    if (!domReady) return;
    const selectUnidade = itemType === 'agua' ? selectUnidadeAgua : selectUnidadeGas;
    const saldoAlertaEl = itemType === 'agua' ? unidadeSaldoAlertaAgua : unidadeSaldoAlertaGas;
    const selectValue = selectUnidade.value;
    
    if (!selectValue || !saldoAlertaEl) {
        if(saldoAlertaEl) saldoAlertaEl.style.display = 'none';
        return;
    }
    
    const [unidadeId, unidadeNome, tipoUnidadeRaw] = selectValue.split('|');
    const saldo = getUnidadeSaldo(unidadeId, itemType);
    const itemLabel = itemType === 'agua' ? 'galão de água' : 'botijão de gás';

    let message = '';
    let type = 'info';
    
    if (saldo > 0) {
        // Unidade deve garrafões/botijões.
        message = `⚠️ Atenção! A unidade **${unidadeNome}** está devendo **${saldo}** ${itemLabel}${saldo > 1 ? 's' : ''} vazio${saldo > 1 ? 's' : ''}. Confirme se o saldo está correto antes de entregar mais.`;
        type = 'warning';
    } else if (saldo < 0) {
        // Unidade tem crédito (entregou mais vazios do que recebeu cheios).
        message = `👍 A unidade **${unidadeNome}** tem um crédito de **${Math.abs(saldo)}** ${itemLabel}${Math.abs(saldo) > 1 ? 's' : ''} (recebeu a mais). Lançamento OK para troca/saída.`;
        type = 'success';
    } else {
        // Saldo zero
        message = `✅ A unidade **${unidadeNome}** tem saldo zero. Perfeito para uma troca 1:1.`;
        type = 'info';
    }

    saldoAlertaEl.className = `alert alert-${type} mt-2`;
    saldoAlertaEl.innerHTML = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    saldoAlertaEl.style.display = 'block';
}

// MODIFICADO: handleAguaSubmit agora chama o modal para pegar o responsável do almoxarifado
async function handleAguaSubmit(e) {
     e.preventDefault();
    if (!isAuthReady) { showAlert('alert-agua', 'Erro: Não autenticado.', 'error'); return; }
    if (!domReady) { showAlert('alert-agua', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
    
    const selectValue = selectUnidadeAgua.value; 
    if (!selectValue) { showAlert('alert-agua', 'Selecione uma unidade.', 'warning'); return; }
    const [unidadeId, unidadeNome, tipoUnidadeRaw] = selectValue.split('|');
    
    const tipoMovimentacao = selectTipoAgua.value; 
    const qtdEntregue = parseInt(inputQtdEntregueAgua.value, 10) || 0;
    const qtdRetorno = parseInt(inputQtdRetornoAgua.value, 10) || 0;
    const data = dateToTimestamp(inputDataAgua.value);
    const responsavelUnidade = capitalizeString(inputResponsavelAgua.value.trim()); 
    
    if (!unidadeId || !data || !responsavelUnidade) {
        showAlert('alert-agua', 'Dados inválidos. Verifique Unidade, Data e Nome de quem Recebeu/Devolveu.', 'warning'); return;
    }
    if (tipoMovimentacao === 'troca' && qtdEntregue === 0 && qtdRetorno === 0) {
         showAlert('alert-agua', 'Para "Troca", ao menos uma das quantidades deve ser maior que zero.', 'warning'); return;
    }
    if (tipoMovimentacao === 'entrega' && qtdEntregue <= 0) {
         showAlert('alert-agua', 'Para "Apenas Saída", a quantidade deve ser maior que zero.', 'warning'); return;
    }
    if (tipoMovimentacao === 'retorno' && qtdRetorno <= 0) {
         showAlert('alert-agua', 'Para "Apenas Retorno", a quantidade deve ser maior que zero.', 'warning'); return;
    }
    
    // Verifica estoque antes de abrir o modal (se houver saída)
    if (qtdEntregue > 0) {
        if (!estoqueInicialDefinido.agua) {
            showAlert('alert-agua', 'Defina o Estoque Inicial de Água antes de lançar saídas.', 'warning'); return;
        }
        const estoqueAtual = parseInt(estoqueAguaAtualEl.textContent) || 0;
        if (qtdEntregue > estoqueAtual) {
            showAlert('alert-agua', `Erro: Estoque insuficiente. Disponível: ${estoqueAtual}`, 'error'); return;
        }
        
        // Se houver saída, abre o modal para pegar o responsável do almoxarifado
        almoxTempFields = {
            unidadeId, unidadeNome, tipoUnidadeRaw,
            tipoMovimentacao, qtdEntregue, qtdRetorno,
            data, responsavelUnidade, itemType: 'agua'
        };
        // Preenche os campos hidden do modal
        document.getElementById('almox-temp-unidadeId').value = unidadeId;
        document.getElementById('almox-temp-unidadeNome').value = unidadeNome;
        document.getElementById('almox-temp-tipoUnidadeRaw').value = tipoUnidadeRaw;
        document.getElementById('almox-temp-tipoMovimentacao').value = tipoMovimentacao;
        document.getElementById('almox-temp-qtdEntregue').value = qtdEntregue;
        document.getElementById('almox-temp-qtdRetorno').value = qtdRetorno;
        document.getElementById('almox-temp-data').value = data.toMillis();
        document.getElementById('almox-temp-responsavelUnidade').value = responsavelUnidade;
        document.getElementById('almox-temp-itemType').value = 'agua';

        // Atualiza título do modal e abre
        const modalTitle = almoxarifadoResponsavelModal.querySelector('.modal-title');
        if (modalTitle) modalTitle.innerHTML = `<i data-lucide="box" class="w-5 h-5"></i> Confirmação de Saída de Estoque (Água)`;
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } 
        
        // Tenta preencher o nome do almoxarifado a partir da última entrada de estoque, se disponível (opcional)
        // Não implementado para evitar complexidade, o usuário deve digitar.
        
        almoxarifadoResponsavelModal.style.display = 'flex'; // Usar flex para centralizar
        document.getElementById('input-almox-responsavel-nome').focus();
        showAlert('alert-agua', 'Quase lá! Agora informe seu nome no pop-up para finalizar a entrega.', 'info');
        return;
    }
    
    // Se for APENAS RETORNO, salva diretamente sem modal
    if (tipoMovimentacao === 'retorno' && qtdRetorno > 0) {
         executeFinalMovimentacao({
            unidadeId, unidadeNome, tipoUnidadeRaw,
            tipoMovimentacao, qtdEntregue, qtdRetorno,
            data, responsavelUnidade, itemType: 'agua',
            responsavelAlmoxarifado: 'N/A - Apenas Retorno' // Não precisa de nome do almox.
         });
    }
}

// NOVO: Função única para executar o salvamento final (chamada do modal)
async function executeFinalMovimentacao(data) {
     if (!isAuthReady || !data.itemType) return;
     
    const itemType = data.itemType;
    const collection = itemType === 'agua' ? aguaCollection : gasCollection;
    const btnSubmit = itemType === 'agua' ? btnSubmitAgua : btnSubmitGas;
    const alertId = itemType === 'agua' ? 'alert-agua' : 'alert-gas';
    const formToReset = itemType === 'agua' ? formAgua : formGas;
    const inputData = itemType === 'agua' ? inputDataAgua : inputDataGas;
    
    const tipoUnidade = (data.tipoUnidadeRaw || '').toUpperCase() === 'SEMCAS' ? 'SEDE' : (data.tipoUnidadeRaw || '').toUpperCase();
    
    // Desabilita o botão para evitar duplicidade
    if (btnSubmit) {
        btnSubmit.disabled = true; 
        btnSubmit.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    }

    let msgSucesso = [];
    
    try {
        const timestamp = serverTimestamp();
        
        // 1. ENTREGA (SAÍDA DE ESTOQUE)
        if (data.qtdEntregue > 0) {
            await addDoc(collection, { 
                unidadeId: data.unidadeId, 
                unidadeNome: data.unidadeNome, 
                tipoUnidade: tipoUnidade, 
                tipo: 'entrega', 
                quantidade: data.qtdEntregue, 
                data: data.data, 
                responsavel: data.responsavelUnidade, // Responsável da Unidade
                responsavelAlmoxarifado: data.responsavelAlmoxarifado, // Responsável do Almoxarifado
                registradoEm: timestamp 
            });
            msgSucesso.push(`${data.qtdEntregue} ${itemType === 'agua' ? 'galão(ões)' : 'botijão(ões)'} entregue(s)`);
        }
        
        // 2. RETORNO (ENTRADA EM ESTOQUE VAZIO/CRÉDITO)
        if (data.qtdRetorno > 0) {
             await addDoc(collection, { 
                 unidadeId: data.unidadeId, 
                 unidadeNome: data.unidadeNome, 
                 tipoUnidade: tipoUnidade, 
                 tipo: 'retorno', 
                 quantidade: data.qtdRetorno, 
                 data: data.data, 
                 responsavel: data.responsavelUnidade, // Responsável da Unidade
                 responsavelAlmoxarifado: data.responsavelAlmoxarifado, // Responsável do Almoxarifado
                 registradoEm: timestamp 
            });
             msgSucesso.push(`${data.qtdRetorno} ${itemType === 'agua' ? 'galão(ões)' : 'botijão(ões)'} recebido(s)`);
        }
        
        showAlert(alertId, `Movimentação salva! ${msgSucesso.join('; ')}.`, 'success');
        
        // Limpa e reseta
        if(formToReset) formToReset.reset(); 
        if(inputData) inputData.value = getTodayDateString(); 
        if (itemType === 'agua') toggleAguaFormInputs();
        if (itemType === 'gas') toggleGasFormInputs();
        
        almoxarifadoResponsavelModal.style.display = 'none'; // Fecha o modal se estava aberto

    } catch (error) { 
        console.error(`Erro salvar movimentação (${itemType}):`, error); 
        showAlert(alertId, `Erro: ${error.message}`, 'error');
        showAlert('alert-almox-responsavel', `Erro ao salvar: ${error.message}. Tente novamente.`, 'error'); // Alerta do modal
    } finally { 
        if (btnSubmit) {
            btnSubmit.disabled = false; 
            btnSubmit.textContent = 'Salvar Movimentação'; 
        }
        const btnModal = document.getElementById('btn-salvar-movimentacao-final');
         if(btnModal) {
             btnModal.disabled = false;
             btnModal.innerHTML = '<i data-lucide="package-open"></i> Confirmar Entrega';
             if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); }
         }
    }
}


// NOVO: Handler para o clique final no modal
async function handleFinalMovimentacaoSubmit() {
    if (!isAuthReady || !domReady) return;
    const nomeAlmoxarifado = capitalizeString(inputAlmoxResponsavelNome.value.trim());
    const itemType = document.getElementById('almox-temp-itemType').value;
    
    if (!nomeAlmoxarifado) {
        showAlert('alert-almox-responsavel', 'Por favor, informe seu nome (Almoxarifado) para registrar a entrega.', 'warning');
        return;
    }
    
    const btnModal = document.getElementById('btn-salvar-movimentacao-final');
    btnModal.disabled = true;
    btnModal.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    
    // Coleta dados do formulário temporário
    const dataMillis = parseInt(document.getElementById('almox-temp-data').value, 10);
    const dataTemp = Timestamp.fromMillis(dataMillis);
    
    const finalData = {
        unidadeId: document.getElementById('almox-temp-unidadeId').value,
        unidadeNome: document.getElementById('almox-temp-unidadeNome').value,
        tipoUnidadeRaw: document.getElementById('almox-temp-tipoUnidadeRaw').value,
        tipoMovimentacao: document.getElementById('almox-temp-tipoMovimentacao').value,
        qtdEntregue: parseInt(document.getElementById('almox-temp-qtdEntregue').value, 10),
        qtdRetorno: parseInt(document.getElementById('almox-temp-qtdRetorno').value, 10),
        data: dataTemp,
        responsavelUnidade: document.getElementById('almox-temp-responsavelUnidade').value,
        responsavelAlmoxarifado: nomeAlmoxarifado, // NOVO CAMPO SALVO
        itemType: itemType
    };
    
    await executeFinalMovimentacao(finalData);
}

function renderAguaStatus() {
     if (!tableStatusAgua) return;
     if (!domReady) { console.warn("renderAguaStatus chamada antes do DOM pronto."); return; }
     
     const statusMap = new Map();
     fb_unidades.forEach(u => { 
        let tipoNormalizado = (u.tipo || 'N/A').toUpperCase();
        if (tipoNormalizado === 'SEMCAS') tipoNormalizado = 'SEDE';
        statusMap.set(u.id, { id: u.id, nome: u.nome, tipo: tipoNormalizado, entregues: 0, recebidos: 0, ultimosLancamentos: [] }); 
    });

     const movsOrdenadas = [...fb_agua_movimentacoes].sort((a, b) => (b.registradoEm?.toMillis() || 0) - (a.registradoEm?.toMillis() || 0));
     
     movsOrdenadas.forEach(m => {
         if (statusMap.has(m.unidadeId)) {
             const unidadeStatus = statusMap.get(m.unidadeId);
             if (m.tipo === 'entrega') unidadeStatus.entregues += m.quantidade;
             else if (m.tipo === 'retorno') unidadeStatus.recebidos += m.quantidade;
             
             // Armazena todos os lançamentos (melhor para o futuro, mas usa só o último)
             unidadeStatus.ultimosLancamentos.push({
                 id: m.id, 
                 respUnidade: m.responsavel, 
                 respAlmox: m.responsavelAlmoxarifado || 'N/A', // NOVO: Responsável do Almoxarifado
                 data: formatTimestamp(m.data), 
                 tipo: m.tipo, 
                 quantidade: m.quantidade
            });
         }
     });

     const statusArray = Array.from(statusMap.values())
         .map(s => ({ ...s, pendentes: s.entregues - s.recebidos })) 
         .filter(s => s.entregues > 0 || s.recebidos > 0 || s.pendentes !== 0) 
         .sort((a, b) => b.pendentes - a.pendentes || a.nome.localeCompare(b.nome)); 

    if (statusArray.length === 0) { 
        tableStatusAgua.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500">Nenhuma movimentação registrada.</td></tr>'; 
        return; 
    }
    tableStatusAgua.innerHTML = statusArray.map(s => {
        const saldo = s.pendentes;
        const saldoText = saldo > 0 ? `Faltando ${saldo}` : (saldo < 0 ? `Crédito ${Math.abs(saldo)}` : 'Zerado');
        const saldoClass = saldo > 0 ? 'text-red-600 font-extrabold' : (saldo < 0 ? 'text-blue-600' : 'text-green-600');
        
        const ultimoLancamento = s.ultimosLancamentos[0];
        let ultimoLancamentoText = 'N/A';
        let remocaoBtn = '-';
        if(ultimoLancamento) {
            const item = (ultimoLancamento.tipo === 'entrega' ? 'Entregue' : 'Recebido');
            const responsavelPrincipal = ultimoLancamento.respUnidade;
            ultimoLancamentoText = `${item} (${ultimoLancamento.quantidade} un.) por ${responsavelPrincipal} em ${ultimoLancamento.data}. Almox: ${ultimoLancamento.respAlmox}`;
            remocaoBtn = `<button class="btn-danger btn-remove" data-id="${ultimoLancamento.id}" data-type="agua" title="Remover último lançamento. Responsável da Unidade: ${responsavelPrincipal}"><i data-lucide="trash-2"></i></button>`;
        }
        
        return `
        <tr title="${ultimoLancamentoText}">
            <td class="font-medium">${s.nome}</td><td>${s.tipo || 'N/A'}</td>
            <td class="text-center">${s.entregues}</td><td class="text-center">${s.recebidos}</td>
            <td class="text-center font-bold ${saldoClass}">${saldoText}</td>
            <td class="text-center space-x-1 whitespace-nowrap">
                ${formatTimestamp(s.ultimosLancamentos[0]?.data) || 'N/A'}
                ${remocaoBtn}
            </td>
        </tr>
    `}).join('');
     if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } // CORREÇÃO 1: Garante que lucide existe

    const filtroStatusAguaEl = document.getElementById('filtro-status-agua');
    if (filtroStatusAguaEl && filtroStatusAguaEl.value) {
        filterTable(filtroStatusAguaEl, 'table-status-agua');
    }
}


// --- LÓGICA DE CONTROLE DE GÁS ---
function toggleGasFormInputs() {
     if (!domReady) return; 
    if (!selectTipoGas) return; 
    const tipo = selectTipoGas.value;
    if (tipo === 'troca') {
        formGroupQtdEntregueGas?.classList.remove('hidden');
        formGroupQtdRetornoGas?.classList.remove('hidden');
    } else if (tipo === 'entrega') {
        formGroupQtdEntregueGas?.classList.remove('hidden');
        formGroupQtdRetornoGas?.classList.add('hidden');
        if(inputQtdRetornoGas) inputQtdRetornoGas.value = "0"; 
    } else if (tipo === 'retorno') {
        formGroupQtdEntregueGas?.classList.add('hidden');
        formGroupQtdRetornoGas?.classList.remove('hidden');
        if(inputQtdEntregueGas) inputQtdEntregueGas.value = "0"; 
    }
}

// MODIFICADO: handleGasSubmit agora chama o modal para pegar o responsável do almoxarifado
async function handleGasSubmit(e) {
    e.preventDefault();
    if (!isAuthReady) { showAlert('alert-gas', 'Erro: Não autenticado.', 'error'); return; }
    if (!domReady) { showAlert('alert-gas', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
    const selectValue = selectUnidadeGas.value; 
    if (!selectValue) { showAlert('alert-gas', 'Selecione uma unidade.', 'warning'); return; }
    const [unidadeId, unidadeNome, tipoUnidadeRaw] = selectValue.split('|');

    const tipoMovimentacao = selectTipoGas.value; 
    const qtdEntregue = parseInt(inputQtdEntregueGas.value, 10) || 0;
    const qtdRetorno = parseInt(inputQtdRetornoGas.value, 10) || 0;
    const data = dateToTimestamp(inputDataGas.value);
    const responsavelUnidade = capitalizeString(inputResponsavelGas.value.trim()); 
    
     if (!unidadeId || !data || !responsavelUnidade) { 
        showAlert('alert-gas', 'Dados inválidos. Verifique Unidade, Data e Nome de quem Recebeu/Devolveu.', 'warning'); return;
    }
    if (tipoMovimentacao === 'troca' && qtdEntregue === 0 && qtdRetorno === 0) {
         showAlert('alert-gas', 'Para "Troca", ao menos uma das quantidades deve ser maior que zero.', 'warning'); return;
    }
    if (tipoMovimentacao === 'entrega' && qtdEntregue <= 0) {
         showAlert('alert-gas', 'Para "Apenas Saída", a quantidade deve ser maior que zero.', 'warning'); return;
    }
    if (tipoMovimentacao === 'retorno' && qtdRetorno <= 0) {
         showAlert('alert-gas', 'Para "Apenas Retorno", a quantidade deve ser maior que zero.', 'warning'); return;
    }
    
    // Verifica estoque antes de abrir o modal (se houver saída)
    if (qtdEntregue > 0) {
        if (!estoqueInicialDefinido.gas) {
            showAlert('alert-gas', 'Defina o Estoque Inicial de Gás antes de lançar saídas.', 'warning'); return;
        }
        const estoqueAtual = parseInt(estoqueGasAtualEl.textContent) || 0;
        if (qtdEntregue > estoqueAtual) {
            showAlert('alert-gas', `Erro: Estoque insuficiente. Disponível: ${estoqueAtual}`, 'error'); return;
        }
        
        // Se houver saída, abre o modal para pegar o responsável do almoxarifado
        almoxTempFields = {
            unidadeId, unidadeNome, tipoUnidadeRaw,
            tipoMovimentacao, qtdEntregue, qtdRetorno,
            data, responsavelUnidade, itemType: 'gas'
        };
        // Preenche os campos hidden do modal
        document.getElementById('almox-temp-unidadeId').value = unidadeId;
        document.getElementById('almox-temp-unidadeNome').value = unidadeNome;
        document.getElementById('almox-temp-tipoUnidadeRaw').value = tipoUnidadeRaw;
        document.getElementById('almox-temp-tipoMovimentacao').value = tipoMovimentacao;
        document.getElementById('almox-temp-qtdEntregue').value = qtdEntregue;
        document.getElementById('almox-temp-qtdRetorno').value = qtdRetorno;
        document.getElementById('almox-temp-data').value = data.toMillis();
        document.getElementById('almox-temp-responsavelUnidade').value = responsavelUnidade;
        document.getElementById('almox-temp-itemType').value = 'gas';

        // Atualiza título do modal e abre
        const modalTitle = almoxarifadoResponsavelModal.querySelector('.modal-title');
        if (modalTitle) modalTitle.innerHTML = `<i data-lucide="box" class="w-5 h-5"></i> Confirmação de Saída de Estoque (Gás)`;
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } 

        almoxarifadoResponsavelModal.style.display = 'flex';
        document.getElementById('input-almox-responsavel-nome').focus();
        showAlert('alert-gas', 'Quase lá! Agora informe seu nome no pop-up para finalizar a entrega.', 'info');
        return;
    }
    
    // Se for APENAS RETORNO, salva diretamente sem modal
    if (tipoMovimentacao === 'retorno' && qtdRetorno > 0) {
         executeFinalMovimentacao({
            unidadeId, unidadeNome, tipoUnidadeRaw,
            tipoMovimentacao, qtdEntregue, qtdRetorno,
            data, responsavelUnidade, itemType: 'gas',
            responsavelAlmoxarifado: 'N/A - Apenas Retorno' // Não precisa de nome do almox.
         });
    }
}

function renderGasStatus() {
    if (!tableStatusGas) return;
    if (!domReady) { console.warn("renderGasStatus chamada antes do DOM pronto."); return; }

    const statusMap = new Map();
     fb_unidades.forEach(u => { 
        let tipoNormalizado = (u.tipo || 'N/A').toUpperCase();
        if (tipoNormalizado === 'SEMCAS') tipoNormalizado = 'SEDE';
        statusMap.set(u.id, { id: u.id, nome: u.nome, tipo: tipoNormalizado, entregues: 0, recebidos: 0, ultimosLancamentos: [] }); 
    });

    const movsOrdenadas = [...fb_gas_movimentacoes].sort((a, b) => (b.registradoEm?.toMillis() || 0) - (a.registradoEm?.toMillis() || 0));
    
    movsOrdenadas.forEach(m => {
         if (statusMap.has(m.unidadeId)) {
             const unidadeStatus = statusMap.get(m.unidadeId);
             if (m.tipo === 'entrega') unidadeStatus.entregues += m.quantidade;
             else if (m.tipo === 'retorno') unidadeStatus.recebidos += m.quantidade;
              // Armazena todos os lançamentos (melhor para o futuro, mas usa só o último)
             unidadeStatus.ultimosLancamentos.push({
                 id: m.id, 
                 respUnidade: m.responsavel, 
                 respAlmox: m.responsavelAlmoxarifado || 'N/A', // NOVO: Responsável do Almoxarifado
                 data: formatTimestamp(m.data), 
                 tipo: m.tipo, 
                 quantidade: m.quantidade
            });
         }
     });

     const statusArray = Array.from(statusMap.values())
         .map(s => ({ ...s, pendentes: s.entregues - s.recebidos }))
         .filter(s => s.entregues > 0 || s.recebidos > 0 || s.pendentes !== 0) 
         .sort((a, b) => b.pendentes - a.pendentes || a.nome.localeCompare(b.nome));

    if (statusArray.length === 0) { 
        tableStatusGas.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500">Nenhuma movimentação registrada.</td></tr>'; 
        return; 
    }
     tableStatusGas.innerHTML = statusArray.map(s => {
        const saldo = s.pendentes;
        const saldoText = saldo > 0 ? `Faltando ${saldo}` : (saldo < 0 ? `Crédito ${Math.abs(saldo)}` : 'Zerado');
        const saldoClass = saldo > 0 ? 'text-red-600 font-extrabold' : (saldo < 0 ? 'text-blue-600' : 'text-green-600');
        
        const ultimoLancamento = s.ultimosLancamentos[0];
        let ultimoLancamentoText = 'N/A';
        let remocaoBtn = '-';
        if(ultimoLancamento) {
            const item = (ultimoLancamento.tipo === 'entrega' ? 'Entregue' : 'Recebido');
            const responsavelPrincipal = ultimoLancamento.respUnidade;
            ultimoLancamentoText = `${item} (${ultimoLancamento.quantidade} un.) por ${responsavelPrincipal} em ${ultimoLancamento.data}. Almox: ${ultimoLancamento.respAlmox}`;
             remocaoBtn = `<button class="btn-danger btn-remove" data-id="${ultimoLancamento.id}" data-type="gas" title="Remover último lançamento. Responsável da Unidade: ${responsavelPrincipal}"><i data-lucide="trash-2"></i></button>`;
        }
        
        return `
        <tr title="${ultimoLancamentoText}">
            <td class="font-medium">${s.nome}</td><td>${s.tipo || 'N/A'}</td>
            <td class="text-center">${s.entregues}</td><td class="text-center">${s.recebidos}</td>
            <td class="text-center font-bold ${saldoClass}">${saldoText}</td>
             <td class="text-center space-x-1 whitespace-nowrap">
                ${formatTimestamp(s.ultimosLancamentos[0]?.data) || 'N/A'}
                ${remocaoBtn}
            </td>
        </tr>
    `}).join('');
     if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } // CORREÇÃO 2: Garante que lucide existe

    const filtroStatusGasEl = document.getElementById('filtro-status-gas');
    if (filtroStatusGasEl && filtroStatusGasEl.value) {
        filterTable(filtroStatusGasEl, 'table-status-gas');
    }
}


// --- LÓGICA DE PREVISÃO INTELIGENTE ---
window.selecionarModoPrevisao = (tipoItem, modo) => {
    if (!domReady) return; 
    console.log(`Modo Previsão (${tipoItem}): ${modo}`);
    modoPrevisao[tipoItem] = modo;
    
    const configContainer = document.getElementById(`config-previsao-${tipoItem}`);
    const cards = document.querySelectorAll(`#subview-previsao-${tipoItem} .previsao-option-card`);
    const selectUnidadeContainer = document.getElementById(`select-unidade-container-${tipoItem}`);
    const selectTipoContainer = document.getElementById(`select-tipo-container-${tipoItem}`);
    const selectTipoEl = document.getElementById(`select-previsao-tipo-${tipoItem}`); 
    const exclusaoContainer = document.getElementById(`exclusao-container-${tipoItem}`);
    const selectExclusaoEl = document.getElementById(`select-exclusao-${tipoItem}`); 

    configContainer.classList.remove('hidden');
    selectUnidadeContainer.classList.add('hidden');
    selectTipoContainer.classList.add('hidden');
    exclusaoContainer.classList.remove('hidden'); 
    
    cards.forEach(card => card.classList.toggle('selected', card.dataset.modo === modo));

    if (modo === 'unidade-especifica') {
        selectUnidadeContainer.classList.remove('hidden');
        exclusaoContainer.classList.add('hidden'); 
        tipoSelecionadoPrevisao[tipoItem] = null; 
    } else if (modo === 'por-tipo') {
        selectTipoContainer.classList.remove('hidden');
        tipoSelecionadoPrevisao[tipoItem] = selectTipoEl.value; 
        populateUnidadeSelects(selectExclusaoEl, tipoItem === 'agua' ? 'atendeAgua' : 'atendeGas', false, true, tipoSelecionadoPrevisao[tipoItem]); 
    } else if (modo === 'completo') {
        tipoSelecionadoPrevisao[tipoItem] = null; 
         populateUnidadeSelects(selectExclusaoEl, tipoItem === 'agua' ? 'atendeAgua' : 'atendeGas', false, true, null);
    }

    listaExclusoes[tipoItem] = [];
    renderizarListaExclusoes(tipoItem);
    
    selectTipoEl.removeEventListener('change', handleTipoPrevisaoChange); 
    selectTipoEl.addEventListener('change', handleTipoPrevisaoChange); 
}

function handleTipoPrevisaoChange(event) {
    if (!domReady) return; 
    const selectEl = event.target;
    const tipoItem = selectEl.id.includes('agua') ? 'agua' : 'gas'; 
    const novoTipo = selectEl.value;
    tipoSelecionadoPrevisao[tipoItem] = novoTipo; 
    
    const selectExclusaoEl = document.getElementById(`select-exclusao-${tipoItem}`);
    populateUnidadeSelects(selectExclusaoEl, tipoItem === 'agua' ? 'atendeAgua' : 'atendeGas', false, true, novoTipo); 
    
    listaExclusoes[tipoItem] = [];
    renderizarListaExclusoes(tipoItem);
}

window.adicionarExclusao = (tipoItem) => {
    if (!domReady) return; 
    const selectExclusao = document.getElementById(`select-exclusao-${tipoItem}`);
    const unidadeId = selectExclusao.value;
    if (!unidadeId || unidadeId === 'todas') return; 
    
    if (listaExclusoes[tipoItem].find(item => item.id === unidadeId)) {
        selectExclusao.value = ""; 
        return;
    }

    const unidadeNome = selectExclusao.options[selectExclusao.selectedIndex].text;
    listaExclusoes[tipoItem].push({ id: unidadeId, nome: unidadeNome });
    
    renderizarListaExclusoes(tipoItem); 
    selectExclusao.value = ""; 
}

function renderizarListaExclusoes(tipoItem) {
     if (!domReady) return; 
    const container = document.getElementById(`lista-exclusoes-${tipoItem}`);
    container.innerHTML = listaExclusoes[tipoItem].map((item, index) => `
        <span class="exclusao-item">
            ${item.nome}
            <button type="button" onclick="removerExclusao('${tipoItem}', ${index})">&times;</button>
        </span>
    `).join('');
}

window.removerExclusao = (tipoItem, index) => {
     if (!domReady) return; 
    listaExclusoes[tipoItem].splice(index, 1); 
    renderizarListaExclusoes(tipoItem); 
}

window.calcularPrevisaoInteligente = (tipoItem) => {
     if (!domReady) return; 
    console.log(`Calculando previsão para ${tipoItem}...`);
    const alertId = `alertas-previsao-${tipoItem}`;
    const resultadoContainerId = `resultado-previsao-${tipoItem}-v2`;
    
    if (!modoPrevisao[tipoItem]) {
        showAlert(alertId, 'Por favor, selecione um modo de previsão primeiro (Etapa 1).', 'warning');
        return;
    }

    const diasPrevisao = parseInt(document.getElementById(`dias-previsao-${tipoItem}`).value, 10) || 7;
    const margemSeguranca = (parseInt(document.getElementById(`margem-seguranca-${tipoItem}`).value, 10) || 15) / 100;
    
    let unidadeIdFiltro = null;
    let tipoUnidadeFiltro = null;

    if (modoPrevisao[tipoItem] === 'unidade-especifica') {
        unidadeIdFiltro = document.getElementById(`select-previsao-unidade-${tipoItem}-v2`).value;
        if (!unidadeIdFiltro) {
            showAlert(alertId, 'Por favor, selecione uma unidade específica (Etapa 2).', 'warning');
            return;
        }
    } else if (modoPrevisao[tipoItem] === 'por-tipo') {
        tipoUnidadeFiltro = document.getElementById(`select-previsao-tipo-${tipoItem}`).value;
         if (!tipoUnidadeFiltro) {
            showAlert(alertId, 'Por favor, selecione um tipo de unidade (Etapa 2).', 'warning');
            return;
        }
    }
    
    document.getElementById(resultadoContainerId).classList.remove('hidden');
    const resultadoContentEl = document.getElementById(`resultado-content-${tipoItem}`);
    const alertasContentEl = document.getElementById(alertId);
    resultadoContentEl.innerHTML = '<div class="loading-spinner-small mx-auto" style="border-color: #fff; border-top-color: #ccc;"></div>';
    alertasContentEl.innerHTML = ''; 

    const movimentacoes = (tipoItem === 'agua') ? fb_agua_movimentacoes : fb_gas_movimentacoes;
    const idsExcluidos = new Set(listaExclusoes[tipoItem].map(item => item.id)); 
    
    let movsFiltradas = movimentacoes.filter(m => {
        let tipoMov = (m.tipoUnidade || '').toUpperCase();
        if (tipoMov === 'SEMCAS') tipoMov = 'SEDE';

        const isEntrega = m.tipo === 'entrega';
        const hasData = m.data;
        const naoExcluida = !idsExcluidos.has(m.unidadeId);
        const unidadeMatch = !unidadeIdFiltro || m.unidadeId === unidadeIdFiltro;
        const tipoMatch = !tipoUnidadeFiltro || tipoMov === tipoUnidadeFiltro.toUpperCase(); 

        return isEntrega && hasData && naoExcluida && unidadeMatch && tipoMatch;
    });

    let tituloPrevisao = "Previsão Completa";
    if (modoPrevisao[tipoItem] === 'unidade-especifica') {
        const unidade = fb_unidades.find(u => u.id === unidadeIdFiltro);
        tituloPrevisao = `Previsão para: ${unidade?.nome || 'Unidade Desconhecida'}`;
    } else if (modoPrevisao[tipoItem] === 'por-tipo') {
        tituloPrevisao = `Previsão para tipo: ${tipoUnidadeFiltro}`;
    }

    if (movsFiltradas.length < 2) {
        resultadoContentEl.innerHTML = `<p class="text-yellow-200">Dados insuficientes para calcular (necessário no mínimo 2 entregas no período/filtro).</p>`;
        if (graficoPrevisao[tipoItem]) graficoPrevisao[tipoItem].destroy(); 
        return;
    }
    
    movsFiltradas.sort((a, b) => a.data.toMillis() - b.data.toMillis());
    
    const primeiraData = movsFiltradas[0].data.toDate();
    const ultimaData = movsFiltradas[movsFiltradas.length - 1].data.toDate();
    
    const diffTime = Math.abs(ultimaData.getTime() - primeiraData.getTime());
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays === 0) diffDays = 1; 
    
    const totalQuantidade = movsFiltradas.reduce((sum, m) => sum + (m.quantidade || 0), 0);
    const mediaDiaria = totalQuantidade / diffDays;
    
    const previsaoBase = mediaDiaria * diasPrevisao;
    const valorMargem = previsaoBase * margemSeguranca;
    const previsaoFinal = Math.ceil(previsaoBase + valorMargem); 

    resultadoContentEl.innerHTML = `
        <h4 class="text-lg font-semibold mb-3">${tituloPrevisao}</h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
                <span class="text-sm opacity-80 block">Média Diária</span>
                <span class="text-2xl font-bold">${mediaDiaria.toFixed(2)}</span>
            </div>
            <div>
                <span class="text-sm opacity-80 block">Previsão p/ ${diasPrevisao} dias</span>
                <span class="text-2xl font-bold">${Math.ceil(previsaoBase)}</span>
            </div>
            <div>
                <span class="text-sm opacity-80 block">Total Recomendado (+${(margemSeguranca * 100).toFixed(0)}%)</span>
                <span class="text-3xl font-bold text-yellow-300">${previsaoFinal}</span>
            </div>
        </div>
        <p class="text-xs opacity-70 mt-3 text-center">Cálculo baseado em ${totalQuantidade} unidades entregues entre ${formatTimestamp(movsFiltradas[0].data)} e ${formatTimestamp(movsFiltradas[movsFiltradas.length - 1].data)} (${diffDays} dias).</p>
         ${listaExclusoes[tipoItem].length > 0 ? `<p class="text-xs opacity-70 mt-1 text-center text-red-200">Excluídas: ${listaExclusoes[tipoItem].map(u=>u.nome).join(', ')}</p>` : ''}
    `;
    
    renderizarGraficoPrevisao(tipoItem, movsFiltradas);
    
    const estoqueAtualEl = (tipoItem === 'agua') ? estoqueAguaAtualEl : estoqueGasAtualEl;
    const estoqueAtual = parseInt(estoqueAtualEl?.textContent || '0') || 0;
        
    if (estoqueAtual < previsaoFinal) {
         alertasContentEl.innerHTML = `
            <div class="previsao-alerta">
                <h4 class="font-bold text-yellow-800">Alerta de Estoque Baixo!</h4>
                <p class="text-sm text-yellow-700">Seu estoque atual (${estoqueAtual}) está abaixo da necessidade prevista (${previsaoFinal}) para os próximos ${diasPrevisao} dias. Recomenda-se reposição.</p>
            </div>
        `;
    } else {
         alertasContentEl.innerHTML = `
             <div class="alert alert-success"> 
                <h4 class="font-bold">Estoque Suficiente</h4>
                <p class="text-sm">Seu estoque atual (${estoqueAtual}) parece suficiente para a demanda prevista (${previsaoFinal}) nos próximos ${diasPrevisao} dias.</p>
             </div>
         `;
         document.querySelector(`#${alertId} .alert-success`).style.display = 'block'; 
    }
     if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } 
}

function renderizarGraficoPrevisao(tipoItem, movsFiltradas) {
    if (!domReady) return; 
    const canvasId = `grafico-previsao-${tipoItem}`;
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const dadosPorDia = movsFiltradas.reduce((acc, m) => {
        const dataFormatada = formatTimestamp(m.data);
        if (!acc[dataFormatada]) {
            acc[dataFormatada] = { timestamp: m.data.toMillis(), total: 0 };
        }
        acc[dataFormatada].total += m.quantidade;
        return acc;
    }, {});
    
    const diasOrdenados = Object.keys(dadosPorDia).sort((a, b) => dadosPorDia[a].timestamp - dadosPorDia[b].timestamp);
    
    const labels = diasOrdenados;
    const data = diasOrdenados.map(dia => dadosPorDia[dia].total);

    if (graficoPrevisao[tipoItem]) {
        graficoPrevisao[tipoItem].destroy();
    }
    
    graficoPrevisao[tipoItem] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Consumo Diário (Entregas)',
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.1 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            scales: {
                y: { 
                    beginAtZero: true, 
                    ticks: { precision: 0 } 
                },
                x: { 
                    ticks: {
                        autoSkip: true, 
                        maxTicksLimit: 10 
                    }
                }
            },
            plugins: {
                legend: { display: false } 
            }
        }
    });
}


// --- LÓGICA DE CONTROLE DE MATERIAIS ---
async function handleMateriaisSubmit(e) {
    e.preventDefault();
    if (!isAuthReady) { showAlert('alert-materiais', 'Erro: Não autenticado.', 'error'); return; }
     if (!domReady) { showAlert('alert-materiais', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
    const selectValue = selectUnidadeMateriais.value; 
    if (!selectValue) { showAlert('alert-materiais', 'Selecione uma unidade.', 'warning'); return; }
    const [unidadeId, unidadeNome, tipoUnidadeRaw] = selectValue.split('|');
    const tipoUnidade = (tipoUnidadeRaw || '').toUpperCase() === 'SEMCAS' ? 'SEDE' : (tipoUnidadeRaw || '').toUpperCase();

    const tipoMaterial = selectTipoMateriais.value;
    const dataSeparacao = dateToTimestamp(inputDataSeparacao.value); // Data da requisição
    const itens = textareaItensMateriais.value.trim();
    
    const responsavelLancamento = capitalizeString(inputResponsavelMateriais.value.trim()); // <<< NOME ATUALIZADO
    const arquivo = inputArquivoMateriais.files[0];
     
     // ATUALIZADO: Verifica responsavelLancamento
     if (!unidadeId || !tipoMaterial || !dataSeparacao || !responsavelLancamento) {
        showAlert('alert-materiais', 'Dados inválidos. Verifique unidade, tipo, data e Responsável pelo Lançamento.', 'warning'); return;
    }
    
    btnSubmitMateriais.disabled = true; 
    
    let fileURL = null;
    let storagePath = null;

    // Lógica de Upload (Se houver arquivo)
    if (arquivo) {
        if (arquivo.size > 10 * 1024 * 1024) { // Limite de 10MB
            showAlert('alert-materiais', 'Erro: Arquivo muito grande (máx 10MB).', 'error');
            btnSubmitMateriais.disabled = false;
            return;
        }
        
        btnSubmitMateriais.innerHTML = '<div class="loading-spinner-small mx-auto"></div><span class="ml-2">Enviando arquivo...</span>';
        showAlert('alert-materiais', 'Enviando arquivo anexo...', 'info', 10000);

        try {
            const fileId = `${Date.now()}_${arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
            storagePath = `artifacts/${appId}/pedidosMateriais/${fileId}`;
            const storageRef = ref(storage, storagePath);
            
            const snapshot = await uploadBytes(storageRef, arquivo);
            fileURL = await getDownloadURL(snapshot.ref);
            
            console.log("Arquivo enviado:", fileURL);
            showAlert('alert-materiais', 'Arquivo enviado! Salvando registro...', 'info', 10000);

        } catch (error) {
            console.error("Erro no upload do arquivo:", error);
            showAlert('alert-materiais', `Erro ao enviar arquivo: ${error.message}`, 'error');
            btnSubmitMateriais.disabled = false; 
            btnSubmitMateriais.textContent = 'Registrar Requisição';
            return;
        }
    } else {
         btnSubmitMateriais.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    }
    
    // Salvar no Firestore
    try {
        await addDoc(materiaisCollection, {
            unidadeId, unidadeNome, tipoUnidade, tipoMaterial,
            dataSeparacao: dataSeparacao, // Data da Requisição
            itens,
            status: 'requisitado', // <<< NOVO STATUS INICIAL
            dataInicioSeparacao: null, // <<< NOVO
            dataRetirada: null,
            dataEntrega: null,
            responsavelLancamento: responsavelLancamento, // <<< NOME ATUALIZADO
            responsavelSeparador: null, // <<< NOVO
            responsavelEntrega: null,
            registradoEm: serverTimestamp(),
            fileURL: fileURL,
            storagePath: storagePath,
            downloadInfo: { count: 0, lastDownload: null, blockedUntil: null } // <<< NOVO para controle download
        });
        showAlert('alert-materiais', 'Requisição registrada!', 'success'); // Mensagem atualizada
        formMateriais.reset(); 
        inputDataSeparacao.value = getTodayDateString(); 
    } catch (error) { 
        console.error("Erro salvar requisição:", error); // Atualizado
        showAlert('alert-materiais', `Erro: ${error.message}`, 'error');
    } finally { 
        btnSubmitMateriais.disabled = false; 
        btnSubmitMateriais.textContent = 'Registrar Requisição'; // Atualizado
    }
}

function renderMateriaisStatus() {
     if (!tableStatusMateriais) return;
     if (!domReady) { console.warn("renderMateriaisStatus chamada antes do DOM pronto."); return; }

    const materiaisOrdenados = [...fb_materiais].sort((a,b) => {
        const statusOrder = { 'requisitado': 0, 'separacao': 1, 'retirada': 2, 'entregue': 3 };
        const statusCompare = (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
        if (statusCompare !== 0) return statusCompare;
        // Ordena por data de requisição (dataSeparacao no BD) decrescente dentro do mesmo status
        return (b.dataSeparacao?.toMillis() || 0) - (a.dataSeparacao?.toMillis() || 0);
    });

    if (materiaisOrdenados.length === 0) {
        // CORREÇÃO: Remove o spinner de carregamento persistente
        tableStatusMateriais.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-500">Nenhuma requisição registrada.</td></tr>';
        return;
    }

    tableStatusMateriais.innerHTML = materiaisOrdenados.map(m => {
        let statusClass = '';
        let statusText = '';
        let acoesHtml = '';
        let downloadBtnHtml = ''; // Botão de download/iniciar separação

        const isEntregue = m.status === 'entregue';
        const now = Timestamp.now();
        const isBlocked = m.downloadInfo?.blockedUntil && m.downloadInfo.blockedUntil.toMillis() > now.toMillis();
        const blockTimeRemaining = isBlocked ? Math.ceil((m.downloadInfo.blockedUntil.toMillis() - now.toMillis()) / (60 * 1000)) : 0; // Minutos restantes

        // 1. Botão de Download / Iniciar Separação
        if (m.fileURL) {
            if (m.status === 'requisitado') {
                downloadBtnHtml = `<button class="btn-icon btn-start-separacao text-orange-600 hover:text-orange-800" data-id="${m.id}" title="Iniciar Separação (Requer Nome)"><i data-lucide="play-circle"></i></button>`;
            } else if (m.status === 'separacao' || m.status === 'retirada' || m.status === 'entregue') {
                 if (isBlocked) {
                     downloadBtnHtml = `<span class="btn-icon text-red-400" title="Download bloqueado por ${blockTimeRemaining} min."><i data-lucide="lock"></i></span>`;
                 } else {
                     const downloadCount = m.downloadInfo?.count || 0;
                     const title = `Baixar Pedido (${downloadCount}/2 downloads usados)`;
                     // Passa a URL pelo data-url para a função handleDownloadPedido
                     downloadBtnHtml = `<button class="btn-icon btn-download-pedido text-blue-600 hover:text-blue-800 ${downloadCount >= 2 ? 'opacity-50 cursor-not-allowed' : ''}" data-id="${m.id}" data-url="${m.fileURL}" ${downloadCount >= 2 ? 'disabled' : ''} title="${title}"><i data-lucide="download-cloud"></i></button>`;
                 }
            } else {
                 // Caso o status não seja nenhum dos anteriores, mas tenha URL (não deveria acontecer)
                 downloadBtnHtml = `<span class="btn-icon text-slate-300" title="Aguardando início da separação"><i data-lucide="file-clock"></i></span>`;
            }
        } else {
            // Se não tem anexo
            if (m.status === 'requisitado') {
                 downloadBtnHtml = `<button class="btn-icon btn-start-separacao text-orange-600 hover:text-orange-800" data-id="${m.id}" title="Iniciar Separação (Sem anexo)"><i data-lucide="play-circle"></i></button>`;
            } else {
                downloadBtnHtml = `<span class="btn-icon text-slate-300" title="Nenhum pedido anexado"><i data-lucide="file-x"></i></span>`;
            }
        }


        // 2. Status e Ações principais
        if (m.status === 'requisitado') {
             statusClass = 'badge-purple'; // Cor nova para requisitado
             statusText = 'Requisitado';
             acoesHtml = ''; // Ação principal é iniciar separação (no lugar do download)
        } else if (m.status === 'separacao') {
            statusClass = 'badge-yellow';
            statusText = 'Em Separação';
            acoesHtml = `
                <button class="btn-info btn-retirada text-xs py-1 px-2" data-id="${m.id}">Disponível p/ Retirada</button>
            `;
        } else if (m.status === 'retirada') {
            statusClass = 'badge-green';
            statusText = 'Disponível p/ Retirada';
            acoesHtml = `
                <button class="btn-success btn-entregue text-xs py-1 px-2" data-id="${m.id}">Entregue</button>
            `;
        } else { // entregue
            statusClass = 'badge-gray';
            statusText = 'Entregue';
            acoesHtml = '';
        }

        // Tooltip e Linha Principal
        const tooltipText = `Lançado por: ${m.responsavelLancamento || 'N/A'} em ${formatTimestampComTempo(m.registradoEm)}`;
        const linhaPrincipal = `
            <tr class="align-top ${isEntregue ? 'opacity-60' : ''}" title="${tooltipText}">
                <td class="font-medium">${m.unidadeNome || 'Unidade Desc.'}</td>
                <td class="capitalize">${m.tipoMaterial || 'N/D'}</td>
                <td>${formatTimestamp(m.dataSeparacao)}</td> <!-- Data da Requisição -->
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td class="text-center space-x-1 whitespace-nowrap"> <!-- Ajustado para alinhar ícones -->
                    ${acoesHtml}
                    ${downloadBtnHtml} <!-- Botão Iniciar/Download -->
                    <button class="btn-danger btn-remove" data-id="${m.id}" data-type="materiais" title="Remover esta requisição"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`;

        // Linha de Observação
        const linhaObservacao = m.itens ? `
            <tr class="obs-row ${isEntregue ? 'opacity-60' : ''} border-b border-slate-200">
                <td colspan="5" class="pt-0 pb-1 px-6 text-xs text-slate-500 whitespace-pre-wrap italic">Obs: ${m.itens}</td>
            </tr>` : '';

        // Linha do Separador
        const linhaSeparador = m.responsavelSeparador ? `
             <tr class="separador-row ${isEntregue ? 'opacity-60' : ''} ${m.status === 'separacao' ? 'bg-yellow-50' : (m.status === 'retirada' ? 'bg-green-50' : 'bg-gray-50')} border-b-2 border-slate-200">
                <td colspan="5" class="py-1 px-6 text-xs text-slate-600">
                    <span class="font-semibold">Separador:</span> ${m.responsavelSeparador}
                    ${m.dataInicioSeparacao ? ` <span class="text-slate-400">(${formatTimestampComTempo(m.dataInicioSeparacao)})</span>` : ''}
                </td>
            </tr>` : '';


        return linhaPrincipal + linhaObservacao + linhaSeparador;
    }).join('');
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } // CORREÇÃO 3: Garante que lucide existe

     // Reaplicar filtro se houver
     const filtroMateriaisEl = document.getElementById('filtro-status-materiais');
    if (filtroMateriaisEl && filtroMateriaisEl.value) {
        filterTable(filtroMateriaisEl, 'table-status-materiais');
    }
}

async function handleMarcarRetirada(e) {
    const button = e.target.closest('button.btn-retirada[data-id]');
    if (!button) return; 
    
    const materialId = button.dataset.id;
    if (!isAuthReady || !materialId) return;
    
    button.disabled = true; button.innerHTML = '<div class="loading-spinner-small mx-auto" style="width: 16px; height: 16px; border-width: 2px;"></div>';
    
    try {
        const docRef = doc(materiaisCollection, materialId);
        await updateDoc(docRef, { 
            status: 'retirada', 
            dataRetirada: serverTimestamp() 
        });
        showAlert('alert-materiais-lista', 'Material marcado como Disponível para Retirada!', 'success', 3000);
    } catch (error) { 
        console.error("Erro marcar p/ retirada:", error); 
        showAlert('alert-materiais-lista', `Erro: ${error.message}`, 'error'); 
        button.disabled = false; 
        button.textContent = 'Disponível p/ Retirada'; 
    }
}

async function handleMarcarEntregue(e) {
    const button = e.target.closest('button.btn-entregue[data-id]');
    if (!button) return; 
    
    const materialId = button.dataset.id;
    if (!isAuthReady || !materialId) return;
    
    const material = fb_materiais.find(m => m.id === materialId);
    // Alterado para usar responsavelSeparador, que é quem está liberando
    const responsavelEntrega = material?.responsavelSeparador || "Responsável (Retirada)"; 
    const storagePath = material?.storagePath; // <<< NOVO: Pega o caminho do arquivo
    
    button.disabled = true; button.innerHTML = '<div class="loading-spinner-small mx-auto" style="width: 16px; height: 16px; border-width: 2px;"></div>';
    
    try {
        const docRef = doc(materiaisCollection, materialId);
        await updateDoc(docRef, { 
            status: 'entregue', 
            dataEntrega: serverTimestamp(), 
            responsavelEntrega: capitalizeString(responsavelEntrega) 
        });
        showAlert('alert-materiais-lista', 'Material marcado como entregue!', 'success', 3000);
        
        // NOVO: Excluir arquivo do Storage
        if (storagePath) {
            try {
                const fileRef = ref(storage, storagePath);
                await deleteObject(fileRef);
                console.log("Arquivo anexo excluído:", storagePath);
            } catch (error) {
                // Não bloquear o usuário por isso, apenas logar
                console.warn("Erro ao excluir arquivo anexo:", error);
                showAlert('alert-materiais-lista', 'Material entregue, mas houve um erro ao limpar o anexo.', 'warning', 4000);
            }
        }

    } catch (error) { 
        console.error("Erro marcar entregue:", error); 
        showAlert('alert-materiais-lista', `Erro: ${error.message}`, 'error'); 
        button.disabled = false; 
        button.textContent = 'Entregue'; 
    } 
}

// --- NOVAS FUNÇÕES PARA FLUXO DO SEPARADOR ---

function openSeparadorModal(materialId) {
    if (!domReady || !separadorModal || !separadorMaterialIdEl || !inputSeparadorNome) return;
    console.log("Abrindo modal para material ID:", materialId);
    separadorMaterialIdEl.value = materialId;
    inputSeparadorNome.value = ''; // Limpa o campo
    inputSeparadorNome.disabled = false;
    btnSalvarSeparador.disabled = false;
    btnSalvarSeparador.innerHTML = 'Salvar Nome e Liberar';
    alertSeparador.style.display = 'none';
    separadorModal.style.display = 'flex'; // Usa flex para centralizar
    inputSeparadorNome.focus();
}

async function handleSalvarSeparador() {
    if (!isAuthReady || !domReady || !inputSeparadorNome || !separadorMaterialIdEl) return;

    const nomeSeparador = capitalizeString(inputSeparadorNome.value.trim());
    const materialId = separadorMaterialIdEl.value;

    if (!nomeSeparador) {
        showAlert('alert-separador', 'Por favor, informe o nome do separador.', 'warning');
        return;
    }
    if (!materialId) {
        showAlert('alert-separador', 'Erro: ID do material não encontrado.', 'error');
        return;
    }

    btnSalvarSeparador.disabled = true;
    inputSeparadorNome.disabled = true;
    btnSalvarSeparador.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';

    try {
        const docRef = doc(materiaisCollection, materialId);
        await updateDoc(docRef, {
            status: 'separacao', // Muda o status para Em Separação
            responsavelSeparador: nomeSeparador,
            dataInicioSeparacao: serverTimestamp() // Marca quando a separação começou
        });

        showAlert('alert-separador', 'Nome salvo! O status foi atualizado para "Em Separação".', 'success', 4000);
        // Fecha o modal após um pequeno delay para o usuário ver a msg de sucesso
        setTimeout(() => {
            if (separadorModal) separadorModal.style.display = 'none';
        }, 2000);

        // Opcional: Tenta iniciar o download automaticamente após salvar (se houver URL)
        const material = fb_materiais.find(m => m.id === materialId);
        if (material?.fileURL) {
             // Chama a função de download após salvar o nome
             setTimeout(() => {
                 handleDownloadPedido(materialId, material.fileURL);
             }, 500); // Pequeno delay
        }

    } catch (error) {
        console.error("Erro ao salvar nome do separador:", error);
        showAlert('alert-separador', `Erro ao salvar: ${error.message}`, 'error');
        btnSalvarSeparador.disabled = false;
        inputSeparadorNome.disabled = false;
        btnSalvarSeparador.innerHTML = 'Salvar Nome e Liberar';
    }
}

async function handleDownloadPedido(materialId, fileURL) {
    if (!isAuthReady || !domReady || !materialId || !fileURL) return;

    const material = fb_materiais.find(m => m.id === materialId);
    if (!material) {
        console.error("Material não encontrado para download:", materialId);
        showAlert('alert-materiais-lista', 'Erro: Registro não encontrado.', 'error');
        return;
    }

    const now = Timestamp.now();
    const downloadInfo = material.downloadInfo || { count: 0, lastDownload: null, blockedUntil: null };

    // Verifica se está bloqueado
    if (downloadInfo.blockedUntil && downloadInfo.blockedUntil.toMillis() > now.toMillis()) {
        const blockTimeRemaining = Math.ceil((downloadInfo.blockedUntil.toMillis() - now.toMillis()) / (60 * 1000));
        showAlert('alert-materiais-lista', `Download temporariamente bloqueado. Tente novamente em ${blockTimeRemaining} minuto(s).`, 'warning');
        return;
    }

    // Verifica limite de downloads
    if (downloadInfo.count >= 2) {
        showAlert('alert-materiais-lista', 'Limite de 2 downloads atingido para este pedido.', 'warning');
        // Bloqueia por 3 minutos após a segunda tentativa falha
        const blockedUntil = Timestamp.fromMillis(now.toMillis() + 3 * 60 * 1000);
        try {
            const docRef = doc(materiaisCollection, materialId);
            await updateDoc(docRef, {
                'downloadInfo.blockedUntil': blockedUntil
            });
            renderMateriaisStatus(); // Re-renderiza para mostrar o cadeado
        } catch (error) {
            console.error("Erro ao bloquear download:", error);
        }
        return;
    }

    // Incrementa contador e registra download
    const newCount = downloadInfo.count + 1;
    let newBlockedUntil = null;
    let blockDurationMinutes = 0;

    // Se for o segundo download, bloqueia por 3 min
    if (newCount === 2) {
        blockDurationMinutes = 3;
        newBlockedUntil = Timestamp.fromMillis(now.toMillis() + blockDurationMinutes * 60 * 1000);
    }
    // Opcional: Bloco de segurança que não deve ser atingido se a lógica de bloqueio do topo estiver correta
    // else if (newCount > 2) {
    //     blockDurationMinutes = 60;
    //     newBlockedUntil = Timestamp.fromMillis(now.toMillis() + blockDurationMinutes * 60 * 1000);
    // }


    try {
        const docRef = doc(materiaisCollection, materialId);
        await updateDoc(docRef, {
            'downloadInfo.count': newCount,
            'downloadInfo.lastDownload': now,
            'downloadInfo.blockedUntil': newBlockedUntil
        });

        // Abre o link do arquivo em nova aba
        window.open(fileURL, '_blank');

        if (blockDurationMinutes > 0) {
            showAlert('alert-materiais-lista', `Download ${newCount}/2 realizado. Próximo download bloqueado por ${blockDurationMinutes} min.`, 'info', 6000);
        } else {
            showAlert('alert-materiais-lista', `Download ${newCount}/2 realizado.`, 'info', 4000);
        }

        renderMateriaisStatus(); // Atualiza a interface (contador e possível cadeado)

    } catch (error) {
        console.error("Erro ao atualizar contador/bloqueio de download:", error);
        showAlert('alert-materiais-lista', `Erro ao registrar download: ${error.message}`, 'error');
    }
}


// --- LÓGICA DE GESTÃO DE UNIDADES ---
function renderGestaoUnidades() {
    if (!tableGestaoUnidades) return;
     if (!domReady) { console.warn("renderGestaoUnidades chamada antes do DOM pronto."); return; }
    
    const filtroNome = normalizeString(filtroUnidadeNome.value);
    const filtroTipo = normalizeString(filtroUnidadeTipo.value);
    const unidadesFiltradas = fb_unidades.filter(unidade => {
        const nomeNormalizado = normalizeString(unidade.nome);
        let tipoNormalizado = normalizeString(unidade.tipo);
        if (tipoNormalizado === 'semcas') tipoNormalizado = 'sede';
        
        const nomeMatch = !filtroNome || nomeNormalizado.includes(filtroNome);
        const tipoMatch = !filtroTipo || tipoNormalizado.includes(normalizeString(filtroTipo));
        return nomeMatch && tipoMatch;
    });

    if (unidadesFiltradas.length === 0) { 
        tableGestaoUnidades.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-slate-500">Nenhuma unidade encontrada ${ (filtroNome || filtroTipo) ? 'com estes filtros' : 'cadastrada. Adicione abaixo.'}</td></tr>`; 
        return; 
    }
    tableGestaoUnidades.innerHTML = unidadesFiltradas.map(unidade => {
         let tipoDisplay = (unidade.tipo || 'N/A').toUpperCase();
         if (tipoDisplay === 'SEMCAS') tipoDisplay = 'SEDE';
         return `
            <tr data-unidade-id="${unidade.id}">
                <td class="font-medium">
                    <span class="unidade-nome-display">${unidade.nome}</span>
                    <button class="btn-icon btn-edit-unidade ml-1" title="Editar nome"><i data-lucide="pencil"></i></button>
                </td>
                <td>${tipoDisplay}</td>
                <td class="text-center"><input type="checkbox" class="form-toggle gestao-toggle" data-field="atendeAgua" ${(unidade.atendeAgua ?? true) ? 'checked' : ''}></td>
                <td class="text-center"><input type="checkbox" class="form-toggle gestao-toggle" data-field="atendeGas" ${(unidade.atendeGas ?? true) ? 'checked' : ''}></td>
                <td class="text-center"><input type="checkbox" class="form-toggle gestao-toggle" data-field="atendeMateriais" ${(unidade.atendeMateriais ?? true) ? 'checked' : ''}></td>
                <td class="text-center">
                    <button class="btn-danger btn-remove" data-id="${unidade.id}" data-type="unidade" data-details="${unidade.nome} (${tipoDisplay})" title="Remover esta unidade e seu histórico"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`
    }).join('');
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } // CORREÇÃO 4: Garante que lucide existe
}

async function handleGestaoToggle(e) {
    const checkbox = e.target.closest('.gestao-toggle'); 
    if (!checkbox) return; 
    
    const row = checkbox.closest('tr');
    const id = row?.dataset.unidadeId; 
    const field = checkbox.dataset.field; 
    const value = checkbox.checked; 
    
    if (!isAuthReady || !id || !field) return; 
    
    checkbox.disabled = true; 
    
    try {
        const docRef = doc(unidadesCollection, id); 
        await updateDoc(docRef, { [field]: value });
        showAlert('alert-gestao', 'Status atualizado!', 'success', 2000);
    } catch (error) { 
        console.error("Erro atualizar unidade:", error); 
        showAlert('alert-gestao', `Erro: ${error.message}`, 'error'); 
        checkbox.checked = !value;
    } finally { 
        checkbox.disabled = false; 
    }
}

function handleEditUnidadeClick(e) {
    const button = e.target.closest('.btn-edit-unidade');
    if (!button) return;
    
    const td = button.closest('td');
    const row = td.closest('tr');
    const nomeSpan = td.querySelector('.unidade-nome-display');
    const currentName = nomeSpan.textContent;

    td.innerHTML = `
        <input type="text" value="${currentName}" class="edit-input w-full" placeholder="Novo nome da unidade">
        <div class="mt-1 space-x-1">
            <button class="btn-icon btn-save-unidade text-green-600 hover:text-green-800" title="Salvar"><i data-lucide="save"></i></button>
            <button class="btn-icon btn-cancel-edit-unidade text-red-600 hover:text-red-800" title="Cancelar"><i data-lucide="x-circle"></i></button>
        </div>
    `;
    row.classList.add('editing-row'); 
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } 
    td.querySelector('input').focus(); 
}

function handleCancelEditUnidadeClick(e) {
    const button = e.target.closest('.btn-cancel-edit-unidade');
    if (!button) return;
    
    const td = button.closest('td');
    const row = button.closest('tr');
    const unidadeId = row.dataset.unidadeId;
    const unidade = fb_unidades.find(u => u.id === unidadeId);
    
    td.innerHTML = `
        <span class="unidade-nome-display">${unidade?.nome || 'Erro'}</span> 
        <button class="btn-icon btn-edit-unidade ml-1" title="Editar nome"><i data-lucide="pencil"></i></button>
    `;
    row.classList.remove('editing-row'); 
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } 
}

async function handleSaveUnidadeClick(e) {
    const button = e.target.closest('.btn-save-unidade');
    if (!button) return;
    
    const td = button.closest('td');
    const row = button.closest('tr'); // Corrigido para encontrar a linha
    const unidadeId = row.dataset.unidadeId;
    const input = td.querySelector('.edit-input');
    const newName = capitalizeString(input.value.trim()); 

    if (!newName) {
        showAlert('alert-gestao', 'O nome da unidade não pode ser vazio.', 'warning');
        input.focus();
        return;
    }

    button.disabled = true;
    const cancelButton = td.querySelector('.btn-cancel-edit-unidade');
    if(cancelButton) cancelButton.disabled = true;
    button.innerHTML = '<div class="loading-spinner-small inline-block" style="width: 1em; height: 1em; border-width: 2px;"></div>';

    try {
        const docRef = doc(unidadesCollection, unidadeId);
        await updateDoc(docRef, { nome: newName });
        
        td.innerHTML = `
            <span class="unidade-nome-display">${newName}</span>
            <button class="btn-icon btn-edit-unidade ml-1" title="Editar nome"><i data-lucide="pencil"></i></button>
        `;
         row.classList.remove('editing-row'); 
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } // CORREÇÃO 5: Garante que lucide existe
        showAlert('alert-gestao', 'Nome da unidade atualizado!', 'success', 2000);
    
    } catch (error) {
        console.error("Erro ao salvar nome da unidade:", error);
        showAlert('alert-gestao', `Erro ao salvar: ${error.message}`, 'error');
        button.disabled = false;
         if(cancelButton) cancelButton.disabled = false;
        button.innerHTML = '<i data-lucide="save"></i>'; 
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } // CORREÇÃO 6: Garante que lucide existe
    }
}

async function handleBulkAddUnidades() {
     if (!isAuthReady || !textareaBulkUnidades) return;
     if (!domReady) { showAlert('alert-gestao', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
     
     const text = textareaBulkUnidades.value.trim();
     if (!text) { showAlert('alert-gestao', 'A área de texto está vazia.', 'warning'); return; }
     
     const lines = text.split('\n');
     const unidadesParaAdd = [];
     const erros = [];
     
     lines.forEach((line, index) => {
         const parts = line.split('\t');
         if (parts.length === 2) {
             let tipo = parts[0].trim().toUpperCase(); 
             if (tipo === 'SEMCAS') tipo = 'SEDE';
             const nome = capitalizeString(parts[1].trim()); 
             
             if (tipo && nome) {
                 const existe = fb_unidades.some(u => {
                     let uTipo = (u.tipo || '').toUpperCase();
                     if (uTipo === 'SEMCAS') uTipo = 'SEDE';
                     return normalizeString(u.nome) === normalizeString(nome) && uTipo === tipo;
                 });
                 if (!existe) {
                     unidadesParaAdd.push({ nome, tipo, atendeAgua: true, atendeGas: true, atendeMateriais: true });
                 } else {
                     console.log(`Unidade já existe (ignorada): ${tipo} - ${nome}`);
                 }
             } else { erros.push(`Linha ${index + 1}: Tipo ou Nome vazio.`); }
         } else if (line.trim()) { 
             erros.push(`Linha ${index + 1}: Formato inválido (use TIPO [TAB] NOME).`);
         }
     });

     if (unidadesParaAdd.length === 0) {
         showAlert('alert-gestao', 'Nenhuma unidade nova para adicionar (ou todas já existem/formato inválido).', 'info');
         if(erros.length > 0) console.warn("Erros na importação:", erros);
         return;
     }
     
     btnBulkAddUnidades.disabled = true; btnBulkAddUnidades.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
     let adicionadasCount = 0;
     
     try {
         for (const unidade of unidadesParaAdd) {
             await addDoc(unidadesCollection, unidade);
             adicionadasCount++;
         }
         showAlert('alert-gestao', `${adicionadasCount} unidade(s) adicionada(s) com sucesso!`, 'success');
         textareaBulkUnidades.value = ''; 
         
         if(erros.length > 0) {
              showAlert('alert-gestao', `Algumas linhas foram ignoradas por erros de formato ou por já existirem. Verifique o console (F12) para detalhes.`, 'warning', 8000);
              console.warn("Erros/Avisos na importação:", erros);
         }
     } catch (error) {
         console.error("Erro ao adicionar unidades em lote:", error);
         showAlert('alert-gestao', `Erro ao adicionar unidades: ${error.message}. ${adicionadasCount} foram adicionadas antes do erro.`, 'error');
     } finally {
         btnBulkAddUnidades.disabled = false; btnBulkAddUnidades.textContent = 'Adicionar Unidades';
     }
}


// --- LÓGICA DO DASHBOARD ---

// <<< Função getChartDataLast30Days RESTAURADA AQUI >>>
// Prepara dados para os gráficos de linha (Água/Gás) dos últimos 30 dias
function getChartDataLast30Days(movimentacoes) {
    const labels = []; const entregasData = []; const retornosData = []; 
    const dataMap = new Map(); // Mapa para acumular dados por dia
    
    // Cria entradas no mapa para os últimos 30 dias (garante que todos os dias apareçam)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) { 
        const d = new Date(today); 
        d.setDate(d.getDate() - i); 
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; 
        const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); 
        labels.push(dateLabel); 
        dataMap.set(dateKey, { entregas: 0, retornos: 0 }); // Inicializa contadores
    }

    // Filtra movimentações dos últimos 30 dias
    const movs30Dias = filterLast30Days(movimentacoes);
    
    // Acumula quantidades por dia no mapa
    movs30Dias.forEach(m => { 
        const mDate = m.data.toDate(); 
        mDate.setHours(0,0,0,0); // Normaliza para início do dia
        const dateKey = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}-${String(mDate.getDate()).padStart(2, '0')}`; 
        if (dataMap.has(dateKey)) { 
            const dayData = dataMap.get(dateKey); 
            if (m.tipo === 'entrega') dayData.entregas += m.quantidade; 
            else if (m.tipo === 'retorno') dayData.retornos += m.quantidade; 
        } 
    });

    // Extrai dados do mapa para arrays do Chart.js
    dataMap.forEach(value => { 
        entregasData.push(value.entregas); 
        retornosData.push(value.retornos); 
    });

    // Retorna estrutura de dados esperada pelo Chart.js
    return { 
        labels, 
        datasets: [ 
            { label: 'Entregues (Cheios)', data: entregasData, backgroundColor: 'rgba(59, 130, 246, 0.7)', borderColor: 'rgba(59, 130, 246, 1)', borderWidth: 1, tension: 0.1 }, 
            { label: 'Recebidos (Vazios)', data: retornosData, backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: 'rgba(16, 185, 129, 1)', borderWidth: 1, tension: 0.1 } 
        ] 
    };
}


// ... (restante das funções do dashboard) ...
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
        // Não chama filterDashboardMateriais aqui para evitar recursão
        // filterDashboardMateriais(null); 
    }
    if(viewName === 'materiais') renderDashboardMateriaisList();
}

function renderDashboardVisaoGeralSummary() {
    if (!domReady) { return; } 
    if (dashboardEstoqueAguaEl) {
        dashboardEstoqueAguaEl.textContent = estoqueAguaAtualEl?.textContent || '0';
    }
    if (dashboardEstoqueGasEl) {
        dashboardEstoqueGasEl.textContent = estoqueGasAtualEl?.textContent || '0';
    }
}

function renderDashboardMateriaisCounts() {
    if (!domReady) { return; } 
    if (!dashboardMateriaisSeparacaoCountEl || !dashboardMateriaisRetiradaCountEl) return;
    // O status agora é 'requisitado' ou 'separacao' que conta como 'Em Separação'
    const separacaoCount = fb_materiais.filter(m => m.status === 'separacao' || m.status === 'requisitado').length;
    const retiradaCount = fb_materiais.filter(m => m.status === 'retirada').length;
    
    dashboardMateriaisSeparacaoCountEl.textContent = separacaoCount;
    dashboardMateriaisRetiradaCountEl.textContent = retiradaCount;
}

// <<< Função filterLast30Days ESTAVA FALTANDO, RESTAURADA ABAIXO >>>
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


function renderDashboardAguaChart() {
    if (!domReady) { return; } 
    const ctx = document.getElementById('dashboardAguaChart')?.getContext('2d'); if (!ctx) return; 
    const data = getChartDataLast30Days(fb_agua_movimentacoes); // <<< Agora a função existe
    if (dashboardAguaChartInstance) { 
        dashboardAguaChartInstance.data = data; 
        dashboardAguaChartInstance.update(); 
    } else { 
        dashboardAguaChartInstance = new Chart(ctx, { type: 'line', data: data, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'top' } } } }); 
    }
}

function renderDashboardGasChart() {
    if (!domReady) { return; } 
    const ctx = document.getElementById('dashboardGasChart')?.getContext('2d'); if (!ctx) return; 
    const data = getChartDataLast30Days(fb_gas_movimentacoes); // <<< Agora a função existe
    if (dashboardGasChartInstance) { 
        dashboardGasChartInstance.data = data; 
        dashboardGasChartInstance.update(); 
    } else { 
        dashboardGasChartInstance = new Chart(ctx, { type: 'line', data: data, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'top' } } } }); 
    }
}

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

function renderDashboardMateriaisList() {
     if (!domReady) { console.warn("renderDashboardMateriaisList chamada antes do DOM pronto."); return; } 
     if (!dashboardMateriaisListContainer || !loadingMateriaisDashboard) return; 
     loadingMateriaisDashboard.style.display = 'none'; 
     
    const pendentes = fb_materiais
        .filter(m => m.status === 'requisitado' || m.status === 'separacao' || m.status === 'retirada')
        .sort((a,b) => { 
            const statusOrder = { 'requisitado': 1, 'separacao': 2, 'retirada': 3 }; 
            const statusCompare = (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
            if (statusCompare !== 0) return statusCompare;
            return (a.dataSeparacao?.toMillis() || 0) - (b.dataSeparacao?.toMillis() || 0); 
        }); 
    
    if (pendentes.length === 0) { 
        dashboardMateriaisListContainer.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">Nenhum material pendente.</p>'; 
        return; 
    }
    dashboardMateriaisListContainer.innerHTML = pendentes.map(m => {
        const isRequisitado = m.status === 'requisitado';
        const isSeparacao = m.status === 'separacao';
        const isRetirada = m.status === 'retirada';
        
        let badgeClass = 'badge-purple';
        let badgeText = 'Requisitado';
        let bgColor = 'bg-purple-50'; 
        let borderColor = 'border-purple-300';
        
        if (isSeparacao) {
            badgeClass = 'badge-yellow';
            badgeText = 'Em Separação';
            bgColor = 'bg-yellow-50';
            borderColor = 'border-yellow-300';
        } else if (isRetirada) {
            badgeClass = 'badge-green';
            badgeText = 'Disponível';
            bgColor = 'bg-green-50';
            borderColor = 'border-green-300';
        }

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

//
// ===================================================================================
// FUNÇÃO MODIFICADA (renderDashboardMateriaisProntos)
// ===================================================================================
//
function renderDashboardMateriaisProntos(filterStatus = null) {
    if (!domReady) {
        console.warn("renderDashboardMateriaisProntos chamada antes do DOM estar pronto (domReady=false). Aguardando...");
        return;
    }

    const container = dashboardMateriaisProntosContainer;
    const titleEl = dashboardMateriaisTitle; 
    const clearButton = btnClearDashboardFilter; 

    if (!container) {
        console.error("Elemento CRÍTICO (container dashboard-materiais-prontos) não encontrado!");
        return; 
    }
    
    // Colunas fixas na ordem do DOM
    const COLUNAS_DOM = ['CT', 'SEDE', 'CRAS', 'CREAS', 'ABRIGO'];
    const colunaDOMElements = Array.from(container.querySelectorAll('.materiais-prontos-col'));
    
    // --- Lógica de filtragem ---
    let pendentes = fb_materiais.filter(m => m.status === 'requisitado' || m.status === 'separacao' || m.status === 'retirada');
    
    let filterToDisplay = filterStatus;
    if (filterStatus === 'separacao') {
         // O card de separação inclui requisitado
         pendentes = pendentes.filter(m => m.status === 'separacao' || m.status === 'requisitado');
         filterToDisplay = 'Em Separação/Requisitado';
    } else if (filterStatus) {
         // O card de retirada (ou outro status, se houver)
         pendentes = pendentes.filter(m => m.status === filterStatus);
         filterToDisplay = filterStatus === 'retirada' ? 'Disponíveis p/ Retirada' : filterStatus;
    }

    if (clearButton) clearButton.classList.toggle('hidden', !filterStatus); 
    if (titleEl) {
        if (filterStatus === 'separacao') {
             titleEl.textContent = 'Materiais em Separação e Requisitados';
        } else if (filterStatus === 'retirada') {
            titleEl.textContent = 'Materiais Disponíveis p/ Retirada';
        } else {
             titleEl.textContent = 'Materiais do Almoxarifado';
        }
    }
    
    // --- Lógica de Agrupamento e Mapeamento de Colunas Dinâmicas ---

    // 1. Agrupar todos os materiais pendentes por tipoUnidade
    const gruposPendentes = pendentes.reduce((acc, m) => {
        let tipoUnidade = (m.tipoUnidade || 'OUTROS').toUpperCase();
        if (tipoUnidade === 'SEMCAS') tipoUnidade = 'SEDE';
        if (!acc[tipoUnidade]) acc[tipoUnidade] = [];
        acc[tipoUnidade].push(m);
        return acc;
    }, {});

    // 2. Separar tipos com dados em fixos e não-fixos
    // Tipos que TEM dados pendentes
    const tiposComDados = Object.keys(gruposPendentes).filter(tipo => gruposPendentes[tipo].length > 0).sort();
    
    // Tipos que tem dados, mas não são colunas fixas (substitutos)
    const tiposNaoFixosComDados = tiposComDados.filter(tipo => !COLUNAS_DOM.includes(tipo));
    const tiposSubstitutos = [...tiposNaoFixosComDados]; // Substitutos disponíveis (FIFO)
    
    // 3. Determinar o mapeamento final de Coluna DOM -> Tipo de Unidade
    let totalPendentesVisiveis = 0;
    const mapeamentoColunas = []; 

    for (let i = 0; i < COLUNAS_DOM.length; i++) {
        const tipoFixo = COLUNAS_DOM[i];
        
        // A coluna fixa tem dados?
        const fixoTemDados = gruposPendentes[tipoFixo] && gruposPendentes[tipoFixo].length > 0;
        
        if (fixoTemDados) {
            mapeamentoColunas.push(tipoFixo);
            totalPendentesVisiveis += gruposPendentes[tipoFixo].length;
        } else {
            // Tenta substituição se não há dados para o tipo fixo desta posição
            if (tiposSubstitutos.length > 0) {
                const tipoSubstituto = tiposSubstitutos.shift(); 
                mapeamentoColunas.push(tipoSubstituto);
                totalPendentesVisiveis += gruposPendentes[tipoSubstituto].length;
            } else {
                // Não há substituto nem dados no fixo, a coluna é desativada
                mapeamentoColunas.push(null); 
            }
        }
    }
    
    // 4. Renderizar o DOM
    
    colunaDOMElements.forEach((colunaDiv, index) => {
        const tipoExibido = mapeamentoColunas[index];
        const ulDestino = colunaDiv.querySelector('ul');
        const h4Cabecalho = colunaDiv.querySelector('h4');
        
        // Limpa e esconde o div pai (coluna)
        ulDestino.innerHTML = ''; 
        colunaDiv.classList.add('hidden'); 

        // Restaura o título H4 original
        h4Cabecalho.textContent = COLUNAS_DOM[index];

        if (tipoExibido) {
            colunaDiv.classList.remove('hidden'); // Mostra a coluna
            h4Cabecalho.textContent = tipoExibido; // Define o cabeçalho (Fixo ou Substituto)

            const materiaisDaColuna = gruposPendentes[tipoExibido] || [];
            
            if (materiaisDaColuna.length > 0) {
                 const materiaisOrdenados = materiaisDaColuna.sort((a,b) => {
                    const statusOrder = { 'requisitado': 1, 'separacao': 2, 'retirada': 3 };
                    const statusCompare = (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
                    if (statusCompare !== 0) return statusCompare;
                    return (a.dataSeparacao?.toMillis() || 0) - (b.dataSeparacao?.toMillis() || 0);
                 });

                 materiaisOrdenados.forEach(m => {
                    const tiposMateriais = m.tipoMaterial || 'N/D';
                    
                    let liClass = '';
                    let spanClass = 'status-indicator';
                    let spanText = '';

                    if (m.status === 'requisitado') {
                        liClass = 'item-requisitado';
                        spanClass += ' requisitado'; 
                        spanText = '📝 Requisitado';
                    } else if (m.status === 'separacao') {
                        // Nenhuma classe de li (deixa o padrão definido em style.css)
                        spanClass += ' separando'; 
                        spanText = '⏳ Separando...';
                    } else if (m.status === 'retirada') {
                        liClass = 'item-retirada';
                        spanClass += ' pronto'; 
                        spanText = '✅ Pronto';
                    }

                    const li = document.createElement('li');
                    li.className = liClass;
                    
                    // InnerHTML adaptado
                    li.innerHTML = `
                        <strong class="text-sm text-gray-800">${m.unidadeNome}</strong>
                        <p class="text-xs text-gray-500 capitalize">(${tiposMateriais})</p>
                        <div><span class="${spanClass}">${spanText}</span></div>
                    `;
                    ulDestino.appendChild(li);
                 });
            } else {
                 ulDestino.innerHTML = `<li class="text-sm text-slate-500 text-center py-4">Nenhum material pendente para ${tipoExibido}.</li>`;
            }
        }
    });

    // 5. Se não houver NENHUM pendente, garante que uma coluna exibe o placeholder.
    if (totalPendentesVisiveis === 0) {
        const placeholder = `<li class="text-sm text-slate-500 text-center py-4">Nenhum material ${filterToDisplay ? `com status "${filterToDisplay}"` : 'pendente'} encontrado.</li>`;
        
        // Tenta encontrar a primeira coluna DOM (que é 'CT')
        const primeiraColunaDiv = colunaDOMElements[0];
        if (primeiraColunaDiv) {
            const ulDestino = primeiraColunaDiv.querySelector('ul');
            ulDestino.innerHTML = placeholder;
            primeiraColunaDiv.classList.remove('hidden'); // Garante que pelo menos o CT aparece vazio
            primeiraColunaDiv.querySelector('h4').textContent = COLUNAS_DOM[0]; // Restaura o CT
        }
    }
    
    // 6. Recriar ícones
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons(); 
    }
}
// ===================================================================================
// FIM DA FUNÇÃO MODIFICADA
// ===================================================================================


function filterDashboardMateriais(status) {
    // CORREÇÃO CRÍTICA:
    // Esta função NÃO deve mais chamar switchTab ou switchDashboardView,
    // pois isso está causando a recursão infinita.
    // Ela deve apenas atualizar o filtro e chamar a função de renderização
    // da lista de materiais do dashboard.
    
    currentDashboardMaterialFilter = status;
    // Removidas chamadas a switchTab e switchDashboardView
    // switchTab('dashboard'); // <-- REMOVIDO
    // switchDashboardView('geral'); // <-- REMOVIDO
    renderDashboardMateriaisProntos(status);
}

function autoScrollView(element) {
    if (!domReady || !element) return; 
    if (element.offsetParent === null) return; 

    if (element.scrollHeight > element.clientHeight) {
        const scrollOptions = { behavior: 'smooth' };
        element.scrollTo({ top: element.scrollHeight, ...scrollOptions });
        
        setTimeout(() => {
            const currentElement = dashboardMateriaisProntosContainer; 
            if (currentElement && currentElement.offsetParent !== null) {
                currentElement.scrollTo({ top: 0, ...scrollOptions });
            }
        }, 3000);
    }
}

function startDashboardRefresh() {
    stopDashboardRefresh(); 
    console.log("Iniciando auto-refresh do Dashboard (2 min)");
    dashboardRefreshInterval = setInterval(() => {
        if (!domReady) return; 
        if (visaoAtiva !== 'dashboard') { stopDashboardRefresh(); return; }
        console.log("Atualizando dados do Dashboard (auto-refresh)...");
        
        renderDashboardAguaChart(); renderDashboardGasChart();
        renderDashboardAguaSummary(); renderDashboardGasSummary();
        renderDashboardMateriaisList(); 
        renderDashboardMateriaisProntos(currentDashboardMaterialFilter); 
        renderDashboardVisaoGeralSummary(); 
        renderDashboardMateriaisCounts();
        updateLastUpdateTime(); 
        
        if (!currentDashboardMaterialFilter) {
            // A rolagem automática agora deve ser verificada no container que tem as colunas
             autoScrollView(dashboardMateriaisProntosContainer); 
        }

    }, 120000);
}

function stopDashboardRefresh() {
    if (dashboardRefreshInterval) {
        console.log("Parando auto-refresh do Dashboard");
        clearInterval(dashboardRefreshInterval);
        dashboardRefreshInterval = null;
    }
}

// --- LÓGICA DE RELATÓRIO PDF ---
function handleGerarPdf() {
     if (!domReady) { showAlert('alert-relatorio', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined' || typeof window.jspdf.AutoTable === 'undefined') {
        showAlert('alert-relatorio', 'Erro: Bibliotecas PDF não carregadas. Tente recarregar a página.', 'error'); return;
    }
    const { jsPDF } = window.jspdf;
    const autoTable = window.jspdf.AutoTable; 

    const tipo = relatorioTipo.value; 
    const dataInicioStr = relatorioDataInicio.value;
    const dataFimStr = relatorioDataFim.value;

    if (!dataInicioStr || !dataFimStr) { showAlert('alert-relatorio', 'Selecione a data de início e fim.', 'warning'); return; }

    const dataInicio = dateToTimestamp(dataInicioStr).toMillis();
    const dataFim = dateToTimestamp(dataFimStr).toMillis() + (24 * 60 * 60 * 1000 - 1); 

    const movimentacoes = (tipo === 'agua' ? fb_agua_movimentacoes : fb_gas_movimentacoes);
    const tipoLabel = (tipo === 'agua' ? 'Água' : 'Gás');

    const movsFiltradas = movimentacoes.filter(m => { 
        const mData = m.data?.toMillis(); 
        return m.tipo === 'entrega' && mData >= dataInicio && mData <= dataFim; 
    });

    if (movsFiltradas.length === 0) { showAlert('alert-relatorio', 'Nenhum dado de entrega encontrado para este período.', 'info'); return; }
    
    btnGerarPdf.disabled = true; btnGerarPdf.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    
    try {
        const doc = new jsPDF(); 

        const abastecimentoMap = new Map(); 
        movsFiltradas.forEach(m => { 
            const nome = m.unidadeNome || 'Desconhecida'; 
            const atual = abastecimentoMap.get(nome) || 0; 
            abastecimentoMap.set(nome, atual + m.quantidade); 
        });
        const abastecimentoData = Array.from(abastecimentoMap.entries())
            .sort((a,b) => b[1] - a[1]) 
            .map(entry => [entry[0], entry[1]]); 

        const responsavelMap = new Map(); 
        movsFiltradas.forEach(m => { 
            const nome = m.responsavel || 'Não identificado'; 
            const atual = responsavelMap.get(nome) || 0; 
            responsavelMap.set(nome, atual + m.quantidade); 
        });
        const responsavelData = Array.from(abastecimentoMap.entries())
            .sort((a,b) => b[1] - a[1])
            .map(entry => [entry[0], entry[1]]);

        doc.setFontSize(16); doc.text(`Relatório de Fornecimento - ${tipoLabel}`, 14, 20);
        doc.setFontSize(10); doc.text(`Período: ${formatTimestamp(Timestamp.fromMillis(dataInicio))} a ${formatTimestamp(Timestamp.fromMillis(dataFim))}`, 14, 26);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 32);

        autoTable(doc, { 
            startY: 40, 
            head: [['Relatório de Entregas por Unidade']], 
            body: [[]], 
            theme: 'plain', 
            styles: { fontSize: 12, fontStyle: 'bold' } 
        });
        autoTable(doc, { 
            head: [['Unidade', 'Quantidade Fornecida']], 
            body: abastecimentoData, 
            theme: 'striped', 
            headStyles: { fillColor: [22, 160, 133] } 
        });

        autoTable(doc, { 
            startY: doc.lastAutoTable.finalY + 15, 
            head: [['Relatório de Recebimento por Responsável']], 
            body: [[]], 
            theme: 'plain', 
            styles: { fontSize: 12, fontStyle: 'bold' } 
        });
        autoTable(doc, { 
            head: [['Responsável', 'Quantidade Recebida']], 
            body: responsavelData, 
            theme: 'striped', 
            headStyles: { fillColor: [41, 128, 185] } 
        });

        doc.save(`Relatorio_${tipoLabel}_${dataInicioStr}_a_${dataFimStr}.pdf`);
        showAlert('alert-relatorio', 'Relatório PDF gerado com sucesso!', 'success');
    } catch (error) { 
        console.error("Erro ao gerar PDF:", error); 
        showAlert('alert-relatorio', `Erro ao gerar PDF: ${error.message}`, 'error');
    } finally { 
        btnGerarPdf.disabled = false; btnGerarPdf.textContent = 'Gerar Relatório PDF'; 
    }
}


// --- LÓGICA DE EXCLUSÃO ---
async function openConfirmDeleteModal(id, type, details = null) {
    if (!id || !type) return; 
     if (!domReady) return; 
    
    let collectionRef = null; 
    let detailsText = details ? `${details} (ID: ${id.substring(0,6)}...)` : `ID: ${id.substring(0,6)}...`;
    let alertElementId = 'alert-gestao'; 
    let showUnidadeWarning = false; 
    let isInicial = false; 
    let isMovimentacao = false;

    if (type === 'agua') { 
        collectionRef = aguaCollection; 
        detailsText = `Movimentação de Água ${detailsText}`; 
        alertElementId = 'alert-agua-lista';
        isMovimentacao = true;
    } else if (type === 'gas') { 
        collectionRef = gasCollection; 
        detailsText = `Movimentação de Gás ${detailsText}`; 
        alertElementId = 'alert-gas-lista';
        isMovimentacao = true;
    } else if (type === 'materiais') { 
        collectionRef = materiaisCollection; 
        detailsText = `Registro de Material ${detailsText}`; 
        alertElementId = 'alert-materiais-lista';
    } else if (type === 'entrada-agua') { 
        collectionRef = estoqueAguaCollection; 
        detailsText = `Entrada de Estoque (Água) ${detailsText}`; 
        alertElementId = 'alert-historico-agua'; 
        const docSnap = await getDoc(doc(collectionRef, id)); 
        isInicial = docSnap.exists() && docSnap.data().tipo === 'inicial';
    } else if (type === 'entrada-gas') { 
        collectionRef = estoqueGasCollection; 
        detailsText = `Entrada de Estoque (Gás) ${detailsText}`; 
        alertElementId = 'alert-historico-gas'; 
        const docSnap = await getDoc(doc(collectionRef, id)); 
        isInicial = docSnap.exists() && docSnap.data().tipo === 'inicial';
    } else if (type === 'unidade') { 
        collectionRef = unidadesCollection; 
        detailsText = `Unidade ${detailsText}`; 
        alertElementId = 'alert-gestao'; 
        showUnidadeWarning = true; 
    } else { 
        console.error("Tipo inválido para exclusão:", type); return; 
    }
    
    // NOVO: Ajusta o ID do alerta de Movimentação para o alerta do formulário de lançamento
    if (isMovimentacao) {
        alertElementId = type === 'agua' ? 'alert-agua' : 'alert-gas';
    }

    deleteInfo = { id, type, collectionRef, alertElementId, details, isInicial }; 
    
    deleteDetailsEl.textContent = `Detalhes: ${detailsText}`;
    deleteWarningUnidadeEl.style.display = showUnidadeWarning ? 'block' : 'none'; 
    deleteWarningInicialEl.style.display = isInicial ? 'block' : 'none'; 
    confirmDeleteModal.style.display = 'flex'; 
}

async function executeDelete() {
    if (!isAuthReady || !deleteInfo.id || !deleteInfo.collectionRef) {
         showAlert(deleteInfo.alertElementId || 'alert-gestao', 'Erro: Não autenticado ou informação de exclusão inválida.', 'error');
         return;
    }
     if (!domReady) { showAlert(deleteInfo.alertElementId || 'alert-gestao', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
    
    btnConfirmDelete.disabled = true; btnConfirmDelete.innerHTML = '<div class="loading-spinner-small mx-auto" style="width:18px; height:18px;"></div>';
    btnCancelDelete.disabled = true;
    
    try {
        // NOVO: Lógica para excluir arquivo anexo se estiver deletando um material
        if (deleteInfo.type === 'materiais') {
            const materialDoc = await getDoc(doc(deleteInfo.collectionRef, deleteInfo.id));
            if (materialDoc.exists()) {
                const storagePath = materialDoc.data().storagePath;
                if (storagePath) {
                     try {
                        const fileRef = ref(storage, storagePath);
                        await deleteObject(fileRef);
                        console.log("Arquivo anexo excluído (registro removido):", storagePath);
                    } catch (error) {
                        console.warn("Erro ao excluir arquivo anexo durante a remoção do registro:", error);
                        // Continua mesmo se falhar
                    }
                }
            }
        }
        
        const docRef = doc(deleteInfo.collectionRef, deleteInfo.id);
        await deleteDoc(docRef);

        if (deleteInfo.type === 'unidade') {
            await deleteUnitHistory(deleteInfo.id); 
            showAlert(deleteInfo.alertElementId || 'alert-gestao', `Unidade "${deleteInfo.details}" e seu histórico removidos!`, 'success');
        } else {
            const message = deleteInfo.isInicial ? 'Lançamento de Estoque Inicial removido!' : 'Lançamento removido com sucesso!';
            showAlert(deleteInfo.alertElementId || 'alert-gestao', message, 'success');
        }

    } catch (error) {
        console.error(`Erro ao remover ${deleteInfo.type}:`, error);
        showAlert(deleteInfo.alertElementId || 'alert-gestao', `Erro ao remover: ${error.message}`, 'error');
    } finally {
        confirmDeleteModal.style.display = 'none';
        btnConfirmDelete.disabled = false; btnConfirmDelete.textContent = 'Confirmar Exclusão';
        btnCancelDelete.disabled = false;
        deleteInfo = { id: null, type: null, collectionRef: null, alertElementId: null, details: null, isInicial: false };
    }
}

async function deleteUnitHistory(unidadeId) {
    if (!unidadeId || !isAuthReady) return;
    console.log(`Iniciando remoção do histórico para unidade ID: ${unidadeId}`);
    
    const batch = writeBatch(db); 
    let deleteCount = 0;
    
    try {
        const aguaQuery = query(aguaCollection, where("unidadeId", "==", unidadeId));
        const aguaSnapshot = await getDocs(aguaQuery); 
        aguaSnapshot.forEach(doc => { batch.delete(doc.ref); deleteCount++; });
        console.log(` - ${aguaSnapshot.size} movimentações de água para remover.`);
        
        const gasQuery = query(gasCollection, where("unidadeId", "==", unidadeId));
        const gasSnapshot = await getDocs(gasQuery); 
        gasSnapshot.forEach(doc => { batch.delete(doc.ref); deleteCount++; });
         console.log(` - ${gasSnapshot.size} movimentações de gás para remover.`);
         
        const materiaisQuery = query(materiaisCollection, where("unidadeId", "==", unidadeId));
        const materiaisSnapshot = await getDocs(materiaisQuery); 
        materiaisSnapshot.forEach(doc => { batch.delete(doc.ref); deleteCount++; });
         console.log(` - ${materiaisSnapshot.size} registros de materiais para remover.`);
         
        if (deleteCount > 0) {
            await batch.commit(); 
            console.log(`Histórico da unidade ${unidadeId} removido (${deleteCount} documentos).`);
        } else { 
            console.log(`Nenhum histórico encontrado para a unidade ${unidadeId}.`); 
        }
    } catch (error) {
         console.error(`Erro ao remover histórico da unidade ${unidadeId}:`, error);
         showAlert('alert-gestao', `Erro ao limpar o histórico da unidade: ${error.message}. A unidade foi removida, mas o histórico pode permanecer.`, 'error', 10000);
         throw error; 
    }
}


// --- LÓGICA DE CONTROLE DE ESTOQUE (ENTRADA) ---
async function handleInicialEstoqueSubmit(e) {
    e.preventDefault();
     if (!domReady) return; 
    const tipoEstoque = e.target.id.includes('agua') ? 'agua' : 'gas'; 
    
    const inputQtd = document.getElementById(`input-inicial-qtd-${tipoEstoque}`).value;
    const inputResp = document.getElementById(`input-inicial-responsavel-${tipoEstoque}`).value;
    const btnSubmit = document.getElementById(`btn-submit-inicial-${tipoEstoque}`);
    const alertElId = `alert-inicial-${tipoEstoque}`;
    
    const quantidade = parseInt(inputQtd, 10);
    const responsavel = capitalizeString(inputResp.trim());

    if (isNaN(quantidade) || quantidade < 0 || !responsavel) { 
        showAlert(alertElId, "Preencha a quantidade e o responsável.", 'warning'); return; 
    }
    
    const estoqueDefinido = (tipoEstoque === 'agua') ? estoqueInicialDefinido.agua : estoqueInicialDefinido.gas;
    if (estoqueDefinido) {
         showAlert(alertElId, "O estoque inicial já foi definido.", 'info'); 
         document.getElementById(`form-inicial-${tipoEstoque}-container`).classList.add('hidden');
         document.getElementById(`btn-abrir-inicial-${tipoEstoque}`).classList.add('hidden');
         document.getElementById(`resumo-estoque-${tipoEstoque}`).classList.remove('hidden'); 
         return;
    }
    
    btnSubmit.disabled = true; btnSubmit.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    const collectionRef = (tipoEstoque === 'agua') ? estoqueAguaCollection : estoqueGasCollection;
    
    try {
        await addDoc(collectionRef, { 
            tipo: 'inicial', 
            quantidade: quantidade, 
            data: serverTimestamp(), 
            responsavel: responsavel, 
            notaFiscal: 'INICIAL', 
            registradoEm: serverTimestamp() 
        });
        showAlert(alertElId, "Estoque inicial salvo!", 'success', 2000);
         document.getElementById(`form-inicial-${tipoEstoque}-container`).classList.add('hidden');
         document.getElementById(`btn-abrir-inicial-${tipoEstoque}`).classList.add('hidden');
    } catch (error) {
        console.error("Erro ao salvar estoque inicial:", error);
        showAlert(alertElId, `Erro ao salvar: ${error.message}`, 'error');
        btnSubmit.disabled = false; btnSubmit.textContent = 'Salvar Inicial'; 
    }
}

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

async function handleEntradaEstoqueSubmit(e) {
    e.preventDefault();
    if (!isAuthReady) { showAlert('alert-agua', 'Erro: Não autenticado.', 'error'); return; } 
    if (!domReady) { showAlert('alert-agua', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
    
    const tipoEstoque = e.target.id.includes('agua') ? 'agua' : 'gas';
    const alertElementId = `alert-${tipoEstoque}`; 
    
    const inputQtd = document.getElementById(`input-qtd-entrada-${tipoEstoque}`).value;
    const inputData = document.getElementById(`input-data-entrada-${tipoEstoque}`).value;
    const inputResp = document.getElementById(`input-responsavel-entrada-${tipoEstoque}`).value;
    const inputNf = document.getElementById(`input-nf-entrada-${tipoEstoque}`).value;
    const btnSubmit = document.getElementById(`btn-submit-entrada-${tipoEstoque}`);
    const form = document.getElementById(`form-entrada-${tipoEstoque}`);
    
    const quantidade = parseInt(inputQtd, 10);
    const data = dateToTimestamp(inputData);
    const responsavel = capitalizeString(inputResp.trim());
    const notaFiscal = inputNf.trim() || 'N/A'; 

    if (!quantidade || quantidade <= 0 || !data || !responsavel) { 
        showAlert(alertElementId, 'Dados inválidos. Verifique quantidade, data e responsável.', 'warning'); return; 
    }
    if (!estoqueInicialDefinido[tipoEstoque]) { 
        showAlert(alertElementId, `Defina o Estoque Inicial de ${tipoEstoque === 'agua' ? 'Água' : 'Gás'} antes de lançar entradas.`, 'warning'); return; 
    }
    
    btnSubmit.disabled = true; btnSubmit.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    const collectionRef = (tipoEstoque === 'agua') ? estoqueAguaCollection : estoqueGasCollection;
    
    try {
        await addDoc(collectionRef, { 
            tipo: 'entrada', 
            quantidade: quantidade, 
            data: data, 
            responsavel: responsavel, 
            notaFiscal: notaFiscal, 
            registradoEm: serverTimestamp() 
        });
        showAlert(alertElementId, 'Entrada no estoque salva!', 'success');
        form.reset(); 
        document.getElementById(`input-data-entrada-${tipoEstoque}`).value = getTodayDateString(); 
    } catch (error) {
        console.error("Erro salvar entrada estoque:", error); 
        showAlert(alertElementId, `Erro: ${error.message}`, 'error');
    } finally { 
        btnSubmit.disabled = false; btnSubmit.textContent = 'Salvar Entrada'; 
    }
}

function renderEstoqueAgua() {
    if (!estoqueAguaAtualEl) return; 
     if (!domReady) { console.warn("renderEstoqueAgua chamada antes do DOM pronto."); return; }
    
    if (loadingEstoqueAguaEl) loadingEstoqueAguaEl.style.display = 'none'; 
    
    if (estoqueInicialDefinido.agua) {
        if(btnAbrirInicialAgua) btnAbrirInicialAgua.classList.add('hidden'); 
        if(formInicialAguaContainer) formInicialAguaContainer.classList.add('hidden'); 
        if(resumoEstoqueAguaEl) resumoEstoqueAguaEl.classList.remove('hidden'); 
    } else { 
        if(btnAbrirInicialAgua) btnAbrirInicialAgua.classList.remove('hidden'); 
        if(resumoEstoqueAguaEl) resumoEstoqueAguaEl.classList.add('hidden'); 
    }

    const estoqueInicial = fb_estoque_agua.filter(e => e.tipo === 'inicial').reduce((sum, e) => sum + e.quantidade, 0);
    const totalEntradas = fb_estoque_agua.filter(e => e.tipo === 'entrada').reduce((sum, e) => sum + e.quantidade, 0);
    const totalSaidas = fb_agua_movimentacoes.filter(m => m.tipo === 'entrega').reduce((sum, m) => sum + m.quantidade, 0);
    const estoqueAtual = estoqueInicial + totalEntradas - totalSaidas;

    estoqueAguaInicialEl.textContent = estoqueInicial;
    estoqueAguaEntradasEl.textContent = `+${totalEntradas}`;
    estoqueAguaSaidasEl.textContent = `-${totalSaidas}`;
    estoqueAguaAtualEl.textContent = estoqueAtual;
    
    renderDashboardVisaoGeralSummary(); 
}

function renderEstoqueGas() {
     if (!estoqueGasAtualEl) return;
     if (!domReady) { console.warn("renderEstoqueGas chamada antes do DOM pronto."); return; }
    if (loadingEstoqueGasEl) loadingEstoqueGasEl.style.display = 'none';
    
    if (estoqueInicialDefinido.gas) {
        if(btnAbrirInicialGas) btnAbrirInicialGas.classList.add('hidden'); 
        if(formInicialGasContainer) formInicialGasContainer.classList.add('hidden'); 
        if(resumoEstoqueGasEl) resumoEstoqueGasEl.classList.remove('hidden');
    } else { 
        if(btnAbrirInicialGas) btnAbrirInicialGas.classList.remove('hidden'); 
        if(resumoEstoqueGasEl) resumoEstoqueGasEl.classList.add('hidden'); 
    }

    const estoqueInicial = fb_estoque_gas.filter(e => e.tipo === 'inicial').reduce((sum, e) => sum + e.quantidade, 0);
    const totalEntradas = fb_estoque_gas.filter(e => e.tipo === 'entrada').reduce((sum, e) => sum + e.quantidade, 0);
    const totalSaidas = fb_gas_movimentacoes.filter(m => m.tipo === 'entrega').reduce((sum, m) => sum + m.quantidade, 0);
    const estoqueAtual = estoqueInicial + totalEntradas - totalSaidas;

    estoqueGasInicialEl.textContent = estoqueInicial;
    estoqueGasEntradasEl.textContent = `+${totalEntradas}`;
    estoqueGasSaidasEl.textContent = `-${totalSaidas}`;
    estoqueGasAtualEl.textContent = estoqueAtual;
    
    renderDashboardVisaoGeralSummary(); 
}

function renderHistoricoAgua() {
    if (!tableHistoricoAgua) return;
     if (!domReady) { console.warn("renderHistoricoAgua chamada antes do DOM pronto."); return; }
    
    // NOVO: Filtra apenas entradas (tipo: inicial ou entrada)
    const historicoOrdenado = [...fb_estoque_agua]
        .filter(e => e.tipo === 'inicial' || e.tipo === 'entrada')
        .sort((a, b) => (b.registradoEm?.toMillis() || 0) - (a.registradoEm?.toMillis() || 0));
     
     if (historicoOrdenado.length === 0) { 
        tableHistoricoAgua.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500">Nenhuma entrada registrada.</td></tr>'; return; 
     }
     
    tableHistoricoAgua.innerHTML = historicoOrdenado.map(e => {
        const tipoClass = e.tipo === 'inicial' ? 'badge-blue' : 'badge-green';
        const tipoText = e.tipo === 'inicial' ? 'Inicial' : 'Entrada';
        return `
        <tr>
            <td>${formatTimestamp(e.data)}</td>
            <td><span class="badge ${tipoClass}">${tipoText}</span></td>
            <td class="text-center font-medium">${e.quantidade}</td>
            <td>${e.responsavel || 'N/A'}</td><td>${e.notaFiscal || 'N/A'}</td>
            <td class="text-center">
                <button class="btn-danger btn-remove" data-id="${e.id}" data-type="entrada-agua" title="Remover esta entrada"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>
    `}).join('');
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } // CORREÇÃO 7: Garante que lucide existe

    const filtroHistoricoAguaEl = document.getElementById('filtro-historico-agua');
    if (filtroHistoricoAguaEl && filtroHistoricoAguaEl.value) { filterTable(filtroHistoricoAguaEl, 'table-historico-agua'); }
}

function renderHistoricoGas() {
     if (!tableHistoricoGas) return;
     if (!domReady) { console.warn("renderHistoricoGas chamada antes do DOM pronto."); return; }
    
    // NOVO: Filtra apenas entradas (tipo: inicial ou entrada)
    const historicoOrdenado = [...fb_estoque_gas]
        .filter(e => e.tipo === 'inicial' || e.tipo === 'entrada')
        .sort((a, b) => (b.data?.toMillis() || 0) - (a.data?.toMillis() || 0));
     
     if (historicoOrdenado.length === 0) { 
        tableHistoricoGas.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500">Nenhuma entrada registrada.</td></tr>'; return; 
     }
     
    tableHistoricoGas.innerHTML = historicoOrdenado.map(e => {
        const tipoClass = e.tipo === 'inicial' ? 'badge-blue' : 'badge-green';
        const tipoText = e.tipo === 'inicial' ? 'Inicial' : 'Entrada';
        return `
        <tr>
            <td>${formatTimestamp(e.data)}</td>
            <td><span class="badge ${tipoClass}">${tipoText}</span></td>
            <td class="text-center font-medium">${e.quantidade}</td>
            <td>${e.responsavel || 'N/A'}</td><td>${e.notaFiscal || 'N/A'}</td>
            <td class="text-center">
                <button class="btn-danger btn-remove" data-id="${e.id}" data-type="entrada-gas" title="Remover esta entrada"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>
    `}).join('');
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } // CORREÇÃO 8: Garante que lucide existe

    const filtroHistoricoGasEl = document.getElementById('filtro-historico-gas');
    if (filtroHistoricoGasEl && filtroHistoricoGasEl.value) { filterTable(filtroHistoricoGasEl, 'table-historico-gas'); }
}


// --- CONTROLE DE ABAS E INICIALIZAÇÃO ---
function switchSubTabView(tabPrefix, subViewName) {
     if (!domReady) return; 
    document.querySelectorAll(`#sub-nav-${tabPrefix} .sub-nav-btn`).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subview === subViewName);
    });
    document.querySelectorAll(`#content-${tabPrefix} > div[id^="subview-"]`).forEach(pane => {
         pane.classList.toggle('hidden', pane.id !== `subview-${subViewName}`);
    });
     if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } 
}

function switchTab(tabName) {
    if (!domReady) { 
        console.warn(`switchTab(${tabName}) chamada antes do DOM pronto. Ignorando.`); 
        // Remoção da lógica de adiamento que causava spam de logs
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
    
    // As chamadas de renderização aqui devem funcionar pois domReady é true
    if (tabName === 'gestao') { renderGestaoUnidades(); }
    if (tabName === 'agua') { 
        // NOVO: Default para Movimentação
        switchSubTabView('agua', 'movimentacao-agua'); 
        switchEstoqueForm('saida-agua'); 
        toggleAguaFormInputs(); 
        renderEstoqueAgua(); 
        renderHistoricoAgua(); 
        // NOVO: Adiciona listener para a seleção de unidade
        if(selectUnidadeAgua) selectUnidadeAgua.addEventListener('change', () => checkUnidadeSaldoAlert('agua'));
        checkUnidadeSaldoAlert('agua');
    }
    if (tabName === 'gas') { 
         // NOVO: Default para Movimentação
        switchSubTabView('gas', 'movimentacao-gas'); 
        switchEstoqueForm('saida-gas'); 
        toggleGasFormInputs(); 
        renderEstoqueGas(); 
        renderHistoricoGas(); 
        // NOVO: Adiciona listener para a seleção de unidade
        if(selectUnidadeGas) selectUnidadeGas.addEventListener('change', () => checkUnidadeSaldoAlert('gas'));
        checkUnidadeSaldoAlert('gas');
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

    setTimeout(() => { 
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } // CORREÇÃO 9: Garante que lucide existe
    }, 50); 
}

// CORREÇÃO: Esta função agora roda PRIMEIRO, no DOMContentLoaded
function setupApp() {
    console.log("Executando setupApp...");
    
    // <<< Busca elementos do DOM AQUI >>>
    navButtons = document.querySelectorAll('.nav-btn'); 
    contentPanes = document.querySelectorAll('main > div[id^="content-"]'); 
    connectionStatusEl = document.getElementById('connectionStatus'); 
    lastUpdateTimeEl = document.getElementById('last-update-time');
    dashboardNavControls = document.getElementById('dashboard-nav-controls');
    summaryAguaPendente = document.getElementById('summary-agua-pendente'); summaryAguaEntregue = document.getElementById('summary-agua-entregue'); summaryAguaRecebido = document.getElementById('summary-agua-recebido');
    summaryGasPendente = document.getElementById('summary-gas-pendente'); summaryGasEntregue = document.getElementById('summary-gas-entregue'); summaryGasRecebido = document.getElementById('summary-gas-recebido');
    dashboardMateriaisProntosContainer = document.getElementById('dashboard-materiais-prontos'); 
    // loadingMateriaisProntos não é mais necessário pois o HTML é estático
    // loadingMateriaisProntos = document.getElementById('loading-materiais-prontos'); 
    btnClearDashboardFilter = document.getElementById('btn-clear-dashboard-filter'); 
    dashboardMateriaisTitle = document.getElementById('dashboard-materiais-title'); 
    dashboardMateriaisListContainer = document.getElementById('dashboard-materiais-list'); loadingMateriaisDashboard = document.getElementById('loading-materiais-dashboard');
    dashboardEstoqueAguaEl = document.getElementById('dashboard-estoque-agua'); dashboardEstoqueGasEl = document.getElementById('dashboard-estoque-gas'); dashboardMateriaisSeparacaoCountEl = document.getElementById('dashboard-materiais-separacao-count');
    dashboardMateriaisRetiradaCountEl = document.getElementById('dashboard-materiais-retirada-count');
    formAgua = document.getElementById('form-agua'); selectUnidadeAgua = document.getElementById('select-unidade-agua'); selectTipoAgua = document.getElementById('select-tipo-agua'); inputDataAgua = document.getElementById('input-data-agua'); inputResponsavelAgua = document.getElementById('input-responsavel-agua'); btnSubmitAgua = document.getElementById('btn-submit-agua'); alertAgua = document.getElementById('alert-agua'); tableStatusAgua = document.getElementById('table-status-agua'); alertAguaLista = document.getElementById('alert-agua-lista');
    inputQtdEntregueAgua = document.getElementById('input-qtd-entregue-agua'); inputQtdRetornoAgua = document.getElementById('input-qtd-retorno-agua'); formGroupQtdEntregueAgua = document.getElementById('form-group-qtd-entregue-agua'); formGroupQtdRetornoAgua = document.getElementById('form-group-qtd-retorno-agua');
    unidadeSaldoAlertaAgua = document.getElementById('unidade-saldo-alerta-agua'); // NOVO
    formGas = document.getElementById('form-gas'); selectUnidadeGas = document.getElementById('select-unidade-gas'); selectTipoGas = document.getElementById('select-tipo-gas'); inputDataGas = document.getElementById('input-data-gas'); inputResponsavelGas = document.getElementById('input-responsavel-gas'); btnSubmitGas = document.getElementById('btn-submit-gas'); alertGas = document.getElementById('alert-gas'); tableStatusGas = document.getElementById('table-status-gas'); alertGasLista = document.getElementById('alert-gas-lista');
    inputQtdEntregueGas = document.getElementById('input-qtd-entregue-gas'); inputQtdRetornoGas = document.getElementById('input-qtd-retorno-gas'); formGroupQtdEntregueGas = document.getElementById('form-group-qtd-entregue-gas'); formGroupQtdRetornoGas = document.getElementById('form-group-qtd-retorno-gas');
    unidadeSaldoAlertaGas = document.getElementById('unidade-saldo-alerta-gas'); // NOVO
    formMateriais = document.getElementById('form-materiais'); selectUnidadeMateriais = document.getElementById('select-unidade-materiais'); selectTipoMateriais = document.getElementById('select-tipo-materiais'); inputDataSeparacao = document.getElementById('input-data-separacao'); textareaItensMateriais = document.getElementById('textarea-itens-materiais'); inputResponsavelMateriais = document.getElementById('input-responsavel-materiais'); inputArquivoMateriais = document.getElementById('input-arquivo-materiais'); btnSubmitMateriais = document.getElementById('btn-submit-materiais'); alertMateriais = document.getElementById('alert-materiais'); tableStatusMateriais = document.getElementById('table-status-materiais'); alertMateriaisLista = document.getElementById('alert-materiais-lista'); // <<< Atualizado
    tableGestaoUnidades = document.getElementById('table-gestao-unidades'); alertGestao = document.getElementById('alert-gestao'); textareaBulkUnidades = document.getElementById('textarea-bulk-unidades'); btnBulkAddUnidades = document.getElementById('btn-bulk-add-unidades');
    filtroUnidadeNome = document.getElementById('filtro-unidade-nome'); filtroUnidadeTipo = document.getElementById('filtro-unidade-tipo'); 
    relatorioTipo = document.getElementById('relatorio-tipo'); relatorioDataInicio = document.getElementById('relatorio-data-inicio'); relatorioDataFim = document.getElementById('relatorio-data-fim'); btnGerarPdf = document.getElementById('btn-gerar-pdf'); alertRelatorio = document.getElementById('alert-relatorio');
    confirmDeleteModal = document.getElementById('confirm-delete-modal'); btnCancelDelete = document.getElementById('btn-cancel-delete'); btnConfirmDelete = document.getElementById('btn-confirm-delete'); deleteDetailsEl = document.getElementById('delete-details'); deleteWarningUnidadeEl = document.getElementById('delete-warning-unidade'); deleteWarningInicialEl = document.getElementById('delete-warning-inicial'); 
    // NOVO: Busca elementos do modal do separador
    separadorModal = document.getElementById('separador-modal');
    inputSeparadorNome = document.getElementById('input-separador-nome');
    btnSalvarSeparador = document.getElementById('btn-salvar-separador');
    separadorMaterialIdEl = document.getElementById('separador-material-id'); // Input hidden
    alertSeparador = document.getElementById('alert-separador');
    // NOVO: Busca elementos do modal de responsável do almoxarifado
    almoxarifadoResponsavelModal = document.getElementById('almoxarifado-responsavel-modal');
    inputAlmoxResponsavelNome = document.getElementById('input-almox-responsavel-nome');
    btnSalvarMovimentacaoFinal = document.getElementById('btn-salvar-movimentacao-final');
    alertAlmoxResponsavel = document.getElementById('alert-almox-responsavel');
    // NOVO: Busca os inputs hidden temporários
    almoxTempFields = {
        unidadeId: document.getElementById('almox-temp-unidadeId'),
        unidadeNome: document.getElementById('almox-temp-unidadeNome'),
        tipoUnidadeRaw: document.getElementById('almox-temp-tipoUnidadeRaw'),
        tipoMovimentacao: document.getElementById('almox-temp-tipoMovimentacao'),
        qtdEntregue: document.getElementById('almox-temp-qtdEntregue'),
        qtdRetorno: document.getElementById('almox-temp-qtdRetorno'),
        data: document.getElementById('almox-temp-data'),
        responsavelUnidade: document.getElementById('almox-temp-responsavelUnidade'),
        itemType: document.getElementById('almox-temp-itemType'),
    };
    estoqueAguaInicialEl = document.getElementById('estoque-agua-inicial'); estoqueAguaEntradasEl = document.getElementById('estoque-agua-entradas'); estoqueAguaSaidasEl = document.getElementById('estoque-agua-saidas'); estoqueAguaAtualEl = document.getElementById('estoque-agua-atual'); loadingEstoqueAguaEl = document.getElementById('loading-estoque-agua'); resumoEstoqueAguaEl = document.getElementById('resumo-estoque-agua');
    formEntradaAgua = document.getElementById('form-entrada-agua'); inputDataEntradaAgua = document.getElementById('input-data-entrada-agua'); btnSubmitEntradaAgua = document.getElementById('btn-submit-entrada-agua');
    formInicialAguaContainer = document.getElementById('form-inicial-agua-container'); formInicialAgua = document.getElementById('form-inicial-agua'); inputInicialQtdAgua = document.getElementById('input-inicial-qtd-agua'); inputInicialResponsavelAgua = document.getElementById('input-inicial-responsavel-agua'); btnSubmitInicialAgua = document.getElementById('btn-submit-inicial-agua'); alertInicialAgua = document.getElementById('alert-inicial-agua'); btnAbrirInicialAgua = document.getElementById('btn-abrir-inicial-agua');
    tableHistoricoAgua = document.getElementById('table-historico-agua'); alertHistoricoAgua = document.getElementById('alert-historico-agua');
    estoqueGasInicialEl = document.getElementById('estoque-gas-inicial'); estoqueGasEntradasEl = document.getElementById('estoque-gas-entradas'); estoqueGasSaidasEl = document.getElementById('estoque-gas-saidas'); estoqueGasAtualEl = document.getElementById('estoque-gas-atual'); loadingEstoqueGasEl = document.getElementById('loading-estoque-gas'); resumoEstoqueGasEl = document.getElementById('resumo-estoque-gas');
    formEntradaGas = document.getElementById('form-entrada-gas'); inputDataEntradaGas = document.getElementById('input-data-entrada-gas'); btnSubmitEntradaGas = document.getElementById('btn-submit-entrada-gas');
    formInicialGasContainer = document.getElementById('form-inicial-gas-container'); formInicialGas = document.getElementById('form-inicial-gas'); inputInicialQtdGas = document.getElementById('input-inicial-qtd-gas'); inputInicialResponsavelGas = document.getElementById('input-inicial-responsavel-gas'); btnSubmitInicialGas = document.getElementById('btn-submit-inicial-gas'); alertInicialGas = document.getElementById('alert-inicial-gas'); btnAbrirInicialGas = document.getElementById('btn-abrir-inicial-gas');
    tableHistoricoGas = document.getElementById('table-historico-gas'); alertHistoricoGas = document.getElementById('alert-historico-gas');

    // <<< VERIFICAÇÃO CRÍTICA >>>
    // Esta verificação agora roda DEPOIS do DOMContentLoaded, então deve passar.
    if (!dashboardMateriaisProntosContainer || !navButtons) {
        console.error("ERRO CRÍTICO: Elementos essenciais (Container Materiais ou Botões de Navegação) NÃO encontrados DENTRO de setupApp!");
        showAlert('alert-agua', 'Erro crítico ao carregar interface. Recarregue a página (Erro Setup).', 'error', 60000);
        return; // Não marcar domReady = true se falhar
    } else {
        console.log("Elementos essenciais encontrados DENTRO de setupApp.");
    }
    
    // CORREÇÃO CRÍTICA: Marcar domReady=true AQUI, após encontrar os elementos
    // e ANTES de adicionar os listeners
    domReady = true; 
    console.log("setupApp: domReady marcado como TRUE.");

    const todayStr = getTodayDateString();
    [inputDataAgua, inputDataGas, inputDataSeparacao, relatorioDataInicio, relatorioDataFim, inputDataEntradaAgua, inputDataEntradaGas].forEach(input => {
        if(input) input.value = todayStr;
    });

    // --- Adiciona Event Listeners ---
    navButtons.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
    if (dashboardNavControls) dashboardNavControls.addEventListener('click', (e) => { const btn = e.target.closest('button.dashboard-nav-btn[data-view]'); if (btn) switchDashboardView(btn.dataset.view); });
    if (formAgua) formAgua.addEventListener('submit', handleAguaSubmit); 
    if (formGas) formGas.addEventListener('submit', handleGasSubmit); 
    if (formMateriais) formMateriais.addEventListener('submit', handleMateriaisSubmit); 
    if (selectTipoAgua) selectTipoAgua.addEventListener('change', toggleAguaFormInputs);
    if (selectTipoGas) selectTipoGas.addEventListener('change', toggleGasFormInputs);
    
    // NOVO: Listener para o select de unidade (para o alerta de saldo)
    if(selectUnidadeAgua) selectUnidadeAgua.addEventListener('change', () => checkUnidadeSaldoAlert('agua'));
    if(selectUnidadeGas) selectUnidadeGas.addEventListener('change', () => checkUnidadeSaldoAlert('gas'));
    
    document.querySelector('main').addEventListener('click', (e) => {
         const removeBtn = e.target.closest('button.btn-remove[data-id]');
         const entregueBtn = e.target.closest('button.btn-entregue[data-id]');
         const retiradaBtn = e.target.closest('button.btn-retirada[data-id]');
         // NOVOS: Botões de Iniciar Separação e Download
         const startSeparacaoBtn = e.target.closest('button.btn-start-separacao[data-id]');
         const downloadPedidoBtn = e.target.closest('button.btn-download-pedido[data-id]');

         if (removeBtn) {
             openConfirmDeleteModal(removeBtn.dataset.id, removeBtn.dataset.type, removeBtn.dataset.details);
         } else if (entregueBtn) {
             handleMarcarEntregue(e);
         } else if (retiradaBtn) {
             handleMarcarRetirada(e);
         } else if (startSeparacaoBtn) { // NOVO
             openSeparadorModal(startSeparacaoBtn.dataset.id);
         } else if (downloadPedidoBtn) { // NOVO
             handleDownloadPedido(downloadPedidoBtn.dataset.id, downloadPedidoBtn.dataset.url);
         }
    });

    if (tableGestaoUnidades) { 
        tableGestaoUnidades.addEventListener('click', handleEditUnidadeClick);
        tableGestaoUnidades.addEventListener('click', handleCancelEditUnidadeClick);
        tableGestaoUnidades.addEventListener('click', handleSaveUnidadeClick);
    }
    const contentGestao = document.getElementById('content-gestao');
    if (contentGestao) {
        contentGestao.addEventListener('change', handleGestaoToggle); 
        if(filtroUnidadeNome) filtroUnidadeNome.addEventListener('input', renderGestaoUnidades); 
        if(filtroUnidadeTipo) filtroUnidadeTipo.addEventListener('input', renderGestaoUnidades); 
    }
    if (btnBulkAddUnidades) btnBulkAddUnidades.addEventListener('click', handleBulkAddUnidades);
    if (btnGerarPdf) btnGerarPdf.addEventListener('click', handleGerarPdf);
    if (btnCancelDelete) btnCancelDelete.addEventListener('click', () => confirmDeleteModal.style.display = 'none');
    if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', executeDelete);
    // NOVO: Listener para salvar nome do separador
    if (btnSalvarSeparador) btnSalvarSeparador.addEventListener('click', handleSalvarSeparador);
    // NOVO: Listener para salvar o nome do almoxarifado no modal
    if (btnSalvarMovimentacaoFinal) btnSalvarMovimentacaoFinal.addEventListener('click', handleFinalMovimentacaoSubmit);
    
    document.querySelectorAll('.form-tab-btn[data-form="saida-agua"]').forEach(btn => btn.addEventListener('click', () => switchEstoqueForm('saida-agua')));
    document.querySelectorAll('.form-tab-btn[data-form="entrada-agua"]').forEach(btn => btn.addEventListener('click', () => switchEstoqueForm('entrada-agua')));
    document.querySelectorAll('.form-tab-btn[data-form="saida-gas"]').forEach(btn => btn.addEventListener('click', () => switchEstoqueForm('saida-gas')));
    document.querySelectorAll('.form-tab-btn[data-form="entrada-gas"]').forEach(btn => btn.addEventListener('click', () => switchEstoqueForm('entrada-gas')));
    if (formEntradaAgua) formEntradaAgua.addEventListener('submit', handleEntradaEstoqueSubmit);
    if (formEntradaGas) formEntradaGas.addEventListener('submit', handleEntradaEstoqueSubmit);
    if (btnAbrirInicialAgua) btnAbrirInicialAgua.addEventListener('click', () => { if(formInicialAguaContainer) formInicialAguaContainer.classList.remove('hidden'); if(btnAbrirInicialAgua) btnAbrirInicialAgua.classList.add('hidden'); });
    if (btnAbrirInicialGas) btnAbrirInicialGas.addEventListener('click', () => { if(formInicialGasContainer) formInicialGasContainer.classList.remove('hidden'); if(btnAbrirInicialGas) btnAbrirInicialGas.classList.add('hidden'); });
    if (formInicialAgua) formInicialAgua.addEventListener('submit', handleInicialEstoqueSubmit);
    if (formInicialGas) formInicialGas.addEventListener('submit', handleInicialEstoqueSubmit);
    document.getElementById('filtro-status-agua')?.addEventListener('input', (e) => filterTable(e.target, 'table-status-agua'));
    document.getElementById('filtro-historico-agua')?.addEventListener('input', (e) => filterTable(e.target, 'table-historico-agua'));
    document.getElementById('filtro-status-gas')?.addEventListener('input', (e) => filterTable(e.target, 'table-status-gas'));
    document.getElementById('filtro-historico-gas')?.addEventListener('input', (e) => filterTable(e.target, 'table-historico-gas'));
    document.getElementById('filtro-status-materiais')?.addEventListener('input', (e) => filterTable(e.target, 'table-status-materiais'));
    // NOVO: Listeners para sub-navegação de Água e Gás
    document.getElementById('sub-nav-agua')?.addEventListener('click', (e) => { 
        const btn = e.target.closest('button.sub-nav-btn[data-subview]'); 
        if (btn) {
             switchSubTabView('agua', btn.dataset.subview); 
             if (btn.dataset.subview === 'status-agua') renderAguaStatus();
             if (btn.dataset.subview === 'historico-agua') renderHistoricoAgua();
        }
    });
    document.getElementById('sub-nav-gas')?.addEventListener('click', (e) => { 
        const btn = e.target.closest('button.sub-nav-btn[data-subview]'); 
        if (btn) {
            switchSubTabView('gas', btn.dataset.subview);
            if (btn.dataset.subview === 'status-gas') renderGasStatus();
            if (btn.dataset.subview === 'historico-gas') renderHistoricoGas();
        }
    });

    const cardSeparacao = document.getElementById('dashboard-card-separacao');
    const cardRetirada = document.getElementById('dashboard-card-retirada');
    const btnClearFilter = btnClearDashboardFilter; 
    
    if (cardSeparacao) {
        // Agora, clicar em 'Em Separação' filtra por status 'separacao' E 'requisitado' (lógica interna)
        cardSeparacao.addEventListener('click', () => filterDashboardMateriais('separacao')); 
    }
    if (cardRetirada) {
        cardRetirada.addEventListener('click', () => filterDashboardMateriais('retirada')); 
    }
    if (btnClearFilter) { 
        btnClearFilter.addEventListener('click', () => filterDashboardMateriais(null));
    }

    if(typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } // CORREÇÃO 10: Garante que lucide existe
    toggleAguaFormInputs(); toggleGasFormInputs();

    // CORREÇÃO: Removida a chamada switchTab('dashboard') daqui
    // Ela agora é chamada pelo onAuthStateChanged
}


// --- INICIALIZAÇÃO GERAL ---
// CORREÇÃO: Ordem de inicialização alterada
document.addEventListener('DOMContentLoaded', () => { 
    console.log("DOM Carregado. Executando setupApp...");
    // 1. Configura o DOM e os listeners primeiro
    setupApp(); 
    
    // 2. Inicia o Firebase APÓS o DOM estar pronto e 'domReady = true'
    console.log("setupApp concluído. Iniciando Firebase...");
    initFirebase(); 
});
