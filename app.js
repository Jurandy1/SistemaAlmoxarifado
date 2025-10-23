// --- IMPORTS DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query, Timestamp, serverTimestamp, setLogLevel, setDoc, getDocs, where, limit, getDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 

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

let app, auth, db, userId;
let isAuthReady = false;
let domReady = false; // <<< NOVA BANDEIRA: Indica se o initApp terminou

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
let initialMaterialFilter = null; // Variável para filtro inicial da aba Materiais
let currentDashboardMaterialFilter = null; // Filtro ativo no dashboard

// --- Referências de Elementos (DOM) - Globais ---
let navButtons, contentPanes, connectionStatusEl, lastUpdateTimeEl;
let dashboardNavControls;
let summaryAguaPendente, summaryAguaEntregue, summaryAguaRecebido;
let summaryGasPendente, summaryGasEntregue, summaryGasRecebido;
// ** RESTAURADO: Variáveis globais para elementos do dashboard de materiais **
let dashboardMateriaisProntosContainer, loadingMateriaisProntos, btnClearDashboardFilter, dashboardMateriaisTitle; 
let dashboardMateriaisListContainer, loadingMateriaisDashboard;
let dashboardEstoqueAguaEl, dashboardEstoqueGasEl, dashboardMateriaisSeparacaoCountEl;
let dashboardMateriaisRetiradaCountEl;
let formAgua, selectUnidadeAgua, selectTipoAgua, inputDataAgua, inputResponsavelAgua, btnSubmitAgua, alertAgua, tableStatusAgua, alertAguaLista;
let inputQtdEntregueAgua, inputQtdRetornoAgua, formGroupQtdEntregueAgua, formGroupQtdRetornoAgua; 
let formGas, selectUnidadeGas, selectTipoGas, inputDataGas, inputResponsavelGas, btnSubmitGas, alertGas, tableStatusGas, alertGasLista;
let inputQtdEntregueGas, inputQtdRetornoGas, formGroupQtdEntregueGas, formGroupQtdRetornoGas; 
let formMateriais, selectUnidadeMateriais, selectTipoMateriais, inputDataSeparacao, textareaItensMateriais, inputResponsavelMateriais, btnSubmitMateriais, alertMateriais, tableStatusMateriais, alertMateriaisLista;
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


// --- FUNÇÕES DE UTILIDADE ---
function showAlert(elementId, message, type = 'info', duration = 5000) {
    const el = document.getElementById(elementId);
    if (!el) { console.warn(`Elemento de alerta não encontrado: ${elementId}`); return; }
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
        auth = getAuth(app);
        
        connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-yellow-400 rounded-full animate-pulse"></span> <span>Autenticando...</span>`;

        onAuthStateChanged(auth, (user) => {
            if (user) {
                isAuthReady = true;
                userId = user.uid;
                console.log("Autenticado com UID:", userId, "Anônimo:", user.isAnonymous);
                connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-green-500 rounded-full"></span> <span class="text-green-700">Conectado</span>`;
                
                const basePath = `artifacts/${appId}/public/data`;
                unidadesCollection = collection(db, `${basePath}/unidades`);
                aguaCollection = collection(db, `${basePath}/controleAgua`);
                gasCollection = collection(db, `${basePath}/controleGas`);
                materiaisCollection = collection(db, `${basePath}/controleMateriais`);
                estoqueAguaCollection = collection(db, `${basePath}/estoqueAgua`);
                estoqueGasCollection = collection(db, `${basePath}/estoqueGas`);
                
                console.log("Caminho base das coleções:", basePath);
                initFirestoreListeners();
                
            } else {
                isAuthReady = false;
                userId = null; 
                console.log("Usuário deslogado.");
                connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-red-500 rounded-full"></span> <span class="text-red-700">Desconectado</span>`;
                clearAlmoxarifadoData();
            }
            updateLastUpdateTime();
        });

        if (initialAuthToken) {
            console.log("Tentando login com Custom Token...");
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            console.log("Nenhum Custom Token encontrado. Tentando login anônimo...");
            await signInAnonymously(auth);
        }

    } catch (error) {
        console.error("Erro ao inicializar Firebase:", error);
        connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-red-500 rounded-full"></span> <span class="text-red-700">Erro Firebase</span>`;
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
        
        populateUnidadeSelects(selectUnidadeAgua, 'atendeAgua');
        populateUnidadeSelects(selectUnidadeGas, 'atendeGas');
        populateUnidadeSelects(selectUnidadeMateriais, 'atendeMateriais');
        populateUnidadeSelects(document.getElementById('select-previsao-unidade-agua-v2'), 'atendeAgua', false); 
        populateUnidadeSelects(document.getElementById('select-previsao-unidade-gas-v2'), 'atendeGas', false); 
        
        populateTipoSelects('agua');
        populateTipoSelects('gas');

        populateUnidadeSelects(document.getElementById('select-exclusao-agua'), 'atendeAgua', false, true, null); 
        populateUnidadeSelects(document.getElementById('select-exclusao-gas'), 'atendeGas', false, true, null); 
        
        renderGestaoUnidades(); 
        renderAguaStatus(); 
        renderGasStatus(); 
        console.log("Unidades atualizadas:", fb_unidades.length);
    }, (error) => { console.error("Erro no listener de unidades:", error); showAlert('alert-gestao', `Erro ao carregar unidades: ${error.message}`, 'error'); });

    onSnapshot(query(aguaCollection), (snapshot) => {
        fb_agua_movimentacoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAguaStatus(); 
        renderDashboardAguaChart(); 
        renderDashboardAguaSummary();
        renderEstoqueAgua();
        console.log("Mov. Água (Saídas) atualizadas:", fb_agua_movimentacoes.length);
    }, (error) => { console.error("Erro no listener de água:", error); showAlert('alert-agua-lista', `Erro ao carregar dados de água: ${error.message}`, 'error'); });

    onSnapshot(query(gasCollection), (snapshot) => {
        fb_gas_movimentacoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderGasStatus(); 
        renderDashboardGasChart(); 
        renderDashboardGasSummary();
        renderEstoqueGas();
        console.log("Mov. Gás (Saídas) atualizadas:", fb_gas_movimentacoes.length);
    }, (error) => { console.error("Erro no listener de gás:", error); showAlert('alert-gas-lista', `Erro ao carregar dados de gás: ${error.message}`, 'error'); });

    onSnapshot(query(materiaisCollection), (snapshot) => {
        fb_materiais = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMateriaisStatus(); 
        renderDashboardMateriaisList();
        renderDashboardMateriaisProntos(currentDashboardMaterialFilter); // Renderiza com o filtro atual
        renderDashboardMateriaisCounts();
        console.log("Materiais atualizados:", fb_materiais.length);
    }, (error) => { console.error("Erro no listener de materiais:", error); showAlert('alert-materiais-lista', `Erro ao carregar materiais: ${error.message}`, 'error'); });

    onSnapshot(query(estoqueAguaCollection), (snapshot) => {
        fb_estoque_agua = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        estoqueInicialDefinido.agua = fb_estoque_agua.some(e => e.tipo === 'inicial');
        renderEstoqueAgua();
        renderHistoricoAgua();
        console.log("Estoque Água (Entradas) atualizado:", fb_estoque_agua.length, "Inicial definido:", estoqueInicialDefinido.agua);
    }, (error) => { console.error("Erro no listener de estoque água:", error); });

    onSnapshot(query(estoqueGasCollection), (snapshot) => {
        fb_estoque_gas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        estoqueInicialDefinido.gas = fb_estoque_gas.some(e => e.tipo === 'inicial');
        renderEstoqueGas();
        renderHistoricoGas();
        console.log("Estoque Gás (Entradas) atualizado:", fb_estoque_gas.length, "Inicial definido:", estoqueInicialDefinido.gas);
    }, (error) => { console.error("Erro no listener de estoque gás:", error); });
}

function clearAlmoxarifadoData() {
    fb_unidades = []; fb_agua_movimentacoes = []; fb_gas_movimentacoes = []; fb_materiais = [];
    fb_estoque_agua = []; fb_estoque_gas = []; 
    estoqueInicialDefinido = { agua: false, gas: false };
    currentDashboardMaterialFilter = null; // Limpa filtro do dashboard

    [selectUnidadeAgua, selectUnidadeGas, selectUnidadeMateriais, 
     document.getElementById('select-previsao-unidade-agua-v2'), 
     document.getElementById('select-previsao-unidade-gas-v2'),
     document.getElementById('select-exclusao-agua'),
     document.getElementById('select-exclusao-gas'),
     document.getElementById('select-previsao-tipo-agua'),
     document.getElementById('select-previsao-tipo-gas')
    ].forEach(sel => { if(sel) sel.innerHTML = '<option value="">Desconectado</option>'; });
    
    [tableStatusAgua, tableStatusGas, tableStatusMateriais, tableGestaoUnidades, tableHistoricoAgua, tableHistoricoGas].forEach(tbody => { if(tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-red-500">Desconectado do Firebase</td></tr>'; });
    
    // Tenta limpar containers do dashboard se existirem
    const dashMateriaisList = document.getElementById('dashboard-materiais-list');
    const dashMateriaisProntos = document.getElementById('dashboard-materiais-prontos');
    if (dashMateriaisList) dashMateriaisList.innerHTML = '<p class="text-center py-4 text-red-500">Desconectado</p>';
    // ** CORREÇÃO: Coloca loader ao limpar por desconexão **
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

    // Usa as variáveis globais que agora são atribuídas em initApp
    if (btnClearDashboardFilter) btnClearDashboardFilter.classList.add('hidden'); 
    if (dashboardMateriaisTitle) dashboardMateriaisTitle.textContent = 'Materiais do Almoxarifado'; 

    console.log("Dados do Almoxarifado limpos devido à desconexão.");
}

function updateLastUpdateTime() {
     if (!lastUpdateTimeEl) return;
    const now = new Date();
    const formattedDate = now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    lastUpdateTimeEl.textContent = `Atualizado: ${formattedDate}`;
}

function populateUnidadeSelects(selectEl, serviceField, includeAll = false, includeSelecione = true, filterType = null) {
    if (!selectEl) return;

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

function populateTipoSelects(itemType) {
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
// ... (código da água inalterado) ...
function toggleAguaFormInputs() {
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

async function handleAguaSubmit(e) {
     e.preventDefault();
    if (!isAuthReady) { showAlert('alert-agua', 'Erro: Não autenticado.', 'error'); return; }
    const selectValue = selectUnidadeAgua.value; 
    if (!selectValue) { showAlert('alert-agua', 'Selecione uma unidade.', 'warning'); return; }
    const [unidadeId, unidadeNome, tipoUnidadeRaw] = selectValue.split('|');
    const tipoUnidade = (tipoUnidadeRaw || '').toUpperCase() === 'SEMCAS' ? 'SEDE' : (tipoUnidadeRaw || '').toUpperCase();

    const tipoMovimentacao = selectTipoAgua.value; 
    const qtdEntregue = parseInt(inputQtdEntregueAgua.value, 10) || 0;
    const qtdRetorno = parseInt(inputQtdRetornoAgua.value, 10) || 0;
    const data = dateToTimestamp(inputDataAgua.value);
    const responsavel = capitalizeString(inputResponsavelAgua.value.trim()); 
    
    if (!unidadeId || !data || !responsavel) {
        showAlert('alert-agua', 'Dados inválidos. Verifique Unidade, Data e Responsável.', 'warning'); return;
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
    if (qtdEntregue > 0) {
        if (!estoqueInicialDefinido.agua) {
            showAlert('alert-agua', 'Defina o Estoque Inicial de Água antes de lançar saídas.', 'warning'); return;
        }
        const estoqueAtual = parseInt(estoqueAguaAtualEl.textContent) || 0;
        if (qtdEntregue > estoqueAtual) {
            showAlert('alert-agua', `Erro: Estoque insuficiente. Disponível: ${estoqueAtual}`, 'error'); return;
        }
    }
    
    btnSubmitAgua.disabled = true; btnSubmitAgua.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    let msgSucesso = [];
    
    try {
        const timestamp = serverTimestamp();
        if (qtdEntregue > 0) {
            await addDoc(aguaCollection, { unidadeId, unidadeNome, tipoUnidade, tipo: 'entrega', quantidade: qtdEntregue, data, responsavel, registradoEm: timestamp });
            msgSucesso.push(`${qtdEntregue} galão(ões) entregue(s)`);
        }
        if (qtdRetorno > 0) {
             await addDoc(aguaCollection, { unidadeId, unidadeNome, tipoUnidade, tipo: 'retorno', quantidade: qtdRetorno, data, responsavel, registradoEm: timestamp });
             msgSucesso.push(`${qtdRetorno} galão(ões) recebido(s)`);
        }
        showAlert('alert-agua', `Movimentação salva! ${msgSucesso.join('; ')}.`, 'success');
        formAgua.reset(); 
        inputDataAgua.value = getTodayDateString(); 
        toggleAguaFormInputs(); 
    } catch (error) { 
        console.error("Erro salvar água:", error); 
        showAlert('alert-agua', `Erro: ${error.message}`, 'error');
    } finally { 
        btnSubmitAgua.disabled = false; 
        btnSubmitAgua.textContent = 'Salvar Movimentação'; 
    }
}

function renderAguaStatus() {
     if (!tableStatusAgua) return;
     // <<< Adicionado cheque domReady >>>
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
             if (unidadeStatus.ultimosLancamentos.length < 1) { 
                 unidadeStatus.ultimosLancamentos.push({id: m.id, resp: m.responsavel, data: formatTimestamp(m.data), tipo: m.tipo});
             }
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
        const tooltipText = s.ultimosLancamentos.map(l => `${l.tipo === 'entrega' ? 'E': 'R'}: ${l.resp} (${l.data})`).join(' | ');
        const ultimoId = s.ultimosLancamentos[0]?.id; 
        const saldo = s.pendentes;
        const saldoText = saldo > 0 ? `Faltando ${saldo}` : (saldo < 0 ? `Crédito ${Math.abs(saldo)}` : 'Zerado');
        const saldoClass = saldo > 0 ? 'text-red-600' : (saldo < 0 ? 'text-blue-600' : 'text-green-600');
        return `
        <tr title="${tooltipText || 'Sem detalhes de responsável'}">
            <td class="font-medium">${s.nome}</td><td>${s.tipo || 'N/A'}</td>
            <td class="text-center">${s.entregues}</td><td class="text-center">${s.recebidos}</td>
            <td class="text-center font-bold ${saldoClass}">${saldoText}</td>
            <td class="text-center">
                ${ultimoId ? `<button class="btn-danger btn-remove" data-id="${ultimoId}" data-type="agua" title="Remover último lançamento desta unidade"><i data-lucide="trash-2"></i></button>` : '-'}
            </td>
        </tr>
    `}).join('');
     lucide.createIcons(); 

    const filtroStatusAguaEl = document.getElementById('filtro-status-agua');
    if (filtroStatusAguaEl && filtroStatusAguaEl.value) {
        filterTable(filtroStatusAguaEl, 'table-status-agua');
    }
}


// --- LÓGICA DE CONTROLE DE GÁS ---
// ... (código do gás inalterado) ...
function toggleGasFormInputs() {
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

async function handleGasSubmit(e) {
    e.preventDefault();
    if (!isAuthReady) { showAlert('alert-gas', 'Erro: Não autenticado.', 'error'); return; }
    const selectValue = selectUnidadeGas.value; 
    if (!selectValue) { showAlert('alert-gas', 'Selecione uma unidade.', 'warning'); return; }
    const [unidadeId, unidadeNome, tipoUnidadeRaw] = selectValue.split('|');
    const tipoUnidade = (tipoUnidadeRaw || '').toUpperCase() === 'SEMCAS' ? 'SEDE' : (tipoUnidadeRaw || '').toUpperCase();

    const tipoMovimentacao = selectTipoGas.value; 
    const qtdEntregue = parseInt(inputQtdEntregueGas.value, 10) || 0;
    const qtdRetorno = parseInt(inputQtdRetornoGas.value, 10) || 0;
    const data = dateToTimestamp(inputDataGas.value);
    const responsavel = capitalizeString(inputResponsavelGas.value.trim()); 
    
     if (!unidadeId || !data || !responsavel) { 
        showAlert('alert-gas', 'Dados inválidos. Verifique Unidade, Data e Responsável.', 'warning'); return;
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
    if (qtdEntregue > 0) {
        if (!estoqueInicialDefinido.gas) {
            showAlert('alert-gas', 'Defina o Estoque Inicial de Gás antes de lançar saídas.', 'warning'); return;
        }
        const estoqueAtual = parseInt(estoqueGasAtualEl.textContent) || 0;
        if (qtdEntregue > estoqueAtual) {
            showAlert('alert-gas', `Erro: Estoque insuficiente. Disponível: ${estoqueAtual}`, 'error'); return;
        }
    }
    
    btnSubmitGas.disabled = true; btnSubmitGas.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    let msgSucesso = [];
    
    try {
        const timestamp = serverTimestamp();
        if (qtdEntregue > 0) {
            await addDoc(gasCollection, { unidadeId, unidadeNome, tipoUnidade, tipo: 'entrega', quantidade: qtdEntregue, data, responsavel, registradoEm: timestamp });
            msgSucesso.push(`${qtdEntregue} botijão(ões) entregue(s)`);
        }
        if (qtdRetorno > 0) {
             await addDoc(gasCollection, { unidadeId, unidadeNome, tipoUnidade, tipo: 'retorno', quantidade: qtdRetorno, data, responsavel, registradoEm: timestamp });
             msgSucesso.push(`${qtdRetorno} botijão(ões) recebido(s)`);
        }
        showAlert('alert-gas', `Movimentação salva! ${msgSucesso.join('; ')}.`, 'success');
        formGas.reset(); 
        inputDataGas.value = getTodayDateString(); 
        toggleGasFormInputs(); 
    } catch (error) { 
        console.error("Erro salvar gás:", error); 
        showAlert('alert-gas', `Erro: ${error.message}`, 'error');
    } finally { 
        btnSubmitGas.disabled = false; 
        btnSubmitGas.textContent = 'Salvar Movimentação'; 
    }
}

function renderGasStatus() {
    if (!tableStatusGas) return;
    // <<< Adicionado cheque domReady >>>
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
             if (unidadeStatus.ultimosLancamentos.length < 1) { 
                 unidadeStatus.ultimosLancamentos.push({id: m.id, resp: m.responsavel, data: formatTimestamp(m.data), tipo: m.tipo});
             }
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
        const tooltipText = s.ultimosLancamentos.map(l => `${l.tipo === 'entrega' ? 'E': 'R'}: ${l.resp} (${l.data})`).join(' | ');
        const ultimoId = s.ultimosLancamentos[0]?.id;
        const saldo = s.pendentes;
        const saldoText = saldo > 0 ? `Faltando ${saldo}` : (saldo < 0 ? `Crédito ${Math.abs(saldo)}` : 'Zerado');
        const saldoClass = saldo > 0 ? 'text-red-600' : (saldo < 0 ? 'text-blue-600' : 'text-green-600');
        return `
        <tr title="${tooltipText || 'Sem detalhes de responsável'}">
            <td class="font-medium">${s.nome}</td><td>${s.tipo || 'N/A'}</td>
            <td class="text-center">${s.entregues}</td><td class="text-center">${s.recebidos}</td>
            <td class="text-center font-bold ${saldoClass}">${saldoText}</td>
             <td class="text-center">
                ${ultimoId ? `<button class="btn-danger btn-remove" data-id="${ultimoId}" data-type="gas" title="Remover último lançamento"><i data-lucide="trash-2"></i></button>` : '-'}
            </td>
        </tr>
    `}).join('');
     lucide.createIcons();

    const filtroStatusGasEl = document.getElementById('filtro-status-gas');
    if (filtroStatusGasEl && filtroStatusGasEl.value) {
        filterTable(filtroStatusGasEl, 'table-status-gas');
    }
}


// --- LÓGICA DE PREVISÃO INTELIGENTE ---
// ... (código da previsão inalterado) ...
window.selecionarModoPrevisao = (tipoItem, modo) => {
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
    const container = document.getElementById(`lista-exclusoes-${tipoItem}`);
    container.innerHTML = listaExclusoes[tipoItem].map((item, index) => `
        <span class="exclusao-item">
            ${item.nome}
            <button type="button" onclick="removerExclusao('${tipoItem}', ${index})">&times;</button>
        </span>
    `).join('');
}

window.removerExclusao = (tipoItem, index) => {
    listaExclusoes[tipoItem].splice(index, 1); 
    renderizarListaExclusoes(tipoItem); 
}

window.calcularPrevisaoInteligente = (tipoItem) => {
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
     lucide.createIcons(); 
}

function renderizarGraficoPrevisao(tipoItem, movsFiltradas) {
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
// ... (código do handleMateriaisSubmit, renderMateriaisStatus, handleMarcarRetirada, handleMarcarEntregue inalterado) ...
async function handleMateriaisSubmit(e) {
    e.preventDefault();
    if (!isAuthReady) { showAlert('alert-materiais', 'Erro: Não autenticado.', 'error'); return; }
    const selectValue = selectUnidadeMateriais.value; 
    if (!selectValue) { showAlert('alert-materiais', 'Selecione uma unidade.', 'warning'); return; }
    const [unidadeId, unidadeNome, tipoUnidadeRaw] = selectValue.split('|');
    const tipoUnidade = (tipoUnidadeRaw || '').toUpperCase() === 'SEMCAS' ? 'SEDE' : (tipoUnidadeRaw || '').toUpperCase();

    const tipoMaterial = selectTipoMateriais.value;
    const dataSeparacao = dateToTimestamp(inputDataSeparacao.value);
    const itens = textareaItensMateriais.value.trim();
    const responsavelSeparacao = capitalizeString(inputResponsavelMateriais.value.trim()); 
     
     if (!unidadeId || !tipoMaterial || !dataSeparacao || !responsavelSeparacao) {
        showAlert('alert-materiais', 'Dados inválidos. Verifique unidade, tipo, data e Responsável (Separação).', 'warning'); return;
    }
    
    btnSubmitMateriais.disabled = true; btnSubmitMateriais.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    
    try {
        await addDoc(materiaisCollection, { 
            unidadeId, unidadeNome, tipoUnidade, tipoMaterial, 
            dataSeparacao, itens, status: 'separacao', 
            dataRetirada: null, 
            dataEntrega: null, responsavelSeparacao, 
            responsavelRetirada: null, 
            responsavelEntrega: null, 
            registradoEm: serverTimestamp() 
        });
        showAlert('alert-materiais', 'Separação registrada!', 'success');
        formMateriais.reset(); 
        inputDataSeparacao.value = getTodayDateString(); 
    } catch (error) { 
        console.error("Erro salvar separação:", error); 
        showAlert('alert-materiais', `Erro: ${error.message}`, 'error');
    } finally { 
        btnSubmitMateriais.disabled = false; 
        btnSubmitMateriais.textContent = 'Registrar Separação'; 
    }
}

function renderMateriaisStatus() {
     if (!tableStatusMateriais) return;
     // <<< Adicionado cheque domReady >>>
     if (!domReady) { console.warn("renderMateriaisStatus chamada antes do DOM pronto."); return; }

    const materiaisOrdenados = [...fb_materiais].sort((a,b) => { 
        const statusOrder = { 'separacao': 1, 'retirada': 2, 'entregue': 3 }; 
        const statusCompare = (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
        if (statusCompare !== 0) return statusCompare;
        const dateA = a.dataEntrega?.toMillis() || a.dataRetirada?.toMillis() || a.dataSeparacao?.toMillis() || 0; 
        const dateB = b.dataEntrega?.toMillis() || b.dataRetirada?.toMillis() || b.dataSeparacao?.toMillis() || 0; 
        return dateB - dateA; 
    });

    if (materiaisOrdenados.length === 0) { 
        tableStatusMateriais.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-500">Nenhuma separação registrada.</td></tr>'; 
        return; 
    }

    tableStatusMateriais.innerHTML = materiaisOrdenados.map(m => {
        let statusClass = '';
        let statusText = '';
        let dataStatusText = '';
        let acoesHtml = '';
        
        const tooltipText = `Separado por: ${m.responsavelSeparacao || 'N/A'}${m.responsavelEntrega ? ' | Entregue por: '+m.responsavelEntrega : ''}`;
        const isEntregue = m.status === 'entregue';
        
        if (m.status === 'separacao') {
            statusClass = 'badge-yellow';
            statusText = 'Em Separação';
            dataStatusText = ''; 
            acoesHtml = `
                <button class="btn-info btn-retirada text-xs py-1 px-2" data-id="${m.id}">Disponível p/ Retirada</button>
            `;
        } else if (m.status === 'retirada') {
            statusClass = 'badge-green';
            statusText = 'Disponível p/ Retirada';
            dataStatusText = m.dataRetirada ? ` (${formatTimestamp(m.dataRetirada)})` : '';
            acoesHtml = `
                <button class="btn-success btn-entregue text-xs py-1 px-2" data-id="${m.id}">Entregue</button>
            `;
        } else {
            statusClass = 'badge-gray';
            statusText = 'Entregue';
            dataStatusText = m.dataEntrega ? ` (${formatTimestamp(m.dataEntrega)})` : '';
            acoesHtml = ''; 
        }
        
        const linhaPrincipal = `
            <tr class="align-top ${isEntregue ? 'opacity-60' : ''}" title="${tooltipText}">
                <td class="font-medium">${m.unidadeNome || 'Unidade Desc.'}</td>
                <td class="capitalize">${m.tipoMaterial || 'N/D'}</td>
                <td>${formatTimestamp(m.dataSeparacao)}</td>
                <td><span class="badge ${statusClass}">${statusText}${dataStatusText}</span></td>
                <td class="text-right space-x-1">
                    ${acoesHtml}
                    <button class="btn-danger btn-remove" data-id="${m.id}" data-type="materiais" title="Remover este registro"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`;
        
        const linhaObservacao = m.itens ? `
            <tr class="obs-row ${isEntregue ? 'opacity-60' : ''} ${m.status === 'separacao' ? 'bg-slate-50' : (m.status === 'retirada' ? 'bg-green-50' : 'bg-gray-50')} border-b-2 border-slate-200">
                <td colspan="5" class="py-2 px-6 text-sm text-slate-600 whitespace-pre-wrap"><strong>Observação:</strong> ${m.itens}</td>
            </tr>` : '';

        return linhaPrincipal + linhaObservacao;
    }).join('');
    lucide.createIcons(); 
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
    const responsavelEntrega = material?.responsavelSeparacao || "Responsável (Retirada)"; 
    
    button.disabled = true; button.innerHTML = '<div class="loading-spinner-small mx-auto" style="width: 16px; height: 16px; border-width: 2px;"></div>';
    
    try {
        const docRef = doc(materiaisCollection, materialId);
        await updateDoc(docRef, { 
            status: 'entregue', 
            dataEntrega: serverTimestamp(), 
            responsavelEntrega: capitalizeString(responsavelEntrega) 
        });
        showAlert('alert-materiais-lista', 'Material marcado como entregue!', 'success', 3000);
    } catch (error) { 
        console.error("Erro marcar entregue:", error); 
        showAlert('alert-materiais-lista', `Erro: ${error.message}`, 'error'); 
        button.disabled = false; 
        button.textContent = 'Entregue'; 
    } 
}


// --- LÓGICA DE GESTÃO DE UNIDADES ---
// ... (código da gestão de unidades inalterado) ...
function renderGestaoUnidades() {
    if (!tableGestaoUnidades) return;
     // <<< Adicionado cheque domReady >>>
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
    lucide.createIcons(); 
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
    lucide.createIcons(); 
    td.querySelector('input').focus(); 
}

function handleCancelEditUnidadeClick(e) {
    const button = e.target.closest('.btn-cancel-edit-unidade');
    if (!button) return;
    
    const td = button.closest('td');
    const row = td.closest('tr');
    const unidadeId = row.dataset.unidadeId;
    const unidade = fb_unidades.find(u => u.id === unidadeId);
    
    td.innerHTML = `
        <span class="unidade-nome-display">${unidade?.nome || 'Erro'}</span> 
        <button class="btn-icon btn-edit-unidade ml-1" title="Editar nome"><i data-lucide="pencil"></i></button>
    `;
    row.classList.remove('editing-row'); 
    lucide.createIcons(); 
}

async function handleSaveUnidadeClick(e) {
    const button = e.target.closest('.btn-save-unidade');
    if (!button) return;
    
    const td = button.closest('td');
    const row = td.closest('tr');
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
        lucide.createIcons(); 
        showAlert('alert-gestao', 'Nome da unidade atualizado!', 'success', 2000);
    
    } catch (error) {
        console.error("Erro ao salvar nome da unidade:", error);
        showAlert('alert-gestao', `Erro ao salvar: ${error.message}`, 'error');
        button.disabled = false;
         if(cancelButton) cancelButton.disabled = false;
        button.innerHTML = '<i data-lucide="save"></i>'; 
        lucide.createIcons();
    }
}

async function handleBulkAddUnidades() {
     if (!isAuthReady || !textareaBulkUnidades) return;
     
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
// ... (código do switchDashboardView, renderDashboardVisaoGeralSummary, renderDashboardMateriaisCounts, filterLast30Days, getChartDataLast30Days, renderDashboardAguaChart, renderDashboardGasChart, renderDashboardAguaSummary, renderDashboardGasSummary, renderDashboardMateriaisList inalterado) ...
function switchDashboardView(viewName) {
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
        filterDashboardMateriais(null); // (ALTERADO) Mostra todos ao mudar para Visão Geral
    }
    if(viewName === 'materiais') renderDashboardMateriaisList();
}

function renderDashboardVisaoGeralSummary() {
    if (!domReady) { return; } // <<< Adicionado cheque domReady >>>
    if (dashboardEstoqueAguaEl) {
        dashboardEstoqueAguaEl.textContent = estoqueAguaAtualEl?.textContent || '0';
    }
    if (dashboardEstoqueGasEl) {
        dashboardEstoqueGasEl.textContent = estoqueGasAtualEl?.textContent || '0';
    }
}

function renderDashboardMateriaisCounts() {
    if (!domReady) { return; } // <<< Adicionado cheque domReady >>>
    if (!dashboardMateriaisSeparacaoCountEl || !dashboardMateriaisRetiradaCountEl) return;
    const separacaoCount = fb_materiais.filter(m => m.status === 'separacao').length;
    const retiradaCount = fb_materiais.filter(m => m.status === 'retirada').length;
    
    dashboardMateriaisSeparacaoCountEl.textContent = separacaoCount;
    dashboardMateriaisRetiradaCountEl.textContent = retiradaCount;
}

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

function renderDashboardAguaChart() {
    if (!domReady) { return; } // <<< Adicionado cheque domReady >>>
    const ctx = document.getElementById('dashboardAguaChart')?.getContext('2d'); if (!ctx) return; 
    const data = getChartDataLast30Days(fb_agua_movimentacoes); 
    if (dashboardAguaChartInstance) { 
        dashboardAguaChartInstance.data = data; 
        dashboardAguaChartInstance.update(); 
    } else { 
        dashboardAguaChartInstance = new Chart(ctx, { type: 'line', data: data, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'top' } } } }); 
    }
}

function renderDashboardGasChart() {
    if (!domReady) { return; } // <<< Adicionado cheque domReady >>>
    const ctx = document.getElementById('dashboardGasChart')?.getContext('2d'); if (!ctx) return; 
    const data = getChartDataLast30Days(fb_gas_movimentacoes); 
    if (dashboardGasChartInstance) { 
        dashboardGasChartInstance.data = data; 
        dashboardGasChartInstance.update(); 
    } else { 
        dashboardGasChartInstance = new Chart(ctx, { type: 'line', data: data, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'top' } } } }); 
    }
}

function renderDashboardAguaSummary() {
    if (!domReady) { return; } // <<< Adicionado cheque domReady >>>
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
     if (!domReady) { return; } // <<< Adicionado cheque domReady >>>
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
     if (!domReady) { console.warn("renderDashboardMateriaisList chamada antes do DOM pronto."); return; } // <<< Adicionado cheque domReady >>>
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


/**
 * Renderiza as colunas de materiais pendentes no dashboard, com opção de filtro por status.
 * @param {string|null} filterStatus - O status para filtrar ('separacao', 'retirada') ou null para mostrar todos.
 */
function renderDashboardMateriaisProntos(filterStatus = null) {
    // <<< Adicionado cheque domReady >>>
    if (!domReady) {
        console.warn("renderDashboardMateriaisProntos chamada antes do DOM estar pronto (domReady=false). Aguardando...");
        return;
    }

    const container = dashboardMateriaisProntosContainer;
    const titleEl = dashboardMateriaisTitle;
    const clearButton = btnClearDashboardFilter;
    const loaderOriginal = loadingMateriaisProntos; 

    // <<< Removido o cheque anterior (!container || !titleEl || !clearButton) pois domReady garante que foram buscados >>>
    
    // Assegura que elementos existam antes de usar (caso o HTML mude)
     if (!container || !titleEl || !clearButton) {
        console.error("Elementos essenciais do Dashboard Materiais Prontos não encontrados!");
        return; 
    }
    
    if (loaderOriginal && loaderOriginal.style.display !== 'none') {
         loaderOriginal.style.display = 'none'; 
    }
    
    container.innerHTML = '<div class="text-center p-10 col-span-full"><div class="loading-spinner-small mx-auto mb-2"></div><p class="text-sm text-slate-500">Atualizando...</p></div>';

    let pendentes = fb_materiais.filter(m => m.status === 'separacao' || m.status === 'retirada');
    if (filterStatus) {
        pendentes = pendentes.filter(m => m.status === filterStatus);
        clearButton.classList.remove('hidden'); 
        titleEl.textContent = `Materiais ${filterStatus === 'separacao' ? 'em Separação' : 'Disponíveis p/ Retirada'}`;
    } else {
        clearButton.classList.add('hidden'); 
        titleEl.textContent = 'Materiais do Almoxarifado';
    }
    
    let contentHtml = ''; 
    
    if (pendentes.length === 0) {
        contentHtml = `<p class="text-sm text-slate-500 text-center py-4 col-span-full">Nenhum material ${filterStatus ? `com status "${filterStatus}"` : 'pendente'} encontrado.</p>`;
    } else {
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

        contentHtml = colunasRenderizadas > 0 ? colunasHtml : `<p class="text-sm text-slate-500 text-center py-4 col-span-full">Nenhum material ${filterStatus ? `com status "${filterStatus}"` : 'pendente'} encontrado.</p>`;
    }
    
    setTimeout(() => {
        if(container) { 
             container.innerHTML = contentHtml;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons(); 
            }
        }
    }, 0);
}


/**
 * Aplica o filtro de materiais no dashboard.
 * @param {string|null} status - O status para filtrar ('separacao', 'retirada') ou null para limpar.
 */
function filterDashboardMateriais(status) {
    currentDashboardMaterialFilter = status;
    renderDashboardMateriaisProntos(status);
}

/**
 * Rola suavemente um elemento se o conteúdo for maior que a área visível.
 */
function autoScrollView(element) {
    if (!element) return;
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
        if (visaoAtiva !== 'dashboard') { stopDashboardRefresh(); return; }
        console.log("Atualizando dados do Dashboard (auto-refresh)...");
        
        renderDashboardAguaChart(); renderDashboardGasChart();
        renderDashboardAguaSummary(); renderDashboardGasSummary();
        renderDashboardMateriaisList(); 
        renderDashboardMateriaisProntos(currentDashboardMaterialFilter); // Atualiza com filtro
        renderDashboardVisaoGeralSummary(); 
        renderDashboardMateriaisCounts();
        updateLastUpdateTime(); 
        
        if (!currentDashboardMaterialFilter) {
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
// ... (código do relatório PDF inalterado) ...
function handleGerarPdf() {
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
        const responsavelData = Array.from(responsavelMap.entries())
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
// ... (código da exclusão inalterado) ...
async function openConfirmDeleteModal(id, type, details = null) {
    if (!id || !type) return; 
    
    let collectionRef = null; 
    let detailsText = details ? `${details} (ID: ${id.substring(0,6)}...)` : `ID: ${id.substring(0,6)}...`;
    let alertElementId = 'alert-gestao'; 
    let showUnidadeWarning = false; 
    let isInicial = false; 

    if (type === 'agua') { 
        collectionRef = aguaCollection; 
        detailsText = `Movimentação de Água ${detailsText}`; 
        alertElementId = 'alert-agua-lista';
    } else if (type === 'gas') { 
        collectionRef = gasCollection; 
        detailsText = `Movimentação de Gás ${detailsText}`; 
        alertElementId = 'alert-gas-lista';
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

    deleteInfo = { id, type, collectionRef, alertElementId, details, isInicial }; 
    
    deleteDetailsEl.textContent = `Detalhes: ${detailsText}`;
    deleteWarningUnidadeEl.style.display = showUnidadeWarning ? 'block' : 'none'; 
    deleteWarningInicialEl.style.display = isInicial ? 'block' : 'none'; 
    confirmDeleteModal.style.display = 'block'; 
}

async function executeDelete() {
    if (!isAuthReady || !deleteInfo.id || !deleteInfo.collectionRef) {
         showAlert(deleteInfo.alertElementId || 'alert-gestao', 'Erro: Não autenticado ou informação de exclusão inválida.', 'error');
         return;
    }
    
    btnConfirmDelete.disabled = true; btnConfirmDelete.innerHTML = '<div class="loading-spinner-small mx-auto" style="width:18px; height:18px;"></div>';
    btnCancelDelete.disabled = true;
    
    try {
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
// ... (código do estoque inalterado) ...
async function handleInicialEstoqueSubmit(e) {
    e.preventDefault();
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
     // <<< Adicionado cheque domReady >>>
     if (!domReady) { console.warn("renderEstoqueAgua chamada antes do DOM pronto."); return; }
    
    if (loadingEstoqueAguaEl) loadingEstoqueAguaEl.style.display = 'none'; 
    
    if (estoqueInicialDefinido.agua) {
        btnAbrirInicialAgua.classList.add('hidden'); 
        formInicialAguaContainer.classList.add('hidden'); 
        resumoEstoqueAguaEl.classList.remove('hidden'); 
    } else { 
        btnAbrirInicialAgua.classList.remove('hidden'); 
        resumoEstoqueAguaEl.classList.add('hidden'); 
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
     // <<< Adicionado cheque domReady >>>
     if (!domReady) { console.warn("renderEstoqueGas chamada antes do DOM pronto."); return; }
    if (loadingEstoqueGasEl) loadingEstoqueGasEl.style.display = 'none';
    
    if (estoqueInicialDefinido.gas) {
        btnAbrirInicialGas.classList.add('hidden'); 
        formInicialGasContainer.classList.add('hidden'); 
        resumoEstoqueGasEl.classList.remove('hidden');
    } else { 
        btnAbrirInicialGas.classList.remove('hidden'); 
        resumoEstoqueGasEl.classList.add('hidden'); 
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
     // <<< Adicionado cheque domReady >>>
     if (!domReady) { console.warn("renderHistoricoAgua chamada antes do DOM pronto."); return; }
    
    const historicoOrdenado = [...fb_estoque_agua].sort((a, b) => (b.data?.toMillis() || 0) - (a.data?.toMillis() || 0));
     
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
    lucide.createIcons(); 

    const filtroHistoricoAguaEl = document.getElementById('filtro-historico-agua');
    if (filtroHistoricoAguaEl && filtroHistoricoAguaEl.value) { filterTable(filtroHistoricoAguaEl, 'table-historico-agua'); }
}

function renderHistoricoGas() {
     if (!tableHistoricoGas) return;
      // <<< Adicionado cheque domReady >>>
     if (!domReady) { console.warn("renderHistoricoGas chamada antes do DOM pronto."); return; }
    
    const historicoOrdenado = [...fb_estoque_gas].sort((a, b) => (b.data?.toMillis() || 0) - (a.data?.toMillis() || 0));
     
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
    lucide.createIcons();

    const filtroHistoricoGasEl = document.getElementById('filtro-historico-gas');
    if (filtroHistoricoGasEl && filtroHistoricoGasEl.value) { filterTable(filtroHistoricoGasEl, 'table-historico-gas'); }
}


// --- CONTROLE DE ABAS E INICIALIZAÇÃO ---
function switchSubTabView(tabPrefix, subViewName) {
    document.querySelectorAll(`#sub-nav-${tabPrefix} .sub-nav-btn`).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subview === subViewName);
    });
    document.querySelectorAll(`#content-${tabPrefix} > div[id^="subview-"]`).forEach(pane => {
         pane.classList.toggle('hidden', pane.id !== `subview-${subViewName}`);
    });
     lucide.createIcons(); 
}

function switchTab(tabName) {
    // <<< Adicionado cheque domReady >>>
    if (!domReady) { console.warn("switchTab chamada antes do DOM pronto."); return; }

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
        filterDashboardMateriais(null); // Limpa filtro do dashboard ao sair dele
    }
    
    if (tabName === 'gestao') { renderGestaoUnidades(); }
    if (tabName === 'agua') { 
        switchSubTabView('agua', 'movimentacao-agua'); 
        switchEstoqueForm('saida-agua'); 
        toggleAguaFormInputs(); 
        renderEstoqueAgua(); 
        renderHistoricoAgua(); 
    }
    if (tabName === 'gas') { 
        switchSubTabView('gas', 'movimentacao-gas'); 
        switchEstoqueForm('saida-gas'); 
        toggleGasFormInputs(); 
        renderEstoqueGas(); 
        renderHistoricoGas(); 
    }
    
    // Mantém a lógica para o filtro inicial da aba Materiais
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

function initApp() {
    console.log("Iniciando initApp..."); // Log para depuração
    // ** RESTAURADO: Atribuições globais, incluindo as do dashboard **
    navButtons = document.querySelectorAll('.nav-btn'); 
    contentPanes = document.querySelectorAll('main > div[id^="content-"]'); 
    connectionStatusEl = document.getElementById('connectionStatus'); 
    lastUpdateTimeEl = document.getElementById('last-update-time');
    dashboardNavControls = document.getElementById('dashboard-nav-controls');
    summaryAguaPendente = document.getElementById('summary-agua-pendente'); summaryAguaEntregue = document.getElementById('summary-agua-entregue'); summaryAguaRecebido = document.getElementById('summary-agua-recebido');
    summaryGasPendente = document.getElementById('summary-gas-pendente'); summaryGasEntregue = document.getElementById('summary-gas-entregue'); summaryGasRecebido = document.getElementById('summary-gas-recebido');
    dashboardMateriaisProntosContainer = document.getElementById('dashboard-materiais-prontos'); 
    loadingMateriaisProntos = document.getElementById('loading-materiais-prontos'); 
    // <<< MODIFICADO: Busca do botão e título movida para cá >>>
    btnClearDashboardFilter = document.getElementById('btn-clear-dashboard-filter'); 
    dashboardMateriaisTitle = document.getElementById('dashboard-materiais-title'); 
    // <<< FIM DA MODIFICAÇÃO >>>
    dashboardMateriaisListContainer = document.getElementById('dashboard-materiais-list'); loadingMateriaisDashboard = document.getElementById('loading-materiais-dashboard');
    dashboardEstoqueAguaEl = document.getElementById('dashboard-estoque-agua'); dashboardEstoqueGasEl = document.getElementById('dashboard-estoque-gas'); dashboardMateriaisSeparacaoCountEl = document.getElementById('dashboard-materiais-separacao-count');
    dashboardMateriaisRetiradaCountEl = document.getElementById('dashboard-materiais-retirada-count');
    formAgua = document.getElementById('form-agua'); selectUnidadeAgua = document.getElementById('select-unidade-agua'); selectTipoAgua = document.getElementById('select-tipo-agua'); inputDataAgua = document.getElementById('input-data-agua'); inputResponsavelAgua = document.getElementById('input-responsavel-agua'); btnSubmitAgua = document.getElementById('btn-submit-agua'); alertAgua = document.getElementById('alert-agua'); tableStatusAgua = document.getElementById('table-status-agua'); alertAguaLista = document.getElementById('alert-agua-lista');
    inputQtdEntregueAgua = document.getElementById('input-qtd-entregue-agua'); inputQtdRetornoAgua = document.getElementById('input-qtd-retorno-agua'); formGroupQtdEntregueAgua = document.getElementById('form-group-qtd-entregue-agua'); formGroupQtdRetornoAgua = document.getElementById('form-group-qtd-retorno-agua');
    formGas = document.getElementById('form-gas'); selectUnidadeGas = document.getElementById('select-unidade-gas'); selectTipoGas = document.getElementById('select-tipo-gas'); inputDataGas = document.getElementById('input-data-gas'); inputResponsavelGas = document.getElementById('input-responsavel-gas'); btnSubmitGas = document.getElementById('btn-submit-gas'); alertGas = document.getElementById('alert-gas'); tableStatusGas = document.getElementById('table-status-gas'); alertGasLista = document.getElementById('alert-gas-lista');
    inputQtdEntregueGas = document.getElementById('input-qtd-entregue-gas'); inputQtdRetornoGas = document.getElementById('input-qtd-retorno-gas'); formGroupQtdEntregueGas = document.getElementById('form-group-qtd-entregue-gas'); formGroupQtdRetornoGas = document.getElementById('form-group-qtd-retorno-gas');
    formMateriais = document.getElementById('form-materiais'); selectUnidadeMateriais = document.getElementById('select-unidade-materiais'); selectTipoMateriais = document.getElementById('select-tipo-materiais'); inputDataSeparacao = document.getElementById('input-data-separacao'); textareaItensMateriais = document.getElementById('textarea-itens-materiais'); inputResponsavelMateriais = document.getElementById('input-responsavel-materiais'); btnSubmitMateriais = document.getElementById('btn-submit-materiais'); alertMateriais = document.getElementById('alert-materiais'); tableStatusMateriais = document.getElementById('table-status-materiais'); alertMateriaisLista = document.getElementById('alert-materiais-lista');
    tableGestaoUnidades = document.getElementById('table-gestao-unidades'); alertGestao = document.getElementById('alert-gestao'); textareaBulkUnidades = document.getElementById('textarea-bulk-unidades'); btnBulkAddUnidades = document.getElementById('btn-bulk-add-unidades');
    filtroUnidadeNome = document.getElementById('filtro-unidade-nome'); filtroUnidadeTipo = document.getElementById('filtro-unidade-tipo'); 
    relatorioTipo = document.getElementById('relatorio-tipo'); relatorioDataInicio = document.getElementById('relatorio-data-inicio'); relatorioDataFim = document.getElementById('relatorio-data-fim'); btnGerarPdf = document.getElementById('btn-gerar-pdf'); alertRelatorio = document.getElementById('alert-relatorio');
    confirmDeleteModal = document.getElementById('confirm-delete-modal'); btnCancelDelete = document.getElementById('btn-cancel-delete'); btnConfirmDelete = document.getElementById('btn-confirm-delete'); deleteDetailsEl = document.getElementById('delete-details'); deleteWarningUnidadeEl = document.getElementById('delete-warning-unidade'); deleteWarningInicialEl = document.getElementById('delete-warning-inicial'); 
    estoqueAguaInicialEl = document.getElementById('estoque-agua-inicial'); estoqueAguaEntradasEl = document.getElementById('estoque-agua-entradas'); estoqueAguaSaidasEl = document.getElementById('estoque-agua-saidas'); estoqueAguaAtualEl = document.getElementById('estoque-agua-atual'); loadingEstoqueAguaEl = document.getElementById('loading-estoque-agua'); resumoEstoqueAguaEl = document.getElementById('resumo-estoque-agua');
    formEntradaAgua = document.getElementById('form-entrada-agua'); inputDataEntradaAgua = document.getElementById('input-data-entrada-agua'); btnSubmitEntradaAgua = document.getElementById('btn-submit-entrada-agua');
    formInicialAguaContainer = document.getElementById('form-inicial-agua-container'); formInicialAgua = document.getElementById('form-inicial-agua'); inputInicialQtdAgua = document.getElementById('input-inicial-qtd-agua'); inputInicialResponsavelAgua = document.getElementById('input-inicial-responsavel-agua'); btnSubmitInicialAgua = document.getElementById('btn-submit-inicial-agua'); alertInicialAgua = document.getElementById('alert-inicial-agua'); btnAbrirInicialAgua = document.getElementById('btn-abrir-inicial-agua');
    tableHistoricoAgua = document.getElementById('table-historico-agua'); alertHistoricoAgua = document.getElementById('alert-historico-agua');
    estoqueGasInicialEl = document.getElementById('estoque-gas-inicial'); estoqueGasEntradasEl = document.getElementById('estoque-gas-entradas'); estoqueGasSaidasEl = document.getElementById('estoque-gas-saidas'); estoqueGasAtualEl = document.getElementById('estoque-gas-atual'); loadingEstoqueGasEl = document.getElementById('loading-estoque-gas'); resumoEstoqueGasEl = document.getElementById('resumo-estoque-gas');
    formEntradaGas = document.getElementById('form-entrada-gas'); inputDataEntradaGas = document.getElementById('input-data-entrada-gas'); btnSubmitEntradaGas = document.getElementById('btn-submit-entrada-gas');
    formInicialGasContainer = document.getElementById('form-inicial-gas-container'); formInicialGas = document.getElementById('form-inicial-gas'); inputInicialQtdGas = document.getElementById('input-inicial-qtd-gas'); inputInicialResponsavelGas = document.getElementById('input-inicial-responsavel-gas'); btnSubmitInicialGas = document.getElementById('btn-submit-inicial-gas'); alertInicialGas = document.getElementById('alert-inicial-gas'); btnAbrirInicialGas = document.getElementById('btn-abrir-inicial-gas');
    tableHistoricoGas = document.getElementById('table-historico-gas'); alertHistoricoGas = document.getElementById('alert-historico-gas');
    
    // Verifica se todos os elementos cruciais foram encontrados
    if (!dashboardMateriaisProntosContainer || !loadingMateriaisProntos || !btnClearDashboardFilter || !dashboardMateriaisTitle) {
        console.error("ERRO CRÍTICO: Elementos essenciais do dashboard de materiais não encontrados no initApp!");
        // Poderia adicionar um alerta visual para o usuário aqui, se desejado.
    }
    
    const todayStr = getTodayDateString();
    [inputDataAgua, inputDataGas, inputDataSeparacao, relatorioDataInicio, relatorioDataFim, inputDataEntradaAgua, inputDataEntradaGas].forEach(input => {
        if(input) input.value = todayStr;
    });

    navButtons.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
    if (dashboardNavControls) dashboardNavControls.addEventListener('click', (e) => { const btn = e.target.closest('button.dashboard-nav-btn[data-view]'); if (btn) switchDashboardView(btn.dataset.view); });
    if (formAgua) formAgua.addEventListener('submit', handleAguaSubmit); 
    if (formGas) formGas.addEventListener('submit', handleGasSubmit); 
    if (formMateriais) formMateriais.addEventListener('submit', handleMateriaisSubmit); 
    if (selectTipoAgua) selectTipoAgua.addEventListener('change', toggleAguaFormInputs);
    if (selectTipoGas) selectTipoGas.addEventListener('change', toggleGasFormInputs);
    
    document.querySelector('main').addEventListener('click', (e) => {
         const removeBtn = e.target.closest('button.btn-remove[data-id]');
         const entregueBtn = e.target.closest('button.btn-entregue[data-id]');
         const retiradaBtn = e.target.closest('button.btn-retirada[data-id]');
         
         if (removeBtn) { openConfirmDeleteModal(removeBtn.dataset.id, removeBtn.dataset.type, removeBtn.dataset.details); } 
         else if (entregueBtn) { handleMarcarEntregue(e); }
         else if (retiradaBtn) { handleMarcarRetirada(e); } 
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
    document.querySelectorAll('.form-tab-btn[data-form="saida-agua"]').forEach(btn => btn.addEventListener('click', () => switchEstoqueForm('saida-agua')));
    document.querySelectorAll('.form-tab-btn[data-form="entrada-agua"]').forEach(btn => btn.addEventListener('click', () => switchEstoqueForm('entrada-agua')));
    document.querySelectorAll('.form-tab-btn[data-form="saida-gas"]').forEach(btn => btn.addEventListener('click', () => switchEstoqueForm('saida-gas')));
    document.querySelectorAll('.form-tab-btn[data-form="entrada-gas"]').forEach(btn => btn.addEventListener('click', () => switchEstoqueForm('entrada-gas')));
    if (formEntradaAgua) formEntradaAgua.addEventListener('submit', handleEntradaEstoqueSubmit);
    if (formEntradaGas) formEntradaGas.addEventListener('submit', handleEntradaEstoqueSubmit);
    if (btnAbrirInicialAgua) btnAbrirInicialAgua.addEventListener('click', () => { formInicialAguaContainer.classList.remove('hidden'); btnAbrirInicialAgua.classList.add('hidden'); });
    if (btnAbrirInicialGas) btnAbrirInicialGas.addEventListener('click', () => { formInicialGasContainer.classList.remove('hidden'); btnAbrirInicialGas.classList.add('hidden'); });
    if (formInicialAgua) formInicialAgua.addEventListener('submit', handleInicialEstoqueSubmit);
    if (formInicialGas) formInicialGas.addEventListener('submit', handleInicialEstoqueSubmit);
    document.getElementById('filtro-status-agua')?.addEventListener('input', (e) => filterTable(e.target, 'table-status-agua'));
    document.getElementById('filtro-historico-agua')?.addEventListener('input', (e) => filterTable(e.target, 'table-historico-agua'));
    document.getElementById('filtro-status-gas')?.addEventListener('input', (e) => filterTable(e.target, 'table-status-gas'));
    document.getElementById('filtro-historico-gas')?.addEventListener('input', (e) => filterTable(e.target, 'table-historico-gas'));
    document.getElementById('filtro-status-materiais')?.addEventListener('input', (e) => filterTable(e.target, 'table-status-materiais'));
    document.getElementById('sub-nav-agua')?.addEventListener('click', (e) => { const btn = e.target.closest('button.sub-nav-btn[data-subview]'); if (btn) switchSubTabView('agua', btn.dataset.subview); });
    document.getElementById('sub-nav-gas')?.addEventListener('click', (e) => { const btn = e.target.closest('button.sub-nav-btn[data-subview]'); if (btn) switchSubTabView('gas', btn.dataset.subview); });

    // Adiciona listeners para filtrar no dashboard
    const cardSeparacao = document.getElementById('dashboard-card-separacao');
    const cardRetirada = document.getElementById('dashboard-card-retirada');
    
    // <<< MODIFICADO: Usa a variável global já definida >>>
    const btnClearFilter = btnClearDashboardFilter; 
    
    if (cardSeparacao) {
        cardSeparacao.addEventListener('click', () => filterDashboardMateriais('separacao')); 
    }
    if (cardRetirada) {
        cardRetirada.addEventListener('click', () => filterDashboardMateriais('retirada')); 
    }
    
    if (btnClearFilter) { 
        btnClearFilter.addEventListener('click', () => filterDashboardMateriais(null));
    }


    if(typeof lucide !== 'undefined') lucide.createIcons();
    toggleAguaFormInputs(); toggleGasFormInputs();

    console.log("initApp concluído. Chamando initFirebase() e switchTab()...");
    initFirebase();
    switchTab('dashboard'); 
    
    // <<< Marcar a bandeira como true NO FINAL de initApp >>>
    console.log("DOM pronto! Marcando domReady = true");
    domReady = true; 
}

// --- INICIALIZAÇÃO GERAL ---
document.addEventListener('DOMContentLoaded', () => { 
    initApp(); 
});

