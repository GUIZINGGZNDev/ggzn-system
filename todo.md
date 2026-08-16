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
