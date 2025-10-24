/* =============================================================
   MÓDULO: Controle de Materiais
   Funções:
     - handleMateriaisSubmit()
     - renderMateriaisStatus()
     - handleMarcarRetirada()
     - handleMarcarEntregue()
     - abrirModalDefinirResponsavel()
     - fecharModalResponsavel()
     - confirmarResponsavelSeparacao()
     - baixarArquivoMaterial()
   Autor: Jurandy Santana (Refatorado por Gemini)
   ============================================================= */

// Importa funções específicas de Storage do SDK do Firebase
// (Assumindo que o storage já foi inicializado em app.js)
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js"; 
import { doc, updateDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', () => {
    // Adiciona listeners específicos de Materiais
    if (formMateriais) formMateriais.addEventListener('submit', handleMateriaisSubmit); 
    document.getElementById('filtro-status-materiais')?.addEventListener('input', (e) => filterTable(e.target, 'table-status-materiais'));

    // Listeners para botões de ação na tabela (delegação de eventos)
    // O listener principal para remoção está em app.js
    // Adiciona listeners para Marcar Retirada e Entregue
     const mainElement = document.querySelector('main');
     if(mainElement){
         mainElement.addEventListener('click', (e) => {
             const entregueBtn = e.target.closest('button.btn-entregue[data-id]');
             const retiradaBtn = e.target.closest('button.btn-retirada[data-id]');
             
             if (entregueBtn) { handleMarcarEntregue(e); }
             else if (retiradaBtn) { handleMarcarRetirada(e); } 
         });
     }

     // Listeners do modal de definir responsável
    if (btnCancelarResponsavelSeparacao) btnCancelarResponsavelSeparacao.addEventListener('click', fecharModalResponsavel);
    if (btnConfirmarResponsavelSeparacao) btnConfirmarResponsavelSeparacao.addEventListener('click', confirmarResponsavelSeparacao);
    if (document.getElementById('btn-fechar-modal-responsavel')) document.getElementById('btn-fechar-modal-responsavel').addEventListener('click', fecharModalResponsavel);

});


// --- LÓGICA DE CONTROLE DE MATERIAIS ---

// Processa o envio do formulário de registro de separação
async function handleMateriaisSubmit(e) {
    e.preventDefault();
    if (!isAuthReady) { showAlert('alert-materiais', 'Erro: Não autenticado.', 'error'); return; }
     if (!domReady) { showAlert('alert-materiais', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
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

    // Validar arquivo (se presente)
    const arquivo = inputArquivoMateriais.files[0];
    if (arquivo) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        
        if (arquivo.size > maxSize) {
            showAlert('alert-materiais', 'Arquivo muito grande! Tamanho máximo: 10MB', 'warning');
            return;
        }
        
        // Verifica tipo MIME e extensão
        const fileExtension = arquivo.name.split('.').pop().toLowerCase();
        if (!allowedTypes.includes(arquivo.type) && !['pdf', 'xls', 'xlsx'].includes(fileExtension)) {
            showAlert('alert-materiais', 'Tipo de arquivo inválido! Use PDF, XLS ou XLSX.', 'warning');
            return;
        }
    }
    
    btnSubmitMateriais.disabled = true; btnSubmitMateriais.innerHTML = '<div class="loading-spinner-small mx-auto"></div> Salvando...';
    
    try {
        let arquivoData = null;
        
        // Se há arquivo, fazer upload primeiro
        if (arquivo) {
            const timestamp = Date.now();
            const nomeArquivoSanitizado = arquivo.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const storagePath = `materiais/${timestamp}_${nomeArquivoSanitizado}`;
            // Usa 'storage' global inicializado em app.js
            const storageRef = ref(storage, storagePath); 
            
            btnSubmitMateriais.innerHTML = '<div class="loading-spinner-small mx-auto"></div> Fazendo upload...';
            
            const uploadTask = uploadBytesResumable(storageRef, arquivo);
            
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        btnSubmitMateriais.innerHTML = `<div class="loading-spinner-small mx-auto"></div> Upload ${Math.round(progress)}%`;
                    },
                    (error) => reject(error),
                    () => resolve()
                );
            });
            
            arquivoData = {
                arquivoNomeOriginal: arquivo.name,
                storagePath: storagePath,
                arquivoMimeType: arquivo.type,
                arquivoTamanho: arquivo.size,
                downloadDisponivel: false,
                downloadCount: 0,
                downloadLimite: 2,
                responsavelPelaSeparacao: null // Será definido depois
            };
        }
        
        btnSubmitMateriais.innerHTML = '<div class="loading-spinner-small mx-auto"></div> Salvando...';
        
        const docData = { 
            unidadeId, unidadeNome, tipoUnidade, tipoMaterial, 
            dataSeparacao, itens, status: 'separacao', 
            dataRetirada: null, 
            dataEntrega: null, responsavelSeparacao, 
            responsavelRetirada: null, 
            responsavelEntrega: null, 
            registradoEm: serverTimestamp(), // Usa global
            ...(arquivoData || {})
        };
        
        // Usa materiaisCollection (global) e addDoc (importado)
        await addDoc(materiaisCollection, docData); 
        showAlert('alert-materiais', arquivo ? 'Separação registrada com arquivo anexado!' : 'Separação registrada!', 'success');
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

// Renderiza a tabela de status de materiais
function renderMateriaisStatus() {
     if (!tableStatusMateriais) return;
     if (!domReady) { console.warn("renderMateriaisStatus chamada antes do DOM pronto."); return; }

    // Usa fb_materiais (global)
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
            
            // Se tem arquivo anexado
            if (m.storagePath) {
                const temArquivo = true;
                const downloadLiberado = m.downloadDisponivel === true;
                const downloadCount = m.downloadCount || 0;
                const downloadLimite = m.downloadLimite || 2;
                const downloadEsgotado = downloadCount >= downloadLimite;
                
                if (!downloadLiberado) {
                    // Arquivo anexado mas ainda não liberado
                    acoesHtml = `
                        <button class="btn btn-primary text-xs py-1 px-2" onclick="abrirModalDefinirResponsavel('${m.id}')" title="Definir responsável e liberar download">
                            📄 Definir Responsável
                        </button>
                        <button class="btn-info btn-retirada text-xs py-1 px-2" data-id="${m.id}">Disponível p/ Retirada</button>
                    `;
                } else if (downloadEsgotado) {
                    // Download já esgotado
                    acoesHtml = `
                        <button class="btn btn-secondary text-xs py-1 px-2" disabled title="Limite de downloads atingido">
                            📄 Download Esgotado (${downloadCount}/${downloadLimite})
                        </button>
                        <button class="btn-info btn-retirada text-xs py-1 px-2" data-id="${m.id}">Disponível p/ Retirada</button>
                    `;
                } else {
                    // Download disponível
                    const restantes = downloadLimite - downloadCount;
                    acoesHtml = `
                        <button class="btn btn-success text-xs py-1 px-2" onclick="baixarArquivoMaterial('${m.id}')" title="Baixar arquivo (${restantes} download(s) restante(s))">
                            📥 Baixar (${restantes}/${downloadLimite})
                        </button>
                        <button class="btn-info btn-retirada text-xs py-1 px-2" data-id="${m.id}">Disponível p/ Retirada</button>
                    `;
                }
            } else {
                // Sem arquivo anexado
                acoesHtml = `
                    <button class="btn-info btn-retirada text-xs py-1 px-2" data-id="${m.id}">Disponível p/ Retirada</button>
                `;
            }
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

    // Reaplica filtro se houver
    const filtroStatusMateriaisEl = document.getElementById('filtro-status-materiais');
    if (filtroStatusMateriaisEl && filtroStatusMateriaisEl.value) {
        filterTable(filtroStatusMateriaisEl, 'table-status-materiais');
    }
}

// Marca um material como "Disponível para Retirada"
async function handleMarcarRetirada(e) {
    // A delegação de eventos já garante que o botão existe
    const button = e.target.closest('button.btn-retirada[data-id]');
    
    const materialId = button.dataset.id;
    if (!isAuthReady || !materialId) return;
    
    button.disabled = true; button.innerHTML = '<div class="loading-spinner-small mx-auto" style="width: 16px; height: 16px; border-width: 2px;"></div>';
    
    try {
        const docRef = doc(materiaisCollection, materialId); // Usa collection global
        await updateDoc(docRef, { 
            status: 'retirada', 
            dataRetirada: serverTimestamp() // Usa global
        });
        showAlert('alert-materiais-lista', 'Material marcado como Disponível para Retirada!', 'success', 3000);
        // O listener do Firestore atualizará a tabela
    } catch (error) { 
        console.error("Erro marcar p/ retirada:", error); 
        showAlert('alert-materiais-lista', `Erro: ${error.message}`, 'error'); 
        button.disabled = false; 
        button.textContent = 'Disponível p/ Retirada'; 
    }
}

// Marca um material como "Entregue"
async function handleMarcarEntregue(e) {
    const button = e.target.closest('button.btn-entregue[data-id]');
    
    const materialId = button.dataset.id;
    if (!isAuthReady || !materialId) return;
    
    // Busca o responsável da separação para usar como default na entrega
    const material = fb_materiais.find(m => m.id === materialId);
    const responsavelEntrega = material?.responsavelSeparacao || "Responsável (Retirada)"; 
    
    button.disabled = true; button.innerHTML = '<div class="loading-spinner-small mx-auto" style="width: 16px; height: 16px; border-width: 2px;"></div>';
    
    try {
        const docRef = doc(materiaisCollection, materialId); // Usa collection global
        await updateDoc(docRef, { 
            status: 'entregue', 
            dataEntrega: serverTimestamp(), // Usa global
            responsavelEntrega: capitalizeString(responsavelEntrega) // Usa função global
        });
        showAlert('alert-materiais-lista', 'Material marcado como entregue!', 'success', 3000);
        // O listener do Firestore atualizará a tabela
    } catch (error) { 
        console.error("Erro marcar entregue:", error); 
        showAlert('alert-materiais-lista', `Erro: ${error.message}`, 'error'); 
        button.disabled = false; 
        button.textContent = 'Entregue'; 
    } 
}

// --- LÓGICA DO MODAL E DOWNLOAD DE ARQUIVO ---

// Abre modal para definir responsável pela separação (chamado pelo HTML)
function abrirModalDefinirResponsavel(materialId) {
    if (!modalDefinirResponsavelSeparacao || !inputNomeResponsavelSeparacao) return;
    
    materialAtualParaLiberacao = materialId; // Usa variável global
    inputNomeResponsavelSeparacao.value = '';
    modalDefinirResponsavelSeparacao.style.display = 'flex'; // Usa flex para centralizar
}

// Fecha modal (chamado pelo HTML e internamente)
function fecharModalResponsavel() {
    if (!modalDefinirResponsavelSeparacao) return;
    modalDefinirResponsavelSeparacao.style.display = 'none';
    materialAtualParaLiberacao = null; // Limpa variável global
    if (inputNomeResponsavelSeparacao) inputNomeResponsavelSeparacao.value = '';
}

// Confirma responsável e libera download (chamado pelo listener)
async function confirmarResponsavelSeparacao() {
    if (!materialAtualParaLiberacao || !inputNomeResponsavelSeparacao) return;
    
    const nomeResponsavel = capitalizeString(inputNomeResponsavelSeparacao.value.trim()); // Usa função global
    if (!nomeResponsavel) {
        showAlert('alert-materiais', 'Digite o nome do responsável!', 'warning'); // Usa função global
        return;
    }
    
    btnConfirmarResponsavelSeparacao.disabled = true;
    btnConfirmarResponsavelSeparacao.innerHTML = '<div class="loading-spinner-small mx-auto"></div>';
    
    try {
        const docRef = doc(materiaisCollection, materialAtualParaLiberacao); // Usa collection global
        await updateDoc(docRef, {
            responsavelPelaSeparacao: nomeResponsavel,
            downloadDisponivel: true,
            // status: 'separacao' // Mantém como separação, só libera o download
        });
        
        showAlert('alert-materiais-lista', 'Responsável definido! Download liberado para o arquivo.', 'success'); // Usa função global
        fecharModalResponsavel();
        // O listener do Firestore atualizará a tabela para mostrar o botão de download
    } catch (error) {
        console.error('Erro ao definir responsável:', error);
        showAlert('alert-materiais', `Erro: ${error.message}`, 'error'); // Usa função global
    } finally {
        btnConfirmarResponsavelSeparacao.disabled = false;
        btnConfirmarResponsavelSeparacao.textContent = 'Confirmar e Liberar Download';
    }
}

// Baixa o arquivo anexado com controle de limite (chamado pelo HTML)
async function baixarArquivoMaterial(materialId) {
    const material = fb_materiais.find(m => m.id === materialId); // Usa array global
    if (!material || !material.storagePath) {
        showAlert('alert-materiais-lista', 'Arquivo não encontrado!', 'error'); // Usa função global
        return;
    }
    
    if (!material.downloadDisponivel) {
        showAlert('alert-materiais-lista', 'Download não liberado! Defina o responsável pela separação primeiro.', 'warning');
        return;
    }
    
    if (material.downloadCount >= material.downloadLimite) {
        showAlert('alert-materiais-lista', 'Limite de downloads atingido! Este arquivo já foi baixado 2 vezes.', 'warning');
        return;
    }
    
    try {
        // Obter URL de download
        // Usa 'storage' global e funções importadas
        const storageRef = ref(storage, material.storagePath); 
        const downloadURL = await getDownloadURL(storageRef);
        
        // Incrementar contador de downloads no Firestore
        const docRef = doc(materiaisCollection, materialId); // Usa collection global
        const novoCount = (material.downloadCount || 0) + 1;
        await updateDoc(docRef, {
            downloadCount: novoCount
        });
        
        // Iniciar download no navegador
        const a = document.createElement('a');
        a.href = downloadURL;
        a.download = material.arquivoNomeOriginal || 'arquivo_material'; // Nome padrão
        a.target = '_blank'; // Abrir em nova aba (melhor para alguns navegadores)
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Atualiza a UI (opcional, pois o listener já fará isso, mas dá feedback imediato)
        const restantes = material.downloadLimite - novoCount;
        if (restantes > 0) {
            showAlert('alert-materiais-lista', `Arquivo baixado! Restam ${restantes} download(s).`, 'success');
        } else {
            showAlert('alert-materiais-lista', 'Arquivo baixado! Limite de downloads atingido.', 'info');
        }
         // O listener do Firestore atualizará o botão na tabela
    } catch (error) {
        console.error('Erro ao baixar arquivo:', error);
        showAlert('alert-materiais-lista', `Erro ao baixar: ${error.code || error.message}`, 'error');
    }
}
