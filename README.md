# iGreen MOB · Migre sua bandeira

Hotsite que o licenciado iGreen envia a donos de eletroposto: proposta de migração de bandeira com simulador de receita
e uma página interna com o eletroposto iGreen em 3D.

- `index.html` — a proposta (home)
- `eletroposto.html` — o eletroposto iGreen em 3D (carregador, camadas de receita, cobertura, letreiro e vagas)
- `config.js` — dados do consultor (nome, cidade, WhatsApp, foto). Também dá para passar pelo link:
  `/?nome=Thiago%20Souza&cidade=Belo%20Horizonte%20%C2%B7%20MG&whats=5531999999999`

Site estático, sem build: na Vercel, importe o repositório com o preset **Other**, sem comando de build e com a raiz como pasta de saída.

Esta pasta é gerada a partir do projeto de trabalho por `scripts/exportar-deploy.js`; ajustes devem ser feitos lá e exportados de novo.
