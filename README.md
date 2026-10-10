# iGreen MOB · Migre sua bandeira

Hotsite que o licenciado iGreen envia a donos de eletroposto: proposta de migração de bandeira com simulador de receita
e uma página interna com o eletroposto iGreen em 3D.

- `index.html` — a proposta (home)
- `eletroposto.html` — o eletroposto iGreen em 3D (carregador, camadas de receita, cobertura, letreiro e vagas)
- `contador.html` + `contador/` — a contagem regressiva do lançamento oficial iGreen MOB (10/10/2026, 20h), em **/contador**,
  com as duas cenas (`/contador#painel` e `/contador#revelacao`); tudo o que ela usa fica na pasta `contador/` (css, js, img)
- `config.js` — dados do consultor (nome, cidade, WhatsApp, foto). Também dá para passar pelo link:
  `/?nome=Thiago%20Souza&cidade=Belo%20Horizonte%20%C2%B7%20MG&whats=5531999999999`

Site estático, sem build: na Vercel, importe o repositório com o preset **Other**, sem comando de build e com a raiz como pasta de saída.

Esta pasta é gerada a partir do projeto de trabalho por `scripts/exportar-deploy.js` (a contagem, por `scripts/exportar-contador.js`); ajustes devem ser feitos lá e exportados de novo.
