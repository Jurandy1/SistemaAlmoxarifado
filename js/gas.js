/* =============================================================
   MÓDULO: Controle de Gás
   Funções:
     - initGas() -> NOVO: Chamado pelo app.js
     - toggleGasFormInputs()
     - handleGasSubmit()
     - renderGasStatus()
     - handleInicialEstoqueSubmit() // Chamado pelo listener no app.js
     - handleEntradaEstoqueSubmit() // Chamado pelo listener no app.js
     - renderEstoqueGas()
     - renderHistoricoGas()
     - selecionarModoPrevisao() // Chamado pelo HTML
     - adicionarExclusao() // Chamado pelo HTML
     - removerExclusao() // Chamado pelo HTML
     - calcularPrevisaoInteligente() // Chamado pelo HTML
     - renderizarGraficoPrevisao()
     - handleTipoPrevisaoChange() // Adicionado internamente
   Autor: Jurandy Santana (Refatorado por Gemini)
   ============================================================= */

// **NOTA**: Este arquivo já estava no formato correto, usando initGas().
// Nenhuma correção foi necessária aqui, apenas garantimos que ele segue
// o padrão dos outros arquivos corrigidos.

function initGas() {
    console.log("Inicializando módulo de Gás...");
    // Adiciona listeners específicos de Gás
    if (formGas) formGas.addEventListener('submit', handleGasSubmit); 
    if (selectTipoGas) selectTipoGas.addEventListener('change', toggleGasFormInputs);
    if (formEntradaGas) formEntradaGas.addEventListener('submit', handleEntradaEstoqueSubmit);
    if (btnAbrirInicialGas) btnAbrirInicialGas.addEventListener('click', () => { if(formInicialGasContainer) formInicialGasContainer.classList.remove('hidden'); if(btnAbrirInicialGas) btnAbrirInicialGas.classList.add('hidden'); });
    if (formInicialGas) formInicialGas.addEventListener('submit', handleInicialEstoqueSubmit);
    document.getElementById('filtro-status-gas')?.addEventListener('input', (e) => filterTable(e.target, 'table-status-gas'));
    document.getElementById('filtro-historico-gas')?.addEventListener('input', (e) => filterTable(e.target, 'table-historico-gas'));

    // Inicializa a visibilidade correta dos inputs Qtd
    toggleGasFormInputs();
}

// **NOVO**: Torna a função initGas acessível globalmente para o app.js
window.initGas = initGas;


// --- LÓGICA DE CONTROLE DE GÁS ---

// Alterna a visibilidade dos campos de quantidade (Entregue/Recebido) baseado no Tipo de Movimentação
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

// Processa o envio do formulário de movimentação de gás
async function handleGasSubmit(e) {
    e.preventDefault();
    if (!isAuthReady) { showAlert('alert-gas', 'Erro: Não autenticado.', 'error'); return; }
    if (!domReady) { showAlert('alert-gas', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
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
        if (!estoqueInicialDefinido.gas) { // Usa variável global
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
        const timestamp = serverTimestamp(); // Usa global
        if (qtdEntregue > 0) {
            // Usa gasCollection (global)
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

// Renderiza a tabela de status (saldo) de gás por unidade
function renderGasStatus() {
    if (!tableStatusGas) return;
    if (!domReady) { console.warn("renderGasStatus chamada antes do DOM pronto."); return; }

    const statusMap = new Map();
     // Usa fb_unidades (global)
     fb_unidades.forEach(u => { 
        let tipoNormalizado = (u.tipo || 'N/A').toUpperCase();
        if (tipoNormalizado === 'SEMCAS') tipoNormalizado = 'SEDE';
        statusMap.set(u.id, { id: u.id, nome: u.nome, tipo: tipoNormalizado, entregues: 0, recebidos: 0, ultimosLancamentos: [] }); 
    });

    // Usa fb_gas_movimentacoes (global)
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


// --- LÓGICA DE ESTOQUE DE GÁS ---

// Processa o envio do formulário de estoque inicial
async function handleInicialEstoqueSubmit(e) {
    e.preventDefault();
     if (!domReady) return; 
    const tipoEstoque = e.target.id.includes('agua') ? 'agua' : 'gas'; 
    if(tipoEstoque !== 'gas') return; // Garante que só processe gás aqui
    
    const inputQtd = document.getElementById(`input-inicial-qtd-gas`).value;
    const inputResp = document.getElementById(`input-inicial-responsavel-gas`).value;
    const btnSubmit = document.getElementById(`btn-submit-inicial-gas`);
    const alertElId = `alert-inicial-gas`;
    
    const quantidade = parseInt(inputQtd, 10);
    const responsavel = capitalizeString(inputResp.trim());

    if (isNaN(quantidade) || quantidade < 0 || !responsavel) { 
        showAlert(alertElId, "Preencha a quantidade e o responsável.", 'warning'); return; 
    }
    
    if (estoqueInicialDefinido.gas) { // Usa a variável global
         showAlert(alertElId, "O estoque inicial já foi definido.", 'info'); 
         document.getElementById(`form-inicial-gas-container`).classList.add('hidden');
         document.getElementById(`btn-abrir-inicial-gas`).classList.add('hidden');
         document.getElementById(`resumo-estoque-gas`).classList.remove('hidden'); 
         return;
    }
    
    btnSubmit.disabled = true; btnSubmit.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    
    try {
        await addDoc(estoqueGasCollection, { // Usa a collection global
            tipo: 'inicial', 
            quantidade: quantidade, 
            data: serverTimestamp(), 
            responsavel: responsavel, 
            notaFiscal: 'INICIAL', 
            registradoEm: serverTimestamp() 
        });
        showAlert(alertElId, "Estoque inicial salvo!", 'success', 2000);
         document.getElementById(`form-inicial-gas-container`).classList.add('hidden');
         document.getElementById(`btn-abrir-inicial-gas`).classList.add('hidden');
    } catch (error) {
        console.error("Erro ao salvar estoque inicial:", error);
        showAlert(alertElId, `Erro ao salvar: ${error.message}`, 'error');
        btnSubmit.disabled = false; btnSubmit.textContent = 'Salvar Inicial'; 
    }
}

// Processa o envio do formulário de entrada de estoque
async function handleEntradaEstoqueSubmit(e) {
    e.preventDefault();
    if (!isAuthReady) { showAlert('alert-gas', 'Erro: Não autenticado.', 'error'); return; } 
    if (!domReady) { showAlert('alert-gas', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
    
    const tipoEstoque = e.target.id.includes('agua') ? 'agua' : 'gas';
    if(tipoEstoque !== 'gas') return; // Garante que só processe gás aqui
    const alertElementId = `alert-gas`; 
    
    const inputQtd = document.getElementById(`input-qtd-entrada-gas`).value;
    const inputData = document.getElementById(`input-data-entrada-gas`).value;
    const inputResp = document.getElementById(`input-responsavel-entrada-gas`).value;
    const inputNf = document.getElementById(`input-nf-entrada-gas`).value;
    const btnSubmit = document.getElementById(`btn-submit-entrada-gas`);
    const form = document.getElementById(`form-entrada-gas`);
    
    const quantidade = parseInt(inputQtd, 10);
    const data = dateToTimestamp(inputData);
    const responsavel = capitalizeString(inputResp.trim());
    const notaFiscal = inputNf.trim() || 'N/A'; 

    if (!quantidade || quantidade <= 0 || !data || !responsavel) { 
        showAlert(alertElementId, 'Dados inválidos. Verifique quantidade, data e responsável.', 'warning'); return; 
    }
    if (!estoqueInicialDefinido.gas) { // Usa a variável global
        showAlert(alertElementId, `Defina o Estoque Inicial de Gás antes de lançar entradas.`, 'warning'); return; 
    }
    
    btnSubmit.disabled = true; btnSubmit.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    
    try {
        await addDoc(estoqueGasCollection, { // Usa a collection global
            tipo: 'entrada', 
            quantidade: quantidade, 
            data: data, 
            responsavel: responsavel, 
            notaFiscal: notaFiscal, 
            registradoEm: serverTimestamp() 
        });
        showAlert(alertElementId, 'Entrada no estoque salva!', 'success');
        form.reset(); 
        document.getElementById(`input-data-entrada-gas`).value = getTodayDateString(); 
    } catch (error) {
        console.error("Erro salvar entrada estoque:", error); 
        showAlert(alertElementId, `Erro: ${error.message}`, 'error');
    } finally { 
        btnSubmit.disabled = false; btnSubmit.textContent = 'Salvar Entrada'; 
    }
}

// Renderiza o resumo do estoque de gás
function renderEstoqueGas() {
     if (!estoqueGasAtualEl) return;
     if (!domReady) { console.warn("renderEstoqueGas chamada antes do DOM pronto."); return; }
    if (loadingEstoqueGasEl) loadingEstoqueGasEl.style.display = 'none';
    
    if (estoqueInicialDefinido.gas) { // Usa a variável global
        if(btnAbrirInicialGas) btnAbrirInicialGas.classList.add('hidden'); 
        if(formInicialGasContainer) formInicialGasContainer.classList.add('hidden'); 
        if(resumoEstoqueGasEl) resumoEstoqueGasEl.classList.remove('hidden');
    } else { 
        if(btnAbrirInicialGas) btnAbrirInicialGas.classList.remove('hidden'); 
        if(resumoEstoqueGasEl) resumoEstoqueGasEl.classList.add('hidden'); 
    }

    // Usa os arrays globais fb_estoque_gas e fb_gas_movimentacoes
    const estoqueInicial = fb_estoque_gas.filter(e => e.tipo === 'inicial').reduce((sum, e) => sum + e.quantidade, 0);
    const totalEntradas = fb_estoque_gas.filter(e => e.tipo === 'entrada').reduce((sum, e) => sum + e.quantidade, 0);
    const totalSaidas = fb_gas_movimentacoes.filter(m => m.tipo === 'entrega').reduce((sum, m) => sum + m.quantidade, 0);
    const estoqueAtual = estoqueInicial + totalEntradas - totalSaidas;

    estoqueGasInicialEl.textContent = estoqueInicial;
    estoqueGasEntradasEl.textContent = `+${totalEntradas}`;
    estoqueGasSaidasEl.textContent = `-${totalSaidas}`;
    estoqueGasAtualEl.textContent = estoqueAtual;
    
    // Atualiza o card no dashboard também
    renderDashboardVisaoGeralSummary(); 
}

// Renderiza a tabela de histórico de entradas no estoque de gás
function renderHistoricoGas() {
     if (!tableHistoricoGas) return;
     if (!domReady) { console.warn("renderHistoricoGas chamada antes do DOM pronto."); return; }
    
    // Usa o array global fb_estoque_gas
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


// --- LÓGICA DE PREVISÃO INTELIGENTE DE GÁS ---

// Seleciona o modo de previsão (chamado pelo HTML)
// A função agora usa as variáveis globais modoPrevisao, listaExclusoes, tipoSelecionadoPrevisao
// e chama as funções globais populateUnidadeSelects e renderizarListaExclusoes
window.selecionarModoPrevisao = (tipoItem, modo) => {
    // **CORREÇÃO**: Verifica ambos os tipos, mas só atua se for o tipo correto
    if (tipoItem !== 'agua' && tipoItem !== 'gas') return;
    if (!domReady) return; 
    
    // Se for 'agua', o agua.js (que também tem essa função) vai pegar.
    // Este arquivo só deve tratar 'gas'.
    if (tipoItem !== 'gas') return; 
    
    console.log(`Modo Previsão (Gás): ${modo}`);
    modoPrevisao.gas = modo;
    
    const configContainer = document.getElementById(`config-previsao-gas`);
    const cards = document.querySelectorAll(`#subview-previsao-gas .previsao-option-card`);
    const selectUnidadeContainer = document.getElementById(`select-unidade-container-gas`);
    const selectTipoContainer = document.getElementById(`select-tipo-container-gas`);
    const selectTipoEl = document.getElementById(`select-previsao-tipo-gas`); 
    const exclusaoContainer = document.getElementById(`exclusao-container-gas`);
    const selectExclusaoEl = document.getElementById(`select-exclusao-gas`); 

    configContainer.classList.remove('hidden');
    selectUnidadeContainer.classList.add('hidden');
    selectTipoContainer.classList.add('hidden');
    exclusaoContainer.classList.remove('hidden'); 
    
    cards.forEach(card => card.classList.toggle('selected', card.dataset.modo === modo));

    if (modo === 'unidade-especifica') {
        selectUnidadeContainer.classList.remove('hidden');
        exclusaoContainer.classList.add('hidden'); 
        tipoSelecionadoPrevisao.gas = null; 
    } else if (modo === 'por-tipo') {
        selectTipoContainer.classList.remove('hidden');
        tipoSelecionadoPrevisao.gas = selectTipoEl.value; 
        populateUnidadeSelects(selectExclusaoEl, 'atendeGas', false, true, tipoSelecionadoPrevisao.gas); 
    } else if (modo === 'completo') {
        tipoSelecionadoPrevisao.gas = null; 
         populateUnidadeSelects(selectExclusaoEl, 'atendeGas', false, true, null);
    }

    listaExclusoes.gas = [];
    renderizarListaExclusoes('gas');
    
    // Remove listener antigo (se existir) e adiciona o novo
    selectTipoEl.removeEventListener('change', handleTipoPrevisaoChangeGas); 
    selectTipoEl.addEventListener('change', handleTipoPrevisaoChangeGas); 
}

// Handler específico para mudança de tipo na previsão de gás
function handleTipoPrevisaoChangeGas(event) {
    if (!domReady) return; 
    const selectEl = event.target;
    const novoTipo = selectEl.value;
    tipoSelecionadoPrevisao.gas = novoTipo; 
    
    const selectExclusaoEl = document.getElementById(`select-exclusao-gas`);
    populateUnidadeSelects(selectExclusaoEl, 'atendeGas', false, true, novoTipo); 
    
    listaExclusoes.gas = [];
    renderizarListaExclusoes('gas');
}

// Adiciona unidade à lista de exclusão (chamado pelo HTML)
window.adicionarExclusao = (tipoItem) => {
    // **CORREÇÃO**: Verifica ambos os tipos, mas só atua se for o tipo correto
    if (tipoItem !== 'agua' && tipoItem !== 'gas') return;
    if (!domReady) return; 
    if (tipoItem !== 'gas') return; 
    
    const selectExclusao = document.getElementById(`select-exclusao-gas`);
    const unidadeId = selectExclusao.value;
    if (!unidadeId || unidadeId === 'todas') return; 
    
    if (listaExclusoes.gas.find(item => item.id === unidadeId)) {
        selectExclusao.value = ""; 
        return;
    }

    const unidadeNome = selectExclusao.options[selectExclusao.selectedIndex].text;
    listaExclusoes.gas.push({ id: unidadeId, nome: unidadeNome });
    
    renderizarListaExclusoes('gas'); 
    selectExclusao.value = ""; 
}

// Renderiza a lista de unidades excluídas
function renderizarListaExclusoes(tipoItem) {
     if (tipoItem !== 'gas' || !domReady) return; 
    const container = document.getElementById(`lista-exclusoes-gas`);
    container.innerHTML = listaExclusoes.gas.map((item, index) => `
        <span class="exclusao-item">
            ${item.nome}
            <button type="button" onclick="removerExclusao('gas', ${index})">&times;</button>
        </span>
    `).join('');
}

// Remove unidade da lista de exclusão (chamado pelo HTML)
window.removerExclusao = (tipoItem, index) => {
     // **CORREÇÃO**: Verifica ambos os tipos, mas só atua se for o tipo correto
    if (tipoItem !== 'agua' && tipoItem !== 'gas') return;
    if (!domReady) return; 
    if (tipoItem !== 'gas') return; 
    
    listaExclusoes.gas.splice(index, 1); 
    renderizarListaExclusoes('gas'); 
}

// Calcula a previsão inteligente (chamado pelo HTML)
window.calcularPrevisaoInteligente = (tipoItem) => {
    // **CORREÇÃO**: Verifica ambos os tipos, mas só atua se for o tipo correto
    if (tipoItem !== 'agua' && tipoItem !== 'gas') return;
    if (!domReady) return; 
    if (tipoItem !== 'gas') return; 
    
    console.log(`Calculando previsão para Gás...`);
    const alertId = `alertas-previsao-gas`;
    const resultadoContainerId = `resultado-previsao-gas-v2`;
    
    if (!modoPrevisao.gas) {
        showAlert(alertId, 'Por favor, selecione um modo de previsão primeiro (Etapa 1).', 'warning');
        return;
    }

    const diasPrevisao = parseInt(document.getElementById(`dias-previsao-gas`).value, 10) || 7;
    const margemSeguranca = (parseInt(document.getElementById(`margem-seguranca-gas`).value, 10) || 15) / 100;
    
    let unidadeIdFiltro = null;
    let tipoUnidadeFiltro = null;

    if (modoPrevisao.gas === 'unidade-especifica') {
        unidadeIdFiltro = document.getElementById(`select-previsao-unidade-gas-v2`).value;
        if (!unidadeIdFiltro) {
            showAlert(alertId, 'Por favor, selecione uma unidade específica (Etapa 2).', 'warning');
            return;
        }
    } else if (modoPrevisao.gas === 'por-tipo') {
        tipoUnidadeFiltro = document.getElementById(`select-previsao-tipo-gas`).value;
         if (!tipoUnidadeFiltro) {
            showAlert(alertId, 'Por favor, selecione um tipo de unidade (Etapa 2).', 'warning');
            return;
        }
    }
    
    document.getElementById(resultadoContainerId).classList.remove('hidden');
    const resultadoContentEl = document.getElementById(`resultado-content-gas`);
    const alertasContentEl = document.getElementById(alertId);
    resultadoContentEl.innerHTML = '<div class="loading-spinner-small mx-auto" style="border-color: #fff; border-top-color: #ccc;"></div>';
    alertasContentEl.innerHTML = ''; 

    const movimentacoes = fb_gas_movimentacoes; // Usa array global
    const idsExcluidos = new Set(listaExclusoes.gas.map(item => item.id)); // Usa array global
    
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

    let tituloPrevisao = "Previsão Completa (Gás)";
    if (modoPrevisao.gas === 'unidade-especifica') {
        const unidade = fb_unidades.find(u => u.id === unidadeIdFiltro);
        tituloPrevisao = `Previsão (Gás) para: ${unidade?.nome || 'Unidade Desconhecida'}`;
    } else if (modoPrevisao.gas === 'por-tipo') {
        tituloPrevisao = `Previsão (Gás) para tipo: ${tipoUnidadeFiltro}`;
    }

    if (movsFiltradas.length < 2) {
        resultadoContentEl.innerHTML = `<p class="text-yellow-200">Dados insuficientes para calcular (necessário no mínimo 2 entregas no período/filtro).</p>`;
        if (graficoPrevisao.gas) graficoPrevisao.gas.destroy(); 
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
         ${listaExclusoes.gas.length > 0 ? `<p class="text-xs opacity-70 mt-1 text-center text-red-200">Excluídas: ${listaExclusoes.gas.map(u=>u.nome).join(', ')}</p>` : ''}
    `;
    
    renderizarGraficoPrevisao('gas', movsFiltradas);
    
    const estoqueAtual = parseInt(estoqueGasAtualEl?.textContent || '0') || 0;
        
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

// Renderiza o gráfico de previsão
function renderizarGraficoPrevisao(tipoItem, movsFiltradas) {
    if (tipoItem !== 'gas' || !domReady) return; 
    const canvasId = `grafico-previsao-gas`;
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

    if (graficoPrevisao.gas) { // Usa a variável global
        graficoPrevisao.gas.destroy();
    }
    
    graficoPrevisao.gas = new Chart(ctx, { // Atribui à variável global
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Consumo Diário (Entregas)',
                data: data,
                borderColor: '#f97316', // Laranja para gás
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
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
