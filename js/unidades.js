/* =============================================================
   MÓDULO: Gestão de Unidades
   Funções:
     - initUnidades() -> NOVO: Chamado pelo app.js
     - renderGestaoUnidades()
     - handleGestaoToggle()
     - handleEditUnidadeClick()
     - handleCancelEditUnidadeClick()
     - handleSaveUnidadeClick()
     - handleBulkAddUnidades()
   Autor: Jurandy Santana (Refatorado por Gemini)
   ============================================================= */

// Importa funções do Firestore necessárias para este módulo
import { doc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// **CORREÇÃO**: Removemos o 'DOMContentLoaded' e criamos a função initUnidades()
// que será chamada pelo app.js quando o DOM e o Firebase estiverem prontos.
function initUnidades() {
    console.log("Inicializando módulo de Unidades...");
    // Adiciona listeners específicos de Gestão de Unidades
    if (tableGestaoUnidades) { 
        // Usa delegação de eventos para os botões dentro da tabela
        tableGestaoUnidades.addEventListener('click', (e) => {
            if (e.target.closest('.btn-edit-unidade')) {
                handleEditUnidadeClick(e);
            } else if (e.target.closest('.btn-cancel-edit-unidade')) {
                handleCancelEditUnidadeClick(e);
            } else if (e.target.closest('.btn-save-unidade')) {
                handleSaveUnidadeClick(e);
            }
        });
        // Listener para os toggles
        tableGestaoUnidades.addEventListener('change', handleGestaoToggle);
    }
    
    // Listeners dos filtros e botão de adicionar em lote
    if (filtroUnidadeNome) filtroUnidadeNome.addEventListener('input', renderGestaoUnidades); 
    if (filtroUnidadeTipo) filtroUnidadeTipo.addEventListener('input', renderGestaoUnidades); 
    if (btnBulkAddUnidades) btnBulkAddUnidades.addEventListener('click', handleBulkAddUnidades);
}

// **NOVO**: Torna a função initUnidades acessível globalmente para o app.js
window.initUnidades = initUnidades;


// --- LÓGICA DE GESTÃO DE UNIDADES ---

// Renderiza a tabela de gestão de unidades
function renderGestaoUnidades() {
    if (!tableGestaoUnidades) return;
     if (!domReady) { console.warn("renderGestaoUnidades chamada antes do DOM pronto."); return; }
    
    // Usa filtros globais
    const filtroNome = normalizeString(filtroUnidadeNome.value);
    const filtroTipo = normalizeString(filtroUnidadeTipo.value);
    
    // Usa fb_unidades (global)
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
         // Os data-* attributes são usados pelos handlers de clique/change
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

// Handler para mudança no status (checkbox toggle)
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
        const docRef = doc(unidadesCollection, id); // Usa collection global
        await updateDoc(docRef, { [field]: value });
        showAlert('alert-gestao', 'Status atualizado!', 'success', 2000); // Usa função global
        // O listener do Firestore atualizará o array fb_unidades e chamará renderGestaoUnidades
    } catch (error) { 
        console.error("Erro atualizar unidade:", error); 
        showAlert('alert-gestao', `Erro: ${error.message}`, 'error'); // Usa função global
        checkbox.checked = !value; // Reverte visualmente em caso de erro
    } finally { 
        checkbox.disabled = false; 
    }
}

// Handler para clique no botão de editar nome
function handleEditUnidadeClick(e) {
    const button = e.target.closest('.btn-edit-unidade');
    if (!button) return;
    
    const td = button.closest('td');
    const row = td.closest('tr');
    // Não permite editar outra linha se uma já estiver em edição
    if (document.querySelector('.editing-row') && !row.classList.contains('editing-row')) {
        showAlert('alert-gestao', 'Salve ou cancele a edição atual antes de editar outra unidade.', 'warning');
        return;
    }

    const nomeSpan = td.querySelector('.unidade-nome-display');
    const currentName = nomeSpan.textContent;

    // Substitui o conteúdo da célula pelo input e botões de salvar/cancelar
    td.innerHTML = `
        <input type="text" value="${currentName}" class="edit-input w-full" placeholder="Novo nome da unidade">
        <div class="mt-1 space-x-1">
            <button class="btn-icon btn-save-unidade text-green-600 hover:text-green-800" title="Salvar"><i data-lucide="check"></i></button>
            <button class="btn-icon btn-cancel-edit-unidade text-red-600 hover:text-red-800" title="Cancelar"><i data-lucide="x"></i></button>
        </div>
    `;
    row.classList.add('editing-row'); // Marca a linha como em edição
    lucide.createIcons(); 
    td.querySelector('input').focus(); 
    td.querySelector('input').select(); // Seleciona o texto
}

// Handler para clique no botão de cancelar edição
function handleCancelEditUnidadeClick(e) {
    const button = e.target.closest('.btn-cancel-edit-unidade');
    if (!button) return;
    
    const td = button.closest('td');
    const row = td.closest('tr');
    const unidadeId = row.dataset.unidadeId;
    const unidade = fb_unidades.find(u => u.id === unidadeId); // Busca nome original no array global
    
    // Restaura o conteúdo original da célula
    td.innerHTML = `
        <span class="unidade-nome-display">${unidade?.nome || 'Erro ao recuperar nome'}</span> 
        <button class="btn-icon btn-edit-unidade ml-1" title="Editar nome"><i data-lucide="pencil"></i></button>
    `;
    row.classList.remove('editing-row'); 
    lucide.createIcons(); 
}

// Handler para clique no botão de salvar edição
async function handleSaveUnidadeClick(e) {
    const button = e.target.closest('.btn-save-unidade');
    if (!button) return;
    
    const td = button.closest('td');
    const row = td.closest('tr');
    const unidadeId = row.dataset.unidadeId;
    const input = td.querySelector('.edit-input');
    const newName = capitalizeString(input.value.trim()); // Usa função global

    if (!newName) {
        showAlert('alert-gestao', 'O nome da unidade não pode ser vazio.', 'warning'); // Usa função global
        input.focus();
        return;
    }

    // Desabilita botões durante o salvamento
    button.disabled = true;
    const cancelButton = td.querySelector('.btn-cancel-edit-unidade');
    if(cancelButton) cancelButton.disabled = true;
    button.innerHTML = '<div class="loading-spinner-small inline-block" style="width: 1em; height: 1em; border-width: 2px;"></div>';

    try {
        const docRef = doc(unidadesCollection, unidadeId); // Usa collection global
        await updateDoc(docRef, { nome: newName });
        
        // Atualiza a célula visualmente (o listener do Firestore fará isso também, mas isso é mais rápido)
        td.innerHTML = `
            <span class="unidade-nome-display">${newName}</span>
            <button class="btn-icon btn-edit-unidade ml-1" title="Editar nome"><i data-lucide="pencil"></i></button>
        `;
         row.classList.remove('editing-row'); 
        lucide.createIcons(); 
        showAlert('alert-gestao', 'Nome da unidade atualizado!', 'success', 2000); // Usa função global
    
    } catch (error) {
        console.error("Erro ao salvar nome da unidade:", error);
        showAlert('alert-gestao', `Erro ao salvar: ${error.message}`, 'error'); // Usa função global
        // Reabilita botões em caso de erro
        button.disabled = false;
         if(cancelButton) cancelButton.disabled = false;
        button.innerHTML = '<i data-lucide="check"></i>'; 
        lucide.createIcons();
    }
}

// Handler para adicionar unidades em lote
async function handleBulkAddUnidades() {
     if (!isAuthReady || !textareaBulkUnidades) return;
     if (!domReady) { showAlert('alert-gestao', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
     
     const text = textareaBulkUnidades.value.trim();
     if (!text) { showAlert('alert-gestao', 'A área de texto está vazia.', 'warning'); return; }
     
     const lines = text.split('\n');
     const unidadesParaAdd = [];
     const erros = [];
     
     lines.forEach((line, index) => {
         const parts = line.split('\t'); // Separado por TAB
         if (parts.length === 2) {
             let tipo = parts[0].trim().toUpperCase(); 
             if (tipo === 'SEMCAS') tipo = 'SEDE'; // Normaliza SEMCAS para SEDE
             const nome = capitalizeString(parts[1].trim()); // Usa função global
             
             if (tipo && nome) {
                 // Verifica se já existe (case-insensitive e tipo normalizado)
                 const existe = fb_unidades.some(u => { // Usa array global
                     let uTipo = (u.tipo || '').toUpperCase();
                     if (uTipo === 'SEMCAS') uTipo = 'SEDE';
                     return normalizeString(u.nome) === normalizeString(nome) && uTipo === tipo;
                 });
                 if (!existe) {
                     // Adiciona com serviços habilitados por padrão
                     unidadesParaAdd.push({ nome, tipo, atendeAgua: true, atendeGas: true, atendeMateriais: true });
                 } else {
                     console.log(`Unidade já existe (ignorada): ${tipo} - ${nome}`);
                     erros.push(`Linha ${index + 1}: Unidade "${nome}" (${tipo}) já existe.`);
                 }
             } else { erros.push(`Linha ${index + 1}: Tipo ou Nome vazio.`); }
         } else if (line.trim()) { 
             erros.push(`Linha ${index + 1}: Formato inválido (use TIPO [TAB] NOME).`);
         }
     });

     if (unidadesParaAdd.length === 0) {
         showAlert('alert-gestao', 'Nenhuma unidade nova para adicionar (verifique formato e duplicados).', 'info');
         if(erros.length > 0) console.warn("Erros/Avisos na importação em lote:", erros);
         return;
     }
     
     btnBulkAddUnidades.disabled = true; btnBulkAddUnidades.innerHTML = '<div class="loading-spinner-small mx-auto"></div> Adicionando...';
     let adicionadasCount = 0;
     
     try {
         // Adiciona uma por uma (mais simples que batch write aqui)
         for (const unidade of unidadesParaAdd) {
             await addDoc(unidadesCollection, unidade); // Usa collection global
             adicionadasCount++;
         }
         showAlert('alert-gestao', `${adicionadasCount} unidade(s) adicionada(s) com sucesso!`, 'success');
         textareaBulkUnidades.value = ''; 
         
         if(erros.length > 0) {
              showAlert('alert-gestao', `Algumas linhas foram ignoradas. Verifique o console (F12) para detalhes.`, 'warning', 8000);
              console.warn("Erros/Avisos na importação em lote:", erros);
         }
         // O listener do Firestore atualizará a tabela
     } catch (error) {
         console.error("Erro ao adicionar unidades em lote:", error);
         showAlert('alert-gestao', `Erro ao adicionar unidades: ${error.message}. ${adicionadasCount} foram adicionadas antes do erro.`, 'error');
     } finally {
         btnBulkAddUnidades.disabled = false; btnBulkAddUnidades.textContent = 'Adicionar Unidades';
     }
}
