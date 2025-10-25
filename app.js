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
// CORREÇÃO PONTO 3: Inicialização dos filtros de saldo
let currentStatusFilter = { agua: 'all', gas: 'all' }; 

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
let formMateriais, selectUnidadeMateriais, selectTipoMateriais, inputDataSeparacao, textareaItensMateriais, inputResponsavelMateriais, inputArquivoMateriais, btnSubmitMateriais, alertMateriais; // <<< Atualizado
let tableGestaoUnidades, alertGestao, textareaBulkUnidades, btnBulkAddUnidades;
let filtroUnidadeNome, filtroUnidadeTipo; 
let relatorioTipo, relatorioDataInicio, relatorioDataFim, btnGerarPdf, alertRelatorio;
let confirmDeleteModal, btnCancelDelete, btnConfirmDelete, deleteDetailsEl, deleteWarningUnidadeEl, deleteWarningInicialEl; 
let estoqueAguaInicialEl, estoqueAguaEntradasEl, estoqueAguaSaidasEl, estoqueAguaAtualEl, loadingEstoqueAguaEl, resumoEstoqueAguaEl;
let formEntradaAgua, inputDataEntradaAgua, btnSubmitEntradaAgua; 
let formInicialAguaContainer, formInicialAgua, inputInicialQtdAgua, inputInicialResponsavelAgua, btnSubmitInicialAgua, alertInicialAgua, btnAbrirInicialAgua; 
let estoqueGasInicialEl, estoqueGasEntradasEl, estoqueGasSaidasEl, estoqueGasAtualEl, loadingEstoqueGasEl, resumoEstoqueGasEl;
let formEntradaGas, inputDataEntradaGas, btnSubmitEntradaGas; 
let formInicialGasContainer, formInicialGas, inputInicialQtdGas, inputInicialResponsavelGas, btnSubmitInicialGas, alertInicialGas, btnAbrirInicialGas; 
let listaExclusoes = { agua: [], gas: [] };
let modoPrevisao = { agua: null, gas: null };
let graficoPrevisao = { agua: null, gas: null };
let tipoSelecionadoPrevisao = { agua: null, gas: null };

// NOVO: Referências Materiais Workflow
let tableParaSeparar, tableEmSeparacao, tableProntoEntrega, tableHistoricoEntregues;
let summaryMateriaisRequisitado, summaryMateriaisSeparacao, summaryMateriaisRetirada;

// NOVO: Referências do Modal do Separador
let separadorModal, inputSeparadorNome, btnSalvarSeparador, separadorMaterialIdEl, alertSeparador; // <<< NOVO
// NOVO: Referências do Modal de Responsável do Almoxarifado (Água/Gás)
let almoxarifadoResponsavelModal, inputAlmoxResponsavelNome, btnSalvarMovimentacaoFinal, alertAlmoxResponsavel; 
let almoxTempFields = {}; // Armazena dados temporariamente
// NOVO: Referências do Modal de Finalização de Entrega (Materiais)
let finalizarEntregaModal, inputEntregaResponsavelAlmox, inputEntregaResponsavelUnidade, btnConfirmarFinalizacaoEntrega, finalizarEntregaMaterialIdEl, alertFinalizarEntrega;

// NOVO: Referências Histórico Geral
let tableHistoricoAguaAll, tableHistoricoGasAll;


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
                
                // CORREÇÃO PONTO 2: Adiciona listener para os botões de filtro de saldo
                if (domReady) {
                    document.querySelectorAll('#filtro-saldo-agua-controls button').forEach(btn => {
                         if (!btn.hasAttribute('data-listener-added')) {
                            btn.addEventListener('click', (e) => handleSaldoFilter('agua', e));
                            btn.setAttribute('data-listener-added', 'true');
                        }
                    });
                    document.querySelectorAll('#filtro-saldo-gas-controls button').forEach(btn => {
                         if (!btn.hasAttribute('data-listener-added')) {
                            btn.addEventListener('click', (e) => handleSaldoFilter('gas', e));
                            btn.setAttribute('data-listener-added', 'true');
                        }
                    });
                }
                
                // CORREÇÃO: Chama os listeners e a renderização inicial AQUI,
                // pois agora temos certeza que o DOM está pronto (domReady=true) E o usuário está autenticado.
                initFirestoreListeners();
                
                // Chama as funções de renderização que dependem de dados (listeners podem já ter dados)
                console.log("Chamando funções de renderização inicial pós-autenticação...");
                updateLastUpdateTime(); 
                renderDashboardMateriaisProntos(currentDashboardMaterialFilter); 
                renderAguaStatus();
                renderGasStatus();
                renderMateriaisStatus(); // RENDERIZA OS NOVOS SUBVIEWS
                renderDashboardMateriaisCounts(); // CONTAGEM P/ SUMMARY DO MATERIAL
                
                renderEstoqueAgua();
                renderAguaMovimentacoesHistory(); // NOVO HISTÓRICO GERAL

                renderEstoqueGas();
                renderGasMovimentacoesHistory(); // NOVO HISTÓRICO GERAL

                renderDashboardAguaChart();
                renderDashboardGasChart();
                renderDashboardAguaSummary();
                renderDashboardGasSummary();
                renderDashboardMateriaisList();
                

                // Inicia a UI (CORREÇÃO PONTO 2: Garante que a primeira aba é carregada corretamente)
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
            
            // Removido o listener daqui, pois foi para o initFirebase para garantir que ele esteja no escopo
            
            // CORREÇÃO: Adiciona uma verificação extra para garantir que o elemento não é nulo/undefined
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
            renderAguaMovimentacoesHistory(); // NOVO: Renderiza histórico geral
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
            renderGasMovimentacoesHistory(); // NOVO: Renderiza histórico geral
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
            renderMateriaisStatus(); // RENDERIZA OS NOVOS SUBVIEWS
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
            // REMOVIDO: renderHistoricoAgua(); // Agora chama só a história de ENTRADAS DE ESTOQUE (Não movimentações de unidades)
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
            // REMOVIDO: renderHistoricoGas(); // Agora chama só a história de ENTRADAS DE ESTOQUE (Não movimentações de unidades)
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
        
        [tableStatusAgua, tableStatusGas, tableHistoricoAguaAll, tableHistoricoGasAll, tableParaSeparar, tableEmSeparacao, tableProntoEntrega, tableHistoricoEntregues, tableGestaoUnidades].forEach(tbody => { 
             // Ajuste para não quebrar se o elemento ainda não foi criado pelo listener inicial
            if(tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-red-500">Desconectado do Firebase</td></tr>'; 
        });
        
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
    const entregues = movimentacoes.filter(m => m.unidadeId === unidadeId && (m.tipo === 'entrega' || m.tipo === 'troca')).reduce((sum, m) => sum + m.quantidade, 0);
    const recebidos = movimentacoes.filter(m => m.unidadeId === unidadeId && (m.tipo === 'retorno' || m.tipo === 'troca')).reduce((sum, m) => sum + m.quantidade, 0);
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
        // Unidade deve garrafões/botijões. (Vazios na Unidade)
        message = `⚠️ Atenção! A unidade **${unidadeNome}** está devendo **${saldo}** ${itemLabel}${saldo > 1 ? 's' : ''} vazio${saldo > 1 ? 's' : ''}. Confirme se o saldo está correto antes de entregar mais.`;
        type = 'warning';
    } else if (saldo < 0) {
        // Unidade tem crédito (entregou mais vazios do que recebeu cheios). (Vazios na Secretaria)
        message = `👍 A unidade **${unidadeNome}** tem um crédito de **${Math.abs(saldo)}** ${itemLabel}${Math.abs(saldo) > 1 ? 's' : ''}. Você deve ter **${Math.abs(saldo)}** ${itemLabel}${Math.abs(saldo) > 1 ? 's' : ''} vazios extras na Secretaria.`;
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
    const data = dateToTimestamp(inputDataAgua.value); // Data da Movimentação
    const responsavelUnidade = capitalizeString(inputResponsavelAgua.value.trim()); 
    
    if (!unidadeId || !data || !responsavelUnidade) {
        showAlert('alert-agua', 'Dados inválidos. Verifique Unidade, Data e Nome de quem Recebeu/Devolveu.', 'warning'); return;
    }
    if (tipoMovimentacao === 'troca' && (qtdEntregue <= 0 || qtdRetorno <= 0)) {
         showAlert('alert-agua', 'Para "Troca", a quantidade entregue e recebida deve ser maior que zero.', 'warning'); return;
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
    }
    
    // CORREÇÃO 1: Vai para o modal para capturar o nome do almoxarifado em QUALQUER movimentação
    
    // Se for APENAS RETORNO ou TROCA com Retorno (que exige o nome do almox. para rastreio)
    // Se for APENAS ENTREGA (também exige nome do almox.)
    
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
    const modalBody = almoxarifadoResponsavelModal.querySelector('.modal-body p');
    const btnConfirm = document.getElementById('btn-salvar-movimentacao-final');
    
    if (tipoMovimentacao === 'entrega' || (tipoMovimentacao === 'troca' && qtdEntregue > 0)) {
         modalBody.innerHTML = `Informe seu nome (Responsável do Almoxarifado) para registrar quem está realizando a **entrega** de **${qtdEntregue}** galão(ões) cheio(s). Esta informação é crucial para o rastreio.`;
         btnConfirm.innerHTML = `<i data-lucide="package-open"></i> Confirmar Entrega`;
    } else if (tipoMovimentacao === 'retorno' || (tipoMovimentacao === 'troca' && qtdRetorno > 0)) {
         modalBody.innerHTML = `Informe seu nome (Responsável do Almoxarifado) para registrar quem está realizando o **recebimento** de **${qtdRetorno}** galão(ões) vazio(s). Esta informação é crucial para o rastreio.`;
         btnConfirm.innerHTML = `<i data-lucide="package-check"></i> Confirmar Recebimento`;
    } else {
        // Nunca deve acontecer com as validações acima, mas por segurança.
        modalBody.innerHTML = `Informe seu nome (Responsável do Almoxarifado) para finalizar a movimentação.`;
        btnConfirm.innerHTML = `<i data-lucide="save"></i> Confirmar Movimentação`;
    }

    if (modalTitle) modalTitle.innerHTML = `<i data-lucide="box" class="w-5 h-5"></i> Confirmação de Movimentação (Água)`;
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } 
    
    almoxarifadoResponsavelModal.style.display = 'flex'; // Usar flex para centralizar
    document.getElementById('input-almox-responsavel-nome').focus();
    showAlert('alert-agua', 'Quase lá! Agora informe seu nome no pop-up para finalizar.', 'info');
    return;
    
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
        
        // 1. ENTREGA (SAÍDA DE ESTOQUE) - Salva o nome do almoxarifado em TODAS as movimentações
        if (data.qtdEntregue > 0) {
            // Se for troca, registra como 'troca' para melhor rastreio
            const tipoRegistro = data.qtdRetorno > 0 ? 'troca' : 'entrega';
            
            await addDoc(collection, { 
                unidadeId: data.unidadeId, 
                unidadeNome: data.unidadeNome, 
                tipoUnidade: tipoUnidade, 
                tipo: tipoRegistro, // Registra como 'troca' ou 'entrega'
                quantidade: data.qtdEntregue, 
                data: data.data, // Data da Movimentação (Entrega)
                responsavel: data.responsavelUnidade, // Responsável da Unidade
                responsavelAlmoxarifado: data.responsavelAlmoxarifado, // Responsável do Almoxarifado
                registradoEm: timestamp // Data do Lançamento
            });
            msgSucesso.push(`${data.qtdEntregue} ${itemType === 'agua' ? 'galão(ões)' : 'botijão(ões)'} entregue(s)`);
        }
        
        // 2. RETORNO (ENTRADA EM ESTOQUE VAZIO/CRÉDITO) - Salva o nome do almoxarifado em TODAS as movimentações
        if (data.qtdRetorno > 0 && data.tipoMovimentacao !== 'troca') { // Se for troca, já foi lançado acima com o tipo 'troca'. Se for só retorno, lança.
             await addDoc(collection, { 
                 unidadeId: data.unidadeId, 
                 unidadeNome: data.unidadeNome, 
                 tipoUnidade: tipoUnidade, 
                 tipo: 'retorno', 
                 quantidade: data.qtdRetorno, 
                 data: data.data, // Data da Movimentação (Retorno)
                 responsavel: data.responsavelUnidade, // Responsável da Unidade
                 responsavelAlmoxarifado: data.responsavelAlmoxarifado, // Responsável do Almoxarifado
                 registradoEm: timestamp // Data do Lançamento
            });
             msgSucesso.push(`${data.qtdRetorno} ${itemType === 'agua' ? 'galão(ões)' : 'botijão(ões)'} recebido(s)`);
        }
        
        showAlert(alertId, `Movimentação salva! ${msgSucesso.join('; ')}.`, 'success');
        
        // Limpa e reseta
        if(formToReset) formToReset.reset(); 
        if(inputData) inputData.value = getTodayDateString(); 
        if (itemType === 'agua') toggleAguaFormInputs();
        if (itemType === 'gas') toggleGasFormInputs();
        // CORREÇÃO PONTO 3: Re-verifica o saldo
        if (itemType === 'agua') checkUnidadeSaldoAlert('agua');
        if (itemType === 'gas') checkUnidadeSaldoAlert('gas');
        
        almoxarifadoResponsavelModal.style.display = 'none'; // Fecha o modal se estava aberto

    } catch (error) { 
        console.error(`Erro salvar movimentação (${itemType}):`, error); 
        showAlert(alertId, `Erro: ${error.message}`, 'error');
        showAlert('alert-almox-responsavel', `Erro ao salvar: ${error.message}. Tente novamente.`, 'error'); // Alerta do modal
    } finally { 
        if (btnSubmit) {
            btnSubmit.disabled = false; 
            btnSubmit.innerHTML = '<i data-lucide="save"></i> <span>Salvar Movimentação</span>'; 
            if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); }
        }
        const btnModal = document.getElementById('btn-salvar-movimentacao-final');
         if(btnModal) {
             btnModal.disabled = false;
             btnModal.innerHTML = '<i data-lucide="package-open"></i> Confirmar Movimentação';
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
        showAlert('alert-almox-responsavel', 'Por favor, informe seu nome (Almoxarifado) para registrar a entrega/recebimento.', 'warning');
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
        data: dataTemp, // Data da Movimentação
        responsavelUnidade: document.getElementById('almox-temp-responsavelUnidade').value,
        responsavelAlmoxarifado: nomeAlmoxarifado, // NOVO CAMPO SALVO
        itemType: itemType
    };
    
    await executeFinalMovimentacao(finalData);
    inputAlmoxResponsavelNome.value = ''; // Limpa o nome no modal após o salvamento
}

// NOVO: Função para lidar com o filtro de saldo (Ponto 3)
function handleSaldoFilter(itemType, e) {
    const button = e.target.closest('button.btn-saldo-filter');
    if (!button) return;

    const newFilter = button.dataset.filter;
    currentStatusFilter[itemType] = newFilter;

    // Atualiza o estado visual dos botões
    document.querySelectorAll(`#filtro-saldo-${itemType}-controls button`).forEach(btn => {
        btn.classList.remove('active', 'bg-blue-600', 'text-white', 'font-semibold', 'btn-warning', 'btn-info', 'btn-secondary', 'bg-green-600', 'bg-orange-600', 'bg-gray-400', 'bg-red-600');
        
        if (btn.dataset.filter === newFilter) {
            // CORREÇÃO PONTO 3: Usa cores mais chamativas e claras para o ativo
            if (btn.dataset.filter === 'devendo') btn.classList.add('active', 'bg-red-600', 'text-white', 'font-semibold');
            else if (btn.dataset.filter === 'credito') btn.classList.add('active', 'bg-green-600', 'text-white', 'font-semibold');
            else if (btn.dataset.filter === 'zero') btn.classList.add('active', 'bg-gray-600', 'text-white', 'font-semibold');
            else btn.classList.add('active', 'bg-blue-600', 'text-white', 'font-semibold'); // Todos
        } else {
            // Garante que os estilos de cor corretos são aplicados quando inativo
            if (btn.dataset.filter === 'devendo') btn.classList.add('btn-warning');
            else if (btn.dataset.filter === 'credito') btn.classList.add('btn-info');
            else btn.classList.add('btn-secondary'); 
        }
    });

    // Re-renderiza a tabela
    if (itemType === 'agua') renderAguaStatus();
    if (itemType === 'gas') renderGasStatus();
}

// MODIFICADO: renderAguaStatus para aplicar o filtro de saldo (Ponto 3)
function renderAguaStatus() {
     if (!tableStatusAgua) return;
     if (!domReady) { console.warn("renderAguaStatus chamada antes do DOM pronto."); return; }
     
     const currentFilter = currentStatusFilter.agua; // Ponto 3
     
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
             // CORREÇÃO PONTO 3: Inclui movimentações de TROCA no cálculo de entregues E recebidos
             if (m.tipo === 'entrega' || m.tipo === 'troca') unidadeStatus.entregues += m.quantidade;
             else if (m.tipo === 'retorno') unidadeStatus.recebidos += m.quantidade;
             
             // Armazena todos os lançamentos (melhor para o futuro, mas usa só o último)
             unidadeStatus.ultimosLancamentos.push({
                 id: m.id, 
                 respUnidade: m.responsavel, 
                 respAlmox: m.responsavelAlmoxarifado || 'N/A', 
                 data: m.data, 
                 registradoEm: m.registradoEm, // NOVO: Data do lançamento
                 tipo: m.tipo, 
                 quantidade: m.quantidade
            });
         }
     });

     let statusArray = Array.from(statusMap.values())
         .map(s => ({ ...s, pendentes: s.entregues - s.recebidos })) 
         .filter(s => s.entregues > 0 || s.recebidos > 0 || s.pendentes !== 0) 
         .sort((a, b) => b.pendentes - a.pendentes || a.nome.localeCompare(b.nome)); 

    // Ponto 3: Aplicar filtro de saldo
    if (currentFilter === 'devendo') {
        statusArray = statusArray.filter(s => s.pendentes > 0);
    } else if (currentFilter === 'credito') {
        statusArray = statusArray.filter(s => s.pendentes < 0);
    } else if (currentFilter === 'zero') {
        statusArray = statusArray.filter(s => s.pendentes === 0);
    }

    if (statusArray.length === 0) { 
        tableStatusAgua.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500">Nenhuma movimentação registrada.</td></tr>'; 
        return; 
    }
    tableStatusAgua.innerHTML = statusArray.map(s => {
        const saldo = s.pendentes;
        let saldoText = '';
        let saldoClass = '';
        
        // Ponto 3: Texto mais claro para saldo
        if (saldo > 0) {
            saldoText = `${saldo} (Vazio na Unidade)`;
            saldoClass = 'text-red-600 font-extrabold';
        } else if (saldo < 0) {
            saldoText = `${Math.abs(saldo)} (Crédito na Sec.)`;
            saldoClass = 'text-green-600 font-extrabold';
        } else {
            saldoText = 'Zerado';
            saldoClass = 'text-gray-600';
        }
        
        const ultimoLancamento = s.ultimosLancamentos[0];
        let remocaoBtn = '-';
        let lancamentoDetalhes = 'N/A';
        
        if(ultimoLancamento) {
            const acao = ultimoLancamento.tipo === 'entrega' ? 'Entrega' : (ultimoLancamento.tipo === 'retorno' ? 'Retirada' : 'Troca');
            const dataMovimentacao = formatTimestampComTempo(ultimoLancamento.data); // Ponto 1: Data + Hora
            const respAlmox = ultimoLancamento.respAlmox;
            const respUnidade = ultimoLancamento.respUnidade;
            
            lancamentoDetalhes = `<span class="font-semibold">${acao} (${ultimoLancamento.quantidade} un.):</span> ${dataMovimentacao} (Almox: ${respAlmox} / Unid: ${respUnidade})`;
            
            remocaoBtn = `<button class="btn-danger btn-remove" data-id="${ultimoLancamento.id}" data-type="agua" title="Remover este lançamento"><i data-lucide="trash-2"></i></button>`;
        }
        
        return `
        <tr title="${lancamentoDetalhes.replace(/<[^>]*>?/gm, '')}">
            <td class="font-medium">${s.nome}</td><td>${s.tipo || 'N/A'}</td>
            <td class="text-center">${s.entregues}</td><td class="text-center">${s.recebidos}</td>
            <td class="text-center font-bold ${saldoClass}">${saldoText}</td>
            <td class="space-x-1 whitespace-nowrap text-xs text-gray-600">
                ${lancamentoDetalhes.split(':</span>')[1] || 'N/A'}
            </td>
        </tr>
    `}).join('');
     if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } 

    const filtroStatusAguaEl = document.getElementById('filtro-status-agua');
    if (filtroStatusAguaEl && filtroStatusAguaEl.value) {
        filterTable(filtroStatusAguaEl, 'table-status-agua');
    }
}

// MODIFICADO: renderGasStatus para aplicar o filtro de saldo (Ponto 3)
function renderGasStatus() {
    if (!tableStatusGas) return;
    if (!domReady) { console.warn("renderGasStatus chamada antes do DOM pronto."); return; }
    
    const currentFilter = currentStatusFilter.gas; // Ponto 3

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
             // CORREÇÃO PONTO 3: Inclui movimentações de TROCA no cálculo de entregues E recebidos
             if (m.tipo === 'entrega' || m.tipo === 'troca') unidadeStatus.entregues += m.quantidade;
             else if (m.tipo === 'retorno') unidadeStatus.recebidos += m.quantidade;
              // Armazena todos os lançamentos (melhor para o futuro, mas usa só o último)
             unidadeStatus.ultimosLancamentos.push({
                 id: m.id, 
                 respUnidade: m.responsavel, 
                 respAlmox: m.responsavelAlmoxarifado || 'N/A', 
                 data: m.data, 
                 registradoEm: m.registradoEm, // NOVO: Data do lançamento
                 tipo: m.tipo, 
                 quantidade: m.quantidade
            });
         }
     });

     let statusArray = Array.from(statusMap.values())
         .map(s => ({ ...s, pendentes: s.entregues - s.recebidos }))
         .filter(s => s.entregues > 0 || s.recebidos > 0 || s.pendentes !== 0) 
         .sort((a, b) => b.pendentes - a.pendentes || a.nome.localeCompare(b.nome));
         
    // Ponto 3: Aplicar filtro de saldo
    if (currentFilter === 'devendo') {
        statusArray = statusArray.filter(s => s.pendentes > 0);
    } else if (currentFilter === 'credito') {
        statusArray = statusArray.filter(s => s.pendentes < 0);
    } else if (currentFilter === 'zero') {
        statusArray = statusArray.filter(s => s.pendentes === 0);
    }

    if (statusArray.length === 0) { 
        tableStatusGas.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500">Nenhuma movimentação registrada.</td></tr>'; 
        return; 
    }
     tableStatusGas.innerHTML = statusArray.map(s => {
        const saldo = s.pendentes;
        let saldoText = '';
        let saldoClass = '';
        
        // Ponto 3: Texto mais claro para saldo
        if (saldo > 0) {
            saldoText = `${saldo} (Vazio na Unidade)`;
            saldoClass = 'text-red-600 font-extrabold';
        } else if (saldo < 0) {
            saldoText = `${Math.abs(saldo)} (Crédito na Sec.)`;
            saldoClass = 'text-green-600 font-extrabold';
        } else {
            saldoText = 'Zerado';
            saldoClass = 'text-gray-600';
        }
        
        const ultimoLancamento = s.ultimosLancamentos[0];
        let remocaoBtn = '-';
        let lancamentoDetalhes = 'N/A';
        
        if(ultimoLancamento) {
            const acao = ultimoLancamento.tipo === 'entrega' ? 'Entrega' : (ultimoLancamento.tipo === 'retorno' ? 'Retirada' : 'Troca');
            const dataMovimentacao = formatTimestampComTempo(ultimoLancamento.data); // Ponto 1: Data + Hora
            const respAlmox = ultimoLancamento.respAlmox;
            const respUnidade = ultimoLancamento.respUnidade;
            
            lancamentoDetalhes = `<span class="font-semibold">${acao} (${ultimoLancamento.quantidade} un.):</span> ${dataMovimentacao} (Almox: ${respAlmox} / Unid: ${respUnidade})`;
            
            remocaoBtn = `<button class="btn-danger btn-remove" data-id="${ultimoLancamento.id}" data-type="gas" title="Remover este lançamento"><i data-lucide="trash-2"></i></button>`;
        }
        
        return `
        <tr title="${lancamentoDetalhes.replace(/<[^>]*>?/gm, '')}">
            <td class="font-medium">${s.nome}</td><td>${s.tipo || 'N/A'}</td>
            <td class="text-center">${s.entregues}</td><td class="text-center">${s.recebidos}</td>
            <td class="text-center font-bold ${saldoClass}">${saldoText}</td>
            <td class="space-x-1 whitespace-nowrap text-xs text-gray-600">
                ${lancamentoDetalhes.split(':</span>')[1] || 'N/A'}
            </td>
        </tr>
    `}).join('');
     if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } 

    const filtroStatusGasEl = document.getElementById('filtro-status-gas');
    if (filtroStatusGasEl && filtroStatusGasEl.value) {
        filterTable(filtroStatusGasEl, 'table-status-gas');
    }
}

// NOVO: Função para renderizar o Histórico Geral de Movimentações (Ponto 3)
function renderMovimentacoesHistory(itemType) {
    if (!domReady) return;
    const tableBody = itemType === 'agua' ? tableHistoricoAguaAll : tableHistoricoGasAll;
    const movimentacoes = itemType === 'agua' ? fb_agua_movimentacoes : fb_gas_movimentacoes;
    const alertId = itemType === 'agua' ? 'alert-historico-agua' : 'alert-historico-gas';

    if (!tableBody) return;

    // Filtra e ordena por data de lançamento (registradoEm) decrescente
    const historicoOrdenado = [...movimentacoes]
        .filter(m => m.tipo === 'entrega' || m.tipo === 'retorno' || m.tipo === 'troca')
        .sort((a, b) => (b.registradoEm?.toMillis() || 0) - (a.registradoEm?.toMillis() || 0));

    if (historicoOrdenado.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-slate-500">Nenhuma movimentação de unidade registrada.</td></tr>`;
        return;
    }
    
    // CORREÇÃO DE ERRO: Removendo o template literal longo e usando concatenação de strings
    // para evitar o erro "unescaped line break"
    let html = '';
    
    historicoOrdenado.forEach(m => {
        const isEntrega = m.tipo === 'entrega';
        const isRetorno = m.tipo === 'retorno';
        const isTroca = m.tipo === 'troca';
        
        let tipoClass = 'badge-gray';
        let tipoText = 'N/A';
        
        if (isEntrega) { tipoClass = 'badge-red'; tipoText = 'Entrega'; }
        else if (isRetorno) { tipoClass = 'badge-green'; tipoText = 'Retirada'; }
        else if (isTroca) { tipoClass = 'badge-blue'; tipoText = 'Troca'; }
        
        // Ponto 1: Data e Hora da Movimentação (Entrega/Retirada)
        const dataMov = formatTimestampComTempo(m.data);
        // Ponto 1: Data e Hora do Lançamento
        const dataLancamento = formatTimestampComTempo(m.registradoEm);
        // Ponto 3: Responsáveis
        const respAlmox = m.responsavelAlmoxarifado || 'N/A';
        const respUnidade = m.responsavel || 'N/A';

        html += '<tr title="Lançado por: ' + respAlmox + '">';
        html += '<td>' + (m.unidadeNome || 'N/A') + '</td>';
        html += '<td><span class="badge ' + tipoClass + '">' + tipoText + '</span></td>';
        html += '<td class="text-center font-medium">' + m.quantidade + '</td>';
        html += '<td class="whitespace-nowrap">' + dataMov + '</td>';
        html += '<td>' + respAlmox + '</td>';
        html += '<td>' + respUnidade + '</td>';
        html += '<td class="text-center whitespace-nowrap text-xs">' + dataLancamento + '</td>';
        html += '<td class="text-center">';
        html += '    <button class="btn-icon btn-remove text-red-600 hover:text-red-800" data-id="' + m.id + '" data-type="' + itemType + '" title="Remover este lançamento"><i data-lucide="trash-2"></i></button>';
        html += '</td>';
        html += '</tr>';
    });

    tableBody.innerHTML = html;
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); }

    const filtroEl = document.getElementById(`filtro-historico-${itemType}`);
    if (filtroEl && filtroEl.value) { filterTable(filtroEl, tableBody.id); }
}

function renderAguaMovimentacoesHistory() { renderMovimentacoesHistory('agua'); }
function renderGasMovimentacoesHistory() { renderMovimentacoesHistory('gas'); }

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
    if (tipoMovimentacao === 'troca' && (qtdEntregue <= 0 || qtdRetorno <= 0)) {
         showAlert('alert-gas', 'Para "Troca", a quantidade entregue e recebida deve ser maior que zero.', 'warning'); return;
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
    }
    
    // CORREÇÃO 2: Vai para o modal para capturar o nome do almoxarifado em QUALQUER movimentação
    
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
    const modalBody = almoxarifadoResponsavelModal.querySelector('.modal-body p');
    const btnConfirm = document.getElementById('btn-salvar-movimentacao-final');
    
    if (tipoMovimentacao === 'entrega' || (tipoMovimentacao === 'troca' && qtdEntregue > 0)) {
         modalBody.innerHTML = `Informe seu nome (Responsável do Almoxarifado) para registrar quem está realizando a **entrega** de **${qtdEntregue}** botijão(ões) cheio(s). Esta informação é crucial para o rastreio.`;
         btnConfirm.innerHTML = `<i data-lucide="package-open"></i> Confirmar Entrega`;
    } else if (tipoMovimentacao === 'retorno' || (tipoMovimentacao === 'troca' && qtdRetorno > 0)) {
         modalBody.innerHTML = `Informe seu nome (Responsável do Almoxarifado) para registrar quem está realizando o **recebimento** de **${qtdRetorno}** botijão(ões) vazio(s). Esta informação é crucial para o rastreio.`;
         btnConfirm.innerHTML = `<i data-lucide="package-check"></i> Confirmar Recebimento`;
    } else {
        // Nunca deve acontecer com as validações acima, mas por segurança.
        modalBody.innerHTML = `Informe seu nome (Responsável do Almoxarifado) para finalizar a movimentação.`;
        btnConfirm.innerHTML = `<i data-lucide="save"></i> Confirmar Movimentação`;
    }

    if (modalTitle) modalTitle.innerHTML = `<i data-lucide="box" class="w-5 h-5"></i> Confirmação de Movimentação (Gás)`;
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } 

    almoxarifadoResponsavelModal.style.display = 'flex';
    document.getElementById('input-almox-responsavel-nome').focus();
    showAlert('alert-gas', 'Quase lá! Agora informe seu nome no pop-up para finalizar.', 'info');
    return;
}

// ... (Implementação de todas as funções de Previsão que estavam faltando) ...

// ===================================================================================
// LÓGICA DE PREVISÃO (Incorporada de previsao.js)
// ===================================================================================

function getConsumoDiarioMedio(itemType, filterConfig = {}) {
    const movimentacoes = itemType === 'agua' ? fb_agua_movimentacoes : fb_gas_movimentacoes;
    
    // 1. Filtro por período (últimos 30 dias para cálculo)
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const movsNoPeriodo = movimentacoes.filter(m => {
        if (!m.data || typeof m.data.toDate !== 'function') return false;
        const mTimestamp = m.data.toMillis();
        return mTimestamp >= thirtyDaysAgo.getTime() && mTimestamp <= today.getTime();
    });

    // 2. Filtrar por unidade/tipo e excluir unidades
    let movsFiltradas = movsNoPeriodo.filter(m => {
        // Apenas entregas e trocas contam como consumo (saída de estoque)
        if (m.tipo !== 'entrega' && m.tipo !== 'troca') return false;

        // Se o modo é Unidade Específica, verifica ID
        if (filterConfig.modo === 'unidade-especifica' && filterConfig.unidadeId && m.unidadeId !== filterConfig.unidadeId) {
            return false;
        }

        // Se o modo é Por Tipo, verifica Tipo
        if (filterConfig.modo === 'por-tipo' && filterConfig.tipo && m.tipoUnidade !== filterConfig.tipo) {
            return false;
        }

        // Exclui unidades explicitamente listadas
        if (filterConfig.exclusoes && filterConfig.exclusoes.includes(m.unidadeId)) {
            return false;
        }
        
        return true;
    });

    // 3. Calcular consumo total
    const consumoTotal = movsFiltradas.reduce((sum, m) => sum + m.quantidade, 0);
    
    // 4. Calcular consumo médio
    const dias = 30;
    const consumoMedioDiario = consumoTotal / dias;

    return { consumoTotal, consumoMedioDiario, dias };
}

function getPrevisaoChartData(itemType, consumoDiarioMedio, diasPrevisao) {
    const dataPontos = [];
    let diaAtual = 0;
    let consumoAcumulado = 0;

    for (let i = 0; i <= diasPrevisao; i++) {
        consumoAcumulado = i * consumoDiarioMedio;
        dataPontos.push({ x: `Dia ${i}`, y: Math.round(consumoAcumulado) });
    }

    // Configuração do gráfico
    return {
        labels: dataPontos.map(p => p.x),
        datasets: [
            {
                label: `Consumo Acumulado (${itemType === 'agua' ? 'Galões' : 'Botijões'})`,
                data: dataPontos.map(p => p.y),
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderColor: itemType === 'agua' ? '#38bdf8' : '#fb923c', // sky-400 / orange-400
                borderWidth: 3,
                pointRadius: 5,
                fill: false,
                tension: 0.3
            }
        ]
    };
}

function renderPrevisaoChart(itemType, data) {
    const ctx = document.getElementById(`grafico-previsao-${itemType}`)?.getContext('2d');
    if (!ctx) return;

    if (graficoPrevisao[itemType]) {
        graficoPrevisao[itemType].data = data;
        graficoPrevisao[itemType].update();
    } else {
        graficoPrevisao[itemType] = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Dias de Previsão' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Consumo (Unidades)' },
                        ticks: { precision: 0 }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

function selecionarModoPrevisao(itemType, modo) {
    modoPrevisao[itemType] = modo;
    
    // Atualiza o estado visual
    document.querySelectorAll(`#config-previsao-${itemType} .previsao-option-card`).forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.modo === modo) {
            card.classList.add('selected');
        }
    });

    // Mostra/Esconde containers de seleção
    const unidadeContainer = document.getElementById(`select-unidade-container-${itemType}`);
    const tipoContainer = document.getElementById(`select-tipo-container-${itemType}`);
    const configContainer = document.getElementById(`config-previsao-${itemType}`);
    
    if (unidadeContainer) unidadeContainer.classList.add('hidden');
    if (tipoContainer) tipoContainer.classList.add('hidden');
    
    if (modo === 'unidade-especifica') {
        if (unidadeContainer) unidadeContainer.classList.remove('hidden');
    } else if (modo === 'por-tipo') {
        if (tipoContainer) tipoContainer.classList.remove('hidden');
    }
    
    // Sempre mostra o container de configuração
    if (configContainer) configContainer.classList.remove('hidden');
    
    // Limpa exclusões, pois elas são específicas para o modo completo/tipo
    listaExclusoes[itemType] = [];
    renderExclusoes(itemType);
    
    // Esconde o resultado anterior
    document.getElementById(`resultado-previsao-${itemType}-v2`)?.classList.add('hidden');
}

function adicionarExclusao(itemType) {
    const selectEl = document.getElementById(`select-exclusao-${itemType}`);
    if (!selectEl) return;
    
    const unidadeId = selectEl.value;
    const unidadeNome = selectEl.options[selectEl.selectedIndex].text;
    
    if (unidadeId && unidadeId !== '' && !listaExclusoes[itemType].some(e => e.id === unidadeId)) {
        listaExclusoes[itemType].push({ id: unidadeId, nome: unidadeNome });
        renderExclusoes(itemType);
    }
}

function removerExclusao(itemType, id) {
    listaExclusoes[itemType] = listaExclusoes[itemType].filter(e => e.id !== id);
    renderExclusoes(itemType);
}

function renderExclusoes(itemType) {
    const listaEl = document.getElementById(`lista-exclusoes-${itemType}`);
    if (!listaEl) return;
    
    listaEl.innerHTML = listaExclusoes[itemType].map(e => `
        <span class="exclusao-item">
            ${e.nome} 
            <button onclick="removerExclusao('${itemType}', '${e.id}')">&times;</button>
        </span>
    `).join('');
}

async function calcularPrevisaoInteligente(itemType) {
    const btn = document.getElementById(`btn-calcular-previsao-${itemType}-v2`);
    if (!btn || !domReady || !modoPrevisao[itemType]) return;

    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner-small inline-block" style="width:1em; height:1em;"></div> Calculando...';

    const diasPrevisao = parseInt(document.getElementById(`dias-previsao-${itemType}`)?.value, 10) || 7;
    const margemSeguranca = parseInt(document.getElementById(`margem-seguranca-${itemType}`)?.value, 10) || 15;
    const itemLabel = itemType === 'agua' ? 'galão' : 'botijão';

    let unidadeId = null;
    let unidadeNome = 'Todas as Unidades';
    let tipoUnidade = null;
    let exclusoes = listaExclusoes[itemType].map(e => e.id);
    
    // Coleta filtros específicos do modo
    if (modoPrevisao[itemType] === 'unidade-especifica') {
        const selectUnidade = document.getElementById(`select-previsao-unidade-${itemType}-v2`);
        unidadeId = selectUnidade?.value;
        unidadeNome = selectUnidade?.options[selectUnidade.selectedIndex]?.text || 'Unidade Inválida';
        if (!unidadeId) {
            showAlert(`alertas-previsao-${itemType}`, 'Selecione a unidade para a previsão específica.', 'warning');
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="calculator"></i> Calcular Previsão';
            if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); }
            return;
        }
    } else if (modoPrevisao[itemType] === 'por-tipo') {
        const selectTipo = document.getElementById(`select-previsao-tipo-${itemType}`);
        tipoUnidade = selectTipo?.value;
        if (!tipoUnidade) {
            showAlert(`alertas-previsao-${itemType}`, 'Selecione o tipo de unidade para a previsão por tipo.', 'warning');
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="calculator"></i> Calcular Previsão';
            if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); }
            return;
        }
        unidadeNome = `Unidades do Tipo: ${tipoUnidade}`;
    }

    const filterConfig = {
        modo: modoPrevisao[itemType],
        unidadeId: unidadeId,
        tipo: tipoUnidade,
        exclusoes: exclusoes
    };

    // 1. Calcular consumo médio
    const { consumoTotal, consumoMedioDiario, dias } = getConsumoDiarioMedio(itemType, filterConfig);
    
    if (consumoTotal === 0) {
        showAlert(`alertas-previsao-${itemType}`, 'Não há dados de consumo para os últimos 30 dias com os filtros selecionados.', 'info');
        document.getElementById(`resultado-previsao-${itemType}-v2`)?.classList.add('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="calculator"></i> Calcular Previsão';
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); }
        return;
    }
    
    // 2. Calcular Previsão
    const previsaoSemMargem = consumoMedioDiario * diasPrevisao;
    const consumoMargem = previsaoSemMargem * (margemSeguranca / 100);
    const previsaoFinal = previsaoSemMargem + consumoMargem;

    // 3. Preparar resultados para o DOM
    const resultadosHtml = `
        <p class="text-sm">Previsão para: <strong>${unidadeNome}</strong></p>
        <div class="mt-4 grid grid-cols-2 gap-4 text-center">
            <div class="bg-blue-800 p-3 rounded-lg">
                <p class="text-xs font-medium opacity-80">Consumo Total (30 Dias)</p>
                <p class="text-3xl font-extrabold">${consumoTotal}</p>
                <p class="text-xs font-medium opacity-80">${itemLabel}(ões)</p>
            </div>
            <div class="bg-blue-800 p-3 rounded-lg">
                <p class="text-xs font-medium opacity-80">Consumo Médio Diário</p>
                <p class="text-3xl font-extrabold">${consumoMedioDiario.toFixed(2)}</p>
                <p class="text-xs font-medium opacity-80">${itemLabel}(ões) / dia</p>
            </div>
        </div>
        <div class="bg-blue-700 p-4 rounded-lg mt-4 text-center">
            <p class="text-sm font-medium">Previsão de Necessidade (Próximos ${diasPrevisao} dias):</p>
            <p class="text-5xl font-extrabold mt-1">${Math.ceil(previsaoFinal)}</p>
            <p class="text-xs font-medium opacity-80 mt-1">${itemLabel}(ões) - (Inclui ${margemSeguranca}% de Margem de Segurança)</p>
        </div>
    `;

    // 4. Renderizar o gráfico
    const chartData = getPrevisaoChartData(itemType, consumoMedioDiario, diasPrevisao);
    renderPrevisaoChart(itemType, chartData);

    // 5. Atualizar UI
    document.getElementById(`resultado-content-${itemType}`)?.innerHTML = resultadosHtml;
    document.getElementById(`resultado-previsao-${itemType}-v2`)?.classList.remove('hidden');
    showAlert(`alertas-previsao-${itemType}`, 'Cálculo de previsão concluído com sucesso.', 'success');

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="calculator"></i> Calcular Previsão';
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); }
}

// ===================================================================================
// FIM DA LÓGICA DE PREVISÃO
// ===================================================================================


// --- LÓGICA DE CONTROLE DE MATERIAIS ---
// (as funções de materiais já estão acima e corrigidas para o Ponto 1)

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
        // CORREÇÃO PONTO 2: Garante a subview correta
        switchSubTabView('agua', 'movimentacao-agua'); 
        switchEstoqueForm('saida-agua'); 
        toggleAguaFormInputs(); 
        renderEstoqueAgua(); 
        renderAguaMovimentacoesHistory(); 
        // NOVO: Adiciona listener para a seleção de unidade
        if(selectUnidadeAgua) selectUnidadeAgua.addEventListener('change', () => checkUnidadeSaldoAlert('agua'));
        checkUnidadeSaldoAlert('agua');
    }
    if (tabName === 'gas') { 
         // CORREÇÃO PONTO 2: Garante a subview correta
        switchSubTabView('gas', 'movimentacao-gas'); 
        switchEstoqueForm('saida-gas'); 
        toggleGasFormInputs(); 
        renderEstoqueGas(); 
        renderGasMovimentacoesHistory(); 
        // NOVO: Adiciona listener para a seleção de unidade
        if(selectUnidadeGas) selectUnidadeGas.addEventListener('change', () => checkUnidadeSaldoAlert('gas'));
        checkUnidadeSaldoAlert('gas');
    }
    
    if (tabName === 'materiais') {
        // NOVO: Default para Registrar Requisição
        switchSubTabView('materiais', 'lancar-materiais'); 
        renderMateriaisStatus(); // Re-renderiza para atualizar os summaries e as tabelas dos subviews
        if (initialMaterialFilter) {
            setTimeout(() => {
                const filtroInput = document.getElementById('filtro-historico-entregues');
                if (filtroInput) {
                    filtroInput.value = initialMaterialFilter;
                    filtroInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                initialMaterialFilter = null;
            }, 100);
        }
    }
    
    // Chamadas para re-inicializar Previsão ao entrar na aba
    if (tabName === 'agua' || tabName === 'gas') {
        const itemType = tabName;
        // Reinicializa o modo, se necessário (para evitar que fique no modo "unidade-especifica" de outra aba)
        const currentSubView = document.querySelector(`#content-${itemType} > div:not(.hidden)`)?.id;
        if (currentSubView && currentSubView.includes('previsao')) {
             if (!modoPrevisao[itemType]) {
                  // Define um modo padrão se não houver nenhum
                 selecionarModoPrevisao(itemType, 'completo');
             } else {
                 // Reativa os cards visuais e a configuração correta
                 selecionarModoPrevisao(itemType, modoPrevisao[itemType]);
             }
        }
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
    formMateriais = document.getElementById('form-materiais'); selectUnidadeMateriais = document.getElementById('select-unidade-materiais'); selectTipoMateriais = document.getElementById('select-tipo-materiais'); inputDataSeparacao = document.getElementById('input-data-separacao'); textareaItensMateriais = document.getElementById('textarea-itens-materiais'); inputResponsavelMateriais = document.getElementById('input-responsavel-materiais'); inputArquivoMateriais = document.getElementById('input-arquivo-materiais'); btnSubmitMateriais = document.getElementById('btn-submit-materiais'); alertMateriais = document.getElementById('alert-materiais');
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
    // NOVO: Busca elementos do modal de finalização de materiais
    finalizarEntregaModal = document.getElementById('finalizar-entrega-modal');
    inputEntregaResponsavelAlmox = document.getElementById('input-entrega-responsavel-almox');
    inputEntregaResponsavelUnidade = document.getElementById('input-entrega-responsavel-unidade');
    btnConfirmarFinalizacaoEntrega = document.getElementById('btn-confirmar-finalizacao-entrega');
    finalizarEntregaMaterialIdEl = document.getElementById('finalizar-entrega-material-id');
    alertFinalizarEntrega = document.getElementById('alert-finalizar-entrega');
    // NOVO: Busca as tabelas de workflow de materiais
    tableParaSeparar = document.getElementById('table-para-separar');
    tableEmSeparacao = document.getElementById('table-em-separacao');
    tableProntoEntrega = document.getElementById('table-pronto-entrega');
    tableHistoricoEntregues = document.getElementById('table-historico-entregues');
    summaryMateriaisRequisitado = document.getElementById('summary-materiais-requisitado');
    summaryMateriaisSeparacao = document.getElementById('summary-materiais-separacao');
    summaryMateriaisRetirada = document.getElementById('summary-materiais-retirada');
    // NOVO: Busca as tabelas de histórico geral
    tableHistoricoAguaAll = document.getElementById('table-historico-agua-all');
    tableHistoricoGasAll = document.getElementById('table-historico-gas-all');
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
    estoqueGasInicialEl = document.getElementById('estoque-gas-inicial'); estoqueGasEntradasEl = document.getElementById('estoque-gas-entradas'); estoqueGasSaidasEl = document.getElementById('estoque-gas-saidas'); estoqueGasAtualEl = document.getElementById('estoque-gas-atual'); loadingEstoqueGasEl = document.getElementById('loading-estoque-gas'); resumoEstoqueGasEl = document.getElementById('resumo-estoque-gas');
    formEntradaGas = document.getElementById('form-entrada-gas'); inputDataEntradaGas = document.getElementById('input-data-entrada-gas'); btnSubmitEntradaGas = document.getElementById('btn-submit-entrada-gas');
    formInicialGasContainer = document.getElementById('form-inicial-gas-container'); formInicialGas = document.getElementById('form-inicial-gas'); inputInicialQtdGas = document.getElementById('input-inicial-qtd-gas'); inputInicialResponsavelGas = document.getElementById('input-inicial-responsavel-gas'); btnSubmitInicialGas = document.getElementById('btn-submit-inicial-gas'); alertInicialGas = document.getElementById('alert-inicial-gas'); btnAbrirInicialGas = document.getElementById('btn-abrir-inicial-gas');

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
    // CORREÇÃO PONTO 2: Adiciona listeners para as sub-abas de água/gás/materiais
    document.querySelectorAll('#sub-nav-materiais .sub-nav-btn').forEach(btn => btn.addEventListener('click', () => switchSubTabView('materiais', btn.dataset.subview)));
    document.querySelectorAll('#sub-nav-agua .sub-nav-btn').forEach(btn => btn.addEventListener('click', () => switchSubTabView('agua', btn.dataset.subview)));
    document.querySelectorAll('#sub-nav-gas .sub-nav-btn').forEach(btn => btn.addEventListener('click', () => switchSubTabView('gas', btn.dataset.subview)));
    
    if (dashboardNavControls) dashboardNavControls.addEventListener('click', (e) => { const btn = e.target.closest('button.dashboard-nav-btn[data-view]'); if (btn) switchDashboardView(btn.dataset.view); });
    if (formAgua) formAgua.addEventListener('submit', handleAguaSubmit); 
    if (formGas) formGas.addEventListener('submit', handleGasSubmit); 
    if (formMateriais) formMateriais.addEventListener('submit', handleMateriaisSubmit); 
    if (selectTipoAgua) selectTipoAgua.addEventListener('change', toggleAguaFormInputs);
    if (selectTipoGas) selectTipoGas.addEventListener('change', toggleGasFormInputs);
    
    // NOVO: Listener para o select de unidade (para o alerta de saldo)
    if(selectUnidadeAgua) selectUnidadeAgua.addEventListener('change', () => checkUnidadeSaldoAlert('agua'));
    if(selectUnidadeGas) selectUnidadeGas.addEventListener('change', () => checkUnidadeSaldoAlert('gas'));
    
    // Botões de Estoque Inicial
    if (formInicialAgua) formInicialAgua.addEventListener('submit', handleInicialEstoqueSubmit);
    if (formInicialGas) formInicialGas.addEventListener('submit', handleInicialEstoqueSubmit);
    if (btnAbrirInicialAgua) btnAbrirInicialAgua.addEventListener('click', () => { formInicialAguaContainer?.classList.remove('hidden'); btnAbrirInicialAgua?.classList.add('hidden'); });
    if (btnAbrirInicialGas) btnAbrirInicialGas.addEventListener('click', () => { formInicialGasContainer?.classList.remove('hidden'); btnAbrirInicialGas?.classList.add('hidden'); });
    
    // Formulários de Entrada de Estoque
    if (formEntradaAgua) formEntradaAgua.addEventListener('submit', handleEntradaEstoqueSubmit);
    if (formEntradaGas) formEntradaGas.addEventListener('submit', handleEntradaEstoqueSubmit);
    
    // Botões de sub-aba de Lançamento (Entrada/Saída)
    document.querySelectorAll('.form-tab-btn').forEach(btn => btn.addEventListener('click', (e) => {
        const formName = btn.dataset.form;
        if (formName) switchEstoqueForm(formName);
    }));

    // Eventos de clique centralizados
    document.querySelector('main').addEventListener('click', (e) => {
         const removeBtn = e.target.closest('button.btn-remove[data-id]');
         // O botão "Entregue" agora abre o modal
         const entregueBtn = e.target.closest('button.btn-entregue[data-id]');
         const retiradaBtn = e.target.closest('button.btn-retirada[data-id]');
         // NOVOS: Botões de Iniciar Separação e Download
         const startSeparacaoBtn = e.target.closest('button.btn-start-separacao[data-id]');
         const downloadPedidoBtn = e.target.closest('button.btn-download-pedido[data-id]');

         if (removeBtn) {
             openConfirmDeleteModal(removeBtn.dataset.id, removeBtn.dataset.type, removeBtn.dataset.details);
         } else if (entregueBtn) {
             handleMarcarEntregue(e); // Agora abre o modal para pegar os nomes
         } else if (retiradaBtn) {
             handleMarcarRetirada(e); // Marca como pronto para retirada
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
    // NOVO: Listener para salvar o nome do almoxarifado no modal (Água/Gás)
    if (btnSalvarMovimentacaoFinal) btnSalvarMovimentacaoFinal.addEventListener('click', handleFinalMovimentacaoSubmit);
    // NOVO: Listener para confirmar finalização de materiais
    if (btnConfirmarFinalizacaoEntrega) btnConfirmarFinalizacaoEntrega.addEventListener('click', handleFinalizarEntregaSubmit);
    
    // NOVO: Listeners dos filtros de Busca (já existiam, mas garantindo)
    const filtroStatusAguaEl = document.getElementById('filtro-status-agua');
    if (filtroStatusAguaEl) filtroStatusAguaEl.addEventListener('input', () => filterTable(filtroStatusAguaEl, 'table-status-agua'));
    const filtroHistoricoAguaEl = document.getElementById('filtro-historico-agua');
    if (filtroHistoricoAguaEl) filtroHistoricoAguaEl.addEventListener('input', () => filterTable(filtroHistoricoAguaEl, 'table-historico-agua-all'));
    const filtroStatusGasEl = document.getElementById('filtro-status-gas');
    if (filtroStatusGasEl) filtroStatusGasEl.addEventListener('input', () => filterTable(filtroStatusGasEl, 'table-status-gas'));
    const filtroHistoricoGasEl = document.getElementById('filtro-historico-gas');
    if (filtroHistoricoGasEl) filtroHistoricoGasEl.addEventListener('input', () => filterTable(filtroHistoricoGasEl, 'table-historico-gas-all'));
    const filtroHistoricoEntreguesEl = document.getElementById('filtro-historico-entregues');
    if (filtroHistoricoEntreguesEl) filtroHistoricoEntreguesEl.addEventListener('input', () => filterTable(filtroHistoricoEntreguesEl, 'table-historico-entregues'));
    
    // NOVO: Listeners da Previsão
    document.querySelectorAll('.previsao-option-card').forEach(card => card.addEventListener('click', (e) => {
        const type = card.closest('[id^="subview-previsao-"]').id.includes('agua') ? 'agua' : 'gas';
        selecionarModoPrevisao(type, card.dataset.modo);
    }));
    
}

// Inicia o setup quando o DOM estiver completamente carregado
document.addEventListener('DOMContentLoaded', setupApp);

// --- Inicializa Firebase após o setup do DOM ---
// O initFirebase será chamado no final de setupApp.
// Não, o initFirebase é chamado na Main Thread e só chama os listeners DEPOIS do onAuthStateChanged!
window.onload = initFirebase;
