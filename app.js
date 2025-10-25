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
    // CORREÇÃO: Inclui a lógica de troca para o saldo
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
        // MODIFICADO: Só lança 'retorno' se não for 'troca' E houver retorno
        if (data.qtdRetorno > 0 && data.tipoMovimentacao !== 'troca') { 
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
        btn.classList.remove('active', 'bg-blue-600', 'text-white', 'font-semibold', 'btn-warning', 'btn-info', 'btn-secondary', 'bg-green-600', 'bg-orange-600', 'bg-gray-600', 'bg-red-600');
        
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
             else if (m.tipo === 'retorno' || m.tipo === 'troca') unidadeStatus.recebidos += m.quantidade;
             
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
             else if (m.tipo === 'retorno' || m.tipo === 'troca') unidadeStatus.recebidos += m.quantidade;
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
    document.querySelectorAll(`#content-${itemType} .previsao-option-card`).forEach(card => {
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
    
    // Variáveis que serão atribuídas após a chamada da função
    let consumoResult, consumoTotal, consumoMedioDiario, dias;

    try {
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
                return;
            }
        } else if (modoPrevisao[itemType] === 'por-tipo') {
            const selectTipo = document.getElementById(`select-previsao-tipo-${itemType}`);
            tipoUnidade = selectTipo?.value;
            if (!tipoUnidade) {
                showAlert(`alertas-previsao-${itemType}`, 'Selecione o tipo de unidade para a previsão por tipo.', 'warning');
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

        // CORREÇÃO CRÍTICA DO ERRO DE SINTAXE: Usando desestruturação aqui
        consumoResult = getConsumoDiarioMedio(itemType, filterConfig);
        // Desestruturação correta
        ({ consumoTotal, consumoMedioDiario, dias } = consumoResult); 
        // FIM DA CORREÇÃO CRÍTICA
        
        if (consumoTotal === 0) {
            showAlert(`alertas-previsao-${itemType}`, 'Não há dados de consumo para os últimos 30 dias com os filtros selecionados.', 'info');
            document.getElementById(`resultado-previsao-${itemType}-v2`)?.classList.add('hidden');
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

    } catch (error) {
        console.error("Erro ao calcular previsão:", error);
        showAlert(`alertas-previsao-${itemType}`, `Erro ao calcular previsão: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="calculator"></i> Calcular Previsão';
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); }
    }
}

// ===================================================================================
// FIM DA LÓGICA DE PREVISÃO
// ===================================================================================


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
    const dataSeparacao = inputDataSeparacao.value ? dateToTimestamp(inputDataSeparacao.value) : serverTimestamp(); // Data da requisição (ou now)
    const itens = textareaItensMateriais.value.trim();
    
    const responsavelLancamento = capitalizeString(inputResponsavelMateriais.value.trim()); // <<< NOME ATUALIZADO
    const arquivo = inputArquivoMateriais.files[0];
     
     // ATUALIZADO: Verifica responsavelLancamento
     if (!unidadeId || !tipoMaterial || !responsavelLancamento) {
        showAlert('alert-materiais', 'Dados inválidos. Verifique unidade, tipo e Responsável pelo Lançamento.', 'warning'); return;
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
            responsavelLancamento: responsavelLancamento, // <<< NOME ATUALIZADO (Responsável da Unidade)
            responsavelSeparador: null, // <<< NOVO
            responsavelEntrega: null, // NOVO (Responsável Almoxarifado)
            responsavelRecebimento: null, // NOVO (Responsável Unidade na Retirada)
            registradoEm: serverTimestamp(), // Data do Lançamento
            fileURL: fileURL,
            storagePath: storagePath,
            downloadInfo: { count: 0, lastDownload: null, blockedUntil: null } // <<< NOVO para controle download
        });
        showAlert('alert-materiais', 'Requisição registrada! O status inicial é "Para Separar".', 'success'); // Mensagem atualizada
        formMateriais.reset(); 
        inputDataSeparacao.value = getTodayDateString(); 
    } catch (error) { 
        console.error("Erro salvar requisição:", error); // Atualizado
        showAlert('alert-materiais', `Erro: ${error.message}`, 'error');
    } finally { 
        btnSubmitMateriais.disabled = false; 
        btnSubmitMateriais.textContent = 'Registrar Requisição'; // Atualizado
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); }
    }
}

// NOVO: Função para renderizar os subviews de materiais (Ponto 4)
function renderMateriaisStatus() {
    if (!domReady) return;
    
    // 1. Resumo de Contagem para a tela de Lançamento
    const requisitado = fb_materiais.filter(m => m.status === 'requisitado');
    const separacao = fb_materiais.filter(m => m.status === 'separacao');
    const retirada = fb_materiais.filter(m => m.status === 'retirada');
    const entregue = fb_materiais.filter(m => m.status === 'entregue');
    
    if (summaryMateriaisRequisitado) summaryMateriaisRequisitado.textContent = requisitado.length;
    if (summaryMateriaisSeparacao) summaryMateriaisSeparacao.textContent = separacao.length;
    if (summaryMateriaisRetirada) summaryMateriaisRetirada.textContent = retirada.length;
    if (dashboardMateriaisSeparacaoCountEl) dashboardMateriaisSeparacaoCountEl.textContent = requisitado.length + separacao.length;
    if (dashboardMateriaisRetiradaCountEl) dashboardMateriaisRetiradaCountEl.textContent = retirada.length;

    // 2. Renderizar Sub-tabelas
    
    // 2.1 Para Separar (Status: requisitado)
    renderMaterialSubTable(tableParaSeparar, requisitado, 'requisitado');
    
    // 2.2 Em Separação (Status: separacao)
    renderMaterialSubTable(tableEmSeparacao, separacao, 'separacao');
    
    // 2.3 Pronto p/ Entrega (Status: retirada)
    renderMaterialSubTable(tableProntoEntrega, retirada, 'retirada');
    
    // 2.4 Histórico (Status: entregue)
    renderMaterialSubTable(tableHistoricoEntregues, entregue.sort((a,b) => (b.dataEntrega?.toMillis() || 0) - (a.dataEntrega?.toMillis() || 0)), 'entregue');

}

// NOVO: Função utilitária para renderizar tabelas de materiais
function renderMaterialSubTable(tableBody, data, status) {
     if (!tableBody) return;
    
    if (data.length === 0) {
        let msg = '';
        if (status === 'requisitado') msg = 'Nenhuma requisição pendente de separação.';
        else if (status === 'separacao') msg = 'Nenhuma requisição em separação.';
        else if (status === 'retirada') msg = 'Nenhum material pronto para entrega.';
        else if (status === 'entregue') msg = 'Nenhuma entrega finalizada.';
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-slate-500">' + msg + '</td></tr>';
        return;
    }

    // CORREÇÃO DE ERRO: Removendo o template literal longo e usando concatenação de strings
    // para evitar o erro "unescaped line break"
    let html = '';
    
    data.map(m => {
        let acoesHtml = '';
        let rowContent = '';
        const dataRequisicao = formatTimestamp(m.dataSeparacao);
        const responsavelLancamento = m.responsavelLancamento || 'N/A';
        const separador = m.responsavelSeparador || 'N/A';
        const dataInicioSeparacao = formatTimestampComTempo(m.dataInicioSeparacao);
        
        if (status === 'requisitado') {
            const hasFile = m.fileURL;
            const downloadBtn = hasFile 
                ? '<button class="btn-icon btn-download-pedido text-blue-600 hover:text-blue-800" data-id="' + m.id + '" data-url="' + m.fileURL + '" title="Baixar Pedido"><i data-lucide="download-cloud"></i></button>'
                : '<span class="btn-icon text-gray-400" title="Sem anexo"><i data-lucide="file-x"></i></span>';
            
            acoesHtml = downloadBtn + 
                ' <button class="btn-icon btn-start-separacao text-green-600 hover:text-green-800" data-id="' + m.id + '" title="Informar Separador e Iniciar"><i data-lucide="play-circle"></i></button>' +
                ' <button class="btn-icon btn-remove text-red-600 hover:text-red-800" data-id="' + m.id + '" data-type="materiais" title="Remover Requisição"><i data-lucide="trash-2"></i></button>';
            
            rowContent = '<td>' + m.unidadeNome + '</td>' +
                '<td class="capitalize">' + m.tipoMaterial + '</td>' +
                '<td>' + dataRequisicao + '</td>' +
                '<td>' + responsavelLancamento + '</td>' +
                '<td class="text-center space-x-2">' + acoesHtml + '</td>';
            
        } else if (status === 'separacao') {
             const hasFile = m.fileURL;
             const downloadBtn = hasFile 
                ? '<button class="btn-icon btn-download-pedido text-blue-600 hover:text-blue-800" data-id="' + m.id + '" data-url="' + m.fileURL + '" title="Baixar Pedido"><i data-lucide="download-cloud"></i></button>'
                : '<span class="btn-icon text-gray-400" title="Sem anexo"><i data-lucide="file-x"></i></span>';
            
            // CORREÇÃO PONTO 1: Botão chamativo "Pronto para Entrega"
            acoesHtml = downloadBtn + 
                ' <button class="btn-success btn-retirada text-xs py-2 px-3 bg-green-500 hover:bg-green-600 text-white rounded-md shadow-md" data-id="' + m.id + '" title="Marcar como pronto para entrega">Pronto para Entrega</button>';
            
            rowContent = '<td>' + m.unidadeNome + '</td>' +
                '<td class="capitalize">' + m.tipoMaterial + '</td>' +
                '<td>' + separador + '</td>' +
                '<td class="text-xs">' + dataInicioSeparacao + '</td>' +
                '<td class="text-center space-x-2">' + acoesHtml + '</td>';
            
        } else if (status === 'retirada') {
            // CORREÇÃO PONTO 1: Botão chamativo "Entregue"
            acoesHtml = 
                ' <button class="btn-success btn-entregue text-xs py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-md" data-id="' + m.id + '" title="Finalizar entrega e registrar responsáveis">Entregue</button>';
            
            rowContent = '<td>' + m.unidadeNome + '</td>' +
                '<td class="capitalize">' + m.tipoMaterial + '</td>' +
                '<td>' + separador + '</td>' +
                '<td class="text-xs">' + (formatTimestamp(m.dataRetirada) || 'N/A') + '</td>' +
                '<td class="text-center space-x-2">' + acoesHtml + '</td>';
            
        } else if (status === 'entregue') {
            const dataEntrega = formatTimestamp(m.dataEntrega);
            // Ponto 4: Usa os novos campos de responsável
            const respUnidade = m.responsavelRecebimento || m.responsavelLancamento || 'N/A';
            const respAlmox = m.responsavelEntrega || m.responsavelSeparador || 'N/A';
            const dataLancamento = formatTimestampComTempo(m.registradoEm);

            rowContent = '<td>' + m.unidadeNome + '</td>' +
                '<td class="capitalize">' + m.tipoMaterial + '</td>' +
                '<td>' + dataEntrega + '</td>' +
                '<td>' + respUnidade + '</td>' +
                '<td>' + respAlmox + '</td>' +
                '<td class="text-center text-xs">' + dataLancamento + '</td>' +
                 '<td class="text-center">' +
                    '<button class="btn-icon btn-remove text-red-600 hover:text-red-800" data-id="' + m.id + '" data-type="materiais" title="Remover Requisição"><i data-lucide="trash-2"></i></button>' +
                 '</td>';
        }
        
        // Linha principal
        html += '<tr>' + rowContent + '</tr>';
        
        // Incluir linha de observação se houver
        if (m.itens) {
            html += '<tr class="obs-row ' + (status === 'entregue' ? 'opacity-60' : '') + ' border-b border-slate-200">' +
                '<td colspan="7" class="pt-0 pb-1 px-6 text-xs text-slate-500 whitespace-pre-wrap italic">Obs: ' + m.itens + '</td>' +
                '</tr>';
        }
    });

    tableBody.innerHTML = html;
    
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); }
}

async function handleMarcarRetirada(e) {
    const button = e.target.closest('button.btn-retirada[data-id]');
    if (!button) return; 
    
    const materialId = button.dataset.id;
    if (!isAuthReady || !materialId) return;
    
    button.disabled = true; button.innerHTML = '<div class="loading-spinner-small mx-auto" style="width: 16px; height: 16px; border-width: 2px;"></div>';
    
    try {
        const docRef = doc(materiaisCollection, materialId);
        // Atualiza status e registra dataRetirada
        await updateDoc(docRef, { 
            status: 'retirada', 
            dataRetirada: serverTimestamp() 
        });
        showAlert('alert-em-separacao', 'Material marcado como Pronto para Entrega!', 'success', 3000);
    } catch (error) { 
        console.error("Erro marcar p/ retirada:", error); 
        showAlert('alert-em-separacao', `Erro: ${error.message}`, 'error'); 
        button.disabled = false; 
        button.textContent = 'Pronto para Entrega'; 
    }
}

// MODIFICADO: handleMarcarEntregue para abrir modal de finalização (Ponto 4)
async function handleMarcarEntregue(e) {
    const button = e.target.closest('button.btn-entregue[data-id]');
    if (!button) return; 
    
    const materialId = button.dataset.id;
    if (!isAuthReady || !materialId) return;
    
    const material = fb_materiais.find(m => m.id === materialId);
    if (!material) return;
    
    // Preenche e abre o modal de finalização
    finalizarEntregaMaterialIdEl.value = materialId;
    inputEntregaResponsavelAlmox.value = material.responsavelSeparador || ''; // Sugere o separador como entregador
    inputEntregaResponsavelUnidade.value = material.responsavelLancamento || ''; // Sugere o lançador como recebedor (comum)
    alertFinalizarEntrega.style.display = 'none';

    finalizarEntregaModal.style.display = 'flex';
    inputEntregaResponsavelAlmox.focus();
}

// NOVO: Função para finalizar a entrega do modal (Ponto 4)
async function handleFinalizarEntregaSubmit() {
    if (!isAuthReady || !domReady) return;
    
    const materialId = finalizarEntregaMaterialIdEl.value;
    const respAlmox = capitalizeString(inputEntregaResponsavelAlmox.value.trim());
    const respUnidade = capitalizeString(inputEntregaResponsavelUnidade.value.trim());
    
    if (!respAlmox || !respUnidade) {
        showAlert('alert-finalizar-entrega', 'Informe o responsável pela entrega (Almoxarifado) e quem recebeu (Unidade).', 'warning');
        return;
    }
    
    btnConfirmarFinalizacaoEntrega.disabled = true;
    btnConfirmarFinalizacaoEntrega.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    
    const material = fb_materiais.find(m => m.id === materialId);
    const storagePath = material?.storagePath;
    
    try {
        const docRef = doc(materiaisCollection, materialId);
        await updateDoc(docRef, { 
            status: 'entregue', 
            dataEntrega: serverTimestamp(), // Data da Entrega (Físico)
            responsavelEntrega: respAlmox, // Responsável do Almoxarifado (Entregou)
            responsavelRecebimento: respUnidade, // Responsável da Unidade (Recebeu)
            registradoEm: serverTimestamp() // Data do Lançamento
        });
        showAlert('alert-pronto-entrega', `Material entregue para ${respUnidade}! Processo finalizado.`, 'success', 3000);
        
        // Excluir arquivo do Storage
        if (storagePath) {
            try {
                const fileRef = ref(storage, storagePath);
                await deleteObject(fileRef);
                console.log("Arquivo anexo excluído:", storagePath);
            } catch (error) {
                console.warn("Erro ao excluir arquivo anexo:", error);
                showAlert('alert-pronto-entrega', 'Material entregue, mas houve um erro ao limpar o anexo.', 'warning', 4000);
            }
        }

    } catch (error) { 
        console.error("Erro finalizar entrega:", error); 
        showAlert('alert-finalizar-entrega', `Erro: ${error.message}`, 'error'); 
        showAlert('alert-pronto-entrega', `Erro ao finalizar: ${error.message}`, 'error'); 
    } finally {
        finalizarEntregaModal.style.display = 'none';
        btnConfirmarFinalizacaoEntrega.disabled = false;
        btnConfirmarFinalizacaoEntrega.innerHTML = '<i data-lucide="check-circle"></i> Confirmar Finalização';
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); }
    }
}

// --- NOVAS FUNÇÕES PARA FLUXO DO SEPARADOR (Ponto 4) ---

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
        // Fech

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
        showAlert('alert-materiais', 'Erro: Registro não encontrado.', 'error');
        return;
    }

    const alertId = material.status === 'requisitado' ? 'alert-para-separar' : (material.status === 'separacao' ? 'alert-em-separacao' : 'alert-pronto-entrega');

    const now = Timestamp.now();
    const downloadInfo = material.downloadInfo || { count: 0, lastDownload: null, blockedUntil: null };

    // Verifica se está bloqueado
    if (downloadInfo.blockedUntil && downloadInfo.blockedUntil.toMillis() > now.toMillis()) {
        const blockTimeRemaining = Math.ceil((downloadInfo.blockedUntil.toMillis() - now.toMillis()) / (60 * 1000));
        showAlert(alertId, `Download temporariamente bloqueado. Tente novamente em ${blockTimeRemaining} minuto(s).`, 'warning');
        return;
    }

    // Verifica limite de downloads
    if (downloadInfo.count >= 2) {
        showAlert(alertId, 'Limite de 2 downloads atingido para este pedido.', 'warning');
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
            showAlert(alertId, `Download ${newCount}/2 realizado. Próximo download bloqueado por ${blockDurationMinutes} min.`, 'info', 6000);
        } else {
            showAlert(alertId, `Download ${newCount}/2 realizado.`, 'info', 4000);
        }

        renderMateriaisStatus(); // Atualiza a interface (contador e possível cadeado)

    } catch (error) {
        console.error("Erro ao atualizar contador/bloqueio de download:", error);
        showAlert(alertId, `Erro ao registrar download: ${error.message}`, 'error');
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
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); } 
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
    const row = button.closest('tr');
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
        // CORREÇÃO: Usa a data da movimentação (m.data) para agrupamento
        const mDate = m.data.toDate(); 
        mDate.setHours(0,0,0,0); // Normaliza para início do dia
        const dateKey = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}-${String(mDate.getDate()).padStart(2, '0')}`; 
        if (dataMap.has(dateKey)) { 
            const dayData = dataMap.get(dateKey); 
            // CORREÇÃO PONTO 3: Considera 'entrega' e 'troca' como entregues, 'retorno' e 'troca' como recebidos
            if (m.tipo === 'entrega' || m.tipo === 'troca') dayData.entregas += m.quantidade; 
            else if (m.tipo === 'retorno' || m.tipo === 'troca') dayData.retornos += m.quantidade; 
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
    if (!summaryMateriaisRequisitado || !summaryMateriaisSeparacao || !summaryMateriaisRetirada) return;
    
    // ATUALIZADO: Usando os novos elementos de resumo
    const requisitadoCount = fb_materiais.filter(m => m.status === 'requisitado').length;
    const separacaoCount = fb_materiais.filter(m => m.status === 'separacao').length;
    const retiradaCount = fb_materiais.filter(m => m.status === 'retirada').length;
    
    // Atualiza os cards do Dashboard (topo)
    if (dashboardMateriaisSeparacaoCountEl) dashboardMateriaisSeparacaoCountEl.textContent = requisitadoCount + separacaoCount;
    if (dashboardMateriaisRetiradaCountEl) dashboardMateriaisRetiradaCountEl.textContent = retiradaCount;
    
    // Atualiza os summaries da subview de lançamento de materiais
    if (summaryMateriaisRequisitado) summaryMateriaisRequisitado.textContent = requisitadoCount;
    if (summaryMateriaisSeparacao) summaryMateriaisSeparacao.textContent = separacaoCount;
    if (summaryMateriaisRetirada) summaryMateriaisRetirada.textContent = retiradaCount;
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
        // CORREÇÃO: Usa a data da movimentação (m.data) para filtragem
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
    // CORREÇÃO PONTO 3: Considera 'entrega' e 'troca' como entregues, 'retorno' e 'troca' como recebidos
    const totalEntregueGeral = fb_agua_movimentacoes.filter(m => m.tipo === 'entrega' || m.tipo === 'troca').reduce((sum, m) => sum + m.quantidade, 0);
    const totalRecebidoGeral = fb_agua_movimentacoes.filter(m => m.tipo === 'retorno' || m.tipo === 'troca').reduce((sum, m) => sum + m.quantidade, 0);
    summaryAguaPendente.textContent = totalEntregueGeral - totalRecebidoGeral; 
    
    const movs30Dias = filterLast30Days(fb_agua_movimentacoes);
    const totalEntregue30d = movs30Dias.filter(m => m.tipo === 'entrega' || m.tipo === 'troca').reduce((sum, m) => sum + m.quantidade, 0);
    const totalRecebido30d = movs30Dias.filter(m => m.tipo === 'retorno' || m.tipo === 'troca').reduce((sum, m) => sum + m.quantidade, 0);
    summaryAguaEntregue.textContent = totalEntregue30d;
    summaryAguaRecebido.textContent = totalRecebido30d;
    
    renderDashboardVisaoGeralSummary(); 
}

function renderDashboardGasSummary() {
     if (!domReady) { return; } 
     if (!summaryGasPendente) return; 
    // CORREÇÃO PONTO 3: Considera 'entrega' e 'troca' como entregues, 'retorno' e 'troca' como recebidos
    const totalEntregueGeral = fb_gas_movimentacoes.filter(m => m.tipo === 'entrega' || m.tipo === 'troca').reduce((sum, m) => sum + m.quantidade, 0);
    const totalRecebidoGeral = fb_gas_movimentacoes.filter(m => m.tipo === 'retorno' || m.tipo === 'troca').reduce((sum, m) => sum + m.quantidade, 0);
    summaryGasPendente.textContent = totalEntregueGeral - totalRecebidoGeral; 
    
    const movs30Dias = filterLast30Days(fb_gas_movimentacoes);
    const totalEntregue30d = movs30Dias.filter(m => m.tipo === 'entrega' || m.tipo === 'troca').reduce((sum, m) => sum + m.quantidade, 0);
    const totalRecebido30d = movs30Dias.filter(m => m.tipo === 'retorno' || m.tipo === 'troca').reduce((sum, m) => sum + m.quantidade, 0);
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
// FUNÇÃO renderDashboardMateriaisProntos (SEM MUDANÇAS SIGNIFICATIVAS NO CORE)
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
// FIM DA FUNÇÃO renderDashboardMateriaisProntos
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
        // Filtra pela data da movimentação (data)
        const mData = m.data?.toMillis(); 
        // Inclui entregas e trocas
        return (m.tipo === 'entrega' || m.tipo === 'troca') && mData >= dataInicio && mData <= dataFim; 
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
        const responsavelData = Array.from(responsavelMap.entries()) // CORREÇÃO: Usar responsavelMap
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
            head: [['Relatório de Recebimento por Responsável (Unidade)']], // CORREÇÃO: Título
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
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') { lucide.createIcons(); }
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
        // CORREÇÃO: O alerta deve ir para o painel principal
        alertElementId = visaoAtiva === 'materiais' ? 'alert-materiais' : 'alert-dashboard'; 
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
            data: serverTimestamp(), // Data da entrada (Movimentação/Data)
            responsavel: responsavel, 
            notaFiscal: 'INICIAL', 
            registradoEm: serverTimestamp() // Data do Lançamento
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
            data: data, // Data da entrada (Movimentação/Data)
            responsavel: responsavel, 
            notaFiscal: notaFiscal, 
            registradoEm: serverTimestamp() // Data do Lançamento
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
        if(formInicialAguaContainer) formInicialAguaContainer.classList.add('hidden'); 
        if(resumoEstoqueAguaEl) resumoEstoqueAguaEl.classList.add('hidden'); 
    }

    const estoqueInicial = fb_estoque_agua.filter(e => e.tipo === 'inicial').reduce((sum, e) => sum + e.quantidade, 0);
    const totalEntradas = fb_estoque_agua.filter(e => e.tipo === 'entrada').reduce((sum, e) => sum + e.quantidade, 0);
    // CORREÇÃO PONTO 3: Considera 'entrega' e 'troca' como saídas do estoque
    const totalSaidas = fb_agua_movimentacoes.filter(m => m.tipo === 'entrega' || m.tipo === 'troca').reduce((sum, m) => sum + m.quantidade, 0);
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
        if(formInicialGasContainer) formInicialGasContainer.classList.add('hidden'); 
        if(resumoEstoqueGasEl) resumoEstoqueGasEl.classList.add('hidden'); 
    }

    const estoqueInicial = fb_estoque_gas.filter(e => e.tipo === 'inicial').reduce((sum, e) => sum + e.quantidade, 0);
    const totalEntradas = fb_estoque_gas.filter(e => e.tipo === 'entrada').reduce((sum, e) => sum + e.quantidade, 0);
    // CORREÇÃO PONTO 3: Considera 'entrega' e 'troca' como saídas do estoque
    const totalSaidas = fb_gas_movimentacoes.filter(m => m.tipo === 'entrega' || m.tipo === 'troca').reduce((sum, m) => sum + m.quantidade, 0);
    const estoqueAtual = estoqueInicial + totalEntradas - totalSaidas;

    estoqueGasInicialEl.textContent = estoqueInicial;
    estoqueGasEntradasEl.textContent = `+${totalEntradas}`;
    estoqueGasSaidasEl.textContent = `-${totalSaidas}`;
    estoqueGasAtualEl.textContent = estoqueAtual;
    
    renderDashboardVisaoGeralSummary(); 
}

// REMOVIDO: renderHistoricoAgua e renderHistoricoGas (pois o histórico GERAL agora faz isso. Este era apenas para entradas.)


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
    document.querySelectorAll('#subview-previsao-agua .previsao-option-card').forEach(card => card.addEventListener('click', (e) => {
        selecionarModoPrevisao('agua', card.dataset.modo);
    }));
    document.querySelectorAll('#subview-previsao-gas .previsao-option-card').forEach(card => card.addEventListener('click', (e) => {
        selecionarModoPrevisao('gas', card.dataset.modo);
    }));
    
}

// Inicia o setup quando o DOM estiver completamente carregado
document.addEventListener('DOMContentLoaded', setupApp);

// --- Inicializa Firebase após o setup do DOM ---
// O initFirebase será chamado no final de setupApp.
// Não, o initFirebase é chamado na Main Thread e só chama os listeners DEPOIS do onAuthStateChanged!
window.onload = initFirebase;
