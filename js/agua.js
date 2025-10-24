/* =============================================================
   MÓDULO: Controle de Água
   Funções:
     - initAgua() -> NOVO: Chamado pelo app.js
     - toggleAguaFormInputs()
     - handleAguaSubmit()
     - renderAguaStatus()
     - handleInicialEstoqueSubmit() // Chamado pelo listener no app.js
     - handleEntradaEstoqueSubmit() // Chamado pelo listener no app.js
     - renderEstoqueAgua()
     - renderHistoricoAgua()
     - selecionarModoPrevisao() // Chamado pelo HTML
     - adicionarExclusao() // Chamado pelo HTML
     - removerExclusao() // Chamado pelo HTML
     - calcularPrevisaoInteligente() // Chamado pelo HTML
     - renderizarGraficoPrevisao()
     - handleTipoPrevisaoChange() // Adicionado internamente
   Autor: Jurandy Santana (Refatorado por Gemini)
   ============================================================= */

// **CORREÇÃO**: Removemos o 'DOMContentLoaded' e criamos a função initAgua()
// que será chamada pelo app.js quando o DOM e o Firebase estiverem prontos.
function initAgua() {
    console.log("Inicializando módulo de Água...");
    
    // **CORREÇÃO DE ESCOPO**: Usa window.formAgua, window.handleAguaSubmit, etc.
    if (window.formAgua) window.formAgua.addEventListener('submit', handleAguaSubmit); 
    if (window.selectTipoAgua) window.selectTipoAgua.addEventListener('change', toggleAguaFormInputs);
    if (window.formEntradaAgua) window.formEntradaAgua.addEventListener('submit', handleEntradaEstoqueSubmit);
    if (window.btnAbrirInicialAgua) window.btnAbrirInicialAgua.addEventListener('click', () => { if(window.formInicialAguaContainer) window.formInicialAguaContainer.classList.remove('hidden'); if(window.btnAbrirInicialAgua) window.btnAbrirInicialAgua.classList.add('hidden'); });
    if (window.formInicialAgua) window.formInicialAgua.addEventListener('submit', handleInicialEstoqueSubmit);
    
    const filtroStatus = document.getElementById('filtro-status-agua');
    if (filtroStatus) filtroStatus.addEventListener('input', (e) => window.filterTable(e.target, 'table-status-agua'));
    
    const filtroHistorico = document.getElementById('filtro-historico-agua');
    if (filtroHistorico) filtroHistorico.addEventListener('input', (e) => window.filterTable(e.target, 'table-historico-agua'));

    // Inicializa a visibilidade correta dos inputs Qtd
    toggleAguaFormInputs();
}

// **NOVO**: Torna a função initAgua acessível globalmente para o app.js
window.initAgua = initAgua;


// --- LÓGICA DE CONTROLE DE ÁGUA ---

// Alterna a visibilidade dos campos de quantidade (Entregue/Recebido) baseado no Tipo de Movimentação
function toggleAguaFormInputs() {
     // **CORREÇÃO DE ESCOPO**: Usa window.domReady, window.selectTipoAgua, etc.
     if (!window.domReady) return; 
    if (!window.selectTipoAgua) return; 
    const tipo = window.selectTipoAgua.value;
    if (tipo === 'troca') {
        window.formGroupQtdEntregueAgua?.classList.remove('hidden');
        window.formGroupQtdRetornoAgua?.classList.remove('hidden');
    } else if (tipo === 'entrega') {
        window.formGroupQtdEntregueAgua?.classList.remove('hidden');
        window.formGroupQtdRetornoAgua?.classList.add('hidden');
        if (window.inputQtdRetornoAgua) window.inputQtdRetornoAgua.value = "0"; 
    } else if (tipo === 'retorno') {
        window.formGroupQtdEntregueAgua?.classList.add('hidden');
        window.formGroupQtdRetornoAgua?.classList.remove('hidden');
        if (window.inputQtdEntregueAgua) window.inputQtdEntregueAgua.value = "0"; 
    }
}

// Processa o envio do formulário de movimentação de água
async function handleAguaSubmit(e) {
     e.preventDefault();
     // **CORREÇÃO DE ESCOPO**: Usa window.isAuthReady, window.showAlert, etc.
    if (!window.isAuthReady) { window.showAlert('alert-agua', 'Erro: Não autenticado.', 'error'); return; }
    if (!window.domReady) { window.showAlert('alert-agua', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
    const selectValue = window.selectUnidadeAgua.value; 
    if (!selectValue) { window.showAlert('alert-agua', 'Selecione uma unidade.', 'warning'); return; }
    const [unidadeId, unidadeNome, tipoUnidadeRaw] = selectValue.split('|');
    const tipoUnidade = (tipoUnidadeRaw || '').toUpperCase() === 'SEMCAS' ? 'SEDE' : (tipoUnidadeRaw || '').toUpperCase();

    const tipoMovimentacao = window.selectTipoAgua.value; 
    const qtdEntregue = parseInt(window.inputQtdEntregueAgua.value, 10) || 0;
    const qtdRetorno = parseInt(window.inputQtdRetornoAgua.value, 10) || 0;
    const data = window.dateToTimestamp(window.inputDataAgua.value);
    const responsavel = window.capitalizeString(window.inputResponsavelAgua.value.trim()); 
    
    if (!unidadeId || !data || !responsavel) {
        window.showAlert('alert-agua', 'Dados inválidos. Verifique Unidade, Data e Responsável.', 'warning'); return;
    }
    if (tipoMovimentacao === 'troca' && qtdEntregue === 0 && qtdRetorno === 0) {
         window.showAlert('alert-agua', 'Para "Troca", ao menos uma das quantidades deve ser maior que zero.', 'warning'); return;
    }
    if (tipoMovimentacao === 'entrega' && qtdEntregue <= 0) {
         window.showAlert('alert-agua', 'Para "Apenas Saída", a quantidade deve ser maior que zero.', 'warning'); return;
    }
    if (tipoMovimentacao === 'retorno' && qtdRetorno <= 0) {
         window.showAlert('alert-agua', 'Para "Apenas Retorno", a quantidade deve ser maior que zero.', 'warning'); return;
    }
    if (qtdEntregue > 0) {
        if (!window.estoqueInicialDefinido.agua) {
            window.showAlert('alert-agua', 'Defina o Estoque Inicial de Água antes de lançar saídas.', 'warning'); return;
        }
        // **CORREÇÃO**: Certifica que estoqueAguaAtualEl existe antes de ler textContent
        const estoqueAtualText = window.estoqueAguaAtualEl?.textContent || '0';
        const estoqueAtual = parseInt(estoqueAtualText, 10) || 0;
        if (qtdEntregue > estoqueAtual) {
            window.showAlert('alert-agua', `Erro: Estoque insuficiente. Disponível: ${estoqueAtual}`, 'error'); return;
        }
    }
    
    window.btnSubmitAgua.disabled = true; window.btnSubmitAgua.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    let msgSucesso = [];
    
    try {
        const timestamp = window.serverTimestamp(); 
        if (qtdEntregue > 0) {
            await window.addDoc(window.aguaCollection, { unidadeId, unidadeNome, tipoUnidade, tipo: 'entrega', quantidade: qtdEntregue, data, responsavel, registradoEm: timestamp });
            msgSucesso.push(`${qtdEntregue} galão(ões) entregue(s)`);
        }
        if (qtdRetorno > 0) {
             await window.addDoc(window.aguaCollection, { unidadeId, unidadeNome, tipoUnidade, tipo: 'retorno', quantidade: qtdRetorno, data, responsavel, registradoEm: timestamp });
             msgSucesso.push(`${qtdRetorno} galão(ões) recebido(s)`);
        }
        window.showAlert('alert-agua', `Movimentação salva! ${msgSucesso.join('; ')}.`, 'success');
        window.formAgua.reset(); 
        window.inputDataAgua.value = window.getTodayDateString(); 
        toggleAguaFormInputs(); 
    } catch (error) { 
        console.error("Erro salvar água:", error); 
        window.showAlert('alert-agua', `Erro: ${error.message}`, 'error');
    } finally { 
        window.btnSubmitAgua.disabled = false; 
        window.btnSubmitAgua.textContent = 'Salvar Movimentação'; 
    }
}

// Renderiza a tabela de status (saldo) de água por unidade
function renderAguaStatus() {
     // **CORREÇÃO DE ESCOPO**: Usa window.tableStatusAgua, window.domReady, etc.
     if (!window.tableStatusAgua) {
         console.warn("Elemento tableStatusAgua não encontrado para renderizar.");
         return;
     }
     // **CORREÇÃO**: Removido check domReady daqui, pois a chamada já vem depois
     // if (!window.domReady) { console.warn("renderAguaStatus chamada antes do DOM pronto."); return; }

     // Esconde spinner (se existir) - *** Garante que o spinner suma ***
     const spinnerRow = window.tableStatusAgua.querySelector('tr.loading-row');
     if (spinnerRow) spinnerRow.remove();
     
     const statusMap = new Map();
     // **CORREÇÃO**: Garante que fb_unidades exista
     if (!window.fb_unidades || window.fb_unidades.length === 0) {
          window.tableStatusAgua.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500">Carregando unidades...</td></tr>';
          return;
     }
     
     window.fb_unidades.forEach(u => { 
        let tipoNormalizado = (u.tipo || 'N/A').toUpperCase();
        if (tipoNormalizado === 'SEMCAS') tipoNormalizado = 'SEDE';
        statusMap.set(u.id, { id: u.id, nome: u.nome, tipo: tipoNormalizado, entregues: 0, recebidos: 0, ultimosLancamentos: [] }); 
    });

     // **CORREÇÃO**: Garante que fb_agua_movimentacoes exista
     const movsOrdenadas = [...(window.fb_agua_movimentacoes || [])].sort((a, b) => (b.registradoEm?.toMillis() || 0) - (a.registradoEm?.toMillis() || 0));
     
     movsOrdenadas.forEach(m => {
         if (statusMap.has(m.unidadeId)) {
             const unidadeStatus = statusMap.get(m.unidadeId);
             if (m.tipo === 'entrega') unidadeStatus.entregues += m.quantidade;
             else if (m.tipo === 'retorno') unidadeStatus.recebidos += m.quantidade;
             if (unidadeStatus.ultimosLancamentos.length < 1) { 
                 unidadeStatus.ultimosLancamentos.push({id: m.id, resp: m.responsavel, data: window.formatTimestamp(m.data), tipo: m.tipo});
             }
         }
     });

     const statusArray = Array.from(statusMap.values())
         .map(s => ({ ...s, pendentes: s.entregues - s.recebidos })) 
         .filter(s => s.entregues > 0 || s.recebidos > 0 || s.pendentes !== 0) 
         .sort((a, b) => b.pendentes - a.pendentes || a.nome.localeCompare(b.nome)); 

    if (statusArray.length === 0) { 
        window.tableStatusAgua.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500">Nenhuma movimentação registrada.</td></tr>'; 
        // return; // Não precisa retornar, o HTML já foi setado
    } else { // *** Adicionado Else ***
        window.tableStatusAgua.innerHTML = statusArray.map(s => {
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
    } // *** Fim do Else ***
     window.lucide.createIcons(); 

    const filtroStatusAguaEl = document.getElementById('filtro-status-agua');
    if (filtroStatusAguaEl && filtroStatusAguaEl.value) {
        window.filterTable(filtroStatusAguaEl, 'table-status-agua');
    }
}

// --- LÓGICA DE ESTOQUE DE ÁGUA ---

// Processa o envio do formulário de estoque inicial
async function handleInicialEstoqueSubmit(e) {
    e.preventDefault();
     // **CORREÇÃO DE ESCOPO**: Usa window.domReady, window.capitalizeString, etc.
     if (!window.domReady) return; 
    const tipoEstoque = e.target.id.includes('agua') ? 'agua' : 'gas'; 
    if(tipoEstoque !== 'agua') return; // Garante que só processe água aqui
    
    const inputQtd = document.getElementById(`input-inicial-qtd-agua`).value;
    const inputResp = document.getElementById(`input-inicial-responsavel-agua`).value;
    const btnSubmit = document.getElementById(`btn-submit-inicial-agua`);
    const alertElId = `alert-inicial-agua`;
    
    const quantidade = parseInt(inputQtd, 10);
    const responsavel = window.capitalizeString(inputResp.trim());

    if (isNaN(quantidade) || quantidade < 0 || !responsavel) { 
        window.showAlert(alertElId, "Preencha a quantidade e o responsável.", 'warning'); return; 
    }
    
    if (window.estoqueInicialDefinido.agua) { // Usa a variável global
         window.showAlert(alertElId, "O estoque inicial já foi definido.", 'info'); 
         document.getElementById(`form-inicial-agua-container`).classList.add('hidden');
         document.getElementById(`btn-abrir-inicial-agua`).classList.add('hidden');
         document.getElementById(`resumo-estoque-agua`).classList.remove('hidden'); 
         return;
    }
    
    btnSubmit.disabled = true; btnSubmit.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    
    try {
        await window.addDoc(window.estoqueAguaCollection, { // Usa a collection global
            tipo: 'inicial', 
            quantidade: quantidade, 
            data: window.serverTimestamp(), 
            responsavel: responsavel, 
            notaFiscal: 'INICIAL', 
            registradoEm: window.serverTimestamp() 
        });
        window.showAlert(alertElId, "Estoque inicial salvo!", 'success', 2000);
         document.getElementById(`form-inicial-agua-container`).classList.add('hidden');
         document.getElementById(`btn-abrir-inicial-agua`).classList.add('hidden');
    } catch (error) {
        console.error("Erro ao salvar estoque inicial:", error);
        window.showAlert(alertElId, `Erro ao salvar: ${error.message}`, 'error');
        btnSubmit.disabled = false; btnSubmit.textContent = 'Salvar Inicial'; 
    }
}

// Processa o envio do formulário de entrada de estoque
async function handleEntradaEstoqueSubmit(e) {
    e.preventDefault();
    // **CORREÇÃO DE ESCOPO**: Usa window.isAuthReady, window.showAlert, etc.
    if (!window.isAuthReady) { window.showAlert('alert-agua', 'Erro: Não autenticado.', 'error'); return; } 
    if (!window.domReady) { window.showAlert('alert-agua', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
    
    const tipoEstoque = e.target.id.includes('agua') ? 'agua' : 'gas';
    if(tipoEstoque !== 'agua') return; // Garante que só processe água aqui
    const alertElementId = `alert-agua`; 
    
    const inputQtd = document.getElementById(`input-qtd-entrada-agua`).value;
    const inputData = document.getElementById(`input-data-entrada-agua`).value;
    const inputResp = document.getElementById(`input-responsavel-entrada-agua`).value;
    const inputNf = document.getElementById(`input-nf-entrada-agua`).value;
    const btnSubmit = document.getElementById(`btn-submit-entrada-agua`);
    const form = document.getElementById(`form-entrada-agua`);
    
    const quantidade = parseInt(inputQtd, 10);
    const data = window.dateToTimestamp(inputData);
    const responsavel = window.capitalizeString(inputResp.trim());
    const notaFiscal = inputNf.trim() || 'N/A'; 

    if (!quantidade || quantidade <= 0 || !data || !responsavel) { 
        window.showAlert(alertElementId, 'Dados inválidos. Verifique quantidade, data e responsável.', 'warning'); return; 
    }
    if (!window.estoqueInicialDefinido.agua) { // Usa a variável global
        window.showAlert(alertElementId, `Defina o Estoque Inicial de Água antes de lançar entradas.`, 'warning'); return; 
    }
    
    btnSubmit.disabled = true; btnSubmit.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    
    try {
        await window.addDoc(window.estoqueAguaCollection, { // Usa a collection global
            tipo: 'entrada', 
            quantidade: quantidade, 
            data: data, 
            responsavel: responsavel, 
            notaFiscal: notaFiscal, 
            registradoEm: window.serverTimestamp() 
        });
        window.showAlert(alertElementId, 'Entrada no estoque salva!', 'success');
        form.reset(); 
        document.getElementById(`input-data-entrada-agua`).value = window.getTodayDateString(); 
    } catch (error) {
        console.error("Erro salvar entrada estoque:", error); 
        window.showAlert(alertElementId, `Erro: ${error.message}`, 'error');
    } finally { 
        btnSubmit.disabled = false; btnSubmit.textContent = 'Salvar Entrada'; 
    }
}

// Renderiza o resumo do estoque de água
function renderEstoqueAgua() {
    // **CORREÇÃO DE ESCOPO**: Usa window.estoqueAguaAtualEl, window.domReady, etc.
    if (!window.estoqueAguaAtualEl) {
        console.warn("Elemento estoqueAguaAtualEl não encontrado para renderizar.");
        return;
    }
    // **CORREÇÃO**: Removido check domReady daqui
    // if (!window.domReady) { console.warn("renderEstoqueAgua chamada antes do DOM pronto."); return; }
    
    // *** CORREÇÃO: Esconde o spinner aqui ***
    if (window.loadingEstoqueAguaEl) window.loadingEstoqueAguaEl.style.display = 'none'; 
    
    if (window.estoqueInicialDefinido.agua) { // Usa a variável global
        if(window.btnAbrirInicialAgua) window.btnAbrirInicialAgua.classList.add('hidden'); 
        if(window.formInicialAguaContainer) window.formInicialAguaContainer.classList.add('hidden'); 
        if(window.resumoEstoqueAguaEl) window.resumoEstoqueAguaEl.classList.remove('hidden'); 
    } else { 
        if(window.btnAbrirInicialAgua) window.btnAbrirInicialAgua.classList.remove('hidden'); 
        if(window.resumoEstoqueAguaEl) window.resumoEstoqueAguaEl.classList.add('hidden'); 
        // **CORREÇÃO**: Se o inicial não foi definido, não calcula o resto
        window.estoqueAguaInicialEl.textContent = '0';
        window.estoqueAguaEntradasEl.textContent = '+0';
        window.estoqueAguaSaidasEl.textContent = '-0';
        window.estoqueAguaAtualEl.textContent = '0';
        window.renderDashboardVisaoGeralSummary(); // Atualiza dashboard com 0
        return; 
    }

    // Usa os arrays globais fb_estoque_agua e fb_agua_movimentacoes
    // **CORREÇÃO**: Garante que os arrays existam
    const estoqueAguaData = window.fb_estoque_agua || [];
    const aguaMovsData = window.fb_agua_movimentacoes || [];
    
    const estoqueInicial = estoqueAguaData.filter(e => e.tipo === 'inicial').reduce((sum, e) => sum + e.quantidade, 0);
    const totalEntradas = estoqueAguaData.filter(e => e.tipo === 'entrada').reduce((sum, e) => sum + e.quantidade, 0);
    const totalSaidas = aguaMovsData.filter(m => m.tipo === 'entrega').reduce((sum, m) => sum + m.quantidade, 0);
    const estoqueAtual = estoqueInicial + totalEntradas - totalSaidas;

    window.estoqueAguaInicialEl.textContent = estoqueInicial;
    window.estoqueAguaEntradasEl.textContent = `+${totalEntradas}`;
    window.estoqueAguaSaidasEl.textContent = `-${totalSaidas}`;
    window.estoqueAguaAtualEl.textContent = estoqueAtual;
    
    // Atualiza o card no dashboard também
    window.renderDashboardVisaoGeralSummary(); 
}

// Renderiza a tabela de histórico de entradas no estoque de água
function renderHistoricoAgua() {
    // **CORREÇÃO DE ESCOPO**: Usa window.tableHistoricoAgua, window.domReady, etc.
    if (!window.tableHistoricoAgua) {
         console.warn("Elemento tableHistoricoAgua não encontrado para renderizar.");
         return;
    }
     // **CORREÇÃO**: Removido check domReady daqui
    // if (!window.domReady) { console.warn("renderHistoricoAgua chamada antes do DOM pronto."); return; }
    
    // Esconde spinner (se existir) - *** Garante que o spinner suma ***
    const spinnerRow = window.tableHistoricoAgua.querySelector('tr.loading-row');
    if (spinnerRow) spinnerRow.remove();
    
     // Usa o array global fb_estoque_agua
     // **CORREÇÃO**: Garante que o array exista
    const historicoOrdenado = [...(window.fb_estoque_agua || [])].sort((a, b) => (b.data?.toMillis() || 0) - (a.data?.toMillis() || 0));
     
     if (historicoOrdenado.length === 0) { 
        window.tableHistoricoAgua.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500">Nenhuma entrada registrada.</td></tr>'; 
        // return; // Não precisa retornar
     } else { // *** Adicionado Else ***
        window.tableHistoricoAgua.innerHTML = historicoOrdenado.map(e => {
            const tipoClass = e.tipo === 'inicial' ? 'badge-blue' : 'badge-green';
            const tipoText = e.tipo === 'inicial' ? 'Inicial' : 'Entrada';
            return `
            <tr>
                <td>${window.formatTimestamp(e.data)}</td>
                <td><span class="badge ${tipoClass}">${tipoText}</span></td>
                <td class="text-center font-medium">${e.quantidade}</td>
                <td>${e.responsavel || 'N/A'}</td><td>${e.notaFiscal || 'N/A'}</td>
                <td class="text-center">
                    <button class="btn-danger btn-remove" data-id="${e.id}" data-type="entrada-agua" title="Remover esta entrada"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>
        `}).join('');
    } // *** Fim do Else ***
    window.lucide.createIcons(); 

    const filtroHistoricoAguaEl = document.getElementById('filtro-historico-agua');
    if (filtroHistoricoAguaEl && filtroHistoricoAguaEl.value) { window.filterTable(filtroHistoricoAguaEl, 'table-historico-agua'); }
}
// **CORREÇÃO DE ESCOPO**: As funções abaixo (selecionarModoPrevisao, etc.)
// já são anexadas ao 'window' no app.js, mas elas usam variáveis globais.
// Vamos garantir que elas usem window.X internamente.

// --- LÓGICA DE PREVISÃO INTELIGENTE DE ÁGUA ---

// Seleciona o modo de previsão (chamado pelo HTML)
// A função agora usa as variáveis globais modoPrevisao, listaExclusoes, tipoSelecionadoPrevisao
// e chama as funções globais populateUnidadeSelects e renderizarListaExclusoes
window.selecionarModoPrevisao = (tipoItem, modo) => {
    // **CORREÇÃO DE ESCOPO**: Usa window.domReady, window.modoPrevisao, etc.
    if (!window.domReady) return; 
    
    // Este arquivo agora trata AMBOS os tipos, mas o app.js
    // anexa as funções do gas.js por último, sobrescrevendo estas.
    // Vamos fazer esta função tratar APENAS 'agua'.
    if (tipoItem !== 'agua') {
        // Se não for água, chama a função de gás (caso ela exista)
        if (typeof window.selecionarModoPrevisaoGas === 'function') {
             window.selecionarModoPrevisaoGas(tipoItem, modo);
        }
        return;
    }
    
    console.log(`Modo Previsão (Água): ${modo}`);
    window.modoPrevisao.agua = modo;
    
    const configContainer = document.getElementById(`config-previsao-agua`);
    const cards = document.querySelectorAll(`#subview-previsao-agua .previsao-option-card`);
    const selectUnidadeContainer = document.getElementById(`select-unidade-container-agua`);
    const selectTipoContainer = document.getElementById(`select-tipo-container-agua`);
    const selectTipoEl = document.getElementById(`select-previsao-tipo-agua`); 
    const exclusaoContainer = document.getElementById(`exclusao-container-agua`);
    const selectExclusaoEl = document.getElementById(`select-exclusao-agua`); 

    configContainer.classList.remove('hidden');
    selectUnidadeContainer.classList.add('hidden');
    selectTipoContainer.classList.add('hidden');
    exclusaoContainer.classList.remove('hidden'); 
    
    cards.forEach(card => card.classList.toggle('selected', card.dataset.modo === modo));

    if (modo === 'unidade-especifica') {
        selectUnidadeContainer.classList.remove('hidden');
        exclusaoContainer.classList.add('hidden'); 
        window.tipoSelecionadoPrevisao.agua = null; 
    } else if (modo === 'por-tipo') {
        selectTipoContainer.classList.remove('hidden');
        window.tipoSelecionadoPrevisao.agua = selectTipoEl.value; 
        window.populateUnidadeSelects(selectExclusaoEl, 'atendeAgua', false, true, window.tipoSelecionadoPrevisao.agua); 
    } else if (modo === 'completo') {
        window.tipoSelecionadoPrevisao.agua = null; 
         window.populateUnidadeSelects(selectExclusaoEl, 'atendeAgua', false, true, null);
    }

    window.listaExclusoes.agua = [];
    renderizarListaExclusoes('agua');
    
    // Remove listener antigo (se existir) e adiciona o novo
    selectTipoEl.removeEventListener('change', handleTipoPrevisaoChangeAgua); 
    selectTipoEl.addEventListener('change', handleTipoPrevisaoChangeAgua); 
}
// Renomeia a função global de gas para evitar colisão
if (typeof window.selecionarModoPrevisao === 'function' && typeof window.selecionarModoPrevisaoGas === 'undefined') {
    window.selecionarModoPrevisaoGas = window.selecionarModoPrevisao;
}


// Handler específico para mudança de tipo na previsão de água
function handleTipoPrevisaoChangeAgua(event) {
    // **CORREÇÃO DE ESCOPO**: Usa window.domReady, window.tipoSelecionadoPrevisao, etc.
    if (!window.domReady) return; 
    const selectEl = event.target;
    const novoTipo = selectEl.value;
    window.tipoSelecionadoPrevisao.agua = novoTipo; 
    
    const selectExclusaoEl = document.getElementById(`select-exclusao-agua`);
    window.populateUnidadeSelects(selectExclusaoEl, 'atendeAgua', false, true, novoTipo); 
    
    window.listaExclusoes.agua = [];
    renderizarListaExclusoes('agua');
}


// Adiciona unidade à lista de exclusão (chamado pelo HTML)
window.adicionarExclusao = (tipoItem) => {
    // **CORREÇÃO DE ESCOPO**: Usa window.domReady, window.listaExclusoes, etc.
     if (!window.domReady) return; 
    if (tipoItem !== 'agua') {
        if (typeof window.adicionarExclusaoGas === 'function') {
            window.adicionarExclusaoGas(tipoItem);
        }
        return;
    } 
    
    const selectExclusao = document.getElementById(`select-exclusao-agua`);
    const unidadeId = selectExclusao.value;
    if (!unidadeId || unidadeId === 'todas') return; 
    
    if (window.listaExclusoes.agua.find(item => item.id === unidadeId)) {
        selectExclusao.value = ""; 
        return;
    }

    const unidadeNome = selectExclusao.options[selectExclusao.selectedIndex].text;
    window.listaExclusoes.agua.push({ id: unidadeId, nome: unidadeNome });
    
    renderizarListaExclusoes('agua'); 
    selectExclusao.value = ""; 
}
if (typeof window.adicionarExclusao === 'function' && typeof window.adicionarExclusaoGas === 'undefined') {
    window.adicionarExclusaoGas = window.adicionarExclusao;
}


// Renderiza a lista de unidades excluídas
function renderizarListaExclusoes(tipoItem) {
     // **CORREÇÃO DE ESCOPO**: Usa window.domReady, window.listaExclusoes, etc.
      if (!window.domReady) return; 
     if (tipoItem !== 'agua') return; 
    const container = document.getElementById(`lista-exclusoes-agua`);
    container.innerHTML = window.listaExclusoes.agua.map((item, index) => `
        <span class="exclusao-item">
            ${item.nome}
            <button type="button" onclick="removerExclusao('agua', ${index})">&times;</button>
        </span>
    `).join('');
}

// Remove unidade da lista de exclusão (chamado pelo HTML)
window.removerExclusao = (tipoItem, index) => {
     // **CORREÇÃO DE ESCOPO**: Usa window.domReady, window.listaExclusoes, etc.
     if (!window.domReady) return; 
    if (tipoItem !== 'agua') {
        if (typeof window.removerExclusaoGas === 'function') {
            window.removerExclusaoGas(tipoItem, index);
        }
        return;
    }
    window.listaExclusoes.agua.splice(index, 1); 
    renderizarListaExclusoes('agua'); 
}
if (typeof window.removerExclusao === 'function' && typeof window.removerExclusaoGas === 'undefined') {
    window.removerExclusaoGas = window.removerExclusao;
}


// Calcula a previsão inteligente (chamado pelo HTML)
window.calcularPrevisaoInteligente = (tipoItem) => {
     // **CORREÇÃO DE ESCOPO**: Usa window.domReady, window.modoPrevisao, etc.
      if (!window.domReady) return; 
     if (tipoItem !== 'agua'){
          if (typeof window.calcularPrevisaoInteligenteGas === 'function') {
             window.calcularPrevisaoInteligenteGas(tipoItem);
         }
         return;
     }
    console.log(`Calculando previsão para Água...`);
    const alertId = `alertas-previsao-agua`;
    const resultadoContainerId = `resultado-previsao-agua-v2`;
    
    if (!window.modoPrevisao.agua) {
        window.showAlert(alertId, 'Por favor, selecione um modo de previsão primeiro (Etapa 1).', 'warning');
        return;
    }

    const diasPrevisao = parseInt(document.getElementById(`dias-previsao-agua`).value, 10) || 7;
    const margemSeguranca = (parseInt(document.getElementById(`margem-seguranca-agua`).value, 10) || 15) / 100;
    
    let unidadeIdFiltro = null;
    let tipoUnidadeFiltro = null;

    if (window.modoPrevisao.agua === 'unidade-especifica') {
        unidadeIdFiltro = document.getElementById(`select-previsao-unidade-agua-v2`).value;
        if (!unidadeIdFiltro) {
            window.showAlert(alertId, 'Por favor, selecione uma unidade específica (Etapa 2).', 'warning');
            return;
        }
    } else if (window.modoPrevisao.agua === 'por-tipo') {
        tipoUnidadeFiltro = document.getElementById(`select-previsao-tipo-agua`).value;
         if (!tipoUnidadeFiltro) {
            window.showAlert(alertId, 'Por favor, selecione um tipo de unidade (Etapa 2).', 'warning');
            return;
        }
    }
    
    document.getElementById(resultadoContainerId).classList.remove('hidden');
    const resultadoContentEl = document.getElementById(`resultado-content-agua`);
    const alertasContentEl = document.getElementById(alertId);
    resultadoContentEl.innerHTML = '<div class="loading-spinner-small mx-auto" style="border-color: #fff; border-top-color: #ccc;"></div>';
    alertasContentEl.innerHTML = ''; 

    const movimentacoes = window.fb_agua_movimentacoes || []; // **CORREÇÃO**: Garante que exista
    const idsExcluidos = new Set(window.listaExclusoes.agua.map(item => item.id)); 
    
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

    let tituloPrevisao = "Previsão Completa (Água)";
    if (window.modoPrevisao.agua === 'unidade-especifica') {
        const unidade = window.fb_unidades.find(u => u.id === unidadeIdFiltro);
        tituloPrevisao = `Previsão (Água) para: ${unidade?.nome || 'Unidade Desconhecida'}`;
    } else if (window.modoPrevisao.agua === 'por-tipo') {
        tituloPrevisao = `Previsão (Água) para tipo: ${tipoUnidadeFiltro}`;
    }

    if (movsFiltradas.length < 2) {
        resultadoContentEl.innerHTML = `<p class="text-yellow-200">Dados insuficientes para calcular (necessário no mínimo 2 entregas no período/filtro).</p>`;
        if (window.graficoPrevisao.agua) window.graficoPrevisao.agua.destroy(); 
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
        <p class="text-xs opacity-70 mt-3 text-center">Cálculo baseado em ${totalQuantidade} unidades entregues entre ${window.formatTimestamp(movsFiltradas[0].data)} e ${window.formatTimestamp(movsFiltradas[movsFiltradas.length - 1].data)} (${diffDays} dias).</p>
         ${window.listaExclusoes.agua.length > 0 ? `<p class="text-xs opacity-70 mt-1 text-center text-red-200">Excluídas: ${window.listaExclusoes.agua.map(u=>u.nome).join(', ')}</p>` : ''}
    `;
    
    renderizarGraficoPrevisao('agua', movsFiltradas);
    
    // **CORREÇÃO**: Garante que estoqueAguaAtualEl existe
    const estoqueAtualText = window.estoqueAguaAtualEl?.textContent || '0';
    const estoqueAtual = parseInt(estoqueAtualText, 10) || 0;
        
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
         // Mostra o alerta de sucesso que normalmente fica escondido
         document.querySelector(`#${alertId} .alert-success`).style.display = 'block'; 
    }
     window.lucide.createIcons(); 
}
if (typeof window.calcularPrevisaoInteligente === 'function' && typeof window.calcularPrevisaoInteligenteGas === 'undefined') {
    window.calcularPrevisaoInteligenteGas = window.calcularPrevisaoInteligente;
}


// Renderiza o gráfico de previsão
function renderizarGraficoPrevisao(tipoItem, movsFiltradas) {
    // **CORREÇÃO DE ESCOPO**: Usa window.domReady, window.graficoPrevisao, etc.
     if (!window.domReady) return; 
    if (tipoItem !== 'agua') return; 
    const canvasId = `grafico-previsao-agua`;
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const dadosPorDia = movsFiltradas.reduce((acc, m) => {
        const dataFormatada = window.formatTimestamp(m.data);
        if (!acc[dataFormatada]) {
            acc[dataFormatada] = { timestamp: m.data.toMillis(), total: 0 };
        }
        acc[dataFormatada].total += m.quantidade;
        return acc;
    }, {});
    
    const diasOrdenados = Object.keys(dadosPorDia).sort((a, b) => dadosPorDia[a].timestamp - dadosPorDia[b].timestamp);
    
    const labels = diasOrdenados;
    const data = diasOrdenados.map(dia => dadosPorDia[dia].total);

    if (window.graficoPrevisao.agua) { // Usa a variável global
        window.graficoPrevisao.agua.destroy();
    }
    
    window.graficoPrevisao.agua = new Chart(ctx, { // Atribui à variável global
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

