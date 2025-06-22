import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Dados estáticos para demonstração
DEMO_DATA = [
    {
        'id': 'EMP001',
        'timestamp': '21/06/2025, 14:39:55',
        'solicitante': 'Matheus',
        'area': 'Logística',
        'tipoOperacao': 'Entrega',
        'codigoItem': '161.100.002',
        'tempoAtendimento': '00:15 (Urgente)',
        'observacao': 'Material para linha de produção 1',
        'status': 'pendente',
        'observacaoOperador': '',
        'horarioInicio': None,
        'horarioConclusao': None
    },
    {
        'id': 'EMP002',
        'timestamp': '21/06/2025, 15:20:30',
        'solicitante': 'Ana Silva',
        'area': 'Injeção de Alumínio',
        'tipoOperacao': 'Guarda',
        'codigoItem': 'ALU-456',
        'tempoAtendimento': '00:30 (Moderado)',
        'observacao': 'Peças acabadas para estoque',
        'status': 'em-andamento',
        'observacaoOperador': 'Iniciado às 15:25',
        'horarioInicio': '15:25',
        'horarioConclusao': None
    },
    {
        'id': 'EMP003',
        'timestamp': '21/06/2025, 13:15:10',
        'solicitante': 'Carlos Santos',
        'area': 'Qualidade',
        'tipoOperacao': 'Validação',
        'codigoItem': 'QLD-789',
        'tempoAtendimento': '00:45 (Normal)',
        'observacao': 'Inspeção de qualidade lote 2025-06',
        'status': 'concluido',
        'observacaoOperador': 'Concluído com sucesso',
        'horarioInicio': '13:20',
        'horarioConclusao': '14:05'
    }
]

status_storage = {}

@app.route('/api/sheets/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "Backend funcionando"})

@app.route('/api/sheets/read-data', methods=['GET'])
def read_data():
    try:
        return jsonify({"success": True, "data": DEMO_DATA})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/sheets/read-status', methods=['GET'])
def read_status():
    try:
        return jsonify({"success": True, "data": status_storage})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/sheets/update-status', methods=['POST'])
def update_status():
    try:
        data = request.get_json()
        request_id = data.get('requestId')
        status = data.get('status')
        observacao = data.get('observacaoOperador', '')
        horario_inicio = data.get('horarioInicio')
        horario_conclusao = data.get('horarioConclusao')
        
        status_storage[request_id] = {
            'status': status,
            'observacaoOperador': observacao,
            'horarioInicio': horario_inicio,
            'horarioConclusao': horario_conclusao
        }
        
        for item in DEMO_DATA:
            if item['id'] == request_id:
                item['status'] = status
                item['observacaoOperador'] = observacao
                if horario_inicio:
                    item['horarioInicio'] = horario_inicio
                if horario_conclusao:
                    item['horarioConclusao'] = horario_conclusao
                break
        
        return jsonify({"success": True, "message": "Status atualizado com sucesso"})
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "message": "Backend do Sistema de Empilhadeira",
        "status": "funcionando",
        "endpoints": [
            "/api/sheets/health",
            "/api/sheets/read-data", 
            "/api/sheets/read-status",
            "/api/sheets/update-status"
        ]
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
    
