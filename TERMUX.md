# GGZN SYSTEM no Termux

Este guia descreve como executar o GGZN SYSTEM em um aparelho Android usando Termux. O repositório deve ser **privado**. Nunca publique o arquivo `.env`, a pasta `.bot-session`, QR Codes, códigos de pareamento, cookies, tokens ou logs de conexão.

## Limitações importantes

O Termux é adequado para testes, manutenção e execução controlada, mas o Android pode suspender processos, encerrar a aplicação ou mudar de rede. Para reduzir interrupções, mantenha o aparelho carregado, desative a otimização de bateria do Termux e use `tmux`. Para operação contínua de produção, a hospedagem gerenciada do Manus ou um servidor persistente é mais confiável.

## 1. Instalar o Termux

Prefira uma distribuição atual do Termux por uma fonte confiável, como [F-Droid](https://f-droid.org/packages/com.termux/) ou o repositório oficial do projeto. Depois de abrir o aplicativo, atualize os pacotes:

```bash
pkg update -y && pkg upgrade -y
pkg install -y git nodejs-lts pnpm tmux openssh
termux-setup-storage
```

Aceite a permissão de armazenamento somente se precisar acessar arquivos do aparelho. Não coloque a sessão do WhatsApp em pastas sincronizadas ou compartilhadas.

## 2. Baixar o repositório privado

No GitHub, use o botão **Code → HTTPS** e substitua a URL abaixo pela URL do repositório privado:

```bash
cd $HOME
git clone https://github.com/SEU_USUARIO/ggzn-system.git
git config --global credential.helper store
cd $HOME/ggzn-system
```

O GitHub pode pedir autenticação por token ou por chave SSH. Nunca cole um token em mensagens, commits ou arquivos do projeto. Para maior segurança, prefira uma chave SSH:

```bash
ssh-keygen -t ed25519 -C "ggzn-termux"
cat ~/.ssh/id_ed25519.pub
```

Adicione a chave pública em **GitHub → Settings → SSH and GPG keys** e clone usando o endereço SSH do repositório.

## 3. Instalar dependências e configurar o ambiente

```bash
cd $HOME/ggzn-system
pnpm install --frozen-lockfile
nano .env
```

Crie o arquivo `.env` manualmente; ele não deve ser commitado. O arquivo deve conter somente os valores fornecidos no painel de segredos do projeto. Em particular, mantenha privados `DATABASE_URL`, `JWT_SECRET`, `BUILT_IN_FORGE_API_KEY`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `OWNER_NAME` e as configurações do bot. Se a instalação do Termux for independente da hospedagem Manus, será necessário fornecer os serviços externos e o banco compatíveis com essa execução; copiar o `.env` de produção sem revisão não é recomendado.

Defina também um diretório de sessão fora do repositório:

```bash
mkdir -p $HOME/.ggzn-session
printf '\nBOT_SESSION_DIR=%s/.ggzn-session\n' "$HOME" >> .env
```

A sessão Baileys contém credenciais sensíveis. Não faça backup dela em GitHub, não a envie por WhatsApp e não compartilhe QR Codes.

## 4. Validar antes de iniciar

```bash
pnpm check
pnpm test -- --run
pnpm run build
```

Se os testes ou o build falharem, corrija o problema antes de iniciar o transporte do WhatsApp.

## 5. Executar em modo de desenvolvimento

```bash
pnpm dev
```

Para manter o processo em uma sessão persistente do Termux:

```bash
tmux new -s ggzn
cd $HOME/ggzn-system
pnpm dev
```

Desanexe com `Ctrl+B` e depois `D`. Para voltar:

```bash
tmux attach -t ggzn
```

Não use `nohup` sem logs e sem entender como encerrar o processo. Para parar o bot, use o controle de pausa do painel ou encerre o processo de forma consciente.

## 6. Vínculo do WhatsApp

Com o serviço iniciado, abra o painel de gerenciamento protegido, solicite o QR Code e escaneie em **WhatsApp → Dispositivos conectados → Conectar dispositivo**. O QR é temporário. Depois do vínculo, confirme no painel que o estado mudou para **CONNECTED** e envie `!id` ou `!menu` em um grupo de teste.

Se aparecer o código `401`, a sessão foi invalidada e será necessário um novo vínculo. Não apague a sessão automaticamente: confirme a operação e gere um QR novo pelo painel.

## 7. Atualizar o código

Pare o processo ou use uma janela separada do `tmux` antes de atualizar:

```bash
cd $HOME/ggzn-system
git pull --ff-only
pnpm install --frozen-lockfile
pnpm check
pnpm test -- --run
pnpm run build
pnpm start
```

Se houver alterações locais, não use `git reset --hard` sem revisar o conteúdo. Faça backup apenas dos arquivos de configuração seguros; nunca versione a sessão do WhatsApp.

## 8. Verificações de segurança

Antes de qualquer envio para o GitHub, execute:

```bash
git status --short
git ls-files | grep -E '(^|/)(\.env|\.bot-session|credentials|auth_info)' || true
```

O segundo comando deve retornar vazio. Se encontrar um arquivo sensível já rastreado, pare e remova-o do histórico antes de publicar. Rotacione imediatamente qualquer segredo que tenha sido exposto.

## 9. Operação 24/7

O Termux pode ser interrompido pelo Android mesmo com `tmux`. Para reduzir o risco, use `termux-wake-lock`, mantenha a bateria e a rede estáveis e configure o Termux:Boot somente depois de validar o processo manualmente. Para produção, considere manter o bot na hospedagem gerenciada e usar o Termux apenas como terminal de administração.

## 10. Nunca faça

Não publique o repositório como público; não coloque credenciais em `README.md`; não envie a pasta `.bot-session`; não cole o QR no GitHub; não desative a proteção do endpoint de QR; não execute comandos copiados de fontes desconhecidas; e não altere permissões de proprietário sem confirmar o identificador real.
