// Configuração da API do Google Sheets
const API_KEY = 'AIzaSyCXFrPi-GSwXnYFBvh3GLZA7jb1f9DMWN8';
const SHEET_ID = '1vmuL-OXeanaYhVFD4sKJpHWfITxSyXFixyOleMBk4RE';

// URL do backend permanente
const BACKEND_URL = 'https://empilhadeira-backend.onrender.com';

// Variáveis globais
let solicitacoes = [];
let statusData = {};

// Função para mostrar notificações
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        max-width: 300px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    if (type === 'success') {
        notification.style.backgroundColor = '#4CAF50';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#f44336';
    } else {
        notification.style.backgroundColor = '#2196F3';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Função para fazer requisições ao backend
async function fetchFromBackend(endpoint, options = {}) {
    try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erro na requisição:', error);
        showNotification('Erro de conexão com o servidor', 'error');
        throw error;
    }
}

// Função para carregar dados do backend
async function carregarDados() {
    try {
        showNotification('Carregando dados...', 'info');
        
        // Carregar dados principais
        const dataResponse = await fetchFromBackend('/api/sheets/read-data');
        if (dataResponse.success) {
            solicitacoes = dataResponse.data;
        }
        
        // Carregar status salvos
        const statusResponse = await fetchFromBackend('/api/sheets/read-status');
        if (statusResponse.success) {
            statusData = statusResponse.data;
            
            // Aplicar status salvos aos dados
            solicitacoes.forEach(solicitacao => {
                if (statusData[solicitacao.id]) {
                    const savedStatus = statusData[solicitacao.id];
                    solicitacao.status = savedStatus.status || solicitacao.status;
                    solicitacao.observacaoOperador = savedStatus.observacaoOperador || '';
                    solicitacao.horarioInicio = savedStatus.horarioInicio || null;
                    solicitacao.horarioConclusao = savedStatus.horarioConclusao || null;
                }
            });
        }
        
        showNotification('Dados carregados com sucesso!', 'success');
        atualizarInterface();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showNotification('Erro ao carregar dados. Usando dados locais.', 'error');
        
        // Fallback para dados locais se houver erro
        carregarDadosLocais();
    }
}

// Função para salvar status no backend
async function salvarStatus(requestId, status, observacao = '', horarioInicio = null, horarioConclusao = null) {
    try {
        const response = await fetchFromBackend('/api/sheets/update-status', {
            method: 'POST',
            body: JSON.stringify({
                requestId: requestId,
                status: status,
                observacaoOperador: observacao,
                horarioInicio: horarioInicio,
                horarioConclusao: horarioConclusao
            })
        });
        
        if (response.success) {
            showNotification('Status salvo com sucesso!', 'success');
            return true;
        } else {
            throw new Error(response.error || 'Erro desconhecido');
        }
    } catch (error) {
        console.error('Erro ao salvar status:', error);
        showNotification('Erro ao salvar no servidor. Dados salvos localmente.', 'error');
        
        // Fallback para localStorage
        salvarStatusLocal(requestId, status, observacao, horarioInicio, horarioConclusao);
        return false;
    }
}

// Função de fallback para dados locais
function carregarDadosLocais() {
    const dadosLocais = localStorage.getItem('empilhadeira_dados');
    const statusLocais = localStorage.getItem('empilhadeira_status');
    
    if (dadosLocais) {
        solicitacoes = JSON.parse(dadosLocais);
    } else {
        // Dados padrão se não houver nada salvo
        solicitacoes = [
            {
                id: 'EMP001',
                timestamp: '21/06/2025, 14:39:55',
                solicitante: 'Matheus',
                area: 'Logística',
                tipoOperacao: 'Entrega',
                codigoItem: '161.100.002',
                tempoAtendimento: '00:15 (Urgente)',
                observacao: 'Material para linha de produção 1',
                status: 'pendente',
                observacaoOperador: '',
                horarioInicio: null,
                horarioConclusao: null
            }
        ];
    }
    
    if (statusLocais) {
        statusData = JSON.parse(statusLocais);
        
        // Aplicar status salvos
        solicitacoes.forEach(solicitacao => {
            if (statusData[solicitacao.id]) {
                const savedStatus = statusData[solicitacao.id];
                solicitacao.status = savedStatus.status || solicitacao.status;
                solicitacao.observacaoOperador = savedStatus.observacaoOperador || '';
                solicitacao.horarioInicio = savedStatus.horarioInicio || null;
                solicitacao.horarioConclusao = savedStatus.horarioConclusao || null;
            }
        });
    }
    
    atualizarInterface();
}

// Função de fallback para salvar localmente
function salvarStatusLocal(requestId, status, observacao, horarioInicio, horarioConclusao) {
    statusData[requestId] = {
        status: status,
        observacaoOperador: observacao,
        horarioInicio: horarioInicio,
        horarioConclusao: horarioConclusao
    };
    
    localStorage.setItem('empilhadeira_status', JSON.stringify(statusData));
    
    // Atualizar também os dados principais
    const solicitacao = solicitacoes.find(s => s.id === requestId);
    if (solicitacao) {
        solicitacao.status = status;
        solicitacao.observacaoOperador = observacao;
        if (horarioInicio) solicitacao.horarioInicio = horarioInicio;
        if (horarioConclusao) solicitacao.horarioConclusao = horarioConclusao;
    }
    
    localStorage.setItem('empilhadeira_dados', JSON.stringify(solicitacoes));
}

// Função para atualizar a interface
function atualizarInterface() {
    const container = document.getElementById('requestsList');
    if (!container) {
        console.error('Container requestsList não encontrado');
        return;
    }
    
    container.innerHTML = '';
    
    // Esconder estado vazio
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';
    
    if (solicitacoes && solicitacoes.length > 0) {
        solicitacoes.forEach(solicitacao => {
            const card = criarCardSolicitacao(solicitacao);
            container.appendChild(card);
        });
    } else {
        // Mostrar estado vazio se não houver solicitações
        if (emptyState) emptyState.style.display = 'block';
    }
    
    atualizarEstatisticas();
}

// Função para criar card de solicitação
function criarCardSolicitacao(solicitacao) {
    const card = document.createElement('div');
    card.className = `request-card status-${solicitacao.status}`;
    
    // Determinar prioridade baseada no tempo de atendimento
    let prioridade = 'normal';
    let classPrioridade = 'normal';
    if (solicitacao.tempoAtendimento && solicitacao.tempoAtendimento.includes('Urgente')) {
        prioridade = 'urgente';
        classPrioridade = 'urgente';
    } else if (solicitacao.tempoAtendimento && solicitacao.tempoAtendimento.includes('Moderado')) {
        prioridade = 'moderado';
        classPrioridade = 'moderado';
    }
    
    card.innerHTML = `
        <div class="request-header">
            <div>
                <div class="request-id">${solicitacao.id}</div>
                <div class="request-timestamp">${solicitacao.timestamp}</div>
            </div>
        </div>
        
        <div class="request-details">
            <div class="detail-item">
                <div class="detail-label">Solicitante</div>
                <div class="detail-value">${solicitacao.solicitante}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Área</div>
                <div class="detail-value">${solicitacao.area}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Operação</div>
                <div class="detail-value">
                    <span class="operation-tag">${solicitacao.tipoOperacao}</span>
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Item</div>
                <div class="detail-value">${solicitacao.codigoItem}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Prioridade</div>
                <div class="detail-value">
                    <span class="priority-tag ${classPrioridade}">${solicitacao.tempoAtendimento}</span>
                </div>
            </div>
        </div>
        
        ${solicitacao.observacao ? `
        <div class="observation-section">
            <div class="observation-label">Observação</div>
            <div class="observation-text">${solicitacao.observacao}</div>
        </div>
        ` : ''}
        
        ${solicitacao.observacaoOperador ? `
        <div class="observation-section">
            <div class="observation-label">Observação do Operador</div>
            <div class="observation-text">${solicitacao.observacaoOperador}</div>
        </div>
        ` : ''}
        
        ${solicitacao.horarioInicio ? `
        <div class="observation-section">
            <div class="observation-label">Horário de Início</div>
            <div class="observation-text">${solicitacao.horarioInicio}</div>
        </div>
        ` : ''}
        
        ${solicitacao.horarioConclusao ? `
        <div class="observation-section">
            <div class="observation-label">Horário de Conclusão</div>
            <div class="observation-text">${solicitacao.horarioConclusao}</div>
        </div>
        ` : ''}
        
        <div class="card-actions">
            ${criarBotoesAcao(solicitacao)}
        </div>
    `;
    
    return card;
}

// Função para criar botões de ação
function criarBotoesAcao(solicitacao) {
    if (solicitacao.status === 'pendente') {
        return `
            <button onclick="iniciarAtendimento('${solicitacao.id}')" class="btn btn-primary">
                Iniciar Atendimento
            </button>
            <button onclick="cancelarSolicitacao('${solicitacao.id}')" class="btn btn-secondary">
                Cancelar
            </button>
        `;
    } else if (solicitacao.status === 'em-andamento') {
        return `
            <button onclick="concluirAtendimento('${solicitacao.id}')" class="btn btn-success">
                Concluir
            </button>
            <button onclick="adicionarObservacao('${solicitacao.id}')" class="btn btn-info">
                Adicionar Observação
            </button>
        `;
    } else {
        return `<span class="status-final">Atendimento ${getStatusText(solicitacao.status)}</span>`;
    }
}

// Função para obter texto do status
function getStatusText(status) {
    const statusMap = {
        'pendente': 'Pendente',
        'em-andamento': 'Em Andamento',
        'concluido': 'Concluído',
        'cancelado': 'Cancelado'
    };
    return statusMap[status] || status;
}

// Função para iniciar atendimento
async function iniciarAtendimento(id) {
    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    const sucesso = await salvarStatus(id, 'em-andamento', '', agora, null);
    
    if (sucesso || true) { // Continua mesmo se falhar o salvamento no servidor
        const solicitacao = solicitacoes.find(s => s.id === id);
        if (solicitacao) {
            solicitacao.status = 'em-andamento';
            solicitacao.horarioInicio = agora;
        }
        
        atualizarInterface();
        showNotification(`Atendimento ${id} iniciado às ${agora}`, 'success');
    }
}

// Função para concluir atendimento
async function concluirAtendimento(id) {
    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const solicitacao = solicitacoes.find(s => s.id === id);
    
    const observacao = solicitacao?.observacaoOperador || '';
    const horarioInicio = solicitacao?.horarioInicio || null;
    
    const sucesso = await salvarStatus(id, 'concluido', observacao, horarioInicio, agora);
    
    if (sucesso || true) { // Continua mesmo se falhar o salvamento no servidor
        if (solicitacao) {
            solicitacao.status = 'concluido';
            solicitacao.horarioConclusao = agora;
        }
        
        atualizarInterface();
        showNotification(`Atendimento ${id} concluído às ${agora}`, 'success');
    }
}

// Função para cancelar solicitação
async function cancelarSolicitacao(id) {
    if (confirm('Tem certeza que deseja cancelar esta solicitação?')) {
        const sucesso = await salvarStatus(id, 'cancelado', 'Cancelado pelo operador', null, null);
        
        if (sucesso || true) { // Continua mesmo se falhar o salvamento no servidor
            const solicitacao = solicitacoes.find(s => s.id === id);
            if (solicitacao) {
                solicitacao.status = 'cancelado';
                solicitacao.observacaoOperador = 'Cancelado pelo operador';
            }
            
            atualizarInterface();
            showNotification(`Solicitação ${id} cancelada`, 'info');
        }
    }
}

// Variáveis globais para o modal
let currentRequestId = null;
let currentAction = null;

// Função para adicionar observação
async function adicionarObservacao(id) {
    currentRequestId = id;
    currentAction = 'observacao';
    
    const modal = document.getElementById('observationModal');
    const modalTitle = document.getElementById('modalTitle');
    const observationText = document.getElementById('observationText');
    const confirmBtn = document.getElementById('confirmActionBtn');
    
    modalTitle.textContent = 'Adicionar Observação';
    observationText.value = '';
    observationText.placeholder = 'Digite sua observação sobre o atendimento...';
    confirmBtn.textContent = 'Adicionar Observação';
    
    modal.style.display = 'block';
}

// Função para concluir atendimento com modal
async function concluirAtendimento(id) {
    currentRequestId = id;
    currentAction = 'concluir';
    
    const modal = document.getElementById('observationModal');
    const modalTitle = document.getElementById('modalTitle');
    const observationText = document.getElementById('observationText');
    const confirmBtn = document.getElementById('confirmActionBtn');
    
    modalTitle.textContent = 'Concluir Atendimento';
    observationText.value = '';
    observationText.placeholder = 'Adicione uma observação final (opcional)...';
    confirmBtn.textContent = 'Concluir Atendimento';
    
    modal.style.display = 'block';
}

// Função para fechar modal
function closeModal() {
    const modal = document.getElementById('observationModal');
    modal.style.display = 'none';
    currentRequestId = null;
    currentAction = null;
}

// Função para confirmar ação do modal
async function confirmarAcaoModal() {
    if (!currentRequestId || !currentAction) return;
    
    const observationText = document.getElementById('observationText');
    const observacao = observationText.value.trim();
    
    if (currentAction === 'observacao') {
        if (!observacao) {
            showNotification('Por favor, digite uma observação', 'error');
            return;
        }
        
        const solicitacao = solicitacoes.find(s => s.id === currentRequestId);
        const horarioInicio = solicitacao?.horarioInicio || null;
        
        const sucesso = await salvarStatus(currentRequestId, 'em-andamento', observacao, horarioInicio, null);
        
        if (sucesso || true) {
            if (solicitacao) {
                solicitacao.observacaoOperador = observacao;
            }
            
            atualizarInterface();
            showNotification('Observação adicionada com sucesso', 'success');
        }
    } else if (currentAction === 'concluir') {
        const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const solicitacao = solicitacoes.find(s => s.id === currentRequestId);
        const horarioInicio = solicitacao?.horarioInicio || null;
        const observacaoFinal = observacao || solicitacao?.observacaoOperador || '';
        
        const sucesso = await salvarStatus(currentRequestId, 'concluido', observacaoFinal, horarioInicio, agora);
        
        if (sucesso || true) {
            if (solicitacao) {
                solicitacao.status = 'concluido';
                solicitacao.horarioConclusao = agora;
                if (observacao) solicitacao.observacaoOperador = observacao;
            }
            
            atualizarInterface();
            showNotification(`Atendimento ${currentRequestId} concluído às ${agora}`, 'success');
        }
    }
    
    closeModal();
}

// Função para atualizar estatísticas
function atualizarEstatisticas() {
    const stats = {
        total: solicitacoes.length,
        pendente: solicitacoes.filter(s => s.status === 'pendente').length,
        emAndamento: solicitacoes.filter(s => s.status === 'em-andamento').length,
        concluido: solicitacoes.filter(s => s.status === 'concluido').length,
        cancelado: solicitacoes.filter(s => s.status === 'cancelado').length
    };
    
    // Atualizar contadores no header (IDs corretos do HTML)
    const pendingCount = document.getElementById('pendingCount');
    const inProgressCount = document.getElementById('inProgressCount');
    const completedCount = document.getElementById('completedCount');
    
    if (pendingCount) pendingCount.textContent = stats.pendente;
    if (inProgressCount) inProgressCount.textContent = stats.emAndamento;
    if (completedCount) completedCount.textContent = stats.concluido;
    
    console.log('Estatísticas atualizadas:', stats);
}

// Função para verificar conectividade
async function verificarConectividade() {
    try {
        const response = await fetchFromBackend('/api/sheets/health');
        if (response.status === 'ok') {
            document.getElementById('status-conexao').textContent = 'Conectado ao Servidor';
            document.getElementById('status-conexao').className = 'status-online';
            return true;
        }
    } catch (error) {
        document.getElementById('status-conexao').textContent = 'Modo Offline';
        document.getElementById('status-conexao').className = 'status-offline';
        return false;
    }
}

// Função de inicialização
async function inicializar() {
    console.log('Inicializando sistema de empilhadeira...');
    
    // Verificar conectividade
    const online = await verificarConectividade();
    
    if (online) {
        // Carregar dados do servidor
        await carregarDados();
    } else {
        // Carregar dados locais
        carregarDadosLocais();
    }
    
    // Verificar conectividade periodicamente
    setInterval(verificarConectividade, 30000); // A cada 30 segundos
    
    console.log('Sistema inicializado com sucesso!');
}

// Salvar dados localmente antes de sair da página
window.addEventListener('beforeunload', () => {
    localStorage.setItem('empilhadeira_dados', JSON.stringify(solicitacoes));
    localStorage.setItem('empilhadeira_status', JSON.stringify(statusData));
});


// Função para aplicar filtros
function aplicarFiltros() {
    const statusFilter = document.getElementById('statusFilter').value;
    const areaFilter = document.getElementById('areaFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    let solicitacoesFiltradas = [...solicitacoes];
    
    // Filtro por status
    if (statusFilter !== 'todos') {
        solicitacoesFiltradas = solicitacoesFiltradas.filter(s => s.status === statusFilter);
    }
    
    // Filtro por área
    if (areaFilter !== 'todos') {
        solicitacoesFiltradas = solicitacoesFiltradas.filter(s => s.area === areaFilter);
    }
    
    // Filtro por data
    if (dateFilter) {
        const dataFiltro = new Date(dateFilter);
        solicitacoesFiltradas = solicitacoesFiltradas.filter(s => {
            const dataTimestamp = new Date(s.timestamp.split(', ')[0].split('/').reverse().join('-'));
            return dataTimestamp.toDateString() === dataFiltro.toDateString();
        });
    }
    
    // Atualizar interface com dados filtrados
    const container = document.getElementById('requestsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';
    
    if (solicitacoesFiltradas.length > 0) {
        solicitacoesFiltradas.forEach(solicitacao => {
            const card = criarCardSolicitacao(solicitacao);
            container.appendChild(card);
        });
    } else {
        if (emptyState) emptyState.style.display = 'block';
    }
    
    // Atualizar estatísticas com dados filtrados
    atualizarEstatisticasFiltradas(solicitacoesFiltradas);
}

// Função para atualizar estatísticas com dados filtrados
function atualizarEstatisticasFiltradas(dados) {
    const stats = {
        pendente: dados.filter(s => s.status === 'pendente').length,
        emAndamento: dados.filter(s => s.status === 'em-andamento').length,
        concluido: dados.filter(s => s.status === 'concluido').length,
    };
    
    const pendingCount = document.getElementById('pendingCount');
    const inProgressCount = document.getElementById('inProgressCount');
    const completedCount = document.getElementById('completedCount');
    
    if (pendingCount) pendingCount.textContent = stats.pendente;
    if (inProgressCount) inProgressCount.textContent = stats.emAndamento;
    if (completedCount) completedCount.textContent = stats.concluido;
}

// Função para limpar filtros
function limparFiltros() {
    document.getElementById('statusFilter').value = 'todos';
    document.getElementById('areaFilter').value = 'todos';
    document.getElementById('dateFilter').value = '';
    atualizarInterface();
}

// Event listeners para filtros
document.addEventListener('DOMContentLoaded', function() {
    // Adicionar event listeners aos filtros
    const statusFilter = document.getElementById('statusFilter');
    const areaFilter = document.getElementById('areaFilter');
    const dateFilter = document.getElementById('dateFilter');
    const refreshBtn = document.getElementById('refreshBtn');
    
    if (statusFilter) statusFilter.addEventListener('change', aplicarFiltros);
    if (areaFilter) areaFilter.addEventListener('change', aplicarFiltros);
    if (dateFilter) dateFilter.addEventListener('change', aplicarFiltros);
    if (refreshBtn) refreshBtn.addEventListener('click', function() {
        limparFiltros();
        carregarDados();
    });
    
    // Fechar modal ao clicar fora dele
    const modal = document.getElementById('observationModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    // Inicializar sistema
    inicializar();
});

