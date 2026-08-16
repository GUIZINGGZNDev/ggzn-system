# GGZN SYSTEM

Bot de WhatsApp para automação de grupos, com estética brutalista premium, hierarquia de cargos, múltiplos prefixos, comandos administrativos, utilidades para membros e recursos de diversão com limites antiabuso.

> O repositório não contém credenciais, arquivos `.env` nem a sessão persistida do WhatsApp. Esses dados são locais e ficam protegidos pelo `.gitignore`.

## Visão geral

O projeto combina **Node.js**, **TypeScript**, **Express**, **React**, **Vite**, **Drizzle ORM**, **MySQL** e **Baileys**. A interface pública é acessível sem login, enquanto as rotas de conexão do proprietário permanecem protegidas no backend. A sessão WhatsApp é persistida localmente para permitir restauração após reinícios.

| Camada | Responsabilidade |
| --- | --- |
| `server/bot/manager.ts` | Ciclo de vida Baileys, QR privado, reconexão e restauração de sessão |
| `server/bot/commands.ts` | Roteamento, cargos, prefixos e comandos |
| `server/bot/routes.ts` | Status público e endpoints de conexão protegidos |
| `server/db.ts` | Persistência e cache de grupos, membros, cargos e sessão |
| `client/src/pages/Home.tsx` | Landing page, catálogo de comandos e saúde da conexão |
| `drizzle/schema.ts` | Modelo persistente do sistema |

## Desenvolvimento

Instale as dependências com `pnpm install` e configure as variáveis exigidas pelo ambiente Manus/WebDev. Em seguida, execute `pnpm dev`. O site e a API ficam disponíveis na mesma porta fornecida pelo servidor de desenvolvimento; não fixe uma porta dentro do código de produção.

Os comandos de validação são:

```bash
pnpm test -- --run
pnpm exec tsc --noEmit
pnpm build
```

## Prefixos e comandos

O prefixo padrão é `!`. Exemplos: `!menu`, `!piada`, `!sticker`, `!banir` e `!silenciar`. O sistema suporta múltiplos prefixos configuráveis por grupo, com permissões respeitando a hierarquia **Dono**, **Administrador**, **Moderador** e **Membro**.

Os comandos destrutivos de spam e trava-zap permanecem bloqueados. Recursos de zoeira são limitados por antiabuso e não devem ser usados para prejudicar pessoas ou grupos.

## Segurança da sessão

A pasta `.bot-session/` contém material sensível de autenticação Baileys e nunca deve ser enviada ao GitHub. O QR e o código de conexão são temporários, privados e destinados somente ao proprietário do número configurado. Em produção, prefira o transporte oficial do WhatsApp Business quando houver necessidade de estabilidade operacional e conformidade de longo prazo.

## GitHub

O código-fonte é mantido em um repositório privado: [GUIZINGGZNDev/whatsapp-bot-node](https://github.com/GUIZINGGZNDev/whatsapp-bot-node). O workflow de CI executa testes e verificação TypeScript a cada push e pull request. Nunca adicione tokens, cookies, credenciais, dumps de banco ou arquivos da sessão em commits.
