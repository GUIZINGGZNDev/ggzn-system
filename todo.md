# Project TODO

- [x] Configurar identidade GGZN SYSTEM e estética brutalista tipográfica
- [x] Adicionar dependências Node.js necessárias para Baileys, QR Code e utilitários do bot
- [x] Definir esquema persistente de grupos, prefixos, cargos e comandos habilitados
- [x] Aplicar migração SQL do esquema de configurações por grupo
- [x] Implementar camada de persistência para configurações, cargos e sessão
- [x] Implementar conexão Baileys com QR Code e código de pareamento
- [ ] Implementar reconexão automática e validar restauração da sessão após reinício
- [x] Implementar endpoint backend para exibir QR Code/código de pareamento
- [x] Implementar múltiplos prefixos configuráveis por grupo
- [x] Implementar hierarquia Dono, Administrador, Moderador e Membro
- [x] Implementar menu principal e submenus ADM, Membros, Cargos, Zoeira, Informações e Configurações
- [ ] Completar implementação real dos comandos ADM: silenciar e limpar ainda dependem de tratamento de mensagens
- [ ] Completar integrações reais de mídia, tradução, clima e busca de informações
- [ ] Completar recursos de zoeira de mídia; antiabuso básico já implementado
- [ ] Implementar sorteio e funções de mídia compatíveis com a infraestrutura disponível
- [x] Construir site público sem login, acessível por link direto
- [x] Exibir nome, logo, comandos e instruções de uso no site
- [ ] Criar testes Vitest adicionais para menus e helpers de persistência
- [x] Validar endpoint de pareamento, banco, QR visual e responsividade
- [x] Ler TODO e confirmar todos os itens concluídos antes do checkpoint final

- [x] Adicionar chave única composta em bot_members (groupJid, userJid) e corrigir upserts de cargos
- [x] Inicializar startBot no boot do servidor; restauração após reinício ainda requer validação com sessão pareada
- [x] Criar página visual de pareamento com QR Code ou código utilizável
- [x] Implementar gerenciamento completo de múltiplos prefixos por grupo
- [x] Implementar reconhecimento/persistência do Dono e atribuição persistente de Moderador
- [ ] Substituir placeholders por implementações reais dos comandos ADM e de membros quando houver suporte técnico disponível
- [x] Adicionar rate limiting e proteção antiabuso para comandos de zoeira

- [x] Adicionar testes Vitest cobrindo prefixos; menus e persistência permanecem como expansão
- [ ] Validar restauração da sessão Baileys após reinício do servidor com número pareado
- [x] Implementar atribuição e persistência real do cargo Moderador
- [x] Persistir o bootstrap do Dono no banco, além da inferência pelo número

- [x] Validar explicitamente /api/bot/pairing com resposta real de QR ou código
- [x] Testar o fluxo completo da página acionando o botão de pareamento
- [x] Revisar o TODO item por item após os testes finais
