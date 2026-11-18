# Agent OS — Documentação funcional

## O que faz
O Agent OS é um painel que abre no browser e mostra, em tempo real, o que a equipa de agentes do
Claude Code está a fazer. A equipa aparece como uma rede de nós (Grafo); quando dois agentes trocam uma mensagem, a ligação entre eles acende. Não
muda nada no trabalho dos agentes — só observa.

## Para quem
Para quem usa a equipa, enquanto a equipa trabalha num projeto ou num gig, para saber quem está a fazer o quê
sem ler o terminal.

## Fluxos de utilizador (user flows)

### 1. Ver a equipa a trabalhar
1. Corre `npm run dev` na pasta `projects/agent-os` e abre http://localhost:4100.
2. O painel escolhe sozinho a sessão mais recente da pasta `product-team`.
3. A vista **Equipa** mostra um nó por agente, com a sua cor, o estado (ativo, inativo, terminado) e
   o que está a fazer agora (por exemplo, "Edit → app/page.tsx"). Os nós podem ser arrastados e
   o grafo tem zoom.
4. Quando um agente manda uma mensagem a outro, a ligação entre os dois acende durante 4 segundos e
   mostra o início da mensagem. O **Feed** (painel direito) recebe cada evento sem atualizar a página.
5. No Grafo, os nós podem ser arrastados e a posição fica guardada; a roda do rato faz zoom.

### 2. Seguir um agente em detalhe
1. Clica num nó (no telemóvel, toca: o Inspetor sobe do fundo do ecrã).
2. O **Inspetor** mostra o modelo, o número de ferramentas, erros e tokens, e a linha temporal
   desse agente por ordem cronológica: o pedido que recebeu, cada ferramenta, os resultados (erros a
   vermelho) e as mensagens trocadas.
3. Na **linha do tempo da sessão** (em baixo), cada agente tem uma pista; clicar num bloco seleciona
   o agente e leva o Inspetor a esse momento.

### 3. Mudar de sessão
1. Clica em **Sessões** na barra lateral.
2. Escolhe outra sessão da lista (mostra título e hora da última atividade).
3. Quando começa uma sessão nova, o painel muda para ela, a não ser que tenhas escolhido uma à mão.

### 4. Ver o estado de um projeto
1. Clica em **Projetos** na barra lateral.
2. Cada projeto mostra a lista de entregáveis (brief, plano, testes, SEO, documentação…) com um
   visto ou uma cruz, e os bugs abertos por gravidade.

### 5. Ver tarefas e memória
- **Tarefas**: a lista de tarefas partilhada pela equipa, com estado e dono. Se a sessão não tiver lista, mostra as
  tarefas de cada agente escritas no plano (`PLAN.md`) do projeto escolhido; estas não têm estado ao vivo.
- **Memória**: as lições que cada agente guardou dos trabalhos anteriores.

## Regras de negócio (business rules)
- **Ativo** = o agente registou atividade nos últimos 60 segundos. **Inativo** = sem atividade há
  mais de 60 segundos. **Terminado** = o agente acabou a tarefa.
- Cada agente tem sempre a mesma cor: tech-lead âmbar, frontend ciano, backend violeta, QA verde,
  growth rosa, outros cinza.
- O raciocínio interno dos agentes ("thinking") nunca é mostrado.
- Textos longos são cortados a 500 caracteres; comandos a 120.
- Um entregável conta como presente quando o ficheiro existe na pasta do projeto.
- Um bug conta como aberto enquanto não estiver marcado como verificado, fechado ou "won't fix".
- O painel só lê ficheiros; não escreve em `~/.claude` nem no repositório.
- Se perder a ligação ao servidor, o indicador passa a "desligado" e volta a ligar sozinho.
- Só funciona nesta máquina (localhost); não está publicado na internet.
