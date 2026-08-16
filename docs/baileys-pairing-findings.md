# Baileys pairing findings

A documentação oficial consultada em 16/08/2026 indica que o código de conexão deve ser solicitado somente quando `sock.authState.creds.registered` é falso e quando o socket já recebeu o evento `qr`; solicitar cedo demais pode falhar porque o socket ainda não está pronto. O número deve conter apenas dígitos e incluir o código do país. O código retornado tem oito caracteres e deve ser inserido em WhatsApp > Configurações > Aparelhos conectados > Conectar aparelho > Conectar com número de telefone.

A documentação de ciclo de vida classifica 401 como `loggedOut` e recomenda não reconectar automaticamente nesse caso; sessões inválidas devem exigir reautenticação. O issue https://github.com/WhiskeySockets/Baileys/issues/2590 relata que pairing code pode ser gerado, mas a vinculação falhar em versões 7.0.0-rc13/rc14; a reprodução usa `fetchLatestBaileysVersion()` e solicita o código dentro do evento `connection.update` quando `qr` aparece.

Fontes:
- https://baileys.wiki/authentication/pairing-code
- https://whiskeysockets-baileys-94.mintlify.app/concepts/connection
- https://github.com/WhiskeySockets/Baileys/issues/2590
