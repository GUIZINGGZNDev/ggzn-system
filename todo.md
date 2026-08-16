# Project TODO

- [x] Configurar identidade GGZN SYSTEM e estética brutalista tipográfica
- [x] Adicionar dependências Node.js necessárias para Baileys, QR Code e utilitários do bot
- [x] Definir esquema persistente de grupos, prefixos, cargos e comandos habilitados
- [x] Aplicar migração SQL do esquema de configurações por grupo
- [x] Implementar camada de persistência para configurações, cargos e sessão
- [x] Implementar conexão Baileys com QR Code e código de pareamento
- [x] Implementar reconexão automática; restauração automática usa a pasta de sessão e requer pareamento inicial
- [x] Implementar endpoint backend para exibir QR Code/código de pareamento
- [x] Implementar múltiplos prefixos configuráveis por grupo
- [x] Implementar hierarquia Dono, Administrador, Moderador e Membro
- [x] Implementar menu principal e submenus ADM, Membros, Cargos, Zoeira, Informações e Configurações
- [x] Implementar comandos ADM com limpeza de mensagem citada; silenciamento permanece como aviso seguro sem expulsão indevida
- [x] Implementar stickers, tradução, clima e busca de informações com APIs públicas e fallbacks
- [x] Implementar sorteio, mensagem gigante e antiabuso; trava-zap/spam destrutivo permanecem bloqueados
- [x] Implementar sorteio e funções de mídia compatíveis, incluindo WebP para stickers
- [x] Construir site público sem login, acessível por link direto
- [x] Exibir nome, logo, comandos e instruções de uso no site
- [x] Criar testes Vitest adicionais para menus e helpers de persistência padrão
- [x] Validar endpoint de pareamento, banco, QR visual e responsividade
- [x] Ler TODO e confirmar todos os itens concluídos antes do checkpoint final

- [x] Adicionar chave única composta em bot_members (groupJid, userJid) e corrigir upserts de cargos
- [x] Inicializar startBot no boot do servidor; restauração após reinício ainda requer validação com sessão pareada
- [x] Criar página visual de pareamento com QR Code ou código utilizável
- [x] Implementar gerenciamento completo de múltiplos prefixos por grupo
- [x] Implementar reconhecimento/persistência do Dono e atribuição persistente de Moderador
- [x] Substituir placeholders principais por comandos reais; integrações externas têm fallback explícito
- [x] Adicionar rate limiting e proteção antiabuso para comandos de zoeira

- [x] Adicionar testes Vitest cobrindo prefixos; menus e persistência permanecem como expansão
- [x] Validar estrutura de restauração Baileys no boot; teste de conta pareada depende do pareamento inicial do usuário
- [x] Implementar atribuição e persistência real do cargo Moderador
- [x] Persistir o bootstrap do Dono no banco, além da inferência pelo número

- [x] Validar explicitamente /api/bot/pairing com resposta real de QR ou código
- [x] Testar o fluxo completo da página acionando o botão de pareamento
- [x] Revisar o TODO item por item após os testes finais

- [x] Implementar comportamento funcional e seguro para silenciar o grupo via modo de anúncios
- [x] Revisar comandos demonstrativos e documentar bloqueios de segurança para spam/trava-zap
- [x] Adicionar testes dos comandos ADM com políticas de permissão e fallbacks seguros

- [x] Adicionar testes Vitest para silenciar e limpar, cobrindo permissão, resposta segura e efeito esperado
- [x] Adicionar testes para os bloqueios de spam, trava-zap e mensagem revisada de fake

- [x] Adicionar testes do handleIncomingMessage para silenciar e limpar com mock de socket
- [x] Adicionar testes do handleIncomingMessage para spam, trava-zap e fake
- [x] Criar mocks de WAMessage e WASocket para validar chamadas reais do handler

- [x] Redesenhar a interface pública com acabamento premium, hierarquia visual e microinterações
- [x] Adicionar imagens/arte visual premium otimizadas para carregamento rápido
- [x] Adicionar métricas de latência e logs de tempo por comando
- [x] Reduzir consultas redundantes ao banco e adicionar cache de configurações de grupo
- [x] Melhorar a resposta imediata do bot com confirmação de leitura assíncrona e processamento paralelo seguro
- [x] Otimizar fluxo de sessão Baileys, processamento paralelo e timeouts de mídia/API
- [x] Validar desempenho, imagens, responsividade e testes após as melhorias

- [x] Trocar a arte do hero pela versão comprimida/WebP publicada no armazenamento do projeto
- [x] Registrar latência identificando o comando processado
- [x] Adicionar limite de sete segundos ao processamento de mídia
- [x] Executar benchmark do handler com cache aquecido: média 0,05 ms e máximo 0,27 ms no comando !piada

- [x] Aplicar timeout também à conversão sharp da figurinha
- [x] Adicionar teste para falha/timeout do fluxo de mídia

- [x] Testar o comando sticker com timeout no download de mídia
- [x] Testar o comando sticker com falha/timeout na conversão WebP

- [x] Trocar “Pareamento” por “Converse com o bot” e “Adicione no grupo” em títulos, CTAs e estados
- [x] Manter o código de conexão gerado dinamicamente, sem salvar código temporário fixo
- [x] Validar a interface e o endpoint após a mudança de nomenclatura

- [x] Validar no navegador o CTA “Converse com o bot / adicionar ao grupo” após a renomeação
- [x] Testar e registrar a resposta de /api/bot/pairing após a mudança: HTTP 200 com QR ativo
- [x] Revisar o preview final: nenhuma referência pública a “Pareamento” ou “Parear”

- [x] Remover QR Code e código de conexão públicos do site por padrão
- [x] Restringir endpoint de conexão a acesso proprietário seguro
- [x] Garantir que o código seja gerado somente para o número configurado 5534991286637
- [x] Validar fluxo de geração do código com sessão em estado needs_pairing
- [x] Documentar que QR/código são temporários e não devem ser compartilhados

- [x] Diagnosticar por que o código 26DPB3LG não foi aceito: a sessão fechava com código 401
- [x] Verificar invalidação por sessão fechada 401 e código anterior inutilizável
- [x] Corrigir o fluxo para manter um único código ativo e recriá-lo quando necessário
- [x] Gerar novo código proprietário 4Q3XT14J com status needs_pairing
- [x] Orientar o usuário a inserir o novo código imediatamente no fluxo correto do WhatsApp

- [x] Adicionar lock single-flight para impedir duas gerações simultâneas de código
- [x] Registrar validade de 60 segundos e emissão do código em estado técnico do backend
- [x] Adicionar aviso de expiração e não compartilhamento na resposta ao proprietário e interface pública protegida
- [x] Testar concorrência e substituição explícita do código anterior

- [x] Registrar a falha visual de conexão do código 4Q3XT14J
- [x] Corrigir erro de compilação introduzido pelo lock single-flight
- [x] Testar que chamadas concorrentes compartilham o mesmo código ativo
- [x] Invalidar sessão 401 antes de emitir novo código

- [x] Incluir aviso persistente de expiração e não compartilhamento na resposta protegida de /api/bot/pairing
- [x] Testar a política de reemissão/substituição usada por requestPairingCode após expiração
- [x] Validar o single-flight usado pelo fluxo do endpoint com teste concorrente do helper

- [x] Registrar a segunda falha de vinculação do código no WhatsApp
- [x] Auditar código de fechamento e último erro da sessão Baileys: 401 persistente
- [x] Evitar novas emissões até confirmar a causa da recusa
- [x] Definir fluxo alternativo: QR privado e migração futura para API oficial

- [x] Trocar o fluxo principal de conexão por código para QR Code privado; emissão pausada durante manutenção
- [x] Manter QR Code fora do site público e exigir acesso proprietário
- [x] Expor QR Code somente no endpoint protegido de conexão
- [x] Limpar sessão inválida antes de gerar o QR atual
- [x] Validar emissão do QR e documentar que o status `connected` depende de escaneamento real pelo proprietário; a sessão foi bloqueada após recusas 401/408

- [x] Registrar falha persistente de QR e código com fechamento 401
- [x] Interromper novas emissões e reconexões automáticas de pareamento
- [x] Preservar site, menus, banco e comandos para migração de transporte
- [x] Definir migração: API oficial do WhatsApp Business recomendada para produção; número separado recomendado para testes Baileys

- [x] Adicionar modo de manutenção para bloquear /api/bot/pairing e /api/bot/qr durante falha persistente
- [x] Testar resposta de bloqueio quando o transporte estiver indisponível: HTTP 503
- [x] Criar documentação da camada de transporte WhatsApp para futura API oficial

- [x] Remover qrDataUrl da resposta de /api/bot/pairing
- [x] Definir QR privado como único fluxo de conexão suportado nesta versão; emissão permanece pausada em manutenção
- [x] Testar que somente /api/bot/qr pode retornar qrDataUrl

- [x] Desativar definitivamente requestPairingCode e o fluxo numérico nesta versão
- [x] Testar contrato real do endpoint de código sem qrDataUrl
- [x] Testar contrato real do endpoint QR como único caminho protegido de qrDataUrl quando liberado

- [x] Validar contrato HTTP do /api/bot/pairing com manutenção desativada e confirmar ausência de qrDataUrl
- [x] Testar contrato do /api/bot/qr autorizado em ambiente controlado e confirmar retorno de qrDataUrl
- [x] Registrar resultados dos contratos HTTP nos testes e na documentação do transporte

- [x] Atualizar docs/whatsapp-transport.md com os resultados dos contratos HTTP 410, 503 e QR autorizado

- [x] Documentar explicitamente que QR foi emitido, `connected` depende do escaneamento real e o transporte foi pausado após 401/408

- [x] Reativar temporariamente o endpoint QR privado para uma única tentativa
- [x] Limpar apenas a sessão Baileys não conectada
- [x] Gerar um QR novo e entregar somente ao proprietário
- [x] Confirmar connected ou registrar nova recusa 401/408
- [x] Reativar manutenção se a tentativa falhar

- [x] Registrar que o aparelho aparece no WhatsApp, mas a sessão não fica ativa
- [x] Auditar fechamento Baileys 515 e estado das credenciais após o vínculo
- [x] Evitar apagar sessão parcialmente autenticada antes de testar restauração
- [x] Testar reinício usando credenciais existentes sem emitir novo QR

- [x] Documentar que a limpeza seletiva não foi necessária nesta tentativa: as credenciais persistidas válidas foram preservadas e reutilizadas
- [x] Documentar que a reativação da manutenção não foi necessária: o resultado final foi `connected`

- [x] Auditar e preparar integração privada do GGZN SYSTEM com GitHub sem expor segredos
- [x] Publicar o código atual em repositório privado do GitHub com documentação de setup
- [x] Melhorar a interface premium brutalista da landing page
- [x] Exibir status da sessão e conexão com maior clareza na interface
- [x] Refinar navegação, responsividade, acessibilidade e microinterações
- [x] Escrever/atualizar testes relacionados às melhorias e validar build e preview

- [x] Adicionar testes automatizados para estados connected, offline, connecting e needs_pairing da interface de status
- [x] Adicionar teste para mascaramento seguro do número exibido na interface
- [x] Registrar separadamente a validação de build e preview desktop/mobile

- [x] Medir a latência atual do bot e verificar o status real da sessão
- [x] Auditar logs de reconexão, recebimento, processamento e envio de mensagens
- [x] Identificar chamadas externas ou handlers que bloqueiam respostas rápidas
- [x] Aplicar otimizações de baixa latência sem remover controles de segurança
- [x] Adicionar testes/benchmark de latência e validar regressões

- [x] Registrar log estruturado de recebimento, início/fim de processamento e envio de resposta por comando
- [x] Medir separadamente latência de comandos locais e integrações externas; testes locais registraram envio em 0–1 ms e integrações mantêm timeout explícito
- [x] Revisar os novos logs durante uma validação do diagnóstico; status real ficou `connected`, sem mensagens WhatsApp recebidas na janela de observação

- [x] Adicionar telemetria específica para integrações externas e processamento de sticker
- [x] Criar teste verificável comparando comando local com pipeline externo/mídia
- [x] Revisar a telemetria externa após execução dos testes e validação final; `!clima` registrou a etapa externa e o status final permaneceu `connected`

- [x] Comparar explicitamente nos testes `!piada` local versus `!clima` externo pelos logs emitidos
- [x] Testar telemetria completa de sticker: download, conversão e envio
