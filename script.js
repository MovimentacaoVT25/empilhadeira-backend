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
    const container = document.getElementById('solicitacoes-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    solicitacoes.forEach(solicitacao => {
        const card = criarCardSolicitacao(solicitacao);
        container.appendChild(card);
    });
    
    atualizarEstatisticas();
}

// Função para criar card de solicitação
function criarCardSolicitacao(solicitacao) {
    const card = document.createElement('div');
    card.className = `solicitacao-card ${solicitacao.status}`;
    card.innerHTML = `
        <div class="card-header">
            <h3>${solicitacao.id}</h3>
            <span class="status-badge ${solicitacao.status}">${getStatusText(solicitacao.status)}</span>
        </div>
        <div class="card-content">
            <p><strong>Solicitante:</strong> ${solicitacao.solicitante}</p>
            <p><strong>Área:</strong> ${solicitacao.area}</p>
            <p><strong>Operação:</strong> ${solicitacao.tipoOperacao}</p>
            <p><strong>Item:</strong> ${solicitacao.codigoItem}</p>
            <p><strong>Tempo:</strong> ${solicitacao.tempoAtendimento}</p>
            <p><strong>Observação:</strong> ${solicitacao.observacao}</p>
            ${solicitacao.observacaoOperador ? `<p><strong>Obs. Operador:</strong> ${solicitacao.observacaoOperador}</p>` : ''}
            ${solicitacao.horarioInicio ? `<p><strong>Início:</strong> ${solicitacao.horarioInicio}</p>` : ''}
            ${solicitacao.horarioConclusao ? `<p><strong>Conclusão:</strong> ${solicitacao.horarioConclusao}</p>` : ''}
        </div>
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

// Função para adicionar observação
async function adicionarObservacao(id) {
    const observacao = prompt('Digite sua observação:');
    if (observacao && observacao.trim()) {
        const solicitacao = solicitacoes.find(s => s.id === id);
        const horarioInicio = solicitacao?.horarioInicio || null;
        
        const sucesso = await salvarStatus(id, 'em-andamento', observacao.trim(), horarioInicio, null);
        
        if (sucesso || true) { // Continua mesmo se falhar o salvamento no servidor
            if (solicitacao) {
                solicitacao.observacaoOperador = observacao.trim();
            }
            
            atualizarInterface();
            showNotification('Observação adicionada com sucesso', 'success');
        }
    }
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
    
    // Atualizar elementos da interface se existirem
    const elementos = {
        'total-solicitacoes': stats.total,
        'pendentes': stats.pendente,
        'em-andamento': stats.emAndamento,
        'concluidas': stats.concluido,
        'canceladas': stats.cancelado
    };
    
    Object.entries(elementos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = valor;
        }
    });
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

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', inicializar);

// Salvar dados localmente antes de sair da página
window.addEventListener('beforeunload', () => {
    localStorage.setItem('empilhadeira_dados', JSON.stringify(solicitacoes));
    localStorage.setItem('empilhadeira_status', JSON.stringify(statusData));
});

