import os
import json
import gspread
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.oauth2.service_account import Credentials

app = Flask(__name__)
CORS(app)

# Configuração do Google Sheets
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

# ID da planilha (extraído da URL)
SPREADSHEET_ID = '1vmuL-OXeanaYhVFD4sKJpHWfITxSyXFixyOleMBk4RE'
SHEET_NAME = 'Dados'  # Nome da aba

# Configuração das credenciais
def get_google_credentials():
    """Obtém as credenciais do Google Sheets"""
    try:
        # Tenta obter as credenciais das variáveis de ambiente
        creds_json = os.environ.get('GOOGLE_CREDENTIALS_JSON')
        if creds_json:
            creds_dict = json.loads(creds_json)
            credentials = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
            return gspread.authorize(credentials)
        else:
            # Fallback para arquivo local (desenvolvimento)
            credentials = Credentials.from_service_account_file('credentials.json', scopes=SCOPES)
            return gspread.authorize(credentials)
    except Exception as e:
        print(f"Erro ao configurar credenciais: {e}")
        return None

def get_worksheet():
    """Obtém a planilha do Google Sheets"""
    try:
        gc = get_google_credentials()
        if gc:
            spreadsheet = gc.open_by_key(SPREADSHEET_ID)
            return spreadsheet.worksheet(SHEET_NAME)
        return None
    except Exception as e:
        print(f"Erro ao acessar planilha: {e}")
        return None

def parse_timestamp(timestamp_str):
    """Converte timestamp da planilha para formato padrão"""
    try:
        # Formato da planilha: "21/06/2025 14:39:55"
        dt = datetime.strptime(timestamp_str, "%d/%m/%Y %H:%M:%S")
        return dt.strftime("%d/%m/%Y, %H:%M:%S")
    except:
        return timestamp_str

def generate_request_id(row_index):
    """Gera ID da solicitação baseado na linha"""
    return f"EMP{str(row_index).zfill(3)}"

def read_sheet_data():
    """Lê todos os dados da planilha"""
    try:
        worksheet = get_worksheet()
        if not worksheet:
            return []
        
        # Obtém todos os valores da planilha
        all_values = worksheet.get_all_values()
        
        if len(all_values) < 2:  # Sem dados além do cabeçalho
            return []
        
        headers = all_values[0]
        data_rows = all_values[1:]
        
        solicitacoes = []
        
        for i, row in enumerate(data_rows, start=2):  # Linha 2 é a primeira linha de dados
            if len(row) < 6:  # Pula linhas incompletas
                continue
                
            # Mapear colunas da planilha
            solicitacao = {
                'id': generate_request_id(i),
                'timestamp': parse_timestamp(row[0]) if row[0] else '',
                'solicitante': row[1] if len(row) > 1 else '',
                'area': row[2] if len(row) > 2 else '',
                'tipoOperacao': row[3] if len(row) > 3 else '',
                'codigoItem': row[4] if len(row) > 4 else '',
                'tempoAtendimento': row[5] if len(row) > 5 else '',
                'observacao': row[6] if len(row) > 6 else '',
                'local': row[7] if len(row) > 7 else '',
                # Colunas adicionais para controle do operador
                'status': row[8] if len(row) > 8 and row[8] else 'pendente',
                'observacaoOperador': row[9] if len(row) > 9 else '',
                'horarioInicio': row[10] if len(row) > 10 else None,
                'horarioConclusao': row[11] if len(row) > 11 else None,
                'operador': row[12] if len(row) > 12 else '',
                'row_index': i  # Índice da linha para atualizações
            }
            
            solicitacoes.append(solicitacao)
        
        return solicitacoes
        
    except Exception as e:
        print(f"Erro ao ler dados da planilha: {e}")
        return []

def update_sheet_row(row_index, status, observacao_operador='', horario_inicio='', horario_conclusao='', operador=''):
    """Atualiza uma linha específica na planilha"""
    try:
        worksheet = get_worksheet()
        if not worksheet:
            return False
        
        # Colunas para atualizar (I=9, J=10, K=11, L=12, M=13)
        updates = []
        
        # Coluna I (9): Status
        if status:
            updates.append({
                'range': f'I{row_index}',
                'values': [[status]]
            })
        
        # Coluna J (10): Observação do Operador
        if observacao_operador:
            updates.append({
                'range': f'J{row_index}',
                'values': [[observacao_operador]]
            })
        
        # Coluna K (11): Horário de Início
        if horario_inicio:
            updates.append({
                'range': f'K{row_index}',
                'values': [[horario_inicio]]
            })
        
        # Coluna L (12): Horário de Conclusão
        if horario_conclusao:
            updates.append({
                'range': f'L{row_index}',
                'values': [[horario_conclusao]]
            })
        
        # Coluna M (13): Operador
        if operador:
            updates.append({
                'range': f'M{row_index}',
                'values': [[operador]]
            })
        
        # Executa todas as atualizações
        for update in updates:
            worksheet.update(update['range'], update['values'])
        
        return True
        
    except Exception as e:
        print(f"Erro ao atualizar planilha: {e}")
        return False

def ensure_sheet_headers():
    """Garante que a planilha tenha todas as colunas necessárias"""
    try:
        worksheet = get_worksheet()
        if not worksheet:
            return False
        
        # Headers esperados
        expected_headers = [
            'Carimbo de data/hora',
            'Solicitante', 
            'Área',
            'Tipo de Operação',
            'Código do Item',
            'Tempo de Atendimento',
            'Observação (opcional)',
            'Local',
            'Status',
            'Observação do Operador',
            'Horário de Início',
            'Horário de Conclusão',
            'Operador'
        ]
        
        # Verifica se os headers existem
        current_headers = worksheet.row_values(1)
        
        # Adiciona headers faltantes
        if len(current_headers) < len(expected_headers):
            missing_headers = expected_headers[len(current_headers):]
            start_col = len(current_headers) + 1
            
            for i, header in enumerate(missing_headers):
                col_letter = chr(ord('A') + start_col - 1 + i)
                worksheet.update(f'{col_letter}1', header)
        
        return True
        
    except Exception as e:
        print(f"Erro ao configurar headers: {e}")
        return False

# Endpoints da API

@app.route('/api/sheets/health', methods=['GET'])
def health_check():
    """Verifica se o serviço está funcionando"""
    try:
        worksheet = get_worksheet()
        if worksheet:
            return jsonify({"status": "ok", "message": "Backend e Google Sheets funcionando"})
        else:
            return jsonify({"status": "error", "message": "Erro ao conectar com Google Sheets"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": f"Erro: {str(e)}"}), 500

@app.route('/api/sheets/read-data', methods=['GET'])
def read_data():
    """Lê dados da planilha Google Sheets"""
    try:
        # Garante que os headers estão corretos
        ensure_sheet_headers()
        
        # Lê os dados
        solicitacoes = read_sheet_data()
        
        return jsonify({
            "success": True, 
            "data": solicitacoes,
            "count": len(solicitacoes)
        })
        
    except Exception as e:
        print(f"Erro ao ler dados: {e}")
        return jsonify({
            "success": False, 
            "error": str(e),
            "data": []
        }), 500

@app.route('/api/sheets/update-status', methods=['POST'])
def update_status():
    """Atualiza status de uma solicitação na planilha"""
    try:
        data = request.get_json()
        request_id = data.get('requestId')
        status = data.get('status')
        observacao = data.get('observacaoOperador', '')
        horario_inicio = data.get('horarioInicio', '')
        horario_conclusao = data.get('horarioConclusao', '')
        operador = data.get('operador', 'Sistema')
        
        if not request_id or not status:
            return jsonify({
                "success": False, 
                "error": "requestId e status são obrigatórios"
            }), 400
        
        # Extrai o número da linha do ID (EMP001 -> linha 2)
        try:
            row_number = int(request_id.replace('EMP', ''))
            row_index = row_number  # O número já corresponde à linha correta
        except:
            return jsonify({
                "success": False, 
                "error": "ID de solicitação inválido"
            }), 400
        
        # Atualiza a planilha
        success = update_sheet_row(
            row_index=row_index,
            status=status,
            observacao_operador=observacao,
            horario_inicio=horario_inicio,
            horario_conclusao=horario_conclusao,
            operador=operador
        )
        
        if success:
            return jsonify({
                "success": True, 
                "message": "Status atualizado com sucesso na planilha"
            })
        else:
            return jsonify({
                "success": False, 
                "error": "Erro ao atualizar planilha"
            }), 500
            
    except Exception as e:
        print(f"Erro ao atualizar status: {e}")
        return jsonify({
            "success": False, 
            "error": str(e)
        }), 500

@app.route('/api/sheets/read-status', methods=['GET'])
def read_status():
    """Lê status das solicitações (compatibilidade)"""
    try:
        solicitacoes = read_sheet_data()
        
        # Converte para formato de status
        status_data = {}
        for sol in solicitacoes:
            status_data[sol['id']] = {
                'status': sol['status'],
                'observacaoOperador': sol['observacaoOperador'],
                'horarioInicio': sol['horarioInicio'],
                'horarioConclusao': sol['horarioConclusao']
            }
        
        return jsonify({
            "success": True, 
            "data": status_data
        })
        
    except Exception as e:
        return jsonify({
            "success": False, 
            "error": str(e)
        }), 500

@app.route('/', methods=['GET'])
def home():
    """Página inicial da API"""
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
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)

