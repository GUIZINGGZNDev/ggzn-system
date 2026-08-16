# Camada de transporte do WhatsApp

O GGZN SYSTEM separa a lógica de negócio da conexão com o WhatsApp. O módulo `server/bot/manager.ts` é o transporte atual baseado em Baileys e concentra sessão, eventos, reconexão e pareamento. O módulo `server/bot/commands.ts` contém menus, cargos, permissões e respostas e não deve depender de QR, código ou detalhes de socket. O banco em `server/db.ts` mantém grupos, prefixos, cargos, comandos e estado de sessão independentemente do provedor. O site em `client/src/pages/Home.tsx` apresenta a marca, comandos e status sem expor credenciais.

O transporte Baileys foi colocado em manutenção após recusas persistentes do WhatsApp com fechamento 401 durante QR e código. Novas requisições para `/api/bot/pairing` e `/api/bot/qr` retornam HTTP 503 por padrão. Para reativar temporariamente o transporte após diagnóstico, a variável `BOT_PAIRING_MAINTENANCE=false` deve ser configurada no ambiente do servidor. A alternativa recomendada para produção é implementar um adaptador da API oficial do WhatsApp Business mantendo os mesmos contratos de comandos, banco e site.

QRs e códigos de conexão são temporários, devem ser usados somente pelo proprietário e nunca devem aparecer em páginas públicas ou ser compartilhados.

## Contratos de conexão validados

Os testes de contrato confirmam que `/api/bot/pairing` retorna **HTTP 410** e não inclui `qrDataUrl`, pois o código numérico foi desativado nesta versão. O modo de manutenção padrão faz `/api/bot/pairing` e `/api/bot/qr` retornarem **HTTP 503** para impedir novas emissões durante a falha persistente. Em ambiente controlado, com manutenção desativada e credencial proprietária, somente `/api/bot/qr` pode retornar `qrDataUrl`; o contrato está coberto por `server/bot/routes.contract.test.ts`.

O QR foi emitido com sucesso durante a validação, mas o estado `connected` só pode ser confirmado depois do escaneamento real pelo proprietário no WhatsApp. Como as tentativas de QR e código terminaram com recusas 401 e 408, o transporte foi pausado por padrão para evitar novas emissões e possíveis bloqueios; a confirmação de `connected` permanece uma etapa operacional do proprietário após a futura reativação ou migração.
