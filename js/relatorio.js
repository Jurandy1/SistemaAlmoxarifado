/* =============================================================
   MÓDULO: Geração de Relatórios
   Funções:
     - handleGerarPdf()
   Dependências:
     - jsPDF, jsPDF-AutoTable (carregados via CDN no HTML)
     - Variáveis globais (fb_agua_movimentacoes, fb_gas_movimentacoes)
     - Funções globais (dateToTimestamp, formatTimestamp, showAlert)
   Autor: Jurandy Santana (Refatorado por Gemini)
   ============================================================= */

// Importa apenas Timestamp, pois as outras funções/vars são globais
import { Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 


document.addEventListener('DOMContentLoaded', () => {
    // Adiciona listener específico para o botão de gerar PDF
    if (btnGerarPdf) btnGerarPdf.addEventListener('click', handleGerarPdf);
});


// --- LÓGICA DE RELATÓRIO PDF ---

// Gera o relatório PDF baseado nas seleções do usuário
function handleGerarPdf() {
     if (!domReady) { showAlert('alert-relatorio', 'Erro: Aplicação não totalmente carregada.', 'error'); return; } 
    
    // Verifica se as bibliotecas jsPDF e autoTable estão carregadas
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined' || typeof window.jspdf.AutoTable === 'undefined') {
        showAlert('alert-relatorio', 'Erro: Bibliotecas PDF não carregadas. Tente recarregar a página.', 'error'); 
        console.error("jsPDF ou jsPDF-AutoTable não encontrados no window.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const autoTable = window.jspdf.AutoTable; // Acessa via window.jspdf

    // Obtém valores dos inputs (referências globais)
    const tipo = relatorioTipo.value; 
    const dataInicioStr = relatorioDataInicio.value;
    const dataFimStr = relatorioDataFim.value;

    if (!dataInicioStr || !dataFimStr) { showAlert('alert-relatorio', 'Selecione a data de início e fim.', 'warning'); return; }

    // Converte datas para timestamps (função global)
    const dataInicioTs = dateToTimestamp(dataInicioStr);
    const dataFimTs = dateToTimestamp(dataFimStr);

    if (!dataInicioTs || !dataFimTs) { showAlert('alert-relatorio', 'Datas inválidas.', 'error'); return;}

    const dataInicio = dataInicioTs.toMillis();
    // Adiciona 1 dia menos 1ms ao fim para incluir todo o último dia
    const dataFim = dataFimTs.toMillis() + (24 * 60 * 60 * 1000 - 1); 

    // Seleciona o array de movimentações correto (arrays globais)
    const movimentacoes = (tipo === 'agua' ? fb_agua_movimentacoes : fb_gas_movimentacoes);
    const tipoLabel = (tipo === 'agua' ? 'Água' : 'Gás');

    // Filtra movimentações do tipo 'entrega' dentro do período selecionado
    const movsFiltradas = movimentacoes.filter(m => { 
        const mData = m.data?.toMillis(); 
        return m.tipo === 'entrega' && mData >= dataInicio && mData <= dataFim; 
    });

    if (movsFiltradas.length === 0) { showAlert('alert-relatorio', 'Nenhum dado de entrega encontrado para este período.', 'info'); return; }
    
    btnGerarPdf.disabled = true; btnGerarPdf.innerHTML = '<div class="loading-spinner-small mx-auto"></div> Gerando...';
    
    try {
        const doc = new jsPDF(); 

        // Agrupa dados por unidade
        const abastecimentoMap = new Map(); 
        movsFiltradas.forEach(m => { 
            const nome = m.unidadeNome || 'Unidade Desconhecida'; 
            const atual = abastecimentoMap.get(nome) || 0; 
            abastecimentoMap.set(nome, atual + m.quantidade); 
        });
        // Formata para o AutoTable e ordena por quantidade (desc)
        const abastecimentoData = Array.from(abastecimentoMap.entries())
            .sort((a,b) => b[1] - a[1]) 
            .map(entry => [entry[0], entry[1]]); 

        // Agrupa dados por responsável
        const responsavelMap = new Map(); 
        movsFiltradas.forEach(m => { 
            const nome = m.responsavel || 'Não identificado'; 
            const atual = responsavelMap.get(nome) || 0; 
            responsavelMap.set(nome, atual + m.quantidade); 
        });
         // Formata para o AutoTable e ordena por quantidade (desc)
        const responsavelData = Array.from(responsavelMap.entries())
            .sort((a,b) => b[1] - a[1])
            .map(entry => [entry[0], entry[1]]);

        // --- Montagem do PDF ---
        doc.setFontSize(16); doc.text(`Relatório de Fornecimento - ${tipoLabel}`, 14, 20);
        doc.setFontSize(10); 
        // Usa formatTimestamp (global) e Timestamp (importado)
        doc.text(`Período: ${formatTimestamp(Timestamp.fromMillis(dataInicio))} a ${formatTimestamp(Timestamp.fromMillis(dataFim))}`, 14, 26);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 32);

        // Tabela por Unidade
        autoTable(doc, { 
            startY: 40, 
            head: [['Relatório de Entregas por Unidade']], 
            body: [[]], // Hack para título
            theme: 'plain', 
            styles: { fontSize: 12, fontStyle: 'bold' } 
        });
        autoTable(doc, { 
            head: [['Unidade', 'Quantidade Fornecida']], 
            body: abastecimentoData, 
            theme: 'striped', 
            headStyles: { fillColor: [22, 160, 133] } // Verde
        });

        // Tabela por Responsável
        autoTable(doc, { 
            startY: doc.lastAutoTable.finalY + 15, // Pula linha após a tabela anterior
            head: [['Relatório de Recebimento por Responsável (Unidade)']], 
            body: [[]], // Hack para título
            theme: 'plain', 
            styles: { fontSize: 12, fontStyle: 'bold' } 
        });
        autoTable(doc, { 
            head: [['Responsável', 'Quantidade Recebida']], 
            body: responsavelData, 
            theme: 'striped', 
            headStyles: { fillColor: [41, 128, 185] } // Azul
        });

        // Salva o PDF
        doc.save(`Relatorio_${tipoLabel}_${dataInicioStr}_a_${dataFimStr}.pdf`);
        showAlert('alert-relatorio', 'Relatório PDF gerado com sucesso!', 'success');
    } catch (error) { 
        console.error("Erro ao gerar PDF:", error); 
        showAlert('alert-relatorio', `Erro ao gerar PDF: ${error.message}`, 'error');
    } finally { 
        btnGerarPdf.disabled = false; btnGerarPdf.textContent = 'Gerar Relatório PDF'; 
    }
}
