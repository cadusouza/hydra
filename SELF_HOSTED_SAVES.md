# Saves self-hosted (fork)

Este fork envia os backups de save do Hydra para um servidor próprio
([hydra-saves-server](https://github.com/cadusouza/hydra-saves-server)) em vez
do Hydra Cloud, sem exigir assinatura.

## Configurar em cada dispositivo

Crie o arquivo `self-hosted-saves.json` na pasta de dados do Hydra:

| Sistema | Caminho |
| ------- | ------- |
| Windows | `%APPDATA%\hydralauncher\self-hosted-saves.json` |
| Linux   | `~/.config/hydralauncher/self-hosted-saves.json` |

```json
{
  "url": "https://saves.appcadu.com",
  "token": "TOKEN-DESTE-DISPOSITIVO"
}
```

Reinicie o Hydra. Alternativa: variáveis de ambiente `HYDRA_SAVES_URL` e
`HYDRA_SAVES_TOKEN`. Para desativar sem apagar o arquivo, use
`"enabled": false`.

## O que muda

- Todas as chamadas `/profile/games/artifacts...` vão para o seu servidor
  (`src/main/services/self-hosted-saves.ts`, roteado em `hydra-api.ts`).
- O painel de cloud save e o upload automático (ao abrir/fechar o jogo)
  funcionam sem assinatura Hydra Cloud.
- Jogos Steam usam o sistema "legacy" (artifacts + Ludusavi) em vez do
  Cloud Save v2, que o servidor não implementa.
- Login, perfil, amigos etc. continuam usando a conta Hydra normal.

## Limitações

- Jogos Epic e saves de emuladores (RPCS3, RetroArch, shadPS4) usam o
  protocolo v2/emulation-saves, que ainda não é suportado.
- O restore é manual (botão no painel de cloud save do jogo).

## Atualizar com o upstream

```bash
git remote add upstream https://github.com/hydralauncher/hydra
git fetch upstream
git rebase upstream/main
```
